import { describe, expect, it } from 'vitest';
import { blankPanel, BOLTS_PER_SIDE, boltStations, buttonOverlap, DOOR, DOOR_FIXINGS, DOOR_SEATS, frameAlong, LATCH_INTO_RING, LATCH_REACH, latchHeights, portHalf, portLatches, portOutline, portRing, portTemplate, portTemplateSvg, PRINTED_LATCH, PRINTED_LATCH_JOINT, setInDoor, sidePortFace, sidePortLength, sidePortOffset, STANDARD_PORT, type DoorPanel, type Face, type V3 } from '@canfactory/catio';

const { thickness: T, width: F } = STANDARD_PORT.ring;
const SIZES = [200, 250, 300, 380, 450];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const near = (a: V3, b: V3, tolerance = 1e-6) => Math.hypot(...sub(a, b)) < tolerance;
/** A point of the profile (u, v from the opening's foot) turned a quarter turn about the opening's middle. */
const quarter = ([u, v]: [number, number], s: number): [number, number] => [-(v - s / 2), s / 2 + u];
const sameSet = (a: [number, number][], b: [number, number][]) => a.length === b.length && a.every(p => b.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6));

describe('the standard port', () => {
  it('is a square opening in a frame 40 deep and 40 wide, flush with the rails, its outline following from it', () => {
    expect(STANDARD_PORT.ring).toEqual({ thickness: 40, width: 40 });
    for (const s of SIZES) {
      expect(portOutline(s)).toBe(s + 80);
      const ring = portRing(s);
      // its four members close round the opening and fill the outline, without overlapping
      const area = ring.reduce((n, [, [u0, u1, v0, v1]]) => n + (u1 - u0) * (v1 - v0), 0);
      expect(area).toBeCloseTo(portOutline(s) ** 2 - s ** 2, 9);
      expect(Math.min(...ring.map(([, r]) => r[0]))).toBe(-s / 2 - F); expect(Math.max(...ring.map(([, r]) => r[3]))).toBe(s + F);
    }
  });

  it('has the same bolt and latch stations on every side: a quarter turn maps them onto themselves', () => {
    for (const s of SIZES) for (const perSide of [1, 2, 3] as const) {
      const bolts = boltStations(s, perSide);
      expect(bolts).toHaveLength(4 * perSide);
      expect(sameSet(bolts.map(p => quarter(p, s)), bolts)).toBe(true);
      // on the middle line of the frame
      for (const [u, v] of bolts) {
        const out = Math.max(Math.abs(u), Math.abs(v - s / 2)) - s / 2;
        expect(out).toBe(F / 2);
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

describe('the latch’s real movement', () => {
  it('reaches as far as the mechanism moves it: closed along the joint past the ring, open out from its side', () => {
    // closed, the lever lies along the joint, within the 40 mm frame; opening, it swings out 38 mm from the side
    expect(LATCH_INTO_RING).toBeLessThan(T);
    expect(LATCH_REACH.swing.v[1]).toBeGreaterThan(LATCH_REACH.closed.v[1]);
    expect(LATCH_REACH.swing.u[0]).toBeLessThan(LATCH_REACH.closed.u[0]);
    expect(LATCH_REACH.width).toBe(38);
  });
});

describe('a side opening', () => {
  const frame = { x: [1, 0, 0] as V3, y: [0, 1, 0] as V3, z: [0, 0, 1] as V3 };

  it('is framed like an end, its face the section’s outline, its opening the tunnel’s, in the end bay', () => {
    for (const s of SIZES) for (const side of [-1, 1] as const) {
      const face = sidePortFace([0, 0, s / 2], frame, s, side);
      // the face on the rails' outer faces, the section's outline: flush, nothing proud of the tunnel
      expect(face.at[0]).toBeCloseTo(side * (s / 2 + F), 9); expect(face.n.map(c => c + 0)).toEqual([-side, 0, 0]);
      // its opening level with the floor and as high as the tunnel
      expect(face.at[2]).toBeCloseTo(0, 9);
      // its frame's x to the right seen from outside, as an end face's is
      expect(face.frame.y.map(c => c + 0)).toEqual(face.n.map(c => c + 0));
    }
    // the end bay: the end frame, then the opening; one bay is the shortest section
    expect(sidePortOffset(300)).toBe(T + 150); expect(sidePortLength(300)).toBe(300 + 2 * T);
  });

  it('takes the two latches of an end butted into it on the head, lying across the joint, base and catch on either side of the middle', () => {
    const face: Face = { at: [0, 0, 0], n: [0, 1, 0], frame: frameAlong([0, 1, 0]) };
    const head = portLatches('h', face, 300, 2, PRINTED_LATCH_JOINT.gap, 'head');
    expect(head).toHaveLength(2);
    for (const q of head) {
      expect(q.out).toEqual(face.frame.z); expect(q.at[2]).toBeCloseTo(300 + F, 9);
      expect(q.base === 'port').toBe(q.side < 0);
      expect(Math.abs(q.at[0])).toBeCloseTo(0.3 * 300, 9);
    }
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
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="420mm" height="420mm" viewBox="0 0 420 420">/);
    expect(svg.match(/<circle /g)).toHaveLength(t.bolts.length);
    expect(svg.match(/<path /g)).toHaveLength(t.notches.length);
    expect(svg.match(/<rect /g)).toHaveLength(2);
    expect(svg).toContain('THIS SIDE OUT');
  });
});
