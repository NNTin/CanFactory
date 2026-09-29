import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { Value } from 'typebox/value';
import { assemblyOffset, assemblyState, assemblyStops, resolveAssembly } from './assembly.ts';
import { activeParts, AssemblySchema, isAssembly, models, type Assembly } from './models.ts';
import { findPart, partAssetPath } from './parts/index.ts';

const assembly: Assembly = {
  poses: { base: { position: [0, 0, 0] }, top: { position: [0, 0, 10] }, insert: { position: [1, 0, 5] } },
  steps: [
    { title: 'Insert', parts: ['insert'], from: [0, 0, -20] },
    { title: 'Close', parts: ['top', 'insert'], from: [0, 0, 30] },
  ],
  lift: 25,
};

describe('assembly slider', () => {
  it('has a stop for the print bed, the exploded layout and each step, on segment boundaries', () => {
    expect(assemblyStops(assembly)).toBe(4);
    expect(assemblyState(assembly, 0)).toEqual({ arrange: 0, steps: [0, 0] });
    expect(assemblyState(assembly, 1 / 3)).toEqual({ arrange: 1, steps: [0, 0] });
    expect(assemblyState(assembly, 2 / 3)).toEqual({ arrange: 1, steps: [1, 0] });
    expect(assemblyState(assembly, 1)).toEqual({ arrange: 1, steps: [1, 1] });
    expect(assemblyState(assembly, 1.5)).toEqual(assemblyState(assembly, 1));
    expect(assemblyState(assembly, -1)).toEqual(assemblyState(assembly, 0));
  });

  it('eases each segment, symmetrically and without overshoot', () => {
    const half = assemblyState(assembly, 1 / 6);
    expect(half.arrange).toBeCloseTo(0.5);
    for (let t = 0; t <= 1; t += 0.01) {
      const { arrange, steps } = assemblyState(assembly, t);
      for (const value of [arrange, ...steps]) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
    }
  });

  it('offsets each part by the unplayed steps it moves in, plus the lift until the last step has played', () => {
    const exploded = assemblyState(assembly, 1 / 3);
    expect(assemblyOffset(assembly, 'base', exploded)).toEqual([0, 0, 25]);
    expect(assemblyOffset(assembly, 'top', exploded)).toEqual([0, 0, 55]);
    expect(assemblyOffset(assembly, 'insert', exploded)).toEqual([0, 0, 35]);
    // After the first step only the insert has moved.
    const inserted = assemblyState(assembly, 2 / 3);
    expect(assemblyOffset(assembly, 'insert', inserted)).toEqual([0, 0, 55]);
    expect(assemblyOffset(assembly, 'top', inserted)).toEqual([0, 0, 55]);
    expect(assemblyOffset(assembly, 'base', inserted)).toEqual([0, 0, 25]);
    // Assembled: every part at its pose, on the floor.
    for (const id of Object.keys(assembly.poses)) expect(assemblyOffset(assembly, id, assemblyState(assembly, 1))).toEqual([0, 0, 0]);
  });
  it('scales every position, step offset and the lift by the model’s assembly scale, and leaves a full-size assembly as it is', () => {
    const model = { assemblyScale: (parameters: Record<string, unknown>) => Number(parameters['scale']) };
    expect(resolveAssembly(model, assembly, { scale: 1 })).toBe(assembly);
    const small = resolveAssembly(model, assembly, { scale: 0.5 });
    expect(small).toEqual({
      poses: { base: { position: [0, 0, 0] }, top: { position: [0, 0, 5] }, insert: { position: [0.5, 0, 2.5] } },
      steps: [{ title: 'Insert', parts: ['insert'], from: [0, 0, -10] }, { title: 'Close', parts: ['top', 'insert'], from: [0, 0, 15] }],
      lift: 12.5,
    });
    // Every offset along the slider is scaled with it.
    const exploded = assemblyState(assembly, 1 / 3);
    if (!small) throw new Error('Expected an assembly');
    expect(assemblyOffset(small, 'top', exploded)).toEqual([0, 0, 27.5]);
  });
});

describe('registered assemblies', () => {
  for (const model of models.filter(candidate => candidate.assembly)) {
    it(`${model.id}: names only its own parts and is valid for the API`, () => {
      const { assembly: data } = model;
      if (!data || !isAssembly(model)) throw new Error('Expected an assembly model');
      expect(Value.Check(AssemblySchema, data)).toBe(true);
      const references = (data.references ?? []).map(reference => reference.id);
      const ids = [...model.parts.map(part => part.id), ...references];
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.filter(id => !(id in data.poses))).toEqual([]);
      for (const id of [...Object.keys(data.poses), ...data.steps.flatMap(step => step.parts)]) expect(ids).toContain(id);
      expect(data.steps.length).toBeGreaterThan(0);
      expect(data.lift).toBeGreaterThanOrEqual(0);
      // Reference objects are shown, never printed: each is a parts-library entry with its source and the STL the preview
      // bundles, and none is rendered.
      for (const reference of data.references ?? []) {
        const part = findPart(reference.part);
        if (!part) throw new Error(`${reference.id}: ${reference.part} is not in the parts library`);
        expect(reference.title).toBe(part.title);
        for (const extension of ['scad', 'stl'] as const) expect(existsSync(partAssetPath(part, extension) ?? ''), `${reference.id}.${extension}`).toBe(true);
        expect(activeParts(model, model.defaults).map(active => active.id)).not.toContain(reference.id);
      }
    });
  }

  it('shows the BIC Mini lighter in the cigarette case, inserted before the case is closed, without adding a part to print', () => {
    const cigaretteCase = models.find(model => model.id === 'cigarette-case');
    if (!cigaretteCase?.assembly || !isAssembly(cigaretteCase)) throw new Error('Expected the cigarette case assembly');
    expect(cigaretteCase.assembly.references).toEqual([{ id: 'mini-bic-lighter', part: 'bic-j25-mini-lighter', title: 'BIC Mini lighter (J25)' }]);
    expect(cigaretteCase.parts.map(part => part.id)).not.toContain('mini-bic-lighter');
    expect(cigaretteCase.assembly.steps.map(step => step.title).slice(-2)).toEqual(['Insert the lighter into its bay', 'Close the case']);
  });
});
