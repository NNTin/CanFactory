import { existsSync, readFileSync } from 'node:fs';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { cigaretteCase, models, partUsage, plankConnector } from '../models.ts';
import { componentTop, devBoardLayout, findPart, findPartSource, ISO_273_CLEARANCE_HOLES, METRIC_THREADS, PART_SOURCES, partAssetPath, partFamilies, parts, PartFamilySchema, PartSchema, PartSourceSchema, springRate, type Part } from './index.ts';

const root = (path: string) => new URL(`../../../../${path}`, import.meta.url);
const dimension = (part: Part, key: string) => part.dimensions[key]?.value ?? Number.NaN;

describe('parts library', () => {
  it('has well-formed families, parts and sources', () => {
    for (const family of partFamilies) expect(Value.Check(PartFamilySchema, family), family.id).toBe(true);
    for (const source of PART_SOURCES) expect(Value.Check(PartSourceSchema, source), source.id).toBe(true);
    for (const part of parts) expect([...Value.Errors(PartSchema, part)].map(error => `${error.instancePath} ${error.message}`), part.id).toEqual([]);
    expect(new Set(partFamilies.map(family => family.id)).size).toBe(partFamilies.length);
    expect(new Set(PART_SOURCES.map(source => source.id)).size).toBe(PART_SOURCES.length);
  });

  it('keeps every part id unique and stable: ids are only ever added (ids.lock)', () => {
    const ids = parts.map(part => part.id);
    expect(ids.length - new Set(ids).size).toBe(0);
    const locked = readFileSync(new URL('./ids.lock', import.meta.url), 'utf8').split('\n').filter(line => line && !line.startsWith('#'));
    // A part that models may link to is never removed or renamed: rename it through `aliases` instead.
    expect(locked.filter(id => !ids.includes(id)), 'ids removed from the library').toEqual([]);
    // A new part is added to ids.lock in the same change, so that removing it later fails here.
    expect(ids.filter(id => !locked.includes(id)), 'new ids missing from packages/contracts/src/parts/ids.lock').toEqual([]);
  });

  it('gives every part its family’s dimensions, a description, and a source for every value', () => {
    for (const part of parts) {
      const family = partFamilies.find(candidate => candidate.id === part.family);
      if (!family) throw new Error(`${part.id}: unknown family ${part.family}`);
      const keys = family.dimensions.map(spec => spec.key);
      expect(Object.keys(part.dimensions).filter(key => !keys.includes(key)), `${part.id}: dimensions the family does not define`).toEqual([]);
      expect(family.dimensions.filter(spec => spec.required && !(spec.key in part.dimensions)).map(spec => spec.key), `${part.id}: missing dimensions`).toEqual([]);
      expect(part.description.length, part.id).toBeGreaterThan(40);
      expect(part.standard !== null || part.product !== null, `${part.id}: neither a standard nor a product`).toBe(true);
      const cited = [...part.sources, ...(part.standard ? [part.standard] : [])];
      for (const [key, value] of Object.entries(part.dimensions)) {
        expect(findPartSource(value.source), `${part.id}.${key}: unknown source ${value.source}`).toBeDefined();
        expect(cited, `${part.id}.${key}: source not listed in the part's sources`).toContain(value.source);
        // The nominal value may lie outside its limits (an m6 pin is always oversize, a hex socket wider than its key), but not far.
        if (value.min !== null && value.max !== null) expect(value.min, `${part.id}.${key} limits`).toBeLessThanOrEqual(value.max);
        for (const limit of [value.min, value.max]) if (limit !== null) expect(Math.abs(limit - value.value), `${part.id}.${key} limit`).toBeLessThan(Math.max(1, value.value * 0.15));
        expect(value.value, `${part.id}.${key}`).toBeGreaterThan(0);
      }
      for (const id of cited) expect(findPartSource(id), `${part.id}: unknown source ${id}`).toBeDefined();
    }
  });

  it('describes different parts differently, so that each one can be told apart', () => {
    const descriptions = parts.map(part => part.description);
    expect(descriptions.length - new Set(descriptions).size).toBe(0);
    expect(parts.map(part => part.title).length - new Set(parts.map(part => part.title)).size).toBe(0);
  });

  it('keeps the dimensions of each family physically consistent', () => {
    for (const part of parts) {
      const [d, message] = [dimension(part, 'd'), part.id];
      if (part.family === 'screw') {
        expect(METRIC_THREADS[part.attributes['thread'] as keyof typeof METRIC_THREADS], message).toBe(dimension(part, 'pitch'));
        if ('dk' in part.dimensions) expect(dimension(part, 'dk'), message).toBeGreaterThan(d);
        if (part.attributes['head'] === 'hex') expect(dimension(part, 'e'), message).toBeGreaterThan(dimension(part, 's'));
        else if ('s' in part.dimensions) expect(dimension(part, 's'), message).toBeLessThan(d);
      }
      if (part.family === 'nut') {
        expect(METRIC_THREADS[part.attributes['thread'] as keyof typeof METRIC_THREADS], message).toBe(dimension(part, 'pitch'));
        expect(dimension(part, 's'), message).toBeGreaterThan(d);
        if ('e' in part.dimensions && part.attributes['shape']?.startsWith('hex')) expect(dimension(part, 'e'), message).toBeCloseTo(dimension(part, 's') * 1.13, 0);
        if ('h' in part.dimensions) expect(dimension(part, 'h'), message).toBeGreaterThan(dimension(part, 'm'));
      }
      if (part.family === 'washer') {
        expect(dimension(part, 'd1'), message).toBeGreaterThan(Number(part.attributes['thread']?.slice(1)));
        expect(dimension(part, 'd2'), message).toBeGreaterThan(dimension(part, 'd1'));
      }
      if (part.family === 'threaded-insert') {
        expect(dimension(part, 'hole'), message).toBeLessThan(dimension(part, 'd'));
        expect(dimension(part, 'holeDepth'), message).toBeGreaterThan(dimension(part, 'l'));
      }
      if (part.family === 'insert-nut') {
        expect(dimension(part, 'core'), message).toBeLessThan(dimension(part, 'hole'));
        expect(dimension(part, 'hole'), message).toBeLessThan(dimension(part, 'd'));
      }
      if (part.family === 'wood-screw') expect(dimension(part, 'dk'), message).toBeGreaterThan(d);
      if (part.family === 'nail') expect(dimension(part, 'l'), message).toBeGreaterThan(dimension(part, 'd') * 5);
      if (part.family === 'levelling-foot') {
        expect(dimension(part, 'd1'), message).toBeGreaterThan(dimension(part, 's'));
        expect(dimension(part, 'l3'), message).toBeGreaterThan(dimension(part, 'l2'));
        expect(dimension(part, 'l5'), message).toBeGreaterThan(dimension(part, 'l4'));
      }
      if (part.family === 'toggle-latch') {
        expect(dimension(part, 'b1'), message).toBeGreaterThan(2 * d);
        expect(dimension(part, 'l1'), message).toBeGreaterThan(dimension(part, 'b3') + dimension(part, 'b4'));
        expect(dimension(part, 'l1'), message).toBeGreaterThan(dimension(part, 'l2'));
      }
      if (part.family === 'corner-bracket') {
        // legs longer than they are wide, a hole narrower than the leg, a plate thinner than the hole
        expect(dimension(part, 'a'), message).toBeGreaterThan(dimension(part, 'c'));
        expect(dimension(part, 'b'), message).toBeGreaterThan(dimension(part, 'c'));
        expect(dimension(part, 'c'), message).toBeGreaterThan(d);
        expect(dimension(part, 't'), message).toBeLessThan(d);
      }
      if (part.family === 'screen-hook') {
        // a strip wider than its hole and thicker than nothing, bent for a range of lips, with its tip shorter than its leg
        expect(dimension(part, 'w'), message).toBeGreaterThan(d);
        expect(dimension(part, 't'), message).toBeGreaterThan(0);
        expect(dimension(part, 'x2'), message).toBeGreaterThan(dimension(part, 'x1'));
        expect(dimension(part, 'l'), message).toBeGreaterThan(dimension(part, 'h'));
      }
      if (part.family === 'set-screw') {
        // a flat point narrower than the thread, a socket narrower than the point, shallower than the screw is long
        expect(METRIC_THREADS[part.attributes['thread'] as keyof typeof METRIC_THREADS], message).toBe(dimension(part, 'pitch'));
        expect(dimension(part, 'dp'), message).toBeLessThan(d);
        expect(dimension(part, 's'), message).toBeLessThan(dimension(part, 'dp'));
        expect(dimension(part, 't'), message).toBeLessThan(dimension(part, 'l'));
      }
      if (part.family === 'ball') expect(part.attributes['diameter'], message).toBe(`${d} mm`);
      if (part.family === 'spring') {
        // a coil wider than its wire, a least length shorter than the free one and longer than its active coils' wire, and the
        // maker's largest force equal to its rate times its greatest deflection
        expect(dimension(part, 'De'), message).toBeGreaterThan(4 * d);
        expect(dimension(part, 'Ln'), message).toBeLessThan(dimension(part, 'L0'));
        expect(dimension(part, 'Lndyn'), message).toBeGreaterThanOrEqual(dimension(part, 'Ln'));
        const coils = Number(/with ([\d.]+) active coils/.exec(part.description)?.[1]);
        expect(dimension(part, 'Ln'), message).toBeGreaterThan(coils * d);
        const force = Number(/Fn = ([\d.]+) N/.exec(part.notes ?? '')?.[1]);
        expect(springRate(part) * (dimension(part, 'L0') - dimension(part, 'Ln')), message).toBeCloseTo(force, 0);
      }
      if (part.family === 'split-ring') {
        // the band is the ring's radial width (one maker's A is 0.25 mm off it), of wire no thicker than the band, two turns thick
        expect(dimension(part, 'D'), message).toBeGreaterThan(d);
        expect(Math.abs(dimension(part, 'a') - (dimension(part, 'D') - d) / 2), message).toBeLessThan(0.3);
        expect(dimension(part, 'w'), message).toBeLessThanOrEqual(dimension(part, 'a'));
        expect(dimension(part, 'b'), message).toBeGreaterThan(dimension(part, 'w'));
        expect(dimension(part, 'b'), message).toBeLessThan(2 * dimension(part, 'w') + 0.5);
      }
      if (part.family === 'nfc-tag') {
        // a flat disc, its antenna inside it
        expect(dimension(part, 'h'), message).toBeLessThan(dimension(part, 'D') / 10);
        if ('antenna' in part.dimensions) expect(dimension(part, 'antenna'), message).toBeLessThan(dimension(part, 'D'));
        expect(part.attributes['memory'], message).toBe({ NTAG213: '144 bytes', NTAG215: '504 bytes', NTAG216: '888 bytes' }[part.attributes['chip'] ?? '']);
      }
      if (part.family === 'cat-collar') {
        // a strap far thinner than it is wide, for a cat's neck (about 15 to 35 cm)
        expect(part.dimensions['thickness']?.max ?? dimension(part, 'thickness'), message).toBeLessThan(dimension(part, 'width') / 4);
        expect(dimension(part, 'neckMax'), message).toBeGreaterThan(150);
        expect(dimension(part, 'neckMax'), message).toBeLessThan(350);
        if ('neckMin' in part.dimensions) expect(dimension(part, 'neckMin'), message).toBeLessThan(dimension(part, 'neckMax'));
      }
      if (part.family === 'bearing') expect(dimension(part, 'D'), message).toBeGreaterThan(d);
      if (part.family === 'magnet' && part.attributes['shape'] !== 'block') expect(dimension(part, 'diameter'), message).toBeGreaterThan(dimension(part, 'innerDiameter') || 0);
    }
  });

  it('lays out every development board inside its outline: pins on their grid, the receptacle at the USB end, components clear of the holes', () => {
    const boards = parts.filter(part => part.family === 'dev-board');
    expect(boards.map(part => part.id)).toEqual(['nologo-esp32-c3-supermini', 'waveshare-esp32-c3-zero']);
    for (const part of boards) {
      const layout = devBoardLayout(part); const message = part.id;
      if (!layout) throw new Error(`${part.id} has no layout`);
      const [L, W, t, e, e1, a, d] = ['L', 'W', 't', 'e', 'e1', 'a', 'd'].map(key => dimension(part, key)) as [number, number, number, number, number, number, number];
      // two rows e1 apart, centred across the board, at the pitch from the first pin down, every name once
      expect(layout.pins.length, message).toBe(Number(part.attributes['pins']));
      expect(new Set(layout.pins.map(pin => pin.name)).size, message).toBe(layout.pins.length);
      expect([...new Set(layout.pins.map(pin => pin.x))].sort((p, q) => p - q), message).toEqual([(W - e1) / 2, (W + e1) / 2]);
      for (const x of new Set(layout.pins.map(pin => pin.x))) {
        const ys = layout.pins.filter(pin => pin.x === x).map(pin => pin.y);
        expect(ys[0], message).toBeCloseTo(L - a, 2);
        for (let i = 1; i < ys.length; i++) expect((ys[i - 1] ?? 0) - (ys[i] ?? 0), message).toBeCloseTo(e, 2);
        expect(Math.min(...ys), message).toBeGreaterThan(d);
      }
      for (const name of ['5V', 'GND', '3V3']) expect(layout.pins.map(pin => pin.name), message).toContain(name);
      // the receptacle across the middle of the USB end, overhanging it
      const { usb } = layout;
      expect(usb.x1 - usb.x0, message).toBeCloseTo(dimension(part, 'usbW'), 2);
      expect(usb.y1 - L, message).toBeCloseTo(dimension(part, 'usbOverhang'), 2);
      expect(usb.x0, message).toBeGreaterThan(0); expect(usb.x1, message).toBeLessThan(W); expect(usb.y0, message).toBeLessThan(L);
      expect(Math.abs((usb.x0 + usb.x1) / 2 - W / 2), message).toBeLessThan(0.5);
      // each component inside the outline (by its turned footprint's bounds) and clear of every pin hole
      for (const component of layout.components) {
        const turn = component.rotation * Math.PI / 180;
        const halfX = (Math.abs(Math.cos(turn)) * component.width + Math.abs(Math.sin(turn)) * component.length) / 2;
        const halfY = (Math.abs(Math.sin(turn)) * component.width + Math.abs(Math.cos(turn)) * component.length) / 2;
        const where = `${message}: ${component.name}`;
        expect(component.x - halfX, where).toBeGreaterThanOrEqual(0); expect(component.x + halfX, where).toBeLessThanOrEqual(W);
        expect(component.y - halfY, where).toBeGreaterThanOrEqual(0); expect(component.y + halfY, where).toBeLessThanOrEqual(L);
        for (const pin of layout.pins) expect(Math.max(Math.abs(pin.x - component.x) - halfX, Math.abs(pin.y - component.y) - halfY), `${where} × ${pin.name}`).toBeGreaterThan(d / 2);
        expect(componentTop(component), where).toBeLessThanOrEqual(usb.height);
        expect(part.sources, `${where}: its size's source`).toContain(component.source);
        // a plunger or lens stands on its body, inside its footprint
        if (component.top) {
          expect(component.top.height, where).toBeGreaterThan(component.height);
          expect(component.top.width, where).toBeLessThanOrEqual(component.width);
          expect(component.top.length, where).toBeLessThanOrEqual(component.length);
        }
      }
      // two buttons (BOOT and reset), each with a plunger to press and its travel, standing above everything round them
      const buttons = layout.components.filter(component => component.kind === 'button');
      expect(buttons.map(button => button.name.split(' ')[0]), message).toEqual([expect.stringMatching(/^BOOT$/), expect.stringMatching(/^RE?S(ET|T)$/)]);
      for (const button of buttons) {
        expect(button.top && button.travel && button.travel > 0, `${message}: ${button.name}`).toBeTruthy();
        const near = layout.components.filter(other => other !== button && Math.hypot(other.x - button.x, other.y - button.y) < 4);
        for (const other of near) expect(componentTop(other), `${message}: ${other.name} beside ${button.name}`).toBeLessThan(componentTop(button));
      }
      // the antenna keep-out lies on the board, at the end away from the receptacle, round the antenna
      const antenna = layout.components.find(component => /antenna/i.test(component.name));
      const keepout = layout.antennaKeepout;
      expect(antenna && keepout.x0 <= antenna.x && antenna.x <= keepout.x1 && keepout.y0 <= antenna.y && antenna.y <= keepout.y1, message).toBe(true);
      expect(keepout.y1, message).toBeLessThan(L / 2);
      // the Zero's RGB LED is its data sheet's: a 2.0 × 1.8 mm base under a 1.34 mm lens, 0.8 mm high
      if (part.id === 'waveshare-esp32-c3-zero') {
        const led = layout.components.find(component => component.kind === 'led');
        expect(led && [led.width, led.length, led.height, led.top?.width, led.top?.length, led.top?.height, led.sized, led.source])
          .toEqual([1.8, 2, 0.28, 1.8, 1.34, 0.8, 'manufacturer', 'xinglight-xl-0807rgbc-ws2812b']);
      }
      // the overall height is the PCB and the tallest thing on it
      expect(dimension(part, 'H'), message).toBeCloseTo(t + usb.height, 2);
    }
  });

  it('keeps the rendered model of every part with an STL preview next to its SCAD source', () => {
    const withStl = parts.filter(part => part.preview.kind === 'stl');
    expect(withStl.map(part => part.id)).toContain('bic-j25-mini-lighter');
    for (const part of withStl) for (const extension of ['scad', 'stl'] as const) {
      const path = partAssetPath(part, extension);
      expect(path && existsSync(root(path)), `${part.id}.${extension}`).toBe(true);
    }
  });

  it('keeps the library’s lighter dimensions equal to its SCAD model', () => {
    const lighter = findPart('bic-j25-mini-lighter');
    const scad = readFileSync(root('parts/everyday-objects/bic-j25-mini-lighter.scad'), 'utf8');
    const value = (name: string) => Number(new RegExp(`^${name} = ([\\d.]+);`, 'm').exec(scad)?.[1]);
    if (!lighter) throw new Error('Expected the lighter');
    expect([dimension(lighter, 'height'), dimension(lighter, 'width'), dimension(lighter, 'thickness'), dimension(lighter, 'bodyHeight'), dimension(lighter, 'profileExponent')])
      .toEqual([value('HEIGHT'), value('WIDTH'), value('THICKNESS'), value('BODY_H'), value('PROFILE_N')]);
  });

  it('links models to the library: the plank connector’s screw sizes and the cigarette case’s lighter', () => {
    const screwHoles = plankConnector.controls.find(control => control.key === 'screwHoles');
    expect(screwHoles?.part).toEqual({ family: 'screw', attribute: 'thread', filter: null });
    // every screw size offered has screws in the library, and the clearance holes are the library's ISO 273 table
    for (const option of screwHoles?.options ?? []) if (option.value !== 'none') expect(parts.some(part => part.attributes['thread'] === option.value), option.value).toBe(true);
    expect(Object.keys(ISO_273_CLEARANCE_HOLES)).toEqual(Object.keys(METRIC_THREADS));
    const m3 = findPart('iso-4762-m3x10');
    if (!m3) throw new Error('Expected ISO 4762 M3 × 10');
    expect(partUsage(m3)).toEqual([{ modelId: 'plank-connector', modelTitle: plankConnector.title, via: 'Screw holes', kind: 'model' },
      // the toggle latch links it by its thread and as a machine screw it offers
      { modelId: 'toggle-latch', modelTitle: 'Toggle latch', via: 'Thread', kind: 'model' }, { modelId: 'toggle-latch', modelTitle: 'Toggle latch', via: 'Machine screw', kind: 'model' }]);
    const lighter = findPart('bic-j25-mini-lighter');
    if (!lighter) throw new Error('Expected the lighter');
    expect(partUsage(lighter)).toEqual([{ modelId: 'cigarette-case', modelTitle: cigaretteCase.title, via: 'Assembly preview', kind: 'model' }]);
    const bearing = findPart('bearing-608');
    if (!bearing) throw new Error('Expected the 608 bearing');
    expect(partUsage(bearing)).toEqual([]);
    // a part-linked control of any model names a family of the library, and its options exist there
    for (const model of models) for (const control of model.controls) if (control.part) {
      const linked = control.part;
      expect(partFamilies.map(family => family.id), `${model.id}.${control.key}`).toContain(linked.family);
      for (const option of control.options ?? []) {
        const exists = parts.some(part => part.family === linked.family && (linked.attribute ? part.attributes[linked.attribute] === option.value : part.id === option.value));
        expect(exists || option.value === 'none', `${model.id}.${control.key} = ${option.value}`).toBe(true);
      }
    }
  });
});
