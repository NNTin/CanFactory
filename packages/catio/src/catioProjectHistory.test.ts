import { describe, expect, it } from 'vitest';
import { addPlatform, applyEdit, beginEdit, cancelEdit, canRedo, canUndo, commitEdit, createHistory, createProject, deleteInstance, moveInstance, previewEdit, redo, undo } from './index.ts';

const start = () => createHistory(createProject({ id: 'p1' }));
const xOf = (h: ReturnType<typeof start>) => h.present.instances.find(i => i.id === 'enclosure-1')?.transform.x;

describe('project history', () => {
  it('makes one complete drag one undo step, however many previews it had', () => {
    let h = beginEdit(start());
    for (const x of [2510, 2550, 2600, 2700]) h = previewEdit(h, moveInstance(h.pending ?? h.present, 'enclosure-1', { x }).project);
    expect(xOf(h)).toBe(2700);
    expect(canUndo(h)).toBe(false);
    h = commitEdit(h);
    expect(h.past).toHaveLength(1); expect(h.present.revision).toBe(1);
    h = undo(h);
    expect(xOf(h)).toBe(2500); expect(h.present.revision).toBe(0);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(xOf(h)).toBe(2700); expect(h.present.revision).toBe(1);
  });

  it('cancels an edit in progress back to the document before it, with no step', () => {
    const before = start();
    let h = previewEdit(beginEdit(before), moveInstance(before.present, 'enclosure-1', { x: 900 }).project);
    h = cancelEdit(h);
    expect(h.present).toEqual(before.present);
    expect(h.past).toEqual([]); expect(h.pending).toBeNull();
  });

  it('restores the whole document on undo, connections and attachments included', () => {
    let h = applyEdit(start(), addPlatform(start().present, 'enclosure-1').project);
    const furnished = h.present;
    h = applyEdit(h, deleteInstance(h.present, 'enclosure-1').project);
    expect(h.present.connections.map(c => c.id)).toEqual(['connection-1']);
    expect(h.present.attachments).toEqual([]);
    h = undo(h);
    expect(h.present).toEqual(furnished);
    h = undo(h);
    expect(h.present).toEqual(start().present);
    expect(canUndo(h)).toBe(false);
    // a new edit after undoing drops the redo branch
    h = applyEdit(h, moveInstance(h.present, 'enclosure-1', { y: 900 }).project);
    expect(canRedo(h)).toBe(false);
  });

  it('leaves no step for an edit that changed nothing, and keeps the view out of undo', () => {
    const h = applyEdit(start(), start().present);
    expect(h.past).toEqual([]);
    let viewed = applyEdit(start(), moveInstance(start().present, 'enclosure-1', { x: 2000 }).project);
    viewed = { ...viewed, present: { ...viewed.present, view: { selection: ['enclosure-1'], hidden: [], camera: 'top' } } };
    expect(undo(viewed).present.view.selection).toEqual(['enclosure-1']);
    // no undo or redo while an edit is in progress
    const busy = beginEdit(viewed);
    expect(undo(busy)).toBe(busy); expect(redo(busy)).toBe(busy);
  });
});
