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

- **ESP32-C3:** the ESP32-C3 SuperMini (Nologo) and the Waveshare ESP32-C3-Zero.
- **ESP32-C6:** the Waveshare ESP32-C6-Zero and the Seeed Studio XIAO ESP32C6.
- **ESP32-S3:** the Seeed Studio XIAO ESP32-S3 Sense, with expansion PCB and camera; see the
  [camera housing](xiao-sense-camera-housing.md#hardware-provenance-and-coordinate-frame). Components can carry a `base`
  height relative to the main PCB top, for stacked boards and underside components (zero when omitted); top heights are local
  to that base. This board is 15 mm tall including its camera, not a flat MCU board.

Besides its dimensions (board `L` × `W` × `t`, corner `r`, pitch `e`, row spacing `e1`, first pin `a` from the USB end, hole `d`,
the USB-C receptacle's width, height and overhang, and the overall height `H`), each board has a layout, `devBoardLayout(part)`:

- **Frame:** millimetres, the PCB's underside on z = 0 with its corner at the origin, the width along X and the length along Y,
  the USB-C receptacle at the +Y end and the antenna at y = 0, seen from the component side.
- **`pins`:** each pin's name and hole centre (`castellated`: a half hole at the edge beside each).
- **`usb`:** the receptacle's box, past the board's end.
- **`components`:** every component taller than the small 0201 and 0402 parts: its `kind`, its body as a box with its height
  above the PCB, and the source of its size.
  - **Buttons:** each has its plunger (`top`: shape, size and the height of its top) and its `travel`. A printed actuator rests
    on the plunger's top and pushes it down by the travel.
  - **LEDs:** an LED with a lens has the lens as its `top`, which is where a light pipe or a thin window goes.
  - **Connectors and shields:** a U.FL receptacle has its post as its `top`; a shield can is one box.
  - `componentTop(component)` is the highest point of any component.
- **`externalAntenna`:** how an external antenna reaches the radio, so that a case leaves room for it and a way out for its
  cable. It is one of:
  - **A `connector`:** the XIAO's U.FL. Its position and the height a mated plug reaches (2.5 mm at most), and `select`, the GPIO
    that switches to it.
  - **`solder points`:** the C3 SuperMini, where Nologo shows a coax core soldered to the chip antenna's feed pad and its shield
    to a ground pad.
  - **`null`:** the maker documents no way (the two Zeros).
- **`bottomPads`:** flat pads on the underside (the C6-Zero's extra GPIO, the XIAO's JTAG, BOOT and battery pads). A floor under
  the board leaves them free to reach.
- **`antennaKeepout`:** where to keep metal, PCBs and thick walls away.
- **`bareUnderside`:** whether the board can lie flat.

Each board's own data:

- **ESP32-C3 SuperMini (Nologo):**
  - Nologo gives 22.52 × 18 mm, the 15.24 mm row spacing and the pinout.
  - Its schematic names 3 × 4 × 2 mm two-pin tact switches. They are drawn as XUNPU's TS-1088 of that size: a 3.9 × 3.0 × 1.5 mm
    body and a Ø1.8 mm plunger, 2.0 mm high, with 0.2 mm travel.
  - The rest is read off Nologo's to-scale render (39.4 px/mm) and is `estimated`.
- **Waveshare ESP32-C3-Zero:**
  - Waveshare's drawing gives 23.5 × 18 mm, R1 corners, 2.54 mm pitch, first pin (1.59 mm) and row inset (1.38 mm).
  - The RGB LED (XL-0807RGBC-WS2812B) is its data sheet's: a 2.0 × 1.8 mm base, 0.28 mm thick, under a 1.34 mm lens, 0.8 mm high.
  - No data sheet names the buttons. Their body (3.5 × 4.2 × 1.5 mm) and beige oval plunger (2.4 × 3.2 mm, top 1.8 mm) are read
    off Waveshare's photographs (14.6 px/mm).
- **Waveshare ESP32-C6-Zero:**
  - Waveshare publishes a dimensioned drawing, a DXF and a STEP model. Everything comes from them, moved into the layout's frame:
    the 1.6 mm PCB, 4.85 mm overall, the Ø0.9 mm holes, the seven Ø1.15 mm pads underneath, the mid-mounted receptacle, and the
    buttons (4.12 × 2.5 × 1.4 mm, Ø1.5 mm plunger to 1.75 mm).
  - The exceptions are the RGB LED (its data sheet), the regulator (missing from the model, placed from the photographs) and the
    buttons' travel (assumed).
- **Seeed Studio XIAO ESP32C6:**
  - Seeed publishes its KiCad design, which gives the outline (20.955 × 17.78 mm, R1.905), the 1.6 mm stack-up, the pins and every
    footprint's place.
  - The parts' sizes are their makers' data sheets:
    - the GCT USB4105 receptacle: 8.94 × 7.35 × 3.31 mm;
    - the Alps SKTAAAE010 buttons: 2.6 × 1.6 × 0.53 mm, 0.11 mm travel;
    - the Hirose U.FL-R-SMT-1: a Ø2 mm post 1.25 mm high, 2.5 mm mated.
  - The shield can over the radio is not in the KiCad design. It is estimated from Seeed's rendered pinout.

Where the makers give nothing, values are `estimated` (source `canfactory-dev-board-estimate`):

- **Read off the drawings:** places read off the makers' to-scale drawings. Expect about ±0.2 mm.
- **Usual package sizes:** QFN32 5 × 5, SOT23-5, a 3.16–3.26 mm high top-mount USB-C receptacle.
- **Assumed:** the C3 boards' 1.0 mm PCB and 1.0 mm holes.

Measure a board before a tight fit, and correct the value under the same id. Copies of the SuperMini from other shops may place
components slightly differently. There is no ESP32-C6 SuperMini: no maker publishes a drawing of one, and the third-party figures
disagree.

The parts library draws a board from its layout (`partGeometry.ts`), and `npm run check:assembly` renders it from
`parts/dev-boards/dev-board.scad` with the layout as `-D` overrides (`GENERIC_MODELS`), so a case's assembly can check its walls
and openings against the receptacle and the components, the plungers, the lens and the U.FL post included. The test checks the
layout:
- the pins on their grid;
- the receptacle centred at the USB end;
- every component inside the outline and clear of the holes;
- each plunger and lens inside its body;
- the two buttons standing above everything round them;
- the Zero's LED as its data sheet gives it;
- the pads underneath clear of the holes;
- the external antenna consistent with its connector or near the antenna;
- the antenna inside its keep-out.

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

### Compact cooling fans

The **`fan`** family (`fans.ts`) adds manufacturer-sourced 5 V axial fans. `W`,
`L` and `H` are frame dimensions in mm, with tolerance maxima used for fit.
`pitch` is nominal mounting pitch; `hole` describes the frame hole, not a printed
clearance bore. `fanMounts` supplies the centred XY pattern: the Sunon 30 mm
frame has **three** holes (orient its lead/missing corner at −X/−Y); the Noctua
40 mm has four. Exhaust is +Z. The Noctua envelope uses the published **12 mm
installed thickness with pads**, not the advertised 10 mm form factor. Its
unpublished hole diameter is explicitly estimated. Electrical/airflow/noise
ratings are in the descriptions, never mislabelled as millimetre dimensions.

Both the procedural web preview and `parts/fans/fan.scad` use this frame and
pattern. Rotor/struts are schematic, pads and leads are omitted. The housing
uses clearance bores with pitch allowance and bolts/nuts rather than the fan's
bundled self-tapping screws. A reference mesh is not a thermal simulation.
