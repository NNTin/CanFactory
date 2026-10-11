import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { dipoleInteraction, type Dipole } from './magnets.ts';
import { add, cross, scale, sub } from './transform.ts';
import type { Vec3 } from './scene.ts';
import { loadEngine } from './engine.ts';
import { buildScene } from './build.ts';
import { Simulation } from './simulation.ts';
import { InteractiveSession, type PhysicsUpdate } from './interactive.ts';
import type { PhysicsSpec } from '@canfactory/contracts';

const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
const a: Dipole = { pos: [0, 0, 0], moment: [0, 0, 0.2], softening: 0.004 };
const b: Dipole = { pos: [0, 0, 0.03], moment: [0, 0, 0.1], softening: 0.003 };
const potential = (a: Dipole, b: Dipole) => {
  const r = sub(b.pos, a.pos), s2 = dot(r, r) + a.softening ** 2 + b.softening ** 2;
  return 1e-7 * (dot(a.moment, b.moment) / s2 ** 1.5 - 3 * dot(a.moment, r) * dot(b.moment, r) / s2 ** 2.5);
};

describe('softened dipoles', () => {
  it('attracts parallel axial poles, repels reversed poles, and has the far-field inverse-fourth force', () => {
    const result = dipoleInteraction(a, b);
    expect(result.force[2]).toBeLessThan(0);
    expect(result.torqueA).toEqual([0, 0, 0]);
    const reversed = dipoleInteraction(a, { ...b, moment: scale(b.moment, -1) });
    expect(reversed.force[2]).toBeCloseTo(-result.force[2], 12);
    const aa = { ...a, softening: 1e-9 }, bb = { ...b, softening: 1e-9 };
    expect(dipoleInteraction(aa, bb).force[2] / dipoleInteraction(aa, { ...bb, pos: scale(bb.pos, 2) }).force[2]).toBeCloseTo(16, 9);
  });
  it('is the negative gradient of one potential and conserves total force/angular momentum off axis', () => {
    const aa = { ...a, moment: [0.1, -0.2, 0.3] as Vec3 }, bb = { ...b, pos: [0.02, 0.01, 0.03] as Vec3, moment: [0.3, 0.1, -0.1] as Vec3 };
    const result = dipoleInteraction(aa, bb), h = 1e-7;
    for (const k of [0, 1, 2]) {
      const d = [0, 0, 0] as Vec3; d[k] = h;
      const gradient = -(potential(aa, { ...bb, pos: add(bb.pos, d) }) - potential(aa, { ...bb, pos: sub(bb.pos, d) })) / (2 * h);
      expect(result.force[k]).toBeCloseTo(gradient, 9);
    }
    const total = add(add(result.torqueA, result.torqueB), cross(sub(bb.pos, aa.pos), result.force));
    for (const v of total) expect(v).toBeCloseTo(0, 12);
    const swapped = dipoleInteraction(bb, aa);
    swapped.force.forEach((v, k) => expect(v).toBeCloseTo(-(result.force[k] ?? 0), 12));
    expect(Math.hypot(...result.torqueB)).toBeGreaterThan(0);
  });
  it('remains finite at coincident centres', () => {
    const result = dipoleInteraction(a, { ...b, pos: a.pos, moment: [0.1, 0, 0] });
    expect([...result.force, ...result.torqueA, ...result.torqueB].every(Number.isFinite)).toBe(true);
  });
});

const spec: PhysicsSpec = {
  bodies: [
    { id: 'fixed', fixed: true, material: 'petg', collision: { kind: 'none' } },
    { id: 'ball', material: 'petg', collision: { kind: 'sphere', centre: [0, 0, 0], diameter: 10 } },
    { id: 'upper', material: 'petg', fixed: true, joint: { type: 'slide', parent: 'ball', anchor: [0, 0, 0] }, collision: { kind: 'box', centre: [0, 0, 0], size: [2, 2, 2] } },
  ],
  magnets: [
    { id: 'grid', title: 'Grid', body: 'fixed', position: [0, 0, 0], moment: [0, 0, 0.2], softening: 4, switchable: true },
    { id: 'internal', title: 'Ball', body: 'ball', position: [2, 0, 0], moment: [0, 0, 0.1], softening: 3 },
  ],
};
const poses = { fixed: { position: [0, 0, 0] }, ball: { position: [0, 0, 30] }, upper: { position: [0, 0, 32] } };

it('compiles dipoles to SI, retains welded inertia, rejects invalid ids and rotates an offset dipole with its ball', async () => {
  const scene = buildScene({ spec, poses, geometry: {} });
  expect(scene.magnets?.[1]?.pos).toEqual([0.002, 0, 0]);
  expect(scene.magnets?.[0]?.softening).toBe(0.004);
  expect(scene.bodies[2]?.inertial?.mass).toBeCloseTo(1270 * 0.002 ** 3, 12);
  const firstMagnet = spec.magnets?.[0]; assert.ok(firstMagnet);
  for (const magnets of [[{ ...firstMagnet, body: 'unknown' }], [firstMagnet, firstMagnet]])
    expect(() => buildScene({ spec: { ...spec, magnets }, poses, geometry: {} })).toThrow();
  const engine = await loadEngine();
  const sim = new Simulation(engine, scene);
  try {
    expect(sim.movableBody('fixed')).toBeUndefined(); expect(sim.movableBody('upper')).toBe('ball');
    sim.step();
    const first = Array.from(sim.data.xfrc_applied);
    expect(first.some(v => Math.abs(v) > 0)).toBe(true);
    expect(first.filter((_, i) => i % 6 >= 3).some(v => Math.abs(v) > 1e-6)).toBe(true); // off-centre torque
    sim.setMagnetEnabled('grid', false); sim.step();
    expect(Array.from(sim.data.xfrc_applied).every(v => v === 0)).toBe(true);
    expect(() => sim.setMagnetEnabled('missing', true)).toThrow(/Unknown magnet/);
    sim.grab('upper', sim.pose('upper').pos); expect(sim.dragging).toBe('ball'); sim.release();
  } finally { sim.dispose(); }
  const reversed = new Simulation(engine, buildScene({ spec, poses: { ...poses, ball: { ...poses.ball, rotation: [180, 0, 0] } }, geometry: {} }));
  try {
    reversed.step();
    // fixed is body 1; the axial reaction is reversed with the internal magnet's polarity
    expect(reversed.data.xfrc_applied[8]).toBeLessThan(0);
  } finally { reversed.dispose(); }
});

it('ignores fixed/fixed support reactions and internal pairs on one welded moving assembly', async () => {
  const engine = await loadEngine(), grid = spec.magnets?.[0], internal = spec.magnets?.[1];
  assert.ok(grid); assert.ok(internal);
  const cases: PhysicsSpec[] = [
    { ...spec, bodies: [...spec.bodies, { id: 'fixed2', fixed: true, material: 'petg', collision: { kind: 'none' } }],
      magnets: [grid, { ...grid, id: 'other-grid', body: 'fixed2' }] },
    { ...spec, magnets: [{ ...grid, enabled: false }, internal, { ...internal, id: 'welded', body: 'upper' }] },
  ];
  for (const candidate of cases) {
    const sim = new Simulation(engine, buildScene({ spec: candidate, poses: { ...poses, fixed2: { position: [10, 0, 0] } }, geometry: {} }));
    try {
      sim.step();
      expect(Array.from(sim.data.xfrc_applied).every(v => v === 0)).toBe(true);
    } finally { sim.dispose(); }
  }
});

/** Outward-wound tetrahedron, mm; sufficient mesh to exercise the same interactive path as the browser. */
const tetra = Float32Array.from([0, 0, 0, 0, 10, 0, 10, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 10, 0, 10, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]);
it('switches fields without resetting time/poses, preserves states across restart/gravity, resets on a new session', async () => {
  const updates: PhysicsUpdate[] = [], session = new InteractiveSession(await loadEngine(), update => updates.push(update));
  const start = { type: 'start' as const, spec, poses, meshes: { fixed: tetra, ball: tetra, upper: tetra } };
  const last = () => { const value = updates.filter(update => update.type === 'poses').at(-1); assert.ok(value); return value; };
  const states = () => { const value = updates.filter(update => update.type === 'magnets').at(-1); assert.ok(value); return value.enabled; };
  try {
    await session.handle(start); session.tick(0.02);
    const before = last();
    await session.handle({ type: 'magnet', id: 'grid', enabled: false });
    expect(last()).toBe(before); expect(states()['grid']).toBe(false);
    session.tick(0.02); expect(last().time).toBeGreaterThan(before.time);
    for (const request of [{ type: 'restart' as const }, { type: 'gravity' as const, direction: [0, 0, 1] as Vec3 }]) {
      await session.handle(request); expect(states()['grid']).toBe(false); expect(last().time).toBe(0);
    }
    await session.handle(start); expect(states()['grid']).toBe(true);
    const ready = updates.filter(update => update.type === 'ready').at(-1); assert.ok(ready);
    expect(ready.movable).toEqual(['ball', 'upper']);
  } finally { await session.handle({ type: 'stop' }); }
});
