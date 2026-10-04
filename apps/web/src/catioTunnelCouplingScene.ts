import * as THREE from 'three';
import { toggleLatchMechanism as TL } from '@canfactory/contracts';
import { createCatioParts } from './catioParts.ts';
import type { CatioState } from './catioScene.ts';
import type { CatioMode } from './catioSettings.ts';
import type { SubassemblyModel, V3 } from './catioSubassembly.ts';
import { groundAt, vec } from './catioTunnel.ts';
import { ENTRY, tunnelCouplingLayout, tunnelCouplingSite, type TunnelCouplingConfig, type TunnelCouplingLayout, type TunnelCouplingSite } from './catioTunnelCoupling.ts';
import { buildCouplingJoint, buildSectionPieces, buildSupportPieces, supportOf, tunnelDrawing } from './catioTunnelPieces.ts';
import { memberApproach } from './catioTunnelScene.ts';

/** Stage 1 frames the first section this far above its place, then lays it on the support. */
export const LIFT = 450;
const EXPLODE = 1.8;
const ease = (t: number) => t * t * (3 - 2 * t);
/** The first three of the latch's movements, from released: hook the link on, close the lever, over centre. Stage 4 plays them. */
const CLOSING = TL.TOGGLE_LATCH_MOVEMENTS.slice(0, 3);

export interface PieceMotion {
  object: THREE.Object3D; stage: number; window: [number, number]; approach: THREE.Vector3; axis?: THREE.Vector3; turns?: number; action: string;
  role?: 'timber' | 'mesh' | 'screw' | 'staple' | 'seal' | 'latch' | 'catch' | 'bolt' | 'nut' | 'section';
  of?: string; drive?: V3;
  /** Built raised over its place with the first section, and laid with it at the end of stage 1. */
  lifted?: boolean;
}

/**
 * The coupling on its own: one of the tunnel's supports on the grass; the first section framed raised over it and laid; its joint
 * readied; the second, identical section coming in along the tunnel's axis from beyond the first, onto the same bearer, short of it
 * by the gap; the joint closed (the printed latches over centre with the shared mechanism, or the bolts and nuts); and screwed down.
 * Every piece is drawn by the tunnel's own builders (catioTunnelPieces.ts), so it is the tunnel page's joint.
 */
export function createTunnelCouplingScene(_variant: CatioMode, config: TunnelCouplingConfig, site: TunnelCouplingSite = tunnelCouplingSite()): SubassemblyModel & {
  layout: TunnelCouplingLayout; motions: PieceMotion[]; levers: ReturnType<typeof buildCouplingJoint>['latches']; lift: () => number; entry: () => number;
} {
  const layout = tunnelCouplingLayout(config, site);
  const { tl, coupling, support, before, after } = layout;
  const p = createCatioParts(); const { component, materials: m } = p;
  const hinge = new THREE.Group(); p.root.add(hinge);
  const draw = tunnelDrawing(p); const { vector } = draw;
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
  const screwMotion = (f: { direction: V3; partId: string }, length: number) => ({ role: 'screw' as const, drive: f.direction, axis: vector(f.direction), turns: 4, approach: vec.mul(f.direction, -(length + 50)) });

  // Stage 0: the grass, and the support that will carry the joint, levelled on its feet as the tunnel page builds it.
  const joint = coupling.face.at; const L = layout.sectionLength;
  const extent = { x: 1600, y0: Math.min(before.start.at[1], joint[1] - 900) - 400, y1: joint[1] + 2.6 * L };
  const ground = new THREE.PlaneGeometry(extent.x * 2, extent.y1 - extent.y0, 40, 60); geometries.push(ground);
  const position = ground.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i); const y = position.getY(i) + (extent.y0 + extent.y1) / 2;
    position.setXYZ(i, x, y, groundAt(layout.straight, x, Math.max(0, y)));
  }
  ground.computeVertexNormals();
  const turf = new THREE.Mesh(ground, m.grass); turf.receiveShadow = true; component('terrain', 0, 'environment').add(turf);
  const built = buildSupportPieces(p, draw, tl, support);
  for (const f of built.feet) {
    group('slabs', 0, 'environment').add(f.slab);
    if (f.leg) group('support', 0, 'timber').add(f.leg);
    for (const g of [f.nut, f.footPiece, ...f.screws]) group('support-feet', 0, 'hardware').add(g);
  }
  group('support', 0, 'timber').add(built.bearer);
  if (built.brace) group('support', 0, 'timber').add(built.brace);
  for (const f of tl.fasteners.filter(q => q.component === 'brace-screws' && supportOf(tl, q)?.id === support.id)) {
    const drawn = draw.fastener(f); if (drawn) group('support-feet', 0, 'hardware').add(drawn.group);
  }

  // Stage 1: the first section, framed raised over its place (rings, rails, floor, mesh), then laid on the support. Stage 3: the
  // second, built the same and whole, comes in along the tunnel from beyond the first.
  const sections = buildSectionPieces(p, draw, tl, layout.pieces);
  const entry = ENTRY(layout);
  const entering = `The second section, identical (${Math.round(after.length)} mm): in along the tunnel’s axis onto the same bearer, ${layout.gap ? `stopping ${layout.gap} mm short of the first` : 'flange to flange against the first'}`;
  const rails = sections.members.filter(q => q.member.piece === before.id && q.member.kind === 'rail').length;
  const firstWindows = { flange: [0, 0.12], rail: [0.12, 0.24], 'rail-screws': [0.24, 0.32], floor: [0.32, 0.4], 'floor-screws': [0.4, 0.46], mesh: [0.46, 0.6], staples: [0.6, 0.72] } as const;
  for (const { member, group: g } of sections.members) {
    if (member.piece === after.id) { group('second-section', 3, 'timber').add(g); move(g, 3, [0, 0.8], entry, entering, { role: 'section', of: member.id }); continue; }
    group('first-section', 1, 'timber').add(g);
    const caption = member.kind === 'flange' ? '2 × Flange ring: stood at each end of the section' : member.kind === 'rail' ? `${rails} × Rail: offered between the flanges from the side` : 'Floor board: laid onto the bottom rails';
    move(g, 1, [...firstWindows[member.kind]], memberApproach(member, before), caption, { role: 'timber', of: member.id, lifted: true });
  }
  for (const { panel, group: g } of sections.panels) {
    if (panel.piece === after.id) { group('second-section-mesh', 3, 'mesh').add(g); move(g, 3, [0, 0.8], entry, entering, { role: 'section', of: panel.id }); continue; }
    group('first-section-mesh', 1, 'mesh').add(g);
    const out = panel.id.endsWith('roof') ? vec.mul(before.frame.z, 240) : vec.mul(before.frame.x, panel.id.endsWith('left') ? -240 : 240);
    move(g, 1, [...firstWindows.mesh], out, '3 × Mesh panel: offered up to the rails', { role: 'mesh', of: panel.id, lifted: true });
  }
  const count = (component: string) => sections.fasteners.filter(q => q.fastener.component === component && q.fastener.piece === before.id).length;
  for (const { fastener: f, group: g, part } of sections.fasteners) {
    if (f.piece === after.id) { group('second-section-fixings', 3, 'hardware').add(g); move(g, 3, [0, 0.8], entry, entering, { role: 'section' }); continue; }
    group('first-section-fixings', 1, 'hardware').add(g);
    const key = f.component === 'staples' ? 'staples' : f.component === 'floor-screws' ? 'floor-screws' : 'rail-screws';
    if (part.family === 'nail') move(g, 1, [...firstWindows[key]], vec.mul(f.direction, -60), `${count('staples')} × ${part.title}: driven over the wire, every 15 cm`, { role: 'staple', drive: f.direction, lifted: true });
    else {
      const { approach, ...meta } = screwMotion(f, part.dimensions['l']?.value ?? 50);
      move(g, 1, [...firstWindows[key]], approach, `${count(f.component)} × ${part.title}: ${f.component === 'rail-screws' ? 'through the flanges into the rail ends' : 'down into the rails'}`, { ...meta, lifted: true });
    }
  }

  // Stage 2: the first section's joint readied: the seal on its flange's face, the base plates (lever and link on) on its sides.
  // The catch plates come on the second section in stage 3. Stage 4 couples, stage 5 screws both flanges down to the bearer.
  const jointPieces = buildCouplingJoint(p, draw, tl, coupling);
  if (jointPieces.seal) {
    group('seal', 2, 'hardware').add(jointPieces.seal);
    move(jointPieces.seal, 2, [0, 0.3], vec.mul(coupling.face.n, 160), 'E-profile seal: stuck round the middle of the outgoing flange’s face', { role: 'seal' });
  }
  const n = jointPieces.latches.length;
  for (const latch of jointPieces.latches) {
    group('latches', 2, 'hardware').add(latch.group);
    move(latch.group, 2, [0.3, 0.6], vec.mul(latch.mount.out, 160), `${n} × Printed toggle latch: base plate, lever and link on it, onto the outgoing flange’s outer side`, { role: 'latch', of: latch.mount.id });
  }
  for (const { mount, group: g } of jointPieces.catches) {
    group('second-section-fixings', 3, 'hardware').add(g); move(g, 3, [0, 0.8], entry, entering, { role: 'section', of: mount.id });
  }
  for (const { fastener: f, group: g } of jointPieces.screws) {
    if (f.component === 'catch-screws') { group('second-section-fixings', 3, 'hardware').add(g); move(g, 3, [0, 0.8], entry, entering, { role: 'section', ...(f.of ? { of: f.of } : {}) }); continue; }
    group('latch-screws', 2, 'hardware').add(g);
    const { approach, ...meta } = screwMotion(f, 25);
    move(g, 2, [0.6, 1], approach, `${2 * n} × Countersunk wood screw 4 × 25: the base plates onto the flange’s sides`, { ...meta, ...(f.of ? { of: f.of } : {}) });
  }
  const bolts = jointPieces.bolts.length;
  for (const { id, bolt, group: g, nut } of jointPieces.bolts) {
    group('bolts', 4, 'hardware').add(g); group('bolts', 4, 'hardware').add(nut);
    move(g, 4, [0, 0.5], vec.mul(bolt.n, -140), `${bolts} × Hexagon head screw M8 × 80: through both flanges, with a large washer`, { role: 'bolt', of: id, drive: bolt.n });
    move(nut, 4, [0.5, 1], vec.mul(bolt.n, 90), `${bolts} × Hexagon nut M8: run on from the far side over a large washer`, { role: 'nut', of: id, axis: vector(bolt.n), turns: 4 });
  }
  for (const f of layout.fixings) {
    const drawn = draw.fastener(f); if (!drawn) continue;
    group('fixings', 5, 'hardware').add(drawn.group);
    const { approach, ...meta } = screwMotion(f, 100);
    move(drawn.group, 5, [0, 0.6], approach, `${layout.fixings.length} × Countersunk wood screw 6 × 100: up through the bearer into both flanges`, meta);
  }

  const bases = motions.map(motion => motion.object.position.clone());
  const baseQuaternions = motions.map(motion => motion.object.quaternion.clone());
  const spin = new THREE.Quaternion();
  let currentAction: string | null = null; let currentLift = 0; let currentEntry = 0; let focus: V3 = [0, 0, 0];
  const at = (progress: number, stage: number) => THREE.MathUtils.clamp(progress - stage + 1, 0, 1);

  function update(state: CatioState) {
    p.update(state);
    // the first section is laid in the last part of stage 1; the second comes in through stage 3
    currentLift = state.exploded ? LIFT : LIFT * (1 - ease(THREE.MathUtils.clamp((at(state.progress, 1) - 0.76) / 0.24, 0, 1)));
    currentEntry = state.exploded ? 1 : 1 - ease(THREE.MathUtils.clamp(at(state.progress, 3) / 0.8, 0, 1));
    const active = new Set<string>();
    for (const [i, motion] of motions.entries()) {
      const base = bases[i]; const quaternion = baseQuaternions[i]; if (!base || !quaternion) continue;
      const stageT = state.progress - motion.stage + 1;
      const [a, b] = motion.window;
      const t = THREE.MathUtils.clamp((stageT - a) / (b - a), 0, 1);
      if (t > 0 && t < 1) active.add(motion.action);
      const away = state.exploded ? (motion.role === 'section' ? 1 : EXPLODE) : 1 - ease(t);
      motion.object.visible = stageT > 0 && (stageT >= 1 || t > 0 || state.exploded || motion.role === 'section');
      motion.object.position.copy(base).addScaledVector(motion.approach, motion.role === 'section' ? currentEntry : away);
      if (motion.lifted) motion.object.position.z += currentLift;
      motion.object.quaternion.copy(quaternion);
      if (motion.axis && motion.turns) motion.object.quaternion.multiply(spin.setFromAxisAngle(motion.axis.clone().normalize(), -away * motion.turns * Math.PI * 2));
    }
    // stage 4: each latch hooked on and closed over centre, the shared mechanism's movements in turn; released, they stand open
    const closing = state.exploded ? 0 : THREE.MathUtils.clamp(at(state.progress, 4) / 0.9, 0, 1);
    const index = Math.min(CLOSING.length - 1, Math.floor(closing * CLOSING.length));
    const movement = CLOSING[index]; const f = ease(closing * CLOSING.length - index);
    let latchAction: string | null = null;
    if (movement) {
      const angle = closing >= 1 ? TL.CLOSED : movement.angle[0] + (movement.angle[1] - movement.angle[0]) * f;
      const swing = closing >= 1 ? 0 : movement.swing[0] + (movement.swing[1] - movement.swing[0]) * f;
      const latchState = state.windowOpen || closing <= 0 ? null : TL.latchState(angle, swing);
      for (const latch of jointPieces.latches) { if (latchState) latch.setState(latchState); else latch.setOpen(1); }
      if (n && closing > 0 && closing < 1 && !state.windowOpen) latchAction = `${n} × Printed toggle latch: ${movement.title.charAt(0).toLowerCase()}${movement.title.slice(1)}`;
    }
    let action: string | null = active.size > 0 ? [...active].join('; ') : latchAction;
    if (!action && !state.exploded && state.progress > 0.76 && state.progress < 1) action = 'Laying the first section on the support, its outgoing flange over the bearer';
    currentAction = action;
    // the cameras follow the second section in from beyond the first while it comes, then the joint again
    focus = state.progress > 2 && state.progress < 3 && !state.exploded ? vec.mul(coupling.face.n, 0.5 * L) : [0, 0, 0];
    p.root.updateMatrixWorld(true);
  }
  function dispose() { p.dispose(); draw.dispose(); jointPieces.dispose(); for (const g of geometries) g.dispose(); }
  return {
    root: p.root, hinge, components: p.components, update, dispose, layout, motions, levers: jointPieces.latches,
    lift: () => currentLift, entry: () => currentEntry, caption: () => currentAction, focusOffset: () => focus,
  };
}
