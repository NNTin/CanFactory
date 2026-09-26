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
  options: Type.Union([Type.Array(Type.Object({ value: Type.String(), label: Type.String(), description: Type.String() }, { additionalProperties: false })), Type.Null()],
    { description: 'The allowed values of an enum control, in display order; null for other kinds.' }),
}, { additionalProperties: false });
export type Control = Static<typeof ControlSchema>;
export type ParameterValues = Record<string, number | boolean | string>;

function control<T extends { properties: Record<string, TSchema> }>(
  schema: T, key: keyof T['properties'] & string, group: Control['group'], enabledWhen: string | null = null, unit: Control['unit'] = 'mm',
): Control {
  const property: TSchema & { type?: unknown } = schema.properties[key] ?? (() => { throw new Error(`Unknown parameter ${key}.`); })();
  return {
    key, group, enabledWhen, options: null,
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
    key, group, enabledWhen: null, options, kind: 'enum', unit: null, minimum: null, maximum: null, step: null,
    label: property.title ?? key, description: property.description ?? '',
    default: typeof property.default === 'string' ? property.default : first.value,
  };
}

/** A control for a string property: a one-line text box. `maximum` carries the character limit. */
function textControl<T extends { properties: Record<string, TSchema> }>(schema: T, key: keyof T['properties'] & string, group: Control['group']): Control {
  const property: TSchema & { title?: string; description?: string; default?: unknown; maxLength?: number } = schema.properties[key] ?? (() => { throw new Error(`Unknown parameter ${key}.`); })();
  return {
    key, group, enabledWhen: null, options: null, kind: 'text', unit: null, minimum: 0, maximum: property.maxLength ?? null, step: null,
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
 * Cigarette case (Onz by sez16sez): five independent parts, reconstructed from STL as static SCAD, with one parameter: how the
 * parts snap together. The large box and lid have a honeycomb wall; the small set (holder, shallow box and lid) does not. The
 * `snap` mode drives every joint through the parts' `SNAP` variable: the lid over the box's upper shell (all modes add a
 * matching pair of features to the box and the lid) and the mini lid in the mini box (only `crush-ribs` adds ribs to the mini
 * lid; the original detent pads and notches stay in every mode). `friction` is the original geometry, unchanged.
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
    title: 'Snap mechanism', description: 'How the parts hold together: a plain close fit, a detent, a flexible clip, magnets or crush ribs. It applies to every joint that supports it.', default: 'friction',
  }),
  engraveText: Type.String({
    title: 'Underside text', description: `Text on the underside of the large box, one line, up to ${TEXT_AREA.maxCharacters} characters (letters, digits, spaces and punctuation, no accents). Leave empty for none.`,
    default: '', maxLength: TEXT_AREA.maxCharacters, pattern: '^[ -~]*$',
  }),
  textFont: Type.Enum(TEXT_FONT_VALUES, { title: 'Text font', description: 'The font of the underside text. All are bold, so that the strokes print cleanly.', default: 'sans' }),
  textSize: dimension('Text size', 'Letter height of the underside text in mm (the height of a capital letter). Longer text needs a smaller size.', 6, TEXT_AREA.minSize, TEXT_AREA.maxSize, 0.5),
  textMode: Type.Enum(TEXT_MODE_VALUES, { title: 'Text style', description: 'Engraved into the box, or carved and filled by a separate part for a second filament.', default: 'engrave' }),
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
  return [];
}

const cigaretteCaseControls = [
  enumControl(CigaretteCaseParametersSchema, 'snap', 'basic', SNAP_VALUES.map(value => ({ value, ...SNAP_TEXT[value] }))),
  textControl(CigaretteCaseParametersSchema, 'engraveText', 'basic'),
  enumControl(CigaretteCaseParametersSchema, 'textFont', 'basic', TEXT_FONT_VALUES.map(value => ({ value, ...TEXT_FONT_TEXT[value] }))),
  control(CigaretteCaseParametersSchema, 'textSize', 'basic'),
  enumControl(CigaretteCaseParametersSchema, 'textMode', 'basic', TEXT_MODE_VALUES.map(value => ({ value, ...TEXT_MODE_TEXT[value] }))),
];

const CIGARETTE_CASE_DIR = 'models/cigarette-case/reference/';
const SNAP_MAPPING = { snap: 'SNAP' };
const TEXT_MAPPING = { engraveText: 'TEXT', textFont: 'TEXT_FONT', textSize: 'TEXT_SIZE' };

/** The parts. `id` is the STL basename inside the ZIP. The SCAD files are the verified reconstructions, except `case-text`, which is
 * new: the underside text as a separate body, present only in `second-filament` mode. The holder and the shallow box have no
 * parameters (the holder's clip tab and the box's notches are part of the original). */
const cigaretteCaseParts: ModelPart[] = [
  { id: 'case-box', title: 'Case box (large)', sourcePath: `${CIGARETTE_CASE_DIR}11_v11.3__-_honeycomb_-_box.scad`, scadMapping: { ...SNAP_MAPPING, ...TEXT_MAPPING } },
  { id: 'case-lid', title: 'Case lid (large)', sourcePath: `${CIGARETTE_CASE_DIR}11_v11.3__-_honeycomb_-_top.scad`, scadMapping: SNAP_MAPPING },
  { id: 'mini-holder', title: 'Mini holder', sourcePath: `${CIGARETTE_CASE_DIR}11_-_Honeycomb_-_minibox.scad`, scadMapping: {} },
  { id: 'mini-box', title: 'Mini box', sourcePath: `${CIGARETTE_CASE_DIR}11_-_Honeycomb_-_topminibox_-_box.scad`, scadMapping: {} },
  { id: 'mini-lid', title: 'Mini box lid', sourcePath: `${CIGARETTE_CASE_DIR}11_-_Honeycomb_-_topminibox_-_top.scad`, scadMapping: SNAP_MAPPING },
  { id: 'case-text', title: 'Case text (second filament)', sourcePath: 'models/cigarette-case/underside-text.scad', scadMapping: TEXT_MAPPING, separateBodies: true,
    includedWhen: parameters => typeof parameters['engraveText'] === 'string' && hasSecondFilamentText({ engraveText: parameters['engraveText'], textMode: String(parameters['textMode']) }) },
];

export const cigaretteCase = {
  id: 'cigarette-case' as const, version: '3' as const, title: 'Cigarette case (Onz)',
  description: 'A honeycomb cigarette case in two sizes: a large box with a sliding lid, and a small holder with a shallow box and lid. Choose how the parts snap together, add text to the underside of the box (engraved, or as a second-filament part), then download every part as a ZIP of STL files.',
  attribution: 'sez16sez (Thingiverse)',
  printNotes: 'Print each part separately; the lids print rim-side down. The optional text part prints flat, in a second colour.',
  // Kept short deliberately: this string and `attribution` are stamped into each STL's 80-byte header (see stampAttribution).
  license: 'CC BY-NC 4.0 (non-commercial)', licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  parts: cigaretteCaseParts,
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

/** Add models here; shared API contracts and the generic editor consume this registry. Widened to the shared
 * interface (rather than the precise literal-typed tuple) so generic code can read optional fields uniformly;
 * `findModel`/`RenderRequestSchema` still discriminate on each model's own literal `id`/`version`. */
export const models: readonly ModelDefinition[] = [fruitFlyTrap, mossPlanter, cigaretteCase];

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
