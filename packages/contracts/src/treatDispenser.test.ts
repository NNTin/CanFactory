import { readFileSync } from 'node:fs';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TREAT_DISPENSER, PhysicsSpecSchema, TIP_ANGLE, TREAT_DISPENSER, TREAT_FASTENERS, TREAT_FIRMWARE, TREAT_PRINTED_PARTS, dimensionOf, findModel, findPart,
  posePoint, treatBayLayout, treatBoltPoses, treatBolts, treatCycleSeconds, treatCycleSteps, treatDispenserAssembly, treatDispenserIssues, treatDispenserLayout,
  treatDispenserPhysics, treatFill, treatFootprint, treatRotorPieces, treatScadValues, treatVertices, treatWiringRoom, validateParameters, type TreatDispenserParameters,
} from './index.ts';

const p = DEFAULT_TREAT_DISPENSER;
const l = treatDispenserLayout(p);

describe('treat dispenser layout', () => {
  it('is valid by default and rejects impossible treats', () => {
    const model = findModel('treat-dispenser');
    if (!model) throw new Error('The treat dispenser is not registered.');
    expect(validateParameters(model, p)).toEqual([]);
    expect(treatDispenserIssues({ ...p, treatWidth: 15 })).not.toEqual([]);
    expect(treatDispenserIssues({ ...p, treatCornerRadius: 2.5, treatThickness: 4 })).not.toEqual([]);
    expect(treatDispenserIssues({ ...p, treatThickness: 7, pocketClearance: 2 })).not.toEqual([]);
  });

  it('sizes a pocket for one treat lying flat, under a slot as long as the pocket', () => {
    expect(l.pocket.length).toBeCloseTo(p.treatLength + 2 * p.pocketClearance, 9);
    expect(l.pocket.width).toBeCloseTo(p.treatWidth + 2 * p.pocketClearance, 9);
    expect(l.pocket.depth).toBeCloseTo(p.treatThickness + p.pocketClearance, 9);
    expect(2 * l.slot.halfX).toBeCloseTo(l.pocket.length, 9);
    // a core round the axis for the shaft
    expect(l.R - l.pocket.depth).toBeGreaterThanOrEqual(5);
  });

  it('leaves no tight edge a pocket leaves under: the flap closes it, a cavity deeper than a treat is long lies behind it', () => {
    expect(l.cavityR - l.R).toBeGreaterThan(p.treatLength);
    // the flap's root stands higher over the rotor than a treat standing on end on it
    expect(l.flap.root.z - (l.axisZ + l.R)).toBeGreaterThan(p.treatLength);
    expect(Math.hypot(l.flap.tip.y, l.flap.tip.z - l.axisZ)).toBeCloseTo(l.R, 9);
  });

  it('keeps the rotor more than a treat’s length above the chute where its pockets drop, so that none can be caught between them', () => {
    for (const y of [-l.slot.halfY, 0, l.slot.halfY]) expect(l.axisZ - l.R - l.chuteAt(y)).toBeGreaterThanOrEqual(TREAT_DISPENSER.dropClear - 1e-9);
    expect(TREAT_DISPENSER.dropClear).toBeGreaterThan(p.treatLength);
    // and the chute steep enough for a treat to slide (friction 0.4: 21.8°)
    expect(Math.tan(TREAT_DISPENSER.chuteSlope * Math.PI / 180)).toBeGreaterThan(0.4);
  });

  it('gives the rotor its pockets as pieces within its cylinder', () => {
    const pieces = treatRotorPieces(l);
    expect(pieces.length).toBe(7);
    for (const piece of pieces) for (let i = 0; i < piece.length; i += 3) {
      expect(Math.abs(piece[i] ?? 0)).toBeLessThanOrEqual(l.rotorEnd + 1e-9);
      expect(Math.hypot(piece[i + 1] ?? 0, (piece[i + 2] ?? 0) - l.axisZ)).toBeLessThanOrEqual(l.R + 1e-6);
    }
  });

  it('sizes the base plate so that a full 0.5 l bottle tips only past the stated angle', () => {
    const [x0, x1, y0, y1] = treatFootprint(p);
    expect(x1 - x0).toBeGreaterThanOrEqual(2 * (l.halfWidth + TREAT_DISPENSER.baseMargin));
    expect(y0).toBeGreaterThan(TREAT_DISPENSER.chuteEnd);
    expect(y1).toBeGreaterThan(l.back);
    expect(TIP_ANGLE).toBeGreaterThanOrEqual(20);
    const wide = treatFootprint({ ...p, bottleDiameter: 55 });
    expect(wide[1]).toBeGreaterThanOrEqual(x1);
  });
});

describe('treat dispenser firmware', () => {
  const yaml = readFileSync(new URL('../../../models/treat-dispenser/esphome/treat-dispenser.yaml', import.meta.url), 'utf8');
  const substitution = (name: string) => Number(new RegExp(`^  ${name}: "(-?[\\d.]+)"`, 'm').exec(yaml)?.[1]);
  const header = readFileSync(new URL('../../../models/treat-dispenser/esphome/treat_dispenser.h', import.meta.url), 'utf8');
  const field = (name: string) => Number(new RegExp(`\\b${name} = (-?[\\d.]+)`).exec(header)?.[1]);

  it('turns one pocket pitch per press, forwards only, at the simulated speed, every move derived from the calibration', () => {
    expect(substitution('steps_per_turn')).toBe(TREAT_FIRMWARE.stepsPerTurn);
    expect(yaml).toContain('config.steps_per_turn = ${steps_per_turn};');
    expect(substitution('max_speed')).toBe(TREAT_FIRMWARE.halfSteps);
    expect(substitution('acceleration')).toBe(TREAT_FIRMWARE.acceleration);
    expect(substitution('jog_steps')).toBe(TREAT_FIRMWARE.jogSteps);
    expect(substitution('pause_ms')).toBe(TREAT_FIRMWARE.pause * 1000);
    expect(substitution('settle_ms')).toBe(TREAT_FIRMWARE.settle * 1000);
    expect(yaml).toContain(`delayed_on: ${TREAT_FIRMWARE.debounce * 1000}ms`);
    // the logic's defaults are the simulated controller's
    expect(field('steps_per_turn')).toBe(TREAT_FIRMWARE.stepsPerTurn);
    expect(field('steps_per_turn') * field('turns_per_cycle')).toBe(treatCycleSteps());
    expect(field('rock_turns')).toBe(TREAT_FIRMWARE.rock);
    expect(field('pause_ms')).toBe(TREAT_FIRMWARE.pause * 1000);
    expect(field('settle_ms')).toBe(TREAT_FIRMWARE.settle * 1000);
    expect(field('prime_cycles')).toBe(TREAT_FIRMWARE.prime);
    expect(field('queue')).toBe(TREAT_FIRMWARE.queue);
    expect(treatCycleSeconds()).toBeGreaterThan(3);
  });

  it('sends every request through the one runner', () => {
    expect(yaml.match(/set_target\(/g)?.length).toBe(3); // boot, and the logic's move and stop hooks
    expect(yaml).not.toMatch(/stepper\.set_target|script\.execute: (dispense_cycle|one_cycle|run_cycles|jog_motor)/);
    for (const request of ['Dispense', 'Prime', 'Jog', 'MarkAligned', 'Calibrate']) expect(yaml).toContain(`dispenser_submit(treat_dispenser::Request::${request}`);
  });

  it('reads BOOT on GPIO9 and drives the ULN2003 from pins that are not strapping, USB or UART pins', () => {
    expect(yaml).toMatch(/number: GPIO9\s+inverted: true/);
    const pins = ['pin_a', 'pin_b', 'pin_c', 'pin_d'].map(pin => new RegExp(`${pin}: (GPIO\\d+)`).exec(yaml)?.[1]);
    expect(pins).toEqual(['GPIO5', 'GPIO6', 'GPIO7', 'GPIO10']);
    for (const avoided of ['GPIO2', 'GPIO8', 'GPIO18', 'GPIO19', 'GPIO20', 'GPIO21']) expect(pins).not.toContain(avoided);
    // no credentials: every secret comes from secrets.yaml
    expect(yaml).toMatch(/ssid: !secret wifi_ssid/);
    expect(yaml).not.toMatch(/password: "/);
  });
});

describe('treat dispenser assembly and electronics', () => {
  const assembly = treatDispenserAssembly(p);

  it('poses every printed part and reuses the ESP32-C3 case’s own parts and board placement', () => {
    for (const part of TREAT_PRINTED_PARTS) expect(assembly.poses[part]).toBeDefined();
    const model = findModel('treat-dispenser');
    expect(model?.parts?.find(part => part.id === 'case-bottom')?.sourcePath).toBe('models/esp32-c3-supermini-case/bottom.scad');
    expect(model?.parts?.find(part => part.id === 'case-top')?.sourcePath).toBe('models/esp32-c3-supermini-case/top.scad');
    expect(model?.license).toBe('CC BY-NC-SA 4.0');
    expect(model?.attribution).toMatch(/bovineblitz/);
    expect(model?.attribution).toMatch(/cylus80/);
    for (const reference of ['motor', 'driver', 'board', 'header-1', 'header-2']) expect(assembly.references?.some(item => item.id === reference)).toBe(true);
  });

  it('puts B and R on the case lid’s outer face, as far apart as the board’s buttons, the lid in the back wall', () => {
    const bay = treatBayLayout(p);
    expect(bay.bootPoint[2]).toBe(0);
    expect(Math.hypot(bay.bootPoint[0] - bay.resetPoint[0], bay.bootPoint[1] - bay.resetPoint[1])).toBeCloseTo(11.66 - 6.11, 6);
    // the case upright inside the outer body and behind the rotor's block, its lid in the back wall (its base 8.4 deep)
    expect(bay.caseFrame.position[0] - 10.9).toBeGreaterThanOrEqual(-l.halfWidth + TREAT_DISPENSER.shell + 1);
    expect(bay.caseFrame.position[1] + 14.4 - 8.4).toBeGreaterThan(l.blockBack);
    expect(bay.caseFrame.position[1] + 14.4).toBeCloseTo(l.back + 0.5, 9);
    // USB-C at its lower end, high enough over the base for the plug and its cable's bend
    expect(bay.usb[2]).toBeGreaterThan(TREAT_DISPENSER.base + 20);
  });

  it('leaves both of the SuperMini’s header rows room for jumper plugs, beside the inner body, not against it', () => {
    const T = TREAT_DISPENSER;
    const rows = treatWiringRoom(p).filter(room => room.id.startsWith('row-'));
    expect(rows).toHaveLength(2);
    for (const room of rows) {
      // inside the outer body, left of the inner body's block and legs, in front of the pins' tips by a housing and a bend
      expect(room.min[0]).toBeGreaterThanOrEqual(-(l.halfWidth - T.shell));
      expect(room.max[0]).toBeLessThanOrEqual(-l.block.halfX + 1e-9);
      expect(room.min[1]).toBeLessThan(treatBayLayout(p).pinTip - 13);
      // clear of the cap's lugs and the sleeve (left of the block, round the rotor's axis) and of the feet
      const lugBottom = l.axisZ - T.lug - (l.capScrewR + T.lug) * Math.tan(50 * Math.PI / 180);
      expect(room.min[0] >= l.lugFace + T.lugThickness || room.max[2] <= lugBottom).toBe(true);
      expect(room.min[1] > l.bore.radius + T.wall || room.max[2] < l.axisZ - (l.bore.radius + T.wall) / Math.cos(50 * Math.PI / 180)).toBe(true);
      expect(room.min[2]).toBeGreaterThan(T.base + T.foot);
    }
    // the two rows face the same way, a row's pitch apart across the case
    expect(Math.abs((rows[0]?.min[0] ?? 0) - (rows[1]?.min[0] ?? 0))).toBeCloseTo(15.24, 1);
  });

  it('sizes every nut bay from the library’s ISO 4032 M3 nut, flat to flat, and every screw to pass through its nut', () => {
    const nut = findPart(TREAT_FASTENERS.nut);
    if (!nut) throw new Error('Missing the nut.');
    const s = dimensionOf(nut, 's', 'max'), e = dimensionOf(nut, 'e', 'min'), m = dimensionOf(nut, 'm', 'max');
    expect([s, e, m]).toEqual([5.5, 6.01, 2.4]);
    // a hexagon across its flats with play, its corners clear of the nut's, its slot as wide as across the flats, narrower than the
    // nut across its corners, so that it cannot turn in it
    expect(l.bay.across).toBeCloseTo(s + 2 * TREAT_DISPENSER.nutPlay, 9);
    expect(l.bay.across * 2 / Math.sqrt(3)).toBeGreaterThan(e);
    expect(l.bay.across).toBeLessThan(e);
    expect(l.bay.depth).toBeGreaterThan(m);
    const values = new Map(treatScadValues(p));
    expect(values.get('NUT')).toEqual([l.bay.across, l.bay.depth].map(v => Math.round(v * 1e6) / 1e6));
    const bolts = treatBolts(p);
    expect(bolts).toHaveLength(16);
    for (const bolt of bolts) {
      const screw = findPart(bolt.screw);
      expect(screw?.attributes['standard'], bolt.id).toBe('ISO 4762');
      expect(screw?.attributes['thread'], bolt.id).toBe('M3');
      // the tip passes the whole nut
      expect(dimensionOf(screw ?? nut, 'l'), bolt.id).toBeGreaterThanOrEqual(bolt.nutAt + m);
      expect(Math.hypot(...bolt.axis)).toBeCloseTo(1, 9); expect(Math.hypot(...bolt.entry)).toBeCloseTo(1, 9);
      expect(bolt.axis.reduce((sum, v, k) => sum + v * (bolt.entry[k] ?? 0), 0)).toBeCloseTo(0, 9);
    }
    // the motor's screws stay in the block's and the right leg's side wall: their tips (and the holes 0.5 past them) short of the slot
    for (const bolt of bolts.filter(b => b.id.startsWith('motor'))) expect(bolt.at[0] - dimensionOf(findPart(bolt.screw) ?? nut, 'l') - 0.5).toBeGreaterThan(l.slot.halfX + 1);
    // their nuts slide in from the block's front face
    for (const bolt of bolts.filter(b => b.id.startsWith('motor'))) expect(bolt.at[1] - bolt.slot).toBeLessThan(-l.block.halfY);
  });

  it('shows every screw and nut in the assembly, where its bolt puts it, and moves each in a step', () => {
    const bolts = treatBolts(p);
    const references = new Map((assembly.references ?? []).map(reference => [reference.id, reference]));
    const stepped = new Set(assembly.steps.flatMap(step => step.parts));
    for (const bolt of bolts) {
      expect(references.get(`${bolt.id}-screw`)?.part).toBe(bolt.screw);
      expect(references.get(`${bolt.id}-nut`)?.part).toBe(TREAT_FASTENERS.nut);
      const poses = treatBoltPoses(bolt);
      expect(assembly.poses[`${bolt.id}-screw`]).toEqual(poses.screw);
      expect(assembly.poses[`${bolt.id}-nut`]).toEqual(poses.nut);
      // the screw's head (its own frame: tip at z = 0, the head from z = l) bears at the bolt's seat; the nut's flats lie along its slot
      const length = dimensionOf(findPart(bolt.screw) ?? findPart(TREAT_FASTENERS.nut)!, 'l');
      posePoint(poses.screw, [0, 0, length]).forEach((v, k) => expect(v).toBeCloseTo(bolt.at[k] ?? 0, 6));
      // the nut's flats are across its own X: its +X maps to the bay's axis × entry
      const across = posePoint({ position: [0, 0, 0], rotation: poses.nut.rotation }, [1, 0, 0]);
      expect(Math.abs(across.reduce((sum, v, k) => sum + v * (bolt.entry[k] ?? 0), 0))).toBeCloseTo(0, 9);
      for (const id of [`${bolt.id}-screw`, `${bolt.id}-nut`]) expect(stepped.has(id), id).toBe(true);
    }
  });

  it('passes the generator every value it reads', () => {
    const scad = readFileSync(new URL('../../../models/treat-dispenser/generator.scad', import.meta.url), 'utf8');
    const names = new Set(treatScadValues(p).map(([name]) => name));
    for (const match of scad.matchAll(/L\("([A-Z0-9_]+)"\)/g)) expect(names.has(match[1] ?? '')).toBe(true);
  });
});

describe('treat dispenser mechanism', () => {
  const spec = treatDispenserPhysics(p);

  it('is a valid spec whose motor turns only the rotor', () => {
    expect(Value.Check(PhysicsSpecSchema, spec)).toBe(true);
    expect(spec.motors?.map(motor => motor.body)).toEqual(['rotor']);
    expect(spec.bodies.find(body => body.id === 'rotor')?.joint?.type).toBe('hinge');
    expect(spec.bodies.filter(body => body.fixed).map(body => body.id)).toEqual(['inner-body', 'chute']);
    expect(spec.controller?.counter).toBe('out');
    // one press: forward a pocket pitch (negative about +X), never back
    expect(spec.controller?.moves).toEqual([-360 / TREAT_DISPENSER.pockets]);
    // the flap: a sprung hinge, pressed on the rotor
    const flap = spec.bodies.find(body => body.id === 'flap');
    expect(flap?.joint?.type).toBe('hinge');
    expect(flap?.joint?.spring?.rest).toBeLessThan(0);
  });

  it('models each treat as a rounded cuboid of the stated size, not a sphere', () => {
    const vertices = treatVertices(p);
    const extent = (k: number) => Math.max(...vertices.filter((_, i) => i % 3 === k)) - Math.min(...vertices.filter((_, i) => i % 3 === k));
    expect([extent(0), extent(1), extent(2)].map(value => Number(value.toFixed(6)))).toEqual([14, 9, 5]);
    for (const item of spec.items ?? []) expect(item.vertices).toEqual(vertices);
  });

  it('fills without overlap above the rotor, the same for the same seed', () => {
    const settings: TreatDispenserParameters = { ...p };
    const a = treatFill(settings, 10, 3, 'random'), b = treatFill(settings, 10, 3, 'random');
    expect(a).toEqual(b);
    for (const treat of a) expect(treat.centre[2]).toBeGreaterThan(l.blockTop);
    for (const [i, first] of a.entries()) for (const second of a.slice(i + 1)) {
      expect(Math.hypot(...first.centre.map((value, k) => value - (second.centre[k] ?? 0)))).toBeGreaterThan(p.treatThickness);
    }
    for (const mode of ['flat', 'edge', 'end', 'diagonal'] as const) expect(treatFill(settings, 8, 1, mode)).toHaveLength(8);
  });

  it('runs the CI scenarios: dispensing invariants, idle, empty, jam, reset, hold and burst', () => {
    expect(spec.scenarios?.map(scenario => scenario.id)).toEqual(['prime-and-dispense', 'idle', 'empty', 'jam', 'reset', 'hold-and-burst']);
  });
});
