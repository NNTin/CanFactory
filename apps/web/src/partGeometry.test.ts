import { describe, expect, it } from 'vitest';
import { dimensionOf, partsOfFamily } from '@canfactory/contracts';
import { Color, Vector3, type BufferGeometry } from 'three';
import { partGeometry } from './partGeometry.ts';

/** Area of the top face in one diagram colour, excluding the sides and bottom. */
function topArea(geometry: BufferGeometry, hex: number): number {
  const positions = geometry.getAttribute('position'); const normals = geometry.getAttribute('normal');
  const colours = geometry.getAttribute('color'); const colour = new Color(hex);
  let area = 0;
  for (let i = 0; i < positions.count; i += 3) {
    if (normals.getZ(i) < 0.9 || Math.abs(colours.getX(i) - colour.r) > 0.00001) continue;
    const a = new Vector3().fromBufferAttribute(positions, i);
    const b = new Vector3().fromBufferAttribute(positions, i + 1);
    const c = new Vector3().fromBufferAttribute(positions, i + 2);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return area;
}

describe('cat entrance front-size diagrams', () => {
  it('can show just the required frame dimensions without inventing an opening', () => {
    const template = partsOfFamily('cat-entrance')[0];
    if (!template) throw new Error('No cat entrances');
    const geometry = partGeometry({ ...template, dimensions: Object.fromEntries(Object.entries(template.dimensions).filter(([key]) => key === 'frameWidth' || key === 'frameHeight')) });
    if (!geometry) throw new Error('No frame-only preview');
    try {
      expect([...geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
      expect(topArea(geometry, 0xf0f0ea)).toBeCloseTo(dimensionOf(template, 'frameWidth') * dimensionOf(template, 'frameHeight'), 0);
      expect(topArea(geometry, 0x58606a)).toBe(0);
      expect(topArea(geometry, 0x86b8d0)).toBe(0);
    } finally { geometry.dispose(); }
  });

  it.each(partsOfFamily('cat-entrance'))('$id uses its published front dimensions, not an invented product depth', part => {
    const geometry = partGeometry(part);
    if (!geometry) throw new Error(`No preview for ${part.id}`);
    try {
      const positions = geometry.getAttribute('position');
      expect([...positions.array].every(Number.isFinite)).toBe(true);
      expect(geometry.getAttribute('color').count).toBe(positions.count);
      geometry.computeBoundingBox();
      const size = geometry.boundingBox?.getSize(new Vector3());
      expect(size?.x).toBeCloseTo(dimensionOf(part, 'frameWidth'));
      expect(size?.y).toBeCloseTo(dimensionOf(part, 'frameHeight'));
      expect(size?.z).toBe(2); // explicitly illustrative, including products whose overall depth is known
      expect(geometry.boundingBox?.min.z).toBe(0);
      const innerArea = dimensionOf(part, 'passageWidth' in part.dimensions ? 'passageWidth' : 'flapWidth') * dimensionOf(part, 'passageHeight' in part.dimensions ? 'passageHeight' : 'flapHeight');
      const cutArea = 'cutoutWidth' in part.dimensions ? dimensionOf(part, 'cutoutWidth') * dimensionOf(part, 'cutoutHeight') : innerArea;
      expect(topArea(geometry, 0x86b8d0)).toBeCloseTo(innerArea, 0);
      expect(topArea(geometry, 0x58606a)).toBeCloseTo(cutArea - innerArea, 0);
      expect(topArea(geometry, 0xf0f0ea)).toBeCloseTo(dimensionOf(part, 'frameWidth') * dimensionOf(part, 'frameHeight') - cutArea, 0);
    } finally { geometry.dispose(); }
  });
});
