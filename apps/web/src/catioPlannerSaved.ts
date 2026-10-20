import { createContext } from 'react';
import { parseProject, serializeProject, type Project } from '@canfactory/catio';
import { createPlannerStore, type PlannerStore } from './catioPlannerStore.ts';

/**
 * The catio planner's project in this browser (#115, FR-08.1–4): one project slot in localStorage, saved after each committed edit
 * and opened on start. Nothing is saved while an edit is in progress (a drag's pointer moves), only once it is committed, undone
 * or redone, or a project is imported. Storage is passed in (`() => localStorage` in the page) so that a browser without it, or
 * one whose storage is full, is a state the page shows, not an error it throws.
 */
export const PLANNER_STORAGE_KEY = 'canfactory.catio.planner.v1';

export type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;
export const browserStorage: StorageAccess = () => window.localStorage;


/** Why the saved project did not open: storage that cannot be read, or data that is not a project this planner reads. */
export type SavedProblem = { kind: 'unavailable'; message: string } | { kind: 'invalid'; errors: string[]; text: string };
export interface SavedProject { project: Project | null; problem: SavedProblem | null }

/** The saved project, or (none saved, or none readable) null with why. It never throws. */
export function readSavedProject(storage: StorageAccess = browserStorage): SavedProject {
  let text: string | null;
  try { text = storage().getItem(PLANNER_STORAGE_KEY); } catch (error) { return { project: null, problem: { kind: 'unavailable', message: (error as Error).message } }; }
  if (text === null) return { project: null, problem: null };
  const parsed = parseProject(text);
  return parsed.ok ? { project: parsed.project, problem: null } : { project: null, problem: { kind: 'invalid', errors: parsed.errors, text } };
}

/** `saved`: the present project is in storage; `pending`: not yet (kept invalid data); `failed`: storage refused it. */
export type SaveState = { state: 'saved'; revision: number } | { state: 'pending' } | { state: 'failed'; message: string };

export interface Autosave {
  get: () => SaveState;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
}

/** The design without how it is viewed: what an edit changes. */
const design = (project: Project) => JSON.stringify({ ...project, view: null });

/**
 * Saves the store's present project now and whenever it changes outside an edit in progress. With `keepUntilEdit` (the saved data
 * could not be opened) nothing is written until the design itself changes, so that opening the page or selecting something does
 * not overwrite that data.
 */
export function createAutosave(store: PlannerStore, { storage = browserStorage, keepUntilEdit = false }: { storage?: StorageAccess; keepUntilEdit?: boolean } = {}): Autosave {
  const listeners = new Set<() => void>();
  let state: SaveState = { state: 'pending' };
  let last: Project | null = null;
  let kept = keepUntilEdit ? design(store.get().present) : null;
  const set = (next: SaveState) => { state = next; for (const listener of listeners) listener(); };
  const save = () => {
    const { present, pending } = store.get();
    if (pending || present === last) return;
    if (kept !== null) { if (design(present) === kept) return; kept = null; }
    last = present;
    try { storage().setItem(PLANNER_STORAGE_KEY, serializeProject(present)); set({ state: 'saved', revision: present.revision }); }
    catch (error) { set({ state: 'failed', message: storageMessage(error) }); }
  };
  const unsubscribe = store.subscribe(save);
  save();
  return { get: () => state, subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }, dispose: unsubscribe };
}

/**
 * The catio project open in this tab (#117): one store, one history and one autosave for the planner and every sub-assembly's view,
 * so that an edit on either is the other's too and one undo takes it back. Opened on first use from what is saved (or a new
 * project), and kept for the tab's life.
 */
export interface ProjectSession { store: PlannerStore; saved: SavedProject; autosave: Autosave }
let session: ProjectSession | null = null;
export function projectSession(): ProjectSession {
  if (!session) {
    const saved = readSavedProject();
    const store = createPlannerStore(saved.project ?? undefined);
    session = { store, saved, autosave: createAutosave(store, { keepUntilEdit: saved.problem?.kind === 'invalid' }) };
  }
  return session;
}
/** The session the planner's page shows, with what it opened from storage (an invalid saved project is kept until the first edit). */
export const ProjectSessionContext = createContext<ProjectSession | null>(null);

function storageMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return "This browser's storage is full.";
  return "This browser's storage is unavailable.";
}

/** The file name an export is saved under: the project's name, made safe for a file. */
export function exportFileName(project: Pick<Project, 'name' | 'revision'>): string {
  const slug = project.name.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').toLowerCase() || 'catio-project';
  return `${slug}-r${project.revision}.catio.json`;
}

/** Hands the browser a file to save. */
export function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
