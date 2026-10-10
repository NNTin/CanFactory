import { Type, type Static } from 'typebox';
import { devBoardLayout, dimensionOf, findPart, fanMounts, ISO_273_CLEARANCE_HOLES, parts } from './parts/index.ts';
import type { Assembly, LinkedReference, ParameterIssue, ParameterValues } from './models.ts';

export const CAMERA_BOARD_ID = 'seeed-xiao-esp32s3-sense';
export const CAMERA_LID_INSERT = 'ruthex-rx-m2x4';
export const CAMERA_MOUNT_INSERTS = ['ruthex-rx-m3x5-7', 'cnc-kitchen-m3x3', 'cnc-kitchen-m4x4', 'ruthex-rx-m4x8-1'] as const;
export const CAMERA_MOUNT_NUTS = ['iso-4032-m3', 'iso-4032-m4', 'din-562-m3', 'din-562-m4'] as const;
export const CAMERA_FANS = ['sunon-mf30100v2-1000u-a99', 'noctua-nf-a4x10-5v-pwm'] as const;
export const CAMERA_FAN_GAP = 2;
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
  width: mm('Housing width', 'Minimum outside width in mm; leave room for the rear mounts. Fan mode may widen it automatically.', 48, 42, 80, 1),
  length: mm('Housing length', 'Compact outside length in mm. Fan mode appends a rear bay; board and USB positions stay fixed when cooling is toggled.', 46, 40, 80, 1),
  mountRetention: Type.Enum(['heat-set', 'nut'], { title: 'Rear mounting', description: 'Blind heat-set inserts or side-loaded captive nuts. The four lid fasteners remain M2 heat-set inserts.', default: 'heat-set' }),
  mountNut: Type.Enum(CAMERA_MOUNT_NUTS, { title: 'Mounting nuts', description: 'Slide two nuts into the tray pockets from inside before fitting the camera. Floor and roof capture the nuts; flats prevent rotation.', default: 'iso-4032-m3' }),
  mountInsert: Type.Enum(CAMERA_MOUNT_INSERTS, { title: 'Mounting inserts', description: 'Two blind, rear-facing heat-set inserts for attaching the enclosure to your own bracket.', default: CAMERA_MOUNT_INSERTS[0] }),
  mountSpacing: mm('Mount spacing', 'Centre distance of the two rear mounting fasteners, in mm.', 34, 28, 60, 1),
  cameraDiameter: mm('Camera opening', 'Through-hole diameter in mm. Measure your lens and check the field of view before printing.', 12, 10, 20),
  cameraOffsetX: mm('Camera alignment X', 'Aperture offset from the nominal lens centre, across the board, in mm.', 0, -3, 3, 0.1),
  cameraOffsetY: mm('Camera alignment Y', 'Aperture offset towards the USB end, in mm.', 0, -3, 3, 0.1),
  antennaDiameter: mm('Antenna exit', 'Split cable opening on the left side, in mm. Lay the pre-connected U.FL lead in before closing.', 5, 3, 8),
  batteryDiameter: mm('Battery wire exit', 'Split opening on the right side for wires to the underside BAT pads, in mm. Battery remains external.', 4, 2, 8),
  chargeWindow: Type.Boolean({ title: 'Charge LED window', description: 'A 2.4 mm side sight hole towards the red charge LED; not a light pipe.', default: true }),
  fanEnabled: Type.Boolean({ title: 'Cooling fan', description: 'Extend the rear of the housing for one roof-exhaust fan, with an integral grille and mandatory lower air intakes. Fan and its screws/nuts appear in the assembly; they are not printed.', default: false }),
  fan: Type.Enum(CAMERA_FANS, { title: 'Fan', description: '5 V fan choice; the shell grows automatically to fit the maximum installed frame. Verify power budget and physical fit before use.', default: 'noctua-nf-a4x10-5v-pwm' }),
  ventilation: Type.Boolean({ title: 'Ventilation', description: 'Passive roof slots when no fan is fitted. Fan mode always adds its grille and air intakes regardless of this setting. Indoor only, not waterproof.', default: true }),
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
  const insert = cameraHardwarePart(p.mountInsert), nut = cameraHardwarePart(p.mountNut), fan = cameraHardwarePart(p.fan);
  const nutS = dimensionOf(nut, 's', 'max') + 0.4, nutHeight = dimensionOf(nut, 'm', 'max');
  const squareNut = nut.attributes['shape']?.startsWith('square') === true;
  const mountHole = ISO_273_CLEARANCE_HOLES[nut.attributes['thread'] === 'M4' ? 'M4' : 'M3'].medium;
  const fanW = dimensionOf(fan, 'W', 'max'), fanL = dimensionOf(fan, 'L', 'max'), fanH = dimensionOf(fan, 'H', 'max');
  const extension = p.fanEnabled ? fanL + p.wall + 15 : 0;
  const width = p.fanEnabled ? Math.max(p.width, fanW + 2 * p.wall + 2) : p.width;
  const length = p.length + extension, back = -p.length / 2 - extension;
  const fanY = -p.length / 2 - 4 - fanL / 2;
  const fanNut = cameraHardwarePart(fan.attributes['mounting'] === '3-corner' ? 'iso-4032-m2-5' : 'iso-4032-m3');
  const fanNutH = dimensionOf(fanNut, 'm', 'max');
  const boardY = p.length / 2 - p.wall - h.usbOverhang - p.usbRecess - h.length;
  const boardZ = p.wall + p.standoff;
  const seam = boardZ + h.thickness + h.seamAbovePcb;
  const fanGrip = p.wall + CAMERA_FAN_GAP + fanH + fanNutH;
  const fanScrew = parts.find(part => part.family === 'screw' && part.attributes['standard'] === 'ISO 4762' && part.attributes['thread'] === fanNut.attributes['thread']
    && dimensionOf(part, 'l') >= fanGrip - 0.5 - 1e-9);
  // At minimum stack settings, raise the roof just enough that a stocked fan bolt cannot reach the floor.
  const roof = Math.max(boardZ + h.height + p.headroom, p.fanEnabled && fanScrew ? dimensionOf(fanScrew, 'l') + 0.8 : 0);
  const top = roof + p.wall;
  const grip = top - seam;
  const screw = parts.find(part => part.family === 'screw' && part.attributes['standard'] === 'ISO 4762' && part.attributes['thread'] === 'M2'
    && dimensionOf(part, 'l') >= grip + 3 - 1e-9 && dimensionOf(part, 'l') <= grip + h.lidHoleDepth - 0.3 + 1e-9);
  return {
    width, length, back, extension, fanY, fanW, fanL, fanH, fanNut, fanNutH, fanScrew, fanGrip,
    fanBottom: roof - CAMERA_FAN_GAP - fanH, fanMounts: fanMounts(fan),
    nutS, nutHeight, squareNut, mountHole,
    boardY, boardZ, seam, roof, top, grip, screw,
    lens: [h.cameraX - h.width / 2, boardY + h.cameraY] as [number, number],
    aperture: [h.cameraX - h.width / 2 + p.cameraOffsetX, boardY + h.cameraY + p.cameraOffsetY] as [number, number],
    usbZ: boardZ + h.thickness + h.usbHeight / 2,
    mountRadius: p.mountRetention === 'nut' ? nutS / (squareNut ? Math.SQRT2 : Math.sqrt(3)) + 1.2 : dimensionOf(insert, 'hole') / 2 + dimensionOf(insert, 'wall'),
    mountDepth: p.mountRetention === 'nut' ? p.wall + nutHeight + 0.3 + 2 : dimensionOf(insert, 'holeDepth'),
    corners: [-1, 1].flatMap(x => [-1, 1].map(y => [x * (width / 2 - h.lidCornerInset), y === 1 ? p.length / 2 - h.lidCornerInset : back + h.lidCornerInset] as [number, number])),
  };
}

export function cameraHousingIssues(p: CameraHousingParameters): ParameterIssue[] {
  const h = CAMERA_HARDWARE, l = cameraHousingLayout(p), issues: ParameterIssue[] = [];
  const issue = (field: string, message: string) => issues.push({ field, message });
  if (p.mountSpacing / 2 + l.mountRadius > l.width / 2 - p.wall + 1e-9)
    issue('mountSpacing', 'Widen the housing or reduce mount spacing to leave the mounting pocket’s required wall.');
  if (p.mountSpacing / 2 - l.mountRadius < h.width / 2 + p.boardFit + 2)
    issue('mountSpacing', 'Increase mount spacing: the mounting bosses must clear the board guides.');
  if (l.mountDepth + p.wall >= l.seam - p.seamFit)
    issue('standoff', 'Increase under-board clearance: the mounting holes need a blind end below the lid seam.');
  if (p.cameraDiameter / 2 < h.lensDiameter / 2 + Math.hypot(p.cameraOffsetX, p.cameraOffsetY) + p.boardFit + 0.4 - 1e-9)
    issue('cameraDiameter', 'Enlarge the camera opening or reduce alignment offsets to keep the nominal lens unobstructed.');
  if (Math.abs(l.aperture[0]) + p.cameraDiameter / 2 > l.width / 2 - 1.2 || l.aperture[1] + p.cameraDiameter / 2 > p.length / 2 - 1.2 || l.aperture[1] - p.cameraDiameter / 2 < l.back + 1.2)
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
  if (p.fanEnabled && !l.fanScrew) issue('fan', 'No library fan screw has enough nut engagement; reduce wall thickness.');
  return issues;
}

export function cameraHousingAssembly(p: CameraHousingParameters): Assembly {
  const l = cameraHousingLayout(p);
  return {
    poses: { base: { position: [0, 0, 0] }, lid: { position: [0, 0, l.top], rotation: [180, 0, 0] } },
    steps: [
      { title: 'Seat the camera stack in the guides; route battery and antenna leads', parts: ['camera-board'], from: [0, 0, 32] },
      { title: p.fanEnabled ? 'Lower the hood with its pre-bolted exhaust fan; keep leads clear of the blades' : 'Lower the camera hood over the stack', parts: ['lid'], from: [0, 0, 64] },
    ],
    lift: 6, partColors: { base: '#537d78', lid: '#e5d9bb' },
  };
}
export function cameraHousingReferences(p: CameraHousingParameters): LinkedReference[] {
  const h = CAMERA_HARDWARE, l = cameraHousingLayout(p);
  return [
    { id: 'camera-board', part: p.board, label: 'camera stack (not printed)', pose: { position: [-h.width / 2, l.boardY, l.boardZ] } },
    ...[-1, 1].map((sign, i): LinkedReference => ({ id: `mount-insert-${i}`, part: p.mountRetention === 'nut' ? p.mountNut : p.mountInsert, label: 'rear mount', movesWith: 'base',
      pose: p.mountRetention === 'nut' ? { position: [sign * p.mountSpacing / 2, 0, p.wall + 0.15] } : { position: [sign * p.mountSpacing / 2, 0, dimensionOf(cameraHardwarePart(p.mountInsert), 'l')], rotation: [180, 0, 0] } })),
    ...(p.fanEnabled ? [
      { id: 'cooling-fan', part: p.fan, label: 'roof exhaust (not printed)', movesWith: 'lid', pose: { position: [0, l.fanY, l.fanBottom] as [number, number, number] } },
      ...l.fanMounts.flatMap(([x, y], i): LinkedReference[] => [
        { id: `fan-nut-${i}`, part: l.fanNut.id, label: 'fan mounting', movesWith: 'lid', pose: { position: [x, l.fanY + y, l.fanBottom - l.fanNutH] } },
        ...(l.fanScrew ? [{ id: `fan-screw-${i}`, part: l.fanScrew.id, label: 'fan mounting', movesWith: 'lid', pose: { position: [x, l.fanY + y, l.top - dimensionOf(l.fanScrew, 'l')] as [number, number, number] } }] : []),
      ]),
    ] : []),
    ...l.corners.flatMap(([x, y], i): LinkedReference[] => [
      { id: `lid-insert-${i}`, part: CAMERA_LID_INSERT, label: 'lid closure', movesWith: 'base', pose: { position: [x, y, l.seam - dimensionOf(cameraHardwarePart(CAMERA_LID_INSERT), 'l')] } },
      ...(l.screw ? [{ id: `lid-screw-${i}`, part: l.screw.id, label: 'lid closure', pose: { position: [x, y, l.top - dimensionOf(l.screw, 'l')] as [number, number, number] },
        step: { title: 'Tighten the four M2 lid screws', from: [0, 0, 100] as [number, number, number] } }] : []),
    ]),
  ];
}

/** [max width, max length, max height, mounting XY array, clearance bore, bolt length]; used by both print generators. */
export function cameraFanScad(id: string, parameters: ParameterValues): string {
  const part = cameraHardwarePart(id), l = cameraHousingLayout(parameters as CameraHousingParameters);
  return JSON.stringify([dimensionOf(part, 'W', 'max'), dimensionOf(part, 'L', 'max'), dimensionOf(part, 'H', 'max'), fanMounts(part), part.attributes['mounting'] === '3-corner' ? 3.4 : 3.8, l.fanScrew ? dimensionOf(l.fanScrew, 'l') : 0]);
}
export function cameraNutScad(id: string): string {
  const part = cameraHardwarePart(id);
  return JSON.stringify([dimensionOf(part, 's', 'max'), dimensionOf(part, 'm', 'max'), part.attributes['shape']?.startsWith('square') === true,
    ISO_273_CLEARANCE_HOLES[part.attributes['thread'] === 'M4' ? 'M4' : 'M3'].medium]);
}
