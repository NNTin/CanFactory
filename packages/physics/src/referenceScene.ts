/**
 * Spike 1's reference scene (docs/physics-plan.md): small printed-part-sized bodies exercising every kind of thing the physics
 * package builds (a mesh piece, primitives, a free body, a sprung hinge, a slide with dry friction), so that a hash of its state
 * after a fixed number of steps can be compared between Node (CI) and the browser.
 */
import { DEFAULT_OPTIONS, MM, type Scene } from './scene.ts';
import { IDENTITY } from './transform.ts';

/** A 10 mm cube as a convex mesh piece (its 8 corners), in metres. */
const cube = (half: number): number[] => [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].flatMap(z => [x * half, y * half, z * half])));

export const REFERENCE_STEPS = 2000;

export function referenceScene(): Scene {
  const friction: [number, number, number] = [0.5, 0.005, 0.0001];
  return {
    options: DEFAULT_OPTIONS,
    exclude: [],
    bodies: [
      { name: 'floor', parent: null, pos: [0, 0, 0], quat: IDENTITY, motion: 'weld', friction, geoms: [{ type: 'box', halfSize: [0.1, 0.1, 0.005], pos: [0, 0, -0.005], quat: IDENTITY }] },
      // a cube dropped 5 mm onto the floor, turned a little so that it lands on an edge
      { name: 'cube', parent: null, pos: [0, 0, 10 * MM], quat: [0.9990482, 0.0436194, 0, 0], motion: 'free', friction, geoms: [{ type: 'mesh', vertices: cube(5 * MM) }] },
      // a 4.5 mm steel ball dropped beside it
      { name: 'ball', parent: null, pos: [20 * MM, 0, 10 * MM], quat: IDENTITY, motion: 'free', friction, geoms: [{ type: 'sphere', radius: 2.25 * MM, pos: [0, 0, 0] }], inertial: { mass: 3.7e-4, pos: [0, 0, 0], inertia: [7.5e-10, 7.5e-10, 7.5e-10, 0, 0, 0] } },
      // a lever on a sprung hinge, held 30° from its spring's rest
      {
        name: 'lever', parent: null, pos: [-30 * MM, 0, 20 * MM], quat: IDENTITY, friction,
        motion: { type: 'hinge', pos: [0, 0, 0], axis: [0, 1, 0], range: [-1.5, 1.5], stiffness: 0.002, springRef: 0, damping: 1e-5, initial: 0.5 },
        geoms: [{ type: 'box', halfSize: [10 * MM, 2 * MM, 1 * MM], pos: [10 * MM, 0, 0], quat: IDENTITY }],
      },
      // a slider on a 20° slope with dry friction
      {
        name: 'slider', parent: null, pos: [0, 30 * MM, 10 * MM], quat: [0.9848078, 0, 0.1736482, 0], friction,
        motion: { type: 'slide', pos: [0, 0, 0], axis: [1, 0, 0], range: [-0.02, 0.02], frictionLoss: 0.001 },
        geoms: [{ type: 'box', halfSize: [3 * MM, 3 * MM, 3 * MM], pos: [0, 0, 0], quat: IDENTITY }],
      },
    ],
  };
}
