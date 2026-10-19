import { describe, expect, it } from 'vitest';
import {
  addEnclosure, addTunnel, applyEdit, connect, connectProblems, connectTargets, createHistory, createProject, detach, evaluateProject, extendTunnel, moveInstance,
  parseProject, projectErrors, resizeGarden, rotateInstance, serializeProject, shortenTunnel, turnTunnel, undo,
  type CommandResult, type EvaluatedEnclosure, type EvaluatedTunnel, type Project,
} from './index.ts';

/** Every document an edit returns is one `parseProject` accepts. */
const sound = (project: Project) => { expect(projectErrors(JSON.parse(JSON.stringify(project)) as unknown)).toEqual([]); return project; };
const done = <R extends CommandResult>(result: R): R => { expect(result.errors).toEqual([]); sound(result.project); return result; };
const tunnel = (project: Project, id: string) => {
  const t = evaluateProject(project).instances.find((i): i is EvaluatedTunnel => i.kind === 'tunnel' && i.id === id);
  if (!t?.layout) throw new Error(`no tunnel ${id}`);
  return { ...t, layout: t.layout };
};
const enclosure = (project: Project, id: string) => {
  const e = evaluateProject(project).instances.find((i): i is EvaluatedEnclosure => i.kind === 'enclosure' && i.id === id);
  if (!e) throw new Error(`no enclosure ${id}`); return e;
};
const route = (project: Project, id: string) => { const t = project.instances.find(i => i.id === id); if (t?.kind !== 'tunnel') throw new Error('no tunnel'); return t.params.route; };
const state = (project: Project, port: string) => project.ports.find(p => p.id === port)?.state;
const modules = (project: Project, id: string) => route(project, id).reduce((n, e) => n + e.modules, 0);
/** The errors on the design that concern `ids`. */
const errorsOn = (project: Project, ...ids: string[]) => evaluateProject(project).issues.filter(i => i.severity === 'error' && i.instanceIds.some(id => ids.includes(id)));

/** The new project in a garden wide enough for a second enclosure East of the first, its left port facing the first's right one. */
function withSecond(gap = 1500): { project: Project; b: string } {
  const p = done(resizeGarden(createProject({ id: 'p1' }), { width: 10000, depth: 6000 })).project;
  const a = p.instances.find(i => i.id === 'enclosure-1');
  if (!a) throw new Error('no enclosure');
  const added = done(addEnclosure(p, { x: a.transform.x + 2000 + gap, y: a.transform.y }));
  return { project: added.project, b: added.id ?? '' };
}
/** Window → A → B: a tunnel from A's right port, `modules` long, connected to B's left port. */
function network(modules = 4) {
  const { project, b } = withSecond();
  const grown = done(addTunnel(project, 'enclosure-1-right', modules));
  const joined = done(connect(grown.project, 'tunnel-2-end', `${b}-left`));
  return { project: joined.project, b, before: project };
}

describe('starting a tunnel', () => {
  it('adds a one-module tunnel from a free enclosure port, its end free; one undo step takes it away', () => {
    const { project } = withSecond();
    const result = done(addTunnel(project, 'enclosure-1-right'));
    expect(result.id).toBe('tunnel-2');
    const p = result.project;
    const t = p.instances.find(i => i.id === 'tunnel-2');
    expect(t?.parent).toBeNull();
    expect(route(p, 'tunnel-2')).toEqual([{ id: 'tunnel-2-element-1', kind: 'straight', modules: 1, floor: expect.any(Number) as number }]);
    // the port opens and takes its coupling; the tunnel's end is free, an unfinished end with an issue on it
    expect(state(p, 'enclosure-1-right')).toBe('connected');
    expect(state(p, 'tunnel-2-end')).toBe('open');
    expect(enclosure(p, 'enclosure-1').layout.ports.find(q => q.side === 'right')?.connected).toBe(true);
    expect(errorsOn(p, 'tunnel-2').map(i => i.id)).toEqual(['connection:tunnel-2:open-end']);
    // it runs straight out of the port, level with its floor, its first flange across the coupling's gap
    const e = tunnel(p, 'tunnel-2');
    const face = evaluateProject(p).ports.find(q => q.id === 'enclosure-1-right')?.world;
    expect(e.world.yaw).toBeCloseTo(face?.yaw ?? NaN, 6);
    expect(e.site.floorZ).toBeCloseTo(face?.z ?? NaN, 6);
    expect(e.layout.couplings.filter(c => c.stage === 6).map(c => c.id)).toEqual(['wall']);
    const history = applyEdit(createHistory(project), p);
    expect(undo(history).present).toEqual(project);
  });

  it('refuses a port that is coupled already, a tunnel’s end, and a port that is not there', () => {
    const p = createProject();
    expect(addTunnel(p, 'enclosure-1-rear').errors[0]).toMatch(/already coupled to Tunnel's far end: a port takes one mate/);
    expect(addTunnel(p, 'tunnel-1-end').errors[0]).toMatch(/extend that tunnel/);
    expect(addTunnel(p, 'nowhere').errors).toEqual(['There is no port nowhere.']);
    expect(addTunnel(p, 'enclosure-1-left', 0).errors[0]).toMatch(/at least one/);
  });
});

describe('extending and turning a free end', () => {
  const start = done(addTunnel(withSecond().project, 'enclosure-1-right')).project;

  it('lengthens and shortens in whole standard modules, each one undo step', () => {
    const longer = done(extendTunnel(start, 'tunnel-2-end', 2)).project;
    expect(modules(longer, 'tunnel-2')).toBe(3);
    const pitch = tunnel(start, 'tunnel-2').layout.pitch;
    expect(tunnel(longer, 'tunnel-2').layout.E[1] - tunnel(start, 'tunnel-2').layout.E[1]).toBeCloseTo(2 * pitch, 6);
    // the free end's port is where its modules end now
    const end = longer.ports.find(p => p.id === 'tunnel-2-end')?.frame;
    expect(end?.y).toBeCloseTo(tunnel(longer, 'tunnel-2').layout.E[1], 6);
    const shorter = done(shortenTunnel(longer, 'tunnel-2-end', 1)).project;
    expect(modules(shorter, 'tunnel-2')).toBe(2);
    let history = applyEdit(applyEdit(createHistory(start), longer), shorter);
    history = undo(history); expect(history.present).toEqual({ ...longer, revision: 1 });
    history = undo(history); expect(history.present).toEqual(start);
  });

  it('keeps at least one module, and never moves an end that is coupled', () => {
    expect(shortenTunnel(start, 'tunnel-2-end', 1).errors[0]).toMatch(/keeps at least one/);
    expect(extendTunnel(start, 'tunnel-2-end', 1.5).errors[0]).toMatch(/whole number/);
    expect(extendTunnel(createProject(), 'tunnel-1-end', 1).errors[0]).toMatch(/coupled to Enclosure's rear port: detach it first/);
    expect(extendTunnel(start, 'tunnel-2-start', 1).errors[0]).toMatch(/grows from its far end/);
  });

  it('turns at a side port, left or right, as one undo step', () => {
    const right = done(turnTunnel(start, 'tunnel-2-end', 'right')).project;
    expect(route(right, 'tunnel-2').at(-1)).toMatchObject({ kind: 'turn', turn: 90, modules: 1 });
    const t = tunnel(right, 'tunnel-2');
    expect(t.layout.joints.filter(j => j.kind === 'turn').map(j => Math.round(j.angle))).toEqual([90]);
    // the end now runs square to where it ran
    expect(Math.abs(t.layout.dE[0])).toBeCloseTo(1, 6);
    const left = done(turnTunnel(start, 'tunnel-2-end', 'left')).project;
    expect(route(left, 'tunnel-2').at(-1)).toMatchObject({ kind: 'turn', turn: -90 });
    expect(tunnel(left, 'tunnel-2').layout.dE[0]).toBeCloseTo(-tunnel(right, 'tunnel-2').layout.dE[0], 6);
    expect(undo(applyEdit(createHistory(start), right)).present).toEqual(start);
  });
});

describe('connecting and detaching', () => {
  it('window → A → B through A’s side port: both runs reach their ports, every port coupled or shut', () => {
    const { project, b } = network();
    const p = sound(project);
    for (const id of ['tunnel-1', 'tunnel-2']) expect(tunnel(p, id).reaches).toBe(true);
    expect(errorsOn(p, 'tunnel-1', 'tunnel-2', 'enclosure-1', b)).toEqual([]);
    expect(state(p, `${b}-left`)).toBe('connected');
    expect(enclosure(p, b).layout.ports.map(q => [q.side, q.connected])).toEqual([['rear', false], ['left', true], ['right', false]]);
    // a port coupled to nothing keeps its closure
    expect(state(p, `${b}-rear`)).toBe('closed');
    expect(state(p, 'enclosure-1-left')).toBe('closed');
  });

  it('moves a free enclosure onto the tunnel’s end, and says so', () => {
    const { project, b } = withSecond(1500);
    const grown = done(addTunnel(project, 'enclosure-1-right', 4)).project;
    const result = done(connect(grown, 'tunnel-2-end', `${b}-left`));
    expect(result.notes?.[0]).toMatch(/Enclosure 2 moved \d+ mm onto Tunnel 2's end/);
    const end = evaluateProject(result.project).ports.find(q => q.id === 'tunnel-2-end')?.world;
    const port = evaluateProject(result.project).ports.find(q => q.id === `${b}-left`)?.world;
    expect(Math.hypot((end?.x ?? 0) - (port?.x ?? 1e9), (end?.y ?? 0) - (port?.y ?? 1e9))).toBeLessThan(1);
    expect(undo(applyEdit(createHistory(grown), result.project)).present).toEqual(grown);
  });

  it('connects only ports that fit: the same size, square on, one mate per port', () => {
    const { project, b } = withSecond();
    const grown = done(addTunnel(project, 'enclosure-1-right', 4)).project;
    // one mate per port
    expect(connectProblems(grown, 'tunnel-2-end', 'enclosure-1-rear')[0]).toMatch(/already coupled to Tunnel's far end: a port takes one mate/);
    expect(connectProblems(grown, 'tunnel-1-end', `${b}-left`)[0]).toMatch(/already coupled .*detach it first/);
    // a tunnel's end is not a cat port
    expect(connectProblems(grown, 'tunnel-2-end', 'tunnel-1-start')[0]).toMatch(/is a tunnel's end/);
    // its orientation: B turned 15° faces 15° off the tunnel's end; B's right port faces away from it
    const turned = done(rotateInstance(grown, b, 15)).project;
    expect(connectProblems(turned, 'tunnel-2-end', `${b}-left`)).toEqual([expect.stringMatching(/faces 15° off Tunnel 2's end: turn Enclosure 2/)]);
    expect(connect(turned, 'tunnel-2-end', `${b}-left`).errors).toHaveLength(1);
    expect(connectProblems(grown, 'tunnel-2-end', `${b}-right`)[0]).toMatch(/faces 180° off/);
    // its size: a port of another size does not fit
    const other = { ...grown, ports: grown.ports.map(q => q.id === `${b}-left` ? { ...q, interface: { ...q.interface, size: 350 } } : q) };
    expect(connectProblems(other, 'tunnel-2-end', `${b}-left`)).toEqual([expect.stringMatching(/350 mm port, Tunnel 2 a 300 mm tunnel: they do not fit/)]);
    // A's left port faces the right way, but behind the end
    expect(connectProblems(grown, 'tunnel-2-end', 'enclosure-1-left')[0]).toMatch(/is behind Tunnel 2's end/);
    // the ports it can be connected to: B's left only
    expect(connectTargets(grown, 'tunnel-2-end').map(t => t.port)).toEqual([`${b}-left`]);
  });

  it('keeps a connection to an anchored port, which stays put, as an invalid draft when whole modules cannot reach it', () => {
    const { project, b } = withSecond(1500);
    // B is anchored: a tunnel starts at its right port
    const anchored = done(addTunnel(project, `${b}-right`)).project;
    const grown = done(addTunnel(anchored, 'enclosure-1-right', 3)).project;
    const result = done(connect(grown, 'tunnel-3-end', `${b}-left`));
    expect(result.project.instances.find(i => i.id === b)).toEqual(grown.instances.find(i => i.id === b));
    expect(result.project.connections.some(c => c.ports.includes(`${b}-left`))).toBe(true);
    expect(tunnel(result.project, 'tunnel-3').reaches).toBe(false);
    expect(errorsOn(result.project, 'tunnel-3').map(i => i.id)).toContain(`connection:tunnel-3+${b}:route`);
    // solved again towards it, in whole modules: its end is less than a module from the port
    expect(tunnel(result.project, 'tunnel-3').layout.moved).toBeLessThan(tunnel(result.project, 'tunnel-3').layout.pitch / 2 + 1);
  });

  it('detaches explicitly: the enclosure’s port is shut again, the tunnel’s end left free where it was; undo restores it', () => {
    const { project, b } = network();
    const connection = project.connections.find(c => c.ports.includes(`${b}-left`));
    const result = done(detach(project, connection?.id ?? ''));
    expect(result.project.connections).toHaveLength(project.connections.length - 1);
    expect(state(result.project, `${b}-left`)).toBe('closed');
    expect(state(result.project, 'tunnel-2-end')).toBe('open');
    expect(result.project.ports.find(q => q.id === 'tunnel-2-end')?.frame).toEqual(project.ports.find(q => q.id === 'tunnel-2-end')?.frame);
    expect(errorsOn(result.project, 'tunnel-2').map(i => i.id)).toEqual(['connection:tunnel-2:open-end']);
    expect(undo(applyEdit(createHistory(project), result.project)).present).toEqual(project);
    expect(detach(project, 'nothing').errors).toEqual(['There is no connection nothing.']);
  });
});

describe('moving a connected enclosure', () => {
  it('moving B rebuilds the run that ends at it; A and the window stay put', () => {
    const { project, b } = network();
    const at = project.instances.find(i => i.id === b)?.transform;
    const moved = done(moveInstance(project, b, { x: (at?.x ?? 0) + 2 * tunnel(project, 'tunnel-2').layout.pitch })).project;
    expect(modules(moved, 'tunnel-2')).toBe(modules(project, 'tunnel-2') + 2);
    expect(tunnel(moved, 'tunnel-2').reaches).toBe(true);
    for (const id of ['window-1', 'enclosure-1', 'tunnel-1']) expect(moved.instances.find(i => i.id === id)).toEqual(project.instances.find(i => i.id === id));
  });

  it('moving A carries the run that starts at it and rebuilds both runs; B stays put', () => {
    const { project, b } = network();
    const a = project.instances.find(i => i.id === 'enclosure-1')?.transform;
    const pitch = tunnel(project, 'tunnel-2').layout.pitch;
    const moved = done(moveInstance(project, 'enclosure-1', { y: (a?.y ?? 0) + pitch })).project;
    expect(moved.instances.find(i => i.id === b)).toEqual(project.instances.find(i => i.id === b));
    // the run from A moved with it, and turns to reach B, which stands one module behind where it ran
    expect(moved.instances.find(i => i.id === 'tunnel-2')?.transform.y).toBeCloseTo((project.instances.find(i => i.id === 'tunnel-2')?.transform.y ?? 0) + pitch, 6);
    expect(tunnel(moved, 'tunnel-1').reaches).toBe(true);
    expect(tunnel(moved, 'tunnel-2').layout.joints.some(j => j.kind === 'turn')).toBe(true);
  });
});

describe('parts', () => {
  it('counts a coupling shared by two pieces once: each tunnel end’s coupling with that tunnel, the window’s with the insert', () => {
    const { project, b } = network();
    const evaluation = evaluateProject(project);
    const tunnels = evaluation.instances.filter((i): i is EvaluatedTunnel => i.kind === 'tunnel');
    // three couplings to enclosure ports (tunnel 1's end, tunnel 2's start and end), one each, and the window's own
    const atPorts = tunnels.flatMap(t => (t.layout?.couplings ?? []).filter(c => c.stage === 6).map(c => `${t.id}:${c.id}`));
    expect(atPorts).toEqual(['tunnel-1:port', 'tunnel-2:wall', 'tunnel-2:port']);
    expect(project.connections.filter(c => !c.ports.includes('window-1-port'))).toHaveLength(atPorts.length);
    const latches = evaluation.bom.filter(l => /latch/i.test(l.name) && l.sources.includes('tunnel-2'));
    expect(latches.length).toBeGreaterThan(0);
    // nothing of an enclosure's port is counted for it: the enclosures have no recipe yet, and the coupling is the tunnel's
    expect(evaluation.bom.filter(l => l.sources.includes(b) || l.sources.includes('enclosure-1'))).toEqual([]);
    // the insert's coupling, once
    expect(new Set(evaluation.bom.filter(l => l.sources.includes('window-1')).map(l => l.sources.join('+')))).toEqual(new Set(['window-1', 'window-1+tunnel-1']));
  });
});

describe('saved projects', () => {
  it('migrates a version 2 document: its tunnel out of the window, onto the site where it stood', () => {
    const p = createProject({ id: 'p1' });
    const v2 = JSON.parse(serializeProject(p)) as Omit<Project, 'schemaVersion'> & { schemaVersion: number };
    v2.schemaVersion = 2;
    const window = v2.instances.find(i => i.id === 'window-1');
    for (const i of v2.instances) if (i.kind === 'tunnel') { i.parent = 'window-1'; i.transform = { x: 0, y: 0, z: 0, yaw: 0 }; }
    if (window) window.transform = { ...window.transform, x: 1800 };
    expect(projectErrors(v2)[0]).toMatch(/migrates version 2/);
    const migrated = parseProject(JSON.stringify(v2));
    if (!migrated.ok) throw new Error(migrated.errors.join(' '));
    expect(migrated.project.schemaVersion).toBe(3);
    const t = migrated.project.instances.find(i => i.id === 'tunnel-1');
    expect(t?.parent).toBeNull();
    expect(t?.transform).toEqual({ x: 1800, y: 0, z: 0, yaw: 0 });
    expect(tunnel(migrated.project, 'tunnel-1').world).toEqual(t?.transform);
  });

  it('round-trips a network through JSON', () => {
    const { project } = network();
    const back = parseProject(serializeProject(project));
    expect(back.ok && back.project).toEqual(project);
  });
});
