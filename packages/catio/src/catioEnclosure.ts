import { CATIO, ROOF_NET, roofBearers } from './catioDesign.ts';
import { MODULAR as d, type EnclosureSize } from './catioModularDesign.ts';
import { frameAlong, type Face } from './catioPort.ts';
import type { V3 } from './catioSubassembly.ts';

/**
 * The enclosure: a timber frame on four feet, meshed all round, its floor and roof netted, a cat port in its rear and in each side
 * over a raised landing and ramp, and a hinged maintenance door at its front. Millimetres, in the enclosure's own coordinates: X
 * across its width from its middle, Y from its rear face (0) to its front (`depth`), Z up from the grass. Each side wall is set out
 * in its own frame (`EnclosureWall`), as a port's frame is: X along the wall, Y out of it.
 */
export interface EnclosureBox { size: V3; center: V3; material?: 'endgrain' | 'rubber' }
export interface EnclosureRod { from: V3; to: V3; radius: number }
/** A mesh panel in a plane through `center`; `explode` is how far it moves out in the exploded view. */
export interface EnclosureMesh { id: string; width: number; height: number; center: V3; plane: 'xy' | 'xz' | 'yz'; explode: V3 }
/**
 * A cat port: the standard port (catioPort.ts) of a tunnel's size. Its frame stands at `at` turned by `angle` about Z, its opening
 * facing −Y (out of the enclosure); `face` is that opening's face, where a tunnel docks, in the enclosure's coordinates.
 */
export interface EnclosurePort { id: string; side: 'rear' | 'left' | 'right'; connected: boolean; at: [number, number]; angle: number; face: Face }
/** A side wall, in its own frame (at `at`, turned by `angle`): its mesh round its port, and the port. */
export interface EnclosureWall { side: 'left' | 'right'; at: [number, number]; angle: number; mesh: EnclosureMesh[]; port: EnclosurePort }
/** The ramp: a board tilted about X by `tilt`, its cleats tilted with it. */
export interface EnclosureRamp { board: EnclosureBox; cleats: EnclosureBox[]; tilt: number }
/** The maintenance door: a framed mesh leaf, `width` × `height`, hinged on its left edge at `hinge`, its hardware on its leaf. */
export interface EnclosureDoor { width: number; height: number; member: number; depth: number; hinge: V3; hardware: EnclosureBox[] }

export interface EnclosureOptions {
  /** The enclosure's id ('a', 'b'), the prefix of every piece's id. */
  id: string;
  /** The standard port's clear size, both ways (`ModularConfig.tunnelSize`). */
  tunnelSize: number;
  /** Which of its cat ports a tunnel docks to. */
  connected: Record<EnclosurePort['side'], boolean>;
}

/**
 * Four mesh panels round a port's opening in a wall (`plane` xz, at `y`): either side of it and below and above it. There is no
 * full panel behind the port. The wall runs from `bottom` to `top`; the opening, `size` square, stands on the sill.
 */
export function meshAroundPort(id: string, width: number, bottom: number, top: number, y: number, size: number, explode: V3 = [0, 0, 140]): EnclosureMesh[] {
  const panel = (suffix: string, w: number, h: number, center: V3): EnclosureMesh => ({ id: `${id}-${suffix}`, width: w, height: h, center, plane: 'xz', explode });
  return [
    ...[-1, 1].map(side => panel(`side-${side}`, (width - size) / 2, top - bottom, [side * (width + size) / 4, y, (top + bottom) / 2])),
    panel('below', size, d.sill - bottom, [0, y, (bottom + d.sill) / 2]),
    panel('above', size, top - d.sill - size, [0, y, (top + d.sill + size) / 2]),
  ];
}

export function enclosureLayout(size: EnclosureSize, { id, tunnelSize: w, connected }: EnclosureOptions) {
  const { width: ew, depth: ed, height: eh } = size; const half = ew / 2; const h = w;
  const landingDepth = w + 100;
  const mesh = (suffix: string, width: number, height: number, center: V3, plane: EnclosureMesh['plane'], explode: V3 = [0, 0, 140]): EnclosureMesh =>
    ({ id: `${id}-${suffix}`, width, height, center, plane, explode });
  const port = (side: EnclosurePort['side'], at: [number, number], angle: number): EnclosurePort => {
    const n: V3 = [Math.round(Math.sin(angle)) || 0, -Math.round(Math.cos(angle)) || 0, 0];
    return { id: `${id}-${side}`, side, connected: connected[side], at, angle, face: { at: [at[0], at[1], d.sill], n, frame: frameAlong(n) } };
  };

  // posts and sole rails on four feet, top rails, and the floor's sill all round
  const frame: EnclosureBox[] = []; const rods: EnclosureRod[] = []; const pads: EnclosureBox[] = [];
  for (const x of [-half + 20, half - 20]) {
    for (const y of [20, ed - 20]) {
      frame.push({ size: [40, 40, eh - 90], center: [x, y, (eh + 90) / 2] });
      rods.push({ from: [x, y, 8], to: [x, y, 90], radius: 9 }); pads.push({ size: [55, 55, 8], center: [x, y, 4], material: 'rubber' });
    }
    for (const z of [90, eh - 20]) frame.push({ size: [40, ed, 40], center: [x, ed / 2, z] });
  }
  for (const y of [20, ed - 20]) for (const z of [90, eh - 20]) frame.push({ size: [ew - 80, 40, 40], center: [0, y, z] });
  for (const x of [-half + 7, half - 7]) frame.push({ size: [14, ed, 14], center: [x, ed / 2, 11], material: 'endgrain' });
  for (const y of [7, ed - 7]) frame.push({ size: [ew - 28, 14, 14], center: [0, y, 11], material: 'endgrain' });

  const floor = [
    mesh('continuous-floor', ew, ed, [0, ed / 2, 4], 'xy', [0, 150, 0]),
    ...[-half, half].map(x => mesh(`floor-skirt-${x}`, ed, 86, [x, ed / 2, 47], 'yz', [0, 150, 0])),
    ...[0, ed].map(y => mesh(`floor-skirt-end-${y}`, ew, 86, [0, y, 47], 'xz', [0, 150, 0])),
  ];
  // The net roof lies on cross rails between the side rails, so that it neither sags nor bags under a cat on top of it.
  const bearers: EnclosureBox[] = roofBearers(ed - 80).map(y => ({ size: [ew - 80, ROOF_NET.bearer.width, ROOF_NET.bearer.depth], center: [0, 40 + y, eh - 10 - CATIO.wire / 2 - ROOF_NET.bearer.depth / 2] }));
  const roof = mesh('roof', ew, ed, [0, ed / 2, eh - 10], 'xy', [0, 0, 400]);

  const rear = { mesh: meshAroundPort(`${id}-rear-mesh`, ew, 90, eh, 0, w), port: port('rear', [0, 0], 0) };
  // Side faces have asymmetric extents around the rear landing's port.
  const sides: EnclosureWall[] = ([-1, 1] as const).map(side => {
    const backRun = landingDepth / 2 - w / 2; const frontRun = ed - landingDepth / 2 - w / 2;
    const name = side < 0 ? 'left' : 'right'; const at: [number, number] = [side * half, landingDepth / 2]; const angle = side * Math.PI / 2;
    return { side: name, at, angle, port: port(name, at, angle), mesh: [
      mesh(`side-${side}-rear`, backRun, eh - 90, [-side * (w + backRun) / 2, 0, (eh + 90) / 2], 'xz'),
      mesh(`side-${side}-front`, frontRun, eh - 90, [side * (w + frontRun) / 2, 0, (eh + 90) / 2], 'xz'),
      mesh(`side-${side}-below`, w, 110, [0, 0, 145], 'xz'),
      mesh(`side-${side}-above`, w, eh - 200 - h, [0, 0, (eh + 200 + h) / 2], 'xz'),
    ] };
  });

  // the landing behind the rear port, bridged to the side ports' thresholds over the frame's clearance, and the ramp down from it
  const landing: EnclosureBox[] = [
    { size: [ew - 80, landingDepth, 18], center: [0, landingDepth / 2, 191], material: 'endgrain' },
    ...[-1, 1].map((side): EnclosureBox => ({ size: [80, w, 18], center: [side * (half - 20), landingDepth / 2, 191], material: 'endgrain' })),
  ];
  const run = ed - landingDepth - 80; const drop = 178; const tilt = -Math.atan2(drop, run);
  const cleats: EnclosureBox[] = [];
  for (let dy = 60; dy < run; dy += 100) cleats.push({ size: [w, 18, 8], center: [0, landingDepth + dy, 204 - drop * dy / run] });
  const ramp: EnclosureRamp = { board: { size: [w, Math.hypot(run, drop), 18], center: [0, landingDepth + run / 2, 102], material: 'endgrain' }, cleats, tilt };

  const dw = ew - 86; const dh = eh - 136;
  const door: EnclosureDoor = { width: dw, height: dh, member: 40, depth: 30, hinge: [-dw / 2, ed, 113], hardware: [
    { size: [65, 15, 22], center: [dw / 2 - 22, 24, dh / 2] },
    ...[120, dh - 120].map((z): EnclosureBox => ({ size: [70, 12, 25], center: [-dw / 2, 22, z] })),
  ] };
  const doorMesh = mesh('human-door-mesh', dw, dh, [0, 0, dh / 2], 'xz', [0, 300, 0]);

  return { id, size, landingDepth, frame, feet: { rods, pads }, floor, bearers, roof, rear, sides, ports: [rear.port, ...sides.map(s => s.port)], landing, ramp, door, doorMesh };
}
export type EnclosureLayout = ReturnType<typeof enclosureLayout>;
