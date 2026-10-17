import { toggleLatch, toggleLatchMechanism as TL } from '@canfactory/contracts';
import type { BomLine, V3 } from './catioSubassembly.ts';

/**
 * The printed toggle latch (the `toggle-latch` model) on a catio joint, shared by every page that latches two faces together: the
 * insert–tunnel coupling (flange to docking frame) and the tunnel–tunnel coupling (flange to flange, also on the tunnel page). One
 * placement and one set of screw positions, from the shared mechanism (toggleLatchMechanism.ts); `buildPrintedLatches`
 * (catioPrintedLatchScene.ts) draws it.
 */
export const PRINTED_LATCH_JOINT = {
  /** The gap the joint is set to: the latch has no adjustable hook, and its plates lock `PRINTED_LATCH.locked` apart. */
  gap: 3,
  /** The self-adhesive EPDM E-profile seal (9 × 4, made for 2–3.5 mm gaps) squashed in it: free height and width. */
  seal: { height: 4, width: 9 },
} as const;

const TG = TL.TOGGLE_LATCH_GEOMETRY;
/**
 * The printed toggle latch on a joint: its base on one side face, its catch on the other's, each plate 12 mm along the joint and
 * 38 mm up it. Locked, the plates stand `locked` apart (the over-centre lock). It has no adjustable hook, so the gap is set for it,
 * 3 mm, and each plate reaches `overhang` past its face edge into the gap. Its screw lines are 6 mm in from the plates' edges.
 * Hooked on with the plates up to `hooked` apart (as far as the mechanism is tabulated), the lever draws them in to `locked`.
 */
export const PRINTED_LATCH = (() => {
  const locked = -TL.tautLink(TL.CLOSED).offset;
  return {
    locked, hooked: -TL.tautLink(TL.HOOK_RANGE[1]).offset, overhang: (PRINTED_LATCH_JOINT.gap - locked) / 2,
    plate: TG.base.back - TG.base.front, along: TG.base.height, length: TG.base.length,
  };
})();

/** Where the latches stand up a joint, as fractions of its height: one at half height, two at 20 and 80 %, three at 15, 50 and 85 %. */
export function latchHeights(count: 1 | 2 | 3): number[] {
  return count === 1 ? [0.5] : count === 2 ? [0.2, 0.8] : [0.15, 0.5, 0.85];
}

/**
 * One printed latch, placed: `at` is on the side faces' plane, at the base plate's edge across the gap from the catch (the seam)
 * and at the latch's middle; `out` is the side face's outward normal; `pull` points from the catch to the base, along the joint.
 * The latch's own frame (`latchPoses`: x across it, y along the pull, z off the face) is (pull × out, pull, out) at `at`.
 */
export interface LatchMount { id: string; side: -1 | 1; at: V3; out: V3; pull: V3 }

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Across the latch: the latch frame's x. */
export const latchAcross = (mount: LatchMount): V3 => cross(mount.pull, mount.out);

/**
 * The two screws through each plate's holes, heads on the plate's front, driven into the face: the base plate's into the face
 * `pull` points to, the catch plate's into the other.
 */
export function printedLatchScrews(mount: LatchMount): { base: { at: V3; direction: V3 }[]; catch: { at: V3; direction: V3 }[] } {
  const across = latchAcross(mount); const front = add(mount.at, mul(mount.out, PRINTED_LATCH.plate)); const direction = mount.out.map(c => -c || 0) as V3;
  const along = (offset: number) => add(front, mul(mount.pull, offset));
  return {
    base: TG.base.holeX.map(hx => ({ at: add(along(TG.base.holeZ), mul(across, hx - TG.base.middle)), direction })),
    catch: TG.catch.holeX.map(hx => ({ at: add(along(-PRINTED_LATCH.locked - TG.catch.holeZ), mul(across, hx - TG.catch.middle)), direction })),
  };
}

const round1 = (mm: number) => Number(mm.toFixed(1));
/** The parts list's line for printed latches: linked to the model, not the parts library. */
export function printedLatchLine(quantity: number, use: string): BomLine {
  return {
    id: toggleLatch.id, group: 'Hardware', name: `${toggleLatch.title}, printed`, quantity, modelId: toggleLatch.id,
    size: `4 printed parts each: base, lever, link and catch · ${PRINTED_LATCH.length} × ${round1(PRINTED_LATCH.along)} × ${round1(PRINTED_LATCH.plate)} plates · holes for DIN 7997 4 × 25 (the model’s default)`, use,
  };
}
/** The E-profile seal's name in the parts lists. */
export const E_PROFILE_SEAL = 'EPDM E-profile seal, self-adhesive (custom)';
