import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareMeshes, detectScaleVariant, intersectionVolume } from './compare.ts';
import { box, cylinder, merge, ring, withHole } from './fixtures.ts';
import { detectRunner, renderScad } from './openscad.ts';
import { meshToPolyhedron } from './polyhedron.ts';
import { overlayToSvg, sliceZ, sectionsToSvg, toPieces } from './sections.ts';
import { bounds, isBinaryStl, parseStl, size, surfaceArea, transform, volume, writeBinaryStl } from './stl.ts';
import { analyzeTopology } from './topology.ts';
import { DEFAULT_TOLERANCE, judge, verifyScad } from './verify.ts';

describe('intersectionVolume', () => {
  it('measures the volume two placed solids share, and 0 for touching or separate ones', () => {
    expect(intersectionVolume(box(10, 10, 10), box(10, 10, 10, [5, 0, 4]), 0.1)).toBeCloseTo(5 * 10 * 6, 0);
    expect(intersectionVolume(box(10, 10, 10), box(10, 10, 10, [10, 0, 0]), 0.1)).toBe(0);
    expect(intersectionVolume(box(10, 10, 10), box(4, 4, 4, [20, 20, 20]))).toBe(0);
    // A pin inside a ring's hole does not collide with it; one through its wall does.
    expect(intersectionVolume(ring(5, 8, 10), cylinder(4.5, 20, 48, [0, 0, -5]), 0.1)).toBe(0);
    expect(intersectionVolume(ring(5, 8, 10), box(2, 2, 20, [5.5, -1, -5]), 0.1)).toBeCloseTo(2 * 2 * 10, 0);
  });
});

describe('stl reader/writer', () => {
  it('round-trips a binary STL and reports bounds, volume and area', () => {
    const bytes = writeBinaryStl(box(2, 3, 4, [10, 20, 30]));
    expect(isBinaryStl(bytes)).toBe(true);
    const mesh = parseStl(bytes);
    expect(bounds(mesh)).toEqual({ min: [10, 20, 30], max: [12, 23, 34] });
    expect(volume(mesh)).toBeCloseTo(24, 6);
    expect(surfaceArea(mesh)).toBeCloseTo(2 * (6 + 8 + 12), 6);
  });

  it('parses ASCII STL, including one that starts with "solid"', () => {
    const ascii = 'solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t\n';
    expect(parseStl(Buffer.from(ascii)).tris).toHaveLength(9);
    expect(() => parseStl(Buffer.from('garbage'))).toThrow(/valid/);
  });
});

describe('overlay', () => {
  it('draws reference and candidate cuts in different colours', () => {
    const svg = overlayToSvg([{ z: 3, reference: sliceZ(box(2, 2, 4), 3), candidate: sliceZ(box(2.2, 2, 4), 3) }]);
    expect(svg).toContain('stroke="#000"');
    expect(svg).toContain('stroke="#d00"');
    expect(svg).toContain('z=3');
  });
});

describe('topology', () => {
  it('accepts a closed single body', () => {
    expect(analyzeTopology(box(1, 1, 1))).toMatchObject({ triangles: 12, uniqueVertices: 8, watertight: true, bodies: 1 });
    expect(analyzeTopology(ring(3, 5, 2))).toMatchObject({ watertight: true });
  });

  it('flags holes, extra bodies and inverted winding', () => {
    expect(analyzeTopology(withHole(box(1, 1, 1))).watertight).toBe(false);
    expect(analyzeTopology(merge(box(1, 1, 1), box(1, 1, 1, [5, 0, 0])))).toMatchObject({ bodies: 2, watertight: false });
    const flipped = box(1, 1, 1);
    const first = flipped.tris.slice(0, 9);
    flipped.tris.set([...first.slice(0, 3), ...first.slice(6, 9), ...first.slice(3, 6)], 0);
    expect(analyzeTopology(flipped).windingConflicts).toBeGreaterThan(0);
  });
});

describe('sections', () => {
  it('slices a ring into an outer loop with one hole and correct net area', () => {
    const [piece] = toPieces(sliceZ(ring(3, 5, 10, 256), 4));
    expect(piece?.holes).toHaveLength(1);
    expect(piece?.area).toBeCloseTo(Math.PI * (25 - 9), 0);
    expect(piece?.centroid[0]).toBeCloseTo(0, 3);
  });

  it('handles a cut exactly on a flat face and an empty cut', () => {
    expect(toPieces(sliceZ(box(2, 2, 2), 0))).toHaveLength(1);
    expect(sliceZ(box(2, 2, 2), 5)).toHaveLength(0);
    expect(sectionsToSvg([{ z: 1, loops: sliceZ(box(2, 2, 2), 1) }])).toContain('<path');
  });
});

describe('comparison', () => {
  it('is registration independent and reports perfect agreement', () => {
    const a = cylinder(10, 20, 96);
    const result = compareMeshes(a, transform(a, 1, [500, -200, 3]));
    expect(result.iou).toBeGreaterThan(0.999);
    expect(result.maxSizeDelta).toBeLessThan(1e-9);
    expect(result.volumeRelativeError).toBeCloseTo(0, 9);
    expect(result.skippedColumns).toBe(0);
  });

  it('measures a coarse polygon approximation of a cylinder', () => {
    const result = compareMeshes(cylinder(10, 20, 96), cylinder(10, 20, 12));
    expect(result.volumeRelativeError).toBeLessThan(-0.02);
    expect(result.iou).toBeLessThan(0.98);
    expect(result.meanDeviation).toBeGreaterThan(0.1);
  });

  it('applies a reference scale', () => {
    const small = box(5, 5, 5);
    expect(compareMeshes(transform(small, 2), box(10, 10, 10)).iou).toBeGreaterThan(0.999);
    expect(compareMeshes(small, box(10, 10, 10), { referenceScale: 2 }).iou).toBeGreaterThan(0.999);
  });

  it('detects scaled copies and rejects different shapes', () => {
    const a = ring(3, 5, 4, 32);
    const b = transform(a, 1.5, [100, 100, 0]);
    expect(detectScaleVariant(a, b)?.scale).toBeCloseTo(1.5, 6);
    expect(detectScaleVariant(a, ring(3, 5, 8, 32))).toBeUndefined();
    expect(detectScaleVariant(a, cylinder(5, 4, 32))).toBeUndefined();
  });

  it('judges against tolerances', () => {
    const good = compareMeshes(box(10, 10, 10), box(10, 10, 10));
    const topology = analyzeTopology(box(1, 1, 1));
    expect(judge(topology, good, DEFAULT_TOLERANCE)).toEqual([]);
    const bad = compareMeshes(box(10, 10, 10), box(10, 10, 11));
    expect(judge(topology, bad, DEFAULT_TOLERANCE).join('|')).toMatch(/bounding box.*volume.*IoU/);
    expect(judge(analyzeTopology(withHole(box(1, 1, 1))), good, DEFAULT_TOLERANCE)[0]).toMatch(/not one closed manifold/);
  });
});

describe('polyhedron fallback', () => {
  it('emits an indexed polyhedron with reversed (clockwise) faces, recentred on the origin', () => {
    const result = meshToPolyhedron(box(2, 2, 2, [10, 10, 10]), { name: 'part' });
    expect(result.points).toBe(8);
    expect(result.faces).toBe(12);
    expect(result.scad).toContain('module part()');
    expect(result.scad).toContain('[-1,-1,0]');
  });

  it('can cluster vertices to shrink the output', () => {
    const fine = meshToPolyhedron(cylinder(10, 5, 256));
    const coarse = meshToPolyhedron(cylinder(10, 5, 256), { cluster: 2 });
    expect(coarse.bytes).toBeLessThan(fine.bytes / 4);
  });
});

// Rendering needs an OpenSCAD runtime, so it is opt-in: set STL_TO_SCAD_RENDER_TESTS=1 (the Docker integration workflow does).
const runner = process.env['STL_TO_SCAD_RENDER_TESTS'] ? await detectRunner() : undefined;

describe.skipIf(!runner)('OpenSCAD round trip', () => {
  it('renders a polyhedron fallback and verifies it against its source STL', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stl-to-scad-test-'));
    try {
      const source = ring(20, 26, 15, 64);
      const stl = join(directory, 'ring.stl');
      const scad = join(directory, 'ring.scad');
      await writeFile(stl, writeBinaryStl(transform(source, 1, [300, 40, 0])));
      await writeFile(scad, meshToPolyhedron(source, { decimals: 4 }).scad);
      const result = await verifyScad(scad, stl, { name: 'ring' });
      expect(result.failures).toEqual([]);
      expect(result.pass).toBe(true);
      expect(result.candidate.topology.watertight).toBe(true);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }, 120_000);

  it('fails a SCAD whose dimensions are wrong and honours -D overrides', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stl-to-scad-test-'));
    try {
      const stl = join(directory, 'cyl.stl');
      const scad = join(directory, 'cyl.scad');
      await writeFile(stl, writeBinaryStl(cylinder(10, 20, 128)));
      await writeFile(scad, 'HEIGHT = 30;\ncylinder(r = 10, h = HEIGHT, $fn = 128);\n');
      expect((await verifyScad(scad, stl)).pass).toBe(false);
      expect((await verifyScad(scad, stl, { defines: { HEIGHT: '20' } })).pass).toBe(true);
      const rendered = await renderScad(scad, { HEIGHT: '20' });
      expect(size(bounds(parseStl(rendered.stl)))[2]).toBeCloseTo(20, 3);
      expect((await readFile(scad, 'utf8'))).toContain('HEIGHT');
    } finally { await rm(directory, { recursive: true, force: true }); }
  }, 120_000);
});
