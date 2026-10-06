import * as THREE from 'three';
import { createCatioParts } from './catioParts.ts';
import type { CatioState } from './catioScene.ts';
import { MODULAR as d, modularLayout, validateModular, type ModularConfig } from './catioModularDesign.ts';
import { buildWindowFrame } from './catioWindowContext.ts';
import { HOOK_FIT, modularWindow, savedWindowInsert, windowInsertLayout, windowProfileOf, type WindowInsertConfig } from './catioWindowInsert.ts';
import { buildHungHardware } from './catioWindowInsertScene.ts';

type V3 = [number, number, number];
export interface CatioDoor { id: string; label: string; kind: 'cat' | 'human'; connected: boolean; moving: THREE.Group[] }
export interface ModularState extends CatioState { doors?: Readonly<Record<string, boolean>> }
/**
 * The modular catio. The window is the real tilt-and-turn window; the insert follows the window insert page (`insert`, as saved
 * there by default): hung on the window frame, its collar lies on the frame's face with its screen hooks and feet, otherwise it is
 * the schematic recess collar with padded clamps.
 */
export function createModularCatio(c: ModularConfig, insert: WindowInsertConfig = savedWindowInsert()) {
  const errors = validateModular(c); if (errors.length) throw new Error(errors.join(' '));
  const p = createCatioParts(); const { component, box, rod, ring, panel, materials: m } = p;
  const layout = modularLayout(c); const doors: CatioDoor[] = [];
  const w = c.tunnelWidth; const h = c.tunnelHeight; const span = w + 80;
  const landingDepth = w + 100;
  // Assembly transforms remain on the outer component; placement and door motion have independent groups.
  function placed(x: number, y: number, angle: number, build: () => void) {
    const start = p.components.length;
    build();
    for (const part of p.components.slice(start)) {
      const pose = new THREE.Group(); pose.add(...part.group.children.slice()); part.group.add(pose);
      pose.position.set(x, y, 0); pose.rotation.z = angle;
    }
  }
  function mesh(id: string, step: number, width: number, height: number, center: V3, plane: 'xy' | 'xz' | 'yz', offset: V3 = [0, 0, 140]) {
    return panel(id, step, width, height, center, plane, offset);
  }
  // Four mesh rectangles surround an aperture. There is no full panel behind the cat gate.
  function perforated(id: string, step: number, width: number, bottom: number, top: number, y: number) {
    for (const side of [-1, 1]) mesh(`${id}-side-${side}`, step, (width - w) / 2, top - bottom, [side * (width + w) / 4, y, (top + bottom) / 2], 'xz');
    mesh(`${id}-below`, step, w, d.sill - bottom, [0, y, (bottom + d.sill) / 2], 'xz');
    mesh(`${id}-above`, step, w, top - d.sill - h, [0, y, (top + d.sill + h) / 2], 'xz');
  }
  function port(id: string, label: string, step: number, connected: boolean) {
    const frame = component(`${id}-frame`, step, 'timber', [0, 0, 100]);
    ring(frame, span, h + 80, 40, 40, 0, d.sill - 40, m.timber);
    const tracks = component(`${id}-tracks`, step, 'hardware', [0, 0, 100]);
    for (const side of [-1, 1]) box(tracks, [12, 28, 2 * h + 45], [side * (w / 2 + 16), 25, d.sill + h + 12], m.hardware);
    const leafPart = component(`${id}-gate`, step, 'timber', [0, 0, 100]);
    const leaf = new THREE.Group(); leafPart.add(leaf);
    box(leaf, [w + 20, 12, h + 20], [0, 25, d.sill + h / 2], m.endgrain);
    const hardware = component(`${id}-latch`, step, 'hardware', [0, 0, 100]);
    const movingHardware = new THREE.Group(); hardware.add(movingHardware);
    box(movingHardware, [42, 20, 12], [0, 42, d.sill + h - 35], m.hardware);
    rod(movingHardware, [w / 2 - 30, 36, d.sill + 15], [w / 2 + 24, 36, d.sill + 15], 5);
    doors.push({ id, label, kind: 'cat', connected, moving: [leaf, movingHardware] });
    if (connected) coupling(`${id}-dock`, 0, 0, 0);
  }
  function coupling(id: string, x: number, y: number, angle: number) {
    placed(x, y, angle, () => {
      const group = component(`${id}-coupling`, 5, 'hardware', [0, 50, 40]);
      // A shallow matching flange overlaps both mating timber end frames.
      ring(group, span + 8, h + 88, 4, 44, 0, d.sill - 44, m.hardware);
      for (const side of [-1, 1]) for (const z of [d.sill + 45, d.sill + h - 45]) {
        box(group, [12, 65, 20], [side * (w / 2 + 24), 0, z], m.hardware);
        box(group, [20, 25, 8], [side * (w / 2 + 24), 0, z + 14], m.rubber);
      }
    });
  }
  const b = layout.bounds;
  const terrain = component('terrain', 0, 'environment');
  const groundWidth = b.maxX - b.minX + 800; const groundDepth = b.maxY + 400;
  box(terrain, [groundWidth, groundDepth, 35], [(b.minX + b.maxX) / 2, groundDepth / 2, -17.5], m.soil);
  box(terrain, [groundWidth, groundDepth, 6], [(b.minX + b.maxX) / 2, groundDepth / 2, -3], m.grass);
  box(terrain, [groundWidth, 850, 35], [(b.minX + b.maxX) / 2, -725, -467.5], m.floor);
  const blades = new THREE.InstancedMesh(new THREE.ConeGeometry(3, 18, 3), m.blade, 1800);
  const bladePose = new THREE.Object3D();
  for (let i = 0; i < blades.count; i++) {
    bladePose.position.set(b.minX - 380 + ((i * 743) % (groundWidth - 40)), 20 + ((i * 431) % (groundDepth - 40)), 7);
    bladePose.rotation.set(Math.PI / 2, 0, i); bladePose.updateMatrix(); blades.setMatrixAt(i, bladePose.matrix);
  }
  terrain.add(blades);
  const wall = component('wall', 0, 'environment');
  const fixedW = c.sashWidth + 90; const fixedH = c.sashHeight + 90; const wallTop = Math.max(b.maxZ + 250, 1800);
  for (const side of [-1, 1]) box(wall, [400, 300, wallTop + 450], [side * (fixedW / 2 + 200), -150, (wallTop - 450) / 2], m.wall);
  box(wall, [fixedW, 300, 605], [0, -150, -147.5], m.wall);
  box(wall, [fixedW, 300, wallTop - 155 - fixedH], [0, -150, (wallTop + 155 + fixedH) / 2], m.wall);
  const window = modularWindow(c, windowProfileOf(insert));
  const { hinge } = buildWindowFrame(p, window);
  const hanging = windowInsertLayout('modular', insert, window);
  const hung = hanging.hooks.length > 0;
  // the collar's middle and back: on the frame's face when hung; the port frame stands far enough out that its gate latch, 52 mm
  // behind it, stays in front of the closed sash
  const collarY = hung ? hanging.yIn + 30 : -60; const collarBack = collarY - 30;
  const portY = hung ? Math.max(collarY, hanging.frame.sashFace + HOOK_FIT.gap + 52) : -60;
  const collar = component('recess-collar', 1, 'timber', [0, -220, 120]);
  const collarWidth = hung ? hanging.W : c.sashWidth + 70; const collarTop = hung ? hanging.z0 + hanging.H : 160 + c.sashHeight + 70;
  ring(collar, collarWidth, collarTop - 160, 40, 60, collarY, 160, m.timber);
  if (hung) {
    const hooks = component('screen-hooks', 1, 'hardware', [0, -220, 120]);
    buildHungHardware(p, { ...hanging, gap: 160 - window.recessFloor, clamps: hanging.clamps.map(cl => ({ ...cl, at: [cl.at[0], cl.at[1], 160] })) }, hooks, hooks);
  } else {
    const clamps = component('padded-clamps', 1, 'hardware', [0, -220, 120]);
    for (const side of [-1, 1]) for (const z of [320, c.sashHeight + 50]) {
      rod(clamps, [side * (c.sashWidth / 2 - 30), -60, z], [side * (fixedW / 2 - 4), -60, z], 5);
      box(clamps, [8, 55, 65], [side * (fixedW / 2 - 4), -60, z], m.rubber);
      box(clamps, [12, 25, 45], [side * (c.sashWidth / 2 - 30), -60, z], m.hardware);
    }
  }
  perforated('window-infill', 1, collarWidth - 80, 200, hung ? collarTop - 10 : c.sashHeight + 190, collarY);
  placed(0, portY, Math.PI, () => port('window-cat', 'Window cat gate', 1, true));
  const threshold = component('window-threshold', 1, 'timber', [0, -220, 120]);
  box(threshold, [w, -collarBack, 18], [0, collarBack / 2, 191], m.endgrain);
  // The insert–tunnel coupling's docking frame (schematic): stiles and a head, the flange's outline, from the port to the wall face.
  const dockingFrame = component('window-docking-frame', 1, 'timber', [0, -220, 120]);
  for (const side of [-1, 1]) box(dockingFrame, [70, -collarBack, h + 70], [side * (w / 2 + 35), collarBack / 2, 200 + (h + 70) / 2]);
  box(dockingFrame, [w, -collarBack, 70], [0, collarBack / 2, 200 + h + 35]);

  for (const e of layout.enclosures) placed(e.centerX, e.rearY, 0, () => {
    const { width: ew, depth: ed, height: eh } = e.size; const half = ew / 2; const id = e.id;
    const frame = component(`${id}-frame`, 2, 'timber', [0, 100, 200]);
    const feet = component(`${id}-four-feet`, 2, 'hardware', [0, 150, 0]);
    for (const x of [-half + 20, half - 20]) {
      for (const y of [20, ed - 20]) {
        box(frame, [40, 40, eh - 90], [x, y, (eh + 90) / 2]);
        rod(feet, [x, y, 8], [x, y, 90], 9); box(feet, [55, 55, 8], [x, y, 4], m.rubber);
      }
      for (const z of [90, eh - 20]) box(frame, [40, ed, 40], [x, ed / 2, z]);
    }
    for (const y of [20, ed - 20]) for (const z of [90, eh - 20]) box(frame, [ew - 80, 40, 40], [0, y, z]);
    for (const x of [-half + 7, half - 7]) box(frame, [14, ed, 14], [x, ed / 2, 11], m.endgrain);
    for (const y of [7, ed - 7]) box(frame, [ew - 28, 14, 14], [0, y, 11], m.endgrain);
    mesh(`${id}-continuous-floor`, 2, ew, ed, [0, ed / 2, 4], 'xy', [0, 150, 0]);
    for (const x of [-half, half]) mesh(`${id}-floor-skirt-${x}`, 2, ed, 86, [x, ed / 2, 47], 'yz', [0, 150, 0]);
    for (const y of [0, ed]) mesh(`${id}-floor-skirt-end-${y}`, 2, ew, 86, [0, y, 47], 'xz', [0, 150, 0]);
    mesh(`${id}-roof`, 2, ew, ed, [0, ed / 2, eh - 10], 'xy', [0, 0, 400]);
    perforated(`${id}-rear-mesh`, 2, ew, 90, eh, 0);
    port(`${id}-rear`, `Enclosure ${id.toUpperCase()} rear cat gate`, 3, id === 'a');
    for (const side of [-1, 1]) placed(side * half, landingDepth / 2, side * Math.PI / 2, () => {
      // Side faces have asymmetric extents around the rear landing's port.
      const backRun = landingDepth / 2 - w / 2; const frontRun = ed - landingDepth / 2 - w / 2;
      const sign = side > 0 ? 1 : -1;
      mesh(`${id}-side-${side}-rear`, 2, backRun, eh - 90, [-sign * (w + backRun) / 2, 0, (eh + 90) / 2], 'xz');
      mesh(`${id}-side-${side}-front`, 2, frontRun, eh - 90, [sign * (w + frontRun) / 2, 0, (eh + 90) / 2], 'xz');
      mesh(`${id}-side-${side}-below`, 2, w, 110, [0, 0, 145], 'xz');
      mesh(`${id}-side-${side}-above`, 2, w, eh - 200 - h, [0, 0, (eh + 200 + h) / 2], 'xz');
      port(`${id}-${side < 0 ? 'left' : 'right'}`, `Enclosure ${id.toUpperCase()} ${side < 0 ? 'left' : 'right'} cat gate`, 3, c.secondEnabled && (id === 'a' ? side > 0 : side < 0));
    });
    const landing = component(`${id}-landing-and-ramp`, 3, 'timber', [0, 140, 180]);
    box(landing, [ew - 80, landingDepth, 18], [0, landingDepth / 2, 191], m.endgrain);
    // Bridge the landing's frame clearance to the side docking thresholds.
    for (const side of [-1, 1]) box(landing, [80, w, 18], [side * (half - 20), landingDepth / 2, 191], m.endgrain);
    const run = ed - landingDepth - 80; const drop = 178;
    const ramp = box(landing, [w, Math.hypot(run, drop), 18], [0, landingDepth + run / 2, 102], m.endgrain); ramp.rotation.x = -Math.atan2(drop, run);
    for (let dy = 60; dy < run; dy += 100) {
      const cleat = box(landing, [w, 18, 8], [0, landingDepth + dy, 204 - drop * dy / run]); cleat.rotation.x = ramp.rotation.x;
    }
    const dw = ew - 86; const dh = eh - 136;
    const doorTimber = component(`${id}-human-door`, 2, 'timber', [0, 300, 0]);
    ring(doorTimber, dw, dh, 40, 30, 0, 0, m.timber);
    const doorMesh = mesh(`${id}-human-door-mesh`, 2, dw, dh, [0, 0, dh / 2], 'xz', [0, 300, 0]);
    const doorMetal = component(`${id}-human-door-hardware`, 2, 'hardware', [0, 300, 0]);
    box(doorMetal, [65, 15, 22], [dw / 2 - 22, 24, dh / 2], m.hardware);
    for (const z of [120, dh - 120]) box(doorMetal, [70, 12, 25], [-dw / 2, 22, z], m.hardware);
    const moving = [doorTimber, doorMesh, doorMetal].map(part => {
      const pivot = new THREE.Group(); pivot.position.set(-dw / 2, ed, 113);
      const centered = new THREE.Group(); centered.position.x = dw / 2;
      centered.add(...part.children.slice()); pivot.add(centered); part.add(pivot); return pivot;
    });
    doors.push({ id: `${id}-human`, label: `Enclosure ${id.toUpperCase()} maintenance door`, kind: 'human', connected: true, moving });
  });

  for (const section of layout.sections) placed(...section.center, section.angle, () => {
    const id = section.id; const length = section.length;
    const frame = component(`${id}-frame`, 4, 'timber', [0, 0, 250]);
    box(frame, [span, length, 18], [0, 0, 191], m.endgrain);
    for (const x of [-w / 2 - 20, w / 2 + 20]) for (const y of [-length / 2 + 20, length / 2 - 20]) box(frame, [40, 40, h + 40], [x, y, 200 + (h + 40) / 2]);
    for (const y of [-length / 2 + 20, length / 2 - 20]) box(frame, [span, 40, 40], [0, y, 200 + h + 20]);
    for (const x of [-w / 2 - 20, w / 2 + 20]) box(frame, [40, length, 40], [x, 0, 200 + h + 20]);
    mesh(`${id}-roof`, 4, span, length, [0, 0, 200 + h + 5], 'xy', [0, 0, 300]);
    for (const side of ['left', 'right', 'back', 'front'] as const) {
      if (section.openings.includes(side)) continue;
      const lateral = side === 'left' || side === 'right'; const sign = side === 'left' || side === 'back' ? -1 : 1;
      mesh(`${id}-${side}`, 4, lateral ? length : span, h + 20, lateral ? [sign * (w / 2 + 20), 0, 200 + (h + 20) / 2] : [0, sign * (length / 2 - 20), 200 + (h + 20) / 2], lateral ? 'yz' : 'xz', [0, 0, 250]);
    }
    const supports = component(`${id}-feet`, 4, 'hardware', [0, 0, 80]);
    for (const x of [-w / 2 - 20, w / 2 + 20]) for (const y of [-length / 2 + 20, length / 2 - 20]) {
      rod(supports, [x, y, 8], [x, y, 182], 8); box(supports, [55, 55, 8], [x, y, 4], m.rubber);
    }
    for (const side of section.openings) {
      const sign = side === 'back' || side === 'left' ? -1 : 1;
      const lateral = side === 'left' || side === 'right';
      coupling(`${id}-${side}`, lateral ? sign * span / 2 : 0, lateral ? 0 : sign * length / 2, lateral ? Math.PI / 2 : 0);
    }
  });
  function update(state: ModularState) {
    p.update(state); hinge.rotation.z = state.windowOpen ? -Math.PI / 2 : 0;
    for (const door of doors) {
      const open = door.connected && (state.doors?.[door.id] ?? door.kind === 'cat');
      for (const moving of door.moving) {
        if (door.kind === 'cat') moving.position.z = open ? (h + 30) * THREE.MathUtils.clamp(state.progress - 5, 0, 1) : 0;
        else moving.rotation.z = open ? Math.PI / 2 : 0;
      }
    }
    p.root.updateMatrixWorld(true);
  }
  return { ...p, hinge, doors, layout, update };
}
