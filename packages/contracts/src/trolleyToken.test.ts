import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { artifactFormat, AssemblySchema, dimensionOf, findPart, ISO_273_CLEARANCE_HOLES, modelBom, motionFrames, RenderRequestSchema, resolveAssembly, scadDefines, TROLLEY_TOKEN_HARDWARE, TROLLEY_TOKEN_HINGE, TROLLEY_TOKEN_OPENING, trolleyToken as model, trolleyTokenSpringWind, validateParameters } from './index.ts';

/** A number a SCAD file assigns at the top level, e.g. `AXLE_X = 10.8125;`. */
const scadNumber = (file: string, name: string): number => {
  const source = readFileSync(new URL(`../../../models/trolley-token/${file}`, import.meta.url), 'utf8');
  const match = new RegExp(`^${name} = (-?[\\d.]+);`, 'm').exec(source);
  if (!match?.[1]) throw new Error(`${file} has no ${name}`);
  return Number(match[1]);
};

describe('jhappone trolley token and shopping-list holder, fitted for M2 hardware', () => {
  it('serves the fixed two-part source design and rejects settings from the discarded versions', () => {
    expect(artifactFormat(model)).toBe('zip');
    expect(model.parts.map(part => part.id)).toEqual(['body', 'clip']);
    expect(model.controls).toEqual([]);
    expect(validateParameters(model, {})).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: model.version, parameters: {} })).toBe(true);
    for (const parameters of [{ angle: 45 }, { clipAngle: 45 }, { coin: 'euro-1' }, { scale: 1 }, null, []]) {
      expect(validateParameters(model, parameters)).not.toEqual([]);
    }
    for (const modelVersion of ['1', '2']) {
      expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion, parameters: {} })).toBe(false);
    }
    for (const part of model.parts) expect(scadDefines(model, part, {})).toEqual([]);
  });

  it('keeps the measured clip axle coaxial with the body throughout opening and closing', () => {
    const poses = [model.assembly.poses['clip'], ...model.assembly.motion?.flatMap(movement => movement.frames.map(frame => frame['clip'])) ?? []];
    // STEP axle [25, 0, 4.5] becomes [-2.5, 0, 4] in the clip's flat print frame.
    for (const pose of poses) {
      if (!pose) throw new Error('Missing clip pose');
      const angle = (pose.rotation?.[1] ?? 0) * Math.PI / 180;
      const x = -2.5 * Math.cos(angle) - 4 * Math.sin(angle) + (pose.position[0] ?? NaN);
      const z = 2.5 * Math.sin(angle) - 4 * Math.cos(angle) + (pose.position[2] ?? NaN);
      expect(x).toBeCloseTo(TROLLEY_TOKEN_HINGE[0], 6);
      expect(z).toBeCloseTo(TROLLEY_TOKEN_HINGE[2], 6);
      expect(pose.position[1]).toBe(0);
    }
    expect(poses.at(-1)).toEqual(poses[0]);
  });

  it('fits the M2 × 16 screw, the M2 nut and the torsion spring that body.scad and clip.scad are sized for', () => {
    const screw = findPart(TROLLEY_TOKEN_HARDWARE.screw), nut = findPart(TROLLEY_TOKEN_HARDWARE.nut), spring = findPart(TROLLEY_TOKEN_HARDWARE.spring);
    if (!screw || !nut || !spring) throw new Error('The trolley token’s hardware is missing from the parts library.');
    // the SCAD files repeat the hardware's numbers
    for (const file of ['body.scad', 'clip.scad']) {
      expect(scadNumber(file, 'AXLE_X')).toBe(TROLLEY_TOKEN_HINGE[0]);
      expect(scadNumber(file, 'AXLE_Z')).toBe(TROLLEY_TOKEN_HINGE[2]);
      expect(scadNumber(file, 'EAR_Y')).toBe(TROLLEY_TOKEN_HARDWARE.earY);
      expect(scadNumber(file, 'HOLE_D')).toBe(ISO_273_CLEARANCE_HOLES.M2.medium);
      expect(scadNumber(file, 'WIRE_D')).toBe(dimensionOf(spring, 'd'));
      expect(scadNumber(file, 'COIL_R')).toBe((dimensionOf(spring, 'Di') + dimensionOf(spring, 'd')) / 2);
      expect(scadNumber(file, 'LEG_Y')).toBe((dimensionOf(spring, 'Lk') - dimensionOf(spring, 'd')) / 2);
    }
    expect(scadNumber('body.scad', 'SCREW_L')).toBe(dimensionOf(screw, 'l'));
    expect(scadNumber('body.scad', 'NUT_S')).toBe(dimensionOf(nut, 's', 'max'));
    expect(scadNumber('body.scad', 'NUT_M')).toBe(dimensionOf(nut, 'm', 'max'));
    expect(scadNumber('body.scad', 'BODY_LEG_ANGLE')).toBe(TROLLEY_TOKEN_HARDWARE.bodyLegAngle);
    expect(scadNumber('body.scad', 'BODY_LEG')).toBe(TROLLEY_TOKEN_HARDWARE.legs[0]);
    expect(scadNumber('clip.scad', 'CLIP_LEG_ANGLE')).toBe(TROLLEY_TOKEN_HARDWARE.clipLegAngle);
    expect(scadNumber('clip.scad', 'CLIP_LEG')).toBe(TROLLEY_TOKEN_HARDWARE.legs[1]);
    expect(TROLLEY_TOKEN_HARDWARE.coilLength).toBe(dimensionOf(spring, 'Lk'));
    expect(TROLLEY_TOKEN_HARDWARE.screwLength).toBe(dimensionOf(screw, 'l'));
    expect(TROLLEY_TOKEN_HARDWARE.nutHeight).toBe(dimensionOf(nut, 'm', 'max'));
    // 16 mm from the head's ear face reach through the whole nut, and stop inside the boss's face
    const tip = TROLLEY_TOKEN_HARDWARE.earY - dimensionOf(screw, 'l');
    expect(readFileSync(new URL('../../../models/trolley-token/body.scad', import.meta.url), 'utf8')).toContain('NUT_SEAT_Y = -(SCREW_L - EAR_Y - NUT_M);');
    const seat = -(dimensionOf(screw, 'l') - TROLLEY_TOKEN_HARDWARE.earY - dimensionOf(nut, 'm', 'max'));
    expect(seat - tip).toBeCloseTo(dimensionOf(nut, 'm', 'max'), 6);
    expect(-seat).toBeGreaterThan(TROLLEY_TOKEN_HARDWARE.earY - 1);
    expect(-tip).toBeLessThan(scadNumber('body.scad', 'BOSS_Y'));
    // the spring turns on the screw (its mandrel range takes M2) and stays within its largest angle when the pad is pressed
    expect(dimensionOf(screw, 'd')).toBeGreaterThanOrEqual(dimensionOf(spring, 'Dd', 'min'));
    expect(dimensionOf(screw, 'd')).toBeLessThanOrEqual(dimensionOf(spring, 'Dd', 'max'));
    expect(trolleyTokenSpringWind(0)).toBeGreaterThan(0);
    expect(trolleyTokenSpringWind(TROLLEY_TOKEN_OPENING)).toBeLessThan(0.8 * Number.parseFloat(spring.attributes['maxAngle'] ?? ''));
    expect(TROLLEY_TOKEN_HARDWARE.legs.every(length => length < dimensionOf(spring, 'Ls'))).toBe(true);
  });

  it('shows the hardware in the assembly, wound as the clip opens, and lists it as the parts to buy', () => {
    const assembly = resolveAssembly(model, model.assembly, {});
    if (!assembly) throw new Error('No assembly');
    expect(Value.Check(AssemblySchema, assembly)).toBe(true);
    expect(assembly.references?.map(reference => reference.part)).toEqual(['gutekunst-t-16102l', 'iso-4032-m2', 'iso-4762-m2x16']);
    expect(assembly.references?.find(reference => reference.id === 'spring')?.legs).toEqual(TROLLEY_TOKEN_HARDWARE.legs);
    // the spring goes in with the clip, then the nut, then the screw
    expect(assembly.steps.map(step => step.parts)).toEqual([['clip', 'spring'], ['nut'], ['screw']]);
    const [opening, closing] = motionFrames(assembly);
    expect(opening?.map(poses => poses['spring']?.wind)).toEqual(Array.from({ length: TROLLEY_TOKEN_OPENING + 1 }, (_, i) => trolleyTokenSpringWind(i)));
    expect(closing?.at(-1)?.['spring']).toEqual(assembly.poses['spring']);
    expect(modelBom(model, {})).toEqual([
      { partId: 'gutekunst-t-16102l', quantity: 1 }, { partId: 'iso-4032-m2', quantity: 1 }, { partId: 'iso-4762-m2x16', quantity: 1 },
    ]);
  });

  it('keeps the hardware requirement visible and preserves the original author and licence', () => {
    expect(Value.Check(AssemblySchema, model.assembly)).toBe(true);
    expect(model.assembly.steps[0]?.parts).toEqual(['clip']);
    expect(model.printNotes).toContain('torsion spring');
    expect(model.printNotes).toContain('M2 × 16');
    expect(model.printNotes).toContain('M2 hex nut');
    expect(model.printNotes).toContain('T-16102L');
    expect(model.printNotes).toContain('do not drill');
    expect(model.printNotes).not.toMatch(/2\.5 mm axle|pilot/);
    expect(model.derived().notes.join(' ')).toContain('no drilling');
    expect(model.attribution).toContain('jhappone');
    expect(model.attributionLinks).toContainEqual({ text: 'Thingiverse', url: 'https://www.thingiverse.com/thing:4126950' });
    expect(model.licenseUrl).toBe('https://creativecommons.org/licenses/by/4.0/');
  });
});
