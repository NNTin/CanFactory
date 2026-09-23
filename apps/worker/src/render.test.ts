import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mossPlanter } from '@canfactory/contracts';
import { repositoryRoot, Store } from '@canfactory/server';
import { renderJob, type OpenScadRunner } from './render.ts';

type Point = [number, number, number];
type Triangle = [Point, Point, Point];

/** Binary STL for a unit tetrahedron translated by `offset` on X, so parts differ (not required, just realistic). */
function tetrahedronStl(offset: number): Buffer {
  const a: Point = [offset, 0, 0]; const b: Point = [offset + 10, 0, 0]; const c: Point = [offset, 10, 0]; const d: Point = [offset, 0, 10];
  const triangles: Triangle[] = [[a, c, b], [a, b, d], [a, d, c], [b, c, d]];
  const bytes = Buffer.alloc(84 + triangles.length * 50);
  bytes.writeUInt32LE(triangles.length, 80);
  triangles.forEach((triangle, index) => triangle.flat().forEach((value, coordinate) => bytes.writeFloatLE(value, 84 + index * 50 + 12 + coordinate * 4)));
  return bytes;
}

/** A fake runner never invokes OpenSCAD: it writes a synthetic valid STL to whatever `-o` path was requested. The
 * real moss-planter SCAD files must still exist on disk (repositoryRoot) so fingerprinting/path resolution succeed;
 * their content is irrelevant here since no real render happens. */
function fakeRunner(invocations: string[][]): OpenScadRunner {
  let offset = 0;
  return (args) => {
    invocations.push(args);
    const output = args[args.indexOf('-o') + 1];
    if (!output) throw new Error('Expected an -o argument');
    writeFileSync(output, tetrahedronStl(offset)); offset += 5;
    return Promise.resolve();
  };
}

let directory: string;
let store: Store;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'canfactory-render-test-'));
  store = new Store(directory, repositoryRoot); store.migrate(); store.seed();
});
afterEach(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });

describe('renderJob for an assembly model', () => {
  it('renders each part with no -D overrides, zips them, stamps attribution, and stores combined metadata', async () => {
    const invocations: string[][] = [];
    const job = store.enqueue(mossPlanter, {});
    const claimed = store.claim();
    if (!claimed?.leaseToken) throw new Error('Expected to claim the job');

    const published = await renderJob(store, claimed, new AbortController().signal, fakeRunner(invocations));
    expect(published).toBe(true);
    expect(invocations).toHaveLength(mossPlanter.parts.length);
    for (const args of invocations) {
      expect(args).not.toContain('-D');
      expect(args.slice(0, 4)).toEqual(['--backend', 'Manifold', '--export-format', 'binstl']);
    }

    const result = store.getJob(job.id);
    expect(result?.status).toBe('succeeded');
    if (!result?.artifact || !('parts' in result.artifact)) throw new Error('Expected an assembly artifact');
    expect(result.artifact.parts).toHaveLength(mossPlanter.parts.length);
    expect(result.artifact.parts.map(part => part.id)).toEqual(mossPlanter.parts.map(part => part.id));
    expect(result.artifact.triangles).toBe(result.artifact.parts.reduce((sum, part) => sum + part.triangles, 0));
    expect(result.artifact.volume).toBeCloseTo(result.artifact.parts.reduce((sum, part) => sum + part.volume, 0));

    const zipBytes = readFileSync(store.artifacts.path(job.id, 'zip'));
    expect(zipBytes.length).toBe(result.artifact.bytes);
    const entries = unzipSync(new Uint8Array(zipBytes));
    expect(Object.keys(entries).sort()).toEqual(mossPlanter.parts.map(part => `${part.id}.stl`).sort());
    for (const [name, bytes] of Object.entries(entries)) {
      const header = Buffer.from(bytes.buffer, bytes.byteOffset, 80).toString('utf8');
      expect(header, name).toContain(`CanFactory | ${mossPlanter.license} | ${mossPlanter.attribution}`);
    }
  });
});
