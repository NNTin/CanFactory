import { Type, type Static } from 'typebox';
import { dimensionOf, findPart } from './parts/index.ts';
import type { Assembly, LinkedReference, ParameterIssue } from './models.ts';

// Restrict to axial discs: blocks/rings/pots need different pockets, not invented dimensions.
export const TOY_GRID_MAGNETS = ['supermagnete-s-08-02-n', 'supermagnete-s-10-03-n', 'supermagnete-s-12-02-n'] as const;
export const TOY_BALL_MAGNETS = ['supermagnete-s-06-02-n', 'supermagnete-s-06-03-n', 'supermagnete-s-08-03-n'] as const;
export const TOY = {
  floor: 1.2, socketWall: 1.2, edgeMargin: 20, pushHole: 3, rim: 5, mountBase: 6, pocketPlay: 0.2, air: 0.2,
  wall: 3, roof: 3, fieldLip: 3, fieldRetainGap: 0.2, pin: 1, pinLength: 1.6, ballHeadroom: 3, ballLip: 0.4, ballSeatWall: 1.2, ballRemovalNotch: 3.2, gripLatitude: 35, gripCount: 6, spokeWidth: 2,
} as const;
const mm = (title: string, description: string, value: number, minimum: number, maximum: number, multipleOf = 0.1) =>
  Type.Number({ title, description, default: value, minimum, maximum, multipleOf });
export const MagneticCatToyParametersSchema = Type.Object({
  width: mm('Toy width', 'Body width, excluding the four external screw ears, in mm.', 160, 120, 200, 1),
  length: mm('Toy length', 'Body length in mm.', 140, 120, 200, 1),
  gridMagnet: Type.Enum(TOY_GRID_MAGNETS, { title: 'Grid magnets', description: 'Sourced axial discs for whichever sockets you choose to populate; exposed and nominally flush until the field is fitted.', default: TOY_GRID_MAGNETS[1] }),
  ballMagnet: Type.Enum(TOY_BALL_MAGNETS, { title: 'Ball magnet', description: 'Two matching sourced discs, one retained in each hollow half. Rear-loaded pockets put continuous thin printed floors between the magnets. Install opposite facing poles; attraction seats each disc against its floor.', default: TOY_BALL_MAGNETS[1] }),
  socketSpacing: mm('Socket spacing', 'Centre-to-centre pitch in both directions, in mm. The centred array fits as many sockets as possible with at least 20 mm from each centre to the outer edge. Choose magnet positions yourself, not a layout preset.', 30, 20, 60, 1),
  fieldThickness: mm('Playing field thickness', 'Smooth solid planar sheet; thinner reduces the magnetic gap but may flex. Print solid, smooth face on the bed.', 1.2, 1, 2, 0.2),
  ballDiameter: mm('Ball diameter', 'Outer spherical envelope in mm. Hollow perforated halves close magnetically and remain separable.', 36, 28, 44, 1),
  ballShellThickness: mm('Ball shell thickness', 'Hollow shell wall in mm. Seven radial grip holes per half; print walls solid.', 2, 1.6, 2.4, 0.2),
  ballGripHoleDiameter: mm('Ball grip hole diameter', 'Diameter of the fourteen through-holes in mm, including one at each pole. Larger holes improve access and reduce mass; at least 1.2 mm of inner-shell web must remain.', 8, 6, 12, 0.5),
  ballMagnetFloorThickness: mm('Ball magnet floor thickness', 'Continuous wall between each magnet and the seam, in mm. The two flat floors touch with no intentional air gap, so face separation is twice this thickness. Solid layers, not sparse infill.', 0.6, 0.4, 1, 0.2),
  magnetPlacement: Type.Enum(['centred', 'eccentric'], { title: 'Ball magnet placement', description: 'Centred balances the two magnet seats symmetrically about the sphere centre; eccentric shifts both seats radially for a deliberate wobble.', default: 'centred' }),
  eccentricOffset: mm('Eccentric offset', 'Radial displacement of both ball magnets from the sphere centre in mm; only used in eccentric mode.', 6, 2, 8, 0.5),
  slotWidth: mm('Paw slot width', 'Rounded elongated roof slots in mm. At most 60% of ball diameter; length alone does not retain a sphere.', 18, 12, 24, 0.5),
  clearance: mm('Joint clearance', 'Gap per side around non-locking ball alignment pins and cover ear reliefs, following the existing clearance-fit convention.', 0.2, 0.2, 0.4, 0.05),
}, { additionalProperties: false });
export type MagneticCatToyParameters = Static<typeof MagneticCatToyParametersSchema>;
export const DEFAULT_MAGNETIC_CAT_TOY = Object.fromEntries(Object.entries(MagneticCatToyParametersSchema.properties).map(([key, p]) => [key, 'default' in p ? p.default : undefined])) as MagneticCatToyParameters;
export function toyMagnet(id: string) {
  const part = findPart(id);
  if (!part || part.family !== 'magnet' || part.attributes['shape'] !== 'disc') throw new Error(`Not an axial library disc: ${id}`);
  return { part, diameter: dimensionOf(part, 'diameter', 'max'), minDiameter: dimensionOf(part, 'diameter', 'min'), thickness: dimensionOf(part, 'thickness', 'max'), nominalThickness: dimensionOf(part, 'thickness') };
}
export function magneticCatToyLayout(p: MagneticCatToyParameters) {
  const grid = toyMagnet(p.gridMagnet), ball = toyMagnet(p.ballMagnet);
  const socketDiameter = grid.diameter + TOY.pocketPlay;
  const socketOuterDiameter = socketDiameter + 2 * TOY.socketWall;
  const socketTop = TOY.floor + grid.nominalThickness;
  const fieldZ = socketTop + TOY.air;
  const fieldTop = fieldZ + p.fieldThickness, radius = p.ballDiameter / 2;
  const roofZ = fieldTop + p.ballDiameter + TOY.ballHeadroom, top = roofZ + TOY.roof;
  const columns = Math.floor((p.width - 2 * TOY.edgeMargin) / p.socketSpacing) + 1;
  const rows = Math.floor((p.length - 2 * TOY.edgeMargin) / p.socketSpacing) + 1;
  const sockets: [number, number][] = Array.from({ length: columns * rows }, (_, i) => [
    ((i % columns) - (columns - 1) / 2) * p.socketSpacing,
    (Math.floor(i / columns) - (rows - 1) / 2) * p.socketSpacing,
  ]);
  const ears: [number, number][] = [-1, 1].flatMap(x => [-1, 1].map(y => [x * (p.width / 2 + 5), y * (p.length / 2 - 12)] as [number, number]));
  const slotLength = Math.min(3 * p.ballDiameter, p.length - 24);
  const slotCount = Math.floor((p.width - 24 + 4) / (p.slotWidth + 4));
  const slotPitch = (p.width - 24 - p.slotWidth) / (slotCount - 1);
  const slotCentres = Array.from({ length: slotCount }, (_, i) => (i - (slotCount - 1) / 2) * slotPitch);
  const offset = p.magnetPlacement === 'eccentric' ? p.eccentricOffset : 0;
  const magnetToField = TOY.air + p.fieldThickness;
  const ballSeatDepth = p.ballMagnetFloorThickness + ball.thickness + TOY.ballLip;
  const gripHoles: [number, number][] = [...Array.from({ length: TOY.gripCount }, (_, i): [number, number] => [TOY.gripLatitude, i * 360 / TOY.gripCount]), [90, 0]];
  const innerRadius = radius - p.ballShellThickness;
  const lat = TOY.gripLatitude * Math.PI / 180;
  const closestHoleAngle = Math.acos(Math.sin(lat) ** 2 + Math.cos(lat) ** 2 * Math.cos(2 * Math.PI / TOY.gripCount));
  const gripWeb = innerRadius * (closestHoleAngle - 2 * Math.asin(p.ballGripHoleDiameter / (2 * innerRadius)));
  const ballBossRadius = (ball.diameter + TOY.pocketPlay) / 2 + TOY.ballSeatWall;
  const pinRadius = radius - p.ballShellThickness - 1;
  return { gripHoles, gripWeb, ballSeatDepth, ballBossRadius, pinRadius, magnetToField, grid, ball, socketDiameter, socketOuterDiameter, socketTop, fieldZ, fieldTop, radius, roofZ, top, columns, rows, sockets, ears, slotLength, slotCount, slotCentres, offset };
}
export function magneticCatToyIssues(p: MagneticCatToyParameters): ParameterIssue[] {
  const l = magneticCatToyLayout(p), issues: ParameterIssue[] = [];
  if (l.gripWeb < 1.2 - 1e-9) issues.push({ field: 'ballGripHoleDiameter', message: 'Grip holes need at least 1.2 mm of web on the inner shell. Reduce hole diameter, enlarge the ball, or reduce shell thickness.' });
  if (p.slotWidth > 0.6 * p.ballDiameter + 1e-9) issues.push({ field: 'slotWidth', message: 'Paw slots must be at most 60% of the ball diameter; reduce slot width or enlarge the ball.' });
  if (l.offset + l.ballBossRadius > l.radius - p.ballShellThickness - 0.5)
    issues.push({ field: 'eccentricOffset', message: 'The hollow ball needs clearance around the complete magnet boss. Reduce offset/magnet size or enlarge the ball.' });
  const distance = Math.min(...[30, 90, 150, 210, 270, 330].map(a => Math.hypot(l.pinRadius * Math.cos(a * Math.PI / 180) - l.offset, l.pinRadius * Math.sin(a * Math.PI / 180))));
  if (distance < l.ballBossRadius + TOY.pin + p.clearance + 0.5)
    issues.push({ field: 'ballMagnet', message: 'The magnet boss crowds the alignment seats. Reduce magnet size/offset or enlarge the ball.' });
  return issues;
}
export function magneticCatToyAssembly(p: MagneticCatToyParameters): Assembly {
  const l = magneticCatToyLayout(p);
  return {
    lift: 20,
    partColors: { grid: '#4f716b', field: '#e5cf9b', 'ball-lower': '#e9a248', 'ball-upper': '#efb95f', cover: '#649aa8' },
    poses: {
      grid: { position: [0, 0, 0] }, field: { position: [0, 0, l.fieldTop], rotation: [180, 0, 0] },
      'ball-lower': { position: [0, 0, l.fieldTop + l.radius + TOY.pinLength], rotation: [180, 0, 0] },
      'ball-upper': { position: [0, 0, l.fieldTop + l.radius - TOY.pinLength] },
      cover: { position: [0, 0, l.top], rotation: [180, 0, 0] },
    },
    steps: [
      { title: 'Place bare magnets in your chosen sockets (full capacity illustrated)', parts: l.sockets.map((_, i) => `grid-magnet-${i + 1}`), from: [0, 0, 30] },
      { title: 'Seat the thin playing field, smooth face up', parts: ['field'], from: [0, 0, 65] },
      { title: 'Close the rear-loaded ball with its thin mating floors touching', parts: ['ball-upper'], from: [0, 0, 16] },
      { title: 'Place the magnetic ball on the playing field', parts: ['ball-lower', 'ball-upper'], from: [0, 0, 95] },
      { title: 'Lower the protective cover and secure four M3 screws', parts: ['cover'], from: [0, 0, 160] },
    ],
  };
}
/** Rear-loaded discs seat against continuous joint-facing floors; the floors meet at the equator. */
export function magneticCatToyReferences(p: MagneticCatToyParameters): LinkedReference[] {
  const l = magneticCatToyLayout(p);
  return [
    ...l.sockets.map(([x, y], i): LinkedReference => ({ id: `grid-magnet-${i + 1}`, part: p.gridMagnet, label: `optional flush socket ${i + 1}`,
      pose: { position: [x, y, TOY.floor] } })),
    ...l.ears.flatMap(([x, y], i): LinkedReference[] => [
      { id: `cover-screw-${i + 1}`, part: 'iso-4762-m3x8', label: 'cover fastener', pose: { position: [x, y, 0] }, movesWith: 'cover' },
      { id: `cover-nut-${i + 1}`, part: 'iso-4032-m3', label: 'captive underside nut', pose: { position: [x, y, 0.1] } },
    ]),
    { id: 'ball-magnet-lower', part: p.ballMagnet, label: `${p.magnetPlacement} lower closure magnet`, pose: { position: [l.offset, 0, l.fieldTop + l.radius - p.ballMagnetFloorThickness], rotation: [180, 0, 0] }, movesWith: 'ball-lower' },
    { id: 'ball-magnet-upper', part: p.ballMagnet, label: `${p.magnetPlacement} upper closure magnet`, pose: { position: [l.offset, 0, l.fieldTop + l.radius + p.ballMagnetFloorThickness] }, movesWith: 'ball-upper' },
  ];
}
