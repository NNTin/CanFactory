import type { CatioView } from './catioDesign.ts';
import { sidePortLength, sidePortOffset, STANDARD_PORT } from './catioPort.ts';
import { PRINTED_LATCH_JOINT } from './catioPrintedLatch.ts';
import { DOOR_SEAT_DEFAULT, DOOR_SEATS, setInDoor, type DoorSeat, PORT_CLOSURE_DEFAULT, PORT_CLOSURES, slidingGateRise, type DoorPanel, type PortClosure } from './catioDoor.ts';

/** All lengths are millimetres. Grass Z=0; wall Y=0; outdoors is +Y. */
export interface EnclosureSize { width: number; depth: number; height: number }
export interface ModularConfig {
  glassWidth: number; glassHeight: number; sashWidth: number; sashHeight: number;
  enclosure: EnclosureSize; second: EnclosureSize; secondEnabled: boolean;
  /** The tunnel's clear size, both ways: the standard port is square (catioPort.ts). */
  tunnelSize: number;
  route: 'straight' | 'left' | 'right'; approach: number; lateral: number; final: number; link: number;
  /** What closes every cat port, the window's and the enclosures': a panel lifted out from behind turn buttons, or a gate slid up. */
  portClosure: PortClosure;
  /** How every set-in door is seated: the window's, the enclosures' and the tunnel's stubs'. */
  doorSeat: DoorSeat;
}
export const MODULAR_DEFAULT: ModularConfig = {
  glassWidth: 800, glassHeight: 800, sashWidth: 910, sashHeight: 910,
  enclosure: { width: 1200, depth: 1000, height: 1200 }, second: { width: 1200, depth: 1000, height: 1200 }, secondEnabled: false,
  tunnelSize: 300, route: 'straight', approach: 2, lateral: 2, final: 1, link: 2, portClosure: PORT_CLOSURE_DEFAULT, doorSeat: DOOR_SEAT_DEFAULT,
};
export const MODULAR = { timber: 40, sill: 200, floor: 4, wall: 300, recess: 150 } as const;
/**
 * The tunnel's standard elements (catioPort.ts): a module is one pitch long (the shortest section that takes a side port, and a
 * latched coupling's gap). A corner is such a module with a side port in the middle of its side: the run before couples its end
 * onto it, and its stub behind is closed by a door.
 */
export const modularPitch = (c: Pick<ModularConfig, 'tunnelSize'>) => sidePortLength(c.tunnelSize) + PRINTED_LATCH_JOINT.gap;
/** The timber round a cat port: the window's port frame and the enclosures' are both this wide. */
export const PORT_FRAME = 40;
/**
 * A cat port's removable panel (catioDoor.ts), for these port sizes: solid at the window, where it is pressed onto a seal against
 * draughts while no tunnel is docked; a framed mesh panel at an enclosure's ports.
 */
export function modularPortPanel(c: Pick<ModularConfig, 'tunnelSize' | 'doorSeat'>, at: 'window' | 'enclosure', id: string = at, stow?: [number, number, number]): DoorPanel {
  return setInDoor({ id, width: c.tunnelSize, height: c.tunnelSize, material: at === 'window' ? 'solid' : 'mesh', seat: c.doorSeat, depth: PORT_FRAME, sealed: at === 'window', sillButton: at !== 'window', ...(stow ? { stow } : {}) });
}

const STEPS: Record<PortClosure, { insert: string; ports: string; couple: string; open: { title: string; detail: string } }> = {
  'removable-panel': {
    insert: 'Keep the cat port shut: its solid panel seated on its seal, every turn button turned over it and locked by its pin. Mesh fills the remaining opening.',
    ports: 'Seat a framed mesh panel in the rear and side ports, from inside the enclosure, and turn every button over it, dropping its locking pin; unused ports stay shut.',
    couple: 'Every port’s panel stays seated and retained while connections are made.',
    open: { title: 'Open the connected ports', detail: 'With maintenance doors latched, lift every button’s locking pin and turn the buttons clear of each panel along the connected route, lift the panel out and stow it clear of the route. Before disconnecting a run, reseat the panels at both of its ends and turn every button back over them, each pin dropped.' },
  },
  'sliding-gate': {
    insert: 'Keep the small sliding cat gate closed; mesh fills the remaining opening.',
    ports: 'Fit the small sliding gates on the rear and side ports; keep unused ports closed.',
    couple: 'Gates remain closed while connections are made.',
    open: { title: 'Open the connected gates', detail: 'With maintenance doors latched, open the gates along the connected route. Before disconnecting a run, close and latch the gates at both ends.' },
  },
};
/**
 * The modular concept's stages, for its cat ports' closure. `hung`: the window insert hangs on the window frame (its default),
 * instead of being clamped into the recess.
 */
export function modularSteps(c: Pick<ModularConfig, 'portClosure'>, hung: boolean): readonly { title: string; detail: string }[] {
  const s = STEPS[c.portClosure];
  return [
    { title: 'Existing window', detail: 'Start with the inward-opening window and grass outside.' },
    { title: 'Fit the window insert', detail: `${hung ? 'Hang it on the window frame: its screen hooks reach behind the fixed frame’s lip and its feet stand on the recess floor, so the sash still closes.' : 'From inside, tighten the padded recess clamps.'} ${s.insert}` },
    { title: 'Position the enclosures', detail: 'Place each enclosure on four short feet. Fit its continuous grass-level mesh floor, skirts, walls, roof and latched front maintenance door.' },
    { title: 'Fit landings and cat ports', detail: `Add the raised rear landing and ramp. ${s.ports}` },
    { title: 'Lay the supported tunnel', detail: 'Join standard sections, one pitch (about 58 cm) each; for an offset, turn 90° twice at side ports, each the end of one run coupled onto a port in the side of the next run’s first section, its stub closed by a door: every piece ends in the same square port, so any one couples to any other. The enclosed solid walkway stays level with the sill on feet at each joint.' },
    { title: 'Couple the connections', detail: `Seat the matching rectangular collars and secure the removable clamps at every joint. ${s.couple}` },
    s.open,
  ];
}

export function validateModular(c: ModularConfig): string[] {
  const errors: string[] = [];
  const range = (n: number, low: number, high: number, name: string) => {
    if (!Number.isFinite(n) || n < low || n > high) errors.push(`${name} must be ${low / 10}–${high / 10} cm.`);
  };
  range(c.glassWidth, 400, 1400, 'Glass width'); range(c.glassHeight, 400, 1400, 'Glass height');
  range(c.sashWidth, 500, 1600, 'Sash width'); range(c.sashHeight, 500, 1600, 'Sash height');
  if (c.sashWidth - c.glassWidth < 60 || c.sashHeight - c.glassHeight < 60) errors.push('The sash needs at least 3 cm of frame on each side of the glass.');
  range(c.tunnelSize, 200, 450, 'Tunnel clear size');
  if (!PORT_CLOSURES.includes(c.portClosure)) errors.push('Choose a removable panel or a sliding gate for the cat ports.');
  if (!DOOR_SEATS.includes(c.doorSeat)) errors.push('Choose stop strips or a rebate for the doors’ seats.');
  // Only a sliding gate travels: it needs its own height again above each port. A removable panel leaves its opening, so a port
  // with one only has to fit, with its frame, where it stands; its seat, buttons and withdrawal are checked from its layout.
  const sliding = c.portClosure === 'sliding-gate';
  const frame = 2 * PORT_FRAME;
  if (c.tunnelSize + frame > c.sashWidth - 10 || (!sliding && c.tunnelSize + frame > c.sashHeight - 10)) errors.push('The cat port and its frame must fit inside the window collar.');
  if (sliding && slidingGateRise(c.tunnelSize, PORT_FRAME) > c.sashHeight - 10) errors.push('The sliding gate needs room for its full upward travel inside the window collar.');
  if (!sliding) errors.push(...new Set(['window', 'enclosure'].flatMap(at => modularPortPanel(c, at as 'window' | 'enclosure').errors)));
  for (const [label, size] of [['Enclosure A', c.enclosure], ['Enclosure B', c.second]] as const) {
    range(size.width, 800, 2400, `${label} width`); range(size.depth, 800, 2400, `${label} depth`); range(size.height, 900, 2200, `${label} height`);
    if (label === 'Enclosure B' && !c.secondEnabled) continue;
    if (sliding && MODULAR.sill + slidingGateRise(c.tunnelSize, frame) > size.height) errors.push(`${label} is too low for the raised cat gate.`);
    if (!sliding && MODULAR.sill + c.tunnelSize + frame > size.height) errors.push(`${label} is too low for its cat ports and their frames.`);
    // a panel is drawn out into the enclosure over the landing, which must be deep enough to take it
    if (!sliding && modularPortPanel(c, 'enclosure').withdraw > c.tunnelSize + 100) errors.push(`${label}’s landing is too shallow to draw a cat port’s panel out over it.`);
    if (size.depth - (c.tunnelSize + 100) - 80 < 300) errors.push(`${label} needs at least 30 cm of ramp run beyond the landing.`);
  }
  for (const [key, value] of Object.entries({ approach: c.approach, lateral: c.lateral, final: c.final, link: c.link })) {
    if (!Number.isInteger(value) || value < 1 || value > 6) errors.push(`${key} run needs 1–6 modules.`);
  }
  if (!['straight', 'left', 'right'].includes(c.route)) errors.push('Choose a straight, left or right route.');
  return errors;
}
export type Point = [number, number];
/**
 * A piece of the tunnel: a straight module, or a corner, a module with a side port in the middle of one side; `openings` are its
 * coupled ports (a corner's: its side port and its front), the others shut (a corner's back by the stub's door).
 */
export interface TunnelSection { id: string; kind: 'straight' | 'corner'; center: Point; length: number; angle: number; openings: ('back' | 'front' | 'left' | 'right')[]; /** On the link between two enclosures, not the main route. */ link?: boolean }
export interface EnclosurePlacement { id: 'a' | 'b'; centerX: number; rearY: number; size: EnclosureSize }
export function modularLayout(c: ModularConfig) {
  const sections: TunnelSection[] = [];
  // every module a pitch; a corner's side port in the middle of its side, its face the flanges' outline out from its axis
  const pitch = modularPitch(c); const gap = PRINTED_LATCH_JOINT.gap;
  const offset = sidePortOffset(c.tunnelSize); const reach = c.tunnelSize / 2 + STANDARD_PORT.ring.width + gap;
  let serial = 0;
  const run = (start: Point, angle: number, count: number, link = false): Point => {
    const dx = -Math.sin(angle); const dy = Math.cos(angle);
    for (let i = 0; i < count; i++) sections.push({ id: `tunnel-${serial++}`, kind: 'straight', center: [start[0] + dx * (i + 0.5) * pitch, start[1] + dy * (i + 0.5) * pitch], length: pitch, angle, openings: ['back', 'front'], ...(link ? { link } : {}) });
    return [start[0] + dx * count * pitch, start[1] + dy * count * pitch];
  };
  let end = run([0, 0], 0, c.approach);
  if (c.route !== 'straight') {
    const sign = c.route === 'right' ? 1 : -1;
    // the first corner runs along the wall, its side port facing back towards the window; the run out ends at it, across the gap
    const first: Point = [0, end[1] + reach];
    sections.push({ id: `tunnel-${serial++}`, kind: 'corner', center: [first[0] - sign * offset + sign * pitch / 2, first[1]], length: pitch, angle: -sign * Math.PI / 2, openings: [sign > 0 ? 'right' : 'left', 'front'] });
    end = run([first[0] - sign * offset + sign * pitch, first[1]], -sign * Math.PI / 2, c.lateral);
    // the second runs out from the wall again, its side port facing back along the wall
    const second: Point = [end[0] + sign * reach, end[1]];
    sections.push({ id: `tunnel-${serial++}`, kind: 'corner', center: [second[0], second[1] - offset + pitch / 2], length: pitch, angle: 0, openings: [sign > 0 ? 'left' : 'right', 'front'] });
    end = run([second[0], second[1] - offset + pitch], 0, c.final);
  }
  const enclosures: EnclosurePlacement[] = [{ id: 'a', centerX: end[0], rearY: end[1], size: c.enclosure }];
  if (c.secondEnabled) {
    const x = end[0] + c.enclosure.width / 2;
    run([x, end[1] + (c.tunnelSize + 100) / 2], -Math.PI / 2, c.link, true);
    enclosures.push({ id: 'b', centerX: x + c.link * pitch + c.second.width / 2, rearY: end[1], size: c.second });
  }
  const minX = Math.min(-c.sashWidth / 2 - 250, ...enclosures.map(e => e.centerX - e.size.width / 2));
  const maxX = Math.max(c.sashWidth / 2 + 250, ...enclosures.map(e => e.centerX + e.size.width / 2));
  const maxY = Math.max(...enclosures.map(e => e.rearY + e.size.depth + e.size.width)); // includes open human doors
  const maxZ = Math.max(c.sashHeight + 300, ...enclosures.map(e => e.size.height));
  return { sections, enclosures, end, bounds: { minX, maxX, maxY, maxZ } };
}
export function modularCamera(c: ModularConfig, view: CatioView, exploded: boolean) {
  const b = modularLayout(c).bounds;
  const center: [number, number, number] = [(b.minX + b.maxX) / 2, b.maxY / 2, b.maxZ / 2];
  const extent = Math.max(b.maxX - b.minX, b.maxY + 400, b.maxZ) + (exploded ? 1000 : 0);
  const vectors = { Exterior: [1.8, 1.1, 1.7], Interior: [0.65, -1.7, 0.65], Front: [0, 1.9, 0.12], Side: [1.9, 0, 0.12], Top: [0, 0.001, 2.1], Mounting: [0.5, -1.5, 0.6] };
  if (view === 'Mounting' || view === 'Interior') {
    const target: [number, number, number] = [0, -60, 200 + c.sashHeight / 2];
    return { target, position: vectors[view].map((v, i) => (target[i] ?? 0) + v * Math.max(c.sashWidth, c.sashHeight) * (exploded ? 1.6 : 1.2)) as [number, number, number] };
  }
  return { target: center, position: vectors[view].map((v, i) => (center[i] ?? 0) + v * extent) as [number, number, number] };
}
