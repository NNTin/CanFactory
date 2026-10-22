import { readFileSync } from 'node:fs';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TREAT_DISPENSER, PhysicsSpecSchema, TREAT_DISPENSER, TREAT_FIRMWARE, TREAT_PRINTED_PARTS, discPieces, findModel, notchOutline, outletOutline, spurGearRadii,
  treatBayLayout, treatCycleSeconds, treatCycleSteps, treatDispenserAssembly, treatDispenserIssues, treatDispenserLayout, treatDispenserPhysics, treatFill, treatScadValues,
  treatVertices, validateParameters, type TreatDispenserParameters,
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
  });

  it('takes one treat lying flat per notch, flush with the face, and no second one beside it', () => {
    // the notch is the treat plus its clearance; deep exactly as thick as the treat plus the plate gap, so a treat on top cannot catch
    expect(l.notchLength).toBeCloseTo(p.treatLength + 2 * p.notchClearance, 9);
    expect(l.notchWidth).toBeCloseTo(p.treatWidth + 2 * p.notchClearance, 9);
    expect(l.discThickness).toBe(p.treatThickness);
    // a second treat flat beside the first needs twice the width; edge on, twice the thickness more than what is left
    expect(2 * p.treatWidth).toBeGreaterThan(l.notchWidth);
    expect(l.notchWidth - p.treatWidth + 0.01).toBeLessThan(p.treatThickness);
    expect(l.notchLength - p.treatLength + 0.01).toBeLessThan(p.treatThickness);
  });

  it('keeps the outlet clear of the notches either side of it at rest, so nothing drops while it stands still', () => {
    const outlet = outletOutline(l);
    for (const angle of l.notchAngles.filter(a => Math.abs(a - l.outletAngle) <= 45)) {
      const notch = notchOutline(l, angle);
      // the notch's points and the outlet's are at least 2 mm apart along the turn
      const along = (q: [number, number]) => Math.atan2(q[1], q[0]) * 180 / Math.PI;
      const gap = Math.min(...notch.map(q => Math.abs(along(q) - l.outletAngle))) - Math.max(...outlet.map(q => Math.abs(along(q) - l.outletAngle)));
      expect(gap).toBeGreaterThan(0);
    }
  });

  it('meshes a 15-tooth pinion with a 30-tooth gear inside the chute’s floor', () => {
    expect(TREAT_DISPENSER.gearTeeth / TREAT_DISPENSER.pinionTeeth).toBe(2);
    expect(l.centreDistance).toBeCloseTo(spurGearRadii(l.pinion).pitch + spurGearRadii(l.gear).pitch, 9);
    expect(l.gearClear).toBeGreaterThanOrEqual(0.6);
    // the pinion sits on the motor's shaft, 8 mm off its can's axis (Kiatronics)
    expect(l.pinionAt[1] - l.canAt[1]).toBeCloseTo(8, 9);
  });

  it('gives the disc four notches as pieces with no sliver, open at the rim', () => {
    const pieces = discPieces(l);
    expect(pieces.length).toBeGreaterThan(20);
    for (const piece of pieces) for (let i = 2; i < piece.length; i += 3) {
      expect(piece[i]).toBeGreaterThanOrEqual(-l.discThickness - 1e-9);
      expect(piece[i]).toBeLessThanOrEqual(1e-9);
    }
  });
});

describe('treat dispenser firmware', () => {
  const yaml = readFileSync(new URL('../../../models/treat-dispenser/esphome/treat-dispenser.yaml', import.meta.url), 'utf8');
  const substitution = (name: string) => Number(new RegExp(`^  ${name}: "(-?[\\d.]+)"`, 'm').exec(yaml)?.[1]);

  const header = readFileSync(new URL('../../../models/treat-dispenser/esphome/treat_dispenser.h', import.meta.url), 'utf8');
  const field = (name: string) => Number(new RegExp(`\\b${name} = (-?[\\d.]+)`).exec(header)?.[1]);

  it('moves one notch pitch per press, in two halves, at the simulated speed, every move derived from the calibration', () => {
    expect(substitution('steps_per_turn')).toBe(TREAT_FIRMWARE.stepsPerTurn);
    expect(yaml).not.toMatch(/half_cycle/);
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
    expect(field('pause_ms')).toBe(TREAT_FIRMWARE.pause * 1000);
    expect(field('settle_ms')).toBe(TREAT_FIRMWARE.settle * 1000);
    expect(field('prime_cycles')).toBe(TREAT_FIRMWARE.prime);
    expect(field('queue')).toBe(TREAT_FIRMWARE.queue);
    expect(treatCycleSeconds()).toBeGreaterThan(3);
  });

  it('sends every request through the one runner', () => {
    // no script or lambda moves the motor except the logic's hooks
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
    for (const reference of ['motor', 'driver', 'board', 'header-1', 'header-2']) expect(assembly.references?.some(item => item.id === reference)).toBe(true);
  });

  it('puts B and R on the case lid’s outer face, as far apart as the board’s buttons', () => {
    const bay = treatBayLayout(p);
    expect(bay.bootPoint[2]).toBe(0);
    expect(Math.hypot(bay.bootPoint[0] - bay.resetPoint[0], bay.bootPoint[1] - bay.resetPoint[1])).toBeCloseTo(11.66 - 6.11, 6);
  });

  it('passes the generator every value it reads', () => {
    const scad = readFileSync(new URL('../../../models/treat-dispenser/generator.scad', import.meta.url), 'utf8');
    const names = new Set(treatScadValues(p).map(([name]) => name));
    for (const match of scad.matchAll(/L\("([A-Z0-9_]+)"\)/g)) expect(names.has(match[1] ?? '')).toBe(true);
  });
});

describe('treat dispenser mechanism', () => {
  const spec = treatDispenserPhysics(p);

  it('is a valid spec whose motor turns only the pinion, its gears meshing by frictionless teeth', () => {
    expect(Value.Check(PhysicsSpecSchema, spec)).toBe(true);
    expect(spec.motors?.map(motor => motor.body)).toEqual(['pinion']);
    expect(spec.bodies.find(body => body.id === 'gear')).toMatchObject({ frictionless: true, fixed: true, joint: { parent: 'disc' } });
    expect(spec.bodies.find(body => body.id === 'pinion')?.frictionless).toBe(true);
    expect(spec.bodies.find(body => body.id === 'disc')?.joint?.type).toBe('hinge');
    expect(spec.controller?.counter).toBe('out');
  });

  it('models each treat as a rounded cuboid of the stated size, not a sphere', () => {
    const vertices = treatVertices(p);
    const extent = (k: number) => Math.max(...vertices.filter((_, i) => i % 3 === k)) - Math.min(...vertices.filter((_, i) => i % 3 === k));
    expect([extent(0), extent(1), extent(2)].map(value => Number(value.toFixed(6)))).toEqual([14, 9, 5]);
    // rounded: no vertex at a sharp corner
    expect(vertices.some((_, i) => i % 3 === 0 && Math.abs(vertices[i] ?? 0) === 7 && Math.abs(vertices[i + 1] ?? 0) === 4.5)).toBe(false);
    for (const item of spec.items ?? []) expect(item.vertices).toEqual(vertices);
  });

  it('fills without overlap, the same for the same seed', () => {
    const settings: TreatDispenserParameters = { ...p };
    const a = treatFill(settings, 12, 3, 'random'), b = treatFill(settings, 12, 3, 'random');
    expect(a).toEqual(b);
    for (const [i, first] of a.entries()) for (const second of a.slice(i + 1)) {
      expect(Math.hypot(...first.centre.map((value, k) => value - (second.centre[k] ?? 0)))).toBeGreaterThan(p.treatThickness);
    }
    for (const mode of ['flat', 'edge', 'end', 'diagonal'] as const) expect(treatFill(settings, 10, 1, mode)).toHaveLength(10);
  });

  it('runs the CI scenarios: dispensing invariants, idle, empty, jam, reset, hold and burst', () => {
    expect(spec.scenarios?.map(scenario => scenario.id)).toEqual(['prime-and-dispense', 'idle', 'empty', 'jam', 'reset', 'hold-and-burst']);
  });
});
