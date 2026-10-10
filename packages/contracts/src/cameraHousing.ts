import { Type, type Static } from 'typebox';
import { devBoardLayout, dimensionOf, findPart, ISO_273_CLEARANCE_HOLES, parts } from './parts/index.ts';
import type { Assembly, LinkedReference, ParameterIssue } from './models.ts';

export const CAMERA_BOARD_ID = 'seeed-xiao-esp32s3-sense';
export const CAMERA_LID_INSERT = 'ruthex-rx-m2x4';
export const CAMERA_MOUNT_INSERTS = ['ruthex-rx-m3x5-7', 'cnc-kitchen-m3x3', 'cnc-kitchen-m4x4', 'ruthex-rx-m4x8-1'] as const;
export function cameraHardwarePart(id: string) {
  const part = findPart(id);
  if (!part) throw new Error(`Missing camera housing hardware: ${id}`);
  return part;
}
const board = cameraHardwarePart(CAMERA_BOARD_ID);
const layout = devBoardLayout(board);
if (!layout) throw new Error('The camera board needs a development-board layout.');
const camera = layout.components.find(c => c.kind === 'camera');
const expansion = layout.components.find(c => c.kind === 'pcb');
const charge = layout.components.find(c => c.name === 'Red charge LED');
const locator = layout.pins[3];
const lens = camera?.top;
if (!camera || !expansion || !charge || !locator || !lens) throw new Error('Incomplete Sense camera stack layout.');
export const CAMERA_HARDWARE = {
  width: dimensionOf(board, 'W'), length: dimensionOf(board, 'L'), thickness: dimensionOf(board, 't'), height: dimensionOf(board, 'H'),
  usbOverhang: dimensionOf(board, 'usbOverhang'), usbHeight: dimensionOf(board, 'usbH'),
  locatorX: Math.abs(locator.x - dimensionOf(board, 'W') / 2), locatorY: locator.y,
  cameraX: camera.x, cameraY: camera.y, lensDiameter: lens.width,
  expansionTop: dimensionOf(board, 't') + (expansion.base ?? 0) + expansion.height,
  chargeY: charge.y, chargeZ: dimensionOf(board, 't') + charge.height / 2,
  antennaY: layout.externalAntenna?.kind === 'connector' ? layout.externalAntenna.y : 0,
  lidBossRadius: 4, lidCornerInset: 5.1, lidHoleDepth: 7.5, screwHole: ISO_273_CLEARANCE_HOLES['M2'].medium, seamAbovePcb: 5,
} as const;
const mm = (title: string, description: string, value: number, min: number, max: number, step = 0.2) =>
  Type.Number({ title, description, default: value, minimum: min, maximum: max, multipleOf: step });
export const CameraHousingParametersSchema = Type.Object({
  board: Type.Enum([CAMERA_BOARD_ID], { title: 'Camera board', description: 'Sense stack without pin headers or an upgraded heatsink.', default: CAMERA_BOARD_ID }),
  width: mm('Housing width', 'Outside width in mm; must leave room for the rear mounting bosses.', 48, 42, 80, 1),
  length: mm('Housing length', 'Outside length in mm. The board stays near the USB end as this changes.', 46, 40, 80, 1),
  mountInsert: Type.Enum(CAMERA_MOUNT_INSERTS, { title: 'Mounting inserts', description: 'Two blind, rear-facing heat-set inserts for attaching the enclosure to your own bracket.', default: CAMERA_MOUNT_INSERTS[0] }),
  mountSpacing: mm('Mount spacing', 'Centre distance of the two rear mounting inserts, in mm.', 34, 28, 60, 1),
  cameraDiameter: mm('Camera opening', 'Through-hole diameter in mm. Measure your lens and check the field of view before printing.', 12, 10, 20),
  cameraOffsetX: mm('Camera alignment X', 'Aperture offset from the nominal lens centre, across the board, in mm.', 0, -3, 3, 0.1),
  cameraOffsetY: mm('Camera alignment Y', 'Aperture offset towards the USB end, in mm.', 0, -3, 3, 0.1),
  antennaDiameter: mm('Antenna exit', 'Split cable opening on the left side, in mm. Lay the pre-connected U.FL lead in before closing.', 5, 3, 8),
  batteryDiameter: mm('Battery wire exit', 'Split opening on the right side for wires to the underside BAT pads, in mm. Battery remains external.', 4, 2, 8),
  chargeWindow: Type.Boolean({ title: 'Charge LED window', description: 'A 2.4 mm side sight hole towards the red charge LED; not a light pipe.', default: true }),
  ventilation: Type.Boolean({ title: 'Ventilation', description: 'Three roof slots behind the board. Indoor enclosure only, not waterproof.', default: true }),
  wall: mm('Wall thickness', 'Shell and roof thickness, in mm.', 2, 1.6, 3.6),
  standoff: mm('Under-board clearance', 'Distance from floor to PCB underside, leaving room for components and battery solder joints.', 4, 3, 8),
  headroom: mm('Camera headroom', 'Space from the published 15 mm stack envelope to the roof underside.', 1.2, 0.8, 4),
  boardFit: mm('Board clearance', 'Lateral play per side in the PCB guides, in mm.', 0.3, 0.2, 0.8, 0.1),
  seamFit: mm('Lid seam clearance', 'Vertical gap between the tray and hood, in mm; the four screws locate and secure the hood.', 0.2, 0.15, 0.45, 0.05),
  usbRecess: mm('USB recess', 'Additional distance of the socket behind the inner front wall, in mm. Total recess includes the wall.', 2, 0, 6),
  usbWidth: mm('USB plug opening width', 'Clear width for your USB-C cable moulding, in mm.', 14, 12, 20),
  usbHeight: mm('USB plug opening height', 'Clear height for your USB-C cable moulding, in mm.', 8, 6, 12),
}, { additionalProperties: false });
export type CameraHousingParameters = Static<typeof CameraHousingParametersSchema>;
export const DEFAULT_CAMERA_HOUSING = Object.fromEntries(Object.entries(CameraHousingParametersSchema.properties).map(([key, value]) => [key, 'default' in value ? value.default : undefined])) as CameraHousingParameters;

/** Same centred XY / Z-up frame as generator.scad. The roof prints down and is rotated 180° about X for assembly. */
export function cameraHousingLayout(p: CameraHousingParameters) {
  const h = CAMERA_HARDWARE;
  const insert = cameraHardwarePart(p.mountInsert);
  const boardY = p.length / 2 - p.wall - h.usbOverhang - p.usbRecess - h.length;
  const boardZ = p.wall + p.standoff;
  const seam = boardZ + h.thickness + h.seamAbovePcb;
  const roof = boardZ + h.height + p.headroom;
  const top = roof + p.wall;
  const grip = top - seam;
  const screw = parts.find(part => part.family === 'screw' && part.attributes['standard'] === 'ISO 4762' && part.attributes['thread'] === 'M2'
    && dimensionOf(part, 'l') >= grip + 3 - 1e-9 && dimensionOf(part, 'l') <= grip + h.lidHoleDepth - 0.3 + 1e-9);
  return {
    boardY, boardZ, seam, roof, top, grip, screw,
    lens: [h.cameraX - h.width / 2, boardY + h.cameraY] as [number, number],
    aperture: [h.cameraX - h.width / 2 + p.cameraOffsetX, boardY + h.cameraY + p.cameraOffsetY] as [number, number],
    usbZ: boardZ + h.thickness + h.usbHeight / 2,
    mountRadius: dimensionOf(insert, 'hole') / 2 + dimensionOf(insert, 'wall'), mountDepth: dimensionOf(insert, 'holeDepth'),
    corners: [-1, 1].flatMap(x => [-1, 1].map(y => [x * (p.width / 2 - h.lidCornerInset), y * (p.length / 2 - h.lidCornerInset)] as [number, number])),
  };
}

export function cameraHousingIssues(p: CameraHousingParameters): ParameterIssue[] {
  const h = CAMERA_HARDWARE, l = cameraHousingLayout(p), issues: ParameterIssue[] = [];
  const issue = (field: string, message: string) => issues.push({ field, message });
  if (p.mountSpacing / 2 + l.mountRadius > p.width / 2 - p.wall + 1e-9)
    issue('mountSpacing', 'Widen the housing or reduce mount spacing to leave the insert maker’s required wall.');
  if (p.mountSpacing / 2 - l.mountRadius < h.width / 2 + p.boardFit + 2)
    issue('mountSpacing', 'Increase mount spacing: the mounting bosses must clear the board guides.');
  if (l.mountDepth + p.wall >= l.seam - p.seamFit)
    issue('standoff', 'Increase under-board clearance: the mounting holes need a blind end below the lid seam.');
  if (p.cameraDiameter / 2 < h.lensDiameter / 2 + Math.hypot(p.cameraOffsetX, p.cameraOffsetY) + p.boardFit + 0.4 - 1e-9)
    issue('cameraDiameter', 'Enlarge the camera opening or reduce alignment offsets to keep the nominal lens unobstructed.');
  if (Math.abs(l.aperture[0]) + p.cameraDiameter / 2 > p.width / 2 - 1.2 || Math.abs(l.aperture[1]) + p.cameraDiameter / 2 > p.length / 2 - 1.2)
    issue('cameraDiameter', 'The camera opening needs at least 1.2 mm of roof at the edge; increase USB recess or reduce the opening/offset.');
  // The narrow expansion-board retainers must remain joined to solid roof, even with a large off-centre aperture.
  for (const x of [-h.width / 2 + 0.55, h.width / 2 - 1.15]) {
    const dx = Math.max(x - l.aperture[0], 0, l.aperture[0] - x - 0.6);
    const dy = Math.max(l.boardY + 7 - l.aperture[1], 0, l.aperture[1] - l.boardY - 9);
    if (Math.hypot(dx, dy) < p.cameraDiameter / 2 + 0.6) {
      issue('cameraDiameter', 'Reduce the opening or move it towards the USB end: leave solid roof over the board retainers.');
      break;
    }
  }
  if (l.corners.some(([x, y]) => Math.hypot(x - l.aperture[0], y - l.aperture[1]) < p.cameraDiameter / 2 + h.screwHole / 2 + 1.3))
    issue('cameraDiameter', 'The camera opening must leave at least 1.3 mm of roof around each lid screw hole.');
  if (l.usbZ - p.usbHeight / 2 < p.wall + 0.8 - 1e-9)
    issue('usbHeight', 'Reduce USB opening height or increase under-board clearance to retain the floor below the plug.');
  if (l.usbZ + p.usbHeight / 2 > l.roof - 0.8)
    issue('usbHeight', 'The USB opening must leave material below the roof.');
  if (!l.screw) issue('headroom', 'No library M2 lid screw reaches the inserts without bottoming out; reduce headroom or wall thickness.');
  return issues;
}

export function cameraHousingAssembly(p: CameraHousingParameters): Assembly {
  const l = cameraHousingLayout(p);
  return {
    poses: { base: { position: [0, 0, 0] }, lid: { position: [0, 0, l.top], rotation: [180, 0, 0] } },
    steps: [
      { title: 'Seat the camera stack in the guides; route battery and antenna leads', parts: ['camera-board'], from: [0, 0, 32] },
      { title: 'Lower the camera hood over the stack', parts: ['lid'], from: [0, 0, 64] },
    ],
    lift: 6, partColors: { base: '#537d78', lid: '#e5d9bb' },
  };
}
export function cameraHousingReferences(p: CameraHousingParameters): LinkedReference[] {
  const h = CAMERA_HARDWARE, l = cameraHousingLayout(p);
  return [
    { id: 'camera-board', part: p.board, label: 'camera stack (not printed)', pose: { position: [-h.width / 2, l.boardY, l.boardZ] } },
    ...[-1, 1].map((sign, i): LinkedReference => ({ id: `mount-insert-${i}`, part: p.mountInsert, label: 'rear mount', movesWith: 'base',
      pose: { position: [sign * p.mountSpacing / 2, 0, dimensionOf(cameraHardwarePart(p.mountInsert), 'l')], rotation: [180, 0, 0] } })),
    ...l.corners.flatMap(([x, y], i): LinkedReference[] => [
      { id: `lid-insert-${i}`, part: CAMERA_LID_INSERT, label: 'lid closure', movesWith: 'base', pose: { position: [x, y, l.seam - dimensionOf(cameraHardwarePart(CAMERA_LID_INSERT), 'l')] } },
      ...(l.screw ? [{ id: `lid-screw-${i}`, part: l.screw.id, label: 'lid closure', pose: { position: [x, y, l.top - dimensionOf(l.screw, 'l')] as [number, number, number] },
        step: { title: 'Tighten the four M2 lid screws', from: [0, 0, 100] as [number, number, number] } }] : []),
    ]),
  ];
}
