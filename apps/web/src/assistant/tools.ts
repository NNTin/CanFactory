// The CanFactory tool group (#152 §4). Lazy: only AssistantHost.tsx (and tests) import this, so the package root never reaches the
// startup bundle (the editor's stage handle comes from the side-effect-free /stage subpath, in controller.ts). Zod checks the shape at the tool boundary; the values are checked by the contracts (TypeBox and each model's own
// validation) in catalogue.ts and controller.ts. Every tool has an output schema (results.ts), so a result that drifts fails loudly, and an activity summary (activity.ts).
import { createStageTools, z, type AppToolGroup, type Tool } from '@nntin/tinytinkerer-embed';
import { checkWireGuideDesign, getPart, listModels, modelSchema, prototypeBoardSummary, queryPrototypeBoard, QUERY_LIMIT, SEARCH_LIMIT, searchParts } from './catalogue.ts';
import { editorHandle, type CanfactoryController } from './controller.ts';
import { boardLayoutResult, boardQueryResult, editorStateResult, hole, modelSchemaResult, modelsResult, openDesignResult, parameters, partResult, searchResult, setParametersResult, validationResult } from './results.ts';
import { describeBoardLayout, describeBoardQuery, describeEditorState, describeModels, describeModelSchema, describeOpenDesign, describePart, describeSearch, describeSetParameters, describeValidation, summarize, type Summary } from './activity.ts';

/**
 * A plain tool over a pure function: its input parsed with `schema` (the runtime has already checked it), its output with `output`,
 * and its activity entry described from that output (activity.ts).
 */
function tool<I extends z.ZodType, O extends z.ZodType>(id: string, label: string, description: string, schema: I, output: O, run: (input: z.infer<I>) => z.input<O>,
  describe: (result: z.output<O>, input: Record<string, unknown> | undefined) => Summary): Tool<unknown, unknown> {
  return { id, description, schema, outputSchema: output, summarizeActivity: summarize(label, output, describe), execute: input => Promise.resolve(run(schema.parse(input))) };
}

export const catalogueTools: Tool<unknown, unknown>[] = [
  tool('canfactory_search_parts', 'Search parts',
    'Start here when planning a circuit on a named prototype board, including a 555 blinker on a half Perma-Proto: resolve its real part id before reading the board layout or creating a KiPrint project. Search CanFactory’s parts library (screws, nuts, magnets, inserts, development and prototype boards, …). Every word of `query` must match the id, title, designation, an alias or an attribute. Returns matching parts and the list of families.',
    z.object({
      query: z.string().max(200).optional().describe('Words to match, e.g. "M3 socket" or "perma proto half"'),
      family: z.string().optional().describe('Only this family id, e.g. "prototype-board"'),
      limit: z.number().int().min(1).max(SEARCH_LIMIT).optional().describe('At most this many parts (default 20)'),
    }),
    searchResult,
    searchParts, describeSearch),
  tool('canfactory_get_part', 'Part',
    'One part with all its dimensions in mm (nominal, min and max, and basis: standard, manufacturer or estimated), its attributes and the sources they were read from.',
    z.object({ id: z.string().describe('The part id, from canfactory_search_parts') }),
    partResult,
    getPart, describePart),
  tool('canfactory_get_prototype_board_layout', 'Board layout',
    'Read this before planning component placement or wiring on a prototype board. Returns its layout summary: outline, hole grid (pitch, columns × rows, first-hole offset), printed column and row labels, drill and pads, the copper nets (strips, rails) with their extent, and the mounting holes. Not every hole: look holes up with canfactory_query_prototype_board.',
    z.object({ partId: z.string().describe('A part of the "prototype-board" family') }),
    boardLayoutResult,
    prototypeBoardSummary, describeBoardLayout),
  tool('canfactory_query_prototype_board', 'Board query',
    'Verify a prototype board’s copper connectivity before choosing component pins or wire ends. Look up holes by position ([column, row]) for their coordinates, label and net; by printed label (e.g. "A1", "J30"); and whether pairs of holes are connected by the board’s copper. This tool can verify the copper connections on a half Perma-Proto.',
    z.object({
      partId: z.string().describe('A part of the "prototype-board" family'),
      holes: z.array(hole).max(QUERY_LIMIT).optional(),
      labels: z.array(z.string().max(20)).max(QUERY_LIMIT).optional(),
      connected: z.array(z.tuple([hole, hole])).max(QUERY_LIMIT).optional().describe('Pairs of holes to check'),
    }),
    boardQueryResult,
    queryPrototypeBoard, describeBoardQuery),
  tool('canfactory_validate_wire_guide_design', 'Validate design',
    'Check a WireGuideDesign (schemaVersion 1) with CanFactory’s shared validation, the one the API and the renderer use: the board, the hookup-wire parts, holes, axis-aligned paths on the grid, levels (no crossing on one level), prints and size limits. Returns field-level issues as { path (JSON Pointer), message }; fix every one and check again. Shape: { schemaVersion: 1, boardPartId, wirePartId, components?: [{ ref, footprint, pins: [[column, row]…], body: keepout }], wires: [{ id, wirePartId?, net?, from: [column, row], to: [column, row], path: [[column, row]…] (corner waypoints), level: integer from 0 }], prints: [{ id, wireIds, region?: { from, to } }], guide: { registration: "mounting-holes" | "edge-clips", coverThickness, channelClearance, funnelTopDiameter, funnelBottomDiameter, funnelStandoff } (mm), keepouts?: [{ kind: "box", x, y, w, h, height } | { kind: "cylinder", cx, cy, d, height }] (mm) }.',
    // Any JSON: the shared validation reports a malformed design with the same issues the API and the worker would.
    z.object({ design: z.unknown().describe('The WireGuideDesign document') }),
    validationResult,
    checkWireGuideDesign, describeValidation),
  tool('canfactory_list_models', 'Models',
    'The models in CanFactory’s library: id, title, what it is, its file format and whether it has adjustable parameters.',
    z.object({}),
    modelsResult,
    listModels, describeModels),
  tool('canfactory_get_model_schema', 'Model parameters',
    'A model’s parameters as its editor offers them: key, label, kind, unit, default, bounds, step and options. A `document` parameter (the wire guide’s design) takes a whole structured document, and its default is one; canfactory_set_model_parameters can’t change it.',
    z.object({ modelId: z.string() }),
    modelSchemaResult,
    modelSchema, describeModelSchema),
];

export const editorTools = createStageTools<CanfactoryController>({
  handle: editorHandle,
  methods: {
    canfactory_get_editor_state: {
      description: 'The model open in CanFactory’s editor: its id, current parameters, validation issues and the last render’s status and size. Fails when no model is open.',
      schema: z.object({}),
      outputSchema: editorStateResult,
      summarizeActivity: summarize('Editor state', editorStateResult, describeEditorState),
    },
    canfactory_set_model_parameters: {
      description: 'Open a model in the editor (if it isn’t already) and change some of its parameters; the others keep their current values. The whole set is checked by the model’s own validation: an invalid value is rejected with the reason, never clamped. The editor then renders it. Not for a model with a `document` parameter: open a wire guide with canfactory_open_wire_guide_design.',
      schema: z.object({ modelId: z.string().describe('The model id, from canfactory_list_models'), parameters: parameters.describe('Parameter key → new value; only the ones to change') }),
      outputSchema: setParametersResult,
      summarizeActivity: summarize('Set parameters', setParametersResult, describeSetParameters),
    },
    canfactory_open_wire_guide_design: {
      description: 'Open a WireGuideDesign in the editor of the prototype-wire-guide model, replacing the design it has, and let the editor render it. The design is checked first with the same validation as canfactory_validate_wire_guide_design; an invalid one is rejected with its issues as { path (JSON Pointer), message }, and nothing is opened. Check the design with canfactory_validate_wire_guide_design before you call this.',
      schema: z.object({ design: z.unknown().describe('The WireGuideDesign document, as checked with canfactory_validate_wire_guide_design') }),
      outputSchema: openDesignResult,
      summarizeActivity: summarize('Open design', openDesignResult, describeOpenDesign),
    },
  },
});

export const toolGroup: AppToolGroup = { id: 'canfactory', label: 'CanFactory', tools: [...catalogueTools, ...editorTools] };
