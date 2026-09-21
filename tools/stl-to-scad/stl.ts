import { createHash } from 'node:crypto';

/** Triangle soup: nine numbers (ax ay az bx by bz cx cy cz) per triangle. Units are whatever the file uses (mm for Canfactory). */
export interface Mesh { tris: Float64Array }

export interface Bounds { min: [number, number, number]; max: [number, number, number] }

/** Bounds-safe typed-array read (the repo enables noUncheckedIndexedAccess). */
export const g = (values: ArrayLike<number>, index: number): number => values[index] ?? 0;

export const triangleCount = (mesh: Mesh): number => mesh.tris.length / 9;

/** Parse binary or ASCII STL. There is deliberately no triangle-count cap: source models can exceed 1M triangles. */
export function parseStl(bytes: Buffer): Mesh {
  if (isBinaryStl(bytes)) {
    const count = bytes.readUInt32LE(80);
    const tris = new Float64Array(count * 9);
    for (let index = 0; index < count; index++) {
      const offset = 84 + index * 50 + 12;
      for (let k = 0; k < 9; k++) tris[index * 9 + k] = bytes.readFloatLE(offset + k * 4);
    }
    return { tris };
  }
  const values: number[] = [];
  for (const match of bytes.toString('utf8').matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) {
    values.push(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  if (values.length === 0 || values.length % 9 !== 0 || values.some(value => !Number.isFinite(value)))
    throw new Error('Not a valid binary or ASCII STL.');
  return { tris: Float64Array.from(values) };
}

/** Binary iff the declared triangle count matches the byte length exactly (ASCII files may also start with "solid"). */
export function isBinaryStl(bytes: Buffer): boolean {
  return bytes.length >= 84 && bytes.length === 84 + bytes.readUInt32LE(80) * 50;
}

export function writeBinaryStl(mesh: Mesh, header = 'stl-to-scad'): Buffer {
  const count = triangleCount(mesh);
  const bytes = Buffer.alloc(84 + count * 50);
  bytes.write(header.slice(0, 80), 0, 'utf8');
  bytes.writeUInt32LE(count, 80);
  for (let index = 0; index < count; index++) {
    const base = index * 9;
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => g(mesh.tris, base + k)) as [number, number, number, number, number, number, number, number, number];
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const length = Math.hypot(nx, ny, nz) || 1;
    const offset = 84 + index * 50;
    [nx / length, ny / length, nz / length, ax, ay, az, bx, by, bz, cx, cy, cz].forEach((value, k) => bytes.writeFloatLE(value, offset + k * 4));
  }
  return bytes;
}

export const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

export function bounds(mesh: Mesh): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < mesh.tris.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = g(mesh.tris, index + axis);
      if (value < g(min, axis)) min[axis] = value;
      if (value > g(max, axis)) max[axis] = value;
    }
  }
  return { min, max };
}

export const size = (b: Bounds): [number, number, number] => [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
export const center = (b: Bounds): [number, number, number] => [(b.max[0] + b.min[0]) / 2, (b.max[1] + b.min[1]) / 2, (b.max[2] + b.min[2]) / 2];

/** Signed enclosed volume (positive for outward winding). */
export function volume(mesh: Mesh): number {
  let sum = 0;
  const t = mesh.tris;
  for (let i = 0; i < t.length; i += 9) {
    const ax = g(t, i), ay = g(t, i + 1), az = g(t, i + 2), bx = g(t, i + 3), by = g(t, i + 4), bz = g(t, i + 5), cx = g(t, i + 6), cy = g(t, i + 7), cz = g(t, i + 8);
    sum += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return sum / 6;
}

export function surfaceArea(mesh: Mesh): number {
  let sum = 0;
  const t = mesh.tris;
  for (let i = 0; i < t.length; i += 9) {
    const ux = g(t, i + 3) - g(t, i), uy = g(t, i + 4) - g(t, i + 1), uz = g(t, i + 5) - g(t, i + 2);
    const vx = g(t, i + 6) - g(t, i), vy = g(t, i + 7) - g(t, i + 1), vz = g(t, i + 8) - g(t, i + 2);
    sum += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return sum;
}

/** Return a copy scaled about the origin and then translated. */
export function transform(mesh: Mesh, scale: number, offset: readonly [number, number, number] = [0, 0, 0]): Mesh {
  const tris = new Float64Array(mesh.tris.length);
  for (let i = 0; i < tris.length; i++) tris[i] = g(mesh.tris, i) * scale + g(offset, i % 3);
  return { tris };
}
