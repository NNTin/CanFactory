import type { Assembly, LinkedReference, ModelDefinition, ParameterValues } from './models.ts';
import { findPart } from './parts/index.ts';

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

/** The steps of their own that linked references add (`LinkedReference.step`), one per title, in the order the titles first appear;
 * each moves every reference of that title, from the first one's offset. */
function linkedSteps(linked: LinkedReference[]): Assembly['steps'] {
  const titles = [...new Set(linked.flatMap(reference => reference.step ? [reference.step.title] : []))];
  return titles.map(title => {
    const members = linked.filter(reference => reference.step?.title === title);
    return { title, parts: members.map(reference => reference.id), from: [...members[0]?.step?.from ?? [0, 0, 0]] };
  });
}

/**
 * The assembly for these parameters: `assembly` (as served) with the model's `linkedReferences` for them added, e.g. the magnets
 * of a magnet snap. Each gets its pose, joins the steps that move the part it is mounted in (or a step of its own after them), and is
 * titled after its library part. With a model's `assemblyScale` other than 1 (e.g. a smaller prototype), every position, step offset
 * and the lift are scaled by it, to match the parts it scaled.
 */
export function resolveAssembly(model: Pick<ModelDefinition, 'linkedReferences' | 'assemblyScale'> | undefined, assembly: Assembly | undefined, parameters: ParameterValues): Assembly | undefined {
  const linked = assembly ? model?.linkedReferences?.(parameters) ?? [] : [];
  const scale = assembly ? model?.assemblyScale?.(parameters) ?? 1 : 1;
  if (!assembly || (linked.length === 0 && scale === 1)) return assembly;
  const resolved: Assembly = linked.length === 0 ? assembly : {
    ...assembly,
    poses: { ...assembly.poses, ...Object.fromEntries(linked.map(reference => [reference.id, reference.pose])) },
    steps: [...assembly.steps.map(step => {
      const riders = linked.filter(reference => reference.movesWith !== undefined && step.parts.includes(reference.movesWith)).map(reference => reference.id);
      return riders.length > 0 ? { ...step, parts: [...step.parts, ...riders] } : step;
    }), ...linkedSteps(linked)],
    references: [...assembly.references ?? [], ...linked.map(reference => ({ id: reference.id, part: reference.part, title: `${findPart(reference.part)?.title ?? reference.part} (${reference.label})` }))],
  };
  return scale === 1 ? resolved : scaleAssembly(resolved, scale);
}

/** The assembly of parts scaled by `scale` about their own origins: every position, step offset and the lift scaled by it. */
function scaleAssembly(assembly: Assembly, scale: number): Assembly {
  const times = (vector: number[]): Vector => [(vector[0] ?? 0) * scale, (vector[1] ?? 0) * scale, (vector[2] ?? 0) * scale];
  return {
    ...assembly,
    poses: Object.fromEntries(Object.entries(assembly.poses).map(([id, pose]) => [id, { ...pose, position: times(pose.position) }])),
    steps: assembly.steps.map(step => ({ ...step, from: times(step.from) })),
    lift: assembly.lift * scale,
  };
}
