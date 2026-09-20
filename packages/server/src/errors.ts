import type { ApiError, ParameterIssue } from '@canfactory/contracts';

/** Expected application failure, safe to expose through the documented error envelope. */
export class AppError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string, public readonly issues: ParameterIssue[] = []) {
    super(message);
    this.name = 'AppError';
  }
  toJSON(): ApiError { return { code: this.code, message: this.message, issues: this.issues }; }
}
