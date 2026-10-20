import { couplingBom, validateCoupling } from './catioCoupling.ts';
import { enclosureInside, enclosureLayout, enclosureSillRange, type EnclosureInside, type EnclosureLayout } from './catioEnclosure.ts';
import { MODULAR, MODULAR_DEFAULT, validateEnclosure, validateModular, type ModularConfig } from './catioModularDesign.ts';
import { platformLayout, type PlatformLayout } from './catioPlatform.ts';
import {
  applyTransform, composeTransform, isKind, relativeTransform, withoutKeys, worldTransforms, yawDirection,
  type EnclosureInstance, type Instance, type Port, type Project, type ProjectIssue, type ProjectSettings, type TunnelInstance, type Transform, type WindowParams,
} from './catioProject.ts';
import type { BomLine } from './catioSubassembly.ts';
import {
  facePoint, PORT_MOVED, routeElementName, routeOf, TUNNEL, tunnelBom, tunnelLayout, tunnelPitch, tunnelSiteFor, vec,
  type DescribedRoute, type RouteElement, type TunnelConfig, type TunnelLayout, type TunnelSite,
} from './catioTunnel.ts';
import { couplingGap, type TunnelCouplingConfig } from './catioTunnelJoint.ts';
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
  /** The tunnel page's config for its ends (in the tunnel's frame), or null when it has no end port. */
  config: TunnelConfig | null; joint: TunnelCouplingConfig; layout: TunnelLayout | null;
  /** What it is laid out on: the standard port's size, and its floor where it starts (the port it starts at). */
  site: TunnelSite;
  /** Whether its whole modules reach the port its end couples to (a free end has none to reach). */
  reaches: boolean;
  /** Its route's elements as laid out, in the chain's order. */
  elements: EvaluatedElement[];
  /** Its two ends: its own port, and the port and instance each is coupled to (null: free, an unfinished end). */
  ends: Record<'start' | 'end', TunnelEnd>;
}
export interface TunnelEnd { port: string | null; mate: string | null; owner: string | null }
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
  const modular = (w: WindowParams | undefined): ModularConfig => ({ ...MODULAR_DEFAULT, ...w, portClosure: s.portClosure, doorSeat: s.doorSeat });
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
    for (const message of new Set([...validateModular(modular(w.params)), ...validateWindowInsert('modular', insertConfig, result.site.window)]))
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
    for (const message of validateEnclosure(e.params, { tunnelSize, portClosure: s.portClosure, doorSeat: s.doorSeat }, name(e))) issue('input', 'error', [e.id], `enclosure-${message}`, message);
    if (t.z < -0.5) issue('geometry', 'error', [e.id], 'below-ground', `${name(e)} stands ${mm(-t.z)} below the lawn.`);
    issue('missing-recipe', 'warning', [e.id], 'enclosure', `${name(e)} has no construction recipe yet: its frame, mesh, floor, roof, door, feet and fixings are not in the parts list.`);
  }

  // Tunnels: each laid out by the tunnel page's own layout along its elements, in the frame of the port it starts at, to the port its
  // end couples to (or, a free end, where it was left).
  /** The standard port's site for a tunnel that starts at an enclosure: the project's first window's (its insert's seat, its size). */
  const standard = [...windows.values()][0]?.site ?? tunnelSiteFor(insertConfig, modular(undefined));
  for (const t of project.instances.filter(isKind('tunnel'))) {
    const ev = evaluateTunnel(t);
    evaluated.push(ev);
  }
  function evaluateTunnel(t: TunnelInstance): EvaluatedTunnel {
    const start = portByName(t.id, 'start'); const end = portByName(t.id, 'end');
    const startMate = start ? mateOf(start) : null; const mate = end ? mateOf(end) : null;
    const startOwner = startMate ? byId.get(startMate.owner) : undefined;
    const atWindow = startOwner?.kind === 'window' ? windows.get(startOwner.id) : undefined;
    const startFace = startMate && startOwner?.kind !== 'tunnel' ? portWorld(startMate) : null;
    const placed = tunnelPlacement(t, atWindow?.site ?? standard, joint, startFace && { face: startFace, window: !!atWindow });
    const endOf = (own: Port | undefined, other: Port | null): TunnelEnd => ({ port: own?.id ?? null, mate: other?.id ?? null, owner: other?.owner ?? null });
    const result: EvaluatedTunnel = {
      ...base(t), world: placed.world, config: null, joint, layout: null, site: placed.site, reaches: false, elements: [], ends: { start: endOf(start, startMate), end: endOf(end, mate) },
    };
    world.set(t.id, placed.world);
    if (start && placed.startLocal) local.set(start.id, placed.startLocal);
    for (const [own, other] of [[start, startMate], [end, mate]] as const) {
      if (other && byId.get(other.owner)?.kind === 'tunnel') issue('connection', 'error', [t.id, other.owner], `tunnel-mate-${own?.name}`, `${name(t)}'s ${own?.name} is coupled to another tunnel's end: a tunnel couples to a window's or an enclosure's cat port (joining tunnels comes with junctions).`);
    }
    // where its end is to couple: its mate's face, or (a free end) where the end was left
    const mateWorld = mate && byId.get(mate.owner)?.kind !== 'tunnel' ? portWorld(mate) : null;
    const target = mateWorld ? relativeTransform(placed.world, mateWorld) : end ? end.frame : null;
    if (!target) { issue('connection', 'error', [t.id], 'no-end', `${name(t)} has no end port.`); return result; }
    const config = tunnelRoute(t, s, target, mateWorld !== null);
    result.config = config;
    const route: DescribedRoute = { elements: t.params.route, end: target.z, ports: { start: !!startFace && !atWindow, end: !!mateWorld } };
    const layout = guard([t.id], 'tunnel', () => tunnelLayout(config, placed.site, joint, route));
    if (!layout) return result;
    result.layout = layout;
    result.elements = evaluatedElements(t, layout, target.z);
    // its end faces out the way it runs: into its mate's face, or (free) where its modules end
    if (end) local.set(end.id, { x: layout.E[0], y: layout.E[1], z: layout.E[2], yaw: -Math.atan2(layout.dE[0], layout.dE[1]) / RAD });
    const ids = mate ? [t.id, mate.owner] : [t.id];
    const onElements = new Set(layout.routeIssues.map(i => i.message));
    for (const i of layout.routeIssues) issue('geometry', 'error', [t.id, ...i.elements], `tunnel-${i.message}`, i.message);
    for (const message of layout.errors.filter(m => !onElements.has(m))) issue('geometry', 'error', [t.id], `tunnel-${message}`, message);
    const pitch = tunnelPitch(placed.site, joint);
    result.reaches = !mateWorld || (layout.moved <= PORT_MOVED && layout.facingMoved <= 0.5);
    if (!result.reaches) {
      const owner = mate ? byId.get(mate.owner) : undefined;
      issue('connection', 'error', ids, 'route', `${name(t)} cannot reach ${owner ? `${name(owner)}'s ${mate?.name} port` : 'its end'} in whole standard modules: they end ${mm(layout.moved)} from it${layout.facingMoved > 0.5 ? `, and it faces ${Math.round(layout.facingMoved)}° from a square turn` : ''}. Move it by whole modules (${mm(pitch)}), or detach the tunnel. The connection is kept.`);
    }
    // FR-04.11: a free end is an unfinished opening, never a finished tunnel
    if (end && !mate) issue('connection', 'error', [t.id], 'open-end', `${name(t)}'s far end is free: an unfinished end. Extend it to a free cat port and connect it there.`);
    if (start && !startMate) issue('connection', 'error', [t.id], 'open-start', `${name(t)}'s start is free: an unfinished end. Connect it to a free cat port.`);
    addBom([t.id], tunnelBom('modular', config, placed.site, joint, layout));
    if (atWindow && startOwner) {
      const couplingSite = { tunnel: config, site: atWindow.site, joint, layout };
      for (const message of validateCoupling('modular', s.insertCoupling, couplingSite)) issue('geometry', 'error', [startOwner.id, t.id], `coupling-${message}`, message);
      addBom([startOwner.id, t.id], couplingBom('modular', s.insertCoupling, couplingSite));
    }
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
 * How far behind its first flange a tunnel's start port's face is: a latched coupling's gap from an enclosure's port; none at a window
 * insert's port, which its own coupling joins it to.
 */
const startGap = (window: boolean, joint: Pick<TunnelCouplingConfig, 'mechanism'>) => window ? 0 : couplingGap(joint);
/**
 * A tunnel's frame in the site, from the face (in the site) of the port it starts at, a window's or not: on the lawn, +Y the way the
 * port faces out, its first flange where the tunnel page starts it (`TUNNEL.wallGap` out), across the coupling's gap from the port.
 */
export function tunnelFrame(face: Transform, window: boolean, joint: Pick<TunnelCouplingConfig, 'mechanism'>): Transform {
  const at = applyTransform({ ...face, z: 0 }, { x: 0, y: startGap(window, joint) - TUNNEL.wallGap, z: 0 });
  return round({ x: at.x, y: at.y, z: 0, yaw: face.yaw });
}
/**
 * Where a tunnel stands and what it is laid out on: coupled at its start (`start`, that port's face in the site), in that port's frame
 * (`tunnelFrame`) with its floor the port's; free, where it was left (its transform), with its first element's floor. `base` is the
 * site of the standard port it is made for. `startLocal` is its start port's face in its frame, when coupled.
 */
export function tunnelPlacement(t: Pick<TunnelInstance, 'transform' | 'params'>, base: TunnelSite, joint: Pick<TunnelCouplingConfig, 'mechanism'>, start: { face: Transform; window: boolean } | null) {
  if (!start) return { world: t.transform, site: { ...base, floorZ: t.params.route[0]?.floor ?? base.floorZ }, startLocal: null };
  const floor = r6(start.face.z);
  return { world: tunnelFrame(start.face, start.window, joint), site: { ...base, floorZ: floor }, startLocal: { x: 0, y: TUNNEL.wallGap - startGap(start.window, joint), z: floor, yaw: 180 } };
}

/**
 * The tunnel page's config that solves a tunnel's route (in its own frame): from its start port to `target`, its end's face
 * in the tunnel's frame. The tunnel runs into a mate's face (`mated`) against the way that faces out; a free end's own face out is
 * the way the tunnel runs.
 */
export function tunnelRoute(t: Pick<TunnelInstance, 'params'>, s: ProjectSettings, target: Transform, mated: boolean): TunnelConfig {
  const [dx, dy] = mated ? yawDirection(target.yaw).map(v => -v) as [number, number] : yawDirection(target.yaw);
  return {
    ...withoutKeys(t.params, ['mode', 'route']), portX: r6(target.x), portY: r6(target.y), portFacing: r6(Math.atan2(dx, dy) / RAD), portLevel: 'own', portHeight: r6(target.z),
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
export function solveRoute(t: Pick<TunnelInstance, 'id' | 'params'>, s: ProjectSettings, site: TunnelSite, target: Transform, mated: boolean, ports?: DescribedRoute['ports']): { route: RouteElement[]; config: TunnelConfig; layout: TunnelLayout } {
  const joint: TunnelCouplingConfig = { ...s.tunnelCoupling, jointShown: 'end-end' };
  const config = tunnelRoute(t, s, target, mated);
  const previous = t.params.route;
  const solved = tunnelLayout({ ...config, portHeight: site.floorZ }, site, joint);
  const taken = new Set(previous.map(e => e.id));
  let n = 0;
  const fresh = () => { let id: string; do id = `${t.id}-element-${++n}`; while (taken.has(id)); taken.add(id); return id; };
  const lastFloor = previous.at(-1)?.floor ?? site.floorZ;
  let route = routeOf(solved, i => previous[i]?.id ?? fresh()).map((e, i) => ({ ...e, floor: i === 0 ? site.floorZ : previous[i]?.floor ?? lastFloor }));
  const lay = (elements: RouteElement[]) => tunnelLayout(config, site, joint, { elements, end: target.z, ...(ports ? { ports } : {}) });
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

/**
 * A tunnel re-placed for a drag's preview: its frame in the site (`world`), its route's config, elements and layout, whether its whole
 * modules reach its mate, and which of its ends' ports moved (`follows`).
 */
export interface TunnelPreview {
  id: string; world: Transform; config: TunnelConfig | null; route: RouteElement[]; layout: TunnelLayout | null; reaches: boolean; follows: 'start' | 'end' | 'both';
}
/**
 * A drag's tunnels: with the instances in `moved` at those transforms (each in its parent's frame), every tunnel coupled to a port of
 * one of them (or of anything in them), from `evaluation`, the project's before the drag. A tunnel that starts there moves with that
 * port; one whose end is coupled is solved again to its mate (FR-04.10). Nothing else is evaluated (no checks, no parts list), so
 * that a drag stays quick; committing it evaluates the whole project.
 */
export function previewTunnels(project: Project, evaluation: Pick<ProjectEvaluation, 'instances' | 'ports'>, moved: ReadonlyMap<string, Transform>): TunnelPreview[] {
  const instances = project.instances.map(i => { const t = moved.get(i.id); return t ? { ...i, transform: t } : i; });
  const byId = new Map(instances.map(i => [i.id, i]));
  const affected = (id: string | null): boolean => { const seen = new Set<string>(); for (let at = id; at && !seen.has(at); at = byId.get(at)?.parent ?? null) { if (moved.has(at)) return true; seen.add(at); } return false; };
  const world = worldTransforms({ instances });
  const ports = new Map(evaluation.ports.map(p => [p.id, p]));
  const face = (id: string | null) => { const p = id ? ports.get(id) : undefined; const owner = p && world.get(p.owner); return p && owner ? composeTransform(owner, p.local) : null; };
  const previews: TunnelPreview[] = [];
  for (const e of evaluation.instances) {
    const t = e.kind === 'tunnel' ? byId.get(e.id) : undefined;
    if (e.kind !== 'tunnel' || t?.kind !== 'tunnel') continue;
    const [startOwner, endOwner] = [e.ends.start.owner, e.ends.end.owner];
    const [startMoved, endMoved] = [!!startOwner && affected(startOwner), !!endOwner && affected(endOwner)];
    if (!startMoved && !endMoved) continue;
    const follows = startMoved && endMoved ? 'both' : startMoved ? 'start' : 'end';
    const startFace = face(e.ends.start.mate);
    const at = startFace ? tunnelFrame(startFace, byId.get(startOwner ?? '')?.kind === 'window', e.joint) : e.world;
    const endFace = face(e.ends.end.mate);
    if (!endFace) { previews.push({ id: e.id, world: at, config: e.config, route: t.params.route, layout: e.layout, reaches: true, follows }); continue; }
    try {
      const { route, config, layout } = solveRoute(t, project.settings, e.site, relativeTransform(at, endFace), true, { start: !!startFace && byId.get(startOwner ?? '')?.kind !== 'window', end: true });
      previews.push({ id: e.id, world: at, config, route, layout, reaches: layout.moved <= PORT_MOVED && layout.facingMoved <= 0.5, follows });
    } catch { /* an unsolvable route previews as not reaching */ }
  }
  return previews;
}

/**
 * Where an instance dragged to `to` stands so that the tunnels coupled to it reach their ports in whole standard modules: moved on
 * the ground by how far the first such tunnel's modules end from its port (FR-02.5: tunnel lengths snap to the module pitch, not the
 * garden grid), the other way when the tunnel starts at it. `to` itself when no tunnel couples to it, or none can be solved.
 */
export function snapToModules(project: Project, evaluation: Pick<ProjectEvaluation, 'instances' | 'ports'>, id: string, to: Transform): Transform {
  const coupled = new Set(evaluation.instances.flatMap(e => e.kind === 'tunnel' && e.ends.end.mate ? [e.id] : []));
  const preview = previewTunnels(project, evaluation, new Map([[id, to]])).find(p => p.layout && p.follows !== 'both' && coupled.has(p.id));
  if (!preview?.layout) return to;
  const { E, asked } = preview.layout;
  const sign = preview.follows === 'start' ? -1 : 1;
  const world = worldTransforms(project);
  const parent = project.instances.find(i => i.id === id)?.parent;
  // the shift in the tunnel's frame, turned into the dragged instance's parent's
  const shift = applyTransform({ x: 0, y: 0, z: 0, yaw: preview.world.yaw - (parent ? world.get(parent)?.yaw ?? 0 : 0) }, { x: sign * (E[0] - asked[0]), y: sign * (E[1] - asked[1]), z: 0 });
  return { ...to, x: r6(to.x + shift.x), y: r6(to.y + shift.y) };
}

/** The instances outside the garden (an enclosure with its door swung open): what a smaller garden would leave out. */
export function outsideGarden(evaluation: Pick<ProjectEvaluation, 'issues'>): string[] {
  return [...new Set(evaluation.issues.filter(i => i.id.endsWith(':garden')).flatMap(i => i.instanceIds))];
}

/**
 * The project with every port's frame where its owner's layout puts it (a free tunnel end where its modules end), and every tunnel
 * in the frame of the port it starts at (`tunnelFrame`; one with a free start stays where it was left).
 */
export function syncFrames(project: Project, evaluation: Pick<ProjectEvaluation, 'ports' | 'instances'> = evaluateProject(project)): Project {
  const frames = new Map(evaluation.ports.map(p => [p.id, p.local]));
  const tunnels = new Map(evaluation.instances.flatMap(e => e.kind === 'tunnel' ? [[e.id, e.world] as const] : []));
  return {
    ...project,
    instances: project.instances.map(i => { const t = tunnels.get(i.id); return t && JSON.stringify(t) !== JSON.stringify(i.transform) ? { ...i, transform: t } : i; }),
    ports: project.ports.map(p => ({ ...p, frame: frames.get(p.id) ?? p.frame })),
  };
}
