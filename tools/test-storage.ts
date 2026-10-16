import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { fruitFlyTrap } from '@canfactory/contracts';
import { ObjectStorage, PostgresStorage, repositoryRoot, inspectStl, RENDERER_IMAGE } from '@canfactory/server';
import { createApp } from '../apps/api/src/app.ts';
import { renderJob, type OpenScadRunner } from '../apps/worker/src/render.ts';
import { startStorageServices } from './storage-services.ts';

const exec = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'canfactory-storage-test-'));
const stores: PostgresStorage[] = [];
let admin: Pool | undefined;
// Its own containers even when TEST_DATABASE_URL is set: this test pauses them, and starts from an empty database.
delete process.env['TEST_DATABASE_URL'];
const services = await startStorageServices('canfactory-storage-test');
try {
  assert.ok(services.containers);
  const { postgres, garage, docker } = services.containers;
  const config = services.objects;
  admin = new Pool({ connectionString: services.databaseUrl, connectionTimeoutMillis: 1000 });
  admin.on('error', () => undefined);
  const control = admin;
  for (let i = 0; i < 3; i++) stores.push(new PostgresStorage(services.databaseUrl, repositoryRoot, join(directory, `scratch-${i}`), new ObjectStorage(config)));
  const [first, second, third] = stores;
  assert.ok(first && second && third);
  await Promise.all([first.migrate(), second.migrate()]);
  await Promise.all([first.seed(), second.seed()]);
  await first.ready();
  await first.pool.query(`UPDATE model_revisions SET detail = detail - 'artifactFormat' - 'customizable'`);
  await second.seed();
  assert.ok((await second.listModels()).every(entry => ['stl', 'zip'].includes(entry.artifactFormat) && typeof entry.customizable === 'boolean'), 'reseeding must refresh stored model details');
  // The offers service: a feed's rows replace that feed's earlier rows, and keep their types through PostgreSQL.
  const awinRow = { advertiserId: 777, merchantProductId: 'SKU-1', market: 'DE' as const, deepLink: 'https://www.awin1.com/pclick.php?p=1', name: 'M3 inserts',
    price: 4.99, currency: 'EUR', deliveryCost: null, inStock: true, lastImported: 1_791_000_000_000 };
  await first.saveAwinFeed({ feedId: 42, advertiserId: 777, lastImported: awinRow.lastImported }, [awinRow, { ...awinRow, merchantProductId: 'SKU-2', inStock: null }]);
  await second.saveAwinFeed({ feedId: 42, advertiserId: 777, lastImported: awinRow.lastImported + 1 }, [{ ...awinRow, lastImported: awinRow.lastImported + 1 }]);
  assert.deepEqual(await first.awinOffers([{ advertiserId: 777, merchantProductId: 'SKU-1', market: 'DE' }, { advertiserId: 777, merchantProductId: 'SKU-2', market: 'DE' }]),
    [{ ...awinRow, lastImported: awinRow.lastImported + 1 }]);
  assert.deepEqual(await first.awinFeeds(), [{ feedId: 42, advertiserId: 777, lastImported: awinRow.lastImported + 1 }]);
  const apis = await Promise.all([createApp(first), createApp(second)]);
  try {
    const model = await first.getModel(fruitFlyTrap.id); assert.ok(model);
    const original = await readFile(join(repositoryRoot, fruitFlyTrap.referencePath));
    const reference = await apis[0].inject(`/api/v1/models/${fruitFlyTrap.id}/reference.stl`);
    assert.deepEqual(reference.rawPayload, original);
    const duplicates = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      (i % 2 ? first : second).enqueue(fruitFlyTrap, fruitFlyTrap.defaults)));
    assert.equal(new Set(duplicates.map(job => job.id)).size, 1);
    const claims = await Promise.all([first.claim(), second.claim(), third.claim()]);
    assert.equal(claims.filter(Boolean).length, 1);
    const job = claims.find(Boolean); assert.ok(job?.leaseToken);
    const file = join(directory, 'artifact.stl');
    const token = job.leaseToken;
    const runner: OpenScadRunner = async (args, signal) => {
      const mapped = args.map(arg => arg.startsWith(directory) ? arg.replace(directory, '/data') : arg.startsWith(repositoryRoot) ? arg.replace(repositoryRoot, '/app') : arg);
      await exec('docker', ['run', '--rm', '--init', '--network', 'none', '--cpus', '2', '--memory', '2g',
        '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        '--mount', `type=bind,src=${repositoryRoot},dst=/app,readonly`, '--mount', `type=bind,src=${directory},dst=/data`,
        RENDERER_IMAGE, 'timeout', '120', 'openscad', ...mapped], { signal, maxBuffer: 1_048_576 });
    };
    const renew = setInterval(() => { void first.renew(job.id, token).catch(() => undefined); }, 5000);
    try { assert.equal(await renderJob(first, job, new AbortController().signal, runner), true); }
    finally { clearInterval(renew); }
    const preview = await apis[0].inject(`/api/v1/renders/${job.id}/stl`);
    const download = await apis[1].inject(`/api/v1/renders/${job.id}/stl?download=true`);
    assert.equal(preview.statusCode, 200); assert.equal(download.statusCode, 200);
    assert.deepEqual(preview.rawPayload, download.rawPayload);
    const metadata = inspectStl(preview.rawPayload);
    await writeFile(file, preview.rawPayload);
    assert.equal(createHash('sha256').update(download.rawPayload).digest('hex'), metadata.sha256);
    assert.match(String(download.headers['content-disposition']), /attachment/);
    assert.equal((await second.enqueue(fruitFlyTrap, fruitFlyTrap.defaults)).id, job.id);
    console.log('PASS real PostgreSQL/Garage migration, seeding, cross-API deduplication, atomic claim and identical STL bytes');

    const interrupted = await first.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 61 });
    const old = await first.claim(); assert.ok(old?.leaseToken); assert.equal(old.id, interrupted.id);
    await control.query('UPDATE render_jobs SET lease_until=0 WHERE id=$1', [old.id]);
    assert.equal(await first.renew(old.id, old.leaseToken), false);
    await Promise.all([second.recover(), third.recover()]);
    const retry = await second.claim(); assert.ok(retry?.leaseToken); assert.equal(retry.attempts, 2);
    await first.fail(old.id, old.leaseToken, { code: 'STALE', message: 'stale', issues: [] });
    assert.equal(await first.complete(old.id, old.leaseToken, metadata, file), false);
    assert.equal((await third.getJob(old.id))?.status, 'running');
    await control.query('UPDATE render_jobs SET lease_until=0 WHERE id=$1', [old.id]);
    await Promise.all([first.recover(), second.recover()]);
    assert.equal((await third.getJob(old.id))?.error?.code, 'WORKER_INTERRUPTED');
    console.log('PASS lease expiry, concurrent recovery, second-interruption failure and stale success/failure fencing');

    await control.query('UPDATE render_jobs SET expires_at=0');
    for (const api of apis) {
      assert.equal((await api.inject(`/api/v1/renders/${job.id}`)).statusCode, 410);
      assert.equal((await api.inject(`/api/v1/renders/${job.id}/stl`)).statusCode, 410);
    }
    await Promise.all([first.cleanup(), second.cleanup()]);
    assert.equal((await control.query<{ n: number }>('SELECT count(*)::int AS n FROM render_jobs')).rows[0]?.['n'], 0);
    assert.equal(await first.objects.exists(config.generatedBucket, `renders/${job.id}/${job.leaseToken}.stl`), false);
    assert.equal(await first.objects.exists(config.catalogueBucket, model.referenceName), true);
    console.log('PASS expiry across replicas, physical deletion and persistent catalogue references');

    const submissions = await Promise.allSettled(Array.from({ length: 24 }, (_, i) =>
      (i % 2 ? first : second).enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 70 + i })));
    assert.equal(submissions.filter(item => item.status === 'fulfilled').length, 16);
    assert.equal(submissions.filter(item => item.status === 'rejected').length, 8);
    const simultaneous = await Promise.all([first.claim(), second.claim(), third.claim()]);
    assert.equal(new Set(simultaneous.map(item => item?.id)).size, 3);
    console.log('PASS global admission limit and distinct simultaneous worker claims');

    const uploadJob = simultaneous[0]; assert.ok(uploadJob?.leaseToken);
    const originalPut = first.objects.put.bind(first.objects);
    first.objects.put = async (...args: Parameters<ObjectStorage['put']>) => {
      await originalPut(...args);
      await control.query('UPDATE render_jobs SET lease_until=0 WHERE id=$1', [uploadJob.id]);
    };
    assert.equal(await first.complete(uploadJob.id, uploadJob.leaseToken, metadata, file), false);
    first.objects.put = originalPut;
    assert.notEqual((await second.getJob(uploadJob.id))?.status, 'succeeded');
    await first.cleanup();
    assert.equal(await first.objects.exists(config.generatedBucket, `renders/${uploadJob.id}/${uploadJob.leaseToken}.stl`), false);
    console.log('PASS lease loss after upload does not publish and abandoned upload is collected');

    await first.heartbeat(randomUUID());
    assert.equal(await second.workerReady(), true);
    assert.match(await first.metrics(), /canfactory_jobs\{status="queued"\} 13/);

    await control.query('UPDATE render_jobs SET expires_at=0');
    await first.cleanup();
    const publication = await first.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 159 });
    const publishing = await first.claim(); assert.ok(publishing?.leaseToken); assert.equal(publishing.id, publication.id);
    const blocker = await control.connect();
    first.objects.put = async (...args: Parameters<ObjectStorage['put']>) => {
      await originalPut(...args);
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE render_jobs IN ACCESS EXCLUSIVE MODE');
    };
    try { await assert.rejects(first.complete(publishing.id, publishing.leaseToken, metadata, file)); }
    finally { await blocker.query('ROLLBACK'); blocker.release(); first.objects.put = originalPut; }
    assert.equal((await second.getJob(publication.id))?.status, 'running');
    assert.equal((await apis[1].inject(`/api/v1/renders/${publication.id}/stl`)).statusCode, 409);
    const abandonedKey = `renders/${publishing.id}/${publishing.leaseToken}.stl`;
    assert.equal(await first.objects.exists(config.generatedBucket, abandonedKey), true);
    await control.query('UPDATE render_jobs SET lease_until=0 WHERE id=$1', [publication.id]);
    await second.recover();
    const originalListing = first.objects.generatedObjects.bind(first.objects);
    // Advance only the orphan's age; retain the real object/queue and database clock.
    first.objects.generatedObjects = async function* () {
      for await (const object of originalListing()) yield { ...object, modified: 0 };
    };
    try { await first.cleanup(); } finally { first.objects.generatedObjects = originalListing; }
    assert.equal(await first.objects.exists(config.generatedBucket, abandonedKey), false);
    console.log('PASS upload followed by real database lock timeout never publishes; orphan is collected after grace');

    const recovered = await first.claim(); assert.ok(recovered?.leaseToken);
    assert.equal(await first.complete(recovered.id, recovered.leaseToken, metadata, file), true);
    const recoveredKey = `renders/${recovered.id}/${recovered.leaseToken}.stl`;
    await control.query('UPDATE render_jobs SET expires_at=0 WHERE id=$1', [recovered.id]);
    const originalRemove = first.objects.remove.bind(first.objects);
    first.objects.remove = () => Promise.reject(new Error('Injected object deletion failure'));
    try { await first.cleanup(); } finally { first.objects.remove = originalRemove; }
    assert.equal(await first.getJob(recovered.id), undefined);
    assert.equal(await first.objects.exists(config.generatedBucket, recoveredKey), true);
    const deletion = await control.query<{ attempts: number }>('SELECT attempts FROM object_deletions WHERE object_key=$1', [recoveredKey]);
    assert.equal(deletion.rows[0]?.attempts, 1);
    await control.query('UPDATE object_deletions SET retry_after=0 WHERE object_key=$1', [recoveredKey]);
    await second.cleanup();
    assert.equal(await first.objects.exists(config.generatedBucket, recoveredKey), false);
    assert.equal(await first.objects.exists(config.catalogueBucket, model.referenceName), true);
    console.log('PASS expired settings disappear despite failed object deletion; durable retry removes file and preserves references');

    const uploadInterrupted = await first.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 157 });
    const uploadClaim = await first.claim(); assert.ok(uploadClaim?.leaseToken); assert.equal(uploadClaim.id, uploadInterrupted.id);
    const cancellation = new AbortController();
    await docker('pause', garage);
    const cancelUpload = setTimeout(() => cancellation.abort(), 250);
    try {
      const outcome = await Promise.race([
        first.complete(uploadClaim.id, uploadClaim.leaseToken, metadata, file, cancellation.signal).then(() => 'resolved', () => 'rejected'),
        delay(3000, 'hung', { ref: false }),
      ]);
      assert.equal(outcome, 'rejected', 'Shutdown must abort an outstanding S3 upload promptly');
    } finally { clearTimeout(cancelUpload); await docker('unpause', garage); }
    assert.equal((await apis[1].inject(`/api/v1/renders/${uploadClaim.id}/stl`)).statusCode, 409);
    await control.query('UPDATE render_jobs SET lease_until=0 WHERE id=$1', [uploadClaim.id]);
    await second.recover();
    const uploadRetry = await second.claim(); assert.ok(uploadRetry?.leaseToken); assert.equal(uploadRetry.attempts, 2);
    assert.equal(await second.complete(uploadRetry.id, uploadRetry.leaseToken, metadata, file), true);
    console.log('PASS cancelled in-flight Garage upload stays unpublished and another worker can recover');

    const committedUpload = await first.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 158 });
    const committedClaim = await first.claim(); assert.ok(committedClaim?.leaseToken); assert.equal(committedClaim.id, committedUpload.id);
    const afterUpload = new AbortController();
    first.objects.put = async (...args: Parameters<ObjectStorage['put']>) => { await originalPut(...args); afterUpload.abort(); };
    try { await assert.rejects(first.complete(committedClaim.id, committedClaim.leaseToken, metadata, file, afterUpload.signal)); }
    finally { first.objects.put = originalPut; }
    const interruptedKey = `renders/${committedClaim.id}/${committedClaim.leaseToken}.stl`;
    assert.equal(await first.objects.exists(config.generatedBucket, interruptedKey), true);
    assert.equal((await apis[0].inject(`/api/v1/renders/${committedClaim.id}/stl`)).statusCode, 409);
    await control.query('UPDATE render_jobs SET lease_until=0 WHERE id=$1', [committedClaim.id]);
    first.objects.generatedObjects = async function* () {
      for await (const object of originalListing()) yield { ...object, modified: 0 };
    };
    try { await first.cleanup(); } finally { first.objects.generatedObjects = originalListing; }
    assert.equal(await first.objects.exists(config.generatedBucket, interruptedKey), false);
    assert.equal(await first.objects.exists(config.generatedBucket, `renders/${uploadRetry.id}/${uploadRetry.leaseToken}.stl`), true);
    console.log('PASS cancellation after upload never publishes; orphan cleanup preserves the winning artifact');

    await docker('pause', garage);
    try { await assert.rejects(first.ready()); } finally { await docker('unpause', garage); }
    await first.ready();
    await docker('pause', postgres);
    try {
      const outcome = await Promise.race([first.ready().then(() => 'resolved', () => 'rejected'), delay(15_000, 'hung', { ref: false })]);
      assert.equal(outcome, 'rejected', 'Database outage must have a client-side deadline');
    } finally { await docker('unpause', postgres); }
    await first.ready();
    console.log('PASS Garage and PostgreSQL outages fail readiness and recover without process restart');

  } finally { await Promise.all(apis.map(api => api.close())); }
} finally {
  await Promise.all(stores.map(store => store.close()));
  await admin?.end();
  await services.stop();
  await rm(directory, { recursive: true, force: true });
}
