import { describe, expect, it } from 'vitest';
import {
  applyEdit, createHistory, createProject, enclosureSillRange, evaluateProject, MODULAR, moveInstance, parseProject, projectErrors, raiseElements,
  serializeProject, tunnelLayout, tunnelRoute, undo, type EvaluatedEnclosure, type EvaluatedWindow, type Project,
} from './index.ts';

/** Every document an edit returns is one `parseProject` accepts. */
const sound = (project: Project) => { expect(projectErrors(JSON.parse(JSON.stringify(project)) as unknown)).toEqual([]); return project; };
const tunnelOf = (project: Project) => {
  const t = evaluateProject(project).instances.find(i => i.kind === 'tunnel'); if (t?.kind !== 'tunnel' || !t.layout) throw new Error('no tunnel'); return { ...t, layout: t.layout };
};
const enclosureOf = (project: Project) => {
  const e = evaluateProject(project).instances.find(i => i.kind === 'enclosure'); if (e?.kind !== 'enclosure') throw new Error('no enclosure'); return e;
};
const routeOf = (project: Project) => { const t = project.instances.find(i => i.kind === 'tunnel'); if (t?.kind !== 'tunnel') throw new Error('no tunnel'); return t.params.route; };
const port = (project: Project, id: string) => project.ports.find(p => p.id === id);
/** A project as version 1 saved it: its tunnel in its window, its route solved from its ends (no elements). */
function asVersion1(project: Project) {
  const v1 = JSON.parse(serializeProject(project)) as Omit<Project, 'schemaVersion'> & { schemaVersion: number };
  v1.schemaVersion = 1;
  for (const i of v1.instances) if (i.kind === 'tunnel') { delete (i.params as Partial<typeof i.params>).route; i.parent = 'window-1'; i.transform = { x: 0, y: 0, z: 0, yaw: 0 }; }
  return v1;
}
/** The new project with its enclosure moved out by `modules` more standard modules: a longer tunnel. */
function longer(modules: number): Project {
  const p = createProject({ id: 'p1' });
  const e = p.instances.find(i => i.id === 'enclosure-1'); if (!e) throw new Error('no enclosure');
  return sound(moveInstance(p, 'enclosure-1', { y: e.transform.y + modules * 383 }).project);
}

describe('the route model', () => {
  it('describes the new tunnel as two one-module elements at the window port’s floor, with ids unique in the project', () => {
    const p = createProject({ id: 'p1' });
    const route = routeOf(p);
    expect(route.map(e => [e.id, e.kind, e.modules])).toEqual([['tunnel-1-element-1', 'straight', 1], ['tunnel-1-element-2', 'straight', 1]]);
    const t = tunnelOf(p);
    expect(route.every(e => e.floor === t.layout.S[2])).toBe(true);
    // each element is its own piece of the layout
    expect(t.elements.map(e => e.pieces)).toEqual([['section-1'], ['section-2']]);
    const duplicate = structuredClone(p); const twin = duplicate.instances[1];
    if (twin?.kind === 'tunnel' && twin.params.route[1]) twin.params.route[1].id = 'window-1';
    expect(projectErrors(duplicate)).toContain('The id window-1 is used more than once.');
  });

  it('round-trips through JSON with its elements, their floors and a selection of elements', () => {
    const raised = raiseElements(longer(2), ['tunnel-1-element-3'], 60).project;
    const selected = { ...raised, view: { ...raised.view, selection: ['tunnel-1-element-3', 'tunnel-1-element-4'] } };
    const back = parseProject(serializeProject(selected));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.project).toEqual(selected);
  });

  it('migrates a version 1 document: its tunnel laid out as version 1 did, now as elements', () => {
    const p = longer(1);
    const v1 = asVersion1(p);
    expect(projectErrors(v1)[0]).toMatch(/not supported here/);
    const migrated = parseProject(JSON.stringify(v1));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.project.schemaVersion).toBe(3);
    expect(migrated.project.instances).toEqual(p.instances);
    expect(routeOf(migrated.project)).toEqual(routeOf(p));
    expect(evaluateProject(migrated.project).bom).toEqual(evaluateProject(p).bom);
  });

  it('keeps a version 1 climb: the migrated elements lay out the same tunnel', () => {
    const p = longer(4);
    // version 1 solved a climb to an enclosure standing higher
    const v1 = asVersion1(p);
    for (const i of v1.instances) if (i.id === 'enclosure-1') i.transform.z += 120;
    for (const q of v1.ports) if (q.owner === 'enclosure-1') q.frame.z = MODULAR.sill;
    const migrated = parseProject(JSON.stringify(v1));
    if (!migrated.ok) throw new Error(migrated.errors.join(' '));
    const t = tunnelOf(migrated.project);
    const w = evaluateProject(migrated.project).instances.find((i): i is EvaluatedWindow => i.kind === 'window'); if (!w || !t.config) throw new Error('no window');
    const v1Layout = tunnelLayout(tunnelRoute(migrated.project.instances[1] as never, migrated.project.settings, { x: t.config.portX, y: t.config.portY, z: t.config.portHeight, yaw: 180 }, true), w.site, t.joint);
    expect(t.layout.pieces.map(q => [q.kind, q.length.toFixed(3), q.pitch.toFixed(3)])).toEqual(v1Layout.pieces.map(q => [q.kind, q.length.toFixed(3), q.pitch.toFixed(3)]));
    expect(t.layout.E.map(v => v.toFixed(3))).toEqual(v1Layout.E.map(v => v.toFixed(3)));
    expect(t.elements.some(x => Math.abs(x.slope) > 1)).toBe(true);
  });
});

describe('raising and lowering elements', () => {
  it('raises a middle element as it is: its neighbours become two sloped runs within the tunnel’s steepest slope', () => {
    const p = longer(3);
    const result = raiseElements(p, ['tunnel-1-element-3'], 60);
    expect(result.errors).toEqual([]);
    sound(result.project);
    const t = tunnelOf(result.project);
    const [, second, third, fourth] = t.elements;
    expect(third?.floor.map(z => z - t.layout.S[2])).toEqual([60, 60]); expect(third?.slope).toBe(0);
    expect(second?.slope).toBeGreaterThan(1); expect(fourth?.slope).toBeLessThan(-1);
    for (const e of [second, fourth]) expect(Math.abs(e?.slope ?? 99)).toBeLessThanOrEqual(t.layout.config.maxSlope);
    // bends where the slope changes: four angle collars, and no issue on the route
    expect(t.layout.pieces.filter(q => q.kind === 'collar')).toHaveLength(4);
    expect(evaluateProject(result.project).issues.filter(i => i.severity === 'error' && i.instanceIds.includes('tunnel-1'))).toEqual([]);
    expect(t.reaches).toBe(true);
  });

  it('keeps a change too steep to build as an editable draft, with the issue on the elements that cannot slope so far', () => {
    const p = longer(3);
    const result = raiseElements(p, ['tunnel-1-element-3'], 300);
    expect(result.errors).toEqual([]);
    sound(result.project);
    const steep = evaluateProject(result.project).issues.filter(i => /steeper than|cannot slope/.test(i.message));
    expect(steep.flatMap(i => i.instanceIds).sort()).toEqual(['tunnel-1', 'tunnel-1', 'tunnel-1-element-2', 'tunnel-1-element-4']);
    expect(steep.every(i => i.severity === 'error')).toBe(true);
    // nothing was snapped back
    expect(routeOf(result.project)[2]?.floor).toBe((routeOf(p)[2]?.floor ?? 0) + 300);
  });

  it('flags elements lowered too near the ground for their supports', () => {
    const p = longer(3);
    const low = raiseElements(p, ['tunnel-1-element-2', 'tunnel-1-element-3', 'tunnel-1-element-4'], -150).project;
    const issues = evaluateProject(low).issues.filter(i => /too close to the ground/.test(i.message));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.flatMap(i => i.instanceIds).some(id => id.startsWith('tunnel-1-element-'))).toBe(true);
  });

  it('takes the enclosure’s port with the last element: its frame, mesh, landing and ramp, and the enclosure stays coupled', () => {
    const p = createProject({ id: 'p1' });
    const before = enclosureOf(p);
    const result = raiseElements(p, ['tunnel-1-element-2'], 100);
    expect(result.errors).toEqual([]);
    expect(result.notes?.join(' ')).toMatch(/Enclosure moved \d+ mm/);
    sound(result.project);
    expect(port(result.project, 'enclosure-1-rear')?.raise).toBe(100);
    const after = enclosureOf(result.project);
    expect(after.layout.rear.port.face.at[2]).toBe(before.layout.rear.port.face.at[2] + 100);
    expect(after.layout.landing[0]?.center[2]).toBe((before.layout.landing[0]?.center[2] ?? 0) + 100);
    expect(after.layout.ramp.tilt).toBeLessThan(before.layout.ramp.tilt);
    const below = (e: EvaluatedEnclosure) => e.layout.rear.mesh.find(m => m.id.endsWith('below'))?.height ?? 0;
    expect(below(after)).toBe(below(before) + 100);
    const t = tunnelOf(result.project);
    expect(t.reaches).toBe(true);
    expect(t.elements[0]?.slope).toBeGreaterThan(5);
  });

  it('clamps an enclosure’s port at the enclosure’s limits, with a message', () => {
    const p = createProject({ id: 'p1' });
    const range = enclosureSillRange({ width: 2000, depth: 2000, height: 2000 }, 300);
    const lowered = raiseElements(p, ['tunnel-1-element-2'], -400);
    expect(lowered.errors).toEqual([]);
    expect(port(lowered.project, 'enclosure-1-rear')?.raise).toBe(range.min - MODULAR.sill);
    expect(lowered.notes?.join(' ')).toMatch(/cat port can go no lower/);
  });

  it('moves the window insert’s port in its collar with the first element, and clamps it there', () => {
    const p = createProject({ id: 'p1' });
    const evaluation = evaluateProject(p);
    const max = evaluation.portRanges.get('window-1-port')?.max ?? 0;
    expect(max).toBeGreaterThan(0);
    const raised = raiseElements(p, ['tunnel-1-element-1', 'tunnel-1-element-2'], max + 500);
    expect(raised.errors).toEqual([]);
    expect(raised.notes?.join(' ')).toMatch(/Window's cat port can go no higher/);
    expect(port(raised.project, 'window-1-port')?.raise).toBe(max);
    const w = evaluateProject(raised.project).instances.find((i): i is EvaluatedWindow => i.kind === 'window');
    expect(w?.site.floorZ).toBeCloseTo((evaluation.instances.find((i): i is EvaluatedWindow => i.kind === 'window')?.site.floorZ ?? 0) + max, 6);
    expect(w?.insert.timber.some(t => t.id === 'port-sill')).toBe(true);
    // the whole selection rose as far as the port could, and the tunnel is level and coupled
    const t = tunnelOf(raised.project);
    expect(t.elements.every(e => Math.abs(e.slope) < 1e-9)).toBe(true);
    expect(t.reaches).toBe(true);
    // on the threshold it can go no lower: nothing to do
    expect(raiseElements(p, ['tunnel-1-element-1'], -10).errors.join(' ')).toMatch(/can go no lower/);
  });

  it('recomputes the supports and the parts list', () => {
    const p = createProject({ id: 'p1' });
    const raised = raiseElements(p, ['tunnel-1-element-1', 'tunnel-1-element-2'], 80).project;
    const before = tunnelOf(p).layout.supports.map(s => s.top);
    const after = tunnelOf(raised).layout.supports.map(s => s.top);
    expect(after).toEqual(before.map(top => top + 80));
    const bom = (q: Project) => evaluateProject(q).bom;
    expect(bom(raised)).not.toEqual(bom(p));
    expect(bom(raised).some(l => l.name === 'Port sill')).toBe(true);
    // a slope's bends are angle collars in the cut list
    const sloped = raiseElements(p, ['tunnel-1-element-2'], 80).project;
    expect(tunnelOf(sloped).layout.pieces.some(q => q.kind === 'collar')).toBe(true);
    expect(bom(sloped).filter(l => /Collar/.test(l.name)).length).toBeGreaterThan(0);
  });

  it('is one undo step that restores the elements, the ports, the enclosure and the parts list', () => {
    const p = createProject({ id: 'p1' });
    const history = applyEdit(createHistory(p), raiseElements(p, ['tunnel-1-element-2'], 100).project);
    expect(history.past).toHaveLength(1);
    const back = undo(history).present;
    expect(back.instances).toEqual(p.instances);
    expect(back.ports).toEqual(p.ports);
    expect(evaluateProject(back).bom).toEqual(evaluateProject(p).bom);
  });

  it('keeps raised elements when the enclosure moves on: their ids and floors stay, and the tunnel still reaches', () => {
    const raised = raiseElements(longer(2), ['tunnel-1-element-3'], 50).project;
    const e = raised.instances.find(i => i.id === 'enclosure-1'); if (!e) throw new Error('no enclosure');
    const moved = moveInstance(raised, 'enclosure-1', { y: e.transform.y + 383 }).project;
    const route = routeOf(moved);
    expect(route.slice(0, 4)).toEqual(routeOf(raised).slice(0, 4));
    expect(route).toHaveLength(routeOf(raised).length + 1);
    expect(tunnelOf(moved).reaches).toBe(true);
  });

  it('refuses what is not a tunnel element, and a number that is not one', () => {
    const p = createProject({ id: 'p1' });
    expect(raiseElements(p, ['enclosure-1'], 10).errors).toEqual(['There is no tunnel element enclosure-1.']);
    expect(raiseElements(p, ['tunnel-1-element-1'], Number.NaN).errors).toEqual(['delta must be a finite number.']);
  });
});
