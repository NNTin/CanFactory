import { magneticCatToyLayout, TOY, type MagneticCatToyParameters } from './magneticCatToy.ts';
import { magnetProduct } from './parts/magnets.ts';
import type { PhysicsBody, PhysicsMagnet, PhysicsSpec } from './physics.ts';
import { clipConvex, extrudedPieces, wallPieces, type Point2 } from './physicsPieces.ts';

/** Midpoints of supermagnete's published remanence ranges (T), read 2026-10-10:
 * N42 1.29–1.32, N45 1.32–1.37. https://www.supermagnete.de/eng/physical-magnet-data
 * m ≈ Br V / μ₀, uniform axial magnetisation, nominal product volume, NOT steel-plate pull force.
 */
const REMANENCE: Record<string, number> = { N42: 1.305, N45: 1.345 };
export function toyDipole(id: string): { moment: number; mass: number; radius: number } {
  const magnet = magnetProduct(id), br = REMANENCE[magnet.grade], { diameter, thickness } = magnet.size;
  if (!br || magnet.shape !== 'disc' || !diameter || !thickness) throw new Error(`No axial disc approximation for ${id}.`);
  return { moment: br * Math.PI * (diameter / 2 * 1e-3) ** 2 * thickness * 1e-3 / (4e-7 * Math.PI), mass: magnet.weight, radius: diameter / 2 };
}

/** Same rounded() outline as the generator, $fn=64. */
function roundedPlan(w: number, h: number, r: number): Point2[] {
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].flatMap(([sx = 1, sy = 1], corner) => Array.from({ length: 17 }, (_, i): Point2 => {
    const a = (corner * 90 + i * 90 / 16) * Math.PI / 180;
    return [sx * (w / 2 - r) + r * Math.cos(a), sy * (h / 2 - r) + r * Math.sin(a)];
  }));
}

/** Roof-down source frame. Exact slot webs and sampled round ends, not a hull that seals the paw openings.
 * Exterior ears/holes and the low field-retaining lip are omitted: the captive sphere cannot reach them. Wall slabs follow the inner rounded shell.
 */
export function toyCoverPieces(p: MagneticCatToyParameters): number[][] {
  const l = magneticCatToyLayout(p), outer = roundedPlan(p.width, p.length, 6), r = p.slotWidth / 2;
  const pieces = wallPieces(roundedPlan(p.width - 2 * TOY.wall, p.length - 2 * TOY.wall, 3), TOY.wall, TOY.roof, l.top - l.fieldZ);
  const cuts = [-p.width / 2, ...l.slotCentres.flatMap(x => [x - r, x + r]), p.width / 2];
  for (let i = 0; i + 1 < cuts.length; i += 2) {
    const left = cuts[i] ?? 0, right = cuts[i + 1] ?? 0;
    pieces.push(...extrudedPieces(clipConvex(clipConvex(outer, [-1, 0, -left]), [1, 0, right]), [0, 1], 0, TOY.roof));
  }
  for (const x of l.slotCentres) for (const sign of [-1, 1]) {
    const shoulder = (l.slotLength - p.slotWidth) / 2;
    const arc: Point2[] = Array.from({ length: 33 }, (_, i) => {
      const a = Math.PI - i * Math.PI / 32;
      return [x + r * Math.cos(a), sign * (shoulder + r * Math.sin(a))];
    });
    pieces.push(...extrudedPieces([...arc, [x + r, sign * p.length / 2], [x - r, sign * p.length / 2]], [0, 1], 0, TOY.roof));
  }
  return pieces;
}

/** Fully assembled, screwed toy, assuming its magnetically closed ball remains assembled. Only the composite ball moves; switches change fields/mesh presence without rebuilding engine bodies. */
export function magneticCatToyPhysics(p: MagneticCatToyParameters): PhysicsSpec {
  const l = magneticCatToyLayout(p), grid = toyDipole(p.gridMagnet), ball = toyDipole(p.ballMagnet);
  const weld = (id: string, parent?: string): PhysicsBody => ({ id, material: 'petg', fixed: true, collision: { kind: 'none' },
    ...(parent ? { joint: { type: 'slide', parent, anchor: [0, 0, 0] } } : {}) });
  const magnets: PhysicsMagnet[] = [
    ...l.sockets.map((_, i): PhysicsMagnet => ({ id: `grid-magnet-${i + 1}`, title: `Grid magnet ${i + 1}`, body: `grid-magnet-${i + 1}`,
      position: [0, 0, l.grid.nominalThickness / 2], moment: [0, 0, grid.moment], softening: grid.radius, switchable: true, enabled: false, hideWhenDisabled: true })),
    ...['lower', 'upper'].map((half): PhysicsMagnet => ({ id: `ball-magnet-${half}`, title: `${half} closure magnet (always on)`, body: `ball-magnet-${half}`,
      position: [0, 0, l.ball.nominalThickness / 2], moment: [0, 0, half === 'lower' ? ball.moment : -ball.moment], softening: ball.radius })),
  ];
  const disabled = Object.fromEntries(l.sockets.map((_, i) => [`grid-magnet-${i + 1}`, false]));
  const targetIndex = Math.floor((l.rows - 1) / 2) * l.columns + Math.floor((l.columns - 1) / 2);
  const target = `grid-magnet-${targetIndex + 1}`;
  const [hx = 0, hy = 0] = l.sockets[targetIndex] ?? [];
  // An eccentric lightweight ball rolls under gravity from the assembly's sideways-heavy pose.
  // Start off/on comparisons with its heavy axis down, so gravitational settling is not mistaken for a magnetic response.
  const at = (x: number, y: number) => l.offset ? {
    'ball-lower': { position: [x + TOY.pinLength, y, l.fieldTop + l.radius], rotation: [180, 90, 0] },
    'ball-upper': { position: [x - TOY.pinLength, y, l.fieldTop + l.radius], rotation: [0, 90, 0] },
    'ball-magnet-lower': { position: [x - l.ballSeatDepth, y, l.fieldTop + l.radius - l.offset], rotation: [0, 90, 0] },
    'ball-magnet-upper': { position: [x + l.ballSeatDepth, y, l.fieldTop + l.radius - l.offset], rotation: [180, 90, 0] },
  } : {
    'ball-lower': { position: [x, y, l.fieldTop + l.radius + TOY.pinLength], rotation: [180, 0, 0] },
    'ball-upper': { position: [x, y, l.fieldTop + l.radius - TOY.pinLength] },
    'ball-magnet-lower': { position: [x, y, l.fieldTop + l.radius - l.ballSeatDepth] },
    'ball-magnet-upper': { position: [x, y, l.fieldTop + l.radius + l.ballSeatDepth], rotation: [180, 0, 0] },
  };
  return {
    bodies: [
      weld('grid'),
      ...l.sockets.map((_, i) => weld(`grid-magnet-${i + 1}`)),
      { ...weld('field'), collision: { kind: 'box', centre: [0, 0, p.fieldThickness / 2], size: [p.width - 8, p.length - 8, p.fieldThickness] } },
      { id: 'ball-lower', material: 'petg', collision: { kind: 'sphere', centre: [0, 0, TOY.pinLength], diameter: p.ballDiameter } },
      weld('ball-upper', 'ball-lower'),
      { ...weld('ball-magnet-lower', 'ball-lower'), material: 'steel', mass: ball.mass },
      { ...weld('ball-magnet-upper', 'ball-upper'), material: 'steel', mass: ball.mass }, // sourced mass for each disc
      { ...weld('cover'), collision: { kind: 'pieces', pieces: toyCoverPieces(p) } },
      ...l.ears.flatMap((_, i) => [weld(`cover-screw-${i + 1}`), weld(`cover-nut-${i + 1}`)]),
    ],
    magnets,
    scenarios: [
      { id: 'magnets-off', title: 'All grid magnets off: the ball rests on the field', duration: 0.25, magnets: disabled, poses: at(hx + 8, hy), checks: [
        { kind: 'position', at: 0.25, body: 'ball-lower', point: [0, 0, TOY.pinLength], axis: 0, min: -2, max: 2 },
        { kind: 'position', at: 0.25, body: 'ball-lower', point: [0, 0, TOY.pinLength], axis: 2, min: -0.02, max: 2 },
        { kind: 'contact', at: 0.25, bodies: ['ball-lower', 'field'], touching: true },
      ] },
      { id: 'magnet-on', title: 'A selected grid magnet attracts and turns the ball', duration: 0.5, magnets: { ...disabled, [target]: true }, poses: at(hx + 8, hy), checks: [
        { kind: 'position', at: 0.5, body: 'ball-lower', point: [0, 0, TOY.pinLength], axis: 0, max: -0.5 },
        { kind: 'position', at: 0.5, body: 'ball-lower', point: [0, 0, TOY.pinLength], axis: 2, min: -0.02, max: 2 },
      ] },
      { id: 'switch-on', title: 'Switching a grid magnet on moves the already assembled ball without resetting it', duration: 0.75, magnets: disabled, poses: at(hx + 8, hy),
        drives: [{ kind: 'magnet', id: target, timeline: [[0.25, 1]] }], checks: [
          { kind: 'position', at: 0.2, body: 'ball-lower', point: [0, 0, TOY.pinLength], axis: 0, min: -2, max: 2 },
          { kind: 'position', at: 0.75, body: 'ball-lower', point: [0, 0, TOY.pinLength], axis: 0, max: -0.5 },
        ] },
      { id: 'cover-retains-ball', title: 'With the toy upside down, the slotted cover retains the ball', duration: 0.5, gravity: [0, 0, 1], magnets: disabled, checks: [
        { kind: 'position', at: 0.5, body: 'ball-lower', point: [0, 0, TOY.pinLength], axis: 2, min: 2.5, max: TOY.ballHeadroom + l.radius },
        { kind: 'contact', at: 0.5, bodies: ['ball-lower', 'cover'], touching: true },
        { kind: 'position', at: 0.5, body: 'cover', axis: 2, min: 0, max: 0 },
      ] },
    ],
  };
}
