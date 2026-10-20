import { describe, expect, it } from 'vitest';
import { CATIO_SUBASSEMBLY_DEFINITIONS } from './catioSubassemblies.ts';
import type { SubassemblyDefinition } from './catioSubassembly.ts';
import { CATIO_SUBASSEMBLIES, clearOf, configureSubassembly, createProject, evaluateProject, fastenerClashes, hasSubject, type CatioSubassembly, type Project } from '@canfactory/catio';

const definition = (id: CatioSubassembly) => CATIO_SUBASSEMBLY_DEFINITIONS[id] as unknown as SubassemblyDefinition<object, unknown>;
/** What a view of `id` shows of the project's first window or tunnel: its config, checks and parts list. */
function view(project: Project, id: CatioSubassembly) {
  const d = definition(id);
  const subject = d.subject(project, evaluateProject(project), null);
  if (!hasSubject(subject)) throw new Error(`${id}: ${subject.problem}`);
  return { subject, errors: d.validate(subject.config, subject.site), bom: JSON.stringify(d.bom(subject.config, subject.site)), facts: d.facts(subject.config, subject.site) };
}
const edit = (project: Project, id: CatioSubassembly, instance: string, patch: Record<string, unknown>) => {
  const result = configureSubassembly(project, id, instance, patch);
  expect(result.errors).toEqual([]);
  return result.project;
};

describe('sub-assembly views of the project (#117)', () => {
  it('shows every sub-assembly of a new project fitted to it, with nothing that does not fit', () => {
    const project = createProject();
    for (const id of CATIO_SUBASSEMBLIES) {
      const shown = view(project, id);
      expect(shown.subject.instance, id).toBe(id === 'window-insert' || id === 'insert-tunnel-coupling' ? 'window-1' : 'tunnel-1');
      expect(shown.errors, id).toEqual([]);
      expect(shown.bom.length, id).toBeGreaterThan(2);
    }
  });

  it('reads one source: a choice made on one view is what every other view and the planner show', () => {
    let project = createProject();
    // the insert's feet move the window port's floor: the tunnel and the coupling start from it
    const floor = view(project, 'tunnel').facts.find(f => f.label.startsWith('Window port floor'))?.value;
    project = edit(project, 'window-insert', 'window-1', { padHeight: 30 });
    expect(view(project, 'window-insert').subject.config).toMatchObject({ padHeight: 30 });
    expect(view(project, 'tunnel').facts.find(f => f.label.startsWith('Window port floor'))?.value).not.toBe(floor);
    // the mesh is the whole catio's: set on the tunnel, the insert has it too
    project = edit(project, 'tunnel', 'tunnel-1', { mesh: 'welded' });
    expect(view(project, 'window-insert').subject.config).toMatchObject({ mesh: 'welded' });
    expect(project.settings.mesh).toBe('welded');
    // how the tunnel is held on its supports: one setting, on the tunnel and on its couplings
    project = edit(project, 'tunnel-tunnel-coupling', 'tunnel-1', { supportFixing: 'strap' });
    expect(view(project, 'tunnel').subject.config).toMatchObject({ supportFixing: 'strap' });
    // the couplings' mechanism is every coupling's: the tunnel is bolted throughout
    const latched = view(project, 'tunnel').bom;
    project = edit(project, 'tunnel-tunnel-coupling', 'tunnel-1', { mechanism: 'bolts' });
    expect(view(project, 'tunnel').bom).not.toBe(latched);
    expect(view(project, 'tunnel').bom).not.toMatch(/Toggle latch, printed/);
    // bolted face to face, the module pitch loses the latches' gap: the enclosure is no longer whole modules away, and the planner says so
    expect(evaluateProject(project).issues.filter(i => i.severity === 'error').map(i => i.id)).toEqual(['connection:tunnel-1+enclosure-1:route']);
  });

  it('says why an instance has no such sub-assembly, rather than showing another', () => {
    const project = createProject();
    const alone = { ...project, instances: project.instances.filter(i => i.kind !== 'tunnel'), ports: project.ports.filter(p => !p.owner.startsWith('tunnel')), connections: [] };
    const evaluation = evaluateProject(alone);
    expect(definition('insert-tunnel-coupling').subject(alone, evaluation, null)).toEqual({ instance: 'window-1', problem: "No tunnel starts at Window's cat port: draw one from it in the planner." });
    expect(definition('tunnel').subject(alone, evaluation, null)).toEqual({ instance: null, problem: 'The project has no tunnel: add one in the planner.' });
    expect(definition('tunnel').subject(project, evaluateProject(project), 'window-1')).toEqual({ instance: null, problem: 'Window is a window, not a tunnel.' });
  });
});

describe('fasteners clear of each other', () => {
  it('moves only the positions too close to one already there, to the nearest clear spot in range', () => {
    expect(clearOf([0, 100, 200], [100], 12, 0, 200)).toEqual([0, 88, 200]);
    expect(clearOf([0, 100, 200], [95, 105], 12, 0, 200)).toEqual([0, 83, 200]);
    expect(clearOf([0], [5], 12, 0, 200)).toEqual([17]);
    expect(clearOf([0], [0], 12, 0, 5)).toEqual([0]); // no clear spot: left for the check to report
  });

  it('measures across the driving direction, not along it', () => {
    const screw = { at: [0, 0, 0] as [number, number, number], direction: [0, -1, 0] as [number, number, number] };
    expect(fastenerClashes([screw], [{ at: [0, -40, 5] }], 12)).toHaveLength(1);
    expect(fastenerClashes([screw], [{ at: [12, -40, 0] }], 12)).toHaveLength(0);
  });
});
