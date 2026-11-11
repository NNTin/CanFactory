import { Type, type TNever } from 'typebox';
import type { Assembly } from './models.ts';

/** Fixed conversion of jhappone's STEP assembly. See models/trolley-token/CONVERSION.md. */
// An empty property map with an impossible index type keeps the render-request union assignable to ParameterValues.
const noParameters: Record<string, TNever> = {};
export const TrolleyTokenParametersSchema = Type.Object(noParameters, { additionalProperties: false });
export const TROLLEY_TOKEN_CLIP_ANGLE = 0.26138493093829307;
export const TROLLEY_TOKEN_HINGE = [10.8125, 0, 4.5] as const;
const CLOSED_POSITION = [13.330722033, 0, 8.488553446] as const;

/** Rotate the clip about the source's axle, rather than about its print-bed origin. Positive opening raises the rear jaw. */
export function trolleyTokenClipPose(openingDegrees: number): Assembly['poses'][string] {
  const a = -openingDegrees * Math.PI / 180;
  const x = CLOSED_POSITION[0] - TROLLEY_TOKEN_HINGE[0], z = CLOSED_POSITION[2] - TROLLEY_TOKEN_HINGE[2];
  return {
    position: [TROLLEY_TOKEN_HINGE[0] + Math.cos(a) * x + Math.sin(a) * z, 0, TROLLEY_TOKEN_HINGE[2] - Math.sin(a) * x + Math.cos(a) * z],
    rotation: [180, TROLLEY_TOKEN_CLIP_ANGLE - openingDegrees, 0],
  };
}

// Inverses of the conversion's rigid print transforms, translated to the body's centre.
export const trolleyTokenAssembly: Assembly = {
  poses: { body: { position: [0, 0, 0] }, clip: trolleyTokenClipPose(0) },
  partColors: { body: '#497c85', clip: '#e5d9bb' },
  steps: [{ title: 'Lower the clip between the hinge ears; fit the spring and axle', parts: ['clip'], from: [0, 0, 18] }],
  motion: [
    { title: 'Press the pad to open the paper grip', frames: Array.from({ length: 15 }, (_, i) => ({ clip: trolleyTokenClipPose(i + 1) })) },
    { title: 'Release the pad to close the grip', frames: Array.from({ length: 15 }, (_, i) => ({ clip: trolleyTokenClipPose(14 - i) })) },
  ],
  lift: 12,
};
