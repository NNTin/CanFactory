import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { detectRunner, renderScad } from './openscad.ts';
import { bounds, parseStl, size, volume } from './stl.ts';
import { analyzeTopology } from './topology.ts';
import { readManifest } from './verify.ts';

const directory = fileURLToPath(new URL('../../models/moss-planter/reference/', import.meta.url));
const scadFiles = (await readdir(directory)).filter(name => name.endsWith('.scad')).sort();

/** A twin is its partner scaled by 100/52: everything but the header comment block and the SCALE line must match. */
const TWINS: [twin: string, original: string][] = [
  ['obj_1_Moosstab Middle RAUTE small.scad', 'obj_5_Moosstab Middle RAUTE small.scad'],
  ['obj_2_erdspiessV2.scad', 'obj_3_erdspiessV2.scad'],
  ['obj_7_Moosstab AbdeckkappeV2.scad', 'obj_10_Moosstab AbdeckkappeV2.scad'],
  ['obj_8_Moosstab Planting Helper V3.scad', 'obj_6_Moosstab Planting Helper V3.scad'],
];

const body = (source: string): string => source.split('\n').filter(line => !line.startsWith('//') && !/^SCALE\s*=/.test(line)).join('\n');

describe('moss planter SCAD reconstructions', () => {
  it('has one SCAD per source model, each credited and self-contained', async () => {
    expect(scadFiles).toHaveLength(10);
    for (const name of scadFiles) {
      const source = await readFile(join(directory, name), 'utf8');
      expect(source, name).toContain('HpInvent');
      expect(source, name).toContain('https://makerworld.com/de/models/1200114-moss-tower-verdura-the-modular-climbing-support');
      expect(source, name).not.toMatch(/^\s*(include|use)\s*</m);
      expect(source, name).toMatch(/^SCALE\s*=/m);
      expect(Buffer.byteLength(source), name).toBeLessThan(50_000);
    }
  });

  it('keeps every scaled twin identical to its original apart from the header and SCALE', async () => {
    for (const [twin, original] of TWINS) {
      const [a, b] = await Promise.all([readFile(join(directory, twin), 'utf8'), readFile(join(directory, original), 'utf8')]);
      expect(body(a), twin).toBe(body(b));
      expect(a, twin).toMatch(/^SCALE\s*=\s*100 \/ 52;/m);
    }
  });

  it('lists every SCAD in the verification manifest', async () => {
    const manifest = await readManifest(join(directory, 'manifest.json'));
    expect(manifest.parts.map(part => part.scad).sort()).toEqual(scadFiles);
  });
});

// Rendering needs an OpenSCAD runtime, so it is opt-in: set STL_TO_SCAD_RENDER_TESTS=1 (the Docker integration workflow does).
const runner = process.env['STL_TO_SCAD_RENDER_TESTS'] ? await detectRunner() : undefined;

describe.skipIf(!runner)('moss planter renders (small parts)', () => {
  const cases: [file: string, dimensions: [number, number, number]][] = [
    ['obj_10_Moosstab AbdeckkappeV2.scad', [52, 52, 15]],
    ['obj_3_erdspiessV2.scad', [41.15, 41.15, 124.003]],
    ['obj_6_Moosstab Planting Helper V3.scad', [85, 85, 97]],
  ];
  it.each(cases)('%s renders one closed solid of the expected size', async (file, dimensions) => {
    const rendered = await renderScad(join(directory, file));
    const mesh = parseStl(rendered.stl);
    expect(analyzeTopology(mesh)).toMatchObject({ watertight: true, bodies: 1, degenerate: 0 });
    expect(volume(mesh)).toBeGreaterThan(0);
    size(bounds(mesh)).forEach((value, axis) => { expect(Math.abs(value - (dimensions[axis] ?? 0))).toBeLessThan(0.05); });
  }, 120_000);
});
