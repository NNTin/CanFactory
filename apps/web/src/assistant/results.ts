// The CanFactory tools' result schemas (#152 §4). tools.ts checks every result against them before the model sees it, and
// activity.ts describes the results by the same schemas (#169), so a summary never reads a shape the tool doesn't return.
import { z } from '@nntin/tinytinkerer-embed';

const scalar = z.union([z.number(), z.boolean(), z.string()]);
/** A parameter's value: a scalar, or a structured document (#152 phase 2). The model's own validation decides which it takes. */
export const parameterValue = z.union([scalar, z.record(z.string(), z.unknown())]);
const nullable = <T extends z.ZodType>(schema: T) => z.union([schema, z.null()]);
export const hole = z.tuple([z.number().int().min(0), z.number().int().min(0)]).describe('A hole as [column, row], both counted from 0');
const point = { x: z.number(), y: z.number() };
const issue = z.object({ field: z.string(), message: z.string() });
/** A wire-guide design's issue: a JSON Pointer into the design, and the reason (`validateWireGuideDesign`). */
const designIssue = z.object({ path: z.string(), message: z.string() });
const partSummary = { id: z.string(), family: z.string(), title: z.string(), designation: z.string() };
const holeInfo = { hole, x: z.number(), y: z.number(), label: nullable(z.string()), net: nullable(z.string()) };

export const parameters = z.record(z.string(), parameterValue);

export const searchResult = z.object({ total: z.number(), parts: z.array(z.object(partSummary)), families: z.array(z.object({ id: z.string(), title: z.string() })) });

export const partResult = z.object({
  ...partSummary, aliases: z.array(z.string()), description: z.string(), notes: nullable(z.string()), standard: nullable(z.string()),
  product: nullable(z.object({ manufacturer: z.string(), sku: z.string(), url: z.string() })), attributes: z.record(z.string(), z.string()),
  dimensions: z.array(z.object({ key: z.string(), label: z.string(), value: z.number(), min: nullable(z.number()), max: nullable(z.number()), basis: z.enum(['standard', 'manufacturer', 'estimated']), source: z.string() })),
  sources: z.array(z.object({ id: z.string(), title: z.string(), publisher: z.string(), kind: z.enum(['standard', 'manufacturer', 'reference']), url: nullable(z.string()) })),
  prototypeBoard: z.boolean(),
});

export const boardLayoutResult = z.object({
  partId: z.string(), frame: z.string(), outline: z.object({ L: z.number(), W: z.number(), t: z.number(), r: z.number() }),
  grid: z.object({ x0: z.number(), y0: z.number(), pitch: z.number(), columns: z.number(), rows: z.number() }),
  holeCount: z.number(), emptyGridPositions: z.number(),
  columnLabels: z.array(z.object({ index: z.number(), label: z.string() })), rowLabels: z.array(z.object({ index: z.number(), label: z.string() })),
  drill: z.number(), plated: z.boolean(),
  pads: z.object({ top: nullable(z.object({ shape: z.enum(['round', 'square']), size: z.number() })), bottom: nullable(z.object({ shape: z.enum(['round', 'square']), size: z.number() })) }),
  surface: z.object({ top: z.string(), bottom: z.string() }), material: z.string(), finish: z.string(),
  nets: z.array(z.object({ id: z.string(), kind: z.enum(['strip', 'rail', 'linked']), holes: z.number(), first: nullable(hole), last: nullable(hole) })),
  mountingHoles: z.array(z.object({ ...point, d: z.number(), plated: z.boolean() })),
});

export const boardQueryResult = z.object({
  holes: z.array(z.union([z.object({ ...holeInfo, drilled: z.literal(true) }), z.object({ hole, drilled: z.literal(false) })])),
  labels: z.array(z.union([z.object({ query: z.string(), found: z.literal(true), ...holeInfo }), z.object({ query: z.string(), found: z.literal(false) })])),
  connected: z.array(z.object({ a: hole, b: hole, connected: z.boolean(), net: nullable(z.string()), problem: z.string().optional() })),
});

export const validationResult = z.object({ valid: z.boolean(), issues: z.array(designIssue) });

export const modelsResult = z.object({ models: z.array(z.object({ id: z.string(), version: z.string(), title: z.string(), description: z.string(), format: z.enum(['stl', 'zip']), adjustable: z.boolean() })) });

export const modelSchemaResult = z.object({
  id: z.string(), version: z.string(), title: z.string(), printNotes: z.string(), note: z.string(),
  parameters: z.array(z.object({
    key: z.string(), label: z.string(), description: z.string(), kind: z.enum(['number', 'boolean', 'enum', 'text', 'svg', 'document']), group: z.enum(['basic', 'advanced']),
    unit: nullable(z.literal('mm')), default: parameterValue, minimum: nullable(z.number()), maximum: nullable(z.number()), step: nullable(z.number()),
    enabledWhen: nullable(z.string()), options: nullable(z.array(z.object({ value: z.string(), label: z.string() }))),
  })),
});

export const editorStateResult = z.object({
  modelId: z.string(), modelVersion: z.string(), title: z.string(), parameters, issues: z.array(issue),
  render: z.object({
    status: z.enum(['invalid', 'queued', 'rendering', 'ready', 'failed', 'updating']), error: nullable(z.string()),
    dimensions: nullable(z.object({ x: z.number(), y: z.number(), z: z.number() })), parts: nullable(z.number()), volumeMm3: nullable(z.number()),
  }),
});

export const setParametersResult = z.union([
  z.object({ ok: z.literal(true), modelId: z.string(), opened: z.boolean(), parameters, note: z.string() }),
  z.object({ ok: z.literal(false), issues: z.array(issue) }),
]);

export const openDesignResult = z.union([
  z.object({
    ok: z.literal(true), modelId: z.string(), opened: z.boolean(), note: z.string(),
    summary: z.object({ board: z.string(), wire: z.string(), wires: z.number(), prints: z.array(z.object({ id: z.string(), wires: z.number() })), levels: z.number() }),
  }),
  z.object({ ok: z.literal(false), issues: z.array(designIssue) }),
]);
