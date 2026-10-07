import { conceptPages } from './concepts.ts';
import { Type, type Static, type TObject, type TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { dimensionOf, findPart, ISO_273_CLEARANCE_HOLES, partAssetPath, type MetricThread, type Part } from './parts/index.ts';
import { TEXT_ADVANCES } from './textMetrics.ts';
import { decodeLogo, LOGO_MAX_LENGTH, logoScad, SvgError } from './svgLogo.ts';
import { PRESSURE_PAD, PRESSURE_PAD_SURFACES, PRESSURE_PAD_TYPES, pressurePadExtenderTravel, pressurePadLeg, pressurePadMinDiameter, pressurePadMinExtenderDiameter, pressurePadMinExtenderLength, pressurePadMinHeight, type PressurePadSurface, type PressurePadType } from './pressurePad.ts';
import { leastRibSpacing, SEGMENT_JOINT_VALUES, sideJointWidth, sideWidth, WINDOW_CAT_GUARD_MAX_SEGMENTS, WINDOW_CAT_GUARD_SPLICE, windowCatGuardBolts, windowCatGuardLayout, windowCatGuardPieces, type SegmentJoints } from './windowCatGuard.ts';
import { eccAllowsLogo, filamentChangeHeight, QR_TAG_MOUNTS, type QrTagMount, knockoutFits, magnetPocketIssues, maxLogoSize, moduleSize, QR_ECC_LEVELS, QR_LOGO_MIN_ECC, QR_TAG, QR_TAG_JOINTS, QR_TAG_SHAPES, QR_TEXT_MAX_LENGTH, qrScad, qrTagCode, qrTagLayout, type QrEcc, type QrTagJoint, type QrTagShape, type QrTagShapeSettings } from './qrMagnetTag.ts';
import { clearanceHoles, PRINTED_WOOD_DIAMETERS, PRINTED_WOOD_SCREWS } from './screwHoles.ts';
import { PRINTED_CORNER_BRACKET_DEFAULT, PRINTED_CORNER_BRACKET_SCREW, printedCornerBracketBite, printedCornerBracketHoles, printedCornerBracketIssues } from './printedCornerBracket.ts';
import { PRINTED_BARB_MIN, PRINTED_SCREEN_HOOK_DEFAULT, PRINTED_SCREEN_HOOK_SCREW, printedScreenHookIssues, printedScreenHookShape } from './printedScreenHook.ts';
import { DETENT_BALLS, DETENT_RETENTIONS, DETENT_SET_SCREWS, DETENT_SPRINGS, DETENT_THREAD_PITCH, DETENT_THREADS, DETENT_TOOL_FEATURES, SPRING_BALL_DETENT_DEFAULT, springBallDetentIssues, springBallDetentLayout, type DetentParts, type DetentRetention, type DetentToolFeature } from './springBallDetent.ts';
import { latchPoses, latchState, OPEN as LATCH_OPEN, SWING as LATCH_SWING, TOGGLE_LATCH_MOVEMENTS, type LatchMovement } from './toggleLatchMechanism.ts';

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
  /** Trusted constants selecting a part of a shared generator; never supplied by API callers. */
  scadConstants?: Record<string, number | boolean | string>;
  /** Parameter key -> SCAD variable, for the parameters this part consumes (a subset of the model's; may be shared). */
  scadMapping?: Record<string, string>;
  /** Absent means always present. When set, the part is rendered (and appears in the ZIP) only for parameters it accepts. */
  includedWhen?: (parameters: ParameterValues) => boolean;
  /** True when the part is several separate closed bodies by design, such as the letters of engraved text. */
  separateBodies?: boolean;
  /** True when the part may enclose sealed voids by design, e.g. the QR tag's cavities for magnets dropped in at a print pause: one
   * outer closed shell, with inward-facing closed shells inside it (`inspectStl`'s `allowVoids`). */
  sealedVoids?: boolean;
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

/** A part's pose: its STL, exactly as rendered, turned and then moved. */
const PoseSchema = Type.Object({
  position: Vector('Translation in mm, applied after the rotation.'),
  rotation: Type.Optional(Vector('Rotation in degrees about the part’s own origin, applied about X, then Y, then Z.')),
}, { additionalProperties: false });

/**
 * How an assembly's parts go together, for the preview's assembly slider. Millimetres and degrees, in the parts' own SCAD
 * frame (Z up). Each part's pose places its STL, exactly as rendered, at its assembled position. The exploded layout is
 * every part's pose plus the `from` offset of each step it moves in, raised by `lift`. The slider first lifts the parts from
 * the print bed into that layout, then plays the steps in order: each step moves its parts from `from` to 0. List every
 * part that moves together (e.g. a box already inside the lid that moves). `lift` is removed during the last step, so the
 * finished assembly stands on the floor. Parts without a pose stay on the print bed. `references` are real-world objects the
 * assembly holds (e.g. the lighter a bay is sized for), shown and moved like parts so that their fit can be seen; they are
 * parts-library entries with an STL preview, never printed, so the worker does not render them and they are not in the ZIP
 * (see `referencePart`). `motion` then moves the finished assembly (e.g. a latch opening and closing), one slider stop per
 * movement: rigid poses sampled densely enough that interpolating between frames keeps the parts' joints together.
 */
export const AssemblySchema = Type.Object({
  partColors: Type.Optional(Type.Record(Type.String(), Type.String({ pattern: '^#[0-9a-fA-F]{6}$' }), { description: 'Suggested filament colors by printed part id; also used in the preview.' })),
  poses: Type.Record(Type.String(), PoseSchema, { description: 'Assembled pose per part id.' }),
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
  motion: Type.Optional(Type.Array(Type.Object({
    title: Type.String({ description: 'Short caption, e.g. “Close the lever”.' }),
    frames: Type.Array(Type.Record(Type.String(), PoseSchema), { minItems: 1, description: 'The poses of the parts it moves, evenly spaced in time; parts a frame leaves out keep their pose.' }),
  }, { additionalProperties: false }), { description: 'Movements of the finished assembly, played after the steps (e.g. a latch opening and closing): each plays from the poses the previous one ends in (the assembled poses for the first) through its frames.' })),
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

/** A phrase of a model's attribution (verbatim) and the page it links to. */
export interface AttributionLink { text: string; url: string }

export interface ModelDefinition {
  id: string;
  version: string;
  title: string;
  description: string;
  attribution: string;
  /** Phrases of `attribution` that link to where they were published, e.g. the original design's page. */
  attributionLinks?: AttributionLink[];
  printNotes: string;
  license: string;
  licenseUrl: string;
  sourcePath?: string;
  referencePath?: string;
  parts?: ModelPart[];
  /** Only for an assembly: how its parts go together (the preview's assembly slider). */
  assembly?: Assembly;
  /** Geometry-derived poses, steps and colors for these settings; assembly remains the catalogue default. */
  assemblyForParameters?: (parameters: ParameterValues) => Assembly;
  /** Other files whose content changes the geometry (e.g. fonts), so that they are part of the cache fingerprint. */
  assetPaths?: string[];
  parameterSchema: TSchema;
  controls: Control[];
  defaults: ParameterValues;
  scadMapping: Record<string, string>;
  /** How a mapped parameter is written after `-D NAME=`, for values that are not plain numbers, booleans or strings (see `scadLiteral`).
   * It gets the (validated) value and all the parameters, for a value that depends on others (the QR tag's code on its error correction). */
  scadEncode?: Record<string, (value: string, parameters: ParameterValues) => string>;
  /** For a single-generator model: dimensions of chosen library parts it is sized from (see `PartDefines`). */
  partDefines?: PartDefines;
  /** Only for an assembly: reference objects that depend on the parameters (see `LinkedReference`, `resolveAssembly`). */
  linkedReferences?: (parameters: ParameterValues) => LinkedReference[];
  /** For number controls whose room depends on other parameters: the narrower range they have for these (schema-valid)
   * parameters, and why, keyed by control. See `controlRange`. */
  limits?: (parameters: ParameterValues) => Record<string, ControlLimit>;
  validate: (parameters: unknown) => ParameterIssue[];
  /** Figures derived from valid settings: `slotCount` (stored with the render), and `notes`, short facts the editor shows under the
   * basic settings (e.g. the QR tag's filament-change height). */
  derived: (parameters: unknown) => { slotCount: number | null; notes?: string[] };
}

/** The OpenSCAD literal for a validated parameter value: the model's `scadEncode` for that key (given a string), or else JSON, which
 * writes numbers, booleans and quoted, escaped strings the way OpenSCAD reads them. */
export function scadLiteral(model: ModelDefinition, key: string, value: number | boolean | string, parameters: ParameterValues = {}): string {
  const encode = model.scadEncode?.[key];
  if (encode) {
    if (typeof value !== 'string') throw new Error(`Parameter ${key} must be a string.`);
    return encode(value, parameters);
  }
  return JSON.stringify(value);
}

/**
 * Every `-D NAME=value` override one SCAD file gets, as [NAME, literal] pairs: the parameters its `scadMapping` names (as
 * `scadLiteral` writes them) and the dimensions of the parts its `partDefines` names. Only mapped, validated values reach
 * OpenSCAD. Shared by the worker and `npm run check:assembly`, so that both render the same thing.
 */
export function scadDefines(model: ModelDefinition, source: { scadMapping?: Record<string, string>; partDefines?: PartDefines; scadConstants?: ModelPart['scadConstants'] }, parameters: ParameterValues): [string, string][] {
  const defines: [string, string][] = [];
  const name = (scadName: string) => { if (!/^[A-Z_]+$/.test(scadName)) throw new Error('Invalid generator parameter mapping.'); return scadName; };
  for (const [key, scadName] of Object.entries(source.scadMapping ?? {})) {
    const value = parameters[key];
    if (value === undefined) throw new Error('Invalid generator parameter mapping.');
    defines.push([name(scadName), scadLiteral(model, key, value, parameters)]);
  }
  for (const [key, variables] of Object.entries(source.partDefines ?? {})) {
    const id = parameters[key];
    const part = typeof id === 'string' ? findPart(id) : undefined;
    if (!part) throw new Error(`Parameter ${key} is not a part of the library.`);
    for (const [scadName, define] of Object.entries(variables)) defines.push([name(scadName), partDefineLiteral(part, define)]);
  }
  for (const [scadName, value] of Object.entries(source.scadConstants ?? {})) {
    if (defines.some(([existing]) => existing === scadName) || (typeof value === 'number' && !Number.isFinite(value)))
      throw new Error('Invalid generator constant.');
    defines.push([name(scadName), JSON.stringify(value)]);
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
  curved: { label: 'Curved sheet', description: 'The same thin strip, bowed across its width: the middle bulges towards the palm past the edges, so the hand rests in a shallow curve. The bulge’s size is set below.' },
  round: { label: 'Round tube', description: 'A round tube, each half a solid half-round that stacks with the other. Thicker and stiffer than the sheet, and the container and the handle grow to make room for it; the tip sits a little lower.' },
  rectangular: { label: 'Rectangular bar', description: 'A rectangular bar 26 mm wide, each half a solid slab that stacks with the other, with softened edges. Thicker and stiffer than the sheet, and the container and the handle grow to make room for it; the tip sits a little lower.' },
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
  gripBulge: dimension('Grip bulge', 'How far the curved grip’s middle bulges towards the palm past its long edges, in mm; the sheet is bowed across its width along its whole run. 0 is as flat as the flat sheet.', 3, 0, 6, 0.5),
  gripSize: dimension('Grip size', 'The round tube’s diameter, or the rectangular bar’s depth, in mm. The rectangular bar is always 26 mm wide. The flat sheet is 6 mm thick; a thinner bar than the default is easier to close a hand round.', 14, 10, 24, 1),
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

/** The eight approved image concepts, in gallery order. */
export const AI_DUCK_VARIANTS = [
  'claude-v1-round', 'claude-v2-sculpted', 'codex-v1-round', 'codex-v2-sculpted',
  'anthropic-v1-round', 'anthropic-v2-sculpted', 'openai-v1-round', 'openai-v2-sculpted',
] as const;
export const AiRubberDuckParametersSchema = Type.Object({
  variant: Type.Enum(AI_DUCK_VARIANTS, { title: 'Version', description: 'Choose the brand face and round or sculpted head from the concept gallery.', default: 'claude-v1-round' }),
  bodyLength: dimension('Body length', 'Length from breast to tail in mm. All pieces are generated to fit at this size.', 90, 70, 120, 1),
  clearance: dimension('Joint clearance', 'Gap per side around the peg core in mm. Smaller values grip more tightly; the small crush ribs hold the pieces together.', 0.2, 0.1, 0.25, 0.01),
}, { additionalProperties: false });
export type AiRubberDuckParameters = Static<typeof AiRubberDuckParametersSchema>;

const duckControls = [
  enumControl(AiRubberDuckParametersSchema, 'variant', 'basic', AI_DUCK_VARIANTS.map(value => {
    const brand = value.startsWith('openai') ? 'OpenAI' : value.startsWith('anthropic') ? 'Anthropic' : value.startsWith('codex') ? 'Codex' : 'Claude';
    return { value, label: `${brand} · ${value.endsWith('round') ? 'Round' : 'Sculpted'}`,
      description: value.endsWith('round') ? 'Yellow duck with a rounded head and raised symbol face.' : 'Cream duck with a sculpted symbol or terminal head.' };
  })),
  control(AiRubberDuckParametersSchema, 'bodyLength', 'basic'),
  control(AiRubberDuckParametersSchema, 'clearance', 'advanced'),
];
const duckDefaults: AiRubberDuckParameters = { variant: 'claude-v1-round', bodyLength: 90, clearance: 0.2 };

/** Same face frame as generator.scad: across=-Y, up=Z, out=-X. STLs print face down;
 * undo that turn, then place them in this frame. Dimensions are checked against rendered meshes. */
export function aiDuckAssembly(parameters: ParameterValues): Assembly {
  const variant = String(parameters['variant']);
  const s = Number(parameters['bodyLength']) / 90;
  const round = variant.endsWith('round'), codex = variant.startsWith('codex'), anthropic = variant.startsWith('anthropic');
  const brand = variant.split('-')[0] ?? '';
  // Mirrors generator.scad (nominal mm at 90 mm, scaled by s). Round faces are inlays printed on their flat backs, which sit
  // INLAY floor mm inside the head's front at x = -43; Codex v1's glyphs inlay into its visor the same way. Sculpted heads
  // print on their flat backs at HEAD2's back X, except the Codex terminal, which prints face down (depth 34).
  const inlayFloor: Record<string, number> = { claude: 10.5, codex: 11.6, anthropic: 10.4, openai: 11.2 };
  const head2: Record<string, [number, number]> = { claude: [-14, 62], codex: [-10, 60], anthropic: [-14, 58], openai: [-12, 63] };
  const [backX, headZ] = head2[brand] ?? [0, 0];
  const flatBack = (x: number, z: number): Assembly['poses'][string] => ({ position: [x, 0, z], rotation: [90, 0, -90] });
  const faceDown = (x: number): Assembly['poses'][string] => ({ position: [x, 0, headZ * s], rotation: [-90, 0, -90] });
  const depth = 34 * s;
  const face = round ? flatBack((-43 + (inlayFloor[brand] ?? 0)) * s, 61 * s) : codex ? faceDown(backX * s - depth) : flatBack(backX * s, headZ * s);
  const poses: Assembly['poses'] = { body: { position: [0, 0, 0] }, face };
  const partColors: Record<string, string> = { body: round ? '#ffda4a' : '#f2e3c3', face: brand === 'claude' ? '#d7774b' : '#292b2e' };
  const moving = ['face'];
  const steps: Assembly['steps'] = [];
  if (codex) {
    for (const id of ['chevron', 'bar']) {
      poses[id] = round ? flatBack((-43 + 5.8) * s, 61 * s) : faceDown(backX * s - depth - 2.2 * s);
      partColors[id] = '#f5f2ea'; moving.push(id);
    }
    steps.push({ title: 'Push the white inserts into the terminal face', parts: ['chevron', 'bar'], from: [-15 * s, 0, 0] });
  } else if (anthropic && round) {
    poses['bar'] = face; partColors['bar'] = '#292b2e'; moving.push('bar');
  }
  steps.push({ title: round ? 'Push the symbol face onto the duck' : 'Seat the sculpted head on the shoulders', parts: moving, from: round ? [-28 * s, 0, 0] : [0, 0, 32 * s] });
  return { poses, partColors, steps, lift: 35 * s };
}

const duckParts: ModelPart[] = [
  { id: 'body', title: 'Duck body' },
  { id: 'face', title: 'Face / head' },
  { id: 'chevron', title: 'Chevron insert', includedWhen: (p: ParameterValues) => String(p['variant']).startsWith('codex') },
  { id: 'bar', title: 'Bar insert', includedWhen: (p: ParameterValues) => String(p['variant']).startsWith('codex') || p['variant'] === 'anthropic-v1-round' },
].map(part => ({ ...part, sourcePath: 'models/ai-rubber-duck/generator.scad', scadConstants: { PART: part.id }, scadMapping: { variant: 'VARIANT', bodyLength: 'BODY_LENGTH', clearance: 'CLEARANCE' } }));

export const aiRubberDuck = {
  id: 'ai-rubber-duck' as const, version: '1' as const, title: 'AI rubber duck',
  description: 'Rubber duck debugging meets AI pair programming. Choose one of eight Claude, Codex, Anthropic and OpenAI designs, adjust its size and fit, then print the colored pieces separately and push them together.',
  attribution: 'CanFactory; brand marks belong to their respective owners',
  license: 'CC BY 4.0 (model geometry)', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  printNotes: 'Use the suggested filament colors beside each part. Print every piece as supplied: the body upright, inlays and sculpted heads on their flat backs, the Codex terminal head and its inserts face down; use local supports for the curved body and the pegs in the round head pockets. Start with PLA, a 0.4 mm nozzle, 0.2 mm layers and 3 perimeters. Remove support from mating surfaces. Fit the white Codex inserts first, then push the face or head onto the keyed pegs. Match body length and clearance across all pieces. Lower clearance grips more tightly. Physical fit needs a test print.',
  parameterSchema: AiRubberDuckParametersSchema, controls: duckControls, defaults: duckDefaults,
  parts: duckParts, assembly: aiDuckAssembly(duckDefaults), assemblyForParameters: aiDuckAssembly,
  scadMapping: {}, validate: () => [], derived: () => ({ slotCount: null }),
} satisfies ModelDefinition;

/** Add models here; shared API contracts and the generic editor consume this registry. Widened to the shared
 * interface (rather than the precise literal-typed tuple) so generic code can read optional fields uniformly;
 * `findModel`/`RenderRequestSchema` still discriminate on each model's own literal `id`/`version`. */
/**
 * Toggle latch (models/toggle-latch/, after "Toggle Latch" on MakerWorld, a remix of Hacky97's "M3 toggle corner latch"): four
 * printed parts, a base whose knuckle carries the lever, the lever, the link that the lever swings over the catch, and the catch.
 * The base and the catch are each screwed on with two screws through a 4 mm plate; their holes are sized for a screw chosen from
 * the parts library, a countersunk wood screw (DIN 7997) or a machine screw. A countersunk head sits flush in a countersink as deep
 * as the head is high; any other head sits on the plate's front face, beside the lever and the link. The lever comes in the
 * original's two pivot fits.
 */
export const TOGGLE_LATCH_SEAT = {
  /** The plates' thickness and height (catch.scad, base.scad: PLATE_BACK - PLATE_FRONT, PLATE_HEIGHT). */
  plate: 4, plateHeight: 12,
  /** The holes' distance from the plates' ends (HOLE_X) and from the latch's middle, where the link's 17.4 mm wide side bars pass. */
  holeFromEnd: 5.77, holeFromMiddle: 13.21, linkHalfWidth: 8.7,
  /** Diametral play of a countersink over the head (SINK_PLAY), the widest countersink the plate's ends and edges leave 0.5 mm
   * around, and the straight hole a countersunk head must leave under it. */
  sinkPlay: 0.4, maxSink: 11, minStraight: 1,
  /** Material a hole leaves above and below it, and the least a screw must reach past the plate's back. */
  holeWall: 1.5, minReach: 4,
} as const;
/** The three clearance holes (fine, medium, coarse) for a library screw (screwHoles.ts). */
export const latchScrewHoles = clearanceHoles;

/** Whether a library screw can fasten the latch's plates: its coarse hole leaves `holeWall` above and below; a countersunk head's
 * countersink fits the plate and leaves `minStraight` of hole; any other head stays clear of the link's side bars; and it reaches
 * `minReach` past the plate's back (a countersunk screw's length includes its head). */
export function latchScrewFits(part: Part): boolean {
  const s = TOGGLE_LATCH_SEAT;
  if (part.family === 'wood-screw' ? part.attributes['head'] !== 'countersunk' : part.family !== 'screw' || !(String(part.attributes['thread']) in ISO_273_CLEARANCE_HOLES)) return false;
  if (latchScrewHoles(part)[2] + 2 * s.holeWall > s.plateHeight + 1e-9) return false;
  const head = dimensionOf(part, part.dimensions['dk'] ? 'dk' : 'e', 'max');
  const countersunk = part.attributes['head'] === 'countersunk';
  const seated = countersunk ? head + s.sinkPlay <= s.maxSink + 1e-9 && dimensionOf(part, 'k', 'max') <= s.plate - s.minStraight + 1e-9
    : head / 2 <= s.holeFromMiddle - s.linkHalfWidth - 0.5 + 1e-9;
  return seated && dimensionOf(part, 'l') >= s.plate + s.minReach - 1e-9;
}

/**
 * The screws the latch offers: every library screw that fits (`latchScrewFits`), in the library's order, and their sizes, wood screws
 * by diameter and machine screws by thread. Listed rather than computed, so that the parameters' types name them; a test keeps each
 * list equal to the library's fitting parts.
 */
export const LATCH_WOOD_DIAMETERS = ['3 mm', '3.5 mm', '4 mm', '4.5 mm', '5 mm'] as const;
export const LATCH_WOOD_SCREWS = [
  'din-7997-3x12', 'din-7997-3x16', 'din-7997-3x20', 'din-7997-3x25', 'din-7997-3x30', 'din-7997-3-5x16', 'din-7997-3-5x20',
  'din-7997-3-5x25', 'din-7997-3-5x30', 'din-7997-3-5x35', 'din-7997-3-5x40', 'din-7997-4x20', 'din-7997-4x25', 'din-7997-4x30',
  'din-7997-4x35', 'din-7997-4x40', 'din-7997-4x45', 'din-7997-4x50', 'din-7997-4-5x25', 'din-7997-4-5x30', 'din-7997-4-5x35',
  'din-7997-4-5x40', 'din-7997-4-5x45', 'din-7997-4-5x50', 'din-7997-4-5x60', 'din-7997-5x30', 'din-7997-5x35', 'din-7997-5x40',
  'din-7997-5x50', 'din-7997-5x60', 'din-7997-5x70', 'din-7997-5x80',
] as const;
export const LATCH_MACHINE_THREADS = ['M2', 'M2.5', 'M3', 'M4', 'M5'] as const;
export const LATCH_MACHINE_SCREWS = [
  'iso-4762-m2x8', 'iso-4762-m2x10', 'iso-4762-m2x12', 'iso-4762-m2x16', 'iso-4762-m2x20', 'iso-4762-m2-5x8', 'iso-4762-m2-5x10',
  'iso-4762-m2-5x12', 'iso-4762-m2-5x16', 'iso-4762-m2-5x20', 'iso-4762-m2-5x25', 'iso-4762-m3x8', 'iso-4762-m3x10',
  'iso-4762-m3x12', 'iso-4762-m3x14', 'iso-4762-m3x16', 'iso-4762-m3x20', 'iso-4762-m3x25', 'iso-4762-m3x30', 'iso-4762-m4x8',
  'iso-4762-m4x10', 'iso-4762-m4x12', 'iso-4762-m4x16', 'iso-4762-m4x20', 'iso-4762-m4x25', 'iso-4762-m4x30', 'iso-4762-m4x35',
  'iso-4762-m4x40', 'iso-7380-m3x8', 'iso-7380-m3x10', 'iso-7380-m3x12', 'iso-7380-m3x16', 'iso-7380-m4x8', 'iso-7380-m4x10',
  'iso-7380-m4x12', 'iso-7380-m4x16', 'iso-7380-m4x20', 'iso-10642-m3x8', 'iso-10642-m3x10', 'iso-10642-m3x12', 'iso-10642-m3x16',
  'iso-10642-m3x20', 'iso-10642-m3x25', 'iso-10642-m3x30', 'iso-10642-m4x8', 'iso-10642-m4x10', 'iso-10642-m4x12',
  'iso-10642-m4x16', 'iso-10642-m4x20', 'iso-10642-m4x25', 'iso-10642-m4x30', 'iso-10642-m4x40', 'iso-10642-m5x8',
  'iso-10642-m5x10', 'iso-10642-m5x12', 'iso-10642-m5x16', 'iso-10642-m5x20', 'iso-10642-m5x25', 'iso-10642-m5x30',
  'iso-10642-m5x40', 'iso-10642-m5x50', 'iso-4017-m2x8', 'iso-4017-m2x10', 'iso-4017-m2x12', 'iso-4017-m2-5x8', 'iso-4017-m2-5x10',
  'iso-4017-m2-5x12', 'iso-4017-m2-5x16', 'iso-4017-m3x8', 'iso-4017-m3x10', 'iso-4017-m3x12', 'iso-4017-m3x16', 'iso-4017-m3x20',
  'iso-4017-m3x25', 'iso-4017-m3x30', 'iso-4017-m4x8', 'iso-4017-m4x10', 'iso-4017-m4x12', 'iso-4017-m4x16', 'iso-4017-m4x20',
  'iso-4017-m4x25', 'iso-4017-m4x30', 'iso-4017-m4x40', 'iso-7045-m2x8', 'iso-7045-m2x10', 'iso-7045-m2x12', 'iso-7045-m2x16',
  'iso-7045-m2-5x8', 'iso-7045-m2-5x10', 'iso-7045-m2-5x12', 'iso-7045-m2-5x16', 'iso-7045-m2-5x20', 'iso-7045-m3x8',
  'iso-7045-m3x10', 'iso-7045-m3x12', 'iso-7045-m3x16', 'iso-7045-m3x20', 'iso-7045-m3x25', 'iso-7045-m3x30', 'iso-7045-m4x8',
  'iso-7045-m4x10', 'iso-7045-m4x12', 'iso-7045-m4x16', 'iso-7045-m4x20', 'iso-7045-m4x25', 'iso-7045-m4x30', 'iso-7045-m4x40',
  'iso-7046-m2x8', 'iso-7046-m2x10', 'iso-7046-m2x12', 'iso-7046-m2x16', 'iso-7046-m2x20', 'iso-7046-m2-5x8', 'iso-7046-m2-5x10',
  'iso-7046-m2-5x12', 'iso-7046-m2-5x16', 'iso-7046-m2-5x20', 'iso-7046-m2-5x25', 'iso-7046-m3x8', 'iso-7046-m3x10',
  'iso-7046-m3x12', 'iso-7046-m3x16', 'iso-7046-m3x20', 'iso-7046-m3x25', 'iso-7046-m3x30', 'iso-7046-m4x8', 'iso-7046-m4x10',
  'iso-7046-m4x12', 'iso-7046-m4x16', 'iso-7046-m4x20', 'iso-7046-m4x25', 'iso-7046-m4x30', 'iso-7046-m4x40', 'iso-7046-m5x8',
  'iso-7046-m5x10', 'iso-7046-m5x12', 'iso-7046-m5x16', 'iso-7046-m5x20', 'iso-7046-m5x25', 'iso-7046-m5x30', 'iso-7046-m5x40',
  'iso-7046-m5x50',
] as const;
/** 4 × 25 wood screws, as the catio's latches use; or an ISO 10642 M4 × 12 through a panel. */
export const DEFAULT_LATCH_SCREWS = { woodDiameter: '4 mm', wood: 'din-7997-4x25', thread: 'M4', machine: 'iso-10642-m4x12' } as const;

const SCREW_KIND_VALUES = ['wood', 'machine'] as const;
const SCREW_KIND_TEXT: Record<typeof SCREW_KIND_VALUES[number], { label: string; description: string }> = {
  wood: { label: 'Wood screws', description: 'Countersunk wood screws (DIN 7997) straight into timber: the heads sit flush in countersinks.' },
  machine: { label: 'Machine screws', description: 'Metric machine screws, e.g. through a panel into nuts or threaded inserts. A countersunk head sits flush; any other head (pan, button, socket cap, hexagon) sits on the plate.' },
};

export const ToggleLatchParametersSchema = Type.Object({
  screwKind: Type.Enum(SCREW_KIND_VALUES, { title: 'Screws', description: 'What the base and the catch are screwed on with: two screws each.', default: 'wood' }),
  woodScrewDiameter: Type.Enum(LATCH_WOOD_DIAMETERS, { title: 'Wood screw diameter', description: 'The wood screws’ diameter; the screws below are those of this diameter.', default: DEFAULT_LATCH_SCREWS.woodDiameter }),
  woodScrew: Type.Enum(LATCH_WOOD_SCREWS, { title: 'Wood screw', description: 'The wood screw the holes and countersinks are sized for. Its length does not change the latch; choose one that bites far enough into the timber.', default: DEFAULT_LATCH_SCREWS.wood }),
  screwThread: Type.Enum(LATCH_MACHINE_THREADS, { title: 'Thread', description: 'The machine screws’ thread; the screws below are those of this thread.', default: DEFAULT_LATCH_SCREWS.thread }),
  machineScrew: Type.Enum(LATCH_MACHINE_SCREWS, { title: 'Machine screw', description: 'The machine screw the holes are sized for: a countersunk head gets a countersink, any other head sits on the plate. Its length does not change the latch.', default: DEFAULT_LATCH_SCREWS.machine }),
  holeFit: Type.Enum(HOLE_FIT_VALUES, { title: 'Hole fit', description: 'How much play the screws have in their holes: the DIN EN 20273 series for machine screws, and the same allowances (0.3 / 0.5 / 0.8 mm) over a wood screw’s diameter.', default: 'medium' }),
  highTolerance: Type.Boolean({ title: 'Loose pivots', description: 'Print the original’s high-tolerance lever: a 5.14 mm pivot hole instead of 4.99 mm on the base’s 4.4 mm pins, and 4.41 mm link pins instead of 4.64 mm in the link’s 5 mm holes. For printers whose holes come out tight.', default: false }),
}, { additionalProperties: false, description: 'Toggle latch parameters. All fields are required; the screw fields are parts-library ids or attribute values.' });
export type ToggleLatchParameters = Static<typeof ToggleLatchParametersSchema>;

const toggleLatchControls = [
  enumControl(ToggleLatchParametersSchema, 'screwKind', 'basic', SCREW_KIND_VALUES.map(value => ({ value, ...SCREW_KIND_TEXT[value] }))),
  // each size links to the library's screws of that size; the screw lists offer only the parts of the chosen size
  { ...enumControl(ToggleLatchParametersSchema, 'woodScrewDiameter', 'basic', LATCH_WOOD_DIAMETERS.map(value => ({ value, label: value, description: `DIN 7997 countersunk wood screws, ${value} in diameter.` }))),
    part: { family: 'wood-screw', attribute: 'diameter', filter: null }, visibleWhen: { control: 'screwKind', values: ['wood'] } },
  { ...partControl(ToggleLatchParametersSchema, 'woodScrew', 'basic', 'wood-screw', LATCH_WOOD_SCREWS), visibleWhen: { control: 'screwKind', values: ['wood'] },
    part: { family: 'wood-screw', attribute: null, filter: { control: 'woodScrewDiameter', attribute: 'diameter' } } },
  { ...enumControl(ToggleLatchParametersSchema, 'screwThread', 'basic', LATCH_MACHINE_THREADS.map(value => ({ value, label: value, description: `Metric ${value} machine screws.` }))),
    part: { family: 'screw', attribute: 'thread', filter: null }, visibleWhen: { control: 'screwKind', values: ['machine'] } },
  { ...partControl(ToggleLatchParametersSchema, 'machineScrew', 'basic', 'screw', LATCH_MACHINE_SCREWS), visibleWhen: { control: 'screwKind', values: ['machine'] },
    part: { family: 'screw', attribute: null, filter: { control: 'screwThread', attribute: 'thread' } } },
  enumControl(ToggleLatchParametersSchema, 'holeFit', 'advanced', HOLE_FIT_VALUES.map(value => ({ value, ...HOLE_FIT_TEXT[value] }))),
  control(ToggleLatchParametersSchema, 'highTolerance', 'advanced'),
];

const TOGGLE_LATCH_DIR = 'models/toggle-latch/';
/** Both plates take the same screws: the kind and fit as strings, each screw's clearance holes as a vector (`scadEncode`), its head from the library. */
const LATCH_SCREW_MAPPING = { screwKind: 'SCREW_KIND', holeFit: 'HOLE_FIT', woodScrew: 'WOOD_HOLES', machineScrew: 'MACHINE_HOLES' };
const LATCH_SCREW_DEFINES: PartDefines = {
  woodScrew: { WOOD_D: ['d', 'value'], WOOD_DK: ['dk', 'max'], WOOD_K: ['k', 'max'] },
  machineScrew: { MACHINE_D: ['d', 'value'], MACHINE_DK: [['dk', 'e'], 'max'], MACHINE_K: ['k', 'max'], MACHINE_HEAD: { attribute: 'head' } },
};
const latchHolesScad = (id: string) => {
  const part = findPart(id);
  if (!part) throw new Error(`${id} is not a part of the library.`);
  return JSON.stringify(latchScrewHoles(part));
};

/** In print order: the two plates (sized for the screws), the lever (reconstruction, either fit) and the link (reconstruction). */
const toggleLatchParts: ModelPart[] = [
  { id: 'base', title: 'Base', sourcePath: `${TOGGLE_LATCH_DIR}base.scad`, scadMapping: LATCH_SCREW_MAPPING, partDefines: LATCH_SCREW_DEFINES },
  { id: 'lever', title: 'Lever', sourcePath: `${TOGGLE_LATCH_DIR}reference/Latch 12mm 3.scad`, scadMapping: { highTolerance: 'HITOL' } },
  { id: 'link', title: 'Link', sourcePath: `${TOGGLE_LATCH_DIR}reference/Latch 12mm 4.scad` },
  { id: 'catch', title: 'Catch', sourcePath: `${TOGGLE_LATCH_DIR}catch.scad`, scadMapping: LATCH_SCREW_MAPPING, partDefines: LATCH_SCREW_DEFINES },
];

/** Lever and link swings are sampled every `LATCH_FRAME_STEP` degrees: between two frames a joint strays by under 0.01 mm. */
const LATCH_FRAME_STEP = 3;

/**
 * The toggle latch as mounted, its plates' backs on the floor (z = 0), the pull along y, from the shared mechanism
 * (`toggleLatchMechanism.ts`, docs/toggle-latch.md): assembled with the lever open and the link swung up off the hook (released),
 * then hooked, closed over centre to its lock, opened back over centre and closed again. The lever and the link snap onto their
 * pins (their side plates spread over the pins' ends). None of it depends on the parameters: the screw holes do not touch the
 * mechanism, and the loose-pivot lever's body is the standard lever's.
 */
export function toggleLatchAssembly(): Assembly {
  const poses = latchPoses(latchState(LATCH_OPEN, LATCH_SWING));
  const frames = (movement: LatchMovement) => {
    const count = Math.max(1, Math.ceil(Math.max(Math.abs(movement.angle[1] - movement.angle[0]), Math.abs(movement.swing[1] - movement.swing[0])) / LATCH_FRAME_STEP));
    return Array.from({ length: count }, (_, i) => {
      const f = (i + 1) / count;
      const { lever, link, catch: plate } = latchPoses(latchState(movement.angle[0] + (movement.angle[1] - movement.angle[0]) * f, movement.swing[0] + (movement.swing[1] - movement.swing[0]) * f));
      return { lever, link, catch: plate };
    });
  };
  return {
    partColors: { base: '#5f7350', catch: '#5f7350', lever: '#d98460', link: '#3f6ea6' },
    poses,
    steps: [
      { title: 'Snap the lever onto the base’s pivot pins', parts: ['lever'], from: [0, 0, 16] },
      { title: 'Snap the link onto the lever’s pins', parts: ['link'], from: [0, 0, 34] },
      { title: 'Screw the catch on across the gap', parts: ['catch'], from: [0, -24, 0] },
    ],
    lift: 12,
    motion: TOGGLE_LATCH_MOVEMENTS.map(movement => ({ title: movement.title, frames: frames(movement) })),
  };
}

export const toggleLatch = {
  id: 'toggle-latch' as const, version: '1' as const, title: 'Toggle latch',
  description: 'A printed over-centre toggle latch, 12 mm wide: a base with the lever’s knuckle, the lever, a link and a catch. Pull the link over the catch’s hook and press the lever down to draw the two sides together. Choose the screws the base and the catch are fastened with, countersunk wood screws or any machine screw from the parts library, and the holes are sized for them; download the four parts as a ZIP of STL files.',
  attribution: 'Hacky97 (Thingiverse), remixed on MakerWorld',
  attributionLinks: [
    { text: 'Hacky97 (Thingiverse)', url: 'https://www.thingiverse.com/thing:5993215' },
    { text: 'MakerWorld', url: 'https://makerworld.com/de/models/625647-toggle-latch' },
  ],
  printNotes: 'Print each part as generated, no supports. Snap the lever onto the base’s pins and the link onto the lever’s.',
  // Kept short: stamped into each STL's 80-byte header together with `attribution` (see mossPlanter).
  license: 'CC BY-NC 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  parts: toggleLatchParts,
  assembly: toggleLatchAssembly(),
  parameterSchema: ToggleLatchParametersSchema,
  controls: toggleLatchControls,
  defaults: Object.fromEntries(toggleLatchControls.map(c => [c.key, c.default])),
  scadMapping: {},
  scadEncode: { woodScrew: latchHolesScad, machineScrew: latchHolesScad },
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(ToggleLatchParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return [];
  },
  derived: () => ({ slotCount: null }),
} satisfies ModelDefinition;

/**
 * Pressure pad: an original design (models/pressure-pad/generator.scad, docs/pressure-pad.md). A round printed pad for the end of a
 * library screw, in place of a bought levelling foot: a thrust pad holds a nut run onto the screw's tip, turning freely, so that it
 * presses without turning; a foot locks the screw's hexagon head, so that turning the pad turns the screw. Its sole is flat,
 * grooved or domed. The window catio's insert and tunnel use it for their clamps and feet.
 */
export const PRESSURE_PAD_THREADS = ['M4', 'M5', 'M6', 'M8'] as const;
/** The nuts a thrust pad takes: nylon-insert lock nuts (the default, they stay put on the tip) and regular hexagon nuts. */
export const PRESSURE_PAD_NUTS = ['iso-10511-m4', 'iso-10511-m5', 'iso-10511-m6', 'iso-10511-m8', 'iso-4032-m4', 'iso-4032-m5', 'iso-4032-m6', 'iso-4032-m8'] as const;
/** The screws a foot takes: ISO 4017 hexagon head screws, whose head locks in the pad's hexagon pocket. */
export const PRESSURE_PAD_SCREWS = [
  'iso-4017-m4x8', 'iso-4017-m4x10', 'iso-4017-m4x12', 'iso-4017-m4x16', 'iso-4017-m4x20', 'iso-4017-m4x25', 'iso-4017-m4x30', 'iso-4017-m4x40', 'iso-4017-m5x10', 'iso-4017-m5x12', 'iso-4017-m5x16', 'iso-4017-m5x20', 'iso-4017-m5x25', 'iso-4017-m5x30', 'iso-4017-m5x40', 'iso-4017-m5x50', 'iso-4017-m6x12', 'iso-4017-m6x16', 'iso-4017-m6x20', 'iso-4017-m6x25', 'iso-4017-m6x30', 'iso-4017-m6x40', 'iso-4017-m6x50', 'iso-4017-m6x60', 'iso-4017-m8x16', 'iso-4017-m8x20', 'iso-4017-m8x25', 'iso-4017-m8x30', 'iso-4017-m8x40', 'iso-4017-m8x50', 'iso-4017-m8x60', 'iso-4017-m8x80',
] as const;
/** M8, as the catio's insert nuts: a foot on ISO 4017 M8 × 50 screws, one 40 mm extender with ISO 10511 lock nuts. */
export const DEFAULT_PRESSURE_PAD = { padType: 'foot', diameter: 32, height: 24.5, surface: 'grooved', relief: 1, extenders: 1, extenderLength: 40, thread: 'M8', nut: 'iso-10511-m8', screw: 'iso-4017-m8x50', fit: 0.4 } as const;
/** The most extenders one leg takes. */
export const PRESSURE_PAD_MAX_EXTENDERS = 3;

const PAD_TYPE_TEXT: Record<PressurePadType, { label: string; description: string }> = {
  thrust: { label: 'Thrust pad (nut)', description: 'A nut run onto the screw’s tip turns freely in the pad: turned from its other end, the screw pushes the pad out without turning it, so the sole does not scrub what it presses on. For clamps.' },
  foot: { label: 'Foot (screw head)', description: 'The screw’s hexagon head locks in the pad: turning the pad turns the screw, like a levelling foot or thumbwheel.' },
};
const PAD_SURFACE_TEXT: Record<PressurePadSurface, { label: string; description: string }> = {
  flat: { label: 'Flat', description: 'The whole sole bears: best on a smooth, even surface.' },
  grooved: { label: 'Grooved', description: 'Concentric grooves bite into a rough surface such as render, and four channels drain them.' },
  domed: { label: 'Domed', description: 'A low dome that bears in the middle first and rocks to follow a surface that is not square to the screw.' },
};

export const PressurePadParametersSchema = Type.Object({
  padType: Type.Enum(PRESSURE_PAD_TYPES, { title: 'Pad', description: 'What the pad holds: a nut that turns freely in it (a thrust pad for a clamp) or a screw head locked in it (a foot).', default: DEFAULT_PRESSURE_PAD.padType }),
  diameter: dimension('Diameter', 'Outside diameter of the pad in mm. A larger pad presses more gently.', DEFAULT_PRESSURE_PAD.diameter, 16, 80, 0.5),
  height: dimension('Height', 'From the pad’s back, against the insert nut or the timber, to its sole, in mm.', DEFAULT_PRESSURE_PAD.height, 8, 80, 0.5),
  surface: Type.Enum(PRESSURE_PAD_SURFACES, { title: 'Sole', description: 'The pad’s pressing face.', default: DEFAULT_PRESSURE_PAD.surface }),
  relief: dimension('Relief', 'Depth of the grooves, or height of the dome, in mm.', DEFAULT_PRESSURE_PAD.relief, 0.4, 3, 0.1),
  extenders: Type.Integer({ title: 'Extenders', description: 'Printed sleeves that make the leg longer than one screw: each joins two screws end to end, a nut locked in one end and the next screw’s head in the other. Hollow between them, so the screw below runs on into it as far as the height needs, then a lock nut holds it. 0 for the pad alone.', default: DEFAULT_PRESSURE_PAD.extenders, minimum: 0, maximum: PRESSURE_PAD_MAX_EXTENDERS }),
  extenderLength: dimension('Extender length', 'Each extender’s length, end to end, in mm. The longer, the more the height can be set at each joint.', DEFAULT_PRESSURE_PAD.extenderLength, 20, 150, 0.5),
  thread: Type.Enum(PRESSURE_PAD_THREADS, { title: 'Thread', description: 'The screw’s thread; the nuts and screws below are those of this thread.', default: DEFAULT_PRESSURE_PAD.thread }),
  nut: Type.Enum(PRESSURE_PAD_NUTS, { title: 'Nut', description: 'The nut the thrust pad’s chamber is sized for, run onto the screw’s tip; the nut locked in each extender, and the lock nut jammed against it.', default: DEFAULT_PRESSURE_PAD.nut }),
  screw: Type.Enum(PRESSURE_PAD_SCREWS, { title: 'Screw', description: 'The hexagon head screw the foot’s and the extenders’ head pockets are sized for. Its length does not change the printed parts; it sets the leg’s length in the assembly.', default: DEFAULT_PRESSURE_PAD.screw }),
  fit: dimension('Fit', 'Play round the nut or head, and round the screw’s shank, on each side, in mm.', DEFAULT_PRESSURE_PAD.fit, 0.1, 0.8, 0.05),
}, { additionalProperties: false, description: 'Pressure pad parameters. All fields are required; dimensions are in millimetres; the nut and screw are parts-library ids.' });
export type PressurePadParameters = Static<typeof PressurePadParametersSchema>;

/** The nut or screw the pad holds, for these parameters. */
export function pressurePadPart(p: Pick<PressurePadParameters, 'padType' | 'nut' | 'screw'>): Part {
  const id = p.padType === 'thrust' ? p.nut : p.screw;
  const part = findPart(id);
  if (!part) throw new Error(`${id} is not a part of the library.`);
  return part;
}

function validatePressurePad(p: PressurePadParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  const part = pressurePadPart(p);
  const height = pressurePadMinHeight(p, part); const diameter = pressurePadMinDiameter(p, part);
  const what = p.padType === 'thrust' ? `an ${part.designation} nut` : `the head of an ${part.designation}`;
  if (p.height < height - 1e-9) issues.push({ field: 'height', message: `The pad must be at least ${Math.ceil(height * 2) / 2} mm high to hold ${what} over a solid floor${p.surface === 'flat' ? '' : ' and its sole’s relief'}.` });
  if (p.diameter < diameter - 1e-9) issues.push({ field: 'diameter', message: `The pad must be at least ${Math.ceil(diameter * 2) / 2} mm across to hold ${what} with a ${PRESSURE_PAD.wall} mm wall.` });
  if (p.extenders > 0) {
    const nut = findPart(p.nut); const screw = findPart(p.screw);
    if (!nut || !screw) return issues;
    const length = pressurePadMinExtenderLength(nut, screw, p.fit); const across = pressurePadMinExtenderDiameter(nut, screw, p.fit);
    const both = `an ${nut.designation} nut and the head of an ${screw.designation}`;
    if (p.extenderLength < length - 1e-9) issues.push({ field: 'extenderLength', message: `An extender must be at least ${Math.ceil(length * 2) / 2} mm long to hold ${both} with a floor between them.` });
    const { max } = pressurePadExtenderTravel(p, nut, screw);
    if (max < 0) issues.push({ field: 'screw', message: `An ${screw.designation} is too short to pass an extender’s lip, its nut and a lock nut: choose one at least ${dimensionOf(screw, 'l') - max} mm long.` });
    if (p.diameter < across - 1e-9 && across > diameter + 1e-9) issues.push({ field: 'diameter', message: `With extenders the pad must be at least ${Math.ceil(across * 2) / 2} mm across: each extender holds ${both} with a ${PRESSURE_PAD.wall} mm wall.` });
  }
  return issues;
}

/**
 * The leg put together (docs/pressure-pad.md#assembly), from `pressurePadLeg`: the pad stays on the floor and the screws, nuts and
 * extenders are added along the leg, each from where it really goes in. A screw's head and a nut slide into their pockets from the
 * slots' side (+X); a foot's extender slides over its nut the same way, the other way round; a thrust pad's next screw comes
 * down into its extender's nut.
 */
export function pressurePadAssembly(parameters: ParameterValues): Assembly {
  const p = { ...DEFAULT_PRESSURE_PAD, ...parameters } as PressurePadParameters;
  const nut = findPart(p.nut) ?? findPart(DEFAULT_PRESSURE_PAD.nut); const screw = findPart(p.screw) ?? findPart(DEFAULT_PRESSURE_PAD.screw);
  if (!nut || !screw) throw new Error('The pressure pad’s default nut and screw are not in the library.');
  const leg = pressurePadLeg(p, nut, screw);
  const side = p.diameter + 12; const along = (id: string) => leg.find(piece => piece.id === id);
  const steps: Assembly['steps'] = [];
  const step = (title: string, parts: string[], from: [number, number, number]) => { if (parts.every(along)) steps.push({ title, parts, from }); };
  if (p.padType === 'foot') {
    step('Slide the screw’s head into the foot from the side', ['screw-0'], [side, 0, 0]);
    for (let i = 1; i <= p.extenders; i++) {
      step(`Extender ${i}: run a lock nut, then a nut, down the screw`, [`locknut-${i}`, `nut-${i}`], [0, 0, 30]);
      step(`Extender ${i}: slide it over the nut from the side (then turn it to the height and jam the lock nut up against it)`, [`extender-${i}`], [-side, 0, 0]);
      step(`Extender ${i}: slide the next screw’s head into its top pocket`, [`screw-${i}`], [side, 0, 0]);
    }
  } else {
    step('Run the nut onto the screw’s tip until flush, then slide both into the pad from the side', ['screw-0', 'nut-0'], [side, 0, 0]);
    for (let i = 1; i <= p.extenders; i++) {
      step(`Extender ${i}: slide it over the screw’s head from the side`, [`extender-${i}`], [-side, 0, 0]);
      step(`Extender ${i}: slide a nut into its top pocket`, [`nut-${i}`], [side, 0, 0]);
      step(`Extender ${i}: turn the next screw, a lock nut on it, down through the nut (to the height, then jam the lock nut down on the extender)`, [`screw-${i}`, `locknut-${i}`], [0, 0, 30]);
    }
  }
  // Each extender's height, set: from the longest leg (as it was slid on) its screw runs on into the hollow bore to the shortest,
  // then back. Everything the joint carries moves with it, sampled every half millimetre.
  const { max } = pressurePadExtenderTravel(p, nut, screw);
  const motion: NonNullable<Assembly['motion']> = max > 0 ? Array.from({ length: p.extenders }, (_, index) => {
    const count = Math.max(2, Math.ceil(max / 0.5));
    const path = [...Array.from({ length: count }, (_, k) => (k + 1) / count), ...Array.from({ length: count }, (_, k) => 1 - (k + 1) / count)];
    return {
      title: `Set the height at extender ${index + 1}: ${Math.round(max * 10) / 10} mm of travel`,
      frames: path.map(setting => Object.fromEntries(pressurePadLeg(p, nut, screw, Array.from({ length: p.extenders }, (_, k) => k === index ? setting : 0))
        .map(piece => [piece.id, { position: piece.position, rotation: piece.rotation }]))),
    };
  }) : [];
  // the printed parts' poses; the screws and nuts are linked references (`pressurePadFasteners`), named in the steps
  return {
    partColors: { pad: '#5f7350', ...Object.fromEntries(Array.from({ length: PRESSURE_PAD_MAX_EXTENDERS }, (_, i) => [`extender-${i + 1}`, '#d98460'])) },
    poses: Object.fromEntries(leg.filter(piece => piece.kind === 'pad' || piece.kind === 'extender').map(piece => [piece.id, { position: piece.position, rotation: piece.rotation }])),
    steps, lift: 10, ...(motion.length > 0 ? { motion } : {}),
  };
}

/** The leg's library screws and nuts, where `pressurePadLeg` puts them; `pressurePadAssembly`'s steps move them. */
function pressurePadFasteners(parameters: ParameterValues): LinkedReference[] {
  const p = { ...DEFAULT_PRESSURE_PAD, ...parameters } as PressurePadParameters;
  const nut = findPart(p.nut); const screw = findPart(p.screw);
  if (!nut || !screw) return [];
  return pressurePadLeg(p, nut, screw).filter(piece => piece.kind === 'nut' || piece.kind === 'screw').map(piece => ({
    id: piece.id, part: (piece.kind === 'nut' ? nut : screw).id,
    label: piece.id.endsWith('-0') ? (p.padType === 'foot' ? 'in the foot' : 'in the pad')
      : `${piece.id.startsWith('locknut') ? 'lock nut at ' : ''}extender ${piece.id.split('-')[1] ?? ''}`,
    pose: { position: piece.position, rotation: piece.rotation },
  }));
}

const padThreadFiltered = (c: Control): Control => ({ ...c, part: c.part && { ...c.part, filter: { control: 'thread', attribute: 'thread' } } });
const pressurePadControls = [
  enumControl(PressurePadParametersSchema, 'padType', 'basic', PRESSURE_PAD_TYPES.map(value => ({ value, ...PAD_TYPE_TEXT[value] }))),
  control(PressurePadParametersSchema, 'diameter', 'basic'),
  control(PressurePadParametersSchema, 'height', 'basic'),
  enumControl(PressurePadParametersSchema, 'surface', 'basic', PRESSURE_PAD_SURFACES.map(value => ({ value, ...PAD_SURFACE_TEXT[value] }))),
  { ...control(PressurePadParametersSchema, 'relief', 'basic'), visibleWhen: { control: 'surface', values: ['grooved', 'domed'] } },
  enumControl(PressurePadParametersSchema, 'thread', 'basic', PRESSURE_PAD_THREADS.map(value => ({ value, label: value, description: `Metric ${value} nuts and screws.` }))),
  control(PressurePadParametersSchema, 'extenders', 'basic', null, null),
  control(PressurePadParametersSchema, 'extenderLength', 'basic'),
  padThreadFiltered(partControl(PressurePadParametersSchema, 'nut', 'basic', 'nut', PRESSURE_PAD_NUTS)),
  padThreadFiltered(partControl(PressurePadParametersSchema, 'screw', 'basic', 'screw', PRESSURE_PAD_SCREWS)),
  control(PressurePadParametersSchema, 'fit', 'advanced'),
];

const PRESSURE_PAD_DEFINES: PartDefines = {
  nut: { NUT_D: ['d', 'value'], NUT_S: ['s', 'max'], NUT_H: [['h', 'm'], 'max'] },
  screw: { SCREW_D: ['d', 'value'], SCREW_S: ['s', 'max'], SCREW_K: ['k', 'max'] },
};
/** The pad, and one extender per `extenders` (each its own STL, all alike), from the one generator. */
const pressurePadParts: ModelPart[] = [
  { id: 'pad', title: 'Pad', sourcePath: 'models/pressure-pad/generator.scad', scadConstants: { PART: 'pad' },
    scadMapping: { padType: 'PAD_TYPE', diameter: 'DIAMETER', height: 'HEIGHT', surface: 'SURFACE', relief: 'RELIEF', fit: 'FIT' }, partDefines: PRESSURE_PAD_DEFINES },
  ...Array.from({ length: PRESSURE_PAD_MAX_EXTENDERS }, (_, i): ModelPart => ({
    id: `extender-${i + 1}`, title: `Extender ${i + 1}`, sourcePath: 'models/pressure-pad/generator.scad', scadConstants: { PART: 'extender' },
    scadMapping: { diameter: 'DIAMETER', extenderLength: 'EXT_LENGTH', fit: 'FIT' }, partDefines: PRESSURE_PAD_DEFINES,
    includedWhen: parameters => Number(parameters['extenders']) > i,
  })),
];

export const pressurePad = {
  id: 'pressure-pad' as const, version: '1' as const, title: 'Pressure pad',
  description: 'A printed pad for the end of a screw, in place of a bought levelling foot: a thrust pad holds a nut on the screw’s tip and presses without turning, a foot holds the screw’s hexagon head and turns it like a levelling foot. Printed extenders join screws end to end for a longer leg. Choose the nut and screw from the parts library, the pad’s size and its sole: flat, grooved or domed.',
  attribution: 'CanFactory (original design)',
  printNotes: 'Print in PETG as generated: the pad with its slotted back on the bed, each extender standing on its nut end; no supports. Slide each nut or screw head into its slot and press it past the two bumps at the mouth. Turn each screw into its extender’s nut until its tip bears: that locks the joint.',
  license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  parts: pressurePadParts,
  assembly: pressurePadAssembly(DEFAULT_PRESSURE_PAD),
  assemblyForParameters: pressurePadAssembly,
  linkedReferences: pressurePadFasteners,
  parameterSchema: PressurePadParametersSchema,
  controls: pressurePadControls,
  defaults: Object.fromEntries(pressurePadControls.map(c => [c.key, c.default])),
  scadMapping: {},
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(PressurePadParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return validatePressurePad(parameters);
  },
  derived: () => ({ slotCount: null }),
} satisfies ModelDefinition;

/**
 * The splice bars' fasteners (docs/window-cat-guard.md#splice-bars): two countersunk screws per bar, down through the bar into each
 * segment, each into a nut in a pocket from the plate's back or a heat-set insert in the spine (or rib). Every part is a real
 * product or standard part from the parts library. A screw fits when its head sits flush in the bar (`WINDOW_CAT_GUARD_SPLICE`)
 * and it reaches past the bar no further than the deepest plate and spine allow (`GUARD_STACK`); a nut or an insert when its
 * pocket or hole, with its wall, stays within `holderRadius` and it fits that deepest plate and spine. Whether a screw suits the
 * chosen nut or insert at the chosen plate and spine is checked by `jointScrewHolds`.
 */
const SPLICE = WINDOW_CAT_GUARD_SPLICE;
/** The plate and the spine together, the depth a screw goes into, at the least and the most `thickness` + `ribHeight`. */
const GUARD_STACK = { minimum: 2.4 + 2, maximum: 6 + 12 } as const;
const jointNutPocketRadius = (part: Part) => dimensionOf(part, 's', 'max') / (part.attributes['shape']?.startsWith('square') ? Math.SQRT2 : Math.sqrt(3)) + SPLICE.nutPlay / 2;

export function jointScrewFits(part: Part): boolean {
  if (part.family !== 'screw' || part.attributes['head'] !== 'countersunk' || !(screwThread(part) in ISO_273_CLEARANCE_HOLES)) return false;
  const reach = screwLength(part) - SPLICE.thickness;
  return dimensionOf(part, 'k', 'max') <= SPLICE.thickness - SPLICE.underHead + 1e-9 && (dimensionOf(part, 'dk', 'max') + SPLICE.sinkPlay) / 2 <= SPLICE.holderRadius + 1e-9
    && reach > 0 && reach <= GUARD_STACK.maximum + 1e-9;
}
export function jointInsertFits(part: Part): boolean {
  return part.family === 'threaded-insert' && dimensionOf(part, 'hole') / 2 + dimensionOf(part, 'wall') <= SPLICE.holderRadius + 1e-9 && dimensionOf(part, 'l') <= GUARD_STACK.maximum;
}
export function jointNutFits(part: Part): boolean {
  return part.family === 'nut' && jointNutPocketRadius(part) + SPLICE.nutWall <= SPLICE.holderRadius + 1e-9
    && SPLICE.nutRecess + nutHeight(part) + SPLICE.nutRoof <= GUARD_STACK.maximum;
}

/**
 * Whether a screw holds in this nut or insert through a plate and spine `stack` deep (its countersunk head flush with the bar's
 * top): into an insert, it reaches past the bar at least as far as the insert is long and no further than the plate's back; into
 * a nut, its tip stays inside the plate's back, and the nut round it (at least `nutRecess` in) leaves `nutRoof` of the spine.
 */
export function jointScrewHolds(stack: number, joints: SegmentJoints, screw: Part, holder: Part): boolean {
  const reach = screwLength(screw) - SPLICE.thickness;
  if (joints === 'threaded-insert') return reach >= dimensionOf(holder, 'l') - 1e-9 && reach <= stack + 1e-9;
  const tip = stack - reach;
  return tip >= -1e-9 && Math.max(tip, SPLICE.nutRecess) + nutHeight(holder) <= stack - SPLICE.nutRoof + 1e-9;
}

/**
 * The fasteners the splice bars offer: every library part that fits (`jointScrewFits`, `jointInsertFits`, `jointNutFits`), of a
 * thread that has a fitting screw and a fitting nut or insert, in the library's order. Listed rather than computed, so that the
 * parameters' types name them; a test keeps each list equal to the library's fitting parts.
 */
export const JOINT_THREADS = ['M2', 'M2.5', 'M3', 'M4'] as const;
export const JOINT_SCREWS = [
  'iso-10642-m3x8', 'iso-10642-m3x10', 'iso-10642-m3x12', 'iso-10642-m3x16', 'iso-10642-m3x20', 'iso-10642-m4x8', 'iso-10642-m4x10', 'iso-10642-m4x12', 'iso-10642-m4x16', 'iso-10642-m4x20',
  'iso-7046-m2x5', 'iso-7046-m2x6', 'iso-7046-m2x8', 'iso-7046-m2x10', 'iso-7046-m2x12', 'iso-7046-m2x16', 'iso-7046-m2x20', 'iso-7046-m2-5x5', 'iso-7046-m2-5x6',
  'iso-7046-m2-5x8', 'iso-7046-m2-5x10', 'iso-7046-m2-5x12', 'iso-7046-m2-5x16', 'iso-7046-m2-5x20', 'iso-7046-m3x5', 'iso-7046-m3x6', 'iso-7046-m3x8', 'iso-7046-m3x10',
  'iso-7046-m3x12', 'iso-7046-m3x16', 'iso-7046-m3x20', 'iso-7046-m4x5', 'iso-7046-m4x6', 'iso-7046-m4x8', 'iso-7046-m4x10', 'iso-7046-m4x12', 'iso-7046-m4x16', 'iso-7046-m4x20',
] as const;
export const JOINT_INSERTS = [
  'cnc-kitchen-m2x3', 'cnc-kitchen-m2-5x4', 'cnc-kitchen-m3x5-7', 'cnc-kitchen-m3x3', 'cnc-kitchen-m3x5x4', 'cnc-kitchen-m4x8-1', 'cnc-kitchen-m4x4', 'ruthex-rx-m2x4', 'ruthex-rx-m3x5-7', 'ruthex-rx-m4x8-1',
] as const;
export const JOINT_NUTS = [
  'iso-4032-m2', 'iso-4032-m2-5', 'iso-4032-m3', 'iso-4032-m4', 'iso-4035-m2', 'iso-4035-m2-5', 'iso-4035-m3', 'iso-4035-m4', 'iso-10511-m3', 'iso-10511-m4', 'din-562-m2', 'din-562-m2-5', 'din-562-m3',
] as const;
/** M3, the usual thread of printed parts: a regular hexagon nut (or a CNC Kitchen M3 × 5.7 insert) on an ISO 10642 M3 × 10. */
export const DEFAULT_JOINT_FASTENERS = { thread: 'M3', insert: 'cnc-kitchen-m3x5-7', nut: 'iso-4032-m3', screw: 'iso-10642-m3x10' } as const;
const JOINT_THREAD_TEXT: Record<string, string> = { M2: 'The smallest screws.', 'M2.5': 'Between M2 and M3.', M3: 'The usual thread of printed parts.', M4: 'The sturdiest that fits the spine.' };

const SEGMENT_JOINT_TEXT: Record<SegmentJoints, { label: string; description: string }> = {
  'nut-bolt': { label: 'Splice bars, screws and nuts', description: 'A printed bar over every joint, on the two spines (or ribs), with a countersunk screw down into each segment and a nut pushed into a pocket in the plate’s back. The joint cannot come apart until you undo the screws.' },
  'threaded-insert': { label: 'Splice bars, screws and threaded inserts', description: 'A printed bar over every joint, with a countersunk screw down into each segment, into a brass heat-set insert melted into the spine (or rib). Needs a soldering iron; the screws go in and out many times.' },
  glue: { label: 'Dovetails only (glue them)', description: 'The joints as in the original: the dovetails hold the segments side by side, but lift out the way they went in. Glue each joint (epoxy or gel superglue for PETG) to keep the panel together.' },
};

/**
 * Window cat guard (models/window-cat-guard/generator.scad, docs/window-cat-guard.md): honeycomb panels that close the gaps of a
 * tilted window, built the way the reference parts in models/window-cat-guard/references/ are: flat honeycomb plates, split into
 * segments that join with an in-plane dovetail under a spine or rib that laps onto the next segment, and a top strip whose pins
 * plug into bosses on the side panels. Every panel longer than `maxPartLength` is split into equal segments, one part each. Unlike
 * the reference, a splice bar is screwed over every joint by default, since the dovetail alone lifts out the way it went in.
 */
export const DEFAULT_WINDOW_CAT_GUARD = {
  height: 550, gap: 105, tipWidth: 10, width: 900, maxPartLength: 210, topStrip: true,
  segmentJoints: 'nut-bolt' as SegmentJoints, jointThread: DEFAULT_JOINT_FASTENERS.thread, jointInsert: DEFAULT_JOINT_FASTENERS.insert,
  jointNut: DEFAULT_JOINT_FASTENERS.nut, jointScrew: DEFAULT_JOINT_FASTENERS.screw,
  thickness: 4, ribHeight: 5, cell: 30, web: 4, border: 6, fit: 0.1,
} as const;

/** The clearance's bands (`fit`): 0.1 mm per side is a snug fit on a tuned printer; more is looser and wobblier. */
const GUARD_CLEARANCE_BANDS = [
  { minimum: 0.05, maximum: 0.1, label: 'Tight (a tuned printer; may need pressing)' },
  { minimum: 0.1, maximum: 0.2, label: 'Snug fit' },
  { minimum: 0.2, maximum: 0.3, label: 'Sliding fit (some wobble)' },
  { minimum: 0.3, maximum: 0.4, label: 'Loose (for printers that print tight)' },
];

export const WindowCatGuardParametersSchema = Type.Object({
  height: dimension('Height', 'Height of the side panels: how high the side gap is that they close, from the panel’s tip at the bottom to the window’s top, in mm. Above the longest part they are split into segments.', DEFAULT_WINDOW_CAT_GUARD.height, 150, 1500, 1),
  gap: dimension('Gap at the top', 'Width of the side gap at the top of the tilted window, frame to sash, in mm: the side panels’ top width and the top strip’s depth.', DEFAULT_WINDOW_CAT_GUARD.gap, 60, 200, 0.5),
  tipWidth: dimension('Width at the bottom', 'Width of the side panels at their bottom, in mm. The gap tapers to nothing at the hinge; the panel stops where it is this wide.', DEFAULT_WINDOW_CAT_GUARD.tipWidth, 4, 60, 0.5),
  width: dimension('Window width', 'Width of the window opening, in mm: from the left side panel’s outer face to the right one’s. The top strip spans it between the side panels’ bosses.', DEFAULT_WINDOW_CAT_GUARD.width, 300, 1600, 1),
  maxPartLength: dimension('Longest part', 'A side panel or the top strip longer than this is split into equal segments that dovetail together, so that every part fits your print bed, in mm.', DEFAULT_WINDOW_CAT_GUARD.maxPartLength, 120, 300, 1),
  topStrip: Type.Boolean({ title: 'Top strip', description: 'A strip across the gap at the top of the window, its pins plugged into bosses on the side panels: the guard becomes one frame that stands in the window. Off: two side panels on their own, without bosses.', default: DEFAULT_WINDOW_CAT_GUARD.topStrip }),
  segmentJoints: Type.Enum(SEGMENT_JOINT_VALUES, { title: 'Segment joints', description: 'What holds the segments of a panel together. The dovetails keep them side by side but lift out the way they went in; a splice bar screwed over every joint holds them for good.', default: DEFAULT_WINDOW_CAT_GUARD.segmentJoints }),
  jointThread: Type.Enum(JOINT_THREADS, { title: 'Screw thread', description: 'The thread of the splice bars’ screws and their nuts or inserts.', default: DEFAULT_JOINT_FASTENERS.thread }),
  jointInsert: Type.Enum(JOINT_INSERTS, { title: 'Threaded inserts', description: 'The heat-set inserts, a real product from the parts library: each hole is sized from the maker’s recommendation, from the spine’s top.', default: DEFAULT_JOINT_FASTENERS.insert }),
  jointNut: Type.Enum(JOINT_NUTS, { title: 'Nuts', description: 'The nuts, standard parts from the parts library: each pocket, from the plate’s back, is cut to the nut’s greatest size and sits where the screw ends.', default: DEFAULT_JOINT_FASTENERS.nut }),
  jointScrew: Type.Enum(JOINT_SCREWS, { title: 'Screws', description: 'The countersunk screws, standard parts from the parts library, two per splice bar: their heads sit flush in the bar. A screw must reach through its nut, or as deep as its insert, without coming out of the plate’s back.', default: DEFAULT_JOINT_FASTENERS.screw }),
  thickness: dimension('Plate thickness', 'Thickness of the honeycomb plates, in mm.', DEFAULT_WINDOW_CAT_GUARD.thickness, 2.4, 6, 0.1),
  ribHeight: dimension('Rib height', 'How high the side panels’ spine and the strip’s ribs stand on the plate, in mm. They stiffen the panels and hold the joints flush.', DEFAULT_WINDOW_CAT_GUARD.ribHeight, 2, 12, 0.5),
  cell: dimension('Honeycomb holes', 'Size of the hexagonal holes, corner to corner, in mm (across flats: 0.87 ×). At most 40 mm, which a paw does not get through; 0 for solid plates.', DEFAULT_WINDOW_CAT_GUARD.cell, 0, 40, 0.5),
  web: dimension('Web', 'Width of the bars between the holes, in mm.', DEFAULT_WINDOW_CAT_GUARD.web, 2, 10, 0.1),
  border: dimension('Border', 'Solid border round every plate, in mm.', DEFAULT_WINDOW_CAT_GUARD.border, 3, 15, 0.5),
  fit: dimension('Clearance', 'Gap per side between parts that fit together, in mm: round each dovetail’s tab in its notch, between the segments’ ends, and round the strip’s pins in the side panels’ bosses. Smaller is tighter and wobbles less; raise it if your printer prints parts that are too tight to go together.', DEFAULT_WINDOW_CAT_GUARD.fit, 0.05, 0.4, 0.01),
}, { additionalProperties: false, description: 'Window cat guard parameters. All fields are required; dimensions are in millimetres; the joint fields are parts-library ids or attribute values.' });
export type WindowCatGuardParameters = Static<typeof WindowCatGuardParametersSchema>;

function validateWindowCatGuard(p: WindowCatGuardParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  const layout = windowCatGuardLayout(p);
  const max = WINDOW_CAT_GUARD_MAX_SEGMENTS;
  if (layout.sideSegments > max) issues.push({ field: 'maxPartLength', message: `The side panels would need ${layout.sideSegments} segments each; at most ${max}: allow parts of at least ${Math.ceil(p.height / max)} mm.` });
  if (p.topStrip && layout.stripSegments > max) issues.push({ field: 'maxPartLength', message: `The top strip would need ${layout.stripSegments} segments; at most ${max}: allow parts of at least ${Math.ceil(layout.stripLength / max)} mm.` });
  if (p.tipWidth >= p.gap) issues.push({ field: 'tipWidth', message: 'The side panels must be narrower at the bottom than the gap at the top.' });
  const joint = sideJointWidth(p);
  if (layout.sideSegments > 1 && layout.sideSegments <= max && sideWidth(p, layout.sideLength) < joint - 1e-9)
    issues.push({ field: 'tipWidth', message: `The side panels’ lowest joint is only ${Math.floor(sideWidth(p, layout.sideLength) * 10) / 10} mm wide; its dovetail needs ${Math.ceil(joint * 10) / 10} mm. Widen the bottom, or allow longer parts so that the joint sits higher.` });
  if (p.topStrip && layout.spacing < leastRibSpacing() - 1e-9)
    issues.push({ field: 'gap', message: `With a top strip the gap must be at least ${Math.ceil((p.gap - layout.spacing + leastRibSpacing()) * 2) / 2} mm, for the bosses either side of the spine (or narrow the border).` });
  if (p.cell > 0 && p.cell < 2 * p.web) issues.push({ field: 'cell', message: `Holes smaller than twice the web (${2 * p.web} mm) are not worth printing: use 0 for solid plates.` });
  issues.push(...segmentJointIssues(p));
  return issues;
}

/** The splice bars' screw must hold in the chosen nut or insert through this plate and spine (`jointScrewHolds`); the message names the shortest that does. */
function segmentJointIssues(p: WindowCatGuardParameters): ParameterIssue[] {
  if (p.segmentJoints === 'glue') return [];
  const screw = findPart(p.jointScrew);
  const holder = findPart(p.segmentJoints === 'threaded-insert' ? p.jointInsert : p.jointNut);
  if (!screw || !holder || screwThread(screw) !== screwThread(holder)) return [];
  const stack = p.thickness + p.ribHeight;
  if (jointScrewHolds(stack, p.segmentJoints, screw, holder)) return [];
  const best = JOINT_SCREWS.map(id => findPart(id)).filter((part): part is Part => part !== undefined && screwThread(part) === screwThread(holder) && jointScrewHolds(stack, p.segmentJoints, part, holder))
    .sort((a, b) => screwLength(a) - screwLength(b))[0];
  const reach = screwLength(screw) - SPLICE.thickness;
  const why = p.segmentJoints === 'threaded-insert'
    ? reach > stack ? `reaches ${reach} mm past the splice bar, through the ${stack} mm of plate and spine` : `reaches only ${reach} mm past the splice bar, but the ${holder.title} is ${dimensionOf(holder, 'l')} mm long`
    : reach > stack ? `reaches ${reach} mm past the splice bar, out of the ${stack} mm of plate and spine` : `leaves no room in the ${stack} mm of plate and spine for the ${holder.title} round its tip and ${SPLICE.nutRoof} mm of spine over it`;
  return [{ field: 'jointScrew', message: `${screw.title} ${why}. ${best ? `Use ${best.title}.` : 'No listed screw of this thread fits: make the plate or the ribs thicker, or choose another nut or insert.'}` }];
}

/**
 * The guard put together (docs/window-cat-guard.md#assembly): each side panel is joined from the top down, every segment's
 * dovetail dropped into the one above from the spine's side (its spine laps onto the plate above), then a splice bar is screwed
 * over every joint; the strip is joined from its right end, each segment laid in from above, its bars screwed on, then plugged into
 * the left panel's bosses, and the right panel is pushed onto the strip's other pins.
 */
export function windowCatGuardAssembly(parameters: ParameterValues): Assembly {
  const p = { ...DEFAULT_WINDOW_CAT_GUARD, ...parameters } as WindowCatGuardParameters;
  const layout = windowCatGuardLayout(p);
  const pieces = windowCatGuardPieces(p);
  const of = (panel: string) => pieces.filter(piece => piece.panel === panel).map(piece => piece.id);
  const bars = (panel: string, joints: (j: number) => boolean) => pieces.filter(piece => piece.kind === 'bar' && piece.panel === panel && joints(piece.segment)).map(piece => piece.id);
  const steps: Assembly['steps'] = [];
  const reach = 60;
  // each step brings the rest of the panel along, so that the exploded layout shows every segment apart (a staircase); a splice bar
  // rides with the segment it is screwed to in its tab (a side panel's lower one, the strip's left one), then comes on in a step of its own
  const from = (kind: string, first: number, last: number) => Array.from({ length: last - first + 1 }, (_, i) => `${kind}-${first + i}`);
  const joints = (n: number) => n > 2 ? 'every joint' : 'the joint';
  for (const [side, title, direction] of [['left', 'Left panel', 1], ['right', 'Right panel', -1]] as const) {
    for (let k = 2; k <= layout.sideSegments; k++)
      steps.push({ title: `${title}: drop segment ${k}’s dovetail into segment ${k - 1}`, parts: [...from(side, k, layout.sideSegments), ...bars(side, j => j >= k - 1)], from: [direction * reach, 0, 0] });
    if (bars(side, () => true).length > 0)
      steps.push({ title: `${title}: screw a splice bar over ${joints(layout.sideSegments)}`, parts: bars(side, () => true), from: [direction * reach / 2, 0, 0] });
  }
  if (layout.stripSegments > 0) {
    for (let k = layout.stripSegments - 1; k >= 1; k--)
      steps.push({ title: `Top strip: lay segment ${k}’s dovetails into segment ${k + 1}`, parts: [...from('strip', 1, k), ...bars('strip', j => j <= k)], from: [0, 0, 40] });
    if (bars('strip', () => true).length > 0)
      steps.push({ title: `Top strip: screw a splice bar over ${joints(layout.stripSegments)}, on both ribs`, parts: bars('strip', () => true), from: [0, 0, 30] });
    steps.push({ title: 'Plug the top strip’s pins into the left panel’s bosses', parts: of('strip'), from: [2 * reach, 0, 0] });
    steps.push({ title: 'Push the right panel’s bosses onto the strip’s other pins; stand the guard in the window', parts: of('right'), from: [4 * reach, 0, 0] });
  }
  return {
    partColors: Object.fromEntries(pieces.map(piece => [piece.id, piece.kind === 'bar' ? '#c8553d' : piece.kind === 'strip' ? '#d9a441' : piece.segment % 2 === 1 ? '#4f7f9c' : '#6f9bb5'])),
    poses: Object.fromEntries(pieces.map(piece => [piece.id, { position: piece.position, rotation: piece.rotation }])),
    steps, lift: 20,
  };
}

/**
 * The splice bars' fasteners, as reference objects where they sit (docs/window-cat-guard.md#splice-bars): each screw's head flush
 * with its bar's top, riding with the bar (a screw's own frame has its tip at z = 0 and its head up); each nut on the screw's tip
 * (or `nutRecess` inside the plate's back), each insert flush with the spine's top, riding with its segment.
 */
function windowCatGuardFasteners(parameters: ParameterValues): LinkedReference[] {
  const p = { ...DEFAULT_WINDOW_CAT_GUARD, ...parameters } as WindowCatGuardParameters;
  const screw = findPart(p.jointScrew);
  const insert = p.segmentJoints === 'threaded-insert';
  const holder = findPart(insert ? p.jointInsert : p.jointNut);
  if (p.segmentJoints === 'glue' || !screw || !holder) return [];
  const stack = p.thickness + p.ribHeight;
  const tip = stack + SPLICE.thickness - screwLength(screw);
  const holderZ = insert ? stack - dimensionOf(holder, 'l') : Math.max(tip, SPLICE.nutRecess);
  // a nut turned as its pocket is, corners along the spine: the library's hexagon has a corner at 30°, its square at 45° (the
  // pocket's square is turned by 45° too)
  const spin = !insert && !holder.attributes['shape']?.startsWith('square') ? -30 : 0;
  return windowCatGuardBolts(p).flatMap((bolt): LinkedReference[] => [
    { id: `${bolt.bar}-${bolt.end}-${insert ? 'insert' : 'nut'}`, part: holder.id, label: bolt.label, pose: { position: bolt.at(holderZ), rotation: bolt.turned(spin) }, movesWith: bolt.segment },
    { id: `${bolt.bar}-${bolt.end}-screw`, part: screw.id, label: bolt.label, pose: { position: bolt.at(tip), rotation: bolt.rotation }, movesWith: bolt.bar },
  ]);
}

/** A part-linked control that offers only the parts of the splice bars' screw thread. */
const jointThreadFiltered = (c: Control): Control => ({ ...c, part: c.part && { ...c.part, filter: { control: 'jointThread', attribute: 'thread' } } });

const windowCatGuardControls = [
  control(WindowCatGuardParametersSchema, 'height', 'basic'),
  control(WindowCatGuardParametersSchema, 'gap', 'basic'),
  control(WindowCatGuardParametersSchema, 'width', 'basic'),
  control(WindowCatGuardParametersSchema, 'topStrip', 'basic'),
  control(WindowCatGuardParametersSchema, 'maxPartLength', 'basic'),
  enumControl(WindowCatGuardParametersSchema, 'segmentJoints', 'basic', SEGMENT_JOINT_VALUES.map(value => ({ value, ...SEGMENT_JOINT_TEXT[value] }))),
  // the fasteners, while the joints have splice bars: the inserts, nuts and screws offered are the library's parts of the chosen thread
  ...[enumControl(WindowCatGuardParametersSchema, 'jointThread', 'basic', JOINT_THREADS.map(value => ({ value, label: value, description: JOINT_THREAD_TEXT[value] ?? '' }))),
    { ...jointThreadFiltered(partControl(WindowCatGuardParametersSchema, 'jointInsert', 'basic', 'threaded-insert', JOINT_INSERTS)), visibleWhen: { control: 'segmentJoints', values: ['threaded-insert'] } },
    { ...jointThreadFiltered(partControl(WindowCatGuardParametersSchema, 'jointNut', 'basic', 'nut', JOINT_NUTS)), visibleWhen: { control: 'segmentJoints', values: ['nut-bolt'] } },
    jointThreadFiltered(partControl(WindowCatGuardParametersSchema, 'jointScrew', 'basic', 'screw', JOINT_SCREWS))]
    .map((c): Control => ({ ...c, visibleWhen: c.visibleWhen ?? { control: 'segmentJoints', values: ['nut-bolt', 'threaded-insert'] } })),
  { ...control(WindowCatGuardParametersSchema, 'fit', 'basic'), bands: GUARD_CLEARANCE_BANDS },
  control(WindowCatGuardParametersSchema, 'tipWidth', 'advanced'),
  control(WindowCatGuardParametersSchema, 'thickness', 'advanced'),
  control(WindowCatGuardParametersSchema, 'ribHeight', 'advanced'),
  control(WindowCatGuardParametersSchema, 'cell', 'advanced'),
  control(WindowCatGuardParametersSchema, 'web', 'advanced'),
  control(WindowCatGuardParametersSchema, 'border', 'advanced'),
];

const WINDOW_CAT_GUARD_SOURCE = 'models/window-cat-guard/generator.scad';
const WINDOW_CAT_GUARD_SHARED = { thickness: 'THICKNESS', ribHeight: 'RIB_HEIGHT', cell: 'CELL', web: 'WEB', border: 'BORDER', fit: 'FIT', gap: 'GAP', maxPartLength: 'MAX_LENGTH', segmentJoints: 'JOINTS', jointThread: 'SCREW_HOLE' };
const WINDOW_CAT_GUARD_SIDE_MAPPING = { ...WINDOW_CAT_GUARD_SHARED, height: 'HEIGHT', tipWidth: 'TIP', topStrip: 'STRIP' };
const WINDOW_CAT_GUARD_STRIP_MAPPING = { ...WINDOW_CAT_GUARD_SHARED, width: 'WIDTH' };
/** The segments take the screw's length (where it ends), the insert's hole and the nut's pocket; a splice bar only the thread's
 * clearance hole and the screw's head. Every bar is the same part, so the bars share one render. */
const WINDOW_CAT_GUARD_SEGMENT_DEFINES: PartDefines = {
  jointScrew: { SCREW_L: ['l', 'value'] },
  jointInsert: { INSERT_HOLE: ['hole', 'value'], INSERT_DEPTH: ['holeDepth', 'value'] },
  // a nylon-insert nut's pocket takes its overall height; a square nut's is square
  jointNut: { NUT_S: ['s', 'max'], NUT_H: [['h', 'm'], 'max'], NUT_SHAPE: { attribute: 'shape' } },
};
const WINDOW_CAT_GUARD_BAR_DEFINES: PartDefines = { jointScrew: { SCREW_D: ['d', 'value'], SCREW_DK: ['dk', 'max'], SCREW_K: ['k', 'max'] } };
const guardLayout = (parameters: ParameterValues) => windowCatGuardLayout({ ...DEFAULT_WINDOW_CAT_GUARD, ...parameters });
const spliced = (parameters: ParameterValues) => (parameters['segmentJoints'] ?? DEFAULT_WINDOW_CAT_GUARD.segmentJoints) !== 'glue';
const segmentTitle = (k: number, first: string) => `segment ${k}${k === 1 ? ` (${first})` : ''}`;
/** Up to eight segments per side panel (1 = the top) and for the strip (1 = its left end), each present while the layout has it;
 * then up to seven splice bars per side panel and seven pairs on the strip (bar j joins segments j and j + 1), with splice bars. */
const windowCatGuardParts: ModelPart[] = [
  ...(['left', 'right'] as const).flatMap(side => Array.from({ length: WINDOW_CAT_GUARD_MAX_SEGMENTS }, (_, i): ModelPart => ({
    id: `${side}-${i + 1}`, title: `${side === 'left' ? 'Left' : 'Right'} panel, ${segmentTitle(i + 1, 'top')}`, sourcePath: WINDOW_CAT_GUARD_SOURCE,
    scadConstants: { PART: 'side', SIDE: side, SEGMENT: i + 1 }, scadMapping: WINDOW_CAT_GUARD_SIDE_MAPPING, partDefines: WINDOW_CAT_GUARD_SEGMENT_DEFINES,
    includedWhen: parameters => guardLayout(parameters).sideSegments > i,
  }))),
  ...Array.from({ length: WINDOW_CAT_GUARD_MAX_SEGMENTS }, (_, i): ModelPart => ({
    id: `strip-${i + 1}`, title: `Top strip, ${segmentTitle(i + 1, 'left end')}`, sourcePath: WINDOW_CAT_GUARD_SOURCE,
    scadConstants: { PART: 'strip', SEGMENT: i + 1 }, scadMapping: WINDOW_CAT_GUARD_STRIP_MAPPING, partDefines: WINDOW_CAT_GUARD_SEGMENT_DEFINES,
    includedWhen: parameters => guardLayout(parameters).stripSegments > i,
  })),
  ...(['left', 'right'] as const).flatMap(side => Array.from({ length: WINDOW_CAT_GUARD_MAX_SEGMENTS - 1 }, (_, i): ModelPart => ({
    id: `${side}-bar-${i + 1}`, title: `${side === 'left' ? 'Left' : 'Right'} panel, splice bar ${i + 1} (segments ${i + 1}–${i + 2})`, sourcePath: WINDOW_CAT_GUARD_SOURCE,
    scadConstants: { PART: 'bar' }, scadMapping: { jointThread: 'SCREW_HOLE' }, partDefines: WINDOW_CAT_GUARD_BAR_DEFINES,
    includedWhen: parameters => spliced(parameters) && guardLayout(parameters).sideSegments > i + 1,
  }))),
  ...Array.from({ length: WINDOW_CAT_GUARD_MAX_SEGMENTS - 1 }, (_, i) => [1, 2].map((rib): ModelPart => ({
    id: `strip-bar-${i + 1}-${rib}`, title: `Top strip, splice bar ${i + 1} (segments ${i + 1}–${i + 2}), rib ${rib}`, sourcePath: WINDOW_CAT_GUARD_SOURCE,
    scadConstants: { PART: 'bar' }, scadMapping: { jointThread: 'SCREW_HOLE' }, partDefines: WINDOW_CAT_GUARD_BAR_DEFINES,
    includedWhen: parameters => spliced(parameters) && guardLayout(parameters).stripSegments > i + 1,
  }))).flat(),
];

export const windowCatGuard = {
  id: 'window-cat-guard' as const, version: '1' as const, title: 'Window cat guard',
  description: 'Honeycomb panels that close the gaps of a tilted window, so that a cat cannot slip into the wedge at the side: two side panels and a strip across the top, plugged together into one frame that stands in the window. Set the window’s height and width and the gap at the top; every panel longer than your print bed allows is split into segments that dovetail together, and a splice bar screwed over every joint (into nuts or threaded inserts from the parts library) keeps them together.',
  attribution: 'After “Tilted window cat protection” on MakerWorld',
  attributionLinks: [{ text: '“Tilted window cat protection” on MakerWorld', url: 'https://makerworld.com/de/models/3234292-tilted-window-cat-protection' }],
  printNotes: 'Print every segment and splice bar flat as generated, in PETG, no supports; the splice bars are all alike. Push the nuts into their pockets in the plates’ backs (or melt the inserts into the spines). Join each panel’s segments by dropping each dovetail into the next segment from the spine’s side, so that the spine laps onto it, and screw a splice bar over every joint. Plug the strip’s pins into the side panels’ bosses, then stand the guard in the tilted window.',
  // ShareAlike: an adaptation of a CC BY-NC-SA 4.0 design (models/window-cat-guard/ATTRIBUTION.md)
  license: 'CC BY-NC-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  parts: windowCatGuardParts,
  assembly: windowCatGuardAssembly(DEFAULT_WINDOW_CAT_GUARD),
  assemblyForParameters: windowCatGuardAssembly,
  linkedReferences: windowCatGuardFasteners,
  parameterSchema: WindowCatGuardParametersSchema,
  controls: windowCatGuardControls,
  defaults: Object.fromEntries(windowCatGuardControls.map(c => [c.key, c.default])),
  scadMapping: {},
  scadEncode: { jointThread: thread => JSON.stringify(ISO_273_CLEARANCE_HOLES[thread as MetricThread].medium) },
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(WindowCatGuardParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return validateWindowCatGuard(parameters);
  },
  derived: () => ({ slotCount: null }),
} satisfies ModelDefinition;

/**
 * Magnetic QR code tag (models/qr-magnet-tag/generator.scad, docs/qr-magnet-tag.md): an original design of two printed parts, a
 * border with disc magnets in its back, and a centre plate carrying a QR code of `qrText` with an optional SVG logo, printed in two
 * colours with one filament change. `packages/contracts/src/qrMagnetTag.ts` encodes the code and repeats the generator's layout.
 * The centre is held in the border's seat by the chosen `joint`.
 */
export const QR_TAG_JOINT_TEXT: Record<QrTagJoint, { label: string; description: string }> = {
  'crush-ribs': { label: 'Crush ribs', description: 'Thin vertical ribs in the border’s seat, squeezed by the centre’s edge: press the centre in. Push it out through the hole in the back.' },
  detent: { label: 'Detent', description: 'Bumps on the centre’s edge click into a groove round the seat. Push it out through the hole in the back.' },
  'twist-lock': { label: 'Twist lock', description: 'A bayonet: the centre is a round disc whose three lugs drop through notches in the seat, then turn 30° under the seat’s lip until they stop, past a small click. The square tile gets a round seat.' },
  magnets: { label: 'Magnets', description: 'A second set of the chosen magnets: in pockets in the seat floor and in the centre’s back, facing each other. Mind their polarity (see the print notes).' },
};
const QR_TAG_SHAPE_TEXT: Record<QrTagShape, { label: string; description: string }> = {
  square: { label: 'Square', description: 'A square tile with rounded corners.' },
  round: { label: 'Round', description: 'A round tile, the code inscribed in its round centre.' },
};
const QR_TAG_MOUNT_TEXT: Record<QrTagMount, { label: string; description: string }> = {
  pockets: { label: 'Pockets (press or glue in)', description: 'Open pockets in the border’s back: press or glue the magnets in after printing. The magnets touch the steel, for the strongest hold.' },
  embedded: { label: 'Embedded (print pause)', description: 'Sealed cavities: the print pauses at the height shown under the settings, you drop the magnets in, and the print closes over them. No glue, nothing to fall out; a thin skin between magnet and steel holds a little less.' },
};
const QR_ECC_TEXT: Record<QrEcc, { label: string; description: string }> = {
  L: { label: 'L (7 %)', description: 'Low: the smallest code; it survives about 7 % damage. No logo.' },
  M: { label: 'M (15 %)', description: 'Medium: survives about 15 % damage. No logo.' },
  Q: { label: 'Q (25 %)', description: 'Quartile: survives about 25 % damage; a logo may cover part of it (at most 15 % of a large code, less of a small one).' },
  H: { label: 'H (30 %)', description: 'High: the largest code; it survives about 30 % damage, and a logo may cover more of it (at most 25 % of a large code).' },
};
/** The fit (clearance per side) in which each joint works as designed (advice only, as the cigarette case's `SNAP_CLEARANCE`):
 * ribs and bumps are sized on top of the fit, but need the walls to clear each other; the lugs turn freely from 0.2 mm; magnets
 * hold at any fit. */
export const QR_TAG_JOINT_FIT: Record<QrTagJoint, { minimum: number; maximum: number }> = {
  'crush-ribs': { minimum: 0.1, maximum: 0.3 },
  detent: { minimum: 0.15, maximum: 0.35 },
  'twist-lock': { minimum: 0.2, maximum: 0.4 },
  magnets: { minimum: 0.15, maximum: 0.6 },
};
export const QR_TAG_FIT_RANGE = { minimum: 0.05, maximum: 0.6, default: 0.2, step: 0.01 } as const;
const QR_TAG_FIT_BANDS = [
  { minimum: 0.05, maximum: 0.15, label: 'Very tight (press fit)' },
  ...FIT_BANDS.slice(1),
];

/** The magnets the tag offers: round (disc) magnets of the parts library no larger than these, which keep the tag flat. Per setting,
 * `magnetPocketIssues` then checks that their pockets fit the tile. */
export const QR_TAG_MAGNET_LIMIT = { diameter: 12.1, thickness: 3.1 } as const;
export function qrTagMagnetFits(part: Part): boolean {
  return part.family === 'magnet' && part.attributes['shape'] === 'disc' && Boolean(part.dimensions['diameter'])
    && dimensionOf(part, 'diameter', 'max') <= QR_TAG_MAGNET_LIMIT.diameter + 1e-9 && dimensionOf(part, 'thickness', 'max') <= QR_TAG_MAGNET_LIMIT.thickness + 1e-9;
}
/** Every magnet of the parts library that fits (`qrTagMagnetFits`), in the library's order; a test keeps the list equal to the library. */
export const QR_TAG_MAGNETS = ['supermagnete-s-04-02-n', 'supermagnete-s-05-02-n52n', 'supermagnete-s-06-02-n', 'supermagnete-s-06-03-n', 'supermagnete-s-08-02-n', 'supermagnete-s-08-03-n', 'supermagnete-s-10-02-n', 'supermagnete-s-10-03-n', 'supermagnete-s-12-02-n'] as const;
/** S-08-02-N: 8 × 2 mm, 1.1 kg of pull each. */
export const DEFAULT_QR_TAG_MAGNET = 'supermagnete-s-08-02-n';

export const DEFAULT_QR_MAGNET_TAG = {
  qrText: 'https://example.com', errorCorrection: 'H', shape: 'square', size: 60, cornerRadius: 4, borderWidth: 6, quietZone: 2,
  logo: '', logoSize: 20, baseThickness: 1.6, reliefHeight: 0.6, layerHeight: 0.2, joint: 'crush-ribs', fit: QR_TAG_FIT_RANGE.default,
  magnet: DEFAULT_QR_TAG_MAGNET, magnetCount: 4, magnetMount: 'pockets',
} as const;
const qr = DEFAULT_QR_MAGNET_TAG;

export const QrMagnetTagParametersSchema = Type.Object({
  qrText: Type.String({ title: 'QR code text', description: `What the code holds, e.g. a web address: up to ${QR_TEXT_MAX_LENGTH} characters of printable ASCII (letters, digits, spaces and punctuation, no accents). The longer it is, the smaller the modules.`, default: qr.qrText, maxLength: QR_TEXT_MAX_LENGTH, pattern: '^[ -~]*$' }),
  errorCorrection: Type.Enum(QR_ECC_LEVELS, { title: 'Error correction', description: 'How much of the code may be damaged or covered and still scan. Higher makes a larger code (smaller modules). A logo needs Q or H.', default: qr.errorCorrection }),
  shape: Type.Enum(QR_TAG_SHAPES, { title: 'Shape', description: 'The outline of the tile.', default: qr.shape }),
  size: dimension('Size', 'The tile’s outer width (square) or diameter (round), in mm.', qr.size, 30, 120, 1),
  cornerRadius: dimension('Corner radius', 'Radius of the square tile’s outer corners, in mm. The seat’s corners follow it, less the border.', qr.cornerRadius, 0, 20, 0.5),
  borderWidth: dimension('Border width', 'The visible ring between the code’s centre piece and the tile’s outer edge, in mm.', qr.borderWidth, 3, 20, 0.5),
  quietZone: Type.Integer({ title: 'Quiet zone', description: 'The light margin round the code on the centre piece, in modules. Scanners need at least one; four is the standard.', default: qr.quietZone, minimum: 1, maximum: 4 }),
  logo: Type.String({ title: 'Logo', description: 'An SVG file whose filled shapes stand in the middle of the code, raised in the dark filament on a light pad of whole modules. Strokes, text, pictures and style sheets in the file are left out. The file itself is never uploaded, only its outline.', default: qr.logo, maxLength: LOGO_MAX_LENGTH, pattern: '^[MLZ0-9 ]*$' }),
  logoSize: Type.Number({ title: 'Logo size (%)', description: 'The logo’s width as a share of the code’s width, in %. Its pad may cost the code at most 60 % of the damage its error correction can repair (and cover at most 15 % of it at Q, 25 % at H), and never the corner patterns: the editor says how large it may be.', default: qr.logoSize, minimum: 10, maximum: 40, multipleOf: 1 }),
  baseThickness: dimension('Base thickness', 'The light base of the centre piece, in mm. Change to the dark filament at its top (rounded up to a layer).', qr.baseThickness, 0.8, 3, 0.1),
  reliefHeight: dimension('Relief height', 'How high the dark modules and the logo stand on the base, in mm.', qr.reliefHeight, 0.4, 2, 0.1),
  layerHeight: dimension('Layer height', 'Your slicer’s layer height, in mm. Used to work out the filament-change height (and to check the relief has at least two dark layers), and with embedded magnets the pause height, which it puts on a layer boundary.', qr.layerHeight, 0.08, 0.32, 0.02),
  joint: Type.Enum(QR_TAG_JOINTS, { title: 'Joint', description: 'How the centre is held in the border.', default: qr.joint }),
  fit: dimension('Fit', 'Gap per side between the centre and the border’s seat, in mm. Larger is looser; raise it if your printer prints parts too tight.', qr.fit, QR_TAG_FIT_RANGE.minimum, QR_TAG_FIT_RANGE.maximum, QR_TAG_FIT_RANGE.step),
  magnet: Type.Enum(QR_TAG_MAGNETS, { title: 'Magnets', description: 'The round magnets in the back of the border (and, with the magnet joint, in the seat and the centre). Each is a real product from the parts library; its pockets are cut to its greatest size.', default: qr.magnet }),
  magnetMount: Type.Enum(QR_TAG_MOUNTS, { title: 'Magnet mounting', description: 'Open pockets that the magnets are pressed or glued into after printing, or sealed cavities that they are dropped into when the print pauses.', default: qr.magnetMount }),
  magnetCount: Type.Number({ title: 'Magnets in the back', description: 'How many magnets the back holds: two on one diagonal, or four in the corners. The magnet joint uses as many again, twice.', default: qr.magnetCount, minimum: 2, maximum: 4, multipleOf: 2 }),
}, { additionalProperties: false, description: 'Magnetic QR code tag parameters. All fields are required; dimensions are in millimetres.' });
export type QrMagnetTagParameters = Static<typeof QrMagnetTagParametersSchema>;

/** The layout's settings for these parameters: the shape and the chosen magnet's greatest size. */
export function qrTagSettings(parameters: ParameterValues): QrTagShapeSettings {
  const p = { ...DEFAULT_QR_MAGNET_TAG, ...parameters } as QrMagnetTagParameters;
  const magnet = findPart(p.magnet) ?? findPart(DEFAULT_QR_TAG_MAGNET);
  if (!magnet) throw new Error('The default magnet is missing from the parts library.');
  return {
    shape: p.shape, size: p.size, cornerRadius: p.cornerRadius, borderWidth: p.borderWidth, quietZone: p.quietZone,
    baseThickness: p.baseThickness, reliefHeight: p.reliefHeight, joint: p.joint, fit: p.fit, magnetCount: p.magnetCount,
    magnetMount: p.magnetMount, layerHeight: p.layerHeight, magnetDiameter: dimensionOf(magnet, 'diameter', 'max'), magnetThickness: dimensionOf(magnet, 'thickness', 'max'),
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function validateQrMagnetTag(p: QrMagnetTagParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  const t = QR_TAG;
  try { decodeLogo(p.logo); }
  catch (error) { return [{ field: 'logo', message: error instanceof SvgError ? error.message : 'The logo is malformed. Load the SVG file again.' }]; }
  if (p.qrText === '') issues.push({ field: 'qrText', message: 'Enter the text the QR code should hold, e.g. a web address.' });
  if (p.logo !== '' && !eccAllowsLogo(p.errorCorrection))
    issues.push({ field: 'errorCorrection', message: `With a logo, the error correction must be at least ${QR_LOGO_MIN_ECC}: the logo covers part of the code. Choose Q or H, or remove the logo.` });
  if (p.size - 2 * p.borderWidth < t.minSeat - 1e-9)
    issues.push({ field: 'borderWidth', message: `The border leaves only ${p.size - 2 * p.borderWidth} mm for the centre; at least ${t.minSeat} mm. Narrow the border or enlarge the tile.` });
  if (p.shape === 'square' && p.cornerRadius > p.size / 2 - 1 + 1e-9)
    issues.push({ field: 'cornerRadius', message: `At most ${p.size / 2 - 1} mm on a ${p.size} mm tile.` });
  if (issues.length > 0) return issues;
  const settings = qrTagSettings(p);
  const layout = qrTagLayout(settings);
  if (p.qrText !== '') {
    const code = qrTagCode(p);
    const size = code.symbol.size;
    const module = moduleSize(layout, size, p.quietZone);
    if (module < t.minModule - 1e-9)
      issues.push({ field: 'qrText', message: `The code needs ${size} × ${size} modules (version ${code.symbol.version}) plus the quiet zone, so each module would be only ${module.toFixed(2)} mm wide; at least ${t.minModule} mm print and scan reliably. Shorten the text, lower the error correction or enlarge the tile.` });
    if (p.logo !== '' && eccAllowsLogo(p.errorCorrection) && !knockoutFits(size, code.pad, p.errorCorrection)) {
      const most = maxLogoSize(size, p.errorCorrection);
      issues.push({ field: 'logoSize', message: most > 0
        ? `A ${p.logoSize} % logo needs a ${code.pad} × ${code.pad} module pad, more than this ${size} × ${size} code at ${p.errorCorrection} can lose. At most ${Math.min(most, 40)} %${p.errorCorrection === 'Q' ? ', or choose H' : ''}.`
        : `This ${size} × ${size} code has no room for a logo pad clear of its corner patterns. Lengthen the text or choose H to get a larger code, or remove the logo.` });
    }
  }
  const change = filamentChangeHeight(p.baseThickness, p.layerHeight);
  const darkLayers = Math.floor((p.baseThickness + p.reliefHeight - change) / p.layerHeight + 1e-6);
  if (darkLayers < 2)
    issues.push({ field: 'reliefHeight', message: `Above the filament change at ${change} mm only ${Math.max(darkLayers, 0)} layer${darkLayers === 1 ? '' : 's'} of the relief print${darkLayers === 1 ? 's' : ''} dark at ${p.layerHeight} mm layers; at least 2. Raise the relief to ${round2(change + 2 * p.layerHeight - p.baseThickness)} mm, or make the base a multiple of the layer height.` });
  if (p.baseThickness < 2 * p.layerHeight - 1e-9)
    issues.push({ field: 'baseThickness', message: `The base must be at least two layers (${round2(2 * p.layerHeight)} mm) thick.` });
  for (const message of magnetPocketIssues(settings, layout)) issues.push({ field: 'magnet', message });
  if (p.joint === 'detent' && p.fit + t.detentEngage > (p.baseThickness - 2 * t.detentMargin) / 2 + 1e-9)
    issues.push({ field: 'fit', message: `The detent’s bumps reach ${round2(p.fit + t.detentEngage)} mm (fit plus ${t.detentEngage} mm), too far for a ${p.baseThickness} mm base: lower the fit to ${round2((p.baseThickness - 2 * t.detentMargin) / 2 - t.detentEngage)} mm or thicken the base.` });
  if (p.joint === 'twist-lock') {
    if (layout.lip < t.lipMin - 1e-9)
      issues.push({ field: 'baseThickness', message: `The twist lock’s lip over the lugs would be only ${round2(layout.lip)} mm; at least ${t.lipMin} mm. Thicken the base or the relief, or lower the fit.` });
    if (p.size / 2 - layout.channelRadius < t.sideWall - 1e-9)
      issues.push({ field: 'borderWidth', message: `The twist lock’s lugs turn ${t.lugDepth} mm into the border, which leaves too little wall: make the border at least ${round2(t.lugDepth + p.fit + t.sideWall)} mm wide.` });
  }
  return issues;
}

/** What the editor shows under the settings: where to change filament, and the code's size. */
function qrMagnetTagNotes(p: QrMagnetTagParameters): string[] {
  const change = filamentChangeHeight(p.baseThickness, p.layerHeight);
  const notes = [`Change to the dark filament at ${change} mm, before layer ${Math.round(change / p.layerHeight) + 1} at ${p.layerHeight} mm layers: the modules and the logo print above it.`];
  const settings = qrTagSettings(p);
  const layout = qrTagLayout(settings);
  if (layout.embedded) {
    const count = layout.backPockets.length + layout.jointPockets.length;
    notes.push(`Border: pause the print at ${layout.pauseHeight} mm, before layer ${Math.round(layout.pauseHeight / p.layerHeight) + 1} at ${p.layerHeight} mm layers, and drop the ${count} magnets into their cavities${layout.jointPockets.length > 0 ? ' (the seat’s with the same pole up as you want facing the centre)' : ''}; then resume.`);
  }
  if (p.qrText === '') return notes;
  const code = qrTagCode(p);
  const module = moduleSize(layout, code.symbol.size, p.quietZone);
  notes.push(`QR version ${code.symbol.version}: ${code.symbol.size} × ${code.symbol.size} modules of ${module.toFixed(2)} mm, error correction ${p.errorCorrection}${code.pad > 0 ? `, a ${code.pad} × ${code.pad} module pad for the logo` : ''}.`);
  return notes;
}

/** The magnets: those in the back, pressed in once the tag is together, and with the magnet joint, a pair per joint pocket: one
 * in the seat floor, one in the centre's back, standing out of it into the floor's pocket (docs/qr-magnet-tag.md#magnets). */
function qrTagMagnets(parameters: ParameterValues): LinkedReference[] {
  const part = typeof parameters['magnet'] === 'string' ? findPart(parameters['magnet']) : undefined;
  if (!part) return [];
  const layout = qrTagLayout(qrTagSettings(parameters));
  return [
    // embedded magnets are sealed in during the print: they are in the border from the start, and move with nothing
    ...layout.backPockets.map(([x, y], i): LinkedReference => layout.embedded
      ? { id: `magnet-back-${i + 1}`, part: part.id, label: `embedded in the back, ${i + 1}`, pose: { position: [x, y, layout.backMagnetZ] } }
      : { id: `magnet-back-${i + 1}`, part: part.id, label: `in the back, pocket ${i + 1}`, pose: { position: [x, y, 0] }, step: { title: 'Press the magnets into the back', from: [0, 0, -12] } }),
    ...layout.jointPockets.map(([x, y], i): LinkedReference => ({ id: `magnet-seat-${i + 1}`, part: part.id, label: `${layout.embedded ? 'embedded under' : 'in'} the seat, ${layout.embedded ? '' : 'pocket '}${i + 1}`, pose: { position: [x, y, layout.seatMagnetZ] } })),
    ...layout.jointPockets.map(([x, y], i): LinkedReference => ({ id: `magnet-centre-${i + 1}`, part: part.id, label: `in the centre, pocket ${i + 1}`, pose: { position: [x, y, layout.floor - layout.protrusion] }, movesWith: 'centre' })),
  ];
}

/**
 * The tag put together: the border lies back down, the centre comes into its seat according to the joint (pressed in, clicked in,
 * dropped in and turned for the twist lock, or set onto the joint magnets), and the back magnets are pressed in last.
 */
export function qrMagnetTagAssembly(parameters: ParameterValues): Assembly {
  const settings = qrTagSettings(parameters);
  const layout = qrTagLayout(settings);
  const centre: Assembly['poses'][string] = { position: [0, 0, layout.floor] };
  const into: Record<QrTagJoint, string> = {
    'crush-ribs': 'Press the centre into the border', detent: 'Click the centre into the border',
    'twist-lock': 'Drop the centre in, its lugs through the notches', magnets: 'Set the centre onto the joint magnets',
  };
  const steps: Assembly['steps'] = [];
  if (settings.joint === 'magnets' && !layout.embedded) steps.push({ title: 'Glue the joint magnets into the seat floor', parts: layout.jointPockets.map((_, i) => `magnet-seat-${i + 1}`), from: [0, 0, 15] });
  steps.push({ title: into[settings.joint], parts: ['centre'], from: [0, 0, 25] });
  const turn = QR_TAG.lockAngle;
  const motion: Assembly['motion'] = settings.joint === 'twist-lock' ? [{
    title: `Turn the centre ${turn}° clockwise until it stops`,
    frames: Array.from({ length: turn / 2 }, (_, k) => ({ centre: { position: centre.position, rotation: [0, 0, -2 * (k + 1)] } })),
  }] : undefined;
  return { partColors: { border: '#2f6fd6', centre: '#eceff1' }, poses: { border: { position: [0, 0, 0] }, centre }, steps, lift: 20, ...(motion ? { motion } : {}) };
}

const qrMagnetTagControls = [
  textControl(QrMagnetTagParametersSchema, 'qrText', 'basic'),
  enumControl(QrMagnetTagParametersSchema, 'errorCorrection', 'basic', QR_ECC_LEVELS.map(value => ({ value, ...QR_ECC_TEXT[value] }))),
  enumControl(QrMagnetTagParametersSchema, 'shape', 'basic', QR_TAG_SHAPES.map(value => ({ value, ...QR_TAG_SHAPE_TEXT[value] }))),
  control(QrMagnetTagParametersSchema, 'size', 'basic'),
  { ...control(QrMagnetTagParametersSchema, 'cornerRadius', 'basic'), visibleWhen: { control: 'shape', values: ['square'] } },
  control(QrMagnetTagParametersSchema, 'borderWidth', 'basic'),
  svgControl(QrMagnetTagParametersSchema, 'logo', 'basic'),
  control(QrMagnetTagParametersSchema, 'logoSize', 'basic', null, null),
  enumControl(QrMagnetTagParametersSchema, 'joint', 'basic', QR_TAG_JOINTS.map(value => ({ value, ...QR_TAG_JOINT_TEXT[value] }))),
  partControl(QrMagnetTagParametersSchema, 'magnet', 'basic', 'magnet', QR_TAG_MAGNETS),
  control(QrMagnetTagParametersSchema, 'magnetCount', 'basic', null, null),
  enumControl(QrMagnetTagParametersSchema, 'magnetMount', 'basic', QR_TAG_MOUNTS.map(value => ({ value, ...QR_TAG_MOUNT_TEXT[value] }))),
  control(QrMagnetTagParametersSchema, 'quietZone', 'advanced', null, null),
  control(QrMagnetTagParametersSchema, 'baseThickness', 'advanced'),
  control(QrMagnetTagParametersSchema, 'reliefHeight', 'advanced'),
  control(QrMagnetTagParametersSchema, 'layerHeight', 'advanced'),
  { ...control(QrMagnetTagParametersSchema, 'fit', 'advanced'), bands: QR_TAG_FIT_BANDS,
    recommended: [{ control: 'joint', ranges: QR_TAG_JOINTS.map(value => ({ value, ...QR_TAG_JOINT_FIT[value] })) }] },
];

const QR_TAG_SOURCE = 'models/qr-magnet-tag/generator.scad';
const QR_TAG_SHARED = { shape: 'SHAPE', size: 'SIZE', cornerRadius: 'CORNER_RADIUS', borderWidth: 'BORDER_WIDTH', baseThickness: 'BASE', reliefHeight: 'RELIEF', joint: 'JOINT', fit: 'FIT', magnetCount: 'MAGNET_COUNT', magnetMount: 'MOUNT', layerHeight: 'LAYER' };
const QR_TAG_MAGNET_DEFINES: PartDefines = { magnet: { MAGNET_D: ['diameter', 'max'], MAGNET_T: ['thickness', 'max'] } };
const qrMagnetTagParts: ModelPart[] = [
  // with embedded magnets, the border encloses their sealed cavities
  { id: 'border', title: 'Border', sourcePath: QR_TAG_SOURCE, scadConstants: { PART: 'border' }, scadMapping: QR_TAG_SHARED, partDefines: QR_TAG_MAGNET_DEFINES, sealedVoids: true },
  { id: 'centre', title: 'Centre with the QR code', sourcePath: QR_TAG_SOURCE, scadConstants: { PART: 'centre' },
    scadMapping: { ...QR_TAG_SHARED, qrText: 'QR', quietZone: 'QUIET_ZONE', logo: 'LOGO', logoSize: 'LOGO_SIZE' }, partDefines: QR_TAG_MAGNET_DEFINES },
];

export const qrMagnetTag = {
  id: 'qr-magnet-tag' as const, version: '1' as const, title: 'Magnetic QR code tag',
  description: 'A flat tag for the fridge or a whiteboard: a border with magnets in its back, and a centre piece with a QR code of your text and, if you like, your SVG logo, printed in two colours with a single filament change. Choose a square or round tile, its size, and how the centre is held in the border: crush ribs, a detent, a twist lock or magnets.',
  attribution: 'CanFactory (original design)',
  printNotes: 'Border: back down, no supports; press or glue the magnets into its back, or with embedded magnets pause at the height shown under the settings and drop them in. Centre: base down in the light filament; change to the dark filament at the height shown under the settings (the base’s top, rounded up to a layer). With the magnet joint, set each centre magnet onto its seat magnet first, so that they attract.',
  license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  parts: qrMagnetTagParts,
  assembly: qrMagnetTagAssembly(DEFAULT_QR_MAGNET_TAG),
  assemblyForParameters: qrMagnetTagAssembly,
  linkedReferences: qrTagMagnets,
  parameterSchema: QrMagnetTagParametersSchema,
  controls: qrMagnetTagControls,
  defaults: Object.fromEntries(qrMagnetTagControls.map(c => [c.key, c.default])),
  scadMapping: {},
  // Only numbers reach OpenSCAD: the code as rectangles of modules, encoded again from the validated text, and the logo's outline.
  scadEncode: {
    qrText: (text: string, parameters: ParameterValues) => qrScad({ qrText: text, errorCorrection: parameters['errorCorrection'] as QrEcc, logo: String(parameters['logo'] ?? ''), logoSize: Number(parameters['logoSize']) }),
    logo: logoScad,
  },
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(QrMagnetTagParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return validateQrMagnetTag(parameters);
  },
  derived(parameters: unknown) {
    return { slotCount: null, ...(Value.Check(QrMagnetTagParametersSchema, parameters) && validateQrMagnetTag(parameters).length === 0 ? { notes: qrMagnetTagNotes(parameters) } : {}) };
  },
} satisfies ModelDefinition;

/**
 * The printed hardware's wood screws (printed corner bracket, printed screen hook): a diameter, which filters the screw list, the
 * screw, whose clearance holes go to the SCAD file as a vector (`scadEncode`) and whose head sizes its countersink (`partDefines`),
 * and the hole fit.
 */
const WOOD_DIAMETER_TEXT = (value: string) => ({ value, label: value, description: `DIN 7997 countersunk wood screws, ${value} in diameter.` });
const printedScrewControls = (schema: TObject) => [
  { ...enumControl(schema, 'woodScrewDiameter', 'basic', PRINTED_WOOD_DIAMETERS.map(WOOD_DIAMETER_TEXT)), part: { family: 'wood-screw', attribute: 'diameter', filter: null } },
  { ...partControl(schema, 'woodScrew', 'basic', 'wood-screw', PRINTED_WOOD_SCREWS), part: { family: 'wood-screw', attribute: null, filter: { control: 'woodScrewDiameter', attribute: 'diameter' } } },
];
const PRINTED_SCREW_DEFINES: PartDefines = { woodScrew: { WOOD_D: ['d', 'value'], WOOD_DK: ['dk', 'max'], WOOD_K: ['k', 'max'] } };
const clearanceHolesScad = (id: string) => {
  const part = findPart(id);
  if (!part) throw new Error(`${id} is not a part of the library.`);
  return JSON.stringify(clearanceHoles(part));
};
const libraryScrew = (id: unknown): Part => {
  const part = typeof id === 'string' ? findPart(id) : undefined;
  if (!part) throw new Error(`${String(id)} is not a part of the library.`);
  return part;
};
/** A screw of the printed hardware driven into its countersunk hole: the screw's own frame (tip on z = 0, head up) turned by `rotation`. */
const drivenScrew = (id: string, screw: Part, label: string, position: [number, number, number], rotation: [number, number, number], from: [number, number, number]): LinkedReference =>
  ({ id, part: screw.id, label, pose: { position, rotation }, step: { title: 'Drive the screws in', from } });

/**
 * Printed corner bracket: an original design (models/printed-corner-bracket/generator.scad, docs/printed-corner-bracket.md), a flat
 * L-shaped plate screwed across a frame's corner in place of a bought flat corner bracket (Stuhlwinkel). Its defaults follow the
 * window catio insert's 40 mm collar member (`printedCornerBracketFor`), whose corners it holds by default.
 */
const PCB = PRINTED_CORNER_BRACKET_DEFAULT;
export const PrintedCornerBracketParametersSchema = Type.Object({
  legA: dimension('Leg A', 'Length of one leg, over the outer corner, in mm: the one along the rail.', PCB.legA, 40, 250, 1),
  legB: dimension('Leg B', 'Length of the other leg, over the outer corner, in mm: the one along the stile.', PCB.legB, 40, 250, 1),
  width: dimension('Width', 'Width of both legs in mm. On a 40 mm member, 20 mm keeps to its outer half.', PCB.width, 10, 40, 0.5),
  thickness: dimension('Thickness', 'Plate thickness in mm: also how deep it is let into the timber to lie flush.', PCB.thickness, 3, 10, 0.5),
  holesPerLeg: Type.Integer({ title: 'Holes per leg', description: 'Screw holes along each leg’s middle line.', default: PCB.holesPerLeg, minimum: 1, maximum: 5 }),
  holeSpacing: dimension('Hole spacing', 'Distance between neighbouring holes on a leg, in mm.', PCB.holeSpacing, 8, 80, 0.5),
  firstHole: dimension('First hole', 'Distance from the outer corner, along each leg, to its first hole, in mm. Past the member the other leg lies on, every screw holds the member its leg runs along.', PCB.firstHole, 10, 240, 0.5),
  woodScrewDiameter: Type.Enum(PRINTED_WOOD_DIAMETERS, { title: 'Wood screw diameter', description: 'The wood screws’ diameter; the screws below are those of this diameter.', default: PRINTED_CORNER_BRACKET_SCREW.diameter }),
  woodScrew: Type.Enum(PRINTED_WOOD_SCREWS, { title: 'Wood screw', description: 'The countersunk wood screw the holes and countersinks are sized for. Its length does not change the bracket; choose one that bites far enough into the timber.', default: PRINTED_CORNER_BRACKET_SCREW.screw }),
  holeFit: Type.Enum(HOLE_FIT_VALUES, { title: 'Hole fit', description: 'How much play the screws have in their holes: 0.3 / 0.5 / 0.8 mm over the screw’s diameter, DIN EN 20273’s allowances for M4 and M5.', default: 'medium' }),
}, { additionalProperties: false, description: 'Printed corner bracket parameters. All fields are required; dimensions are in millimetres; the screw is a parts-library id.' });
export type PrintedCornerBracketParameters = Static<typeof PrintedCornerBracketParametersSchema>;

const printedCornerBracketControls = [
  control(PrintedCornerBracketParametersSchema, 'legA', 'basic'),
  control(PrintedCornerBracketParametersSchema, 'legB', 'basic'),
  control(PrintedCornerBracketParametersSchema, 'width', 'basic'),
  control(PrintedCornerBracketParametersSchema, 'thickness', 'basic'),
  control(PrintedCornerBracketParametersSchema, 'holesPerLeg', 'basic', null, null),
  control(PrintedCornerBracketParametersSchema, 'holeSpacing', 'basic'),
  control(PrintedCornerBracketParametersSchema, 'firstHole', 'basic'),
  ...printedScrewControls(PrintedCornerBracketParametersSchema),
  enumControl(PrintedCornerBracketParametersSchema, 'holeFit', 'advanced', HOLE_FIT_VALUES.map(value => ({ value, ...HOLE_FIT_TEXT[value] }))),
];

/** The bracket lowered onto the corner, then its screws driven in from above, flush in their countersinks. */
function printedCornerBracketScrews(parameters: ParameterValues): LinkedReference[] {
  const p = { ...printedCornerBracket.defaults, ...parameters } as PrintedCornerBracketParameters;
  const screw = libraryScrew(p.woodScrew); const l = dimensionOf(screw, 'l');
  return printedCornerBracketHoles(p).map((hole, i) => drivenScrew(`screw-${i + 1}`, screw, `leg ${hole.leg.toUpperCase()}`,
    hole.leg === 'a' ? [hole.along, hole.across, p.thickness - l] : [hole.across, hole.along, p.thickness - l], [0, 0, 0], [0, 0, l + 10]));
}

export const printedCornerBracket = {
  id: 'printed-corner-bracket' as const, version: '1' as const, title: 'Printed corner bracket',
  description: 'A flat L-shaped plate screwed across the corner of a timber frame, one leg on each member, to keep the corner square and closed: a printed flat corner bracket. Set the legs, width and thickness, how many holes and where, and choose the countersunk wood screw from the parts library: the holes are its clearance holes, countersunk so its head sits flush. The defaults suit the window catio insert’s 40 mm collar.',
  attribution: 'CanFactory (original design)',
  printNotes: 'Print in PETG as generated, back down; no supports. 100 % infill or at least five walls round the holes.',
  license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  parts: [{ id: 'bracket', title: 'Bracket', sourcePath: 'models/printed-corner-bracket/generator.scad',
    scadMapping: { legA: 'LEG_A', legB: 'LEG_B', width: 'WIDTH', thickness: 'THICKNESS', holesPerLeg: 'HOLES_PER_LEG', holeSpacing: 'HOLE_SPACING', firstHole: 'FIRST_HOLE', holeFit: 'HOLE_FIT', woodScrew: 'WOOD_HOLES' },
    partDefines: PRINTED_SCREW_DEFINES }],
  assembly: { partColors: { bracket: '#5f7350' }, poses: { bracket: { position: [0, 0, 0] } }, steps: [{ title: 'Lay the bracket across the corner', parts: ['bracket'], from: [0, 0, 20] }], lift: 10 },
  linkedReferences: printedCornerBracketScrews,
  parameterSchema: PrintedCornerBracketParametersSchema,
  controls: printedCornerBracketControls,
  defaults: Object.fromEntries(printedCornerBracketControls.map(c => [c.key, c.default])),
  scadMapping: {},
  scadEncode: { woodScrew: clearanceHolesScad },
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(PrintedCornerBracketParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return printedCornerBracketIssues(parameters, libraryScrew(parameters.woodScrew));
  },
  derived(parameters: unknown) {
    if (!Value.Check(PrintedCornerBracketParametersSchema, parameters)) return { slotCount: null };
    const screw = libraryScrew(parameters.woodScrew);
    return { slotCount: null, notes: [`${2 * parameters.holesPerLeg} screws, ${screw.designation}: each bites ${printedCornerBracketBite(parameters, screw)} mm into the timber through the plate.`, `Let it in ${parameters.thickness} mm to lie flush with the timber’s face.`] };
  },
} satisfies ModelDefinition;

/**
 * Printed screen hook: an original design (models/printed-screen-hook/generator.scad, docs/printed-screen-hook.md), the long (head) and
 * the short (sill) hook that hang a screen frame on a tilt-and-turn window's fixed frame, made for one window's lip and seal gap.
 */
const PSH = PRINTED_SCREEN_HOOK_DEFAULT;
export const PrintedScreenHookParametersSchema = Type.Object({
  frameLip: dimension('Frame lip thickness', 'Open the window and measure the fixed frame’s outermost leg, from its outer face to the seal on its back, in mm. The barb reaches behind it.', 15.5, 5, 35, 0.5),
  sealGap: dimension('Seal gap', 'From the lip’s back to the closed sash’s face, where the outer seal is, in mm. The barb lies in it, centred, so the sash still closes.', 3.5, 1, 10, 0.5),
  engage: dimension('Reach behind the lip', 'How far both barbs reach behind the lip once the frame hangs, in mm. The long barb is made longer by what the frame is lifted to hang it.', PSH.engage, 3, 15, 0.5),
  width: dimension('Width', 'Width of the strip in mm.', PSH.width, 8, 20, 0.5),
  legLength: dimension('Leg length', 'From the turn’s outer face to the end of the screwed leg, in mm.', PSH.legLength, 25, 80, 1),
  legThickness: dimension('Leg thickness', 'Of the screwed leg, in mm: it takes the countersunk heads.', PSH.legThickness, 2.5, 8, 0.5),
  turnThickness: dimension('Turn thickness', 'Of the turn into the window, in mm.', PSH.turnThickness, 2.5, 8, 0.5),
  barbThickness: dimension('Barb thickness', 'Of the barb in the seal gap, in mm: at most the gap less 0.5 mm each side.', PSH.barbThickness, PRINTED_BARB_MIN, 4, 0.1),
  clearance: dimension('Clearance', 'How far the short hooks’ turns stand off the sill lip’s tip once the frame stands on its feet, in mm, and the long ones’ off the head lip while it is lifted.', PSH.clearance, 0.5, 3, 0.5),
  woodScrewDiameter: Type.Enum(PRINTED_WOOD_DIAMETERS, { title: 'Wood screw diameter', description: 'The wood screws’ diameter; the screws below are those of this diameter.', default: PRINTED_SCREEN_HOOK_SCREW.diameter }),
  woodScrew: Type.Enum(PRINTED_WOOD_SCREWS, { title: 'Wood screw', description: 'The countersunk wood screw the leg’s two holes are sized for. Its length does not change the hook.', default: PRINTED_SCREEN_HOOK_SCREW.screw }),
  holeFit: Type.Enum(HOLE_FIT_VALUES, { title: 'Hole fit', description: 'How much play the screws have in their holes: 0.3 / 0.5 / 0.8 mm over the screw’s diameter, DIN EN 20273’s allowances for M4 and M5.', default: 'medium' }),
}, { additionalProperties: false, description: 'Printed screen hook parameters. All fields are required; dimensions are in millimetres; the screw is a parts-library id.' });
export type PrintedScreenHookParameters = Static<typeof PrintedScreenHookParametersSchema>;

const printedScreenHookControls = [
  control(PrintedScreenHookParametersSchema, 'frameLip', 'basic'),
  control(PrintedScreenHookParametersSchema, 'sealGap', 'basic'),
  control(PrintedScreenHookParametersSchema, 'engage', 'basic'),
  control(PrintedScreenHookParametersSchema, 'width', 'basic'),
  ...printedScrewControls(PrintedScreenHookParametersSchema),
  control(PrintedScreenHookParametersSchema, 'legLength', 'advanced'),
  control(PrintedScreenHookParametersSchema, 'legThickness', 'advanced'),
  control(PrintedScreenHookParametersSchema, 'turnThickness', 'advanced'),
  control(PrintedScreenHookParametersSchema, 'barbThickness', 'advanced'),
  control(PrintedScreenHookParametersSchema, 'clearance', 'advanced'),
  enumControl(PrintedScreenHookParametersSchema, 'holeFit', 'advanced', HOLE_FIT_VALUES.map(value => ({ value, ...HOLE_FIT_TEXT[value] }))),
];

/**
 * The two hooks as they sit on a stile, seen from the side: the section stood up (Y up), the long one at the head with its barb up,
 * the short one at the sill turned over, barb down, both `width` across along -Y. `PRINTED_HOOK_SPAN` apart, turn to turn.
 */
const PRINTED_HOOK_SPAN = 110;
const hookPose = (part: 'long' | 'short', p: PrintedScreenHookParameters) => part === 'long'
  ? { position: [0, 0, PRINTED_HOOK_SPAN + p.engage + p.clearance] as [number, number, number], rotation: [90, 0, 0] as [number, number, number] }
  : { position: [0, -p.width, p.engage + p.clearance] as [number, number, number], rotation: [-90, 0, 0] as [number, number, number] };
export function printedScreenHookAssembly(parameters: ParameterValues): Assembly {
  const p = { ...printedScreenHook.defaults, ...parameters } as PrintedScreenHookParameters;
  return {
    partColors: { long: '#5f7350', short: '#d98460' },
    poses: { long: hookPose('long', p), short: hookPose('short', p) },
    steps: [
      { title: 'Lay the long hook on the stile’s back, at the head, barb up', parts: ['long'], from: [30, 0, 0] },
      { title: 'Lay the short hook on the stile’s back, at the sill, barb down', parts: ['short'], from: [30, 0, 0] },
    ],
    lift: 10,
  };
}
/** Two screws through each hook's leg, from the room side (+X) into the stile. */
function printedScreenHookScrews(parameters: ParameterValues): LinkedReference[] {
  const p = { ...printedScreenHook.defaults, ...parameters } as PrintedScreenHookParameters;
  const screw = libraryScrew(p.woodScrew); const l = dimensionOf(screw, 'l');
  const { holes } = printedScreenHookShape(p, screw);
  return (['long', 'short'] as const).flatMap(part => {
    const pose = hookPose(part, p); const [x, y, z] = pose.position; const up = part === 'long' ? 1 : -1;
    return holes.map((v, i) => drivenScrew(`${part}-screw-${i + 1}`, screw, `${part} hook`, [x + p.legThickness - l, y + (part === 'long' ? -p.width / 2 : p.width / 2), z + up * v], [0, 90, 0], [l + 10, 0, 0]));
  });
}

export const printedScreenHook = {
  id: 'printed-screen-hook' as const, version: '1' as const, title: 'Printed screen hook',
  description: 'Hooks that hang a screen frame on a tilt-and-turn window without drilling, as insect screens hang: a leg screwed to the frame’s back, a turn into the window and a barb that reaches behind the fixed frame’s lip, in the seal gap, so the sash still closes. Enter your window’s lip thickness and seal gap and the barb stands where they put it: nothing to bend. A long hook for the head and a short one for the sill, as a ZIP; choose the wood screws from the parts library.',
  attribution: 'CanFactory (original design)',
  printNotes: 'Print in PETG as generated, lying on its side; no supports. Print two of each: two long hooks for the head, two short ones for the sill.',
  license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  parts: (['long', 'short'] as const).map((part): ModelPart => ({
    id: part, title: part === 'long' ? 'Long hook (head)' : 'Short hook (sill)', sourcePath: 'models/printed-screen-hook/generator.scad', scadConstants: { PART: part },
    scadMapping: { frameLip: 'FRAME_LIP', sealGap: 'SEAL_GAP', engage: 'ENGAGE', clearance: 'CLEARANCE', width: 'WIDTH', legLength: 'LEG_LENGTH', legThickness: 'LEG_THICKNESS', turnThickness: 'TURN_THICKNESS', barbThickness: 'BARB_THICKNESS', holeFit: 'HOLE_FIT', woodScrew: 'WOOD_HOLES' },
    partDefines: PRINTED_SCREW_DEFINES,
  })),
  get assembly() { return printedScreenHookAssembly(this.defaults); },
  assemblyForParameters: printedScreenHookAssembly,
  linkedReferences: printedScreenHookScrews,
  parameterSchema: PrintedScreenHookParametersSchema,
  controls: printedScreenHookControls,
  defaults: Object.fromEntries(printedScreenHookControls.map(c => [c.key, c.default])),
  scadMapping: {},
  scadEncode: { woodScrew: clearanceHolesScad },
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(PrintedScreenHookParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return printedScreenHookIssues(parameters, libraryScrew(parameters.woodScrew));
  },
  derived(parameters: unknown) {
    if (!Value.Check(PrintedScreenHookParametersSchema, parameters)) return { slotCount: null };
    const shape = printedScreenHookShape(parameters, libraryScrew(parameters.woodScrew));
    const mm = (value: number) => `${Math.round(value * 10) / 10} mm`;
    return { slotCount: null, notes: [
      `Barbs ${mm(shape.rise.long)} (long) and ${mm(shape.rise.short)} (short) past the turn, ${mm(shape.front)} from the leg’s face: ${mm((parameters.sealGap - parameters.barbThickness) / 2)} clear of the lip’s back and of the sash.`,
      `Screw the long hooks with their turns ${mm(shape.headClear)} below the head lip’s tip, the short ones ${mm(parameters.clearance)} above the sill lip’s tip; lift the frame ${mm(shape.lift)} to hang it.`,
    ] };
  },
} satisfies ModelDefinition;

/**
 * Spring ball detent: an original design (models/spring-ball-detent/generator.scad, docs/spring-ball-detent.md), a printed, threaded
 * spring plunger with a bought steel ball and spring, as Ganter's GN 615: the body, and its press cap unless a set screw closes it.
 */
const SBD = SPRING_BALL_DETENT_DEFAULT;
const RETENTION_TEXT: Record<DetentRetention, { label: string; description: string }> = {
  'press-cap': { label: 'Press cap', description: 'A printed cap with crush ribs, pushed into the back up to the tool feature’s floor: no tools, and the preload is set by the design.' },
  'set-screw': { label: 'Set screw', description: 'A bought ISO 4026 set screw in a hole you tap in the back: turn it in or out to set the preload.' },
};
const TOOL_FEATURE_TEXT: Record<DetentToolFeature, { label: string; description: string }> = {
  slot: { label: 'Slot', description: 'A screwdriver slot across the back face, as GN 615.' },
  hex: { label: 'Hex socket', description: 'A socket for a hex key in the back, as GN 615.3; it must be wider than what goes in through it, so it needs more wall.' },
};
export const SpringBallDetentParametersSchema = Type.Object({
  thread: Type.Enum(DETENT_THREADS, { title: 'Thread', description: 'The body’s metric thread (ISO 261 coarse pitch), printed on the outside: it screws into a tapped hole of that size.', default: SBD.thread }),
  ball: Type.Enum(DETENT_BALLS, { title: 'Ball', description: 'The steel ball from the parts library. Its bore is its largest diameter plus the clearance.', default: SBD.ball }),
  spring: Type.Enum(DETENT_SPRINGS, { title: 'Spring', description: 'The compression spring from the parts library: it must fit the ball’s bore, and its inner diameter must be small enough for the ball to sit on it.', default: SBD.spring }),
  protrusion: dimension('Protrusion', 'How far the ball stands out of the nose, in mm. The nose’s lip must still reach over the ball, so a larger ball can stand out further.', SBD.protrusion, 0.2, 3, 0.05),
  travel: dimension('Travel', 'How far the ball can be pushed in, in mm: at least the protrusion, so that it goes in flush, and no further than the spring allows before it goes solid.', SBD.travel, 0.2, 6, 0.05),
  retention: Type.Enum(DETENT_RETENTIONS, { title: 'Retention', description: 'What closes the back once the ball and the spring are in.', default: SBD.retention }),
  setScrew: Type.Enum(DETENT_SET_SCREWS, { title: 'Set screw', description: 'The flat-point set screw that closes the back and sets the preload. The ball and spring go in through its tap hole.', default: SBD.setScrew }),
  bodyLength: dimension('Body length', 'From the back face to the nose, in mm, without the ball.', SBD.bodyLength, 8, 40, 0.5),
  toolFeature: Type.Enum(DETENT_TOOL_FEATURES, { title: 'Tool feature', description: 'What turns the body: a slot or a hex socket in its back.', default: SBD.toolFeature }),
  clearance: dimension('Clearance', 'Play of the ball in its bore, over its largest diameter, in mm.', SBD.clearance, 0.1, 0.6, 0.05),
  threadPlay: dimension('Thread play', 'How much smaller than the nominal the printed thread’s major diameter is, in mm, so that it turns in a tapped hole.', SBD.threadPlay, 0, 0.6, 0.05),
  capInterference: dimension('Cap interference', 'How far the press cap’s crush ribs stand out over the bore, across its diameter, in mm.', SBD.capInterference, 0, 0.5, 0.05),
}, { additionalProperties: false, description: 'Spring ball detent parameters. All fields are required; dimensions are in millimetres; the ball, spring and set screw are parts-library ids.' });
export type SpringBallDetentParameters = Static<typeof SpringBallDetentParametersSchema>;

const springBallDetentControls = [
  enumControl(SpringBallDetentParametersSchema, 'thread', 'basic', DETENT_THREADS.map(value => ({ value, label: value, description: `An ${value} × ${DETENT_THREAD_PITCH[value]} thread.` }))),
  partControl(SpringBallDetentParametersSchema, 'ball', 'basic', 'ball', DETENT_BALLS),
  partControl(SpringBallDetentParametersSchema, 'spring', 'basic', 'spring', DETENT_SPRINGS),
  control(SpringBallDetentParametersSchema, 'protrusion', 'basic'),
  control(SpringBallDetentParametersSchema, 'travel', 'basic'),
  enumControl(SpringBallDetentParametersSchema, 'retention', 'basic', DETENT_RETENTIONS.map(value => ({ value, ...RETENTION_TEXT[value] }))),
  { ...partControl(SpringBallDetentParametersSchema, 'setScrew', 'basic', 'set-screw', DETENT_SET_SCREWS), visibleWhen: { control: 'retention', values: ['set-screw'] } },
  control(SpringBallDetentParametersSchema, 'bodyLength', 'basic'),
  enumControl(SpringBallDetentParametersSchema, 'toolFeature', 'basic', DETENT_TOOL_FEATURES.map(value => ({ value, ...TOOL_FEATURE_TEXT[value] }))),
  control(SpringBallDetentParametersSchema, 'clearance', 'advanced'),
  control(SpringBallDetentParametersSchema, 'threadPlay', 'advanced'),
  { ...control(SpringBallDetentParametersSchema, 'capInterference', 'advanced'), visibleWhen: { control: 'retention', values: ['press-cap'] } },
];

const detentParts = (p: SpringBallDetentParameters): DetentParts => ({ ball: libraryScrew(p.ball), spring: libraryScrew(p.spring), setScrew: libraryScrew(p.setScrew) });
const SBD_MAPPING = { thread: 'THREAD', protrusion: 'PROTRUSION', travel: 'TRAVEL', retention: 'RETENTION', bodyLength: 'BODY_LENGTH', toolFeature: 'TOOL_FEATURE', clearance: 'CLEARANCE', threadPlay: 'THREAD_PLAY', capInterference: 'CAP_INTERFERENCE' };
const SBD_DEFINES: PartDefines = {
  ball: { BALL_D: ['d', 'value'], BALL_MAX: ['d', 'max'], BALL_MIN: ['d', 'min'] },
  spring: { SPRING_WIRE: ['d', 'value'], SPRING_DE: ['De', 'value'], SPRING_FREE: ['L0', 'value'], SPRING_LEAST: ['Ln', 'value'] },
  setScrew: { SET_D: ['d', 'value'], SET_PITCH: ['pitch', 'value'], SET_L: ['l', 'value'] },
};

/**
 * The detent assembled standing nose up, as it is printed: the ball goes up into the bore from the back, then the press cap or the
 * set screw. The spring between them is shown beside the body at its free length (`springBallDetentReferences`), since inside it is
 * compressed. The exploded layout stacks them below the body: the ball, then the cap or the set screw.
 */
export function springBallDetentAssembly(parameters: ParameterValues): Assembly {
  const p = { ...springBallDetent.defaults, ...parameters } as SpringBallDetentParameters;
  const parts = detentParts(p);
  const layout = springBallDetentLayout(p, parts);
  const ballMax = dimensionOf(parts.ball, 'd', 'max');
  const below = 3; const ballTop = layout.centre + ballMax / 2;
  const closer = p.retention === 'press-cap' ? layout.cap.length : dimensionOf(parts.setScrew, 'l');
  const closerTop = p.retention === 'press-cap' ? layout.tool.depth + layout.cap.length : layout.seat;
  const closerDrop = closerTop + below + ballMax + below;
  return {
    partColors: { body: '#5f7350', cap: '#d98460' },
    poses: p.retention === 'press-cap' ? { body: { position: [0, 0, 0] }, cap: { position: [0, 0, layout.tool.depth] } } : { body: { position: [0, 0, 0] } },
    steps: [
      { title: 'Drop the ball into the back, then the spring', parts: ['ball'], from: [0, 0, -(ballTop + below)] },
      p.retention === 'press-cap'
        ? { title: `Press the cap in, flush with the ${layout.tool.kind === 'slot' ? 'slot' : 'socket'}’s floor`, parts: ['cap'], from: [0, 0, -closerDrop] }
        : { title: 'Turn the set screw in to set the preload', parts: ['set-screw'], from: [0, 0, -closerDrop] },
    ],
    lift: Math.ceil(closerDrop - closerTop + closer + 2),
  };
}
/** The ball on the lip, the spring standing beside the body at its free length (inside, it is compressed), and the set screw at its
 * nominal preload, point up. Each is a line of the model's hardware list. */
function springBallDetentReferences(parameters: ParameterValues): LinkedReference[] {
  const p = { ...springBallDetent.defaults, ...parameters } as SpringBallDetentParameters;
  const parts = detentParts(p);
  const layout = springBallDetentLayout(p, parts);
  const references: LinkedReference[] = [
    { id: 'ball', part: parts.ball.id, label: 'on the lip', pose: { position: [0, 0, layout.centre - dimensionOf(parts.ball, 'd', 'max') / 2] } },
    { id: 'spring', part: parts.spring.id, label: 'beside it, at its free length', pose: { position: [layout.thread.major / 2 + dimensionOf(parts.spring, 'De', 'max') / 2 + 4, 0, 0] } },
  ];
  if (p.retention === 'set-screw') references.push({ id: 'set-screw', part: parts.setScrew.id, label: 'closing the back', pose: { position: [0, 0, layout.seat], rotation: [180, 0, 0] } });
  return references;
}

export const springBallDetent = {
  id: 'spring-ball-detent' as const, version: '1' as const, title: 'Spring ball detent',
  description: 'A printed spring plunger: a threaded body that holds a steel ball part-way out of its nose on a spring, for indexing, positioning and click-in retention, as Ganter’s GN 615. Choose the thread, the ball and the spring from the parts library, how far the ball stands out and how far it gives, and a press cap or a set screw (adjustable preload) to close the back; the body is sized round them, and the settings are checked so that the spring never goes solid.',
  attribution: 'CanFactory (original design)',
  printNotes: 'Print the body in PETG standing on its back face, nose up, and the cap standing; no supports. 0.2 mm layers or finer for the thread; 100 % infill.',
  license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  parts: (['body', 'cap'] as const).map((part): ModelPart => ({
    id: part, title: part === 'body' ? 'Body' : 'Press cap', sourcePath: 'models/spring-ball-detent/generator.scad', scadConstants: { PART: part },
    scadMapping: SBD_MAPPING, partDefines: SBD_DEFINES,
    ...(part === 'cap' ? { includedWhen: (parameters: ParameterValues) => parameters['retention'] === 'press-cap' } : {}),
  })),
  get assembly() { return springBallDetentAssembly(this.defaults); },
  assemblyForParameters: springBallDetentAssembly,
  linkedReferences: springBallDetentReferences,
  parameterSchema: SpringBallDetentParametersSchema,
  controls: springBallDetentControls,
  defaults: Object.fromEntries(springBallDetentControls.map(c => [c.key, c.default])),
  scadMapping: {},
  validate(parameters: unknown): ParameterIssue[] {
    if (!Value.Check(SpringBallDetentParametersSchema, parameters)) return [{ field: '', message: 'Parameters do not match the model schema.' }];
    return springBallDetentIssues(parameters, detentParts(parameters));
  },
  derived(parameters: unknown) {
    if (!Value.Check(SpringBallDetentParametersSchema, parameters)) return { slotCount: null };
    const parts = detentParts(parameters);
    const layout = springBallDetentLayout(parameters, parts);
    const mm = (value: number) => `${Math.round(value * 10) / 10} mm`;
    const n = (value: number) => `${Math.round(value * 10) / 10} N`;
    const { tool } = layout;
    const feature = tool.kind === 'slot' ? `a ${mm(tool.width)} slot, ${mm(tool.depth)} deep` : `a hex socket for a ${tool.key} mm key, ${mm(tool.depth)} deep`;
    const forces = (installed: number) => `${n(layout.rate * (layout.free - installed))} with the ball out, ${n(layout.rate * (layout.free - installed + parameters.travel))} pushed in`;
    return { slotCount: null, notes: [
      `Printed ${parameters.thread} thread, ${mm(layout.thread.major)} over its crests, with ${feature} in the back; the ball sits in a ${mm(layout.bore)} bore.`,
      parameters.retention === 'press-cap'
        ? `The spring pushes ${forces(layout.installed)}. Press the ${mm(layout.cap.length)} cap in until it is flush with the ${tool.kind === 'slot' ? 'slot' : 'socket'}’s floor, ${mm(tool.depth)} in.`
        : `Tap the back ${parameters.setScrew.replace('iso-4026-', '').split('x')[0]?.toUpperCase()} (${mm(layout.screw.tap)} hole, ${mm(layout.screw.tapTop)} deep). With the set screw’s point ${mm(layout.seat)} in from the back, the spring pushes ${forces(layout.installed)}; from ${mm(layout.screw.seatLeast)} to ${mm(layout.screw.seatMost)} in, ${n(layout.rate * layout.preload)} to ${n(layout.rate * (layout.free - layout.shortest))} with the ball out.`,
    ] };
  },
} satisfies ModelDefinition;

export const models: readonly ModelDefinition[] = [fruitFlyTrap, mossPlanter, cigaretteCase, plankConnector, litterShovel, aiRubberDuck, toggleLatch, pressurePad, windowCatGuard, qrMagnetTag, printedCornerBracket, printedScreenHook, springBallDetent];

export function findModel(id: string): ModelDefinition | undefined { return models.find(model => model.id === id); }

/**
 * A model or concept page that links to a part: a model through an option of a part-linked control or as a reference object
 * of its assembly; a concept page (`kind: 'concept'`, `modelId` is its page, e.g. `catio/window-insert`) through its parts list.
 */
export interface PartUsage { modelId: string; modelTitle: string; via: string; kind: 'model' | 'concept' }

/** Every model and concept page that links to this part (the parts library's “Used by”). */
export function partUsage(part: Part): PartUsage[] {
  return [
    ...models.flatMap(model => [
      ...model.controls.filter(control => control.part?.family === part.family && control.options?.some(option =>
        option.value === (control.part?.attribute ? part.attributes[control.part.attribute] : part.id))).map(control => ({ modelId: model.id, modelTitle: model.title, via: control.label, kind: 'model' as const })),
      ...(model.assembly?.references ?? []).filter(reference => reference.part === part.id).map(() => ({ modelId: model.id, modelTitle: model.title, via: 'Assembly preview', kind: 'model' as const })),
    ]),
    ...conceptPages.flatMap(page => page.parts.filter(link => link.partId === part.id).map(link => ({ modelId: page.id, modelTitle: page.title, via: link.via, kind: 'concept' as const }))),
  ];
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
