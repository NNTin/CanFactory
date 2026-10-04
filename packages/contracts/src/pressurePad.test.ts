import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import {
  artifactFormat, DEFAULT_PRESSURE_PAD, findModel, linkedPartData, offeredOptions, partUsage, PRESSURE_PAD_NUTS, PRESSURE_PAD_SCREWS, PRESSURE_PAD_THREADS,
  pressurePad, pressurePadPart, scadDefines, validateParameters, type Control,
} from './models.ts';
import { dimensionOf, findPart, parts } from './parts/index.ts';
import { RenderRequestSchema } from './index.ts';
import { hexScrew, PRESSURE_PAD, pressurePadMinDiameter, pressurePadMinHeight, pressurePadPocket, pressurePadSeat } from './pressurePad.ts';

const source = readFileSync(new URL('../../../models/pressure-pad/generator.scad', import.meta.url), 'utf8');
const part = (id: string) => findPart(id) ?? (() => { throw new Error(`Missing ${id}`); })();
const find = (key: string) => pressurePad.controls.find(control => control.key === key) as Control;
const defaults = pressurePad.defaults;

describe('pressure pad contract', () => {
  it('is a registered single-STL model whose defaults validate', () => {
    expect(findModel('pressure-pad')).toBe(pressurePad);
    expect(artifactFormat(pressurePad)).toBe('stl');
    expect(defaults).toEqual(DEFAULT_PRESSURE_PAD);
    expect(validateParameters(pressurePad, defaults)).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'pressure-pad', modelVersion: '1', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'pressure-pad', modelVersion: '1', parameters: { ...defaults, extra: 1 } })).toBe(false);
  });

  it('keeps every SCAD default and fixed size equal to the contract', () => {
    for (const [name, literal] of scadDefines(pressurePad, pressurePad, defaults))
      expect(source, name).toMatch(new RegExp(`^${name} = ${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`, 'm'));
    const fixed = { LIP: PRESSURE_PAD.lip, FLOOR: PRESSURE_PAD.floor, TIP: PRESSURE_PAD.tipRecess, WALL: PRESSURE_PAD.wall, SNAP: PRESSURE_PAD.snap, CHAMFER: PRESSURE_PAD.chamfer };
    for (const [name, value] of Object.entries(fixed)) expect(source, name).toMatch(new RegExp(`^${name} += ${String(value).replace('.', '\\.')};`, 'm'));
    // the foot's screw head reaches the SCAD file from the library
    expect(scadDefines(pressurePad, pressurePad, { ...defaults, padType: 'foot', screw: 'iso-4017-m6x40', thread: 'M6' }))
      .toEqual(expect.arrayContaining([['SCREW_S', '10'], ['SCREW_K', '4.15'], ['NUT_H', '8']]));
  });

  it('offers the library’s M4–M8 lock and hexagon nuts and ISO 4017 screws, filtered by thread', () => {
    const threads = new Set<string>(PRESSURE_PAD_THREADS);
    expect([...PRESSURE_PAD_NUTS]).toEqual(parts.filter(p => p.family === 'nut' && ['ISO 10511', 'ISO 4032'].includes(String(p.attributes['standard'])) && threads.has(String(p.attributes['thread'])))
      .sort((a, b) => (a.attributes['standard'] === 'ISO 10511' ? 0 : 1) - (b.attributes['standard'] === 'ISO 10511' ? 0 : 1)).map(p => p.id));
    expect([...PRESSURE_PAD_SCREWS]).toEqual(parts.filter(p => p.attributes['standard'] === 'ISO 4017' && threads.has(String(p.attributes['thread']))).map(p => p.id));
    expect(find('nut')).toMatchObject({ visibleWhen: { control: 'padType', values: ['thrust'] }, part: { family: 'nut', attribute: null, filter: { control: 'thread', attribute: 'thread' } } });
    expect(find('screw')).toMatchObject({ visibleWhen: { control: 'padType', values: ['foot'] }, part: { family: 'screw', attribute: null, filter: { control: 'thread', attribute: 'thread' } } });
    expect(offeredOptions(find('nut'), { ...defaults, thread: 'M5' }).map(o => o.value)).toEqual(['iso-10511-m5', 'iso-4032-m5']);
    expect(validateParameters(pressurePad, { ...defaults, thread: 'M6' })).toContainEqual(expect.objectContaining({ field: 'nut' }));
    expect(validateParameters(pressurePad, { ...defaults, thread: 'M6', nut: 'iso-10511-m6' })).toEqual([]);
    expect(partUsage(part('iso-10511-m8')).filter(use => use.modelId === 'pressure-pad').map(use => use.via)).toEqual(['Nut']);
    expect(linkedPartData(pressurePad).map(entry => entry.id)).toEqual([...PRESSURE_PAD_NUTS, ...PRESSURE_PAD_SCREWS]);
  });

  it('refuses a pad too low or too narrow for its nut or head, and its relief', () => {
    const nut = part('iso-10511-m8');
    // lip 3, nut 8 + 0.4, tip recess 2, floor 3, grooves 1
    expect(pressurePadMinHeight(DEFAULT_PRESSURE_PAD, nut)).toBeCloseTo(17.4, 9);
    expect(pressurePadMinDiameter(DEFAULT_PRESSURE_PAD, nut)).toBeCloseTo(13 * 2 / Math.sqrt(3) + 0.8 + 6, 9);
    expect(validateParameters(pressurePad, { ...defaults, height: 17 })).toContainEqual(expect.objectContaining({ field: 'height' }));
    expect(validateParameters(pressurePad, { ...defaults, height: 17, surface: 'flat' })).toEqual([]);
    expect(validateParameters(pressurePad, { ...defaults, diameter: 21.5 })).toContainEqual(expect.objectContaining({ field: 'diameter' }));
    const foot = { ...DEFAULT_PRESSURE_PAD, padType: 'foot' as const };
    // a foot holds the screw's head: lip 3, head 5.45 + 0.4, floor 3, grooves 1
    expect(pressurePadMinHeight(foot, part('iso-4017-m8x30'))).toBeCloseTo(12.85, 9);
    expect(validateParameters(pressurePad, { ...foot, height: 13 })).toEqual([]);
    expect(validateParameters(pressurePad, { ...foot, height: 12.5 })).toContainEqual(expect.objectContaining({ field: 'height' }));
    expect(pressurePadPart(foot).id).toBe('iso-4017-m8x30');
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
});
