import { describe, expect, it } from 'vitest';
import { findPart, models, resolveAssembly } from '@canfactory/contracts';
import { groupParts } from './viewerPartGroups.ts';

describe('the viewer’s parts list', () => {
  it('lists one row per instance of the same library part as one row with its count and every instance', () => {
    const assembly = { references: [
      { id: 'a-screw', part: 'iso-4762-m3x10', title: 'M3 screw (a)' },
      { id: 'b-screw', part: 'iso-4762-m3x10', title: 'M3 screw (b)' },
      { id: 'lighter', part: 'bic-j25-mini-lighter', title: 'BIC Mini lighter (J25)' },
    ] };
    const rows = groupParts([{ id: 'box', reference: false }, { id: 'a-screw', reference: true }, { id: 'lighter', reference: true }, { id: 'b-screw', reference: true }],
      assembly, { box: 'Box', 'a-screw': 'M3 screw (a)', 'b-screw': 'M3 screw (b)', lighter: 'BIC Mini lighter (J25)' });
    expect(rows.map(row => [row.title, row.ids, row.count])).toEqual([
      ['Box', ['box'], 1],
      [findPart('iso-4762-m3x10')?.title ?? 'iso-4762-m3x10', ['a-screw', 'b-screw'], 2],
      ['BIC Mini lighter (J25)', ['lighter'], 1],
    ]);
  });

  it('keeps printed parts and single references as they were', () => {
    const rows = groupParts([{ id: 'left', reference: false }, { id: 'right', reference: false }, { id: 'nut', reference: true }],
      { references: [{ id: 'nut', part: 'iso-4762-m3x10', title: 'M3 nut (left)' }] }, { left: 'Left', nut: 'M3 nut (left)' });
    expect(rows.map(row => [row.title, row.ids])).toEqual([['Left', ['left']], ['right', ['right']], ['M3 nut (left)', ['nut']]]);
  });

  it('groups the window cat guard’s repeated screws', () => {
    const model = models.find(candidate => candidate.id === 'window-cat-guard');
    if (!model) throw new Error('missing model');
    const assembly = resolveAssembly(model, model.assembly, model.defaults);
    const references = assembly?.references ?? [];
    const rows = groupParts(references.map(reference => ({ id: reference.id, reference: true })), assembly, Object.fromEntries(references.map(reference => [reference.id, reference.title])));
    expect(rows.length).toBeLessThan(references.length);
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(references.length);
    for (const row of rows) expect(new Set(row.ids.map(id => references.find(reference => reference.id === id)?.part)).size).toBe(1);
  });
});
