import { Type, type Static, type TSchema } from 'typebox';
import { Value } from 'typebox/value';

/** A field-level, user-readable validation failure. Paths are parameter names. */
export interface ParameterIssue { field: string; message: string }

const dimension = (title: string, description: string, value: number, minimum: number, maximum: number, step = 0.1) =>
  Type.Number({ title, description, default: value, minimum, maximum, multipleOf: step });

/** Millimetres throughout. Brim width is radial; funnel diameter excludes the brim. */
export const FruitFlyTrapParametersSchema = Type.Object({
  trapDiameter: dimension('Funnel diameter', 'Outer diameter at the wide end, excluding the brim, in mm.', 60, 20, 200),
  trapHeight: dimension('Funnel height', 'Overall printed height in mm.', 60, 10, 200),
  brimWidth: dimension('Brim width', 'Radial width extending outward on each side of the funnel, in mm.', 10, 1, 30),
  nozzleDiameter: dimension('Central opening', 'Inner diameter of the opening at the narrow end, in mm.', 3.5, 1, 30),
  slotsEnabled: Type.Boolean({ title: 'Ventilation slots', description: 'Distribute small slots automatically over the funnel. Disable for a smooth wall.', default: true }),
  wallThickness: dimension('Wall thickness', 'Thickness of the funnel wall and brim in mm.', 0.8, 0.8, 1.6),
  handles: Type.Boolean({ title: 'Brim handles', description: 'Add two opposing handles, sized with the brim.', default: true }),
  gapHeight: dimension('Slot height', 'Vertical height of each ventilation slot in mm.', 1.6, 1, 3, 0.2),
  gapWidth: dimension('Slot width', 'Width of each ventilation slot in mm.', 0.4, 0.3, 0.8),
  gapDistanceHorizontal: dimension('Horizontal spacing', 'Target spacing between slots around each layer, in mm.', 1.6, 1.2, 2, 0.2),
  gapDistanceVertical: dimension('Vertical spacing', 'Target spacing between slot layers, in mm.', 1.6, 1, 3, 0.2),
}, { additionalProperties: false, description: 'Fruit fly trap parameters. All fields are required; dimensions are in millimetres.' });

export type FruitFlyTrapParameters = Static<typeof FruitFlyTrapParametersSchema>;

/** Generic, schema-derived controls understood by the shared React editor. */
export const ControlSchema = Type.Object({
  key: Type.String(),
  label: Type.String(),
  description: Type.String(),
  kind: Type.Union([Type.Literal('number'), Type.Literal('boolean')]),
  group: Type.Union([Type.Literal('basic'), Type.Literal('advanced')]),
  unit: Type.Union([Type.Literal('mm'), Type.Null()]),
  default: Type.Union([Type.Number(), Type.Boolean()]),
  minimum: Type.Union([Type.Number(), Type.Null()]),
  maximum: Type.Union([Type.Number(), Type.Null()]),
  step: Type.Union([Type.Number(), Type.Null()]),
  enabledWhen: Type.Union([Type.String(), Type.Null()]),
}, { additionalProperties: false });
export type Control = Static<typeof ControlSchema>;
export type ParameterValues = Record<string, number | boolean>;

function control<T extends { properties: Record<string, TSchema> }>(
  schema: T, key: keyof T['properties'] & string, group: Control['group'], enabledWhen: string | null = null, unit: Control['unit'] = 'mm',
): Control {
  const property: TSchema & { type?: unknown } = schema.properties[key] ?? (() => { throw new Error(`Unknown parameter ${key}.`); })();
  return {
    key, group, enabledWhen,
    label: 'title' in property && typeof property.title === 'string' ? property.title : key,
    description: 'description' in property && typeof property.description === 'string' ? property.description : '',
    kind: property.type === 'boolean' ? 'boolean' : 'number',
    unit: property.type === 'boolean' ? null : unit,
    default: 'default' in property && (typeof property.default === 'boolean' || typeof property.default === 'number') ? property.default : 0,
    minimum: 'minimum' in property && typeof property.minimum === 'number' ? property.minimum : null,
    maximum: 'maximum' in property && typeof property.maximum === 'number' ? property.maximum : null,
    step: property.type === 'integer' ? 1 : 'multipleOf' in property && typeof property.multipleOf === 'number' ? property.multipleOf : null,
  };
}

/** Mirrors the original SCAD layout, counting unique cutters (the seam is not duplicated). */
export function slotCount(p: FruitFlyTrapParameters): number {
  if (!p.slotsEnabled) return 0;
  const layers = Math.round((p.trapHeight * 0.75 + p.gapDistanceVertical) / (p.gapHeight + p.gapDistanceVertical));
  let count = 0;
  for (let layer = 0; layer < layers; layer++) {
    const radius = layer / layers * (p.trapDiameter / 2 - p.nozzleDiameter * 1.5) + p.nozzleDiameter * 1.5;
    count += Math.round(2 * Math.PI * radius / (p.gapDistanceHorizontal + p.gapWidth));
  }
  return count;
}

function validateTrap(p: FruitFlyTrapParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  if (p.nozzleDiameter + 2 * p.wallThickness >= p.trapDiameter)
    issues.push({ field: 'nozzleDiameter', message: 'The opening plus two wall thicknesses must be smaller than the funnel diameter.' });
  if (p.slotsEnabled && p.nozzleDiameter <= 2 * p.wallThickness)
    issues.push({ field: 'nozzleDiameter', message: 'With slots enabled, the opening must exceed twice the wall thickness.' });
  if (slotCount(p) > 10000)
    issues.push({ field: 'gapDistanceHorizontal', message: 'This layout exceeds 10,000 slots. Increase spacing or reduce the funnel size.' });
  return issues;
}

const controls = [
  control(FruitFlyTrapParametersSchema, 'trapDiameter', 'basic'), control(FruitFlyTrapParametersSchema, 'trapHeight', 'basic'),
  control(FruitFlyTrapParametersSchema, 'brimWidth', 'basic'), control(FruitFlyTrapParametersSchema, 'nozzleDiameter', 'basic'),
  control(FruitFlyTrapParametersSchema, 'slotsEnabled', 'basic'),
  control(FruitFlyTrapParametersSchema, 'wallThickness', 'advanced'), control(FruitFlyTrapParametersSchema, 'handles', 'advanced'),
  control(FruitFlyTrapParametersSchema, 'gapHeight', 'advanced', 'slotsEnabled'), control(FruitFlyTrapParametersSchema, 'gapWidth', 'advanced', 'slotsEnabled'),
  control(FruitFlyTrapParametersSchema, 'gapDistanceHorizontal', 'advanced', 'slotsEnabled'),
  control(FruitFlyTrapParametersSchema, 'gapDistanceVertical', 'advanced', 'slotsEnabled'),
];

/** One independently rendered, self-contained SCAD file that is part of a multi-part assembly model. */
export interface ModelPart {
  id: string; title: string; sourcePath: string;
  /** Parameter key -> SCAD variable, for the parameters this part consumes (a subset of the model's; may be shared). */
  scadMapping?: Record<string, string>;
}

/**
 * Trusted repository model. Source paths never come from API callers.
 *
 * Exactly one of `sourcePath` or `parts` must be set: `sourcePath` for an ordinary single-generator model (rendered
 * once, one STL); `parts` for an assembly (each part rendered independently, packaged as one ZIP — see
 * `isAssembly`/`artifactFormat`). An assembly's parts may share the model's parameters: each part's `scadMapping` names
 * the parameter keys it consumes, and the same key may feed several parts. `referencePath` is optional: omit it when there is no small, permanent "original"
 * STL to preserve (e.g. when the only source was a large STL that will not stay in the repository).
 */
export interface ModelDefinition {
  id: string;
  version: string;
  title: string;
  description: string;
  attribution: string;
  printNotes: string;
  license: string;
  licenseUrl: string;
  sourcePath?: string;
  referencePath?: string;
  parts?: ModelPart[];
  parameterSchema: TSchema;
  controls: Control[];
  defaults: ParameterValues;
  scadMapping: Record<string, string>;
  validate: (parameters: unknown) => ParameterIssue[];
  derived: (parameters: unknown) => { slotCount: number | null };
}

/** True for a multi-part assembly model (rendered as N independent solids, packaged as one ZIP). */
export function isAssembly(model: ModelDefinition): model is ModelDefinition & { parts: ModelPart[] } {
  return Boolean(model.parts && model.parts.length > 0);
}

/** Every SCAD file that determines this model's geometry, in render order (1 entry, or N for an assembly). */
export function modelSourcePaths(model: ModelDefinition): string[] {
  if (isAssembly(model)) return model.parts.map(part => part.sourcePath);
  return model.sourcePath ? [model.sourcePath] : [];
}

/** The shape of the generated artifact: one STL, or a ZIP of one STL per part. */
export function artifactFormat(model: ModelDefinition): 'stl' | 'zip' {
  return isAssembly(model) ? 'zip' : 'stl';
}

export const fruitFlyTrap = {
  id: 'fruit-fly-trap' as const, version: '1' as const, title: 'Fruit fly trap',
  description: 'A customizable funnel that sits on a jar. Choose a smooth wall or a pattern of fine ventilation slots.',
  attribution: 'Stefan Schönberger · adapted for CanFactory',
  printNotes: 'Print brim-side down',
  license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sourcePath: 'models/fruit-fly-trap/generator.scad',
  referencePath: 'models/fruit-fly-trap/reference/fruit_fly_trap.stl',
  parameterSchema: FruitFlyTrapParametersSchema,
  controls,
  defaults: Object.fromEntries(controls.map(c => [c.key, c.default])),
  scadMapping: {
    trapDiameter: 'TRAP_DIAMETER', trapHeight: 'TRAP_HEIGHT', brimWidth: 'BRIM_WIDTH',
    nozzleDiameter: 'NOZZLE_DIAMETER', slotsEnabled: 'SLOTS_ENABLED', wallThickness: 'WALL_THICKNESS',
    handles: 'BRIM_HANDLES', gapHeight: 'GAP_HEIGHT', gapWidth: 'GAP_WIDTH',
    gapDistanceHorizontal: 'GAP_DISTANCE_HORIZONTAL', gapDistanceVertical: 'GAP_DISTANCE_VERTICAL',
  },
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(FruitFlyTrapParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return validateTrap(parameters);
  },
  derived(parameters: unknown) {
    return { slotCount: Value.Check(FruitFlyTrapParametersSchema, parameters) ? slotCount(parameters) : null };
  },
} satisfies ModelDefinition;

/**
 * Moss planter: five parts (ground spike, planting helper, cover cap, and two RAUTE lattice segments) that share one
 * thread, so parts built for the same `towerDiameter` screw together. `towerDiameter` scales every part (52 and 100
 * are the sizes of the original design); the other parameters apply to one part each.
 */
export const MossPlanterParametersSchema = Type.Object({
  towerDiameter: dimension('Tower diameter', 'Outer diameter of the lattice segments and cover cap, in mm. Every part is scaled to it, so all parts fit together. The original design is 52 or 100.', 52, 40, 120, 1),
  spikeLength: dimension('Ground spike length', 'Overall length of the ground spike in mm. At least 60 mm for a 52 mm tower, growing in proportion to the tower diameter (the original 52 mm spike is 124 mm).', 124, 50, 300, 1),
  shortRauteRows: Type.Integer({ title: 'Short lattice rows', description: 'Rows of diamonds in the short lattice segment. The height grows by about 17.5 mm per row (the original has 4).', default: 4, minimum: 2, maximum: 20 }),
  tallRauteRows: Type.Integer({ title: 'Tall lattice rows', description: 'Rows of diamonds in the tall lattice segment. The height grows by about 17.5 mm per row (the original has 10).', default: 10, minimum: 2, maximum: 24 }),
  rauteColumns: Type.Integer({ title: 'Lattice columns', description: 'Struts around both lattice segments. 0 chooses automatically from the tower diameter (6 at 52 mm, 12 at 100 mm); otherwise 4 to 16.', default: 0, minimum: 0, maximum: 16 }),
}, { additionalProperties: false, description: 'Moss planter parameters. Lengths are in millimetres. All fields are required.' });
export type MossPlanterParameters = Static<typeof MossPlanterParametersSchema>;

const mossPlanterControls = [
  control(MossPlanterParametersSchema, 'towerDiameter', 'basic'),
  control(MossPlanterParametersSchema, 'spikeLength', 'basic'),
  control(MossPlanterParametersSchema, 'shortRauteRows', 'basic', null, null),
  control(MossPlanterParametersSchema, 'tallRauteRows', 'basic', null, null),
  control(MossPlanterParametersSchema, 'rauteColumns', 'advanced', null, null),
];

/** Columns the RAUTE generator picks for `rauteColumns = 0`; mirrors `NCOLS` in models/moss-planter/raute.scad. */
export function rauteColumns(p: MossPlanterParameters): number {
  return p.rauteColumns > 0 ? p.rauteColumns : Math.max(3, Math.round(p.towerDiameter / 8.66));
}

/** Shortest spike (mm) at this tower diameter: the base alone is about 50 mm tall at 52 mm. */
export const minimumSpikeLength = (towerDiameter: number): number => Math.ceil(60 * towerDiameter / 52);

/** Struts (rows x columns) one lattice segment may have; more exceeds the 120-second render limit. */
const MAX_LATTICE_CELLS = 340;

function validateMossPlanter(p: MossPlanterParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  if (p.rauteColumns !== 0 && p.rauteColumns < 4)
    issues.push({ field: 'rauteColumns', message: 'Use 0 for automatic, or at least 4 columns.' });
  if (p.spikeLength < minimumSpikeLength(p.towerDiameter))
    issues.push({ field: 'spikeLength', message: `At a ${p.towerDiameter} mm tower diameter the spike must be at least ${minimumSpikeLength(p.towerDiameter)} mm long.` });
  const columns = rauteColumns(p);
  if (columns * Math.max(p.shortRauteRows, p.tallRauteRows) > MAX_LATTICE_CELLS)
    issues.push({ field: p.tallRauteRows >= p.shortRauteRows ? 'tallRauteRows' : 'shortRauteRows',
      message: `${columns} columns times this many rows is too complex to render. Use fewer rows or columns.` });
  return issues;
}

const MOSS_PLANTER_DIR = 'models/moss-planter/';

/** The five parts of the moss tower. `id` is the STL basename inside the ZIP. Every part takes `towerDiameter`. */
const mossPlanterParts: ModelPart[] = [
  { id: 'ground-spike', title: 'Ground spike', sourcePath: `${MOSS_PLANTER_DIR}spike.scad`,
    scadMapping: { towerDiameter: 'TOWER_DIAMETER', spikeLength: 'SPIKE_LENGTH' } },
  { id: 'planting-helper', title: 'Planting helper', sourcePath: `${MOSS_PLANTER_DIR}helper.scad`,
    scadMapping: { towerDiameter: 'TOWER_DIAMETER' } },
  { id: 'cover-cap', title: 'Cover cap', sourcePath: `${MOSS_PLANTER_DIR}cap.scad`,
    scadMapping: { towerDiameter: 'TOWER_DIAMETER' } },
  { id: 'lattice-short', title: 'Lattice segment, short', sourcePath: `${MOSS_PLANTER_DIR}raute.scad`,
    scadMapping: { towerDiameter: 'TOWER_DIAMETER', shortRauteRows: 'ROWS', rauteColumns: 'COLUMNS' } },
  { id: 'lattice-tall', title: 'Lattice segment, tall', sourcePath: `${MOSS_PLANTER_DIR}raute.scad`,
    scadMapping: { towerDiameter: 'TOWER_DIAMETER', tallRauteRows: 'ROWS', rauteColumns: 'COLUMNS' } },
];

export const mossPlanter = {
  id: 'moss-planter' as const, version: '2' as const, title: 'Moss planter (Verdura)',
  description: 'Five parts of a modular moss-tower kit — ground spike, planting helper, cover cap, and two lattice segments — in any tower diameter. Every part is generated to fit the others; download the full set as a ZIP of STL files.',
  attribution: 'HpInvent (MakerWorld)',
  printNotes: 'Print each part separately.',
  // Kept short deliberately: this string and `attribution` together are stamped into each STL's 80-byte header
  // (see apps/worker/src/render.ts's stampAttribution) and would otherwise be silently truncated there.
  license: 'Adapted, original MakerWorld terms apply', licenseUrl: 'https://makerworld.com/de/models/1200114-moss-tower-verdura-the-modular-climbing-support',
  parts: mossPlanterParts,
  parameterSchema: MossPlanterParametersSchema,
  controls: mossPlanterControls,
  defaults: Object.fromEntries(mossPlanterControls.map(c => [c.key, c.default])),
  scadMapping: {},
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(MossPlanterParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return validateMossPlanter(parameters);
  },
  derived: () => ({ slotCount: null }),
} satisfies ModelDefinition;

/** Add models here; shared API contracts and the generic editor consume this registry. Widened to the shared
 * interface (rather than the precise literal-typed tuple) so generic code can read optional fields uniformly;
 * `findModel`/`RenderRequestSchema` still discriminate on each model's own literal `id`/`version`. */
export const models: readonly ModelDefinition[] = [fruitFlyTrap, mossPlanter];

export function findModel(id: string): ModelDefinition | undefined { return models.find(model => model.id === id); }

/** Validates unknown browser/API input, including cross-field rules, without coercion. */
export function validateParameters(model: ModelDefinition, parameters: unknown): ParameterIssue[] {
  if (!Value.Check(model.parameterSchema, parameters)) {
    return [...Value.Errors(model.parameterSchema, parameters)].map(error => ({
      field: error.instancePath.replace(/^\//, ''), message: error.message,
    }));
  }
  return model.validate(parameters);
}
