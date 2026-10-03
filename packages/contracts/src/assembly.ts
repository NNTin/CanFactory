import type { Assembly, LinkedReference, ModelDefinition, ParameterValues } from './models.ts';
import { findPart } from './parts/index.ts';

type Vector = [number, number, number];

/**
 * Where the assembly slider is: how far the parts have come from the print bed, and how far each step has played (0..1); with
 * `Assembly.motion`, also how far each movement has played.
 */
export interface AssemblyState { arrange: number; steps: number[]; motion?: number[] }

/** The slider's stops: the print bed, the exploded layout, one per step (the last is the finished assembly), then one per movement. */
export const assemblyStops = (assembly: Assembly): number => assembly.steps.length + 2 + (assembly.motion?.length ?? 0);

const ease = (value: number): number => value * value * (3 - 2 * value);
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * The slider value `t` (0..1) as equal, eased segments: lifting the parts off the print bed, then each step in order, then each
 * movement. Every stop from `assemblyStops` falls exactly on a segment boundary.
 */
export function assemblyState(assembly: Assembly, t: number): AssemblyState {
  const motion = assembly.motion ?? [];
  const segments = assembly.steps.length + 1 + motion.length;
  const at = clamp01(t) * segments;
  const state: AssemblyState = { arrange: ease(clamp01(at)), steps: assembly.steps.map((_, index) => ease(clamp01(at - 1 - index))) };
  if (motion.length > 0) state.motion = motion.map((_, index) => ease(clamp01(at - 1 - assembly.steps.length - index)));
  return state;
}

type Pose = Assembly['poses'][string];

/**
 * Every movement's poses: for each, the poses it starts from (the previous one's last, or the assembled poses) followed by one per
 * frame, each complete (the parts a frame leaves out keep their pose).
 */
export function motionFrames(assembly: Assembly): Record<string, Pose>[][] {
  let current: Record<string, Pose> = { ...assembly.poses };
  return (assembly.motion ?? []).map(movement => {
    const frames = [current];
    for (const frame of movement.frames) { current = { ...current, ...frame }; frames.push(current); }
    return frames;
  });
}

/**
 * The poses between which a part is moving in this state, and how far between them (0..1): undefined until a movement has begun,
 * so the steps place the parts. A part interpolated between the two (position linearly, rotation along the shorter arc) stays
 * rigid and, since the frames are dense, on its joints.
 */
export function motionPose(frames: Record<string, Pose>[][], partId: string, state: AssemblyState): { from: Pose; to: Pose; f: number } | undefined {
  const progress = state.motion ?? [];
  let index = -1;
  for (let k = 0; k < progress.length; k++) if ((progress[k] ?? 0) > 0) index = k;
  const movement = frames[index];
  if (!movement) return undefined;
  const at = (progress[index] ?? 0) * (movement.length - 1);
  const i = Math.min(movement.length - 2, Math.floor(at));
  const from = movement[i]?.[partId], to = movement[i + 1]?.[partId];
  return from && to ? { from, to, f: at - i } : undefined;
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
 * titled after its library part.
 */
export function resolveAssembly(model: Pick<ModelDefinition, 'linkedReferences' | 'assemblyForParameters'> | undefined, assembly: Assembly | undefined, parameters: ParameterValues): Assembly | undefined {
  assembly = model?.assemblyForParameters?.(parameters) ?? assembly;
  const linked = assembly ? model?.linkedReferences?.(parameters) ?? [] : [];
  if (!assembly || linked.length === 0) return assembly;
  return {
    ...assembly,
    poses: { ...assembly.poses, ...Object.fromEntries(linked.map(reference => [reference.id, reference.pose])) },
    steps: [...assembly.steps.map(step => {
      const riders = linked.filter(reference => reference.movesWith !== undefined && step.parts.includes(reference.movesWith)).map(reference => reference.id);
      return riders.length > 0 ? { ...step, parts: [...step.parts, ...riders] } : step;
    }), ...linkedSteps(linked)],
    references: [...assembly.references ?? [], ...linked.map(reference => ({ id: reference.id, part: reference.part, title: `${findPart(reference.part)?.title ?? reference.part} (${reference.label})` }))],
  };
}
