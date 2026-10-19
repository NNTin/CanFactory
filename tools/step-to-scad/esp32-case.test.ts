import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { esp32C3SuperminiCase as model } from '@canfactory/contracts';
import { inspectStl, renderScad } from '@canfactory/server';
import { parseStl } from '../stl-to-scad/stl.ts';
import { verifyMeshes } from '../stl-to-scad/verify.ts';

const exec = promisify(execFile);
// Real OpenSCAD and independent supplied meshes, enabled in the integration workflow.
const renderTests = process.env['STL_TO_SCAD_RENDER_TESTS'] === '1' ? describe : describe.skip;
renderTests('ESP32-C3 STEP conversion against the supplied 3MFs', () => {
  for (const part of model.parts) it(`${part.id}: preserves geometry as one closed printable body`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'canfactory-step-'));
    try {
      const reference = join(directory, 'source.stl');
      await exec('python3', ['tools/step-to-scad/reference_3mf.py', `models/${model.id}/references/${part.id}.3mf`, reference, ...(part.id === 'top' ? ['--flip-x'] : [])]);
      const original = await readFile(reference);
      const rendered = await renderScad(resolve(part.sourcePath), part.id === 'top' ? { LED_HOLES: 'false' } : {});
      const result = verifyMeshes(parseStl(original), original, rendered.stl, rendered, { name: part.id, scad: part.sourcePath, stl: reference, scadBytes: (await readFile(part.sourcePath)).length });
      expect(result.failures).toEqual([]);
      expect(result.comparison.iou).toBeGreaterThan(0.995);
      const info = inspectStl(rendered.stl);
      expect(info.meshRepairs ?? 0).toBe(0);
      const exactVolume = part.id === 'bottom' ? 1330.8783020667368 : 570.158588470339;
      expect(Math.abs(info.volume / exactVolume - 1)).toBeLessThan(0.0001);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }, 60_000);
});
