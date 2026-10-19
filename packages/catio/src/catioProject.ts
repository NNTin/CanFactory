import { Type, type Static, type TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { CATIO_MESH_DEFAULT, CATIO_MESHES, type CatioMesh } from '@canfactory/contracts';
import { COUPLING_CONTROLS, COUPLING_DEFAULT, type CouplingConfig } from './catioCoupling.ts';
import { DOOR_SEAT_DEFAULT, DOOR_SEATS, PORT_CLOSURE_DEFAULT, PORT_CLOSURES, type DoorSeat, type PortClosure } from './catioDoor.ts';
import { MODULAR_DEFAULT } from './catioModularDesign.ts';
import { inRange, type SubassemblyControl } from './catioSubassembly.ts';
import { TUNNEL_CONTROLS, TUNNEL_DEFAULT, type RouteElement, type TunnelConfig } from './catioTunnel.ts';
import { TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DEFAULT, type TunnelCouplingConfig } from './catioTunnelJoint.ts';
import { WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT, type WindowInsertConfig } from './catioWindowInsert.ts';

/**
 * The catio planner's project: one versioned JSON document that holds the whole design (#109). Millimetres and degrees throughout.
 *
 * The site's frame: X along the rear garden boundary from its left corner (seen from the garden), Y from the rear boundary (the
 * house wall, Y = 0) into the garden, Z up from the lawn. Every instance stands in its parent's frame (the site's when it has
 * none) at `transform`: moved by x, y, z, then turned by `yaw` degrees anticlockwise about Z, seen from above. A window's frame is
 * X along the wall, +Y out into the garden. An enclosure's is its layout's (catioEnclosure.ts): X across its width from its middle, Y
 * from its rear face to its front, where the maintenance door is. A tunnel stands on the site in the frame of the port it starts at
 * (catioTunnel.ts's, on the lawn: `tunnelFrame`), +Y the way it runs out of that port.
 *
 * The document holds only what the owner chose: instances, the ports between them and their mates, attachments to structural
 * members, and project-level settings. Everything derived (layouts, checks, the parts list) is evaluated from it
 * (`evaluateProject`). How it is viewed is kept apart from the physical design, in `view`.
 *
 * Later kinds (junctions, more interior items) and custom-cut tunnels add instance kinds and params: an instance's `kind` is any
 * string and its `params` an open record, checked per kind, so the document's shape and version stay the same.
 *
 * Version 2 (#126) describes each tunnel's route as a chain of elements (`TunnelParams.route`) and lets a cat port be raised or
 * lowered (`Port.raise`). Version 3 (#127) runs a tunnel between any two ports, a window's or an enclosure's: it is no longer in a
 * window but on the site, each of its ends coupled or free. `parseProject` (catioProjectMigrate.ts) reads versions 1 and 2 too, and
 * migrates them.
 */
export const PROJECT_SCHEMA_VERSION = 3;

/** The instance kinds this version builds; a document with another is reported, not dropped. */
export const INSTANCE_KINDS = ['window', 'enclosure', 'tunnel', 'platform'] as const;
export type InstanceKind = typeof INSTANCE_KINDS[number];

const Id = Type.String({ minLength: 1, maxLength: 120 });
/** A length that must be positive. JSON has no NaN or Infinity, and a TypeBox number rejects both. */
const Size = Type.Number({ exclusiveMinimum: 0 });

export const TransformSchema = Type.Object({ x: Type.Number(), y: Type.Number(), z: Type.Number(), yaw: Type.Number() }, { additionalProperties: false });
export type Transform = Static<typeof TransformSchema>;
export const PointSchema = Type.Object({ x: Type.Number(), y: Type.Number(), z: Type.Number() }, { additionalProperties: false });
export type Point3 = Static<typeof PointSchema>;

/** The window, site context: the existing window's sizes and the cat port's clear size. */
export const WindowParamsSchema = Type.Object({ glassWidth: Size, glassHeight: Size, sashWidth: Size, sashHeight: Size, tunnelSize: Size }, { additionalProperties: false });
export type WindowParams = Static<typeof WindowParamsSchema>;
/** An enclosure's outside dimensions. */
export const EnclosureParamsSchema = Type.Object({ width: Size, depth: Size, height: Size }, { additionalProperties: false });
export type EnclosureParams = Static<typeof EnclosureParamsSchema>;
/**
 * A platform's board: `width` along its own X, `depth` along its Y, `thickness`. Its elevation (the board's top above the enclosure's
 * ground) and yaw are its transform's z and yaw, in its enclosure's frame.
 */
export const PlatformParamsSchema = Type.Object({ width: Size, depth: Size, thickness: Size }, { additionalProperties: false });
export type PlatformParams = Static<typeof PlatformParamsSchema>;

/**
 * The tunnel's own choices: those of the tunnel page (`TunnelConfig`) that are not its route's ends. Where it starts and ends follows
 * from the ports its ends couple to, and its mesh and support fixing are project settings. `mode` is how its runs are
 * made: whole standard modules (the only mode yet; custom cuts come later, as another mode). `route` is its chain of elements from
 * its start port (catioTunnel.ts `RouteElement`): each a whole number of modules, a straight run or a side-port turn, with its own id
 * (selectable, unique in the project) and its floor's height where it starts, in the tunnel's frame. The chain runs into its end
 * port's floor (a free end's own, where it was left); neighbours at different heights slope between them.
 */
export const TUNNEL_ROUTE_KEYS = ['portX', 'portY', 'portFacing', 'portLevel', 'portHeight', 'angleJoint', 'mesh', 'supportFixing', 'supportBase'] as const;
export type TunnelOwnSettings = Omit<TunnelConfig, typeof TUNNEL_ROUTE_KEYS[number]>;
export type TunnelParams = { mode: 'standard'; route: RouteElement[] } & TunnelOwnSettings;
const Modules = Type.Integer({ minimum: 1, maximum: 100 });
export const RouteElementSchema = Type.Union([
  Type.Object({ id: Id, kind: Type.Literal('straight'), modules: Modules, floor: Type.Number() }, { additionalProperties: false }),
  Type.Object({ id: Id, kind: Type.Literal('turn'), turn: Type.Union([Type.Literal(90), Type.Literal(-90)]), modules: Modules, floor: Type.Number() }, { additionalProperties: false }),
]);
export const TunnelParamsSchema = Type.Object({ mode: Type.Literal('standard'), route: Type.Array(RouteElementSchema, { minItems: 1 }) }, { additionalProperties: true });
/** The keys of a tunnel's params that are not tunnel-page settings. */
const TUNNEL_OWN_KEYS = ['mode', 'route'] as const;

const InstanceBase = <K extends InstanceKind, P extends TSchema>(kind: K, params: P) => Type.Object({
  id: Id, kind: Type.Literal(kind), name: Type.Optional(Type.String({ maxLength: 200 })),
  /** The instance it stands on or in, or null for the site. */
  parent: Type.Union([Id, Type.Null()]),
  transform: TransformSchema, params,
  /** Material choices by role, e.g. a platform's `sheet`. */
  material: Type.Record(Type.String(), Type.String()),
}, { additionalProperties: false });
export const WindowInstanceSchema = InstanceBase('window', WindowParamsSchema);
export const EnclosureInstanceSchema = InstanceBase('enclosure', EnclosureParamsSchema);
export const TunnelInstanceSchema = InstanceBase('tunnel', TunnelParamsSchema);
export const PlatformInstanceSchema = InstanceBase('platform', PlatformParamsSchema);
export type WindowInstance = Static<typeof WindowInstanceSchema>;
export type EnclosureInstance = Static<typeof EnclosureInstanceSchema>;
export type TunnelInstance = Omit<Static<typeof TunnelInstanceSchema>, 'params'> & { params: TunnelParams };
/** Every tunnel's route elements by id, with the tunnel and their place in its chain. */
export function routeElements(project: Pick<Project, 'instances'>): Map<string, { tunnel: TunnelInstance; index: number; element: RouteElement }> {
  const found = new Map<string, { tunnel: TunnelInstance; index: number; element: RouteElement }>();
  for (const tunnel of project.instances.filter(isKind('tunnel'))) tunnel.params.route.forEach((element, index) => found.set(element.id, { tunnel, index, element }));
  return found;
}
export type PlatformInstance = Static<typeof PlatformInstanceSchema>;
export type Instance = WindowInstance | EnclosureInstance | TunnelInstance | PlatformInstance;
/** The document's shape of every instance, whatever its kind: what a reader checks before it checks the kind's params. */
export const AnyInstanceSchema = Type.Object({
  id: Id, kind: Type.String({ minLength: 1 }), name: Type.Optional(Type.String({ maxLength: 200 })), parent: Type.Union([Id, Type.Null()]),
  transform: TransformSchema, params: Type.Record(Type.String(), Type.Unknown()), material: Type.Record(Type.String(), Type.String()),
}, { additionalProperties: false });

/**
 * A port: an opening of `owner` where another instance couples on. `name` is the owner's port (a window's `port`, a tunnel's `start`
 * and `end`, an enclosure's `rear`, `left` and `right`); `frame` is its face in the owner's frame, its yaw the way the opening faces
 * out (0: +Y). `open` is a free tunnel end, not yet finished; `closed` is a window's or an enclosure's port shut by its closure;
 * `connected` is coupled to its one mate.
 * `raise` is how far a window's or an enclosure's cat port stands above (or, negative, below) where its owner puts it by default: a
 * window insert's port on the threshold, an enclosure's at `MODULAR.sill`. It is moved with the tunnel element coupled to it (#126).
 */
export const PortSchema = Type.Object({
  id: Id, owner: Id, name: Type.String({ minLength: 1 }), frame: TransformSchema, raise: Type.Optional(Type.Number()),
  interface: Type.Object({ kind: Type.Literal('standard-port'), size: Size }, { additionalProperties: false }),
  state: Type.Union([Type.Literal('open'), Type.Literal('closed'), Type.Literal('connected')]),
}, { additionalProperties: false });
export type Port = Static<typeof PortSchema>;
/** Two ports coupled together. A port has at most one mate; a branch is a junction with several ports. */
export const ConnectionSchema = Type.Object({ id: Id, ports: Type.Tuple([Id, Id]) }, { additionalProperties: false });
export type Connection = Static<typeof ConnectionSchema>;
/**
 * An instance fixed to a structural member of another: `support.member` names the member in that instance's layout (an enclosure's
 * `side-left` or `side-right` frame, or a platform's `frame-rear` or `frame-front` cross bearer on them: catioPlatform.ts), `anchor`
 * is the point that bears on it, in the attached instance's own frame.
 */
export const AttachmentSchema = Type.Object({
  id: Id, instance: Id, support: Type.Object({ instance: Id, member: Type.String({ minLength: 1 }) }, { additionalProperties: false }), anchor: PointSchema,
}, { additionalProperties: false });
export type Attachment = Static<typeof AttachmentSchema>;
/** How the project is looked at: never part of the physical design, the checks or the parts list. */
export const ViewSchema = Type.Object({ selection: Type.Array(Id), hidden: Type.Array(Id), camera: Type.Union([Type.String(), Type.Null()]) }, { additionalProperties: false });
export type ProjectView = Static<typeof ViewSchema>;
/** What a view can name: the instances, their tunnels' route elements, and the ports (a selected port is where a tunnel starts). */
type Viewable = { instances: readonly { id: string; kind: string; params: unknown }[]; ports?: readonly { id: string }[] };
const viewable = (project: Viewable) => new Set([
  ...project.instances.flatMap(i => [i.id, ...(i.kind === 'tunnel' ? routeOf(i.params).map(e => e.id) : [])]), ...(project.ports ?? []).map(p => p.id),
]);
const routeOf = (params: unknown): { id: string }[] => {
  const route = (params as { route?: unknown } | null)?.route;
  return Array.isArray(route) ? route.filter((e): e is { id: string } => typeof (e as { id?: unknown } | null)?.id === 'string') : [];
};
/** `view` with only the instances, route elements and ports `project` has: what a view kept across a change to the instances still names. */
export function keepView(view: ProjectView, project: Viewable): ProjectView {
  const ids = viewable(project);
  return { ...view, selection: view.selection.filter(id => ids.has(id)), hidden: view.hidden.filter(id => ids.has(id)) };
}

/**
 * The sub-assemblies' settings, held by the project (PoC: copies starting from each page's defaults; #117 makes the project their
 * one source). The mesh, the cat ports' closure and the doors' seat are the whole catio's. The insert's own mesh is the project's,
 * and the tunnel coupling page's `jointShown` is only that page's view, so neither is held here.
 */
export type InsertSettings = Omit<WindowInsertConfig, 'mesh'>;
export type TunnelCouplingSettings = Omit<TunnelCouplingConfig, 'jointShown'>;
export interface ProjectSettings {
  insert: InsertSettings; insertCoupling: CouplingConfig; tunnelCoupling: TunnelCouplingSettings;
  mesh: CatioMesh; portClosure: PortClosure; doorSeat: DoorSeat;
}
export const SettingsSchema = Type.Object({
  insert: Type.Record(Type.String(), Type.Unknown()), insertCoupling: Type.Record(Type.String(), Type.Unknown()), tunnelCoupling: Type.Record(Type.String(), Type.Unknown()),
  mesh: Type.Union(CATIO_MESHES.map(m => Type.Literal(m))), portClosure: Type.Union(PORT_CLOSURES.map(c => Type.Literal(c))), doorSeat: Type.Union(DOOR_SEATS.map(s => Type.Literal(s))),
}, { additionalProperties: false });

export const ProjectSchema = Type.Object({
  id: Id, schemaVersion: Type.Literal(PROJECT_SCHEMA_VERSION), name: Type.String({ maxLength: 200 }), units: Type.Literal('mm'),
  /** Counts committed edits, so that an export can name the revision it shows. */
  revision: Type.Integer({ minimum: 0 }),
  garden: Type.Object({ width: Size, depth: Size }, { additionalProperties: false }),
  settings: SettingsSchema,
  instances: Type.Array(AnyInstanceSchema), ports: Type.Array(PortSchema), connections: Type.Array(ConnectionSchema), attachments: Type.Array(AttachmentSchema),
  view: ViewSchema,
}, { additionalProperties: false });
export interface Project extends Omit<Static<typeof ProjectSchema>, 'settings' | 'instances'> { settings: ProjectSettings; instances: Instance[] }

/** A copy of `value` without `keys`. */
export const withoutKeys = <T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !(keys as readonly PropertyKey[]).includes(key))) as Omit<T, K>;
export const SETTINGS_DEFAULT: ProjectSettings = {
  insert: withoutKeys(WINDOW_INSERT_DEFAULT, ['mesh']), insertCoupling: COUPLING_DEFAULT, tunnelCoupling: withoutKeys(TUNNEL_COUPLING_DEFAULT, ['jointShown']),
  mesh: CATIO_MESH_DEFAULT, portClosure: PORT_CLOSURE_DEFAULT, doorSeat: DOOR_SEAT_DEFAULT,
};
/** A new project's window. */
export const WINDOW_PARAMS_DEFAULT: WindowParams = {
  glassWidth: MODULAR_DEFAULT.glassWidth, glassHeight: MODULAR_DEFAULT.glassHeight, sashWidth: MODULAR_DEFAULT.sashWidth, sashHeight: MODULAR_DEFAULT.sashHeight, tunnelSize: MODULAR_DEFAULT.tunnelSize,
};
/** The tunnel page's defaults, its sections one module each: a tunnel's params but its route. */
export const TUNNEL_PARAMS_DEFAULT: Omit<TunnelParams, 'route'> = { mode: 'standard', ...withoutKeys(TUNNEL_DEFAULT, TUNNEL_ROUTE_KEYS), sectionLength: 1 };

// The controls that check each setting: a value is accepted when a control for its key offers it.
const TUNNEL_SETTING_CONTROLS = [...TUNNEL_COUPLING_CONTROLS, ...TUNNEL_CONTROLS] as SubassemblyControl<object>[];
const accepted = (controls: SubassemblyControl<object>[], key: string, value: unknown) => controls.some(control => control.key === key
  && (control.range ? inRange(control.range, value) : control.options.some(option => option.value === value)));
/** Every key of `defaults` present with a value its control offers, and no other key. */
function checkControlled(path: string, raw: Record<string, unknown>, defaults: object, controls: SubassemblyControl<object>[]): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(defaults)) {
    if (!(key in raw)) errors.push(`${path}.${key} is missing.`);
    else if (!accepted(controls, key, raw[key])) errors.push(`${path}.${key} has an unsupported value (${JSON.stringify(raw[key])}).`);
  }
  for (const key of Object.keys(raw)) if (!(key in defaults)) errors.push(`${path}.${key} is not a setting of this version.`);
  return errors;
}

const PARAMS_SCHEMA = { window: WindowParamsSchema, enclosure: EnclosureParamsSchema, tunnel: TunnelParamsSchema, platform: PlatformParamsSchema } as const;
/** The parent each kind stands in: the site, or an instance of one of these kinds. */
export const PARENT_KINDS: Record<InstanceKind, (InstanceKind | null)[]> = { window: [null], enclosure: [null], tunnel: [null], platform: ['enclosure'] };

function schemaErrors(path: string, schema: TSchema, value: unknown): string[] {
  // a union reports every branch it tried, and an extra property its false schema too; their summaries are enough
  return [...Value.Errors(schema, value)].filter(e => !e.schemaPath.includes('/anyOf/') && e.keyword !== 'boolean')
    .slice(0, 20).map(e => `${path}${e.instancePath || ''}: ${e.message}${e.keyword === 'additionalProperties' ? ` (${(e.params as { additionalProperties?: string[] }).additionalProperties?.join(', ') ?? ''})` : ''}.`);
}

/**
 * Everything wrong with a project document that `parseProject` would refuse: its shape, its version, every number finite, every id
 * unique, every reference resolved (parents, port owners, connection ports, attachments, the view), each kind's params and the
 * settings. Empty for a sound document. It checks the document only; whether its design can be built is `evaluateProject`'s.
 */
export function projectErrors(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return ['A project is a JSON object.'];
  const record = raw as Record<string, unknown>;
  const version = record['schemaVersion'];
  if (version === undefined) return ['The file has no schemaVersion: it is not a catio planner project.'];
  if (typeof version !== 'number' || !Number.isInteger(version)) return [`schemaVersion ${JSON.stringify(version)} is not a version number.`];
  if (version > PROJECT_SCHEMA_VERSION) return [`The project was saved by a newer planner (schema version ${version}); this one reads version ${PROJECT_SCHEMA_VERSION}.`];
  if (version !== PROJECT_SCHEMA_VERSION) return [`Schema version ${version} is not supported here; this planner reads version ${PROJECT_SCHEMA_VERSION}${version >= 1 ? ` (opening a file migrates version ${version})` : ''}.`];
  if (!Value.Check(ProjectSchema, raw)) return schemaErrors('project', ProjectSchema, raw);
  const p = raw;
  const errors: string[] = [];

  const ids = new Set<string>();
  const elements = p.instances.flatMap(i => i.kind === 'tunnel' ? routeOf(i.params) : []);
  for (const { id } of [...p.instances, ...elements, ...p.ports, ...p.connections, ...p.attachments]) {
    if (ids.has(id)) errors.push(`The id ${id} is used more than once.`); ids.add(id);
  }
  const instances = new Map(p.instances.map(i => [i.id, i]));
  for (const i of p.instances) {
    if (!(INSTANCE_KINDS as readonly string[]).includes(i.kind)) { errors.push(`Instance ${i.id} is a ${i.kind}, which this planner does not support.`); continue; }
    const kind = i.kind as InstanceKind;
    const schema = PARAMS_SCHEMA[kind];
    if (!Value.Check(schema, i.params)) errors.push(...schemaErrors(`${i.id}.params`, schema, i.params));
    else if (kind === 'tunnel') errors.push(...checkControlled(`${i.id}.params`, withoutKeys(i.params as Record<string, unknown>, TUNNEL_OWN_KEYS), withoutKeys(TUNNEL_PARAMS_DEFAULT, ['mode']), TUNNEL_CONTROLS as SubassemblyControl<object>[]));
    const parent = i.parent === null ? null : instances.get(i.parent);
    if (i.parent !== null && !parent) errors.push(`Instance ${i.id}'s parent ${i.parent} does not exist.`);
    else if (!PARENT_KINDS[kind].includes((parent?.kind ?? null) as InstanceKind | null)) errors.push(`A ${kind} cannot stand ${parent ? `in a ${parent.kind}` : 'on the site'} (${i.id}).`);
  }
  // a parent chain must end at the site
  for (const i of p.instances) {
    const seen = new Set<string>(); let at: typeof i | undefined = i;
    while (at?.parent && !seen.has(at.id)) { seen.add(at.id); at = instances.get(at.parent); }
    if (at && seen.has(at.id)) { errors.push(`Instance ${i.id}'s parents form a loop.`); break; }
  }
  const ports = new Map(p.ports.map(q => [q.id, q]));
  for (const q of p.ports) {
    if (!instances.has(q.owner)) errors.push(`Port ${q.id}'s owner ${q.owner} does not exist.`);
    if (p.ports.some(o => o !== q && o.owner === q.owner && o.name === q.name)) errors.push(`Instance ${q.owner} has two ports named ${q.name}.`);
  }
  const mated = new Map<string, string>();
  for (const c of p.connections) {
    const [a, b] = c.ports;
    if (a === b) errors.push(`Connection ${c.id} couples port ${a} to itself.`);
    for (const id of c.ports) {
      const q = ports.get(id);
      if (!q) { errors.push(`Connection ${c.id}'s port ${id} does not exist.`); continue; }
      if (mated.has(id)) errors.push(`Port ${id} has more than one mate (${mated.get(id)} and ${c.id}).`); else mated.set(id, c.id);
      if (q.state !== 'connected') errors.push(`Port ${id} is coupled by ${c.id} but is marked ${q.state}.`);
    }
    const [qa, qb] = [ports.get(a), ports.get(b)];
    if (qa && qb && qa.owner === qb.owner) errors.push(`Connection ${c.id} couples two ports of ${qa.owner}.`);
    if (qa && qb && Math.abs(qa.interface.size - qb.interface.size) > 1e-6) errors.push(`Connection ${c.id} couples ports of different sizes (${qa.interface.size} and ${qb.interface.size} mm).`);
  }
  for (const q of p.ports) if (q.state === 'connected' && !mated.has(q.id)) errors.push(`Port ${q.id} is marked connected but has no mate.`);
  for (const a of p.attachments) {
    const attached = instances.get(a.instance); const support = instances.get(a.support.instance);
    if (!attached) errors.push(`Attachment ${a.id}'s instance ${a.instance} does not exist.`);
    if (!support) errors.push(`Attachment ${a.id}'s support ${a.support.instance} does not exist.`);
    if (attached && support && attached.parent !== support.id) errors.push(`Attachment ${a.id} fixes ${attached.id} to ${support.id}, which it does not stand in.`);
  }
  const named = viewable(p);
  for (const [list, name] of [[p.view.selection, 'selection'], [p.view.hidden, 'hidden list']] as const) {
    for (const id of list) if (!named.has(id)) errors.push(`The view's ${name} names ${id}, which does not exist.`);
  }
  const s = p.settings;
  errors.push(...checkControlled('settings.insert', s.insert, SETTINGS_DEFAULT.insert, WINDOW_INSERT_CONTROLS as SubassemblyControl<object>[]));
  errors.push(...checkControlled('settings.insertCoupling', s.insertCoupling, SETTINGS_DEFAULT.insertCoupling, COUPLING_CONTROLS as SubassemblyControl<object>[]));
  errors.push(...checkControlled('settings.tunnelCoupling', s.tunnelCoupling, SETTINGS_DEFAULT.tunnelCoupling, TUNNEL_SETTING_CONTROLS));
  return errors;
}

export const serializeProject = (project: Project): string => JSON.stringify(project, null, 2);

// Transforms
const RAD = Math.PI / 180;
/** A point of a frame placed at `t`, in the frame `t` is given in. */
export function applyTransform(t: Transform, p: Point3): Point3 {
  const c = Math.cos(t.yaw * RAD); const s = Math.sin(t.yaw * RAD);
  return { x: t.x + c * p.x - s * p.y, y: t.y + s * p.x + c * p.y, z: t.z + p.z };
}
/** A point given in the frame `t` is given in, in the frame placed at `t`. */
export function invertTransform(t: Transform, p: Point3): Point3 {
  const c = Math.cos(t.yaw * RAD); const s = Math.sin(t.yaw * RAD); const dx = p.x - t.x; const dy = p.y - t.y;
  return { x: c * dx + s * dy, y: -s * dx + c * dy, z: p.z - t.z };
}
/** A child's frame (`local`, in its parent's) in the frame its parent is placed in (`parent`). */
export function composeTransform(parent: Transform, local: Transform): Transform {
  return { ...applyTransform(parent, local), yaw: parent.yaw + local.yaw };
}
/** A frame given in the frame `t` is given in, in the frame placed at `t`. */
export function relativeTransform(t: Transform, frame: Transform): Transform {
  return { ...invertTransform(t, frame), yaw: frame.yaw - t.yaw };
}
/** The direction a yaw faces, its yaw 0 facing +Y. */
export const yawDirection = (yaw: number): [number, number] => [-Math.sin(yaw * RAD), Math.cos(yaw * RAD)];

/** Each instance's frame in the site's: its own composed with its parents'. An instance in a missing or looping parent stands on the site. */
export function worldTransforms(project: Pick<Project, 'instances'>): Map<string, Transform> {
  const byId = new Map(project.instances.map(i => [i.id, i]));
  const world = new Map<string, Transform>();
  const resolve = (id: string, seen: Set<string>): Transform => {
    const known = world.get(id); if (known) return known;
    const i = byId.get(id); if (!i) return { x: 0, y: 0, z: 0, yaw: 0 };
    const parent = i.parent && byId.has(i.parent) && !seen.has(i.parent) ? resolve(i.parent, new Set([...seen, id])) : null;
    const t = parent ? composeTransform(parent, i.transform) : { ...i.transform };
    world.set(id, t); return t;
  };
  for (const i of project.instances) resolve(i.id, new Set());
  return world;
}

export const isKind = <K extends InstanceKind>(kind: K) => (i: Instance): i is Extract<Instance, { kind: K }> => i.kind === kind;

export const ISSUE_KINDS = ['input', 'geometry', 'connection', 'missing-recipe', 'unverified'] as const;
/**
 * A problem with the design, on the instances it concerns: a number that cannot be used (`input`), something that does not fit
 * (`geometry`), a port or route that does not join (`connection`), something without a construction recipe yet (`missing-recipe`),
 * or a physical property nobody has verified (`unverified`). An `error` withholds a complete build; a design with errors stays
 * editable and saveable as a draft.
 */
export interface ProjectIssue {
  /** Stable while the problem lasts, e.g. to keep it selected in a list. */
  id: string;
  kind: typeof ISSUE_KINDS[number]; severity: 'error' | 'warning' | 'info'; instanceIds: string[]; message: string;
}
