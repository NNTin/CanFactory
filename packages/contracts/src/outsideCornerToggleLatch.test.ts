import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { AssemblySchema, CORNER_LATCH_SCREWS, DEFAULT_CORNER_LATCH, LATCH_WOOD_SCREWS, RenderRequestSchema, artifactFormat, cornerLatchLayout, findModel, findPart, modelSourcePaths, motionFrames, outsideCornerToggleLatch as model, partUsage, resolveAssembly, scadDefines, toggleLatch, toggleLatchAssembly, validateParameters } from './index.ts';
import * as M from './toggleLatchMechanism.ts';

const source = (part: string) => readFileSync(new URL(`../../../models/outside-corner-toggle-latch/${part}.scad`, import.meta.url), 'utf8');
const profile = (part: string, name: string): unknown => JSON.parse(source(part).match(new RegExp(`${name} = (\\[[\\s\\S]*?\\]);`))?.[1] ?? 'null');
const defaults = { ...DEFAULT_CORNER_LATCH };
const part = (id: string) => { const p = findPart(id); if (!p) throw new Error(id); return p; };

describe('outside-corner toggle latch', () => {
  it('is an independent four-part catalogue model with a strict render request and the original moving parts', () => {
    expect(findModel(model.id)).toBe(model);
    expect(model.defaults).toEqual(defaults);
    expect(validateParameters(model, defaults)).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: '1', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: '1', parameters: { ...defaults, screwKind: 'machine' } })).toBe(false);
    expect(artifactFormat(model)).toBe('zip');
    expect(model.parts.map(p => p.id)).toEqual(['base', 'lever', 'link', 'catch']);
    expect(modelSourcePaths(model)).toEqual(['models/outside-corner-toggle-latch/base.scad', 'models/toggle-latch/reference/Latch 12mm 3.scad', 'models/toggle-latch/reference/Latch 12mm 4.scad', 'models/outside-corner-toggle-latch/catch.scad']);
    expect(toggleLatch.defaults['woodScrew']).toBe('din-7997-4x25');
    expect(toggleLatch.assembly).toEqual(toggleLatchAssembly());
    expect(model.license).toBe(toggleLatch.license);
  });

  it('keeps the real joints, hook profiles and five over-centre movements, raised above the long catch flange', () => {
    expect(profile('base', 'BASE_KNUCKLE')).toEqual(M.TOGGLE_LATCH_PROFILES.baseKnuckle);
    expect(profile('catch', 'CATCH_HOOK')).toEqual(M.TOGGLE_LATCH_PROFILES.catchHook);
    const originalCatch = readFileSync(new URL('../../../models/toggle-latch/catch.scad', import.meta.url), 'utf8');
    expect(source('catch').match(/CATCH_HOOK_END = (\[[\s\S]*?\]);/)?.[1]).toBe(originalCatch.match(/CATCH_HOOK_END = (\[[\s\S]*?\]);/)?.[1]);
    for (const plankThickness of [10, 18, 40]) {
      const p = { ...defaults, plankThickness }, a = resolveAssembly(model, model.assembly, p);
      if (!a) throw new Error('Missing assembly');
      expect(Value.Check(AssemblySchema, a)).toBe(true);
      expect(a.motion?.map(m => m.title)).toEqual(M.TOGGLE_LATCH_MOVEMENTS.map(m => m.title));
      const { legLength } = cornerLatchLayout(p);
      const frames = [a.poses, ...motionFrames(a).flat()], originals = [toggleLatch.assembly.poses, ...motionFrames(toggleLatch.assembly).flat()];
      frames.forEach((frame, i) => Object.entries(frame).forEach(([id, pose]) => {
        const original = originals[i]?.[id]; expect(original).toBeDefined();
        expect(pose.rotation).toEqual(original?.rotation);
        expect(pose.position).toEqual(original?.position.map((v, axis) => axis === 2 ? v + legLength : v));
      }));
    }
  });

  it('moves the screws beyond the butt joint and sizes both perpendicular seats from the same library screw', () => {
    expect(cornerLatchLayout(defaults)).toMatchObject({ holeAt: 36, legLength: 44, bite: 16, catchFromCorner: 36 });
    expect(cornerLatchLayout(defaults).baseFromCorner).toBeCloseTo(37.311, 3);
    for (const part of model.parts.filter(p => ['base', 'catch'].includes(p.id))) {
      const defines = Object.fromEntries(scadDefines(model, part, defaults));
      expect(defines).toMatchObject({ PLANK_T: '18', EDGE_DISTANCE: '18', WOOD_HOLES: '[4.3,4.5,4.8]', WOOD_D: '4', WOOD_DK: '7.5', WOOD_K: '2.2', HOLE_FIT: '"medium"' });
    }
    // In local SCAD frames: the base screw runs along +y; the catch along -z. The assembled faces are perpendicular.
    expect(source('base')).toContain('translate([x, PLATE_FRONT, HOLE_AT]) rotate([-90, 0, 0]) wood_hole()');
    expect(source('catch')).toContain('translate([x, PLATE_BACK + HOLE_AT, 4]) rotate([180, 0, 0]) wood_hole()');
    const screw = part(defaults.woodScrew);
    expect(partUsage(screw).filter(u => u.modelId === model.id).map(u => u.via)).toContain('Wood screw');
  });

  it('offers only screw sizes that can fit the feet and some supported plank thickness, and validates penetration and setback', () => {
    expect(CORNER_LATCH_SCREWS).toEqual(LATCH_WOOD_SCREWS.filter(id => (part(id).dimensions['l']?.value ?? Infinity) <= 42));
    for (const woodScrew of CORNER_LATCH_SCREWS) {
      const screw = part(woodScrew);
      expect(validateParameters(model, { ...defaults, plankThickness: 40, woodScrew, woodScrewDiameter: screw.attributes['diameter'] })).toEqual([]);
    }
    expect(validateParameters(model, { ...defaults, woodScrew: 'din-7997-4x25' })).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'woodScrew' })]));
    expect(validateParameters(model, { ...defaults, plankThickness: 17.5 })).not.toEqual([]);
    expect(validateParameters(model, { ...defaults, woodScrewDiameter: '3 mm', woodScrew: 'din-7997-3x12', plankThickness: 10, edgeDistance: 12 })).toEqual([]);
    expect(validateParameters(model, { ...defaults, plankThickness: 40, woodScrewDiameter: '5 mm', woodScrew: 'din-7997-5x30', edgeDistance: 12 })).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'edgeDistance' })]));
    expect(validateParameters(model, { ...defaults, woodScrewDiameter: '3 mm' })).not.toEqual([]);
    for (const override of [{ plankThickness: NaN }, { plankThickness: 41 }, { edgeDistance: 31 }, { highTolerance: 1 }]) expect(validateParameters(model, { ...defaults, ...override })).not.toEqual([]);
  });
});
