import { describe, expect, it } from 'vitest';
import {
  addTunnel, applyEdit, configureSubassembly, createHistory, createProject, evaluateProject, hasSubject, insertCouplingSubject, projectErrors,
  SETTINGS_DEFAULT, SUBASSEMBLY_CONTROLS, subassemblyInstances, tunnelCouplingSubject, tunnelSubject, undo, windowInsertSubject, type Project,
} from './index.ts';

const fresh = () => createProject({ id: 'p1' });
const sound = (project: Project) => { expect(projectErrors(JSON.parse(JSON.stringify(project)) as unknown)).toEqual([]); return project; };

describe('sub-assemblies of the project’s instances (#117)', () => {
  it('reads each sub-assembly of an instance from the project: the one source of its settings', () => {
    const project = fresh(); const evaluation = evaluateProject(project);
    const insert = windowInsertSubject(project, evaluation, null);
    if (!hasSubject(insert)) throw new Error(insert.problem);
    expect(insert.instance).toBe('window-1');
    expect(insert.config).toEqual({ ...SETTINGS_DEFAULT.insert, mesh: SETTINGS_DEFAULT.mesh });
    const coupling = insertCouplingSubject(project, evaluation, 'window-1');
    if (!hasSubject(coupling)) throw new Error(coupling.problem);
    expect(coupling.config).toEqual(SETTINGS_DEFAULT.insertCoupling);
    const tunnel = tunnelSubject(project, evaluation, 'tunnel-1');
    if (!hasSubject(tunnel)) throw new Error(tunnel.problem);
    // laid out along its own route, as the planner shows it, starting at the window, so docked by the insert–tunnel coupling
    const evaluated = evaluation.instances.find(e => e.id === 'tunnel-1');
    expect(evaluated?.kind === 'tunnel' && evaluated.layout).toBe(tunnel.site.layout);
    expect(tunnel.site.coupling).toEqual(SETTINGS_DEFAULT.insertCoupling);
    expect(tunnel.config).toMatchObject({ mesh: SETTINGS_DEFAULT.mesh, supportFixing: SETTINGS_DEFAULT.tunnelCoupling.supportFixing, sectionLength: 1 });
    const joint = tunnelCouplingSubject(project, evaluation, null);
    if (!hasSubject(joint)) throw new Error(joint.problem);
    expect(joint.config).toEqual({ ...SETTINGS_DEFAULT.tunnelCoupling, jointShown: 'end-end' });
    expect(subassemblyInstances(project, 'tunnel').map(i => i.id)).toEqual(['tunnel-1']);
  });

  it('shows a tunnel that starts at an enclosure without a window insert to dock to', () => {
    const added = addTunnel(fresh(), 'enclosure-1-right', 2);
    expect(added.errors).toEqual([]);
    const tunnel = tunnelSubject(added.project, evaluateProject(added.project), added.id);
    if (!hasSubject(tunnel)) throw new Error(tunnel.problem);
    expect(tunnel.site.coupling).toBeNull();
  });

  it('keeps each choice where the project holds it: the whole catio’s, or a tunnel’s own', () => {
    let p = fresh();
    const set = (id: Parameters<typeof configureSubassembly>[1], instance: string, patch: Record<string, unknown>) => {
      const result = configureSubassembly(p, id, instance, patch); expect(result.errors).toEqual([]); p = sound(result.project);
    };
    set('window-insert', 'window-1', { cornerJoint: 'half-lap', mesh: 'welded' });
    expect(p.settings.insert.cornerJoint).toBe('half-lap'); expect(p.settings.mesh).toBe('welded');
    expect('mesh' in p.settings.insert).toBe(false);
    set('insert-tunnel-coupling', 'window-1', { latch: 'gn-831', latchesPerSide: 2 });
    expect(p.settings.insertCoupling).toMatchObject({ latch: 'gn-831', latchesPerSide: 2 });
    set('tunnel', 'tunnel-1', { footPad: 'ganter', sectionLength: 2, supportFixing: 'dowels' });
    const tunnel = p.instances.find(i => i.id === 'tunnel-1');
    expect(tunnel?.kind === 'tunnel' && tunnel.params).toMatchObject({ footPad: 'ganter', sectionLength: 2 });
    expect(tunnel?.kind === 'tunnel' && 'supportFixing' in tunnel.params).toBe(false);
    expect(p.settings.tunnelCoupling.supportFixing).toBe('dowels');
    set('tunnel-tunnel-coupling', 'tunnel-1', { supportBase: 'self-standing', doorFixing: 'latches' });
    expect(p.settings.tunnelCoupling).toMatchObject({ supportBase: 'self-standing', doorFixing: 'latches' });
    // a view's choice and what the route sets are no settings to change here
    expect(SUBASSEMBLY_CONTROLS.tunnel.map(c => c.key)).not.toContain('portX');
  });

  it('refuses what its controls do not offer, a setting the route sets, and an instance of another kind, keeping the project', () => {
    const p = fresh();
    for (const [id, instance, patch, error] of [
      ['window-insert', 'window-1', { padHeight: 99 }, 'Pad height cannot be 99.'],
      ['window-insert', 'window-1', { cornerJoint: 'nailed' }, 'Collar corners cannot be "nailed".'],
      ['tunnel', 'tunnel-1', { portX: 100 }, 'portX is not a setting of the tunnel here.'],
      ['tunnel-tunnel-coupling', 'tunnel-1', { jointShown: 'end-side' }, 'jointShown is not a setting of the tunnel tunnel coupling here.'],
      ['tunnel', 'window-1', { footPad: 'ganter' }, 'There is no tunnel window-1.'],
    ] as const) {
      const result = configureSubassembly(p, id, instance, patch);
      expect(result.errors, `${id} ${JSON.stringify(patch)}`).toEqual([error]);
      expect(result.project).toBe(p);
    }
  });

  it('lays every tunnel out again for the insert’s new floor and the couplings’ pitch, as one undo step', () => {
    const p = fresh();
    const floorOf = (project: Project) => { const t = evaluateProject(project).instances.find(i => i.id === 'tunnel-1'); return t?.kind === 'tunnel' ? t.site.floorZ : NaN; };
    const raised = configureSubassembly(p, 'window-insert', 'window-1', { padHeight: 30 });
    expect(raised.errors).toEqual([]);
    expect(floorOf(raised.project)).toBeGreaterThan(floorOf(p));
    // its route starts at the new floor; what no longer fits in whole modules is reported on it, never dropped
    const tunnel = raised.project.instances.find(i => i.id === 'tunnel-1');
    expect(tunnel?.kind === 'tunnel' && tunnel.params.route[0]?.floor).toBeCloseTo(floorOf(raised.project), 6);
    expect(evaluateProject(raised.project).issues.filter(i => i.severity === 'error').map(i => i.id)).toEqual(['connection:tunnel-1+enclosure-1:route']);
    const history = applyEdit(createHistory(p), raised.project);
    expect(undo(history).present.settings).toEqual(p.settings);
    expect(undo(history).present.instances).toEqual(p.instances);
  });
});
