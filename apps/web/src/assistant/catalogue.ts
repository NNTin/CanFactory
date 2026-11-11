// The read-only CanFactory tools (#152 §4), as plain functions over the bundled contracts: parts, prototype-board layouts and the
// model catalogue. No editor and no network. Results are compact on purpose (the model pays for every token): a board's summary,
// never every hole. tools.ts gives them their Zod schemas.
import { artifactFormat, findModel, findPart, findPartFamily, findPartSource, models, partFamilies, parts, prototypeBoardLayout, type Part, type PrototypeBoardHole, type PrototypeBoardHoleRef, type PrototypeBoardLayout } from '@canfactory/contracts';

/** Thrown for a request the tool can't answer (an unknown id): the model reads the message as the tool's error. */
export class ToolInputError extends Error {}

const partSummary = (part: Part) => ({ id: part.id, family: part.family, title: part.title, designation: part.designation });

export const SEARCH_LIMIT = 50;

/** Parts whose id, title, designation, aliases or attribute values contain every word of `query`, optionally in one family. */
export function searchParts(input: { query?: string | undefined; family?: string | undefined; limit?: number | undefined }) {
  if (input.family !== undefined && !findPartFamily(input.family)) throw new ToolInputError(`There is no part family “${input.family}”. Families: ${partFamilies.map(family => family.id).join(', ')}.`);
  const words = (input.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const matches = parts.filter(part => (input.family === undefined || part.family === input.family) && words.every(word =>
    [part.id, part.title, part.designation, ...part.aliases, ...Object.values(part.attributes)].some(text => text.toLowerCase().includes(word))));
  const limit = Math.min(input.limit ?? 20, SEARCH_LIMIT);
  return {
    total: matches.length,
    parts: matches.slice(0, limit).map(partSummary),
    families: partFamilies.map(family => ({ id: family.id, title: family.title })),
  };
}

function requirePart(id: string): Part {
  const part = findPart(id);
  if (!part) throw new ToolInputError(`There is no part “${id}”. Find one with canfactory_search_parts.`);
  return part;
}

/** A part with every dimension (mm, with its limits, basis and source) and the sources it was read from. */
export function getPart(input: { id: string }) {
  const part = requirePart(input.id);
  const family = findPartFamily(part.family);
  const label = (key: string) => family?.dimensions.find(dimension => dimension.key === key)?.label ?? key;
  return {
    ...partSummary(part),
    aliases: part.aliases, description: part.description, notes: part.notes,
    standard: part.standard, product: part.product, attributes: part.attributes,
    dimensions: Object.entries(part.dimensions).map(([key, dimension]) => ({ key, label: label(key), ...dimension })),
    sources: part.sources.flatMap(id => { const source = findPartSource(id); return source ? [{ id, title: source.title, publisher: source.publisher, kind: source.kind, url: source.url }] : []; }),
    prototypeBoard: prototypeBoardLayout(part) !== undefined,
  };
}

function requireBoard(partId: string): PrototypeBoardLayout {
  const layout = prototypeBoardLayout(requirePart(partId));
  if (!layout) throw new ToolInputError(`“${partId}” is not a prototype board. Find one with canfactory_search_parts (family "prototype-board").`);
  return layout;
}

/** A hole as [column, row], copied (the layout's own refs are readonly). */
const ref = (hole: PrototypeBoardHoleRef | PrototypeBoardHole): [number, number] => 'column' in hole ? [hole.column, hole.row] : [hole[0], hole[1]];

/** The labels a board prints along one axis, by column or row index, leaving out the unlabelled ones. */
function labelRuns(labels: (string | null)[]) {
  return labels.flatMap((label, index) => label === null ? [] : [{ index, label }]);
}

/** A board's layout without its holes: outline, grid, labels, pads, nets (as counts and extents) and mounting holes. */
export function prototypeBoardSummary(input: { partId: string }) {
  const layout = requireBoard(input.partId);
  return {
    partId: input.partId,
    frame: 'mm; the board underside at z = 0 with its corner at the origin, seen from the component side; columns along +X, rows along +Y, both from 0. A hole is [column, row].',
    outline: layout.outline,
    grid: layout.grid,
    holeCount: layout.holes.length,
    emptyGridPositions: layout.grid.columns * layout.grid.rows - layout.holes.length,
    columnLabels: labelRuns(layout.columnLabels),
    rowLabels: labelRuns(layout.rowLabels),
    drill: layout.drill, plated: layout.plated, pads: layout.pads, surface: layout.surface, material: layout.material, finish: layout.finish,
    nets: layout.nets.map(({ id, kind, holes }) => { const [first, last] = [holes[0], holes.at(-1)]; return { id, kind, holes: holes.length, first: first ? ref(first) : null, last: last ? ref(last) : null }; }),
    mountingHoles: layout.mountingHoles,
  };
}

export const QUERY_LIMIT = 64;

/** Holes by position or label, and whether pairs of holes are connected by the board's copper. */
export function queryPrototypeBoard(input: { partId: string; holes?: PrototypeBoardHoleRef[] | undefined; labels?: string[] | undefined; connected?: [PrototypeBoardHoleRef, PrototypeBoardHoleRef][] | undefined }) {
  const layout = requireBoard(input.partId);
  const describe = (hole: PrototypeBoardHole) => ({ hole: ref(hole), x: hole.x, y: hole.y, label: hole.label, net: hole.net });
  const at = ([column, row]: PrototypeBoardHoleRef) => layout.hole(column, row);
  return {
    holes: (input.holes ?? []).map(position => { const hole = at(position); return hole ? { ...describe(hole), drilled: true as const } : { hole: ref(position), drilled: false as const }; }),
    labels: (input.labels ?? []).map(query => { const hole = layout.holeByLabel(query); return hole ? { query, found: true as const, ...describe(hole) } : { query, found: false as const }; }),
    connected: (input.connected ?? []).map(([a, b]) => {
      const [first, second] = [at(a), at(b)];
      const net = first?.net && first.net === second?.net ? first.net : null;
      return { a: ref(a), b: ref(b), connected: net !== null || (first !== undefined && first === second), net, ...(first && second ? {} : { problem: 'Not a drilled hole of this board.' }) };
    }),
  };
}

/** The model catalogue. */
export function listModels() {
  return { models: models.map(model => ({ id: model.id, version: model.version, title: model.title, description: model.description, format: artifactFormat(model), adjustable: model.controls.length > 0 })) };
}

/** A model's parameters, as its editor offers them, with the defaults. */
export function modelSchema(input: { modelId: string }) {
  const model = findModel(input.modelId);
  if (!model) throw new ToolInputError(`There is no model “${input.modelId}”. List the models with canfactory_list_models.`);
  return {
    id: model.id, version: model.version, title: model.title, printNotes: model.printNotes,
    parameters: model.controls.map(control => ({
      key: control.key, label: control.label, description: control.description, kind: control.kind, group: control.group, unit: control.unit,
      default: control.default, minimum: control.minimum, maximum: control.maximum, step: control.step, enabledWhen: control.enabledWhen,
      options: control.options?.map(option => ({ value: option.value, label: option.label })) ?? null,
    })),
    note: 'Bounds can also depend on other parameters; canfactory_set_model_parameters rejects a combination the model does not allow, with the reason.',
  };
}
