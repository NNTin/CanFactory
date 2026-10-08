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
    // legs of 2.5 members, half a member wide, three staggered holes on each leg past the joint
    expect(printedCornerBracketFor(40)).toEqual({ legA: 100, legB: 100, width: 20, thickness: 5, holesPerLeg: 3, holeSpacing: 20, firstHole: 50, holeLayout: 'staggered' });
    expect(defaults).toEqual({ ...PRINTED_CORNER_BRACKET_DEFAULT, woodScrewDiameter: '4 mm', woodScrew: 'din-7997-4x35', holeFit: 'medium' });
    expect(printedCornerBracketHoles(PRINTED_CORNER_BRACKET_DEFAULT).map(hole => `${hole.leg} ${hole.along}`)).toEqual(['a 50', 'a 70', 'a 90', 'b 50', 'b 70', 'b 90']);
    expect(validateParameters(printedCornerBracket, defaults)).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'printed-corner-bracket', modelVersion: '1', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'printed-corner-bracket', modelVersion: '1', parameters: { ...defaults, extra: 1 } })).toBe(false);
  });

  it('staggers the holes across each leg by default, and keeps them in a straight line only when asked', () => {
    const across = (size: typeof PRINTED_CORNER_BRACKET_DEFAULT) => printedCornerBracketHoles(size).map(hole => Math.round(hole.across * 1000) / 1000);
    // on the 20 mm leg's thirds: the first hole of each leg towards its inner edge, then alternating
    expect(across(PRINTED_CORNER_BRACKET_DEFAULT)).toEqual([13.333, 6.667, 13.333, 13.333, 6.667, 13.333]);
    for (const leg of ['a', 'b'] as const) {
      const holes = printedCornerBracketHoles(PRINTED_CORNER_BRACKET_DEFAULT).filter(hole => hole.leg === leg);
      // neighbouring holes never share a grain line, and the rows are clear of each other by more than a hole
      for (let i = 1; i < holes.length; i++) expect(Math.abs((holes[i]?.across ?? 0) - (holes[i - 1]?.across ?? 0))).toBeGreaterThan(dimensionOf(part('din-7997-4x35'), 'd'));
    }
    expect(across({ ...PRINTED_CORNER_BRACKET_DEFAULT, holeLayout: 'straight' })).toEqual([10, 10, 10, 10, 10, 10]);
    // a single hole stays on the middle line either way
    expect(across({ ...PRINTED_CORNER_BRACKET_DEFAULT, holesPerLeg: 1 })).toEqual([10, 10]);
    expect(validateParameters(printedCornerBracket, { ...defaults, holeLayout: 'straight' })).toEqual([]);
  });

  it('refuses staggered holes on a leg too narrow for their countersinks, and names the width that takes them', () => {
    // a 4 mm screw's countersink (7.9 mm) and its 1.5 mm walls: 5.45 mm round each hole, so the thirds need 16.35 mm
    expect(validateParameters(printedCornerBracket, { ...defaults, width: 16 })).toEqual([{ field: 'width', message: 'Staggered holes for a DIN 7997 4 × 35 lie on the leg\'s thirds, and their countersinks need the legs at least 16.35 mm wide: make them wider, choose a thinner screw, or put the holes in a straight line (Hole layout).' }]);
    expect(validateParameters(printedCornerBracket, { ...defaults, width: 16.5 })).toEqual([]);
    expect(validateParameters(printedCornerBracket, { ...defaults, width: 16, holeLayout: 'straight' })).toEqual([]);
    // one hole a leg is not staggered; a 6 mm screw (11.4 mm countersink) needs 21.6 mm
    expect(validateParameters(printedCornerBracket, { ...defaults, width: 12, holesPerLeg: 1, legA: 60, legB: 60, firstHole: 40 })).toEqual([]);
    expect(fields(printedCornerBracket, { ...defaults, woodScrewDiameter: '6 mm', woodScrew: 'din-7997-6x40' })).toEqual(['width']);
    expect(fields(printedCornerBracket, { ...defaults, width: 22, woodScrewDiameter: '6 mm', woodScrew: 'din-7997-6x40' })).toEqual([]);
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
    // staggered: the first and last holes of each leg on its inner third
    expect(assembly?.poses['screw-1']).toEqual({ position: [50, 40 / 3, 5 - dimensionOf(screw, 'l')], rotation: [0, 0, 0] });
    expect(assembly?.poses['screw-2']?.position).toEqual([70, 10 - 20 / 6, 5 - dimensionOf(screw, 'l')]);
    expect(assembly?.poses['screw-6']?.position).toEqual([40 / 3, 90, 5 - dimensionOf(screw, 'l')]);
    const straight = resolveAssembly(printedCornerBracket, printedCornerBracket.assembly, { ...defaults, holeLayout: 'straight' });
    expect(straight?.poses['screw-2']?.position).toEqual([70, 10, 5 - dimensionOf(screw, 'l')]);
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
    // two 4 mm screws need 4 + 3 + 3 × 5.45 mm of leg; one, as much leg past it as it stands from the turn: 2 × (8 + 3 + 5.45) mm
    const four = { ...defaults, width: 11, legLength: 25, woodScrewDiameter: '4 mm', woodScrew: 'din-7997-4x20' };
    expect(fields(printedScreenHook, { ...four, screwCount: 2 })).toContain('legLength');
    expect(validateParameters(printedScreenHook, four)).toEqual([]);
    expect(fields(printedScreenHook, { ...four, turnThickness: 8 })).toEqual(['legLength']);
    expect(validateParameters(printedScreenHook, { ...four, turnThickness: 8 })[0]?.message).toMatch(/at least 33 mm long: with one screw, 16.5 mm from the turn/);
    expect(validateParameters(printedScreenHook, { ...four, turnThickness: 8, legLength: 33 })).toEqual([]);
    expect(fields(printedScreenHook, { ...defaults, woodScrewDiameter: '5 mm', woodScrew: 'din-7997-5x30' })).toContain('woodScrew');
  });

  it('drives one screw, by default, or two into each hook’s leg from the room side', () => {
    const screw = part('din-7997-3x20');
    for (const [screwCount, ids] of [[1, ['long-screw-1', 'short-screw-1']], [2, ['long-screw-1', 'long-screw-2', 'short-screw-1', 'short-screw-2']]] as const) {
      const parameters = { ...defaults, screwCount };
      const assembly = resolveAssembly(printedScreenHook, printedScreenHook.assemblyForParameters(parameters), parameters);
      expect(assembly?.steps.map(step => step.title)).toEqual(['Lay the long hook on the stile’s back, at the head, barb up', 'Lay the short hook on the stile’s back, at the sill, barb down', 'Drive the screws in']);
      expect(assembly?.steps.at(-1)?.parts).toEqual(ids);
      // head flush with the leg's inner face, the screw along +X
      for (const id of ids) expect(assembly?.poses[id]).toMatchObject({ position: [4 - dimensionOf(screw, 'l'), expect.any(Number), expect.any(Number)], rotation: [0, 90, 0] });
    }
    expect(defaults['screwCount']).toBe(1);
    // the one screw is where the first of two goes: just past the 3 mm fillet, its 4.5 mm countersink seat clear of it
    const one = printedScreenHookShape(size(), screw); const two = printedScreenHookShape(size({ screwCount: 2 }), screw);
    expect(one.holes).toEqual([-11.5]);
    expect(two.holes).toEqual([-11.5, -35.5]);
    expect(two.swing).toBeNull();
    // eased, a long hook swings its barb's far corner, 25.5 mm out and 5 mm across, down to the head lip's tip, 19.5 mm out
    const a = (one.swing ?? 0) * Math.PI / 180;
    expect(25.5 * Math.cos(a) + 5 * Math.sin(a)).toBeCloseTo(19.5, 9);
    expect(printedScreenHook.derived(defaults).notes).toEqual([
      'Barbs 14 mm (long) and 7 mm (short) past the turn, 16.3 mm from the leg’s face: 0.8 mm clear of the lip’s back and of the sash.',
      'Screw the long hooks with their turns 8 mm below the head lip’s tip, the short ones 1 mm above the sill lip’s tip; lift the frame 7 mm to hang it.',
      'One screw in each leg, 11.5 mm from the turn: eased, a hook turns on it; a long hook’s barb is clear below the head lip once it is swung 53° either way.',
    ]);
    expect(printedScreenHook.derived({ ...defaults, screwCount: 2 }).notes?.at(-1)).toBe('Two screws in each leg: the hooks are held square and cannot turn.');
  });
});
