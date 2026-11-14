// What the assistant's editor tools call (#152 §4). Eager: the app installs the controller on `editorHandle` when it mounts, and
// the lazy assistant's tools (tools.ts) call that handle. It may import the side-effect-free /stage subpath, never the package root.
// Nothing here renders: a change goes into the editor's parameters, and the editor's own render queue and one-job rule do the rest.
import { createStageControllerHandle } from '@nntin/tinytinkerer-embed/stage';
import { findModel, validateParameters, validateWireGuideDesign, wireGuideSummary, type ModelDefinition, type ParameterIssue, type ParameterValues, type WireGuideDesign, type WireGuideIssue } from '@canfactory/contracts';

export const NOT_MOUNTED = 'The CanFactory editor is not ready yet. Ask the user to reload the page.';
export const WIRE_GUIDE_MODEL = 'prototype-wire-guide';
export const NO_EDITOR = 'No model is open in the editor. Open one with canfactory_set_model_parameters, or ask the user which model they mean.';

/** The editor's state as the assistant reads it. */
export interface EditorState {
  modelId: string;
  modelVersion: string;
  title: string;
  parameters: ParameterValues;
  /** Why the current parameters can't render, as the editor shows it. */
  issues: ParameterIssue[];
  render: {
    status: 'invalid' | 'queued' | 'rendering' | 'ready' | 'failed' | 'updating';
    error: string | null;
    /** The last finished render's size in mm (a single STL), or its parts' count and total volume (an assembly). */
    dimensions: { x: number; y: number; z: number } | null;
    parts: number | null;
    volumeMm3: number | null;
  };
}

/** A mounted editor, as it registers itself: the latest state on every render, and a way to set its parameters. */
export interface EditorSession {
  model: ModelDefinition;
  state(): EditorState;
  setParameters(parameters: ParameterValues): void;
}

/**
 * The session a mounted editor registers. `snapshot` is the editor's state as of its last commit; `apply` hands it new parameters
 * (a React state update, seen only after the next commit). Until the editor commits a new snapshot, the session reports the
 * parameters it applied, so a second tool call in the same turn builds on the first instead of on stale state, and
 * get_editor_state right after a set reads the change. A newer snapshot (the commit, or the user's own edit) always wins.
 */
export function createEditorSession(model: ModelDefinition, snapshot: () => EditorState | null, apply: (parameters: ParameterValues) => void): EditorSession {
  let applied: { over: EditorState; state: EditorState } | null = null;
  const state = (): EditorState => {
    const current = snapshot();
    if (!current) throw new Error('The editor is still starting.');
    if (applied?.over === current) return applied.state;
    applied = null;
    return current;
  };
  return {
    model,
    state,
    setParameters(parameters) {
      const current = state();
      // Only validated parameters are applied (canfactory_set_model_parameters); their render is pending until the editor commits.
      applied = { over: snapshot() ?? current, state: { ...current, parameters, issues: [], render: { ...current.render, status: 'updating', error: null } } };
      apply(parameters);
    },
  };
}

export type SetParametersResult =
  | { ok: true; modelId: string; opened: boolean; parameters: ParameterValues; note: string }
  | { ok: false; issues: ParameterIssue[] };

export type OpenWireGuideResult =
  | { ok: true; modelId: string; opened: boolean; summary: ReturnType<typeof wireGuideSummary>; note: string }
  /** The issues as canfactory_validate_wire_guide_design reports them: JSON Pointers into the design. */
  | { ok: false; issues: WireGuideIssue[] };

/** The editor tools; each method is one tool, named as the model sees it (prefixed: bare ids collide with plugin tools). */
export interface CanfactoryController {
  canfactory_get_editor_state(input: unknown): EditorState;
  canfactory_set_model_parameters(input: unknown): SetParametersResult;
  canfactory_open_wire_guide_design(input: unknown): OpenWireGuideResult;
}

interface Slot<T> { get(): T | null; set(value: T | null): void; subscribe(listener: (value: T | null) => void): () => void }
function slot<T>(): Slot<T> {
  let value: T | null = null;
  const listeners = new Set<(value: T | null) => void>();
  return {
    get: () => value,
    set(next) { value = next; for (const listener of listeners) listener(next); },
    subscribe(listener) { listeners.add(listener); listener(value); return () => { listeners.delete(listener); }; },
  };
}

/** The handle the editor tools call: the app installs its controller on it while it is mounted, and until then every call fails. */
export const editorHandle = createStageControllerHandle<CanfactoryController>(NOT_MOUNTED);
/** The mounted editor, or null on any other page. */
export const editorSession = slot<EditorSession>();

/** Parameters the assistant chose for a model that wasn't open yet; its editor starts from them (see `takePendingParameters`). */
const pending = new Map<string, ParameterValues>();
export function takePendingParameters(model: ModelDefinition): ParameterValues | undefined {
  const values = pending.get(model.id);
  pending.delete(model.id);
  return values;
}

/**
 * The controller over the app's navigation and the editor session.
 *
 * `set_model_parameters` validates the merged parameters with the model's own validation (`validateParameters`: its TypeBox
 * schema, part filters, limits and checks) and rejects them whole if anything is wrong. It never clamps or corrects a value.
 * It doesn't open a model with a `document` parameter (the wire guide): `open_wire_guide_design` does, after checking the design
 * with `validateWireGuideDesign` on its own. Both change the editor the same way, so its render queue and one-job rule apply.
 */
export function createCanfactoryController(options: { openModel: (modelId: string) => void; savedParameters: (model: ModelDefinition) => ParameterValues; session?: Slot<EditorSession> }): CanfactoryController {
  const session = options.session ?? editorSession;
  const openEditor = (model: ModelDefinition) => { const current = session.get(); return current?.model.id === model.id ? current : null; };
  /** Hands validated parameters to the model's editor: the open one, or the one it navigates to, which starts from them. */
  const apply = (model: ModelDefinition, parameters: ParameterValues, open: EditorSession | null) => {
    if (open) open.setParameters(parameters);
    else { pending.set(model.id, parameters); options.openModel(model.id); }
  };
  const note = 'The editor renders the new settings itself. Read canfactory_get_editor_state for the render status and size.';
  return {
    canfactory_get_editor_state() {
      const current = session.get();
      if (!current) throw new Error(NO_EDITOR);
      return current.state();
    },
    canfactory_set_model_parameters(input) {
      const { modelId, parameters: changes } = input as { modelId: string; parameters: ParameterValues };
      const model = findModel(modelId);
      if (!model) return { ok: false, issues: [{ field: 'modelId', message: `There is no model “${modelId}”. List the models with canfactory_list_models.` }] };
      const document = model.controls.find(control => control.kind === 'document');
      if (document) return { ok: false, issues: [{ field: document.key, message: `${model.title}’s ${document.key} is a structured document, not a setting. Check it with canfactory_validate_wire_guide_design, then open it with canfactory_open_wire_guide_design.` }] };
      const unknown = Object.keys(changes).filter(key => !(key in model.defaults));
      if (unknown.length > 0) return { ok: false, issues: unknown.map(field => ({ field, message: `${model.title} has no parameter “${field}”. Read its parameters with canfactory_get_model_schema.` })) };
      const open = openEditor(model);
      const next = { ...(open ? open.state().parameters : options.savedParameters(model)), ...changes };
      const issues = validateParameters(model, next);
      if (issues.length > 0) return { ok: false, issues };
      apply(model, next, open);
      return { ok: true, modelId: model.id, opened: !open, parameters: next, note };
    },
    canfactory_open_wire_guide_design(input) {
      const { design } = input as { design: unknown };
      const issues = validateWireGuideDesign(design);
      if (issues.length > 0) return { ok: false, issues };
      const model = findModel(WIRE_GUIDE_MODEL);
      if (!model) throw new Error(`The ${WIRE_GUIDE_MODEL} model is missing from this build.`);
      // A copy, so the editor's design can't change under it; the model's own validation is the one the editor shows.
      const parameters: ParameterValues = { design: structuredClone(design) as WireGuideDesign };
      const modelIssues = validateParameters(model, parameters);
      if (modelIssues.length > 0) return { ok: false, issues: modelIssues.map(issue => ({ path: issue.field.replace(/^design/, ''), message: issue.message })) };
      const open = openEditor(model);
      apply(model, parameters, open);
      return { ok: true, modelId: model.id, opened: !open, summary: wireGuideSummary(design as WireGuideDesign), note };
    },
  };
}
