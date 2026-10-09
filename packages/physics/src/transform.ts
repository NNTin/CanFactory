/** Rotations and rigid transforms. Quaternions are (w, x, y, z), as in MuJoCo. */
import { DEG, type Quat, type Vec3 } from './scene.ts';

export const IDENTITY: Quat = [1, 0, 0, 0];

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a, [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

export const quatConjugate = ([w, x, y, z]: Quat): Quat => [w, -x, -y, -z];

export function quatAxisAngle(axis: Vec3, angle: number): Quat {
  const length = Math.hypot(...axis);
  if (length === 0) throw new Error('A rotation axis must not be zero.');
  const s = Math.sin(angle / 2) / length;
  return [Math.cos(angle / 2), axis[0] * s, axis[1] * s, axis[2] * s];
}

/**
 * The rotation of an assembly pose (`Pose.rotation`, degrees): about X, then Y, then Z, all about the fixed axes, as OpenSCAD's
 * `rotate([x, y, z])` and the preview do.
 */
export function quatFromPoseRotation(rotation: readonly number[] | undefined): Quat {
  const [x = 0, y = 0, z = 0] = rotation ?? [];
  return quatMultiply(quatAxisAngle([0, 0, 1], z * DEG), quatMultiply(quatAxisAngle([0, 1, 0], y * DEG), quatAxisAngle([1, 0, 0], x * DEG)));
}

export function rotate(q: Quat, v: Vec3): Vec3 {
  const [w, x, y, z] = q;
  // v + 2 w (u × v) + 2 u × (u × v), with u = (x, y, z)
  const cx = y * v[2] - z * v[1], cy = z * v[0] - x * v[2], cz = x * v[1] - y * v[0];
  return [
    v[0] + 2 * (w * cx + y * cz - z * cy),
    v[1] + 2 * (w * cy + z * cx - x * cz),
    v[2] + 2 * (w * cz + x * cy - y * cx),
  ];
}

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** A rigid transform: rotate, then translate. */
export interface Transform { pos: Vec3; quat: Quat }

export const apply = (t: Transform, point: Vec3): Vec3 => add(rotate(t.quat, point), t.pos);

/** `t` expressed in the frame `frame`: frame⁻¹ ∘ t. */
export function relative(frame: Transform, t: Transform): Transform {
  const inverse = quatConjugate(frame.quat);
  return { pos: rotate(inverse, sub(t.pos, frame.pos)), quat: quatMultiply(inverse, t.quat) };
}

/** The (unsigned) angle of a rotation, in radians. */
export const quatAngle = (q: Quat): number => 2 * Math.acos(Math.min(1, Math.abs(q[0])));
