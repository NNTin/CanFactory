import { describe, expect, it } from 'vitest';
import {
  addEnclosure, addPlatform, composeTransform, createProject, evaluateProject, moveInstance, parseProject, PLATFORM, resizeInstance, rotateInstance, serializeProject,
  previewTunnels, snapToModules, tunnelBom, tunnelPitch, withoutKeys, type Project,
} from './index.ts';

const furnished = () => addPlatform(createProject({ id: 'p1' }), 'enclosure-1').project;
const platformOf = (project: Project) => {
  const p = evaluateProject(project).instances.find(i => i.kind === 'platform'); if (p?.kind !== 'platform') throw new Error('no platform'); return p;
};
const tunnelOf = (project: Project) => {
  const t = evaluateProject(project).instances.find(i => i.kind === 'tunnel'); if (t?.kind !== 'tunnel') throw new Error('no tunnel'); return t;
};
const issueIds = (project: Project) => evaluateProject(project).issues.map(i => i.id);

describe('evaluateProject', () => {
  it('needs nothing but the project: no storage, and the same result from a JSON copy', () => {
    expect((globalThis as { localStorage?: unknown }).localStorage).toBeUndefined();
    const project = furnished();
    const parsed = parseProject(serializeProject(project));
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    expect(evaluateProject(parsed.project)).toEqual(evaluateProject(project));
  });

  it('places every instance in the site: the platform through its enclosure', () => {
    const project = furnished();
    const e = evaluateProject(project);
    const enclosure = e.instances.find(i => i.id === 'enclosure-1');
    const platform = e.instances.find(i => i.id === 'platform-1');
    const local = project.instances.find(i => i.id === 'platform-1')?.transform;
    if (!enclosure || !platform || !local) throw new Error('missing instances');
    expect(platform.world).toEqual(composeTransform(enclosure.world, local));
    // every port where its owner's layout puts it: the tunnel's end on the enclosure's rear port, facing it
    const at = (id: string) => e.ports.find(p => p.id === id)?.world;
    const end = at('tunnel-1-end'); const rear = at('enclosure-1-rear');
    expect(end && [end.x, end.y, end.z]).toEqual(rear && [rear.x, rear.y, rear.z]);
    expect(end && rear && Math.abs(end.yaw - rear.yaw)).toBe(180);
  });

  it('solves the tunnel with the tunnel page’s own layout and parts list', () => {
    const project = createProject({ id: 'p1' });
    const t = tunnelOf(project);
    if (!t.config) throw new Error('no tunnel config');
    expect(t.config).toMatchObject({ portX: 0, portFacing: 0, portLevel: 'own', angleJoint: 'side-port', sectionLength: 1 });
    expect(t.config.portY).toBeCloseTo(776, 9);
    const bom = evaluateProject(project).bom.filter(l => l.sources.length === 1 && l.sources[0] === 'tunnel-1');
    if (!t.layout) throw new Error('no tunnel layout');
    expect(bom.map(line => withoutKeys(line, ['sources']))).toEqual(tunnelBom('modular', t.config, t.layout.site, t.joint));
  });

  it('keeps an enclosure moved off its route as an invalid draft, its connection kept', () => {
    const moved = moveInstance(createProject({ id: 'p1' }), 'enclosure-1', { y: 900 }).project;
    expect(moved.connections.map(c => c.id)).toEqual(['connection-1', 'connection-2']);
    const t = tunnelOf(moved);
    expect(t.reaches).toBe(false);
    const route = evaluateProject(moved).issues.find(i => i.id === 'connection:tunnel-1+enclosure-1:route');
    expect(route?.severity).toBe('error');
    expect(route?.message).toMatch(/whole standard modules: they end 124 mm from it.*The connection is kept/);
    expect(evaluateProject(moved).unresolved).toContainEqual(route);
    // one more whole module away, it reaches again
    const again = moveInstance(createProject({ id: 'p1' }), 'enclosure-1', { y: 776 + 383 }).project;
    expect(tunnelOf(again).reaches).toBe(true);
    // beside the window it turns at side ports to reach it, a whole number of modules each way
    const offset = moveInstance(createProject({ id: 'p1' }), 'enclosure-1', { x: 2500 + 3 * 383, y: 776 + 4 * 383 }).project;
    expect(tunnelOf(offset).layout?.turns.map(Math.abs)).toEqual([90, 90]);
    // turned away from the tunnel, the route cannot face into its port
    expect(issueIds(rotateInstance(createProject({ id: 'p1' }), 'enclosure-1', 45).project)).toContain('connection:tunnel-1+enclosure-1:route');
  });

  it('lists the enclosure as missing its recipe, never leaving it out silently', () => {
    const e = evaluateProject(createProject({ id: 'p1' }));
    const missing = e.issues.filter(i => i.kind === 'missing-recipe');
    expect(missing).toEqual([{ id: 'missing-recipe:enclosure-1:enclosure', kind: 'missing-recipe', severity: 'warning', instanceIds: ['enclosure-1'], message: missing[0]?.message ?? '' }]);
    expect(missing[0]?.message).toMatch(/no construction recipe/);
    expect(e.unresolved).toContainEqual(missing[0]);
    expect(e.bom.some(l => l.sources.includes('enclosure-1'))).toBe(false);
  });

  it('gives every parts-list line the instances it is for', () => {
    const e = evaluateProject(furnished());
    expect(e.bom.every(l => l.sources.length > 0)).toBe(true);
    const sources = new Set(e.bom.map(l => l.sources.join('+')));
    expect([...sources].sort()).toEqual(['platform-1', 'tunnel-1', 'window-1', 'window-1+tunnel-1']);
    const platform = e.bom.filter(l => l.sources[0] === 'platform-1');
    expect(platform.map(l => [l.id, l.quantity, l.partId])).toEqual([
      ['platform-board', 1, undefined], ['platform-batten', 2, undefined], [PLATFORM.hardware.postScrew, 8, PLATFORM.hardware.postScrew], [PLATFORM.hardware.boardScrew, 6, PLATFORM.hardware.boardScrew],
    ]);
    expect(platform[0]?.size).toBe('1920 × 400 × 18, cut from a 2500 × 1250 × 18 sheet (e.g. Garnica Laudio Wire Xtra Plus, BAUHAUS 28517690)');
  });
});

describe('the platform', () => {
  it('spans the enclosure on its two side frames, and only its span is unverified', () => {
    const project = furnished();
    const p = platformOf(project);
    expect(p.layout?.params).toEqual({ width: 1920, depth: 400, thickness: 18 });
    expect(p.layout?.battens.map(b => [b.member, b.center[0]])).toEqual([['side-left', -960 + 22.5], ['side-right', 960 - 22.5]]);
    const issues = evaluateProject(project).issues.filter(i => i.instanceIds.includes('platform-1'));
    expect(issues.map(i => [i.kind, i.severity])).toEqual([['unverified', 'info']]);
  });

  it('follows its enclosure when the enclosure moves or turns', () => {
    const project = furnished();
    const before = platformOf(project).world;
    const moved = moveInstance(project, 'enclosure-1', { x: 1800, y: 1400 }).project;
    expect(platformOf(moved).world).toEqual({ ...before, x: before.x - 700, y: before.y + 624 });
    const turned = rotateInstance(project, 'enclosure-1', 90).project;
    expect(platformOf(turned).world.yaw).toBe(90);
    expect(evaluateProject(turned).issues.filter(i => i.instanceIds.includes('platform-1') && i.severity === 'error')).toEqual([]);
  });

  it('is flagged, not moved, when its enclosure shrinks', () => {
    const project = resizeInstance(furnished(), 'enclosure-1', { width: 1600 }).project;
    expect(project.instances.find(i => i.id === 'platform-1')).toEqual(furnished().instances.find(i => i.id === 'platform-1'));
    const ids = issueIds(project);
    expect(ids).toContain('geometry:platform-1+enclosure-1:platform-outside');
    expect(ids).toContain('connection:platform-1+enclosure-1:platform-detached-attachment-1');
    expect(ids).toContain('connection:platform-1+enclosure-1:platform-detached-attachment-2');
    expect(ids).toContain('connection:platform-1+enclosure-1:platform-unsupported');
    // too low for its height
    expect(issueIds(resizeInstance(furnished(), 'enclosure-1', { height: 1100 }).project)).toContain('geometry:platform-1+enclosure-1:platform-above');
  });

  it('reports an attachment its own resize breaks, a board too big for a sheet, and a batten across a cat port', () => {
    const narrower = resizeInstance(furnished(), 'platform-1', { width: 1500 }).project;
    expect(issueIds(narrower)).toContain('connection:platform-1+enclosure-1:platform-detached-attachment-1');
    const wide = resizeInstance(resizeInstance(furnished(), 'enclosure-1', { width: 2400, depth: 2400 }).project, 'platform-1', { width: 2320, depth: 1300 }).project;
    expect(issueIds(wide)).toContain('geometry:platform-1+enclosure-1:platform-sheet');
    expect(issueIds(moveInstance(furnished(), 'platform-1', { z: 500 }).project)).toContain('geometry:platform-1+enclosure-1:platform-port-side-left');
    expect(issueIds(moveInstance(furnished(), 'platform-1', { z: 150 }).project)).toContain('geometry:platform-1+enclosure-1:platform-below');
  });
});

describe('a drag’s preview', () => {
  it('re-solves only the tunnels the dragged instances couple to, as evaluating the moved project does', () => {
    const project = furnished();
    const evaluation = evaluateProject(project);
    const at = project.instances.find(i => i.id === 'enclosure-1')?.transform;
    if (!at) throw new Error('no enclosure');
    const to = { ...at, y: at.y + 700 };
    const [preview, ...others] = previewTunnels(project, evaluation, new Map([['enclosure-1', to]]));
    expect(others).toEqual([]);
    const moved = tunnelOf(moveInstance(project, 'enclosure-1', to).project);
    expect(preview?.config).toEqual(moved.config);
    expect(preview?.reaches).toBe(moved.reaches);
    // moving the platform inside leaves the tunnel alone
    expect(previewTunnels(project, evaluation, new Map([['platform-1', { x: 0, y: 900, z: 1200, yaw: 0 }]]))).toEqual([]);
  });

  it('snaps an enclosure on a tunnel to whole modules, on the ground', () => {
    const project = createProject();
    const evaluation = evaluateProject(project);
    const at = project.instances.find(i => i.id === 'enclosure-1')?.transform;
    if (!at) throw new Error('no enclosure');
    const window = evaluation.instances.find(i => i.kind === 'window');
    if (window?.kind !== 'window') throw new Error('no window');
    const pitch = tunnelPitch(window.site, { ...project.settings.tunnelCoupling, jointShown: 'end-end' });
    for (const dy of [380, pitch * 0.6, -pitch * 0.4]) {
      const snapped = snapToModules(project, evaluation, 'enclosure-1', { ...at, y: at.y + dy });
      expect(snapped.x).toBeCloseTo(at.x, 3);
      expect(Math.abs((snapped.y - at.y) / pitch - Math.round((snapped.y - at.y) / pitch))).toBeLessThan(1e-6);
      expect(tunnelOf(moveInstance(project, 'enclosure-1', snapped).project).reaches).toBe(true);
    }
    // an enclosure on no tunnel stays where it is put
    const free = addEnclosure(project, { x: 500, y: 3000 });
    expect(snapToModules(free.project, evaluateProject(free.project), free.id ?? '', { x: 512, y: 3003, z: 0, yaw: 0 })).toEqual({ x: 512, y: 3003, z: 0, yaw: 0 });
  });
});
