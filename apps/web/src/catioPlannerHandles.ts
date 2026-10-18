import type { EnclosureParams, PlatformParams, Transform } from '@canfactory/catio';

/**
 * The planner's resize handles (FR-02.2): one on each face of the selection that can be dragged to change its size, the opposite
 * face staying where it is. Millimetres, in the instance's own frame: an enclosure's has its origin at the middle of its rear sole
 * (X across its width, Y out to its door, Z up); a platform's board has its origin at the middle of its top face.
 */
export type SizeFace = '+x' | '-x' | '+y' | '-y' | '+z';
export type Sized = { kind: 'enclosure'; params: EnclosureParams } | { kind: 'platform'; params: PlatformParams };
export interface Box { min: [number, number, number]; max: [number, number, number] }

/** The smallest size a handle drags a width, depth or height down to. */
export const MIN_SIZE = 100;
const RAD = Math.PI / 180;
const KEY = { x: 'width', y: 'depth', z: 'height' } as const;

/** The faces that have a handle: the board's thickness is the inspector's alone. */
export const sizeFaces = (s: Sized): SizeFace[] => s.kind === 'enclosure' ? ['+x', '-x', '+y', '-y', '+z'] : ['+x', '-x', '+y', '-y'];

/** The instance's own box, in its frame. */
export function sizeBox(s: Sized): Box {
  const { width: w, depth: d } = s.params;
  return s.kind === 'enclosure' ? { min: [-w / 2, 0, 0], max: [w / 2, d, s.params.height] } : { min: [-w / 2, -d / 2, -s.params.thickness], max: [w / 2, d / 2, 0] };
}

/** The middle of a face of the instance's box, where its handle sits. */
export function facePoint(s: Sized, face: SizeFace): [number, number, number] {
  const { min, max } = sizeBox(s); const axis = 'xyz'.indexOf(face[1] ?? 'x');
  const p: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  p[axis] = face[0] === '+' ? max[axis] ?? 0 : min[axis] ?? 0;
  return p;
}

/**
 * The instance with `face` dragged `delta` mm outward (inward when negative), its size snapped to `step` and no smaller than
 * `MIN_SIZE`: the size it takes, where it then stands in its parent's frame (so that the opposite face stays put), the dragged
 * box in its old frame (a drag's preview), and how much the size changed.
 */
export function resizeFrom(s: Sized, transform: Transform, face: SizeFace, delta: number, step: number) {
  const axis = face[1] as 'x' | 'y' | 'z'; const sign = face[0] === '+' ? 1 : -1; const key = KEY[axis];
  const params = s.params as Record<string, number>;
  const old = params[key] ?? 0;
  const next = Math.max(MIN_SIZE, Math.round((old + delta) / step) * step);
  const change = next - old;
  // the origin moves so that the opposite face stays: half the change across a centred axis, all of it at an enclosure's rear
  let sx = 0; let sy = 0;
  if (axis === 'x') sx = sign * change / 2;
  else if (axis === 'y') sy = s.kind === 'platform' ? sign * change / 2 : sign < 0 ? -change : 0;
  const c = Math.cos(transform.yaw * RAD); const n = Math.sin(transform.yaw * RAD);
  const box = sizeBox(s); const i = 'xyz'.indexOf(axis);
  if (sign > 0) box.max[i] = (box.max[i] ?? 0) + change; else box.min[i] = (box.min[i] ?? 0) - change;
  return {
    size: { [key]: next } as Partial<EnclosureParams> | Partial<PlatformParams>, key, value: next, change, box,
    transform: { ...transform, x: transform.x + c * sx - n * sy, y: transform.y + n * sx + c * sy },
  };
}
