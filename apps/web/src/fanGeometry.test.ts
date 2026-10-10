import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CAMERA_FANS, DEFAULT_CAMERA_HOUSING, dimensionOf, fanMounts, findPart } from '@canfactory/contracts';
import { partGeometry } from './partGeometry.ts';
import { CameraHousingIllustration } from './CameraHousingIllustration.tsx';
import { GENERIC_MODELS } from '../../../tools/assembly-meshes.ts';

describe('fan previews', () => {
  it('uses maximum installed frames and the same mounting patterns as the assembly checker', () => {
    for (const id of CAMERA_FANS) {
      const part = findPart(id); assert.ok(part);
      const geometry = partGeometry(part); assert.ok(geometry);
      geometry.computeBoundingBox(); const box = geometry.boundingBox; assert.ok(box);
      expect(box.min.x).toBeCloseTo(-dimensionOf(part, 'W', 'max') / 2);
      expect(box.max.x).toBeCloseTo(dimensionOf(part, 'W', 'max') / 2);
      expect(box.min.y).toBeCloseTo(-dimensionOf(part, 'L', 'max') / 2);
      expect(box.max.y).toBeCloseTo(dimensionOf(part, 'L', 'max') / 2);
      expect(box.min.z).toBe(0);
      expect(box.max.z).toBeCloseTo(dimensionOf(part, 'H', 'max'));
      expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
      const generic = GENERIC_MODELS['fan']; assert.ok(generic);
      expect(JSON.parse(generic.defines(part)['MOUNTS'] ?? 'null')).toEqual(fanMounts(part));
      expect(fanMounts(part)).toHaveLength(id.startsWith('sunon') ? 3 : 4);
      geometry.dispose();
    }
  });
  it('shows both SVG views and labels the optional cooling variant, or draws the compact no-fan model', () => {
    const cooling = renderToStaticMarkup(CameraHousingIllustration());
    expect(cooling).toContain('OPTIONAL 5 V FAN BAY SHOWN');
    expect(cooling).toContain('data-view="assembled"');
    expect(cooling).toContain('data-view="exploded"');
    expect(cooling).toContain('data-fan="frame"');
    expect(cooling.match(/data-fan="grille"/g)).toHaveLength(2);
    const compact = renderToStaticMarkup(CameraHousingIllustration({ parameters: DEFAULT_CAMERA_HOUSING }));
    expect(compact).not.toContain('data-fan=');
  });
});
