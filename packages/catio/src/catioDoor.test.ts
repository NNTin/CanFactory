import { describe, expect, it } from 'vitest';
import { CATIO_DOOR_HARDWARE, dimensionOf, findPart } from '@canfactory/contracts';
import { catioMesh } from '@canfactory/contracts';
import { buttonOutline, buttonOverlap, buttonsAlong, buttonSweep, COUPLING_CONTROLS, COUPLING_DEFAULT, couplingFacts, couplingLayout, couplingSteps, DOOR, DOOR_SEATS, DOOR_TRAVEL, doorAction, doorBom, doorBounds, doorFasteners, doorLibraryParts, doorPose, doorRetention, doorZone, fastenerClashes, HOOK_FIT, INSERT, insetPanel, LOCK_FROM_PIVOT, MODULAR, MODULAR_DEFAULT, modularPortPanel, PORT_FRAME, setInDoor, slidingGateRise, STANDARD_PORT, TUNNEL, TUNNEL_COUPLING_DEFAULT, TUNNEL_DEFAULT, tunnelBom, tunnelFacts, tunnelLayout, tunnelSiteFor, tunnelSteps, validateEnclosure, validateModular, validateWindowInsert, vec, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT, windowFor, windowFrame, windowInsertBom, windowInsertFacts, windowInsertLayout, windowInsertSteps, type CouplingSite, type DoorBox, type DoorPanel, type ModularConfig, type TunnelConfig, type TunnelSite, type WindowInsertConfig, type WindowSpec } from './index.ts';
const SITE = tunnelSiteFor(WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT);
const COUPLING_SITE: CouplingSite = { tunnel: TUNNEL_DEFAULT, site: SITE, joint: TUNNEL_COUPLING_DEFAULT };

/** The cat port sizes the planner allows (20–45 cm each way), and section lengths between the tunnel's flanges. */
const SIZES = [200, 250, 300, 380, 450];
const BAYS = [300, 440, 690, 940];
const faces = SIZES.flatMap(width => SIZES.flatMap(height => DOOR_SEATS.flatMap(seat => (['solid', 'mesh'] as const).map(material => setInDoor({ id: 'p', width, height, material, seat, depth: PORT_FRAME, sealed: material === 'solid', sillButton: material !== 'solid' })))));
const insets = BAYS.flatMap(width => SIZES.map(height => insetPanel({ id: 'a', width, height, cavity: TUNNEL.rail, pivots: { head: 10, sill: TUNNEL.floor + TUNNEL.rail - 10 } })));
const doors = [...faces, ...insets];
const name = (d: DoorPanel) => `${d.fit} ${d.material} ${d.opening.width} × ${d.opening.height}`;
const range = (b: DoorBox, i: 0 | 1 | 2): [number, number] => [b.center[i] - b.size[i] / 2, b.center[i] + b.size[i] / 2];
const fixed = (d: DoorPanel) => d.timber.filter(t => !t.moves).flatMap(t => t.boxes);
const moving = (d: DoorPanel) => d.timber.filter(t => t.moves).flatMap(t => t.boxes);
const overlaps = (a: [number, number], b: [number, number]) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
const windowWith = (closure: WindowSpec['closure'], config: WindowInsertConfig = WINDOW_INSERT_DEFAULT): WindowSpec => ({ ...windowFor('modular', config, MODULAR_DEFAULT), closure });
const siteWith = (closure: WindowSpec['closure'], insert: WindowInsertConfig = WINDOW_INSERT_DEFAULT): TunnelSite => {
  const window = windowWith(closure, insert);
  return { ...tunnelSiteFor(WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT), insert, window, floorZ: windowInsertLayout('modular', insert, window).floor };
};

describe('removable door panel: seating', () => {
  it('fits every permitted opening without a complaint, and refuses one too small or with too little timber beside it', () => {
    for (const d of doors) expect(d.errors, name(d)).toEqual([]);
    expect(setInDoor({ id: 'p', width: 100, height: 300, material: 'solid', seat: 'stops', depth: PORT_FRAME }).errors.join()).toMatch(/at least 15 cm each way/);
    expect(setInDoor({ id: 'p', width: 300, height: 300, material: 'solid', seat: 'stops', depth: 25, sealed: true }).errors.join()).toMatch(/door and its stops need 30 mm of the opening's depth; the frame is 25 mm deep/);
    expect(setInDoor({ id: 'p', width: 300, height: 300, material: 'mesh', seat: 'rebate', depth: 20 }).errors.join()).toMatch(/leaves less than 8 mm of the 20 mm frame/);
    expect(insetPanel({ id: 'a', width: 440, height: 300, cavity: 30, pivots: { head: 12, sill: 46 } }).errors.join()).toMatch(/need 40 mm of depth; the opening has 30 mm/);
    expect(insetPanel({ id: 'a', width: 440, height: 300, cavity: 40, pivots: { head: 2, sill: 46 } }).errors.join()).toMatch(/would not turn clear of the panel/);
  });

  it('is seated all round: on stop strips inside its opening, or in a rebate round it', () => {
    for (const d of doors) {
      const [u0, u1, v0, v1] = d.rect; const { width: W, height: H } = d.opening; const rebate = d.seat === 'rebate';
      // the panel covers the whole opening but for its clearance, and nothing of it stands in the opening behind its seat
      expect(u0, name(d)).toBeLessThanOrEqual(-W / 2 + DOOR.clearance); expect(u1).toBeGreaterThanOrEqual(W / 2 - DOOR.clearance);
      if (d.fit === 'inset') expect(d.back, name(d)).toBeGreaterThanOrEqual(0);
      else expect(d.front, name(d)).toBe(d.material === 'solid' ? d.buttonUnder : -DOOR.setIn.recess);
      for (const b of moving(d)) expect(range(b, 2)[0], name(d)).toBeGreaterThanOrEqual(d.back - 1e-9);
      // the seat's overlap on each of its four edges: a stop strip, or the rebate's shoulder (the panel reaches out into it)
      const stops = fixed(d).filter(b => range(b, 2)[1] <= d.back + 1e-9);
      const lap = rebate ? { left: -W / 2 - u0, right: u1 - W / 2, head: v1 - H, sill: -v0 } : {
        left: Math.max(...stops.map(b => overlaps(range(b, 0), [u0, u0 + 50]))),
        right: Math.max(...stops.map(b => overlaps(range(b, 0), [u1 - 50, u1]))),
        head: Math.max(...stops.map(b => overlaps(range(b, 1), [v1 - 50, v1]))),
        sill: Math.max(...stops.map(b => overlaps(range(b, 1), [v0, v0 + 50]))),
      };
      for (const [side, value] of Object.entries(lap)) expect(value, `${name(d)} ${side}`).toBeGreaterThanOrEqual(d.seatLap - 1e-9);
      expect(d.seatLap, name(d)).toBeGreaterThanOrEqual(10);
      if (rebate) {
        // a rebate: no strips, the rebate as wide as the stops would be and as deep as the panel sits
        expect(stops).toEqual([]); expect(d.rebate).toEqual({ width: DOOR.setIn.lap, depth: (d.seal ? DOOR.seal.gap : 0) - d.back });
        continue;
      }
      // the stops are continuous, round all four sides
      const strip = d.fit === 'inset' ? DOOR.stop.lap : DOOR.setIn.lap;
      expect(Math.max(...stops.filter(b => range(b, 1)[0] < 1e-9).map(b => b.size[0])), name(d)).toBeCloseTo(W, 6);
      expect(stops.reduce((n, b) => n + Math.max(b.size[0], b.size[1]), 0)).toBeCloseTo(2 * W + 2 * (H - 2 * strip), 6);
      // the stops and the panel fill the depth of the rails exactly: the panel is flush with them
      if (d.fit === 'inset') expect(DOOR.stop.depth + (d.front - d.back)).toBe(TUNNEL.rail);
      else for (const b of stops) expect(range(b, 2)[0], name(d)).toBeGreaterThanOrEqual(-PORT_FRAME - 1e-9);
    }
  });

  it('is carried and located by timber, not by its screws: it stands in its opening (or its rebate) with 2 mm to spare', () => {
    for (const d of doors) {
      const [u0, u1, v0, v1] = d.rect; const { width: W, height: H } = d.opening;
      if (d.fit === 'inset') {
        expect(v0, name(d)).toBe(0);
        expect([u0 + W / 2, W / 2 - u1, H - v1]).toEqual([DOOR.clearance, DOOR.clearance, 2 * DOOR.clearance]);
      } else {
        const e = d.seat === 'rebate' ? DOOR.setIn.lap : 0;
        for (const gap of [u0 + W / 2 + e, W / 2 + e - u1, v0 + e, H + e - v1]) expect(gap, name(d)).toBeCloseTo(DOOR.clearance, 9);
      }
      // a mesh panel: inset, a frame with the mesh clamped under cover strips on its cat side, a mullion past 60 cm; set in, a slim
      // frame with the mesh stapled on its back
      if (d.material === 'mesh') {
        const uprights = d.timber.find(t => t.id === 'panel-frame-stile')?.boxes.length ?? 0;
        expect(uprights, name(d)).toBe(1 + Math.max(1, Math.ceil((u1 - u0) / DOOR.mullionSpan)));
        if (d.fit === 'inset') {
          expect(d.front - d.back).toBe(DOOR.frame.thickness + DOOR.meshLayer + DOOR.cover);
          expect(d.mesh?.center[2]).toBeLessThan(d.back + DOOR.cover + DOOR.meshLayer);
          expect(d.timber.find(t => t.id === 'panel-cover-stile')?.boxes.every(b => range(b, 2)[0] === d.back)).toBe(true);
        } else {
          expect(d.front - d.back).toBe(DOOR.setIn.frameThick + DOOR.meshLayer);
          expect(d.mesh?.center[2]).toBeCloseTo(d.back + DOOR.meshLayer / 2, 9);
          const staples = d.fasteners.filter(f => f.role === 'staple');
          expect(staples.length, name(d)).toBeGreaterThanOrEqual(Math.ceil((2 * (u1 - u0) + 2 * (v1 - v0)) / DOOR.setIn.staplePitch));
          for (const f of staples) expect(f.at[2]).toBe(d.back);
        }
        expect(d.seal).toBeNull(); expect(d.pull).toBeNull();
      } else {
        // a solid panel: plywood pressed onto a seal that runs all round its seat, with a pull on its operator's side
        expect(d.front - d.back).toBe(DOOR.setIn.solid);
        expect(DOOR.seal.gap).toBeLessThan(DOOR.seal.height);
        expect(d.seal?.boxes).toHaveLength(4);
        expect(d.seal?.length).toBeGreaterThanOrEqual(2 * d.opening.width + 2 * d.opening.height);
        expect(d.pull && range(d.pull, 2)).toEqual([d.front, d.front + DOOR.pull.depth]);
      }
    }
  });
});

describe('removable door panel: retention both ways', () => {
  it('cannot be pushed in past its seat, nor drawn out past its closed buttons', () => {
    for (const d of doors) {
      // inwards (−n): the seat; outwards (+n): every button lies 12 mm over the panel, directly over its face
      for (const b of d.buttons) {
        expect(buttonOverlap(d, b, 0), `${name(d)} ${b.id}`).toBeCloseTo(DOOR.button.overlap, 6);
        expect(b.pivot[2], b.id).toBe(d.buttonUnder);
      }
      expect(d.buttonUnder - d.front, name(d)).toBe(d.play);
      // a sealed panel is held squashed onto its seal; a mesh panel has only the washer's thickness of play
      expect(d.play).toBe(d.material === 'solid' ? 0 : dimensionOf(d.washer, 'h') + (d.fit === 'set-in' ? DOOR.setIn.recess : 0));
      expect(d.play).toBeLessThan(d.seatLap);
    }
  });

  it('spaces its buttons so that the panel cannot tilt or flex free between them', () => {
    for (const d of doors) {
      // an inset panel is held at its head and its sill only, so its buttons are spaced along them; a set-in one is seated round all
      // four sides, and held by one at the middle of each, as the reference's are (whether its corners stay in is a check on a built door)
      const { span, corner } = doorRetention(d);
      if (d.fit === 'inset') { expect(span, name(d)).toBeLessThanOrEqual(DOOR.pitch + 1e-9); expect(corner, name(d)).toBeLessThanOrEqual(DOOR.pitch / 2 + 1e-9); }
      else expect(corner, name(d)).toBeLessThanOrEqual(Math.max(d.opening.width, d.opening.height) / 2 + DOOR.setIn.lap + 1e-9);
      // set in, one at the middle of every side (but the sill where there is no frame below it); the head and the sill of an inset
      // one, two or more each: never one edge alone
      const sides = new Set(d.buttons.map(b => b.side));
      if (d.fit === 'set-in') {
        expect([...sides].sort(), name(d)).toEqual(d.material === 'solid' ? ['head', 'left', 'right'] : ['head', 'left', 'right', 'sill']);
        for (const side of sides) expect(d.buttons.filter(b => b.side === side).length).toBe(1);
      } else {
        expect([...sides].sort(), name(d)).toEqual(['head', 'sill']);
        for (const side of sides) expect(d.buttons.filter(b => b.side === side).length, `${name(d)} ${side}`).toBeGreaterThanOrEqual(2);
      }
    }
    expect([100, 250, 251, 500, 501].map(length => buttonsAlong(length, 1))).toEqual([1, 1, 2, 2, 3]);
  });

  it('screws every pivot into sound timber, through a washer the button turns on', () => {
    for (const d of doors) {
      const pivots = d.fasteners.filter(f => f.role === 'pivot');
      expect(pivots).toHaveLength(d.buttons.length);
      const screw = findPart(pivots[0]?.partId ?? ''); if (!screw) throw new Error('pivot');
      const bite = dimensionOf(screw, 'l') - DOOR.button.thickness - dimensionOf(d.washer, 'h');
      // at least 20 mm of timber in all, and 12 mm of what its strip is fixed on
      expect(bite, name(d)).toBeGreaterThanOrEqual(DOOR.bite);
      expect(bite, name(d)).toBeGreaterThanOrEqual(DOOR.behind);
      expect(doorLibraryParts(d)).toEqual([{ partId: CATIO_DOOR_HARDWARE.washer, quantity: d.buttons.length, use: expect.stringContaining('turns on it') as string },
        { partId: CATIO_DOOR_HARDWARE.lockPin, quantity: d.buttons.length, use: expect.stringContaining('locking pin') as string }]);
      // each button's locking pin: between its pivot and the panel's edge, clear of the pivot's screw and over the timber
      for (const b of d.buttons) {
        const reach = Math.hypot(b.lock[0] - b.pivot[0], b.lock[1] - b.pivot[1]); const away = b.reach - DOOR.button.overlap;
        expect(reach).toBeGreaterThanOrEqual(Math.min(LOCK_FROM_PIVOT, away - DOOR.button.lock.diameter) - 1e-9);
        expect(reach + DOOR.button.lock.diameter / 2).toBeLessThan(away);
        expect(buttonOverlap(d, { ...b, pivot: [b.lock[0], b.lock[1], b.pivot[2]], reach: 0, tail: 0 }, 0)).toBe(0);
      }
      // no two of the fixed screws share a hole: the strips' screws are kept clear of the pivots
      const screws = d.fasteners.filter(f => !f.moves && f.role !== 'stop');
      for (const [i, a] of screws.entries()) for (const b of screws.slice(i + 1)) expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]), `${name(d)} ${a.role}/${b.role}`).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('removable door panel: button sweep and withdrawal', () => {
  it('turns every button a quarter turn clear, over its own timber and the panel only, without meeting another', () => {
    for (const d of doors) {
      const [u0, u1, v0, v1] = d.rect;
      const land = PORT_FRAME;
      for (const b of d.buttons) {
        for (let turn = 0; turn <= 1.0001; turn += 0.05) {
          const outline = buttonOutline(b, Math.min(1, turn));
          // it never reaches farther over the panel than its tip's circle does
          expect(buttonOverlap(d, b, Math.min(1, turn)), `${name(d)} ${b.id}`).toBeLessThanOrEqual(buttonSweep(b) - (b.reach - DOOR.button.overlap) + 1e-9);
          if (d.fit === 'set-in') for (const [u, v] of outline) {
            // never beyond the frame round the opening it is mounted on
            expect(Math.abs(u), `${name(d)} ${b.id} at ${turn}`).toBeLessThanOrEqual(d.opening.width / 2 + land + 1e-6);
            expect(v, `${name(d)} ${b.id} at ${turn}`).toBeLessThanOrEqual(d.opening.height + land + 1e-6); expect(v).toBeGreaterThanOrEqual(-land - 1e-6);
          } else for (const [u, v] of outline) {
            // between the flanges, on the rails above and below the opening (a corner of its short end passes a rail's edge by a hair)
            expect(Math.abs(u), `${name(d)} ${b.id}`).toBeLessThanOrEqual(d.opening.width / 2 + 1e-6);
            expect(v).toBeLessThanOrEqual(d.opening.height + TUNNEL.rail + 2); expect(v).toBeGreaterThanOrEqual(-TUNNEL.floor - TUNNEL.rail - 2);
          }
        }
        // open: clear of the panel's outline by at least a millimetre, so it comes straight out
        expect(buttonOverlap(d, b, 1), b.id).toBe(0);
        const clear = Math.min(...buttonOutline(b, 1).map(([u, v]) => Math.max(u0 - u, u - u1, v0 - v, v - v1)));
        expect(clear, `${name(d)} ${b.id}`).toBeGreaterThanOrEqual(1);
      }
      for (const [i, a] of d.buttons.entries()) for (const b of d.buttons.slice(i + 1)) {
        expect(Math.hypot(a.pivot[0] - b.pivot[0], a.pivot[1] - b.pivot[1]), `${name(d)} ${a.id}/${b.id}`).toBeGreaterThan(buttonSweep(a) + buttonSweep(b));
      }
      // nor does a button's sweep reach the pull
      if (d.pull) for (const b of d.buttons) expect(Math.hypot(b.pivot[0] - d.pull.center[0], b.pivot[1] - d.pull.center[1]) - Math.hypot(d.pull.size[0], d.pull.size[1]) / 2, name(d)).toBeGreaterThan(buttonSweep(b));
    }
  });

  it('comes straight out once every button is open: past its strips with 2 mm each side, then clear of everything fixed', () => {
    for (const d of doors) {
      const [u0, u1, v0, v1] = d.rect;
      // whatever is fixed in front of the seat stands outside the panel's outline (its locating strips), the open buttons too
      for (const b of fixed(d).filter(q => range(q, 2)[1] > d.back + 1e-9)) expect(Math.max(overlaps(range(b, 0), [u0, u1]) > 0 && overlaps(range(b, 1), [v0, v1]) > 0 ? 1 : 0, 0), name(d)).toBe(0);
      // drawn out by `withdraw`, its back is beyond the farthest fixed thing by the margin, pull and all
      expect(d.depth, name(d)).toBeGreaterThanOrEqual(d.buttonUnder + DOOR.button.thickness);
      expect(d.back + d.withdraw - d.depth, name(d)).toBe(DOOR.withdraw);
      // the buttons turn before the panel moves, and the panel is out before it is set aside
      for (let travel = 0; travel <= 1.0001; travel += 0.02) {
        const q = doorPose(d, Math.min(1, travel));
        if (q.turn < 1) expect(q.offset, `${name(d)} at ${travel}`).toEqual([0, 0, 0]);
        if (q.out < 1) expect([q.offset[0], q.offset[1]]).toEqual([0, 0]);
        expect(q.offset[2]).toBeGreaterThanOrEqual(-1e-9);
      }
      expect(doorPose(d, 0)).toMatchObject({ turn: 0, out: 0, gone: false });
      expect(doorPose(d, DOOR_TRAVEL.turned)).toMatchObject({ turn: 1, out: 0 });
      expect(doorPose(d, DOOR_TRAVEL.out).offset).toEqual([0, 0, d.withdraw]);
      // with nowhere of its own to stow it, the panel is carried away
      expect(doorPose(d, 1)).toMatchObject({ turn: 1, out: 1, gone: true });
      expect(doorAction(d, 0, 'panel')).toBeNull(); expect(doorAction(d, 1, 'panel')).toBeNull();
      expect(doorAction(d, 0.2, 'panel')).toMatch(new RegExp(`^${d.buttons.length} × Door turn button: its locking pin lifted, turned a quarter turn clear`));
      expect(doorAction(d, 0.5, 'panel')).toMatch(/drawn straight out/); expect(doorAction(d, 0.9, 'panel')).toMatch(/stowed clear of the route/);
    }
    const stowed = setInDoor({ id: 'p', width: 300, height: 300, material: 'solid', seat: 'stops', depth: PORT_FRAME, sealed: true, sillButton: false, stow: [700, 0, 400] });
    expect(doorPose(stowed, 1)).toMatchObject({ offset: [700, 0, 400], gone: false });
  });

  it('lists what it draws: timber, mesh, printed buttons, pull and seal, with the pivots, washers and screws as library parts', () => {
    const net = catioMesh('netting');
    for (const d of doors) {
      const lines = doorBom(d, { prefix: 'x', where: 'Here', mesh: net });
      expect(new Set(lines.map(line => line.id)).size).toBe(lines.length);
      expect(lines.filter(line => line.group === 'Timber').reduce((n, line) => n + line.quantity, 0), name(d)).toBe(d.timber.reduce((n, t) => n + t.boxes.length, 0));
      expect(lines.filter(line => /Door turn button, printed \(custom\)/.test(line.name)).reduce((n, line) => n + line.quantity, 0), name(d)).toBe(d.buttons.length);
      expect(lines.filter(line => line.group === 'Mesh')).toHaveLength(d.mesh ? 1 : 0);
      expect(lines.some(line => line.name.startsWith('Panel pull'))).toBe(d.pull !== null);
      expect(lines.some(line => /E-profile seal/.test(line.name))).toBe(d.seal !== null);
      // printed hardware is named as custom, and says it is untested
      for (const line of lines.filter(q => /printed/.test(q.name))) { expect(line.name).toContain('(custom)'); expect(line.partId).toBeUndefined(); }
      expect(lines.find(line => /Door turn button/.test(line.name))?.use).toMatch(/untested/);
      for (const f of d.fasteners) expect(findPart(f.partId), f.partId).toBeDefined();
      expect(doorBom(d, { prefix: 'x', where: 'Here', mesh: net, count: 3 }).reduce((n, line) => n + line.quantity, 0)).toBe(3 * lines.reduce((n, line) => n + line.quantity, 0));
    }
  });
});

describe('cat-port closure: sliding travel only for a sliding gate', () => {
  // (the standard port is square: the same clear size both ways)
  const grid = SIZES.flatMap(size => [500, 700, 910, 1600].flatMap(sash => [900, 1200, 2200].map(height => ({
    config: { ...MODULAR_DEFAULT, tunnelSize: size, sashWidth: sash, sashHeight: sash, glassWidth: sash - 110, glassHeight: sash - 110 } as ModularConfig,
    enclosure: { width: 1200, depth: 1000, height },
  }))));
  /** The window's checks and an enclosure's, as the planner makes them. */
  const checks = (config: ModularConfig, enclosure: { width: number; depth: number; height: number }) => [...validateModular(config), ...validateEnclosure(enclosure, config, 'Enclosure A')];

  it('asks a sliding gate for its travel over every permitted size, and a removable panel only to fit where it stands', () => {
    for (const { config, enclosure } of grid) {
      const removable = checks(config, enclosure); const gate = checks({ ...config, portClosure: 'sliding-gate' }, enclosure);
      const label = JSON.stringify([config.tunnelSize, config.sashHeight, enclosure.height]);
      // no travel constraint without a sliding gate
      expect(removable.filter(e => /sliding gate|raised cat gate/.test(e)), label).toEqual([]);
      // the same constraints as before for the gate, from the one shared rule
      expect(gate.some(e => /sliding gate needs room for its full upward travel/.test(e)), label).toBe(slidingGateRise(config.tunnelSize, PORT_FRAME) > config.sashHeight - 10);
      expect(gate.some(e => /too low for the raised cat gate/.test(e)), label).toBe(MODULAR.sill + slidingGateRise(config.tunnelSize, 2 * PORT_FRAME) > enclosure.height);
      // a panel only has to fit, with its frame, in the collar and under the enclosure's top rail: never more than the gate asked
      expect(removable.some(e => /must fit inside the window collar/.test(e)), label).toBe(config.tunnelSize + 80 > config.sashWidth - 10 || config.tunnelSize + 80 > config.sashHeight - 10);
      expect(removable.some(e => /too low for its cat ports/.test(e)), label).toBe(MODULAR.sill + config.tunnelSize + 80 > enclosure.height);
      for (const error of removable) expect(gate.length, `${label}: ${error}`).toBeGreaterThan(0);
      // its seat, buttons and withdrawal are checked from the very panel that is drawn
      if (removable.length === 0) for (const at of ['window', 'enclosure'] as const) {
        const panel = modularPortPanel(config, at); expect(panel.errors, label).toEqual([]);
        expect(panel.material).toBe(at === 'window' ? 'solid' : 'mesh');
        expect(panel.withdraw).toBeLessThanOrEqual(config.tunnelSize + 100);
      }
    }
    // a port as high as the sliding gate could never be: 45 cm in a 91 cm sash, and in a 90 cm enclosure
    const tall = { ...MODULAR_DEFAULT, tunnelSize: 450 }; const low = { width: 1200, depth: 1000, height: 900 };
    expect(checks(tall, low)).toEqual([]); expect(checks({ ...tall, portClosure: 'sliding-gate' }, low)).toHaveLength(2);
  });

  it('applies the window insert’s own travel check to a sliding gate only, and its panel checks to a panel only', () => {
    for (const height of SIZES) for (const sash of [600, 910, 1300]) {
      const base = { ...windowFor('modular', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT), sashWidth: sash, sashHeight: sash, glassWidth: sash - 110, glassHeight: sash - 110, openingWidth: sash + 90, openingHeight: sash + 90, tunnel: { width: 300, height } };
      const gate = validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, { ...base, closure: 'sliding-gate' }); const panel = validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, { ...base, closure: 'removable-panel' });
      const l = windowInsertLayout('modular', WINDOW_INSERT_DEFAULT, { ...base, closure: 'sliding-gate' });
      expect(gate.some(e => /sliding gate needs room above the port/.test(e)), `${height} in ${sash}`).toBe(l.floor + slidingGateRise(height, 50) > l.z0 + l.H - INSERT.member - 40);
      expect(panel.filter(e => /sliding|gate/.test(e)), `${height} in ${sash}`).toEqual([]);
      expect(panel.some(e => /must fit under the collar’s head rail/.test(e)), `${height} in ${sash}`).toBe(l.floor + height + INSERT.portMember > l.z0 + l.H - INSERT.member);
      expect(gate.filter(e => /panel|turn button/.test(e))).toEqual([]);
    }
    // 45 cm high in the default 91 cm sash: a panel fits, a gate has nowhere to go
    const tall = { ...windowFor('modular', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT), tunnel: { width: 300, height: 450 } };
    expect(validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, { ...tall, closure: 'removable-panel' })).toEqual([]);
    expect(validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, { ...tall, closure: 'sliding-gate' }).join()).toMatch(/sliding gate needs room above the port/);
  });
});

describe('window insert: the cat port’s removable panel', () => {
  const configs: WindowInsertConfig[] = [WINDOW_INSERT_DEFAULT, ...WINDOW_INSERT_CONTROLS.filter(c => !c.range).flatMap(control => control.options.map(option => ({ ...WINDOW_INSERT_DEFAULT, [control.key]: option.value }))),
    { ...WINDOW_INSERT_DEFAULT, attachment: 'spreader-feet' }, { ...WINDOW_INSERT_DEFAULT, attachment: 'spreader-feet', clampsPerSide: 3 }];
  const valid = configs.filter(config => validateWindowInsert('modular', config, windowWith('removable-panel', config)).length === 0);

  it('changes nothing of the insert but what closes its port', () => {
    expect(valid.length).toBeGreaterThan(30);
    for (const config of valid) {
      const panel = windowInsertLayout('modular', config, windowWith('removable-panel', config)); const gate = windowInsertLayout('modular', config, windowWith('sliding-gate', config));
      for (const key of ['W', 'H', 'floor', 'yIn', 'yOut', 'timber', 'panels', 'fasteners', 'clamps', 'hooks', 'brackets', 'port'] as const) expect(panel[key], key).toEqual(gate[key]);
      expect(panel.closure).toBe('removable-panel'); expect(gate.closure).toBe('sliding-gate');
      expect(panel.door).not.toBeNull(); expect(gate.door).toBeNull();
      expect(windowInsertLayout('direct', config, windowFor('direct', config, MODULAR_DEFAULT)).door).toBeNull(); expect(windowInsertLayout('direct', config, windowFor('direct', config, MODULAR_DEFAULT)).closure).toBeNull();
    }
  });

  it('sets a solid panel into the port from the room side, about flush with the port frame, standing on the threshold', () => {
    for (const seat of DOOR_SEATS) for (const config of valid) {
      const window = { ...windowWith('removable-panel', config), seat };
      const l = windowInsertLayout('modular', config, window); const door = l.door; if (!door || !l.port) throw new Error('door');
      expect(door.panel).toMatchObject({ material: 'solid', fit: 'set-in', seat, opening: { width: l.port.width, height: l.port.height } });
      expect(door.frame).toEqual({ origin: [0, l.yOut - INSERT.portMember, l.floor], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0] });
      // the frame's origin is the port frame's room face
      const jambs = l.timber.filter(t => t.component === 'port-frame').flatMap(t => t.boxes);
      for (const b of jambs) expect(b.center[1] - b.size[1] / 2, 'port frame room face').toBeCloseTo(door.frame.origin[1], 6);
      // the panel in the port, just behind the room face, inside the port frame's depth
      const sheet = doorBounds(door.frame, door.panel.timber.find(t => t.id === 'panel-sheet')?.boxes[0] ?? { size: [0, 0, 0], center: [0, 0, 0] });
      // sealed, pressed onto its seal by the buttons: its face under their washers
      expect(door.panel.play).toBe(0); expect(sheet.min[1]).toBeCloseTo(door.frame.origin[1] - door.panel.buttonUnder, 6);
      expect(sheet.max[1]).toBeLessThan(l.yOut);
      // standing on the threshold: in a rebate it goes below the floor into the threshold's rebate, on stops it stands on the sill stop
      expect(sheet.min[2]).toBeCloseTo(l.floor + (seat === 'stops' ? DOOR.clearance : -(DOOR.setIn.lap - DOOR.clearance)), 6);
      // three buttons, one on each jamb and one on the transom: there is no frame face below the threshold
      expect(door.panel.buttons.map(b => b.side).sort()).toEqual(['head', 'left', 'right']);
      // the stops, inside the port and within its depth
      for (const b of door.panel.timber.filter(t => t.id.startsWith('stop')).flatMap(t => t.boxes).map(b => doorBounds(door.frame, b))) {
        expect(b.min[1]).toBeGreaterThan(door.frame.origin[1]); expect(b.max[1]).toBeLessThanOrEqual(l.yOut + 1e-6);
        expect(Math.max(Math.abs(b.min[0]), Math.abs(b.max[0]))).toBeLessThanOrEqual(l.port.width / 2 + 1e-6);
      }
      expect(door.panel.timber.some(t => t.id.startsWith('stop'))).toBe(seat === 'stops');
      expect(door.panel.rebate === null || door.panel.rebate === undefined).toBe(seat === 'stops');
      // nothing of it reaches the outdoor face: the coupling's docking frame, seal and latches have that to themselves
      const zone = doorZone(l); if (!zone) throw new Error('zone');
      expect(zone.max[1]).toBeCloseTo(door.frame.origin[1], 6); expect(zone.max[1]).toBeLessThan(l.yOut);
    }
  });

  it('can be reached and drawn out from the room: clear of the hooks, brackets and clamps, and of the closed sash when hung', () => {
    for (const config of valid) {
      const window = windowWith('removable-panel', config);
      const l = windowInsertLayout('modular', config, window); const zone = doorZone(l); if (!zone || !l.door) throw new Error('zone');
      const meets = (b: { size: number[]; center: number[] }) => [0, 1, 2].every(i => (b.center[i] ?? 0) - (b.size[i] ?? 0) / 2 < (zone.max[i] ?? 0) - 1e-9 && (b.center[i] ?? 0) + (b.size[i] ?? 0) / 2 > (zone.min[i] ?? 0) + 1e-9);
      for (const hook of l.hooks) for (const b of hook.boxes) expect(meets(b), `${hook.id} ${JSON.stringify(config)}`).toBe(false);
      for (const bracket of l.brackets) for (const b of bracket.boxes) expect(meets(b), bracket.id).toBe(false);
      // the zone runs from the seat into the room for the panel's whole withdrawal
      expect(zone.max[1] - zone.min[1]).toBeCloseTo(l.door.panel.depth + l.door.panel.withdraw, 6);
      // hung, the collar's back lies on the frame's face: the buttons and the pull stand behind it, in front of the closed sash
      if (l.hooks.length) expect(l.door.frame.origin[1] - l.door.panel.depth - l.frame.sashFace).toBeGreaterThanOrEqual(HOOK_FIT.gap);
      // removed, the panel is shown stowed beside the window opening, in the room
      const stow = l.door.panel.stow; if (!stow) throw new Error('stow');
      expect(stow[0] - (l.port?.width ?? 0) / 2 - DOOR.lap).toBeGreaterThan(window.openingWidth / 2);
      expect(l.door.frame.origin[1] - stow[2]).toBeLessThan(-300);
    }
    // a collar too narrow to leave room beside the port says so, whichever closure
    const narrow = { ...windowWith('removable-panel'), tunnel: { width: 450, height: 300 }, sashWidth: 600, openingWidth: 690 };
    expect(validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, narrow).length).toBeGreaterThan(0);
  });

  it('lists the panel’s parts instead of the gate’s, counted from the layout, and says what closes the port', () => {
    for (const config of valid) {
      const window = windowWith('removable-panel', config); const l = windowInsertLayout('modular', config, window); const door = l.door?.panel; if (!door) throw new Error('door');
      const lines = windowInsertBom('modular', config, window); const gate = windowInsertBom('modular', config, windowWith('sliding-gate', config));
      const quantity = (match: (line: typeof lines[number]) => boolean, list = lines) => list.filter(match).reduce((n, line) => n + line.quantity, 0);
      expect(lines.filter(line => /gate/i.test(line.name) || /gate/.test(line.id))).toEqual([]);
      expect(gate.filter(line => /^(cat-gate|gate-tracks|gate-latch)$/.test(line.id)).map(line => line.id)).toEqual(['cat-gate', 'gate-tracks', 'gate-latch']);
      expect(gate.filter(line => /port-panel|Door turn|Panel pull/.test(`${line.id} ${line.name}`))).toEqual([]);
      expect(quantity(line => line.name === 'Cat-port panel')).toBe(1);
      // its stop strips round the port, as the default seat
      expect(quantity(line => line.name.startsWith('Door stop'))).toBe(4); expect(quantity(line => line.name.startsWith('Locating strip'))).toBe(0);
      expect(quantity(line => /Door turn button, printed \(custom\)/.test(line.name))).toBe(door.buttons.length);
      expect(quantity(line => line.name.startsWith('Panel pull'))).toBe(1); expect(quantity(line => line.id === 'port-panel-door-seal')).toBe(1);
      // the pivots, the washers, the strips', the stop's and the pull's screws: library parts, more than the gate's list by exactly these
      const extra = (partId: string) => quantity(line => line.partId === partId) - quantity(line => line.partId === partId, gate);
      expect(extra(CATIO_DOOR_HARDWARE.pivot.inset)).toBe(door.buttons.length); expect(extra(CATIO_DOOR_HARDWARE.washer)).toBe(door.buttons.length);
      expect(extra(CATIO_DOOR_HARDWARE.lockPin)).toBe(door.buttons.length);
      expect(extra(CATIO_DOOR_HARDWARE.stopScrew)).toBe(door.fasteners.filter(f => f.role === 'stop').length);
      expect(extra(CATIO_DOOR_HARDWARE.pullScrew)).toBe(2);
      // everything else is the same list
      const doorParts: string[] = Object.values(CATIO_DOOR_HARDWARE).flatMap(v => typeof v === 'string' ? [v] : Object.values(v));
      const rest = (list: typeof lines) => list.filter(line => !/^port-panel|^cat-gate$|^gate-/.test(line.id) && !doorParts.includes(line.partId ?? ''));
      expect(rest(lines)).toEqual(rest(gate));
    }
    const facts = windowInsertFacts('modular', WINDOW_INSERT_DEFAULT, windowWith('removable-panel'));
    expect(facts.find(f => f.label === 'Cat port · closed by')).toEqual({ label: 'Cat port · closed by', value: 'Removable panel with turn buttons', from: { page: 'planner', settings: ['Cat-port closure'] } });
    expect(facts.find(f => f.label === 'Port panel · kept in by')?.value).toMatch(/^3 turn buttons \(jamb and head\), 12 mm over the panel · seat \d+ mm$/);
    expect(windowInsertFacts('modular', WINDOW_INSERT_DEFAULT, windowWith('sliding-gate')).find(f => f.label === 'Cat port · closed by')?.value).toBe('Vertical sliding gate');
    expect(windowInsertFacts('direct', WINDOW_INSERT_DEFAULT, windowFor('direct', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT)).some(f => /closed by|Port panel/.test(f.label))).toBe(false);
    const step = windowInsertSteps('modular', WINDOW_INSERT_DEFAULT, windowWith('removable-panel')).at(-1);
    expect(step?.detail).toMatch(/Screw the 3 door turn buttons onto the port frame’s room face/);
    expect(step?.detail).toMatch(/Shut it again, every button over it, before the tunnel is undocked/);
    expect(step?.detail).not.toMatch(/gate|track/);
    expect(windowInsertSteps('modular', WINDOW_INSERT_DEFAULT, windowWith('sliding-gate')).at(-1)?.detail).toMatch(/Lower the sliding cat gate into them from above/);
  });

});

describe('insert–tunnel coupling with a removable cat-port panel', () => {
  it('keeps its docking-frame screws clear of the panel’s screws in the same jambs and transom, for every setting', () => {
    const couplings = [COUPLING_DEFAULT, ...COUPLING_CONTROLS.flatMap(control => control.options.map(option => ({ ...COUPLING_DEFAULT, [control.key]: option.value })))];
    const inserts: WindowInsertConfig[] = [WINDOW_INSERT_DEFAULT, { ...WINDOW_INSERT_DEFAULT, attachment: 'spreader-feet' }, ...([100, 150, 200] as const).map(fixingPitch => ({ ...WINDOW_INSERT_DEFAULT, fixingPitch })), { ...WINDOW_INSERT_DEFAULT, mesh: 'welded', meshFixing: 'staples' }];
    for (const insert of inserts) for (const config of couplings) for (const height of [200, 300, 450]) {
      const site = siteWith('removable-panel', insert); const window = { ...site.window, tunnel: { width: 300, height } };
      const tall: TunnelSite = { ...site, window, h: height, floorZ: windowInsertLayout('modular', insert, window).floor };
      if (validateWindowInsert('modular', insert, window).length) continue;
      const l = couplingLayout(config, { tunnel: TUNNEL_DEFAULT, joint: TUNNEL_COUPLING_DEFAULT, site: tall }); const door = l.insert.door; if (!door) throw new Error('door');
      expect(l.errors, JSON.stringify([insert.attachment, insert.fixingPitch, config, height])).toEqual([]);
      const into = doorFasteners(door.panel, door.frame).filter(f => !f.moves && f.role !== 'stop');
      expect(into.length).toBeGreaterThanOrEqual(door.panel.buttons.length);
      expect(fastenerClashes(l.fasteners.filter(f => f.component === 'frame-screws'), into, 12)).toEqual([]);
      // the same number of frame screws as with the sliding gate: only moved along
      const gateSite = siteWith('sliding-gate', insert); const gateWindow = { ...gateSite.window, tunnel: { width: 300, height } };
      const gate = couplingLayout(config, { tunnel: TUNNEL_DEFAULT, joint: TUNNEL_COUPLING_DEFAULT, site: { ...gateSite, window: gateWindow, h: height, floorZ: tall.floorZ } });
      expect(l.fasteners.map(f => f.component)).toEqual(gate.fasteners.map(f => f.component));
      expect(l.frame).toEqual(gate.frame); expect(l.latches).toEqual(gate.latches);
    }
  });

  it('leaves the panel free to come out with the tunnel docked: everything of the coupling is on the port’s outdoor face', () => {
    const l = couplingLayout(COUPLING_DEFAULT, { tunnel: TUNNEL_DEFAULT, joint: TUNNEL_COUPLING_DEFAULT, site: siteWith('removable-panel') }); const zone = doorZone(l.insert); if (!zone) throw new Error('zone');
    for (const member of l.frame) for (const b of member.boxes) expect(b.center[1] - b.size[1] / 2, member.id).toBeGreaterThanOrEqual(l.insert.yOut - 1e-9);
    expect(zone.max[1]).toBeLessThan(l.insert.yOut);
    // the insert still carries nothing: the wall support is the tunnel's, as before
    expect(l.wallSupport).toBeDefined();
    const steps = couplingSteps('modular', COUPLING_DEFAULT, COUPLING_SITE); const facts = couplingFacts('modular', COUPLING_DEFAULT, COUPLING_SITE);
    expect(steps[0]?.detail).toMatch(/with its cat-port panel seated, every turn button turned over it/);
    expect(steps.at(-1)?.detail).toMatch(/lift every button’s locking pin, turn the buttons clear and lift its panel out, and stow it clear of the route/);
    expect(steps.at(-1)?.detail).toMatch(/Before undocking, shut the port at this end and the enclosure’s port at the other/);
    expect(facts.find(f => f.label === 'Cat port · closed by')).toMatchObject({ value: 'Removable panel with turn buttons', from: { page: 'planner' } });
  });

});

describe('tunnel doors: every section’s end bay', () => {
  const routes: TunnelConfig[] = [
    TUNNEL_DEFAULT, { ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' },
    { ...TUNNEL_DEFAULT, portX: -1730, portY: 3420, portFacing: -25, portHeight: 820, slopeLeg: 'final', final: 2300, angleJoint: 'angle-collar' },
    { ...TUNNEL_DEFAULT, portX: 0, portY: 4000, portFacing: 0, portLevel: 'window', sectionLength: 1 },
    { ...TUNNEL_DEFAULT, portX: 2400, portY: 2000, portFacing: 90, portLevel: 'window' },
  ];
  const site = siteWith('removable-panel');
  const T = STANDARD_PORT.ring.thickness; const F = STANDARD_PORT.ring.width;

  it('opens both sides of every section’s end bay, framed like an end, and shuts every one not coupled with the standard door', () => {
    for (const doorFixing of ['turn-buttons', 'latches'] as const) for (const config of routes) {
      const l = tunnelLayout(config, site, { ...TUNNEL_COUPLING_DEFAULT, doorFixing });
      expect(l.errors, JSON.stringify(config)).toEqual([]);
      // (a section whose start is a mitre has no end bay: the mitred frame leans over where it would be)
      for (const p of l.pieces.filter(q => q.kind === 'section' && vec.dot(q.start.n, q.frame.y) > 1 - 1e-9)) {
        // a bay post one opening on from the start frame, both sides (none in a section one bay long: its far frame is it)
        const posts = l.members.filter(m => m.piece === p.id && m.kind === 'post');
        expect(posts.length, p.id).toBe(p.length > l.unitLength + 1e-6 ? 2 : 0);
        for (const m of posts) { expect([m.fromOffset, m.toOffset]).toEqual([T + l.w, 2 * T + l.w]); expect([m.rect[2], m.rect[3]]).toEqual([0, l.h]); }
        // a door on each side but the one the run before is coupled into, and on the start where that is so
        const doors = l.doors.filter(d => d.piece === p.id);
        expect(doors.map(d => d.at).sort(), p.id).toEqual([...(p.sidePort ? ['start'] : []), ...(['left', 'right'] as const).filter(s => p.sidePort?.side !== (s === 'left' ? -1 : 1))].sort());
        for (const d of doors) {
          expect(d.door.errors).toEqual([]);
          expect(d.door.fit).toBe(doorFixing === 'latches' ? 'blank' : 'set-in');
          expect(d.door.opening).toEqual({ width: l.w, height: l.w });
          // out of the section, on the plane of its outline: the side openings' face is the rails' outer faces
          expect(vec.dot(d.frame.n, d.face.n)).toBeCloseTo(-1, 9);
          if (d.at !== 'start') {
            expect(Math.abs(vec.dot(vec.sub(d.face.at, p.start.at), p.frame.x))).toBeCloseTo(l.w / 2 + F, 6);
            expect(vec.dot(vec.sub(d.face.at, p.start.at), p.frame.y)).toBeCloseTo(T + l.w / 2, 6);
          }
          expect(d.latches).toHaveLength(doorFixing === 'latches' ? (d.at === 'start' ? 2 * TUNNEL_COUPLING_DEFAULT.latchesPerSide : 2) : 0);
        }
        // no side mesh in the end bay: its sides are the openings
        for (const panel of l.panels.filter(q => q.piece === p.id && !q.id.includes('roof') && !q.id.includes('-edge-'))) {
          for (const c of panel.corners) expect(vec.dot(vec.sub(c, p.start.at), p.frame.y), panel.id).toBeGreaterThanOrEqual(2 * T + l.w - 1e-6);
        }
      }
      // a collar has none
      expect(l.doors.every(d => l.pieces.find(q => q.id === d.piece)?.kind === 'section')).toBe(true);
    }
  });

  it('lists each door’s timber, mesh, buttons and library screws, and tells how to use them without letting a cat out', () => {
    for (const mesh of ['netting', 'welded'] as const) {
      const config = { ...TUNNEL_DEFAULT, mesh }; const l = tunnelLayout(config, site, TUNNEL_COUPLING_DEFAULT);
      const lines = tunnelBom('modular', config, site, TUNNEL_COUPLING_DEFAULT);
      const quantity = (match: (line: typeof lines[number]) => boolean) => lines.filter(match).reduce((sum, line) => sum + line.quantity, 0);
      expect(quantity(line => /Door turn button, printed \(custom\)/.test(line.name))).toBe(l.doors.reduce((sum, d) => sum + d.door.buttons.length, 0));
      expect(quantity(line => line.name === 'Removable panel mesh')).toBe(l.doors.length);
      expect(quantity(line => line.partId === CATIO_DOOR_HARDWARE.washer)).toBe(l.doors.reduce((sum, d) => sum + d.door.buttons.length, 0));
      expect(quantity(line => line.name === 'Bay post')).toBe(l.members.filter(m => m.kind === 'post').length);
      const steps = tunnelSteps('modular', config, SITE, TUNNEL_COUPLING_DEFAULT).map(step => step.detail).join(' ');
      expect(steps).toMatch(/Every section starts with a square end bay/);
      expect(steps).toMatch(/The side doors are for reaching in from outside.*secure the cats elsewhere first, with both ends’ ports shut/);
      expect(steps).toMatch(/Before any part of the tunnel is uncoupled again, shut both ends’ ports first/);
    }
    expect(tunnelSteps('modular', TUNNEL_DEFAULT, SITE, TUNNEL_COUPLING_DEFAULT)[0]?.detail).toMatch(/cat-port panel seated|cat gate shut and latched/);
    expect(tunnelFacts('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT).find(f => f.label === 'Side doors · end bays')?.value).toMatch(/^\d+ · .* · 4 turn buttons/);
    expect(tunnelFacts('modular', TUNNEL_DEFAULT, siteWith('sliding-gate'), TUNNEL_COUPLING_DEFAULT).find(f => f.label.startsWith('Cat ports at both ends'))).toMatchObject({ value: 'Vertical sliding gate', from: { page: 'planner', settings: ['Cat-port closure'] } });
  });

});

describe('the window frame is the same either way', () => {
  it('does not move the collar, the hooks or the feet when the closure changes', () => {
    const a = windowInsertLayout('modular', WINDOW_INSERT_DEFAULT, windowWith('removable-panel')); const b = windowInsertLayout('modular', WINDOW_INSERT_DEFAULT, windowWith('sliding-gate'));
    expect(windowFrame(a.window)).toEqual(windowFrame(b.window));
    expect(a.hookFit).toEqual(b.hookFit);
  });
});
