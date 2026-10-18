import { describe, expect, it } from 'vitest';
import { createProject, moveInstance } from '@canfactory/catio';
import { createPlannerStore } from './catioPlannerStore.ts';

describe('the planner store', () => {
  it('makes a drag one undo step, and Esc puts it back', () => {
    const store = createPlannerStore();
    let changes = 0; store.subscribe(() => { changes++; });
    const start = store.get().present;
    store.preview(moveInstance(start, 'enclosure-1', { x: 1000 }).project);
    store.preview(moveInstance(start, 'enclosure-1', { x: 1200 }).project);
    store.cancel();
    expect(store.get().present.instances).toBe(start.instances);
    store.preview(moveInstance(start, 'enclosure-1', { x: 1200 }).project);
    store.commit();
    expect(store.get().past).toHaveLength(1);
    store.undo();
    expect(store.get().present.instances).toEqual(start.instances);
    store.redo();
    expect(store.get().present.instances.find(i => i.id === 'enclosure-1')?.transform.x).toBe(1200);
    expect(changes).toBe(7);
  });

  it('keeps the selection out of the history and the evaluation', () => {
    const store = createPlannerStore();
    const evaluation = store.evaluation();
    store.select(['enclosure-1']);
    expect(store.get().past).toHaveLength(0);
    expect(store.evaluation()).toBe(evaluation);
    store.apply(moveInstance(store.get().present, 'enclosure-1', { x: 900 }).project);
    store.undo();
    expect(store.get().present.view.selection).toEqual(['enclosure-1']);
    store.load(createProject({ name: 'Other' }));
    expect(store.get().present.name).toBe('Other');
    expect(store.get().past).toHaveLength(0);
  });
});
