import { existsSync, readFileSync } from 'node:fs';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { cigaretteCase, models, partUsage, plankConnector } from '../models.ts';
import { findPart, findPartSource, ISO_273_CLEARANCE_HOLES, METRIC_THREADS, PART_SOURCES, partAssetPath, partFamilies, parts, PartFamilySchema, PartSchema, PartSourceSchema, type Part } from './index.ts';

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
      if (part.family === 'bearing') expect(dimension(part, 'D'), message).toBeGreaterThan(d);
      if (part.family === 'magnet' && part.attributes['shape'] !== 'block') expect(dimension(part, 'diameter'), message).toBeGreaterThan(dimension(part, 'innerDiameter') || 0);
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
    expect(partUsage(m3)).toEqual([{ modelId: 'plank-connector', modelTitle: plankConnector.title, via: 'Screw holes' }]);
    const lighter = findPart('bic-j25-mini-lighter');
    if (!lighter) throw new Error('Expected the lighter');
    expect(partUsage(lighter)).toEqual([{ modelId: 'cigarette-case', modelTitle: cigaretteCase.title, via: 'Assembly preview' }]);
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
