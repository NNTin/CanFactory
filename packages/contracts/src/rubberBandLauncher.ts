import { Type, type TNever } from 'typebox';
import type { Assembly } from './models.ts';
import type { PrintBody } from './printBodies.ts';

/** Verified reconstruction of FerryTeacher's print-in-place launcher. See models/rubber-band-launcher/references/VERIFICATION.md. */
// An empty property map with an impossible index type keeps the render-request union assignable to ParameterValues.
const noParameters: Record<string, TNever> = {};
export const RubberBandLauncherParametersSchema = Type.Object(noParameters, { additionalProperties: false });

/** The trigger's pivot pins, in the print's frame (launcher.scad PIVOT, stood up by print_pose): an axis along Y. */
export const RUBBER_BAND_LAUNCHER_PIVOT = [20.691, 0, 54.813 - 36.527] as const;
/** How far the trigger turns when pulled, in degrees: to the spine, which it meets at about 8.5 degrees. `npm run check:assembly --
 * rubber-band-launcher` proves the range. */
export const RUBBER_BAND_LAUNCHER_PULL = 8;

/** The trigger turned by `degrees` about its pins. Positive pulls it: the ridged finger end moves back towards the grip and the
 * top end rises at the back of the barrel, until the trigger meets the frame's spine (just under 9 degrees). */
export function rubberBandLauncherTriggerPose(degrees: number): Assembly['poses'][string] {
  const a = degrees * Math.PI / 180, [px, , pz] = RUBBER_BAND_LAUNCHER_PIVOT;
  // Rotation about Y: x' = x cos a + z sin a, z' = -x sin a + z cos a; the pivot stays put.
  return { position: [px - (Math.cos(a) * px + Math.sin(a) * pz), 0, pz - (-Math.sin(a) * px + Math.cos(a) * pz)], rotation: [0, degrees, 0] };
}

/** The print's two bodies (ModelPart.bodies), each told by a point inside it: the frame by the web between its grip pockets, the
 * trigger by its pivot axis, halfway through its thickness. */
export const RUBBER_BAND_LAUNCHER_BODIES: PrintBody[] = [
  { id: 'frame', title: 'Frame', point: [35, -0.3, 54.813 + 20.8] },
  { id: 'trigger', title: 'Trigger', point: [RUBBER_BAND_LAUNCHER_PIVOT[0], -0.3, RUBBER_BAND_LAUNCHER_PIVOT[2]] },
];

const STEPS = 6;
// One print-in-place piece: the bodies stay where they print (no lift, nothing put together). The one step is freeing the
// trigger, which then turns on its own against the frame.
export const rubberBandLauncherAssembly: Assembly = {
  poses: { frame: { position: [0, 0, 0] }, trigger: rubberBandLauncherTriggerPose(0) },
  partColors: { frame: '#497c85', trigger: '#e5a54b' },
  steps: [{ title: 'Free the trigger: work it gently until it turns on its pins', parts: ['trigger'], from: [0, 0, 0] }],
  motion: [
    { title: 'Pull the trigger to its stop', frames: Array.from({ length: STEPS }, (_, i) => ({ trigger: rubberBandLauncherTriggerPose(RUBBER_BAND_LAUNCHER_PULL * (i + 1) / STEPS) })) },
    { title: 'Release the trigger', frames: Array.from({ length: STEPS }, (_, i) => ({ trigger: rubberBandLauncherTriggerPose(RUBBER_BAND_LAUNCHER_PULL * (STEPS - 1 - i) / STEPS) })) },
  ],
  lift: 0,
};
