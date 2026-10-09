# The parts library

The parts library is a catalogue of real-world parts that models are made to fit: screws, nuts, washers, magnets, threaded
inserts, bearings, pins, wood screws, staples, insert nuts for wood, levelling feet, toggle latches, insect screen hooks, flat corner brackets, set screws, steel balls, compression springs, split rings, NFC tags, cat collars, development boards, and everyday objects such as the BIC
Mini lighter the cigarette case holds. Every entry is one real
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

### Balls, springs and set screws

Three families added for the [spring ball detent](spring-ball-detent.md). Their sizes are scoped to what that model needs, not a
whole catalogue:

- **`ball`** (`balls.ts`): ISO 3290-1 / DIN 5401 chromium-steel (100Cr6) balls of grade G100, 2.5 to 6 mm. One dimension, the
  diameter `d`, whose limits are the grade's boundary dimensions (±47.5 µm, read from Kugel Pompel's DIN 5401 data sheet).
  A bore takes the `max`.
- **`spring`** (`springs.ts`): Gutekunst compression springs by article (short ones for a capped detent, longer ones to span a side
  opening), each read from its own page on federnshop.com:
  - dimensions: wire `d`, outer diameter `De` (± its tolerance), free length `L0` (± its tolerance), the least length in static
    use `Ln` (the solid length plus EN 13906-1's least coil gaps: never compress it further) and in dynamic use `Lndyn`;
  - attributes: the spring rate (`rate`, read with `springRate(part)`) and the largest force.
  - The test checks that the rate times `L0 − Ln` is the maker's largest force. The inner diameter is `De − 2d`.
- **`set-screw`** (`set-screws.ts`): ISO 4026 hexagon socket set screws with a flat point, M3 to M8. Dimensions: `d`, `pitch`,
  `l`, the point `dp` (max/min), the key `s` and the socket depth `t`.

`npm run check:assembly` renders them from generic models in `parts/balls/`, `parts/springs/` and `parts/set-screws/`. The set
screw's thread is drawn at its minor diameter, so that it clears its tap-drill hole.

### Development boards

The **`dev-board`** family (`dev-boards.ts`) holds small microcontroller boards that a print holds (a smart lamp's controller):
the ESP32-C3 SuperMini (Nologo) and the Waveshare ESP32-C3-Zero. A case is designed around more than a board's size, so besides its
dimensions (board `L` × `W` × `t`, corner `r`, pitch `e`, row spacing `e1`, first pin `a` from the USB end, hole `d`, the USB-C
receptacle's width, height and overhang, and the overall height `H`) each board has a layout, `devBoardLayout(part)`:

- **Frame:** millimetres, the PCB's underside on z = 0 with its corner at the origin, the width along X and the length along Y,
  the USB-C receptacle at the +Y end and the antenna at y = 0, seen from the component side.
- **`pins`:** each pin's name and hole centre (`castellated`: a half hole at the edge beside each).
- **`usb`:** the receptacle's box, past the board's end.
- **`components`:** every component taller than the small 0402 parts, as a box with its height above the PCB: the chip, the
  buttons, the regulator, the crystal, the LEDs and the antenna.
- **`antennaKeepout`:** where to keep metal, PCBs and thick walls away.
- **`bareUnderside`:** whether the board can lie flat.

What the makers publish is `manufacturer`: Nologo gives the SuperMini's 22.52 × 18 mm, its 15.24 mm row spacing and its pinout.
Waveshare's drawing gives the Zero's 23.5 × 18 mm, R1 corners, 2.54 mm pitch, first pin (1.59 mm) and row inset (1.38 mm), and
the RGB LED's data sheet gives its size. Neither publishes the rest, so it is `estimated` (source
`canfactory-dev-board-estimate`):

- **Read off the drawings:** the components' places and the receptacle, from the makers' to-scale drawings (Nologo's render at
  39.4 px/mm, Waveshare's photograph at 14.6 px/mm). Expect about ±0.2 mm.
- **Usual package sizes:** QFN32 5 × 5, SOT23-5, a 3.16–3.26 mm high top-mount USB-C receptacle, 3 × 4 mm tact switches about
  2 mm high.
- **Assumed:** a 1.0 mm PCB and 1.0 mm holes.

Measure a board before a tight fit, and correct the value under the same id. Copies of the SuperMini from other shops may place
components slightly differently.

The parts library draws a board from its layout (`partGeometry.ts`), and `npm run check:assembly` renders it from
`parts/dev-boards/dev-board.scad` with the layout as `-D` overrides (`GENERIC_MODELS`), so a case's assembly can check its walls
and openings against the receptacle and the components. The test checks the layout: the pins on their grid, the receptacle
centred at the USB end, every component inside the outline and clear of the holes, and the antenna inside its keep-out.

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
- **A concept page** (not a model, e.g. the catio window insert, `#/concepts/catio/window-insert`): list the parts it uses in
  `packages/contracts/src/concepts.ts`; the library lists the page under “Used by” with `kind: 'concept'`.

## Where to buy

A part can link to shops: add a curated offer for it to `packages/contracts/src/parts/offers.ts` (an Amazon ASIN or an
Awin advertiser's product, one row per market, with the pieces per pack). Without one, the part links to a search of the
visitor's Amazon for its designation. See [affiliate-offers.md](affiliate-offers.md).
