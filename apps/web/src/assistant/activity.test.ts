import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_WIRE_GUIDE_DESIGN, findModel, validateWireGuideDesign, type ModelDefinition, type WireGuideDesign } from '@canfactory/contracts';
import type { ActivityView } from '@nntin/tinytinkerer-embed';
import { createCanfactoryController, createEditorSession, editorHandle, editorSession, type EditorState } from './controller.ts';
import { toolGroup } from './tools.ts';

// Each case runs the real registered tool (input schema, execute, output schema, as the runtime does) and summarizes what it
// returned with the tool's own summarizer, as the activity panel does.
const byId = new Map(toolGroup.tools.map(tool => [tool.id, tool]));
function summarizer(id: string) {
  const summarize = byId.get(id)?.summarizeActivity;
  if (!summarize) throw new Error(`${id} has no activity summarizer`);
  return summarize;
}
async function run(id: string, input: Record<string, unknown>): Promise<{ output: unknown; view: ActivityView }> {
  const tool = byId.get(id);
  if (!tool) throw new Error(`No tool ${id}`);
  const output = await tool.execute(tool.schema.parse(input));
  tool.outputSchema?.parse(output);
  return { output, view: await summarizer(id)(output, input) };
}
/** A view's status and title: `title` as a pattern, or as a part of it. */
function expectView(view: ActivityView, status: ActivityView['status'], title: RegExp | string) {
  expect(view.status).toBe(status);
  expect(view.title).toMatch(title);
}
const texts = (view: ActivityView) => view.sections.flatMap(section => section.kind === 'text' ? [section.value] : []);
const raw = (view: ActivityView) => view.sections.find(section => section.kind === 'json' && section.label === 'Output');

const BOARD = 'adafruit-perma-proto-half';
const design = (): WireGuideDesign => ({
  schemaVersion: 1, boardPartId: BOARD, wirePartId: 'alpha-wire-3051-1',
  wires: [{ id: 'W1', from: [0, 3], to: [5, 3], path: [], level: 0 }, { id: 'W2', from: [2, 5], to: [2, 11], path: [], level: 0 }],
  prints: [{ id: 'G1', wireIds: ['W1', 'W2'] }],
  guide: { registration: 'mounting-holes', coverThickness: 1.2, channelClearance: 0.2, funnelTopDiameter: 2.2, funnelBottomDiameter: 1, funnelStandoff: 0.5 },
});

describe('every CanFactory tool', () => {
  it('has a summarizer, so a known result never falls back to Unknown', () => {
    expect(toolGroup.tools.filter(tool => !tool.summarizeActivity).map(tool => tool.id)).toEqual([]);
  });

  it('keeps an absent, malformed or foreign result Unknown, with what came back', async () => {
    for (const tool of toolGroup.tools) {
      for (const output of [undefined, null, { unexpected: true }, 'text']) {
        const view = await summarizer(tool.id)(output, {});
        expect(view.status, `${tool.id} ${JSON.stringify(output)}`).toBe('unknown');
        expect(view.title).toMatch(/unrecognized result$/);
        expect(raw(view)).toEqual(output === undefined || output === null ? undefined : { kind: 'json', label: 'Output', value: output });
      }
    }
    // Near misses too: a search result whose total isn't a number, a query pair without its verdict.
    expect((await summarizer('canfactory_search_parts')({ total: '1', parts: [], families: [] })).status).toBe('unknown');
    expect((await summarizer('canfactory_query_prototype_board')({ holes: [], labels: [], connected: [{ a: [0, 3], b: [0, 7], net: null }] })).status).toBe('unknown');
    expect((await summarizer('canfactory_open_wire_guide_design')({ ok: true })).status).toBe('unknown');
  });

  it('leaves a thrown call to the runtime: an exception is an execution failure, not a result to summarize', async () => {
    const tool = byId.get('canfactory_get_part');
    await expect((async () => tool?.execute({ id: 'no-such-part' }))()).rejects.toThrow(/no part/);
  });
});

describe('catalogue reads', () => {
  it('counts the parts a search matched', async () => {
    const { view, output } = await run('canfactory_search_parts', { query: 'perma proto half' });
    expect(view.status).toBe('ok');
    expect(view.title).toMatch(/^Search parts: (1 part matches|\d+ parts match) “perma proto half”$/);
    expect(texts(view).some(line => line.startsWith(`${BOARD}: `))).toBe(true);
    expect(raw(view)?.kind === 'json' && raw(view)).toMatchObject({ value: output });
  });

  it('says how many it shows when the limit cuts the matches', async () => {
    const { view, output } = await run('canfactory_search_parts', { family: 'prototype-board', limit: 1 });
    expect((output as { total: number }).total).toBeGreaterThan(1);
    expectView(view, 'ok', /parts match in prototype-board, showing 1$/);
  });

  it('reports no matches as a successful search, not a failure', async () => {
    const { view, output } = await run('canfactory_search_parts', { query: 'zzz-no-such-part' });
    expect(output).toMatchObject({ total: 0, parts: [] });
    expect(view).toMatchObject({ status: 'ok', title: 'Search parts: no parts match “zzz-no-such-part”' });
    expect(texts(view)[0]).toMatch(/families available: .*prototype-board/);
  });

  it('describes a part and a board layout, without dumping the board into the collapsed line', async () => {
    expectView((await run('canfactory_get_part', { id: BOARD })).view, 'ok', new RegExp(`^Part: .+ \\(${BOARD}\\), \\d+ dimensions from \\d+ sources?$`));
    const { view, output } = await run('canfactory_get_prototype_board_layout', { partId: BOARD });
    const layout = output as { grid: { columns: number; rows: number }; holeCount: number; nets: unknown[] };
    expect(view.status).toBe('ok');
    expect(view.title).toBe(`Board layout: ${BOARD}, ${layout.grid.columns} × ${layout.grid.rows} grid at 2.5 mm, ${layout.holeCount} holes, ${layout.nets.length} nets`);
    expect(view.title.length).toBeLessThan(120);
    // The whole layout stays available, expanded only.
    expect(raw(view)).toEqual({ kind: 'json', label: 'Output', value: output });
  });

  it('describes the model catalogue and a model’s parameters', async () => {
    expectView((await run('canfactory_list_models', {})).view, 'ok', /^Models: \d+ models, \d+ adjustable$/);
    expectView((await run('canfactory_get_model_schema', { modelId: 'fruit-fly-trap' })).view, 'ok', /^Model parameters: Fruit fly trap \(fruit-fly-trap\), \d+ parameters/);
  });
});

describe('board queries', () => {
  it('counts connected and disconnected pairs; a disconnected pair is a successful answer', async () => {
    const { view } = await run('canfactory_query_prototype_board', { partId: BOARD, labels: ['A1', 'Z99'], connected: [[[0, 3], [0, 7]], [[0, 3], [1, 3]]] });
    expect(view.status).toBe('ok');
    expect(view.title).toBe(`Board query: ${BOARD}, 2 labels (1 found); 2 pairs: 1 connected, 1 not connected`);
    expect(texts(view)).toEqual(['A1 → [0, 3], strip 1A-E', 'Z99: no such label', '[0, 3]–[0, 7]: connected (strip 1A-E)', '[0, 3]–[1, 3]: not connected']);
  });

  it('reports only disconnected pairs as ok too', async () => {
    const { view } = await run('canfactory_query_prototype_board', { partId: BOARD, connected: [[[0, 3], [1, 3]]] });
    expect(view).toMatchObject({ status: 'ok', title: `Board query: ${BOARD}, 1 pair: 0 connected, 1 not connected` });
  });

  it('warns, without failing the read, when a pair names an undrilled hole', async () => {
    const { view } = await run('canfactory_query_prototype_board', { partId: BOARD, holes: [[0, 3], [0, 2]], connected: [[[0, 2], [0, 3]]] });
    expect(view.status).toBe('warn');
    expect(view.title).toBe(`Board query: ${BOARD}, 2 holes (1 drilled); 1 pair: 0 connected, 1 not connected, 1 naming an undrilled hole`);
    expect(texts(view)).toContain('[0, 2]–[0, 3]: not connected; Not a drilled hole of this board.');
  });
});

describe('design validation', () => {
  it('reports a valid design', async () => {
    expect((await run('canfactory_validate_wire_guide_design', { design: design() })).view).toMatchObject({ status: 'ok', title: 'Validate design: design valid, no issues' });
  });

  it('names an invalid design’s issues, the first in the collapsed line and every one expanded', async () => {
    const crossing = design();
    crossing.wires.push({ id: 'W3', from: [4, 1], to: [4, 6], path: [], level: 0 }, { id: 'W4', from: [99, 0], to: [99, 1], path: [], level: 0 });
    const expected = validateWireGuideDesign(crossing);
    expect(expected.length).toBeGreaterThan(1);
    const { view } = await run('canfactory_validate_wire_guide_design', { design: crossing });
    expect(view.status).toBe('error');
    expect(view.title).toContain(`design invalid, ${expected.length} issues: ${expected[0]?.path}: `);
    expect(texts(view)).toEqual(expected.map(issue => `• ${issue.path}: ${issue.message}`));
  });

  it('names the issue of a design that is not one at all', async () => {
    const { view } = await run('canfactory_validate_wire_guide_design', { design: null });
    expectView(view, 'error', /^Validate design: design invalid, 1 issue: \(design\): /);
  });

  it('does not call a contradictory result valid', async () => {
    const view = await summarizer('canfactory_validate_wire_guide_design')({ valid: true, issues: [{ path: '/wires', message: 'x' }] });
    expect(view).toMatchObject({ status: 'warn', title: 'Validate design: reported valid, but with 1 issue: /wires: x' });
  });
});

describe('editor tools', () => {
  const trap = findModel('fruit-fly-trap') as ModelDefinition;
  const guide = findModel('prototype-wire-guide') as ModelDefinition;
  const state = (model: ModelDefinition, render: Partial<EditorState['render']>, issues: EditorState['issues'] = []): EditorState => ({
    modelId: model.id, modelVersion: model.version, title: model.title, parameters: { ...model.defaults }, issues,
    render: { status: 'ready', error: null, dimensions: null, parts: null, volumeMm3: null, ...render },
  });
  /** The app's controller over a mounted editor whose snapshot the test sets. */
  function mount(model: ModelDefinition, initial: EditorState) {
    let current = initial;
    const opened: string[] = [];
    editorSession.set(createEditorSession(model, () => current, () => undefined));
    editorHandle.setController(createCanfactoryController({ openModel: id => { opened.push(id); }, savedParameters: m => ({ ...m.defaults }) }));
    return { opened, commit(next: EditorState) { current = next; } };
  }
  afterEach(() => { editorHandle.setController(null); editorSession.set(null); });

  it('summarizes each observed render status as that read’s observation', async () => {
    const editor = mount(trap, state(trap, { status: 'queued' }));
    const read = async () => (await run('canfactory_get_editor_state', {}));
    const queued = await read();
    expect(queued.view).toMatchObject({ status: 'ok', title: 'Editor state: Fruit fly trap, render queued when read, not ready' });
    editor.commit(state(trap, { status: 'rendering', dimensions: { x: 80, y: 104, z: 60 } }));
    const rendering = (await read()).view;
    expect(rendering).toMatchObject({ status: 'ok', title: 'Editor state: Fruit fly trap, rendering when read, not ready' });
    // The older render's size is not passed off as the new one's.
    expect(texts(rendering)).toContain('Last finished render (older settings): 80 × 104 × 60 mm');
    editor.commit(state(trap, { status: 'updating' }));
    expect((await read()).view.title).toBe('Editor state: Fruit fly trap, render pending for new settings when read, not ready');
    editor.commit(state(trap, { status: 'failed', error: 'Rendering exceeded the 120-second limit.' }));
    expect((await read()).view).toMatchObject({ status: 'error', title: 'Editor state: Fruit fly trap, render failed: Rendering exceeded the 120-second limit.' });
    editor.commit(state(trap, { status: 'invalid' }, [{ field: 'trapHeight', message: 'must be at most 150' }]));
    expect((await read()).view).toMatchObject({ status: 'error', title: 'Editor state: Fruit fly trap, settings invalid so nothing renders, 1 issue: trapHeight: must be at most 150' });
    editor.commit(state(trap, { status: 'ready', dimensions: { x: 80, y: 104.25, z: 60 } }));
    expect((await read()).view).toMatchObject({ status: 'ok', title: 'Editor state: Fruit fly trap, render ready (80 × 104.3 × 60 mm)' });
    editor.commit(state(guide, { status: 'ready', parts: 2, volumeMm3: 1234.56 }));
    expect((await read()).view.title).toBe(`Editor state: ${guide.title}, render ready (2 parts, 1234.6 mm³)`);
    // A summary is of the recorded result: the queued read still says queued once the editor is ready, never “ready”.
    expect((await summarizer('canfactory_get_editor_state')(queued.output, {})).title).toBe(queued.view.title);
  });

  it('says a parameter change requested a render, not that it rendered, and a read right after reports it pending', async () => {
    mount(trap, state(trap, { status: 'ready', dimensions: { x: 80, y: 104, z: 60 } }));
    const { view } = await run('canfactory_set_model_parameters', { modelId: trap.id, parameters: { trapHeight: 80 } });
    expect(view).toMatchObject({ status: 'ok', title: 'Set parameters: fruit-fly-trap, set trapHeight; render requested, not ready yet' });
    expect((await run('canfactory_get_editor_state', {})).view.title).toMatch(/render pending for new settings when read, not ready$/);
  });

  it('notes when the change opened the model’s editor', async () => {
    const editor = mount(guide, state(guide, { status: 'ready' }));
    const { view } = await run('canfactory_set_model_parameters', { modelId: trap.id, parameters: { trapHeight: 80 } });
    expect(view.title).toBe('Set parameters: fruit-fly-trap, set trapHeight, opened its editor; render requested, not ready yet');
    expect(editor.opened).toEqual([trap.id]);
  });

  it('exposes a rejected parameter change and its issues', async () => {
    mount(trap, state(trap, { status: 'ready' }));
    const { view, output } = await run('canfactory_set_model_parameters', { modelId: trap.id, parameters: { trapHeight: 1e6 } });
    const [first] = (output as { ok: false; issues: { field: string; message: string }[] }).issues;
    expect(view.status).toBe('error');
    expect(view.title).toMatch(/^Set parameters: rejected, nothing changed, \d+ issues?: /);
    expect(view.title).toContain(`${first?.field}: `);
    // Unknown models and the wire guide's document are rejected the same way.
    expectView((await run('canfactory_set_model_parameters', { modelId: 'no-such-model', parameters: {} })).view, 'error', 'modelId: There is no model “no-such-model”');
    expectView((await run('canfactory_set_model_parameters', { modelId: guide.id, parameters: {} })).view, 'error', 'design: ');
  });

  it('says an opened design is opened with its render requested, never rendered', async () => {
    const editor = mount(trap, state(trap, { status: 'ready' }));
    const { view } = await run('canfactory_open_wire_guide_design', { design: DEFAULT_WIRE_GUIDE_DESIGN });
    expect(view.status).toBe('ok');
    expect(view.title).toMatch(/^Open design: opened the design on .+, \d+ wires?, \d+ prints?; render requested, not ready yet$/);
    expect(view.title).not.toMatch(/render ready|rendered/);
    expect(editor.opened).toEqual(['prototype-wire-guide']);
  });

  it('exposes a rejected design and its issues, with nothing opened', async () => {
    const editor = mount(trap, state(trap, { status: 'ready' }));
    const invalid = { ...design(), boardPartId: 'm3-hex-nut' };
    const [first] = validateWireGuideDesign(invalid);
    const { view } = await run('canfactory_open_wire_guide_design', { design: invalid });
    expect(view.status).toBe('error');
    expect(view.title).toContain(`Open design: design rejected, nothing opened, 1 issue: ${first?.path}: ${first?.message.slice(0, 40)}`);
    expect(editor.opened).toEqual([]);
  });
});
