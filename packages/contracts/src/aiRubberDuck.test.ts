import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { activeParts, aiDuckAssembly, aiRubberDuck, AI_DUCK_VARIANTS, AssemblySchema, RenderRequestSchema, resolveAssembly, scadDefines, validateParameters } from './index.ts';

describe('AI rubber duck', () => {
  for (const variant of AI_DUCK_VARIANTS) {
    it(`${variant}: exposes exactly its physical colored pieces and assembly moves`, () => {
      const parameters = { ...aiRubberDuck.defaults, variant };
      expect(validateParameters(aiRubberDuck, parameters)).toEqual([]);
      expect(Value.Check(RenderRequestSchema, { modelId: aiRubberDuck.id, modelVersion: '1', parameters })).toBe(true);
      const ids = activeParts(aiRubberDuck, parameters).map(part => part.id);
      const expected = variant.startsWith('codex') ? ['body', 'face', 'chevron', 'bar'] : variant === 'anthropic-v1-round' ? ['body', 'face', 'bar'] : ['body', 'face'];
      expect(ids).toEqual(expected);
      const assembly = resolveAssembly(aiRubberDuck, aiRubberDuck.assembly, parameters);
      expect(Value.Check(AssemblySchema, assembly)).toBe(true);
      expect(Object.keys(assembly?.poses ?? {})).toEqual(ids);
      expect(Object.keys(assembly?.partColors ?? {})).toEqual(ids);
      expect(new Set(assembly?.steps.flatMap(step => step.parts))).toEqual(new Set(ids.filter(id => id !== 'body')));
      expect(assembly?.partColors?.['body']).toBe(variant.endsWith('round') ? '#ffda4a' : '#f2e3c3');
      if (variant.startsWith('codex')) {
        expect(assembly?.steps[0]?.parts).toEqual(['chevron', 'bar']);
        expect(assembly?.steps[1]?.parts).toEqual(['face', 'chevron', 'bar']);
        expect(assembly?.partColors?.['bar']).toBe('#f5f2ea');
      }
      for (const part of activeParts(aiRubberDuck, parameters)) {
        const definitions = Object.fromEntries(scadDefines(aiRubberDuck, part, parameters));
        expect(definitions).toEqual({ VARIANT: JSON.stringify(variant), BODY_LENGTH: '90', CLEARANCE: '0.2', PART: JSON.stringify(part.id) });
      }
    });
  }

  it('accepts size and fit boundaries and rejects unsafe, nonfinite, unknown and injected values', () => {
    for (const bodyLength of [70, 90, 120]) for (const clearance of [0.1, 0.2, 0.25])
      expect(validateParameters(aiRubberDuck, { ...aiRubberDuck.defaults, bodyLength, clearance })).toEqual([]);
    for (const change of [{ bodyLength: 69 }, { bodyLength: 121 }, { bodyLength: NaN }, { clearance: 0.09 }, { clearance: 0.26 }, { variant: 'unknown' }, { PART: 'face' }, { RIBS: false }])
      expect(validateParameters(aiRubberDuck, { ...aiRubberDuck.defaults, ...change }).length).toBeGreaterThan(0);
  });

  it('moves the face and the terminal inserts together as body size changes', () => {
    const at = (bodyLength: number) => aiDuckAssembly({ ...aiRubberDuck.defaults, variant: 'codex-v2-sculpted', bodyLength });
    for (const bodyLength of [70, 120]) {
      const assembly = at(bodyLength), base = at(90);
      for (const id of ['face', 'chevron', 'bar'])
        assembly.poses[id]?.position.forEach((coordinate, axis) => expect(coordinate).toBeCloseTo((base.poses[id]?.position[axis] ?? 0) * bodyLength / 90));
      expect(assembly.poses['body']?.position).toEqual([0, 0, 0]);
    }
  });

  it('seats every face where the generator puts it, scaling with the body', () => {
    const expected: Record<string, { position: number[]; rotation: number[] }> = {
      'claude-v1-round': { position: [-32.5, 0, 61], rotation: [90, 0, -90] },
      'codex-v1-round': { position: [-31.4, 0, 61], rotation: [90, 0, -90] },
      'anthropic-v1-round': { position: [-32.6, 0, 61], rotation: [90, 0, -90] },
      'openai-v1-round': { position: [-31.8, 0, 61], rotation: [90, 0, -90] },
      'claude-v2-sculpted': { position: [-14, 0, 62], rotation: [90, 0, -90] },
      'codex-v2-sculpted': { position: [-44, 0, 60], rotation: [-90, 0, -90] },
      'anthropic-v2-sculpted': { position: [-14, 0, 58], rotation: [90, 0, -90] },
      'openai-v2-sculpted': { position: [-12, 0, 63], rotation: [90, 0, -90] },
    };
    for (const variant of AI_DUCK_VARIANTS) for (const bodyLength of [70, 90, 120]) {
      const s = bodyLength / 90, face = aiDuckAssembly({ ...aiRubberDuck.defaults, variant, bodyLength }).poses['face'];
      expect(face?.rotation).toEqual(expected[variant]?.rotation);
      expected[variant]?.position.forEach((coordinate, axis) => expect(face?.position[axis]).toBeCloseTo(coordinate * s));
    }
    const glyphs = aiDuckAssembly({ ...aiRubberDuck.defaults, variant: 'codex-v1-round' }).poses;
    expect(glyphs['chevron']).toEqual({ position: [-37.2, 0, 61], rotation: [90, 0, -90] });
    expect(glyphs['bar']).toEqual(glyphs['chevron']);
  });

  it('rejects conflicting generator constants', () => {
    const part = aiRubberDuck.parts[0];
    if (!part) throw new Error('Missing body');
    expect(() => scadDefines(aiRubberDuck, { ...part, scadConstants: { BODY_LENGTH: 1 } }, aiRubberDuck.defaults)).toThrow('Invalid generator constant');
    expect(() => scadDefines(aiRubberDuck, { ...part, scadConstants: { PART: Infinity } }, aiRubberDuck.defaults)).toThrow();
    expect(() => scadDefines(aiRubberDuck, { ...part, scadConstants: { 'BAD;': 'body' } }, aiRubberDuck.defaults)).toThrow();
  });
});
