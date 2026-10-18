import { describe, expect, it } from 'vitest';
import {
  addPlatform, applyTransform, composeTransform, createProject, invertTransform, parseProject, PROJECT_SCHEMA_VERSION, relativeTransform,
  serializeProject, withoutKeys, worldTransforms, type Project,
} from './index.ts';

const close = (a: Record<string, number>, b: Record<string, number>) => { for (const k of Object.keys(b)) expect(a[k]).toBeCloseTo(b[k] ?? NaN, 9); };
/** A project with every kind of record: the default one with a platform in its enclosure. */
const furnished = (): Project => addPlatform(createProject({ id: 'p1', name: 'Test' }), 'enclosure-1').project;
type Json = Record<string, unknown>;
/** The object at `path` in a parsed document, to change it. */
const at = (root: unknown, ...path: (string | number)[]): Json => path.reduce<unknown>((node, key) => (node as Record<string | number, unknown>)[key], root) as Json;
const mutate = (f: (raw: Json) => void) => { const raw = JSON.parse(serializeProject(furnished())) as Json; f(raw); return parseProject(raw); };
const errorsOf = (result: ReturnType<typeof parseProject>) => result.ok ? [] : result.errors;

describe('project transforms', () => {
  it('composes a child frame in its parent frame: moved, then turned anticlockwise', () => {
    const parent = { x: 1000, y: 2000, z: 50, yaw: 90 };
    close(applyTransform(parent, { x: 100, y: 0, z: 10 }), { x: 1000, y: 2100, z: 60 });
    close(composeTransform(parent, { x: 100, y: 200, z: 1200, yaw: 30 }), { x: 800, y: 2100, z: 1250, yaw: 120 });
    // inverse and relative frames undo the composition
    const p = { x: -12.5, y: 301, z: 7 };
    close(invertTransform(parent, applyTransform(parent, p)), p);
    const child = { x: 100, y: 200, z: 1200, yaw: 30 };
    close(relativeTransform(parent, composeTransform(parent, child)), child);
  });

  it('places every instance through its parents: a platform rides on its enclosure', () => {
    const project = furnished();
    const world = worldTransforms(project);
    const enclosure = project.instances.find(i => i.id === 'enclosure-1');
    const platform = project.instances.find(i => i.id === 'platform-1');
    if (!enclosure || !platform) throw new Error('missing instances');
    close(world.get('platform-1') ?? {}, composeTransform(enclosure.transform, platform.transform));
    // the tunnel stands in its window's frame
    close(world.get('tunnel-1') ?? {}, world.get('window-1') ?? {});
  });
});

describe('parseProject', () => {
  it('round-trips a project through JSON: ids, dimensions, connections, attachments and view', () => {
    const project = { ...furnished(), view: { selection: ['platform-1'], hidden: ['tunnel-1'], camera: 'top' } };
    const result = parseProject(serializeProject(project));
    expect(errorsOf(result)).toEqual([]);
    expect(result.ok && result.project).toEqual(project);
    // the parsed document is a copy, not the object passed in
    const raw: unknown = JSON.parse(serializeProject(project));
    const again = parseProject(raw);
    expect(again.ok && again.project).not.toBe(raw);
  });

  it('refuses what is not a project, without throwing', () => {
    expect(errorsOf(parseProject('{ not json'))[0]).toMatch(/not JSON/);
    expect(errorsOf(parseProject('[1, 2]'))).toEqual(['A project is a JSON object.']);
    expect(errorsOf(parseProject({ name: 'x' }))[0]).toMatch(/no schemaVersion/);
    expect(parseProject(null).ok).toBe(false);
  });

  it('refuses unsupported versions, newer or older', () => {
    expect(errorsOf(mutate(raw => { raw['schemaVersion'] = PROJECT_SCHEMA_VERSION + 1; }))[0]).toMatch(/newer planner/);
    expect(errorsOf(mutate(raw => { raw['schemaVersion'] = 0; }))[0]).toMatch(/not supported/);
    expect(errorsOf(mutate(raw => { raw['schemaVersion'] = '1'; }))[0]).toMatch(/not a version number/);
  });

  it('refuses numbers that are not finite, impossible sizes and wrong types', () => {
    const project = furnished();
    const nan = structuredClone(project); at(nan, 'instances', 2, 'transform')['x'] = Number.NaN;
    expect(parseProject(nan).ok).toBe(false);
    const infinite = structuredClone(project); at(infinite, 'garden')['width'] = Number.POSITIVE_INFINITY;
    expect(parseProject(infinite).ok).toBe(false);
    expect(errorsOf(mutate(raw => { at(raw, 'instances', 2, 'params')['width'] = -2000; }))[0]).toMatch(/enclosure-1\.params\/width/);
    expect(errorsOf(mutate(raw => { raw['revision'] = 1.5; })).length).toBeGreaterThan(0);
    expect(errorsOf(mutate(raw => { raw['extra'] = true; }))[0]).toMatch(/additional properties \(extra\)/);
  });

  it('refuses duplicate ids', () => {
    expect(errorsOf(mutate(raw => { at(raw, 'instances', 1)['id'] = 'window-1'; }))).toContain('The id window-1 is used more than once.');
    expect(errorsOf(mutate(raw => { at(raw, 'connections', 1)['id'] = 'window-1-port'; }))).toContain('The id window-1-port is used more than once.');
  });

  it('refuses dangling references of every kind', () => {
    expect(errorsOf(mutate(raw => { at(raw, 'instances', 1)['parent'] = 'window-9'; }))).toContain('Instance tunnel-1\'s parent window-9 does not exist.');
    expect(errorsOf(mutate(raw => { at(raw, 'ports', 0)['owner'] = 'ghost'; }))).toContain('Port window-1-port\'s owner ghost does not exist.');
    expect(errorsOf(mutate(raw => { at(raw, 'connections', 0, 'ports')[1] = 'ghost-port'; }))).toContain('Connection connection-1\'s port ghost-port does not exist.');
    expect(errorsOf(mutate(raw => { at(raw, 'attachments', 0, 'support')['instance'] = 'enclosure-7'; }))).toContain('Attachment attachment-1\'s support enclosure-7 does not exist.');
    expect(errorsOf(mutate(raw => { at(raw, 'attachments', 0)['instance'] = 'platform-7'; }))).toContain('Attachment attachment-1\'s instance platform-7 does not exist.');
    expect(errorsOf(mutate(raw => { at(raw, 'view')['selection'] = ['gone']; }))).toContain('The view\'s selection names gone, which does not exist.');
  });

  it('refuses a port with two mates, a port state that contradicts its connections, and impossible parents', () => {
    expect(errorsOf(mutate(raw => { (raw['connections'] as unknown[]).push({ id: 'connection-3', ports: ['window-1-port', 'enclosure-1-left'] }); at(raw, 'ports', 4)['state'] = 'connected'; })))
      .toContain('Port window-1-port has more than one mate (connection-1 and connection-3).');
    expect(errorsOf(mutate(raw => { at(raw, 'ports', 4)['state'] = 'connected'; }))).toContain('Port enclosure-1-left is marked connected but has no mate.');
    expect(errorsOf(mutate(raw => { at(raw, 'ports', 0)['state'] = 'closed'; }))).toContain('Port window-1-port is coupled by connection-1 but is marked closed.');
    expect(errorsOf(mutate(raw => { at(raw, 'instances', 3)['parent'] = 'window-1'; }))).toContain('A platform cannot stand in a window (platform-1).');
    expect(errorsOf(mutate(raw => { at(raw, 'instances', 2)['parent'] = 'platform-1'; })).some(e => /loop|cannot stand/.test(e))).toBe(true);
  });

  it('refuses kinds and settings this version does not know', () => {
    expect(errorsOf(mutate(raw => { at(raw, 'instances', 2)['kind'] = 'junction'; }))).toContain('Instance enclosure-1 is a junction, which this planner does not support.');
    expect(errorsOf(mutate(raw => { at(raw, 'settings', 'insert')['padHeight'] = 999; }))).toContain('settings.insert.padHeight has an unsupported value (999).');
    expect(errorsOf(mutate(raw => { at(raw, 'settings')['tunnelCoupling'] = withoutKeys(at(raw, 'settings', 'tunnelCoupling'), ['mechanism']); }))).toContain('settings.tunnelCoupling.mechanism is missing.');
    expect(errorsOf(mutate(raw => { at(raw, 'instances', 1, 'params')['sectionLength'] = 9; }))).toContain('tunnel-1.params.sectionLength has an unsupported value (9).');
    expect(errorsOf(mutate(raw => { at(raw, 'instances', 1, 'params')['mode'] = 'custom'; })).length).toBeGreaterThan(0);
  });
});
