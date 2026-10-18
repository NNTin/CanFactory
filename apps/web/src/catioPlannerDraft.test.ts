import { describe, expect, it } from 'vitest';
import { addEnclosure, addPlatform, createProject, evaluateProject, resizeInstance, type Project } from '@canfactory/catio';
import { draftBuildList } from './catioPlannerDraft.ts';

const draft = (project: Project) => draftBuildList(project, evaluateProject(project));

describe("the planner's draft build list", () => {
  it('groups the parts as the catio pages do, each line with its source instances', () => {
    const list = draft(createProject());
    expect(list.groups.map(g => g.group)).toEqual(['Timber', 'Mesh', 'Hardware', 'Groundwork'].filter(g => list.groups.some(x => x.group === g)));
    const lines = list.groups.flatMap(g => g.lines);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every(line => line.sources.length > 0 && line.quantity > 0)).toBe(true);
    expect(new Set(lines.flatMap(line => line.sources))).toEqual(new Set(['window-1', 'tunnel-1']));
    expect(list.requirements.length).toBeGreaterThan(0);
  });

  it('is a draft that starts its unresolved items with the enclosure recipe', () => {
    let project = createProject();
    const added = addEnclosure(project, { x: 4000, y: 3000 }, { width: 10, depth: 10, height: 10 });
    project = added.project;
    const list = draft(project);
    expect(list.draft).toBe(true);
    expect(list.unresolved[0]).toMatchObject({ kind: 'missing-recipe', instanceIds: ['enclosure-1'] });
    const ranks = list.unresolved.map(i => i.kind === 'missing-recipe' && i.instanceIds.some(id => id.startsWith('enclosure')) ? 0 : i.severity === 'error' ? 1 : 2);
    expect(ranks).toEqual([...ranks].sort());
  });

  it('follows the platform when it is resized, one line per item for every instance it is for', () => {
    const { project, id } = addPlatform(createProject(), 'enclosure-1');
    const platformLines = (p: Project) => draft(p).groups.flatMap(g => g.lines).filter(line => line.sources.includes(id ?? ''));
    const before = platformLines(project);
    const after = platformLines(resizeInstance(project, id ?? '', { depth: 600 }).project);
    expect(before.length).toBeGreaterThan(0);
    expect(after.map(l => `${l.quantity} ${l.size}`)).not.toEqual(before.map(l => `${l.quantity} ${l.size}`));
    // two identical lines from different instances are one, counted together
    const merged = draftBuildList({ revision: 3, instances: [] }, { issues: [], unresolved: [], bom: [
      { id: 'a', group: 'Hardware', name: 'Screw', quantity: 2, size: '4 × 40', use: 'Board', sources: ['p-1'] },
      { id: 'a', group: 'Hardware', name: 'Screw', quantity: 3, size: '4 × 40', use: 'Board', sources: ['p-2'] },
    ] });
    expect(merged).toMatchObject({ revision: 3, draft: false, groups: [{ group: 'Hardware', lines: [{ quantity: 5, sources: ['p-1', 'p-2'] }] }] });
  });
});
