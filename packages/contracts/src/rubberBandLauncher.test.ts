import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { artifactFormat, AssemblySchema, dimensionOf, modelBom, motionFrames, poseIds, RenderRequestSchema, RUBBER_BAND_LAUNCHER_PIVOT, RUBBER_BAND_LAUNCHER_PULL, RUBBER_BAND_LAUNCHER_REST, RUBBER_BAND_LAUNCHER_RETURN_BAND, RUBBER_BAND_LAUNCHER_SHOT_BAND, rubberBandLauncher as model, rubberBandLauncherReturnStretch, rubberBandLauncherTriggerPose, scadDefines, validateParameters } from './index.ts';

const assembly = model.assembly;
const triggerAngle = (pose: { rotation?: number[] } | undefined) => (pose?.rotation?.[1] ?? NaN) - 180;

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
    for (const modelVersion of ['1', '2', '3']) expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion, parameters: {} })).toBe(false);
    for (const parameters of [{ scale: 1 }, { bandLength: 60 }, null, []]) expect(validateParameters(model, parameters)).not.toEqual([]);
    // the download carries the return band's grooves (launcher.scad's default); only the verification turns them off
    for (const part of model.parts) expect(scadDefines(model, part, {})).toEqual([]);
  });

  it('rests the trigger back in the notch and pulls it through it to its stop, turning about its pins', () => {
    expect(Value.Check(AssemblySchema, assembly)).toBe(true);
    expect(RUBBER_BAND_LAUNCHER_REST).toBeLessThan(0);
    expect(RUBBER_BAND_LAUNCHER_PULL).toBeGreaterThan(0);
    expect(triggerAngle(assembly.poses['trigger'])).toBe(RUBBER_BAND_LAUNCHER_REST);
    const [pull, back] = motionFrames(assembly).slice(0, 2).map(frames => frames.slice(1).map(frame => triggerAngle(frame['trigger'])));
    expect(pull?.at(-1)).toBe(RUBBER_BAND_LAUNCHER_PULL);
    expect(back?.at(-1)).toBe(RUBBER_BAND_LAUNCHER_REST);
    // every trigger pose turns about the pins: the pivot (print coordinates, turned upright with the frame) stays put
    const pivot = [RUBBER_BAND_LAUNCHER_PIVOT[0], 54.813 - RUBBER_BAND_LAUNCHER_PIVOT[1]] as const;
    for (const angle of [RUBBER_BAND_LAUNCHER_REST, 0, RUBBER_BAND_LAUNCHER_PULL]) {
      const pose = rubberBandLauncherTriggerPose(angle), a = (pose.rotation?.[1] ?? NaN) * Math.PI / 180;
      expect(Math.cos(a) * pivot[0] + Math.sin(a) * pivot[1] + (pose.position[0] ?? NaN)).toBeCloseTo(-pivot[0], 9);
      expect(-Math.sin(a) * pivot[0] + Math.cos(a) * pivot[1] + (pose.position[2] ?? NaN)).toBeCloseTo(109.62 - pivot[1], 9);
    }
  });

  it('fires the shot band out of the notch as the trigger passes level with its lip, and the return band brings the trigger back', () => {
    const [pull, back] = motionFrames(assembly);
    const angles = pull?.slice(1).map(frame => triggerAngle(frame['trigger'])) ?? [];
    const shot = pull?.slice(1).map(frame => frame['shot-band']?.position) ?? [];
    // the band rides up on the trigger's top end until the trigger is level with the lip (0 degrees), then leaves forward and up
    const firing = angles.indexOf(0);
    expect(firing).toBeGreaterThan(0);
    for (let i = 1; i < firing; i++) expect(shot[i]?.[0] ?? NaN).toBeCloseTo(shot[i - 1]?.[0] ?? NaN, 6);
    for (let i = firing; i < shot.length; i++) {
      expect(shot[i]?.[0] ?? NaN).toBeGreaterThan(shot[i - 1]?.[0] ?? NaN);
      expect(shot[i]?.[2] ?? NaN).toBeGreaterThan(shot[i - 1]?.[2] ?? NaN);
    }
    // the return band stretches as the trigger is pulled (its top end lifts away from the grip) and stays taut at rest: a #18 round
    // the trigger's top end and the bottom of the grip, about 1.54× at rest and 1.64× pulled
    const stretches = [RUBBER_BAND_LAUNCHER_REST, ...angles].map(rubberBandLauncherReturnStretch);
    for (let i = 1; i < stretches.length; i++) expect(stretches[i] ?? NaN).toBeGreaterThan(stretches[i - 1] ?? NaN);
    expect(rubberBandLauncherReturnStretch(RUBBER_BAND_LAUNCHER_REST)).toBeCloseTo(1.54, 2);
    expect(rubberBandLauncherReturnStretch(RUBBER_BAND_LAUNCHER_PULL)).toBeCloseTo(1.64, 2);
    // its pose follows the trigger: stretched along itself as far as the trigger's groove has moved from the grip's
    const scales = [assembly.poses['return-band'], ...(pull?.slice(1) ?? []).map(frame => frame['return-band'])].map(pose => pose?.scale?.[0] ?? NaN);
    expect(scales[0]).toBe(1);
    for (let i = 1; i < scales.length; i++) expect(scales[i] ?? NaN).toBeGreaterThan(scales[i - 1] ?? NaN);
    // letting go moves the trigger and the return band; the shot band has gone
    expect(assembly.motion?.[1]?.frames.every(frame => Object.keys(frame).sort().join() === 'return-band,trigger')).toBe(true);
    expect(back).toHaveLength(angles.length + 1);
  });

  it('shows and lists both rubber bands, fitted and loaded before the shot', () => {
    expect(assembly.references?.map(reference => [reference.id, reference.part])).toEqual([['return-band', 'alliance-sterling-18'], ['shot-band', 'alliance-sterling-19']]);
    expect(modelBom(model, {})).toEqual([{ partId: 'alliance-sterling-18', quantity: 1 }, { partId: 'alliance-sterling-19', quantity: 1 }]);
    expect(assembly.steps.map(step => step.parts)).toEqual([['return-band'], ['shot-band']]);
    // a 1/16″ band fits the 2.2 mm groove in the barrel's tip
    expect(dimensionOf(RUBBER_BAND_LAUNCHER_SHOT_BAND, 'width')).toBeLessThan(2.2);
    // the return band's 1/16″ fits the 2.2 mm groove round the bottom of the grip (and the V on the trigger, 4.4 mm across its top)
    expect(dimensionOf(RUBBER_BAND_LAUNCHER_RETURN_BAND, 'width')).toBeLessThan(2.2);
    // hooked into the grip's groove and let down into the trigger's: its end in the grip's groove stays put while it is fitted
    const fit = assembly.steps[0], rest = assembly.poses['return-band'];
    const angle = (rest?.rotation?.[1] ?? NaN) * Math.PI / 180, along = [Math.cos(angle), -Math.sin(angle)] as const;
    const span = Math.max(...(assembly.references?.[0]?.loop ?? []).map(([x = 0]) => x));
    // the far end moves by the step's offset plus the extra stretch along the band (local x, upright (cos, 0, -sin) of the turn about Y)
    const moved = [0, 2].map((axis, i) => (fit?.from[axis] ?? NaN) + ((fit?.scaleFrom?.[0] ?? NaN) - 1) * span * (along[i] ?? NaN));
    for (const value of moved) expect(Math.abs(value)).toBeLessThan(0.1);
  });

  it('credits FerryTeacher, keeps the NonCommercial and ShareAlike terms and explains both bands', () => {
    expect(model.attribution).toContain('FerryTeacher');
    expect(model.license).toBe('CC BY-NC-SA');
    expect(model.licenseUrl).toBe('https://creativecommons.org/licenses/by-nc-sa/4.0/');
    expect(model.attributionLinks).toContainEqual({ text: 'Cults3D', url: 'https://cults3d.com/en/3d-model/game/rubber-band-launcher' });
    expect(model.attributionLinks).toContainEqual({ text: 'FerryTeacher', url: 'https://cults3d.com/en/users/FerryTeacher' });
    for (const phrase of ['One print, in place', 'cannot be put in afterwards', 'return band', 'shot band', '#19', '#18', 'groove', 'Non-commercial', 'same licence'])
      expect(model.printNotes).toContain(phrase);
    expect(`CanFactory | ${model.license} | ${model.attribution}`.length).toBeLessThanOrEqual(80);
  });
});
