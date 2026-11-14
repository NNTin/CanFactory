import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_WIRE_GUIDE_DESIGN, findModel, validateParameters, validateWireGuideDesign, type ModelDefinition, type ParameterValues, type WireGuideDesign } from '@canfactory/contracts';
import { createCanfactoryController, createEditorSession, editorSession, NO_EDITOR, takePendingParameters, type EditorSession, type EditorState } from './controller.ts';

const trap = findModel('fruit-fly-trap') as ModelDefinition;
const duck = findModel('ai-rubber-duck') as ModelDefinition;
const guide = findModel('prototype-wire-guide') as ModelDefinition;

/** A mounted editor of `model`, as the Editor component registers it. */
function mount(model: ModelDefinition, parameters: ParameterValues = { ...model.defaults }) {
  const state: EditorState = { modelId: model.id, modelVersion: model.version, title: model.title, parameters, issues: [],
    render: { status: 'ready', error: null, dimensions: { x: 1, y: 2, z: 3 }, parts: null, volumeMm3: 1000 } };
  const setParameters = vi.fn((next: ParameterValues) => { state.parameters = next; });
  const session: EditorSession = { model, state: () => state, setParameters };
  editorSession.set(session);
  return { state, setParameters };
}

function controller() {
  const openModel = vi.fn<(id: string) => void>();
  const savedParameters = vi.fn((model: ModelDefinition) => ({ ...model.defaults }));
  return { openModel, savedParameters, controller: createCanfactoryController({ openModel, savedParameters }) };
}

describe('canfactory_get_editor_state', () => {
  it('fails with a clear message when no model is open', () => {
    editorSession.set(null);
    expect(() => controller().controller.canfactory_get_editor_state({})).toThrow(NO_EDITOR);
  });

  it('reads the mounted editor', () => {
    const { state } = mount(trap);
    expect(controller().controller.canfactory_get_editor_state({})).toBe(state);
  });
});

describe('canfactory_set_model_parameters', () => {
  it('changes the open editor’s parameters, keeping the others', () => {
    const { setParameters } = mount(trap, { ...trap.defaults, brimWidth: 12 });
    const { controller: tools, openModel } = controller();
    const result = tools.canfactory_set_model_parameters({ modelId: trap.id, parameters: { trapHeight: 80 } });
    expect(result).toMatchObject({ ok: true, opened: false, parameters: { trapHeight: 80, brimWidth: 12 } });
    expect(setParameters).toHaveBeenCalledWith({ ...trap.defaults, brimWidth: 12, trapHeight: 80 });
    expect(openModel).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range value instead of clamping it, and changes nothing', () => {
    const { setParameters, state } = mount(trap);
    const result = controller().controller.canfactory_set_model_parameters({ modelId: trap.id, parameters: { trapHeight: 500 } });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.some(issue => issue.field === 'trapHeight')).toBe(true);
    expect(setParameters).not.toHaveBeenCalled();
    expect(state.parameters['trapHeight']).toBe(trap.defaults['trapHeight']);
  });

  it('rejects a value of the wrong type', () => {
    mount(trap);
    const result = controller().controller.canfactory_set_model_parameters({ modelId: trap.id, parameters: { handles: 'yes' } });
    expect(result).toMatchObject({ ok: false, issues: [{ field: 'handles' }] });
  });

  it('rejects parameters the model doesn’t have, and unknown models', () => {
    mount(trap);
    const { controller: tools } = controller();
    expect(tools.canfactory_set_model_parameters({ modelId: trap.id, parameters: { height: 80 } })).toMatchObject({ ok: false, issues: [{ field: 'height' }] });
    expect(tools.canfactory_set_model_parameters({ modelId: 'no-such-model', parameters: {} })).toMatchObject({ ok: false, issues: [{ field: 'modelId' }] });
  });

  it('opens another model, starting from its saved settings plus the change', () => {
    const { setParameters } = mount(trap);
    const { controller: tools, openModel, savedParameters } = controller();
    const key = Object.keys(duck.defaults).find(name => typeof duck.defaults[name] === 'number') as string;
    const control = duck.controls.find(item => item.key === key);
    const value = (control?.minimum ?? 0) + (control?.step ?? 1);
    const result = tools.canfactory_set_model_parameters({ modelId: duck.id, parameters: { [key]: value } });
    expect(result).toMatchObject({ ok: true, opened: true, modelId: duck.id });
    expect(savedParameters).toHaveBeenCalledWith(duck);
    expect(openModel).toHaveBeenCalledWith(duck.id);
    expect(setParameters).not.toHaveBeenCalled();
    // The duck's editor picks them up once, when it mounts.
    expect(takePendingParameters(duck)).toEqual({ ...duck.defaults, [key]: value });
    expect(takePendingParameters(duck)).toBeUndefined();
  });

  it('opens a model when no editor is mounted', () => {
    editorSession.set(null);
    const { controller: tools, openModel } = controller();
    expect(tools.canfactory_set_model_parameters({ modelId: trap.id, parameters: { trapHeight: 80 } })).toMatchObject({ ok: true, opened: true });
    expect(openModel).toHaveBeenCalledWith(trap.id);
    expect(takePendingParameters(trap)).toMatchObject({ trapHeight: 80 });
  });

  it('doesn’t open the wire guide (a document parameter), with or without a design, and points to its own tool', () => {
    editorSession.set(null);
    const { controller: tools, openModel } = controller();
    for (const parameters of [{ design: guide.defaults['design'] }, {}] as ParameterValues[]) {
      const result = tools.canfactory_set_model_parameters({ modelId: guide.id, parameters });
      expect(result).toMatchObject({ ok: false, issues: [{ field: 'design', message: expect.stringContaining('canfactory_open_wire_guide_design') as unknown }] });
    }
    // Not even with the wire guide's editor open.
    const { setParameters } = mount(guide);
    expect(tools.canfactory_set_model_parameters({ modelId: guide.id, parameters: { design: guide.defaults['design'] } as ParameterValues })).toMatchObject({ ok: false });
    expect(setParameters).not.toHaveBeenCalled();
    expect(openModel).not.toHaveBeenCalled();
    expect(takePendingParameters(guide)).toBeUndefined();
  });
});

describe('canfactory_open_wire_guide_design', () => {
  // Two wires on the half Perma-Proto, one print.
  const design = (): WireGuideDesign => ({
    schemaVersion: 1, boardPartId: 'adafruit-perma-proto-half', wirePartId: 'alpha-wire-3051-1',
    wires: [{ id: 'W1', from: [0, 3], to: [5, 3], path: [], level: 0 }, { id: 'W2', from: [2, 5], to: [2, 11], path: [], level: 0 }],
    prints: [{ id: 'G1', wireIds: ['W1', 'W2'] }],
    guide: { registration: 'mounting-holes', coverThickness: 1.2, channelClearance: 0.2, funnelTopDiameter: 2.2, funnelBottomDiameter: 1, funnelStandoff: 0.5 },
  });

  it('rejects an invalid design with the shared validation’s issues, and opens nothing', () => {
    const { setParameters } = mount(guide);
    const { controller: tools, openModel } = controller();
    const crossing = design();
    crossing.wires.push({ id: 'W3', from: [4, 1], to: [4, 6], path: [], level: 0 });
    for (const candidate of [crossing, { ...design(), boardPartId: 'm3-hex-nut' }, { schemaVersion: 2 }, 'not a design', null]) {
      const issues = validateWireGuideDesign(candidate);
      expect(issues.length).toBeGreaterThan(0);
      // Exactly what canfactory_validate_wire_guide_design reports: { path (JSON Pointer), message }.
      expect(tools.canfactory_open_wire_guide_design({ design: candidate })).toEqual({ ok: false, issues });
    }
    expect(setParameters).not.toHaveBeenCalled();
    expect(openModel).not.toHaveBeenCalled();
    expect(takePendingParameters(guide)).toBeUndefined();
  });

  it('opens the wire guide’s editor on a valid design when another model (or none) is open', () => {
    for (const mounted of [trap, null]) {
      if (mounted) mount(mounted); else editorSession.set(null);
      const { controller: tools, openModel, savedParameters } = controller();
      const result = tools.canfactory_open_wire_guide_design({ design: design() });
      expect(result).toMatchObject({ ok: true, modelId: guide.id, opened: true, summary: { wires: 2, levels: 1, prints: [{ id: 'G1', wires: 2 }] } });
      expect(openModel).toHaveBeenCalledWith(guide.id);
      // The editor starts from the design (the same path a model opened with set_model_parameters takes), not from saved settings.
      expect(savedParameters).not.toHaveBeenCalled();
      const pending = takePendingParameters(guide);
      expect(pending).toEqual({ design: design() });
      expect(validateParameters(guide, pending)).toEqual([]);
    }
  });

  it('replaces the design in an open wire-guide editor, through the editor’s own parameters', () => {
    const { setParameters, state } = mount(guide, { design: DEFAULT_WIRE_GUIDE_DESIGN });
    const { controller: tools, openModel } = controller();
    const input = design();
    expect(tools.canfactory_open_wire_guide_design({ design: input })).toMatchObject({ ok: true, opened: false });
    expect(openModel).not.toHaveBeenCalled();
    expect(setParameters).toHaveBeenCalledTimes(1);
    expect(state.parameters).toEqual({ design: input });
    // A copy: the model's later edits to its input can't change the editor's design.
    input.wires.pop();
    expect((state.parameters['design'] as WireGuideDesign).wires).toHaveLength(2);
    expect(takePendingParameters(guide)).toBeUndefined();
  });
});

describe('the editor session', () => {
  /** An editor as React runs it: `apply` queues the change, and the snapshot changes only when `commit` runs. */
  function laggingEditor(model: ModelDefinition) {
    const snapshot = (parameters: ParameterValues): EditorState => ({ modelId: model.id, modelVersion: model.version, title: model.title, parameters, issues: [],
      render: { status: 'ready', error: null, dimensions: null, parts: null, volumeMm3: null } });
    let committed = snapshot({ ...model.defaults });
    let queued: ParameterValues | null = null;
    const session = createEditorSession(model, () => committed, next => { queued = next; });
    return { session, commit: () => { if (queued) committed = snapshot(queued); queued = null; }, edit: (parameters: ParameterValues) => { committed = snapshot(parameters); } };
  }

  it('keeps two changes in one turn, made before the editor commits, and reads them back', () => {
    const editor = laggingEditor(trap);
    editorSession.set(editor.session);
    const { controller: tools } = controller();
    expect(tools.canfactory_set_model_parameters({ modelId: trap.id, parameters: { trapHeight: 80 } })).toMatchObject({ ok: true });
    expect(tools.canfactory_set_model_parameters({ modelId: trap.id, parameters: { brimWidth: 12 } })).toMatchObject({ ok: true, parameters: { trapHeight: 80, brimWidth: 12 } });
    expect(tools.canfactory_get_editor_state({})).toMatchObject({ parameters: { trapHeight: 80, brimWidth: 12 }, render: { status: 'updating' } });
    editor.commit();
    expect(tools.canfactory_get_editor_state({})).toMatchObject({ parameters: { trapHeight: 80, brimWidth: 12 }, render: { status: 'ready' } });
  });

  it('validates the second change against the first', () => {
    const editor = laggingEditor(trap);
    editorSession.set(editor.session);
    const { controller: tools } = controller();
    tools.canfactory_set_model_parameters({ modelId: trap.id, parameters: { trapDiameter: 20 } });
    // A 25 mm opening is fine on the default 60 mm funnel, but not on the 20 mm one just set.
    expect(validateParameters(trap, { ...trap.defaults, nozzleDiameter: 25 })).toEqual([]);
    expect(tools.canfactory_set_model_parameters({ modelId: trap.id, parameters: { nozzleDiameter: 25 } })).toMatchObject({ ok: false, issues: [{ field: 'nozzleDiameter' }] });
  });

  it('gives way to the editor’s own newer state, e.g. the user’s edit', () => {
    const editor = laggingEditor(trap);
    editorSession.set(editor.session);
    const { controller: tools } = controller();
    tools.canfactory_set_model_parameters({ modelId: trap.id, parameters: { trapHeight: 80 } });
    editor.edit({ ...trap.defaults, trapHeight: 90 });
    expect(tools.canfactory_get_editor_state({})).toMatchObject({ parameters: { trapHeight: 90 } });
  });
});
