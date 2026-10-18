import type { Project } from './catioProject.ts';

/**
 * The planner's undo history: whole documents, so that undoing restores everything an edit changed (instances, ports, connections
 * and attachments alike). An edit is a transaction: `beginEdit` it, `previewEdit` each step of it (a drag's every pointer move), then
 * `commitEdit` it as one undo step, or `cancelEdit` it to put the document back as it was. `applyEdit` is a one-step edit. Committing counts
 * the project's revision. The view (`project.view`) is not part of a step: undo and redo keep the current one.
 */
export interface History {
  past: Project[];
  /** The document as it is now: an edit's preview while one is in progress. */
  present: Project;
  future: Project[];
  /** The document before the edit in progress, if there is one. */
  pending: Project | null;
}

export const createHistory = (project: Project): History => ({ past: [], present: project, future: [], pending: null });

export const beginEdit = (h: History): History => h.pending ? h : { ...h, pending: h.present };

/** Shows `project` as the edit in progress (beginning one, if none is). */
export const previewEdit = (h: History, project: Project): History => ({ ...h, pending: h.pending ?? h.present, present: project });

/** Ends the edit in progress as one undo step; an edit that changed nothing leaves no step. */
export function commitEdit(h: History): History {
  if (!h.pending) return h;
  if (physical(h.pending) === physical(h.present)) return { ...h, pending: null };
  return { past: [...h.past, h.pending], present: { ...h.present, revision: h.pending.revision + 1 }, future: [], pending: null };
}

/** Abandons the edit in progress: the document is as it was before it began. */
export const cancelEdit = (h: History): History => h.pending ? { ...h, present: { ...h.pending, view: h.present.view }, pending: null } : h;

export const applyEdit = (h: History, project: Project): History => commitEdit(previewEdit(beginEdit(h), project));

export const canUndo = (h: History) => !h.pending && h.past.length > 0;
export const canRedo = (h: History) => !h.pending && h.future.length > 0;

export function undo(h: History): History {
  const previous = h.past.at(-1);
  if (!previous || h.pending) return h;
  return { past: h.past.slice(0, -1), present: { ...previous, view: h.present.view }, future: [h.present, ...h.future], pending: null };
}

export function redo(h: History): History {
  const [next, ...rest] = h.future;
  if (!next || h.pending) return h;
  return { past: [...h.past, h.present], present: { ...next, view: h.present.view }, future: rest, pending: null };
}

/** The document without its view and revision: what an undo step is about. */
const physical = (project: Project) => JSON.stringify({ ...project, view: null, revision: 0 });
