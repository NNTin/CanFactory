import { Type, type Static, type TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { TEXT_ADVANCES } from './textMetrics.ts';

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
  kind: Type.Union([Type.Literal('number'), Type.Literal('boolean'), Type.Literal('enum'), Type.Literal('text')]),
  group: Type.Union([Type.Literal('basic'), Type.Literal('advanced')]),
  unit: Type.Union([Type.Literal('mm'), Type.Null()]),
  default: Type.Union([Type.Number(), Type.Boolean(), Type.String()]),
  minimum: Type.Union([Type.Number(), Type.Null()]),
  maximum: Type.Union([Type.Number(), Type.Null()], { description: 'Upper bound of a number; for a text control, the most characters allowed.' }),
  step: Type.Union([Type.Number(), Type.Null()]),
  enabledWhen: Type.Union([Type.String(), Type.Null()]),
  visibleWhen: Type.Union([Type.Object({
    control: Type.String({ description: 'The key of an enum control of the same model.' }),
    values: Type.Array(Type.String()),
  }, { additionalProperties: false }), Type.Null()],
  { description: 'Show this control only while another (enum) control has one of these values; its value still applies (it only matters in those modes). Null to always show it.' }),
  options: Type.Union([Type.Array(Type.Object({ value: Type.String(), label: Type.String(), description: Type.String() }, { additionalProperties: false })), Type.Null()],
    { description: 'The allowed values of an enum control, in display order; null for other kinds.' }),
  bands: Type.Union([Type.Array(Type.Object({ minimum: Type.Number(), maximum: Type.Number(), label: Type.String() }, { additionalProperties: false })), Type.Null()],
    { description: 'Named sub-ranges of a number control, in order, from minimum (included) to maximum (excluded, except for the last): the editor names the one the value is in. Null for none.' }),
  recommended: Type.Union([Type.Array(Type.Object({
    control: Type.String({ description: 'The key of an enum control of the same model.' }),
    ranges: Type.Array(Type.Object({ value: Type.String(), minimum: Type.Number(), maximum: Type.Number() }, { additionalProperties: false })),
  }, { additionalProperties: false })), Type.Null()],
  { description: 'For a number control, the sub-range recommended for each value of other (enum) controls, one entry per control: the editor highlights the range that suits all their current values on the slider, and names the controls a value is outside of. Advice only; values outside it stay valid. Null for none.' }),
}, { additionalProperties: false });
export type Control = Static<typeof ControlSchema>;
export type ParameterValues = Record<string, number | boolean | string>;

function control<T extends { properties: Record<string, TSchema> }>(
  schema: T, key: keyof T['properties'] & string, group: Control['group'], enabledWhen: string | null = null, unit: Control['unit'] = 'mm',
): Control {
  const property: TSchema & { type?: unknown } = schema.properties[key] ?? (() => { throw new Error(`Unknown parameter ${key}.`); })();
  return {
    key, group, enabledWhen, visibleWhen: null, options: null, bands: null, recommended: null,
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

/** A control for a string-literal union property: a pick-one list with a short explanation of every value. */
function enumControl<T extends { properties: Record<string, TSchema> }>(
  schema: T, key: keyof T['properties'] & string, group: Control['group'], options: Control['options'] & object,
): Control {
  const property: TSchema & { title?: string; description?: string; default?: unknown } = schema.properties[key] ?? (() => { throw new Error(`Unknown parameter ${key}.`); })();
  const first = options[0];
  if (!first) throw new Error(`Enum ${key} needs at least one option.`);
  return {
    key, group, enabledWhen: null, visibleWhen: null, options, bands: null, recommended: null, kind: 'enum', unit: null, minimum: null, maximum: null, step: null,
    label: property.title ?? key, description: property.description ?? '',
    default: typeof property.default === 'string' ? property.default : first.value,
  };
}

/** A control for a string property: a one-line text box. `maximum` carries the character limit. */
function textControl<T extends { properties: Record<string, TSchema> }>(schema: T, key: keyof T['properties'] & string, group: Control['group']): Control {
  const property: TSchema & { title?: string; description?: string; default?: unknown; maxLength?: number } = schema.properties[key] ?? (() => { throw new Error(`Unknown parameter ${key}.`); })();
  return {
    key, group, enabledWhen: null, visibleWhen: null, options: null, bands: null, recommended: null, kind: 'text', unit: null, minimum: 0, maximum: property.maxLength ?? null, step: null,
    label: property.title ?? key, description: property.description ?? '', default: typeof property.default === 'string' ? property.default : '',
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
  /** Absent means always present. When set, the part is rendered (and appears in the ZIP) only for parameters it accepts. */
  includedWhen?: (parameters: ParameterValues) => boolean;
  /** True when the part is several separate closed bodies by design, such as the letters of engraved text. */
  separateBodies?: boolean;
}

const Vector = (description: string) => Type.Array(Type.Number(), { minItems: 3, maxItems: 3, description });

/**
 * How an assembly's parts go together, for the preview's assembly slider. Millimetres and degrees, in the parts' own SCAD
 * frame (Z up). Each part's pose places its STL, exactly as rendered, at its assembled position. The exploded layout is
 * every part's pose plus the `from` offset of each step it moves in, raised by `lift`. The slider first lifts the parts from
 * the print bed into that layout, then plays the steps in order: each step moves its parts from `from` to 0. List every
 * part that moves together (e.g. a box already inside the lid that moves). `lift` is removed during the last step, so the
 * finished assembly stands on the floor. Parts without a pose stay on the print bed. `references` are real-world objects the
 * assembly holds (e.g. the lighter a bay is sized for), shown and moved like parts so that their fit can be seen; they are
 * never printed, so the worker does not render them and they are not in the ZIP (see `referenceObjectPath`).
 */
export const AssemblySchema = Type.Object({
  poses: Type.Record(Type.String(), Type.Object({
    position: Vector('Translation in mm, applied after the rotation.'),
    rotation: Type.Optional(Vector('Rotation in degrees about the part’s own origin, applied about X, then Y, then Z.')),
  }, { additionalProperties: false }), { description: 'Assembled pose per part id.' }),
  steps: Type.Array(Type.Object({
    title: Type.String({ description: 'Short caption, e.g. “Close the mini box”.' }),
    parts: Type.Array(Type.String(), { description: 'The part ids that move together in this step.' }),
    from: Vector('Offset in mm at which the parts start this step; they end it at their assembled pose.'),
  }, { additionalProperties: false })),
  lift: Type.Number({ description: 'Height in mm of the exploded layout above the print bed.' }),
  references: Type.Optional(Type.Array(Type.Object({
    id: Type.String({ description: 'Its key in `poses` and `steps`.' }),
    title: Type.String({ description: 'What it is, e.g. “BIC Mini lighter (J25)”.' }),
  }, { additionalProperties: false }), { description: 'Real-world objects shown in the preview for comparison, e.g. a lighter in its bay. Not printed and not in the ZIP.' })),
}, { additionalProperties: false });
export type Assembly = Static<typeof AssemblySchema>;

/**
 * Where an assembly's reference object lives: `<id>.scad` is its source, with the real-world dimensions as named values, and
 * `<id>.stl` beside it is that file rendered, which the web app bundles for the preview. Reference objects do not depend on
 * the model's parameters, so they are rendered once, when the SCAD file changes, rather than by the worker.
 */
export function referenceObjectPath(modelId: string, id: string, extension: 'scad' | 'stl'): string {
  return `models/${modelId}/reference-objects/${id}.${extension}`;
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
  /** Only for an assembly: how its parts go together (the preview's assembly slider). */
  assembly?: Assembly;
  /** Other files whose content changes the geometry (e.g. fonts), so that they are part of the cache fingerprint. */
  assetPaths?: string[];
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

/** Folder (relative to the project root) of the fonts OpenSCAD is pointed at, so engraved text looks the same on every host. */
export const FONTS_DIR = 'models/fonts';

/** The parts rendered for these parameters, in ZIP order: the model's parts minus those whose `includedWhen` says no. */
export function activeParts(model: ModelDefinition & { parts: ModelPart[] }, parameters: ParameterValues): ModelPart[] {
  return model.parts.filter(part => part.includedWhen?.(parameters) ?? true);
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

/**
 * Cigarette case (Onz by sez16sez): five independent parts, reconstructed from STL as static SCAD. The large box and lid have a
 * honeycomb wall; the small set (holder, shallow box and lid) does not. Each of the four joints has its own snap setting, which
 * reaches exactly the two parts of that joint (docs/cigarette-case-snap.md):
 * - `snap` (`SNAP`): the case lid over the case box's upper shell; every mode adds a matching pair of features to both.
 * - `miniLidSnap` (`MINI_LID_SNAP`): the mini lid in the mini box; the original end pads in the rim notches stay in every mode.
 * - `holderSnap` (`HOLDER_SNAP`): the mini holder in the case box's round bay; the bay's tab is only the upper stop.
 * - `miniBoxSnap` (`MINI_BOX_SNAP`): the closed mini box in the case lid's cavity.
 * `friction` adds nothing. The `clearance` reaches every part as `CLEARANCE`: the gap per side on all four mating surfaces,
 * which the snap features are sized from.
 */
const SNAP_VALUES = ['friction', 'detent', 'clip', 'magnet', 'crush-ribs'] as const;
export type SnapMode = typeof SNAP_VALUES[number];
const SNAP_TEXT: Record<SnapMode, { label: string; description: string }> = {
  friction: { label: 'Friction fit', description: 'The original design: smooth walls held by a close fit. Nothing is added.' },
  detent: { label: 'Detent', description: 'A small bump on the box that clicks into a groove in the lid.' },
  clip: { label: 'Clip', description: 'A flexible tongue on the lid whose nib snaps into a pocket in the box.' },
  magnet: { label: 'Magnets', description: 'Pockets for 6 x 2 mm round magnets in the box and lid (magnets not included).' },
  'crush-ribs': { label: 'Crush ribs', description: 'Thin ribs that are squeezed slightly by the mating wall for a snug press fit.' },
};

/** The three smaller joints offer a subset of the modes; each describes what is added at that joint. */
const INSERT_SNAP_VALUES = ['friction', 'detent', 'crush-ribs'] as const;
export type InsertSnapMode = typeof INSERT_SNAP_VALUES[number];
const MINI_LID_SNAP_TEXT: Record<InsertSnapMode, { label: string; description: string }> = {
  friction: { label: 'Clearance fit', description: 'The original design: the end pads sit in the rim notches, one clearance all round. They locate the lid but do not latch it.' },
  detent: { label: 'Detent', description: 'A small bump on each side of the mini lid clicks into a groove just under the mini box\'s rim.' },
  'crush-ribs': { label: 'Crush ribs', description: 'Three thin ribs on each side of the mini lid are squeezed slightly by the mini box\'s walls.' },
};
const HOLDER_SNAP_TEXT: Record<InsertSnapMode, { label: string; description: string }> = {
  friction: { label: 'Friction fit', description: 'Only a close fit holds the holder in the bay; it can drop out of the open floor if the clearance is loose.' },
  detent: { label: 'Detent', description: 'A bump on each end of the holder clicks into a groove in the bay. Push it out from above, e.g. with a lighter.' },
  'crush-ribs': { label: 'Crush ribs', description: 'Four thin ribs near the holder\'s floor are squeezed by the bay wall. Push it out from above, e.g. with a lighter.' },
};
const MINI_BOX_SNAP_TEXT: Record<InsertSnapMode, { label: string; description: string }> = {
  friction: { label: 'Friction fit', description: 'Only a close fit holds the closed mini box in the case lid when the lid is lifted off.' },
  detent: { label: 'Detent', description: 'A bump on each side of the case lid\'s cavity clicks into a groove in the mini box. Pull it out with a finger.' },
  'crush-ribs': { label: 'Crush ribs', description: 'Thin ribs near the top of the case lid\'s cavity are squeezed by the mini box. Pull it out with a finger.' },
};

/**
 * Clearance: the gap per side between every pair of mating surfaces (the SCAD files' `CLEARANCE`; see docs/cigarette-case-snap.md).
 * The bands name the kind of fit, and each snap mode has the range in which it works as designed (issue #7): a plain friction fit, and
 * magnets (whose pockets are oversized on their own), work across the whole range; a clip needs 0.2 to 0.4 mm around the moving nib;
 * the detent and crush ribs are sized from the clearance but need the walls to clear each other, so that only the bump or ribs touch.
 */
export const CLEARANCE_RANGE = { minimum: 0.1, maximum: 0.6, default: 0.2, step: 0.01 } as const;
const FIT_BANDS = [
  { minimum: 0.1, maximum: 0.15, label: 'Very tight (press fit)' },
  { minimum: 0.15, maximum: 0.25, label: 'Snug fit' },
  { minimum: 0.25, maximum: 0.4, label: 'Sliding fit' },
  { minimum: 0.4, maximum: 0.6, label: 'Easy sliding (removable)' },
];
export const SNAP_CLEARANCE: Record<SnapMode, { minimum: number; maximum: number }> = {
  friction: { minimum: 0.1, maximum: 0.6 },
  detent: { minimum: 0.2, maximum: 0.4 },
  clip: { minimum: 0.2, maximum: 0.4 },
  magnet: { minimum: 0.1, maximum: 0.6 },
  'crush-ribs': { minimum: 0.2, maximum: 0.4 },
};
/** The same for the three smaller joints. A friction fit is all that holds the holder and the mini box in the lid against their
 * weight, so it is only recommended up to a snug fit; the detents and ribs work as on the case lid. */
export const MINI_LID_SNAP_CLEARANCE: Record<InsertSnapMode, { minimum: number; maximum: number }> = {
  friction: { minimum: 0.1, maximum: 0.25 },
  detent: { minimum: 0.2, maximum: 0.4 },
  'crush-ribs': { minimum: 0.2, maximum: 0.4 },
};
export const HOLDER_SNAP_CLEARANCE: Record<InsertSnapMode, { minimum: number; maximum: number }> = {
  friction: { minimum: 0.1, maximum: 0.2 },
  detent: { minimum: 0.2, maximum: 0.4 },
  'crush-ribs': { minimum: 0.2, maximum: 0.4 },
};
export const MINI_BOX_SNAP_CLEARANCE: Record<InsertSnapMode, { minimum: number; maximum: number }> = {
  friction: { minimum: 0.1, maximum: 0.2 },
  detent: { minimum: 0.2, maximum: 0.4 },
  'crush-ribs': { minimum: 0.2, maximum: 0.4 },
};

/**
 * How far each detent bump reaches past the mating wall (`*_DETENT_ENGAGE`) and how much each crush rib is squeezed
 * (`*_CRUSH_SQUEEZE`), per joint: the SCAD defaults, the slider range and the recommended range. Both are on top of the
 * clearance, so they engage the same amount at any clearance (docs/cigarette-case-snap.md). They are advanced settings, shown only
 * while their joint uses that mechanism.
 */
export const SNAP_TUNING = {
  snapDetentEngage: { joint: 'snap', mode: 'detent', variable: 'DETENT_ENGAGE', default: 0.19, recommended: { minimum: 0.12, maximum: 0.25 } },
  snapCrushSqueeze: { joint: 'snap', mode: 'crush-ribs', variable: 'CRUSH_SQUEEZE', default: 0.16, recommended: { minimum: 0.08, maximum: 0.2 } },
  miniLidDetentEngage: { joint: 'miniLidSnap', mode: 'detent', variable: 'ML_DETENT_ENGAGE', default: 0.12, recommended: { minimum: 0.08, maximum: 0.18 } },
  miniLidCrushSqueeze: { joint: 'miniLidSnap', mode: 'crush-ribs', variable: 'CRUSH_SQUEEZE', default: 0.1, recommended: { minimum: 0.06, maximum: 0.15 } },
  holderDetentEngage: { joint: 'holderSnap', mode: 'detent', variable: 'HOLDER_DETENT_ENGAGE', default: 0.15, recommended: { minimum: 0.1, maximum: 0.2 } },
  holderCrushSqueeze: { joint: 'holderSnap', mode: 'crush-ribs', variable: 'HOLDER_CRUSH_SQUEEZE', default: 0.1, recommended: { minimum: 0.06, maximum: 0.15 } },
  miniBoxDetentEngage: { joint: 'miniBoxSnap', mode: 'detent', variable: 'MB_DETENT_ENGAGE', default: 0.15, recommended: { minimum: 0.1, maximum: 0.2 } },
  miniBoxCrushSqueeze: { joint: 'miniBoxSnap', mode: 'crush-ribs', variable: 'MB_CRUSH_SQUEEZE', default: 0.1, recommended: { minimum: 0.06, maximum: 0.15 } },
} as const;
export type SnapTuningKey = keyof typeof SNAP_TUNING;
/** The slider range of every engagement and squeeze, in mm. */
export const SNAP_TUNING_RANGE = { minimum: 0.02, maximum: 0.4, step: 0.01 } as const;
/** A detent's groove is engagement + clearance deep; in the 1 mm walls it is cut into, at least this much wall must remain. */
export const GROOVE_WALL = { thickness: 1, minimumLeft: 0.2 } as const;
const JOINT_NAME: Record<string, string> = { snap: 'case lid', miniLidSnap: 'mini box lid', holderSnap: 'holder in the box', miniBoxSnap: 'mini box in the lid' };
const tuningControl = (key: SnapTuningKey, what: string, description: string) => {
  const tuning = SNAP_TUNING[key];
  return dimension(`${what} (${JOINT_NAME[tuning.joint]})`, description, tuning.default, SNAP_TUNING_RANGE.minimum, SNAP_TUNING_RANGE.maximum, SNAP_TUNING_RANGE.step);
};

const TEXT_FONT_VALUES = ['sans', 'serif', 'mono', 'wide'] as const;
export type TextFont = typeof TEXT_FONT_VALUES[number];
const TEXT_FONT_TEXT: Record<TextFont, { label: string; description: string }> = {
  sans: { label: 'Sans (Liberation Sans Bold)', description: 'A clean, neutral bold sans-serif. The safe choice for small text.' },
  serif: { label: 'Serif (Liberation Serif Bold)', description: 'A bold serif with a classic look.' },
  mono: { label: 'Monospace (Liberation Mono Bold)', description: 'Every letter is equally wide, which suits numbers and codes.' },
  wide: { label: 'Wide (DejaVu Sans Bold)', description: 'Wide, open letters that stay legible at the smallest sizes; takes more room.' },
};
const TEXT_MODE_VALUES = ['engrave', 'second-filament'] as const;
export type TextMode = typeof TEXT_MODE_VALUES[number];
const TEXT_MODE_TEXT: Record<TextMode, { label: string; description: string }> = {
  engrave: { label: 'Engraved', description: 'The text is carved 0.8 mm into the underside of the box. Works on any printer.' },
  'second-filament': { label: 'Second filament', description: 'The text is carved the same way, and a separate "case-text" part fills it exactly: print it in another colour on a multi-nozzle printer or with a filament change.' },
};

/** The free, flat area on the underside of the case box (see models/cigarette-case/reference/11_v11.3__-_honeycomb_-_box.scad). */
export const TEXT_AREA = { width: 35, height: 16, margin: 0.5, maxCharacters: 20, minSize: 3, maxSize: 10 } as const;

export const CigaretteCaseParametersSchema = Type.Object({
  snap: Type.Enum(SNAP_VALUES, {
    title: 'Case lid snap', description: 'How the case lid holds on the case box: a plain close fit, a detent, a flexible clip, magnets or crush ribs. The other joints have their own settings.', default: 'friction',
  }),
  miniLidSnap: Type.Enum(INSERT_SNAP_VALUES, {
    title: 'Mini box lid', description: 'How the mini lid holds in the mini box: the original pads (a clearance fit), a detent or crush ribs.', default: 'friction',
  }),
  holderSnap: Type.Enum(INSERT_SNAP_VALUES, {
    title: 'Holder in the box', description: 'How the mini holder is held in the case box\'s round bay, which is open through the floor: a friction fit, a detent or crush ribs.', default: 'friction',
  }),
  miniBoxSnap: Type.Enum(INSERT_SNAP_VALUES, {
    title: 'Mini box in the lid', description: 'How the closed mini box is held in the case lid, so that it comes off with the lid: a friction fit, a detent or crush ribs.', default: 'friction',
  }),
  engraveText: Type.String({
    title: 'Underside text', description: `Text on the underside of the large box, one line, up to ${TEXT_AREA.maxCharacters} characters (letters, digits, spaces and punctuation, no accents). Leave empty for none.`,
    default: '', maxLength: TEXT_AREA.maxCharacters, pattern: '^[ -~]*$',
  }),
  textFont: Type.Enum(TEXT_FONT_VALUES, { title: 'Text font', description: 'The font of the underside text. All are bold, so that the strokes print cleanly.', default: 'sans' }),
  textSize: dimension('Text size', 'Letter height of the underside text in mm (the height of a capital letter). Longer text needs a smaller size.', 6, TEXT_AREA.minSize, TEXT_AREA.maxSize, 0.5),
  textMode: Type.Enum(TEXT_MODE_VALUES, { title: 'Text style', description: 'Engraved into the box, or carved and filled by a separate part for a second filament.', default: 'engrave' }),
  clearance: dimension('Clearance', 'Gap per side between parts that fit together (lid on box, mini box in the lid, holder in the box), in mm. Larger is looser; raise it if your printer prints parts that are too tight.',
    CLEARANCE_RANGE.default, CLEARANCE_RANGE.minimum, CLEARANCE_RANGE.maximum, CLEARANCE_RANGE.step),
  snapDetentEngage: tuningControl('snapDetentEngage', 'Detent engagement', 'How far the bump on the case box reaches past the case lid\'s wall, in mm, on top of the clearance. More clicks harder.'),
  snapCrushSqueeze: tuningControl('snapCrushSqueeze', 'Crush-rib squeeze', 'How much the ribs on the case box are squeezed by the case lid, in mm, on top of the clearance. More holds tighter.'),
  miniLidDetentEngage: tuningControl('miniLidDetentEngage', 'Detent engagement', 'How far the bumps on the mini lid reach past the mini box\'s wall, in mm, on top of the clearance. More clicks harder.'),
  miniLidCrushSqueeze: tuningControl('miniLidCrushSqueeze', 'Crush-rib squeeze', 'How much the ribs on the mini lid are squeezed by the mini box, in mm, on top of the clearance. More holds tighter.'),
  holderDetentEngage: tuningControl('holderDetentEngage', 'Detent engagement', 'How far the bumps on the holder reach past the bay wall, in mm, on top of the clearance. More holds harder, but a lighter must still push the holder out.'),
  holderCrushSqueeze: tuningControl('holderCrushSqueeze', 'Crush-rib squeeze', 'How much the ribs on the holder are squeezed by the bay wall, in mm, on top of the clearance. More holds tighter, but a lighter must still push the holder out.'),
  miniBoxDetentEngage: tuningControl('miniBoxDetentEngage', 'Detent engagement', 'How far the bumps in the case lid reach past the mini box\'s wall, in mm, on top of the clearance. More holds harder, but a finger must still pull the mini box out.'),
  miniBoxCrushSqueeze: tuningControl('miniBoxCrushSqueeze', 'Crush-rib squeeze', 'How much the ribs in the case lid are squeezed by the mini box, in mm, on top of the clearance. More holds tighter, but a finger must still pull the mini box out.'),
}, { additionalProperties: false, description: 'Cigarette case parameters. All fields are required.' });
export type CigaretteCaseParameters = Static<typeof CigaretteCaseParametersSchema>;

/** Width in mm of a one-line string at this font and size, from the measured advance widths (kerning ignored; measured with OpenSCAD's text()). */
export function textWidth(font: string, text: string, size: number): number {
  const advances = TEXT_ADVANCES[font];
  if (!advances) return Number.POSITIVE_INFINITY;
  let width = 0;
  for (const char of text) width += advances[char] ?? Number.POSITIVE_INFINITY;
  return width * size;
}

/** Whether the text part exists: only when there is something visible to print in a second filament. */
export const hasSecondFilamentText = (p: { engraveText: string; textMode: string }): boolean => p.textMode === 'second-filament' && p.engraveText.trim() !== '';

function validateCigaretteCase(p: CigaretteCaseParameters): ParameterIssue[] {
  const width = textWidth(p.textFont, p.engraveText, p.textSize);
  if (width > TEXT_AREA.width - TEXT_AREA.margin)
    return [{ field: 'engraveText', message: `This text is about ${Number.isFinite(width) ? width.toFixed(0) : 'too many'} mm wide at this font and size, but only ${TEXT_AREA.width - TEXT_AREA.margin} mm are free on the underside. Shorten it or lower the text size.` }];
  // A detent's groove (engagement + clearance deep) must leave enough of the 1 mm wall it is cut into: the case lid's wall, and the
  // mini box's for its own two joints. The holder's groove is in the 2.1 mm bay wall. Checked only while that detent is in use.
  const deepest = GROOVE_WALL.thickness - GROOVE_WALL.minimumLeft;
  for (const key of ['snapDetentEngage', 'miniLidDetentEngage', 'miniBoxDetentEngage'] as const) {
    const tuning = SNAP_TUNING[key];
    if (p[tuning.joint] !== tuning.mode || p[key] + p.clearance <= deepest + 1e-9) continue;
    return [{ field: key, message: `With ${p.clearance.toFixed(2)} mm clearance, a ${p[key].toFixed(2)} mm detent engagement needs a ${(p[key] + p.clearance).toFixed(2)} mm deep groove, which leaves less than ${GROOVE_WALL.minimumLeft} mm of the ${GROOVE_WALL.thickness} mm wall (${JOINT_NAME[tuning.joint]}). Keep engagement + clearance at or below ${deepest.toFixed(2)} mm.` }];
  }
  return [];
}

const cigaretteCaseControls = [
  enumControl(CigaretteCaseParametersSchema, 'snap', 'basic', SNAP_VALUES.map(value => ({ value, ...SNAP_TEXT[value] }))),
  enumControl(CigaretteCaseParametersSchema, 'miniLidSnap', 'basic', INSERT_SNAP_VALUES.map(value => ({ value, ...MINI_LID_SNAP_TEXT[value] }))),
  enumControl(CigaretteCaseParametersSchema, 'holderSnap', 'basic', INSERT_SNAP_VALUES.map(value => ({ value, ...HOLDER_SNAP_TEXT[value] }))),
  enumControl(CigaretteCaseParametersSchema, 'miniBoxSnap', 'basic', INSERT_SNAP_VALUES.map(value => ({ value, ...MINI_BOX_SNAP_TEXT[value] }))),
  textControl(CigaretteCaseParametersSchema, 'engraveText', 'basic'),
  enumControl(CigaretteCaseParametersSchema, 'textFont', 'basic', TEXT_FONT_VALUES.map(value => ({ value, ...TEXT_FONT_TEXT[value] }))),
  control(CigaretteCaseParametersSchema, 'textSize', 'basic'),
  enumControl(CigaretteCaseParametersSchema, 'textMode', 'basic', TEXT_MODE_VALUES.map(value => ({ value, ...TEXT_MODE_TEXT[value] }))),
  { ...control(CigaretteCaseParametersSchema, 'clearance', 'advanced'), bands: FIT_BANDS,
    recommended: [
      { control: 'snap', ranges: SNAP_VALUES.map(value => ({ value, ...SNAP_CLEARANCE[value] })) },
      { control: 'miniLidSnap', ranges: INSERT_SNAP_VALUES.map(value => ({ value, ...MINI_LID_SNAP_CLEARANCE[value] })) },
      { control: 'holderSnap', ranges: INSERT_SNAP_VALUES.map(value => ({ value, ...HOLDER_SNAP_CLEARANCE[value] })) },
      { control: 'miniBoxSnap', ranges: INSERT_SNAP_VALUES.map(value => ({ value, ...MINI_BOX_SNAP_CLEARANCE[value] })) },
    ] },
  // each joint's engagement or squeeze, shown only while that joint uses the mechanism, with its recommended range highlighted
  ...(Object.keys(SNAP_TUNING) as SnapTuningKey[]).map(key => {
    const tuning = SNAP_TUNING[key];
    return { ...control(CigaretteCaseParametersSchema, key, 'advanced'), visibleWhen: { control: tuning.joint, values: [tuning.mode] },
      recommended: [{ control: tuning.joint, ranges: [{ value: tuning.mode, ...tuning.recommended }] }] };
  }),
];

const CIGARETTE_CASE_DIR = 'models/cigarette-case/reference/';
const CLEARANCE_MAPPING = { clearance: 'CLEARANCE' };
// Each joint's setting, engagement and squeeze reach the parts of that joint that carry the feature (a groove needs the engagement too).
const SNAP_MAPPING = { snap: 'SNAP', snapDetentEngage: 'DETENT_ENGAGE' };
const MINI_LID_SNAP_MAPPING = { miniLidSnap: 'MINI_LID_SNAP', miniLidDetentEngage: 'ML_DETENT_ENGAGE' };
const HOLDER_SNAP_MAPPING = { holderSnap: 'HOLDER_SNAP', holderDetentEngage: 'HOLDER_DETENT_ENGAGE' };
const MINI_BOX_SNAP_MAPPING = { miniBoxSnap: 'MINI_BOX_SNAP', miniBoxDetentEngage: 'MB_DETENT_ENGAGE' };
const TEXT_MAPPING = { engraveText: 'TEXT', textFont: 'TEXT_FONT', textSize: 'TEXT_SIZE' };

/** The parts. `id` is the STL basename inside the ZIP. The SCAD files are the verified reconstructions, with their mating surfaces
 * fitted to one clearance (the `clearance` parameter; see models/cigarette-case/reference/VERIFICATION.md), except
 * `case-text`, which is new: the underside text as a separate body, present only in `second-filament` mode. Each snap setting
 * reaches the two parts of its joint. */
const cigaretteCaseParts: ModelPart[] = [
  { id: 'case-box', title: 'Case box (large)', sourcePath: `${CIGARETTE_CASE_DIR}11_v11.3__-_honeycomb_-_box.scad`, scadMapping: { ...CLEARANCE_MAPPING, ...SNAP_MAPPING, snapCrushSqueeze: 'CRUSH_SQUEEZE', ...HOLDER_SNAP_MAPPING, ...TEXT_MAPPING } },
  { id: 'case-lid', title: 'Case lid (large)', sourcePath: `${CIGARETTE_CASE_DIR}11_v11.3__-_honeycomb_-_top.scad`, scadMapping: { ...CLEARANCE_MAPPING, ...SNAP_MAPPING, ...MINI_BOX_SNAP_MAPPING, miniBoxCrushSqueeze: 'MB_CRUSH_SQUEEZE' } },
  { id: 'mini-holder', title: 'Mini holder', sourcePath: `${CIGARETTE_CASE_DIR}11_-_Honeycomb_-_minibox.scad`, scadMapping: { ...CLEARANCE_MAPPING, ...HOLDER_SNAP_MAPPING, holderCrushSqueeze: 'HOLDER_CRUSH_SQUEEZE' } },
  { id: 'mini-box', title: 'Mini box', sourcePath: `${CIGARETTE_CASE_DIR}11_-_Honeycomb_-_topminibox_-_box.scad`, scadMapping: { ...CLEARANCE_MAPPING, ...MINI_LID_SNAP_MAPPING, ...MINI_BOX_SNAP_MAPPING } },
  { id: 'mini-lid', title: 'Mini box lid', sourcePath: `${CIGARETTE_CASE_DIR}11_-_Honeycomb_-_topminibox_-_top.scad`, scadMapping: { ...CLEARANCE_MAPPING, ...MINI_LID_SNAP_MAPPING, miniLidCrushSqueeze: 'CRUSH_SQUEEZE' } },
  { id: 'case-text', title: 'Case text (second filament)', sourcePath: 'models/cigarette-case/underside-text.scad', scadMapping: TEXT_MAPPING, separateBodies: true,
    includedWhen: parameters => typeof parameters['engraveText'] === 'string' && hasSecondFilamentText({ engraveText: parameters['engraveText'], textMode: String(parameters['textMode']) }) },
];

/**
 * The closed case, in the case box's frame. Found by collision checks on the rendered parts (docs/cigarette-case-assembly.md,
 * `npm run check:assembly`): the lid's rim sits on the box's step at 60.38 mm. The holder stands flush with the box's
 * underside in the round bay, which is open through the floor; the clip tab stops it from coming in from the top. The mini
 * lid sits flush in the mini box: cap level with the rim, pads centred in the notches. The closed mini box goes into the lid
 * upside down, turned over about X: its floor, whose +X end is the curved sweep, lies against the lid's flat ceiling (98.23 mm)
 * and its open side, closed by the mini lid's flat cap, faces the case box. Turning about X keeps its chamfered end one
 * clearance from the lid's chamfer. The mini lid, printed cap down, is used cap down, turned about Z only. Every fitted part is
 * derived from the surface it fits into (issue #7), so these poses hold for any clearance.
 */
const cigaretteCaseAssembly: Assembly = {
  poses: {
    'case-box': { position: [0, 0, 0] },
    'case-text': { position: [0, 0, 0] },
    'case-lid': { position: [0, 0, 60.38] },
    'mini-holder': { position: [-16.84, 0, 0] },
    'mini-box': { position: [6.43, 0, 98.23], rotation: [180, 0, 0] },
    'mini-lid': { position: [6.43, 0, 83.839], rotation: [0, 0, 180] },
    // In the round bay, above the holder: centred like it, width along Y, base down, resting on the clip tab (the lowest point
    // clear of the box and the holder). Its top is 1.1 mm under the lid's ceiling (docs/cigarette-case-assembly.md).
    'mini-bic-lighter': { position: [-16.84, 0, 35.12] },
  },
  steps: [
    { title: 'Close the mini box', parts: ['mini-lid'], from: [0, 0, -20] },
    { title: 'Slide the mini box into the lid', parts: ['mini-box', 'mini-lid'], from: [0, 0, -44] },
    { title: 'Push the holder into the box', parts: ['mini-holder'], from: [0, 0, -42] },
    { title: 'Insert the lighter into its bay', parts: ['mini-bic-lighter'], from: [0, 0, 50] },
    { title: 'Close the case', parts: ['case-lid', 'mini-box', 'mini-lid'], from: [0, 0, 100] },
  ],
  lift: 50,
  references: [{ id: 'mini-bic-lighter', title: 'BIC Mini lighter (J25)' }],
};

export const cigaretteCase = {
  id: 'cigarette-case' as const, version: '5' as const, title: 'Cigarette case (Onz)',
  description: 'A honeycomb cigarette case in two sizes: a large box with a sliding lid, and a small holder with a shallow box and lid. Choose how each joint holds (the lid on the box, the mini lid, the holder in the box and the mini box in the lid) and how closely the parts fit, add text to the underside of the box (engraved, or as a second-filament part), then download every part as a ZIP of STL files.',
  attribution: 'sez16sez (Thingiverse)',
  printNotes: 'Print each part separately; the lids print rim-side down. The optional text part prints flat, in a second colour.',
  // Kept short deliberately: this string and `attribution` are stamped into each STL's 80-byte header (see stampAttribution).
  license: 'CC BY-NC 4.0 (non-commercial)', licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  parts: cigaretteCaseParts,
  assembly: cigaretteCaseAssembly,
  assetPaths: ['LiberationSans-Bold.ttf', 'LiberationSerif-Bold.ttf', 'LiberationMono-Bold.ttf', 'DejaVuSans-Bold.ttf'].map(name => `${FONTS_DIR}/${name}`),
  parameterSchema: CigaretteCaseParametersSchema,
  controls: cigaretteCaseControls,
  defaults: Object.fromEntries(cigaretteCaseControls.map(c => [c.key, c.default])),
  scadMapping: {},
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(CigaretteCaseParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return validateCigaretteCase(parameters);
  },
  derived: () => ({ slotCount: null }),
} satisfies ModelDefinition;

/**
 * Plank connector: an original design (models/plank-connector/generator.scad). A symmetric sleeve with one pocket per plank end
 * and a solid stop between them, so two planks meet end to end inside it. The default pocket, 50.22 x 4.80 mm, fits a
 * 50.20 x 4.80 mm plank with 0.02 mm of clearance on the wide side only. Screw holes are optional through-holes across the wide
 * faces, sized as clearance holes per DIN EN 20273 (ISO 273).
 */
const SCREW_HOLE_VALUES = ['none', 'M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8'] as const;
export type ScrewHoles = typeof SCREW_HOLE_VALUES[number];
const HOLE_FIT_VALUES = ['fine', 'medium', 'coarse'] as const;
export type HoleFit = typeof HOLE_FIT_VALUES[number];

/**
 * DIN EN 20273 (ISO 273) clearance-hole diameters in mm, per screw size and series: fine (H12), medium (H13, the usual choice)
 * and coarse (H14). Mirrors `DIN_EN_20273` in models/plank-connector/generator.scad (a test keeps the two identical).
 */
export const CLEARANCE_HOLES: Record<Exclude<ScrewHoles, 'none'>, Record<HoleFit, number>> = {
  M2: { fine: 2.2, medium: 2.4, coarse: 2.6 },
  'M2.5': { fine: 2.7, medium: 2.9, coarse: 3.1 },
  M3: { fine: 3.2, medium: 3.4, coarse: 3.6 },
  M4: { fine: 4.3, medium: 4.5, coarse: 4.8 },
  M5: { fine: 5.3, medium: 5.5, coarse: 5.8 },
  M6: { fine: 6.4, medium: 6.6, coarse: 7 },
  M8: { fine: 8.4, medium: 9, coarse: 10 },
};

/** Diameter in mm of the through-holes for these settings; 0 without holes. */
export const holeDiameter = (p: { screwHoles: ScrewHoles; holeFit: HoleFit }): number =>
  p.screwHoles === 'none' ? 0 : CLEARANCE_HOLES[p.screwHoles][p.holeFit];

const SCREW_HOLE_TEXT: Record<ScrewHoles, { label: string; description: string }> = {
  none: { label: 'No holes', description: 'A plain sleeve; the planks are held by the close fit alone (or glue).' },
  ...Object.fromEntries(Object.entries(CLEARANCE_HOLES).map(([screw, hole]) => [screw, {
    label: `${screw} (${hole.medium} mm hole)`,
    description: `Through-holes for ${screw} screws: ${hole.fine} / ${hole.medium} / ${hole.coarse} mm (fine / medium / coarse, DIN EN 20273).`,
  }])) as Record<Exclude<ScrewHoles, 'none'>, { label: string; description: string }>,
};
const HOLE_FIT_TEXT: Record<HoleFit, { label: string; description: string }> = {
  fine: { label: 'Fine (H12)', description: 'The smallest DIN EN 20273 hole: the screw is located closely.' },
  medium: { label: 'Medium (H13)', description: 'The standard DIN EN 20273 hole, the usual choice.' },
  coarse: { label: 'Coarse (H14)', description: 'The largest DIN EN 20273 hole: most play, easiest to line up with a hole drilled in the plank.' },
};

export const PlankConnectorParametersSchema = Type.Object({
  pocketWidth: dimension('Pocket width', 'Wide side of each pocket in mm: the plank width plus clearance. The default fits a 50.20 mm plank with 0.02 mm to spare.', 50.22, 5, 200, 0.01),
  pocketThickness: dimension('Pocket thickness', 'Thin side of each pocket in mm: the plank thickness plus clearance. The default fits a 4.80 mm plank exactly.', 4.8, 1, 50, 0.01),
  insertionDepth: dimension('Insertion depth', 'How far each plank end goes into the connector, in mm.', 20, 5, 150, 0.5),
  screwHoles: Type.Enum(SCREW_HOLE_VALUES, {
    title: 'Screw holes', description: 'Optional through-holes across the wide faces, to screw or bolt each plank in place, sized for the chosen metric screw per DIN EN 20273. Drill the planks to match.', default: 'none',
  }),
  holeFit: Type.Enum(HOLE_FIT_VALUES, { title: 'Hole fit', description: 'The DIN EN 20273 series of the screw holes (when there are holes).', default: 'medium' }),
  holesPerEnd: Type.Integer({ title: 'Holes per plank', description: 'Screw holes per plank end, spread evenly across the pocket width (when there are holes).', default: 2, minimum: 1, maximum: 4 }),
  wallThickness: dimension('Wall thickness', 'Material around the pockets on every side, in mm.', 2, 0.8, 10),
  stopThickness: dimension('Centre stop', 'Thickness of the solid stop between the two pockets, in mm. 0 makes an open sleeve that the planks can slide through.', 2, 0, 20),
  entryChamfer: dimension('Entry chamfer', 'Size of the 45° lead-in at each pocket opening, in mm, which eases the plank in. 0 for none.', 0.5, 0, 5),
}, { additionalProperties: false, description: 'Plank connector parameters. All fields are required; dimensions are in millimetres.' });
export type PlankConnectorParameters = Static<typeof PlankConnectorParametersSchema>;

/** Least material in mm between a screw hole and a plank edge, a neighbouring hole or the plank end. */
const HOLE_MARGIN = 1;

function validatePlankConnector(p: PlankConnectorParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  if (p.entryChamfer > p.wallThickness - 0.4)
    issues.push({ field: 'entryChamfer', message: `The entry chamfer must leave at least 0.4 mm of wall: at most ${Math.max(0, p.wallThickness - 0.4).toFixed(1)} mm for this wall thickness.` });
  const hole = holeDiameter(p);
  if (hole > 0) {
    if (hole + 2 * HOLE_MARGIN > p.insertionDepth)
      issues.push({ field: 'insertionDepth', message: `A ${hole} mm screw hole needs an insertion depth of at least ${hole + 2 * HOLE_MARGIN} mm.` });
    if (hole + 2 * HOLE_MARGIN > p.pocketWidth / p.holesPerEnd)
      issues.push({ field: 'holesPerEnd', message: `${p.holesPerEnd} holes of ${hole} mm do not fit across a ${p.pocketWidth} mm pocket. Use fewer holes or a smaller screw.` });
  }
  return issues;
}

const plankConnectorControls = [
  control(PlankConnectorParametersSchema, 'pocketWidth', 'basic'),
  control(PlankConnectorParametersSchema, 'pocketThickness', 'basic'),
  control(PlankConnectorParametersSchema, 'insertionDepth', 'basic'),
  enumControl(PlankConnectorParametersSchema, 'screwHoles', 'basic', SCREW_HOLE_VALUES.map(value => ({ value, ...SCREW_HOLE_TEXT[value] }))),
  enumControl(PlankConnectorParametersSchema, 'holeFit', 'advanced', HOLE_FIT_VALUES.map(value => ({ value, ...HOLE_FIT_TEXT[value] }))),
  control(PlankConnectorParametersSchema, 'holesPerEnd', 'advanced', null, null),
  control(PlankConnectorParametersSchema, 'wallThickness', 'advanced'),
  control(PlankConnectorParametersSchema, 'stopThickness', 'advanced'),
  control(PlankConnectorParametersSchema, 'entryChamfer', 'advanced'),
];

export const plankConnector = {
  id: 'plank-connector' as const, version: '1' as const, title: 'Plank connector',
  description: 'A sleeve that joins two planks end to end: each plank slides into its own pocket up to a centre stop. Set the pocket to your plank’s cross-section and the insertion depth, and add screw holes sized per DIN EN 20273 if you like.',
  attribution: 'CanFactory (original design)',
  printNotes: 'Print standing on one end, as generated; no supports needed.',
  license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  sourcePath: 'models/plank-connector/generator.scad',
  parameterSchema: PlankConnectorParametersSchema,
  controls: plankConnectorControls,
  defaults: Object.fromEntries(plankConnectorControls.map(c => [c.key, c.default])),
  scadMapping: {
    pocketWidth: 'POCKET_WIDTH', pocketThickness: 'POCKET_THICKNESS', insertionDepth: 'INSERTION_DEPTH',
    screwHoles: 'SCREW_SIZE', holeFit: 'HOLE_FIT', holesPerEnd: 'HOLES_PER_END',
    wallThickness: 'WALL_THICKNESS', stopThickness: 'STOP_THICKNESS', entryChamfer: 'ENTRY_CHAMFER',
  },
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(PlankConnectorParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return validatePlankConnector(parameters);
  },
  derived: () => ({ slotCount: null }),
} satisfies ModelDefinition;

/** Add models here; shared API contracts and the generic editor consume this registry. Widened to the shared
 * interface (rather than the precise literal-typed tuple) so generic code can read optional fields uniformly;
 * `findModel`/`RenderRequestSchema` still discriminate on each model's own literal `id`/`version`. */
export const models: readonly ModelDefinition[] = [fruitFlyTrap, mossPlanter, cigaretteCase, plankConnector];

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
