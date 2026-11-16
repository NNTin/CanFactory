import { Type, type TNever } from 'typebox';
import type { Assembly, LinkedReference } from './models.ts';

/** Fixed conversion of jhappone's STEP assembly, fitted for real hardware. See models/trolley-token/CONVERSION.md. */
// An empty property map with an impossible index type keeps the render-request union assignable to ParameterValues.
const noParameters: Record<string, TNever> = {};
export const TrolleyTokenParametersSchema = Type.Object(noParameters, { additionalProperties: false });
export const TROLLEY_TOKEN_CLIP_ANGLE = 0.26138493093829307;
export const TROLLEY_TOKEN_HINGE = [10.8125, 0, 4.5] as const;
const CLOSED_POSITION = [13.330722033, 0, 8.488553446] as const;
/** How far the pad presses the clip open, in degrees. */
export const TROLLEY_TOKEN_OPENING = 15;

/**
 * The clamp's hardware, as body.scad and clip.scad are fitted for it (a test keeps the numbers equal): an ISO 4762 M2 × 16 socket
 * head screw as the pivot, its head on the +Y hinge ear, into an ISO 4032 M2 nut trapped in the -Y ear; and a Gutekunst T-16102L
 * torsion spring (180° legs, side by side) on the screw between the clip's knuckles. The spring's first leg, cut to `legs[0]` mm,
 * bears down on the body's seat at `bodyLegAngle`; its second, cut to `legs[1]` mm, bears up on the clip's pad at `clipLegAngle`
 * when closed (degrees, raising the leg's front from pointing straight ahead). Wound by their difference closed, and by the
 * opening more when the pad is pressed, it pushes the pad up and so closes the rear grip.
 */
export const TROLLEY_TOKEN_HARDWARE = {
  screw: 'iso-4762-m2x16', nut: 'iso-4032-m2', spring: 'gutekunst-t-16102l',
  /** The ears' outer faces, where the screw's head and (16 mm on) its tip are. */
  earY: 7.5, screwLength: 16, nutHeight: 1.6,
  bodyLegAngle: 18, clipLegAngle: -10, legs: [5, 6] as [number, number],
  /** The spring's unloaded coil body: centred on the hinge between the knuckles. */
  coilLength: 2.75,
} as const;
/** The spring's wind with the clip opened by `openingDegrees`: closed, the difference of its legs' angles. */
export const trolleyTokenSpringWind = (openingDegrees: number): number =>
  TROLLEY_TOKEN_HARDWARE.bodyLegAngle - TROLLEY_TOKEN_HARDWARE.clipLegAngle + openingDegrees;

/** Rotate the clip about the source's axle, rather than about its print-bed origin. Positive opening raises the rear jaw. */
export function trolleyTokenClipPose(openingDegrees: number): Assembly['poses'][string] {
  const a = -openingDegrees * Math.PI / 180;
  const x = CLOSED_POSITION[0] - TROLLEY_TOKEN_HINGE[0], z = CLOSED_POSITION[2] - TROLLEY_TOKEN_HINGE[2];
  return {
    position: [TROLLEY_TOKEN_HINGE[0] + Math.cos(a) * x + Math.sin(a) * z, 0, TROLLEY_TOKEN_HINGE[2] - Math.sin(a) * x + Math.cos(a) * z],
    rotation: [180, TROLLEY_TOKEN_CLIP_ANGLE - openingDegrees, 0],
  };
}

/**
 * The spring on the hinge: its coil's axis (Z as the parts library draws it) along +Y, its first leg turned to the body's seat;
 * only its wind changes as the clip opens, which turns its second leg with the clip.
 */
export function trolleyTokenSpringPose(openingDegrees: number): LinkedReference['pose'] {
  const [x, , z] = TROLLEY_TOKEN_HINGE;
  return { position: [x, -TROLLEY_TOKEN_HARDWARE.coilLength / 2, z], rotation: [-90, TROLLEY_TOKEN_HARDWARE.bodyLegAngle, 0], wind: trolleyTokenSpringWind(openingDegrees) };
}

/** The screw, the nut and the spring, where the clamp has them: the parts list and the preview's reference objects. */
export function trolleyTokenHardware(): LinkedReference[] {
  const [x, , z] = TROLLEY_TOKEN_HINGE;
  const { earY, screwLength } = TROLLEY_TOKEN_HARDWARE;
  const tip = earY - screwLength;
  return [
    { id: 'spring', part: TROLLEY_TOKEN_HARDWARE.spring, label: 'on the pivot, legs cut to 5 and 6 mm', pose: trolleyTokenSpringPose(0), legs: TROLLEY_TOKEN_HARDWARE.legs, movesWith: 'clip' },
    // turned so that its corners point up and down, as its trap is
    { id: 'nut', part: TROLLEY_TOKEN_HARDWARE.nut, label: 'in the trap of the −Y ear', pose: { position: [x, tip, z], rotation: [-90, 0, 0] }, step: { title: 'Push the M2 nut into its trap in the ear', from: [0, -8, 0] } },
    { id: 'screw', part: TROLLEY_TOKEN_HARDWARE.screw, label: 'the pivot', pose: { position: [x, tip, z], rotation: [-90, 0, 0] }, step: { title: 'Push the M2 × 16 screw through the ears, the clip and the spring; tighten it into the nut', from: [0, 22, 0] } },
  ];
}

const opening = (degrees: number) => ({ clip: trolleyTokenClipPose(degrees), spring: trolleyTokenSpringPose(degrees) });

// Inverses of the conversion's rigid print transforms, translated to the body's centre.
export const trolleyTokenAssembly: Assembly = {
  poses: { body: { position: [0, 0, 0] }, clip: trolleyTokenClipPose(0) },
  partColors: { body: '#497c85', clip: '#e5d9bb' },
  steps: [{ title: 'Put the spring between the clip’s knuckles, legs crossed onto their seats; lower the clip between the hinge ears', parts: ['clip'], from: [0, 0, 18] }],
  motion: [
    { title: 'Press the pad to open the paper grip', frames: Array.from({ length: TROLLEY_TOKEN_OPENING }, (_, i) => opening(i + 1)) },
    { title: 'Release the pad: the spring closes the grip', frames: Array.from({ length: TROLLEY_TOKEN_OPENING }, (_, i) => opening(TROLLEY_TOKEN_OPENING - 1 - i)) },
  ],
  lift: 12,
};
