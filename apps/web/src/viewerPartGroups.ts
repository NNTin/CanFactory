import { findPart, type Assembly } from '@canfactory/contracts';

/** One row of the viewer's parts list: a part, or every placed instance of the same library part (`count` > 1). */
export interface PartGroup {
  /** The row's key: the part's id, or `library:<part id>` for a group of library parts. */
  key: string;
  title: string;
  /** The ids of the meshes the row shows and hides, in the order the viewer loaded them. */
  ids: string[];
  count: number;
  reference: boolean;
}

/**
 * The parts list's rows for the loaded parts: the assembly's reference objects that are the same library part (e.g. the four M3
 * screws of a joint, one linked reference per bolt) are one row, titled after the library part, at the first one's place; every
 * other part keeps its own row and title (`titles`, by id). The same item for several instances is counted once, with all of them
 * as its sources, as the catio build list's lines are.
 */
/**
 * The key the viewer groups a loaded part by: `library:<part id>` for a reference object of the assembly (every instance of that
 * library part shares it), else the part's own id. The parts list's rows and the print bed's cells both group by it.
 */
export function partGroupKeys(assembly: Pick<Assembly, 'references'> | undefined): (part: { id: string; reference: boolean }) => string {
  const libraryPart = new Map((assembly?.references ?? []).map(reference => [reference.id, reference.part]));
  return part => {
    const partId = part.reference ? libraryPart.get(part.id) : undefined;
    return partId ? `library:${partId}` : part.id;
  };
}

export function groupParts(parts: readonly { id: string; reference: boolean }[], assembly: Pick<Assembly, 'references'> | undefined, titles: Readonly<Record<string, string>>): PartGroup[] {
  const keyOf = partGroupKeys(assembly);
  const groups = new Map<string, PartGroup>();
  for (const part of parts) {
    const key = keyOf(part);
    const known = groups.get(key);
    if (known) { known.ids.push(part.id); known.count++; continue; }
    groups.set(key, { key, title: titles[part.id] ?? part.id, ids: [part.id], count: 1, reference: part.reference });
  }
  // a group takes its library part's own title: each instance's names its place (“… (left panel, joint 1–2)”)
  for (const group of groups.values()) {
    const partId = group.count > 1 && group.key.startsWith('library:') ? group.key.slice('library:'.length) : undefined;
    if (partId) group.title = findPart(partId)?.title ?? partId;
  }
  return [...groups.values()];
}
