import { Type, type Static, type TLiteral, type TObject } from 'typebox';
import { registeredModels, type ModelDefinition } from './models.ts';
export * from './models.ts';
export * from './assembly.ts';
export * from './bom.ts';
export * from './svgLogo.ts';
export * from './parts/index.ts';
export * from './concepts.ts';
export * from './pressurePad.ts';
export * from './windowCatGuard.ts';
export * from './qrMagnetTag.ts';
export * from './printPause.ts';
export * from './screwHoles.ts';
export * from './outsideCornerToggleLatch.ts';
export * from './printedCornerBracket.ts';
export * from './printedScreenHook.ts';
export * from './springBallDetent.ts';
export * from './catCollarTag.ts';
export * from './cameraHousing.ts';
export * from './magneticCatToy.ts';
export * from './physics.ts';
export * from './physicsPieces.ts';
export * from './cigaretteCasePhysics.ts';
export * from './spurGear.ts';
/** The toggle latch's mechanism, shared by the catalogue card's side view and the assembly preview. */
export * as toggleLatchMechanism from './toggleLatchMechanism.ts';

/** Stable error envelope; clients may branch on code and highlight field issues. */
export const ErrorSchema = Type.Object({
  code: Type.String({ description: 'Stable machine-readable error code.', examples: ['INVALID_PARAMETERS'] }),
  message: Type.String({ description: 'Actionable human-readable explanation.' }),
  issues: Type.Array(Type.Object({ field: Type.String(), message: Type.String() }, { additionalProperties: false })),
  detail: Type.Optional(Type.String({ description: 'Technical detail for whoever fixes the fault (a failed render: which part and check, or the generator\'s output).' })),
  reference: Type.Optional(Type.String({ description: 'Identifier to quote when reporting the fault (a failed render: its job id).' })),
  retryable: Type.Optional(Type.Boolean({ description: 'Whether the same request may succeed on another attempt. False for defects that the same settings hit again.' })),
}, { additionalProperties: false });
export type ApiError = Static<typeof ErrorSchema>;

/** One request branch per model, as a tuple type so that `Static` keeps the discriminated union. */
type RenderRequestBranches<Models extends readonly ModelDefinition[]> = {
  -readonly [K in keyof Models]: TObject<{ modelId: TLiteral<Models[K]['id']>; modelVersion: TLiteral<Models[K]['version']>; parameters: Models[K]['parameterSchema'] }>
};

/** Derived from `registeredModels`: registering a model there is all a new model needs. */
export const RenderRequestSchema = Type.Union(registeredModels.map(model => Type.Object({
  modelId: Type.Literal(model.id),
  modelVersion: Type.Literal(model.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
  parameters: model.parameterSchema,
}, { additionalProperties: false })) as RenderRequestBranches<typeof registeredModels>, { description: 'Complete, uncoerced settings for one model version.' });
export type RenderRequest = Static<typeof RenderRequestSchema>;

export const RenderStatusSchema = Type.Enum(['queued', 'running', 'succeeded', 'failed']);
export type RenderStatus = Static<typeof RenderStatusSchema>;
export const DimensionsSchema = Type.Object({ x: Type.Number(), y: Type.Number(), z: Type.Number() }, { additionalProperties: false, description: 'Axis-aligned dimensions in millimetres, including brim and handles.' });
export type Dimensions = Static<typeof DimensionsSchema>;

export const ArtifactPartSchema = Type.Object({
  id: Type.String(), title: Type.String(), bytes: Type.Integer(), triangles: Type.Integer(),
  dimensions: DimensionsSchema, volume: Type.Number({ description: 'Enclosed material volume in cubic millimetres.' }),
  meshRepairs: Type.Optional(Type.Integer({ minimum: 1, description: 'Zero-area slivers (float32 rounding of the STL) the renderer split; absent when there were none.' })),
}, { additionalProperties: false });

export const ArtifactSchema = Type.Object({
  url: Type.String({ description: 'The same bytes are used for preview and download. Add ?download=true for attachment disposition.' }),
  sha256: Type.String(), bytes: Type.Integer(), triangles: Type.Integer(),
  dimensions: Type.Optional(DimensionsSchema),
  volume: Type.Number({ description: 'Enclosed material volume in cubic millimetres, summed across parts for an assembly.' }),
  parts: Type.Optional(Type.Array(ArtifactPartSchema, { description: 'Present only for a multi-part assembly’s ZIP artifact, in ZIP order.' })),
  meshRepairs: Type.Optional(Type.Integer({ minimum: 1, description: 'Zero-area slivers (float32 rounding of the STL) the renderer split; absent when there were none.' })),
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

export * from './magneticCatToyPhysics.ts';

export * from './esp32Case.ts';
export * from './treatDispenser.ts';
export * from './miterBox.ts';
