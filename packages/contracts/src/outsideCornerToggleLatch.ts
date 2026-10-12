import type { Assembly, ParameterIssue } from './models.ts';
import { dimensionOf, findPart } from './parts/index.ts';
import { CLOSED, latchState } from './toggleLatchMechanism.ts';

/** Dimensions shared with the two self-contained generators. The original mechanism stays unchanged. */
export const CORNER_LATCH = { plate: 4, endMargin: 8, tipClearance: 2, minBite: 8, minSetbackDiameters: 3 } as const;
export const DEFAULT_CORNER_LATCH = {
  plankThickness: 18, edgeDistance: 18, woodScrewDiameter: '4 mm', woodScrew: 'din-7997-4x20', holeFit: 'medium', highTolerance: false,
} as const;
export const CORNER_LATCH_SCREWS = [
  'din-7997-3x12', 'din-7997-3x16', 'din-7997-3x20', 'din-7997-3x25', 'din-7997-3x30',
  'din-7997-3-5x16', 'din-7997-3-5x20', 'din-7997-3-5x25', 'din-7997-3-5x30', 'din-7997-3-5x35', 'din-7997-3-5x40',
  'din-7997-4x20', 'din-7997-4x25', 'din-7997-4x30', 'din-7997-4x35', 'din-7997-4x40',
  'din-7997-4-5x25', 'din-7997-4-5x30', 'din-7997-4-5x35', 'din-7997-4-5x40',
  'din-7997-5x30', 'din-7997-5x35', 'din-7997-5x40',
] as const;
export interface CornerLatchSettings { plankThickness: number; edgeDistance: number; woodScrew: string }

export function cornerLatchLayout(p: CornerLatchSettings) {
  const screw = findPart(p.woodScrew);
  if (!screw) throw new Error(`Unknown wood screw: ${p.woodScrew}`);
  const holeAt = p.plankThickness + p.edgeDistance;
  return { screw, holeAt, legLength: holeAt + CORNER_LATCH.endMargin, bite: dimensionOf(screw, 'l') - CORNER_LATCH.plate,
    baseFromCorner: holeAt - latchState(CLOSED).offset, catchFromCorner: holeAt };
}

export function cornerLatchIssues(p: CornerLatchSettings): ParameterIssue[] {
  const l = cornerLatchLayout(p), screw = l.screw;
  const issues: ParameterIssue[] = [];
  if (l.bite > p.plankThickness - CORNER_LATCH.tipClearance + 1e-9)
    issues.push({ field: 'woodScrew', message: `This screw penetrates ${l.bite} mm into the plank. Choose a shorter screw or thicker planks to leave at least ${CORNER_LATCH.tipClearance} mm before the far face.` });
  if (l.bite < CORNER_LATCH.minBite)
    issues.push({ field: 'woodScrew', message: `Choose a screw with at least ${CORNER_LATCH.minBite} mm of penetration beyond the mounting plate.` });
  const minimum = dimensionOf(screw, 'd') * CORNER_LATCH.minSetbackDiameters;
  if (p.edgeDistance < minimum)
    issues.push({ field: 'edgeDistance', message: `Use at least ${minimum} mm beyond the butt joint for this screw. This is a layout allowance, not a structural timber rating.` });
  return issues;
}

/** Raise the unchanged kinematics so the catch's downward mounting flange stands on the preview floor. No fake corner rotation
 * of the hook: the catch's SCAD flange changes the mounting normal while retaining the original hook position and draw stroke. */
export function cornerLatchAssembly(original: Assembly, p: CornerLatchSettings): Assembly {
  const { legLength } = cornerLatchLayout(p);
  const raise = (poses: Assembly['poses']): Assembly['poses'] => Object.fromEntries(Object.entries(poses).map(([id, pose]) => [id,
    { ...pose, position: pose.position.map((v, axis) => axis === 2 ? v + legLength : v) },
  ]));
  return { ...original, poses: raise(original.poses), steps: original.steps.map(step => step.parts.includes('catch')
    ? { ...step, title: 'Mount the catch on the perpendicular outside plank face' } : step),
  motion: (original.motion ?? []).map(movement => ({ ...movement, frames: movement.frames.map(raise) })) };
}
