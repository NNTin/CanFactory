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
import type { LatchMount } from './catioPrintedLatch.ts';
import { groundAt, tunnelBounds, tunnelLayout, tunnelSite, TUNNEL, vec, type Member, type Piece, type Rect, type TunnelConfig, type TunnelLayout, type TunnelSite } from './catioTunnel.ts';
import { savedTunnelCoupling, type TunnelCouplingConfig } from './catioTunnelJoint.ts';
import { buildCouplingJoint, buildSectionPieces, buildSupportPieces, supportOf, tunnelDrawing } from './catioTunnelPieces.ts';

/** Stages 3–4 frame and mesh the sections this far above their line; stage 5 lowers them onto the supports. */
export const LIFT = 650;
const EXPLODE = 1.8;
const along = (progress: number, stage: number) => THREE.MathUtils.clamp(progress - stage + 1, 0, 1);
const ease = (t: number) => t * t * (3 - 2 * t);

export interface PieceMotion {
  object: THREE.Object3D; stage: number; window: [number, number]; approach: THREE.Vector3; axis?: THREE.Vector3; turns?: number; action: string;
  role?: 'slab' | 'leg' | 'insert-nut' | 'foot' | 'bearer' | 'screw' | 'staple' | 'bolt' | 'nut' | 'timber' | 'mesh' | 'latch' | 'seal';
  /** The tunnel piece (section or collar) it travels with when the pieces are lowered, or the support it rises with when levelled. */
  carrier?: string; support?: string; of?: string; drive?: V3;
}

/** Which way a flange ring, rail or floor board comes in while a section is framed: rings along the axis, rails from the side, the floor from above. */
export function memberApproach(mem: Member, owner: Piece): V3 {
  return mem.kind === 'flange' ? vec.mul(mem.toOffset > 0 ? owner.start.n : owner.end.n, mem.toOffset > 0 ? -160 : 160) : mem.kind === 'rail' ? vec.mul(owner.frame.x, (mem.rect[0] + mem.rect[1]) > 0 ? 220 : -220) : vec.mul(owner.frame.z, 260);
}
/** The caption for a member coming in, for all the pieces of its kind in `layout` (or in `pieces` of it). */
export function memberCaption(layout: TunnelLayout, mem: Member, collars: boolean, pieces?: string[]): string {
  const of = (id: string) => !pieces || pieces.includes(id);
  const count = pieces ? pieces.length : layout.pieces.length;
  return mem.kind === 'flange' ? `${count * 2} × Flange ring: stood at each end of every ${collars ? 'section and collar' : 'section'}`
    : mem.kind === 'rail' ? `${layout.members.filter(n => n.kind === 'rail' && of(n.piece)).length} × Rail: offered between the flanges from the side` : `${count} × Floor board: laid onto the bottom rails`;
}

/** The tunnel on its site: every piece of `tunnelLayout`, staged as `tunnelSteps` describes. */
export function createTunnelScene(_variant: CatioMode, config: TunnelConfig, site: TunnelSite = tunnelSite(), joint: TunnelCouplingConfig = savedTunnelCoupling()): SubassemblyModel & {
  layout: ReturnType<typeof tunnelLayout>; motions: PieceMotion[]; carriers: Map<string, number>; drops: Map<string, number>;
  levers: { mount: LatchMount; lever: THREE.Group; setOpen: (open: number) => void }[];
} {
  const layout = tunnelLayout(config, site, joint);
  const { w, h } = layout;
  const p = createCatioParts(); const { component, materials: m } = p;
  const b = tunnelBounds(layout);
  const groundWidth = 2 * Math.max(Math.abs(b.minX), Math.abs(b.maxX)) + 1200;
  const { hinge } = buildWindowContext(p, site.window, { width: groundWidth, depth: 1 }, false);
  const first = p.components.length;
  const draw = tunnelDrawing(p); const { vector, hexahedron, corners, beam, meshQuad } = draw;
  const geometries: THREE.BufferGeometry[] = [];

  const motions: PieceMotion[] = [];
  const move = (object: THREE.Object3D, stage: number, window: [number, number], approach: V3, action: string, meta: Partial<Omit<PieceMotion, 'object' | 'stage' | 'window' | 'approach' | 'action'>> = {}) => {
    motions.push({ object, stage, window, approach: vector(approach), action, ...meta });
  };
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
  const dock = buildCouplingPieces(p, couplingLayout(couplingConfig, { tunnel: config, site }), couplingConfig.latchType);
  const dockingFrame = component('docking-frame', 0, undefined);
  for (const g of [...dock.frame.map(f => f.group), dock.seal, ...dock.catches.map(c => c.group)]) dockingFrame.add(g);
  const latches = component('coupling-latches', 6, 'hardware', [0, 160, 0]);
  for (const g of [...dock.latches.map(q => q.group), ...(dock.lip ? [dock.lip] : [])]) latches.add(g);
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
  const { foot, pad, insertNut, travel } = layout;
  const trestles = layout.supports.filter(s => s.kind === 'trestle');
  const blocks = layout.supports.filter(s => s.kind === 'block');
  const feetCount = layout.supports.reduce((n, s) => n + s.feet.length, 0);
  for (const s of layout.supports) {
    drops.set(s.id, Math.min(...s.feet.map(f => f.actualSetting)) - travel.min);
    const built = buildSupportPieces(p, draw, layout, s);
    for (const { foot: f, slab, leg, nut, footPiece, screws } of built.feet) {
      group('slabs', 1, 'environment').add(slab);
      move(slab, 1, [0, 0.12], [0, 0, 260], `${feetCount} × Paving slab: bedded in the grass under every foot`, { role: 'slab', of: f.id });
      if (leg) { group('legs', 1, 'timber').add(leg); move(leg, 1, [0.12, 0.26], [0, 0, 300], `${trestles.length * 2} × Leg: stood over its slab`, { role: 'leg', support: s.id, of: f.id }); }
      group('foot-insert-nuts', 1, 'hardware').add(nut);
      move(nut, 1, [0.26, 0.4], [0, 0, -70], `${feetCount} × ${insertNut.title}: screwed up into the foot end of each ${blocks.length ? 'leg or low bearer' : 'leg'}`, { role: 'insert-nut', support: s.id, of: f.id, axis: new THREE.Vector3(0, 0, 1), turns: 3 });
      // the foot stays on the slab while it is turned
      group('levelling-feet', 1, 'hardware').add(footPiece);
      move(footPiece, 1, [0.4, 0.56], [0, 0, -0.01], pad ? `${feetCount} × Printed foot on an ${foot.designation}: screwed up into the insert nut by turning the foot` : `${feetCount} × ${foot.title}: stud screwed up into the insert nut`, { role: 'foot', of: f.id, axis: new THREE.Vector3(0, 0, 1), turns: 5 });
      for (const screw of screws) {
        group('bearer-screws', 1, 'hardware').add(screw);
        move(screw, 1, [0.72, 0.84], [0, 0, 150], `${trestles.length * 4} × Countersunk wood screw 6 × 100: down through the bearer into the legs`, { role: 'screw', support: s.id, drive: [0, 0, -1], axis: new THREE.Vector3(0, 0, 1), turns: 4 });
      }
    }
    group('bearers', 1, 'timber').add(built.bearer);
    move(built.bearer, 1, s.kind === 'block' ? [0.12, 0.26] : [0.56, 0.72], [0, 0, 300], s.kind === 'block' ? `${blocks.length} × Low bearer: laid over its slabs` : `${trestles.length} × Bearer: laid onto its legs`, { role: 'bearer', support: s.id });
    if (built.brace) {
      group('braces', 1, 'timber').add(built.brace);
      move(built.brace, 1, [0.84, 0.92], vec.mul(s.along, -200), `${layout.supports.filter(t => t.brace).length} × Brace: across the tall trestles`, { role: 'timber', support: s.id });
    }
  }
  const braceScrews = layout.fasteners.filter(f => f.component === 'brace-screws');
  for (const f of braceScrews) {
    const drawn = draw.fastener(f); if (!drawn) continue; const s = supportOf(layout, f);
    group('brace-screws', 1, 'hardware').add(drawn.group);
    move(drawn.group, 1, [0.92, 1], vec.mul(f.direction, -110), `${braceScrews.length} × Countersunk wood screw 5 × 50: brace onto the legs`, { role: 'screw', drive: f.direction, axis: vector(f.direction), turns: 4, ...(s ? { support: s.id } : {}) });
  }

  // Stages 3–4: every piece framed and meshed, raised over its place.
  const sections = layout.pieces.filter(q => q.kind === 'section').length; const collars = layout.pieces.length - sections;
  const built = buildSectionPieces(p, draw, layout);
  for (const { member: mem, group: g } of built.members) {
    const id = mem.kind === 'flange' ? 'flanges' : mem.kind === 'rail' ? 'rails' : 'floor-boards';
    group(id, 3, 'timber').add(g);
    const owner = layout.pieces.find(q => q.id === mem.piece); if (!owner) continue;
    const window: [number, number] = mem.kind === 'flange' ? [0, 0.2] : mem.kind === 'rail' ? [0.2, 0.4] : [0.55, 0.7];
    move(g, 3, window, memberApproach(mem, owner), memberCaption(layout, mem, collars > 0), { role: 'timber', carrier: owner.id });
  }
  for (const { cleat, group: g } of built.cleats) {
    group('cleats', 3, 'timber').add(g);
    move(g, 3, [0.82, 0.91], vec.mul(cleat.frame.z, 180), `${layout.cleats.length} × Floor cleat: laid across the sloped floor`, { role: 'timber', carrier: cleat.piece });
  }
  const fastenerWindows: Record<string, { stage: number; window: [number, number] }> = {
    'rail-screws': { stage: 3, window: [0.4, 0.55] }, 'floor-screws': { stage: 3, window: [0.7, 0.82] }, 'cleat-screws': { stage: 3, window: [0.91, 1] },
    staples: { stage: 4, window: [0.5, 1] }, 'flange-screws': { stage: 6, window: [0, 0.35] },
  };
  for (const { panel, group: g } of built.panels) {
    group('mesh', 4, 'mesh').add(g);
    const owner = layout.pieces.find(q => q.id === panel.piece);
    const out = owner ? (panel.id.endsWith('roof') ? vec.mul(owner.frame.z, 240) : vec.mul(owner.frame.x, panel.id.endsWith('left') ? -240 : 240)) : [0, 0, 240] as V3;
    move(g, 4, [0, 0.5], out, `${layout.panels.length} × Mesh panel: offered up to the rails`, { role: 'mesh', carrier: panel.piece });
  }
  const flangeScrews = layout.fasteners.filter(f => f.component === 'flange-screws').flatMap(f => { const drawn = draw.fastener(f); return drawn ? [{ fastener: f, ...drawn }] : []; });
  for (const { fastener: f, group: g, part: partData } of [...built.fasteners, ...flangeScrews]) {
    const timing = fastenerWindows[f.component]; if (!timing) continue;
    const count = layout.fasteners.filter(q => q.component === f.component).length;
    group(f.component, timing.stage, 'hardware').add(g);
    const carrier = f.piece; const support = supportOf(layout, f)?.id;
    if (partData.family === 'nail') {
      move(g, timing.stage, timing.window, vec.mul(f.direction, -60), `${count} × ${partData.title}: driven over the wire, every 15 cm`, { role: 'staple', drive: f.direction, ...(carrier ? { carrier } : {}) });
    } else {
      const l = dimensionOf(partData, 'l');
      const how = f.component === 'rail-screws' ? 'through the flanges into the rail ends' : f.component === 'flange-screws' ? 'up through the bearers into the flanges' : 'down into the rails';
      move(g, timing.stage, timing.window, vec.mul(f.direction, -(l + 50)), `${count} × ${partData.title}: ${how}`, { role: 'screw', drive: f.direction, axis: vector(f.direction), turns: 4, ...(carrier ? { carrier } : {}), ...(support ? { support } : {}) });
    }
  }

  // Stages 3 and 5: the couplings. Latched: plates screwed on while framing, the seal stuck on before laying, levers closed once
  // both pieces are down. Bolted (and at the port): bolt and washer from the window side, washer and nut from the far side.
  const joints = layout.couplings.map(c => buildCouplingJoint(p, draw, layout, c));
  const levers: ReturnType<typeof buildCouplingJoint>['latches'] = [];
  const latchCount = joints.reduce((n, j) => n + j.latches.length, 0);
  const plateScrews = layout.fasteners.filter(f => f.component === 'latch-screws' || f.component === 'catch-screws').length;
  const sealed = joints.filter(j => j.seal).length;
  for (const j of joints) {
    const c = j.coupling;
    const count = layout.couplings.filter(k => k.stage === c.stage).reduce((n, k) => n + k.bolts.length, 0);
    const id = c.stage === 5 ? 'coupling-bolts' : 'port-bolts';
    const windows: [[number, number], [number, number]] = c.stage === 5 ? [[0.55, 0.78], [0.78, 1]] : [[0.5, 0.75], [0.75, 1]];
    const carrier = c.stage === 5 && c.before ? { carrier: c.before } : {};
    const bolt = findPart('iso-4017-m8x80'); const nutPart = findPart('iso-4032-m8');
    for (const { id: of, bolt: bt, group: g, nut } of j.bolts) {
      group(id, c.stage, 'hardware').add(g); group(id, c.stage, 'hardware').add(nut);
      move(g, c.stage, windows[0], vec.mul(bt.n, -140), `${count} × ${bolt?.title ?? 'Bolt'}: through both flanges, with a large washer`, { role: 'bolt', of, drive: bt.n, ...carrier });
      move(nut, c.stage, windows[1], vec.mul(bt.n, 90), `${count} × ${nutPart?.title ?? 'Nut'}: run on from the far side over a large washer`, { role: 'nut', of, axis: vector(bt.n), turns: 4, ...carrier });
    }
    for (const { mount, group: g } of j.catches) {
      group('section-latches', 3, 'hardware').add(g);
      move(g, 3, [0.82, 0.9], vec.mul(mount.out, 160), `${latchCount} × Catch plate of the printed latch: onto the flange after each coupling`, { role: 'latch', of: mount.id, ...(c.after ? { carrier: c.after } : {}) });
    }
    for (const latch of j.latches) {
      levers.push(latch);
      group('section-latches', 3, 'hardware').add(latch.group);
      move(latch.group, 3, [0.82, 0.9], vec.mul(latch.mount.out, 160), `${latchCount} × Printed toggle latch: base plate, lever and link on it, onto the flange before each coupling`, { role: 'latch', of: latch.mount.id, ...(c.before ? { carrier: c.before } : {}) });
    }
    for (const { fastener: f, group: g } of j.screws) {
      group('section-latch-screws', 3, 'hardware').add(g);
      const carrierOf = f.piece ? { carrier: f.piece } : {};
      move(g, 3, [0.9, 1], vec.mul(f.direction, -65), `${plateScrews} × Countersunk wood screw 4 × 25: the latch plates onto the flanges’ sides`, { role: 'screw', of: f.of ?? '', drive: f.direction, axis: vector(f.direction), turns: 4, ...carrierOf });
    }
    if (j.seal) {
      group('section-seals', 5, 'hardware').add(j.seal);
      move(j.seal, 5, [0, 0.12], vec.mul(c.face.n, 120), `${sealed} × E-profile seal: stuck round the flange’s face before the next piece is laid`, { role: 'seal', ...(c.before ? { carrier: c.before } : {}) });
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
    // the printed latches close over centre in the last part of stage 5, once every piece is down
    const closing = state.exploded ? 0 : ease(THREE.MathUtils.clamp((lower - 0.6) / 0.35, 0, 1));
    for (const latch of levers) latch.setOpen(1 - closing);
    let action: string | null = active.size > 0 ? [...active].join('; ') : null;
    if (!action && state.progress > 4 && closing > 0 && closing < 1) action = `${latchCount} × Printed toggle latch: hooked over its catch, lever pressed down over centre`;
    if (!action && state.progress > 1 && state.progress < 2) action = 'Each foot is turned on its stud, from below the bearer, until the bearer top meets the string line; then its nut is jammed up against the timber';
    if (!action && state.progress > 4 && state.progress <= 5 && lower < 0.5) {
      const piece = layout.pieces[Math.min(order.length - 1, Math.floor(lower / 0.5 * order.length))];
      action = `Lowering ${piece?.name.toLowerCase() ?? 'the pieces'} onto its supports, from the window end`;
    }
    currentAction = action;
    hinge.rotation.z = state.windowOpen ? -Math.PI / 2 : 0;
    p.root.updateMatrixWorld(true);
  }
  function dispose() { p.dispose(); dock.dispose(); draw.dispose(); for (const j of joints) j.dispose(); for (const g of geometries) g.dispose(); }
  return { root: p.root, hinge, components: p.components, update, dispose, layout, motions, carriers, drops, levers, caption: () => currentAction };
}
