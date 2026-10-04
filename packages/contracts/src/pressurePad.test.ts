import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import {
  activeParts, artifactFormat, DEFAULT_PRESSURE_PAD, findModel, linkedPartData, offeredOptions, partUsage, PRESSURE_PAD_NUTS, PRESSURE_PAD_SCREWS, PRESSURE_PAD_THREADS,
  pressurePad, pressurePadAssembly, pressurePadPart, scadDefines, validateParameters, type Control, type ParameterValues,
} from './models.ts';
import { resolveAssembly } from './assembly.ts';
import { dimensionOf, findPart, parts } from './parts/index.ts';
import { RenderRequestSchema } from './index.ts';
import {
  hexScrew, PRESSURE_PAD, pressurePadExtenderTravel, pressurePadLeg, pressurePadMinDiameter, pressurePadMinExtenderDiameter, pressurePadMinExtenderLength, pressurePadMinHeight, pressurePadPocket,
  pressurePadSeat,
} from './pressurePad.ts';

const source = readFileSync(new URL('../../../models/pressure-pad/generator.scad', import.meta.url), 'utf8');
const part = (id: string) => findPart(id) ?? (() => { throw new Error(`Missing ${id}`); })();
const find = (key: string) => pressurePad.controls.find(control => control.key === key) as Control;
const defaults = pressurePad.defaults;

describe('pressure pad contract', () => {
  it('is a registered model of a pad and up to three extenders whose defaults validate', () => {
    expect(findModel('pressure-pad')).toBe(pressurePad);
    expect(artifactFormat(pressurePad)).toBe('zip');
    expect(pressurePad.parts.map(p => p.id)).toEqual(['pad', 'extender-1', 'extender-2', 'extender-3']);
    expect(activeParts(pressurePad, defaults).map(p => p.id)).toEqual(['pad', 'extender-1']);
    expect(activeParts(pressurePad, { ...defaults, extenders: 0 }).map(p => p.id)).toEqual(['pad']);
    expect(activeParts(pressurePad, { ...defaults, extenders: 3 }).map(p => p.id)).toEqual(['pad', 'extender-1', 'extender-2', 'extender-3']);
    expect(defaults).toEqual(DEFAULT_PRESSURE_PAD);
    expect(validateParameters(pressurePad, defaults)).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'pressure-pad', modelVersion: '1', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'pressure-pad', modelVersion: '1', parameters: { ...defaults, extra: 1 } })).toBe(false);
  });

  it('keeps every SCAD default and fixed size equal to the contract', () => {
    const [pad, extender] = pressurePad.parts;
    // every SCAD variable a part receives has the contract's default as its own (the extender's PART constant aside)
    for (const [name, literal] of [...scadDefines(pressurePad, pad ?? {}, defaults), ...scadDefines(pressurePad, extender ?? {}, defaults).filter(([name]) => name !== 'PART')])
      expect(source, name).toMatch(new RegExp(`^${name} = ${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`, 'm'));
    expect(scadDefines(pressurePad, extender ?? {}, defaults)).toEqual(expect.arrayContaining([['PART', '"extender"'], ['EXT_LENGTH', '40']]));
    const fixed = { LIP: PRESSURE_PAD.lip, FLOOR: PRESSURE_PAD.floor, TIP: PRESSURE_PAD.tipRecess, WALL: PRESSURE_PAD.wall, SNAP: PRESSURE_PAD.snap, CHAMFER: PRESSURE_PAD.chamfer };
    for (const [name, value] of Object.entries(fixed)) expect(source, name).toMatch(new RegExp(`^${name} += ${String(value).replace('.', '\\.')};`, 'm'));
    // the foot's screw head reaches the SCAD file from the library
    expect(scadDefines(pressurePad, pad ?? {}, { ...defaults, padType: 'foot', screw: 'iso-4017-m6x40', thread: 'M6' }))
      .toEqual(expect.arrayContaining([['SCREW_S', '10'], ['SCREW_K', '4.15'], ['NUT_H', '8']]));
  });

  it('offers the library’s M4–M8 lock and hexagon nuts and ISO 4017 screws, filtered by thread', () => {
    const threads = new Set<string>(PRESSURE_PAD_THREADS);
    expect([...PRESSURE_PAD_NUTS]).toEqual(parts.filter(p => p.family === 'nut' && ['ISO 10511', 'ISO 4032'].includes(String(p.attributes['standard'])) && threads.has(String(p.attributes['thread'])))
      .sort((a, b) => (a.attributes['standard'] === 'ISO 10511' ? 0 : 1) - (b.attributes['standard'] === 'ISO 10511' ? 0 : 1)).map(p => p.id));
    expect([...PRESSURE_PAD_SCREWS]).toEqual(parts.filter(p => p.attributes['standard'] === 'ISO 4017' && threads.has(String(p.attributes['thread']))).map(p => p.id));
    // both are always shown: the extenders take a nut and a screw whichever pad it is
    expect(find('nut')).toMatchObject({ visibleWhen: null, part: { family: 'nut', attribute: null, filter: { control: 'thread', attribute: 'thread' } } });
    expect(find('screw')).toMatchObject({ visibleWhen: null, part: { family: 'screw', attribute: null, filter: { control: 'thread', attribute: 'thread' } } });
    expect(offeredOptions(find('nut'), { ...defaults, thread: 'M5' }).map(o => o.value)).toEqual(['iso-10511-m5', 'iso-4032-m5']);
    expect(validateParameters(pressurePad, { ...defaults, thread: 'M6' })).toContainEqual(expect.objectContaining({ field: 'nut' }));
    expect(validateParameters(pressurePad, { ...defaults, thread: 'M6', nut: 'iso-10511-m6', screw: 'iso-4017-m6x30' })).toEqual([]);
    expect(partUsage(part('iso-10511-m8')).filter(use => use.modelId === 'pressure-pad').map(use => use.via)).toEqual(['Nut']);
    expect(linkedPartData(pressurePad).map(entry => entry.id)).toEqual([...PRESSURE_PAD_NUTS, ...PRESSURE_PAD_SCREWS]);
  });

  it('refuses a pad too low or too narrow for its nut or head, and its relief', () => {
    const nut = part('iso-10511-m8');
    const thrust = { ...DEFAULT_PRESSURE_PAD, padType: 'thrust' as const, extenders: 0 };
    // lip 3, nut 8 + 0.4, tip recess 2, floor 3, grooves 1
    expect(pressurePadMinHeight(thrust, nut)).toBeCloseTo(17.4, 9);
    expect(pressurePadMinDiameter(thrust, nut)).toBeCloseTo(13 * 2 / Math.sqrt(3) + 0.8 + 6, 9);
    expect(validateParameters(pressurePad, { ...thrust, height: 17 })).toContainEqual(expect.objectContaining({ field: 'height' }));
    expect(validateParameters(pressurePad, { ...thrust, height: 17, surface: 'flat' })).toEqual([]);
    expect(validateParameters(pressurePad, { ...thrust, diameter: 21.5 })).toContainEqual(expect.objectContaining({ field: 'diameter' }));
    const foot = { ...DEFAULT_PRESSURE_PAD, padType: 'foot' as const, extenders: 0 };
    // a foot holds the screw's head: lip 3, head 5.45 + 0.4, floor 3, grooves 1
    expect(pressurePadMinHeight(foot, part('iso-4017-m8x30'))).toBeCloseTo(12.85, 9);
    expect(validateParameters(pressurePad, { ...foot, height: 13 })).toEqual([]);
    expect(validateParameters(pressurePad, { ...foot, height: 12.5 })).toContainEqual(expect.objectContaining({ field: 'height' }));
    expect(pressurePadPart(foot).id).toBe('iso-4017-m8x50');
  });

  it('holds the screw where the catio pages expect it, and picks hexagon screws by length', () => {
    expect(pressurePadSeat('thrust', part('iso-10511-m8'))).toBe(PRESSURE_PAD.lip + 8);
    expect(pressurePadSeat('foot', part('iso-4017-m8x30'))).toBe(PRESSURE_PAD.lip);
    expect(pressurePadPocket('foot', part('iso-4017-m8x30'), 0.4)).toMatchObject({ hole: 8.8, recess: 0 });
    expect(hexScrew('M8', 66.8).id).toBe('iso-4017-m8x80');
    expect(hexScrew('M8', 29).id).toBe('iso-4017-m8x30');
    expect(hexScrew('M8', 200).id).toBe('iso-4017-m8x80');
    expect(dimensionOf(hexScrew('M6', 0), 'l')).toBe(12);
  });

  it('refuses an extender too short or too narrow for its nut and the next screw’s head', () => {
    const nut = part('iso-10511-m8'); const screw = part('iso-4017-m8x30');
    // lip 3, nut 8 + 0.4, floor 3, head 5.45 + 0.4, lip 3
    expect(pressurePadMinExtenderLength(nut, screw, 0.4)).toBeCloseTo(23.25, 9);
    expect(pressurePadMinExtenderDiameter(nut, screw, 0.4)).toBeCloseTo(13.8 * 2 / Math.sqrt(3) + 6, 9);
    expect(validateParameters(pressurePad, { ...defaults, extenderLength: 23 })).toEqual([expect.objectContaining({ field: 'extenderLength' })]);
    expect(validateParameters(pressurePad, { ...defaults, extenderLength: 23.5 })).toEqual([]);
    expect(validateParameters(pressurePad, { ...defaults, extenderLength: 23, extenders: 0 })).toEqual([]);
    // the library's nuts and hexagon heads of one thread are equally wide across the flats, so the extender is no wider than a foot
    expect(pressurePadMinExtenderDiameter(nut, screw, 0.4)).toBeCloseTo(pressurePadMinDiameter({ padType: 'foot', fit: 0.4 }, screw), 9);
    expect(validateParameters(pressurePad, { ...defaults, diameter: 21.5 })).toEqual([expect.objectContaining({ field: 'diameter' })]);
  });

  it('stacks the leg: each screw held where its pocket holds it, each extender on the screw below, set anywhere in its travel', () => {
    const nut = part('iso-10511-m8'); const screw = part('iso-4017-m8x50'); const h = 8; const l = 50; const k = 5.45;
    const at = (pieces: ReturnType<typeof pressurePadLeg>, id: string) => pieces.find(piece => piece.id === id) ?? (() => { throw new Error(id); })();
    const shape = { ...DEFAULT_PRESSURE_PAD, extenderLength: 40 };
    // up the 40 mm extender's bore: 40 − 2 × 3 lips − the nut 8 − the next head 5.45 − 0.4 of play
    const travel = pressurePadExtenderTravel({ ...shape, padType: 'foot' }, nut, screw);
    expect(travel.travel).toBeCloseTo(20.15, 9); expect(travel.max).toBeCloseTo(20.15, 9);
    // a short screw leaves less, for the lock nut: 30 − 2 × 3 − 2 × 8 (foot), 30 − 3 − 2 × 8 (thrust pad)
    expect(pressurePadExtenderTravel({ ...shape, padType: 'foot' }, nut, part('iso-4017-m8x30')).max).toBeCloseTo(8, 9);
    expect(pressurePadExtenderTravel({ ...shape, padType: 'thrust' }, nut, part('iso-4017-m8x30')).max).toBeCloseTo(11, 9);
    expect(pressurePadExtenderTravel({ ...shape, padType: 'foot' }, nut, part('iso-4017-m8x20')).max).toBeLessThan(0);
    for (const extenders of [0, 1, 3]) for (const setting of [0, 0.5, 1]) {
      const settings = Array.from({ length: extenders }, () => setting);
      const run = 20.15 * setting;
      const foot = pressurePadLeg({ ...shape, padType: 'foot', extenders }, nut, screw, settings);
      expect(foot.map(piece => piece.id)).toEqual(['pad', 'screw-0', ...Array.from({ length: extenders }, (_, i) => [`locknut-${i + 1}`, `nut-${i + 1}`, `extender-${i + 1}`, `screw-${i + 1}`]).flat()]);
      // the first head bears on the pad's lip, inside the pad
      expect(at(foot, 'screw-0').bottom).toBeCloseTo(24.5 - 3 - k, 9);
      for (let i = 1; i <= extenders; i++) {
        const e = at(foot, `extender-${i}`); const below = at(foot, `screw-${i - 1}`); const n = at(foot, `nut-${i}`); const lock = at(foot, `locknut-${i}`); const next = at(foot, `screw-${i}`);
        // the nut stands on the extender's bottom lip; the screw below runs on through it into the bore, by the setting
        expect(n.bottom).toBeCloseTo(e.bottom + 3, 9);
        expect(below.top).toBeCloseTo(n.top + run, 9);
        // never further than the next head's pocket
        expect(below.top).toBeLessThanOrEqual(e.top - 3 - k - 0.4 + 1e-9);
        // the lock nut jammed up against the extender, clear of the pad or extender below
        expect(lock.top).toBeCloseTo(e.bottom, 9);
        expect(lock.bottom).toBeGreaterThanOrEqual((i === 1 ? 24.5 : at(foot, `extender-${i - 1}`).top) - 1e-9);
        // the next screw's head sits under the extender's top lip, its shank out of the top
        expect(next.bottom + k).toBeCloseTo(e.top - 3, 9);
        expect(next.top).toBeCloseTo(e.top - 3 + l, 9);
      }
      const thrust = pressurePadLeg({ ...shape, padType: 'thrust', extenders }, nut, screw, settings);
      // the nut bears on the pad's chamber floor, the screw's tip flush with it, the head up
      expect(at(thrust, 'nut-0').bottom).toBeCloseTo(24.5 - 3 - h - 0.4, 9);
      expect(at(thrust, 'screw-0').bottom).toBeCloseTo(at(thrust, 'nut-0').bottom, 9);
      for (let i = 1; i <= extenders; i++) {
        const e = at(thrust, `extender-${i}`); const below = at(thrust, `screw-${i - 1}`); const n = at(thrust, `nut-${i}`); const lock = at(thrust, `locknut-${i}`); const next = at(thrust, `screw-${i}`);
        expect(e.rotation[0]).toBe(180);
        // turned over: the screw below's head inside, its underside on the bottom lip
        expect(below.bottom + l).toBeCloseTo(e.bottom + 3, 9);
        // the nut against the top lip, the next screw's tip through it into the bore by the setting, not into the head's pocket
        expect(n.top).toBeCloseTo(e.top - 3, 9);
        expect(next.bottom).toBeCloseTo(n.bottom - run, 9);
        expect(next.bottom).toBeGreaterThanOrEqual(e.bottom + 3 + k + 0.4 - 1e-9);
        // the lock nut on the extender's top, under the next screw's head
        expect(lock.bottom).toBeCloseTo(e.top, 9);
        expect(lock.top).toBeLessThanOrEqual(next.bottom + l + 1e-9);
      }
    }
  });

  it('animates the leg going together, every screw and nut from where it really goes in, then each joint’s height', () => {
    for (const padType of ['foot', 'thrust'] as const) for (const extenders of [0, 2]) {
      const parameters: ParameterValues = { ...defaults, padType, extenders };
      const assembly = resolveAssembly(pressurePad, pressurePad.assembly, parameters);
      if (!assembly) throw new Error('assembly');
      const moved = assembly.steps.flatMap(step => step.parts);
      const pieces = [...activeParts(pressurePad, parameters).map(p => p.id), ...(assembly.references ?? []).map(r => r.id)];
      // every piece but the pad moves exactly once, and every one has a pose
      expect(moved.sort()).toEqual(pieces.filter(id => id !== 'pad').sort());
      for (const id of pieces) expect(assembly.poses[id], id).toBeDefined();
      expect(assembly.steps).toHaveLength(1 + 3 * extenders);
      // sideways slides along the slots' +X (the pieces into the slots) or −X (an extender over them); a nut or screw turned on along Z
      for (const step of assembly.steps) expect(step.from[1]).toBe(0);
      expect((assembly.references ?? []).map(r => r.title)).toContain(`Hexagon head screw M8 × 50 (${padType === 'foot' ? 'in the foot' : 'in the pad'})`);
      expect((assembly.references ?? []).filter(r => r.id.startsWith('locknut')).map(r => r.title)).toEqual(Array.from({ length: extenders }, (_, i) => `Nylon-insert lock nut M8 (lock nut at extender ${i + 1})`));
      // one movement per extender: from the longest leg in to the shortest and back, the joint's screw only ever running along its axis
      expect(assembly.motion ?? []).toHaveLength(extenders);
      for (const [index, movement] of (assembly.motion ?? []).entries()) {
        expect(movement.title).toBe(`Set the height at extender ${index + 1}: 20.2 mm of travel`);
        // the leg's top screw rises and falls by the travel (a foot's extender moves on the screw below; a thrust pad's screw in it)
        const top = `screw-${extenders}`;
        const heights = movement.frames.map(frame => frame[top]?.position[2] ?? NaN);
        expect(Math.max(...heights) - Math.min(...heights)).toBeCloseTo(20.15, 9);
        expect(heights.at(-1)).toBeCloseTo(assembly.poses[top]?.position[2] ?? NaN, 9);
        for (const frame of movement.frames) for (const pose of Object.values(frame)) expect([pose.position[0], pose.position[1]]).toEqual([0, 0]);
      }
    }
    expect(pressurePadAssembly(defaults).steps.map(step => step.title)).toEqual([
      'Slide the screw’s head into the foot from the side', 'Extender 1: run a lock nut, then a nut, down the screw',
      'Extender 1: slide it over the nut from the side (then turn it to the height and jam the lock nut up against it)', 'Extender 1: slide the next screw’s head into its top pocket',
    ]);
    const short = validateParameters(pressurePad, { ...defaults, screw: 'iso-4017-m8x20' });
    expect(short.map(issue => issue.field)).toEqual(['screw']);
    expect(short[0]?.message).toContain('at least 22 mm long');
  });
});
