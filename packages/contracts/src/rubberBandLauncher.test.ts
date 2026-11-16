import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { artifactFormat, AssemblySchema, poseIds, RenderRequestSchema, RUBBER_BAND_LAUNCHER_PIVOT, RUBBER_BAND_LAUNCHER_PULL, rubberBandLauncher as model, scadDefines, validateParameters } from './index.ts';

describe('FerryTeacher rubber band launcher', () => {
  it('serves the print-in-place pair as one print of two bodies, with no settings', () => {
    expect(artifactFormat(model)).toBe('zip');
    // one printable file: the trigger is printed on its pins inside the frame and cannot be fitted afterwards
    expect(model.parts.map(part => [part.id, part.sourcePath])).toEqual([['launcher', 'models/rubber-band-launcher/launcher.scad']]);
    expect(model.parts[0]?.bodies.map(body => body.id)).toEqual(['frame', 'trigger']);
    expect(poseIds(model.parts)).toEqual(['frame', 'trigger']);
    expect(model.controls).toEqual([]);
    expect(validateParameters(model, {})).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: model.version, parameters: {} })).toBe(true);
    for (const parameters of [{ scale: 1 }, { bandLength: 60 }, null, []]) expect(validateParameters(model, parameters)).not.toEqual([]);
    for (const part of model.parts) expect(scadDefines(model, part, {})).toEqual([]);
  });

  it('shows the bodies as printed, frees the trigger in place and turns it about its pivot pins', () => {
    expect(Value.Check(AssemblySchema, model.assembly)).toBe(true);
    expect(model.assembly.poses).toEqual({ frame: { position: [0, 0, 0] }, trigger: { position: [0, 0, 0], rotation: [0, 0, 0] } });
    // nothing is lifted, laid out or put together: the one step (freeing the trigger) does not move it against the frame
    expect(model.assembly.lift).toBe(0);
    expect(model.assembly.steps.map(step => [step.title.split(':')[0], step.parts, step.from])).toEqual([['Free the trigger', ['trigger'], [0, 0, 0]]]);
    expect(model.assembly.motion?.flatMap(movement => movement.frames.flatMap(frame => Object.keys(frame)))).not.toContain('frame');
    const frames = model.assembly.motion?.flatMap(movement => movement.frames.map(frame => frame['trigger'])) ?? [];
    expect(frames).toHaveLength(12);
    const [px, , pz] = RUBBER_BAND_LAUNCHER_PIVOT;
    for (const pose of frames) {
      if (!pose) throw new Error('Missing trigger pose');
      // The pivot maps onto itself: rotate it about Y by the pose's angle, then translate.
      const a = (pose.rotation?.[1] ?? NaN) * Math.PI / 180;
      expect(Math.cos(a) * px + Math.sin(a) * pz + (pose.position[0] ?? NaN)).toBeCloseTo(px, 9);
      expect(-Math.sin(a) * px + Math.cos(a) * pz + (pose.position[2] ?? NaN)).toBeCloseTo(pz, 9);
      expect(pose.position[1]).toBe(0);
    }
    expect(Math.max(...frames.map(pose => pose?.rotation?.[1] ?? 0))).toBe(RUBBER_BAND_LAUNCHER_PULL);
    expect(frames.at(-1)?.rotation?.[1]).toBe(0);
  });

  it('credits FerryTeacher and keeps the NonCommercial and ShareAlike terms visible', () => {
    expect(model.attribution).toContain('FerryTeacher');
    expect(model.license).toBe('CC BY-NC-SA');
    expect(model.licenseUrl).toBe('https://creativecommons.org/licenses/by-nc-sa/4.0/');
    expect(model.attributionLinks).toContainEqual({ text: 'Cults3D', url: 'https://cults3d.com/en/3d-model/game/rubber-band-launcher' });
    expect(model.attributionLinks).toContainEqual({ text: 'FerryTeacher', url: 'https://cults3d.com/en/users/FerryTeacher' });
    expect(model.printNotes).toContain('One print, in place');
    expect(model.printNotes).toContain('cannot be put in afterwards');
    expect(model.printNotes).toContain('Non-commercial');
    expect(model.printNotes).toContain('same licence');
    expect(`CanFactory | ${model.license} | ${model.attribution}`.length).toBeLessThanOrEqual(80);
  });
});
