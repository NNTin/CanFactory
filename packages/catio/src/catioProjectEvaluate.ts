import { couplingBom, validateCoupling } from './catioCoupling.ts';
import { enclosureInside, enclosureLayout, type EnclosureInside, type EnclosureLayout } from './catioEnclosure.ts';
import { MODULAR_DEFAULT, validateModular, type ModularConfig } from './catioModularDesign.ts';
import { platformLayout, type PlatformLayout } from './catioPlatform.ts';
import {
  applyTransform, composeTransform, isKind, relativeTransform, withoutKeys, worldTransforms, yawDirection,
  type EnclosureInstance, type Instance, type Port, type Project, type ProjectIssue, type TunnelInstance, type Transform, type WindowParams,
} from './catioProject.ts';
import type { BomLine } from './catioSubassembly.ts';
import { facePoint, PORT_MOVED, TUNNEL, tunnelBom, tunnelLayout, tunnelPitch, tunnelSiteFor, type TunnelConfig, type TunnelLayout, type TunnelSite } from './catioTunnel.ts';
import type { TunnelCouplingConfig } from './catioTunnelJoint.ts';
import { validateWindowInsert, windowInsertBom, windowInsertLayout, type WindowInsertConfig, type WindowInsertLayout } from './catioWindowInsert.ts';

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
  /** The tunnel page's config this route solves (in its window's frame), or null when it has nothing to start from. */
  config: TunnelConfig | null; joint: TunnelCouplingConfig; layout: TunnelLayout | null;
  /** Whether its whole modules reach the port it couples to. */
  reaches: boolean;
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
}

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
    const result = guard([w.id], 'window insert', () => {
      const site = tunnelSiteFor(insertConfig, modular(w.params));
      return { site, insert: windowInsertLayout('modular', insertConfig, site.window) };
    });
    if (!result) continue;
    const e: EvaluatedWindow = { ...base(w), ...result, config: insertConfig };
    windows.set(w.id, e); evaluated.push(e);
    const port = portByName(w.id, 'port');
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
    for (const side of ['rear', 'left', 'right'] as const) connected[side] = portByName(e.id, side)?.state === 'connected';
    const layout = guard([e.id], 'enclosure', () => enclosureLayout(e.params, { id: e.id, tunnelSize, connected }));
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
    const result: EvaluatedTunnel = { ...base(t), config: null, joint, layout: null, reaches: false };
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
    // the tunnel runs into a mate's face against the way it faces out; a free end's own face out is the way the tunnel runs
    const [dx, dy] = mateWorld ? yawDirection(target.yaw).map(v => -v) as [number, number] : yawDirection(target.yaw);
    const own = withoutKeys(t.params, ['mode']);
    const config: TunnelConfig = {
      ...own, portX: r6(target.x), portY: r6(target.y), portFacing: r6(Math.atan2(dx, dy) / RAD), portLevel: 'own', portHeight: r6(target.z),
      angleJoint: 'side-port', mesh: s.mesh, supportFixing: s.tunnelCoupling.supportFixing, supportBase: s.tunnelCoupling.supportBase,
    };
    result.config = config;
    const layout = guard([t.id], 'tunnel', () => tunnelLayout(config, window.site, joint));
    if (!layout) return result;
    result.layout = layout;
    if (end && mate) {
      const psi = Math.atan2(layout.dE[0], layout.dE[1]) / RAD;
      local.set(end.id, { x: layout.E[0], y: layout.E[1], z: layout.E[2], yaw: -psi });
    }
    const ids = mate ? [t.id, mate.owner] : [t.id];
    for (const message of layout.errors) issue('geometry', 'error', [t.id], `tunnel-${message}`, message);
    const pitch = tunnelPitch(window.site, joint);
    result.reaches = layout.moved <= PORT_MOVED && layout.facingMoved <= 0.5;
    if (!result.reaches) {
      const owner = mate ? byId.get(mate.owner) : undefined;
      issue('connection', 'error', ids, 'route', `${name(t)} cannot reach ${owner ? `${name(owner)}'s ${mate?.name} port` : 'its end'} in whole standard modules: they end ${mm(layout.moved)} from it${layout.facingMoved > 0.5 ? `, and it faces ${Math.round(layout.facingMoved)}° from a square turn` : ''}. Move it by whole modules (${mm(pitch)}), or detach the tunnel. The connection is kept.`);
    }
    if (end && !mate) issue('connection', 'error', [t.id], 'open-end', `${name(t)}'s far end is not coupled to a port: an open end is not a finished tunnel.`);
    if (start && mateOf(start)?.owner !== window.id) issue('connection', 'error', [t.id, window.id], 'start', `${name(t)} does not start at its window's cat port.`);
    const couplingSite = { tunnel: config, site: window.site, joint };
    for (const message of validateCoupling('modular', s.insertCoupling, couplingSite)) issue('geometry', 'error', [window.id, t.id], `coupling-${message}`, message);
    addBom([t.id], tunnelBom('modular', config, window.site, joint));
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
  return { instances: evaluated, ports, issues, bom, unresolved };
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
