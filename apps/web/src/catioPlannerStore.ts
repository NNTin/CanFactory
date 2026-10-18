import { createContext, useContext, useSyncExternalStore } from 'react';
import {
  applyEdit, beginEdit, cancelEdit, commitEdit, createHistory, createProject, evaluateProject, previewEdit, redo, undo,
  type History, type Project, type ProjectEvaluation,
} from '@canfactory/catio';

/**
 * The catio planner's project store: the one place the planner page, its build list and its persistence (#115) read and change the
 * project. It holds the undo history (catioProjectHistory.ts) and tells its subscribers of every change; the selection is the
 * document's `view.selection`, which undo and redo keep. `evaluation()` is the present project's, computed once per document.
 */
export interface PlannerStore {
  get: () => History;
  subscribe: (listener: () => void) => () => void;
  /** One complete edit: one undo step. */
  apply: (project: Project) => void;
  /** A step of an edit in progress (a drag), shown but not yet an undo step. */
  preview: (project: Project) => void;
  /** Ends the edit in progress as one undo step. */
  commit: () => void;
  /** Abandons the edit in progress (Esc). */
  cancel: () => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
  /** Starts over from `project` (a loaded or imported one), with a new history. */
  load: (project: Project) => void;
  evaluation: () => ProjectEvaluation;
}

const DESIGN = ['garden', 'settings', 'instances', 'ports', 'connections', 'attachments'] as const;

export function createPlannerStore(project: Project = createProject()): PlannerStore {
  let history = createHistory(project);
  const listeners = new Set<() => void>();
  let evaluated: { project: Project; evaluation: ProjectEvaluation } | null = null;
  const set = (next: History) => { if (next === history) return; history = next; for (const listener of listeners) listener(); };
  return {
    get: () => history,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    apply: next => set(applyEdit(history, next)),
    preview: next => set(previewEdit(beginEdit(history), next)),
    commit: () => set(commitEdit(history)),
    cancel: () => set(cancelEdit(history)),
    undo: () => set(undo(history)),
    redo: () => set(redo(history)),
    select(ids) {
      const { present } = history;
      if (JSON.stringify(present.view.selection) === JSON.stringify(ids)) return;
      set({ ...history, present: { ...present, view: { ...present.view, selection: ids } } });
    },
    load: next => set(createHistory(next)),
    evaluation() {
      const { present } = history;
      // the view is not part of the design: a change of selection keeps the evaluation
      if (evaluated && DESIGN.every(key => evaluated?.project[key] === present[key])) return evaluated.evaluation;
      evaluated = { project: present, evaluation: evaluateProject(present) };
      return evaluated.evaluation;
    },
  };
}

export const PlannerStoreContext = createContext<PlannerStore | null>(null);

/** The page's store, from `PlannerStoreContext`. */
export function usePlannerStore(): PlannerStore {
  const store = useContext(PlannerStoreContext);
  if (!store) throw new Error('usePlannerStore needs a PlannerStoreContext provider.');
  return store;
}
/** The history, re-rendering on every change. */
export function usePlannerHistory(): History {
  const store = usePlannerStore();
  return useSyncExternalStore(store.subscribe, store.get);
}
/** The selected instance ids and a way to select others. */
export function useSelection(): [string[], (ids: string[]) => void] {
  const store = usePlannerStore();
  return [useSyncExternalStore(store.subscribe, store.get).present.view.selection, store.select];
}
