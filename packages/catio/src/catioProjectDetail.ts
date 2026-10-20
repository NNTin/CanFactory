import { COUPLING_CONTROLS, type CouplingConfig, type CouplingSite } from './catioCoupling.ts';
import type { Instance, Project } from './catioProject.ts';
import type { EvaluatedTunnel, EvaluatedWindow, ProjectEvaluation } from './catioProjectEvaluate.ts';
import type { CatioSubassembly, SubassemblyControl } from './catioSubassembly.ts';
import { TUNNEL_CONTROLS, type TunnelConfig, type TunnelLayout, type TunnelSite } from './catioTunnel.ts';
import type { TunnelCouplingSite } from './catioTunnelCoupling.ts';
import { TUNNEL_COUPLING_CONTROLS, type TunnelCouplingConfig } from './catioTunnelJoint.ts';
import { WINDOW_INSERT_CONTROLS, type WindowInsertConfig, type WindowSpec } from './catioWindowInsert.ts';

/**
 * The sub-assemblies of a project's instances (#117): what a sub-assembly's detail view shows of one instance, fitted to the rest of
 * the project as it is. The project is the one source of every construction choice: a view reads its sub-assembly's config here
 * (`windowInsertSubject` and the others) and changes it with `configureSubassembly` (catioProjectCommands.ts), an edit of the
 * project like any other, so that the planner and every view show the same design and one undo takes the edit back.
 *
 * Where each choice is held: the insert's (`settings.insert`), the insert–tunnel coupling's (`settings.insertCoupling`) and the
 * tunnel–tunnel coupling's (`settings.tunnelCoupling`, with how every tunnel is held on its supports) are the whole catio's, as are
 * its mesh and the cat ports' closure and door seat: one standard port and one module pitch, so that any element couples to any other.
 * A tunnel's own settings (its sections' length, its feet, its ground, its steepest slope) are its params.
 */
export const SUBASSEMBLY_OWNERS: Record<CatioSubassembly, 'window' | 'tunnel'> = {
  'window-insert': 'window', 'insert-tunnel-coupling': 'window', tunnel: 'tunnel', 'tunnel-tunnel-coupling': 'tunnel',
};

/** The tunnel's settings that a project tunnel's route sets (its ends from its ports, its turns at side ports), not edited on their own. */
const ROUTE_SET: readonly string[] = ['portX', 'portY', 'portFacing', 'portLevel', 'portHeight', 'approach', 'final', 'slopeLeg', 'angleJoint'];

/**
 * The settings each sub-assembly's view and the planner's inspector edit, as controls: the insert's with tunnel, the tunnel's but
 * those its route sets, and the couplings'. Which joint the tunnel–tunnel coupling's view shows is that view's own, not the project's.
 */
export const SUBASSEMBLY_CONTROLS: { [K in CatioSubassembly]: SubassemblyControl<SubassemblyConfigs[K]>[] } = {
  'window-insert': WINDOW_INSERT_CONTROLS.filter(c => !c.variants || c.variants.includes('modular')),
  'insert-tunnel-coupling': COUPLING_CONTROLS,
  tunnel: TUNNEL_CONTROLS.filter(c => !ROUTE_SET.includes(c.key)),
  'tunnel-tunnel-coupling': TUNNEL_COUPLING_CONTROLS.filter(c => c.key !== 'jointShown'),
};
export interface SubassemblyConfigs {
  'window-insert': WindowInsertConfig; 'insert-tunnel-coupling': CouplingConfig; tunnel: TunnelConfig; 'tunnel-tunnel-coupling': TunnelCouplingConfig;
}

/** A sub-assembly of one instance: its config as the project holds it, and what it is fitted to (`site`). */
export interface Subject<C, S> { instance: string; config: C; site: S }
/** Why an instance has no such sub-assembly to show, e.g. a window with no tunnel at its cat port. */
export interface NoSubject { instance: string | null; problem: string }
export type SubjectOf<C, S> = Subject<C, S> | NoSubject;
export const hasSubject = <C, S>(s: SubjectOf<C, S>): s is Subject<C, S> => 'config' in s;

/** A tunnel as its view shows it: laid out along its project route, from the port it starts at. */
export interface TunnelSubjectSite {
  site: TunnelSite; joint: TunnelCouplingConfig; layout: TunnelLayout;
  /** The insert–tunnel coupling at its start, when it starts at a window's cat port; null at an enclosure's or a free start. */
  coupling: CouplingConfig | null;
}

/** The instances a sub-assembly's view can show: the project's windows, or its tunnels, in the document's order. */
export function subassemblyInstances(project: Pick<Project, 'instances'>, id: CatioSubassembly): Instance[] {
  return project.instances.filter(i => i.kind === SUBASSEMBLY_OWNERS[id]);
}

const nameOf = (project: Project, id: string) => project.instances.find(i => i.id === id)?.name ?? id;
/** The evaluated instance a view shows: `instance`, or the first one of its kind when none is named. */
function pick<K extends 'window' | 'tunnel'>(project: Project, evaluation: Pick<ProjectEvaluation, 'instances'>, kind: K, instance: string | null):
  (K extends 'window' ? EvaluatedWindow : EvaluatedTunnel) | NoSubject {
  const id = instance ?? project.instances.find(i => i.kind === kind)?.id ?? null;
  const known = id === null ? undefined : project.instances.find(i => i.id === id);
  if (!id || !known) return { instance: null, problem: instance ? `The project has no ${instance}.` : `The project has no ${kind}: add one in the planner.` };
  if (known.kind !== kind) return { instance: null, problem: `${nameOf(project, id)} is a ${known.kind}, not a ${kind}.` };
  const evaluated = evaluation.instances.find(e => e.id === id);
  if (!evaluated || evaluated.kind !== kind) return { instance: id, problem: `${nameOf(project, id)} could not be laid out: see its problems in the planner.` };
  return evaluated as K extends 'window' ? EvaluatedWindow : EvaluatedTunnel;
}
const failed = (e: object): e is NoSubject => 'problem' in e;

/** A window's insert, in that window, as the project sets it. */
export function windowInsertSubject(project: Project, evaluation: Pick<ProjectEvaluation, 'instances'>, instance: string | null): SubjectOf<WindowInsertConfig, WindowSpec> {
  const w = pick(project, evaluation, 'window', instance);
  return failed(w) ? w : { instance: w.id, config: w.config, site: w.site.window };
}

/** The tunnel that starts at a window's cat port, evaluated: the one the insert–tunnel coupling joins to it. */
function tunnelAt(project: Project, evaluation: Pick<ProjectEvaluation, 'instances'>, window: string): EvaluatedTunnel | undefined {
  const port = project.ports.find(p => p.owner === window && p.name === 'port');
  return evaluation.instances.find((e): e is EvaluatedTunnel => e.kind === 'tunnel' && !!port && e.ends.start.mate === port.id);
}

/** A window's insert–tunnel coupling: its docking frame on the insert, and the first section of the tunnel that starts there. */
export function insertCouplingSubject(project: Project, evaluation: Pick<ProjectEvaluation, 'instances'>, instance: string | null): SubjectOf<CouplingConfig, CouplingSite> {
  const w = pick(project, evaluation, 'window', instance);
  if (failed(w)) return w;
  const t = tunnelAt(project, evaluation, w.id);
  if (!t?.config || !t.layout) return { instance: w.id, problem: `No tunnel starts at ${w.name}'s cat port${t ? ' that can be laid out' : ''}: draw one from it in the planner.` };
  return { instance: w.id, config: project.settings.insertCoupling, site: { tunnel: t.config, site: w.site, joint: t.joint, layout: t.layout } };
}

/** A tunnel laid out along its route in the project, from the port it starts at. */
export function tunnelSubject(project: Project, evaluation: Pick<ProjectEvaluation, 'instances'>, instance: string | null): SubjectOf<TunnelConfig, TunnelSubjectSite> {
  const t = pick(project, evaluation, 'tunnel', instance);
  if (failed(t)) return t;
  if (!t.config || !t.layout) return { instance: t.id, problem: `${t.name} could not be laid out: see its problems in the planner.` };
  const atWindow = t.ends.start.owner !== null && project.instances.find(i => i.id === t.ends.start.owner)?.kind === 'window';
  return { instance: t.id, config: t.config, site: { site: t.site, joint: t.joint, layout: t.layout, coupling: atWindow ? project.settings.insertCoupling : null } };
}

/** One coupling between two of a tunnel's sections, of the project's mechanism, its sections the tunnel's longest. */
export function tunnelCouplingSubject(project: Project, evaluation: Pick<ProjectEvaluation, 'instances'>, instance: string | null): SubjectOf<TunnelCouplingConfig, TunnelCouplingSite> {
  const t = pick(project, evaluation, 'tunnel', instance);
  if (failed(t)) return t;
  if (!t.config) return { instance: t.id, problem: `${t.name} could not be laid out: see its problems in the planner.` };
  return { instance: t.id, config: t.joint, site: { tunnel: t.config, site: t.site } };
}

/** Where `configureSubassembly` keeps a sub-assembly's setting in the project. */
export type SettingHome = 'insert' | 'insertCoupling' | 'tunnelCoupling' | 'mesh' | 'tunnel';
export function settingHome(id: CatioSubassembly, key: string): SettingHome {
  if (key === 'mesh') return 'mesh';
  if (id === 'window-insert') return 'insert';
  if (id === 'insert-tunnel-coupling') return 'insertCoupling';
  if (id === 'tunnel-tunnel-coupling' || key === 'supportFixing' || key === 'supportBase') return 'tunnelCoupling';
  return 'tunnel';
}
