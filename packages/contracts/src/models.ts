import { Type, type Static, type TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { dimensionOf, findPart, ISO_273_CLEARANCE_HOLES, partAssetPath, type MetricThread, type Part } from './parts/index.ts';
import { TEXT_ADVANCES } from './textMetrics.ts';
import { decodeLogo, LOGO_MAX_LENGTH, logoScad, SvgError } from './svgLogo.ts';

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

const VisibleWhenSchema = Type.Object({
  control: Type.String({ description: 'The key of an enum control of the same model.' }),
  values: Type.Array(Type.String()),
}, { additionalProperties: false });

/** Generic, schema-derived controls understood by the shared React editor. */
export const ControlSchema = Type.Object({
  key: Type.String(),
  label: Type.String(),
  description: Type.String(),
  kind: Type.Union([Type.Literal('number'), Type.Literal('boolean'), Type.Literal('enum'), Type.Literal('text'), Type.Literal('svg')], {
    description: 'An `svg` control takes an SVG file, which the editor turns into a logo string (packages/contracts/src/svgLogo.ts); its value is that string, empty for none.',
  }),
  group: Type.Union([Type.Literal('basic'), Type.Literal('advanced')]),
  unit: Type.Union([Type.Literal('mm'), Type.Null()]),
  default: Type.Union([Type.Number(), Type.Boolean(), Type.String()]),
  minimum: Type.Union([Type.Number(), Type.Null()]),
  maximum: Type.Union([Type.Number(), Type.Null()], { description: 'Upper bound of a number; for a text control, the most characters allowed.' }),
  step: Type.Union([Type.Number(), Type.Null()]),
  enabledWhen: Type.Union([Type.String(), Type.Null()]),
  visibleWhen: Type.Union([VisibleWhenSchema, Type.Array(VisibleWhenSchema, { minItems: 1 }), Type.Null()],
  { description: 'Show this control only while another (enum) control has one of these values, or, given several such conditions, while all of them hold; its value still applies (it only matters in those modes). Null to always show it.' }),
  options: Type.Union([Type.Array(Type.Object({ value: Type.String(), label: Type.String(), description: Type.String() }, { additionalProperties: false })), Type.Null()],
    { description: 'The allowed values of an enum control, in display order; null for other kinds.' }),
  bands: Type.Union([Type.Array(Type.Object({ minimum: Type.Number(), maximum: Type.Number(), label: Type.String() }, { additionalProperties: false })), Type.Null()],
    { description: 'Named sub-ranges of a number control, in order, from minimum (included) to maximum (excluded, except for the last): the editor names the one the value is in. Null for none.' }),
  recommended: Type.Union([Type.Array(Type.Object({
    control: Type.String({ description: 'The key of an enum control of the same model.' }),
    ranges: Type.Array(Type.Object({ value: Type.String(), minimum: Type.Number(), maximum: Type.Number() }, { additionalProperties: false })),
  }, { additionalProperties: false })), Type.Null()],
  { description: 'For a number control, the sub-range recommended for each value of other (enum) controls, one entry per control: the editor highlights the range that suits all their current values on the slider, and names the controls a value is outside of. Advice only; values outside it stay valid. Null for none.' }),
  part: Type.Union([Type.Object({
    family: Type.String({ description: 'The id of a parts-library family.' }),
    attribute: Type.Union([Type.String(), Type.Null()], { description: 'Null: each option value is the id of a part of the family. Otherwise each option value is a value of this attribute of the family (e.g. `thread` = `M3`), which stands for every part that has it.' }),
    filter: Type.Union([Type.Object({
      control: Type.String({ description: 'The key of an enum control of the same model.' }),
      attribute: Type.String({ description: 'An attribute of the family, e.g. `thread`.' }),
    }, { additionalProperties: false }), Type.Null()],
    { description: 'For part-id options: offer only the parts whose attribute equals the current value of another (enum) control, e.g. the screws of the chosen thread. The editor lists only those, and moves the choice to the first of them when the other control changes; while the control is shown, any other part is invalid. Null to offer every option.' }),
  }, { additionalProperties: false }), Type.Null()],
  { description: 'For an enum control whose options are real-world parts: the parts-library family they link to. The editor links the selected option to the library. Null for none.' }),
}, { additionalProperties: false });
export type Control = Static<typeof ControlSchema>;
export type ParameterValues = Record<string, number | boolean | string>;

function control<T extends { properties: Record<string, TSchema> }>(
  schema: T, key: keyof T['properties'] & string, group: Control['group'], enabledWhen: string | null = null, unit: Control['unit'] = 'mm',
): Control {
  const property: TSchema & { type?: unknown } = schema.properties[key] ?? (() => { throw new Error(`Unknown parameter ${key}.`); })();
  return {
    key, group, enabledWhen, visibleWhen: null, options: null, bands: null, recommended: null, part: null,
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
    key, group, enabledWhen: null, visibleWhen: null, options, bands: null, recommended: null, part: null, kind: 'enum', unit: null, minimum: null, maximum: null, step: null,
    label: property.title ?? key, description: property.description ?? '',
    default: typeof property.default === 'string' ? property.default : first.value,
  };
}

/**
 * A control for a parameter whose values are parts-library ids (a `Type.Enum` of them): a pick-one list of those parts, named and
 * described by the library, and linked to it (`part`), so that the editor links the choice to the library and the library lists
 * the model under the part's “Used by”. Their dimensions reach the SCAD files through `partDefines`.
 */
function partControl<T extends { properties: Record<string, TSchema> }>(
  schema: T, key: keyof T['properties'] & string, group: Control['group'], family: string, partIds: readonly string[],
): Control {
  const options = partIds.map(id => {
    const part = findPart(id);
    if (part?.family !== family) throw new Error(`${key}: ${id} is not a ${family} in the parts library.`);
    return { value: id, label: `${part.title} (${part.product?.sku ?? part.designation})`, description: part.description };
  });
  return { ...enumControl(schema, key, group, options), part: { family, attribute: null, filter: null } };
}

/** Whether a control is shown for these parameters (`Control.visibleWhen`). */
export function controlShown(control: Control, parameters: ParameterValues): boolean {
  const conditions = control.visibleWhen === null ? [] : Array.isArray(control.visibleWhen) ? control.visibleWhen : [control.visibleWhen];
  return conditions.every(condition => condition.values.includes(String(parameters[condition.control])));
}

/**
 * The range of a number control for these parameters: its own `minimum` and `maximum`, narrowed by the model's `limits` where the
 * room for it depends on other parameters (e.g. the longest slot the scoop's length leaves room for). The editor's slider spans
 * this range, and a shown control's value outside it is invalid (`limitIssues`).
 */
export function controlRange(model: ModelDefinition, control: Control, parameters: ParameterValues): { minimum: number | null; maximum: number | null } {
  const limit = control.kind === 'number' ? model.limits?.(parameters)[control.key] : undefined;
  const narrow = (own: number | null, other: number | undefined, pick: (a: number, b: number) => number) => other === undefined ? own : own === null ? other : pick(own, other);
  return { minimum: narrow(control.minimum, limit?.minimum, Math.max), maximum: narrow(control.maximum, limit?.maximum, Math.min) };
}

/** Issues of the shown number controls whose value is outside the range the model's `limits` leave for these parameters. */
function limitIssues(model: ModelDefinition, parameters: ParameterValues): ParameterIssue[] {
  if (!model.limits) return [];
  const limits = model.limits(parameters);
  return model.controls.flatMap(control => {
    const limit = limits[control.key], value = parameters[control.key];
    if (!limit || control.kind !== 'number' || typeof value !== 'number' || !controlShown(control, parameters)) return [];
    const unit = control.unit ? ` ${control.unit}` : '';
    if (limit.maximum !== undefined && value > limit.maximum + 1e-9) return [{ field: control.key, message: `At most ${limit.maximum}${unit}: ${limit.reason}` }];
    if (limit.minimum !== undefined && value < limit.minimum - 1e-9) return [{ field: control.key, message: `At least ${limit.minimum}${unit}: ${limit.reason}` }];
    return [];
  });
}

/** Whether a part-linked control offers this option for these parameters (`Control.part.filter`): always, unless the control
 * filters its parts by another control's value and this option's part does not have it. */
export function partOptionOffered(control: Control, option: string, parameters: ParameterValues): boolean {
  const filter = control.part?.filter;
  if (!filter) return true;
  return findPart(option)?.attributes[filter.attribute] === String(parameters[filter.control]);
}

/** The options of a control that are offered for these parameters (see `partOptionOffered`). */
export function offeredOptions(control: Control, parameters: ParameterValues): NonNullable<Control['options']> {
  return (control.options ?? []).filter(option => partOptionOffered(control, option.value, parameters));
}

/** Issues of the part-linked controls whose choice is not offered for the other controls' values, while they are shown. */
function partFilterIssues(model: ModelDefinition, parameters: ParameterValues): ParameterIssue[] {
  return model.controls.flatMap(control => {
    const filter = control.part?.filter;
    const value = parameters[control.key];
    if (!filter || !controlShown(control, parameters) || typeof value !== 'string' || partOptionOffered(control, value, parameters)) return [];
    const other = model.controls.find(c => c.key === filter.control);
    const wanted = String(parameters[filter.control]);
    return [{ field: control.key, message: `${findPart(value)?.title ?? value} does not match the ${other?.label.toLowerCase() ?? filter.control} (${wanted}). Choose one with ${filter.attribute} ${wanted}.` }];
  });
}

/** A control for a string property: a one-line text box. `maximum` carries the character limit. */
function textControl<T extends { properties: Record<string, TSchema> }>(schema: T, key: keyof T['properties'] & string, group: Control['group']): Control {
  const property: TSchema & { title?: string; description?: string; default?: unknown; maxLength?: number } = schema.properties[key] ?? (() => { throw new Error(`Unknown parameter ${key}.`); })();
  return {
    key, group, enabledWhen: null, visibleWhen: null, options: null, bands: null, recommended: null, part: null, kind: 'text', unit: null, minimum: 0, maximum: property.maxLength ?? null, step: null,
    label: property.title ?? key, description: property.description ?? '', default: typeof property.default === 'string' ? property.default : '',
  };
}

/** A control for a logo-string property: the editor reads an SVG file into it (`svgToLogo`). `maximum` carries the string's length limit. */
function svgControl<T extends { properties: Record<string, TSchema> }>(schema: T, key: keyof T['properties'] & string, group: Control['group']): Control {
  return { ...textControl(schema, key, group), kind: 'svg' };
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
  /** Dimensions of chosen library parts that this part is sized from (see `PartDefines`). */
  partDefines?: PartDefines;
}

/**
 * How a chosen real-world part reaches a SCAD file: parameter key (a part-linked control, whose value is a parts-library id) ->
 * SCAD variable -> which dimension of the chosen part, and which of its values: the nominal `value`, or the `min` or `max` of its
 * tolerance (the nominal value when the source gives no limit). A pocket takes the `max`. The worker passes the number as
 * `-D NAME=value` (`scadDefines`).
 */
export type PartDefines = Record<string, Record<string, PartDefine>>;
/**
 * One SCAD variable from the chosen part: a dimension's value (or the first of several dimensions the part has, e.g. a nylon-insert
 * nut's overall height `h`, else its height `m`, since not every part of a family has every dimension), or an attribute, written as
 * a string (e.g. a nut's `shape`).
 */
export type PartDefine = [dimension: string | readonly string[], limit: 'value' | 'min' | 'max'] | { attribute: string };

/** The OpenSCAD literal a `PartDefine` gives for this part. Throws when the part has none of its dimensions, or not its attribute. */
export function partDefineLiteral(part: Part, define: PartDefine): string {
  if (!Array.isArray(define)) {
    const value = part.attributes[define.attribute];
    if (value === undefined) throw new Error(`${part.id} has no attribute ${define.attribute}.`);
    return JSON.stringify(value);
  }
  const [dimensions, limit] = define;
  const keys: readonly string[] = typeof dimensions === 'string' ? [dimensions] : dimensions;
  const key = keys.find(candidate => part.dimensions[candidate]) ?? keys[0] ?? '';
  return JSON.stringify(dimensionOf(part, key, limit));
}

/**
 * A reference object that depends on the settings, such as the magnets chosen for a snap: shown in the assembly preview like
 * `Assembly.references`, only for the parameters it is returned for, at a pose that may follow them. `movesWith` names a part it is
 * mounted in: it joins every step that moves that part. Its title is the part's, followed by `label`.
 */
export interface LinkedReference {
  id: string; part: string; label: string;
  pose: { position: [number, number, number]; rotation?: [number, number, number] };
  movesWith?: string;
  /** A step of its own, after the assembly's steps (e.g. driving in screws once the parts are together): references with the same
   * title move together, from their `from` offset, in the order the titles first appear. */
  step?: { title: string; from: [number, number, number] };
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
 * parts-library entries with an STL preview, never printed, so the worker does not render them and they are not in the ZIP
 * (see `referencePart`).
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
    part: Type.String({ description: 'The id of the parts-library entry it is.' }),
    title: Type.String({ description: 'What it is: the part’s title, e.g. “BIC Mini lighter (J25)”.' }),
  }, { additionalProperties: false }), { description: 'Real-world objects shown in the preview for comparison, e.g. a lighter in its bay. They are parts-library entries. Not printed and not in the ZIP.' })),
}, { additionalProperties: false });
export type Assembly = Static<typeof AssemblySchema>;

/**
 * An assembly's reference object: the parts-library entry `partId`, under the pose key `id`. It must have an STL preview: its
 * `.scad` source has the real-world dimensions as named values and the `.stl` beside it is that file rendered, which the web app
 * bundles (`partAssetPath`). Reference objects do not depend on the model's parameters, so they are rendered once, when the
 * SCAD file changes, rather than by the worker.
 */
export function referencePart(id: string, partId: string): NonNullable<Assembly['references']>[number] {
  const part = findPart(partId);
  if (!part || !partAssetPath(part, 'stl')) throw new Error(`Reference ${id}: ${partId} is not a parts-library entry with an STL preview.`);
  return { id, part: part.id, title: part.title };
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
/** A narrower range for a number control (`ModelDefinition.limits`); `reason` completes the issue for a value outside it. */
export interface ControlLimit { minimum?: number; maximum?: number; reason: string }

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
  /** How a mapped parameter is written after `-D NAME=`, for values that are not plain numbers, booleans or strings (see `scadLiteral`). */
  scadEncode?: Record<string, (value: string) => string>;
  /** For a single-generator model: dimensions of chosen library parts it is sized from (see `PartDefines`). */
  partDefines?: PartDefines;
  /** Only for an assembly: reference objects that depend on the parameters (see `LinkedReference`, `resolveAssembly`). */
  linkedReferences?: (parameters: ParameterValues) => LinkedReference[];
  /** For number controls whose room depends on other parameters: the narrower range they have for these (schema-valid)
   * parameters, and why, keyed by control. See `controlRange`. */
  limits?: (parameters: ParameterValues) => Record<string, ControlLimit>;
  validate: (parameters: unknown) => ParameterIssue[];
  derived: (parameters: unknown) => { slotCount: number | null };
}

/** The OpenSCAD literal for a validated parameter value: the model's `scadEncode` for that key (given a string), or else JSON, which
 * writes numbers, booleans and quoted, escaped strings the way OpenSCAD reads them. */
export function scadLiteral(model: ModelDefinition, key: string, value: number | boolean | string): string {
  const encode = model.scadEncode?.[key];
  if (encode) {
    if (typeof value !== 'string') throw new Error(`Parameter ${key} must be a string.`);
    return encode(value);
  }
  return JSON.stringify(value);
}

/**
 * Every `-D NAME=value` override one SCAD file gets, as [NAME, literal] pairs: the parameters its `scadMapping` names (as
 * `scadLiteral` writes them) and the dimensions of the parts its `partDefines` names. Only mapped, validated values reach
 * OpenSCAD. Shared by the worker and `npm run check:assembly`, so that both render the same thing.
 */
export function scadDefines(model: ModelDefinition, source: { scadMapping?: Record<string, string>; partDefines?: PartDefines }, parameters: ParameterValues): [string, string][] {
  const defines: [string, string][] = [];
  const name = (scadName: string) => { if (!/^[A-Z_]+$/.test(scadName)) throw new Error('Invalid generator parameter mapping.'); return scadName; };
  for (const [key, scadName] of Object.entries(source.scadMapping ?? {})) {
    const value = parameters[key];
    if (value === undefined) throw new Error('Invalid generator parameter mapping.');
    defines.push([name(scadName), scadLiteral(model, key, value)]);
  }
  for (const [key, variables] of Object.entries(source.partDefines ?? {})) {
    const id = parameters[key];
    const part = typeof id === 'string' ? findPart(id) : undefined;
    if (!part) throw new Error(`Parameter ${key} is not a part of the library.`);
    for (const [scadName, define] of Object.entries(variables)) defines.push([name(scadName), partDefineLiteral(part, define)]);
  }
  return defines;
}

/**
 * The parts-library data a model's geometry depends on: every part its `partDefines` can choose, with its dimensions. Part of the
 * cache fingerprint, so that correcting a part's value (under the same id) renders the model again.
 */
export function linkedPartData(model: ModelDefinition): { id: string; dimensions: Part['dimensions'] }[] {
  const keys = new Set([model.partDefines, ...(model.parts ?? []).map(part => part.partDefines)].flatMap(defines => Object.keys(defines ?? {})));
  return [...keys].flatMap(key => model.controls.find(control => control.key === key)?.options ?? [])
    .flatMap(option => { const part = findPart(option.value); return part ? [{ id: part.id, dimensions: part.dimensions }] : []; });
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
 * honeycomb wall; the small set (holder, shallow box and lid) does not. Each of the five joints has its own snap setting, which
 * reaches exactly the printed parts of that joint (docs/cigarette-case-snap.md):
 * - `snap` (`SNAP`): the case lid over the case box's upper shell; every mode adds a matching pair of features to both.
 * - `miniLidSnap` (`MINI_LID_SNAP`): the mini lid in the mini box; the original end pads in the rim notches stay in every mode.
 * - `holderSnap` (`HOLDER_SNAP`): the mini holder in the case box's round bay; the bay's tab is only the upper stop.
 * - `lighterSnap` (`LIGHTER_SNAP`): the BIC Mini lighter (a reference object, never printed) in the same bay, above the tab; only
 *   the case box carries it, since the lighter cannot be changed.
 * - `miniBoxSnap` (`MINI_BOX_SNAP`): the closed mini box in the case lid's cavity.
 * `friction` adds nothing. The `clearance` reaches every part as `CLEARANCE`: the gap per side on all five mating surfaces,
 * which the snap features are sized from.
 */
const SNAP_VALUES = ['friction', 'detent', 'clip', 'magnet', 'crush-ribs'] as const;
export type SnapMode = typeof SNAP_VALUES[number];
const SNAP_TEXT: Record<SnapMode, { label: string; description: string }> = {
  friction: { label: 'Friction fit', description: 'The original design: smooth walls held by a close fit. Nothing is added.' },
  detent: { label: 'Detent', description: 'A small bump on the box that clicks into a groove in the lid.' },
  clip: { label: 'Clip', description: 'A flexible tongue on the lid whose nib snaps into a pocket in the box.' },
  magnet: { label: 'Magnets', description: 'Pockets for four round magnets, sized for the magnets chosen below: two in the box and two in the lid, facing each other (magnets not included).' },
  'crush-ribs': { label: 'Crush ribs', description: 'Thin ribs that are squeezed slightly by the mating wall for a snug press fit.' },
};

/**
 * Where the case lid's magnets sit, and how much room they have: the SCAD files' SNAP_X0 / SNAP_X1 (the straight stretch of the side
 * walls), CAVITY_Y (the lid's inner face there), MAGNET_Z (the magnets' height above the lid rim), BASE_TOP (the lid rim in the box's
 * frame), MAGNET_PLAY (the pocket's diametral play) and the lid boss's margin around the pocket; a test keeps them equal to the SCAD
 * files. A magnet sits flush with the wall face, as deep as it is high: in the box's 1 mm shell wall, backed by a boss that ends at
 * BOSS_IN_Y (10.9), and in the lid's wall, backed by a boss that fills the honeycomb. `maxThickness` is the original 6 x 2 mm pocket's
 * depth: no pocket goes deeper into the box's boss than it did, which leaves 0.19 mm behind it at the largest clearance
 * (docs/cigarette-case-snap.md#magnets).
 */
export const MAGNET_SEAT = { x0: -1, x1: 9.5, cavityY: 13.79, z: 8, baseTop: 60.38, play: 0.1, lidBossMargin: 0.4, maxThickness: 2.1 } as const;

/** Whether the lid's magnet pockets can take this library part: a round (disc) magnet no higher than the box's boss allows, whose
 * pocket and the lid's boss around it fit on the straight stretch of the wall. */
export function magnetFits(part: Part): boolean {
  if (part.family !== 'magnet' || part.attributes['shape'] !== 'disc') return false;
  const width = dimensionOf(part, 'diameter', 'max') + MAGNET_SEAT.play + 2 * MAGNET_SEAT.lidBossMargin;
  return dimensionOf(part, 'thickness', 'max') <= MAGNET_SEAT.maxThickness + 1e-9 && width <= MAGNET_SEAT.x1 - MAGNET_SEAT.x0 + 1e-9;
}

/**
 * The magnets the case lid offers: every magnet of the parts library that fits (`magnetFits`), in the library's order. Listed
 * rather than computed, so that the parameter's type names them; a test keeps the list equal to the library's fitting magnets.
 */
export const CASE_MAGNETS = ['supermagnete-s-04-02-n', 'supermagnete-s-05-02-n52n', 'supermagnete-s-06-02-n', 'supermagnete-s-08-02-n'] as const;
/** S-06-02-N: 6.1 x 2.1 mm at most, the pocket of the original design. */
export const DEFAULT_CASE_MAGNET = 'supermagnete-s-06-02-n';

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
  detent: { label: 'Detent', description: 'A bump on each end of the holder clicks into a groove in the bay. Push it out from above, e.g. with a lighter turned upside down.' },
  'crush-ribs': { label: 'Crush ribs', description: 'Four thin ribs near the holder\'s floor are squeezed by the bay wall. Push it out from above, e.g. with a lighter turned upside down.' },
};
/** The lighter is not printed, so it takes only what the case box alone can do: its fit, or crush ribs on the bay wall. */
const LIGHTER_SNAP_VALUES = ['friction', 'crush-ribs'] as const;
export type LighterSnapMode = typeof LIGHTER_SNAP_VALUES[number];
const LIGHTER_SNAP_TEXT: Record<LighterSnapMode, { label: string; description: string }> = {
  friction: { label: 'Friction fit', description: 'The bay above the tab follows the lighter\'s outline, one clearance all round. Nothing is added.' },
  'crush-ribs': { label: 'Crush ribs', description: 'Four thin ribs on the bay wall, just above the tab, are squeezed by the lighter\'s flat faces. It still pushes the holder out, turned upside down.' },
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
/** The closed case lid traps the lighter, so a friction fit may be a little looser than the holder's; the ribs work as elsewhere. */
export const LIGHTER_SNAP_CLEARANCE: Record<LighterSnapMode, { minimum: number; maximum: number }> = {
  friction: { minimum: 0.1, maximum: 0.25 },
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
  lighterCrushSqueeze: { joint: 'lighterSnap', mode: 'crush-ribs', variable: 'LIGHTER_CRUSH_SQUEEZE', default: 0.1, recommended: { minimum: 0.06, maximum: 0.15 } },
  miniBoxDetentEngage: { joint: 'miniBoxSnap', mode: 'detent', variable: 'MB_DETENT_ENGAGE', default: 0.15, recommended: { minimum: 0.1, maximum: 0.2 } },
  miniBoxCrushSqueeze: { joint: 'miniBoxSnap', mode: 'crush-ribs', variable: 'MB_CRUSH_SQUEEZE', default: 0.1, recommended: { minimum: 0.06, maximum: 0.15 } },
} as const;
export type SnapTuningKey = keyof typeof SNAP_TUNING;
/** The slider range of every engagement and squeeze, in mm. */
export const SNAP_TUNING_RANGE = { minimum: 0.02, maximum: 0.4, step: 0.01 } as const;
/** A detent's groove is engagement + clearance deep; in the 1 mm walls it is cut into, at least this much wall must remain. */
export const GROOVE_WALL = { thickness: 1, minimumLeft: 0.2 } as const;
const JOINT_NAME: Record<string, string> = { snap: 'case lid', miniLidSnap: 'mini box lid', holderSnap: 'holder in the box', lighterSnap: 'lighter in the box', miniBoxSnap: 'mini box in the lid' };
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
  engrave: { label: 'Engraved', description: 'The text or logo is carved 0.8 mm into the underside of the box. Works on any printer.' },
  'second-filament': { label: 'Second filament', description: 'The text or logo is carved the same way, and a separate "case-text" part fills it exactly: print it in another colour on a multi-nozzle printer or with a filament change.' },
};
/** What goes on the underside: a line of text, or a logo read from an SVG file (packages/contracts/src/svgLogo.ts). */
const UNDERSIDE_MARK_VALUES = ['text', 'logo'] as const;
export type UndersideMark = typeof UNDERSIDE_MARK_VALUES[number];
const UNDERSIDE_MARK_TEXT: Record<UndersideMark, { label: string; description: string }> = {
  text: { label: 'Text', description: 'One line of text in one of four fonts.' },
  logo: { label: 'SVG logo', description: 'The filled shapes of an SVG file, scaled to fit the free area.' },
};

/** The free, flat area on the underside of the case box (see models/cigarette-case/reference/11_v11.3__-_honeycomb_-_box.scad). */
export const TEXT_AREA = { width: 35, height: 16, margin: 0.5, maxCharacters: 20, minSize: 3, maxSize: 10 } as const;
/** The logo is scaled to `logoSize` high, or less if it would then be wider than the free area less its margin (`LOGO_W` in the SCAD). */
export const LOGO_AREA = { width: TEXT_AREA.width - TEXT_AREA.margin, minSize: 3, maxSize: 15, defaultSize: 12 } as const;

export const CigaretteCaseParametersSchema = Type.Object({
  snap: Type.Enum(SNAP_VALUES, {
    title: 'Case lid snap', description: 'How the case lid holds on the case box: a plain close fit, a detent, a flexible clip, magnets or crush ribs. The other joints have their own settings.', default: 'friction',
  }),
  magnet: Type.Enum(CASE_MAGNETS, {
    title: 'Magnets', description: 'The round magnets the case lid snap is sized for, with magnets: two in the box and two in the lid. Each is a real product from the parts library; its pockets are cut to its greatest size.', default: DEFAULT_CASE_MAGNET,
  }),
  miniLidSnap: Type.Enum(INSERT_SNAP_VALUES, {
    title: 'Mini box lid', description: 'How the mini lid holds in the mini box: the original pads (a clearance fit), a detent or crush ribs.', default: 'friction',
  }),
  holderSnap: Type.Enum(INSERT_SNAP_VALUES, {
    title: 'Holder in the box', description: 'How the mini holder is held in the case box\'s round bay, which is open through the floor: a friction fit, a detent or crush ribs.', default: 'friction',
  }),
  lighterSnap: Type.Enum(LIGHTER_SNAP_VALUES, {
    title: 'Lighter in the box', description: 'How the BIC Mini lighter is held in the round bay, above the holder: the fitted bay alone (a friction fit) or crush ribs.', default: 'friction',
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
  undersideMark: Type.Enum(UNDERSIDE_MARK_VALUES, { title: 'Underside mark', description: 'What goes on the underside of the large box: a line of text, or a logo from an SVG file.', default: 'text' }),
  logo: Type.String({
    title: 'Underside logo', description: 'An SVG file whose filled shapes are engraved on the underside of the large box, mirrored so that they read correctly. Strokes, text, pictures and style sheets in the file are left out. The file itself is never uploaded, only its outline.',
    default: '', maxLength: LOGO_MAX_LENGTH, pattern: '^[MLZ0-9 ]*$',
  }),
  logoSize: dimension('Logo size', `Height of the underside logo in mm. A wide logo is made smaller, so that it stays within the ${LOGO_AREA.width} mm free width.`, LOGO_AREA.defaultSize, LOGO_AREA.minSize, LOGO_AREA.maxSize, 0.5),
  textMode: Type.Enum(TEXT_MODE_VALUES, { title: 'Underside style', description: 'The text or logo is engraved into the box, or carved and filled by a separate part for a second filament.', default: 'engrave' }),
  clearance: dimension('Clearance', 'Gap per side between parts that fit together (lid on box, mini box in the lid, holder and lighter in the box), in mm. Larger is looser; raise it if your printer prints parts that are too tight.',
    CLEARANCE_RANGE.default, CLEARANCE_RANGE.minimum, CLEARANCE_RANGE.maximum, CLEARANCE_RANGE.step),
  snapDetentEngage: tuningControl('snapDetentEngage', 'Detent engagement', 'How far the bump on the case box reaches past the case lid\'s wall, in mm, on top of the clearance. More clicks harder.'),
  snapCrushSqueeze: tuningControl('snapCrushSqueeze', 'Crush-rib squeeze', 'How much the ribs on the case box are squeezed by the case lid, in mm, on top of the clearance. More holds tighter.'),
  miniLidDetentEngage: tuningControl('miniLidDetentEngage', 'Detent engagement', 'How far the bumps on the mini lid reach past the mini box\'s wall, in mm, on top of the clearance. More clicks harder.'),
  miniLidCrushSqueeze: tuningControl('miniLidCrushSqueeze', 'Crush-rib squeeze', 'How much the ribs on the mini lid are squeezed by the mini box, in mm, on top of the clearance. More holds tighter.'),
  holderDetentEngage: tuningControl('holderDetentEngage', 'Detent engagement', 'How far the bumps on the holder reach past the bay wall, in mm, on top of the clearance. More holds harder, but a lighter must still push the holder out.'),
  holderCrushSqueeze: tuningControl('holderCrushSqueeze', 'Crush-rib squeeze', 'How much the ribs on the holder are squeezed by the bay wall, in mm, on top of the clearance. More holds tighter, but a lighter must still push the holder out.'),
  lighterCrushSqueeze: tuningControl('lighterCrushSqueeze', 'Crush-rib squeeze', 'How much the ribs in the round bay are squeezed by the lighter, in mm, on top of the clearance. More holds tighter, but the lighter must still slide in, and push the holder out upside down.'),
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

/** Whether the underside carries anything: visible text, or a logo, whichever `undersideMark` chooses. */
export const hasUndersideMark = (p: { undersideMark: string; engraveText: string; logo: string }): boolean =>
  p.undersideMark === 'logo' ? p.logo !== '' : p.engraveText.trim() !== '';
/** Whether the text part exists: only when there is something visible to print in a second filament. */
export const hasSecondFilamentMark = (p: { undersideMark: string; engraveText: string; logo: string; textMode: string }): boolean =>
  p.textMode === 'second-filament' && hasUndersideMark(p);

function validateCigaretteCase(p: CigaretteCaseParameters): ParameterIssue[] {
  // The logo reaches OpenSCAD whichever mark is chosen, so it is always checked in full.
  try { decodeLogo(p.logo); }
  catch (error) { return [{ field: 'logo', message: error instanceof SvgError ? error.message : 'The logo is malformed. Load the SVG file again.' }]; }
  const width = textWidth(p.textFont, p.engraveText, p.textSize);
  if (p.undersideMark === 'text' && width > TEXT_AREA.width - TEXT_AREA.margin)
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
  { ...partControl(CigaretteCaseParametersSchema, 'magnet', 'basic', 'magnet', CASE_MAGNETS), visibleWhen: { control: 'snap', values: ['magnet'] } },
  enumControl(CigaretteCaseParametersSchema, 'miniLidSnap', 'basic', INSERT_SNAP_VALUES.map(value => ({ value, ...MINI_LID_SNAP_TEXT[value] }))),
  enumControl(CigaretteCaseParametersSchema, 'holderSnap', 'basic', INSERT_SNAP_VALUES.map(value => ({ value, ...HOLDER_SNAP_TEXT[value] }))),
  enumControl(CigaretteCaseParametersSchema, 'lighterSnap', 'basic', LIGHTER_SNAP_VALUES.map(value => ({ value, ...LIGHTER_SNAP_TEXT[value] }))),
  enumControl(CigaretteCaseParametersSchema, 'miniBoxSnap', 'basic', INSERT_SNAP_VALUES.map(value => ({ value, ...MINI_BOX_SNAP_TEXT[value] }))),
  enumControl(CigaretteCaseParametersSchema, 'undersideMark', 'basic', UNDERSIDE_MARK_VALUES.map(value => ({ value, ...UNDERSIDE_MARK_TEXT[value] }))),
  // the text's settings while the mark is text, the logo's while it is a logo
  ...[textControl(CigaretteCaseParametersSchema, 'engraveText', 'basic'),
    enumControl(CigaretteCaseParametersSchema, 'textFont', 'basic', TEXT_FONT_VALUES.map(value => ({ value, ...TEXT_FONT_TEXT[value] }))),
    control(CigaretteCaseParametersSchema, 'textSize', 'basic')].map(c => ({ ...c, visibleWhen: { control: 'undersideMark', values: ['text'] } })),
  ...[svgControl(CigaretteCaseParametersSchema, 'logo', 'basic'), control(CigaretteCaseParametersSchema, 'logoSize', 'basic')]
    .map(c => ({ ...c, visibleWhen: { control: 'undersideMark', values: ['logo'] } })),
  enumControl(CigaretteCaseParametersSchema, 'textMode', 'basic', TEXT_MODE_VALUES.map(value => ({ value, ...TEXT_MODE_TEXT[value] }))),
  { ...control(CigaretteCaseParametersSchema, 'clearance', 'advanced'), bands: FIT_BANDS,
    recommended: [
      { control: 'snap', ranges: SNAP_VALUES.map(value => ({ value, ...SNAP_CLEARANCE[value] })) },
      { control: 'miniLidSnap', ranges: INSERT_SNAP_VALUES.map(value => ({ value, ...MINI_LID_SNAP_CLEARANCE[value] })) },
      { control: 'holderSnap', ranges: INSERT_SNAP_VALUES.map(value => ({ value, ...HOLDER_SNAP_CLEARANCE[value] })) },
      { control: 'lighterSnap', ranges: LIGHTER_SNAP_VALUES.map(value => ({ value, ...LIGHTER_SNAP_CLEARANCE[value] })) },
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
const LIGHTER_SNAP_MAPPING = { lighterSnap: 'LIGHTER_SNAP', lighterCrushSqueeze: 'LIGHTER_CRUSH_SQUEEZE' };
const MINI_BOX_SNAP_MAPPING = { miniBoxSnap: 'MINI_BOX_SNAP', miniBoxDetentEngage: 'MB_DETENT_ENGAGE' };
// The chosen magnet's greatest size, which the pockets and bosses of both halves are cut to.
const MAGNET_DEFINES: PartDefines = { magnet: { MAGNET_D: ['diameter', 'max'], MAGNET_T: ['thickness', 'max'] } };
const TEXT_MAPPING = { undersideMark: 'MARK', engraveText: 'TEXT', textFont: 'TEXT_FONT', textSize: 'TEXT_SIZE', logo: 'LOGO', logoSize: 'LOGO_SIZE' };

/** The parts. `id` is the STL basename inside the ZIP. The SCAD files are the verified reconstructions, with their mating surfaces
 * fitted to one clearance (the `clearance` parameter; see models/cigarette-case/reference/VERIFICATION.md), except
 * `case-text`, which is new: the underside text as a separate body, present only in `second-filament` mode. Each snap setting
 * reaches the printed parts of its joint (the lighter setting only the case box). */
const cigaretteCaseParts: ModelPart[] = [
  { id: 'case-box', title: 'Case box (large)', sourcePath: `${CIGARETTE_CASE_DIR}11_v11.3__-_honeycomb_-_box.scad`, scadMapping: { ...CLEARANCE_MAPPING, ...SNAP_MAPPING, snapCrushSqueeze: 'CRUSH_SQUEEZE', ...HOLDER_SNAP_MAPPING, ...LIGHTER_SNAP_MAPPING, ...TEXT_MAPPING }, partDefines: MAGNET_DEFINES },
  { id: 'case-lid', title: 'Case lid (large)', sourcePath: `${CIGARETTE_CASE_DIR}11_v11.3__-_honeycomb_-_top.scad`, scadMapping: { ...CLEARANCE_MAPPING, ...SNAP_MAPPING, ...MINI_BOX_SNAP_MAPPING, miniBoxCrushSqueeze: 'MB_CRUSH_SQUEEZE' }, partDefines: MAGNET_DEFINES },
  { id: 'mini-holder', title: 'Mini holder', sourcePath: `${CIGARETTE_CASE_DIR}11_-_Honeycomb_-_minibox.scad`, scadMapping: { ...CLEARANCE_MAPPING, ...HOLDER_SNAP_MAPPING, holderCrushSqueeze: 'HOLDER_CRUSH_SQUEEZE' } },
  { id: 'mini-box', title: 'Mini box', sourcePath: `${CIGARETTE_CASE_DIR}11_-_Honeycomb_-_topminibox_-_box.scad`, scadMapping: { ...CLEARANCE_MAPPING, ...MINI_LID_SNAP_MAPPING, ...MINI_BOX_SNAP_MAPPING } },
  { id: 'mini-lid', title: 'Mini box lid', sourcePath: `${CIGARETTE_CASE_DIR}11_-_Honeycomb_-_topminibox_-_top.scad`, scadMapping: { ...CLEARANCE_MAPPING, ...MINI_LID_SNAP_MAPPING, miniLidCrushSqueeze: 'CRUSH_SQUEEZE' } },
  { id: 'case-text', title: 'Case text (second filament)', sourcePath: 'models/cigarette-case/underside-text.scad', scadMapping: TEXT_MAPPING, separateBodies: true,
    includedWhen: parameters => hasSecondFilamentMark({ undersideMark: String(parameters['undersideMark']), engraveText: String(parameters['engraveText'] ?? ''), logo: String(parameters['logo'] ?? ''), textMode: String(parameters['textMode']) }) },
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
    // clear of the box and the holder). Its top is 1.1 mm under the lid's ceiling (docs/cigarette-case-assembly.md). Upright, the
    // tab stops it short of the holder; turned upside down, wheel side towards the tab, its hood and wheel pass the tab and push
    // the holder out.
    // The bay above the tab is fitted to it (its plan plus the clearance), so this pose holds for any clearance.
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
  references: [referencePart('mini-bic-lighter', 'bic-j25-mini-lighter')],
};

/**
 * The four magnets in magnet mode, as reference objects in their pockets (docs/cigarette-case-assembly.md): in the box, the pocket
 * opens on the upper shell's outer face (CAVITY_Y less the clearance) and the magnet fills it inwards; in the lid, it opens on the
 * cavity wall (CAVITY_Y) and the magnet fills it outwards, so the two face each other across the clearance. Each is placed at its
 * greatest height, as the pocket is cut, and turned so that its axis runs along Y. The lid's move with the lid.
 */
function caseMagnets(parameters: ParameterValues): LinkedReference[] {
  const part = parameters['snap'] === 'magnet' && typeof parameters['magnet'] === 'string' ? findPart(parameters['magnet']) : undefined;
  if (!part) return [];
  const t = dimensionOf(part, 'thickness', 'max');
  const clearance = typeof parameters['clearance'] === 'number' ? parameters['clearance'] : CLEARANCE_RANGE.default;
  const [x, z] = [(MAGNET_SEAT.x0 + MAGNET_SEAT.x1) / 2, MAGNET_SEAT.baseTop + MAGNET_SEAT.z];
  const box = MAGNET_SEAT.cavityY - clearance - t;
  // Turned about X by -90 degrees, a magnet's axis (Z) points to +Y; by +90 degrees, to -Y.
  const at = (y: number, sign: 1 | -1): LinkedReference['pose'] => ({ position: [x, sign * y, z], rotation: [-90 * sign, 0, 0] });
  return [
    { id: 'magnet-box-plus-y', part: part.id, label: 'case box, +Y side', pose: at(box, 1) },
    { id: 'magnet-box-minus-y', part: part.id, label: 'case box, −Y side', pose: at(box, -1) },
    { id: 'magnet-lid-plus-y', part: part.id, label: 'case lid, +Y side', pose: at(MAGNET_SEAT.cavityY, 1), movesWith: 'case-lid' },
    { id: 'magnet-lid-minus-y', part: part.id, label: 'case lid, −Y side', pose: at(MAGNET_SEAT.cavityY, -1), movesWith: 'case-lid' },
  ];
}

export const cigaretteCase = {
  id: 'cigarette-case' as const, version: '8' as const, title: 'Cigarette case (Onz)',
  description: 'A honeycomb cigarette case in two sizes: a large box with a sliding lid, and a small holder with a shallow box and lid. Choose how each joint holds (the lid on the box, the mini lid, the holder and the lighter in the box, and the mini box in the lid) and how closely the parts fit, add text or an SVG logo to the underside of the box (engraved, or as a second-filament part), then download every part as a ZIP of STL files.',
  attribution: 'sez16sez (Thingiverse)',
  printNotes: 'Print each part separately; the lids print rim-side down. The optional text part prints flat, in a second colour.',
  // Kept short deliberately: this string and `attribution` are stamped into each STL's 80-byte header (see stampAttribution).
  license: 'CC BY-NC 4.0 (non-commercial)', licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  parts: cigaretteCaseParts,
  assembly: cigaretteCaseAssembly,
  linkedReferences: caseMagnets,
  assetPaths: ['LiberationSans-Bold.ttf', 'LiberationSerif-Bold.ttf', 'LiberationMono-Bold.ttf', 'DejaVuSans-Bold.ttf'].map(name => `${FONTS_DIR}/${name}`),
  parameterSchema: CigaretteCaseParametersSchema,
  controls: cigaretteCaseControls,
  defaults: Object.fromEntries(cigaretteCaseControls.map(c => [c.key, c.default])),
  scadMapping: {},
  // The logo string becomes a vector of numbers; OpenSCAD never sees it as text.
  scadEncode: { logo: logoScad },
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

/** DIN EN 20273 (ISO 273) clearance-hole diameters in mm, per screw size and series, from the parts library. */
export const CLEARANCE_HOLES: Record<Exclude<ScrewHoles, 'none'>, Record<HoleFit, number>> = ISO_273_CLEARANCE_HOLES;

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
  // Each size links to the library's screws of that thread (`none` to nothing).
  { ...enumControl(PlankConnectorParametersSchema, 'screwHoles', 'basic', SCREW_HOLE_VALUES.map(value => ({ value, ...SCREW_HOLE_TEXT[value] }))), part: { family: 'screw', attribute: 'thread', filter: null } },
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

/**
 * Litter shovel: an original design in three parts (models/litter-shovel/, docs/litter-shovel.md), all closed rings, stacked
 * container, scoop, handle. The container's flat lip carries the scoop's U-shaped cap (the bag folded over the lip is pinched
 * between them); the cap's flat top carries the handle's ring, flush with it. The grip is two halves: the container's
 * own handle (the finger side, open at the bottom; a sheet is braced by `supportCount` thin fins) and the handle part's (the palm side),
 * which lies on it so that the two make one bar; held, it clamps the three parts. `handleShape` makes them thin sheets (flat, or
 * curved by `gripBulge`), or a round tube or a rectangular bar of `gripSize`. Under the container's mouth, on the scraper
 * side, a 45° dam (`damWidth`) keeps the clumps in when the shovel is turned over to scoop again. `gripEnd` ends it open above the floor or on
 * the floor. Two joints hold by a close fit or a detent (`scoopSnap`: the scoop's sleeve in the
 * container's mouth; `handleSnap`: the handle's ring on the blade's base), sized from one `clearance`; `handleReinforcement` can also
 * screw the handle to the scoop with parts-library hardware. The other parameters shape the sieve round the scoop's walls and its
 * straight, sharp scraping tip.
 */
const SIEVE_PATTERN_VALUES = ['slots', 'staggered', 'round', 'hex'] as const;
export type SievePattern = typeof SIEVE_PATTERN_VALUES[number];
const SIEVE_PATTERN_TEXT: Record<SievePattern, { label: string; description: string }> = {
  slots: { label: 'Vertical slots', description: 'Rounded slots on a straight grid. Long slots sift fastest.' },
  staggered: { label: 'Staggered slots', description: 'Rounded slots with every other row shifted by half a pitch, like brickwork: a stiffer wall for the same open area.' },
  round: { label: 'Round holes', description: 'Circular holes, close-packed in offset rows. Holds finer clumps back.' },
  hex: { label: 'Hexagons', description: 'A honeycomb of hexagonal holes: the most open area for a given bar width.' },
};
const SLOT_PATTERNS: SievePattern[] = ['slots', 'staggered'];
/** How the slots are sized: by the number of rows, which then share the sieve zone's height, or by their length. */
const SIEVE_SIZING_VALUES = ['rows', 'length'] as const;
export type SieveSizing = typeof SIEVE_SIZING_VALUES[number];
const SIEVE_SIZING_TEXT: Record<SieveSizing, { label: string; description: string }> = {
  rows: { label: 'By rows', description: 'Choose how many rows of slots there are: they share the sieve’s height, as long as it lets them be.' },
  length: { label: 'By slot length', description: 'Choose how long the slots are: as many rows as fit are cut.' },
};

/** Both joints of the litter shovel hold by a close fit alone or by a detent. */
const SHOVEL_SNAP_VALUES = ['friction', 'detent'] as const;
export type ShovelSnapMode = typeof SHOVEL_SNAP_VALUES[number];
const SCOOP_SNAP_TEXT: Record<ShovelSnapMode, { label: string; description: string }> = {
  friction: { label: 'Friction fit', description: 'Only a close fit (and the bag in between) holds the scoop’s sleeve in the container’s mouth. Hold both halves of the grip when you lift the shovel.' },
  detent: { label: 'Detent', description: 'Four bumps on the scoop’s sleeve click into grooves just inside the container’s mouth, through the bag, so the container stays on even when you hold only the handle part’s grip.' },
};
const HANDLE_SNAP_TEXT: Record<ShovelSnapMode, { label: string; description: string }> = {
  friction: { label: 'Friction fit', description: 'Only a close fit holds the handle’s ring on the base of the scoop’s blade.' },
  detent: { label: 'Detent', description: 'Four bumps on the base of the scoop’s blade click into grooves in the handle’s ring, so the handle stays on while you sift.' },
};
/** The grip's shape: a thin sheet (the default), the same sheet curved out into a bulge, a round tube or a rectangular bar. Each is two halves, one on
 * the container and one on the handle, that stack into one bar. */
const HANDLE_SHAPE_VALUES = ['sheet', 'curved', 'round', 'rectangular'] as const;
export type HandleShape = typeof HANDLE_SHAPE_VALUES[number];
const HANDLE_SHAPE_TEXT: Record<HandleShape, { label: string; description: string }> = {
  sheet: { label: 'Flat sheet', description: 'Two thin sheets, one on the container and one on the handle, that stack into one 6 mm strip, 26 mm wide. Held in the fist, they clamp the parts together.' },
  curved: { label: 'Curved sheet', description: 'The same thin strip, but the run down to the tip bulges out towards the palm in a smooth curve, for the hand to sit in. The bulge’s size is set below.' },
  round: { label: 'Round tube', description: 'A round tube, each half a solid half-round that stacks with the other. Thicker and stiffer than the sheet, and the container and the handle grow to make room for it; the tip sits lower.' },
  rectangular: { label: 'Rectangular bar', description: 'A rectangular bar 26 mm wide, each half a solid slab that stacks with the other, with softened edges. Thicker and stiffer than the sheet, and the container and the handle grow to make room for it; the tip sits lower.' },
};

/** Where the grip ends: its tip hangs open above the floor (30 mm for the sheets; lower for the round and rectangular bars, as their finger gap moves the bend down), or it runs down to the floor. */
const GRIP_END_VALUES = ['open', 'floor'] as const;
export type GripEnd = typeof GRIP_END_VALUES[number];
const GRIP_END_TEXT: Record<GripEnd, { label: string; description: string }> = {
  open: { label: 'Open, above the floor', description: 'The grip ends in a rounded tip above the floor (30 mm for the sheets, lower for the round and rectangular bars), open like a hook. Printed standing, the container’s grip tip starts in mid-air: let your slicer add supports under it.' },
  floor: { label: 'Down to the floor', description: 'The grip runs down to the floor. The container’s grip then starts on the print bed, so nothing needs support.' },
};
/** The clearance range in which each mode works as designed: a friction fit must be snug to hold, a detent needs the walls to clear. */
export const SHOVEL_SNAP_CLEARANCE: Record<ShovelSnapMode, { minimum: number; maximum: number }> = {
  friction: { minimum: 0.1, maximum: 0.25 },
  detent: { minimum: 0.2, maximum: 0.4 },
};
/** Each joint's detent engagement: how far its bumps reach past the mating wall, on top of the clearance (the SCAD variable, its
 * default and the recommended range). */
export const SHOVEL_SNAP_TUNING = {
  scoopDetentEngage: { joint: 'scoopSnap', variable: 'SCOOP_DETENT_ENGAGE', default: 0.15, recommended: { minimum: 0.1, maximum: 0.25 } },
  handleDetentEngage: { joint: 'handleSnap', variable: 'HANDLE_DETENT_ENGAGE', default: 0.15, recommended: { minimum: 0.1, maximum: 0.25 } },
} as const;

/**
 * The handle's reinforcement (docs/litter-shovel.md#reinforcement): on top of `handleSnap`, two screws fasten the handle's ring to
 * the scoop's blade for good, on the grip side (+X), either side of the grip. Each is a countersunk screw, driven from inside the
 * scoop so that its head sits flush with the blade's inner face, through the blade's wall and the ring, into a heat-set insert or a
 * nut held in a boss on the ring's outer face. Every part is a real product or standard part from the parts library.
 */
const HANDLE_REINFORCEMENT_VALUES = ['none', 'threaded-insert', 'nut-bolt'] as const;
export type HandleReinforcement = typeof HANDLE_REINFORCEMENT_VALUES[number];
const HANDLE_REINFORCEMENT_TEXT: Record<HandleReinforcement, { label: string; description: string }> = {
  none: { label: 'None', description: 'Only the handle’s snap setting holds the handle on the scoop; lift it off at any time.' },
  'threaded-insert': { label: 'Threaded inserts and screws', description: 'Two brass heat-set inserts, melted into bosses on the handle’s ring beside the grip, take two countersunk screws driven from inside the scoop. The handle stays on the scoop for good, and still comes off with a screwdriver.' },
  'nut-bolt': { label: 'Nuts and screws', description: 'Two nuts, pushed into pockets in bosses on the handle’s ring beside the grip, take two countersunk screws driven from inside the scoop. No soldering iron needed.' },
};

/**
 * Where the fasteners sit and the room they have, in the container's frame (the SCAD files' FASTENER_* values; a test keeps them
 * equal): `y` either side of the grip (26 mm wide) and `z` above the cap's top, in the 15 mm ring over the blade's solid root band.
 * `innerX` is the blade's inner face on the grip side, `seatWall` its wall there (a thinner blade has a pad round each screw that makes it so, so this does not depend on `wallThickness`) and `ringOut` the blade's inner face to the ring's outer
 * face (the wall, the clearance and the ring, which is the clearance thinner: the same at any clearance). A countersunk head leaves
 * `underHead` of the wall and its countersink (`sinkPlay` wider than the head) stays within `sinkRadius` of the axis, clear of the
 * funnel below (whose top, at the ring's inner face, is 11.8 mm over the cap's lower edges: 16 − 11.8 = 4.2). The boss on the ring ends where the screw's tip does, so it is `screw length − ringOut` deep, at most
 * `bossDepth`; its radius (the insert's hole and wall, or the nut's pocket and `nutWall`) is at most `bossRadius`, clear of the grip
 * and the cap. An insert's hole leaves `insertLeft` of the ring; a nut sits `nutRecess` deep in a pocket `nutPlay` wider than it,
 * on a floor at least `nutFloor` thick.
 */
export const HANDLE_FASTENER_SEAT = {
  y: 21, z: 8, capTop: 144.5, innerX: 37.65, seatWall: 3.2, ringOut: 6.8, underHead: 0.8, sinkPlay: 0.2, sinkRadius: 4.2,
  bossDepth: 10, bossRadius: 6.5, insertLeft: 0.4, nutPlay: 0.2, nutRecess: 0.2, nutFloor: 1.2, nutWall: 1.2,
} as const;

const nutHeight = (part: Part) => dimensionOf(part, part.dimensions['h'] ? 'h' : 'm', 'max');
/** The radius of a nut's pocket: its hexagon's or square's corners, with the play. */
const nutPocketRadius = (part: Part) => dimensionOf(part, 's', 'max') / (part.attributes['shape']?.startsWith('square') ? Math.SQRT2 : Math.sqrt(3)) + HANDLE_FASTENER_SEAT.nutPlay / 2;
const screwThread = (part: Part) => part.attributes['thread'] ?? '';
const screwLength = (part: Part) => dimensionOf(part, 'l');

/** Whether a library screw can fasten the handle: a countersunk head that sits in the blade's wall and countersink, a thread with an
 * ISO 273 clearance hole, and a length that ends in a boss no deeper than allowed. */
export function handleScrewFits(part: Part): boolean {
  const { seatWall, underHead, sinkPlay, sinkRadius, ringOut, bossDepth } = HANDLE_FASTENER_SEAT;
  if (part.family !== 'screw' || part.attributes['head'] !== 'countersunk' || !(screwThread(part) in ISO_273_CLEARANCE_HOLES)) return false;
  const boss = screwLength(part) - ringOut;
  return dimensionOf(part, 'k', 'max') <= seatWall - underHead + 1e-9 && (dimensionOf(part, 'dk', 'max') + sinkPlay) / 2 <= sinkRadius + 1e-9
    && boss >= 0 && boss <= bossDepth + 1e-9;
}

/** The shortest screw among `screws` that leaves the ring `needed` mm (from the blade's wall, at this clearance) for its insert or nut. */
const shortestScrew = (screws: readonly string[], thread: string, needed: number, clearance: number) => screws.map(id => findPart(id))
  .filter((part): part is Part => part !== undefined && screwThread(part) === thread && screwLength(part) - HANDLE_FASTENER_SEAT.seatWall - clearance >= needed - 1e-9)
  .sort((a, b) => screwLength(a) - screwLength(b))[0];

/** How much of the screw's length past the blade's wall an insert needs: its hole, and the ring it must leave. */
const insertNeeds = (part: Part) => dimensionOf(part, 'holeDepth') + HANDLE_FASTENER_SEAT.insertLeft;
/** The same for a nut: its recessed pocket, and the floor under it. */
const nutNeeds = (part: Part) => nutHeight(part) + HANDLE_FASTENER_SEAT.nutRecess + HANDLE_FASTENER_SEAT.nutFloor;

/** Whether a library insert fits a boss on the ring and some fitting screw of its thread is long enough for it (at the least clearance). */
export function handleInsertFits(part: Part, screws: readonly Part[]): boolean {
  if (part.family !== 'threaded-insert') return false;
  const radius = dimensionOf(part, 'hole') / 2 + dimensionOf(part, 'wall');
  return radius <= HANDLE_FASTENER_SEAT.bossRadius + 1e-9 && shortestScrew(screws.map(screw => screw.id), screwThread(part), insertNeeds(part), CLEARANCE_RANGE.minimum) !== undefined;
}

/** Whether a library nut's pocket fits a boss on the ring and some fitting screw of its thread is long enough for it. */
export function handleNutFits(part: Part, screws: readonly Part[]): boolean {
  if (part.family !== 'nut') return false;
  return nutPocketRadius(part) + HANDLE_FASTENER_SEAT.nutWall <= HANDLE_FASTENER_SEAT.bossRadius + 1e-9
    && shortestScrew(screws.map(screw => screw.id), screwThread(part), nutNeeds(part), CLEARANCE_RANGE.minimum) !== undefined;
}

/**
 * The parts the handle's reinforcement offers: every library part that fits (`handleScrewFits`, `handleInsertFits`,
 * `handleNutFits`), in the library's order, and the threads of the fitting screws. Listed rather than computed, so that the
 * parameters' types name them; a test keeps each list equal to the library's fitting parts.
 */
export const HANDLE_THREADS = ['M2', 'M2.5', 'M3', 'M4'] as const;
export const HANDLE_SCREWS = [
  'iso-10642-m3x8', 'iso-10642-m3x10', 'iso-10642-m3x12', 'iso-10642-m3x16', 'iso-10642-m4x8', 'iso-10642-m4x10', 'iso-10642-m4x12', 'iso-10642-m4x16', 'iso-7046-m2x8', 'iso-7046-m2x10', 'iso-7046-m2x12', 'iso-7046-m2x16', 'iso-7046-m2-5x8', 'iso-7046-m2-5x10', 'iso-7046-m2-5x12', 'iso-7046-m2-5x16', 'iso-7046-m3x8', 'iso-7046-m3x10', 'iso-7046-m3x12', 'iso-7046-m3x16', 'iso-7046-m4x8', 'iso-7046-m4x10', 'iso-7046-m4x12', 'iso-7046-m4x16',
] as const;
export const HANDLE_INSERTS = [
  'cnc-kitchen-m2x3', 'cnc-kitchen-m2-5x4', 'cnc-kitchen-m3x5-7', 'cnc-kitchen-m3x3', 'cnc-kitchen-m3x5x4', 'cnc-kitchen-m4x8-1', 'cnc-kitchen-m4x4', 'ruthex-rx-m2x4', 'ruthex-rx-m3x5-7', 'ruthex-rx-m4x8-1',
] as const;
export const HANDLE_NUTS = [
  'iso-4032-m2', 'iso-4032-m2-5', 'iso-4032-m3', 'iso-4032-m4', 'iso-4035-m2', 'iso-4035-m2-5', 'iso-4035-m3', 'iso-4035-m4', 'iso-10511-m3', 'iso-10511-m4', 'din-562-m2', 'din-562-m2-5', 'din-562-m3', 'din-562-m4',
] as const;
/** M3, the usual thread of printed parts: a CNC Kitchen M3 × 5.7 insert, or a regular hexagon nut, on an ISO 10642 M3 × 12. */
export const DEFAULT_HANDLE_FASTENERS = { thread: 'M3', insert: 'cnc-kitchen-m3x5-7', nut: 'iso-4032-m3', screw: 'iso-10642-m3x12' } as const;
const HANDLE_THREAD_TEXT: Record<string, string> = { M2: 'The smallest: the lightest screws and the smallest bosses.', 'M2.5': 'Between M2 and M3.', M3: 'The usual thread of printed parts.', M4: 'The sturdiest: the largest bosses on the ring.' };

/** The scoop's length (`scoopLength`, scoop.scad's SCOOP_LENGTH, its `HEIGHT`): the tip's height over the cap's lower edges. */
export const SCOOP_LENGTH_RANGE = { minimum: 90, maximum: 180, default: 127, step: 1 } as const;

/**
 * The shell's wall (`wallThickness`, the SCAD files' WALL_THICKNESS): the container's and the scoop's blade's. The default is 4 lines
 * of a 0.4 mm nozzle; the maximum is the blade's wall before this was a parameter. The container's floor is `wall + 0.8`, at most
 * `FLOOR_MAXIMUM`; the scraping edge stays `TIP_WALL_LEFT` thinner than the wall, so that its bevel is one.
 */
export const WALL_THICKNESS_RANGE = { minimum: 1.2, maximum: 3.2, default: 1.6 } as const;
export const WALL_BANDS = [
  { minimum: 1.2, maximum: 1.6, label: 'Thin (3 to 4 perimeters)' },
  { minimum: 1.6, maximum: 2.4, label: 'Standard (4 to 6 perimeters)' },
  { minimum: 2.4, maximum: 3.2, label: 'Heavy (more than 6 perimeters)' },
];
const TIP_WALL_LEFT = 0.4;
/** The sieve margin's range (`sieveMargin`), and the tip bevel's (`tipBevel`). */
const SIEVE_MARGIN_RANGE = { minimum: 3, maximum: 10 } as const;
const TIP_BEVEL_RANGE = { minimum: 5, maximum: 20 } as const;
/** The sieve zone's bottom (scoop.scad's SIEVE_BOTTOM: the cap's top and the root band over it), in the scoop's frame. */
const SIEVE_BOTTOM = 26;
/** The longest slot any setting leaves room for (`sieveHeight` on the longest scoop, the shortest bevel and the smallest margin):
 * the schema's bound of `gapLength`; `slotLengthLimit` narrows it to the current settings. */
const GAP_LENGTH_STEP = 0.5;
const GAP_LENGTH_MAXIMUM = SCOOP_LENGTH_RANGE.maximum - TIP_BEVEL_RANGE.minimum - SIEVE_BOTTOM - 2 * SIEVE_MARGIN_RANGE.minimum;

export const LitterShovelParametersSchema = Type.Object({
  sievePattern: Type.Enum(SIEVE_PATTERN_VALUES, { title: 'Sieve texture', description: 'The shape and arrangement of the gaps in the scoop’s walls: across the back, round the corners and along the sides.', default: 'slots' }),
  gapWidth: dimension('Gap width', 'Width of each gap in mm: the slot width, the hole diameter or the hexagon’s size across flats. Litter finer than this falls through.', 7.2, 1, 15),
  sieveSizing: Type.Enum(SIEVE_SIZING_VALUES, { title: 'Slot sizing', description: 'Size the slots by how many rows there are (they fill the sieve’s height) or by their length (slot textures only).', default: 'rows' }),
  sieveRows: Type.Integer({ title: 'Slot rows', description: 'How many rows of slots there are, one above the other (slot textures, sized by rows). The slots share the sieve’s height, as long as it lets them be, with a bar between rows.', default: 1, minimum: 1, maximum: 5 }),
  gapLength: dimension('Slot length', 'Length of each slot along the wall, in mm (slot textures, sized by length). At least the gap width; at most what the scoop’s length, the tip bevel and the margin leave room for.', 25, 6, GAP_LENGTH_MAXIMUM, GAP_LENGTH_STEP),
  gapSpacing: dimension('Bar width', 'Solid wall between neighbouring gaps, in mm. Wider bars make a stiffer sieve with less open area.', 5.6, 1, 15),
  sieveMargin: dimension('Sieve margin', 'Solid border kept between the gaps and the wall’s edges (the solid band above the cap, the bevel under the tip, the side walls’ top and the front corners), in mm.', 3.2, SIEVE_MARGIN_RANGE.minimum, SIEVE_MARGIN_RANGE.maximum),
  wallThickness: dimension('Wall thickness', 'Thickness of the shell’s walls, in mm: the container’s and the scoop’s blade (the floor follows it, and the handle’s root and the screws’ seats keep their strength). Three to five lines of a 0.4 mm nozzle are 1.2 to 2.0 mm; thicker only adds weight and print time. It also caps the tip thickness.', WALL_THICKNESS_RANGE.default, WALL_THICKNESS_RANGE.minimum, WALL_THICKNESS_RANGE.maximum),
  tipThickness: dimension('Tip thickness', 'Thickness of the scoop’s straight scraping edge, in mm. Thinner scrapes cleaner; thicker is sturdier.', 0.8, 0.4, 2),
  scoopLength: dimension('Scoop length', 'How far the scoop’s blade reaches, in mm: the height of its straight scraping edge over the cap. A longer scoop takes more litter in one go and has a taller sieve: longer slots, or more rows of gaps.',
    SCOOP_LENGTH_RANGE.default, SCOOP_LENGTH_RANGE.minimum, SCOOP_LENGTH_RANGE.maximum, SCOOP_LENGTH_RANGE.step),
  tipBevel: dimension('Tip bevel length', 'How far down from the scraping edge the scoop’s inner face is bevelled, in mm. The sieve stays below the bevel.', 12, TIP_BEVEL_RANGE.minimum, TIP_BEVEL_RANGE.maximum, 0.5),
  gripEnd: Type.Enum(GRIP_END_VALUES, { title: 'Grip end', description: 'Where the grip ends: open above the floor (the container’s grip tip needs slicer supports), or down on the floor (no supports).', default: 'open' }),
  handleShape: Type.Enum(HANDLE_SHAPE_VALUES, { title: 'Handle shape', description: 'The grip’s shape: a flat sheet, a curved sheet, a round tube or a rectangular bar. The round and rectangular bars are thicker, so the container and the handle grow to make room for them.', default: 'sheet' }),
  gripBulge: dimension('Grip bulge', 'How far the curved grip bulges out towards the palm, in mm, on its run down to the tip. 0 is as straight as the flat sheet.', 8, 0, 15, 0.5),
  gripSize: dimension('Grip size', 'The round tube’s diameter, or the rectangular bar’s depth, in mm. The rectangular bar is always 26 mm wide. Larger fills the hand more; the round tube stops at 28 mm so that it clears the screws’ bosses.', 26, 20, 28, 1),
  supportCount: Type.Integer({ title: 'Grip supports', description: 'Thin fins that brace the container’s handle under its slope, side by side across the grip. More fins make it stiffer. The round and rectangular bars are solid and need none.', default: 3, minimum: 1, maximum: 5 }),
  damWidth: dimension('Dam width', 'How far the dam under the container’s mouth, on the scraper side, reaches in from the back wall, in mm (0 for none). It falls inward at 45°: turned over to scoop, the clumps already inside collect behind it instead of falling out.', 8, 0, 15, 0.5),
  supportThickness: dimension('Support thickness', 'Thickness of each fin under the container’s handle, in mm.', 2, 1.2, 4),
  scoopSnap: Type.Enum(SHOVEL_SNAP_VALUES, { title: 'Scoop on the container', description: 'How the scoop’s sleeve holds in the container’s mouth: a close fit only, or a detent.', default: 'detent' }),
  handleSnap: Type.Enum(SHOVEL_SNAP_VALUES, { title: 'Handle on the scoop', description: 'How the handle’s ring holds on the base of the scoop’s blade: a close fit only, or a detent.', default: 'detent' }),
  handleReinforcement: Type.Enum(HANDLE_REINFORCEMENT_VALUES, { title: 'Handle reinforcement', description: 'Whether two screws also fasten the handle to the scoop for good, beside the grip: into threaded inserts or nuts on the handle’s ring. On top of the snap setting.', default: 'none' }),
  handleThread: Type.Enum(HANDLE_THREADS, { title: 'Screw thread', description: 'The thread of the two screws and their inserts or nuts. A larger thread holds harder and needs larger bosses on the ring.', default: DEFAULT_HANDLE_FASTENERS.thread }),
  handleInsert: Type.Enum(HANDLE_INSERTS, { title: 'Threaded inserts', description: 'The heat-set inserts, a real product from the parts library: each boss’s hole and wall are sized from the maker’s recommendation.', default: DEFAULT_HANDLE_FASTENERS.insert }),
  handleNut: Type.Enum(HANDLE_NUTS, { title: 'Nuts', description: 'The nuts, standard parts from the parts library: each boss’s pocket is cut to the nut’s greatest size.', default: DEFAULT_HANDLE_FASTENERS.nut }),
  handleScrew: Type.Enum(HANDLE_SCREWS, { title: 'Screws', description: 'The countersunk screws, standard parts from the parts library, driven from inside the scoop so that their heads sit flush. The bosses on the ring end where the screws do: a longer screw makes them deeper.', default: DEFAULT_HANDLE_FASTENERS.screw }),
  clearance: dimension('Clearance', 'Gap per side between parts that fit together (the scoop’s sleeve in the container’s mouth, the handle’s ring on the scoop’s blade), in mm. Larger is looser; raise it if your printer prints parts that are too tight.',
    CLEARANCE_RANGE.default, CLEARANCE_RANGE.minimum, CLEARANCE_RANGE.maximum, CLEARANCE_RANGE.step),
  scoopDetentEngage: dimension('Detent engagement (scoop on the container)', 'How far the bumps on the scoop’s sleeve reach past the container’s mouth, in mm, on top of the clearance. More clicks harder.',
    SHOVEL_SNAP_TUNING.scoopDetentEngage.default, SNAP_TUNING_RANGE.minimum, SNAP_TUNING_RANGE.maximum, SNAP_TUNING_RANGE.step),
  handleDetentEngage: dimension('Detent engagement (handle on the scoop)', 'How far the bumps on the scoop’s blade reach past the handle’s ring, in mm, on top of the clearance. More clicks harder.',
    SHOVEL_SNAP_TUNING.handleDetentEngage.default, SNAP_TUNING_RANGE.minimum, SNAP_TUNING_RANGE.maximum, SNAP_TUNING_RANGE.step),
}, { additionalProperties: false, description: 'Litter shovel parameters. All fields are required; dimensions are in millimetres.' });
export type LitterShovelParameters = Static<typeof LitterShovelParametersSchema>;

/**
 * The scoop's blade, in the scoop's frame (mm). Mirrors models/litter-shovel/scoop.scad. The wall's outer plan is a rounded
 * rectangle (`OUT`: 81.7 × 114, corner radius 17.6) with a wall of `wallThickness` (so the inner corner radius is 17.6 less that). The back wall (−X) and most of the back corners rise to
 * the straight tip (`HEIGHT`, the scoop's length `scoopLength`). The side walls' top falls in half a cosine from `descentStart` (8 mm into the back corners) to
 * `FRONT_Z` where the front corners start. The sieve zone starts above the solid root band (`CAP_TOP` + `ROOT_BAND`, which the
 * handle's ring covers) and ends under the tip's bevel.
 */
export const SCOOP_BLADE = { backX: -40.85, flatY: 39.4, cornerRadius: 17.6, sideLength: 46.5, sieveBottom: SIEVE_BOTTOM, frontZ: 26 } as const;
/** Most gaps one sieve may have; more makes the scoop slow to render. */
export const MAX_SIEVE_GAPS = 600;

const bladeCornerX = SCOOP_BLADE.backX + SCOOP_BLADE.cornerRadius;
const descentStart = bladeCornerX - 8, descentEnd = -bladeCornerX;

/** The height of the scoop's side walls' top at `x` (scoop.scad's `side_top`), for a scoop of this length (the tip's height). */
export function scoopSideTop(x: number, height: number = SCOOP_LENGTH_RANGE.default): number {
  const { frontZ } = SCOOP_BLADE;
  if (x <= descentStart) return height;
  if (x >= descentEnd) return frontZ;
  return frontZ + (height - frontZ) * (1 + Math.cos(Math.PI * (x - descentStart) / (descentEnd - descentStart))) / 2;
}

/** The side walls' top lowered by `d`, measured square to it (scoop.scad's `side_below`). */
function scoopSideBelow(x: number, d: number, height: number): number {
  const { frontZ } = SCOOP_BLADE;
  const slope = x <= descentStart || x >= descentEnd ? 0
    : -(height - frontZ) * Math.PI / (2 * (descentEnd - descentStart)) * Math.sin(Math.PI * (x - descentStart) / (descentEnd - descentStart));
  return scoopSideTop(x, height) - d * Math.sqrt(1 + slope * slope);
}

type SieveParameters = Pick<LitterShovelParameters, 'sievePattern' | 'sieveSizing' | 'sieveRows' | 'gapWidth' | 'gapLength' | 'gapSpacing' | 'sieveMargin' | 'tipBevel' | 'scoopLength' | 'wallThickness'>;

/** The height the gaps may take (scoop.scad's SIEVE_HEIGHT): from one margin above the root band to one margin under the tip's
 * bevel. On the back, whose top is the tip, one gap this tall fits exactly; on the sides the falling top leaves less. */
export function sieveHeight(p: Pick<LitterShovelParameters, 'sieveMargin' | 'tipBevel' | 'scoopLength'>): number {
  return p.scoopLength - p.tipBevel - SCOOP_BLADE.sieveBottom - 2 * p.sieveMargin;
}

/** The longest slot these settings leave room for (`gapLength`'s limit): the sieve's height, down to the slot length's step. */
export function slotLengthLimit(p: Pick<LitterShovelParameters, 'sieveMargin' | 'tipBevel' | 'scoopLength'>): number {
  return Math.floor(sieveHeight(p) / GAP_LENGTH_STEP + 1e-9) * GAP_LENGTH_STEP;
}

/**
 * The slots' length (scoop.scad's SLOT_LENGTH). Sized by length, it is `gapLength`. Sized by rows, the rows and the bars between
 * them fill the sieve's height exactly: sieveRows × length + (sieveRows − 1) × gapSpacing = sieveHeight, so the top row ends one
 * margin under the bevel on the back.
 */
export function slotLength(p: SieveParameters): number {
  return p.sieveSizing === 'rows' ? (sieveHeight(p) - (p.sieveRows - 1) * p.gapSpacing) / p.sieveRows : p.gapLength;
}

/** The most rows of slots at least `gapWidth` long that the sieve's height has room for. */
export function sieveRowsLimit(p: SieveParameters): number {
  return Math.floor((sieveHeight(p) + p.gapSpacing) / (p.gapWidth + p.gapSpacing) + 1e-9);
}

/**
 * The sieve's gaps [s, z, length], exactly as scoop.scad lays them out (its `GAPS`): `s` runs along the wall's inner face from the
 * middle of the back, round the corners and along the sides (negative towards −Y), `z` is the centre's height and `length` the
 * gap's extent up the wall (a slot's length; sized by rows, shorter where the side walls' top falls).
 */
export function sieveGaps(p: SieveParameters): [number, number, number][] {
  const { backX, flatY, cornerRadius, sideLength, sieveBottom } = SCOOP_BLADE;
  const height = p.scoopLength;
  const innerRadius = cornerRadius - p.wallThickness, arc = Math.PI / 2 * innerRadius;
  const end = flatY + arc + sideLength, top = height - p.tipBevel;
  const slot = SLOT_PATTERNS.includes(p.sievePattern);
  const length = slotLength(p);
  const gapZ = slot ? length : p.sievePattern === 'hex' ? p.gapWidth * 2 / Math.sqrt(3) : p.gapWidth;
  const pitchY = p.gapWidth + p.gapSpacing;
  const pitchZ = slot ? length + p.gapSpacing : pitchY * Math.sqrt(3) / 2;
  const offsetRows = p.sievePattern !== 'slots';
  const margin = p.sieveMargin;
  const rows = Math.floor((top - sieveBottom) / pitchZ) + 1;
  const columns = Math.ceil(end / pitchY) + 1;
  // The outer face's X where the inner face is at `a` along it (scoop.scad's `wall_x`).
  const wallX = (a: number) => a <= flatY ? backX : a <= flatY + arc ? bladeCornerX - cornerRadius * Math.cos((a - flatY) / innerRadius)
    : bladeCornerX + a - flatY - arc;
  const fits = (s: number, z: number) => {
    const a1 = Math.abs(s) + p.gapWidth / 2, z0 = z - gapZ / 2, z1 = z + gapZ / 2;
    return a1 <= end - margin + 1e-6 && z0 >= sieveBottom + margin - 1e-6
      && z1 <= top - margin + 1e-6 && z1 <= scoopSideBelow(wallX(a1), margin, height) + 1e-6;
  };
  // Sized by rows, every row keeps its bottom all round, and each slot ends at its row's length or, if lower, the margin under
  // the side walls' top at its outer upper corner (scoop.scad's `slot_top`); it is cut if still at least as long as it is wide.
  const fitRows = slot && p.sieveSizing === 'rows';
  const slotTop = (s: number) => Math.min(top - margin, scoopSideBelow(wallX(Math.abs(s) + p.gapWidth / 2), margin, height));
  const gaps: [number, number, number][] = [];
  for (let row = 0; row < rows; row++) for (let column = -columns; column <= columns; column++) {
    const s = (column + (offsetRows && row % 2 === 1 ? 0.5 : 0)) * pitchY;
    if (fitRows) {
      const z0 = sieveBottom + margin + row * pitchZ;
      const l = Math.min(z0 + length, slotTop(s)) - z0;
      if (Math.abs(s) + p.gapWidth / 2 <= end - margin + 1e-6 && l >= p.gapWidth - 1e-6) gaps.push([s, z0 + l / 2, l]);
    } else {
      const z = sieveBottom + margin + gapZ / 2 + row * pitchZ;
      if (fits(s, z)) gaps.push([s, z, gapZ]);
    }
  }
  return gaps;
}

function validateLitterShovel(p: LitterShovelParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  const slot = SLOT_PATTERNS.includes(p.sievePattern), byRows = slot && p.sieveSizing === 'rows';
  if (slot && !byRows && p.gapLength < p.gapWidth)
    issues.push({ field: 'gapLength', message: `A slot must be at least as long as it is wide: at least ${p.gapWidth} mm.` });
  if (byRows && slotLength(p) < p.gapWidth - 1e-9) {
    const most = sieveRowsLimit(p), length = slotLength(p);
    const left = length > 0 ? `slots only ${length.toFixed(1)} mm long, shorter than they are wide (${p.gapWidth} mm)` : 'no room for slots';
    issues.push({ field: 'sieveRows', message: `${p.sieveRows} rows leave ${left}: at most ${most} ${most === 1 ? 'row fits' : 'rows fit'}. Use fewer rows, narrower gaps or bars, or a longer scoop.` });
  }
  const count = issues.length ? 0 : sieveGaps(p).length;
  if (!issues.length && count === 0)
    issues.push({ field: slot ? byRows ? 'sieveRows' : 'gapLength' : 'gapWidth', message: 'Not a single gap fits in the scoop’s walls. Use smaller gaps, a smaller margin or a shorter tip bevel.' });
  if (count > MAX_SIEVE_GAPS)
    issues.push({ field: 'gapSpacing', message: `${count} gaps are too many (at most ${MAX_SIEVE_GAPS}). Use larger gaps or wider bars.` });
  issues.push(...handleReinforcementIssues(p));
  return issues;
}

/** The screw must be long enough for the chosen insert (its hole, and the ring it leaves) or nut (its pocket and floor), at this clearance. */
function handleReinforcementIssues(p: LitterShovelParameters): ParameterIssue[] {
  if (p.handleReinforcement === 'none') return [];
  const screw = findPart(p.handleScrew);
  const holder = findPart(p.handleReinforcement === 'threaded-insert' ? p.handleInsert : p.handleNut);
  if (!screw || !holder) return [];
  const needed = p.handleReinforcement === 'threaded-insert' ? insertNeeds(holder) : nutNeeds(holder);
  const reach = screwLength(screw) - HANDLE_FASTENER_SEAT.seatWall - p.clearance;
  if (reach >= needed - 1e-9) return [];
  const shortest = shortestScrew(HANDLE_SCREWS, screwThread(holder), needed, p.clearance);
  const what = p.handleReinforcement === 'threaded-insert' ? `its ${dimensionOf(holder, 'holeDepth')} mm deep hole and ${HANDLE_FASTENER_SEAT.insertLeft} mm of the ring` : `its pocket and a ${HANDLE_FASTENER_SEAT.nutFloor} mm floor`;
  return [{ field: 'handleScrew', message: `${screw.title} reaches only ${reach.toFixed(1)} mm past the scoop’s wall at ${p.clearance.toFixed(2)} mm clearance, but the ${holder.title} needs ${needed.toFixed(1)} mm (${what}). ${shortest ? `Use at least ${shortest.title}.` : 'No listed screw is long enough: lower the clearance.'}` }];
}

/** A part-linked control that offers only the parts of the chosen screw thread. */
const threadFiltered = (c: Control): Control => ({ ...c, part: c.part && { ...c.part, filter: { control: 'handleThread', attribute: 'thread' } } });

const litterShovelControls = [
  enumControl(LitterShovelParametersSchema, 'sievePattern', 'basic', SIEVE_PATTERN_VALUES.map(value => ({ value, ...SIEVE_PATTERN_TEXT[value] }))),
  control(LitterShovelParametersSchema, 'gapWidth', 'basic'),
  // slots are sized by rows or by length: the sizing, and the one of the two it uses, only for slot textures
  { ...enumControl(LitterShovelParametersSchema, 'sieveSizing', 'basic', SIEVE_SIZING_VALUES.map(value => ({ value, ...SIEVE_SIZING_TEXT[value] }))), visibleWhen: { control: 'sievePattern', values: [...SLOT_PATTERNS] } },
  { ...control(LitterShovelParametersSchema, 'sieveRows', 'basic', null, null), visibleWhen: [{ control: 'sievePattern', values: [...SLOT_PATTERNS] }, { control: 'sieveSizing', values: ['rows'] }] },
  { ...control(LitterShovelParametersSchema, 'gapLength', 'basic'), visibleWhen: [{ control: 'sievePattern', values: [...SLOT_PATTERNS] }, { control: 'sieveSizing', values: ['length'] }] },
  control(LitterShovelParametersSchema, 'gapSpacing', 'basic'),
  control(LitterShovelParametersSchema, 'scoopLength', 'basic'),
  enumControl(LitterShovelParametersSchema, 'gripEnd', 'basic', GRIP_END_VALUES.map(value => ({ value, ...GRIP_END_TEXT[value] }))),
  enumControl(LitterShovelParametersSchema, 'handleShape', 'basic', HANDLE_SHAPE_VALUES.map(value => ({ value, ...HANDLE_SHAPE_TEXT[value] }))),
  { ...control(LitterShovelParametersSchema, 'gripBulge', 'basic'), visibleWhen: { control: 'handleShape', values: ['curved'] } },
  { ...control(LitterShovelParametersSchema, 'gripSize', 'basic'), visibleWhen: { control: 'handleShape', values: ['round', 'rectangular'] } },
  { ...control(LitterShovelParametersSchema, 'supportCount', 'basic', null, null), visibleWhen: { control: 'handleShape', values: ['sheet', 'curved'] } },
  control(LitterShovelParametersSchema, 'damWidth', 'basic'),
  enumControl(LitterShovelParametersSchema, 'scoopSnap', 'basic', SHOVEL_SNAP_VALUES.map(value => ({ value, ...SCOOP_SNAP_TEXT[value] }))),
  enumControl(LitterShovelParametersSchema, 'handleSnap', 'basic', SHOVEL_SNAP_VALUES.map(value => ({ value, ...HANDLE_SNAP_TEXT[value] }))),
  enumControl(LitterShovelParametersSchema, 'handleReinforcement', 'basic', HANDLE_REINFORCEMENT_VALUES.map(value => ({ value, ...HANDLE_REINFORCEMENT_TEXT[value] }))),
  // the fasteners, while the handle is reinforced: the inserts, nuts and screws offered are the library's parts of the chosen thread
  ...[enumControl(LitterShovelParametersSchema, 'handleThread', 'basic', HANDLE_THREADS.map(value => ({ value, label: value, description: HANDLE_THREAD_TEXT[value] ?? '' }))),
    { ...threadFiltered(partControl(LitterShovelParametersSchema, 'handleInsert', 'basic', 'threaded-insert', HANDLE_INSERTS)), visibleWhen: { control: 'handleReinforcement', values: ['threaded-insert'] } },
    { ...threadFiltered(partControl(LitterShovelParametersSchema, 'handleNut', 'basic', 'nut', HANDLE_NUTS)), visibleWhen: { control: 'handleReinforcement', values: ['nut-bolt'] } },
    threadFiltered(partControl(LitterShovelParametersSchema, 'handleScrew', 'basic', 'screw', HANDLE_SCREWS))]
    .map((c): Control => ({ ...c, visibleWhen: c.visibleWhen ?? { control: 'handleReinforcement', values: ['threaded-insert', 'nut-bolt'] } })),
  { ...control(LitterShovelParametersSchema, 'wallThickness', 'advanced'), bands: WALL_BANDS },
  control(LitterShovelParametersSchema, 'sieveMargin', 'advanced'),
  control(LitterShovelParametersSchema, 'tipThickness', 'advanced'),
  control(LitterShovelParametersSchema, 'tipBevel', 'advanced'),
  control(LitterShovelParametersSchema, 'supportThickness', 'advanced'),
  { ...control(LitterShovelParametersSchema, 'clearance', 'advanced'), bands: FIT_BANDS,
    recommended: (['scoopSnap', 'handleSnap'] as const).map(key => ({ control: key, ranges: SHOVEL_SNAP_VALUES.map(value => ({ value, ...SHOVEL_SNAP_CLEARANCE[value] })) })) },
  // each joint's engagement, shown only while that joint uses a detent, with its recommended range highlighted
  ...(Object.keys(SHOVEL_SNAP_TUNING) as (keyof typeof SHOVEL_SNAP_TUNING)[]).map(key => {
    const tuning = SHOVEL_SNAP_TUNING[key];
    return { ...control(LitterShovelParametersSchema, key, 'advanced'), visibleWhen: { control: tuning.joint, values: ['detent'] },
      recommended: [{ control: tuning.joint, ranges: [{ value: 'detent', ...tuning.recommended }] }] };
  }),
];

/**
 * The handle's fasteners, as reference objects where they sit (docs/litter-shovel.md#reinforcement), in the container's frame: on
 * the grip side, either side of the grip. Each screw's head is flush with the blade's inner face and its tip at the boss's face;
 * it lies along X, head inward (a screw's own frame has its tip at z = 0 and its head up). The inserts sit flush with the bosses'
 * faces, the nuts `nutRecess` deep; both ride with the handle. The screws are driven in from inside the scoop, a step of their own.
 */
function handleFasteners(parameters: ParameterValues): LinkedReference[] {
  const mode = parameters['handleReinforcement'];
  const screw = typeof parameters['handleScrew'] === 'string' ? findPart(parameters['handleScrew']) : undefined;
  const holderId = mode === 'threaded-insert' ? parameters['handleInsert'] : mode === 'nut-bolt' ? parameters['handleNut'] : undefined;
  const holder = typeof holderId === 'string' ? findPart(holderId) : undefined;
  if (!screw || !holder) return [];
  const { innerX, capTop, y, z, nutRecess } = HANDLE_FASTENER_SEAT;
  const l = screwLength(screw), face = innerX + l, height = capTop + z;
  const holderX = mode === 'threaded-insert' ? face - dimensionOf(holder, 'l') : face - nutRecess - nutHeight(holder);
  return [1, -1].flatMap((side): LinkedReference[] => {
    const name = side > 0 ? 'plus-y' : 'minus-y', label = side > 0 ? '+Y side of the grip' : '−Y side of the grip';
    return [
      { id: `handle-${mode === 'threaded-insert' ? 'insert' : 'nut'}-${name}`, part: holder.id, label, pose: { position: [holderX, side * y, height], rotation: [0, 90, 0] }, movesWith: 'handle' },
      { id: `handle-screw-${name}`, part: screw.id, label, pose: { position: [face, side * y, height], rotation: [0, -90, 0] },
        step: { title: 'Drive the screws in from inside the scoop', from: [-(l + 8), 0, 0] } },
    ];
  });
}

const LITTER_SHOVEL_DIR = 'models/litter-shovel/';
/** The reinforcement's setting reaches the scoop (its countersunk holes) and the handle (its bosses); the thread as its ISO 273
 * medium clearance hole, the chosen parts as their dimensions. */
const SHOVEL_REINFORCEMENT_MAPPING = { handleReinforcement: 'HANDLE_REINFORCEMENT', handleThread: 'SCREW_HOLE' };
const SHOVEL_SCOOP_FASTENER_DEFINES: PartDefines = { handleScrew: { SCREW_D: ['d', 'value'], SCREW_DK: ['dk', 'max'], SCREW_K: ['k', 'max'] } };
const SHOVEL_HANDLE_FASTENER_DEFINES: PartDefines = {
  handleScrew: { SCREW_L: ['l', 'value'] },
  handleInsert: { INSERT_HOLE: ['hole', 'value'], INSERT_DEPTH: ['holeDepth', 'value'], INSERT_WALL: ['wall', 'value'] },
  // a nylon-insert nut's pocket takes its overall height; a square nut's is square
  handleNut: { NUT_S: ['s', 'max'], NUT_H: [['h', 'm'], 'max'], NUT_SHAPE: { attribute: 'shape' } },
};
const SHOVEL_GRIP_MAPPING = { handleShape: 'HANDLE_SHAPE', gripBulge: 'GRIP_BULGE', gripSize: 'GRIP_SIZE' };
const SHOVEL_SCOOP_SNAP_MAPPING = { scoopSnap: 'SCOOP_SNAP', scoopDetentEngage: 'SCOOP_DETENT_ENGAGE' };
const SHOVEL_HANDLE_SNAP_MAPPING = { handleSnap: 'HANDLE_SNAP', handleDetentEngage: 'HANDLE_DETENT_ENGAGE' };

/** The parts, in stacking order. Each joint's setting reaches the two parts of that joint, and the grip's end the two halves of
 * the grip; the sieve, the tip and the scoop's length reach only the scoop, the supports and the dam only the container. */
const litterShovelParts: ModelPart[] = [
  { id: 'container', title: 'Container', sourcePath: `${LITTER_SHOVEL_DIR}container.scad`, scadMapping: { wallThickness: 'WALL_THICKNESS', clearance: 'CLEARANCE', gripEnd: 'GRIP_END', ...SHOVEL_GRIP_MAPPING, supportCount: 'SUPPORT_COUNT', supportThickness: 'SUPPORT_THICKNESS', damWidth: 'DAM_WIDTH', ...SHOVEL_SCOOP_SNAP_MAPPING } },
  { id: 'scoop', title: 'Scoop', sourcePath: `${LITTER_SHOVEL_DIR}scoop.scad`,
    scadMapping: { wallThickness: 'WALL_THICKNESS', scoopLength: 'SCOOP_LENGTH', sievePattern: 'SIEVE_PATTERN', sieveSizing: 'SIEVE_SIZING', sieveRows: 'SIEVE_ROWS', gapWidth: 'GAP_WIDTH', gapLength: 'GAP_LENGTH', gapSpacing: 'GAP_SPACING', sieveMargin: 'SIEVE_MARGIN', tipThickness: 'TIP_THICKNESS', tipBevel: 'TIP_BEVEL', clearance: 'CLEARANCE', ...SHOVEL_SCOOP_SNAP_MAPPING, ...SHOVEL_HANDLE_SNAP_MAPPING, ...SHOVEL_REINFORCEMENT_MAPPING },
    partDefines: SHOVEL_SCOOP_FASTENER_DEFINES },
  { id: 'handle', title: 'Handle', sourcePath: `${LITTER_SHOVEL_DIR}handle.scad`, scadMapping: { clearance: 'CLEARANCE', gripEnd: 'GRIP_END', ...SHOVEL_GRIP_MAPPING, ...SHOVEL_HANDLE_SNAP_MAPPING, ...SHOVEL_REINFORCEMENT_MAPPING },
    partDefines: SHOVEL_HANDLE_FASTENER_DEFINES },
];

/**
 * In the container's frame. The scoop's cap sits on the container's lip (141.5 mm), with its sleeve and skirt 5 mm below it
 * (136.5 mm); the handle's ring sits on the cap's top (144.5 mm). The handle prints upside down, its ring's top (15 mm higher,
 * 159.5 mm) on the bed, so it is turned over about X. The scoop goes on first, then the handle comes down over the blade and
 * along the container's handle. None of this depends on the parameters (docs/litter-shovel.md).
 */
const litterShovelAssembly: Assembly = {
  poses: {
    container: { position: [0, 0, 0] },
    scoop: { position: [0, 0, 136.5] },
    handle: { position: [0, 0, 159.5], rotation: [180, 0, 0] },
  },
  steps: [
    { title: 'Set the scoop on the container', parts: ['scoop'], from: [0, 0, 60] },
    { title: 'Lower the handle over the scoop', parts: ['handle'], from: [0, 0, 200] },
  ],
  lift: 60,
};

export const litterShovel = {
  id: 'litter-shovel' as const, version: '3' as const, title: 'Litter shovel',
  description: 'A cat-litter sifting shovel in three closed-ring parts, stacked: a container for a liner bag with its own open, hook-like handle, a sifting scoop that caps its rim, with a straight, sharp edge that scrapes along the floor and a sieve round its back, corners and sides, and a handle whose ring sits on the scoop and whose grip lies on the container’s handle. Both halves of the grip stack into one smooth bar, a flat sheet by default; held in the fist, they clamp all three parts. Choose the scoop’s length, the sieve texture (slots, staggered slots, round holes or hexagons), the gap size and bar width, the scraping edge’s thickness and bevel, the dam that keeps the clumps in when you scoop again, the grip’s shape (a flat or curved sheet, a round tube or a rectangular bar), where it ends and, for the sheets, how many thin fins brace it, how the parts hold (a close fit or a detent), and whether two screws fasten the handle to the scoop for good (into threaded inserts or nuts from the parts library), then download the three parts as a ZIP of STL files.',
  attribution: 'CanFactory (original design)',
  printNotes: 'Print each part as generated: the container standing on its floor, the scoop on its cap, the handle upside down on its ring’s top. Only the container’s open grip tip needs slicer supports; with the grip down to the floor, nothing does. The round and rectangular grips are solid: print them with sparse infill. Fold the bag about 5 mm over the container’s lip; inside, it drapes over the dam. With a handle reinforcement, melt the inserts in (or push the nuts in) from outside the bosses, then drive the countersunk screws in from inside the scoop.',
  license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  parts: litterShovelParts,
  assembly: litterShovelAssembly,
  linkedReferences: handleFasteners,
  parameterSchema: LitterShovelParametersSchema,
  controls: litterShovelControls,
  defaults: Object.fromEntries(litterShovelControls.map(c => [c.key, c.default])),
  scadMapping: {},
  // The thread reaches the SCAD files as its ISO 273 medium clearance hole.
  scadEncode: { handleThread: thread => JSON.stringify(ISO_273_CLEARANCE_HOLES[thread as MetricThread].medium) },
  // the longest slot the scoop's length, the tip's bevel and the margin leave room for
  limits(parameters: ParameterValues) {
    if (!Value.Check(LitterShovelParametersSchema, parameters)) return {};
    return {
      tipThickness: { maximum: Math.round((parameters.wallThickness - TIP_WALL_LEFT) * 10) / 10, reason: `the wall (${parameters.wallThickness} mm) leaves less than ${TIP_WALL_LEFT} mm to bevel down to the tip. Use a thicker wall or a thinner tip.` },
      gapLength: { maximum: slotLengthLimit(parameters), reason: `the scoop’s length (${parameters.scoopLength} mm), the tip bevel and the sieve margin leave room for no longer slot. Use a longer scoop, a shorter bevel or a smaller margin.` } };
  },
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(LitterShovelParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return validateLitterShovel(parameters);
  },
  derived(parameters: unknown) {
    return { slotCount: Value.Check(LitterShovelParametersSchema, parameters) ? sieveGaps(parameters).length : null };
  },
} satisfies ModelDefinition;

/** Add models here; shared API contracts and the generic editor consume this registry. Widened to the shared
 * interface (rather than the precise literal-typed tuple) so generic code can read optional fields uniformly;
 * `findModel`/`RenderRequestSchema` still discriminate on each model's own literal `id`/`version`. */
export const models: readonly ModelDefinition[] = [fruitFlyTrap, mossPlanter, cigaretteCase, plankConnector, litterShovel];

export function findModel(id: string): ModelDefinition | undefined { return models.find(model => model.id === id); }

/** A model that links to a part: through an option of a part-linked control, or as a reference object of its assembly. */
export interface PartUsage { modelId: string; modelTitle: string; via: string }

/** Every model that links to this part (the parts library's “Used by”). */
export function partUsage(part: Part): PartUsage[] {
  return models.flatMap(model => [
    ...model.controls.filter(control => control.part?.family === part.family && control.options?.some(option =>
      option.value === (control.part?.attribute ? part.attributes[control.part.attribute] : part.id))).map(control => ({ modelId: model.id, modelTitle: model.title, via: control.label })),
    ...(model.assembly?.references ?? []).filter(reference => reference.part === part.id).map(() => ({ modelId: model.id, modelTitle: model.title, via: 'Assembly preview' })),
  ]);
}

/** Validates unknown browser/API input, including cross-field rules, without coercion. */
export function validateParameters(model: ModelDefinition, parameters: unknown): ParameterIssue[] {
  if (!Value.Check(model.parameterSchema, parameters)) {
    return [...Value.Errors(model.parameterSchema, parameters)].map(error => ({
      field: error.instancePath.replace(/^\//, ''), message: error.message,
    }));
  }
  const filtered = [...partFilterIssues(model, parameters as ParameterValues), ...limitIssues(model, parameters as ParameterValues)];
  return filtered.length > 0 ? filtered : model.validate(parameters);
}
