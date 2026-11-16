import { Type, type TNever } from 'typebox';
import type { Assembly } from './models.ts';
import type { PrintBody } from './printBodies.ts';
import { dimensionOf, findPart } from './parts/index.ts';

/** Verified reconstruction of FerryTeacher's print-in-place launcher, with CanFactory's return band. See
 * models/rubber-band-launcher/references/VERIFICATION.md and docs/rubber-band-launcher.md. */
// An empty property map with an impossible index type keeps the render-request union assignable to ParameterValues.
const noParameters: Record<string, TNever> = {};
export const RubberBandLauncherParametersSchema = Type.Object(noParameters, { additionalProperties: false });

type Vec3 = [number, number, number];
type Pose = Assembly['poses'][string];

// launcher.scad models the launcher lying flat (x along the barrel, y up the gun, z through the thickness) and stands it on the
// barrel's top edge to print (print_pose): print X = x, Y = z - 10.3, Z = TOP_Y - y. The preview turns the print over about the
// pivot pins' axis (Y), so that the launcher stands upright: X = -x, Y = z - 10.3, Z = y + HEIGHT - TOP_Y.
const TOP_Y = 54.813;
const HALF = 10.3;
/** The print's height (print_pose's Z, the frame's grip end at the top): the upright launcher's barrel top. */
const HEIGHT = 109.62;
/** A point of the flat model, in the upright preview. */
const upright = ([x, y, z]: readonly number[]): Vec3 => [-(x ?? 0), (z ?? 0) - HALF, (y ?? 0) + HEIGHT - TOP_Y];
const degrees = (radians: number) => radians * 180 / Math.PI;

/** The trigger's pivot pins (launcher.scad PIVOT), in the flat model. */
export const RUBBER_BAND_LAUNCHER_PIVOT = [20.691, 36.527] as const;
/** The trigger at rest, in degrees from where it prints: turned back against the frame's back wall (it meets it at about -12.5),
 * its top end down in the notch, where the shot band sits on it. The return band holds it there. */
export const RUBBER_BAND_LAUNCHER_REST = -12;
/** The trigger pulled to its stop on the frame's spine (it meets it at about 8.5): its top end has risen through the notch and
 * pushed the shot band out of it on the way, at 0, where the top is level with the notch's lip. */
export const RUBBER_BAND_LAUNCHER_PULL = 8;

/** A point of the flat model turned with the trigger by `angle` degrees about its pins (counter-clockwise seen from +z: pulling). */
function turned([x, y]: readonly [number, number], angle: number): [number, number] {
  const a = angle * Math.PI / 180, [px, py] = RUBBER_BAND_LAUNCHER_PIVOT, dx = x - px, dy = y - py;
  return [px + dx * Math.cos(a) - dy * Math.sin(a), py + dx * Math.sin(a) + dy * Math.cos(a)];
}

/** The frame, upright: the print turned over about Y and stood on its grip. */
const FRAME_POSE: Pose = { position: [0, 0, HEIGHT], rotation: [0, 180, 0] };

/** The trigger turned by `angle` degrees about its pins (positive pulls it), upright like the frame. */
export function rubberBandLauncherTriggerPose(angle: number): Pose {
  // the print's rotation about the pivot (x' = x cos a + z sin a, z' = -x sin a + z cos a in print coordinates), then the frame's turn
  const a = angle * Math.PI / 180, px = RUBBER_BAND_LAUNCHER_PIVOT[0], pz = TOP_Y - RUBBER_BAND_LAUNCHER_PIVOT[1];
  const tx = px - (Math.cos(a) * px + Math.sin(a) * pz), tz = pz - (-Math.sin(a) * px + Math.cos(a) * pz);
  return { position: [-tx, 0, HEIGHT - tz], rotation: [0, 180 + angle, 0] };
}

/** The print's two bodies (ModelPart.bodies), each told by a point inside it (print coordinates): the frame by the web between its
 * grip pockets, the trigger by its pivot axis, halfway through its thickness. */
export const RUBBER_BAND_LAUNCHER_BODIES: PrintBody[] = [
  { id: 'frame', title: 'Frame', point: [35, -0.3, TOP_Y + 20.8] },
  { id: 'trigger', title: 'Trigger', point: [RUBBER_BAND_LAUNCHER_PIVOT[0], -0.3, TOP_Y - RUBBER_BAND_LAUNCHER_PIVOT[1]] },
];

const band = (id: string) => findPart(id) ?? (() => { throw new Error(`Missing the rubber band ${id}.`); })();
/** The shot band: an office band #19 (3½″ × 1/16″, 1.6 mm wide, for the 2.2 mm groove in the barrel's tip). */
export const RUBBER_BAND_LAUNCHER_SHOT_BAND = band('alliance-sterling-19');
/** The return band: an office band #8 (⅞″ × 1/16″) round the pegs on the arm and on the trigger. */
export const RUBBER_BAND_LAUNCHER_RETURN_BAND = band('alliance-sterling-8');

// ---- The shot band: hooked into the groove in the front of the barrel's tip, its strands along both sides of the frame, its back
// end across the notch, pulled against the lip in front of it and resting on the trigger's top end.

/** Where the shot band's front end sits (flat model): in the groove in the front of the barrel's tip, its lower edge GROOVE_LOW. */
const MUZZLE_X = -62.315;
const GROOVE_LOW = 47.2 - dimensionOf(RUBBER_BAND_LAUNCHER_SHOT_BAND, 'width') / 2;
/** The notch's lip, in front of the band's back end: its top (the barrel's top edge) and where the band crosses behind it. */
const LIP_TOP = 54.81;
/** The trigger's top edge (flat model, as printed): it carries the band's back end in the notch. */
const TRIGGER_TOP: readonly [readonly [number, number], readonly [number, number]] = [[31.9, 54.81], [50.92, 54.81]];
/**
 * The outline the shot band is stretched round (x from the muzzle along the barrel, y = -(z - 10.3) across it): the frame's
 * outline within the band's height, from the front of the barrel's tip to the lip in front of the notch, 0.05 mm out; its back
 * edge 0.5 mm behind the lip, which the band's tilt (up to 5 degrees, about the muzzle) takes up. Measured on launcher.scad's frame.
 */
export const RUBBER_BAND_LAUNCHER_SHOT_LOOP: [number, number][] = [
  [-0.15, 1.28], [0.05, 2.72], [0.25, 3.64], [0.45, 4.09], [0.65, 4.52], [0.85, 4.94], [1.06, 5.34], [1.26, 5.73], [1.46,
  6.09], [1.66, 6.44], [1.86, 6.78], [2.27, 7.09], [5.08, 9.04], [5.88, 9.35], [7.29, 9.8], [9.5, 10.07], [11.9, 10.17],
  [14.3, 10.25], [16.7, 10.31], [19.1, 10.35], [101.36, 10.35], [101.36, -9.75], [19.1, -9.75], [16.7, -9.71], [14.3,
  -9.65], [11.9, -9.57], [9.5, -9.47], [7.29, -9.2], [5.88, -8.75], [5.08, -8.44], [2.27, -6.49], [1.86, -6.18], [1.66,
  -5.84], [1.46, -5.49], [1.26, -5.13], [1.06, -4.74], [0.85, -4.34], [0.65, -3.92], [0.45, -3.49], [0.25, -3.04], [0.05,
  -2.12], [-0.15, -0.68]];
/** Along the band, from the muzzle to the inside of its back end. */
const SHOT_REACH = Math.max(...RUBBER_BAND_LAUNCHER_SHOT_LOOP.map(([x]) => x));

/** The height of the trigger's top under the shot band's back end, the trigger turned by `angle`. */
function triggerTopUnderBand(angle: number): number {
  const [a, b] = TRIGGER_TOP.map(point => turned(point, angle)) as [[number, number], [number, number]];
  const at = (x: number) => a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  const back = MUZZLE_X + SHOT_REACH, thickness = dimensionOf(RUBBER_BAND_LAUNCHER_SHOT_BAND, 'thickness');
  return Math.max(at(back - 0.5), at(back + thickness + 0.1));
}

/** The shot band tilted by `tilt` radians about its front end (its back end up), moved by `offset` (flat model, mm). */
function shotBandPose(tilt: number, offset: Vec3 = [0, 0, 0]): Pose {
  return { position: upright([MUZZLE_X + offset[0], GROOVE_LOW + offset[1], HALF + offset[2]]), rotation: [180, 180 + degrees(tilt), 0] };
}

/** The tilt that sets the shot band's back end on the trigger's top, the trigger turned by `angle`; undefined once the top has
 * lifted it over the lip: the band is free and flies. */
function shotBandTilt(angle: number): number | undefined {
  const low = triggerTopUnderBand(angle) + 0.05;
  return low - LIP_TOP >= 0.05 - 1e-9 && angle > RUBBER_BAND_LAUNCHER_REST ? undefined : Math.asin((low - GROOVE_LOW) / SHOT_REACH);
}

// ---- The return band: round a peg on the frame's arm and one on the trigger's finger end (launcher.scad ARM_PEG, TRIGGER_PEG),
// outside the frame's z = 0 face, in BAND_PEG_GAP.

const ARM_PEG: readonly [number, number] = [6, 30];
const TRIGGER_PEG: readonly [number, number] = [10.5, 4];
/** The band's lower edge (flat z): inside BAND_PEG_GAP (-2 .. 0), clear of the pegs' heads and the frame's face. */
const RETURN_LOW = -1.8;
/** Round the arm peg's stem (its teardrop's point is inside the band), and round the whole of the trigger peg's teardrop, which turns
 * with the trigger. */
const ARM_PEG_R = 1.35, TRIGGER_PEG_R = 1.9;
const restSpan = Math.hypot(...turned(TRIGGER_PEG, RUBBER_BAND_LAUNCHER_REST).map((v, i) => v - (ARM_PEG[i] ?? 0)) as [number, number]);

/** The outline the return band is stretched round at rest: the hull of the two pegs, from the arm peg (at the origin) along x. */
export const RUBBER_BAND_LAUNCHER_RETURN_LOOP: [number, number][] = (() => {
  const circle = (cx: number, r: number) => Array.from({ length: 48 }, (_, i) => [cx + r * Math.cos(i * Math.PI / 24), r * Math.sin(i * Math.PI / 24)] as [number, number]);
  const points = [...circle(0, ARM_PEG_R), ...circle(restSpan, TRIGGER_PEG_R)].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: number[], a: number[], b: number[]) => ((a[0] ?? 0) - (o[0] ?? 0)) * ((b[1] ?? 0) - (o[1] ?? 0)) - ((a[1] ?? 0) - (o[1] ?? 0)) * ((b[0] ?? 0) - (o[0] ?? 0));
  const half = (list: [number, number][]) => list.reduce<[number, number][]>((hull, p) => {
    while (hull.length >= 2 && cross(hull[hull.length - 2] ?? p, hull[hull.length - 1] ?? p, p) <= 0) hull.pop();
    hull.push(p); return hull;
  }, []);
  const lower = half(points), upper = half([...points].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)].map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
})();

/** The return band, the trigger turned by `angle`: from the arm peg towards the trigger peg, stretched to their distance. */
function returnBandPose(angle: number): Pose {
  const [tx, ty] = turned(TRIGGER_PEG, angle), dx = tx - ARM_PEG[0], dy = ty - ARM_PEG[1], span = Math.hypot(dx, dy);
  // local x along the band, its width (local z) along the flat model's +z: about X by -90, then about Y
  return { position: upright([ARM_PEG[0], ARM_PEG[1], RETURN_LOW]), rotation: [-90, degrees(Math.atan2(-dy / span, -dx / span)), 0], scale: [span / restSpan, 1, 1] };
}

/** How far the return band is stretched, the trigger turned by `angle`: its length round the pegs over its loose loop (twice the flat
 * length). */
export function rubberBandLauncherReturnStretch(angle: number): number {
  const [tx, ty] = turned(TRIGGER_PEG, angle), span = Math.hypot(tx - ARM_PEG[0], ty - ARM_PEG[1]);
  const around = 2 * span + Math.PI * (ARM_PEG_R + TRIGGER_PEG_R);
  return around / (2 * dimensionOf(RUBBER_BAND_LAUNCHER_RETURN_BAND, 'length'));
}

// ---- The assembly: off the print bed and upright, the trigger freed to rest; the return band fitted, the shot band loaded; then a
// shot (the trigger pulled to its stop: the shot band rides up on its top end until it is over the lip, and flies) and the return
// band pulling the trigger back to rest.

const STEP = 2;
const angles = (from: number, to: number) => Array.from({ length: Math.round(Math.abs(to - from) / STEP) }, (_, i) => from + Math.sign(to - from) * STEP * (i + 1));
const restTilt = shotBandTilt(RUBBER_BAND_LAUNCHER_REST) ?? 0;

/** The shot band's poses while the trigger is pulled: riding on its top end, then flying off forward and up, a little further each
 * frame, from where it was let go. */
function shotFrames(): Pose[] {
  let free: { tilt: number; frames: number } | undefined;
  return angles(RUBBER_BAND_LAUNCHER_REST, RUBBER_BAND_LAUNCHER_PULL).map(angle => {
    const tilt = free ? undefined : shotBandTilt(angle);
    if (tilt !== undefined) return shotBandPose(tilt);
    free ??= { tilt: Math.asin((LIP_TOP + 0.1 - GROOVE_LOW) / SHOT_REACH), frames: 0 };
    free.frames++;
    return shotBandPose(free.tilt, [-20 * free.frames, 3 * free.frames, 0]);
  });
}

export const rubberBandLauncherAssembly: Assembly = (() => {
  const pull = angles(RUBBER_BAND_LAUNCHER_REST, RUBBER_BAND_LAUNCHER_PULL), shot = shotFrames();
  return {
    poses: {
      frame: FRAME_POSE, trigger: rubberBandLauncherTriggerPose(RUBBER_BAND_LAUNCHER_REST),
      'return-band': returnBandPose(RUBBER_BAND_LAUNCHER_REST), 'shot-band': shotBandPose(restTilt),
    },
    partColors: { frame: '#497c85', trigger: '#e5a54b' },
    references: [
      { id: 'return-band', part: RUBBER_BAND_LAUNCHER_RETURN_BAND.id, title: `${RUBBER_BAND_LAUNCHER_RETURN_BAND.title} (return band, round the pegs on the arm and the trigger)`, loop: RUBBER_BAND_LAUNCHER_RETURN_LOOP },
      { id: 'shot-band', part: RUBBER_BAND_LAUNCHER_SHOT_BAND.id, title: `${RUBBER_BAND_LAUNCHER_SHOT_BAND.title} (shot band, from the barrel’s tip into the notch)`, loop: RUBBER_BAND_LAUNCHER_SHOT_LOOP },
    ],
    steps: [
      { title: 'Free the trigger and fit the return band round the peg on the arm and the peg on the trigger', parts: ['return-band'], from: [0, -6, 0] },
      { title: 'Load a shot band: hook it into the groove at the barrel’s tip, stretch it back along both sides and into the notch, on the trigger', parts: ['shot-band'], from: [4, 0, 12], scaleFrom: [1.06, 1, 1] },
    ],
    motion: [
      { title: 'Pull the trigger: its top end lifts the shot band out of the notch, and the band flies', frames: pull.map((angle, i) => ({ trigger: rubberBandLauncherTriggerPose(angle), 'return-band': returnBandPose(angle), 'shot-band': shot[i] ?? shotBandPose(restTilt) })) },
      { title: 'Let go: the return band pulls the trigger back to rest', frames: angles(RUBBER_BAND_LAUNCHER_PULL, RUBBER_BAND_LAUNCHER_REST).map(angle => ({ trigger: rubberBandLauncherTriggerPose(angle), 'return-band': returnBandPose(angle) })) },
    ],
    lift: 70,
  };
})();
