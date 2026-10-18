import { describe, expect, it } from 'vitest';
import { createProject, moveInstance, serializeProject } from '@canfactory/catio';
import { createPlannerStore } from './catioPlannerStore.ts';
import { createAutosave, exportFileName, PLANNER_STORAGE_KEY, readSavedProject, type StorageAccess } from './catioPlannerSaved.ts';

/** An in-memory storage that counts its writes, and fails them while `full`. */
function memory(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  const state = { writes: 0, full: false };
  const storage: StorageAccess = () => ({
    getItem: key => items.get(key) ?? null,
    setItem(key, value) {
      if (state.full) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      state.writes++; items.set(key, value);
    },
  });
  return { storage, items, state };
}
const unavailable: StorageAccess = () => { throw new Error('The operation is insecure.'); };

describe('the saved planner project', () => {
  it('opens what was saved, nothing when nothing was, and reports unreadable storage and invalid data', () => {
    const saved = createProject({ name: 'Saved' });
    expect(readSavedProject(memory({ [PLANNER_STORAGE_KEY]: serializeProject(saved) }).storage).project?.name).toBe('Saved');
    expect(readSavedProject(memory().storage)).toEqual({ project: null, problem: null });
    expect(readSavedProject(unavailable).problem?.kind).toBe('unavailable');
    const invalid = readSavedProject(memory({ [PLANNER_STORAGE_KEY]: '{"schemaVersion": 99}' }).storage);
    expect(invalid.project).toBeNull();
    expect(invalid.problem).toMatchObject({ kind: 'invalid', text: '{"schemaVersion": 99}' });
    expect(invalid.problem?.kind === 'invalid' && invalid.problem.errors[0]).toMatch(/newer planner/);
  });

  it('saves after each committed edit, never during one', () => {
    const { storage, state } = memory();
    const store = createPlannerStore();
    const autosave = createAutosave(store, { storage });
    expect(state.writes).toBe(1);
    const start = store.get().present;
    for (const x of [1000, 1100, 1200]) store.preview(moveInstance(start, 'enclosure-1', { x }).project);
    expect(state.writes).toBe(1);
    store.commit();
    expect(state.writes).toBe(2);
    expect(autosave.get()).toEqual({ state: 'saved', revision: 1 });
    expect(readSavedProject(storage).project?.instances.find(i => i.id === 'enclosure-1')?.transform.x).toBe(1200);
    store.undo();
    expect(readSavedProject(storage).project?.revision).toBe(0);
    autosave.dispose();
    store.redo();
    expect(state.writes).toBe(3);
  });

  it('keeps invalid saved data until the design is edited', () => {
    const { storage, items } = memory({ [PLANNER_STORAGE_KEY]: 'not json' });
    const store = createPlannerStore();
    const autosave = createAutosave(store, { storage, keepUntilEdit: true });
    store.select(['enclosure-1']);
    expect(items.get(PLANNER_STORAGE_KEY)).toBe('not json');
    expect(autosave.get().state).toBe('pending');
    store.apply(moveInstance(store.get().present, 'enclosure-1', { x: 1500 }).project);
    expect(readSavedProject(storage).project?.revision).toBe(1);
  });

  it('reports storage that is full or unavailable as not saved', () => {
    const { storage, state } = memory();
    state.full = true;
    const store = createPlannerStore();
    const autosave = createAutosave(store, { storage });
    expect(autosave.get()).toEqual({ state: 'failed', message: "This browser's storage is full." });
    state.full = false;
    store.apply(moveInstance(store.get().present, 'enclosure-1', { x: 1500 }).project);
    expect(autosave.get().state).toBe('saved');
    expect(createAutosave(createPlannerStore(), { storage: unavailable }).get()).toEqual({ state: 'failed', message: "This browser's storage is unavailable." });
  });

  it('names an export after the project and its revision', () => {
    expect(exportFileName({ name: 'Garden catio · 2026', revision: 4 })).toBe('garden-catio-2026-r4.catio.json');
    expect(exportFileName({ name: '???', revision: 0 })).toBe('catio-project-r0.catio.json');
  });
});
