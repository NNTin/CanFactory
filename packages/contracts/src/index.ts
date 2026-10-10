import { Type, type Static } from 'typebox';
import { aiRubberDuck, AssemblySchema, cameraHousing, catCollarTag, cigaretteCase, ControlSchema, fruitFlyTrap, litterShovel, mossPlanter, plankConnector, pressurePad, printedCornerBracket, printedScreenHook, qrMagnetTag, springBallDetent, toggleLatch, windowCatGuard } from './models.ts';
import { PartFamilySchema, PartSchema, PartSourceSchema } from './parts/index.ts';
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
export * from './printedCornerBracket.ts';
export * from './printedScreenHook.ts';
export * from './springBallDetent.ts';
export * from './catCollarTag.ts';
export * from './cameraHousing.ts';
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

export const ModelPartSummarySchema = Type.Object({ id: Type.String(), title: Type.String() }, { additionalProperties: false });

export const ModelSummarySchema = Type.Object({
  id: Type.String(), version: Type.String(), title: Type.String(), description: Type.String(),
  attribution: Type.String(),
  attributionLinks: Type.Optional(Type.Array(Type.Object({
    text: Type.String({ description: 'A phrase of `attribution`, verbatim.' }),
    url: Type.String({ description: 'The page it links to, e.g. the original design.' }),
  }, { additionalProperties: false }), { description: 'Phrases of the attribution that link to where they were published.' })),
  license: Type.String(), licenseUrl: Type.String(),
  printNotes: Type.String({ description: 'Model-specific orientation or printing guidance.' }),
  artifactFormat: Type.Union([Type.Literal('stl'), Type.Literal('zip')], { description: 'The shape of the generated file: one STL, or a ZIP of one STL per part.' }),
  customizable: Type.Boolean({ description: 'Whether this model exposes adjustable parameters yet.' }),
}, { additionalProperties: false });

export const ModelDetailSchema = Type.Object({
  ...ModelSummarySchema.properties,
  controls: Type.Array(ControlSchema),
  defaults: Type.Record(Type.String(), Type.Union([Type.Number(), Type.Boolean(), Type.String()])),
  parameterSchema: Type.Record(Type.String(), Type.Unknown(), { description: 'JSON Schema for this model’s parameter object.' }),
  referenceUrl: Type.Optional(Type.String({ description: 'Absent when this model has no small, permanent original file.' })),
  parts: Type.Optional(Type.Array(ModelPartSummarySchema, { description: 'Present only for multi-part assembly models, in render/ZIP order.' })),
  assembly: Type.Optional(AssemblySchema),
}, { additionalProperties: false });
export type ModelDetail = Static<typeof ModelDetailSchema>;

/** Register a typed branch for each provided model; preserve the tuple for precise inference. */
export const RenderRequestSchema = Type.Union([
  Type.Object({
    modelId: Type.Literal(aiRubberDuck.id),
    modelVersion: Type.Literal(aiRubberDuck.version),
    parameters: aiRubberDuck.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(fruitFlyTrap.id),
    modelVersion: Type.Literal(fruitFlyTrap.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: fruitFlyTrap.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(mossPlanter.id),
    modelVersion: Type.Literal(mossPlanter.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: mossPlanter.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(cigaretteCase.id),
    modelVersion: Type.Literal(cigaretteCase.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: cigaretteCase.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(plankConnector.id),
    modelVersion: Type.Literal(plankConnector.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: plankConnector.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(litterShovel.id),
    modelVersion: Type.Literal(litterShovel.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: litterShovel.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(toggleLatch.id),
    modelVersion: Type.Literal(toggleLatch.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: toggleLatch.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(pressurePad.id),
    modelVersion: Type.Literal(pressurePad.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: pressurePad.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(windowCatGuard.id),
    modelVersion: Type.Literal(windowCatGuard.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: windowCatGuard.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(qrMagnetTag.id),
    modelVersion: Type.Literal(qrMagnetTag.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: qrMagnetTag.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(printedCornerBracket.id),
    modelVersion: Type.Literal(printedCornerBracket.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: printedCornerBracket.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(printedScreenHook.id),
    modelVersion: Type.Literal(printedScreenHook.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: printedScreenHook.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(springBallDetent.id),
    modelVersion: Type.Literal(springBallDetent.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: springBallDetent.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(catCollarTag.id),
    modelVersion: Type.Literal(catCollarTag.version, { description: 'Version returned by the catalogue. Refresh the catalogue on a version conflict.' }),
    parameters: catCollarTag.parameterSchema,
  }, { additionalProperties: false }),
  Type.Object({
    modelId: Type.Literal(cameraHousing.id), modelVersion: Type.Literal(cameraHousing.version), parameters: cameraHousing.parameterSchema,
  }, { additionalProperties: false }),
], { description: 'Complete, uncoerced settings for one model version.' });
export type RenderRequest = Static<typeof RenderRequestSchema>;

export const PartUsageSchema = Type.Object({
  modelId: Type.String({ description: 'The model’s id, or for a concept its page under `#/concepts/`, e.g. `catio/window-insert`.' }), modelTitle: Type.String(),
  via: Type.String({ description: 'The model’s setting that links to the part, “Assembly preview” for a reference object, or the concept’s use of it.' }),
  kind: Type.Union([Type.Literal('model'), Type.Literal('concept')], { description: '`model`: a model in the library; `concept`: a concept page.' }),
}, { additionalProperties: false });

export const PartFamilySummarySchema = Type.Object({
  ...PartFamilySchema.properties,
  count: Type.Integer({ description: 'How many parts the family has.' }),
}, { additionalProperties: false });
export type PartFamilySummary = Static<typeof PartFamilySummarySchema>;

/** A family with all its parts, the sources they cite, and the models that link to each part (by part id). */
export const PartFamilyDetailSchema = Type.Object({
  family: PartFamilySchema,
  parts: Type.Array(PartSchema),
  sources: Type.Array(PartSourceSchema),
  usage: Type.Record(Type.String(), Type.Array(PartUsageSchema), { description: 'Models that link to a part, by part id; parts no model links to are left out.' }),
}, { additionalProperties: false });
export type PartFamilyDetail = Static<typeof PartFamilyDetailSchema>;

export const PartDetailSchema = Type.Object({
  part: PartSchema, family: PartFamilySchema, sources: Type.Array(PartSourceSchema), usage: Type.Array(PartUsageSchema),
}, { additionalProperties: false });
export type PartDetail = Static<typeof PartDetailSchema>;

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
