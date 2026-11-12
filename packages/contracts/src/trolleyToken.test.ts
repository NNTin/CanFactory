import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { artifactFormat, AssemblySchema, RenderRequestSchema, scadDefines, TROLLEY_TOKEN_HINGE, trolleyToken as model, validateParameters } from './index.ts';

describe('jhappone trolley token and shopping-list holder', () => {
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

  it('keeps the hardware requirement visible and preserves the original author and licence', () => {
    expect(Value.Check(AssemblySchema, model.assembly)).toBe(true);
    expect(model.assembly.steps[0]?.parts).toEqual(['clip']);
    expect(model.printNotes).toContain('torsion spring');
    expect(model.printNotes).toContain('2.5 mm axle');
    expect(model.printNotes).toContain('1 mm pilot holes');
    expect(model.attribution).toContain('jhappone');
    expect(model.attributionLinks).toContainEqual({ text: 'Thingiverse', url: 'https://www.thingiverse.com/thing:4126950' });
    expect(model.licenseUrl).toBe('https://creativecommons.org/licenses/by/4.0/');
  });
});
