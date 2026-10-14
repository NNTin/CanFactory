import { describe, expect, it } from 'vitest';
import { blankPanel, buttonOverlap, DOOR, portPanel, type DoorPanel } from './catioDoor.ts';
import {
  BOLTS_PER_SIDE, boltStations, boxesOverlap, CUBE_BLOCK, cubeEdge, cubeFaces, DOOR_FIXINGS, frameAlong, latchEnvelope, memberBox, PORT_FACES, portHalf, portLatches, portOutline, portRing,
  STANDARD_PORT, type Face, type OrientedBox,
} from './catioPort.ts';
import { latchHeights, PRINTED_LATCH, PRINTED_LATCH_JOINT } from './catioPrintedLatch.ts';
import type { V3 } from './catioSubassembly.ts';

const { thickness: T, width: F } = STANDARD_PORT.ring;
const SIZES = [200, 250, 300, 380, 450];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const near = (a: V3, b: V3, tolerance = 1e-6) => Math.hypot(...sub(a, b)) < tolerance;
/** A point of the profile (u, v from the opening's foot) turned a quarter turn about the opening's middle. */
const quarter = ([u, v]: [number, number], s: number): [number, number] => [-(v - s / 2), s / 2 + u];
const sameSet = (a: [number, number][], b: [number, number][]) => a.length === b.length && a.every(p => b.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6));
/** A cube round the origin in the world's frame, entered along +Y. */
const cube = (s: number) => cubeFaces([0, 0, 0], frameAlong([0, 1, 0]), cubeEdge(s), s);
/** A standard element's ring `gap` outside the port on `face`, facing it: what a coupled element puts there. */
const mateRing = (face: Face, s: number, gap: number): OrientedBox[] => portRing(s).map(([, rect]) => memberBox(face, rect, -gap - T, -gap));

describe('the standard port', () => {
  it('is a square opening in a ring 30 deep and 70 wide, its outline and a cube’s edge following from it', () => {
    expect(STANDARD_PORT.ring).toEqual({ thickness: 30, width: 70 });
    for (const s of SIZES) {
      expect(portOutline(s)).toBe(s + 140);
      // the rings of two adjacent faces meet edge to edge at the inside of the corner, leaving a T × T notch outside both
      expect(cubeEdge(s)).toBe(portOutline(s) + 2 * T);
      const ring = portRing(s);
      // its four members close round the opening and fill the outline, without overlapping
      const area = ring.reduce((n, [, [u0, u1, v0, v1]]) => n + (u1 - u0) * (v1 - v0), 0);
      expect(area).toBeCloseTo(portOutline(s) ** 2 - s ** 2, 9);
      expect(Math.min(...ring.map(([, r]) => r[0]))).toBe(-s / 2 - F); expect(Math.max(...ring.map(([, r]) => r[3]))).toBe(s + F);
    }
    expect(cubeEdge(300)).toBe(500);
  });

  it('has the same bolt and latch stations on every side: a quarter turn maps them onto themselves', () => {
    for (const s of SIZES) for (const perSide of [1, 2, 3] as const) {
      const bolts = boltStations(s, perSide);
      expect(bolts).toHaveLength(4 * perSide);
      expect(sameSet(bolts.map(p => quarter(p, s)), bolts)).toBe(true);
      // on the middle line of the ring's outer 30 mm: clear of a section's corner rails (40 mm) and inside the ring
      for (const [u, v] of bolts) {
        const out = Math.max(Math.abs(u), Math.abs(v - s / 2)) - s / 2;
        expect(out).toBe(40 + (F - 40) / 2);
      }
      // the latches' fractions are symmetric, so the stations up one side are those across the others turned
      const f = latchHeights(perSide);
      const mirrored = f.map(x => 1 - x).sort(); for (const [i, x] of [...f].sort().entries()) expect(mirrored[i]).toBeCloseTo(x, 12);
    }
    expect(Object.entries(BOLTS_PER_SIDE)).toEqual([['4', 1], ['8', 2], ['12', 3]]);
  });

  it('carries, seen from outside, its latches’ base plates on its left and their catch plates on its right', () => {
    expect(portHalf(-1)).toBe('base'); expect(portHalf(1)).toBe('catch');
    const face: Face = { at: [0, 0, 0], n: [0, 1, 0], frame: frameAlong([0, 1, 0]) };
    for (const perSide of [1, 2, 3] as const) for (const gap of [PRINTED_LATCH_JOINT.gap]) {
      const latches = portLatches('p', face, 300, perSide, gap);
      expect(latches).toHaveLength(2 * perSide);
      for (const q of latches) {
        // the frame's x is to the right seen from outside (looking in along n): its left side has the port's base
        expect(q.base === 'port').toBe(q.side < 0);
        expect(q.out).toEqual(mul(face.frame.x, q.side));
        // the pull runs from the catch to the base: into the port when the base is on it
        expect(dot(q.pull, face.n)).toBe(q.base === 'port' ? 1 : -1);
        // the seam is the base plate's edge, `overhang` into the gap from the face of the element it is on
        const offset = dot(sub(q.at, face.at), face.n);
        expect(offset).toBeCloseTo(q.base === 'port' ? -PRINTED_LATCH.overhang : -(gap - PRINTED_LATCH.overhang), 9);
      }
    }
  });

  it('meets any other port with a base across from every catch, whichever way round it is turned', () => {
    // two ports facing each other across the gap, each in its own frame (x to the right seen from outside): the second one is the
    // first turned half round, as a section's start faces the end before it, at any of four quarter turns about the joint's axis
    const gap = PRINTED_LATCH_JOINT.gap; const s = 300;
    const a: Face = { at: [0, 0, 0], n: [0, 1, 0], frame: frameAlong([0, 1, 0]) };
    const mine = portLatches('a', a, s, 2, gap);
    // the element outside `a`, as its own port: its normal the other way, x mirrored
    const b: Face = { at: [0, -gap, 0], n: [0, -1, 0], frame: { x: [-1, 0, 0], y: [0, -1, 0], z: [0, 0, 1] } };
    const theirs = portLatches('b', b, s, 2, gap);
    for (const q of mine) {
      const across = theirs.find(r => near(add(r.at, mul(r.pull, 0)), r.at) && Math.abs(r.at[0] - q.at[0]) < 1e-6 && Math.abs(r.at[2] - q.at[2]) < 1e-6);
      expect(across, q.id).toBeDefined();
      // where `a` has its base, the other port has its catch: one latch, not two halves of the same kind
      expect((q.base === 'port') !== (across?.base === 'port')).toBe(true);
      // and the two describe the same latch: the same seam and pull
      expect(near(q.at, across?.at ?? [0, 0, 0])).toBe(true); expect(near(q.pull, across?.pull ?? [0, 0, 0])).toBe(true);
    }
  });

  it('offers both door fixings', () => {
    expect([...DOOR_FIXINGS]).toEqual(['latches', 'turn-buttons']);
  });
});

describe('a cube', () => {
  it('has six faces, each a standard port’s plane: normal into the cube, a right-handed frame, the opening’s foot on the plane', () => {
    for (const s of SIZES) {
      const C = cubeEdge(s); const faces = cube(s);
      expect(Object.keys(faces)).toEqual([...PORT_FACES]);
      const normals = PORT_FACES.map(f => faces[f].n);
      // six different directions, opposite in pairs
      for (const [i, n] of normals.entries()) {
        expect(Math.hypot(...n)).toBeCloseTo(1, 12);
        expect(normals.filter((m, j) => j !== i && near(m, mul(n, -1))).length).toBe(1);
      }
      for (const f of PORT_FACES) {
        const { at, n, frame } = faces[f];
        expect(near(frame.y, n)).toBe(true);
        expect(near(cross(frame.x, frame.y), frame.z)).toBe(true);
        // half an edge out from the centre, at the opening's foot (half the opening below the face's middle)
        expect(dot(at, n)).toBeCloseTo(-C / 2, 9);
        expect(near(add(at, mul(frame.z, s / 2)), mul(n, -C / 2))).toBe(true);
      }
      // the back face is the one a run along +Y enters by, in that run's frame, as a section's start face
      expect(faces.back.n).toEqual([0, 1, 0]); expect(faces.back.frame).toEqual(frameAlong([0, 1, 0]));
    }
  });

  it('has rings that meet edge to edge without overlapping, and corner blocks behind them', () => {
    for (const s of SIZES) {
      const faces = cube(s); const C = cubeEdge(s);
      const rings = PORT_FACES.flatMap(f => portRing(s).map(([name, rect]) => ({ id: `${f}-${name}`, face: f, box: memberBox(faces[f], rect, 0, T) })));
      for (const a of rings) for (const b of rings) if (a.face !== b.face) expect(boxesOverlap(a.box, b.box, 0.01), `${a.id} / ${b.id}`).toBe(false);
      // a block in each corner touches the three rings over it, inside them
      const reach = C / 2 - T - CUBE_BLOCK / 2;
      expect(reach + CUBE_BLOCK / 2).toBe(C / 2 - T);
      expect(reach - CUBE_BLOCK / 2).toBeGreaterThan(s / 2);
      const block: OrientedBox = { center: [reach, reach, reach], size: [CUBE_BLOCK, CUBE_BLOCK, CUBE_BLOCK], axes: frameAlong([0, 1, 0]) };
      for (const r of rings) expect(boxesOverlap(block, r.box, 0.01), r.id).toBe(false);
    }
  });

  it('keeps every face’s latches clear of the other faces’ rings, latches and coupled elements, coupled or closed by a latched door', () => {
    const gap = PRINTED_LATCH_JOINT.gap;
    for (const s of SIZES) for (const perSide of [1, 2, 3] as const) {
      const faces = cube(s);
      const latches = PORT_FACES.flatMap(f => portLatches(f, faces[f], s, perSide, gap).map(q => ({ face: f, id: q.id, box: latchEnvelope(q) })));
      const rings = PORT_FACES.flatMap(f => portRing(s).map(([name, rect]) => ({ face: f, id: `${f}-${name}`, box: memberBox(faces[f], rect, 0, T) })));
      // on every face a coupled element's ring (or a blank door's, the same outline), across the gap
      const mates = PORT_FACES.flatMap(f => mateRing(faces[f], s, gap).map((box, i) => ({ face: f, id: `${f}-mate-${i}`, box })));
      for (const q of latches) {
        for (const r of [...rings, ...mates].filter(r => r.face !== q.face)) expect(boxesOverlap(q.box, r.box, 0.01), `${q.id} / ${r.id}`).toBe(false);
        for (const r of latches.filter(r => r.face !== q.face)) expect(boxesOverlap(q.box, r.box, 0.01), `${q.id} / ${r.id}`).toBe(false);
      }
      // and the coupled elements of two faces stay clear of each other
      for (const a of mates) for (const b of mates.filter(m => m.face !== a.face)) expect(boxesOverlap(a.box, b.box, 0.01), `${a.id} / ${b.id}`).toBe(false);
    }
  });
});

describe('the standard doors', () => {
  const sizes = SIZES.flatMap(size => (['mesh', 'solid'] as const).map(material => ({ size, material })));
  const pivots = (d: DoorPanel) => d.buttons.map(b => [b.pivot[0], b.pivot[1]] as [number, number]);

  it('held by turn buttons: a panel lapping the ring all round, the same buttons on all four sides', () => {
    for (const { size, material } of sizes) {
      const d = portPanel({ id: 'd', size, material, land: F });
      expect(d.errors, `${material} ${size}`).toEqual([]);
      expect(d.fit).toBe('port');
      expect(d.rect).toEqual([-size / 2 - DOOR.lap, size / 2 + DOOR.lap, -DOOR.lap, size + DOOR.lap]);
      const count = (side: string) => d.buttons.filter(b => b.side === side).length;
      expect(new Set(['left', 'right', 'head', 'sill'].map(count)).size).toBe(1);
      // the buttons are where they would be had the door been turned a quarter round: it fits a port at any rotation
      expect(sameSet(pivots(d).map(p => quarter(p, size)), pivots(d))).toBe(true);
      // every button holds the panel closed and clears it open
      for (const b of d.buttons) { expect(buttonOverlap(d, b, 0)).toBeGreaterThan(DOOR.button.overlap - 1); expect(buttonOverlap(d, b, 1)).toBe(0); }
      // everything fixed stands on the ring, inside its outline
      for (const t of d.timber.filter(q => !q.moves)) for (const b of t.boxes) {
        expect(Math.abs(b.center[0]) + b.size[0] / 2).toBeLessThanOrEqual(size / 2 + F + 1e-9);
        expect(b.center[1] - b.size[1] / 2).toBeGreaterThanOrEqual(-F - 1e-9); expect(b.center[1] + b.size[1] / 2).toBeLessThanOrEqual(size + F + 1e-9);
      }
    }
  });

  it('held by the port’s latches: a blank ring of the port’s outline across the gap, closed by mesh or a sheet', () => {
    const gap = PRINTED_LATCH_JOINT.gap;
    for (const { size, material } of sizes) {
      const d = blankPanel({ id: 'd', size, material, land: F, gap });
      expect(d.errors).toEqual([]);
      expect(d.fit).toBe('blank'); expect(d.buttons).toEqual([]);
      expect(d.rect).toEqual([-size / 2 - F, size / 2 + F, -F, size + F]);
      expect(d.back).toBe(gap);
      // its ring is a flange ring's: the latches' plates go on its sides, T deep
      const ring = d.timber.filter(t => t.id.startsWith('blank-') && (t.id === 'blank-stile' || t.id === 'blank-rail')).flatMap(t => t.boxes);
      expect(ring).toHaveLength(4);
      for (const b of ring) { expect(b.size[2]).toBe(T); expect(b.center[2]).toBe(gap + T / 2); }
      expect(material === 'mesh' ? d.mesh : d.timber.some(t => t.id === 'blank-sheet')).toBeTruthy();
    }
  });

  it('on a floor face: solid, with a plug filling the port’s opening up to the ring’s inner face', () => {
    const gap = PRINTED_LATCH_JOINT.gap;
    for (const size of SIZES) {
      for (const d of [blankPanel({ id: 'f', size, material: 'solid', land: F, gap, floor: true }), portPanel({ id: 'f', size, material: 'solid', land: F, floor: true })]) {
        const plug = d.timber.find(t => t.id === 'floor-plug'); expect(plug, d.fit).toBeDefined();
        const [b] = plug?.boxes ?? [];
        // flush with the ring's inner face (n = −T), the opening filled but for the clearance
        expect((b?.center[2] ?? 0) - (b?.size[2] ?? 0) / 2).toBeCloseTo(-T, 9);
        expect(b?.size[0]).toBe(size - 2 * DOOR.clearance); expect(b?.size[1]).toBe(size - 2 * DOOR.clearance);
        expect(plug?.moves).toBe(true);
      }
      expect(blankPanel({ id: 'f', size, material: 'mesh', land: F, gap, floor: true }).errors).toContain('A floor door must be solid.');
    }
  });
});
