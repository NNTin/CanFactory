import { describe, expect, it } from 'vitest';
import { loadEngine } from './engine.ts';
import { inertialOf, massProperties } from './massProperties.ts';
import { toMjcf } from './mjcf.ts';
import { REFERENCE_STEPS, referenceScene } from './referenceScene.ts';
import { DEFAULT_OPTIONS, MM, type Scene } from './scene.ts';
import { Simulation } from './simulation.ts';
import { IDENTITY, quatFromPoseRotation, rotate } from './transform.ts';

/** The reference scene's state hash after REFERENCE_STEPS steps with @mujoco/mujoco 3.14.0 (single-threaded). Renew it only
 * after an engine upgrade, and check the browser gives the same (docs/physics-plan.md, "Determinism"). */
const REFERENCE_HASH = '97aa7205e6d866e8';

/** A closed axis-aligned box mesh, outward-wound, from (0, 0, 0) to (a, b, c). */
function boxTriangles(a: number, b: number, c: number): number[] {
  const v = (x: number, y: number, z: number) => [x * a, y * b, z * c];
  const quads = [
    [v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)], [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)],
    [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)], [v(0, 1, 0), v(0, 1, 1), v(1, 1, 1), v(1, 1, 0)],
    [v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0)], [v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)],
  ];
  return quads.flatMap(([p, q, r, s]) => [...p ?? [], ...q ?? [], ...r ?? [], ...p ?? [], ...r ?? [], ...s ?? []]);
}

describe('mass properties', () => {
  it('match a box’s', () => {
    const properties = massProperties(boxTriangles(2, 4, 6));
    expect(properties.volume).toBeCloseTo(48, 9);
    expect(properties.centroid).toEqual([1, 2, 3].map(value => expect.closeTo(value, 9) as number));
    // about the centroid, per unit density: m (b² + c²) / 12, ...
    const [xx, yy, zz, xy, xz, yz] = properties.inertia;
    expect(xx).toBeCloseTo(48 * (16 + 36) / 12, 6);
    expect(yy).toBeCloseTo(48 * (4 + 36) / 12, 6);
    expect(zz).toBeCloseTo(48 * (4 + 16) / 12, 6);
    for (const product of [xy, xz, yz]) expect(product).toBeCloseTo(0, 6);
  });

  it('scale millimetres and g/m³ to SI', () => {
    const inertial = inertialOf(massProperties(boxTriangles(10, 10, 10)), 1270, MM);
    expect(inertial.mass).toBeCloseTo(1.27e-3, 12);
    expect(inertial.pos).toEqual([5e-3, 5e-3, 5e-3].map(value => expect.closeTo(value, 12) as number));
    expect(inertial.inertia[0]).toBeCloseTo(1.27e-3 * 2e-4 / 12, 15);
  });

  it('refuse an inside-out mesh', () => {
    const triangles = boxTriangles(1, 1, 1);
    const flipped: number[] = [];
    for (let i = 0; i < triangles.length; i += 9) flipped.push(...triangles.slice(i, i + 3), ...triangles.slice(i + 6, i + 9), ...triangles.slice(i + 3, i + 6));
    expect(() => massProperties(flipped)).toThrow(/inside out/);
  });
});

describe('pose rotation', () => {
  it('turns about X, then Y, then Z (fixed axes)', () => {
    const q = quatFromPoseRotation([90, 90, 0]);
    // X first: +Y goes to +Z; then Y: +Z goes to +X
    const v = rotate(q, [0, 1, 0]);
    expect(v.map(value => Math.round(value * 1e9) / 1e9)).toEqual([1, 0, 0]);
  });
});

describe('MJCF', () => {
  it('nests bodies and escapes names', () => {
    const scene: Scene = {
      options: DEFAULT_OPTIONS, exclude: [['a', 'b"c']],
      bodies: [
        { name: 'a', parent: null, pos: [0, 0, 0], quat: IDENTITY, motion: 'weld', friction: [1, 0, 0], geoms: [] },
        { name: 'b"c', parent: 'a', pos: [0, 0, 0], quat: IDENTITY, motion: 'free', friction: [1, 0, 0], geoms: [{ type: 'sphere', radius: 1, pos: [0, 0, 0] }] },
      ],
    };
    const xml = toMjcf(scene);
    expect(xml).toContain('<body name="b&quot;c"');
    expect(xml.indexOf('name="b&quot;c"')).toBeGreaterThan(xml.indexOf('<body name="a"'));
    expect(xml).toContain('<exclude body1="a" body2="b&quot;c"/>');
  });

  it('refuses an unknown parent', () => {
    expect(() => toMjcf({ options: DEFAULT_OPTIONS, exclude: [], bodies: [{ name: 'a', parent: 'nope', pos: [0, 0, 0], quat: IDENTITY, motion: 'weld', friction: [1, 0, 0], geoms: [] }] }))
      .toThrow(/parent nope/);
  });
});

describe('simulation', () => {
  it('rests small parts within 1 µm of the floor', async () => {
    const simulation = new Simulation(await loadEngine(), referenceScene());
    try {
      simulation.advance(1);
      // the cube's centre rests 5 mm up, the ball's 2.25 mm
      expect(Math.abs(simulation.pose('cube').pos[2] - 5 * MM)).toBeLessThan(1e-6);
      expect(Math.abs(simulation.pose('ball').pos[2] - 2.25 * MM)).toBeLessThan(1e-6);
      expect(simulation.contacts().some(contact => contact.body1 === 'floor' && contact.body2 === 'cube')).toBe(true);
      // the sprung lever has swung back towards its spring's rest; the slider has not slid down (its friction holds)
      expect(Math.abs(simulation.jointValue('lever'))).toBeLessThan(0.5);
    } finally {
      simulation.dispose();
    }
  });

  it('gives the same state hash run after run', async () => {
    const engine = await loadEngine();
    const hashes = [0, 1].map(() => {
      const simulation = new Simulation(engine, referenceScene());
      try {
        simulation.step(REFERENCE_STEPS);
        return simulation.stateHash();
      } finally {
        simulation.dispose();
      }
    });
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[0]).toBe(REFERENCE_HASH);
  });

  it('drags a body by a point', async () => {
    const simulation = new Simulation(await loadEngine(), referenceScene());
    try {
      simulation.advance(0.2);
      const start = simulation.pose('cube').pos;
      simulation.grab('cube', [start[0], start[1], start[2] + 5 * MM]);
      simulation.dragTo([start[0] + 20 * MM, start[1], start[2] + 25 * MM]);
      simulation.advance(0.5);
      const held = simulation.pose('cube').pos;
      expect(held[0] - start[0]).toBeCloseTo(20 * MM, 3);
      expect(simulation.dragging).toBe('cube');
      simulation.release();
      simulation.advance(0.5);
      expect(simulation.pose('cube').pos[2]).toBeLessThan(held[2]);
    } finally {
      simulation.dispose();
    }
  });
});
