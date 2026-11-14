import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { DEFAULT_WIRE_GUIDE_DESIGN, findModel, models, parts, partsOfFamily, validateWireGuideDesign, type ModelDefinition, type WireGuideDesign } from '@canfactory/contracts';
import { z, type Tool } from '@nntin/tinytinkerer-embed';
import { controllerSlot, createCanfactoryController, editorSession, NOT_MOUNTED } from './controller.ts';
import { assistantPolicy, IDENTITY } from './policy.ts';
import { editorHandle, toolGroup } from './tools.ts';

const byId = new Map(toolGroup.tools.map(tool => [tool.id, tool]));
function tool(id: string): Tool<unknown, unknown> {
  const found = byId.get(id);
  if (!found) throw new Error(`No tool ${id}`);
  return found;
}
/** Runs a tool as the runtime does: input parsed with its schema, output checked against its output schema. */
async function call(id: string, input: unknown): Promise<unknown> {
  const found = tool(id);
  const { schema, outputSchema } = found;
  const output = await found.execute(schema.parse(input));
  if (outputSchema) outputSchema.parse(output);
  return output;
}

describe('the CanFactory tool group', () => {
  it('has prefixed, unique ids (bare ids that collide with plugin tools are dropped) and convertible schemas', () => {
    expect(toolGroup.id).toBe('canfactory');
    expect(byId.size).toBe(toolGroup.tools.length);
    expect([...byId.keys()].sort()).toEqual(['canfactory_get_editor_state', 'canfactory_get_model_schema', 'canfactory_get_part', 'canfactory_get_prototype_board_layout',
      'canfactory_list_models', 'canfactory_query_prototype_board', 'canfactory_search_parts', 'canfactory_set_model_parameters', 'canfactory_validate_wire_guide_design']);
    for (const { schema, outputSchema } of toolGroup.tools) {
      // What the runtime sends the model as the tool's JSON Schema.
      expect(() => z.toJSONSchema(schema)).not.toThrow();
      expect(outputSchema).toBeDefined();
    }
  });

  it('can check a wire guide, but not open one yet (that needs #152 phase 2’s model)', () => {
    expect([...byId.keys()].filter(id => id.includes('wire_guide'))).toEqual(['canfactory_validate_wire_guide_design']);
  });
});

describe('parts tools', () => {
  it('describes every part of the library within its output schema', async () => {
    for (const part of parts) {
      const result = await call('canfactory_get_part', { id: part.id }) as { id: string; dimensions: { key: string }[] };
      expect(result.id).toBe(part.id);
      expect(result.dimensions.map(dimension => dimension.key).sort()).toEqual(Object.keys(part.dimensions).sort());
    }
  });

  it('searches by words, family and limit', async () => {
    const result = await call('canfactory_search_parts', { query: 'perma proto half' }) as { total: number; parts: { id: string }[] };
    expect(result.parts.map(part => part.id)).toContain('adafruit-perma-proto-half');
    const boards = await call('canfactory_search_parts', { family: 'prototype-board', limit: 2 }) as { total: number; parts: unknown[] };
    expect(boards.total).toBe(partsOfFamily('prototype-board').length);
    expect(boards.parts).toHaveLength(2);
  });

  it('rejects unknown ids and families, and limits past the bound', async () => {
    await expect(call('canfactory_get_part', { id: 'no-such-part' })).rejects.toThrow(/no part/);
    await expect(call('canfactory_search_parts', { family: 'no-such-family' })).rejects.toThrow(/no part family/);
    expect(tool('canfactory_search_parts').schema.safeParse({ limit: 500 }).success).toBe(false);
  });
});

describe('prototype-board tools', () => {
  it('summarises every board within its output schema, without listing every hole', async () => {
    for (const board of partsOfFamily('prototype-board')) {
      const summary = await call('canfactory_get_prototype_board_layout', { partId: board.id }) as Record<string, unknown>;
      expect(summary).not.toHaveProperty('holes');
      // The full Perma-Proto, with its ~120 five-hole strips, is the largest: about 12 kB, some 3k tokens.
      expect(JSON.stringify(summary).length).toBeLessThan(16_000);
    }
  });

  it('looks up holes, labels and copper connections on a half Perma-Proto', async () => {
    const result = await call('canfactory_query_prototype_board', {
      partId: 'adafruit-perma-proto-half',
      holes: [[0, 3], [0, 2]],
      labels: ['A1', 'Z99'],
      connected: [[[0, 3], [0, 7]], [[0, 3], [1, 3]], [[0, 0], [29, 0]]],
    });
    expect(result).toMatchObject({
      holes: [{ hole: [0, 3], drilled: true, label: 'A1', net: 'strip 1A-E' }, { hole: [0, 2], drilled: false }],
      labels: [{ query: 'A1', found: true, hole: [0, 3] }, { query: 'Z99', found: false }],
      connected: [{ connected: true, net: 'strip 1A-E' }, { connected: false, net: null }, { connected: true, net: 'rail bottom +' }],
    });
  });

  it('rejects a part that is not a board, and malformed holes', async () => {
    await expect(call('canfactory_get_prototype_board_layout', { partId: parts.find(part => part.family !== 'prototype-board')?.id })).rejects.toThrow(/not a prototype board/);
    expect(tool('canfactory_query_prototype_board').schema.safeParse({ partId: 'x', holes: [[-1, 0]] }).success).toBe(false);
    expect(tool('canfactory_query_prototype_board').schema.safeParse({ partId: 'x', holes: [[0.5, 0]] }).success).toBe(false);
  });
});

describe('canfactory_validate_wire_guide_design', () => {
  // Two wires on the half Perma-Proto, one print.
  const design = (): WireGuideDesign => ({
    schemaVersion: 1, boardPartId: 'adafruit-perma-proto-half', wirePartId: 'alpha-wire-3051-1',
    wires: [{ id: 'W1', from: [0, 3], to: [5, 3], path: [], level: 0 }, { id: 'W2', from: [2, 5], to: [2, 11], path: [], level: 0 }],
    prints: [{ id: 'G1', wireIds: ['W1', 'W2'] }],
    guide: { registration: 'mounting-holes', coverThickness: 1.2, channelClearance: 0.2, funnelTopDiameter: 2.2, funnelBottomDiameter: 1, funnelStandoff: 0.5 },
  });

  it('accepts a valid design', async () => {
    expect(await call('canfactory_validate_wire_guide_design', { design: design() })).toEqual({ valid: true, issues: [] });
  });

  it('reports exactly the shared validation’s issues, malformed designs included, as the API and the worker do', async () => {
    const crossing = design();
    crossing.wires.push({ id: 'W3', from: [4, 1], to: [4, 6], path: [], level: 0 });
    for (const candidate of [crossing, { ...design(), boardPartId: 'm3-hex-nut' }, { schemaVersion: 2 }, 'not a design', null]) {
      const result = await call('canfactory_validate_wire_guide_design', { design: candidate }) as { valid: boolean; issues: unknown[] };
      expect(result.valid).toBe(false);
      expect(result.issues).toEqual(validateWireGuideDesign(candidate));
    }
  });
});

describe('model tools', () => {
  it('lists every model and describes every model’s parameters within the output schemas', async () => {
    const list = await call('canfactory_list_models', {}) as { models: { id: string }[] };
    expect(list.models.map(model => model.id)).toEqual(models.map(model => model.id));
    for (const model of models) {
      const schema = await call('canfactory_get_model_schema', { modelId: model.id }) as { parameters: { key: string; default: unknown }[] };
      expect(schema.parameters.map(parameter => parameter.key)).toEqual(model.controls.map(control => control.key));
      // The defaults it reports are a valid parameter set of the model.
      expect(Value.Check(model.parameterSchema, Object.fromEntries(schema.parameters.map(parameter => [parameter.key, parameter.default])))).toBe(true);
    }
  });

  it('reports a document parameter with its whole default document', async () => {
    const schema = await call('canfactory_get_model_schema', { modelId: 'prototype-wire-guide' }) as { parameters: { key: string; kind: string; default: unknown }[] };
    expect(schema.parameters).toMatchObject([{ key: 'design', kind: 'document', default: DEFAULT_WIRE_GUIDE_DESIGN }]);
  });
});

describe('editor tools through the stage handle', () => {
  const trap = findModel('fruit-fly-trap') as ModelDefinition;

  it('fail with a clear message until the app installs its controller', async () => {
    controllerSlot.set(null);
    await expect(editorHandle.request('canfactory_get_editor_state', {})).rejects.toThrow(NOT_MOUNTED);
  });

  it('reach the app’s controller, and validate what it returns', async () => {
    const opened: string[] = [];
    controllerSlot.set(createCanfactoryController({ openModel: id => { opened.push(id); }, savedParameters: model => ({ ...model.defaults }) }));
    editorSession.set(null);
    await expect(call('canfactory_get_editor_state', {})).rejects.toThrow(/No model is open/);
    expect(await call('canfactory_set_model_parameters', { modelId: trap.id, parameters: { trapHeight: 80 } })).toMatchObject({ ok: true, opened: true });
    expect(opened).toEqual([trap.id]);
    expect(await call('canfactory_set_model_parameters', { modelId: trap.id, parameters: { trapHeight: 1e6 } })).toMatchObject({ ok: false });
    // A malformed result (here: a controller bug) fails the call instead of reaching the model.
    controllerSlot.set({ ...createCanfactoryController({ openModel: () => undefined, savedParameters: () => ({}) }), canfactory_get_editor_state: () => ({ modelId: 1 }) as never });
    await expect(call('canfactory_get_editor_state', {})).rejects.toThrow();
    controllerSlot.set(null);
  });
});

describe('the assistant policy', () => {
  it('names CanFactory, and only describes tools the turn has', () => {
    expect(assistantPolicy.identity).toBe(IDENTITY);
    const all = assistantPolicy.instructions?.({ boundary: 'synthesis', toolIds: [...byId.keys()] }) ?? '';
    expect(all).toContain('canfactory_set_model_parameters');
    expect(all).toMatch(/never invent a dimension/i);
    expect(all).toContain('canfactory_validate_wire_guide_design');
    const none = assistantPolicy.instructions?.({ boundary: 'decision', toolIds: [] }) ?? '';
    expect(none).not.toContain('canfactory_');
    expect(none).toMatch(/clarifying question/);
  });
});
