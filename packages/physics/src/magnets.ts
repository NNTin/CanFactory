/**
 * Softened point-dipole interaction, SI. The unsoftened limit is the magnetic dipole field and F = ∇(m·B), τ = m×B:
 * https://www.feynmanlectures.caltech.edu/II_15.html (15-2, 15-4, 15-11); dipole field: https://www.feynmanlectures.caltech.edu/II_14.html.
 * We differentiate U = c[(a·b)/s³ − 3(a·r)(b·r)/s⁵], s² = r² + ε², c = μ₀/(4π) ≈ 10⁻⁷.
 * Softening is an explicit numerical approximation, NOT a finite-disc/steel/near-field solver. Using the same potential for
 * forces and torques preserves action/reaction and total angular momentum, including for off-axis dipoles.
 */
import type { Vec3 } from './scene.ts';
import { add, cross, scale, sub } from './transform.ts';

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export interface Dipole { pos: Vec3; moment: Vec3; softening: number }

/** Force on B, and intrinsic torques on A and B (N, N·m). The force on A is the negative of `force`. */
export function dipoleInteraction(a: Dipole, b: Dipole): { force: Vec3; torqueA: Vec3; torqueB: Vec3 } {
  const r = sub(b.pos, a.pos), ma = a.moment, mb = b.moment;
  const s2 = dot(r, r) + a.softening ** 2 + b.softening ** 2;
  if (!(s2 > 0)) throw new Error('Dipoles need positive softening or separation.');
  const c3 = 1e-7 / s2 ** 1.5, c5 = c3 / s2;
  const ar = dot(ma, r), br = dot(mb, r);
  return {
    force: scale(add(add(scale(mb, ar), scale(ma, br)), scale(r, dot(ma, mb) - 5 * ar * br / s2)), 3 * c5),
    torqueA: cross(ma, sub(scale(r, 3 * c5 * br), scale(mb, c3))),
    torqueB: cross(mb, sub(scale(r, 3 * c5 * ar), scale(ma, c3))),
  };
}
