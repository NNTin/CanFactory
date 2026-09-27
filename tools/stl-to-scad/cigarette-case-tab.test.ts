import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { detectRunner, renderScad } from './openscad.ts';
import { g, parseStl, type Mesh } from './stl.ts';

const BOX = new URL('../../models/cigarette-case/reference/11_v11.3__-_honeycomb_-_box.scad', import.meta.url).pathname;

type Point = [number, number];

/** A top-level `NAME = [...];` array of the box SCAD, which is plain JSON-compatible number data. */
function scadArray(source: string, name: string): unknown {
  const match = new RegExp(`^${name} = (\\[[\\s\\S]*?\\]);$`, 'm').exec(source);
  if (!match?.[1]) throw new Error(`${name} not found in the box SCAD.`);
  return JSON.parse(match[1].replace(/\s+/g, '')) as unknown;
}

type Vec = [number, number, number];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vertex = (mesh: Mesh, i: number): Vec => [g(mesh.tris, i), g(mesh.tris, i + 1), g(mesh.tris, i + 2)];

/** Parity of the crossings of a ray from p (a skewed direction, so it misses edges and vertices) with the mesh's triangles. */
function inside(mesh: Mesh, p: Vec): boolean {
  const d: Vec = [1, 0.3183, 0.1291];
  let crossings = 0;
  for (let i = 0; i < mesh.tris.length; i += 9) {
    const a = vertex(mesh, i), e1 = sub(vertex(mesh, i + 3), a), e2 = sub(vertex(mesh, i + 6), a);
    const h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(p, a), u = dot(s, h) / det;
    if (u < 0 || u > 1) continue;
    const q = cross(s, e1), v = dot(d, q) / det;
    if (v < 0 || u + v > 1) continue;
    if (dot(e2, q) / det > 0) crossings++;
  }
  return crossings % 2 === 1;
}

// Rendering needs an OpenSCAD runtime, so it is opt-in: set STL_TO_SCAD_RENDER_TESTS=1 (the Docker integration workflow does).
const runner = process.env['STL_TO_SCAD_RENDER_TESTS'] ? await detectRunner() : undefined;

describe.skipIf(!runner)('cigarette case box: clip tab in the round bay', () => {
  it('is rooted in the bay wall over its whole height and length, and leaves the holder side open', async () => {
    const source = await readFile(BOX, 'utf8');
    const bay = scadArray(source, 'BAY_ROUND') as Point[];
    const tab = scadArray(source, 'TAB') as [number, Point[]][];
    const step = Number(/^TAB_STEP = ([\d.]+);/m.exec(source)?.[1]);
    const bottom = tab[0]?.[0] ?? NaN, top = (tab[tab.length - 1]?.[0] ?? NaN) + step;
    const chord = Number(/^TAB_CHORD = (-?[\d.]+);/m.exec(source)?.[1]);
    const centre: Point = [Number(/^HOLDER_BAY_X = (-?[\d.]+);/m.exec(source)?.[1]), 0];
    const mesh = parseStl((await renderScad(BOX)).stl);

    // 0.1 mm inside the bay wall, all along the tab's end of the bay and at the middle of every slice but the top one (where the
    // 45-degree top of the fill meets the wall), must be solid: the tab traced from the source touched the wall only in its
    // lowest 0.4 mm, over 1.8 mm.
    const wall = bay.filter(p => p[1] < chord - 0.3).map(([x, y]): Point => {
      const length = Math.hypot(centre[0] - x, centre[1] - y);
      return [x + 0.1 * (centre[0] - x) / length, y + 0.1 * (centre[1] - y) / length];
    });
    expect(wall.length).toBeGreaterThan(20);
    const detached = tab.slice(0, -1).flatMap(([z]) => wall.filter(([x, y]) => !inside(mesh, [x, y, z + step / 2])).map(([x, y]) => `(${x.toFixed(2)}, ${y.toFixed(2)}, ${(z + step / 2).toFixed(2)})`));
    expect(detached).toEqual([]);

    // The hollow under the hood, where the holder's dome stops, stays open.
    for (const z of [32.4, 33.0, 33.6]) expect(inside(mesh, [centre[0], -8, z]), `under the hood at z = ${z}`).toBe(false);
    // Above the hood's top, and just below its bottom, the bay is open too.
    expect(inside(mesh, [centre[0], -11.3, top + 0.1])).toBe(false);
    expect(inside(mesh, [centre[0], -11.3, bottom - 0.1])).toBe(false);
  }, 120_000);
});
