import * as THREE from 'three';
import { dimensionOf, findPart } from '@canfactory/contracts';
import { createCatioParts } from './catioParts.ts';
import type { CatioState } from './catioScene.ts';
import type { CatioMode } from './catioSettings.ts';
import type { SubassemblyModel, V3 } from './catioSubassembly.ts';
import { buildWindowContext } from './catioWindowContext.ts';
import { windowInsertLayout } from './catioWindowInsert.ts';
import { buildInsertContext } from './catioWindowInsertScene.ts';
import { couplingLayout, savedCoupling } from './catioCoupling.ts';
import { buildCouplingPieces } from './catioCouplingScene.ts';
import { facePoint, groundAt, tunnelBounds, tunnelLayout, tunnelSite, TUNNEL, vec, type Face, type Rect, type TunnelConfig, type TunnelSite } from './catioTunnel.ts';

/** Stages 3–4 frame and mesh the sections this far above their line; stage 5 lowers them onto the supports. */
export const LIFT = 650;
const EXPLODE = 1.8;
const along = (progress: number, stage: number) => THREE.MathUtils.clamp(progress - stage + 1, 0, 1);
const ease = (t: number) => t * t * (3 - 2 * t);

export interface PieceMotion {
  object: THREE.Object3D; stage: number; window: [number, number]; approach: THREE.Vector3; axis?: THREE.Vector3; turns?: number; action: string;
  role?: 'slab' | 'leg' | 'insert-nut' | 'foot' | 'bearer' | 'screw' | 'staple' | 'bolt' | 'nut' | 'timber' | 'mesh';
  /** The tunnel piece (section or collar) it travels with when the pieces are lowered, or the support it rises with when levelled. */
  carrier?: string; support?: string; of?: string; drive?: V3;
}

/** The tunnel on its site: every piece of `tunnelLayout`, staged as `tunnelSteps` describes. */
export function createTunnelScene(_variant: CatioMode, config: TunnelConfig, site: TunnelSite = tunnelSite()): SubassemblyModel & {
  layout: ReturnType<typeof tunnelLayout>; motions: PieceMotion[]; carriers: Map<string, number>; drops: Map<string, number>;
} {
  const layout = tunnelLayout(config, site);
  const { w, h } = layout;
  const p = createCatioParts(); const { component, box, rod, materials: m } = p;
  const b = tunnelBounds(layout);
  const groundWidth = 2 * Math.max(Math.abs(b.minX), Math.abs(b.maxX)) + 1200;
  const { hinge } = buildWindowContext(p, site.window, { width: groundWidth, depth: 1 }, false);
  const first = p.components.length;
  const geometries: THREE.BufferGeometry[] = [];
  const hexGeometry = new THREE.CylinderGeometry(1, 1, 1, 6); const discGeometry = new THREE.CylinderGeometry(1, 1, 1, 20);
  geometries.push(hexGeometry, discGeometry);
  const vector = (v: V3) => new THREE.Vector3(...v);
  const cylinder = (parent: THREE.Object3D, from: V3, to: V3, radius: number, material: THREE.Material, hex = false) => {
    const a = vector(from); const c = vector(to); const v = c.clone().sub(a);
    const mesh = new THREE.Mesh(hex ? hexGeometry : discGeometry, material);
    mesh.position.copy(a.add(c).multiplyScalar(0.5)); mesh.scale.set(radius, v.length(), radius);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); mesh.castShadow = true; parent.add(mesh); return mesh;
  };
  /** A solid between two quadrilaterals (each counter-clockwise seen from outside the first), relative to `origin`. */
  const hexahedron = (parent: THREE.Object3D, corners: V3[], material: THREE.Material, origin: V3) => {
    const c = corners.map(q => vec.sub(q, origin));
    const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const positions: number[] = [];
    for (const [a, b2, c2, d] of quads) for (const i of [a, b2, c2, a, c2, d]) positions.push(...(c[i ?? 0] ?? [0, 0, 0]));
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
    (material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; parent.add(mesh); return mesh;
  };
  const corners = (from: Face, fromOffset: number, to: Face, toOffset: number, [u0, u1, v0, v1]: Rect): V3[] => [
    ...([[u0, v0], [u1, v0], [u1, v1], [u0, v1]] as const).map(([u, v]) => facePoint(from, u, v, fromOffset)),
    ...([[u0, v0], [u1, v0], [u1, v1], [u0, v1]] as const).map(([u, v]) => facePoint(to, u, v, toOffset)),
  ];
  const centroid = (points: V3[]): V3 => vec.mul(points.reduce<V3>((s, q) => vec.add(s, q), [0, 0, 0]), 1 / points.length);
  /** A box from `from` to `to`, `width` across (horizontal) and `height` up. */
  const beam = (parent: THREE.Object3D, from: V3, to: V3, width: number, height: number, material: THREE.Material, origin: V3) => {
    const axis = vec.unit(vec.sub(to, from)); const vertical = Math.abs(axis[2]) > 0.99;
    const x = vertical ? new THREE.Vector3(1, 0, 0) : vector(vec.unit(vec.cross(axis, [0, 0, 1]))); const y = vector(axis); const z = x.clone().cross(y);
    const mesh = box(parent as THREE.Group, [width, vec.len(vec.sub(to, from)), height], vec.sub(centroid([from, to]), origin), material);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); return mesh;
  };
  const wire = new THREE.BoxGeometry(1, 1, 1); geometries.push(wire);
  /** Wire mesh over a planar quadrilateral: wires parallel to each pair of its edges. */
  const meshQuad = (parent: THREE.Object3D, c: [V3, V3, V3, V3], origin: V3) => {
    const pitch = TUNNEL.mesh.opening + TUNNEL.mesh.wire; const lines: [V3, V3][] = [];
    const lerp = (a: V3, b2: V3, t: number) => vec.add(a, vec.mul(vec.sub(b2, a), t));
    const [c0, c1, c2, c3] = c;
    const n1 = Math.max(1, Math.round(Math.max(vec.len(vec.sub(c1, c0)), vec.len(vec.sub(c2, c3))) / pitch));
    const n2 = Math.max(1, Math.round(Math.max(vec.len(vec.sub(c3, c0)), vec.len(vec.sub(c2, c1))) / pitch));
    for (let i = 0; i <= n1; i++) lines.push([lerp(c0, c1, i / n1), lerp(c3, c2, i / n1)]);
    for (let i = 0; i <= n2; i++) lines.push([lerp(c0, c3, i / n2), lerp(c1, c2, i / n2)]);
    const wires = new THREE.InstancedMesh(wire, m.mesh, lines.length); const pose = new THREE.Object3D();
    lines.forEach(([a, b2], i) => {
      const length = vec.len(vec.sub(b2, a)) + TUNNEL.mesh.wire;
      pose.position.copy(vector(vec.sub(centroid([a, b2]), origin)));
      pose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), length > 1e-6 ? vector(vec.unit(vec.sub(b2, a))) : new THREE.Vector3(0, 1, 0));
      pose.scale.set(TUNNEL.mesh.wire, Math.max(length, 0.01), TUNNEL.mesh.wire); pose.updateMatrix(); wires.setMatrixAt(i, pose.matrix);
    });
    parent.add(wires); return wires;
  };

  const motions: PieceMotion[] = [];
  const move = (object: THREE.Object3D, stage: number, window: [number, number], approach: V3, action: string, meta: Partial<Omit<PieceMotion, 'object' | 'stage' | 'window' | 'approach' | 'action'>> = {}) => {
    motions.push({ object, stage, window, approach: vector(approach), action, ...meta });
  };
  const piece = (parent: THREE.Object3D, origin: V3) => { const g = new THREE.Group(); g.position.set(...origin); parent.add(g); return g; };
  const groups = new Map<string, THREE.Group>();
  const group = (id: string, step: number, layer: 'timber' | 'mesh' | 'hardware' | 'environment') => {
    const existing = groups.get(id); if (existing) return existing;
    const created = component(id, step, layer, [0, 0, 0]); groups.set(id, created); return created;
  };

  // Stage 0: the site. Uneven ground, the window insert as set on its page with the coupling's docking frame on its port, and the
  // enclosure's port flange.
  const terrain = component('terrain', 0, 'environment');
  const depth = b.maxY + 900;
  const ground = new THREE.PlaneGeometry(groundWidth, depth, 90, 90); geometries.push(ground);
  const position = ground.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i); const y = position.getY(i) + depth / 2;
    position.setXYZ(i, x, y, groundAt(config, x, y));
  }
  ground.computeVertexNormals();
  const turf = new THREE.Mesh(ground, m.grass); turf.receiveShadow = true; terrain.add(turf);
  buildInsertContext(p, windowInsertLayout('modular', site.insert, site.window));
  // the coupling as set on its page, docked to this tunnel: its frame, seal and catches are on the insert from the start; the
  // latch bodies and lip come with the first section and are closed in the last stage (the coupling page shows how)
  const couplingConfig = savedCoupling();
  const joint = buildCouplingPieces(p, couplingLayout(couplingConfig, { tunnel: config, site }), couplingConfig.latchType);
  const dockingFrame = component('docking-frame', 0, undefined);
  for (const g of [...joint.frame.map(f => f.group), joint.seal, ...joint.catches.map(c => c.group)]) dockingFrame.add(g);
  const latches = component('coupling-latches', 6, 'hardware', [0, 160, 0]);
  for (const g of [...joint.latches.map(q => q.group), ...(joint.lip ? [joint.lip] : [])]) latches.add(g);
  const port = component('enclosure-port', 0, undefined);
  const last = layout.pieces.at(-1);
  if (last) {
    const ring: Rect[] = [[-w / 2 - 70, -w / 2, -70, h + 70], [w / 2, w / 2 + 70, -70, h + 70], [-w / 2, w / 2, h, h + 70], [-w / 2, w / 2, -70, 0]];
    for (const rect of ring) hexahedron(port, corners(last.end, 0, last.end, TUNNEL.flange.thickness, rect), m.endgrain, [0, 0, 0]);
    // the enclosure's rear wall round its port, for scale only: the enclosure is not designed here
    const back = vec.add(layout.E, vec.mul(layout.dE, TUNNEL.flange.thickness + 25)); const across = last.end.frame.x;
    const z0 = groundAt(config, back[0], back[1], false); const top = layout.E[2] + h + 500;
    const quad: [V3, V3, V3, V3] = [vec.add([back[0], back[1], z0], vec.mul(across, -650)), vec.add([back[0], back[1], z0], vec.mul(across, 650)), vec.add([back[0], back[1], top], vec.mul(across, 650)), vec.add([back[0], back[1], top], vec.mul(across, -650))];
    meshQuad(port, quad, [0, 0, 0]);
    for (const s of [-1, 1]) beam(port, vec.add([back[0], back[1], z0], vec.mul(across, s * 650)), vec.add([back[0], back[1], top], vec.mul(across, s * 650)), 45, 45, m.timber, [0, 0, 0]);
  }

  // Stage 1: slabs, then each support: legs (or a low bearer), insert nuts and feet from below, the bearer, its screws, the brace.
  const drops = new Map<string, number>();
  const { foot, insertNut, travel } = layout;
  const l1 = dimensionOf(foot, 'l1'); const l3 = dimensionOf(foot, 'l3'); const d1 = dimensionOf(foot, 'd1') / 2; const af = dimensionOf(foot, 's');
  const trestles = layout.supports.filter(s => s.kind === 'trestle');
  const blocks = layout.supports.filter(s => s.kind === 'block');
  const feetCount = layout.supports.reduce((n, s) => n + s.feet.length, 0);
  for (const s of layout.supports) {
    drops.set(s.id, Math.min(...s.feet.map(f => f.actualSetting)) - travel.min);
    for (const f of s.feet) {
      const slab = piece(group('slabs', 1, 'environment'), [f.at[0], f.at[1], f.slabTop - TUNNEL.slab.thickness / 2]);
      box(slab, [TUNNEL.slab.size, TUNNEL.slab.size, TUNNEL.slab.thickness], [0, 0, 0], m.floor).quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(s.along[0], s.along[1]));
      move(slab, 1, [0, 0.12], [0, 0, 260], `${feetCount} × Paving slab: bedded in the grass under every foot`, { role: 'slab', of: f.id });
      const bottom = f.slabTop + l3 + f.actualSetting;
      if (f.leg > 0) {
        const leg = piece(group('legs', 1, 'timber'), [f.at[0], f.at[1], bottom + f.leg / 2]);
        box(leg, [TUNNEL.leg, TUNNEL.leg, f.leg], [0, 0, 0]);
        move(leg, 1, [0.12, 0.26], [0, 0, 300], `${trestles.length * 2} × Leg: stood over its slab`, { role: 'leg', support: s.id, of: f.id });
      }
      const nut = piece(group('foot-insert-nuts', 1, 'hardware'), [f.at[0], f.at[1], bottom]);
      cylinder(nut, [0, 0, 0], [0, 0, dimensionOf(insertNut, 'l')], dimensionOf(insertNut, 'd') / 2, m.hardware);
      move(nut, 1, [0.26, 0.4], [0, 0, -70], `${feetCount} × ${insertNut.title}: screwed up into the foot end of each ${blocks.length ? 'leg or low bearer' : 'leg'}`, { role: 'insert-nut', support: s.id, of: f.id, axis: new THREE.Vector3(0, 0, 1), turns: 3 });
      // the foot: pad on the slab, hexagon, and the stud up into the insert nut (it stays on the slab while it is turned)
      const footPiece = piece(group('levelling-feet', 1, 'hardware'), [f.at[0], f.at[1], f.slabTop]);
      cylinder(footPiece, [0, 0, 0], [0, 0, l3 - 7], d1, m.rubber);
      cylinder(footPiece, [0, 0, l3 - 7], [0, 0, l3], af / Math.sqrt(3), m.hardware, true);
      cylinder(footPiece, [0, 0, l3], [0, 0, l3 + l1], dimensionOf(foot, 'd') / 2, m.hardware);
      move(footPiece, 1, [0.4, 0.56], [0, 0, -0.01], `${feetCount} × ${foot.title}: stud screwed up into the insert nut`, { role: 'foot', of: f.id, axis: new THREE.Vector3(0, 0, 1), turns: 5 });
      if (s.kind === 'trestle') for (const k of [-1, 1]) {
        const at = vec.add([f.at[0], f.at[1], s.top], vec.mul(s.along, k * 11));
        const screw = piece(group('bearer-screws', 1, 'hardware'), at);
        cylinder(screw, [0, 0, 0], [0, 0, -2], 5.5, m.hardware); rod(screw, [0, 0, 0], [0, 0, -100], 2.5);
        move(screw, 1, [0.72, 0.84], [0, 0, 150], `${trestles.length * 4} × Countersunk wood screw 6 × 100: down through the bearer into the legs`, { role: 'screw', support: s.id, drive: [0, 0, -1], axis: new THREE.Vector3(0, 0, 1), turns: 4 });
      }
    }
    const centre: V3 = [s.at[0], s.at[1], s.top - s.depth / 2];
    const bearer = piece(group('bearers', 1, 'timber'), centre);
    beam(bearer, vec.add(centre, vec.mul(s.across, -s.length / 2)), vec.add(centre, vec.mul(s.across, s.length / 2)), TUNNEL.bearer.width, s.depth, s.kind === 'block' ? m.endgrain : m.timber, centre);
    move(bearer, 1, s.kind === 'block' ? [0.12, 0.26] : [0.56, 0.72], [0, 0, 300], s.kind === 'block' ? `${blocks.length} × Low bearer: laid over its slabs` : `${trestles.length} × Bearer: laid onto its legs`, { role: 'bearer', support: s.id });
    if (s.brace) {
      const offset = vec.mul(s.along, -(TUNNEL.leg / 2 + TUNNEL.brace.thickness / 2));
      const from = vec.add(s.brace.from, offset); const to = vec.add(s.brace.to, offset); const c = centroid([from, to]);
      const brace = piece(group('braces', 1, 'timber'), c);
      beam(brace, from, to, TUNNEL.brace.thickness, TUNNEL.brace.width, m.endgrain, c);
      move(brace, 1, [0.84, 0.92], vec.mul(s.along, -200), `${layout.supports.filter(t => t.brace).length} × Brace: across the tall trestles`, { role: 'timber', support: s.id });
    }
  }
  for (const f of layout.fasteners.filter(f => f.component === 'brace-screws')) {
    const s = layout.supports.find(t => t.brace && Math.min(vec.len(vec.sub(t.brace.from, [f.at[0], f.at[1], t.brace.from[2]])), vec.len(vec.sub(t.brace.to, [f.at[0], f.at[1], t.brace.to[2]]))) < 200);
    const screw = piece(group('brace-screws', 1, 'hardware'), f.at);
    cylinder(screw, [0, 0, 0], vec.mul(f.direction, 2), 4.6, m.hardware); rod(screw, [0, 0, 0], vec.mul(f.direction, 50), 2.1);
    move(screw, 1, [0.92, 1], vec.mul(f.direction, -110), `${layout.fasteners.filter(g => g.component === 'brace-screws').length} × Countersunk wood screw 5 × 50: brace onto the legs`, { role: 'screw', drive: f.direction, axis: vector(f.direction), turns: 4, ...(s ? { support: s.id } : {}) });
  }

  // Stages 3–4: every piece framed and meshed, raised over its place.
  const sections = layout.pieces.filter(q => q.kind === 'section').length; const collars = layout.pieces.length - sections;
  for (const mem of layout.members) {
    const pts = corners(mem.from, mem.fromOffset, mem.to, mem.toOffset, mem.rect); const c = centroid(pts);
    const id = mem.kind === 'flange' ? 'flanges' : mem.kind === 'rail' ? 'rails' : 'floor-boards';
    const g = piece(group(id, 3, 'timber'), c);
    hexahedron(g, pts, mem.kind === 'flange' ? m.endgrain : m.timber, c);
    const owner = layout.pieces.find(q => q.id === mem.piece); if (!owner) continue;
    const window: [number, number] = mem.kind === 'flange' ? [0, 0.2] : mem.kind === 'rail' ? [0.2, 0.4] : [0.55, 0.7];
    const approach = mem.kind === 'flange' ? vec.mul(mem.toOffset > 0 ? owner.start.n : owner.end.n, mem.toOffset > 0 ? -160 : 160) : mem.kind === 'rail' ? vec.mul(owner.frame.x, (mem.rect[0] + mem.rect[1]) > 0 ? 220 : -220) : vec.mul(owner.frame.z, 260);
    const caption = mem.kind === 'flange' ? `${layout.pieces.length * 2} × Flange ring: stood at each end of every ${collars ? 'section and collar' : 'section'}`
      : mem.kind === 'rail' ? `${layout.members.filter(n => n.kind === 'rail').length} × Rail: offered between the flanges from the side` : `${layout.pieces.length} × Floor board: laid onto the bottom rails`;
    move(g, 3, window, approach, caption, { role: 'timber', carrier: owner.id });
  }
  for (const cleat of layout.cleats) {
    const g = piece(group('cleats', 3, 'timber'), cleat.center);
    const half = vec.mul(cleat.frame.x, cleat.length / 2);
    beam(g, vec.sub(cleat.center, half), vec.add(cleat.center, half), TUNNEL.cleat.size, TUNNEL.cleat.size, m.endgrain, cleat.center);
    move(g, 3, [0.82, 0.91], vec.mul(cleat.frame.z, 180), `${layout.cleats.length} × Floor cleat: laid across the sloped floor`, { role: 'timber', carrier: cleat.piece });
  }
  const carrierOf = (at: V3) => {
    let best = layout.pieces[0]?.id ?? ''; let distance = Infinity;
    for (const q of layout.pieces) {
      const t = THREE.MathUtils.clamp(vec.dot(vec.sub(at, q.start.at), q.frame.y), 0, q.length);
      const d = vec.len(vec.sub(at, vec.add(q.start.at, vec.mul(q.frame.y, t)))); if (d < distance) { distance = d; best = q.id; }
    }
    return best;
  };
  const fastenerWindows: Record<string, { stage: number; window: [number, number] }> = {
    'rail-screws': { stage: 3, window: [0.4, 0.55] }, 'floor-screws': { stage: 3, window: [0.7, 0.82] }, 'cleat-screws': { stage: 3, window: [0.91, 1] },
    staples: { stage: 4, window: [0.5, 1] }, 'flange-screws': { stage: 6, window: [0, 0.35] },
  };
  for (const panel of layout.panels) {
    const c = centroid(panel.corners);
    const g = piece(group('mesh', 4, 'mesh'), c);
    meshQuad(g, panel.corners, c);
    const owner = layout.pieces.find(q => q.id === panel.piece);
    const out = owner ? (panel.id.endsWith('roof') ? vec.mul(owner.frame.z, 240) : vec.mul(owner.frame.x, panel.id.endsWith('left') ? -240 : 240)) : [0, 0, 240] as V3;
    move(g, 4, [0, 0.5], out, `${layout.panels.length} × Mesh panel: offered up to the rails`, { role: 'mesh', carrier: panel.piece });
  }
  for (const f of layout.fasteners) {
    const timing = fastenerWindows[f.component]; if (!timing) continue;
    const partData = findPart(f.partId); if (!partData) continue;
    const count = layout.fasteners.filter(g => g.component === f.component).length;
    const g = piece(group(f.component, timing.stage, 'hardware'), f.at);
    const carrier = f.component === 'flange-screws' ? undefined : carrierOf(f.at);
    const support = f.component === 'flange-screws' ? layout.supports.find(s => s.fixings.some(q => Math.hypot(q[0] - f.at[0], q[1] - f.at[1]) < 1e-6))?.id : undefined;
    if (partData.family === 'nail') {
      const across = f.across ?? [1, 0, 0];
      rod(g, vec.mul(across, -5), vec.mul(across, 5), 1.25);
      move(g, timing.stage, timing.window, vec.mul(f.direction, -60), `${count} × ${partData.title}: driven over the wire, every 15 cm`, { role: 'staple', drive: f.direction, ...(carrier ? { carrier } : {}) });
    } else {
      const l = dimensionOf(partData, 'l');
      cylinder(g, [0, 0, 0], vec.mul(f.direction, 1.5), dimensionOf(partData, 'dk') / 2, m.hardware); rod(g, [0, 0, 0], vec.mul(f.direction, l), dimensionOf(partData, 'd') / 2.4);
      const how = f.component === 'rail-screws' ? 'through the flanges into the rail ends' : f.component === 'flange-screws' ? 'up through the bearers into the flanges' : 'down into the rails';
      move(g, timing.stage, timing.window, vec.mul(f.direction, -(l + 50)), `${count} × ${partData.title}: ${how}`, { role: 'screw', drive: f.direction, axis: vector(f.direction), turns: 4, ...(carrier ? { carrier } : {}), ...(support ? { support } : {}) });
    }
  }

  // Stage 5: couplings, once both pieces are down: bolt and washer from the window side, washer and nut from the far side.
  const bolt = findPart('iso-4017-m8x80'); const washer = findPart('iso-7093-m8'); const nutPart = findPart('iso-4032-m8');
  if (bolt && washer && nutPart) {
    const wh = dimensionOf(washer, 'h'); const wr = dimensionOf(washer, 'd2') / 2; const nm = dimensionOf(nutPart, 'm'); const ns = dimensionOf(nutPart, 's');
    const T = TUNNEL.flange.thickness;
    for (const c of layout.couplings) {
      const count = layout.couplings.filter(k => k.stage === c.stage).reduce((n, k) => n + k.bolts.length, 0);
      const id = c.stage === 5 ? 'coupling-bolts' : 'port-bolts';
      const windows: [[number, number], [number, number]] = c.stage === 5 ? [[0.55, 0.78], [0.78, 1]] : [[0.5, 0.75], [0.75, 1]];
      const before = layout.interfaces.find(i => i.id === c.id)?.before ?? undefined;
      for (const [i, bt] of c.bolts.entries()) {
        const n = bt.n; const head = vec.mul(n, -(T + wh));
        const g = piece(group(id, c.stage, 'hardware'), bt.at);
        cylinder(g, head, vec.mul(n, -(T + wh + dimensionOf(bolt, 'k'))), dimensionOf(bolt, 's') / Math.sqrt(3), m.hardware, true);
        cylinder(g, vec.mul(n, -T), head, wr, m.hardware);
        rod(g, head, vec.add(head, vec.mul(n, dimensionOf(bolt, 'l'))), 4);
        move(g, c.stage, windows[0], vec.mul(n, -140), `${count} × ${bolt.title}: through both flanges, with a large washer`, { role: 'bolt', of: `${c.id}-${i}`, drive: n, ...(c.stage === 5 && before ? { carrier: before } : {}) });
        const nutGroup = piece(group(id, c.stage, 'hardware'), bt.at);
        cylinder(nutGroup, vec.mul(n, T), vec.mul(n, T + wh), wr, m.hardware);
        cylinder(nutGroup, vec.mul(n, T + wh), vec.mul(n, T + wh + nm), ns / Math.sqrt(3), m.hardware, true);
        move(nutGroup, c.stage, windows[1], vec.mul(n, 90), `${count} × ${nutPart.title}: run on from the far side over a large washer`, { role: 'nut', of: `${c.id}-${i}`, axis: vector(n), turns: 4, ...(c.stage === 5 && before ? { carrier: before } : {}) });
      }
    }
  }
  for (const c of p.components.slice(first)) p.root.add(c.group);
  const bases = motions.map(motion => motion.object.position.clone());
  const baseQuaternions = motions.map(motion => motion.object.quaternion.clone());
  const spin = new THREE.Quaternion();
  const carriers = new Map<string, number>(); const supportRise = new Map<string, number>();
  let currentAction: string | null = null;
  const order = layout.pieces.map(q => q.id);

  function update(state: CatioState) {
    p.update(state);
    // pieces are lowered one after another from the window end in the first half of stage 5
    const lower = along(state.progress, 5);
    order.forEach((id, i) => {
      const t = THREE.MathUtils.clamp((lower - i / order.length * 0.5) / (0.5 / order.length), 0, 1);
      carriers.set(id, state.exploded ? LIFT : LIFT * (1 - ease(state.progress >= 5 ? 1 : t)));
    });
    // the feet are turned in stage 2 until each bearer is at its height
    const level = state.exploded ? 0 : ease(along(state.progress, 2));
    for (const s of layout.supports) supportRise.set(s.id, -(drops.get(s.id) ?? 0) * (1 - level));
    const active = new Set<string>();
    for (const [i, motion] of motions.entries()) {
      const base = bases[i]; const quaternion = baseQuaternions[i]; if (!base || !quaternion) continue;
      const stageT = state.progress - motion.stage + 1;
      const [a, b2] = motion.window;
      const t = THREE.MathUtils.clamp((stageT - a) / (b2 - a), 0, 1);
      if (t > 0 && t < 1) active.add(motion.action);
      const away = state.exploded ? EXPLODE : 1 - ease(t);
      motion.object.visible = stageT >= 1 || t > 0 || (state.exploded && stageT > a);
      motion.object.position.copy(base).addScaledVector(motion.approach, away);
      if (motion.carrier) motion.object.position.z += carriers.get(motion.carrier) ?? 0;
      if (motion.support) motion.object.position.z += supportRise.get(motion.support) ?? 0;
      motion.object.quaternion.copy(quaternion);
      if (motion.axis && motion.turns) motion.object.quaternion.multiply(spin.setFromAxisAngle(motion.axis.clone().normalize(), -away * motion.turns * Math.PI * 2));
      if (motion.role === 'foot' && !state.exploded) motion.object.quaternion.multiply(spin.setFromAxisAngle(new THREE.Vector3(0, 0, 1), level * Math.PI * 6));
    }
    let action: string | null = active.size > 0 ? [...active].join('; ') : null;
    if (!action && state.progress > 1 && state.progress < 2) action = 'Each foot is turned on its stud, from below the bearer, until the bearer top meets the string line; then its nut is jammed up against the timber';
    if (!action && state.progress > 4 && state.progress <= 5 && lower < 0.5) {
      const piece = layout.pieces[Math.min(order.length - 1, Math.floor(lower / 0.5 * order.length))];
      action = `Lowering ${piece?.name.toLowerCase() ?? 'the pieces'} onto its supports, from the window end`;
    }
    currentAction = action;
    hinge.rotation.z = state.windowOpen ? -Math.PI / 2 : 0;
    p.root.updateMatrixWorld(true);
  }
  function dispose() { p.dispose(); for (const g of geometries) g.dispose(); }
  return { root: p.root, hinge, components: p.components, update, dispose, layout, motions, carriers, drops, caption: () => currentAction };
}
