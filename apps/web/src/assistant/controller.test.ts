import { describe, expect, it, vi } from 'vitest';
import { findModel, validateParameters, type ModelDefinition, type ParameterValues } from '@canfactory/contracts';
import { createCanfactoryController, createEditorSession, editorSession, NO_EDITOR, takePendingParameters, type EditorSession, type EditorState } from './controller.ts';

const trap = findModel('fruit-fly-trap') as ModelDefinition;
const duck = findModel('ai-rubber-duck') as ModelDefinition;

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

  it('doesn’t open the wire guide (a document parameter), with or without a design, and points to the JSON import', () => {
    const guide = findModel('prototype-wire-guide') as ModelDefinition;
    editorSession.set(null);
    const { controller: tools, openModel } = controller();
    for (const parameters of [{ design: guide.defaults['design'] }, {}] as ParameterValues[]) {
      const result = tools.canfactory_set_model_parameters({ modelId: guide.id, parameters });
      expect(result).toMatchObject({ ok: false, issues: [{ field: 'design', message: expect.stringContaining('Import design (.json)') as unknown }] });
    }
    expect(openModel).not.toHaveBeenCalled();
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
