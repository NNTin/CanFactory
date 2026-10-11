import { Type, type Static } from 'typebox';
import { dimensionOf, findPart } from './parts/index.ts';
import type { Assembly, LinkedReference, ParameterIssue } from './models.ts';

// Restrict to axial discs: blocks/rings/pots need different pockets, not invented dimensions.
export const TOY_GRID_MAGNETS = ['supermagnete-s-08-02-n', 'supermagnete-s-10-03-n', 'supermagnete-s-12-02-n'] as const;
export const TOY_BALL_MAGNETS = ['supermagnete-s-04-02-n', 'supermagnete-s-06-03-n', 'supermagnete-s-08-03-n'] as const;
export const TOY = {
  floor: 1.2, socketWall: 1.2, edgeMargin: 20, pushHole: 3, rim: 5, mountBase: 6, pocketPlay: 0.2, air: 0.2,
  wall: 3, roof: 3, fieldLip: 3, fieldRetainGap: 0.2, pin: 1.6, pinLength: 2.4, ballHeadroom: 3,
} as const;
const mm = (title: string, description: string, value: number, minimum: number, maximum: number, multipleOf = 0.1) =>
  Type.Number({ title, description, default: value, minimum, maximum, multipleOf });
export const MagneticCatToyParametersSchema = Type.Object({
  width: mm('Toy width', 'Body width, excluding the four external screw ears, in mm.', 160, 120, 200, 1),
  length: mm('Toy length', 'Body length in mm.', 140, 120, 200, 1),
  gridMagnet: Type.Enum(TOY_GRID_MAGNETS, { title: 'Grid magnets', description: 'Sourced axial discs for whichever sockets you choose to populate; exposed and nominally flush until the field is fitted.', default: TOY_GRID_MAGNETS[1] }),
  ballMagnet: Type.Enum(TOY_BALL_MAGNETS, { title: 'Ball magnet', description: 'One sourced axial disc captured between the ball halves.', default: TOY_BALL_MAGNETS[1] }),
  socketSpacing: mm('Socket spacing', 'Centre-to-centre pitch in both directions, in mm. The centred array fits as many sockets as possible with at least 20 mm from each centre to the outer edge. Choose magnet positions yourself, not a layout preset.', 30, 20, 60, 1),
  fieldThickness: mm('Playing field thickness', 'Smooth solid planar sheet; thinner reduces the magnetic gap but may flex. Print solid, smooth face on the bed.', 1.2, 1, 2, 0.2),
  ballDiameter: mm('Ball diameter', 'Finished spherical diameter in mm. Both halves must be printed solid and bonded.', 36, 28, 44, 1),
  magnetPlacement: Type.Enum(['centred', 'eccentric'], { title: 'Ball magnet placement', description: 'Centred puts the magnet at the geometric/mass centre of solid mirrored halves; eccentric shifts the split pocket radially for a deliberate wobble.', default: 'centred' }),
  eccentricOffset: mm('Eccentric offset', 'Radial displacement of the ball magnet from the sphere centre in mm; only used in eccentric mode.', 6, 2, 8, 0.5),
  slotWidth: mm('Paw slot width', 'Rounded elongated roof slots in mm. At most 60% of ball diameter; length alone does not retain a sphere.', 18, 12, 24, 0.5),
  clearance: mm('Joint clearance', 'Gap per side around ball pins and cover ear reliefs. Following the litter-shovel detent convention.', 0.2, 0.2, 0.4, 0.05),
  detentEngage: mm('Ball detent engagement', 'Radial interference beyond the socket wall, independent of clearance (cigarette-case/litter-shovel tuning pattern). Adhesive is still mandatory.', 0.15, 0.05, 0.25, 0.05),
}, { additionalProperties: false });
export type MagneticCatToyParameters = Static<typeof MagneticCatToyParametersSchema>;
export const DEFAULT_MAGNETIC_CAT_TOY = Object.fromEntries(Object.entries(MagneticCatToyParametersSchema.properties).map(([key, p]) => [key, 'default' in p ? p.default : undefined])) as MagneticCatToyParameters;
export function toyMagnet(id: string) {
  const part = findPart(id);
  if (!part || part.family !== 'magnet' || part.attributes['shape'] !== 'disc') throw new Error(`Not an axial library disc: ${id}`);
  return { part, diameter: dimensionOf(part, 'diameter', 'max'), thickness: dimensionOf(part, 'thickness', 'max'), nominalThickness: dimensionOf(part, 'thickness') };
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
  return { magnetToField, grid, ball, socketDiameter, socketOuterDiameter, socketTop, fieldZ, fieldTop, radius, roofZ, top, columns, rows, sockets, ears, slotLength, slotCount, slotCentres, offset };
}
export function magneticCatToyIssues(p: MagneticCatToyParameters): ParameterIssue[] {
  const l = magneticCatToyLayout(p), issues: ParameterIssue[] = [];
  if (p.slotWidth > 0.6 * p.ballDiameter + 1e-9) issues.push({ field: 'slotWidth', message: 'Paw slots must be at most 60% of the ball diameter; reduce slot width or enlarge the ball.' });
  const pocketR = (l.ball.diameter + TOY.pocketPlay) / 2;
  if (Math.hypot(l.offset + pocketR, l.ball.thickness / 2 + 0.1) > l.radius - 2)
    issues.push({ field: 'eccentricOffset', message: 'The magnet pocket needs at least 2 mm of solid ball around it. Reduce offset/magnet size or enlarge the ball.' });
  // Six alternating pin/socket seats around the equator. Keep the offset magnet clear of both kinds.
  const distance = Math.min(...[30, 90, 150, 210, 270, 330].map(a => Math.hypot(0.72 * l.radius * Math.cos(a * Math.PI / 180) - l.offset, 0.72 * l.radius * Math.sin(a * Math.PI / 180))));
  if (distance < pocketR + TOY.pin + p.clearance + p.detentEngage + 1.2 - 1e-9)
    issues.push({ field: 'ballMagnet', message: 'The ball magnet pocket crowds the joint pins. Reduce magnet size/offset or enlarge the ball.' });
  return issues;
}
export function magneticCatToyAssembly(p: MagneticCatToyParameters): Assembly {
  const l = magneticCatToyLayout(p);
  return {
    lift: 20,
    partColors: { grid: '#4f716b', field: '#e5cf9b', 'ball-lower': '#e9a248', 'ball-upper': '#efb95f', cover: '#649aa8' },
    poses: {
      grid: { position: [0, 0, 0] }, field: { position: [0, 0, l.fieldTop], rotation: [180, 0, 0] },
      'ball-lower': { position: [0, 0, l.fieldTop] },
      'ball-upper': { position: [0, 0, l.fieldTop + p.ballDiameter], rotation: [180, 0, 0] },
      cover: { position: [0, 0, l.top], rotation: [180, 0, 0] },
    },
    steps: [
      { title: 'Place bare magnets in your chosen sockets (full capacity illustrated)', parts: l.sockets.map((_, i) => `grid-magnet-${i + 1}`), from: [0, 0, 30] },
      { title: 'Seat the thin playing field, smooth face up', parts: ['field'], from: [0, 0, 65] },
      { title: 'Bond the ball halves around the selected magnet mount', parts: ['ball-upper'], from: [0, 0, 16] },
      { title: 'Place the magnetic ball on the playing field', parts: ['ball-lower', 'ball-upper'], from: [0, 0, 95] },
      { title: 'Lower the protective cover and secure four M3 screws', parts: ['cover'], from: [0, 0, 160] },
    ],
  };
}
/** Library discs use their bottom face as z=0. Grid discs seat on the thin floor; the ball disc rides with its bonded lower half. */
export function magneticCatToyReferences(p: MagneticCatToyParameters): LinkedReference[] {
  const l = magneticCatToyLayout(p);
  return [
    ...l.sockets.map(([x, y], i): LinkedReference => ({ id: `grid-magnet-${i + 1}`, part: p.gridMagnet, label: `optional flush socket ${i + 1}`,
      pose: { position: [x, y, TOY.floor] } })),
    ...l.ears.flatMap(([x, y], i): LinkedReference[] => [
      { id: `cover-screw-${i + 1}`, part: 'iso-4762-m3x8', label: 'cover fastener', pose: { position: [x, y, 0] }, movesWith: 'cover' },
      { id: `cover-nut-${i + 1}`, part: 'iso-4032-m3', label: 'captive underside nut', pose: { position: [x, y, 0.1] } },
    ]),
    { id: 'ball-magnet', part: p.ballMagnet, label: `${p.magnetPlacement} ball seat`, pose: { position: [l.offset, 0, l.fieldTop + l.radius - l.ball.thickness / 2] }, movesWith: 'ball-lower' },
  ];
}
