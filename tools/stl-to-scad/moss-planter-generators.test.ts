import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mossPlanter } from '../../packages/contracts/src/index.ts';
import { detectRunner, renderScad, type Defines } from './openscad.ts';
import { bounds, parseStl, size, volume } from './stl.ts';
import { analyzeTopology } from './topology.ts';

const directory = fileURLToPath(new URL('../../models/moss-planter/', import.meta.url));
const reference = fileURLToPath(new URL('../../models/moss-planter/reference/', import.meta.url));

describe('moss planter generators', () => {
  const sources = [...new Set(mossPlanter.parts.map(part => part.sourcePath))];

  it('are credited, self-contained, and take the tower diameter', async () => {
    expect(sources).toHaveLength(4);
    for (const relative of sources) {
      const source = await readFile(join(directory, '..', '..', relative), 'utf8');
      expect(source, relative).toContain('HpInvent');
      expect(source, relative).toContain('https://makerworld.com/de/models/1200114-moss-tower-verdura-the-modular-climbing-support');
      expect(source, relative).not.toMatch(/^\s*(include|use)\s*</m);
      expect(source, relative).toMatch(/^TOWER_DIAMETER\s*=\s*52;/m);
    }
  });

  it('declare exactly the variables their part mappings override', async () => {
    for (const part of mossPlanter.parts) {
      const source = await readFile(join(directory, '..', '..', part.sourcePath), 'utf8');
      for (const name of Object.values(part.scadMapping ?? {})) expect(source, `${part.id} ${name}`).toMatch(new RegExp(`^${name}\\s*=`, 'm'));
    }
  });
});

// Rendering needs an OpenSCAD runtime, so it is opt-in: set STL_TO_SCAD_RENDER_TESTS=1 (the Docker integration workflow does).
const runner = process.env['STL_TO_SCAD_RENDER_TESTS'] ? await detectRunner() : undefined;

async function render(file: string, defines: Defines) {
  const mesh = parseStl((await renderScad(join(directory, file), defines)).stl);
  expect(analyzeTopology(mesh)).toMatchObject({ watertight: true, bodies: 1, degenerate: 0 });
  return mesh;
}

describe.skipIf(!runner)('moss planter generators reproduce the original parts', () => {
  // [generator, defines, reference STL, tolerance on the bounding box]. The small parts are exact scaled copies; the RAUTE
  // lattices are reconstructions (IoU 0.97 at best) so their volume is compared loosely.
  const cases: [string, Defines, string][] = [
    ['cap.scad', { TOWER_DIAMETER: '52' }, 'obj_10_Moosstab AbdeckkappeV2.stl'],
    ['cap.scad', { TOWER_DIAMETER: '100' }, 'obj_7_Moosstab AbdeckkappeV2.stl'],
    ['helper.scad', { TOWER_DIAMETER: '52' }, 'obj_6_Moosstab Planting Helper V3.stl'],
    ['helper.scad', { TOWER_DIAMETER: '100' }, 'obj_8_Moosstab Planting Helper V3.stl'],
    ['spike.scad', { TOWER_DIAMETER: '52', SPIKE_LENGTH: '124.003' }, 'obj_3_erdspiessV2.stl'],
    ['spike.scad', { TOWER_DIAMETER: '100', SPIKE_LENGTH: '238.467' }, 'obj_2_erdspiessV2.stl'],
  ];
  it.each(cases)('%s %j matches %s', async (file, defines, original) => {
    const mesh = await render(file, defines);
    const source = parseStl(await readFile(join(reference, original)));
    size(bounds(source)).forEach((value, axis) => { expect(Math.abs(value - (size(bounds(mesh))[axis] ?? 0))).toBeLessThan(0.05); });
    expect(Math.abs(volume(mesh) / volume(source) - 1)).toBeLessThan(0.005);
  }, 120_000);

  it.each([
    [{ TOWER_DIAMETER: '52', ROWS: '4' }, 'obj_5_Moosstab Middle RAUTE small.stl'],
    [{ TOWER_DIAMETER: '52', ROWS: '10' }, 'obj_4_Moosstab Middle RAUTE.stl'],
  ] as [Defines, string][])('raute.scad %j matches %s', async (defines, original) => {
    const mesh = await render('raute.scad', defines);
    const source = parseStl(await readFile(join(reference, original)));
    size(bounds(source)).forEach((value, axis) => { expect(Math.abs(value - (size(bounds(mesh))[axis] ?? 0))).toBeLessThan(0.1); });
    expect(Math.abs(volume(mesh) / volume(source) - 1)).toBeLessThan(0.02);
  }, 240_000);
});

describe.skipIf(!runner)('moss planter generators at intermediate and unusual settings', () => {
  it.each([
    ['cap.scad', { TOWER_DIAMETER: '77' }, [77, 77, 22.207]],
    ['helper.scad', { TOWER_DIAMETER: '63' }, [102.98, 102.98, 117.52]],
    ['spike.scad', { TOWER_DIAMETER: '77', SPIKE_LENGTH: '200' }, [60.94, 60.94, 200]],
    ['raute.scad', { TOWER_DIAMETER: '63', ROWS: '3', COLUMNS: '8' }, [63, 63, 0]],
  ] as [string, Defines, [number, number, number]][])('%s %j is one closed solid of the scaled size', async (file, defines, dimensions) => {
    const mesh = await render(file, defines);
    size(bounds(mesh)).forEach((value, axis) => {
      const expected = dimensions[axis] ?? 0;
      if (expected > 0) expect(Math.abs(value - expected), `${file} axis ${axis}`).toBeLessThan(0.1);
    });
  }, 240_000);
});
