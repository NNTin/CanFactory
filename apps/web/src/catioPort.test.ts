import { describe, expect, it } from 'vitest';
import { blankPanel, buttonOverlap, DOOR, DOOR_SEATS, setInDoor, type DoorPanel } from './catioDoor.ts';
import {
  BOLTS_PER_SIDE, boltStations, boxesOverlap, CUBE_BLOCK, CUBE_POCKET, CUBE_SWING_CLEAR, cubeClashes, cubeEdge, cubeFaces, DOOR_FIXINGS, edgeStripSection, edgeStripSegments, frameAlong,
  LATCH_INTO_RING, LATCH_REACH, LATCH_SWING_INTO, latchEnvelope, latchSwing, memberBox, PORT_FACES, portHalf, portLatches, portOutline, portRing, portTemplate, portTemplateSvg,
  SIDE_POCKET, SIDE_RAIL, SIDE_RING_SET, sideClashes, sidePocketPost, sidePortFaces, sidePortLength, sidePortOffset, STANDARD_PORT, type Face, type OrientedBox,
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
      // each face's ring a ring's depth and the pocket in from the edge: room for both faces' latches at every edge
      expect(cubeEdge(s)).toBe(portOutline(s) + 2 * (T + CUBE_POCKET));
      const ring = portRing(s);
      // its four members close round the opening and fill the outline, without overlapping
      const area = ring.reduce((n, [, [u0, u1, v0, v1]]) => n + (u1 - u0) * (v1 - v0), 0);
      expect(area).toBeCloseTo(portOutline(s) ** 2 - s ** 2, 9);
      expect(Math.min(...ring.map(([, r]) => r[0]))).toBe(-s / 2 - F); expect(Math.max(...ring.map(([, r]) => r[3]))).toBe(s + F);
    }
    expect(cubeEdge(300)).toBe(300 + 2 * (F + T + CUBE_POCKET));
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
    expect([...DOOR_FIXINGS]).toEqual(['turn-buttons', 'latches']);
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

  it('held by turn buttons: a panel set into the ring’s opening, the same button on all four sides', () => {
    for (const { size, material } of sizes) for (const seat of DOOR_SEATS) {
      const d = setInDoor({ id: 'd', width: size, height: size, material, seat, depth: T });
      expect(d.errors, `${material} ${size} ${seat}`).toEqual([]);
      expect(d.fit).toBe('set-in');
      const out = seat === 'rebate' ? DOOR.setIn.lap - DOOR.clearance : -DOOR.clearance;
      expect(d.rect).toEqual([-size / 2 - out, size / 2 + out, -out, size + out]);
      expect(['left', 'right', 'head', 'sill'].map(side => d.buttons.filter(b => b.side === side).length)).toEqual([1, 1, 1, 1]);
      // the buttons are where they would be had the door been turned a quarter round: it fits a port at any rotation
      expect(sameSet(pivots(d).map(p => quarter(p, size)), pivots(d))).toBe(true);
      // every button holds the panel closed and clears it open, its pivot on the ring
      for (const b of d.buttons) {
        expect(buttonOverlap(d, b, 0)).toBeCloseTo(DOOR.button.overlap, 6); expect(buttonOverlap(d, b, 1)).toBe(0);
        expect(Math.max(Math.abs(b.pivot[0]), Math.abs(b.pivot[1] - size / 2))).toBeLessThan(size / 2 + F);
      }
      // nothing of it stands proud of the ring's face but the buttons, and everything fixed is inside the opening
      for (const t of d.timber) for (const b of t.boxes) expect(b.center[2] + b.size[2] / 2).toBeLessThanOrEqual(0);
      for (const t of d.timber.filter(q => !q.moves)) for (const b of t.boxes) {
        expect(Math.abs(b.center[0]) + b.size[0] / 2).toBeLessThanOrEqual(size / 2 + 1e-9);
        expect(b.center[1] - b.size[1] / 2).toBeGreaterThanOrEqual(-1e-9); expect(b.center[1] + b.size[1] / 2).toBeLessThanOrEqual(size + 1e-9);
        expect(b.center[2] - b.size[2] / 2).toBeGreaterThanOrEqual(-T - 1e-9);
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
      for (const d of [blankPanel({ id: 'f', size, material: 'solid', land: F, gap, floor: true }), ...DOOR_SEATS.map(seat => setInDoor({ id: 'f', width: size, height: size, material: 'solid', seat, depth: T, floor: true }))]) {
        const plug = d.timber.find(t => t.id === 'floor-plug'); expect(plug, d.fit).toBeDefined();
        const [b] = plug?.boxes ?? [];
        // flush with the ring's inner face (n = −T), the opening filled but for the clearance (and, on stops, inside them)
        expect((b?.center[2] ?? 0) - (b?.size[2] ?? 0) / 2).toBeCloseTo(-T, 9);
        const inside = size - 2 * DOOR.clearance - (d.seat === 'stops' ? 2 * DOOR.setIn.lap : 0);
        expect(b?.size[0]).toBe(inside); expect(b?.size[1]).toBe(inside);
        expect(plug?.moves).toBe(true);
      }
      expect(blankPanel({ id: 'f', size, material: 'mesh', land: F, gap, floor: true }).errors).toContain('A floor door must be solid.');
    }
  });
});

describe('a cube’s latch pockets, from the latch’s real movement', () => {
  it('reaches as far as the mechanism moves it: closed along the joint past the ring, open out of the pocket', () => {
    // closed, the lever lies along the joint, past a 30 mm ring; opening, it swings out 38 mm from the side
    expect(LATCH_INTO_RING).toBeGreaterThan(T);
    expect(LATCH_REACH.swing.v[1]).toBeGreaterThan(LATCH_REACH.closed.v[1]);
    expect(LATCH_REACH.swing.u[0]).toBeLessThan(LATCH_REACH.closed.u[0]);
    expect(LATCH_REACH.width).toBe(38);
  });

  it('is the least pocket that keeps every face’s latch, open or closed, clear of the others, for every size and latch count', () => {
    expect(cubeClashes(CUBE_POCKET)).toBe(false);
    expect(cubeClashes(CUBE_POCKET - 1)).toBe(true);
    // and the old 30 mm notch (no pocket) is not enough: a lever swinging open would hit the next face's coupled element
    expect(cubeClashes(0)).toBe(true);
    const gap = PRINTED_LATCH_JOINT.gap;
    for (const s of SIZES) for (const perSide of [1, 2, 3] as const) {
      const faces = cube(s);
      const latches = PORT_FACES.flatMap(f => portLatches(f, faces[f], s, perSide, gap).map(q => ({ face: f, id: q.id, swing: latchSwing(q), closed: latchEnvelope(q) })));
      const solid = PORT_FACES.flatMap(f => [...portRing(s).map(([, rect]) => ({ face: f, box: memberBox(faces[f], rect, 0, T) })), ...mateRing(faces[f], s, gap).map(box => ({ face: f, box }))]);
      for (const q of latches) {
        for (const r of solid.filter(x => x.face !== q.face)) expect(boxesOverlap(q.swing, r.box, -CUBE_SWING_CLEAR), `${s} ${perSide} ${q.id}`).toBe(false);
        for (const r of latches.filter(x => x.face !== q.face)) expect(boxesOverlap(q.swing, r.closed, -CUBE_SWING_CLEAR), `${s} ${q.id} / ${r.id}`).toBe(false);
      }
    }
  });

  it('closes each edge between the latches with an edge strip glued to both rings’ sides, cut short of every latch station', () => {
    for (const s of SIZES) for (const perSide of [1, 2, 3] as const) {
      const C = cubeEdge(s); const strip = edgeStripSection(s); const segments = edgeStripSegments(s, perSide);
      // the corner square outside both rings' outlines: from the outline to the cube's edge, a ring's depth and the pocket
      expect(strip).toBe(T + CUBE_POCKET);
      // between the corner blocks
      expect(segments[0]?.[0]).toBeCloseTo(-(C / 2 - T - CUBE_BLOCK), 9); expect(segments.at(-1)?.[1]).toBeCloseTo(C / 2 - T - CUBE_BLOCK, 9);
      // each latch's station and its swing (its width and 2 mm each side) left open: its pocket
      const faces = cube(s);
      const swings = PORT_FACES.flatMap(f => portLatches(f, faces[f], s, perSide, PRINTED_LATCH_JOINT.gap).map(latchSwing));
      for (const [from, to] of segments) {
        expect(to).toBeGreaterThan(from);
        // a strip along the vertical edge at the back right: clear of every latch's swing
        const box: OrientedBox = { center: [s / 2 + F + strip / 2, -(s / 2 + F + strip / 2), (from + to) / 2], size: [strip, strip, to - from], axes: frameAlong([0, 1, 0]) };
        for (const q of swings) expect(boxesOverlap(box, q, 0.01), `${s} ${perSide}`).toBe(false);
      }
    }
  });
});

describe('a side port', () => {
  const frame = { x: [1, 0, 0] as V3, y: [0, 1, 0] as V3, z: [0, 0, 1] as V3 };

  it('lies on the section’s rails, its face flush with the flanges’ outline, its opening the tunnel’s', () => {
    for (const s of SIZES) {
      const { back, side } = sidePortFaces([0, 0, 0], frame, s, SIDE_POCKET);
      // the face at the flanges' outline, the ring its depth inside it on the rails' outer faces
      expect(side.at[0]).toBeCloseTo(s / 2 + F, 9); expect(SIDE_RING_SET).toBe(T); expect(s / 2 + F - T).toBe(s / 2 + SIDE_RAIL);
      // its opening level with the floor and as high as the tunnel, square onto the section's side
      expect(side.at[2]).toBeCloseTo(back.at[2], 9); expect(side.n.map(c => c + 0)).toEqual([-1, 0, 0]);
      // the stub: its end port's face the pocket and a ring's depth past the side ring's outline
      expect(-back.at[1]).toBeCloseTo(sidePortOffset(s), 9); expect(sidePortOffset(s)).toBe(s / 2 + F + SIDE_POCKET + T);
      expect(sidePortLength(s)).toBe(2 * sidePortOffset(s));
    }
  });

  it('has a pocket beside it from the latch’s real movement: the least that keeps both ports’ latches clear of each other’s ends', () => {
    expect(sideClashes(SIDE_POCKET)).toBe(false);
    expect(sideClashes(SIDE_POCKET - 1)).toBe(true);
    // larger than a cube's: the stub's flange reaches out to the side port's face, where a cube's next ring stops a pocket short of it
    expect(SIDE_POCKET).toBeGreaterThan(CUBE_POCKET);
    // the lever swings out along the section by more than the cube's pocket
    expect(LATCH_REACH.swing.v[1]).toBeGreaterThan(CUBE_POCKET);
    for (const s of SIZES) expect(sideClashes(SIDE_POCKET, s)).toBe(false);
  });

  it('closes the side behind the latches with a post in each pocket, clear of their swing', () => {
    const post = sidePocketPost(300);
    expect(post.width).toBe(SIDE_POCKET);
    // from the clear opening's plane out to just behind the latches' parts, open or closed
    expect(post.depth + CUBE_SWING_CLEAR + LATCH_SWING_INTO).toBeLessThanOrEqual(F + 1e-9);
    expect(post.depth).toBeGreaterThan(SIDE_RAIL - 10);
  });
});

describe('the marking template', () => {
  it('has every bolt station of every count, and a notch at every latch station on all four sides', () => {
    for (const s of SIZES) {
      const t = portTemplate(s);
      expect(t.size).toBe(portOutline(s)); expect(t.opening).toBe(s);
      for (const n of [1, 2, 3] as const) for (const [u, v] of boltStations(s, n)) expect(t.bolts.some(([a, b]) => Math.hypot(a - u, b - v) < 1e-6), `${s} ${n}`).toBe(true);
      // and nothing else: 4, 8 and 12 bolts share the middle station
      expect(t.bolts).toHaveLength(4 * 5);
      for (const side of [0, 1, 2, 3] as const) expect(t.notches.filter(q => q.side === side).map(q => q.along).sort((a, b) => a - b)).toEqual(t.notches.filter(q => q.side === 0).map(q => q.along).sort((a, b) => a - b));
      // a quarter turn maps it onto itself, so it marks a ring the same whichever side is up
      expect(sameSet(t.bolts.map(q => quarter(q, s)), t.bolts)).toBe(true);
      // the latch stations: on each side, at the fractions of every count
      for (const n of [1, 2, 3] as const) {
        const latches = portLatches('p', { at: [0, 0, 0], n: [0, 1, 0], frame: frameAlong([0, 1, 0]) }, s, n, 3);
        for (const q of latches) expect(t.notches.some(m => m.side === (q.side < 0 ? 0 : 2) && Math.abs((q.side < 0 ? m.along : -m.along) - (q.at[2] - s / 2)) < 1e-6), q.id).toBe(true);
      }
    }
  });

  it('draws at 1:1 in millimetres: an SVG with the outline, the opening, every hole and notch', () => {
    const svg = portTemplateSvg(300); const t = portTemplate(300);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="480mm" height="480mm" viewBox="0 0 480 480">/);
    expect(svg.match(/<circle /g)).toHaveLength(t.bolts.length);
    expect(svg.match(/<path /g)).toHaveLength(t.notches.length);
    expect(svg.match(/<rect /g)).toHaveLength(2);
    expect(svg).toContain('THIS SIDE OUT');
  });
});
