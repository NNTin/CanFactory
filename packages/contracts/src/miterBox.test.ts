import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeParts, artifactFormat, findModel, linkedPartData, miterBox, offeredOptions, scadDefines, validateParameters, type Control, type ParameterValues } from './models.ts';
import { resolveAssembly } from './assembly.ts';
import { dimensionOf, findPart, parts } from './parts/index.ts';
import {
  DEFAULT_MITER_BOX, MITER_BOX, MITER_BOX_CLAMP_SCREWS, MITER_BOX_NUTS, MITER_BOX_PAD_NUTS, MITER_BOX_PARTS, MITER_BOX_THREADS, miterBoxAssembly, miterBoxClampPoses,
  miterBoxGuidePoses, miterBoxIssues, miterBoxLayout, miterBoxPadsFit, miterBoxPinPoses, miterBoxScadValues, type MiterBoxParameters,
} from './miterBox.ts';
import { PRESSURE_PAD } from './pressurePad.ts';

const source = readFileSync(new URL('../../../models/miter-box/generator.scad', import.meta.url), 'utf8');
const padSource = readFileSync(new URL('../../../models/pressure-pad/generator.scad', import.meta.url), 'utf8');
const find = (key: string) => miterBox.controls.find(control => control.key === key) as Control;
const need = (id: string) => findPart(id) ?? (() => { throw new Error(`Missing ${id}`); })();
const settings = (overrides: Partial<MiterBoxParameters> = {}): MiterBoxParameters => ({ ...DEFAULT_MITER_BOX, ...overrides });
const turn = ([x, y]: [number, number], degrees: number): [number, number] => {
  const c = Math.cos(degrees * Math.PI / 180), s = Math.sin(degrees * Math.PI / 180);
  return [x * c - y * s, x * s + y * c];
};
/** The corners of a rectangle in the guide's frame, turned through the whole swing, every degree. */
const swept = (x0: number, x1: number, y0: number, y1: number) => Array.from({ length: 2 * MITER_BOX.maxAngle + 1 }, (_, i) => i - MITER_BOX.maxAngle)
  .flatMap(angle => [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(point => turn(point as [number, number], angle)));
const circle = (cx: number, cy: number, r: number) => Array.from({ length: 36 }, (_, i): [number, number] => [cx + r * Math.cos(i * Math.PI / 18), cy + r * Math.sin(i * Math.PI / 18)]);
const sweptCircle = (cx: number, cy: number, r: number) => Array.from({ length: 2 * MITER_BOX.maxAngle + 1 }, (_, i) => i - MITER_BOX.maxAngle).flatMap(angle => circle(cx, cy, r).map(point => turn(point, angle)));

// A spread of settings: the defaults, each extreme, both threads, the longest and shortest guides.
const spread: Partial<MiterBoxParameters>[] = [
  {}, { stockWidth: 15 }, { stockWidth: 50 }, { stockHeight: 15, clampScrew: 'iso-4017-m6x40' }, { stockHeight: 50 }, { guideDepth: 50 }, { guideLength: 10 }, { guideLength: 30 },
  { bladeKerf: 0.4, slotClearance: 0.05 }, { bladeKerf: 3, slotClearance: 0.4 }, { fit: 0.1 }, { fit: 0.6 },
  { thread: 'M5', nut: 'iso-4032-m5', padNut: 'iso-10511-m5', clampScrew: 'iso-4017-m5x50' },
  { thread: 'M5', nut: 'iso-4032-m5', padNut: 'iso-10511-m5', clampScrew: 'iso-4017-m5x50', stockWidth: 50, stockHeight: 35, fit: 0.6 },
];

describe('miter box contract', () => {
  it('is a registered assembly whose defaults validate', () => {
    expect(findModel('miter-box')).toBe(miterBox);
    expect(artifactFormat(miterBox)).toBe('zip');
    expect(miterBox.parts.map(part => part.id)).toEqual([...MITER_BOX_PARTS]);
    expect(activeParts(miterBox, miterBox.defaults).map(part => part.id)).toEqual([...MITER_BOX_PARTS]);
    expect(miterBox.defaults).toEqual(DEFAULT_MITER_BOX);
    expect(validateParameters(miterBox, miterBox.defaults)).toEqual([]);
    for (const overrides of spread) expect(validateParameters(miterBox, settings(overrides)), JSON.stringify(overrides)).toEqual([]);
  });

  it('gives the generator every value it reads, and nothing it does not', () => {
    const read = [...source.matchAll(/L\("([A-Z_]+)"\)/g)].map(match => match[1]).sort();
    const written = miterBoxScadValues(settings()).map(([name]) => name).sort();
    expect([...new Set(read)]).toEqual(written);
    const defines = Object.fromEntries(scadDefines(miterBox, miterBox.parts[0] ?? { scadMapping: {} }, miterBox.defaults));
    expect(defines['PART']).toBe('"base"');
    expect(defines['LAYOUT']).toMatch(/^\[\["BED",/);
    expect(defines['NUT_S']).toBe('10');
    // the knobs and pads are the pressure pad's, which has the grip flutes as an option
    expect(padSource).toMatch(/^GRIP = 0;/m);
    expect(miterBox.parts.filter(part => part.sourcePath.includes('pressure-pad')).map(part => part.id)).toEqual(['pad-left', 'pad-right', 'knob-left', 'knob-right', 'lock-knob']);
    expect(linkedPartData(miterBox).map(part => part.id).sort()).toEqual([...MITER_BOX_NUTS, ...MITER_BOX_PAD_NUTS, ...MITER_BOX_CLAMP_SCREWS].sort());
  });

  it('offers exactly the library parts of each thread, and the fixed knob and pad sizes hold them all', () => {
    const library = (standard: string) => parts.filter(p => p.attributes['standard'] === standard && MITER_BOX_THREADS.includes(p.attributes['thread'] as never)).map(p => p.id);
    expect([...MITER_BOX_NUTS]).toEqual(library('ISO 4032'));
    expect([...MITER_BOX_PAD_NUTS]).toEqual(library('ISO 10511'));
    expect(MITER_BOX_CLAMP_SCREWS.every(id => findPart(id)?.attributes['standard'] === 'ISO 4017' && dimensionOf(need(id), 'l') >= 30)).toBe(true);
    for (const thread of MITER_BOX_THREADS) {
      const p = { ...miterBox.defaults, thread } as ParameterValues;
      expect(offeredOptions(find('nut'), p).map(o => o.value)).toEqual([`iso-4032-${thread.toLowerCase()}`]);
      expect(offeredOptions(find('padNut'), p).map(o => o.value)).toEqual([`iso-10511-${thread.toLowerCase()}`]);
      for (const screw of MITER_BOX_CLAMP_SCREWS.filter(id => id.includes(thread.toLowerCase())))
        expect(miterBoxPadsFit(need(screw), need(`iso-10511-${thread.toLowerCase()}`), 0.6), screw).toBe(true);
    }
  });

  it('rejects parts of another thread and a clamp screw too short for the stock', () => {
    expect(validateParameters(miterBox, settings({ thread: 'M5' })).map(issue => issue.field)).toContain('nut');
    const short = miterBoxIssues(settings({ clampScrew: 'iso-4017-m6x40' }));
    expect(short.map(issue => issue.field)).toEqual(['clampScrew']);
    expect(short[0]?.message).toMatch(/only reaches down to stock/);
    expect(miterBoxIssues(settings({ clampScrew: 'iso-4017-m6x50' }))).toEqual([]);
    expect(validateParameters(miterBox, { ...miterBox.defaults, stockWidth: 51 }).length).toBeGreaterThan(0);
  });

  it('keeps the guide clear of the stock, the fence and the hold-downs at every angle, and the saw clear of everything but its slots', () => {
    for (const overrides of spread) {
      const l = miterBoxLayout(settings(overrides));
      const what = JSON.stringify(overrides);
      const half = l.postWidth / 2, pl = l.guideLength;
      // the front post and the lock knob stay in front of the widest stock; the rear post and the pin behind the stock's face
      for (const [, y] of swept(-half, half, l.frontPost - pl / 2, l.frontPost + pl / 2)) expect(y, what).toBeGreaterThanOrEqual(l.W);
      for (const [, y] of sweptCircle(l.knobX, l.knobY, MITER_BOX.knob.diameter / 2)) expect(y, what).toBeGreaterThanOrEqual(l.W);
      for (const [, y] of swept(-half, half, -l.rearPost - pl / 2, -l.rearPost + pl / 2)) expect(y, what).toBeLessThanOrEqual(-MITER_BOX.margin + 1e-9);
      for (const [, y] of sweptCircle(l.pinX, l.pinY, l.pinR)) expect(y, what).toBeLessThanOrEqual(-MITER_BOX.margin + 1e-9);
      // the fence (part of the base) stops beyond the turntable's socket; nothing turning over the turntable reaches its retainers
      expect(l.fenceStart, what).toBeGreaterThan(l.turntable + l.fit);
      const retainer = Math.hypot(l.retainTip, l.retainY) - l.retainD / 2;
      for (const [x, y] of [...swept(-half, half, -l.rearPost - pl / 2, -l.rearPost + pl / 2), ...sweptCircle(l.pinX, l.pinY, l.pinR)])
        expect(Math.hypot(x, y), what).toBeLessThan(retainer - MITER_BOX.margin + 1e-6);
      // the knob and the pin stand beside the saw's line, the kerf groove reaches past both posts
      expect(Math.abs(l.knobX) - MITER_BOX.knob.diameter / 2, what).toBeGreaterThan(l.slot / 2 + 1);
      expect(l.pinX - l.pinR, what).toBeGreaterThan(l.postWidth / 2);
      expect(l.armTip, what).toBeGreaterThan(l.frontPost + pl / 2);
      // the hold-downs, their sockets' blocks and their pads stand off the saw's line at 45° and outside the turntable
      const inner = l.holdX - Math.max(l.holdPinL, MITER_BOX.pad.diameter) / 2;
      expect(inner, what).toBeGreaterThan(Math.max(-l.blockBack, l.slotTo + MITER_BOX.pad.diameter / 2) + l.slot / 2);
      expect(inner, what).toBeGreaterThan(l.turntable + l.fit);
      // the posts reach above the tallest stock, the hold-downs' beams over the fence and the retracted pads
      expect(l.postHeight, what).toBeGreaterThan(settings(overrides).stockHeight);
      expect(l.beamBottom - MITER_BOX.pad.height - 0.5, what).toBeGreaterThan(l.bed + settings(overrides).stockHeight);
      expect(l.beamBottom, what).toBeGreaterThan(l.bed + l.fenceHeight);
    }
  });

  it('holds the turntable and the hold-downs with stainless dowel pins and puts no nut in the base', () => {
    for (const overrides of spread) {
      const l = miterBoxLayout(settings(overrides));
      const what = JSON.stringify(overrides);
      for (const pin of [l.pin, l.retainer, l.holdPin]) expect(pin.attributes['material'], what).toBe('Stainless steel A1');
      // the retainers: over the turntable's top with play, over its rim by retainOverlap, held in the fence by at least
      // retainGrip, behind the stock's face, inside their bores (which leave the fence's back face), and pushed in from behind
      // clear of the hold-downs' blocks
      const ca = Math.cos(MITER_BOX.retainAngle * Math.PI / 180);
      expect(l.retainZ - l.retainD / 2 - l.bed, what).toBeCloseTo(MITER_BOX.retainPlay);
      expect(l.turntable - l.retainTip, what).toBeCloseTo(MITER_BOX.retainOverlap);
      expect(l.retainL - l.retainOut, what).toBeGreaterThanOrEqual(MITER_BOX.retainGrip);
      expect(l.retainY + l.retainD / 2 * ca, what).toBeLessThanOrEqual(-MITER_BOX.margin + 1e-3);
      expect(l.retainL, what).toBeLessThanOrEqual(l.retainBack);
      expect(l.holdX - l.holdPinL / 2, what).toBeGreaterThan(l.retainApproach);
      // the hold-down's pin: across the socket's walls (each at least socket.wall) and the column, inside the block's height
      expect((l.holdPinL - MITER_BOX.holdDown.width) / 2 - l.fit, what).toBeGreaterThanOrEqual(MITER_BOX.socket.wall);
      expect(l.holdPinZ - l.holdPinD / 2, what).toBeGreaterThan(l.socketFloor + 2);
      expect(l.holdPinZ + l.holdPinD / 2, what).toBeLessThan(l.bed + l.fenceHeight - 2);
      // the lock: its nut in the arm under at least lockCeiling, the screw through it reaching the base's floor with the knob just over the arm
      expect(MITER_BOX.arm - l.lockPocket, what).toBeGreaterThanOrEqual(MITER_BOX.lockCeiling - 1e-9);
      expect(l.lockShank - MITER_BOX.arm, what).toBeGreaterThanOrEqual(MITER_BOX.lockRise);
      expect(l.lockShank, what).toBe(dimensionOf(l.lockScrew, 'l') - PRESSURE_PAD.lip);
      expect(l.lockShank, what).toBeGreaterThanOrEqual(l.lockPocket);
      // the index pin: in the base by pinDepth over a floor, standing above the turntable, its lift clear of the socket's floor
      expect(l.pinL - MITER_BOX.arm - MITER_BOX.pinDepth).toBeGreaterThanOrEqual(5);
      expect(MITER_BOX.pinLift).toBeGreaterThan(MITER_BOX.pinDepth);
      expect(l.bed - MITER_BOX.arm - MITER_BOX.pinDepth).toBeCloseTo(MITER_BOX.stopFloor);
    }
    // the base is thinner than the first design's 17.7 mm, and no reference is a nut under the base
    expect(miterBoxLayout(settings()).bed).toBeLessThanOrEqual(12.2);
    const references = miterBox.linkedReferences(miterBox.defaults);
    expect(references.filter(reference => findPart(reference.part)?.family === 'nut').map(reference => reference.id).sort())
      .toEqual(['lock-nut', 'pad-nut-left', 'pad-nut-right', 'tnut-left', 'tnut-right']);
  });

  it('offers the stainless dowel pins in the parts library', () => {
    const stainless = parts.filter(p => p.family === 'pin' && p.attributes['material'] === 'Stainless steel A1');
    expect(stainless.length).toBe(parts.filter(p => p.family === 'pin' && p.attributes['material'] === 'Steel').length);
    expect(need('iso-2338-4x12-a1').designation).toBe('ISO 2338 4 m6 × 12 – A1');
    expect(dimensionOf(need('iso-2338-4x30-a1'), 'd', 'max')).toBeCloseTo(4.012);
  });

  it('assembles every part and moves the guide and the clamps as the layout says', () => {
    const p = settings();
    const assembly = resolveAssembly(miterBox, miterBox.assembly, miterBox.defaults);
    expect(assembly).toBeDefined();
    const ids = new Set([...MITER_BOX_PARTS, ...(assembly?.references ?? []).map(reference => reference.id)]);
    for (const id of MITER_BOX_PARTS) expect(miterBox.assembly.poses[id], id).toBeDefined();
    for (const step of miterBox.assembly.steps) for (const id of step.parts) expect(ids.has(id), id).toBe(true);
    expect(assembly?.references?.length).toBe(13);
    const l = miterBoxLayout(p);
    const motion = miterBoxAssembly(p).motion ?? [];
    expect(motion.map(m => m.title)).toHaveLength(6);
    // the first swing ends at 45° with the pin back in its hole; the third at 10° with the pin still lifted
    const end = (index: number) => motion[index]?.frames.at(-1) ?? {};
    expect(end(0)['turntable']?.rotation?.[2]).toBeCloseTo(45);
    expect(end(0)['pin']).toEqual(miterBoxGuidePoses(l, 45).pin);
    expect(end(1)['turntable']?.rotation?.[2]).toBeCloseTo(-22.5);
    expect(end(2)['pin']).toEqual(miterBoxGuidePoses(l, 10, MITER_BOX.pinLift).pin);
    // the lock screw follows the knob round the pivot; its nut turns with the arm, in its pocket
    const at45 = miterBoxGuidePoses(l, 45);
    expect(Math.hypot(at45['lock-knob']?.position[0] ?? 0, at45['lock-knob']?.position[1] ?? 0)).toBeCloseTo(l.lockRadius, 2);
    expect(at45['lock-nut']?.rotation[2]).toBeCloseTo(45 + 30, 2);
    // the pins lie along X: the retainers reaching over the turntable from the fence's ends, the hold-downs' across their sockets
    const pins = miterBoxPinPoses(l);
    expect(pins['retainer-right']).toEqual({ position: [l.retainTip, l.retainY, l.retainZ], rotation: [0, 90, -MITER_BOX.retainAngle] });
    expect(pins['hold-pin-left']?.position[0]).toBeCloseTo(-l.holdX + l.holdPinL / 2);
    // the clamps: pads slid to both ends of the slot, then screwed down to the lowest stock
    const slide = motion[4]?.frames ?? [];
    expect(Math.min(...slide.map(frame => frame['pad-left']?.position[1] ?? Infinity))).toBeCloseTo(l.slotFrom);
    expect(Math.max(...slide.map(frame => frame['pad-left']?.position[1] ?? -Infinity))).toBeCloseTo(l.slotTo);
    const lowest = Math.min(...(motion[5]?.frames ?? []).map(frame => frame['pad-right']?.position[2] ?? Infinity));
    expect(lowest - MITER_BOX.pad.height).toBeCloseTo(l.bed + l.clampLow);
    // the knob stays above the hold-down's beam however far the pad goes down
    const down = miterBoxClampPoses(l, 'left', l.slotFrom, lowest);
    expect(down['knob-left']?.position[2]).toBeGreaterThanOrEqual(l.beamTop);
  });

  it('notes the slots, the stops, the clamps’ range and the hardware', () => {
    const notes = miterBox.derived(miterBox.defaults).notes ?? [];
    expect(notes.join(' ')).toMatch(/Saw slots 1\.50 mm wide/);
    expect(notes.join(' ')).toMatch(/0, ±22\.5 and ±45°/);
    expect(notes.join(' ')).toMatch(/ISO 4017 M6 × 60/);
    expect(notes.join(' ')).toMatch(/No nuts in the base: 2 ISO 2338 4 m6 × 12 – A1/);
  });
});
