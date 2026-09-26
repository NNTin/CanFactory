import type { Assembly } from './models.ts';

type Vector = [number, number, number];

/** Where the assembly slider is: how far the parts have come from the print bed, and how far each step has played (0..1). */
export interface AssemblyState { arrange: number; steps: number[] }

/** The slider's stops: the print bed, the exploded layout, then one per step (the last is the finished assembly). */
export const assemblyStops = (assembly: Assembly): number => assembly.steps.length + 2;

const ease = (value: number): number => value * value * (3 - 2 * value);
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * The slider value `t` (0..1) as equal, eased segments: lifting the parts off the print bed, then each step in order.
 * Every stop from `assemblyStops` falls exactly on a segment boundary.
 */
export function assemblyState(assembly: Assembly, t: number): AssemblyState {
  const segments = assembly.steps.length + 1;
  const at = clamp01(t) * segments;
  return { arrange: ease(clamp01(at)), steps: assembly.steps.map((_, index) => ease(clamp01(at - 1 - index))) };
}

/**
 * The part's offset from its assembled pose in this state, once it has left the print bed: the unplayed part of every step
 * it moves in, plus the lift, which is removed during the last step.
 */
export function assemblyOffset(assembly: Assembly, partId: string, state: AssemblyState): Vector {
  const offset: Vector = [0, 0, assembly.lift * (1 - (state.steps.at(-1) ?? 1))];
  assembly.steps.forEach((step, index) => {
    if (!step.parts.includes(partId)) return;
    const remaining = 1 - (state.steps[index] ?? 0);
    for (let axis = 0; axis < 3; axis++) offset[axis] = (offset[axis] ?? 0) + (step.from[axis] ?? 0) * remaining;
  });
  return offset;
}
