/**
 * Mass properties of a closed triangle mesh of uniform density: volume, centre of mass and inertia tensor, summed over the
 * tetrahedra that each triangle spans with the origin (signed, so the mesh must be closed and consistently wound, as a
 * rendered STL is). The physics side computes them from the part's own mesh, not from its convex pieces, whose overlaps and
 * hulls would count some volume twice or add some that is not there.
 */
import type { Inertial, Vec3 } from './scene.ts';

export interface MassProperties {
  /** In the mesh's units cubed. */
  volume: number;
  centroid: Vec3;
  /** Inertia per unit density about the centroid: xx, yy, zz, xy, xz, yz (the products as tensor entries, i.e. −∫xy). */
  inertia: [number, number, number, number, number, number];
}

/** `triangles`: 9 numbers per triangle (three vertices, counter-clockwise seen from outside). */
export function massProperties(triangles: ArrayLike<number>): MassProperties {
  if (triangles.length % 9 !== 0) throw new Error('A triangle mesh has 9 numbers per triangle.');
  let volume = 0, cx = 0, cy = 0, cz = 0, xx = 0, yy = 0, zz = 0, xy = 0, xz = 0, yz = 0;
  for (let i = 0; i < triangles.length; i += 9) {
    const ax = triangles[i] ?? 0, ay = triangles[i + 1] ?? 0, az = triangles[i + 2] ?? 0;
    const bx = triangles[i + 3] ?? 0, by = triangles[i + 4] ?? 0, bz = triangles[i + 5] ?? 0;
    const qx = triangles[i + 6] ?? 0, qy = triangles[i + 7] ?? 0, qz = triangles[i + 8] ?? 0;
    const v = (ax * (by * qz - bz * qy) - ay * (bx * qz - bz * qx) + az * (bx * qy - by * qx)) / 6;
    volume += v;
    cx += v * (ax + bx + qx) / 4;
    cy += v * (ay + by + qy) / 4;
    cz += v * (az + bz + qz) / 4;
    // second moments of the tetrahedron (0, a, b, c): ∫x² = V/10 Σ(ai ai + ai aj), ∫xy = V/20 (2 Σ ai bi + Σ_{i≠j} ai bj)
    const square = (p: number, q: number, r: number) => p * p + q * q + r * r + p * q + p * r + q * r;
    const product = (p1: number, q1: number, r1: number, p2: number, q2: number, r2: number) =>
      2 * (p1 * p2 + q1 * q2 + r1 * r2) + p1 * q2 + p2 * q1 + p1 * r2 + p2 * r1 + q1 * r2 + q2 * r1;
    xx += v / 10 * square(ax, bx, qx);
    yy += v / 10 * square(ay, by, qy);
    zz += v / 10 * square(az, bz, qz);
    xy += v / 20 * product(ax, bx, qx, ay, by, qy);
    xz += v / 20 * product(ax, bx, qx, az, bz, qz);
    yz += v / 20 * product(ay, by, qy, az, bz, qz);
  }
  if (!(volume > 0)) throw new Error('The mesh has no positive volume: it is open or wound inside out.');
  const c: Vec3 = [cx / volume, cy / volume, cz / volume];
  // second moments about the centroid (parallel axis theorem)
  const sxx = xx - volume * c[0] * c[0], syy = yy - volume * c[1] * c[1], szz = zz - volume * c[2] * c[2];
  const sxy = xy - volume * c[0] * c[1], sxz = xz - volume * c[0] * c[2], syz = yz - volume * c[1] * c[2];
  return { volume, centroid: c, inertia: [syy + szz, sxx + szz, sxx + syy, -sxy, -sxz, -syz] };
}

/** The inertial of a body of this density, its mesh scaled by `unit` (e.g. millimetres to metres). */
export function inertialOf(properties: MassProperties, density: number, unit = 1): Inertial {
  const mass = properties.volume * unit ** 3 * density;
  const k = density * unit ** 5;
  return {
    mass,
    pos: [properties.centroid[0] * unit, properties.centroid[1] * unit, properties.centroid[2] * unit],
    inertia: properties.inertia.map(value => value * k) as Inertial['inertia'],
  };
}
