import {
  addEnclosure, addTunnel, CATIO_SUBASSEMBLIES, connect, createProject, DEFAULT_TUNNEL_MODULES, detach, DOOR_SEAT_DEFAULT, DOOR_SEATS, evaluateProject,
  extendTunnel, isPortClosure, moveInstance, parseCoupling, parseTunnel, parseTunnelCoupling, parseWindowInsert, projectErrors, rotateInstance,
  SETTINGS_DEFAULT, syncFrames, turnTunnel, withoutKeys, type CatioSubassembly, type CommandResult, type DoorSeat, type EnclosureParams, type PortClosure,
  type Project, type ProjectSettings, type TunnelConfig, type WindowParams,
} from '@canfactory/catio';

/**
 * The one-time import of a catio saved by the old concept page (FR-08.5, #116): its whole-catio settings (`canfactory.catio.v1`,
 * versions 1–3, written by its Direct and Modular modes) and the sub-assembly pages' own saves (`canfactory.catio.<id>.v1`) become a
 * new planner project. It runs only when the owner asks for it, reads those keys and never writes or removes them: the old saves
 * stay as they were. This module is the only code that reads `canfactory.catio.v1`; nothing keeps it alive as a second source.
 */
export const LEGACY_CATIO_KEY = 'canfactory.catio.v1';
const pageKey = (id: CatioSubassembly) => `canfactory.catio.${id}.v1`;
/** What every design saved before the cat ports' closure could be chosen has: the mechanism it was drawn with. */
const LEGACY_CLOSURE: PortClosure = 'sliding-gate';

/** The old page's whole-catio design, as its settings versions 1–3 hold it, brought to version 3. */
interface LegacyDesign {
  mode: 'direct' | 'modular';
  window: WindowParams; portClosure: PortClosure; doorSeat: DoorSeat;
  route: 'straight' | 'left' | 'right'; approach: number; lateral: number; final: number; link: number;
  enclosure: EnclosureParams; second: EnclosureParams | null;
}
export interface LegacySaves {
  /** The whole catio's settings, or null when there are none; `unreadable` when they are there but not a catio this reads. */
  catio: LegacyDesign | null | 'unreadable';
  /** Each sub-assembly page's own save, its config read by that page's parse; absent when it has none. */
  pages: Partial<Record<CatioSubassembly, { config: unknown; ownSave: boolean; beforeClosure: boolean }>>;
}
export type LegacyImport = { kind: 'none' } | { kind: 'failed'; errors: string[] } | { kind: 'imported'; project: Project; notes: string[] };

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const size = (value: unknown): EnclosureParams | null =>
  record(value) && finite(value['width']) && finite(value['depth']) && finite(value['height']) ? { width: value['width'], depth: value['depth'], height: value['height'] } : null;

/**
 * The old page's settings, any version, as a design; null when they are none of its versions or not complete. Version 1 had no
 * closure (every cat port a sliding gate); up to version 2 the tunnel's clear width and height could differ, and the standard port
 * takes the larger, so that the cats' opening never shrinks; a design saved before the doors' seat could be chosen has stop strips.
 */
export function legacyDesign(value: unknown): LegacyDesign | null {
  if (!record(value) || ![1, 2, 3].includes(value['version'] as number) || !record(value['config'])) return null;
  const c = value['config'];
  const sizes = [c['tunnelSize'], c['tunnelWidth'], c['tunnelHeight']].filter(finite);
  const tunnelSize = finite(c['tunnelSize']) ? c['tunnelSize'] : sizes.length ? Math.max(...sizes) : NaN;
  const window = { glassWidth: c['glassWidth'], glassHeight: c['glassHeight'], sashWidth: c['sashWidth'], sashHeight: c['sashHeight'], tunnelSize };
  const enclosure = size(c['enclosure']);
  const route = c['route'];
  const modules = ['approach', 'lateral', 'final', 'link'].map(key => c[key]);
  if (!Object.values(window).every(finite) || !enclosure || (route !== 'straight' && route !== 'left' && route !== 'right')
    || !modules.every(n => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 6)) return null;
  const closure = value['version'] === 1 ? LEGACY_CLOSURE : c['portClosure'];
  const seat = c['doorSeat'] ?? DOOR_SEAT_DEFAULT;
  if (!isPortClosure(closure) || !DOOR_SEATS.includes(seat as DoorSeat)) return null;
  const [approach = 1, lateral = 1, final = 1, link = 1] = modules as number[];
  return {
    mode: value['mode'] === 'direct' ? 'direct' : 'modular', window: window as WindowParams, portClosure: closure, doorSeat: seat as DoorSeat,
    route, approach, lateral, final, link, enclosure, second: c['secondEnabled'] === true ? size(c['second']) : null,
  };
}

/** Reads the old saves from `storage`: only reads, never writes. */
export function readLegacySaves(storage: Pick<Storage, 'getItem'>): LegacySaves {
  const parse = (key: string): unknown => { try { return JSON.parse(storage.getItem(key) ?? 'null'); } catch { return undefined; } };
  const raw = parse(LEGACY_CATIO_KEY);
  const catio = raw === null ? null : legacyDesign(raw) ?? 'unreadable';
  const pages: LegacySaves['pages'] = {};
  for (const id of CATIO_SUBASSEMBLIES) {
    const saved = parse(pageKey(id));
    if (!record(saved) || saved['version'] !== 1) continue;
    // a page's own save names its variant; since the closure could be chosen it also says whether its door is shown open
    const ownSave = typeof saved['variant'] === 'string';
    const views = record(saved['views']) ? Object.values(saved['views']).filter(record) : [];
    pages[id] = { config: saved['config'], ownSave, beforeClosure: ownSave && !views.some(view => typeof view['doorOpen'] === 'boolean') };
  }
  return { catio, pages };
}

/** The tunnel page's settings a planner tunnel holds of its own: its feet and how steep it may climb (its route is the project's). */
const TUNNEL_OWN = ['maxSlope', 'footPad', 'padHeight', 'padSurface', 'footDiameter', 'groundFall', 'groundTolerance'] as const satisfies readonly (keyof TunnelConfig)[];

/** Runs a command of the planner, as the import's own step: its refusal ends the import. */
function step(result: CommandResult): Project {
  if (result.errors.length) throw new Error(result.errors.join(' '));
  return result.project;
}

/**
 * A new planner project from the old saves, or `none` when there are none, or why they could not be imported. The design's window,
 * enclosures and route are laid out with the planner's own commands, so the project is one the planner made: the tunnel from the
 * window runs the saved modules (turning twice at side ports for an offset route) into enclosure A's rear port, and a second
 * enclosure stands at the end of the link from A's right-hand port. The sub-assembly pages' saves give the project's insert,
 * couplings, mesh and the tunnels' feet. The garden is grown, never shrunk, to take it all.
 */
function legacyProject(saves: LegacySaves): LegacyImport {
  const pages = saves.pages;
  if (saves.catio === null && !Object.values(pages).some(page => page.ownSave)) return { kind: 'none' };
  if (saves.catio === 'unreadable') return { kind: 'failed', errors: ['The saved catio settings are not of a version this import reads, or are incomplete.'] };
  const notes: string[] = [];
  const design = saves.catio;
  // with no whole-catio settings, a page saved before the closure could be chosen kept its sliding gates
  const legacyClosure = !design && Object.values(pages).some(page => page.beforeClosure);
  /** Whether a page's save chose a setting (its mesh, by default): a save without it has the page's default, not a choice. */
  const savedKey = (id: 'window-insert' | 'tunnel', key: string) => { const config = pages[id]?.config; return record(config) && key in config; };
  const saved = (id: 'window-insert' | 'tunnel') => savedKey(id, 'mesh');
  const insert = parseWindowInsert(pages['window-insert']?.config) ?? null;
  const tunnel = parseTunnel(pages.tunnel?.config) ?? null;
  const settings: ProjectSettings = {
    ...SETTINGS_DEFAULT,
    insert: insert ? withoutKeys(insert, ['mesh']) : SETTINGS_DEFAULT.insert,
    insertCoupling: parseCoupling(pages['insert-tunnel-coupling']?.config) ?? SETTINGS_DEFAULT.insertCoupling,
    // how the tunnel was held on its supports was the tunnel page's setting, which the coupling page showed and wrote back there
    tunnelCoupling: {
      ...withoutKeys(parseTunnelCoupling(pages['tunnel-tunnel-coupling']?.config) ?? { ...SETTINGS_DEFAULT.tunnelCoupling, jointShown: 'end-end' }, ['jointShown']),
      ...Object.fromEntries((['supportFixing', 'supportBase'] as const).flatMap(key => tunnel && savedKey('tunnel', key) ? [[key, tunnel[key]]] : [])),
    },
    mesh: (saved('window-insert') ? insert?.mesh : undefined) ?? (saved('tunnel') ? tunnel?.mesh : undefined) ?? SETTINGS_DEFAULT.mesh,
    portClosure: design?.portClosure ?? (legacyClosure ? LEGACY_CLOSURE : SETTINGS_DEFAULT.portClosure),
    doorSeat: design?.doorSeat ?? SETTINGS_DEFAULT.doorSeat,
  };
  if (saved('window-insert') && saved('tunnel') && insert?.mesh !== tunnel?.mesh) notes.push(`The window insert and the tunnel were meshed differently; the project takes the window insert's mesh for the whole catio.`);
  if (legacyClosure) notes.push('A sub-assembly page was saved before the cat ports’ closure could be chosen: it keeps the sliding gates it was drawn with.');
  if (design?.mode === 'direct') notes.push('The old page showed the direct design, on the window without a tunnel. The planner builds a catio with a tunnel: the modular design’s sizes are imported.');

  try {
    let p = createProject({ id: 'imported-catio', name: 'My existing catio', settings, ...(design ? { window: design.window, enclosure: design.enclosure } : {}) });
    if (tunnel) p = { ...p, instances: p.instances.map(i => i.kind === 'tunnel' ? { ...i, params: { ...i.params, ...Object.fromEntries(TUNNEL_OWN.map(k => [k, tunnel[k]])) } } : i) };
    if (design) {
      // the route the old page laid out: approach modules, then for an offset two side-port turns round the lateral run
      p = step(detach(p, 'connection-2'));
      const end = 'tunnel-1-end';
      if (design.approach !== DEFAULT_TUNNEL_MODULES) p = step(extendTunnel(p, end, design.approach - DEFAULT_TUNNEL_MODULES));
      if (design.route !== 'straight') {
        const [out, back] = design.route === 'right' ? ['right', 'left'] as const : ['left', 'right'] as const;
        p = step(turnTunnel(p, end, out)); p = step(extendTunnel(p, end, design.lateral));
        p = step(turnTunnel(p, end, back)); p = step(extendTunnel(p, end, design.final));
      }
      p = placeOnEnd(p, 'enclosure-1', 'rear', end);
      if (design.second) {
        const added = addEnclosure(p, { x: 0, y: 0 }, design.second); p = step(added);
        const link = addTunnel(p, 'enclosure-1-right', design.link); p = step(link);
        if (!added.id || !link.id) throw new Error('The second enclosure could not be added.');
        p = placeOnEnd(p, added.id, 'left', `${link.id}-end`);
      }
    }
    p = fitGarden(p);
    const errors = projectErrors(p);
    if (errors.length) return { kind: 'failed', errors };
    const imported = Object.entries(pages).filter(([, page]) => page.ownSave).map(([id]) => id.replaceAll('-', ' '));
    if (imported.length) notes.push(`Also imported: the settings saved on the ${[imported.slice(0, -1).join(', '), imported.at(-1)].filter(Boolean).join(' and ')} ${imported.length > 1 ? 'pages' : 'page'}.`);
    return { kind: 'imported', project: p, notes };
  } catch (error) {
    return { kind: 'failed', errors: [`The saved catio could not be laid out in the planner: ${(error as Error).message}`] };
  }
}

/** `p` with the free enclosure `id` turned so that its port `side` faces the tunnel end `end`, moved onto it and coupled there. */
function placeOnEnd(p: Project, id: string, side: string, end: string): Project {
  const port = p.ports.find(q => q.owner === id && q.name === side);
  const free = evaluateProject(p).ports.find(q => q.id === end)?.world;
  if (!port || !free) throw new Error(`There is no ${side} port or tunnel end to couple.`);
  let next = step(rotateInstance(p, id, ((free.yaw + 180 - port.frame.yaw) % 360 + 360) % 360));
  const face = evaluateProject(next).ports.find(q => q.id === port.id)?.world;
  const at = next.instances.find(i => i.id === id)?.transform;
  if (!face || !at) throw new Error(`${id} has no ${side} port.`);
  next = step(moveInstance(next, id, { x: at.x + free.x - face.x, y: at.y + free.y - face.y }));
  return step(connect(next, end, port.id));
}

/** `p` in a garden large enough for it, with half a metre round it: everything shifted along the wall to stand inside. */
function fitGarden(p: Project): Project {
  const MARGIN = 500;
  const evaluation = evaluateProject(p);
  const points = [
    ...evaluation.instances.flatMap(e => e.kind === 'enclosure' ? e.footprint : []),
    ...evaluation.ports.map(q => [q.world.x, q.world.y] as [number, number]),
  ];
  const xs = points.map(([x]) => x); const ys = points.map(([, y]) => y);
  const [minX, maxX, maxY] = [Math.min(...xs), Math.max(...xs), Math.max(...ys)];
  const up = (n: number) => Math.ceil(n / 100) * 100;
  const width = Math.max(p.garden.width, up(maxX - minX + 2 * MARGIN));
  const depth = Math.max(p.garden.depth, up(maxY + MARGIN));
  const dx = Math.round((width - minX - maxX) / 2);
  const instances = p.instances.map(i => i.parent === null ? { ...i, transform: { ...i.transform, x: i.transform.x + dx } } : i);
  return syncFrames({ ...p, garden: { width, depth }, instances });
}

/** The import the planner's "Import my existing catio" runs: the old saves in this browser, read now. */
export const importLegacyCatio = (storage: Pick<Storage, 'getItem'>): LegacyImport => legacyProject(readLegacySaves(storage));

