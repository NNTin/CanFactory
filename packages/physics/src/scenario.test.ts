import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { PhysicsSpecSchema, type PhysicsSpec } from '@canfactory/contracts';
import { buildScene, type BuildInput } from './build.ts';
import { loadEngine } from './engine.ts';
import { interpolate, runScenario } from './scenario.ts';
import { Simulation } from './simulation.ts';

/** A cube's corners, mm, from (0, 0, 0) to (s, s, s). */
const cube = (s: number): number[] => [0, s].flatMap(x => [0, s].flatMap(y => [0, s].flatMap(z => [x, y, z])));

/**
 * A plunger: a fixed block (a 20 mm box, as its convex piece) and a 4.5 mm steel ball on a sprung slide 1 mm above it. The spring (2 N/mm) is relaxed 2 mm above the assembled pose; it is about
 * critically damped (2 √(k m) = 0.0017 N·s/mm), so that it settles.
 */
const spec: PhysicsSpec = {
  bodies: [
    { id: 'block', material: 'petg', fixed: true },
    {
      id: 'ball', material: 'steel', collision: { kind: 'sphere', centre: [0, 0, 0], diameter: 4.5 },
      joint: { type: 'slide', parent: 'block', anchor: [10, 10, 23.25], axis: [0, 0, 1], range: [-5, 5], spring: { stiffness: 2, rest: 2 }, damping: 0.002 },
    },
  ],
  scenarios: [
    {
      id: 'rest', title: 'The spring pushes the ball up to its rest', duration: 1,
      checks: [{ kind: 'joint', at: 1, body: 'ball', min: 1.99, max: 2.01 }, { kind: 'contact', at: 1, bodies: ['ball', 'block'], touching: false }],
    },
    {
      id: 'pressed', title: 'Driven down 1 mm, the ball touches the block', duration: 0.5,
      drives: [{ kind: 'joint', body: 'ball', timeline: [[0, 0], [0.2, -1]] }],
      checks: [{ kind: 'joint', at: 0.5, body: 'ball', min: -1.01, max: -0.99 }, { kind: 'contact', at: 0.5, bodies: ['ball', 'block'], touching: true }],
    },
  ],
};

const input: BuildInput = {
  spec,
  poses: { block: { position: [0, 0, 0] }, ball: { position: [10, 10, 23.25] } },
  geometry: { block: { pieces: [cube(20)] } },
};

describe('mechanism spec', () => {
  it('is valid', () => { expect(Value.Check(PhysicsSpecSchema, spec)).toBe(true); });
});

describe('buildScene', () => {
  it('converts to SI and nests jointed bodies under their parents', () => {
    const scene = buildScene(input);
    const ball = scene.bodies.find(body => body.name === 'ball');
    expect(ball?.parent).toBe('block');
    expect(ball?.pos).toEqual([0.01, 0.01, 0.02325].map(value => expect.closeTo(value, 12) as number));
    const motion = ball?.motion;
    if (typeof motion !== 'object') throw new Error('The ball should have a joint.');
    expect(motion.stiffness).toBeCloseTo(2000, 9); // 2 N/mm
    expect(motion.springRef).toBeCloseTo(0.002, 12);
    expect(motion.range).toEqual([-0.005, 0.005].map(value => expect.closeTo(value, 12) as number));
    // the steel ball: 7.80 g/cm³ × 4/3 π (2.25 mm)³ = 0.372 g
    expect(ball?.inertial?.mass).toBeCloseTo(7800 * 4 / 3 * Math.PI * 0.00225 ** 3, 12);
    expect(scene.options.gravity).toEqual([0, 0, -9.81]);
  });

  it('turns gravity', () => { expect(buildScene({ ...input, gravity: [0, 0, 2] }).options.gravity).toEqual([0, 0, 9.81]); });

  it('drops an ideal joint for a contact one', () => {
    const contact: PhysicsSpec = { bodies: [spec.bodies[0] ?? { id: '', material: 'petg' }, { ...spec.bodies[1] ?? { id: '', material: 'petg' }, joint: { type: 'slide', parent: 'block', anchor: [10, 10, 23.25], model: 'contact' } }] };
    const ball = buildScene({ ...input, spec: contact }).bodies.find(body => body.name === 'ball');
    expect(ball?.motion).toBe('free');
    expect(ball?.parent).toBe(null);
  });

  it('needs pieces for a decomposed body', () => {
    expect(() => buildScene({ ...input, geometry: {} })).toThrow(/block needs its convex pieces/);
  });
});

describe('scenarios', () => {
  it('interpolates timelines', () => {
    expect(interpolate([[0, 0], [1, 10]], 0.25)).toEqual([2.5]);
    expect(interpolate([[1, 5, 6]], 0)).toEqual([5, 6]);
    expect(interpolate([[0, 0], [1, 10]], 3)).toEqual([10]);
  });

  it('run and check', async () => {
    const engine = await loadEngine();
    for (const scenario of spec.scenarios ?? []) {
      const result = runScenario(engine, input, scenario);
      expect(result.checks.map(check => `${String(check.pass)} ${check.description}`)).toEqual(result.checks.map(check => `true ${check.description}`));
    }
  });

  it('rests a free body on a fixed one', async () => {
    const simulation = new Simulation(await loadEngine(), buildScene({
      spec: { bodies: [{ id: 'block', material: 'petg', fixed: true }, { id: 'cube', material: 'petg' }] },
      poses: { block: { position: [0, 0, -20] }, cube: { position: [0, 0, 0] } },
      geometry: { block: { pieces: [cube(20)] }, cube: { pieces: [cube(10)] } },
    }));
    try {
      simulation.advance(0.3);
      expect(simulation.pose('cube').pos[2]).toBeCloseTo(0, 5);
      expect(simulation.touching('block', 'cube')).toBe(true);
    } finally {
      simulation.dispose();
    }
  });
});

describe('hullTriangles', () => {
  it('gives a cube 12 outward triangles', async () => {
    const { hullTriangles } = await import('./hull.ts');
    const { massProperties } = await import('./massProperties.ts');
    const vertices = cube(2);
    const triangles = hullTriangles([...vertices, 1, 1, 1]);
    expect(triangles).toHaveLength(36);
    const soup = triangles.flatMap(index => vertices.slice(3 * index, 3 * index + 3));
    expect(massProperties(soup).volume).toBeCloseTo(8, 9);
  });
});
