import type { ApiError, ParameterIssue } from '@canfactory/contracts';

/** Expected application failure, safe to expose through the documented error envelope. */
export class AppError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string, public readonly issues: ParameterIssue[] = []) {
    super(message);
    this.name = 'AppError';
  }
  toJSON(): ApiError { return { code: this.code, message: this.message, issues: this.issues }; }
}

/** Why a render failed. The retryable ones may pass on another attempt or with other settings; the rest are defects in a model or
 * the renderer that the same request will hit again, and must reach an operator. */
export type RenderFailureCode = 'RENDER_TIMEOUT' | 'OPENSCAD_FAILED' | 'GEOMETRY_INVALID' | 'MODEL_CHANGED' | 'SETTINGS_INVALID' | 'RENDERER_INTERNAL';

/** A classified render failure: `message` is for the person who asked for the render, `detail` for whoever fixes it (no paths). */
export class RenderFailure extends Error {
  constructor(public readonly code: RenderFailureCode, message: string, public readonly detail: string, public readonly retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RenderFailure';
  }
  envelope(reference: string): ApiError { return { code: this.code, message: this.message, issues: [], detail: this.detail, reference, retryable: this.retryable }; }
}

export const DEFECT = 'This combination of settings hits a defect in the model, not a mistake in your settings. It has been logged; please pick slightly different values meanwhile.';

/** Any error thrown while rendering, as a RenderFailure. An unclassified one is a renderer bug. */
export function classifyRenderError(error: unknown): RenderFailure {
  if (error instanceof RenderFailure) return error;
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return new RenderFailure('RENDERER_INTERNAL', 'The renderer failed unexpectedly. It has been logged; please try again.', detail, true, { cause: error });
}
