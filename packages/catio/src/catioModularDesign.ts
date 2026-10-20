import { sidePortLength } from './catioPort.ts';
import { PRINTED_LATCH_JOINT } from './catioPrintedLatch.ts';
import { DOOR_SEAT_DEFAULT, DOOR_SEATS, setInDoor, type DoorSeat, PORT_CLOSURE_DEFAULT, PORT_CLOSURES, slidingGateRise, type DoorPanel, type PortClosure } from './catioDoor.ts';

/**
 * The window's sizes and the cat ports' settings of the catio with a tunnel (the sub-assembly pages' `modular` variant): one
 * standard square port at the window and at every enclosure, all shut by the same closure and seated alike. The catio planner holds
 * them in its project (a window's params, the project's settings); the sub-assembly pages take them from there.
 * All lengths are millimetres. Grass Z=0; wall Y=0; outdoors is +Y.
 */
export interface EnclosureSize { width: number; depth: number; height: number }
export interface ModularConfig {
  glassWidth: number; glassHeight: number; sashWidth: number; sashHeight: number;
  /** The tunnel's clear size, both ways: the standard port is square (catioPort.ts). */
  tunnelSize: number;
  /** What closes every cat port, the window's and the enclosures': a panel lifted out from behind turn buttons, or a gate slid up. */
  portClosure: PortClosure;
  /** How every set-in door is seated: the window's, the enclosures' and the tunnel's stubs'. */
  doorSeat: DoorSeat;
}
export const MODULAR_DEFAULT: ModularConfig = {
  glassWidth: 800, glassHeight: 800, sashWidth: 910, sashHeight: 910, tunnelSize: 300, portClosure: PORT_CLOSURE_DEFAULT, doorSeat: DOOR_SEAT_DEFAULT,
};
/** An enclosure's timber, and where its cat ports' floor stands above the grass by default. */
export const MODULAR = { timber: 40, sill: 200 } as const;
/**
 * The tunnel's standard elements (catioPort.ts): a module is one pitch long (the shortest section that takes a side port, and a
 * latched coupling's gap).
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

const range = (errors: string[], n: number, low: number, high: number, name: string) => {
  if (!Number.isFinite(n) || n < low || n > high) errors.push(`${name} must be ${low / 10}–${high / 10} cm.`);
};
/** The window's sizes and the cat ports' settings: whether the port, its frame and its closure fit the window. */
export function validateModular(c: ModularConfig): string[] {
  const errors: string[] = [];
  range(errors, c.glassWidth, 400, 1400, 'Glass width'); range(errors, c.glassHeight, 400, 1400, 'Glass height');
  range(errors, c.sashWidth, 500, 1600, 'Sash width'); range(errors, c.sashHeight, 500, 1600, 'Sash height');
  if (c.sashWidth - c.glassWidth < 60 || c.sashHeight - c.glassHeight < 60) errors.push('The sash needs at least 3 cm of frame on each side of the glass.');
  range(errors, c.tunnelSize, 200, 450, 'Tunnel clear size');
  if (!PORT_CLOSURES.includes(c.portClosure)) errors.push('Choose a removable panel or a sliding gate for the cat ports.');
  if (!DOOR_SEATS.includes(c.doorSeat)) errors.push('Choose stop strips or a rebate for the doors’ seats.');
  // Only a sliding gate travels: it needs its own height again above each port. A removable panel leaves its opening, so a port
  // with one only has to fit, with its frame, where it stands; its seat, buttons and withdrawal are checked from its layout.
  const sliding = c.portClosure === 'sliding-gate';
  const frame = 2 * PORT_FRAME;
  if (c.tunnelSize + frame > c.sashWidth - 10 || (!sliding && c.tunnelSize + frame > c.sashHeight - 10)) errors.push('The cat port and its frame must fit inside the window collar.');
  if (sliding && slidingGateRise(c.tunnelSize, PORT_FRAME) > c.sashHeight - 10) errors.push('The sliding gate needs room for its full upward travel inside the window collar.');
  if (!sliding) errors.push(...new Set(['window', 'enclosure'].flatMap(at => modularPortPanel(c, at as 'window' | 'enclosure').errors)));
  return errors;
}
/** An enclosure's outside dimensions (`label` names it), with cat ports of `c`: whether they, their closures and its ramp fit it. */
export function validateEnclosure(size: EnclosureSize, c: Pick<ModularConfig, 'tunnelSize' | 'portClosure' | 'doorSeat'>, label: string): string[] {
  const errors: string[] = [];
  range(errors, size.width, 800, 2400, `${label} width`); range(errors, size.depth, 800, 2400, `${label} depth`); range(errors, size.height, 900, 2200, `${label} height`);
  const sliding = c.portClosure === 'sliding-gate';
  const frame = 2 * PORT_FRAME;
  if (sliding && MODULAR.sill + slidingGateRise(c.tunnelSize, frame) > size.height) errors.push(`${label} is too low for the raised cat gate.`);
  if (!sliding && MODULAR.sill + c.tunnelSize + frame > size.height) errors.push(`${label} is too low for its cat ports and their frames.`);
  // a panel is drawn out into the enclosure over the landing, which must be deep enough to take it
  if (!sliding && modularPortPanel(c, 'enclosure').withdraw > c.tunnelSize + 100) errors.push(`${label}’s landing is too shallow to draw a cat port’s panel out over it.`);
  if (size.depth - (c.tunnelSize + 100) - 80 < 300) errors.push(`${label} needs at least 30 cm of ramp run beyond the landing.`);
  return errors;
}
