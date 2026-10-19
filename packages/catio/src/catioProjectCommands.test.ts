import { describe, expect, it } from 'vitest';
import {
  addEnclosure, addPlatform, createProject, DEFAULT_TUNNEL_MODULES, deleteDependents, deleteInstance, duplicateInstance, ENCLOSURE_DEFAULT,
  enclosureLayout, evaluateProject, GARDEN_DEFAULT, MODULAR, moveInstance, parseProject, PRINTED_LATCH_JOINT, projectErrors, resizeGarden,
  resizeInstance, resizeWindow, rotateInstance, setCatPorts, sidePortLength, TUNNEL, tunnelPitch, type Project,
} from './index.ts';

const fresh = () => createProject({ id: 'p1' });
const enclosureOf = (project: Project, id = 'enclosure-1') => {
  const e = evaluateProject(project).instances.find(i => i.id === id); if (e?.kind !== 'enclosure') throw new Error(`no enclosure ${id}`); return e;
};
const tunnelOf = (project: Project) => {
  const t = evaluateProject(project).instances.find(i => i.kind === 'tunnel'); if (t?.kind !== 'tunnel') throw new Error('no tunnel'); return t;
};
/** Every document an edit returns is one `parseProject` accepts: no dangling reference, no duplicate id. */
const sound = (project: Project) => { expect(projectErrors(JSON.parse(JSON.stringify(project)) as unknown)).toEqual([]); return project; };

describe('the new project', () => {
  const project = fresh();
  const evaluation = evaluateProject(project);

  it('is a 5 × 5 m lawn with the window in the middle of its rear wall, a tunnel and an empty 2 × 2 × 2 m enclosure', () => {
    sound(project);
    expect(project.garden).toEqual({ width: 5000, depth: 5000 });
    expect(project.instances.map(i => [i.id, i.kind, i.parent])).toEqual([['window-1', 'window', null], ['tunnel-1', 'tunnel', null], ['enclosure-1', 'enclosure', null]]);
    expect(project.instances[0]?.transform).toEqual({ x: GARDEN_DEFAULT.width / 2, y: 0, z: 0, yaw: 0 });
    // the tunnel stands on the site in the frame of the window's port it starts at
    expect(project.instances[1]?.transform).toEqual(project.instances[0]?.transform);
    expect(project.instances[2]?.params).toEqual({ width: 2000, depth: 2000, height: 2000 });
    expect(project.attachments).toEqual([]);
    expect(project.connections.map(c => c.ports)).toEqual([['window-1-port', 'tunnel-1-start'], ['tunnel-1-end', 'enclosure-1-rear']]);
    expect(project.ports.filter(p => p.owner === 'enclosure-1').map(p => [p.name, p.state])).toEqual([['rear', 'connected'], ['left', 'closed'], ['right', 'closed']]);
  });

  it('reports the enclosure’s inside dimensions besides its outside ones', () => {
    const e = enclosureOf(project);
    expect(e.layout.size).toEqual(ENCLOSURE_DEFAULT);
    expect(e.inside.width).toBe(2000 - 2 * MODULAR.timber); expect(e.inside.depth).toBe(2000 - 2 * MODULAR.timber);
    expect(e.inside.height).toBeLessThan(2000 - MODULAR.timber); expect(e.inside.height).toBeGreaterThan(1900);
  });

  it('stands the enclosure where two standard modules end: computed from the pitch, the coupling’s gap and the port', () => {
    const t = tunnelOf(project);
    if (!t.layout) throw new Error('no tunnel layout');
    const site = t.layout.site;
    const pitch = tunnelPitch(site, t.joint);
    expect(pitch).toBe(sidePortLength(site.w) + PRINTED_LATCH_JOINT.gap);
    // two one-module sections, straight out, level with the window port, reaching the enclosure's rear port exactly
    expect(t.layout.pieces.map(p => p.length)).toEqual(Array(DEFAULT_TUNNEL_MODULES).fill(pitch - PRINTED_LATCH_JOINT.gap));
    expect(t.layout.turns).toEqual([]); expect(t.layout.slope).toBeNull();
    expect(t.reaches).toBe(true); expect(t.layout.moved).toBeLessThan(1e-6);
    // the rear port's face on the tunnel's end: the enclosure's rear face that far from the wall, its port's sill on the window port's floor
    const e = enclosureOf(project);
    const rear = enclosureLayout(ENCLOSURE_DEFAULT, { id: 'x', tunnelSize: site.w, connected: { rear: true, left: false, right: false } }).rear.port.face.at;
    expect(e.world.x).toBeCloseTo(GARDEN_DEFAULT.width / 2, 9);
    expect(e.world.y).toBeCloseTo(TUNNEL.wallGap + DEFAULT_TUNNEL_MODULES * pitch, 9);
    expect(e.world.z + rear[2]).toBeCloseTo(site.floorZ, 9);
    expect(e.world.yaw).toBe(0);
    expect([pitch, e.world.y, e.world.z]).toEqual([383, 776, 45.5]);
  });

  it('keeps everything inside the garden, the door’s swing included, with the door facing the garden', () => {
    const e = enclosureOf(project);
    // the door is on the enclosure's front (+Y in its frame), which faces into the garden (+Y in the site's)
    expect(e.layout.door.hinge[1]).toBe(e.layout.size.depth);
    for (const [x, y] of e.footprint) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(5000); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(5000); }
    expect(Math.max(...e.footprint.map(([, y]) => y))).toBe(776 + 2000 + e.layout.door.width);
    expect(evaluation.issues.filter(i => i.severity === 'error')).toEqual([]);
  });
});

describe('commands', () => {
  it('adds an enclosure with shut ports, and refuses numbers that are not finite', () => {
    const result = addEnclosure(fresh(), { x: 1000, y: 3000, yaw: 90 }, { width: 1200, depth: 1000, height: 1200 });
    expect(result.errors).toEqual([]); expect(result.id).toBe('enclosure-2');
    sound(result.project);
    expect(result.project.ports.filter(p => p.owner === 'enclosure-2').map(p => p.state)).toEqual(['closed', 'closed', 'closed']);
    const bad = addEnclosure(fresh(), { x: Number.NaN, y: 0 });
    expect(bad.errors).toEqual(['x must be a finite number.']); expect(bad.id).toBeNull();
    expect(addEnclosure(fresh(), { x: 0, y: 0 }, { width: 0, depth: 1000, height: 1000 }).errors).toEqual(['width must be more than 0 mm.']);
  });

  it('adds a platform attached to both side frames of its enclosure', () => {
    const { project, id, errors } = addPlatform(fresh(), 'enclosure-1');
    expect(errors).toEqual([]); expect(id).toBe('platform-1');
    sound(project);
    expect(project.attachments.map(a => [a.instance, a.support.instance, a.support.member])).toEqual([['platform-1', 'enclosure-1', 'side-left'], ['platform-1', 'enclosure-1', 'side-right']]);
    expect(addPlatform(fresh(), 'window-1').errors).toEqual(['There is no enclosure window-1.']);
  });

  it('refuses a platform in an enclosure too small inside for one, rather than save a board with no size', () => {
    const narrow = resizeInstance(fresh(), 'enclosure-1', { width: 70 }).project;
    const { project, id, errors } = addPlatform(narrow, 'enclosure-1');
    expect(id).toBeNull();
    expect(errors).toEqual([expect.stringMatching(/^Enclosure is too small inside \(-10 mm between its side frames\) for a platform\.$/)]);
    expect(project).toBe(narrow);
  });

  it('moves and rotates enclosures and platforms, and nothing else', () => {
    const start = addPlatform(fresh(), 'enclosure-1').project;
    const moved = moveInstance(start, 'enclosure-1', { x: 2000, y: 1500 });
    expect(moved.errors).toEqual([]);
    expect(moved.project.instances.find(i => i.id === 'enclosure-1')?.transform).toEqual({ x: 2000, y: 1500, z: 45.5, yaw: 0 });
    const raised = moveInstance(start, 'platform-1', { z: 1500 });
    expect(raised.project.instances.find(i => i.id === 'platform-1')?.transform.z).toBe(1500);
    const turned = rotateInstance(start, 'enclosure-1', 90);
    expect(turned.project.instances.find(i => i.id === 'enclosure-1')?.transform.yaw).toBe(90);
    expect(moveInstance(start, 'tunnel-1', { x: 1 }).errors[0]).toMatch(/cannot be moved/);
    expect(moveInstance(start, 'ghost', { x: 1 }).errors).toEqual(['There is no instance ghost.']);
    const rejected = rotateInstance(start, 'enclosure-1', Number.POSITIVE_INFINITY);
    expect(rejected.errors).toEqual(['yaw must be a finite number.']); expect(rejected.project).toBe(start);
  });

  it('resizes an enclosure and its ports follow, but its interior keeps its size and place', () => {
    const start = addPlatform(fresh(), 'enclosure-1').project;
    const { project, errors } = resizeInstance(start, 'enclosure-1', { width: 2400 });
    expect(errors).toEqual([]);
    expect(project.instances.find(i => i.id === 'enclosure-1')?.params).toEqual({ width: 2400, depth: 2000, height: 2000 });
    expect(project.ports.find(p => p.id === 'enclosure-1-right')?.frame.x).toBe(1200);
    expect(project.instances.find(i => i.id === 'platform-1')).toEqual(start.instances.find(i => i.id === 'platform-1'));
    expect(resizeInstance(start, 'enclosure-1', { thickness: 3 }).errors).toEqual(['A enclosure has no thickness to resize.']);
    expect(resizeInstance(start, 'platform-1', { depth: -5 }).errors).toEqual(['depth must be more than 0 mm.']);
  });

  it('duplicates an enclosure with its interior under new ids, coupled to nothing', () => {
    const start = addPlatform(fresh(), 'enclosure-1').project;
    const { project, id } = duplicateInstance(start, 'enclosure-1');
    sound(project);
    expect(id).toBe('enclosure-2');
    const copy = project.instances.find(i => i.id === 'enclosure-2');
    expect(copy?.transform.x).toBe(2500 + 2000 + 500);
    const platform = project.instances.find(i => i.kind === 'platform' && i.parent === 'enclosure-2');
    expect(platform?.id).toBe('platform-2');
    expect(project.attachments.filter(a => a.instance === 'platform-2').map(a => a.support.instance)).toEqual(['enclosure-2', 'enclosure-2']);
    expect(project.ports.filter(p => p.owner === 'enclosure-2').map(p => p.state)).toEqual(['closed', 'closed', 'closed']);
    expect(project.connections).toEqual(start.connections);
    // a platform's copy goes above it, still on its battens
    const second = duplicateInstance(start, 'platform-1');
    expect(second.project.instances.find(i => i.id === second.id)?.transform.z).toBe(1500);
    expect(evaluateProject(second.project).issues.filter(i => i.severity === 'error')).toEqual([]);
  });

  it('lists what a delete takes with it, then deletes it all, leaving no dangling reference', () => {
    const start = { ...addPlatform(fresh(), 'enclosure-1').project, view: { selection: ['platform-1'], hidden: ['enclosure-1'], camera: null } };
    const dependents = deleteDependents(start, 'enclosure-1');
    expect(dependents).toEqual({
      instances: ['enclosure-1', 'platform-1'], ports: ['enclosure-1-rear', 'enclosure-1-left', 'enclosure-1-right'], connections: ['connection-2'], attachments: ['attachment-1', 'attachment-2'],
    });
    const { project, removed } = deleteInstance(start, 'enclosure-1');
    expect(removed).toEqual(dependents);
    sound(project);
    expect(project.instances.map(i => i.id)).toEqual(['window-1', 'tunnel-1']);
    // the tunnel's end is left open, and reported as unfinished
    expect(project.ports.find(p => p.id === 'tunnel-1-end')?.state).toBe('open');
    expect(project.view).toEqual({ selection: [], hidden: [], camera: null });
    expect(evaluateProject(project).issues.map(i => i.id)).toContain('connection:tunnel-1:open-end');
    // deleting the window leaves the tunnel where it stands, its start free: the tunnel is no longer in the window
    const windowless = deleteInstance(fresh(), 'window-1');
    sound(windowless.project);
    expect(windowless.removed.instances).toEqual(['window-1']);
    expect(windowless.project.ports.find(p => p.id === 'tunnel-1-start')?.state).toBe('open');
    expect(windowless.project.instances.find(i => i.id === 'tunnel-1')?.transform).toEqual(fresh().instances.find(i => i.id === 'tunnel-1')?.transform);
    expect(evaluateProject(windowless.project).issues.map(i => i.id)).toContain('connection:tunnel-1:open-start');
    // deleting the tunnel shuts the enclosure's rear port
    const tunnelless = deleteInstance(fresh(), 'tunnel-1');
    expect(tunnelless.project.ports.find(p => p.id === 'enclosure-1-rear')?.state).toBe('closed');
    expect(deleteInstance(fresh(), 'ghost').errors).toEqual(['There is no instance ghost.']);
  });

  it('resizes the garden without moving, scaling or deleting anything, and flags what is outside it', () => {
    const start = fresh();
    const smaller = resizeGarden(start, { width: 2800, depth: 3000 });
    expect(smaller.errors).toEqual([]);
    expect(smaller.project.garden).toEqual({ width: 2800, depth: 3000 });
    expect(smaller.project.instances).toEqual(start.instances);
    expect(smaller.outside).toEqual(['enclosure-1', 'window-1']);
    expect(evaluateProject(smaller.project).issues.find(i => i.id === 'geometry:enclosure-1:garden')?.message).toMatch(/door swung open/);
    expect(resizeGarden(start, { width: 6000, depth: 4500 }).outside).toEqual(['enclosure-1']);
    expect(resizeGarden(start, { width: 6000, depth: 6000 }).outside).toEqual([]);
    expect(resizeGarden(start, { width: Number.NaN, depth: 1 }).project).toBe(start);
  });

  it('never produces a document its own reader refuses', () => {
    let project = fresh();
    for (const step of [
      (p: Project) => addEnclosure(p, { x: 600, y: 4000 }).project, (p: Project) => addPlatform(p, 'enclosure-2').project,
      (p: Project) => duplicateInstance(p, 'enclosure-2').project, (p: Project) => deleteInstance(p, 'enclosure-1').project,
      (p: Project) => resizeInstance(p, 'platform-1', { width: 900 }).project, (p: Project) => deleteInstance(p, 'window-1').project,
    ]) project = step(project);
    expect(parseProject(JSON.stringify(project)).ok).toBe(true);
  });
});

describe('the window and the cat ports (FR-02.10)', () => {
  it('resizes the window, and with the cat port every port and tunnel: the enclosure stays where it is and its tunnel runs to it again', () => {
    const start = fresh();
    const glass = sound(resizeWindow(start, 'window-1', { glassWidth: 700, sashWidth: 850 }).project);
    expect(glass.instances[0]?.params).toMatchObject({ glassWidth: 700, sashWidth: 850, tunnelSize: 300 });
    const wider = resizeWindow(start, 'window-1', { tunnelSize: 350 });
    expect(wider.errors).toEqual([]); sound(wider.project);
    expect(new Set(wider.project.ports.map(p => p.interface.size))).toEqual(new Set([350]));
    expect(wider.project.instances[2]?.transform).toEqual(start.instances[2]?.transform);
    const t = tunnelOf(wider.project);
    expect(t.ends.end.owner).toBe('enclosure-1'); expect(t.layout?.w).toBe(350);
    // a size that cannot be one, another instance, or a size a window has not: refused, the project unchanged
    for (const result of [resizeWindow(start, 'window-1', { tunnelSize: -1 }), resizeWindow(start, 'window-1', { sashHeight: Number.NaN }), resizeWindow(start, 'enclosure-1', { glassWidth: 700 }),
      resizeWindow(start, 'window-1', { width: 900 } as never)]) { expect(result.project).toBe(start); expect(result.errors.length).toBeGreaterThan(0); }
    // too small for its port is a design problem the planner shows, not a refusal
    expect(evaluateProject(resizeWindow(start, 'window-1', { tunnelSize: 460 }).project).issues.map(i => i.message).join(' ')).toMatch(/Tunnel clear size must be 20–45 cm/);
  });

  it('chooses the cat ports’ closure and the doors’ seat for the whole catio', () => {
    const start = fresh();
    const gate = sound(setCatPorts(start, { portClosure: 'sliding-gate', doorSeat: 'rebate' }).project);
    expect(gate.settings).toMatchObject({ portClosure: 'sliding-gate', doorSeat: 'rebate' });
    expect(evaluateProject(gate).instances.find(i => i.kind === 'window')).toMatchObject({ site: { window: { closure: 'sliding-gate', seat: 'rebate' } } });
    expect(setCatPorts(start, { portClosure: 'curtain' as never }).project).toBe(start);
    expect(setCatPorts(start, { doorSeat: 'glue' as never }).errors.join()).toMatch(/stop strips or a rebate/);
  });
});
