import { readFileSync } from 'node:fs';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import {
  BAND_MODULUS, BOTTLE_NECKS, DEFAULT_TREAT_DISPENSER, PhysicsSpecSchema, TREAT_BAND_SIZES, partsOfFamily, treatBandPose, treatBandTorque, TIP_ANGLE, TREAT_DISPENSER, TREAT_FASTENERS, TREAT_FIRMWARE, TREAT_PRINTED_PARTS, dimensionOf, findModel, findPart,
  posePoint, treatBayLayout, treatPartPoses, treatBoltPoses, treatBolts, treatCycleSeconds, treatCycleSteps, treatDispenserAssembly, treatDispenserIssues, treatDispenserLayout,
  treatDispenserPhysics, treatFeet, treatFill, treatFootprint, treatRotorPieces, treatScadValues, treatVertices, treatWiringRoom, validateParameters, type TreatDispenserParameters,
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

  it('keeps the thread’s grooves apart at every thread clearance: the cutter’s turns never overlap, so a bottle still catches', () => {
    // thread_cutter's widths in the generator: the bottle's ridge (base and crest, fractions of the pitch) grown by the clearance
    const scad = readFileSync(new URL('../../../models/treat-dispenser/generator.scad', import.meta.url), 'utf8');
    const grown = /base = NECK_PITCH \* ([\d.]+) \+ 2 \* THREAD_CLEARANCE/.exec(scad);
    if (!grown) throw new Error('thread_cutter’s ridge base was not found in the generator.');
    const model = findModel('treat-dispenser');
    if (!model) throw new Error('The treat dispenser is not registered.');
    const maximum = 0.5;
    expect(validateParameters(model, { ...p, threadClearance: maximum })).toEqual([]);
    expect(validateParameters(model, { ...p, threadClearance: maximum + 0.05 })).not.toEqual([]);
    for (const neck of Object.values(BOTTLE_NECKS)) expect(neck.pitch * (1 - Number(grown[1])) - 2 * maximum, neck.title).toBeGreaterThan(0.05);
  });

  it('sizes one pocket for a treat lying along it, down to the axis (the shaft pokes in), under a slot as long as the pocket', () => {
    expect(TREAT_DISPENSER.pockets).toBe(1);
    expect(l.pocket.length).toBeCloseTo(p.treatLength + 2 * p.pocketClearance, 9);
    expect(l.pocket.width).toBeCloseTo(p.treatWidth + 2 * p.pocketClearance, 9);
    expect(l.pocket.depth).toBe(l.R);
    expect(2 * l.slot.halfX).toBeCloseTo(l.pocket.length, 9);
    // a treat lying flat or on edge stays below the rotor's surface (one leaning across it may stand out a little: the trailing face
    // lifts it, see below)
    expect(p.treatWidth + p.pocketClearance).toBeLessThan(l.pocket.depth);
  });

  it('closes the slot’s back edge with a rigid, counterweighted flap on the rotor, a cavity deeper than a treat is long behind it', () => {
    const F = TREAT_DISPENSER.flap;
    // at rest the slot's walls stand clear of the pocket's mouth, which is centred on the top
    expect(l.bore.radius * Math.sin(l.pocket.mouth * Math.PI / 180)).toBeLessThan(l.slot.halfY);
    expect(l.pocket.turn).toBeGreaterThan(0);
    expect(TREAT_DISPENSER.dropFront).toBeGreaterThan(l.pocket.mouth);
    expect(l.cavityR - l.R).toBeGreaterThan(p.treatLength);
    // the hinge stands higher over the rotor than a treat standing on end on it; the tip rests on the rotor, behind the hinge, so that
    // the flap's weight turns it onto the rotor (a treat pushes it back and up)
    expect(l.flap.hinge.z - (l.axisZ + l.R)).toBeGreaterThan(p.treatLength);
    expect(Math.hypot(l.flap.tip.y, l.flap.tip.z - l.axisZ)).toBeCloseTo(l.R, 9);
    expect(l.flap.tip.y).toBeGreaterThan(l.flap.hinge.y);
    // its counterweight holds it shut with about the closing torque of the old TPU flap's preload (0.3 N·mm, which the trials with a
    // plain hanging plate, about 0.01 N·mm, showed it needs), and swings up its whole travel behind the slot's back wall (a wall between)
    expect(l.flap.closing).toBeGreaterThan(0.25);
    // (the counterweight's top is flush with the hub's: its leading top corner swings nearest the wall)
    const [wy] = F.weight, a = F.swing * Math.PI / 180;
    expect(l.flap.hinge.y + (F.reach - wy / 2) * Math.cos(a) - F.hub * Math.sin(a) - 0.5 - (l.slot.halfY + TREAT_DISPENSER.wall)).toBeGreaterThan(0);
    expect(l.blockTop - l.flap.hinge.z).toBeGreaterThan(l.flap.sweepTop + TREAT_DISPENSER.wall - 1e-9);
    // the snap: the hub's hole turns freely on a boss, its mouth narrower than a boss (it holds), each boss reaches into the hub
    expect(F.hole).toBeGreaterThan(F.boss);
    expect(F.mouth).toBeLessThan(2 * F.boss);
    expect(F.bossLength).toBeGreaterThan((2 * l.slot.halfX - l.flap.width) / 2);
    expect(F.hub - F.hole).toBeGreaterThanOrEqual(1.2);
  });

  it('seals the optional flap magnets in at a print pause each, the inner body’s clear of the counterweight’s swing, repelling so as to close the flap', () => {
    const F = TREAT_DISPENSER.flap, M = F.magnet, m = l.magnets, { hinge } = l.flap;
    const magnet = findPart(M.part);
    if (!magnet) throw new Error('No flap magnet in the library.');
    // cavities from the library part's greatest size, play round it and headroom over it; the pauses on layer boundaries
    expect(2 * m.radius).toBeCloseTo(dimensionOf(magnet, 'diameter', 'max') + 2 * M.play, 9);
    for (const cavity of [m.flap, m.body]) {
      expect(cavity.z1 - cavity.z0).toBeGreaterThanOrEqual(m.thickness + M.headroom - 1e-9);
      expect(Math.abs(cavity.pause / M.layer - Math.round(cavity.pause / M.layer))).toBeLessThan(1e-6);
    }
    // the flap's under the counterweight's top face (its skin on the bed), within the counterweight's length
    expect(hinge.z + F.hub - m.flap.z1).toBeCloseTo(M.skin, 6);
    expect(m.flap.y - m.radius).toBeGreaterThan(hinge.y + F.reach - F.weight[0] / 2);
    expect(m.flap.y + m.radius).toBeLessThan(hinge.y + F.reach + F.weight[0] / 2);
    // the inner body's under the block's top and behind the slot, a skin from each; outside the room the counterweight sweeps
    expect(l.blockTop - m.body.z1).toBeGreaterThanOrEqual(M.skin - 1e-9);
    expect(m.body.y - m.radius - (l.slot.halfY + M.skin)).toBeGreaterThan(0);
    // and a skin over the rubber band's way across under it
    if (m.body.y + m.radius > l.band.slot.y0 && m.body.y - m.radius < l.band.slot.y1) expect(m.body.z0 - l.band.slot.z1).toBeGreaterThanOrEqual(M.skin - 1e-9);
    const [wy, wz] = F.weight;
    const inSweep = (y: number, z: number) => Array.from({ length: F.swing + 1 }, (_, a) => a * Math.PI / 180).some(a => {
      const dy = y - hinge.y, dz = z - hinge.z, ry = dy * Math.cos(a) + dz * Math.sin(a), rz = -dy * Math.sin(a) + dz * Math.cos(a);
      return ry > F.reach - wy / 2 - 0.5 - M.skin && ry < F.reach + wy / 2 + 0.5 + M.skin && rz > F.hub - wz - 0.5 - M.skin && rz < F.hub + 0.5 + M.skin;
    });
    for (let dy = -m.radius; dy <= m.radius; dy += 0.5) for (const z of [m.body.z0, m.body.z1]) expect(inSweep(m.body.y + dy, z)).toBe(false);
    // in the physics only when fitted: two dipoles, opposed (they repel), the inner body's above the flap's
    expect(treatDispenserPhysics(p).magnets ?? []).toEqual([]);
    const magnets = treatDispenserPhysics({ ...p, flapMagnets: true }).magnets ?? [];
    expect(magnets.map(item => item.body)).toEqual(['flap', 'inner-body']);
    // the flap's magnet, a reference object in the assembly, rides on the flap in the simulation
    const withMagnets = treatDispenserPhysics({ ...p, flapMagnets: true });
    expect(withMagnets.attached).toEqual({ 'flap-magnet': 'flap' });
    expect(withMagnets.bodies.some(body => body.id === 'flap')).toBe(true);
    expect(treatDispenserAssembly({ ...p, flapMagnets: true }).references?.some(reference => reference.id === 'flap-magnet')).toBe(true);
    expect(treatDispenserPhysics(p).attached).toBeUndefined();
    const poses = treatPartPoses(l), world = (body: string, v: number[]) => posePoint({ position: [0, 0, 0], rotation: (body === 'flap' ? poses.flap : poses['inner-body']).rotation }, v);
    const [up, down] = magnets.map(item => world(item.body, item.moment));
    expect(up?.[2]).toBeGreaterThan(0); expect(down?.[2]).toBeLessThan(0);
    expect(m.body.centre).toBeGreaterThan(m.flap.centre);
    // two flat magnets side by side repel only while the line between them stays within 54.7° of their axes (beyond it the same faces
    // attract): over the whole swing it stays within 45°, so that neither a little placement error nor the flap's turn flips it
    for (let deg = 0; deg <= F.swing; deg++) {
      const a = deg * Math.PI / 180, dy = m.flap.y - hinge.y, dz = m.flap.centre - hinge.z;
      const ry = hinge.y + dy * Math.cos(a) - dz * Math.sin(a) - m.body.y, rz = hinge.z + dy * Math.sin(a) + dz * Math.cos(a) - m.body.centre;
      // (from the inner body's axis, which points down; the flap's axis is turned by the swing, so take the larger of the two)
      const offBody = Math.acos(-rz / Math.hypot(ry, rz)) * 180 / Math.PI, offFlap = Math.abs(offBody - deg);
      expect(Math.max(offBody, offFlap), `${deg}°`).toBeLessThan(45);
    }
    // their closing torque about the hinge (softened point dipoles, as the engine takes them: each softened by its radius, the pair's
    // lengths in quadrature): closing at rest and as the flap opens
    const MU = 4e-7 * Math.PI, moment = Math.hypot(...(up ?? [])), soft = Math.SQRT2 * (dimensionOf(magnet, 'diameter') / 2) * 1e-3;
    const energy = (deg: number) => {
      const a = deg * Math.PI / 180, dy = m.flap.y - hinge.y, dz = m.flap.centre - hinge.z;
      const py = hinge.y + dy * Math.cos(a) - dz * Math.sin(a), pz = hinge.z + dy * Math.sin(a) + dz * Math.cos(a);
      const ry = (py - m.body.y) * 1e-3, rz = (pz - m.body.centre) * 1e-3, d2 = ry ** 2 + rz ** 2 + soft ** 2, d = Math.sqrt(d2);
      // the inner body's moment points down (0, −moment): its field at the flap's magnet, and the flap's moment turned with the flap
      const dot = -moment * rz / d, k = MU / (4 * Math.PI) / (d2 * d);
      const by = k * 3 * ry / d * dot, bz = k * (3 * rz / d * dot + moment);
      return -(-Math.sin(a) * moment * by + Math.cos(a) * moment * bz);
    };
    // (N·mm: the energy rising as the flap opens is a torque closing it)
    const closing = (deg: number) => (energy(deg + 0.01) - energy(deg - 0.01)) / (0.02 * Math.PI / 180) * 1000;
    for (let deg = 0; deg <= F.swing; deg += 5) expect(closing(deg), `${deg}°`).toBeGreaterThan(0);
    // (at the 55° stop the magnets must sit high and far back to stay repelling over the whole swing: they add little at rest)
    expect(closing(0)).toBeGreaterThan(0.05);
    expect(closing(0.75 * F.swing)).toBeGreaterThan(2 * closing(0));
  });

  it('offers the rubber bands that are taut at rest in some notch and not too firm at the stop, firmer the further out', () => {
    // Gent's relation at Sterling's 42 Shore A
    expect(BAND_MODULUS).toBeCloseTo(1.82, 2);
    const B = TREAT_DISPENSER.band, notches = B.notches.map((_, k) => k + 1);
    const torques = (flapBand: TreatDispenserParameters['flapBand'], flapBandNotch: number) => treatBandTorque(l, { flapBand, flapBandNotch }, [0, l.flap.swing]).map(torque => -torque);
    const usable = (size: string) => notches.some(notch => {
      const [rest = 0, stop = 0] = torques(size as TreatDispenserParameters['flapBand'], notch);
      return rest > 0 && stop <= B.maxStop;
    });
    const sizes = partsOfFamily('rubber-band').map(part => part.id.replace('alliance-sterling-', ''));
    expect([...TREAT_BAND_SIZES]).toEqual(sizes.filter(usable));
    expect(torques('none', 3).map(Math.abs)).toEqual([0, 0]);
    for (const size of TREAT_BAND_SIZES) {
      // each closes the flap, the more the further it opens and (at rest) the further out it is hooked
      const angles = Array.from({ length: l.flap.swing / 5 + 1 }, (_, k) => 5 * k);
      for (const notch of notches) {
        const curve = treatBandTorque(l, { flapBand: size, flapBandNotch: notch }, angles).map(torque => -torque);
        curve.forEach((torque, k) => { expect(torque).toBeGreaterThanOrEqual(k > 0 ? (curve[k - 1] ?? 0) : 0); });
        // (at rest: a short band stretched far flattens its strands, so that at the stop a notch further out can be a little softer)
        if (notch > 1) expect(curve[0]).toBeGreaterThanOrEqual(-(treatBandTorque(l, { flapBand: size, flapBandNotch: notch - 1 }, [0])[0] ?? 0));
      }
      // the issues say which settings hang slack or hold too firmly
      for (const notch of notches) {
        const [rest = 0, stop = 0] = torques(size, notch);
        expect(treatDispenserIssues({ ...p, flapBand: size, flapBandNotch: notch }).length > 0).toBe(rest <= 0 || stop > B.maxStop);
      }
    }
  });

  it('gives the band its way across behind the hinge, clear of the bosses, and grooved pegs inside the outer body', () => {
    const B = TREAT_DISPENSER.band, F = TREAT_DISPENSER.flap, { hinge } = l.flap, band = l.band;
    expect(band.y - hinge.y).toBeCloseTo(B.lever, 9);
    // the slots: behind the bosses (and the hub's teardrop peak over them), round the band's plane
    expect(band.slot.y0).toBeGreaterThan(hinge.y + F.boss + 0.5);
    expect(band.slot.y1 - band.slot.y0).toBeCloseTo(B.slot, 9);
    // from below the grooves' openings to over the highest the widest band lies on the flap
    expect(band.slot.z0).toBeLessThan(band.z - B.grooveOpen);
    for (let a = -5; a <= l.flap.swing; a += 5) expect(band.slot.z1).toBeGreaterThanOrEqual(hinge.z + (band.over(a)?.z ?? 0) + band.widest);
    // it lies on the flap's top over the whole swing, `line` above the grooves at rest
    for (let a = -5; a <= l.flap.swing; a += 5) expect(band.over(a)).toBeDefined();
    expect(hinge.z + (band.over(0)?.z ?? 0) - band.z).toBeCloseTo(B.line, 9);
    // the grooves round the line, under the pegs' tops; the outermost peg and its ledge inside the outer body's wall
    expect(band.pegTop).toBeGreaterThan(band.z + B.grooveOpen);
    expect(band.ledge.top).toBeLessThan(band.z - B.grooveOpen);
    expect(band.ledge.x1).toBeLessThan(l.halfWidth - TREAT_DISPENSER.shell - TREAT_DISPENSER.gap);
    expect(band.ledge.x0).toBeCloseTo(l.block.halfX, 9);
  });

  it('puts the band on the flap’s hinge in the simulation and in the assembly only when fitted', () => {
    const fitted = { ...p, flapBand: '14', flapBandNotch: 3 } as const;
    const joint = treatDispenserPhysics(fitted).bodies.find(body => body.id === 'flap')?.joint;
    expect(joint?.load?.at[0]).toBe(-5);
    expect(joint?.load?.at.at(-1)).toBe(l.flap.swing);
    expect(joint?.load?.values).toEqual(treatBandTorque(l, fitted, joint?.load?.at ?? []));
    expect(Value.Check(PhysicsSpecSchema, treatDispenserPhysics(fitted))).toBe(true);
    expect(treatDispenserPhysics(p).bodies.find(body => body.id === 'flap')?.joint?.load).toBeUndefined();
    const assembly = treatDispenserAssembly(fitted);
    expect(assembly.references?.find(reference => reference.id === 'band')?.part).toBe('alliance-sterling-14');
    expect(assembly.steps.some(step => step.parts.includes('band'))).toBe(true);
    // drawn over the pegs, reaching the outer faces of its notch's
    const pose = treatBandPose(l, fitted)?.pose, part = findPart('alliance-sterling-14');
    if (!pose || !part) throw new Error('No band pose.');
    expect(pose.position[2]).toBeGreaterThan(l.band.pegTop);
    expect(pose.scale[0] * (dimensionOf(part, 'length') / Math.PI - dimensionOf(part, 'thickness'))).toBeCloseTo(l.band.pegOut(2), 9);
    expect(treatDispenserAssembly(p).references?.some(reference => reference.id === 'band')).toBe(false);
  });

  it('keeps the rotor more than a treat’s length above the chute where its pockets drop, so that none can be caught between them', () => {
    for (const y of [-l.slot.halfY, 0, l.slot.halfY]) expect(l.axisZ - l.R - l.chuteAt(y)).toBeGreaterThanOrEqual(TREAT_DISPENSER.dropClear - 1e-9);
    expect(TREAT_DISPENSER.dropClear).toBeGreaterThan(p.treatLength);
    // and the chute steep enough for a treat to slide (friction 0.4: 21.8°)
    expect(Math.tan(TREAT_DISPENSER.chuteSlope * Math.PI / 180)).toBeGreaterThan(0.4);
  });

  it('gives the rotor its pocket as pieces within its cylinder', () => {
    const pieces = treatRotorPieces(l);
    expect(pieces.length).toBe(5);
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

  it('screws nothing into the inner body’s feet: they stand in the base plate’s rims, and the outer body’s top bears on its collar', () => {
    expect(treatBolts(p).filter(bolt => bolt.nutIn === 'inner-body' && bolt.axis[2] === 1)).toEqual([]);
    expect(treatFeet(l)).toHaveLength(4);
    const values = Object.fromEntries(treatScadValues(p));
    expect(values['COLLAR']).toEqual([TREAT_DISPENSER.collar, TREAT_DISPENSER.collarDepth]);
    expect(values['RIM']).toEqual([TREAT_DISPENSER.rim, TREAT_DISPENSER.rimHeight]);
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
    expect(bolts).toHaveLength(12);
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
      const length = dimensionOf(findPart(bolt.screw) ?? findPart(TREAT_FASTENERS.nut) ?? (() => { throw new Error('Missing the nut.'); })(), 'l');
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
    // the flap: free on its hinge (no spring), held on the rotor by its counterweight; its mass and inertia come from its mesh, so that
    // the counterweight's moment is the printed part's
    const flap = spec.bodies.find(body => body.id === 'flap');
    expect(flap?.joint?.type).toBe('hinge');
    expect(flap?.joint?.spring).toBeUndefined();
    expect(flap?.mass).toBeUndefined();
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
