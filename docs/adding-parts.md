# The parts library

The parts library is a catalogue of real-world parts that models are made to fit: screws, nuts, washers, magnets, threaded
inserts, bearings, pins, and everyday objects such as the BIC Mini lighter the cigarette case holds. Every entry is one real
item, a size of a standard part (ISO 4762 M3 × 10) or a named product (supermagnete S-06-02-N), with its dimensions, their
tolerances where the source gives them, and the source of every value.

The data lives in `packages/contracts/src/parts/`, one file per family. The API serves it (`GET /api/v1/part-families`,
`/api/v1/part-families/{id}` and `/api/v1/parts/{id}`, see [interfaces.md](interfaces.md)), and the web app browses it on its
own page, the parts library (`#/parts`). Each family page lists its parts with filters and search, shows the listed parts side
by side and true to size in a live 3D preview (hover one, in the preview or the list, to highlight it and read its
description), and shows the selected part's dimensions, sources and the models that use it.

## Schema

`packages/contracts/src/parts/schema.ts`:

- **`PartFamily`**: `id`, `title`, `description`, its `attributes` (the facets the page filters by, e.g. thread and head) and
  its `dimensions` (key, label, the symbol of the standard's drawing, and whether every part has it).
- **`Part`**: a stable `id`, its `family`, a plain `title`, the `designation` it is ordered by, `aliases` (e.g. the DIN number
  an ISO standard replaced), a `description` that tells it apart from its neighbours, the `standard` that defines it or the
  `product` (manufacturer, article number, page), `attributes`, `dimensions`, `sources`, `notes`, and its `preview`.
- **`Dimension`**: the nominal `value` in mm, `min` and `max` when the source gives them, the `basis` (`standard`,
  `manufacturer` or `estimated`) and the `source` it was read from. The nominal value may lie outside its limits: an m6 pin is
  always oversize, and a hex socket is wider than its key. Design against the limit that matters: a pocket takes the `max`.
- **`PartSource`**: every source, by id, in `sources.ts`: its title, publisher, URL, `kind` and the date it was read.

## Sources

Prefer primary sources, and say where every number was read:

- A **standard part** cites its standard (`kind: 'standard'`, e.g. `iso-4762`). Standards are paywalled, so the numbers are read
  from a published copy of the standard's table, which is cited too (`kind: 'reference'`, e.g. the fasteners.eu table), and each
  dimension's `source` is that table. When a reference table has a misprint, correct it from the standard's other data and say
  so in the part's `notes` (ISO 4035's M3 pitch). When two references disagree, give only what they agree on and say so
  (DIN 562's least height).
- A **product** cites its manufacturer (`kind: 'manufacturer'`): the article's own page or data sheet (supermagnete), or the
  maker's dimension drawing (CNC Kitchen's table, ruthex's packaging drawings).
- A value no one publishes is `estimated`, with a source that explains how (the lighter's oval, from photographs).

Only the published values are used; a standard's text is never reproduced.

## Adding parts

- **More sizes of an existing standard or product line**: add rows to the family file's table. Each table is one row per size
  or product, expanded into parts, so that a standard is a few lines however many lengths it has.
- **A new standard or product line**: add a table (and its sources to `sources.ts`) to the family file, following the others.
- **A new family**: add a file with its `PartFamily` and parts, register both in `index.ts`, give it a builder in
  `apps/web/src/partGeometry.ts` (or STL previews) and an icon in `apps/web/src/PartsLibrary.tsx`. `index.ts` lists the families
  planned next.

Then add every new id to `packages/contracts/src/parts/ids.lock`. Part ids are permanent: models link to them. The test fails
if an id disappears from the library or a new one is missing from the lock. Rename a part through `aliases`, never by changing
its id; if a value was wrong, correct it under the same id.

`npm test` checks the whole library (`parts.test.ts`): the schema, that every part has its family's required dimensions and a
source for every value, unique ids, titles and descriptions, and physical sanity per family (a head is wider than its thread,
a nut's corners are wider than its flats, an insert's hole is smaller than the insert).

## Previews

Most parts are built in the browser from their dimensions (`partGeometry.ts`): simplified shapes, but every size is the part's
own. A part whose shape cannot be built that way, such as an everyday object, has an STL preview: a SCAD file under `parts/`
with the real dimensions as named values, and the STL beside it, rendered with
`openscad --backend Manifold --export-format binstl <file>.scad -o <file>.stl`. Render the STL again after changing the SCAD file;
for a reference object, `npm run check:assembly` fails until you do.

## Linking a model to the library

- **A setting that chooses a part**: set `part: { family, attribute }` on the enum control (see
  [adding-models.md](adding-models.md), “Real-world parts”). The plank connector's screw holes link each size to the screws of
  that thread: `part: { family: 'screw', attribute: 'thread' }`.
- **A setting that chooses one part** (a part id per option): `partControl` for the options and `partDefines` for the geometry;
  the cigarette case's magnet snap sizes its pockets from the chosen magnet (see [adding-models.md](adding-models.md)). A
  `part.filter` offers only the parts that match another setting: the litter shovel's inserts, nuts and screws follow its thread.
- **An object the model holds**: add it to `assembly.references` with `referencePart(poseId, partId)`, as the cigarette case
  does with the lighter; or, when it depends on the settings, return it from `linkedReferences`, as the case does with its magnets.

Either way the library lists the model under the part's “Used by” (`partUsage`).
