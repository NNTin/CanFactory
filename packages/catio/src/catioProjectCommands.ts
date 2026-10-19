import { enclosureLayout } from './catioEnclosure.ts';
import { MODULAR_DEFAULT } from './catioModularDesign.ts';
import {
  clampPlatform, platformAttachments, platformDefaults, platformOrientation, platformRange, platformYaw, PLATFORM_RECIPES, PLATFORM_SHEET, type PlatformRange,
} from './catioPlatform.ts';
import {
  applyTransform, composeTransform, isKind, yawDirection, keepView, projectErrors, PROJECT_SCHEMA_VERSION, relativeTransform, routeElements, SETTINGS_DEFAULT, TUNNEL_PARAMS_DEFAULT, WINDOW_PARAMS_DEFAULT, worldTransforms,
  type Attachment, type Connection, type EnclosureInstance, type EnclosureParams, type Instance, type PlatformParams, type Port, type Project, type Transform, type TunnelInstance,
} from './catioProject.ts';
import { evaluateProject, outsideGarden, solveRoute, syncFrames, tunnelFrame, type EvaluatedTunnel, type ProjectEvaluation } from './catioProjectEvaluate.ts';
import { routeElementName, TUNNEL, tunnelPitch, tunnelSiteFor, type RouteElement } from './catioTunnel.ts';

/**
 * The planner's edits: pure functions from a project to the next one. An edit that cannot be made (a number that is not finite or
 * not positive, an instance that is not there or cannot take it) returns the project unchanged with its `errors`, so that a bad
 * value never reaches the document. After every edit the ports are where their owners' layouts put them, and each tunnel in the frame
 * of the port it starts at (`syncFrames`). Edits do
 * not count revisions: a committed history step does (catioProjectHistory.ts: `commitEdit`).
 */
export interface CommandResult {
  project: Project; errors: string[];
  /** What the edit did other than asked, e.g. a platform kept inside its enclosure: for the owner, not a refusal. */
  notes?: string[];
}

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
const newPort = (owner: string, name: string, size: number, state: Port['state']): Port =>
  ({ id: portId(owner, name), owner, name, frame: { x: 0, y: 0, z: 0, yaw: 0 }, interface: { kind: 'standard-port', size }, state });
const fail = (project: Project, ...errors: string[]): CommandResult => ({ project, errors });
/**
 * `next`, its ports synced, as the edit's result; or `project` unchanged with the reasons, if `next` is a document `parseProject`
 * would refuse. An edit's own checks say why first; this is the guarantee that no edit puts what cannot be reopened into the history.
 */
function ok(project: Project, next: Project, evaluation?: Pick<ProjectEvaluation, 'ports' | 'instances'>): CommandResult {
  const synced = syncFrames(next, evaluation);
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
  // the route the two modules make, straight out from the window port at its floor's height
  const site = tunnelSiteFor({ ...settings.insert, mesh: settings.mesh }, { ...MODULAR_DEFAULT, ...window.params, portClosure: settings.portClosure, doorSeat: settings.doorSeat });
  const joint = { ...settings.tunnelCoupling, jointShown: 'end-end' as const };
  const solved = solveRoute({ id: 'tunnel-1', params: { ...TUNNEL_PARAMS_DEFAULT, route: [] } }, settings,
    site, { x: 0, y: TUNNEL.wallGap + DEFAULT_TUNNEL_MODULES * tunnelPitch(site, joint), z: site.floorZ, yaw: 180 }, true);
  const tunnel: Instance = { id: 'tunnel-1', kind: 'tunnel', name: 'Tunnel', parent: null, transform: windowAt, params: { ...TUNNEL_PARAMS_DEFAULT, route: solved.route }, material: {} };
  const { E } = solved.layout;
  const rear = enclosureLayout(ENCLOSURE_DEFAULT, { id: 'enclosure-1', tunnelSize: site.w, connected: { rear: true, left: false, right: false } }).rear.port.face.at;
  const enclosureAt = composeTransform(windowAt, { x: E[0] - rear[0], y: E[1] - rear[1], z: E[2] - rear[2], yaw: 0 });
  const enclosure: Instance = { id: 'enclosure-1', kind: 'enclosure', name: 'Enclosure', parent: null, transform: enclosureAt, params: { ...ENCLOSURE_DEFAULT }, material: {} };
  const ports: Port[] = [
    newPort(window.id, 'port', site.w, 'connected'), newPort(tunnel.id, 'start', site.w, 'connected'), newPort(tunnel.id, 'end', site.w, 'connected'),
    ...ENCLOSURE_PORTS.map(side => newPort(enclosure.id, side, site.w, side === 'rear' ? 'connected' : 'closed')),
  ];
  const connections: Connection[] = [
    { id: 'connection-1', ports: [portId(window.id, 'port'), portId(tunnel.id, 'start')] },
    { id: 'connection-2', ports: [portId(tunnel.id, 'end'), portId(enclosure.id, 'rear')] },
  ];
  return syncFrames({
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
  const ports = ENCLOSURE_PORTS.map(side => newPort(id, side, tunnelSize(project), 'closed'));
  return withId(ok(project, { ...project, instances: [...project.instances, enclosure], ports: [...project.ports, ...ports] }), id);
}

/** A new frame-mounted platform across `enclosureId`, attached to both of its side frames. */
export function addPlatform(project: Project, enclosureId: string): CommandResult & { id: string | null } {
  const enclosure = project.instances.filter(isKind('enclosure')).find(e => e.id === enclosureId);
  if (!enclosure) return { ...fail(project, `There is no enclosure ${enclosureId}.`), id: null };
  const { params, transform, ends } = platformDefaults(roomOf(project, enclosure), tunnelSize(project));
  // a board across an enclosure too small inside to hold one would have no size: refuse it, rather than save it
  if (numberErrors({ ...params }, true).length) return { ...fail(project, `${enclosure.name ?? enclosure.id} is too small inside (${Math.round(params.width)} mm between its side frames) for a platform.`), id: null };
  const taken = allIds(project);
  const id = nextId(project, 'platform', taken); taken.add(id);
  const platform: Instance = { id, kind: 'platform', name: `Platform ${id.split('-')[1]}`, parent: enclosure.id, transform, params, material: { sheet: PLATFORM_SHEET } };
  const attachments: Attachment[] = ends.map(({ member, anchor }) => {
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

/** An enclosure's standard port size, as `evaluateProject` reads it: its ports', else the window's. */
const portSize = (project: Project, enclosure: string) => project.ports.find(p => p.owner === enclosure)?.interface.size ?? tunnelSize(project);
/** An enclosure's layout, for what stands in it: its ports' state does not matter there. */
const roomOf = (project: Project, enclosure: EnclosureInstance) =>
  enclosureLayout(enclosure.params, { id: enclosure.id, tunnelSize: portSize(project, enclosure.id), connected: { rear: false, left: false, right: false } });

/**
 * Where a platform can stand in its enclosure (`platformRange`), its board as `change.params` and turned to `change.yaw` (by
 * default, as they are): what every move of it is clamped to, here and in the viewport's drag. Null for anything but a platform
 * in an enclosure.
 */
export function platformRangeOf(project: Project, id: string, change: { params?: PlatformParams; yaw?: number } = {}): PlatformRange | null {
  const platform = project.instances.find(i => i.id === id);
  if (platform?.kind !== 'platform') return null;
  const enclosure = project.instances.filter(isKind('enclosure')).find(e => e.id === platform.parent);
  if (!enclosure) return null;
  return platformRange(change.params ?? platform.params, change.yaw ?? platform.transform.yaw, roomOf(project, enclosure), portSize(project, enclosure.id));
}

const cm = (mm: number) => `${mm < -0.5 ? '−' : ''}${(Math.abs(Math.round(mm)) / 10).toLocaleString('en', { maximumFractionDigits: 1 })}`;
/** A range's text, in centimetres: `24–176 cm`, `−76–76 cm`, or several bands. */
export const rangeText = (intervals: [number, number][]) => intervals.length ? `${intervals.map(([a, b]) => `${cm(a)}–${cm(b)}`).join(' or ')} cm` : 'nowhere';
const AXIS_TITLES = { x: 'West–East', y: 'North–South' } as const;
/** What keeping a platform at `got` rather than `wanted` changed, for the owner. */
function clampNotes(range: PlatformRange, wanted: Transform, got: Transform, name: string): string[] {
  const notes: string[] = [];
  const moved = (key: 'x' | 'y' | 'z') => Math.abs(wanted[key] - got[key]) > 0.5;
  if (moved(range.fixed)) notes.push(`${name} spans its enclosure ${range.orientation === 'west-east' ? 'from side to side' : 'from rear to front'}: it stays in the middle ${AXIS_TITLES[range.fixed]}.`);
  if (moved(range.free)) notes.push(`${name} stops at ${cm(got[range.free])} cm ${AXIS_TITLES[range.free]}: it moves within ${rangeText([range.along])}, between the inside faces.`);
  if (moved('z')) notes.push(`${name} stops at an elevation of ${cm(got.z)} cm: its supports allow ${rangeText(range.heights)}, clear of the cat ports.`);
  return notes;
}
const noted = (result: CommandResult, notes: string[]): CommandResult => result.errors.length || !notes.length ? result : { ...result, notes };

/**
 * Moves an enclosure or platform to `to` in its parent's frame (a platform's z is its elevation). An enclosure carries its
 * interior; a tunnel coupled to it keeps the connection and is re-solved, an invalid draft when its modules no longer reach. A
 * platform is kept inside its enclosure where its recipe holds (`platformRange`): it stays centred between the frames it spans,
 * stops at the inside faces and at its lowest and highest elevations, and skips the heights of the cat ports in the way it moved.
 * The result's notes say where it stopped.
 */
export function moveInstance(project: Project, id: string, to: Partial<Pick<Transform, 'x' | 'y' | 'z'>>): CommandResult {
  const instance = movable(project, id); if (typeof instance === 'string') return fail(project, instance);
  const errors = numberErrors(to, false); if (errors.length) return fail(project, ...errors);
  const wanted = { ...instance.transform, ...to };
  const range = platformRangeOf(project, id);
  if (!range) return ok(project, rerouted(replace(project, { ...instance, transform: wanted }), [id]));
  const transform = clampPlatform(range, wanted, instance.transform.z);
  return noted(ok(project, replace(project, { ...instance, transform })), clampNotes(range, wanted, transform, instance.name ?? id));
}

/**
 * Turns an enclosure or platform to `yaw` degrees about its own origin, in its parent's frame. A platform runs West–East or
 * North–South: it turns in quarter turns (to the nearest), and a turn to the other way is one edit that spans its board between the
 * other frames, keeps it inside (`platformRange`) and moves its attachments to the members its ends then bear on.
 */
export function rotateInstance(project: Project, id: string, yaw: number): CommandResult {
  const instance = movable(project, id); if (typeof instance === 'string') return fail(project, instance);
  const errors = numberErrors({ yaw }, false); if (errors.length) return fail(project, ...errors);
  if (instance.kind !== 'platform') return ok(project, rerouted(replace(project, { ...instance, transform: { ...instance.transform, yaw } }), [id]));
  const quarter = platformYaw(yaw); const name = instance.name ?? id;
  const range = platformRangeOf(project, id, { yaw: quarter });
  if (!range) return ok(project, replace(project, { ...instance, transform: { ...instance.transform, yaw: quarter } }));
  const notes = quarter !== yaw ? [`A platform turns in 90° steps: ${name} is turned to ${quarter}°.`] : [];
  let params = instance.params;
  if (range.orientation !== platformOrientation(platformYaw(instance.transform.yaw))) {
    params = { ...params, width: range.span, depth: Math.min(params.depth, range.room) };
    notes.push(`${name} now runs ${PLATFORM_RECIPES[range.orientation].title}: its board spans ${cm(range.span)} cm${params.depth < instance.params.depth ? `, and is ${cm(params.depth)} cm deep to fit` : ''}.`);
  }
  const fitted = platformRangeOf(project, id, { params, yaw: quarter }) ?? range;
  const turned = { ...instance, params, transform: clampPlatform(fitted, { ...instance.transform, yaw: quarter }) };
  return noted(ok(project, { ...replace(project, turned), attachments: platformAttachments(project.attachments, id, params, quarter) }), notes);
}

/**
 * Resizes an enclosure (width, depth, height) or a platform (width, depth, thickness). Its children keep their sizes and their
 * positions in its frame; whatever no longer fits, or an attachment it breaks, is reported by `evaluateProject`, never moved. A
 * platform's own resize keeps it inside its enclosure as a move does: its span no wider than the frames it spans, its depth no
 * more than there is room for, and its position clamped to the range its new size has.
 */
export function resizeInstance(project: Project, id: string, size: Partial<EnclosureParams> | Partial<PlatformParams>): CommandResult {
  const instance = movable(project, id); if (typeof instance === 'string') return fail(project, instance);
  const keys = instance.kind === 'enclosure' ? ['width', 'depth', 'height'] : ['width', 'depth', 'thickness'];
  const unknown = Object.keys(size).filter(k => !keys.includes(k));
  if (unknown.length) return fail(project, `A ${instance.kind} has no ${unknown.join(' or ')} to resize.`);
  const errors = numberErrors(size, true); if (errors.length) return fail(project, ...errors);
  if (instance.kind !== 'platform') return ok(project, rerouted(replace(project, { ...instance, params: { ...instance.params, ...size } } as Instance), [id]));
  const range = platformRangeOf(project, id);
  const wanted = { ...instance.params, ...size };
  const params = range ? { ...wanted, width: Math.min(wanted.width, range.span), depth: Math.min(wanted.depth, range.room) } : wanted;
  const name = instance.name ?? id; const notes: string[] = [];
  if (params.width < wanted.width) notes.push(`${name}'s board is ${cm(params.width)} cm long: that is the span between the frames it rests on.`);
  if (params.depth < wanted.depth) notes.push(`${name}'s board is ${cm(params.depth)} cm deep: no more fits between the inside faces.`);
  const fitted = platformRangeOf(project, id, { params });
  const transform = fitted ? clampPlatform(fitted, instance.transform) : instance.transform;
  if (fitted) notes.push(...clampNotes(fitted, instance.transform, transform, name));
  // a platform's anchors stay at its ends, so that resizing it moves where it bears, not what it is fixed to
  const resized = { ...instance, params, transform };
  return noted(ok(project, { ...replace(project, resized), attachments: platformAttachments(project.attachments, id, params, transform.yaw) }), notes);
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
  // a platform's copy stays inside its enclosure, as a move would keep it
  const range = platformRangeOf(project, id);
  if (range) for (const c of copies) if (c.id === copy) c.transform = clampPlatform(range, c.transform, instance.transform.z);
  return withId(ok(project, { ...project, instances: [...project.instances, ...copies], ports: [...project.ports, ...ports], attachments: [...project.attachments, ...attachments] }), copy);
}

function descendants(project: Project, id: string): Instance[] {
  const children = project.instances.filter(i => i.parent === id);
  return children.flatMap(c => [c, ...descendants(project, c.id)]);
}

/** What deleting an instance takes with it: the instance and everything in or on it, their ports, connections and attachments. */
export interface Dependents { instances: string[]; ports: string[]; connections: string[]; attachments: string[] }
/**
 * Everything `deleteInstance` would remove, to confirm with the owner first: the instance, its children (an enclosure's interior),
 * their ports, the connections to those ports and the attachments of or to them. The mates of those connections are kept: a
 * window's or an enclosure's port shut, a tunnel's end left free (where it was, an unfinished end).
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
      attachments: project.attachments.filter(gone(removed.attachments)), view: keepView(project.view, { instances, ports }),
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

/**
 * `project` with every tunnel whose end is coupled to a port of `moved` (or of what stands in them, other than `except`), or that
 * starts at one, solved again to its end's mate (`solveRoute`), from the port it starts at: its elements keep their ids and floors
 * where they still are, and run into the mate's floor (FR-04.10).
 */
function rerouted(project: Project, moved: string[], except: string[] = []): Project {
  const evaluation = evaluateProject(project);
  const ports = new Map(evaluation.ports.map(p => [p.id, p]));
  const byId = new Map(project.instances.map(i => [i.id, i]));
  const inMoved = (id: string | null) => { for (let at: string | null = id, n = 0; at && n < 50; at = byId.get(at)?.parent ?? null, n++) if (moved.includes(at)) return true; return false; };
  let next = project;
  for (const e of evaluation.instances) {
    const t = byId.get(e.id);
    if (e.kind !== 'tunnel' || t?.kind !== 'tunnel' || except.includes(t.id)) continue;
    const mateWorld = e.ends.end.mate ? ports.get(e.ends.end.mate)?.world : undefined;
    if (!mateWorld || !(inMoved(e.ends.end.owner) || inMoved(e.ends.start.owner) || inMoved(t.id))) continue;
    const { route } = solveRoute(t, project.settings, e.site, relativeTransform(e.world, mateWorld), true);
    next = replace(next, { ...t, params: { ...t.params, route } });
  }
  return next;
}
/** The port coupled to port `id`, if any. */
function mateOf(project: Project, id: string): Port | undefined {
  const other = project.connections.find(c => c.ports.includes(id))?.ports.find(p => p !== id);
  return other ? project.ports.find(p => p.id === other) : undefined;
}
const titleOf = (project: Project, id: string) => { const i = project.instances.find(q => q.id === id); return i?.name ?? id; };
/** What the planner calls a port: its owner's name and the port's (`Enclosure 2's left port`, `Window's cat port`). */
export function portTitle(project: Project, id: string): string {
  const port = project.ports.find(p => p.id === id);
  if (!port) return id;
  const owner = project.instances.find(i => i.id === port.owner);
  return owner?.kind === 'window' ? `${titleOf(project, port.owner)}'s cat port` : owner?.kind === 'tunnel' ? `${titleOf(project, port.owner)}'s ${port.name === 'start' ? 'start' : 'far end'}` : `${titleOf(project, port.owner)}'s ${port.name} port`;
}

/** The ids taken in the project, its route elements' too. */
const takenIds = (project: Project) => new Set([...allIds(project), ...routeElements(project).keys()]);
/** A tunnel's end `end` (its port's id) that is free, or why it cannot be extended or turned there. */
function freeEnd(project: Project, end: string): { tunnel: TunnelInstance; port: Port } | string {
  const port = project.ports.find(p => p.id === end);
  const tunnel = port && project.instances.find(i => i.id === port.owner);
  if (!port || tunnel?.kind !== 'tunnel') return `There is no tunnel end ${end}.`;
  if (port.name !== 'end') return `${titleOf(project, tunnel.id)} grows from its far end: its start stays where it starts.`;
  const mate = mateOf(project, end);
  if (mate) return `${portTitle(project, end)} is coupled to ${portTitle(project, mate.id)}: detach it first.`;
  return { tunnel, port };
}

/**
 * A new tunnel from the free cat port `from` (a window's or an enclosure's, FR-04.1): `modules` standard modules (one by default)
 * straight out of it, level with its floor, its start coupled there (the port opens and takes its coupling, FR-04.9) and its far end
 * free, an unfinished end until it is connected.
 */
export function addTunnel(project: Project, from: string, modules = 1): CommandResult & { id: string | null } {
  if (!Number.isInteger(modules) || modules < 1) return { ...fail(project, 'A tunnel is a whole number of modules, at least one.'), id: null };
  const port = project.ports.find(p => p.id === from);
  const owner = port && project.instances.find(i => i.id === port.owner);
  if (!port || !owner) return { ...fail(project, `There is no port ${from}.`), id: null };
  if (owner.kind === 'tunnel') return { ...fail(project, `${portTitle(project, from)} is a tunnel's end: extend that tunnel, rather than start another.`), id: null };
  const mate = mateOf(project, from);
  if (mate) return { ...fail(project, `${portTitle(project, from)} is already coupled to ${portTitle(project, mate.id)}: a port takes one mate.`), id: null };
  const evaluation = evaluateProject(project);
  const face = evaluation.ports.find(p => p.id === from)?.world;
  if (!face) return { ...fail(project, `${portTitle(project, from)} has no place yet.`), id: null };
  const taken = takenIds(project);
  const id = nextId(project, 'tunnel', taken); taken.add(id);
  const connection = nextId(project, 'connection', taken);
  const floor = face.z;
  const joint = { ...project.settings.tunnelCoupling, jointShown: 'end-end' as const };
  const tunnel: Instance = {
    id, kind: 'tunnel', name: `Tunnel ${id.split('-')[1]}`, parent: null, transform: tunnelFrame(face, owner.kind === 'window', joint),
    params: { ...TUNNEL_PARAMS_DEFAULT, route: Array.from({ length: modules }, (_, n) => ({ id: `${id}-element-${n + 1}`, kind: 'straight' as const, modules: 1, floor })) }, material: {},
  };
  const ports: Port[] = [
    ...project.ports.map(p => p.id === from ? { ...p, state: 'connected' as const } : p),
    newPort(id, 'start', port.interface.size, 'connected'), { ...newPort(id, 'end', port.interface.size, 'open'), frame: { x: 0, y: 0, z: floor, yaw: 0 } },
  ];
  return withId(ok(project, { ...project, instances: [...project.instances, tunnel], ports, connections: [...project.connections, { id: connection, ports: [from, portId(id, 'start')] }] }), id);
}

/**
 * Lengthens a tunnel at its free far end (`end`, its port's id) by `modules` whole standard modules (FR-04.3), or (negative)
 * shortens it by as many: added modules run on straight and level with the end; a shortened tunnel loses its last modules, turns
 * among them, and keeps at least one. A coupled end is anchored: detach it first.
 */
export function extendTunnel(project: Project, end: string, modules: number): CommandResult {
  if (!Number.isInteger(modules) || modules === 0) return fail(project, 'A tunnel is lengthened or shortened by a whole number of modules.');
  const found = freeEnd(project, end); if (typeof found === 'string') return fail(project, found);
  const { tunnel, port } = found;
  let route = tunnel.params.route.map(e => ({ ...e }));
  if (modules > 0) {
    const taken = takenIds(project);
    route = [...route, ...Array.from({ length: modules }, (): RouteElement => { const id = nextId(project, `${tunnel.id}-element`, taken); taken.add(id); return { id, kind: 'straight', modules: 1, floor: port.frame.z }; })];
  } else {
    const total = route.reduce((n, e) => n + e.modules, 0);
    if (total + modules < 1) return fail(project, `${titleOf(project, tunnel.id)} is ${total} ${total === 1 ? 'module' : 'modules'} long: it keeps at least one. Delete it instead.`);
    for (let left = -modules; left > 0;) {
      const last = route.at(-1); if (!last) break;
      if (last.modules > left) { last.modules -= left; left = 0; } else { route.pop(); left -= last.modules; }
    }
  }
  return ok(project, replace(project, { ...tunnel, params: { ...tunnel.params, route } }));
}
/** Shortens a tunnel at its free far end by `modules` whole standard modules (`extendTunnel`). */
export const shortenTunnel = (project: Project, end: string, modules: number): CommandResult => extendTunnel(project, end, -modules);

/**
 * Turns a tunnel at its free far end (`end`) to the left or the right: a side-port turn, one module (the section whose side port the
 * run so far couples into), level with the end.
 */
export function turnTunnel(project: Project, end: string, direction: 'left' | 'right'): CommandResult {
  const found = freeEnd(project, end); if (typeof found === 'string') return fail(project, found);
  const { tunnel, port } = found;
  const id = nextId(project, `${tunnel.id}-element`, takenIds(project));
  const turn: RouteElement = { id, kind: 'turn', turn: direction === 'right' ? 90 : -90, modules: 1, floor: port.frame.z };
  return ok(project, replace(project, { ...tunnel, params: { ...tunnel.params, route: [...tunnel.params.route, turn] } }));
}

/** How far a tunnel's free end may be from a port for the planner to offer to connect it there. */
export const CONNECT_REACH = 500;
/**
 * Why the free tunnel end `end` cannot be coupled to the port `to` (FR-04.8), or nothing when it can: `to` must be a window's or an
 * enclosure's cat port without a mate (one mate per port), of the same standard port and size, and, at a far end, face it square on
 * and stand ahead of it: the tunnel runs on into it. (A start couples anywhere: the tunnel then stands in that port's frame.)
 */
export function connectProblems(project: Project, end: string, to: string, evaluation: Pick<ProjectEvaluation, 'ports'> = evaluateProject(project)): string[] {
  const own = project.ports.find(p => p.id === end); const port = project.ports.find(p => p.id === to);
  const tunnel = own && project.instances.find(i => i.id === own.owner);
  const owner = port && project.instances.find(i => i.id === port.owner);
  if (!own || tunnel?.kind !== 'tunnel') return [`There is no tunnel end ${end}.`];
  if (!port || !owner) return [`There is no port ${to}.`];
  const problems: string[] = [];
  const ownMate = mateOf(project, end); const mate = mateOf(project, to);
  if (ownMate) problems.push(`${portTitle(project, end)} is already coupled to ${portTitle(project, ownMate.id)}: detach it first.`);
  if (owner.kind === 'tunnel') problems.push(`${portTitle(project, to)} is a tunnel's end: a tunnel couples to a window's or an enclosure's cat port (joining tunnels comes with junctions).`);
  else if (mate) problems.push(`${portTitle(project, to)} is already coupled to ${portTitle(project, mate.id)}: a port takes one mate.`);
  if (Math.abs(port.interface.size - own.interface.size) > 1e-6) {
    problems.push(`${portTitle(project, to)} is a ${Math.round(port.interface.size)} mm port, ${titleOf(project, tunnel.id)} a ${Math.round(own.interface.size)} mm tunnel: they do not fit.`);
  }
  if (own.name === 'end' && owner.kind !== 'tunnel') {
    const a = evaluation.ports.find(p => p.id === end)?.world; const b = evaluation.ports.find(p => p.id === to)?.world;
    const off = a && b ? ((b.yaw - a.yaw - 180) % 360 + 540) % 360 - 180 : 0;
    if (Math.abs(off) > 0.5) problems.push(`${portTitle(project, to)} faces ${Math.abs(Math.round(off))}° off ${titleOf(project, tunnel.id)}'s end: turn ${titleOf(project, owner.id)} (or the tunnel's end) so that they face each other.`);
    else if (a && b) {
      const [dx, dy] = yawDirection(a.yaw);
      // (a little behind it is where whole modules overshoot: the tunnel is laid out again into it)
      if ((b.x - a.x) * dx + (b.y - a.y) * dy < -CONNECT_REACH) problems.push(`${portTitle(project, to)} is behind ${titleOf(project, tunnel.id)}'s end: the tunnel runs on into a port ahead of it.`);
    }
  }
  return problems;
}
/** The ports the free tunnel end `end` can be connected to (`connectProblems`), nearest first, with their distance from it. */
export function connectTargets(project: Project, end: string, evaluation: Pick<ProjectEvaluation, 'ports'> = evaluateProject(project)): { port: string; distance: number }[] {
  const at = evaluation.ports.find(p => p.id === end)?.world; if (!at) return [];
  return evaluation.ports.filter(p => p.owner !== project.ports.find(q => q.id === end)?.owner && !connectProblems(project, end, p.id, evaluation).length)
    .map(p => ({ port: p.id, distance: Math.hypot(p.world.x - at.x, p.world.y - at.y, p.world.z - at.z) })).sort((a, b) => a.distance - b.distance);
}

/**
 * Couples the free tunnel end `end` to the port `to`, when they fit (`connectProblems`): both are then connected, and the port opens
 * and takes its coupling (FR-04.9). A far end coupled to an enclosure coupled to nothing else moves that enclosure onto it (with what
 * stands in it): the tunnel's modules decide where it stands. An anchored port (a window's, or an enclosure's coupled elsewhere) stays
 * put: the tunnel is solved again to reach it, and is kept as an invalid draft when its whole modules cannot (FR-04.10). A start
 * coupled anew puts the tunnel in that port's frame.
 */
export function connect(project: Project, end: string, to: string): CommandResult & { id: string | null } {
  const evaluation = evaluateProject(project);
  const problems = connectProblems(project, end, to, evaluation);
  if (problems.length) return { ...fail(project, ...problems), id: null };
  const own = project.ports.find(p => p.id === end); const port = project.ports.find(p => p.id === to);
  const tunnel = own && project.instances.find(i => i.id === own.owner);
  const owner = port && project.instances.find(i => i.id === port.owner);
  if (!own || !port || !tunnel || !owner) return { ...fail(project, `There is no port ${to}.`), id: null };
  const id = nextId(project, 'connection', takenIds(project));
  let next: Project = {
    ...project, ports: project.ports.map(p => p.id === end || p.id === to ? { ...p, state: 'connected' as const } : p),
    connections: [...project.connections, { id, ports: [end, to] }],
  };
  if (own.name === 'start') return withId(ok(project, rerouted(next, [tunnel.id])), id);
  const anchored = owner.kind !== 'enclosure' || owner.parent !== null
    || project.connections.some(c => c.ports.some(q => project.ports.find(p => p.id === q)?.owner === owner.id));
  if (anchored) return withId(ok(project, rerouted(next, [owner.id])), id);
  // the enclosure moves onto the tunnel's end, as its modules lay it out into the port's floor
  const after = evaluateProject(next);
  const e = after.instances.find((i): i is EvaluatedTunnel => i.kind === 'tunnel' && i.id === tunnel.id);
  const face = after.ports.find(p => p.id === to)?.world;
  if (!e?.layout || !face) return withId(ok(project, next), id);
  const reached = applyTransform(e.world, { x: e.layout.E[0], y: e.layout.E[1], z: e.layout.E[2] });
  const shift = { x: reached.x - face.x, y: reached.y - face.y };
  const notes: string[] = [];
  if (Math.hypot(shift.x, shift.y) >= 0.5) {
    next = replace(next, { ...owner, transform: { ...owner.transform, x: r3(owner.transform.x + shift.x), y: r3(owner.transform.y + shift.y) } });
    notes.push(`${titleOf(project, owner.id)} moved ${Math.round(Math.hypot(shift.x, shift.y))} mm onto ${titleOf(project, tunnel.id)}'s end: its whole modules decide where it stands.`);
  }
  return withId(noted(ok(project, next), notes), id);
}

/**
 * Uncouples the connection `id`, explicitly (FR-04.10: a connection is never dropped silently): a window's or an enclosure's port is
 * shut again by its closure, a tunnel's end is left free where it is, an unfinished end.
 */
export function detach(project: Project, id: string): CommandResult {
  const connection = project.connections.find(c => c.id === id);
  if (!connection) return fail(project, `There is no connection ${id}.`);
  const kinds = new Map(project.instances.map(i => [i.id, i.kind]));
  const ports = project.ports.map(p => !connection.ports.includes(p.id) ? p : { ...p, state: kinds.get(p.owner) === 'tunnel' ? 'open' as const : 'closed' as const });
  return ok(project, { ...project, ports, connections: project.connections.filter(c => c.id !== id) });
}

/**
 * Raises (or, `delta` < 0, lowers) tunnel route elements by `delta` mm, as one edit (FR-02.6, FR-04.2): each element's floor and the
 * next one's (its end), so that the elements move as they are and their neighbours that stay put slope up or down to them, with bends
 * where the slope changes (`tunnelLayout`). An element at either end of its tunnel takes the cat port it couples to with it: the
 * window insert's port moves in its collar, an enclosure's port with its frame, mesh, landing and ramp (`Port.raise`), as far as
 * they allow (`ProjectEvaluation.portRanges`). Beyond that the whole edit stops there, and the notes say so. An enclosure at the
 * tunnel's end is moved by as much as the bends lengthen or shorten the route, so that it stays coupled; the notes say by how much.
 * A slope too steep or a support too low is not refused: the design stays an editable draft with those issues on the elements.
 */
export function raiseElements(project: Project, ids: readonly string[], delta: number): CommandResult {
  const errors = numberErrors({ delta }, false); if (errors.length) return fail(project, ...errors);
  const elements = routeElements(project);
  const missing = ids.filter(id => !elements.has(id));
  if (missing.length || !ids.length) return fail(project, missing.length ? `There is no tunnel element ${missing.join(', ')}.` : 'Select tunnel elements to raise or lower.');
  const evaluation = evaluateProject(project);
  const tunnels = new Map<string, { tunnel: TunnelInstance; nodes: Set<number> }>();
  for (const id of ids) {
    const found = elements.get(id); if (!found) continue;
    const entry = tunnels.get(found.tunnel.id) ?? { tunnel: found.tunnel, nodes: new Set<number>() };
    entry.nodes.add(found.index); entry.nodes.add(found.index + 1);
    tunnels.set(found.tunnel.id, entry);
  }
  // the cat ports at the ends that move with them, and how far each can
  let step = delta; const notes: string[] = [];
  const raised = new Map<string, number>();
  const endFrames = new Map<string, number>();
  for (const { tunnel, nodes } of tunnels.values()) {
    const n = tunnel.params.route.length;
    for (const [node, name] of [[0, 'start'], [n, 'end']] as const) {
      if (!nodes.has(node)) continue;
      const own = project.ports.find(p => p.owner === tunnel.id && p.name === name);
      const mate = own && mateOf(project, own.id);
      if (!mate) { if (own && name === 'end') endFrames.set(own.id, own.frame.z); continue; }
      const range = evaluation.portRanges.get(mate.id);
      const now = mate.raise ?? 0;
      raised.set(mate.id, now);
      if (!range) continue;
      const allowed = Math.min(range.max, Math.max(range.min, now + step)) - now;
      if (Math.abs(allowed) < Math.abs(step) - 1e-9) {
        step = Math.sign(step) === Math.sign(allowed) ? allowed : 0;
        const owner = project.instances.find(i => i.id === mate.owner);
        notes.push(`${owner?.name ?? mate.owner}'s ${owner?.kind === 'window' ? '' : `${mate.name} `}cat port can go no ${delta > 0 ? 'higher' : 'lower'} (${owner?.kind === 'window' ? 'the insert' : 'the enclosure'} allows ${cm(range.min)} to ${cm(range.max)} cm from its usual height: ${range.limits}).`);
      }
    }
  }
  if (Math.abs(step) < 0.5) return fail(project, ...(notes.length ? notes : ['Nothing to raise or lower.']));
  if (Math.abs(step - delta) > 1e-9) notes.push(`The selection ${delta > 0 ? 'rises' : 'falls'} ${Math.round(Math.abs(step))} mm, not ${Math.round(Math.abs(delta))} mm.`);
  let next: Project = {
    ...project,
    instances: project.instances.map(i => {
      const entry = tunnels.get(i.id); if (!entry || i.kind !== 'tunnel') return i;
      return { ...i, params: { ...i.params, route: i.params.route.map((e, index) => entry.nodes.has(index) ? { ...e, floor: e.floor + step } : e) } };
    }),
    ports: project.ports.map(p => raised.has(p.id) ? { ...p, raise: (raised.get(p.id) ?? 0) + step }
      : endFrames.has(p.id) ? { ...p, frame: { ...p.frame, z: p.frame.z + step } } : p),
  };
  // an enclosure at a tunnel's end follows where its elements now end
  const after = evaluateProject(next);
  const world = worldTransforms(project);
  const followed: string[] = [];
  for (const { tunnel } of tunnels.values()) {
    const before = evaluation.instances.find((e): e is EvaluatedTunnel => e.kind === 'tunnel' && e.id === tunnel.id)?.layout;
    const now = after.instances.find((e): e is EvaluatedTunnel => e.kind === 'tunnel' && e.id === tunnel.id)?.layout;
    const end = project.ports.find(p => p.owner === tunnel.id && p.name === 'end');
    const mate = end && mateOf(project, end.id);
    const owner = mate && next.instances.find(i => i.id === mate.owner);
    const tunnelWorld = world.get(tunnel.id);
    if (!before || !now || owner?.kind !== 'enclosure' || owner.parent !== null || !tunnelWorld || followed.includes(owner.id)) continue;
    const shift = applyTransform({ x: 0, y: 0, z: 0, yaw: tunnelWorld.yaw }, { x: now.E[0] - before.E[0], y: now.E[1] - before.E[1], z: 0 });
    if (Math.hypot(shift.x, shift.y) < 0.5) continue;
    followed.push(owner.id);
    next = replace(next, { ...owner, transform: { ...owner.transform, x: r3(owner.transform.x + shift.x), y: r3(owner.transform.y + shift.y) } });
    notes.push(`${owner.name ?? owner.id} moved ${Math.round(Math.hypot(shift.x, shift.y))} mm with the tunnel's end: its bends make ${tunnel.name ?? tunnel.id} ${now.totalLength > before.totalLength ? 'longer' : 'shorter'}, and the enclosure stays coupled.`);
  }
  if (followed.length) next = rerouted(next, followed, [...tunnels.keys()]);
  return noted(ok(project, next), notes);
}
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** What the planner calls a tunnel element: its tunnel's name and its place in the chain. */
export function elementTitle(project: Project, id: string): string | null {
  const found = routeElements(project).get(id);
  return found ? `${found.tunnel.name ?? found.tunnel.id} · ${routeElementName(found.index, found.element)}` : null;
}
