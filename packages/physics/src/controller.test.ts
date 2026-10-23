import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { PhysicsSpecSchema, type PhysicsSpec } from '@canfactory/contracts';
import { buildScene, type BuildInput } from './build.ts';
import { CycleController } from './controller.ts';
import { loadEngine } from './engine.ts';
import { DEG } from './scene.ts';
import { Simulation } from './simulation.ts';

/** A cube's corners, mm, centred on the origin, side `s`. */
const cube = (s: number): number[] => [-s / 2, s / 2].flatMap(x => [-s / 2, s / 2].flatMap(y => [-s / 2, s / 2].flatMap(z => [x, y, z])));

/**
 * A paddle (a 20 × 4 × 4 mm box) on a vertical hinge at the origin, turned by a small torque-limited motor (10 N·mm), with gravity
 * off-axis irrelevant; a fixed post stands in its way at 90°, and a 4 mm cube falls through a counter's plane below.
 */
function spec(post: boolean): PhysicsSpec {
  return {
    bodies: [
      { id: 'paddle', material: 'petg', collision: { kind: 'box', centre: [10, 0, 0], size: [20, 4, 4] }, joint: { type: 'hinge', anchor: [0, 0, 0], axis: [0, 0, 1] } },
      { id: 'post', material: 'petg', fixed: true, collision: post ? { kind: 'box', centre: [0, 14, 0], size: [4, 4, 4] } : { kind: 'none' } },
    ],
    maxStep: 0.0002,
    motors: [{ id: 'motor', title: 'Motor', body: 'paddle', torque: 10, stiffness: 50, damping: 0.5, inertia: 2000, speed: 90, acceleration: 400, slip: 1 }],
    items: [{ id: 'cube', title: 'Cube', group: 'cubes', vertices: cube(4), mass: 0.5, friction: 0.3, pose: { position: [40, 0, 10] } }],
    counters: [{ id: 'out', title: 'Out', group: 'cubes', kind: 'crossing', point: [0, 0, -5], along: [0, 0, -1], min: [30, -10, -50], max: [50, 10, 50] }],
    controller: {
      motor: 'motor', moves: [45, 45], pause: 0.05, settle: 0.1, debounce: 0.02, queue: 1, boot: 0.2, prime: 2, jog: 5, stall: 5, counter: 'out',
      controls: [{ id: 'b', title: 'Boot', label: 'B', action: 'dispense' }, { id: 'r', title: 'Reset', label: 'R', action: 'reset' }, { id: 'j', title: 'Jog', label: 'J', action: 'jog' }, { id: 'a', title: 'Aligned', label: 'A', action: 'aligned' }],
    },
  };
}

const input = (post: boolean): BuildInput => ({ spec: spec(post), poses: { paddle: { position: [0, 0, 0] }, post: { position: [0, 0, 0] } }, geometry: {} });

describe('motors, counters and a cycle controller', () => {
  it('are valid in the spec', () => { expect(Value.Check(PhysicsSpecSchema, spec(true))).toBe(true); });

  it('turn a hinge by the command, and count an item once as it falls through a plane', async () => {
    const engine = await loadEngine();
    const simulation = new Simulation(engine, buildScene(input(false)));
    try {
      simulation.moveMotor('motor', 60 * DEG);
      simulation.advance(1.5);
      const motor = simulation.motor('motor');
      expect(motor.actual / DEG).toBeCloseTo(60, 0);
      expect(motor.lost).toBe(0);
      expect(motor.moving).toBe(false);
      expect(simulation.counted('out')).toEqual(['cube']);
    } finally { simulation.dispose(); }
  });

  it('stall against an obstruction instead of passing through it, and report the lost travel', async () => {
    const engine = await loadEngine();
    const simulation = new Simulation(engine, buildScene(input(true)));
    try {
      simulation.moveMotor('motor', 120 * DEG);
      simulation.advance(2);
      const motor = simulation.motor('motor');
      // the post's near face is at y = 12, the paddle 2 mm thick: it stops near 90° less its half-width over the radius
      expect(motor.actual / DEG).toBeLessThan(90);
      expect(motor.actual / DEG).toBeGreaterThan(70);
      expect(Math.abs(motor.lost) / DEG).toBeGreaterThan(20);
      expect(simulation.distance('paddle', 'post')).toBeGreaterThan(-2e-4);
    } finally { simulation.dispose(); }
  });

  it('debounce presses, queue one, reject more, and reboot on reset without moving', async () => {
    const engine = await loadEngine();
    const simulation = new Simulation(engine, buildScene(input(false)));
    const settings = spec(false).controller;
    if (!settings) throw new Error('The test spec has a controller.');
    const controller = new CycleController(simulation, settings);
    const tap = (control: string, hold = 0.05) => { controller.press(control, true); simulation.advance(hold); controller.press(control, false); };
    try {
      // a 5 ms bounce does not count
      tap('b', 0.005);
      simulation.advance(0.1);
      expect(controller.report().state).toBe('ready');
      // a press, held for a second: one cycle, not more
      tap('b', 1);
      expect(controller.report().state).toBe('running');
      simulation.advance(2);
      expect(controller.report()).toMatchObject({ state: 'ready', cycles: 1, rejected: 0 });
      expect(controller.report().commanded).toBeCloseTo(90, 6);
      // three quick presses: one runs, one waits, one is rejected
      tap('b'); tap('b'); tap('b');
      expect(controller.report()).toMatchObject({ queued: 1, rejected: 1 });
      simulation.advance(4);
      expect(controller.report()).toMatchObject({ state: 'ready', cycles: 3, rejected: 1, queued: 0 });
      // a reset mid-cycle stops the motor; it boots, presses during boot are rejected, and it waits to be aligned
      tap('b');
      simulation.advance(0.3);
      tap('r');
      expect(controller.report().state).toBe('booting');
      const before = controller.report().commanded;
      tap('b');
      simulation.advance(0.5);
      expect(controller.report().commanded).toBeCloseTo(before, 0);
      expect(controller.report()).toMatchObject({ state: 'unaligned', cycles: 3, rejected: 2, last: { interrupted: true } });
      tap('b');
      expect(controller.report().rejected).toBe(3);
      tap('j');
      simulation.advance(0.5);
      tap('a');
      expect(controller.report().state).toBe('ready');
    } finally { simulation.dispose(); }
  });
});
