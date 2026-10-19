import { Value } from 'typebox/value';
import { MODULAR_DEFAULT } from './catioModularDesign.ts';
import {
  composeTransform, keepView, projectErrors, PROJECT_SCHEMA_VERSION, ProjectSchema, relativeTransform, worldTransforms,
  type Project, type ProjectSettings, type WindowParams,
} from './catioProject.ts';
import { tunnelRoute } from './catioProjectEvaluate.ts';
import { routeOf, tunnelLayout, tunnelSiteFor } from './catioTunnel.ts';

/**
 * Reading a project file, of this planner's version or an older one. Version 1 (#113) solved each tunnel's route from its ends;
 * version 2 (#126) describes it as a chain of elements. A version 1 document is migrated by laying its tunnels out as version 1 did
 * (from the window's port to the port each one's end couples to, as its ports' frames hold them) and keeping that layout as their
 * elements: the same tunnel, now with its elements' ids and floors in the document. Version 3 (#127) puts each tunnel on the site
 * rather than in its window: a version 2 tunnel keeps its place, its transform composed with its window's.
 */
export type ParseResult = { ok: true; project: Project } | { ok: false; errors: string[] };

/** An older document as this version: version 1 as version 2, version 2 as version 3. Anything else is passed on unchanged. */
export function migrateProject(raw: unknown): unknown {
  return toVersion3(toVersion2(raw));
}

/** A version 1 document as version 2: every tunnel's route described as version 1 laid it out. */
function toVersion2(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || (raw as { schemaVersion?: unknown }).schemaVersion !== 1) return raw;
  const shape = raw as { instances?: unknown; ports?: unknown; connections?: unknown; settings?: unknown };
  if (!Array.isArray(shape.instances) || !Array.isArray(shape.ports) || !Array.isArray(shape.connections) || typeof shape.settings !== 'object' || shape.settings === null) return raw;
  const v1 = raw as Project;
  try {
    const settings: ProjectSettings = v1.settings;
    const world = worldTransforms(v1);
    const instances = v1.instances.map(i => {
      if (i.kind !== 'tunnel') return i;
      const t = i;
      const window = v1.instances.find(w => w.id === t.parent && w.kind === 'window');
      const end = v1.ports.find(p => p.owner === t.id && p.name === 'end');
      const tunnelWorld = world.get(t.id);
      if (!window || !end || !tunnelWorld) return i;
      const other = v1.connections.find(c => c.ports.includes(end.id))?.ports.find(id => id !== end.id);
      const mate = v1.ports.find(p => p.id === other);
      const mateOwner = mate && world.get(mate.owner);
      const target = mate && mateOwner ? relativeTransform(tunnelWorld, composeTransform(mateOwner, mate.frame)) : end.frame;
      const site = tunnelSiteFor({ ...settings.insert, mesh: settings.mesh }, { ...MODULAR_DEFAULT, ...(window.params as WindowParams), portClosure: settings.portClosure, doorSeat: settings.doorSeat });
      // version 1's own layout (climbing to its end's height on the way), kept as elements
      const layout = tunnelLayout(tunnelRoute(t, settings, target, !!mateOwner), site, { ...settings.tunnelCoupling, jointShown: 'end-end' });
      return { ...t, params: { ...t.params, route: routeOf(layout, n => `${t.id}-element-${n + 1}`) } };
    });
    return { ...v1, schemaVersion: 2, instances };
  } catch {
    return raw;
  }
}

/** A version 2 document as version 3: every tunnel on the site where its window put it. */
function toVersion3(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || (raw as { schemaVersion?: unknown }).schemaVersion !== 2) return raw;
  const shape = raw as { instances?: unknown };
  if (!Array.isArray(shape.instances) || !shape.instances.every(i => typeof i === 'object' && i !== null)) return raw;
  const v2 = raw as Project;
  try {
    const world = worldTransforms(v2);
    const instances = v2.instances.map(i => i.kind === 'tunnel' ? { ...i, parent: null, transform: world.get(i.id) ?? i.transform } : i);
    return { ...v2, schemaVersion: PROJECT_SCHEMA_VERSION, instances };
  } catch {
    return raw;
  }
}

/**
 * A project from a file's text (or its parsed JSON): the document when `projectErrors` finds nothing (a version 1 document migrated
 * first), else the errors, so that the caller keeps its current project. Its view keeps only what it has (`keepView`). It never throws.
 */
export function parseProject(json: unknown): ParseResult {
  let raw = json;
  if (typeof json === 'string') {
    try { raw = JSON.parse(json); } catch (error) { return { ok: false, errors: [`The file is not JSON: ${(error as Error).message}`] }; }
  }
  raw = migrateProject(raw);
  // the view is not the design: a selection or hidden list naming what is gone is dropped, not a reason to refuse the project
  if (Value.Check(ProjectSchema, raw)) raw = { ...raw, view: keepView(raw.view, raw) };
  const errors = projectErrors(raw);
  return errors.length ? { ok: false, errors } : { ok: true, project: structuredClone(raw) as Project };
}
