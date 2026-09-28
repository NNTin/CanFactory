import { Type, type Static } from 'typebox';

/**
 * Where a value comes from. Primary sources are preferred: the standard itself for standard parts, the manufacturer for a
 * product. A standard's text is paywalled, so its numbers are usually read from a published table of it; that table is cited as a
 * `reference` next to the standard, so that anyone can check where each number was read.
 */
export const PartSourceSchema = Type.Object({
  id: Type.String({ description: 'Stable id, referenced by parts and dimensions.' }),
  title: Type.String(),
  publisher: Type.String({ description: 'Who publishes it, e.g. “ISO” or “supermagnete (Webcraft GmbH)”.' }),
  url: Type.Union([Type.String(), Type.Null()]),
  kind: Type.Union([Type.Literal('standard'), Type.Literal('manufacturer'), Type.Literal('reference')], {
    description: '`standard`: the standard that defines the part. `manufacturer`: the maker’s own data sheet or product page. `reference`: a published copy of a standard’s table, or other secondary data.',
  }),
  accessed: Type.String({ description: 'The date the values were read from it (ISO 8601), for web pages that can change.' }),
}, { additionalProperties: false });
export type PartSource = Static<typeof PartSourceSchema>;

/** One measurement of a part, in millimetres: the nominal value and, when its source gives them, the limits of its tolerance. */
export const DimensionSchema = Type.Object({
  value: Type.Number({ description: 'Nominal value in mm.' }),
  min: Type.Union([Type.Number(), Type.Null()], { description: 'Smallest allowed value in mm, when known.' }),
  max: Type.Union([Type.Number(), Type.Null()], { description: 'Largest allowed value in mm, when known.' }),
  basis: Type.Union([Type.Literal('standard'), Type.Literal('manufacturer'), Type.Literal('estimated')], {
    description: '`standard`: from the part’s standard. `manufacturer`: from the maker’s data. `estimated`: no published figure; estimated (e.g. from photographs), as `source` explains.',
  }),
  source: Type.String({ description: 'The id of the source it was read from.' }),
}, { additionalProperties: false });
export type Dimension = Static<typeof DimensionSchema>;

/** How the parts library draws a part: built from its dimensions in the browser, or a rendered model from the repository. */
export const PartPreviewSchema = Type.Union([
  Type.Object({ kind: Type.Literal('procedural') }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal('stl'),
    path: Type.String({ description: 'The STL, rendered from the SCAD file beside it (see `partAssetPath`).' }),
  }, { additionalProperties: false }),
]);
export type PartPreview = Static<typeof PartPreviewSchema>;

/**
 * A real-world item: a size of a standard part (ISO 4762 M3 × 10) or a named product (supermagnete S-06-02-N). `id` is stable
 * forever: models link to it. Rename a part through `aliases`, never by changing its id.
 */
export const PartSchema = Type.Object({
  id: Type.String({ pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' }),
  family: Type.String(),
  title: Type.String({ description: 'A plain name, e.g. “Socket head cap screw M3 × 10”.' }),
  designation: Type.String({ description: 'How it is ordered: the standard designation or the manufacturer’s article number.' }),
  aliases: Type.Array(Type.String(), { description: 'Other designations of the same part, e.g. the DIN standard an ISO standard replaced.' }),
  description: Type.String({ description: 'What exactly this item is, in one or two sentences, so that it can be told apart from its neighbours.' }),
  standard: Type.Union([Type.String(), Type.Null()], { description: 'The id of the source that defines it, for a standard part.' }),
  product: Type.Union([Type.Object({ manufacturer: Type.String(), sku: Type.String(), url: Type.String() }, { additionalProperties: false }), Type.Null()],
    { description: 'The product, for a part that is not defined by a standard.' }),
  attributes: Type.Record(Type.String(), Type.String(), { description: 'Facets the library filters by (see the family’s `attributes`).' }),
  dimensions: Type.Record(Type.String(), DimensionSchema, { description: 'Keyed by the family’s dimension keys.' }),
  sources: Type.Array(Type.String(), { description: 'Ids of every source used for this part.' }),
  notes: Type.Union([Type.String(), Type.Null()]),
  preview: PartPreviewSchema,
}, { additionalProperties: false });
export type Part = Static<typeof PartSchema>;

export const PartFamilySchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  description: Type.String(),
  attributes: Type.Array(Type.Object({ key: Type.String(), label: Type.String() }, { additionalProperties: false }),
    { description: 'Facets of the family, in display order.' }),
  dimensions: Type.Array(Type.Object({
    key: Type.String(), label: Type.String(), symbol: Type.String({ description: 'The letter used in the standard’s drawing, e.g. “dk”.' }),
    required: Type.Boolean({ description: 'Whether every part of the family has it.' }),
  }, { additionalProperties: false }), { description: 'The dimensions of the family, in display order.' }),
}, { additionalProperties: false });
export type PartFamily = Static<typeof PartFamilySchema>;
