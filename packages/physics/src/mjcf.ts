/**
 * MJCF, MuJoCo's XML model format, generated from a scene. Generated as text rather than through `mjSpec`, whose web bindings
 * are still marked untested (docs/physics-plan.md). Every name is escaped; numbers are written with enough digits to round-trip.
 */
import type { Scene, SceneBody, SceneGeom, SceneJoint } from './scene.ts';

const num = (value: number): string => {
  if (!Number.isFinite(value)) throw new Error(`MJCF: not a finite number: ${value}`);
  return Object.is(value, -0) ? '0' : String(value);
};
const list = (values: readonly number[]): string => values.map(num).join(' ');
const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attrs = (values: Record<string, string | undefined>): string =>
  Object.entries(values).flatMap(([key, value]) => value === undefined ? [] : [` ${key}="${escape(value)}"`]).join('');

/** How close two bodies are when they touch, in metres: 10 µm, a tenth of the smallest clearance the models are built with. */
export const TOUCH = 1e-5;

/** The name of a body's geom and mesh assets. */
export const geomName = (body: string, index: number): string => `${body}#${index}`;

function geomXml(body: SceneBody, geom: SceneGeom, index: number): string {
  const common = { name: geomName(body.name, index), friction: list(body.friction) };
  switch (geom.type) {
    case 'mesh': return `<geom${attrs({ ...common, type: 'mesh', mesh: geomName(body.name, index) })}/>`;
    case 'sphere': return `<geom${attrs({ ...common, type: 'sphere', size: num(geom.radius), pos: list(geom.pos) })}/>`;
    case 'cylinder':
    case 'capsule': return `<geom${attrs({ ...common, type: geom.type, size: list([geom.radius, geom.halfLength]), pos: list(geom.pos), quat: list(geom.quat) })}/>`;
    case 'box': return `<geom${attrs({ ...common, type: 'box', size: list(geom.halfSize), pos: list(geom.pos), quat: list(geom.quat) })}/>`;
  }
}

function jointXml(name: string, joint: SceneJoint): string {
  return `<joint${attrs({
    name,
    type: joint.type,
    pos: list(joint.pos),
    axis: joint.type === 'ball' ? undefined : list(joint.axis),
    limited: joint.range ? 'true' : 'false',
    range: joint.range ? list(joint.range) : undefined,
    stiffness: joint.stiffness === undefined ? undefined : num(joint.stiffness),
    springref: joint.springRef === undefined ? undefined : num(joint.springRef),
    damping: joint.damping === undefined ? undefined : num(joint.damping),
    frictionloss: joint.frictionLoss === undefined ? undefined : num(joint.frictionLoss),
  })}/>`;
}

function bodyXml(scene: Scene, body: SceneBody, depth: number): string {
  const pad = '  '.repeat(depth);
  const lines = [`${pad}<body${attrs({ name: body.name, pos: list(body.pos), quat: list(body.quat) })}>`];
  if (body.motion === 'free') lines.push(`${pad}  <freejoint${attrs({ name: body.name })}/>`);
  else if (body.motion !== 'weld') lines.push(`${pad}  ${jointXml(body.name, body.motion)}`);
  const inertial = body.inertial;
  if (inertial) {
    const [xx, yy, zz, xy, xz, yz] = inertial.inertia;
    lines.push(`${pad}  <inertial${attrs({ pos: list(inertial.pos), mass: num(inertial.mass), fullinertia: list([xx, yy, zz, xy, xz, yz]) })}/>`);
  }
  body.geoms.forEach((geom, index) => lines.push(`${pad}  ${geomXml(body, geom, index)}`));
  for (const child of scene.bodies.filter(other => other.parent === body.name)) lines.push(bodyXml(scene, child, depth + 1));
  lines.push(`${pad}</body>`);
  return lines.join('\n');
}

/** The scene's model. Bodies are nested under their parents; a body's mesh pieces become mesh assets of their own. */
export function toMjcf(scene: Scene): string {
  const names = new Set<string>();
  for (const body of scene.bodies) {
    if (names.has(body.name)) throw new Error(`MJCF: two bodies are named ${body.name}`);
    names.add(body.name);
  }
  for (const body of scene.bodies) {
    if (body.parent !== null && !names.has(body.parent)) throw new Error(`MJCF: ${body.name}'s parent ${body.parent} is not a body`);
  }
  const { options } = scene;
  const meshes = scene.bodies.flatMap(body => body.geoms.flatMap((geom, index) =>
    geom.type === 'mesh' ? [`    <mesh${attrs({ name: geomName(body.name, index), vertex: list(geom.vertices) })}/>`] : []));
  const parentCollisions = scene.bodies.some(body => body.collideWithParent === true);
  return [
    '<mujoco model="canfactory">',
    // Explicit inertials win; geoms of a body without one take their mass from the density (kg/m³ of PETG by default).
    '  <compiler angle="radian" inertiafromgeom="auto" boundmass="1e-6" boundinertia="1e-12"/>',
    // implicitfast integrates joint springs and damping implicitly: a steel ball on a stiff spring oscillates at ω·Δt above 1.
    `  <option${attrs({ timestep: num(options.timestep), gravity: list(options.gravity), integrator: 'implicitfast' })}>`,
    // MuJoCo leaves out contacts between a body and its parent; a body that should collide with its parent adds the pair below.
    `    <flag${attrs({ filterparent: parentCollisions ? 'disable' : undefined })}/>`,
    '  </option>',
    '  <default>',
    `    <geom${attrs({ solref: list(options.solref), solimp: list(options.solimp), density: '1270', margin: '0', condim: '3' })}/>`,
    `    <joint${attrs({ solreflimit: list(options.solref), solimplimit: list(options.solimp) })}/>`,
    '  </default>',
    meshes.length > 0 ? ['  <asset>', ...meshes, '  </asset>'].join('\n') : '',
    '  <worldbody>',
    ...scene.bodies.filter(body => body.parent === null).map(body => bodyXml(scene, body, 2)),
    '  </worldbody>',
    contactXml(scene, parentCollisions),
    driveXml(scene),
    '</mujoco>',
  ].filter(line => line !== '').join('\n');
}

/** The name of the equality constraint that drives a body's joint. */
export const driveName = (body: string): string => `drive:${body}`;

/**
 * A joint equality per driven joint: with no second joint, it holds the joint at its first coefficient (from its reference, 0).
 * MuJoCo's constraints are mass-normalised: one gives way under a force F by about F (1 − d) / (d m k), with d the impedance and
 * k = 1 / timeconst². A 0.4 g ball pushed by its 2 N/mm spring at 4 N gave way 0.09 mm with the contacts' settings, so a drive is
 * twice as stiff (the shortest time constant MuJoCo allows, 2 time steps) at ten times the impedance: about 1 µm.
 */
function driveXml(scene: Scene): string {
  const drives = scene.drives ?? [];
  if (drives.length === 0) return '';
  const solref = list([2 * scene.options.timestep, 1]);
  return ['  <equality>', ...drives.map(({ body }) => `    <joint${attrs({ name: driveName(body), joint1: body, polycoef: '0 0 0 0 0', solref, solimp: '0.9999 0.9999 0.0001' })}/>`), '  </equality>'].join('\n');
}

/** Exclusions: the scene's own, and, when parent filtering is off for some bodies, every other body–parent pair. */
function contactXml(scene: Scene, parentCollisions: boolean): string {
  const pairs: [string, string][] = [...scene.exclude];
  if (parentCollisions) {
    for (const body of scene.bodies) if (body.parent !== null && body.collideWithParent !== true) pairs.push([body.parent, body.name]);
  }
  if (pairs.length === 0) return '';
  return ['  <contact>', ...pairs.map(([a, b]) => `    <exclude${attrs({ body1: a, body2: b })}/>`), '  </contact>'].join('\n');
}

