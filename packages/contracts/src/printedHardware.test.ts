import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import {
  artifactFormat, findModel, linkedPartData, modelSourcePaths, partUsage, printedCornerBracket, printedScreenHook, scadDefines, validateParameters,
  type ModelDefinition, type ParameterValues,
} from './models.ts';
import { resolveAssembly } from './assembly.ts';
import { modelUsage, windowInsertConcept } from './concepts.ts';
import { RenderRequestSchema } from './index.ts';
import { dimensionOf, findPart, parts } from './parts/index.ts';
import { PRINTED_CORNER_BRACKET_DEFAULT, printedCornerBracketFor, printedCornerBracketHoles, WINDOW_INSERT_MEMBER } from './printedCornerBracket.ts';
import { PRINTED_BARB_MIN, PRINTED_HOOK_GUSSET, PRINTED_SCREEN_HOOK_DEFAULT, printedScreenHookShape, SCREEN_HOOK_FIT, type PrintedScreenHookSize } from './printedScreenHook.ts';
import { clearanceHoles, PRINTED_SCREW_SEAT, PRINTED_WOOD_DIAMETERS, PRINTED_WOOD_SCREWS, WOOD_SCREW_PLAY } from './screwHoles.ts';

const part = (id: string) => findPart(id) ?? (() => { throw new Error(`Missing ${id}`); })();
const source = (id: string) => readFileSync(new URL(`../../../models/${id}/generator.scad`, import.meta.url), 'utf8');
const escape = (literal: string) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fields = (model: ModelDefinition, parameters: ParameterValues) => validateParameters(model, parameters).map(issue => issue.field);

describe('printed hardware screws', () => {
  it('offers every DIN 7997 wood screw of the library, by diameter, with DIN EN 20273’s allowances over its diameter', () => {
    expect([...PRINTED_WOOD_SCREWS]).toEqual(parts.filter(p => p.family === 'wood-screw' && p.attributes['standard'] === 'DIN 7997').map(p => p.id));
    expect([...PRINTED_WOOD_DIAMETERS]).toEqual([...new Set(PRINTED_WOOD_SCREWS.map(id => part(id).attributes['diameter']))]);
    expect(clearanceHoles(part('din-7997-4x35'))).toEqual([4.3, 4.5, 4.8]);
    expect(clearanceHoles(part('din-7997-3x20'))).toEqual([3 + WOOD_SCREW_PLAY.fine, 3 + WOOD_SCREW_PLAY.medium, 3 + WOOD_SCREW_PLAY.coarse]);
  });
});

describe('printed corner bracket contract', () => {
  const defaults = printedCornerBracket.defaults;

  it('is a registered one-part assembly, its defaults following the window insert collar’s member', () => {
    expect(findModel('printed-corner-bracket')).toBe(printedCornerBracket);
    expect(artifactFormat(printedCornerBracket)).toBe('zip');
    expect(modelSourcePaths(printedCornerBracket)).toEqual(['models/printed-corner-bracket/generator.scad']);
    expect(printedCornerBracket.license).toBe('CC BY 4.0');
    expect(WINDOW_INSERT_MEMBER).toBe(40);
    // legs of 2.5 members, half a member wide, three holes on each leg past the joint
    expect(printedCornerBracketFor(40)).toEqual({ legA: 100, legB: 100, width: 20, thickness: 5, holesPerLeg: 3, holeSpacing: 20, firstHole: 50 });
    expect(defaults).toEqual({ ...PRINTED_CORNER_BRACKET_DEFAULT, woodScrewDiameter: '4 mm', woodScrew: 'din-7997-4x35', holeFit: 'medium' });
    expect(printedCornerBracketHoles(PRINTED_CORNER_BRACKET_DEFAULT).map(hole => `${hole.leg} ${hole.along}`)).toEqual(['a 50', 'a 70', 'a 90', 'b 50', 'b 70', 'b 90']);
    expect(validateParameters(printedCornerBracket, defaults)).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'printed-corner-bracket', modelVersion: '1', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'printed-corner-bracket', modelVersion: '1', parameters: { ...defaults, extra: 1 } })).toBe(false);
  });

  it('keeps every SCAD default equal to the contract default it is mapped from', () => {
    const [bracket] = printedCornerBracket.parts;
    const defines = scadDefines(printedCornerBracket, bracket ?? {}, defaults);
    expect(defines).toContainEqual(['WOOD_HOLES', '[4.3,4.5,4.8]']);
    for (const [name, literal] of defines) expect(source('printed-corner-bracket'), name).toMatch(new RegExp(`^${name} = ${escape(literal)};`, 'm'));
    expect(source('printed-corner-bracket')).toMatch(new RegExp(`^SINK_PLAY = ${PRINTED_SCREW_SEAT.sinkPlay};`, 'm'));
  });

  it('refuses holes off the legs, too close together or in the corner square, and screws that do not seat', () => {
    expect(fields(printedCornerBracket, { ...defaults, legA: 90 })).toEqual(['legA']);
    expect(fields(printedCornerBracket, { ...defaults, legB: 90 })).toEqual(['legB']);
    expect(fields(printedCornerBracket, { ...defaults, holeSpacing: 10 })).toContain('holeSpacing');
    expect(fields(printedCornerBracket, { ...defaults, firstHole: 22 })).toContain('firstHole');
    // a 6 mm screw's head is 3 mm high: a 3 mm plate cannot take its countersink; its countersink needs a 14.8 mm strip
    expect(fields(printedCornerBracket, { ...defaults, thickness: 3, woodScrewDiameter: '6 mm', woodScrew: 'din-7997-6x40' })).toContain('woodScrew');
    expect(fields(printedCornerBracket, { ...defaults, width: 12, woodScrewDiameter: '6 mm', woodScrew: 'din-7997-6x40' })).toContain('woodScrew');
    // a screw that barely passes the plate
    expect(fields(printedCornerBracket, { ...defaults, thickness: 10, woodScrewDiameter: '3 mm', woodScrew: 'din-7997-3x12' })).toContain('woodScrew');
    // the screw list follows its diameter
    expect(fields(printedCornerBracket, { ...defaults, woodScrewDiameter: '5 mm' })).toContain('woodScrew');
    expect(validateParameters(printedCornerBracket, { ...defaults, holesPerLeg: 1, legA: 60, legB: 60, firstHole: 40 })).toEqual([]);
  });

  it('drives a library screw into every hole, head flush with the face, and names the window insert as its user', () => {
    const assembly = resolveAssembly(printedCornerBracket, printedCornerBracket.assembly, defaults);
    expect(assembly?.steps.map(step => step.title)).toEqual(['Lay the bracket across the corner', 'Drive the screws in']);
    const screw = part('din-7997-4x35');
    expect(assembly?.poses['screw-1']).toEqual({ position: [50, 10, 5 - dimensionOf(screw, 'l')], rotation: [0, 0, 0] });
    expect(assembly?.poses['screw-6']?.position).toEqual([10, 90, 5 - dimensionOf(screw, 'l')]);
    expect(partUsage(screw).filter(use => use.modelId === 'printed-corner-bracket').map(use => use.via)).toEqual(['Wood screw diameter', 'Wood screw']);
    expect(linkedPartData(printedCornerBracket).map(entry => entry.id)).toEqual([...PRINTED_WOOD_SCREWS]);
    expect(modelUsage('printed-corner-bracket').map(use => use.pageId)).toEqual([windowInsertConcept.id]);
  });
});

describe('printed screen hook contract', () => {
  const defaults = printedScreenHook.defaults;
  const size = (overrides: Partial<PrintedScreenHookSize> = {}): PrintedScreenHookSize => ({ ...defaults, ...overrides } as unknown as PrintedScreenHookSize);

  it('is a registered two-part assembly, the long and the short hook from one generator', () => {
    expect(findModel('printed-screen-hook')).toBe(printedScreenHook);
    expect(printedScreenHook.parts.map(p => [p.id, p.scadConstants])).toEqual([['long', { PART: 'long' }], ['short', { PART: 'short' }]]);
    expect(modelSourcePaths(printedScreenHook)).toEqual(Array(2).fill('models/printed-screen-hook/generator.scad'));
    expect(printedScreenHook.license).toBe('CC BY 4.0');
    // a VEKA Softline 82 MD's lip and seal gap, as the window insert's default window
    expect(defaults).toEqual({ ...PRINTED_SCREEN_HOOK_DEFAULT, frameLip: 15.5, sealGap: 3.5, woodScrewDiameter: '3 mm', woodScrew: 'din-7997-3x20', holeFit: 'medium' });
    expect(validateParameters(printedScreenHook, defaults)).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'printed-screen-hook', modelVersion: '1', parameters: defaults })).toBe(true);
    expect(modelUsage('printed-screen-hook').map(use => use.pageId)).toEqual([windowInsertConcept.id]);
  });

  it('keeps every SCAD default and fixed size equal to the contract’s', () => {
    for (const hook of printedScreenHook.parts)
      for (const [name, literal] of scadDefines(printedScreenHook, hook, defaults)) if (name !== 'PART') expect(source('printed-screen-hook'), name).toMatch(new RegExp(`^${name} = ${escape(literal)};`, 'm'));
    expect(source('printed-screen-hook')).toMatch(new RegExp(`^GUSSET_MAX = ${PRINTED_HOOK_GUSSET};`, 'm'));
    expect(source('printed-screen-hook')).toMatch(new RegExp(`^SINK_WALL = ${PRINTED_SCREW_SEAT.wall};`, 'm'));
    expect(source('printed-screen-hook')).toMatch(new RegExp(`^GAP = ${SCREEN_HOOK_FIT.gap};`, 'm'));
    expect(source('printed-screen-hook')).toMatch(new RegExp(`^SINK_PLAY = ${PRINTED_SCREW_SEAT.sinkPlay};`, 'm'));
  });

  it('puts the barb in the middle of the seal gap and makes the long one longer by the lift that hangs the frame', () => {
    for (const [frameLip, sealGap] of [[15.5, 3.5], [5, 3], [35, 10], [8, 4.5]] as const) {
      const p = size({ frameLip, sealGap });
      const shape = printedScreenHookShape(p, part('din-7997-3x20'));
      expect(shape.front - frameLip).toBeCloseTo(frameLip + sealGap - shape.back, 9);
      expect(shape.back - shape.front).toBe(p.barbThickness);
      // the short barb reaches `engage` behind the sill lip, its turn `clearance` off the tip; lifted by its rise, the long hooks'
      // turns stay `clearance` under the head lip's tip, and their barbs reach `engage` behind it once let down
      expect(shape.rise.short).toBe(p.engage + p.clearance);
      expect(shape.lift).toBe(shape.rise.short);
      expect(shape.headClear).toBe(shape.lift + p.clearance);
      expect(shape.rise.long - shape.headClear).toBe(p.engage);
      expect(validateParameters(printedScreenHook, { ...defaults, frameLip, sealGap })).toEqual([]);
    }
  });

  it('refuses a barb the seal gap cannot take, a leg that would touch the sash, and screws that do not seat', () => {
    // a 2 mm barb needs 3 mm: thinner it prints down to 1.2 mm, for a 2.2 mm gap
    expect(fields(printedScreenHook, { ...defaults, sealGap: 2.5 })).toEqual(['barbThickness']);
    expect(validateParameters(printedScreenHook, { ...defaults, sealGap: 2.5, barbThickness: 1.5 })).toEqual([]);
    expect(validateParameters(printedScreenHook, { ...defaults, sealGap: 1 })[0]?.message).toMatch(new RegExp(`at least ${PRINTED_BARB_MIN} mm\\), or use bought hooks`));
    // a 5 mm lip and a 3 mm seal gap leave 5.5 mm to the barb: a 5 mm leg would leave no turn
    expect(fields(printedScreenHook, { ...defaults, frameLip: 5, sealGap: 3, legThickness: 5 })).toContain('legThickness');
    expect(fields(printedScreenHook, { ...defaults, legLength: 25, woodScrewDiameter: '4 mm', woodScrew: 'din-7997-4x20' })).toContain('legLength');
    expect(fields(printedScreenHook, { ...defaults, woodScrewDiameter: '5 mm', woodScrew: 'din-7997-5x30' })).toContain('woodScrew');
  });

  it('drives two screws into each hook’s leg from the room side', () => {
    const assembly = resolveAssembly(printedScreenHook, printedScreenHook.assembly, defaults);
    expect(assembly?.steps.map(step => step.title)).toEqual(['Lay the long hook on the stile’s back, at the head, barb up', 'Lay the short hook on the stile’s back, at the sill, barb down', 'Drive the screws in']);
    expect(assembly?.steps.at(-1)?.parts).toEqual(['long-screw-1', 'long-screw-2', 'short-screw-1', 'short-screw-2']);
    // head flush with the leg's inner face, the screw along +X
    const screw = part('din-7997-3x20');
    for (const id of ['long-screw-1', 'short-screw-2']) expect(assembly?.poses[id]).toMatchObject({ position: [4 - dimensionOf(screw, 'l'), expect.any(Number), expect.any(Number)], rotation: [0, 90, 0] });
    expect(printedScreenHook.derived(defaults).notes).toEqual([
      'Barbs 14 mm (long) and 7 mm (short) past the turn, 16.3 mm from the leg’s face: 0.8 mm clear of the lip’s back and of the sash.',
      'Screw the long hooks with their turns 8 mm below the head lip’s tip, the short ones 1 mm above the sill lip’s tip; lift the frame 7 mm to hang it.',
    ]);
  });
});
