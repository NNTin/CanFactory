import { BOM_GROUPS, bomRequirements, type BomGroup, type Requirement } from '@canfactory/contracts';
import type { Project, ProjectBomLine, ProjectEvaluation, ProjectIssue } from '@canfactory/catio';

/**
 * The planner's draft build list (#115, FR-07.1, 3–4, 13, 15): the evaluated project's parts list grouped as the catio pages group
 * theirs, each line with the instances it is for, and everything that keeps it from being a complete build. It is derived from one
 * evaluation of one revision, so that it never outlives an edit.
 */
export interface DraftBuildList {
  revision: number;
  groups: { group: BomGroup; lines: ProjectBomLine[] }[];
  /** What is not in the list or not settled yet: the enclosures' missing recipe first, then errors, then the rest. */
  unresolved: ProjectIssue[];
  /** While anything is unresolved or an issue is open, the list is a draft, never a complete build. */
  draft: boolean;
  /** The library parts of the list, for offers and the buy list. */
  requirements: Requirement[];
}

/** One line per physical item: the same item for several instances is counted once, with all of them as its sources. */
function merge(lines: readonly ProjectBomLine[]): ProjectBomLine[] {
  const merged = new Map<string, ProjectBomLine>();
  for (const line of lines) {
    const key = [line.group, line.partId ?? '', line.modelId ?? '', line.name, line.size, line.use].join('|');
    const known = merged.get(key);
    if (known) merged.set(key, { ...known, quantity: known.quantity + line.quantity, sources: [...new Set([...known.sources, ...line.sources])] });
    else merged.set(key, { ...line, sources: [...line.sources] });
  }
  return [...merged.values()];
}

export function draftBuildList(project: Pick<Project, 'revision' | 'instances'>, evaluation: Pick<ProjectEvaluation, 'bom' | 'issues' | 'unresolved'>): DraftBuildList {
  const lines = merge(evaluation.bom);
  const kindOf = new Map(project.instances.map(i => [i.id, i.kind]));
  const rank = (issue: ProjectIssue) => issue.kind === 'missing-recipe' && issue.instanceIds.some(id => kindOf.get(id) === 'enclosure') ? 0
    : issue.severity === 'error' ? 1 : issue.kind === 'missing-recipe' ? 2 : 3;
  // a stable sort: the evaluation's order within each rank
  const unresolved = [...evaluation.unresolved].sort((a, b) => rank(a) - rank(b));
  return {
    revision: project.revision,
    groups: BOM_GROUPS.map(group => ({ group, lines: lines.filter(line => line.group === group) })).filter(g => g.lines.length > 0),
    unresolved,
    draft: unresolved.length > 0 || evaluation.issues.some(i => i.severity !== 'info'),
    requirements: bomRequirements(lines),
  };
}
