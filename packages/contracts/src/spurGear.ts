import type { PhysicsSpec } from './physics.ts';
import { extrudedPieces, revolvedPieces, type Point2 } from './physicsPieces.ts';

/**
 * An involute spur gear (ISO 53 basic rack: 20° pressure angle, addendum 1 m, dedendum 1.25 m), its outline and, for the physics
 * (docs/physics-plan.md, spike 4), its convex collision pieces: each tooth on its own, cut at the root circle, and the hub, so that
 * gears are coupled by the contact of their teeth. tools/physics/fixtures/spur-gear.scad draws the same outline with the same
 * formulas (the check compares the pieces with its render). Millimetres; the gear lies on z = 0..width about the Z axis, tooth 0
 * centred on +X.
 */
export interface SpurGear {
  /** Module (mm). */
  module: number;
  teeth: number;
  width: number;
  /** Pressure angle (degrees); 20 by default. */
  pressureAngle?: number;
  /** How much each tooth is thinned at the pitch circle (mm, along the arc): half the pair's backlash. */
  backlash?: number;
}

const DEG = Math.PI / 180;
/** The involute function, inv φ = tan φ − φ. */
const inv = (phi: number) => Math.tan(phi) - phi;

export function spurGearRadii(gear: SpurGear) {
  const pitch = gear.module * gear.teeth / 2;
  const alpha = (gear.pressureAngle ?? 20) * DEG;
  return { pitch, base: pitch * Math.cos(alpha), tip: pitch + gear.module, root: pitch - 1.25 * gear.module, alpha };
}

/**
 * One tooth's outline, about +X: from the root circle up its two involute flanks (radial below the base circle) to its tip arc, as
 * a convex polygon (the involute flanks of an external tooth bulge outwards; the steps along them are `steps`).
 */
export function spurGearTooth(gear: SpurGear, steps = 8): Point2[] {
  const { pitch, base, tip, root, alpha } = spurGearRadii(gear);
  // half the tooth's angle at radius r: π / 2z at the pitch circle, less the thinning, along the involute
  const half = (r: number) => Math.PI / (2 * gear.teeth) - (gear.backlash ?? 0) / (2 * pitch) + inv(alpha) - inv(Math.acos(Math.min(1, base / r)));
  const start = Math.max(base, root);
  const radii = Array.from({ length: steps + 1 }, (_, i) => start + (tip - start) * i / steps);
  const flank = (side: 1 | -1) => [...(root < base ? [[root, half(base)] as Point2] : []), ...radii.map(r => [r, half(r)] as Point2)]
    .map(([r, a]): Point2 => [r * Math.cos(side * a), r * Math.sin(side * a)]);
  const tipArc = [-0.5, 0, 0.5].map(f => { const a = f * half(tip) * 2; return [tip * Math.cos(a), tip * Math.sin(a)] as Point2; });
  return [...flank(-1), ...tipArc.slice(1, -1), ...flank(1).reverse()];
}

/** The gear's whole outline: every tooth, joined along the root circle (for the SCAD file and the tests). */
export function spurGearOutline(gear: SpurGear, steps = 8): Point2[] {
  const tooth = spurGearTooth(gear, steps);
  return Array.from({ length: gear.teeth }, (_, k) => {
    const a = 2 * Math.PI * k / gear.teeth, c = Math.cos(a), s = Math.sin(a);
    return tooth.map(([x, y]): Point2 => [c * x - s * y, s * x + c * y]);
  }).flat();
}

/**
 * The gear's convex pieces: each tooth extruded across the width, and the hub, a disc of the root circle in as many segments as
 * teeth times four (its chords lie inside the root circle, where no tooth of the other gear reaches).
 */
export function spurGearPieces(gear: SpurGear, steps = 8): number[][] {
  const tooth = spurGearTooth(gear, steps);
  const { root } = spurGearRadii(gear);
  const teeth = Array.from({ length: gear.teeth }, (_, k) => {
    const a = 2 * Math.PI * k / gear.teeth, c = Math.cos(a), s = Math.sin(a);
    return extrudedPieces(tooth.map(([x, y]): Point2 => [c * x - s * y, s * x + c * y]), [0, 1], 0, gear.width);
  }).flat();
  return [...teeth, ...revolvedPieces([[0, 0], [root, 0], [root, gear.width], [0, gear.width]], gear.teeth * 4)];
}

/**
 * Spike 4's gear pair: a driving gear on a hinge at the origin and a driven one at the centre distance m (z1 + z2) / 2, coupled only
 * by their teeth, the driven one damped (its load: dry friction in its bearing set the pair rattling, its stick-slip kicking the
 * teeth). They start with the driver's tooth centred in the driven gear's gap, half the backlash free on either side. The scenarios check the ratio (turned on by 90°, the driven gear turns back by
 * 90° z1 / z2, lagging by half the backlash) and the backlash as on a bench: the driven gear held, the driver turned by a small
 * torque one way and then the other, between its teeth's flanks, by the pair's thinning over its pitch radius.
 */
export function spurGearPairPhysics(driver: SpurGear, driven: SpurGear): PhysicsSpec & { centreDistance: number } {
  const a = (spurGearRadii(driver).pitch + spurGearRadii(driven).pitch);
  // the driven gear turned so that a gap, not a tooth, faces the driver's tooth 0 across the centre line
  const phase = 180 + 180 / driven.teeth;
  const ratio = driver.teeth / driven.teeth;
  const turn = 90;
  const thinning = (driver.backlash ?? 0) + (driven.backlash ?? 0);
  // the driven gear's lag behind the ideal ratio, and the driver's play with the driven gear held (degrees)
  const backlash = thinning / spurGearRadii(driven).pitch / DEG;
  const play = thinning / spurGearRadii(driver).pitch / DEG;
  return {
    centreDistance: a,
    // with steps of 0.25 ms or longer the teeth skipped, and 0.2 ms was on the edge (spike 4)
    maxStep: 0.0001,
    poses: { driver: { position: [0, 0, 0] }, driven: { position: [a, 0, 0], rotation: [0, 0, phase] } },
    bodies: [
      // damped so that, turned by the bench's 10 N·mm, its teeth meet the other gear's at a few mm/s (quasi-static)
      { id: 'driver', material: 'petg', collision: { kind: 'pieces', pieces: spurGearPieces(driver) }, joint: { type: 'hinge', anchor: [0, 0, 0], axis: [0, 0, 1], damping: 1 } },
      { id: 'driven', material: 'petg', collision: { kind: 'pieces', pieces: spurGearPieces(driven) }, joint: { type: 'hinge', anchor: [a, 0, 0], axis: [0, 0, 1], damping: 0.5 } },
    ],
    scenarios: [
      {
        id: 'ratio', title: `Turned ${turn}°, the driver turns the driven gear back ${(turn * ratio).toFixed(1)}° (z1 / z2 = ${ratio.toFixed(3)})`, duration: 1.4,
        drives: [{ kind: 'joint', body: 'driver', timeline: [[0, 0], [1.2, turn]] }],
        checks: [{ kind: 'joint', at: 1.4, body: 'driven', min: -turn * ratio + backlash / 2 - 0.1, max: -turn * ratio + backlash / 2 + 0.1 }],
      },
      {
        id: 'backlash', title: `Held by the driven gear, the driver turns ${play.toFixed(3)}° between its teeth's flanks (the backlash over its pitch radius)`, duration: 0.8,
        drives: [
          { kind: 'joint', body: 'driven', timeline: [[0, 0]] },
          // 10 N·mm one way, then the other, at 10 mm from the driver's axis
          { kind: 'force', body: 'driver', point: [0, 10, 3], force: [-1, 0, 0], from: 0, to: 0.4 },
          { kind: 'force', body: 'driver', point: [0, 10, 3], force: [1, 0, 0], from: 0.4, to: 0.8 },
        ],
        checks: [
          { kind: 'joint', at: 0.39, body: 'driver', min: play / 2 - 0.05, max: play / 2 + 0.05 },
          { kind: 'joint', at: 0.79, body: 'driver', min: -play / 2 - 0.05, max: -play / 2 + 0.05 },
        ],
      },
    ],
  };
}
