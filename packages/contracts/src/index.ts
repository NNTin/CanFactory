import { Type, type Static } from 'typebox';
import { ControlSchema, fruitFlyTrap } from './models.ts';
export * from './models.ts';

/** Stable error envelope; clients may branch on code and highlight field issues. */
export const ErrorSchema = Type.Object({
  code: Type.String({ description: 'Stable machine-readable error code.', examples: ['INVALID_PARAMETERS'] }),
  message: Type.String({ description: 'Actionable human-readable explanation.' }),
  issues: Type.Array(Type.Object({ field: Type.String(), message: Type.String() }, { additionalProperties: false })),
}, { additionalProperties: false });
export type ApiError = Static<typeof ErrorSchema>;

export const ModelSummarySchema = Type.Object({
  id: Type.String(), version: Type.String(), title: Type.String(), description: Type.String(),
  attribution: Type.String(), license: Type.String(), licenseUrl: Type.String(),
  printNotes: Type.String({ description: 'Model-specific orientation or printing guidance.' }),
}, { additionalProperties: false });

export const ModelDetailSchema = Type.Object({
  ...ModelSummarySchema.properties,
  controls: Type.Array(ControlSchema),
  defaults: Type.Record(Type.String(), Type.Union([Type.Number(), Type.Boolean()])),
  parameterSchema: Type.Record(Type.String(), Type.Unknown(), { description: 'JSON Schema for this model’s parameter object.' }),
  referenceUrl: Type.String(),
}, { additionalProperties: false });
export type ModelDetail = Static<typeof ModelDetailSchema>;

/** Register a typed branch for each provided model; preserve the tuple for precise inference. */
export const RenderRequestSchema = Type.Union([Type.Object({
  modelId: Type.Literal(fruitFlyTrap.id),
  modelVersion: Type.Literal(fruitFlyTrap.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
  parameters: fruitFlyTrap.parameterSchema,
}, { additionalProperties: false })], { description: 'Complete, uncoerced settings for one model version.' });
export type RenderRequest = Static<typeof RenderRequestSchema>;

export const RenderStatusSchema = Type.Enum(['queued', 'running', 'succeeded', 'failed']);
export type RenderStatus = Static<typeof RenderStatusSchema>;
export const DimensionsSchema = Type.Object({ x: Type.Number(), y: Type.Number(), z: Type.Number() }, { additionalProperties: false, description: 'Axis-aligned dimensions in millimetres, including brim and handles.' });
export type Dimensions = Static<typeof DimensionsSchema>;

export const ArtifactSchema = Type.Object({
  url: Type.String({ description: 'The same bytes are used for preview and download. Add ?download=true for attachment disposition.' }),
  sha256: Type.String(), bytes: Type.Integer(), triangles: Type.Integer(),
  dimensions: DimensionsSchema, volume: Type.Number({ description: 'Enclosed material volume in cubic millimetres.' }),
}, { additionalProperties: false });

/** Pending/failed renders have no downloadable artifact. expiresAt is Unix time in milliseconds. */
export const RenderSchema = Type.Object({
  id: Type.String(), modelId: Type.String(), modelVersion: Type.String(),
  status: RenderStatusSchema,
  createdAt: Type.Integer(), expiresAt: Type.Integer(),
  slotCount: Type.Union([Type.Integer(), Type.Null()]),
  artifact: Type.Union([ArtifactSchema, Type.Null()]),
  error: Type.Union([ErrorSchema, Type.Null()]),
}, { additionalProperties: false });
export type Render = Static<typeof RenderSchema>;

export const IdParamsSchema = Type.Object({ id: Type.String({ minLength: 1, maxLength: 100, pattern: '^[a-zA-Z0-9-]+$' }) }, { additionalProperties: false });
export const DownloadQuerySchema = Type.Object({ download: Type.Optional(Type.Literal('true')) }, { additionalProperties: false });
