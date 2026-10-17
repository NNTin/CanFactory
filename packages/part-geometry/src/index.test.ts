import { describe, expect, it } from 'vitest';
import { dimensionOf, parts, type Part } from '@canfactory/contracts';
import * as THREE from 'three';
import { partGeometry } from './index.ts';

/** The edges that do not join an even number of triangles, vertices welded at 0.1 µm: none for a closed solid. */
function openEdges(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  const key = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map(v => Math.round(v * 1e4)).join(',');
  const edges = new Map<string, number>();
  for (let i = 0; i < position.count; i += 3) {
    const corners = [key(i), key(i + 1), key(i + 2)];
    if (new Set(corners).size < 3) continue;
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]] as const) {
      const edge = [corners[a], corners[b]].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  return [...edges.values()].filter(count => count % 2 !== 0).length;
}

const size = (part: Part) => {
  const geometry = partGeometry(part); if (!geometry) throw new Error(`${part.id} has no geometry`);
  geometry.computeBoundingBox(); const box = geometry.boundingBox ?? new THREE.Box3();
  geometry.dispose();
  return box.getSize(new THREE.Vector3());
};

describe('part geometry', () => {
  it('builds every procedural part as closed solids, which the collision check needs to tell inside from outside', () => {
    // a staple's legs meet its points without a shared edge; it is not checked against a model
    for (const part of parts.filter(p => p.preview.kind === 'procedural' && p.family !== 'nail')) {
      const geometry = partGeometry(part); if (!geometry) throw new Error(`${part.id} has no geometry`);
      expect(openEdges(geometry), part.id).toBe(0);
      geometry.dispose();
    }
  });
  it('draws what a printed pocket must take: a magnet at its largest, an insert as the hole it is melted into', () => {
    for (const part of parts.filter(p => p.family === 'magnet' && p.attributes['shape'] !== 'block'))
      expect(size(part).x, part.id).toBeCloseTo(dimensionOf(part, 'diameter', 'max'), 1);
    for (const part of parts.filter(p => p.family === 'threaded-insert')) {
      expect(size(part).x, part.id).toBeCloseTo(dimensionOf(part, 'hole'), 1);
      expect(size(part).z, part.id).toBeCloseTo(dimensionOf(part, 'l'), 6);
    }
  });
});
