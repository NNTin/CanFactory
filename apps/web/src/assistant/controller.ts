// What the assistant's editor tools call (#152 §4). Eager and tinytinkerer-free: the app installs the controller in `controllerSlot`,
// and the lazy assistant bridges the slot to the package's stage handle (AssistantHost.tsx). Nothing here renders: a change goes
// into the editor's parameters, and the editor's own debounce, render queue and one-job rule do the rest.
import { findModel, validateParameters, type ModelDefinition, type ParameterIssue, type ParameterValues } from '@canfactory/contracts';

export const NOT_MOUNTED = 'The CanFactory editor is not ready yet. Ask the user to reload the page.';
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

export type SetParametersResult =
  | { ok: true; modelId: string; opened: boolean; parameters: ParameterValues; note: string }
  | { ok: false; issues: ParameterIssue[] };

/** The editor tools; each method is one tool, named as the model sees it (prefixed: bare ids collide with plugin tools). */
export interface CanfactoryController {
  canfactory_get_editor_state(input: unknown): EditorState;
  canfactory_set_model_parameters(input: unknown): SetParametersResult;
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

/** The controller the app installs while it is mounted. The package's `createStageControllerHandle` is only on its root, which eager
 * code must not import, so the lazy assistant subscribes its handle to this slot instead. */
export const controllerSlot = slot<CanfactoryController>();
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
 */
export function createCanfactoryController(options: { openModel: (modelId: string) => void; savedParameters: (model: ModelDefinition) => ParameterValues; session?: Slot<EditorSession> }): CanfactoryController {
  const session = options.session ?? editorSession;
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
      const unknown = Object.keys(changes).filter(key => !(key in model.defaults));
      if (unknown.length > 0) return { ok: false, issues: unknown.map(field => ({ field, message: `${model.title} has no parameter “${field}”. Read its parameters with canfactory_get_model_schema.` })) };
      const current = session.get();
      const open = current?.model.id === model.id ? current : null;
      const next = { ...(open ? open.state().parameters : options.savedParameters(model)), ...changes };
      const issues = validateParameters(model, next);
      if (issues.length > 0) return { ok: false, issues };
      if (open) open.setParameters(next);
      else { pending.set(model.id, next); options.openModel(model.id); }
      return { ok: true, modelId: model.id, opened: !open, parameters: next,
        note: 'The editor renders the new settings itself. Read canfactory_get_editor_state for the render status and size.' };
    },
  };
}
