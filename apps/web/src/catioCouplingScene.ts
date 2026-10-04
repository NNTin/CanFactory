import * as THREE from 'three';
import { dimensionOf, findPart } from '@canfactory/contracts';
import { createCatioParts } from './catioParts.ts';
import type { CatioState } from './catioScene.ts';
import type { CatioMode } from './catioSettings.ts';
import type { SubassemblyModel, V3 } from './catioSubassembly.ts';
import { buildWindowContext } from './catioWindowContext.ts';
import { COUPLING, couplingLayout, couplingSite, type CouplingConfig, type CouplingLayout, type CouplingSite } from './catioCoupling.ts';
import { buildInsertContext } from './catioWindowInsertScene.ts';
import { facePoint, TUNNEL, vec, type Face, type Rect } from './catioTunnel.ts';
import { buildPrintedLatches } from './catioPrintedLatchScene.ts';

/** Stage 3 fits the latches to the first section this far above its place; stage 4 lowers it onto its wall support. */
export const LIFT = 450;
/** How far an open latch's lever stands out from the closed position, in degrees. */
export const OPEN = 110;
const EXPLODE = 1.8;
const along = (progress: number, stage: number) => THREE.MathUtils.clamp(progress - stage + 1, 0, 1);
const ease = (t: number) => t * t * (3 - 2 * t);

export interface PieceMotion {
  object: THREE.Object3D; stage: number; window: [number, number]; approach: THREE.Vector3; axis?: THREE.Vector3; turns?: number; action: string;
  role?: 'timber' | 'seal' | 'catch' | 'latch' | 'lip' | 'screw'; of?: string; drive?: V3;
  /** Pieces fitted to the first section travel with it while it is lowered. */
  carried?: boolean;
}

/**
 * The coupling's pieces, each in its own group placed where it is installed (latches closed), not yet added to a scene: the
 * coupling page stages them, other pages show them as they are. Each latch's `setOpen` opens it (0 locked, 1 released). The printed
 * latch is built from its parts' real profiles and moved by the shared mechanism (toggleLatchMechanism.ts); its catch stays where
 * the lock holds it. `dispose` frees what the printed latch adds.
 */
export function buildCouplingPieces(p: ReturnType<typeof createCatioParts>, layout: CouplingLayout, latchType: CouplingConfig['latchType']) {
  const { box, rod, materials: m } = p;
  const at = (origin: V3 = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(...origin); return g; };
  const frame = layout.frame.map(member => { const group = at(); for (const b of member.boxes) box(group, b.size, b.center, m.timber); return { member, group }; });
  const seal = at(); const sw = COUPLING.seal.width / 2; const { y0, y1 } = layout.seal;
  layout.seal.path.slice(1).forEach(([x, z], i) => {
    const [px, pz] = layout.seal.path[i] ?? [x, z];
    box(seal, [Math.abs(x - px) + 2 * sw, y1 - y0, Math.abs(z - pz) + (i === 1 ? 2 * sw : 0)], [(x + px) / 2, (y0 + y1) / 2, (z + pz) / 2], m.rubber);
  });
  const gn = layout.latchPart;
  let dispose = () => {};
  let catches: { latch: CouplingLayout['latches'][number]; group: THREE.Group }[];
  let latches: { latch: CouplingLayout['latches'][number]; group: THREE.Group; lever: THREE.Group; setOpen: (open: number) => void }[];
  if (gn) {
    const [b1, b2, b3, b4, h1, h2] = (['b1', 'b2', 'b3', 'b4', 'h1', 'h2'] as const).map(key => dimensionOf(gn, key)) as [number, number, number, number, number, number];
    catches = layout.latches.map(q => {
      const group = at([q.faceX, q.catchY + b4 / 2, q.z]);
      box(group, [1.5, b4, b2], [q.side * 0.75, 0, 0], m.hardware);
      box(group, [h2, 2, b2 * 0.6], [q.side * h2 / 2, -b4 / 2 + 3, 0], m.hardware);
      return { latch: q, group };
    });
    latches = layout.latches.map(q => {
      const group = at([q.faceX, q.hingeY, q.z]);
      box(group, [1.5, b3, b1], [q.side * 0.75, -b3 / 2, 0], m.hardware);
      box(group, [h1 * 0.75, b3 * 0.5, b1 * 0.8], [q.side * h1 * 0.375, -b3 * 0.3, 0], m.hardware);
      // the lever pivots on the body; closed, it lies along the joint with its hook over the catch
      const lever = new THREE.Group(); lever.name = `${q.id}-lever`; lever.position.set(q.side * h1 * 0.75, -b3 * 0.3, 0); group.add(lever);
      const reach = q.hingeY - b3 * 0.3 - (q.catchY + 3);
      box(lever, [1.5, reach, b1 * 0.9], [q.side * (h1 * 0.25 - 0.75), -reach / 2, 0], m.hardware);
      rod(lever, [q.side * h1 * 0.25, -reach, 0], [q.side * (-h1 * 0.75 + h2), -reach, 0], 1.6);
      if (latchType !== 'A') box(lever, [6, 4, latchType === 'SV' ? 3 : b1 * 0.5], [q.side * (h1 * 0.25 + 3), -reach * 0.45, 0], m.rubber);
      return { latch: q, group, lever, setOpen: (open: number) => lever.rotation.set(0, 0, q.side * THREE.MathUtils.degToRad(OPEN) * open) };
    });
  } else {
    // the shared printed latch, at the mounts the layout placed
    const placed = layout.latches.flatMap(q => q.printed ? [{ ...q.printed.mount, latch: q }] : []);
    const printed = buildPrintedLatches(placed); dispose = printed.dispose;
    catches = printed.catches.map(({ mount, group }) => ({ latch: mount.latch, group }));
    latches = printed.latches.map(({ mount, group, lever, setOpen }) => ({ latch: mount.latch, group, lever, setOpen }));
  }
  let lip: THREE.Group | null = null;
  if (layout.lip) {
    const { x0, x1, y0: ly0, y1: ly1, z } = layout.lip;
    lip = at(); box(lip, [x1 - x0, ly1 - ly0, COUPLING.lip.thickness], [(x0 + x1) / 2, (ly0 + ly1) / 2, z + COUPLING.lip.thickness / 2], m.rubber);
  }
  return { frame, seal, catches, latches, lip, dispose };
}

/**
 * The coupling at the window: the insert in its recess and the tunnel's wall support as fixed context, the docking frame, seal and
 * catches fitted to the insert, the first section with its latches lowered onto its support, and the latches closed. The page's
 * open/closed toggle shows the joint released: every lever open and its hook off the catch.
 */
export function createCouplingScene(_variant: CatioMode, config: CouplingConfig, site: CouplingSite = couplingSite()): SubassemblyModel & {
  layout: ReturnType<typeof couplingLayout>; motions: PieceMotion[]; levers: THREE.Group[]; lift: () => number;
} {
  const layout = couplingLayout(config, site);
  const { insert, tl, first } = layout;
  const p = createCatioParts(); const { component, box, rod, materials: m } = p;
  const { hinge } = buildWindowContext(p, site.site.window);
  const start = p.components.length;
  const geometries: THREE.BufferGeometry[] = [];
  const discGeometry = new THREE.CylinderGeometry(1, 1, 1, 20); geometries.push(discGeometry);
  const vector = (v: V3) => new THREE.Vector3(...v);
  const cylinder = (parent: THREE.Object3D, from: V3, to: V3, radius: number, material: THREE.Material) => {
    const a = vector(from); const c = vector(to); const v = c.clone().sub(a);
    const mesh = new THREE.Mesh(discGeometry, material);
    mesh.position.copy(a.add(c).multiplyScalar(0.5)); mesh.scale.set(radius, v.length(), radius);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); mesh.castShadow = true; parent.add(mesh); return mesh;
  };
  /** A solid between two quadrilaterals, relative to `origin` (as in the tunnel scene). */
  const hexahedron = (parent: THREE.Object3D, corners: V3[], material: THREE.Material, origin: V3) => {
    const c = corners.map(q => vec.sub(q, origin));
    const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const positions: number[] = [];
    for (const [a, b, c2, d] of quads) for (const i of [a, b, c2, a, c2, d]) positions.push(...(c[i ?? 0] ?? [0, 0, 0]));
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
    (material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; parent.add(mesh); return mesh;
  };
  const corners = (from: Face, fromOffset: number, to: Face, toOffset: number, [u0, u1, v0, v1]: Rect): V3[] => [
    ...([[u0, v0], [u1, v0], [u1, v1], [u0, v1]] as const).map(([u, v]) => facePoint(from, u, v, fromOffset)),
    ...([[u0, v0], [u1, v0], [u1, v1], [u0, v1]] as const).map(([u, v]) => facePoint(to, u, v, toOffset)),
  ];
  const wire = new THREE.BoxGeometry(1, 1, 1); geometries.push(wire);
  const meshQuad = (parent: THREE.Object3D, c: [V3, V3, V3, V3]) => {
    const pitch = TUNNEL.mesh.opening + TUNNEL.mesh.wire; const lines: [V3, V3][] = [];
    const lerp = (a: V3, b: V3, t: number) => vec.add(a, vec.mul(vec.sub(b, a), t));
    const [c0, c1, c2, c3] = c;
    const n1 = Math.max(1, Math.round(vec.len(vec.sub(c1, c0)) / pitch)); const n2 = Math.max(1, Math.round(vec.len(vec.sub(c3, c0)) / pitch));
    for (let i = 0; i <= n1; i++) lines.push([lerp(c0, c1, i / n1), lerp(c3, c2, i / n1)]);
    for (let i = 0; i <= n2; i++) lines.push([lerp(c0, c3, i / n2), lerp(c1, c2, i / n2)]);
    const wires = new THREE.InstancedMesh(wire, m.mesh, lines.length); const pose = new THREE.Object3D();
    lines.forEach(([a, b], i) => {
      pose.position.copy(vector(vec.mul(vec.add(a, b), 0.5)));
      pose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector(vec.unit(vec.sub(b, a))));
      pose.scale.set(TUNNEL.mesh.wire, vec.len(vec.sub(b, a)) + TUNNEL.mesh.wire, TUNNEL.mesh.wire); pose.updateMatrix(); wires.setMatrixAt(i, pose.matrix);
    });
    parent.add(wires); return wires;
  };

  const motions: PieceMotion[] = [];
  const move = (object: THREE.Object3D, stage: number, window: [number, number], approach: V3, action: string, meta: Partial<Omit<PieceMotion, 'object' | 'stage' | 'window' | 'approach' | 'action'>> = {}) => {
    motions.push({ object, stage, window, approach: vector(approach), action, ...meta });
  };
  const piece = (parent: THREE.Object3D, origin: V3 = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(...origin); parent.add(g); return g; };
  const groups = new Map<string, THREE.Group>();
  const group = (id: string, step: number, layer: 'timber' | 'mesh' | 'hardware') => {
    const existing = groups.get(id); if (existing) return existing;
    const created = component(id, step, layer, [0, 0, 0]); groups.set(id, created); return created;
  };

  // Stage 0: the insert in its recess (timber and mesh) and the tunnel's wall support, levelled.
  buildInsertContext(p, insert);
  const supportGroup = component('wall-support', 0, undefined);
  const s = layout.wallSupport;
  if (s) {
    const centre: V3 = [s.at[0], s.at[1], s.top - s.depth / 2];
    const bearer = box(supportGroup, [s.length, TUNNEL.bearer.width, s.depth], centre, s.kind === 'block' ? m.endgrain : m.timber);
    bearer.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(s.across[1], s.across[0]));
    const foot = tl.foot; const l3 = tl.footHeight;
    for (const f of s.feet) {
      box(supportGroup, [TUNNEL.slab.size, TUNNEL.slab.size, TUNNEL.slab.thickness], [f.at[0], f.at[1], f.slabTop - TUNNEL.slab.thickness / 2], m.floor);
      cylinder(supportGroup, f.at, vec.add(f.at, [0, 0, l3]), (tl.pad ? tl.pad.diameter : dimensionOf(foot, 'd1')) / 2, tl.pad ? m.printed : m.rubber);
      cylinder(supportGroup, vec.add(f.at, [0, 0, l3]), vec.add(f.at, [0, 0, l3 + f.actualSetting]), dimensionOf(foot, 'd') / 2, m.hardware);
      if (f.leg > 0) box(supportGroup, [TUNNEL.leg, TUNNEL.leg, f.leg], [f.at[0], f.at[1], s.top - s.depth - f.leg / 2], m.timber);
    }
  }

  // Stage 1: the docking frame, stiles then head, from outdoors; then its screws.
  const pieces = buildCouplingPieces(p, layout, config.latchType);
  for (const { member, group: g } of pieces.frame) {
    group('docking-frame', 1, 'timber').add(g);
    const head = member.id === 'frame-head';
    move(g, 1, head ? [0.3, 0.55] : [0, 0.3], [0, 260, head ? 120 : 0], head ? 'Docking frame head: laid across the stiles onto the transom' : `2 × Docking frame stile: offered to the port jambs${layout.battenFace > layout.meshFace ? ', rebate over the cover batten' : ''}`, { role: 'timber', of: member.id });
  }
  const screw = (component: string, stage: number, window: [number, number], f: (typeof layout.fasteners)[number], action: string, carried = false) => {
    const partData = findPart(f.partId); if (!partData) return;
    const l = dimensionOf(partData, 'l');
    const g = piece(group(component, stage, 'hardware'), f.at);
    cylinder(g, [0, 0, 0], vec.mul(f.direction, 1.5), dimensionOf(partData, 'dk') / 2, m.hardware); rod(g, [0, 0, 0], vec.mul(f.direction, l), dimensionOf(partData, 'd') / 2.4);
    move(g, stage, window, vec.mul(f.direction, -(l + 40)), action, { role: 'screw', drive: f.direction, axis: vector(f.direction), turns: 4, carried, ...(f.of ? { of: f.of } : {}) });
  };
  const count = (component: string) => layout.fasteners.filter(f => f.component === component).length;
  for (const f of layout.fasteners.filter(f => f.component === 'frame-screws')) screw('frame-screws', 1, [0.6, 1], f, `${count('frame-screws')} × Countersunk wood screw 5 × 60: through the frame into the jambs and transom`);

  // Stage 2: the seal round the frame's face, then the catch brackets on its sides and their screws.
  const sealGroup = pieces.seal; group('seal', 2, 'hardware').add(sealGroup);
  move(sealGroup, 2, [0, 0.35], [0, 200, 0], `${layout.seal.profile} seal: stuck round the middle of the frame’s face`, { role: 'seal' });
  const latchTitle = layout.latchPart?.title ?? 'Printed toggle latch';
  const catchName = layout.latchPart ? 'Catch bracket' : 'Catch plate of the printed latch';
  for (const { latch: q, group: g } of pieces.catches) {
    group('catches', 2, 'hardware').add(g);
    move(g, 2, [0.45, 0.7], [q.side * 160, 0, 0], `${layout.latches.length} × ${catchName}: onto the docking frame’s outer side`, { role: 'catch', of: q.id });
  }
  for (const f of layout.fasteners.filter(f => f.component === 'catch-screws')) screw('catch-screws', 2, [0.7, 1], f, `${count('catch-screws')} × Countersunk wood screw 4 × 25: ${layout.latchPart ? 'catch brackets' : 'catch plates'} onto the frame`);

  // Stage 3: the first section (built on the tunnel page) arrives raised; its latch bodies, screws and floor lip are fitted.
  if (first) {
    const timber = piece(group('first-section', 3, 'timber')); const mesh = piece(group('first-section-mesh', 3, 'mesh'));
    for (const mem of tl.members.filter(q => q.piece === first.id)) hexahedron(timber, corners(mem.from, mem.fromOffset, mem.to, mem.toOffset, mem.rect), mem.kind === 'flange' ? m.endgrain : m.timber, [0, 0, 0]);
    for (const q of tl.panels.filter(q => q.piece === first.id)) meshQuad(mesh, q.corners);
    // it is already built: it arrives whole at the start of the stage and only travels with the lift
    for (const g of [timber, mesh]) move(g, 3, [0, 0], [0, 0, 0], 'The first section, framed and meshed on the tunnel page', { role: 'timber', carried: true });
  }
  const levers: THREE.Group[] = [];
  for (const { latch: q, group: g, lever } of pieces.latches) {
    group('latches', 3, 'hardware').add(g);
    levers.push(lever);
    move(g, 3, [0.05, 0.4], [q.side * 160, 0, 0], `${layout.latches.length} × ${latchTitle}: ${layout.latchPart ? 'body' : 'base plate, lever and link on it,'} onto the first flange’s outer side`, { role: 'latch', of: q.id, carried: true });
  }
  for (const f of layout.fasteners.filter(f => f.component === 'latch-screws')) screw('latch-screws', 3, [0.4, 0.7], f, `${count('latch-screws')} × Countersunk wood screw 4 × 25: ${layout.latchPart ? 'latch bodies' : 'base plates'} onto the flange`, true);
  if (pieces.lip) {
    const g = pieces.lip; group('floor-lip', 3, 'hardware').add(g);
    move(g, 3, [0.7, 0.85], [0, 0, 120], 'EPDM floor lip: laid on the flange’s sill, reaching past its back', { role: 'lip', carried: true });
    for (const f of layout.fasteners.filter(f => f.component === 'lip-screws')) screw('lip-screws', 3, [0.85, 1], f, `${count('lip-screws')} × Countersunk wood screw 4 × 25: the lip onto the sill`, true);
  }

  for (const c of p.components.slice(start)) p.root.add(c.group);
  const bases = motions.map(motion => motion.object.position.clone());
  const baseQuaternions = motions.map(motion => motion.object.quaternion.clone());
  const spin = new THREE.Quaternion();
  let currentAction: string | null = null; let currentLift = 0;

  function update(state: CatioState) {
    p.update(state);
    const lower = along(state.progress, 4);
    currentLift = state.exploded ? LIFT : LIFT * (1 - ease(lower));
    const active = new Set<string>();
    for (const [i, motion] of motions.entries()) {
      const base = bases[i]; const quaternion = baseQuaternions[i]; if (!base || !quaternion) continue;
      const stageT = state.progress - motion.stage + 1;
      const [a, b] = motion.window;
      const t = b > a ? THREE.MathUtils.clamp((stageT - a) / (b - a), 0, 1) : (stageT >= a ? 1 : 0);
      if (t > 0 && t < 1) active.add(motion.action);
      const away = state.exploded ? EXPLODE : 1 - ease(t);
      motion.object.visible = stageT >= 1 || t > 0 || (state.exploded && stageT > a);
      motion.object.position.copy(base).addScaledVector(motion.approach, away);
      if (motion.carried) motion.object.position.z += currentLift;
      motion.object.quaternion.copy(quaternion);
      if (motion.axis && motion.turns) motion.object.quaternion.multiply(spin.setFromAxisAngle(motion.axis.clone().normalize(), -away * motion.turns * Math.PI * 2));
    }
    // the levers close in the first half of stage 5; released (the page's toggle), they stand open again
    const closing = state.exploded ? 0 : ease(THREE.MathUtils.clamp(along(state.progress, 5) / 0.6, 0, 1));
    const closed = state.windowOpen ? 0 : closing;
    for (const latch of pieces.latches) latch.setOpen(1 - closed);
    let action: string | null = active.size > 0 ? [...active].join('; ') : null;
    if (!action && state.progress > 3 && state.progress < 4 && !state.exploded) action = 'Lowering the first section onto its wall support, square to the port, onto the seal';
    if (!action && state.progress > 4 && closing > 0 && closing < 1) action = `${layout.latches.length} × ${latchTitle}: hooked over its catch, lever pressed down over centre`;
    currentAction = action;
    // the window stays open: the cat goes through it into the port
    hinge.rotation.z = -Math.PI / 2;
    p.root.updateMatrixWorld(true);
  }
  function dispose() { p.dispose(); pieces.dispose(); for (const g of geometries) g.dispose(); }
  return { root: p.root, hinge, components: p.components, update, dispose, layout, motions, levers, lift: () => currentLift, caption: () => currentAction };
}
