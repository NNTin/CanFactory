import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { assemblyState, assemblyStops, motionFrames, motionPose } from './assembly.ts';
import { AssemblySchema, toggleLatch, toggleLatchAssembly } from './models.ts';
import * as M from './toggleLatchMechanism.ts';

const source = (path: string) => readFileSync(new URL(`../../../models/toggle-latch/${path}`, import.meta.url), 'utf8');
const BASE = source('base.scad'), CATCH = source('catch.scad'), LEVER = source('reference/Latch 12mm 3.scad'), LINK = source('reference/Latch 12mm 4.scad');
/** A SCAD vector of points, `NAME = [[x, y], ...];`. */
const points = (file: string, name: string): M.Vec2[] => {
  const body = new RegExp(`^${name} = \\[([^;]*)\\];`, 'm').exec(file)?.[1] ?? '';
  return [...body.matchAll(/\[\s*([-\d.]+),\s*([-\d.]+)\]/g)].map(match => [Number(match[1]), Number(match[2])]);
};
/** A SCAD number or the first number of a SCAD expression or vector, `NAME = ...;`. */
const numbers = (file: string, name: string): number[] => {
  const line = new RegExp(`^${name}\\s*=\\s*([^;]*);`, 'm').exec(file)?.[1] ?? '';
  return [...line.matchAll(/-?\d+(?:\.\d+)?/g)].map(match => Number(match[0]));
};
const near = (a: M.Vec2, b: M.Vec2, tolerance = 1e-9) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tolerance;
const G = M.TOGGLE_LATCH_GEOMETRY, P = M.TOGGLE_LATCH_PROFILES;

describe('toggle latch mechanism', () => {
  it('draws on the SCAD files’ own profiles and joints', () => {
    expect(P.baseKnuckle).toEqual(points(BASE, 'BASE_KNUCKLE'));
    expect(P.catchHook).toEqual(points(CATCH, 'CATCH_HOOK'));
    expect(P.leverSide).toEqual(points(LEVER, 'LEVER_SIDE'));
    expect(P.leverBridge).toEqual(points(LEVER, 'LEVER_BRIDGE'));
    expect(P.linkSide).toEqual(points(LINK, 'LINK_SIDE'));
    expect(P.linkBar).toEqual(points(LINK, 'LINK_BAR'));
    expect([G.base.front, G.base.back, G.base.height, G.base.edgeRadius]).toEqual(['PLATE_FRONT', 'PLATE_BACK', 'PLATE_HEIGHT', 'EDGE_RADIUS'].map(name => numbers(BASE, name)[0]));
    expect([G.catch.front, G.catch.back, G.catch.height, G.catch.edgeRadius]).toEqual(['PLATE_FRONT', 'PLATE_BACK', 'PLATE_HEIGHT', 'EDGE_RADIUS'].map(name => numbers(CATCH, name)[0]));
    expect(G.base.pivot).toEqual(numbers(BASE, 'PIN_CENTRE'));
    for (const [g, file] of [[G.base, BASE], [G.catch, CATCH]] as const) {
      expect(g.length).toBe(numbers(file, 'PLATE_LENGTH')[0]);
      expect(g.holeX).toEqual(numbers(file, 'HOLE_X'));
      expect(g.holeZ).toBe(numbers(file, 'HOLE_Z')[0]);
    }
    expect(G.base.pinDiameter).toBe(numbers(BASE, 'PIN_D')[0]);
    expect(G.base.knuckle).toEqual(numbers(BASE, 'KNUCKLE_X'));
    expect(G.base.pins).toEqual(numbers(BASE, 'PIN_X'));
    expect(G.catch.hook).toEqual(numbers(CATCH, 'HOOK_X'));
    expect([G.lever.pivotDiameter, G.lever.pinDiameter]).toEqual([numbers(LEVER, 'PIVOT_D')[1], numbers(LEVER, 'PIN_D')[1]]);
    expect([G.lever.pinLength, G.lever.side, G.lever.width]).toEqual(['PIN_LENGTH', 'SIDE', 'WIDTH'].map(name => numbers(LEVER, name)[0]));
    expect([G.link.holeDiameter, G.link.side, G.link.width]).toEqual(['HOLE_D', 'SIDE', 'WIDTH'].map(name => numbers(LINK, name)[0]));
    const [k0 = 0, k1 = 0] = numbers(BASE, 'KNUCKLE_X'), [h0 = 0, h1 = 0] = numbers(CATCH, 'HOOK_X');
    expect(G.base.middle).toBeCloseTo((k0 + k1) / 2, 9);
    expect(G.catch.middle).toBeCloseTo((h0 + h1) / 2, 9);
    // the standard lever's centres: PIVOT_CENTRE = HITOL ? [...] : [x, z]
    expect(G.lever.pivot).toEqual(numbers(LEVER, 'PIVOT_CENTRE').slice(2));
    expect(G.lever.pin).toEqual(numbers(LEVER, 'PIN_CENTRE').slice(2));
    expect(G.lever.middle).toBe((numbers(LEVER, 'WIDTH')[0] ?? 0) / 2);
    expect(G.link.hole).toEqual(numbers(LINK, 'HOLE_CENTRE'));
    expect(G.link.middle).toBe((numbers(LINK, 'WIDTH')[0] ?? 0) / 2);
  });

  it('seats the link’s nose in the hook’s dip: two circles that fit their profiles’ points', () => {
    const onCircle = (profile: M.Vec2[], pick: (p: M.Vec2) => boolean, centre: M.Vec2, radius: number) => {
      const chosen = profile.filter(pick);
      expect(chosen.length).toBeGreaterThanOrEqual(7);
      for (const point of chosen) expect(Math.abs(Math.hypot(point[0] - centre[0], point[1] - centre[1]) - radius)).toBeLessThan(0.005);
    };
    onCircle(P.catchHook, ([y, z]) => y >= 4 && y <= 7.5 && z < 4.5, G.catch.dip.centre, G.catch.dip.radius);
    onCircle(P.linkBar, ([x]) => x > 8, G.link.nose.centre, G.link.nose.radius);
    expect(M.NOSE_PLAY).toBeCloseTo(0.582, 9);
  });

  it('lists the hooked link as the contact solver finds it', () => {
    expect(M.computeHookedTable()).toEqual(M.TOGGLE_LATCH_HOOKED);
  }, 20_000);

  it('keeps every joint together: the lever on the base’s pins, the link on the lever’s', () => {
    for (let i = 0; i <= 200; i++) {
      const state = M.latchCycleState(i / 200);
      expect(near(M.placePoint(state.lever, G.lever.pivot), M.PIVOT)).toBe(true);
      expect(near(M.placePoint(state.lever, G.lever.pin), state.pin)).toBe(true);
      expect(near(M.placePoint(state.link, G.link.hole), state.pin)).toBe(true);
      // rigid: every placement is a rotation or a reflection, never a stretch
      for (const { m } of [state.lever, state.link, state.catch]) {
        expect(Math.hypot(m[0], m[2])).toBeCloseTo(1, 12);
        expect(Math.abs(m[0] * m[3] - m[1] * m[2])).toBeCloseTo(1, 12);
      }
      // the catch only slides along the pull
      expect(state.catch.t[1]).toBe(G.catch.back);
    }
  });

  it('locks over centre: the catch is drawn in closest at the dead centre, and eases back as the lever comes to rest', () => {
    const gap = (angle: number) => -M.tautLink(angle).offset;
    expect(M.CLOSED).toBeLessThan(M.DEAD_CENTRE);
    expect(M.DEAD_CENTRE).toBeLessThan(M.RELEASED);
    expect(M.RELEASED).toBeLessThan(M.OPEN);
    for (let angle = M.CLOSED; angle < M.RELEASED; angle += 0.5) expect(gap(angle)).toBeGreaterThanOrEqual(gap(M.DEAD_CENTRE) - 1e-9);
    // past the dead centre the pull turns the lever on towards its stop: the gap grows again
    expect(gap(M.CLOSED)).toBeGreaterThan(gap(M.DEAD_CENTRE) + 0.2);
    expect(gap(M.RELEASED)).toBeGreaterThan(gap(M.CLOSED) + 1);
    // the plates never meet
    expect(gap(M.DEAD_CENTRE)).toBeGreaterThan(0.9);
    // the closed lever lies past the line through pin and pivot; the dead centre is that line
    expect(M.CLOSED).toBeCloseTo(-8.18, 2);
    expect(M.DEAD_CENTRE).toBeCloseTo(13.5, 1);
    expect(M.OPEN).toBeCloseTo(119.4, 1);
  });

  it('moves no part through another, across the latch’s width', () => {
    const base = M.placeProfile(M.BASE_PLACEMENT, P.baseKnuckle);
    const basePlate = M.placeProfile(M.BASE_PLACEMENT, M.BASE_PLATE_SECTION);
    for (let i = 0; i <= 240; i++) {
      const state = M.latchCycleState(i / 240);
      const lever = [M.placeProfile(state.lever, P.leverSide), M.placeProfile(state.lever, P.leverBridge)];
      const [side, bar] = [M.placeProfile(state.link, P.linkSide), M.placeProfile(state.link, P.linkBar)];
      const hook = M.placeProfile(state.catch, P.catchHook), catchPlate = M.placeProfile(state.catch, M.CATCH_PLATE_SECTION);
      const label = `${state.title} at ${i}/240`;
      // the plates span the whole width; the hook and the knuckle lie between the lever's and the link's side plates
      for (const part of [...lever, side, bar]) expect(M.polygonsOverlap(part, basePlate), label).toBe(false);
      for (const part of lever) expect(M.polygonsOverlap(part, hook), label).toBe(false);
      // the bar bears on the hook: they touch, to within 5 µm (interpolating the table between its half-degree rows)
      expect(M.polygonsOverlap(bar, M.placeProfile(M.catchPlacement(state.offset + 0.005), P.catchHook)), label).toBe(false);
      expect(M.polygonsOverlap(side, catchPlate), label).toBe(false);
      expect(M.polygonsOverlap(bar, base), label).toBe(false);
      expect(M.polygonsOverlap(basePlate, catchPlate), label).toBe(false);
    }
  });

  it('turns the plane placements into rigid 3D poses of the rendered parts', () => {
    const state = M.latchState(M.CLOSED);
    const poses = M.latchPoses(state);
    // the pose's rotation about X, then Y, then Z, then its translation, as the preview and `npm run check:assembly` apply it
    const apply = ({ position, rotation }: M.LatchPose, [x0, y0, z0]: [number, number, number]): [number, number, number] => {
      const [a, b, c] = rotation.map(degrees => degrees * Math.PI / 180) as [number, number, number];
      let [x, y, z] = [x0, y0, z0];
      [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
      [x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
      [x, y] = [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)];
      return [x + position[0], y + position[1], z + position[2]];
    };
    const check = (pose: M.LatchPose, placement: M.Placement2D, point: [number, number, number], profile: [number, number], width: number, middle: number) => {
      const [x, y, z] = apply(pose, point);
      const [u, v] = M.placePoint(placement, [point[profile[0]] ?? 0, point[profile[1]] ?? 0]);
      expect(y).toBeCloseTo(u, 3); expect(z).toBeCloseTo(v, 3);
      expect(Math.abs(x)).toBeCloseTo(Math.abs((point[width] ?? 0) - middle), 3);
    };
    for (const point of [[0, 0, 0], [3, 7, 11], [38, 15, 12]] as [number, number, number][]) {
      check(poses.base, M.BASE_PLACEMENT, point, [1, 2], 0, G.base.middle);
      check(poses.catch, state.catch, point, [1, 2], 0, G.catch.middle);
      check(poses.lever, state.lever, point, [0, 2], 1, G.lever.middle);
      check(poses.link, state.link, point, [0, 2], 1, G.link.middle);
    }
    // the base's plate lies on the floor, the latch's middle on x = 0
    expect(apply(poses.base, [0, G.base.back, 0])[2]).toBeCloseTo(0, 9);
    expect(apply(poses.base, [G.base.middle, 0, 0])[0]).toBeCloseTo(0, 9);
  });
});

describe('toggle latch assembly preview', () => {
  const assembly = toggleLatchAssembly();

  it('is the model’s assembly: exploded, put together, then hooked, closed over centre, opened and closed again', () => {
    expect(toggleLatch.assembly).toEqual(assembly);
    expect(Value.Check(AssemblySchema, assembly)).toBe(true);
    expect(Object.keys(assembly.poses).sort()).toEqual(['base', 'catch', 'lever', 'link']);
    expect(assembly.steps.map(step => step.parts)).toEqual([['lever'], ['link'], ['catch']]);
    expect(assembly.motion?.map(movement => movement.title)).toEqual(M.TOGGLE_LATCH_MOVEMENTS.map(movement => movement.title));
    expect(assemblyStops(assembly)).toBe(2 + 3 + 5);
    // assembled released; the last frame is the locked latch
    expect(assembly.poses).toEqual(M.latchPoses(M.latchState(M.OPEN, M.SWING)));
    const frames = motionFrames(assembly);
    expect(frames.at(-1)?.at(-1)).toEqual(M.latchPoses(M.latchState(M.CLOSED)));
    expect(frames[2]?.at(-1)).toEqual(M.latchPoses(M.latchState(M.CLOSED)));
  });

  it('samples each movement densely: no part moves 3 mm between two frames', () => {
    for (const movement of motionFrames(assembly)) for (let i = 1; i < movement.length; i++) for (const id of ['lever', 'link']) {
      const [a, b] = [movement[i - 1]?.[id], movement[i]?.[id]];
      const shift = Math.hypot(...[0, 1, 2].map(axis => (b?.position[axis] ?? 0) - (a?.position[axis] ?? 0)));
      expect(shift).toBeLessThan(3);
    }
  });

  it('plays the movements after the steps, from the poses each movement starts in', () => {
    const frames = motionFrames(assembly);
    const steps = assembly.steps.length;
    const segments = steps + 1 + 5;
    expect(motionPose(frames, 'lever', assemblyState(assembly, (steps + 1) / segments))).toBeUndefined();
    const hooking = motionPose(frames, 'link', assemblyState(assembly, (steps + 1.5) / segments));
    expect(hooking?.from).toEqual(frames[0]?.[Math.floor(hooking ? 0.5 * (frames[0].length - 1) : 0)]?.['link']);
    const end = motionPose(frames, 'lever', assemblyState(assembly, 1));
    expect(end?.f).toBeCloseTo(1, 9);
    expect(end?.to).toEqual(M.latchPoses(M.latchState(M.CLOSED)).lever);
  });
});
