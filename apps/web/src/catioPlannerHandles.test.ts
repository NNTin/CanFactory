import { describe, expect, it } from 'vitest';
import { applyTransform } from '@canfactory/catio';
import { facePoint, MIN_SIZE, resizeFrom, sizeFaces, type SizeFace, type Sized } from './catioPlannerHandles.ts';

const enclosure: Sized = { kind: 'enclosure', params: { width: 2000, depth: 2000, height: 2000 } };
const platform: Sized = { kind: 'platform', params: { width: 1920, depth: 400, thickness: 18 } };
const opposite = (face: SizeFace): SizeFace => `${face[0] === '+' ? '-' : '+'}${face[1]}` as SizeFace;
const at = (t: { x: number; y: number; z: number; yaw: number }, [x, y, z]: [number, number, number]) => applyTransform(t, { x, y, z });

describe('the resize handles', () => {
  it('drag a face, snapped, the opposite face staying where it is, however the instance is turned', () => {
    for (const s of [enclosure, platform]) for (const face of sizeFaces(s)) for (const yaw of [0, 30, -90]) {
      const t = { x: 1200, y: 800, z: s.kind === 'platform' ? 1200 : 0, yaw };
      const r = resizeFrom(s, t, face, 237, 10);
      expect(r.change).toBe(240);
      const resized = { ...s, params: { ...s.params, ...r.size } } as Sized;
      if (face === '+z') continue;
      // the face opposite the dragged one is where it was in the site
      const before = at(t, facePoint(s, opposite(face))); const after = at(r.transform, facePoint(resized, opposite(face)));
      expect(after.x).toBeCloseTo(before.x, 6); expect(after.y).toBeCloseTo(before.y, 6);
      // and the dragged face moved out by the change
      const moved = at(r.transform, facePoint(resized, face)); const was = at(t, facePoint(s, face));
      expect(Math.hypot(moved.x - was.x, moved.y - was.y)).toBeCloseTo(240, 6);
    }
  });

  it('keeps a size no smaller than the least, and shows the dragged box in the old frame', () => {
    expect(resizeFrom(enclosure, { x: 0, y: 0, z: 0, yaw: 0 }, '-x', -5000, 10).value).toBe(MIN_SIZE);
    const r = resizeFrom(enclosure, { x: 0, y: 0, z: 0, yaw: 0 }, '+z', 100, 10);
    expect(r.size).toEqual({ height: 2100 }); expect(r.box.max[2]).toBe(2100); expect(r.transform).toEqual({ x: 0, y: 0, z: 0, yaw: 0 });
    expect(sizeFaces(platform)).not.toContain('+z');
  });
});
