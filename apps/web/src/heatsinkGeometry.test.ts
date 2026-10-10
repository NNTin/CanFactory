import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CAMERA_HEATSINKS, DEFAULT_CAMERA_HOUSING, dimensionOf, findPartFamily, findPart } from '@canfactory/contracts';
import { partGeometry } from './partGeometry.ts';
import { CameraHousingIllustration } from './CameraHousingIllustration.tsx';
import { GENERIC_MODELS } from '../../../tools/assembly-meshes.ts';

describe('heatsink previews', () => {
  it('replaces the unmerged fan family with source-labelled passive parts', () => {
    expect(findPartFamily('fan')).toBeUndefined();
    expect(findPart('seeed-xiao-aluminium-heatsink')?.dimensions['H']?.basis).toBe('estimated');
    expect(findPart('same-sky-hsb02-101007')?.dimensions['H']?.basis).toBe('manufacturer');
  });
  it('uses maximum envelopes and the same dimensions as the assembly checker', () => {
    for (const id of CAMERA_HEATSINKS) {
      const part = findPart(id); assert.ok(part);
      const geometry = partGeometry(part); assert.ok(geometry);
      geometry.computeBoundingBox(); const box = geometry.boundingBox; assert.ok(box);
      expect(box.min.x).toBeCloseTo(-dimensionOf(part, 'W', 'max') / 2);
      expect(box.max.x).toBeCloseTo(dimensionOf(part, 'W', 'max') / 2);
      expect(box.min.y).toBeCloseTo(-dimensionOf(part, 'L', 'max') / 2);
      expect(box.max.y).toBeCloseTo(dimensionOf(part, 'L', 'max') / 2);
      expect(box.min.z).toBeCloseTo(0, 6);
      expect(box.max.z).toBeCloseTo(dimensionOf(part, 'H', 'max'));
      expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
      const generic = GENERIC_MODELS['heatsink']; assert.ok(generic);
      expect(Number(generic.defines(part)['H'])).toBe(dimensionOf(part, 'H', 'max'));
      geometry.dispose();
    }
  });
  it('shows both SVG views and the default backside sink, or the compact no-heatsink model', () => {
    const cooling = renderToStaticMarkup(CameraHousingIllustration());
    expect(cooling).toContain('BACKSIDE HEATSINK / DEFAULT ON');
    expect(cooling).toContain('data-view="assembled"');
    expect(cooling).toContain('data-view="exploded"');
    expect(cooling).toContain('data-heatsink="backside"');
    const compact = renderToStaticMarkup(CameraHousingIllustration({ parameters: { ...DEFAULT_CAMERA_HOUSING, heatsinkEnabled: false } }));
    expect(compact).not.toContain('data-heatsink=');
  });
});
