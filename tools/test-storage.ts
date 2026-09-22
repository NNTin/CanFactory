import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { fruitFlyTrap } from '@canfactory/contracts';
import { ObjectStorage, PostgresStorage, repositoryRoot, inspectStl, RENDERER_IMAGE, type ObjectConfig } from '@canfactory/server';
import { createApp } from '../apps/api/src/app.ts';
import { renderJob, type OpenScadRunner } from '../apps/worker/src/render.ts';

const exec = promisify(execFile);
const suffix = randomBytes(6).toString('hex');
const name = `canfactory-storage-test-${suffix}`;
const directory = await mkdtemp(join(tmpdir(), `${name}-`));
const password = randomBytes(24).toString('hex');
const keyId = `GK${randomBytes(16).toString('hex')}`;
const keySecret = randomBytes(32).toString('hex');
const environment = { ...process.env, POSTGRES_PASSWORD: password,
  GARAGE_DEFAULT_ACCESS_KEY: keyId, GARAGE_DEFAULT_SECRET_KEY: keySecret, GARAGE_DEFAULT_BUCKET: 'generated' };
const containers: string[] = [];
const volumes: string[] = [];
const stores: PostgresStorage[] = [];
let admin: Pool | undefined;
const docker = async (...args: string[]) => {
  try { return (await exec('docker', args, { env: environment, maxBuffer: 1_048_576 })).stdout.trim(); }
  catch { throw new Error(`Isolated Docker ${args[0] ?? 'operation'} failed; credentials suppressed.`); }
};
async function waitFor(action: () => Promise<void>): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await action(); return; } catch { await delay(200); }
  }
  throw new Error('Isolated storage services did not become ready within 20 seconds.');
}
try {
  await docker('network', 'create', name);
  for (const service of ['postgres', 'garage']) {
    const volume = `${name}-${service}`;
    await docker('volume', 'create', volume); volumes.push(volume);
  }
  const postgres = `${name}-postgres`;
  await docker('run', '-d', '--name', postgres, '--network', name, '--memory', '768m', '--cpus', '1',
    '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_USER=canfactory', '-e', 'POSTGRES_DB=canfactory',
    '-p', '127.0.0.1::5432', '-v', `${postgres}:/var/lib/postgresql`,
    'postgres:18.6-trixie@sha256:86c951e05bf56c93d95d397747fb8820ac76cc3bedb78f43abd83eedbe3666ae');
  containers.push(postgres);
  const configPath = join(directory, 'garage.toml');
  await writeFile(configPath, `metadata_dir = "/data/meta"\ndata_dir = "/data/objects"\ndb_engine = "lmdb"\nreplication_factor = 1\nrpc_bind_addr = "0.0.0.0:3901"\nrpc_public_addr = "127.0.0.1:3901"\nrpc_secret = "${randomBytes(32).toString('hex')}"\n[s3_api]\ns3_region = "garage"\napi_bind_addr = "0.0.0.0:3900"\n`, { mode: 0o600 });
  const garage = `${name}-garage`;
  await docker('run', '-d', '--name', garage, '--network', name, '--memory', '512m', '--cpus', '1',
    '-e', 'GARAGE_DEFAULT_ACCESS_KEY', '-e', 'GARAGE_DEFAULT_SECRET_KEY', '-e', 'GARAGE_DEFAULT_BUCKET',
    '-p', '127.0.0.1::3900', '-v', `${garage}:/data`, '-v', `${configPath}:/etc/garage.toml:ro`,
    'dxflrs/garage:v2.4.1@sha256:9c96caa2612d3411acc5b0e6701fb238dbfba33e533a6d7d3d811a4b12d0d020',
    '/garage', 'server', '--single-node', '--default-bucket');
  containers.push(garage);
  const pgPort = (await docker('port', postgres, '5432')).split(':').at(-1);
  const s3Port = (await docker('port', garage, '3900')).split(':').at(-1);
  assert.ok(pgPort && s3Port);
  const databaseUrl = `postgresql://canfactory:${password}@127.0.0.1:${pgPort}/canfactory`;
  admin = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 1000 });
  admin.on('error', () => undefined);
  const control = admin;
  await waitFor(async () => { await control.query('SELECT 1'); });
  await waitFor(async () => { await docker('exec', garage, '/garage', 'status'); });
  await docker('exec', garage, '/garage', 'bucket', 'create', 'catalogue');
  await docker('exec', garage, '/garage', 'bucket', 'allow', '--read', '--write', '--owner', 'catalogue', '--key', keyId);
  const config: ObjectConfig = { endpoint: `http://127.0.0.1:${s3Port}`, region: 'garage', accessKeyId: keyId,
    secretAccessKey: keySecret, catalogueBucket: 'catalogue', generatedBucket: 'generated' };
  for (let i = 0; i < 3; i++) stores.push(new PostgresStorage(databaseUrl, repositoryRoot, join(directory, `scratch-${i}`), new ObjectStorage(config)));
  const [first, second, third] = stores;
  assert.ok(first && second && third);
  await waitFor(() => first.objects.ready());
  await Promise.all([first.migrate(), second.migrate()]);
  await Promise.all([first.seed(), second.seed()]);
  await first.ready();
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
  for (const container of containers.reverse()) await docker('rm', '-f', container);
  for (const volume of volumes) await docker('volume', 'rm', volume);
  await docker('network', 'rm', name);
  await rm(directory, { recursive: true, force: true });
}
