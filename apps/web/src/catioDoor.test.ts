import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CATIO_DOOR_HARDWARE, dimensionOf, findPart } from '@canfactory/contracts';
import {
  buttonOutline, buttonOverlap, buttonsAlong, buttonSweep, DOOR, DOOR_TRAVEL, doorAction, doorBom, doorBounds, doorFasteners, doorLibraryParts, doorPose, doorRetention, facePanel, insetPanel,
  PORT_CLOSURE_DEFAULT, PORT_CLOSURE_LEGACY, PORT_CLOSURES, slidingGateRise, type DoorBox, type DoorPanel,
} from './catioDoor.ts';
import { buildDoorPanel } from './catioDoorScene.ts';
import { createCatioParts } from './catioParts.ts';
import type { CatioState } from './catioScene.ts';
import { catioMesh } from '@canfactory/contracts';
import { MODULAR, MODULAR_DEFAULT, modularPortPanel, modularSteps, PORT_FRAME, validateModular, type ModularConfig } from './catioModularDesign.ts';
import { createModularCatio, type ModularState } from './catioModularScene.ts';
import { CATIO_SETTINGS_VERSION, CATIO_STORAGE_KEY, defaultCatioSettings, loadCatioSettings, migrateCatioSettings, parseCatioSettings, savedBeforeClosure } from './catioSettings.ts';
import { defaultSubassemblySettings, fastenerClashes, parseSubassemblySettings, saveShared, subassemblyStorageKey } from './catioSubassembly.ts';
import { couplingDefinition, tunnelCouplingDefinition, tunnelDefinition, windowInsertDefinition } from './catioSubassemblies.ts';
import { COUPLING_CONTROLS, COUPLING_DEFAULT, couplingFacts, couplingLayout, couplingSteps } from './catioCoupling.ts';
import { createCouplingScene } from './catioCouplingScene.ts';
import { parseTunnel, TUNNEL, TUNNEL_DEFAULT, tunnelBom, tunnelFacts, tunnelLayout, tunnelSite, tunnelSteps, vec, type TunnelConfig, type TunnelSite } from './catioTunnel.ts';
import { TUNNEL_COUPLING_DEFAULT } from './catioTunnelJoint.ts';
import { tunnelCouplingFacts, tunnelCouplingLayout } from './catioTunnelCoupling.ts';
import { createTunnelCouplingScene } from './catioTunnelCouplingScene.ts';
import { createTunnelScene } from './catioTunnelScene.ts';
import { windowFrame } from './catioWindow.ts';
import { doorZone, HOOK_FIT, INSERT, validateWindowInsert, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT, windowFor, windowInsertBom, windowInsertFacts, windowInsertLayout, windowInsertSteps, type WindowInsertConfig, type WindowSpec } from './catioWindowInsert.ts';
import { createWindowInsertScene } from './catioWindowInsertScene.ts';

/** The cat port sizes the catio concept page allows (20–45 cm each way), and section lengths between the tunnel's flanges. */
const SIZES = [200, 250, 300, 380, 450];
const BAYS = [300, 440, 690, 940];
const faces = SIZES.flatMap(width => SIZES.flatMap(height => (['solid', 'mesh'] as const).map(material => facePanel({ id: 'p', width, height, material, land: PORT_FRAME }))));
const insets = BAYS.flatMap(width => SIZES.map(height => insetPanel({ id: 'a', width, height, cavity: TUNNEL.rail, pivots: { head: TUNNEL.access.pivotEdge, sill: TUNNEL.floor + TUNNEL.rail - TUNNEL.access.pivotEdge } })));
const doors = [...faces, ...insets];
const name = (d: DoorPanel) => `${d.fit} ${d.material} ${d.opening.width} × ${d.opening.height}`;
const range = (b: DoorBox, i: 0 | 1 | 2): [number, number] => [b.center[i] - b.size[i] / 2, b.center[i] + b.size[i] / 2];
const fixed = (d: DoorPanel) => d.timber.filter(t => !t.moves).flatMap(t => t.boxes);
const moving = (d: DoorPanel) => d.timber.filter(t => t.moves).flatMap(t => t.boxes);
const overlaps = (a: [number, number], b: [number, number]) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
const installed: CatioState = { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);
const sliding: ModularConfig = { ...MODULAR_DEFAULT, portClosure: 'sliding-gate' };
const windowWith = (closure: WindowSpec['closure'], config: WindowInsertConfig = WINDOW_INSERT_DEFAULT): WindowSpec => ({ ...windowFor('modular', config), closure });
const siteWith = (closure: WindowSpec['closure'], insert: WindowInsertConfig = WINDOW_INSERT_DEFAULT): TunnelSite => {
  const window = windowWith(closure, insert);
  return { ...tunnelSite(), insert, window, floorZ: windowInsertLayout('modular', insert, window).floor };
};

describe('removable door panel: seating', () => {
  it('fits every permitted opening without a complaint, and refuses one too small or with too little timber beside it', () => {
    for (const d of doors) expect(d.errors, name(d)).toEqual([]);
    expect(facePanel({ id: 'p', width: 100, height: 300, material: 'solid', land: PORT_FRAME }).errors.join()).toMatch(/at least 15 cm each way/);
    expect(facePanel({ id: 'p', width: 300, height: 300, material: 'solid', land: 25 }).errors.join()).toMatch(/too narrow for the panel’s locating strips/);
    expect(insetPanel({ id: 'a', width: 440, height: 300, cavity: 30, pivots: { head: 12, sill: 46 } }).errors.join()).toMatch(/need 40 mm of depth; the opening has 30 mm/);
    expect(insetPanel({ id: 'a', width: 440, height: 300, cavity: 40, pivots: { head: 2, sill: 46 } }).errors.join()).toMatch(/would not turn clear of the panel/);
  });

  it('is seated all round: on the frame beside and above its opening and on a stop across its floor, or on four stops inside it', () => {
    for (const d of doors) {
      const [u0, u1, v0, v1] = d.rect; const { width: W, height: H } = d.opening;
      // the panel covers the whole opening, and nothing of it stands in the opening behind its seat
      expect(u0, name(d)).toBeLessThanOrEqual(-W / 2 + (d.fit === 'inset' ? DOOR.clearance : 0)); expect(u1).toBeGreaterThanOrEqual(W / 2 - (d.fit === 'inset' ? DOOR.clearance : 0));
      expect(d.back, name(d)).toBeGreaterThanOrEqual(0);
      for (const b of moving(d)) expect(range(b, 2)[0], name(d)).toBeGreaterThanOrEqual(d.back - 1e-9);
      // the seat's overlap on each of its four edges: the frame's own face (a face-fitted panel laps onto it), or a stop strip
      const stops = fixed(d).filter(b => range(b, 2)[1] <= 1e-9);
      const lap = {
        left: d.fit === 'face' ? -W / 2 - u0 : Math.max(...stops.map(b => overlaps(range(b, 0), [u0, u0 + 50]))),
        right: d.fit === 'face' ? u1 - W / 2 : Math.max(...stops.map(b => overlaps(range(b, 0), [u1 - 50, u1]))),
        head: d.fit === 'face' ? v1 - H : Math.max(...stops.map(b => overlaps(range(b, 1), [v1 - 50, v1]))),
        sill: Math.max(...stops.map(b => overlaps(range(b, 1), [v0, v0 + 50]))),
      };
      for (const [side, value] of Object.entries(lap)) expect(value, `${name(d)} ${side}`).toBeGreaterThanOrEqual(d.seatLap - 1e-9);
      expect(d.seatLap, name(d)).toBeGreaterThanOrEqual(10);
      // the stops are continuous: they run the opening's whole width at its floor (and, inset, round all four sides)
      const sill = stops.filter(b => range(b, 1)[0] < 1e-9);
      expect(Math.max(...sill.map(b => b.size[0])), name(d)).toBeCloseTo(W, 6);
      if (d.fit === 'inset') {
        expect(stops.reduce((n, b) => n + Math.max(b.size[0], b.size[1]), 0)).toBeCloseTo(2 * W + 2 * (H - 2 * DOOR.stop.lap), 6);
        // the stops and the panel fill the depth of the rails exactly: the panel is flush with them
        expect(DOOR.stop.depth + (d.front - d.back)).toBe(TUNNEL.rail);
      }
    }
  });

  it('is carried and located by timber, not by its screws: it stands on the floor between strips, or in its opening, with 2 mm to spare', () => {
    for (const d of doors) {
      const [u0, u1, v0, v1] = d.rect;
      // it stands on the opening's floor
      expect(v0, name(d)).toBe(0);
      if (d.fit === 'face') {
        // locating strips beside it and over it, each 2 mm clear, thick enough to carry the buttons level with its face
        const strips = fixed(d).filter(b => range(b, 2)[0] >= -1e-9);
        expect(strips).toHaveLength(3);
        const beside = strips.filter(b => b.size[1] > b.size[0]); const over = strips.find(b => b.size[0] > b.size[1]);
        expect(beside.map(b => range(b, 0)).map(([a, z]) => a > 0 ? a - u1 : u0 - z)).toEqual([DOOR.clearance, DOOR.clearance]);
        expect((over ? range(over, 1)[0] : NaN) - v1).toBe(DOOR.clearance);
        for (const b of strips) { expect(range(b, 2)).toEqual([0, d.mount]); expect(Math.abs(b.center[0]) + b.size[0] / 2, name(d)).toBeLessThanOrEqual(d.opening.width / 2 + PORT_FRAME + 1e-9); }
      } else {
        expect([u0 + d.opening.width / 2, d.opening.width / 2 - u1, d.opening.height - v1]).toEqual([DOOR.clearance, DOOR.clearance, 2 * DOOR.clearance]);
      }
      // a mesh panel is a frame with the mesh clamped under cover strips on its cat side; one longer than 60 cm has a mullion
      if (d.material === 'mesh') {
        expect(d.front - d.back).toBe(DOOR.frame.thickness + DOOR.meshLayer + DOOR.cover);
        const uprights = d.timber.find(t => t.id === 'panel-frame-stile')?.boxes.length ?? 0;
        expect(uprights, name(d)).toBe(1 + Math.max(1, Math.ceil((u1 - u0) / DOOR.mullionSpan)));
        expect(d.mesh?.center[2]).toBeLessThan(d.back + DOOR.cover + DOOR.meshLayer);
        expect(d.timber.find(t => t.id === 'panel-cover-stile')?.boxes.every(b => range(b, 2)[0] === d.back)).toBe(true);
        expect(d.seal).toBeNull(); expect(d.pull).toBeNull();
      } else {
        // a solid panel: plywood pressed onto a seal that runs all round its seat, with a pull on its operator's side
        expect(d.front - d.back).toBe(DOOR.solid.thickness);
        expect(d.back).toBe(DOOR.seal.gap); expect(DOOR.seal.gap).toBeLessThan(DOOR.seal.height);
        expect(d.seal?.boxes).toHaveLength(4);
        expect(d.seal?.length).toBeGreaterThan(2 * d.opening.width + 2 * d.opening.height);
        expect(d.pull && range(d.pull, 2)).toEqual([d.front, d.front + DOOR.pull.depth]);
      }
    }
  });
});

describe('removable door panel: retention both ways', () => {
  it('cannot be pushed in past its seat, nor drawn out past its closed buttons', () => {
    for (const d of doors) {
      // inwards (−n): the seat; outwards (+n): every button lies 12 mm over the panel, directly over its face
      expect(d.back, name(d)).toBeGreaterThanOrEqual(0);
      for (const b of d.buttons) {
        expect(buttonOverlap(d, b, 0), `${name(d)} ${b.id}`).toBeCloseTo(DOOR.button.overlap, 6);
        expect(b.pivot[2], b.id).toBe(d.buttonUnder);
      }
      expect(d.buttonUnder - d.front, name(d)).toBe(d.play);
      // a sealed panel is held squashed onto its seal; a mesh panel has only the washer's thickness of play
      expect(d.play).toBe(d.material === 'solid' ? 0 : dimensionOf(d.washer, 'h'));
      expect(d.play).toBeLessThan(d.seatLap);
    }
  });

  it('spaces its buttons so that the panel cannot tilt or flex free between them', () => {
    for (const d of doors) {
      const { span, corner } = doorRetention(d);
      expect(span, name(d)).toBeLessThanOrEqual(DOOR.pitch + 1e-9);
      expect(corner, name(d)).toBeLessThanOrEqual(DOOR.pitch / 2 + 1e-9);
      // both uprights and the head of a face-fitted panel, the head and the sill of an inset one: never one edge alone
      const sides = new Set(d.buttons.map(b => b.side));
      expect([...sides].sort(), name(d)).toEqual(d.fit === 'face' ? ['head', 'left', 'right'] : ['head', 'sill']);
      for (const side of sides) expect(d.buttons.filter(b => b.side === side).length, `${name(d)} ${side}`).toBeGreaterThanOrEqual(side === 'head' && d.fit === 'face' ? 1 : 2);
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
      expect(bite - (d.fit === 'face' ? d.mount : 0), name(d)).toBeGreaterThanOrEqual(DOOR.behind);
      expect(doorLibraryParts(d)).toEqual([{ partId: CATIO_DOOR_HARDWARE.washer, quantity: d.buttons.length, use: expect.stringContaining('turns on it') as string }]);
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
      const land = d.fit === 'face' ? PORT_FRAME : 0;
      for (const b of d.buttons) {
        for (let turn = 0; turn <= 1.0001; turn += 0.05) {
          const outline = buttonOutline(b, Math.min(1, turn));
          // it never reaches farther over the panel than its tip's circle does
          expect(buttonOverlap(d, b, Math.min(1, turn)), `${name(d)} ${b.id}`).toBeLessThanOrEqual(buttonSweep(b) - (b.reach - DOOR.button.overlap) + 1e-9);
          if (d.fit === 'face') for (const [u, v] of outline) {
            // never beyond the port frame it is mounted on
            expect(Math.abs(u), `${name(d)} ${b.id} at ${turn}`).toBeLessThanOrEqual(d.opening.width / 2 + land + 1e-6);
            expect(v, `${name(d)} ${b.id} at ${turn}`).toBeLessThanOrEqual(d.opening.height + land + 1e-6);
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
      expect(doorAction(d, 0.2, 'panel')).toMatch(new RegExp(`^${d.buttons.length} × Door turn button: turned a quarter turn clear`));
      expect(doorAction(d, 0.5, 'panel')).toMatch(/drawn straight out/); expect(doorAction(d, 0.9, 'panel')).toMatch(/stowed clear of the route/);
    }
    const stowed = facePanel({ id: 'p', width: 300, height: 300, material: 'solid', land: PORT_FRAME, stow: [700, 0, 400] });
    expect(doorPose(stowed, 1)).toMatchObject({ offset: [700, 0, 400], gone: false });
  });

  it('draws what it lays out: every piece once, the buttons turning and the panel coming out as one', () => {
    for (const d of [facePanel({ id: 'p', width: 300, height: 300, material: 'solid', land: PORT_FRAME, stow: [600, 0, 300] }), ...insets.slice(0, 2), ...faces.filter(f => f.material === 'mesh').slice(0, 1)]) {
      const p = createCatioParts(); const root = new THREE.Group(); p.root.add(root);
      const built = buildDoorPanel(p, d, { origin: [100, 50, 200], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0] }, { timber: root, mesh: root, hardware: root });
      root.updateMatrixWorld(true);
      expect(built.buttons).toHaveLength(d.buttons.length);
      expect(built.fixed).toHaveLength(d.timber.filter(t => !t.moves).length);
      // seated: the panel's timber is where the layout puts it, in the world
      const seated = bounds(built.panel);
      const expected = moving(d).map(b => doorBounds(built.frame, b));
      for (const i of [0, 1, 2] as const) {
        expect(seated.min.getComponent(i), name(d)).toBeCloseTo(Math.min(...expected.map(e => e.min[i])), 6);
        expect(seated.max.getComponent(i), name(d)).toBeCloseTo(Math.max(...expected.map(e => e.max[i])), 6);
      }
      // each button lies over the panel closed, and beside it open
      const overPanel = (b: typeof built.buttons[number]) => { const box = bounds(b.arm); return box.intersectsBox(new THREE.Box3(seated.min.clone().addScalar(-0.5), seated.max.clone().addScalar(0.5))) && box.max.x > seated.min.x + 1 && box.min.x < seated.max.x - 1 && box.max.z > seated.min.z + 1 && box.min.z < seated.max.z - 1; };
      for (const b of built.buttons) expect(overPanel(b), `${name(d)} ${b.button.id} closed`).toBe(true);
      built.set(DOOR_TRAVEL.turned); root.updateMatrixWorld(true);
      for (const b of built.buttons) expect(overPanel(b), `${name(d)} ${b.button.id} open`).toBe(false);
      expect(bounds(built.panel).min.y).toBeCloseTo(seated.min.y, 6);
      // drawn out along the door's n (here −Y), by its withdrawal
      built.set(DOOR_TRAVEL.out); root.updateMatrixWorld(true);
      expect(seated.min.y - bounds(built.panel).min.y).toBeCloseTo(d.withdraw, 6);
      built.set(1); root.updateMatrixWorld(true);
      // set aside where it is stowed, or carried away
      expect(built.panel.children.every(child => child.visible)).toBe(d.stow !== null);
      if (d.stow) expect(bounds(built.panel).min.x - seated.min.x).toBeCloseTo(d.stow[0], 6);
      built.set(0); root.updateMatrixWorld(true);
      expect(built.panel.children.every(child => child.visible)).toBe(true);
      expect(bounds(built.panel).min.toArray().map(x => Math.round(x * 1e6))).toEqual(seated.min.toArray().map(x => Math.round(x * 1e6)));
      p.dispose();
    }
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
  const grid = SIZES.flatMap(size => [500, 700, 910, 1600].flatMap(sash => [900, 1200, 2200].map((height): ModularConfig => ({
    ...MODULAR_DEFAULT, tunnelWidth: size, tunnelHeight: size, sashWidth: sash, sashHeight: sash, glassWidth: sash - 110, glassHeight: sash - 110, enclosure: { width: 1200, depth: 1000, height },
  }))));

  it('defaults to the removable panel, keeps the sliding gate selectable, and names what a saved design had', () => {
    expect(PORT_CLOSURE_DEFAULT).toBe('removable-panel'); expect(PORT_CLOSURE_LEGACY).toBe('sliding-gate');
    expect([...PORT_CLOSURES]).toEqual(['removable-panel', 'sliding-gate']);
    expect(MODULAR_DEFAULT.portClosure).toBe('removable-panel'); expect(defaultCatioSettings().config.portClosure).toBe('removable-panel');
    expect(validateModular(MODULAR_DEFAULT)).toEqual([]); expect(validateModular(sliding)).toEqual([]);
    expect(validateModular({ ...MODULAR_DEFAULT, portClosure: 'curtain' as ModularConfig['portClosure'] }).join()).toMatch(/Choose a removable panel or a sliding gate/);
    expect(slidingGateRise(300, 40)).toBe(640);
  });

  it('asks a sliding gate for its travel over every permitted size, and a removable panel only to fit where it stands', () => {
    for (const config of grid) {
      const removable = validateModular(config); const gate = validateModular({ ...config, portClosure: 'sliding-gate' });
      const label = JSON.stringify([config.tunnelWidth, config.tunnelHeight, config.sashHeight, config.enclosure.height]);
      // no travel constraint without a sliding gate
      expect(removable.filter(e => /sliding gate|raised cat gate/.test(e)), label).toEqual([]);
      // the same constraints as before for the gate, from the one shared rule
      expect(gate.some(e => /sliding gate needs room for its full upward travel/.test(e)), label).toBe(slidingGateRise(config.tunnelHeight, PORT_FRAME) > config.sashHeight - 10);
      expect(gate.some(e => /too low for the raised cat gate/.test(e)), label).toBe(MODULAR.sill + slidingGateRise(config.tunnelHeight, 2 * PORT_FRAME) > config.enclosure.height);
      // a panel only has to fit, with its frame, in the collar and under the enclosure's top rail: never more than the gate asked
      expect(removable.some(e => /must fit inside the window collar/.test(e)), label).toBe(config.tunnelWidth + 80 > config.sashWidth - 10 || config.tunnelHeight + 80 > config.sashHeight - 10);
      expect(removable.some(e => /too low for its cat ports/.test(e)), label).toBe(MODULAR.sill + config.tunnelHeight + 80 > config.enclosure.height);
      for (const error of removable) expect(gate.length, `${label}: ${error}`).toBeGreaterThan(0);
      // its seat, buttons and withdrawal are checked from the very panel that is drawn
      if (removable.length === 0) for (const at of ['window', 'enclosure'] as const) {
        const panel = modularPortPanel(config, at); expect(panel.errors, label).toEqual([]);
        expect(panel.material).toBe(at === 'window' ? 'solid' : 'mesh');
        expect(panel.withdraw).toBeLessThanOrEqual(config.tunnelWidth + 100);
      }
    }
    // a port as high as the sliding gate could never be: 45 cm in a 91 cm sash, and in a 90 cm enclosure
    const tall = { ...MODULAR_DEFAULT, tunnelWidth: 450, tunnelHeight: 450, enclosure: { width: 1200, depth: 1000, height: 900 } };
    expect(validateModular(tall)).toEqual([]); expect(validateModular({ ...tall, portClosure: 'sliding-gate' })).toHaveLength(2);
  });

  it('applies the window insert’s own travel check to a sliding gate only, and its panel checks to a panel only', () => {
    for (const height of SIZES) for (const sash of [600, 910, 1300]) {
      const base = { ...windowFor('modular'), sashWidth: sash, sashHeight: sash, glassWidth: sash - 110, glassHeight: sash - 110, openingWidth: sash + 90, openingHeight: sash + 90, tunnel: { width: 300, height } };
      const gate = validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, { ...base, closure: 'sliding-gate' }); const panel = validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, { ...base, closure: 'removable-panel' });
      const l = windowInsertLayout('modular', WINDOW_INSERT_DEFAULT, { ...base, closure: 'sliding-gate' });
      expect(gate.some(e => /sliding gate needs room above the port/.test(e)), `${height} in ${sash}`).toBe(l.floor + slidingGateRise(height, 50) > l.z0 + l.H - INSERT.member - 40);
      expect(panel.filter(e => /sliding|gate/.test(e)), `${height} in ${sash}`).toEqual([]);
      expect(panel.some(e => /must fit under the collar’s head rail/.test(e)), `${height} in ${sash}`).toBe(l.floor + height + INSERT.portMember > l.z0 + l.H - INSERT.member);
      expect(gate.filter(e => /panel|turn button/.test(e))).toEqual([]);
    }
    // 45 cm high in the default 91 cm sash: a panel fits, a gate has nowhere to go
    const tall = { ...windowFor('modular'), tunnel: { width: 300, height: 450 } };
    expect(validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, { ...tall, closure: 'removable-panel' })).toEqual([]);
    expect(validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, { ...tall, closure: 'sliding-gate' }).join()).toMatch(/sliding gate needs room above the port/);
  });
});

describe('saved settings from before the closure could be chosen', () => {
  const without = <T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key as K))) as Omit<T, K>;
  const legacyConfig = without({ ...MODULAR_DEFAULT, route: 'left' as const, approach: 3, tunnelWidth: 350, secondEnabled: true, second: { width: 1800, depth: 1600, height: 1900 } }, 'portClosure');
  const legacyViews = { direct: { progress: 2, exploded: true, windowOpen: false, cutaway: true, hidden: ['mesh'], view: 'Side', doors: {} }, modular: { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: ['environment'], view: 'Top', doors: { 'window-cat': false, 'a-human': true } } };
  const legacy = JSON.stringify({ version: 1, mode: 'modular', config: legacyConfig, views: legacyViews });

  it('keeps a version 1 catio’s dimensions and viewing state, and its sliding gates; its tunnel square at the larger size', () => {
    const settings = parseCatioSettings(legacy);
    expect(settings.version).toBe(CATIO_SETTINGS_VERSION); expect(settings.mode).toBe('modular');
    // a 35 × 30 cm tunnel becomes the standard square port, 35 cm both ways: the cats' opening never shrinks
    expect(settings.config).toEqual({ ...legacyConfig, tunnelHeight: 350, portClosure: 'sliding-gate' });
    expect(settings.views).toEqual(legacyViews);
    expect(validateModular(settings.config)).toEqual([]);
    // saved again, it stays as migrated: the new default is never applied behind the owner's back
    expect(parseCatioSettings(JSON.stringify(settings))).toEqual(settings);
    // a sliding-only size that only a version 1 design could have keeps working
    expect(parseCatioSettings(JSON.stringify({ version: 1, mode: 'modular', config: { ...legacyConfig, sashHeight: 910 }, views: {} })).config.portClosure).toBe('sliding-gate');
  });

  it('uses the new default only for a fresh or reset design, and still rejects what is not a valid design', () => {
    expect(parseCatioSettings(null).config.portClosure).toBe('removable-panel');
    expect(structuredClone(MODULAR_DEFAULT).portClosure).toBe('removable-panel');
    // a design saved with the choice keeps its choice, either way
    for (const portClosure of PORT_CLOSURES) expect(parseCatioSettings(JSON.stringify({ ...defaultCatioSettings(), config: { ...MODULAR_DEFAULT, portClosure } })).config.portClosure).toBe(portClosure);
    // corrupt or invalid: the defaults, as before
    expect(migrateCatioSettings(null)).toBeNull(); expect(migrateCatioSettings({ version: 7 })).toBeNull(); expect(migrateCatioSettings([])).toBeNull();
    expect(parseCatioSettings(JSON.stringify({ version: 1, config: { ...legacyConfig, sashWidth: 2 } }))).toEqual(defaultCatioSettings());
    expect(parseCatioSettings(JSON.stringify({ version: 1, config: 'none' }))).toEqual(defaultCatioSettings());
    expect(parseCatioSettings(JSON.stringify({ version: 2, config: legacyConfig }))).toEqual(defaultCatioSettings());
    expect(parseCatioSettings(JSON.stringify({ version: 2, config: { ...legacyConfig, portClosure: 'curtain' } }))).toEqual(defaultCatioSettings());
    // migrating does not touch what it is given
    const before = JSON.parse(legacy) as Record<string, unknown>; const copy = structuredClone(before);
    migrateCatioSettings(before); expect(before).toEqual(copy);
  });

  it('keeps a saved tunnel as it was, without side access, with its settings and viewing state', () => {
    const old = without({ ...TUNNEL_DEFAULT, portX: 800, portHeight: 655, supportFixing: 'dowels' as const, mesh: 'welded' as const }, 'sideAccess', 'sideAccessSide');
    const saved = parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, variant: 'modular', config: old, views: { modular: { progress: 3, view: 'Top', hidden: ['mesh'], cutaway: true, exploded: true, windowOpen: false } } }));
    expect(saved.config).toEqual({ ...old, sideAccess: 'none', sideAccessSide: TUNNEL_DEFAULT.sideAccessSide });
    expect(saved.views.modular).toEqual({ progress: 3, view: 'Top', hidden: ['mesh'], cutaway: true, exploded: true, windowOpen: false, doorOpen: false });
    expect(tunnelLayout(saved.config, siteWith('sliding-gate')).access).toEqual([]);
    // saved again with the setting, it keeps it; a fresh or reset tunnel has the new default
    expect(parseTunnel(saved.config)).toEqual(saved.config);
    expect(parseTunnel({ ...old, sideAccess: 'all', sideAccessSide: 'left' })).toMatchObject({ sideAccess: 'all', sideAccessSide: 'left' });
    expect(defaultSubassemblySettings(tunnelDefinition).config).toMatchObject({ sideAccess: 'one', sideAccessSide: 'right' });
    expect(parseSubassemblySettings(tunnelDefinition, null).config.sideAccess).toBe('one');
    // only the settings another page shares with it, written before the tunnel page was ever opened: not a saved tunnel
    expect(parseTunnel({ supportFixing: 'strap', supportBase: 'self-standing' })).toEqual({ ...TUNNEL_DEFAULT, supportFixing: 'strap', supportBase: 'self-standing' });
    // an invalid value of the setting itself falls back to the default, like any other
    expect(parseTunnel({ ...old, sideAccess: 'both' })?.sideAccess).toBe('one');
  });

  it('keeps sliding gates for a window insert or tunnel saved before the choice, when the whole catio was never saved', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key), clear: () => store.clear(), key: () => null, length: 0 };
    const previous = (globalThis as { localStorage?: Storage }).localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
    try {
      const oldView = { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: [], view: 'Exterior' };
      const oldPage = (config: object) => JSON.stringify({ version: 1, variant: 'modular', config, views: { direct: oldView, modular: oldView } });
      const closures = () => [loadCatioSettings().config.portClosure, windowFor('modular').closure, tunnelSite().window.closure, windowInsertLayout('modular', WINDOW_INSERT_DEFAULT).closure];
      // nothing saved anywhere: a new design, with removable panels
      expect(closures()).toEqual(Array(4).fill('removable-panel')); expect(store.size).toBe(0);
      // each page alone, saved before the choice, with no whole-catio settings: its design keeps its sliding gate
      for (const [id, config] of [['window-insert', { ...WINDOW_INSERT_DEFAULT, footDiameter: 40 }], ['tunnel', without(TUNNEL_DEFAULT, 'sideAccess', 'sideAccessSide')], ['insert-tunnel-coupling', COUPLING_DEFAULT], ['tunnel-tunnel-coupling', TUNNEL_COUPLING_DEFAULT]] as const) {
        store.clear(); store.set(subassemblyStorageKey(id), oldPage(config));
        expect(savedBeforeClosure(storage), id).toBe(true);
        expect(closures(), id).toEqual(Array(4).fill('sliding-gate'));
        expect(windowInsertLayout('modular', WINDOW_INSERT_DEFAULT).door, id).toBeNull();
        // the decision is saved with the catio's settings, everything else at its defaults
        expect(JSON.parse(store.get(CATIO_STORAGE_KEY) ?? '{}')).toEqual({ ...defaultCatioSettings(), config: { ...MODULAR_DEFAULT, portClosure: 'sliding-gate' } });
        // so it holds once the page has saved itself again in today's form
        store.set(subassemblyStorageKey(id), JSON.stringify(parseSubassemblySettings(windowInsertDefinition, null)));
        expect(savedBeforeClosure(storage), id).toBe(false); expect(closures(), id).toEqual(Array(4).fill('sliding-gate'));
      }
      // a page first saved today, with no whole-catio settings: a new design
      store.clear(); store.set(subassemblyStorageKey('window-insert'), JSON.stringify(defaultSubassemblySettings(windowInsertDefinition)));
      expect(savedBeforeClosure(storage)).toBe(false); expect(closures()).toEqual(Array(4).fill('removable-panel')); expect(store.has(CATIO_STORAGE_KEY)).toBe(false);
      // only the settings another page shares into a page's storage, or rubbish: not a saved design
      store.clear(); saveShared(tunnelCouplingDefinition, { ...TUNNEL_COUPLING_DEFAULT, supportFixing: 'strap' as const }); store.set(subassemblyStorageKey('window-insert'), '{oops');
      expect(store.has(subassemblyStorageKey('tunnel'))).toBe(true); expect(savedBeforeClosure(storage)).toBe(false); expect(closures()).toEqual(Array(4).fill('removable-panel'));
      // saved whole-catio settings decide, whatever the pages hold: version 1 migrates to the gate, a chosen panel stays
      store.set(subassemblyStorageKey('tunnel'), oldPage(without(TUNNEL_DEFAULT, 'sideAccess', 'sideAccessSide')));
      store.set(CATIO_STORAGE_KEY, JSON.stringify(defaultCatioSettings())); expect(closures()).toEqual(Array(4).fill('removable-panel'));
      store.set(CATIO_STORAGE_KEY, legacy); expect(loadCatioSettings().config.portClosure).toBe('sliding-gate');
    } finally { Object.defineProperty(globalThis, 'localStorage', { value: previous, configurable: true }); }
  });

  it('remembers an opened door per page, and starts every older page with its door shut', () => {
    for (const definition of [windowInsertDefinition, couplingDefinition, tunnelDefinition, tunnelCouplingDefinition] as const) {
      const d = definition as typeof windowInsertDefinition;
      expect(defaultSubassemblySettings(d).views.modular.doorOpen, d.id).toBe(false);
      const last = d.steps('modular', d.defaults).length - 1;
      expect(parseSubassemblySettings(d, JSON.stringify({ version: 1, variant: 'modular', config: d.defaults, views: { modular: { progress: last, doorOpen: true } } })).views.modular).toMatchObject({ progress: last, doorOpen: true });
      expect(parseSubassemblySettings(d, JSON.stringify({ version: 1, variant: 'modular', config: d.defaults, views: { modular: { progress: last, doorOpen: 'yes' } } })).views.modular.doorOpen).toBe(false);
    }
    // each page offers the toggle only where its design has a door
    expect(windowInsertDefinition.doorToggle?.('modular', WINDOW_INSERT_DEFAULT)).toBe('Cat port open');
    expect(windowInsertDefinition.doorToggle?.('direct', WINDOW_INSERT_DEFAULT)).toBeNull();
    expect(couplingDefinition.doorToggle?.('modular', COUPLING_DEFAULT)).toBe('Cat port open');
    // the tunnel's side access and its cubes' doors open together
    expect(tunnelDefinition.doorToggle?.('modular', TUNNEL_DEFAULT)).toBe('Doors open');
    expect(tunnelDefinition.doorToggle?.('modular', { ...TUNNEL_DEFAULT, sideAccess: 'none' })).toBe('Cube doors open');
    const noCubes = { ...TUNNEL_DEFAULT, angleJoint: 'angle-collar' as const };
    expect(tunnelDefinition.doorToggle?.('modular', noCubes)).toBe('Side access open');
    expect(tunnelDefinition.doorToggle?.('modular', { ...noCubes, sideAccess: 'none' })).toBeNull();
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
      expect(windowInsertLayout('direct', config).door).toBeNull(); expect(windowInsertLayout('direct', config).closure).toBeNull();
    }
  });

  it('seats a solid panel on the port frame’s room side, standing on the threshold, coming out into the room', () => {
    for (const config of valid) {
      const l = windowInsertLayout('modular', config, windowWith('removable-panel', config)); const door = l.door; if (!door || !l.port) throw new Error('door');
      expect(door.panel).toMatchObject({ material: 'solid', fit: 'face', opening: { width: l.port.width, height: l.port.height } });
      expect(door.frame).toEqual({ origin: [0, l.yOut - INSERT.portMember, l.floor], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0] });
      // its seat is the jambs' and the transom's room-side faces: the port frame's own timber
      const jambs = l.timber.filter(t => t.component === 'port-frame').flatMap(t => t.boxes);
      for (const b of jambs) expect(b.center[1] - b.size[1] / 2, 'port frame room face').toBeCloseTo(door.frame.origin[1], 6);
      const sheet = doorBounds(door.frame, door.panel.timber.find(t => t.id === 'panel-sheet')?.boxes[0] ?? { size: [0, 0, 0], center: [0, 0, 0] });
      expect(sheet.min[2]).toBeCloseTo(l.floor, 6);
      expect(sheet.max[1]).toBeCloseTo(door.frame.origin[1] - DOOR.seal.gap, 6);
      // the strips lie on the jambs and the transom, within them
      for (const b of door.panel.timber.filter(t => t.id.startsWith('strip')).flatMap(t => t.boxes).map(b => doorBounds(door.frame, b))) {
        expect(b.max[1]).toBeCloseTo(door.frame.origin[1], 6);
        expect(Math.max(Math.abs(b.min[0]), Math.abs(b.max[0]))).toBeLessThanOrEqual(l.port.width / 2 + INSERT.portMember + 1e-6);
        expect(b.max[2]).toBeLessThanOrEqual(l.port.transomZ + INSERT.portMember + 1e-6);
      }
      // the sill stop lies on the threshold between the jambs, on the tunnel side of the seat
      const stop = doorBounds(door.frame, door.panel.timber.find(t => t.id === 'stop-sill')?.boxes[0] ?? { size: [0, 0, 0], center: [0, 0, 0] });
      expect([stop.min[2], stop.max[2] - stop.min[2], stop.min[1]]).toEqual([l.floor, DOOR.stop.lap, door.frame.origin[1]].map(x => expect.closeTo(x, 6) as number));
      expect(stop.max[1]).toBeLessThanOrEqual(l.yOut);
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
      expect(quantity(line => line.name.startsWith('Locating strip'))).toBe(3); expect(quantity(line => line.name === 'Sill stop')).toBe(1);
      expect(quantity(line => /Door turn button, printed \(custom\)/.test(line.name))).toBe(door.buttons.length);
      expect(quantity(line => line.name.startsWith('Panel pull'))).toBe(1); expect(quantity(line => line.id === 'port-panel-door-seal')).toBe(1);
      // the pivots, the washers, the strips', the stop's and the pull's screws: library parts, more than the gate's list by exactly these
      const extra = (partId: string) => quantity(line => line.partId === partId) - quantity(line => line.partId === partId, gate);
      expect(extra(CATIO_DOOR_HARDWARE.pivot.sealed)).toBe(door.buttons.length); expect(extra(CATIO_DOOR_HARDWARE.washer)).toBe(door.buttons.length);
      expect(extra(CATIO_DOOR_HARDWARE.stripScrew.sealed)).toBe(door.fasteners.filter(f => f.role === 'strip').length);
      expect(extra(CATIO_DOOR_HARDWARE.stopScrew)).toBe(door.fasteners.filter(f => f.role === 'stop').length);
      expect(extra(CATIO_DOOR_HARDWARE.pullScrew)).toBe(2);
      // everything else is the same list
      const doorParts: string[] = Object.values(CATIO_DOOR_HARDWARE).flatMap(v => typeof v === 'string' ? [v] : Object.values(v));
      const rest = (list: typeof lines) => list.filter(line => !/^port-panel|^cat-gate$|^gate-/.test(line.id) && !doorParts.includes(line.partId ?? ''));
      expect(rest(lines)).toEqual(rest(gate));
    }
    const facts = windowInsertFacts('modular', WINDOW_INSERT_DEFAULT, windowWith('removable-panel'));
    expect(facts.find(f => f.label === 'Cat port · closed by')).toEqual({ label: 'Cat port · closed by', value: 'Removable panel with turn buttons', from: { page: 'concept', settings: ['Cat-port closure'] } });
    expect(facts.find(f => f.label === 'Port panel · kept in by')?.value).toMatch(/^6 turn buttons \(jamb and head\), 12 mm over the panel · seat 12 mm$/);
    expect(windowInsertFacts('modular', WINDOW_INSERT_DEFAULT, windowWith('sliding-gate')).find(f => f.label === 'Cat port · closed by')?.value).toBe('Vertical sliding gate');
    expect(windowInsertFacts('direct', WINDOW_INSERT_DEFAULT).some(f => /closed by|Port panel/.test(f.label))).toBe(false);
    const step = windowInsertSteps('modular', WINDOW_INSERT_DEFAULT, windowWith('removable-panel')).at(-1);
    expect(step?.detail).toMatch(/Screw the 6 door turn buttons onto the strips/);
    expect(step?.detail).toMatch(/Shut it again, every button over it, before the tunnel is undocked/);
    expect(step?.detail).not.toMatch(/gate|track/);
    expect(windowInsertSteps('modular', WINDOW_INSERT_DEFAULT, windowWith('sliding-gate')).at(-1)?.detail).toMatch(/Lower the sliding cat gate into them from above/);
  });

  it('stages the panel from the room side, turns its buttons over it last, and opens it again with the page’s toggle', () => {
    const scene = createWindowInsertScene('modular', WINDOW_INSERT_DEFAULT, windowWith('removable-panel')); const door = scene.closure?.door; if (!door) throw new Error('door');
    const ids = scene.components.map(part => part.id);
    expect(ids).toEqual(expect.arrayContaining(['port-panel', 'port-panel-hardware'])); expect(ids.filter(id => /gate/.test(id))).toEqual([]);
    expect(scene.components.find(part => part.id === 'port-panel')).toMatchObject({ step: 6, layer: 'timber' });
    expect(scene.components.find(part => part.id === 'port-panel-hardware')).toMatchObject({ step: 6, layer: 'hardware' });
    const turned = () => door.buttons.map(b => Math.abs(Math.atan2(Math.sin(b.arm.rotation.z - Math.atan2(b.button.closed[1], b.button.closed[0])), Math.cos(b.arm.rotation.z - Math.atan2(b.button.closed[1], b.button.closed[0])))) / (Math.PI / 2));
    // stage 6: stop and strips, their screws, the seal, the buttons (pointing clear), the panel, and last the buttons turned over it
    const captions: string[] = [];
    for (let progress = 5.02; progress < 6; progress += 0.04) { scene.update({ ...installed, progress }); const caption = scene.caption?.(); if (caption && captions.at(-1) !== caption) captions.push(caption); }
    expect(captions.map(c => c.split(':')[0])).toEqual(['4 × Sill stop and locating strip', 'Screws', 'Seal', '6 × Door turn button', 'Cat-port panel', '6 × Door turn button']);
    expect(captions.at(-1)).toMatch(/turned a quarter turn over the panel, until its pip drops into its dimple/);
    scene.update({ ...installed, progress: 5.7 }); for (const t of turned()) expect(t).toBeCloseTo(1, 6);
    // complete: seated, every button over it
    scene.update(installed); const seated = bounds(door.panel);
    for (const t of turned()) expect(t).toBeCloseTo(0, 6);
    expect(scene.caption?.()).toBeNull();
    // the toggle: buttons clear first, then the panel into the room, then stowed on the wall beside the window
    scene.update({ ...installed, door: 0.2 }); expect(scene.caption?.()).toMatch(/6 × Door turn button: turned a quarter turn clear of the cat-port panel/);
    expect(bounds(door.panel).min.y).toBeCloseTo(seated.min.y, 6);
    scene.update({ ...installed, door: DOOR_TRAVEL.turned }); for (const t of turned()) expect(t).toBeCloseTo(1, 6);
    scene.update({ ...installed, door: DOOR_TRAVEL.out }); expect(seated.min.y - bounds(door.panel).min.y).toBeCloseTo(door.door.withdraw, 6);
    expect(scene.caption?.()).toMatch(/Cat-port panel: stowed clear of the route/);
    scene.update({ ...installed, door: 1 });
    const stowed = bounds(door.panel); const w = scene.layout.window;
    expect(stowed.min.x).toBeGreaterThan(w.openingWidth / 2); expect(stowed.max.y).toBeLessThan(-300);
    // the port is clear: nothing of the door's is left in the opening but the low sill stop
    const port = scene.layout.port; if (!port) throw new Error('port');
    const opening = new THREE.Box3(new THREE.Vector3(-port.width / 2 + 1, -400, scene.layout.floor + DOOR.stop.lap + 1), new THREE.Vector3(port.width / 2 - 1, 0, scene.layout.floor + port.height - 1));
    for (const part of scene.components.filter(q => /^port-panel/.test(q.id))) part.group.traverse(o => { if (o instanceof THREE.Mesh && o.visible) expect(new THREE.Box3().setFromObject(o).intersectsBox(opening), part.id).toBe(false); });
    // before the assembly is complete, and exploded, the toggle does nothing
    scene.update({ ...installed, progress: 5, door: 1 }); expect(door.panel.position.z).toBeGreaterThan(0);
    scene.update({ ...installed, progress: 6, door: 0 }); expect(bounds(door.panel).min.toArray().map(Math.round)).toEqual(seated.min.toArray().map(Math.round));
    scene.dispose();
    // the sliding gate, as before: tracks, gate and latch, and the toggle slides it up
    const gate = createWindowInsertScene('modular', WINDOW_INSERT_DEFAULT, windowWith('sliding-gate'));
    expect(gate.components.map(part => part.id)).toEqual(expect.arrayContaining(['gate-tracks', 'cat-gate', 'gate-latch']));
    expect(gate.components.map(part => part.id).filter(id => /port-panel/.test(id))).toEqual([]);
    gate.update(installed); const shut = bounds(gate.components.find(part => part.id === 'cat-gate')?.group ?? new THREE.Group());
    gate.update({ ...installed, door: 1 }); const raised = bounds(gate.components.find(part => part.id === 'cat-gate')?.group ?? new THREE.Group());
    expect(raised.min.z - shut.min.z).toBeCloseTo((gate.layout.port?.height ?? 0) + 30, 6);
    gate.update({ ...installed, door: 0.5 }); expect(gate.caption?.()).toMatch(/Cat gate: unlatched and slid up/);
    gate.dispose();
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
      const l = couplingLayout(config, { tunnel: TUNNEL_DEFAULT, site: tall }); const door = l.insert.door; if (!door) throw new Error('door');
      expect(l.errors, JSON.stringify([insert.attachment, insert.fixingPitch, config, height])).toEqual([]);
      const into = doorFasteners(door.panel, door.frame).filter(f => !f.moves && f.role !== 'stop');
      expect(into.length).toBeGreaterThan(door.panel.buttons.length);
      expect(fastenerClashes(l.fasteners.filter(f => f.component === 'frame-screws'), into, 12)).toEqual([]);
      // the same number of frame screws as with the sliding gate: only moved along
      const gateSite = siteWith('sliding-gate', insert); const gateWindow = { ...gateSite.window, tunnel: { width: 300, height } };
      const gate = couplingLayout(config, { tunnel: TUNNEL_DEFAULT, site: { ...gateSite, window: gateWindow, h: height, floorZ: tall.floorZ } });
      expect(l.fasteners.map(f => f.component)).toEqual(gate.fasteners.map(f => f.component));
      expect(l.frame).toEqual(gate.frame); expect(l.latches).toEqual(gate.latches);
    }
  });

  it('leaves the panel free to come out with the tunnel docked: everything of the coupling is on the port’s outdoor face', () => {
    const l = couplingLayout(COUPLING_DEFAULT, { tunnel: TUNNEL_DEFAULT, site: siteWith('removable-panel') }); const zone = doorZone(l.insert); if (!zone) throw new Error('zone');
    for (const member of l.frame) for (const b of member.boxes) expect(b.center[1] - b.size[1] / 2, member.id).toBeGreaterThanOrEqual(l.insert.yOut - 1e-9);
    expect(zone.max[1]).toBeLessThan(l.insert.yOut);
    // the insert still carries nothing: the wall support is the tunnel's, as before
    expect(l.wallSupport).toBeDefined();
    const steps = couplingSteps('modular', COUPLING_DEFAULT); const facts = couplingFacts('modular', COUPLING_DEFAULT);
    expect(steps[0]?.detail).toMatch(/with its cat-port panel seated, every turn button turned over it/);
    expect(steps.at(-1)?.detail).toMatch(/turn every button clear and lift its panel out, and stow it clear of the route/);
    expect(steps.at(-1)?.detail).toMatch(/Before undocking, shut the port at this end and the enclosure’s port at the other/);
    expect(facts.find(f => f.label === 'Cat port · closed by')).toMatchObject({ value: 'Removable panel with turn buttons', from: { page: 'concept' } });
  });

  it('shows the port shut until the tunnel is docked and latched, then opens it into the room past the docked tunnel', () => {
    const docked: CatioState = { progress: 5, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
    for (const closure of PORT_CLOSURES) {
      const scene = createCouplingScene('modular', COUPLING_DEFAULT, { tunnel: TUNNEL_DEFAULT, site: siteWith(closure) });
      const ids = scene.components.map(part => part.id);
      expect(ids).toEqual(expect.arrayContaining(['window-port-closure', 'window-port-closure-hardware']));
      expect(scene.closure?.door === null).toBe(closure === 'sliding-gate'); expect(scene.closure?.gate === null).toBe(closure === 'removable-panel');
      const group = scene.components.find(part => part.id === 'window-port-closure')?.group; if (!group) throw new Error('closure');
      scene.update(docked); const shut = bounds(group);
      // not docked yet, or the latches released: it stays shut whatever the toggle says
      for (const state of [{ ...docked, progress: 3, door: 1 }, { ...docked, windowOpen: true, door: 1 }, { ...docked, progress: 4.5, door: 1 }]) { scene.update(state); expect(bounds(group).equals(shut), `${closure} ${state.progress}`).toBe(true); }
      scene.update({ ...docked, door: 1 }); const open = bounds(group);
      expect(open.equals(shut)).toBe(false);
      if (closure === 'removable-panel') {
        // into the room: nothing of the moving panel passes the port frame's room-side face
        const moving = scene.closure?.door?.panel; if (!moving) throw new Error('panel');
        for (const travel of [0.45, 0.6, 0.8, 1]) { scene.update({ ...docked, door: travel }); expect(bounds(moving).max.y, String(travel)).toBeLessThanOrEqual(scene.layout.insert.yOut - INSERT.portMember + 1e-6); }
        scene.update({ ...docked, door: 0.5 }); expect(scene.caption?.()).toMatch(/Cat-port panel: drawn straight out of its opening/);
      } else expect(open.max.z).toBeGreaterThan(shut.max.z);
      scene.dispose();
    }
  });
});

describe('tunnel side access', () => {
  const routes: TunnelConfig[] = [
    TUNNEL_DEFAULT, { ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' },
    { ...TUNNEL_DEFAULT, portX: -1730, portY: 3420, portFacing: -25, portHeight: 820, slopeLeg: 'final', final: 2300 },
    { ...TUNNEL_DEFAULT, portX: 0, portY: 4000, portFacing: 0, portHeight: 245, slopeLeg: 'approach', approach: 1500 },
    { ...TUNNEL_DEFAULT, portX: 900, portY: 5200, portFacing: 15, portHeight: 1100, maxSlope: 25, sectionLength: 2 },
    { ...TUNNEL_DEFAULT, portX: 0, portY: 4000, portFacing: 0, portLevel: 'window', sectionLength: 1 },
    { ...TUNNEL_DEFAULT, angleJoint: 'angle-collar', portX: 1200, portY: 3000, final: 700, slopeLeg: 'middle' },
  ];
  const site = siteWith('removable-panel');
  const variants = (route: TunnelConfig) => (['none', 'one', 'all'] as const).flatMap(sideAccess => (['left', 'right'] as const).map((sideAccessSide): TunnelConfig => ({ ...route, sideAccess, sideAccessSide })));
  const joints = [TUNNEL_COUPLING_DEFAULT, { ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' as const }];

  it('leaves the route, every piece, coupling, support and the roof exactly as they are without it, for either mesh', { timeout: 120_000 }, () => {
    for (const route of routes) for (const mesh of ['netting', 'welded'] as const) for (const joint of joints) {
      const plain = tunnelLayout({ ...route, mesh, sideAccess: 'none' }, site, joint);
      type Layout = typeof plain;
      const roofEdges = (layout: Layout) => layout.panels.filter(panel => panel.id.endsWith('-mesh-roof')).flatMap(panel => panel.edges);
      /** The staples along the roof panels' edges: on an edge's line, driven its way. */
      const roofStaples = (layout: Layout) => { const edges = roofEdges(layout); return layout.fasteners.filter(f => f.component === 'staples' && edges.some(edge => vec.dot(f.direction, edge.drive) > 0.999 && Math.abs(vec.len(vec.sub(f.at, edge.from)) + vec.len(vec.sub(edge.to, f.at)) - vec.len(vec.sub(edge.to, edge.from))) < 1e-6)); };
      const plainRoofStaples = roofStaples(plain); expect(plainRoofStaples.length).toBeGreaterThan(plain.pieces.length);
      for (const config of variants({ ...route, mesh })) {
        const l = tunnelLayout(config, site, joint); const label = `${mesh} ${config.sideAccess} ${config.sideAccessSide}`;
        expect(l.errors, label).toEqual(plain.errors);
        for (const key of ['S', 'E', 'pieces', 'joints', 'interfaces', 'couplings', 'supports', 'members', 'cleats', 'totalLength', 'rise', 'turns'] as const) expect(l[key], `${label} ${key}`).toEqual(plain[key]);
        // the roof: the same panels, corners and edges, and the same staples along them
        const roof = (layout: typeof l) => layout.panels.filter(panel => panel.id.endsWith('-mesh-roof'));
        // (a cube has no roof mesh of its own: its roof is a door)
        expect(roof(l), label).toEqual(roof(plain)); expect(roof(l)).toHaveLength(l.pieces.filter(p => p.kind !== 'cube').length);
        expect(roofStaples(l), label).toEqual(plainRoofStaples);
        // the other fasteners too, but for the mesh of the side that is now a panel
        const notMesh = (layout: typeof l) => layout.fasteners.filter(f => f.component !== 'staples');
        expect(notMesh(l), label).toEqual(notMesh(plain));
        // roof mesh lines of the parts list are the same
        const roofLines = (config2: TunnelConfig) => tunnelBom('modular', config2, site, joint).filter(line => line.name === 'Roof mesh').map(line => ({ ...line, id: '' }));
        if (joint === TUNNEL_COUPLING_DEFAULT) expect(roofLines(config), label).toEqual(roofLines({ ...config, sideAccess: 'none' }));
        if (config.sideAccess === 'none') { expect(l.access).toEqual([]); expect(l.panels).toEqual(plain.panels); expect(l.fasteners).toEqual(plain.fasteners); }
      }
    }
  });

  it('replaces one side’s mesh with a panel between the flanges, in sections with two square ends long enough for it', () => {
    for (const route of routes) for (const config of variants(route)) {
      const l = tunnelLayout(config, site); const plain = tunnelLayout({ ...config, sideAccess: 'none' }, site);
      const T = TUNNEL.flange.thickness; const square = (p: typeof l.pieces[number]) => vec.dot(p.start.n, p.frame.y) > 1 - 1e-9 && vec.dot(p.end.n, p.frame.y) > 1 - 1e-9;
      const able = l.pieces.filter(p => p.kind === 'section' && square(p) && p.length - 2 * T >= TUNNEL.access.minLength);
      expect(config.supportFixing).not.toBe('strap');
      expect(l.access.map(a => a.piece), JSON.stringify(config)).toEqual(config.sideAccess === 'all' ? able.map(p => p.id) : config.sideAccess === 'one' ? able.slice(Math.floor(able.length / 2), Math.floor(able.length / 2) + 1).map(p => p.id) : []);
      const sign = config.sideAccessSide === 'left' ? -1 : 1; const sideName = config.sideAccessSide;
      for (const a of l.access) {
        const piece = l.pieces.find(p => p.id === a.piece); if (!piece) throw new Error('piece');
        expect(a.side).toBe(sign); expect(a.door.errors).toEqual([]);
        expect(a.door.opening).toEqual({ width: piece.length - 2 * T, height: l.h });
        // that side's mesh panel is gone, the other side's and the roof's are as they were
        expect(l.panels.some(panel => panel.id === `${piece.id}-mesh-${sideName}`)).toBe(false);
        for (const id of [`${piece.id}-mesh-${sideName === 'left' ? 'right' : 'left'}`, `${piece.id}-mesh-roof`]) expect(l.panels.find(panel => panel.id === id)).toEqual(plain.panels.find(panel => panel.id === id));
        // a net hood ends on that side's top rail, a staple over every mesh, above the buttons; welded mesh needs nothing more
        const edge = l.panels.find(panel => panel.id === `${piece.id}-mesh-edge-${sideName}`);
        expect(edge !== undefined).toBe(l.mesh.soft);
        if (edge) {
          const staples = l.fasteners.filter(f => f.component === 'staples' && f.piece === piece.id && /top rail over the side access/.test(f.use));
          expect((piece.length - 2 * T) / staples.length).toBeLessThanOrEqual(l.mesh.opening);
          const top = Math.max(...a.door.buttons.map(b => b.pivot[1] + buttonSweep(b)));
          expect(l.h + TUNNEL.rail - TUNNEL.access.hoodTurn).toBeGreaterThan(Math.max(...a.door.buttons.filter(b => b.side === 'head').map(b => b.pivot[1] + b.tail)));
          expect(top).toBeLessThan(l.h + TUNNEL.rail + 20);
        }
        // its frame: seated the panel's thickness inside the rails' outer faces, coming out sideways, flush with the rails
        const outer = l.w / 2 + TUNNEL.rail; const middle = vec.mul(vec.add(piece.start.at, piece.end.at), 0.5);
        expect(vec.len(vec.sub(a.frame.origin, vec.add(middle, vec.mul(piece.frame.x, sign * (outer - a.door.front)))))).toBeCloseTo(0, 6);
        expect(vec.dot(a.frame.n, vec.mul(piece.frame.x, sign))).toBeCloseTo(1, 9); expect(vec.dot(a.frame.v, piece.frame.z)).toBeCloseTo(1, 9);
        expect(vec.len(vec.sub(vec.cross(a.frame.u, a.frame.v), a.frame.n))).toBeCloseTo(0, 9);
        // everything of it lies between the flanges' inner faces, along the tunnel
        const along = (point: [number, number, number]) => vec.dot(vec.sub(point, middle), piece.frame.y);
        const reach = Math.max(...[...a.door.timber.flatMap(t => t.boxes).map(b => doorBounds(a.frame, b)).flatMap(b => [b.min, b.max]), ...a.door.buttons.flatMap(b => [-1, 1].map(k => [b.pivot[0] + k * buttonSweep(b), b.pivot[1], b.pivot[2]] as [number, number, number]).map(q => vec.add(a.frame.origin, vec.add(vec.mul(a.frame.u, q[0]), vec.add(vec.mul(a.frame.v, q[1]), vec.mul(a.frame.n, q[2]))))))].map(q => Math.abs(along(q))));
        if (Math.abs(piece.pitch) < 1e-9 && Math.abs(piece.frame.y[0]) < 1e-9) expect(reach).toBeLessThanOrEqual(piece.length / 2 - T + 1e-6);
        for (const b of a.door.buttons) expect(Math.abs(b.pivot[0]) + buttonSweep(b)).toBeLessThanOrEqual(a.door.opening.width / 2 + 1e-6);
      }
    }
    // mitred sections have no square ends: such a tunnel has no panel, and says so instead of failing
    const mitred = tunnelLayout({ ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' }, site);
    if (mitred.access.length === 0) expect(tunnelFacts('modular', { ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' }, site).find(f => f.label.startsWith('Side access'))?.value).toBe('no section can take a panel');
    expect(tunnelLayout(TUNNEL_DEFAULT, site).access).toHaveLength(1);
  });

  it('stays clear of the couplings’ latches and bolts, the supports and what holds the tunnel on them, and of the screws in its rails', () => {
    for (const route of routes) for (const joint of joints) for (const supportFixing of ['screws', 'strap', 'dowels', 'turn-buttons', 'gravity'] as const) {
      const l = tunnelLayout({ ...route, sideAccess: 'all', supportFixing, supportBase: 'self-standing' }, site, joint);
      for (const a of l.access) {
        const piece = l.pieces.find(p => p.id === a.piece); if (!piece) throw new Error('piece');
        const middle = vec.mul(vec.add(piece.start.at, piece.end.at), 0.5); const half = piece.length / 2 - TUNNEL.flange.thickness;
        const along = (point: [number, number, number]) => Math.abs(vec.dot(vec.sub(point, middle), piece.frame.y));
        // the space the panel, its stops and its buttons take, and the panel's way out, in the door's own frame
        const reachOut = a.door.depth + a.door.withdraw;
        /** Whether a box of a support (`size` across, along and up it) reaches into that space. */
        const inZone = (s: { across: [number, number, number]; along: [number, number, number] }, box: { center: [number, number, number]; size: [number, number, number] }) => {
          const d = vec.sub(box.center, a.frame.origin);
          const half = (e: [number, number, number]) => (Math.abs(vec.dot(s.across, e)) * box.size[0] + Math.abs(vec.dot(s.along, e)) * box.size[1] + Math.abs(e[2]) * box.size[2]) / 2;
          const [u, v, n] = [vec.dot(d, a.frame.u), vec.dot(d, a.frame.v), vec.dot(d, a.frame.n)]; const [hu, hv, hn] = [half(a.frame.u), half(a.frame.v), half(a.frame.n)];
          if (Math.abs(u) >= a.door.opening.width / 2 + hu - 1e-6) return false;
          // the opening, from the stops out to where the panel is clear; and the rails' faces above and below it, where the buttons turn
          const way = v > -hv + 1e-6 && v < l.h + hv - 1e-6 && n > -DOOR.stop.depth - hn + 1e-6 && n < reachOut + hn - 1e-6;
          const buttons = v > -TUNNEL.floor - TUNNEL.rail - hv + 1e-6 && v < l.h + TUNNEL.rail + hv - 1e-6 && n > a.door.mount - hn + 1e-6 && n < a.door.buttonUnder + DOOR.button.thickness + 2 + hn - 1e-6;
          return way || buttons;
        };
        // every latch and bolt of its section's couplings is at a flange, beyond the panel's ends; so the latches stay in reach
        for (const c of l.couplings.filter(q => q.before === piece.id || q.after === piece.id)) {
          for (const latch of c.latches) expect(along(latch.at), `${a.id} ${latch.id}`).toBeGreaterThan(half);
          for (const bolt of c.bolts) expect(along(bolt.at), a.id).toBeGreaterThan(half - 1e-6);
        }
        // what holds the tunnel on its supports (dowels, straps and cleats, keepers, posts and the support fixings' own turn buttons)
        for (const s of l.supports) {
          // none of them stands where the panel is, where it comes out, or where its buttons turn
          for (const button of s.hold.buttons) for (const box of [button.keeper, button.post, button.button]) expect(inZone(s, box), `${a.id} ${s.id}`).toBe(false);
          for (const cleat of s.hold.strap?.cleats ?? []) expect(inZone(s, cleat), `${a.id} ${s.id} strap cleat`).toBe(false);
          for (const point of s.hold.dowels) expect(inZone(s, { center: point, size: [8, 8, 40] }), `${a.id} ${s.id} dowel`).toBe(false);
          // a strap goes over the tunnel at a support: over the flanges, never over the panel
          const beside = (point: [number, number, number]) => { const d = vec.sub(point, middle); return vec.len(vec.sub(d, vec.mul(piece.frame.y, vec.dot(d, piece.frame.y)))) < l.w + 2 * TUNNEL.flange.width; };
          for (const point of s.hold.strap?.path ?? []) if (beside(point) && along(point) < piece.length / 2 + 100) expect(along(point), `${a.id} strap`).toBeGreaterThan(half);
        }
        // a strap would cross the first, the last and any sloped section's side: with straps those have no panel
        if (supportFixing === 'strap') { expect([l.pieces[0]?.id, l.pieces.at(-1)?.id]).not.toContain(a.piece); expect(piece.pitch).toBe(0); }
        else if (route === TUNNEL_DEFAULT) expect(l.access.map(q => q.piece)).toContain(l.pieces[0]?.id);
        expect(l.errors.filter(e => /strap would cross|turn button would foul/.test(e))).toEqual([]);
        // its pivots are driven into the rails clear of the roof's staples, the floor's screws and the rails' own
        const pivots = doorFasteners(a.door, a.frame).filter(f => f.role === 'pivot');
        const others = l.fasteners.filter(f => f.piece === piece.id && ['staples', 'floor-screws', 'rail-screws', 'cleat-screws', 'flange-screws', 'latch-screws', 'catch-screws'].includes(f.component));
        const near = pivots.flatMap(f => others.filter(o => {
          const screw = findPart(o.partId); const depth = screw ? dimensionOf(screw, 'l') : 30;
          const q = findPart(f.partId); const own = q ? dimensionOf(q, 'l') : 30;
          // the closest the two shanks come to each other, sampled along both
          let least = Infinity;
          for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) least = Math.min(least, vec.len(vec.sub(vec.add(f.at, vec.mul(f.direction, own * i / 10)), vec.add(o.at, vec.mul(vec.unit(o.direction), depth * j / 10)))));
          return least < 4;
        }));
        expect(near.map(o => o.component), `${a.id} ${supportFixing}`).toEqual([]);
        // and the tunnel is held on its supports exactly as without the panel
      }
      expect(l.supports.map(s => s.hold), supportFixing).toEqual(tunnelLayout({ ...route, sideAccess: 'none', supportFixing, supportBase: 'self-standing' }, site, joint).supports.map(s => s.hold));
    }
  });

  it('lists each panel’s timber, mesh, buttons and library screws, and tells how to use it without letting a cat out', () => {
    for (const mesh of ['netting', 'welded'] as const) for (const sideAccess of ['none', 'one', 'all'] as const) {
      // (a route without cubes, whose doors have the same parts)
      const config = { ...TUNNEL_DEFAULT, angleJoint: 'angle-collar' as const, portX: 1200, portY: 3000, final: 700, slopeLeg: 'middle' as const, mesh, sideAccess }; const l = tunnelLayout(config, site); const n = l.access.length;
      const lines = tunnelBom('modular', config, site); const plain = tunnelBom('modular', { ...config, sideAccess: 'none' }, site);
      const quantity = (match: (line: typeof lines[number]) => boolean, list = lines) => list.filter(match).reduce((sum, line) => sum + line.quantity, 0);
      const door = l.access[0]?.door;
      expect(quantity(line => /Door turn button, printed \(custom\)/.test(line.name))).toBe(l.access.reduce((sum, a) => sum + a.door.buttons.length, 0));
      expect(quantity(line => line.name === 'Removable panel mesh')).toBe(n);
      expect(quantity(line => line.name.startsWith('Panel frame'))).toBe(l.access.reduce((sum, a) => sum + a.door.timber.filter(t => t.id.startsWith('panel-frame')).reduce((k, t) => k + t.boxes.length, 0), 0));
      expect(quantity(line => line.name.startsWith('Access stop'))).toBe(4 * n);
      for (const [partId, role] of [[CATIO_DOOR_HARDWARE.pivot.inset, 'pivot'], [CATIO_DOOR_HARDWARE.stopScrew, 'stop'], [CATIO_DOOR_HARDWARE.frameScrew, 'frame'], [CATIO_DOOR_HARDWARE.coverScrew, 'cover']] as const)
        expect(quantity(line => line.partId === partId) - quantity(line => line.partId === partId, plain), `${mesh} ${sideAccess} ${role}`).toBe(l.access.reduce((sum, a) => sum + a.door.fasteners.filter(f => f.role === role).length, 0));
      expect(quantity(line => line.partId === CATIO_DOOR_HARDWARE.washer)).toBe(l.access.reduce((sum, a) => sum + a.door.buttons.length, 0));
      // one side's mesh fewer for each panel; the support fixings' own turn buttons are another part altogether
      if (mesh === 'welded') expect(quantity(line => line.name === 'Side mesh')).toBe(2 * l.pieces.length - n);
      else expect(quantity(line => line.name === 'Net hood')).toBe(l.pieces.length);
      expect(lines.some(line => line.id === 'turn-buttons')).toBe(false);
      const steps = tunnelSteps('modular', config).map(step => step.detail).join(' ');
      expect(/side access/.test(steps)).toBe(n > 0);
      if (door) {
        expect(steps).toMatch(new RegExp(`Screw ${door.buttons.length} door turn buttons onto the rails’ outer faces`));
        expect(steps).toMatch(/Opening one opens the tunnel to the garden: secure the cats elsewhere first, with both ends’ ports shut/);
      }
      // the gates at both ends, whatever they are, are shut before the tunnel is uncoupled
      expect(steps).toMatch(/Before any part of the tunnel is uncoupled again, shut both ends’ ports first/);
    }
    expect(tunnelSteps('modular', TUNNEL_DEFAULT)[0]?.detail).toMatch(/cat-port panel seated|cat gate shut and latched/);
    expect(tunnelFacts('modular', TUNNEL_DEFAULT, site).find(f => f.label === 'Side access · right')?.value).toMatch(/^1 removable mesh panel, .* · \d+ turn buttons \(head and sill\), 12 mm over the panel · seat 10 mm$/);
    expect(tunnelFacts('modular', TUNNEL_DEFAULT, siteWith('sliding-gate')).find(f => f.label.startsWith('Cat ports at both ends'))).toMatchObject({ value: 'Vertical sliding gate', from: { page: 'concept', settings: ['Cat-port closure'] } });
    expect(tunnelFacts('modular', { ...TUNNEL_DEFAULT, sideAccess: 'none' }, site).some(f => f.label.startsWith('Side access'))).toBe(false);
  });

  it('draws the panels with the shared door, opens them with the page’s toggle, and shows the window port’s closure as the insert has it', () => {
    for (const closure of PORT_CLOSURES) {
      const scene = createTunnelScene('modular', { ...TUNNEL_DEFAULT, sideAccess: 'all' }, siteWith(closure), TUNNEL_COUPLING_DEFAULT);
      const ids = scene.components.map(part => part.id);
      expect(ids).toEqual(expect.arrayContaining(['access-panels', 'access-panel-mesh', 'access-buttons', 'window-port-closure']));
      expect(scene.accessPanels).toHaveLength(scene.layout.access.length); expect(scene.accessPanels.length).toBeGreaterThan(1);
      expect(scene.components.find(part => part.id === 'access-panels')).toMatchObject({ step: 4, layer: 'timber' });
      expect(scene.components.find(part => part.id === 'access-panel-mesh')?.layer).toBe('mesh'); expect(scene.components.find(part => part.id === 'access-buttons')?.layer).toBe('hardware');
      scene.update(installed);
      const seated = scene.accessPanels.map(a => bounds(a.built.panel));
      for (const [i, a] of scene.accessPanels.entries()) {
        // installed where the layout puts it
        const expected = a.access.door.timber.filter(t => t.moves).flatMap(t => t.boxes).map(b => doorBounds(a.access.frame, b));
        for (const k of [0, 1, 2] as const) expect(seated[i]?.min.getComponent(k), a.access.id).toBeCloseTo(Math.min(...expected.map(e => e.min[k])), 4);
      }
      scene.update({ ...installed, door: 0.2 }); expect(scene.caption?.()).toMatch(/Door turn button: turned a quarter turn clear of the side-access panel/);
      scene.update({ ...installed, door: DOOR_TRAVEL.out });
      for (const [i, a] of scene.accessPanels.entries()) {
        const moved = bounds(a.built.panel).getCenter(new THREE.Vector3()).sub(seated[i]?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3());
        // straight out sideways, away from the tunnel
        expect(moved.length()).toBeCloseTo(a.access.door.withdraw, 4); expect(moved.normalize().dot(new THREE.Vector3(...a.access.frame.n))).toBeCloseTo(1, 6);
      }
      scene.update({ ...installed, door: 1 }); for (const a of scene.accessPanels) expect(a.built.panel.children.every(child => !child.visible)).toBe(true);
      // not before the tunnel is complete
      scene.update({ ...installed, progress: 5.5, door: 1 }); for (const a of scene.accessPanels) expect(a.built.panel.children.every(child => child.visible)).toBe(true);
      // the staging brings each panel in with its section, and says so
      scene.update({ ...installed, progress: 3.75 }); expect(scene.caption?.()).toMatch(/Side-access panel: stood on its opening’s sill against the stops/);
      scene.dispose();
    }
    const none = createTunnelScene('modular', { ...TUNNEL_DEFAULT, sideAccess: 'none' }, site, TUNNEL_COUPLING_DEFAULT);
    expect(none.components.map(part => part.id).filter(id => /access/.test(id))).toEqual([]); expect(none.accessPanels).toEqual([]); none.dispose();
  });

  it('shows a panel beside the tunnel–tunnel joint, clear of its latches, on the coupling page', () => {
    const tunnel = { ...TUNNEL_DEFAULT, sideAccess: 'all' as const };
    const l = tunnelCouplingLayout(TUNNEL_COUPLING_DEFAULT, { tunnel, site });
    expect(l.tl.access.filter(a => l.pieces.includes(a.piece)).map(a => a.piece)).toEqual(l.pieces);
    expect(tunnelCouplingFacts('modular', TUNNEL_COUPLING_DEFAULT, { tunnel, site }).find(f => f.label === 'Side access')).toMatchObject({ from: { page: 'tunnel', settings: ['sideAccess', 'sideAccessSide'] } });
    expect(tunnelCouplingFacts('modular', TUNNEL_COUPLING_DEFAULT, { tunnel: { ...tunnel, sideAccess: 'none' }, site }).some(f => f.label === 'Side access')).toBe(false);
    const scene = createTunnelCouplingScene('modular', TUNNEL_COUPLING_DEFAULT, { tunnel, site });
    expect(scene.accessPanels).toHaveLength(2);
    const coupled: CatioState = { progress: 5, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
    scene.update(coupled);
    // the latches' levers and the panels' pieces do not meet, shut or open
    for (const travel of [0, 0.4, 0.7]) {
      scene.update({ ...coupled, door: travel });
      for (const lever of scene.levers) for (const a of scene.accessPanels) for (const piece of [...a.built.moving, ...a.built.buttons.map(b => b.group), ...a.built.fixed.map(f => f.group)]) expect(bounds(lever.group).intersectsBox(bounds(piece)), `${a.access.id} at ${travel}`).toBe(false);
    }
    scene.update({ ...coupled, door: 1 }); expect(scene.accessPanels.every(a => a.built.panel.children.every(child => !child.visible))).toBe(true);
    scene.update({ ...coupled, progress: 4, door: 1 }); expect(scene.accessPanels.every(a => a.built.panel.children.every(child => child.visible))).toBe(true);
    scene.dispose();
  });
});

describe('whole catio: every cat port by the chosen closure', () => {
  const assembled: ModularState = { progress: 6, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
  const part = (scene: ReturnType<typeof createModularCatio>, id: string) => { const found = scene.components.find(p => p.id === id); if (!found) throw new Error(`Missing ${id}`); return found.group; };
  const both = { ...MODULAR_DEFAULT, secondEnabled: true };

  it('draws a removable panel at the window (solid) and at every enclosure port (framed mesh), or a sliding gate at each', () => {
    const panel = createModularCatio(both); const gate = createModularCatio({ ...both, portClosure: 'sliding-gate' });
    const cats = panel.doors.filter(d => d.kind === 'cat');
    expect(cats.map(d => d.id)).toEqual(gate.doors.filter(d => d.kind === 'cat').map(d => d.id)); expect(cats).toHaveLength(7);
    expect(new Set(cats.map(d => d.mechanism))).toEqual(new Set(['removable-panel'])); expect(new Set(gate.doors.filter(d => d.kind === 'cat').map(d => d.mechanism))).toEqual(new Set(['sliding-gate']));
    expect(panel.doors.filter(d => d.kind === 'human').map(d => d.mechanism)).toEqual(['hinged', 'hinged']);
    expect(cats.map(d => d.label)).toEqual(expect.arrayContaining(['Window cat-port panel', 'Enclosure A rear cat-port panel', 'Enclosure B left cat-port panel']));
    expect(gate.doors.map(d => d.label)).toEqual(expect.arrayContaining(['Window cat gate', 'Enclosure A rear cat gate']));
    const ids = panel.components.map(p => p.id); const gateIds = gate.components.map(p => p.id);
    for (const d of cats) {
      expect(ids).toEqual(expect.arrayContaining([`${d.id}-frame`, `${d.id}-panel`, `${d.id}-panel-buttons`]));
      // mesh at the enclosures, where a port may stand unused under the sky; solid at the window, which it has to close
      expect(ids.includes(`${d.id}-panel-mesh`), d.id).toBe(d.id !== 'window-cat');
      expect(gateIds).toEqual(expect.arrayContaining([`${d.id}-frame`, `${d.id}-tracks`, `${d.id}-gate`, `${d.id}-latch`]));
    }
    expect(ids.filter(id => /-(tracks|gate|latch)$/.test(id))).toEqual([]); expect(gateIds.filter(id => /-panel/.test(id))).toEqual([]);
    // the same parts otherwise, roofs and all
    const rest = (list: string[]) => list.filter(id => !/-(tracks|gate|latch|panel|panel-mesh|panel-buttons)$/.test(id));
    expect(rest(ids)).toEqual(rest(gateIds));
    panel.dispose(); gate.dispose();
  });

  it('leaves every roof, its bearers, the walls, floors and tunnel exactly as they are, whichever closure', () => {
    const panel = createModularCatio({ ...both, route: 'right' }); const gate = createModularCatio({ ...both, route: 'right', portClosure: 'sliding-gate' });
    panel.update(assembled); gate.update(assembled);
    const roofs = panel.components.filter(p => /roof/.test(p.id)); expect(roofs.length).toBeGreaterThan(4);
    for (const p of panel.components.filter(q => !/-(panel|panel-mesh|panel-buttons)$/.test(q.id) && !/^window-(threshold|docking-frame|cat)/.test(q.id) && q.id !== 'window-infill-below' && !/^window-infill/.test(q.id) && q.id !== 'recess-collar' && q.id !== 'screen-hooks' && q.id !== 'padded-clamps')) {
      const other = gate.components.find(q => q.id === p.id); if (!other) throw new Error(p.id);
      expect([p.step, p.layer], p.id).toEqual([other.step, other.layer]);
      expect(bounds(p.group).min.toArray().concat(bounds(p.group).max.toArray()), p.id).toEqual(bounds(other.group).min.toArray().concat(bounds(other.group).max.toArray()));
    }
    expect(panel.panels.filter(q => /roof/.test(q.id))).toEqual(gate.panels.filter(q => /roof/.test(q.id)));
    expect(panel.layout).toEqual(gate.layout);
    panel.dispose(); gate.dispose();
  });

  it('keeps unused ports shut and retained, opens the connected ones only at the last stage, and shuts any of them again', () => {
    const scene = createModularCatio(both);
    const seatedAt = new Map<string, THREE.Box3>();
    scene.update({ ...assembled, progress: 5 });
    for (const d of scene.doors.filter(q => q.kind === 'cat')) seatedAt.set(d.id, bounds(d.moving[0] ?? new THREE.Group()));
    const moved = (id: string) => { const d = scene.doors.find(q => q.id === id); const box = bounds(d?.moving[0] ?? new THREE.Group()); return d?.moving[0]?.children.some(child => !child.visible) || !box.equals(seatedAt.get(id) ?? new THREE.Box3()); };
    // before the last stage every port is shut, whatever is asked
    scene.update({ ...assembled, progress: 5, doors: Object.fromEntries(scene.doors.map(d => [d.id, true])) });
    for (const d of scene.doors.filter(q => q.kind === 'cat')) expect(moved(d.id), d.id).toBe(false);
    // complete: the connected ports open (their panels out), the unused stay shut even when asked to open
    scene.update({ ...assembled, doors: Object.fromEntries(scene.doors.map(d => [d.id, true])) });
    for (const d of scene.doors.filter(q => q.kind === 'cat')) expect(moved(d.id), d.id).toBe(d.connected);
    expect(scene.doors.filter(d => d.kind === 'cat' && !d.connected).map(d => d.id).sort()).toEqual(['a-left', 'b-rear', 'b-right']);
    // each shuts on its own
    scene.update({ ...assembled, doors: { 'window-cat': false } });
    expect(moved('window-cat')).toBe(false); expect(moved('a-rear')).toBe(true);
    // halfway through the last stage the buttons have turned and the panels are coming out: not a slide upwards
    scene.update({ ...assembled, progress: 5.6 });
    const rear = scene.doors.find(d => d.id === 'a-rear')?.moving[0]; if (!rear) throw new Error('rear');
    const out = bounds(rear).getCenter(new THREE.Vector3()).sub((seatedAt.get('a-rear') ?? new THREE.Box3()).getCenter(new THREE.Vector3()));
    expect(out.y).toBeGreaterThan(1); expect(Math.abs(out.z)).toBeLessThan(1e-6); expect(Math.abs(out.x)).toBeLessThan(1e-6);
    // the apertures are free of fixed mesh, and with the panel out nothing but the sill stop is left in a connected port
    scene.update(assembled);
    for (const d of scene.doors.filter(q => q.kind === 'cat' && q.connected)) {
      const frame = bounds(part(scene, `${d.id}-frame`)); const centre = frame.getCenter(new THREE.Vector3()); centre.z = MODULAR.sill + both.tunnelHeight / 2;
      const direction = d.id.endsWith('left') || d.id.endsWith('right') ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const through = new THREE.Raycaster(centre.clone().addScaledVector(direction, -120), direction, 0, 240);
      const blockers = scene.components.filter(p => p.layer === 'mesh' || new RegExp(`^${d.id}-panel`).test(p.id)).map(p => p.group);
      const hits = through.intersectObjects(blockers, true).filter(hit => { let o: THREE.Object3D | null = hit.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
      expect(hits, `${d.id} blocked`).toHaveLength(0);
    }
    scene.dispose();
  });

  it('describes the chosen mechanism in its stages', () => {
    for (const hung of [true, false]) {
      const panel = modularSteps(MODULAR_DEFAULT, hung); const gate = modularSteps(sliding, hung);
      expect(panel).toHaveLength(7); expect(gate).toHaveLength(7);
      expect(panel.map(s => s.title)).toEqual(['Existing window', 'Fit the window insert', 'Position the enclosures', 'Fit landings and cat ports', 'Lay the supported tunnel', 'Couple the connections', 'Open the connected ports']);
      expect(gate.at(-1)?.title).toBe('Open the connected gates');
      const text = panel.map(s => s.detail).join(' ');
      expect(text).not.toMatch(/gate|slid/i);
      expect(text).toMatch(/turn every button clear of each panel along the connected route, lift the panel out and stow it clear of the route/);
      expect(text).toMatch(/Before disconnecting a run, reseat the panels at both of its ends and turn every button back over them/);
      expect(text).toMatch(/unused ports stay shut/);
      expect(gate.map(s => s.detail).join(' ')).toMatch(/Before disconnecting a run, close and latch the gates at both ends/);
      expect(panel[1]?.detail.startsWith(hung ? 'Hang it on the window frame' : 'From inside, tighten the padded recess clamps')).toBe(true);
    }
  });
});

describe('the window frame is the same either way', () => {
  it('does not move the collar, the hooks or the feet when the closure changes', () => {
    const a = windowInsertLayout('modular', WINDOW_INSERT_DEFAULT, windowWith('removable-panel')); const b = windowInsertLayout('modular', WINDOW_INSERT_DEFAULT, windowWith('sliding-gate'));
    expect(windowFrame(a.window)).toEqual(windowFrame(b.window));
    expect(a.hookFit).toEqual(b.hookFit);
  });
});
