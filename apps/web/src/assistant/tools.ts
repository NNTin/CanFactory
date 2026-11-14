// The CanFactory tool group (#152 §4). Lazy: only AssistantHost.tsx (and tests) import this, so the package root never reaches the
// startup bundle (the editor's stage handle comes from the side-effect-free /stage subpath, in controller.ts). Zod checks the shape at the tool boundary; the values are checked by the contracts (TypeBox and each model's own
// validation) in catalogue.ts and controller.ts. Every tool has an output schema, so a result that drifts fails loudly.
import { createStageTools, z, type AppToolGroup, type Tool } from '@nntin/tinytinkerer-embed';
import { checkWireGuideDesign, getPart, listModels, modelSchema, prototypeBoardSummary, queryPrototypeBoard, QUERY_LIMIT, SEARCH_LIMIT, searchParts } from './catalogue.ts';
import { editorHandle, type CanfactoryController } from './controller.ts';

const scalar = z.union([z.number(), z.boolean(), z.string()]);
/** A parameter's value: a scalar, or a structured document (#152 phase 2). The model's own validation decides which it takes. */
const parameterValue = z.union([scalar, z.record(z.string(), z.unknown())]);
const nullable = <T extends z.ZodType>(schema: T) => z.union([schema, z.null()]);
const hole = z.tuple([z.number().int().min(0), z.number().int().min(0)]).describe('A hole as [column, row], both counted from 0');
const point = { x: z.number(), y: z.number() };
const issue = z.object({ field: z.string(), message: z.string() });
/** A wire-guide design's issue: a JSON Pointer into the design, and the reason (`validateWireGuideDesign`). */
const designIssue = z.object({ path: z.string(), message: z.string() });
const partSummary = { id: z.string(), family: z.string(), title: z.string(), designation: z.string() };
const holeInfo = { hole, x: z.number(), y: z.number(), label: nullable(z.string()), net: nullable(z.string()) };

const parameters = z.record(z.string(), parameterValue);
const editorState = z.object({
  modelId: z.string(), modelVersion: z.string(), title: z.string(), parameters, issues: z.array(issue),
  render: z.object({
    status: z.enum(['invalid', 'queued', 'rendering', 'ready', 'failed', 'updating']), error: nullable(z.string()),
    dimensions: nullable(z.object({ x: z.number(), y: z.number(), z: z.number() })), parts: nullable(z.number()), volumeMm3: nullable(z.number()),
  }),
});

/** A plain tool over a pure function: its input parsed with `schema` (the runtime has already checked it), its output with `output`. */
function tool<I extends z.ZodType, O extends z.ZodType>(id: string, description: string, schema: I, output: O, run: (input: z.infer<I>) => z.input<O>): Tool<unknown, unknown> {
  return { id, description, schema, outputSchema: output, execute: input => Promise.resolve(run(schema.parse(input))) };
}

export const catalogueTools: Tool<unknown, unknown>[] = [
  tool('canfactory_search_parts',
    'Search CanFactory’s parts library (screws, nuts, magnets, inserts, development and prototype boards, …). Every word of `query` must match the id, title, designation, an alias or an attribute. Returns matching parts and the list of families.',
    z.object({
      query: z.string().max(200).optional().describe('Words to match, e.g. "M3 socket" or "perma proto half"'),
      family: z.string().optional().describe('Only this family id, e.g. "prototype-board"'),
      limit: z.number().int().min(1).max(SEARCH_LIMIT).optional().describe('At most this many parts (default 20)'),
    }),
    z.object({ total: z.number(), parts: z.array(z.object(partSummary)), families: z.array(z.object({ id: z.string(), title: z.string() })) }),
    searchParts),
  tool('canfactory_get_part',
    'One part with all its dimensions in mm (nominal, min and max, and basis: standard, manufacturer or estimated), its attributes and the sources they were read from.',
    z.object({ id: z.string().describe('The part id, from canfactory_search_parts') }),
    z.object({
      ...partSummary, aliases: z.array(z.string()), description: z.string(), notes: nullable(z.string()), standard: nullable(z.string()),
      product: nullable(z.object({ manufacturer: z.string(), sku: z.string(), url: z.string() })), attributes: z.record(z.string(), z.string()),
      dimensions: z.array(z.object({ key: z.string(), label: z.string(), value: z.number(), min: nullable(z.number()), max: nullable(z.number()), basis: z.enum(['standard', 'manufacturer', 'estimated']), source: z.string() })),
      sources: z.array(z.object({ id: z.string(), title: z.string(), publisher: z.string(), kind: z.enum(['standard', 'manufacturer', 'reference']), url: nullable(z.string()) })),
      prototypeBoard: z.boolean(),
    }),
    getPart),
  tool('canfactory_get_prototype_board_layout',
    'A prototype board’s layout summary: outline, hole grid (pitch, columns × rows, first-hole offset), printed column and row labels, drill and pads, the copper nets (strips, rails) with their extent, and the mounting holes. Not every hole: look holes up with canfactory_query_prototype_board.',
    z.object({ partId: z.string().describe('A part of the "prototype-board" family') }),
    z.object({
      partId: z.string(), frame: z.string(), outline: z.object({ L: z.number(), W: z.number(), t: z.number(), r: z.number() }),
      grid: z.object({ x0: z.number(), y0: z.number(), pitch: z.number(), columns: z.number(), rows: z.number() }),
      holeCount: z.number(), emptyGridPositions: z.number(),
      columnLabels: z.array(z.object({ index: z.number(), label: z.string() })), rowLabels: z.array(z.object({ index: z.number(), label: z.string() })),
      drill: z.number(), plated: z.boolean(),
      pads: z.object({ top: nullable(z.object({ shape: z.enum(['round', 'square']), size: z.number() })), bottom: nullable(z.object({ shape: z.enum(['round', 'square']), size: z.number() })) }),
      surface: z.object({ top: z.string(), bottom: z.string() }), material: z.string(), finish: z.string(),
      nets: z.array(z.object({ id: z.string(), kind: z.enum(['strip', 'rail', 'linked']), holes: z.number(), first: nullable(hole), last: nullable(hole) })),
      mountingHoles: z.array(z.object({ ...point, d: z.number(), plated: z.boolean() })),
    }),
    prototypeBoardSummary),
  tool('canfactory_query_prototype_board',
    'Look up holes of a prototype board: by position ([column, row]) for their coordinates, label and net; by printed label (e.g. "A1", "J30"); and whether pairs of holes are connected by the board’s copper.',
    z.object({
      partId: z.string().describe('A part of the "prototype-board" family'),
      holes: z.array(hole).max(QUERY_LIMIT).optional(),
      labels: z.array(z.string().max(20)).max(QUERY_LIMIT).optional(),
      connected: z.array(z.tuple([hole, hole])).max(QUERY_LIMIT).optional().describe('Pairs of holes to check'),
    }),
    z.object({
      holes: z.array(z.union([z.object({ ...holeInfo, drilled: z.literal(true) }), z.object({ hole, drilled: z.literal(false) })])),
      labels: z.array(z.union([z.object({ query: z.string(), found: z.literal(true), ...holeInfo }), z.object({ query: z.string(), found: z.literal(false) })])),
      connected: z.array(z.object({ a: hole, b: hole, connected: z.boolean(), net: nullable(z.string()), problem: z.string().optional() })),
    }),
    queryPrototypeBoard),
  tool('canfactory_validate_wire_guide_design',
    'Check a WireGuideDesign (schemaVersion 1) with CanFactory’s shared validation, the one the API and the renderer use: the board, the hookup-wire parts, holes, axis-aligned paths on the grid, levels (no crossing on one level), prints and size limits. Returns field-level issues as { path (JSON Pointer), message }; fix every one and check again. Shape: { schemaVersion: 1, boardPartId, wirePartId, components?: [{ ref, footprint, pins: [[column, row]…], body: keepout }], wires: [{ id, wirePartId?, net?, from: [column, row], to: [column, row], path: [[column, row]…] (corner waypoints), level: integer from 0 }], prints: [{ id, wireIds, region?: { from, to } }], guide: { registration: "mounting-holes" | "edge-clips", coverThickness, channelClearance, funnelTopDiameter, funnelBottomDiameter, funnelStandoff } (mm), keepouts?: [{ kind: "box", x, y, w, h, height } | { kind: "cylinder", cx, cy, d, height }] (mm) }.',
    // Any JSON: the shared validation reports a malformed design with the same issues the API and the worker would.
    z.object({ design: z.unknown().describe('The WireGuideDesign document') }),
    z.object({ valid: z.boolean(), issues: z.array(designIssue) }),
    checkWireGuideDesign),
  tool('canfactory_list_models',
    'The models in CanFactory’s library: id, title, what it is, its file format and whether it has adjustable parameters.',
    z.object({}),
    z.object({ models: z.array(z.object({ id: z.string(), version: z.string(), title: z.string(), description: z.string(), format: z.enum(['stl', 'zip']), adjustable: z.boolean() })) }),
    listModels),
  tool('canfactory_get_model_schema',
    'A model’s parameters as its editor offers them: key, label, kind, unit, default, bounds, step and options. A `document` parameter (the wire guide’s design) takes a whole structured document, and its default is one; canfactory_set_model_parameters can’t change it.',
    z.object({ modelId: z.string() }),
    z.object({
      id: z.string(), version: z.string(), title: z.string(), printNotes: z.string(), note: z.string(),
      parameters: z.array(z.object({
        key: z.string(), label: z.string(), description: z.string(), kind: z.enum(['number', 'boolean', 'enum', 'text', 'svg', 'document']), group: z.enum(['basic', 'advanced']),
        unit: nullable(z.literal('mm')), default: parameterValue, minimum: nullable(z.number()), maximum: nullable(z.number()), step: nullable(z.number()),
        enabledWhen: nullable(z.string()), options: nullable(z.array(z.object({ value: z.string(), label: z.string() }))),
      })),
    }),
    modelSchema),
];

export const editorTools = createStageTools<CanfactoryController>({
  handle: editorHandle,
  methods: {
    canfactory_get_editor_state: {
      description: 'The model open in CanFactory’s editor: its id, current parameters, validation issues and the last render’s status and size. Fails when no model is open.',
      schema: z.object({}),
      outputSchema: editorState,
    },
    canfactory_set_model_parameters: {
      description: 'Open a model in the editor (if it isn’t already) and change some of its parameters; the others keep their current values. The whole set is checked by the model’s own validation: an invalid value is rejected with the reason, never clamped. The editor then renders it. Not for a model with a `document` parameter: open a wire guide with canfactory_open_wire_guide_design.',
      schema: z.object({ modelId: z.string().describe('The model id, from canfactory_list_models'), parameters: parameters.describe('Parameter key → new value; only the ones to change') }),
      outputSchema: z.union([
        z.object({ ok: z.literal(true), modelId: z.string(), opened: z.boolean(), parameters, note: z.string() }),
        z.object({ ok: z.literal(false), issues: z.array(issue) }),
      ]),
    },
    canfactory_open_wire_guide_design: {
      description: 'Open a WireGuideDesign in the editor of the prototype-wire-guide model, replacing the design it has, and let the editor render it. The design is checked first with the same validation as canfactory_validate_wire_guide_design; an invalid one is rejected with its issues as { path (JSON Pointer), message }, and nothing is opened. Check the design with canfactory_validate_wire_guide_design before you call this.',
      schema: z.object({ design: z.unknown().describe('The WireGuideDesign document, as checked with canfactory_validate_wire_guide_design') }),
      outputSchema: z.union([
        z.object({
          ok: z.literal(true), modelId: z.string(), opened: z.boolean(), note: z.string(),
          summary: z.object({ board: z.string(), wire: z.string(), wires: z.number(), prints: z.array(z.object({ id: z.string(), wires: z.number() })), levels: z.number() }),
        }),
        z.object({ ok: z.literal(false), issues: z.array(designIssue) }),
      ]),
    },
  },
});

export const toolGroup: AppToolGroup = { id: 'canfactory', label: 'CanFactory', tools: [...catalogueTools, ...editorTools] };
