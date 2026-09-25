import { describe, expect, it } from 'vitest';
import { detectRunner, renderScad } from './openscad.ts';
import { buildRelief, findLevels, heightmap, levelRegions, maskLoops, openOutline, outlineAt, quantise, reliefScad, type ReliefMap } from './relief.ts';
import type { Point2 } from './sections.ts';
import { bounds, parseStl, size, type Mesh } from './stl.ts';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Side walls only (no caps): enough for horizontal sections, which is all the relief measurement uses. */
function openPrism(polygon: Point2[], z0: number, z1: number): Float64Array {
  const t: number[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i] as Point2, b = polygon[(i + 1) % polygon.length] as Point2;
    t.push(a[0], a[1], z0, b[0], b[1], z0, b[0], b[1], z1, a[0], a[1], z0, b[0], b[1], z1, a[0], a[1], z1);
  }
  return Float64Array.from(t);
}

const rect = (x0: number, y0: number, x1: number, y1: number): Point2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** A 20 x 20 square wall, 10 high; its +x face carries a 4 wide, 2 high, 3 thick rib from z = 3 to 6. */
function ribbed(): Mesh {
  const lower = openPrism(rect(-10, -10, 10, 10), 0, 3);
  const middle = openPrism([[-10, -10], [10, -10], [10, -2], [13, -2], [13, 2], [10, 2], [10, 10], [-10, 10]], 3, 6);
  const upper = openPrism(rect(-10, -10, 10, 10), 6, 10);
  return { tris: Float64Array.from([...lower, ...middle, ...upper]) };
}

describe('maskLoops', () => {
  const grid = (rows: string[]): { mask: Uint8Array; width: number; height: number } => ({
    mask: Uint8Array.from(rows.flatMap(r => Array.from({ length: r.length }, (_, i) => (r.charAt(i) === '#' ? 1 : 0)))), width: rows[0]?.length ?? 0, height: rows.length,
  });
  const signedArea = (loop: Point2[]): number => loop.reduce((a, p, i) => { const q = loop[(i + 1) % loop.length] as Point2; return a + (p[0] * q[1] - q[0] * p[1]) / 2; }, 0);

  it('traces a block counter-clockwise and a hole clockwise', () => {
    const { mask, width, height } = grid(['###', '#.#', '###']);
    const areas = maskLoops(mask, width, height).map(signedArea).sort((a, b) => a - b);
    expect(areas).toEqual([-1, 9]);
  });

  it('joins cells that only touch diagonally so no loop pinches itself', () => {
    const { mask, width, height } = grid(['#.', '.#']);
    const loops = maskLoops(mask, width, height);
    expect(loops).toHaveLength(1);
    expect(Math.abs(signedArea(loops[0] as Point2[]))).toBe(3);
  });
});

describe('openOutline', () => {
  it('removes ribs narrower than the disc and keeps the smooth outline', () => {
    const comb: Point2[] = [[0, 0], [30, 0], [30, 10], [22, 10], [22, 13], [21, 13], [21, 10], [10, 10], [10, 12.5], [9, 12.5], [9, 10], [0, 10]];
    const opened = openOutline(comb, 1.2);
    const area = opened.points.reduce((a, p, i) => { const q = opened.points[(i + 1) % opened.points.length] as Point2; return a + (p[0] * q[1] - q[0] * p[1]) / 2; }, 0);
    expect(area).toBeGreaterThan(296);
    expect(area).toBeLessThan(301);
    expect(Math.max(...opened.points.map(p => p[1]))).toBeLessThan(10.2);
    expect(opened.perimeter).toBeCloseTo(80 - 4 * (2 - Math.PI / 2) * 1.2, 0);   // the four sharp corners are rounded to the disc radius
  });

  it('parametrises the outline by arc length with outward normals', () => {
    const outline = { points: [[0, 0], [4, 0], [4, 2], [0, 2]] as Point2[], cumulative: [0, 4, 6, 10, 12], perimeter: 12 };
    expect(outlineAt(outline, 2)).toMatchObject({ x: 2, y: 0, ny: -1 });
    expect(outlineAt(outline, 5)).toMatchObject({ x: 4, y: 1, nx: 1 });
    expect(outlineAt(outline, 12 + 2).x).toBeCloseTo(2, 9);
  });
});

describe('relief measurement', () => {
  const synthetic = (): ReliefMap => {
    const width = 100, height = 60;
    const d = new Float32Array(width * height);
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) d[r * width + c] = c >= 20 && c < 40 && r >= 10 && r < 30 ? 2.4 : c >= 60 && c < 70 ? 1.3 : (r + c) % 7 === 0 ? 0.02 : -0.02;
    return { base: { points: [[0, 0]], cumulative: [0, 10], perimeter: 10 }, px: 0.1, z0: 0, width, height, marginColumns: 0, d };
  };

  it('finds the plateau heights from the height histogram', () => {
    expect(findLevels(synthetic())).toEqual([0, 1.3, 2.4]);
  });

  it('assigns every cell to its nearest plateau', () => {
    const map = synthetic();
    const index = quantise(map, [0, 1.3, 2.4]);
    expect(index[15 * 100 + 25]).toBe(2);
    expect(index[5 * 100 + 65]).toBe(1);
    expect(index[5 * 100 + 5]).toBe(0);
  });

  it('cuts the map into nested regions with the right areas', () => {
    const regions = levelRegions(synthetic(), [0, 1.3, 2.4]);
    const area = (loops: Point2[][]): number => loops.reduce((a, l) => a + Math.abs(l.reduce((s, p, i) => { const q = l[(i + 1) % l.length] as Point2; return s + (p[0] * q[1] - q[0] * p[1]) / 2; }, 0)), 0);
    const [low, high] = regions;
    expect(low).toMatchObject({ kind: 'add', height: 1.3 });
    expect(area((high as { loops: Point2[][] }).loops)).toBeCloseTo(2 * 2, 1);          // 20 x 20 cells of 0.1 mm
    expect(area((low as { loops: Point2[][] }).loops)).toBeCloseTo(2 * 2 + 1 * 6, 1);    // nested: contains the 2.4 region and the 1.3 stripe
    expect(regions.map(r => r.grow)).toEqual([0.03, 0]);
  });

  it('measures a rib on a wall against its base outline', () => {
    const mesh = ribbed();
    const relief = buildRelief(mesh, { baseZ: 1, z0: 0.5, z1: 9.5, px: 0.1, refine: false });
    expect(relief.levels).toEqual([0, 3]);
    const [rib] = relief.regions;
    expect(rib).toMatchObject({ kind: 'add', height: 3 });
    const xs = (rib?.loops ?? []).flat().map(p => p[1]);
    expect(Math.min(...xs)).toBeCloseTo(3, 0);
    expect(Math.max(...xs)).toBeCloseTo(6, 0);
    const map = heightmap(mesh, { baseZ: 1, z0: 0.5, z1: 9.5, px: 0.1 });
    expect(map.width).toBeGreaterThan(400);
  });
});

// Rendering needs an OpenSCAD runtime, so it is opt-in: set STL_TO_SCAD_RENDER_TESTS=1 (the Docker integration workflow does).
const runner = process.env['STL_TO_SCAD_RENDER_TESTS'] ? await detectRunner() : undefined;

describe.skipIf(!runner)('wrapped relief in OpenSCAD', () => {
  it('bends the measured rib back around the outline', async () => {
    const mesh = ribbed();
    const relief = buildRelief(mesh, { baseZ: 1, z0: 0.5, z1: 9.5, px: 0.1, refine: false });
    const box = bounds(mesh);
    const scad = `${reliefScad(relief.map, relief.regions, { origin: [0, 0, box.min[2]] })}
linear_extrude(height = 10) polygon(RELIEF_BASE);
relief_wrap(1);
`;
    const directory = await mkdtemp(join(tmpdir(), 'stl-to-scad-relief-'));
    try {
      const file = join(directory, 'wall.scad');
      await writeFile(file, scad);
      const rendered = parseStl((await renderScad(file)).stl);
      const [dx, dy, dz] = size(bounds(rendered));
      expect(dx).toBeCloseTo(23, 0);   // 20 wall + 3 rib
      expect(dy).toBeCloseTo(20, 0);
      expect(dz).toBeCloseTo(10, 1);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }, 120_000);
});
