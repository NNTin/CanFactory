import { couplingBom, validateCoupling } from './catioCoupling.ts';
import { enclosureInside, enclosureLayout, enclosureSillRange, type EnclosureInside, type EnclosureLayout } from './catioEnclosure.ts';
import { MODULAR, MODULAR_DEFAULT, validateModular, type ModularConfig } from './catioModularDesign.ts';
import { platformLayout, type PlatformLayout } from './catioPlatform.ts';
import {
  applyTransform, composeTransform, isKind, relativeTransform, withoutKeys, worldTransforms, yawDirection,
  type EnclosureInstance, type Instance, type Port, type Project, type ProjectIssue, type ProjectSettings, type TunnelInstance, type Transform, type WindowParams,
} from './catioProject.ts';
import type { BomLine } from './catioSubassembly.ts';
import {
  facePoint, PORT_MOVED, routeElementName, routeOf, TUNNEL, tunnelBom, tunnelLayout, tunnelPitch, tunnelSiteFor, vec,
  type RouteElement, type TunnelConfig, type TunnelLayout, type TunnelSite,
} from './catioTunnel.ts';
import type { TunnelCouplingConfig } from './catioTunnelJoint.ts';
import { portRaiseRange, validateWindowInsert, windowInsertBom, windowInsertLayout, type WindowInsertConfig, type WindowInsertLayout } from './catioWindowInsert.ts';

/**
 * The evaluated project: every instance placed in the site, its layout from the catio's own builders, the checks and the parts list.
 * It reads the project and nothing else (no saved settings, no storage), and never throws: a design that cannot be built is
 * reported in `issues`, and stays an editable draft. The one source for the planner's scene, its checks and its build list.
 */
interface Evaluated<K extends Instance['kind']> { id: string; kind: K; parent: string | null; name: string; world: Transform }
export interface EvaluatedWindow extends Evaluated<'window'> { site: TunnelSite; insert: WindowInsertLayout; config: WindowInsertConfig }
export interface EvaluatedEnclosure extends Evaluated<'enclosure'> {
  layout: EnclosureLayout;
  /** The usable room inside, as well as the outside dimensions (`layout.size`). */
  inside: EnclosureInside;
  /** Its outline on the ground with its door swung fully open, in the site's frame. */
  footprint: [number, number][];
}
export interface EvaluatedTunnel extends Evaluated<'tunnel'> {
  /** The tunnel page's config for its ends (in its window's frame), or null when it has nothing to start from. */
  config: TunnelConfig | null; joint: TunnelCouplingConfig; layout: TunnelLayout | null;
  /** Whether its whole modules reach the port it couples to. */
  reaches: boolean;
  /** Its route's elements as laid out, in the chain's order. */
  elements: EvaluatedElement[];
}
/**
 * A tunnel's route element as laid out: its floor where it starts and where it ends (above the grass at the wall, in the tunnel's
 * frame), its slope (degrees, + up), its length (its sections'), and the pieces of the layout it is.
 */
export interface EvaluatedElement {
  id: string; tunnel: string; index: number; name: string; kind: RouteElement['kind']; modules: number;
  floor: [number, number]; slope: number; length: number; pieces: string[];
}
export interface EvaluatedPlatform extends Evaluated<'platform'> { layout: PlatformLayout | null }
export type EvaluatedInstance = EvaluatedWindow | EvaluatedEnclosure | EvaluatedTunnel | EvaluatedPlatform;
/** A port where it is: `local` in its owner's frame (what the document's port should hold), `world` in the site's. */
export interface EvaluatedPort { id: string; owner: string; name: string; state: Port['state']; size: number; local: Transform; world: Transform }
/** A parts-list line with the instances it is for. */
export interface ProjectBomLine extends BomLine { sources: string[] }

export interface ProjectEvaluation {
  instances: EvaluatedInstance[];
  ports: EvaluatedPort[];
  issues: ProjectIssue[];
  bom: ProjectBomLine[];
  /** What keeps the parts list from being a complete build: every error, every missing recipe and everything unverified. */
  unresolved: ProjectIssue[];
  /** How far each window's and enclosure's cat port can be raised or lowered (`Port.raise`), by port id. */
  portRanges: Map<string, PortRange>;
}
/** Where a cat port's `raise` can go: from `min` to `max`, and what stops it there. */
export interface PortRange { min: number; max: number; limits: string }

const RAD = Math.PI / 180;
/** The yaw a direction faces (0: +Y), in (−180°, 180°]. */
const yawOf = (n: readonly number[]) => { const a = Math.atan2(-(n[0] ?? 0), n[1] ?? 0) / RAD; return a <= -180 + 1e-9 ? 180 : a; };
const round = (t: Transform): Transform => ({ x: r6(t.x), y: r6(t.y), z: r6(t.z), yaw: r6(t.yaw) });
const r6 = (v: number) => Math.round(v * 1e6) / 1e6 || 0;
const mm = (v: number) => `${Math.round(v)} mm`;

export function evaluateProject(project: Project): ProjectEvaluation {
  const issues: ProjectIssue[] = [];
  const issue = (kind: ProjectIssue['kind'], severity: ProjectIssue['severity'], instanceIds: string[], code: string, message: string) => {
    issues.push({ id: `${kind}:${instanceIds.join('+')}:${code}`, kind, severity, instanceIds, message });
  };
  const bom: ProjectBomLine[] = [];
  const addBom = (sources: string[], lines: BomLine[]) => { for (const line of lines) bom.push({ ...line, sources }); };
  const guard = <T,>(ids: string[], what: string, f: () => T): T | null => {
    try { return f(); } catch (error) { issue('geometry', 'error', ids, `failed-${what}`, `The ${what} could not be laid out: ${(error as Error).message}`); return null; }
  };

  const s = project.settings;
  const world = worldTransforms(project);
  const byId = new Map(project.instances.map(i => [i.id, i]));
  const portsOf = (owner: string) => project.ports.filter(p => p.owner === owner);
  const portByName = (owner: string, name: string) => project.ports.find(p => p.owner === owner && p.name === name);
  const mateOf = (port: Port) => {
    const c = project.connections.find(k => k.ports.includes(port.id));
    const other = c?.ports.find(id => id !== port.id);
    return other ? project.ports.find(p => p.id === other) ?? null : null;
  };
  const insertConfig: WindowInsertConfig = { ...s.insert, mesh: s.mesh };
  const joint: TunnelCouplingConfig = { ...s.tunnelCoupling, jointShown: 'end-end' };
  const portRanges = new Map<string, PortRange>();
  const modular = (w: WindowParams | undefined, enclosure = MODULAR_DEFAULT.enclosure): ModularConfig => ({
    ...MODULAR_DEFAULT, ...w, enclosure, second: enclosure, secondEnabled: false, portClosure: s.portClosure, doorSeat: s.doorSeat,
  });
  const name = (i: Instance) => i.name ?? i.id;
  const local = new Map<string, Transform>();
  const evaluated: EvaluatedInstance[] = [];
  const base = <K extends Instance['kind']>(i: Instance & { kind: K }): Evaluated<K> => ({ id: i.id, kind: i.kind, parent: i.parent, name: name(i), world: world.get(i.id) ?? i.transform });

  // Windows: the insert in the window, its cat port where the tunnel starts.
  const windows = new Map<string, EvaluatedWindow>();
  for (const w of project.instances.filter(isKind('window'))) {
    const port = portByName(w.id, 'port');
    const result = guard([w.id], 'window insert', () => {
      const site = tunnelSiteFor(insertConfig, { ...modular(w.params), portRaise: port?.raise ?? 0 });
      return { site, insert: windowInsertLayout('modular', insertConfig, site.window) };
    });
    if (!result) continue;
    const e: EvaluatedWindow = { ...base(w), ...result, config: insertConfig };
    windows.set(w.id, e); evaluated.push(e);
    if (port) {
      const range = portRaiseRange(result.insert);
      portRanges.set(port.id, { ...range, limits: 'on the threshold at the lowest; at the highest the port, its transom and the docking frame reach the collar’s head rail' });
      const raise = port.raise ?? 0;
      if (raise < range.min - 0.5 || raise > range.max + 0.5) issue('geometry', 'error', [w.id], 'port-raise', `${name(w)}'s cat port is raised ${mm(raise)}; the insert allows ${mm(range.min)} to ${mm(range.max)} (${portRanges.get(port.id)?.limits ?? ''}).`);
    }
    if (port) local.set(port.id, { x: 0, y: TUNNEL.wallGap, z: result.site.floorZ, yaw: 0 });
    for (const message of new Set([...validateModular(modular(w.params)).filter(m => !m.startsWith('Enclosure')), ...validateWindowInsert('modular', insertConfig, result.site.window)]))
      issue('input', 'error', [w.id], `window-${message}`, message);
    addBom([w.id], windowInsertBom('modular', insertConfig, result.site.window));
  }

  // Enclosures: their layout, the room inside, and their ports.
  const enclosures = new Map<string, EvaluatedEnclosure>();
  const tunnelSizeOf = (e: EnclosureInstance) => {
    // the standard port's size is the window's, through whatever couples to it; the project's first window otherwise
    const w = [...windows.values()][0];
    return portsOf(e.id)[0]?.interface.size ?? w?.site.w ?? MODULAR_DEFAULT.tunnelSize;
  };
  for (const e of project.instances.filter(isKind('enclosure'))) {
    const tunnelSize = tunnelSizeOf(e);
    const connected = { rear: false, left: false, right: false };
    const sills: Partial<Record<'rear' | 'left' | 'right', number>> = {};
    const range = enclosureSillRange(e.params, tunnelSize, s.portClosure);
    for (const side of ['rear', 'left', 'right'] as const) {
      const port = portByName(e.id, side);
      connected[side] = port?.state === 'connected';
      if (!port) continue;
      sills[side] = MODULAR.sill + (port.raise ?? 0);
      portRanges.set(port.id, { min: range.min - MODULAR.sill, max: range.max - MODULAR.sill, limits: 'its frame above the sole rails at the lowest; at the highest below the top rails, with a ramp no steeper than its limit' });
      const sill = sills[side] ?? MODULAR.sill;
      if (sill < range.min - 0.5 || sill > range.max + 0.5) issue('geometry', 'error', [e.id], `port-raise-${side}`, `${name(e)}'s ${side} cat port stands ${mm(sill)} up; the enclosure allows ${mm(range.min)} to ${mm(range.max)}.`);
    }
    const layout = guard([e.id], 'enclosure', () => enclosureLayout(e.params, { id: e.id, tunnelSize, connected, sills }));
    if (!layout) continue;
    const t = world.get(e.id) ?? e.transform;
    const reach = e.params.depth + layout.door.width;
    const footprint = ([[-1, 0], [1, 0], [1, reach], [-1, reach]] as const).map(([sx, y]) => {
      const p = applyTransform(t, { x: sx * e.params.width / 2, y, z: 0 }); return [p.x, p.y] as [number, number];
    });
    const ev: EvaluatedEnclosure = { ...base(e), layout, inside: enclosureInside(layout), footprint };
    enclosures.set(e.id, ev); evaluated.push(ev);
    for (const p of layout.ports) {
      const port = portByName(e.id, p.side);
      if (port) local.set(port.id, { x: p.face.at[0], y: p.face.at[1], z: p.face.at[2], yaw: yawOf(p.face.n) });
    }
    const checks = validateModular(modular(project.instances.find(isKind('window'))?.params, e.params)).filter(m => m.startsWith('Enclosure A'));
    for (const message of checks) issue('input', 'error', [e.id], `enclosure-${message}`, message.replace('Enclosure A', name(e)));
    if (t.z < -0.5) issue('geometry', 'error', [e.id], 'below-ground', `${name(e)} stands ${mm(-t.z)} below the lawn.`);
    issue('missing-recipe', 'warning', [e.id], 'enclosure', `${name(e)} has no construction recipe yet: its frame, mesh, floor, roof, door, feet and fixings are not in the parts list.`);
  }

  // Tunnels: each solved by the tunnel page's own layout, from its window's port to the port its end couples to, in the window's frame.
  for (const t of project.instances.filter(isKind('tunnel'))) {
    const ev = evaluateTunnel(t);
    evaluated.push(ev);
  }
  function evaluateTunnel(t: TunnelInstance): EvaluatedTunnel {
    const result: EvaluatedTunnel = { ...base(t), config: null, joint, layout: null, reaches: false, elements: [] };
    const window = t.parent ? windows.get(t.parent) : undefined;
    if (!window) { issue('connection', 'error', [t.id], 'no-window', `${name(t)} has no window to start from.`); return result; }
    const tunnelWorld = result.world;
    const start = portByName(t.id, 'start'); const end = portByName(t.id, 'end');
    if (start) local.set(start.id, { x: 0, y: TUNNEL.wallGap, z: window.site.floorZ, yaw: 180 });
    // where its end is to couple: its mate's face, or (a free end) where the end was left
    const mate = end ? mateOf(end) : null;
    const mateWorld = mate ? portWorld(mate) : null;
    const target = mateWorld ? relativeTransform(tunnelWorld, mateWorld) : end ? end.frame : null;
    if (!target) { issue('connection', 'error', [t.id], 'no-end', `${name(t)} has no end port.`); return result; }
    const config = tunnelRoute(t, s, target, mateWorld !== null);
    result.config = config;
    const layout = guard([t.id], 'tunnel', () => tunnelLayout(config, window.site, joint, { elements: t.params.route, end: target.z }));
    if (!layout) return result;
    result.layout = layout;
    result.elements = evaluatedElements(t, layout, target.z);
    if (end && mate) {
      const psi = Math.atan2(layout.dE[0], layout.dE[1]) / RAD;
      local.set(end.id, { x: layout.E[0], y: layout.E[1], z: layout.E[2], yaw: -psi });
    }
    const ids = mate ? [t.id, mate.owner] : [t.id];
    const onElements = new Set(layout.routeIssues.map(i => i.message));
    for (const i of layout.routeIssues) issue('geometry', 'error', [t.id, ...i.elements], `tunnel-${i.message}`, i.message);
    for (const message of layout.errors.filter(m => !onElements.has(m))) issue('geometry', 'error', [t.id], `tunnel-${message}`, message);
    const pitch = tunnelPitch(window.site, joint);
    result.reaches = layout.moved <= PORT_MOVED && layout.facingMoved <= 0.5;
    if (!result.reaches) {
      const owner = mate ? byId.get(mate.owner) : undefined;
      issue('connection', 'error', ids, 'route', `${name(t)} cannot reach ${owner ? `${name(owner)}'s ${mate?.name} port` : 'its end'} in whole standard modules: they end ${mm(layout.moved)} from it${layout.facingMoved > 0.5 ? `, and it faces ${Math.round(layout.facingMoved)}° from a square turn` : ''}. Move it by whole modules (${mm(pitch)}), or detach the tunnel. The connection is kept.`);
    }
    if (end && !mate) issue('connection', 'error', [t.id], 'open-end', `${name(t)}'s far end is not coupled to a port: an open end is not a finished tunnel.`);
    if (start && mateOf(start)?.owner !== window.id) issue('connection', 'error', [t.id, window.id], 'start', `${name(t)} does not start at its window's cat port.`);
    const couplingSite = { tunnel: config, site: window.site, joint, layout };
    for (const message of validateCoupling('modular', s.insertCoupling, couplingSite)) issue('geometry', 'error', [window.id, t.id], `coupling-${message}`, message);
    addBom([t.id], tunnelBom('modular', config, window.site, joint, layout));
    addBom([window.id, t.id], couplingBom('modular', s.insertCoupling, couplingSite));
    return result;
  }
  function portWorld(port: Port): Transform | null {
    const owner = world.get(port.owner); if (!owner) return null;
    return composeTransform(owner, local.get(port.id) ?? port.frame);
  }

  // Platforms: placed in their enclosure, on its side frames.
  for (const p of project.instances.filter(isKind('platform'))) {
    const enclosure = p.parent ? enclosures.get(p.parent) : undefined;
    const ev: EvaluatedPlatform = { ...base(p), layout: null };
    evaluated.push(ev);
    if (!enclosure) { issue('connection', 'error', [p.id], 'no-enclosure', `${name(p)} is not in an enclosure.`); continue; }
    const attachments = project.attachments.filter(a => a.instance === p.id);
    const layout = guard([p.id], 'platform', () => platformLayout(p.params, p.transform, enclosure.layout, attachments, tunnelSizeOf(byId.get(enclosure.id) as EnclosureInstance)));
    if (!layout) continue;
    ev.layout = layout;
    for (const i of layout.issues) issue(i.kind, i.severity, [p.id, enclosure.id], `platform-${i.code}`, i.message.replace(/^The platform/, name(p)));
    addBom([p.id], layout.bom);
  }

  // Ports: every one somewhere; an opening neither coupled nor shut is no finished design.
  const ports: EvaluatedPort[] = project.ports.map(port => {
    const l = round(local.get(port.id) ?? port.frame);
    const owner = world.get(port.owner) ?? { x: 0, y: 0, z: 0, yaw: 0 };
    return { id: port.id, owner: port.owner, name: port.name, state: port.state, size: port.interface.size, local: l, world: round(composeTransform(owner, l)) };
  });
  for (const port of project.ports) {
    const owner = byId.get(port.owner);
    if (port.state === 'open' && owner?.kind !== 'tunnel') issue('connection', 'error', [port.owner], `open-${port.id}`, `${owner ? name(owner) : port.owner}'s ${port.name} port is open: couple it or shut it.`);
  }

  // The garden: everything on the site inside it, an enclosure with its door swung open, a tunnel with its flanges.
  const { width: gw, depth: gd } = project.garden;
  const outside = (points: [number, number][]) => points.some(([x, y]) => x < -0.5 || x > gw + 0.5 || y < -0.5 || y > gd + 0.5);
  for (const e of enclosures.values()) if (outside(e.footprint)) issue('geometry', 'error', [e.id], 'garden', `${e.name} is outside the garden, with its door swung open.`);
  for (const e of evaluated) {
    if (e.kind === 'window') {
      const half = e.site.window.openingWidth / 2;
      if (outside([-half, half].map(x => { const p = applyTransform(e.world, { x, y: 0, z: 0 }); return [p.x, p.y]; }))) issue('geometry', 'error', [e.id], 'garden', `${e.name} is outside the garden's rear wall.`);
    }
    if (e.kind === 'tunnel' && e.layout) {
      const lateral = e.layout.w / 2 + TUNNEL.flange.width;
      const points = e.layout.pieces.flatMap(p => [p.start, p.end]).flatMap(face => [-lateral, lateral].map(u => {
        const [x, y] = facePoint(face, u, 0); const q = applyTransform(e.world, { x, y, z: 0 }); return [q.x, q.y] as [number, number];
      }));
      if (outside(points)) issue('geometry', 'error', [e.id], 'garden', `${e.name} runs outside the garden.`);
    }
  }

  const unresolved = issues.filter(i => i.severity === 'error' || i.kind === 'missing-recipe' || i.kind === 'unverified');
  return { instances: evaluated, ports, issues, bom, unresolved, portRanges };
}

/** A tunnel's elements as `layout` lays them out, its route ending at the floor `end`. */
function evaluatedElements(t: TunnelInstance, layout: TunnelLayout, end: number): EvaluatedElement[] {
  const route = t.params.route;
  return route.map((e, index) => {
    const pieces = layout.pieces.filter(p => p.element === e.id);
    return {
      id: e.id, tunnel: t.id, index, name: routeElementName(index, e), kind: e.kind, modules: e.modules,
      floor: [index === 0 ? layout.S[2] : e.floor, route[index + 1]?.floor ?? end], slope: layout.elementSlopes.get(e.id) ?? 0,
      length: pieces.reduce((n, p) => n + p.length, 0), pieces: pieces.map(p => p.id),
    };
  });
}

/**
 * The tunnel page's config that solves a tunnel's route (in its window's frame): from its window's port to `target`, its end's face
 * in the tunnel's frame. The tunnel runs into a mate's face (`mated`) against the way that faces out; a free end's own face out is
 * the way the tunnel runs.
 */
export function tunnelRoute(t: Pick<TunnelInstance, 'params'>, s: ProjectSettings, target: Transform, mated: boolean): TunnelConfig {
  const [dx, dy] = mated ? yawDirection(target.yaw).map(v => -v) as [number, number] : yawDirection(target.yaw);
  return {
    ...withoutKeys(t.params, ['mode']), portX: r6(target.x), portY: r6(target.y), portFacing: r6(Math.atan2(dx, dy) / RAD), portLevel: 'own', portHeight: r6(target.z),
    angleJoint: 'side-port', mesh: s.mesh, supportFixing: s.tunnelCoupling.supportFixing, supportBase: s.tunnelCoupling.supportBase,
  };
}

/**
 * A tunnel's route solved again from its ends, as a chain of elements: the tunnel page's solver (`tunnelLayout` on `tunnelRoute`) runs
 * it level from its start port to `target` (its end's face in the tunnel's frame) in whole modules, and its sections become the
 * elements (`routeOf`). They keep the ids and floors of the route it had (`previous`), place by place, and the chain runs into the
 * target's floor. Where those floors make it slope, its bends take room: the last straight run along each way is then given whole
 * modules more or fewer, so that it still ends at the target. The one way a coupled tunnel follows what it couples to: a drag's
 * preview and the command that commits it both use it.
 */
export function solveRoute(t: Pick<TunnelInstance, 'id' | 'params'>, s: ProjectSettings, site: TunnelSite, target: Transform, mated: boolean): { route: RouteElement[]; config: TunnelConfig; layout: TunnelLayout } {
  const joint: TunnelCouplingConfig = { ...s.tunnelCoupling, jointShown: 'end-end' };
  const config = tunnelRoute(t, s, target, mated);
  const previous = t.params.route ?? [];
  const solved = tunnelLayout({ ...config, portHeight: site.floorZ }, site, joint);
  const taken = new Set(previous.map(e => e.id));
  let n = 0;
  const fresh = () => { let id: string; do id = `${t.id}-element-${++n}`; while (taken.has(id)); taken.add(id); return id; };
  const lastFloor = previous.at(-1)?.floor ?? site.floorZ;
  let route = routeOf(solved, i => previous[i]?.id ?? fresh()).map((e, i) => ({ ...e, floor: i === 0 ? site.floorZ : previous[i]?.floor ?? lastFloor }));
  const lay = (elements: RouteElement[]) => tunnelLayout(config, site, joint, { elements, end: target.z });
  let layout = lay(route);
  // the last run along each way decides where the route ends that way: give it whole modules more or fewer
  const segments: number[][] = [[]];
  route.forEach((e, i) => { if (e.kind === 'turn' && i > 0) segments.push([]); segments.at(-1)?.push(i); });
  const adjusted = new Set<string>();
  for (const segment of segments.slice().reverse()) {
    const first = route[segment[0] ?? 0]; const piece = layout.pieces.find(p => p.element === first?.id);
    if (!piece) continue;
    const way = [piece.frame.y[0], piece.frame.y[1]]; const key = `${Math.round(way[0] ?? 0)},${Math.round(way[1] ?? 0)}`;
    const opposite = `${-Math.round(way[0] ?? 0)},${-Math.round(way[1] ?? 0)}`;
    if (adjusted.has(key) || adjusted.has(opposite)) continue;
    adjusted.add(key);
    const off = vec.dot(vec.sub(layout.E, layout.asked), [way[0] ?? 0, way[1] ?? 0, 0]);
    const k = Math.round(off / layout.pitch);
    if (!k) continue;
    const straights = segment.filter(i => route[i]?.kind === 'straight');
    const at = straights.at(-1);
    if (at === undefined) continue;
    const template = route[at];
    if (!template) continue;
    if (k > 0) {
      const gone = new Set(straights.slice(-Math.min(k, straights.length - (segment.length === straights.length ? 1 : 0))));
      route = route.filter((_, i) => !gone.has(i));
    } else {
      const added = Array.from({ length: -k }, (): RouteElement => ({ id: fresh(), kind: 'straight', modules: template.modules, floor: template.floor }));
      route = [...route.slice(0, at + 1), ...added, ...route.slice(at + 1)];
    }
    layout = lay(route);
  }
  return { route, config, layout };
}

/** A tunnel re-solved for a drag's preview: its route's config, elements and layout, and whether its whole modules reach its mate. */
export interface TunnelPreview { id: string; config: TunnelConfig; route: RouteElement[]; layout: TunnelLayout | null; reaches: boolean }
/**
 * A drag's tunnels: with the instances in `moved` at those transforms (each in its parent's frame), every tunnel coupled to a port of
 * one of them (or of anything in them) re-solved, from `evaluation`, the project's before the drag. Nothing else is evaluated (no
 * checks, no parts list), so that a drag stays quick; committing it evaluates the whole project.
 */
export function previewTunnels(project: Project, evaluation: Pick<ProjectEvaluation, 'instances' | 'ports'>, moved: ReadonlyMap<string, Transform>): TunnelPreview[] {
  const instances = project.instances.map(i => { const t = moved.get(i.id); return t ? { ...i, transform: t } : i; });
  const byId = new Map(instances.map(i => [i.id, i]));
  const affected = (id: string | null): boolean => { const seen = new Set<string>(); for (let at = id; at && !seen.has(at); at = byId.get(at)?.parent ?? null) { if (moved.has(at)) return true; seen.add(at); } return false; };
  const world = worldTransforms({ instances });
  const ports = new Map(evaluation.ports.map(p => [p.id, p]));
  const previews: TunnelPreview[] = [];
  for (const t of instances.filter(isKind('tunnel'))) {
    const end = project.ports.find(p => p.owner === t.id && p.name === 'end');
    const connection = end && project.connections.find(c => c.ports.includes(end.id));
    const mate = ports.get(connection?.ports.find(id => id !== end?.id) ?? '');
    const window = evaluation.instances.find((e): e is EvaluatedWindow => e.kind === 'window' && e.id === t.parent);
    const tunnelWorld = world.get(t.id);
    if (!mate || !window || !tunnelWorld || !(affected(mate.owner) || affected(t.id))) continue;
    const ownerWorld = world.get(mate.owner); if (!ownerWorld) continue;
    const target = relativeTransform(tunnelWorld, composeTransform(ownerWorld, mate.local));
    try {
      const { route, config, layout } = solveRoute(t, project.settings, window.site, target, true);
      previews.push({ id: t.id, config, route, layout, reaches: layout.moved <= PORT_MOVED && layout.facingMoved <= 0.5 });
    } catch { /* an unsolvable route previews as not reaching */ }
  }
  return previews;
}

/**
 * Where an instance dragged to `to` stands so that the tunnels coupled to it reach it in whole standard modules: moved
 * on the ground by how far the first such tunnel's modules end from its port (FR-02.5: tunnel lengths snap to the module pitch,
 * not the garden grid). `to` itself when no tunnel couples to it, or none can be solved.
 */
export function snapToModules(project: Project, evaluation: Pick<ProjectEvaluation, 'instances' | 'ports'>, id: string, to: Transform): Transform {
  const preview = previewTunnels(project, evaluation, new Map([[id, to]])).find(p => p.layout);
  const tunnel = preview && project.instances.find(i => i.id === preview.id);
  if (!preview?.layout || !tunnel) return to;
  const { E, asked } = preview.layout;
  const world = worldTransforms(project);
  const parent = project.instances.find(i => i.id === id)?.parent;
  // the shift in the tunnel's frame, turned into the dragged instance's parent's
  const shift = applyTransform({ x: 0, y: 0, z: 0, yaw: (world.get(tunnel.id)?.yaw ?? 0) - (parent ? world.get(parent)?.yaw ?? 0 : 0) }, { x: E[0] - asked[0], y: E[1] - asked[1], z: 0 });
  return { ...to, x: r6(to.x + shift.x), y: r6(to.y + shift.y) };
}

/** The instances outside the garden (an enclosure with its door swung open): what a smaller garden would leave out. */
export function outsideGarden(evaluation: Pick<ProjectEvaluation, 'issues'>): string[] {
  return [...new Set(evaluation.issues.filter(i => i.id.endsWith(':garden')).flatMap(i => i.instanceIds))];
}

/** The project with every port's frame where its owner's layout puts it (a free tunnel end stays where it was left). */
export function syncPorts(project: Project, evaluation: Pick<ProjectEvaluation, 'ports'> = evaluateProject(project)): Project {
  const frames = new Map(evaluation.ports.map(p => [p.id, p.local]));
  return { ...project, ports: project.ports.map(p => ({ ...p, frame: frames.get(p.id) ?? p.frame })) };
}
