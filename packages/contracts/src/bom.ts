import type { ModelDefinition, ParameterValues } from './models.ts';
import type { Requirement } from './parts/matcher.ts';

export const BOM_GROUPS = ['Timber', 'Mesh', 'Hardware', 'Groundwork'] as const;
export type BomGroup = typeof BOM_GROUPS[number];
/** One line of a parts list (the catio pages' “Everything it takes”). A library part links to the parts library; other lines are cut or made for the build. */
export interface BomLine {
  id: string;
  group: BomGroup;
  name: string;
  quantity: number;
  /** Size, e.g. a cut length and section, or a part's key dimensions, in millimetres. */
  size: string;
  /** Where it goes. */
  use: string;
  partId?: string;
  /** A part printed from a model of the library (e.g. `toggle-latch`): links to the model. */
  modelId?: string;
}

/**
 * The library parts a model needs for these settings: every real-world object of its assembly (its references, and the linked
 * references its settings place, e.g. the case's magnets or the shovel's screws), counted by part, in the order they first appear.
 * Derived only: hardware that a model does not place in its assembly preview is not in it.
 */
export function modelBom(model: Pick<ModelDefinition, 'assembly' | 'assemblyForParameters' | 'linkedReferences'>, parameters: ParameterValues): Requirement[] {
  const assembly = model.assemblyForParameters?.(parameters) ?? model.assembly;
  return countParts([...(assembly?.references ?? []).map(reference => reference.part), ...(model.linkedReferences?.(parameters) ?? []).map(reference => reference.part)]
    .map(partId => ({ partId, quantity: 1 })));
}

/** The library parts of a parts list, counted by part. */
export function bomRequirements(lines: readonly BomLine[]): Requirement[] {
  return countParts(lines.flatMap(line => line.partId ? [{ partId: line.partId, quantity: line.quantity }] : []));
}

/** Requirements summed by part, in the order each part first appears. */
export function countParts(requirements: readonly Requirement[]): Requirement[] {
  const counts = new Map<string, number>();
  for (const requirement of requirements) counts.set(requirement.partId, (counts.get(requirement.partId) ?? 0) + requirement.quantity);
  return [...counts].map(([partId, quantity]) => ({ partId, quantity }));
}
