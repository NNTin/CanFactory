import { enclosureLayout } from './catioEnclosure.ts';
import { MODULAR_DEFAULT } from './catioModularDesign.ts';
import { platformAnchors, platformDefaults, PLATFORM_SHEET } from './catioPlatform.ts';
import {
  composeTransform, isKind, keepView, projectErrors, PROJECT_SCHEMA_VERSION, SETTINGS_DEFAULT, TUNNEL_PARAMS_DEFAULT, WINDOW_PARAMS_DEFAULT,
  type Attachment, type Connection, type EnclosureParams, type Instance, type PlatformParams, type Port, type Project, type Transform,
} from './catioProject.ts';
import { evaluateProject, outsideGarden, syncPorts, type ProjectEvaluation } from './catioProjectEvaluate.ts';
import { TUNNEL, TUNNEL_DEFAULT, tunnelLayout, tunnelPitch, tunnelSiteFor } from './catioTunnel.ts';

/**
 * The planner's edits: pure functions from a project to the next one. An edit that cannot be made (a number that is not finite or
 * not positive, an instance that is not there or cannot take it) returns the project unchanged with its `errors`, so that a bad
 * value never reaches the document. After every edit the ports are where their owners' layouts put them (`syncPorts`). Edits do
 * not count revisions: a committed history step does (catioProjectHistory.ts: `commitEdit`).
 */
export interface CommandResult { project: Project; errors: string[] }

/** The new project's garden, enclosure and tunnel (FR-01.2–4). */
export const GARDEN_DEFAULT = { width: 5000, depth: 5000 } as const;
export const ENCLOSURE_DEFAULT: EnclosureParams = { width: 2000, depth: 2000, height: 2000 };
/** The new project's tunnel: this many standard modules straight out from the window to the enclosure's rear port. */
export const DEFAULT_TUNNEL_MODULES = 2;
const ENCLOSURE_PORTS = ['rear', 'left', 'right'] as const;

const portId = (owner: string, name: string) => `${owner}-${name}`;
const allIds = (p: Project) => new Set([...p.instances, ...p.ports, ...p.connections, ...p.attachments].map(x => x.id));
/** The first `prefix-n` no id of the project has yet. */
export function nextId(project: Project, prefix: string, taken: Set<string> = allIds(project)): string {
  for (let n = 1; ; n++) if (!taken.has(`${prefix}-${n}`)) return `${prefix}-${n}`;
}
const port = (owner: string, name: string, size: number, state: Port['state']): Port =>
  ({ id: portId(owner, name), owner, name, frame: { x: 0, y: 0, z: 0, yaw: 0 }, interface: { kind: 'standard-port', size }, state });
const fail = (project: Project, ...errors: string[]): CommandResult => ({ project, errors });
/**
 * `next`, its ports synced, as the edit's result; or `project` unchanged with the reasons, if `next` is a document `parseProject`
 * would refuse. An edit's own checks say why first; this is the guarantee that no edit puts what cannot be reopened into the history.
 */
function ok(project: Project, next: Project, evaluation?: Pick<ProjectEvaluation, 'ports'>): CommandResult {
  const synced = syncPorts(next, evaluation);
  const errors = projectErrors(synced);
  return errors.length ? fail(project, ...errors) : { project: synced, errors: [] };
}
/** A result naming the instance an edit made: none, if the edit was refused. */
const withId = (result: CommandResult, id: string | null) => ({ ...result, id: result.errors.length ? null : id });
/** Errors for values that are not finite numbers, or (`positive`) not above zero. */
function numberErrors(values: Record<string, unknown>, positive: boolean): string[] {
  return Object.entries(values).filter(([, v]) => v !== undefined).flatMap(([key, v]) =>
    typeof v !== 'number' || !Number.isFinite(v) ? [`${key} must be a finite number.`] : positive && v <= 0 ? [`${key} must be more than 0 mm.`] : []);
}
const tunnelSize = (p: Project) => p.instances.find(isKind('window'))?.params.tunnelSize ?? MODULAR_DEFAULT.tunnelSize;

/**
 * A new project: a 5 × 5 m lawn; the window (the catio concept's defaults) in the middle of its rear wall with the window insert;
 * a tunnel of two standard modules straight out from it; and an empty 2 × 2 × 2 m enclosure on the tunnel's end, its maintenance
 * door facing the garden. The enclosure stands where the tunnel's own layout ends (its module pitch, the coupling's gap and the
 * standard port), its rear port's sill level with the window port's floor.
 */
export function createProject({ id = 'catio-project', name = 'My catio' }: { id?: string; name?: string } = {}): Project {
  const garden = { ...GARDEN_DEFAULT };
  const settings = structuredClone(SETTINGS_DEFAULT);
  const windowAt: Transform = { x: garden.width / 2, y: 0, z: 0, yaw: 0 };
  const window: Instance = { id: 'window-1', kind: 'window', name: 'Window', parent: null, transform: windowAt, params: { ...WINDOW_PARAMS_DEFAULT }, material: {} };
  const tunnel: Instance = { id: 'tunnel-1', kind: 'tunnel', name: 'Tunnel', parent: window.id, transform: { x: 0, y: 0, z: 0, yaw: 0 }, params: { ...TUNNEL_PARAMS_DEFAULT }, material: {} };
  // the route the two modules make, straight out from the window port at its floor's height
  const site = tunnelSiteFor({ ...settings.insert, mesh: settings.mesh }, { ...MODULAR_DEFAULT, ...window.params, portClosure: settings.portClosure, doorSeat: settings.doorSeat });
  const joint = { ...settings.tunnelCoupling, jointShown: 'end-end' as const };
  const route = tunnelLayout({ ...TUNNEL_DEFAULT, ...tunnel.params, portX: 0, portY: TUNNEL.wallGap + DEFAULT_TUNNEL_MODULES * tunnelPitch(site, joint), portFacing: 0, portLevel: 'own', portHeight: site.floorZ,
    angleJoint: 'side-port', mesh: settings.mesh, supportFixing: settings.tunnelCoupling.supportFixing, supportBase: settings.tunnelCoupling.supportBase }, site, joint);
  const rear = enclosureLayout(ENCLOSURE_DEFAULT, { id: 'enclosure-1', tunnelSize: site.w, connected: { rear: true, left: false, right: false } }).rear.port.face.at;
  const enclosureAt = composeTransform(windowAt, { x: route.E[0] - rear[0], y: route.E[1] - rear[1], z: route.E[2] - rear[2], yaw: 0 });
  const enclosure: Instance = { id: 'enclosure-1', kind: 'enclosure', name: 'Enclosure', parent: null, transform: enclosureAt, params: { ...ENCLOSURE_DEFAULT }, material: {} };
  const ports: Port[] = [
    port(window.id, 'port', site.w, 'connected'), port(tunnel.id, 'start', site.w, 'connected'), port(tunnel.id, 'end', site.w, 'connected'),
    ...ENCLOSURE_PORTS.map(side => port(enclosure.id, side, site.w, side === 'rear' ? 'connected' : 'closed')),
  ];
  const connections: Connection[] = [
    { id: 'connection-1', ports: [portId(window.id, 'port'), portId(tunnel.id, 'start')] },
    { id: 'connection-2', ports: [portId(tunnel.id, 'end'), portId(enclosure.id, 'rear')] },
  ];
  return syncPorts({
    id, schemaVersion: PROJECT_SCHEMA_VERSION, name, units: 'mm', revision: 0, garden, settings,
    instances: [window, tunnel, enclosure], ports, connections, attachments: [], view: { selection: [], hidden: [], camera: null },
  });
}

/** A new empty enclosure standing at `at` on the site, its ports shut. */
export function addEnclosure(project: Project, at: { x: number; y: number; yaw?: number }, size: EnclosureParams = ENCLOSURE_DEFAULT): CommandResult & { id: string | null } {
  const errors = [...numberErrors({ x: at.x, y: at.y, yaw: at.yaw }, false), ...numberErrors({ ...size }, true)];
  if (errors.length) return { ...fail(project, ...errors), id: null };
  const id = nextId(project, 'enclosure');
  const enclosure: Instance = { id, kind: 'enclosure', name: `Enclosure ${id.split('-')[1]}`, parent: null, transform: { x: at.x, y: at.y, z: 0, yaw: at.yaw ?? 0 }, params: { ...size }, material: {} };
  const ports = ENCLOSURE_PORTS.map(side => port(id, side, tunnelSize(project), 'closed'));
  return withId(ok(project, { ...project, instances: [...project.instances, enclosure], ports: [...project.ports, ...ports] }), id);
}

/** A new frame-mounted platform across `enclosureId`, attached to both of its side frames. */
export function addPlatform(project: Project, enclosureId: string): CommandResult & { id: string | null } {
  const enclosure = project.instances.filter(isKind('enclosure')).find(e => e.id === enclosureId);
  if (!enclosure) return { ...fail(project, `There is no enclosure ${enclosureId}.`), id: null };
  const layout = enclosureLayout(enclosure.params, { id: enclosure.id, tunnelSize: tunnelSize(project), connected: { rear: false, left: false, right: false } });
  const { params, transform, anchors } = platformDefaults(layout);
  // a board across an enclosure too small inside to hold one would have no size: refuse it, rather than save it
  if (numberErrors({ ...params }, true).length) return { ...fail(project, `${enclosure.name ?? enclosure.id} is too small inside (${Math.round(params.width)} mm between its side frames) for a platform.`), id: null };
  const taken = allIds(project);
  const id = nextId(project, 'platform', taken); taken.add(id);
  const platform: Instance = { id, kind: 'platform', name: `Platform ${id.split('-')[1]}`, parent: enclosure.id, transform, params, material: { sheet: PLATFORM_SHEET } };
  const attachments: Attachment[] = (Object.entries(anchors) as [keyof typeof anchors, typeof anchors[keyof typeof anchors]][]).map(([member, anchor]) => {
    const aid = nextId(project, 'attachment', taken); taken.add(aid);
    return { id: aid, instance: id, support: { instance: enclosure.id, member }, anchor };
  });
  return withId(ok(project, { ...project, instances: [...project.instances, platform], attachments: [...project.attachments, ...attachments] }), id);
}

const MOVABLE = ['enclosure', 'platform'] as const;
function movable(project: Project, id: string): Instance | string {
  const instance = project.instances.find(i => i.id === id);
  if (!instance) return `There is no instance ${id}.`;
  if (!(MOVABLE as readonly string[]).includes(instance.kind)) return `A ${instance.kind} cannot be moved, turned, resized or duplicated here yet.`;
  return instance;
}
const replace = (project: Project, instance: Instance): Project => ({ ...project, instances: project.instances.map(i => i.id === instance.id ? instance : i) });

/**
 * Moves an enclosure or platform to `to` in its parent's frame (a platform's z is its elevation). An enclosure carries its
 * interior; a tunnel coupled to it keeps the connection and is re-solved, an invalid draft when its modules no longer reach.
 */
export function moveInstance(project: Project, id: string, to: Partial<Pick<Transform, 'x' | 'y' | 'z'>>): CommandResult {
  const instance = movable(project, id); if (typeof instance === 'string') return fail(project, instance);
  const errors = numberErrors(to, false); if (errors.length) return fail(project, ...errors);
  return ok(project, replace(project, { ...instance, transform: { ...instance.transform, ...to } }));
}

/** Turns an enclosure or platform to `yaw` degrees about its own origin, in its parent's frame. */
export function rotateInstance(project: Project, id: string, yaw: number): CommandResult {
  const instance = movable(project, id); if (typeof instance === 'string') return fail(project, instance);
  const errors = numberErrors({ yaw }, false); if (errors.length) return fail(project, ...errors);
  return ok(project, replace(project, { ...instance, transform: { ...instance.transform, yaw } }));
}

/**
 * Resizes an enclosure (width, depth, height) or a platform (width, depth, thickness). Its children keep their sizes and their
 * positions in its frame; whatever no longer fits, or an attachment it breaks, is reported by `evaluateProject`.
 */
export function resizeInstance(project: Project, id: string, size: Partial<EnclosureParams> | Partial<PlatformParams>): CommandResult {
  const instance = movable(project, id); if (typeof instance === 'string') return fail(project, instance);
  const keys = instance.kind === 'enclosure' ? ['width', 'depth', 'height'] : ['width', 'depth', 'thickness'];
  const unknown = Object.keys(size).filter(k => !keys.includes(k));
  if (unknown.length) return fail(project, `A ${instance.kind} has no ${unknown.join(' or ')} to resize.`);
  const errors = numberErrors(size, true); if (errors.length) return fail(project, ...errors);
  const resized = { ...instance, params: { ...instance.params, ...size } } as Instance;
  // a platform's anchors stay at its ends, so that resizing it moves where it bears, not what it is fixed to
  const attachments = resized.kind === 'platform'
    ? project.attachments.map(a => a.instance === id && a.support.member in platformAnchors(resized.params) ? { ...a, anchor: platformAnchors(resized.params)[a.support.member as keyof ReturnType<typeof platformAnchors>] } : a)
    : project.attachments;
  return ok(project, { ...replace(project, resized), attachments });
}

/**
 * A copy of an enclosure (with everything in it) or a platform, under new ids, moved by `offset` (by default beside an enclosure,
 * above a platform). Its ports start shut: a copy couples to nothing until it is connected.
 */
export function duplicateInstance(project: Project, id: string, offset?: Partial<Transform>): CommandResult & { id: string | null } {
  const instance = movable(project, id); if (typeof instance === 'string') return { ...fail(project, instance), id: null };
  const shift = offset ?? (instance.kind === 'enclosure' ? { x: instance.params.width + 500 } : { z: 300 });
  const errors = numberErrors(shift, false); if (errors.length) return { ...fail(project, ...errors), id: null };
  const taken = allIds(project);
  const fresh = (prefix: string) => { const n = nextId(project, prefix, taken); taken.add(n); return n; };
  const ids = new Map<string, string>();
  const subtree = [instance, ...descendants(project, id)];
  for (const i of subtree) ids.set(i.id, fresh(i.kind));
  const copies = subtree.map((i): Instance => ({
    ...structuredClone(i), id: ids.get(i.id) ?? i.id, ...(i.name ? { name: `${i.name} (copy)` } : {}), parent: i.parent && ids.has(i.parent) ? ids.get(i.parent) ?? null : i.parent,
    transform: i === instance ? { ...i.transform, x: i.transform.x + (shift.x ?? 0), y: i.transform.y + (shift.y ?? 0), z: i.transform.z + (shift.z ?? 0), yaw: i.transform.yaw + (shift.yaw ?? 0) } : { ...i.transform },
  }));
  const ports = project.ports.filter(p => ids.has(p.owner)).map(p => {
    const owner = ids.get(p.owner) ?? p.owner;
    return { ...structuredClone(p), id: portId(owner, p.name), owner, state: p.state === 'connected' ? 'closed' as const : p.state };
  });
  const attachments = project.attachments.filter(a => ids.has(a.instance)).map(a => ({
    ...structuredClone(a), id: fresh('attachment'), instance: ids.get(a.instance) ?? a.instance,
    support: { ...a.support, instance: ids.get(a.support.instance) ?? a.support.instance },
  }));
  const copy = ids.get(id) ?? null;
  return withId(ok(project, { ...project, instances: [...project.instances, ...copies], ports: [...project.ports, ...ports], attachments: [...project.attachments, ...attachments] }), copy);
}

function descendants(project: Project, id: string): Instance[] {
  const children = project.instances.filter(i => i.parent === id);
  return children.flatMap(c => [c, ...descendants(project, c.id)]);
}

/** What deleting an instance takes with it: the instance and everything in or on it, their ports, connections and attachments. */
export interface Dependents { instances: string[]; ports: string[]; connections: string[]; attachments: string[] }
/**
 * Everything `deleteInstance` would remove, to confirm with the owner first: the instance, its children (a window's tunnel, an
 * enclosure's interior), their ports, the connections to those ports and the attachments of or to them. The mates of those
 * connections are kept, shut (or, a tunnel's end, left open).
 */
export function deleteDependents(project: Project, id: string): Dependents {
  const root = project.instances.find(i => i.id === id);
  if (!root) return { instances: [], ports: [], connections: [], attachments: [] };
  const instances = [root, ...descendants(project, id)].map(i => i.id);
  const ports = project.ports.filter(p => instances.includes(p.owner)).map(p => p.id);
  const connections = project.connections.filter(c => c.ports.some(p => ports.includes(p))).map(c => c.id);
  const attachments = project.attachments.filter(a => instances.includes(a.instance) || instances.includes(a.support.instance)).map(a => a.id);
  return { instances, ports, connections, attachments };
}

/** Deletes an instance and its dependents (`deleteDependents`): no reference to anything removed is left behind. */
export function deleteInstance(project: Project, id: string): CommandResult & { removed: Dependents } {
  const removed = deleteDependents(project, id);
  if (!removed.instances.length) return { ...fail(project, `There is no instance ${id}.`), removed };
  const gone = (list: string[]) => (x: { id: string }) => !list.includes(x.id);
  const orphaned = new Set(project.connections.filter(c => removed.connections.includes(c.id)).flatMap(c => c.ports));
  const owners = new Map(project.instances.map(i => [i.id, i.kind]));
  const ports = project.ports.filter(gone(removed.ports)).map(p => orphaned.has(p.id) ? { ...p, state: owners.get(p.owner) === 'tunnel' ? 'open' as const : 'closed' as const } : p);
  const instances = project.instances.filter(gone(removed.instances));
  return {
    ...ok(project, {
      ...project, instances, ports, connections: project.connections.filter(gone(removed.connections)),
      attachments: project.attachments.filter(gone(removed.attachments)), view: keepView(project.view, { instances }),
    }),
    removed,
  };
}

/** Resizes the garden. Nothing is moved, scaled or deleted: `outside` lists what is now outside it. */
export function resizeGarden(project: Project, size: { width: number; depth: number }): CommandResult & { outside: string[] } {
  const errors = numberErrors(size, true);
  if (errors.length) return { ...fail(project, ...errors), outside: [] };
  const resized = { ...project, garden: { width: size.width, depth: size.depth } };
  const evaluation = evaluateProject(resized);
  const result = ok(project, resized, evaluation);
  return { ...result, outside: result.errors.length ? [] : outsideGarden(evaluation) };
}
