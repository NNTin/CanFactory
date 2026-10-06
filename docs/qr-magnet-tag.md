# Magnetic QR code tag

A flat tag that sticks to a fridge or a whiteboard, in two printed parts
([issue #48](https://github.com/NNTin/CanFactory/issues/48)):

- **Border** (`border`): the frame. Disc magnets from the parts library sit in its back: in open pockets, pressed or glued in, or
  **embedded** in sealed cavities that they are dropped into when the print pauses (`magnetMount`).
- **Centre** (`centre`): a plate carrying a QR code of `qrText`, with an optional SVG logo in its middle. It prints as **one
  model in two colours**: a light base, then the dark modules and logo raised on it, with **one filament change**.

The centre is held in the border by the chosen `joint`. An original CanFactory design, CC BY 4.0
([ATTRIBUTION.md](../models/qr-magnet-tag/ATTRIBUTION.md)).

## Parameters

| Key | Default | Range | What it does |
|---|---|---|---|
| `qrText` | `https://example.com` | 1–200 printable ASCII characters | The code's payload. Encoded in the contract; the API never receives a matrix. |
| `errorCorrection` | `H` | `L` `M` `Q` `H` | A logo needs `Q` or `H` (validation message otherwise). |
| `shape` | `square` | `square` `round` | The tile's outline. |
| `size` | 60 mm | 30–120 | Outer width (square) or diameter (round). |
| `cornerRadius` | 4 mm | 0–20, at most `size`/2 − 1 | Square only. The seat's corners are this less the border (at least 1 mm). |
| `borderWidth` | 6 mm | 3–20 | The visible ring round the centre; the seat is `size` − 2 × `borderWidth` (at least 20 mm). |
| `quietZone` | 2 modules | 1–4 | The light margin round the code, on the centre. |
| `logo` | none | `svg` control | As the cigarette case's logo (below). Centred on a light knockout pad. |
| `logoSize` | 20 % | 10–40 % of the code's width | Limited by the error correction (see [Logo](#logo)). |
| `baseThickness` | 1.6 mm | 0.8–3 | The light base. The filament change is at its top. |
| `reliefHeight` | 0.6 mm | 0.4–2 | How high the dark modules and the logo stand on the base. |
| `layerHeight` | 0.2 mm | 0.08–0.32 | Your slicer's layer height: for the reported change height and its check, and with embedded magnets the pause height (the only geometry it changes). |
| `joint` | `crush-ribs` | `crush-ribs` `detent` `twist-lock` `magnets` | How the centre is held. |
| `fit` | 0.2 mm | 0.05–0.6 | Gap per side between the centre and the seat, with bands and per-joint recommendations. |
| `magnet` | S-08-02-N (8 × 2 mm) | the library's disc magnets up to 12 × 3 mm | Back pockets, and the `magnets` joint. |
| `magnetCount` | 4 | 2 or 4 | Back pockets: two on one diagonal, or one in each corner. |
| `magnetMount` | `pockets` | `pockets` `embedded` | Open pockets (press or glue the magnets in after printing), or sealed cavities (drop them in at a print pause). |

The module size is `codeWidth / (modules + 2 × quietZone)`, where `codeWidth` is the largest square on the centre's face (a
rounded square loses its corner arcs; a disc's inscribed square is its diameter / √2). Validation refuses modules under
**1.0 mm**: "Shorten the text, lower the error correction or enlarge the tile." The default code is version 3 (29 × 29
modules), 1.43 mm per module. The 200-character limit fits a 120 mm tile at `L`; at `H` it needs a code of version 15.

## How it is built

Both parts are centred on the Z axis; the layout is computed the same way in the generator and in `qrTagLayout`
(`packages/contracts/src/qrMagnetTag.ts`), and a test keeps their fixed sizes (`QR_TAG`) equal.

**The border is a shallow tray**: a floor that holds the magnets, and round it the ring, `borderWidth` wide, whose inside is
the seat. The centre sits in the seat flush with the ring (the seat is `baseThickness + reliefHeight` deep). The floor is
the magnet's greatest height plus 0.8 mm (2.9 mm for 8 × 2 mm magnets), so the default tag is 5.1 mm thick.

The magnet pockets are in the floor's back, on the diagonals, as far out as the outline leaves 1.2 mm of wall: they straddle
the seat's edge, as in the issue's sketch (8.3 mm pockets in a 6 mm border). That is why the border has a floor rather than
being an open frame: an 8 mm magnet does not fit in a 6 mm ring. A 5 mm push-out hole goes through the middle of the floor.

**Print orientation, and a deliberate deviation from the issue.** The issue asks for the border to print face down, "so the
pockets open upwards". With a floor under the seat that is not printable without supports: face down, the floor would be a
bridge across the whole seat (48 mm by default, up to 110 mm). So **the border prints back down**: the pockets open onto the
bed, and each needs only a short bridge over its 8 mm diameter, the way any blind hole prints; the seat opens upwards, and
the ring's front, the visible face, is the top surface. No part needs supports.

**The centre prints base down**: the light base (`baseThickness`), then the dark modules and the logo
(`reliefHeight`). It goes into the seat the same way up, so the assembly needs no turning over.

### Embedded magnets (print pause)

With `magnetMount = embedded` every magnet of the border (the back's, and with the magnet joint the seat's) lies in a **sealed
cavity**: from a skin over the back face up to the **pause height**, under the floor's 0.8 mm wall. All cavities share those
heights, so one pause serves them all.

- The skin is at least 0.4 mm, in whole layers (`toLayers`): 0.4 mm at 0.2 or 0.08 mm layers, 0.48 mm at 0.12, 0.64 mm at 0.32.
- The pause height is the skin plus the magnet's greatest height plus 0.05 mm of headroom, rounded up to a layer boundary:
  **2.6 mm, before layer 14** for the default 8 × 2 mm magnets at 0.2 mm layers. The cavity's top is that boundary, so the next
  layer is the first to bridge over the magnets, and the nozzle never meets one. This is the only geometry `layerHeight` changes.
- The floor grows by the skin and the headroom (3.4 mm instead of 2.9 mm by default). With the magnet joint, the centre's magnet
  still stands into an open pocket above the floor over the embedded seat magnet (the two then 1.0 mm apart instead of 0.2 mm).
- The editor shows the pause under the settings ("Border: pause the print at 2.6 mm, before layer 14 … and drop the 4 magnets
  into their cavities; then resume"). In the slicer, add a pause (PrusaSlicer/OrcaSlicer: *Add pause print* at that height;
  Cura: *Pause at height*) before that layer.
- The skin costs some hold: the magnets no longer touch the steel. Choose a larger magnet, or open pockets, for heavy use.
- Neodymium magnets jump to a steel print sheet and to each other: drop each in with tweezers, and check before resuming that all
  sit flat at the bottom of their cavities (a raised one would be hit by the nozzle).
- The STL encloses the cavities as inward-facing shells. That is a new, generic option of the mesh check:
  `ModelPart.sealedVoids` lets `inspectStl` (`allowVoids`) accept exactly one outer shell plus shells that face inwards (negative
  volume) and lie inside it, which a ray-parity test confirms; a second body beside the first is still refused. The renderer
  test counts the border's shells: one plus a cavity per magnet.
- In the assembly preview the embedded magnets are in the border from the start: they have no step, and with the magnet joint the
  seat magnets are not glued in either. Hide the border (its button under the slider) to see them.

### The colour change

Change to the dark filament at the base's top, rounded up to a layer boundary: `ceil(baseThickness / layerHeight) ×
layerHeight` (`filamentChangeHeight`). At the defaults: **1.6 mm, before layer 9** at 0.2 mm layers. The editor shows it under
the settings (the generic `ModelDefinition.derived(...).notes`), together with the code's version and module size, and the print
notes say where to find it. If the base is not a multiple of the layer height, the layer that holds the base's top prints
light; validation requires at least **two dark layers** of relief above the change ("Raise the relief to … or make the base a
multiple of the layer height"). The first layer is assumed to be as high as the others; with a thicker first layer, add the
difference.

## The QR code

`encodeQr` uses [uqr](https://github.com/unjs/uqr) 0.1.3 (MIT, no dependencies, pinned exactly), a port of Project Nayuki's
QR Code generator. Why a library and not an own encoder: Nayuki's is a reference-quality implementation of ISO/IEC 18004
(Reed–Solomon blocks and interleaving, all 40 versions, the standard's mask penalty rules N1–N4), small and audited, and uqr
exposes what the tag needs:

- **Byte mode always**: the text is passed as bytes (one per printable ASCII character), so `HELLO` is not switched to the
  alphanumeric mode behind the user's back.
- **Exactly the chosen error correction**: `boostEcc: false`, so the size the editor reports is the size that prints.
- **The smallest version that holds the text**, and the **mask chosen by the standard's penalty**, deterministically.
- **The module types**: which modules are function patterns, which the logo knockout and its check use.

`qrTagCode` clears the logo's knockout pad and merges the dark modules into rectangles (`mergeModules`: each row's runs, then
equal runs in consecutive rows), and `qrScad` writes `[modules, pad, [[x, y, w, h], ...]]` for `-D QR=`: integers only. The
generator scales them to the module size and grows each by 0.01 mm, so that modules that touch only at a corner overlap rather
than share an edge. The SCAD file's default `QR` is the default text's code, so the file renders on its own; a test keeps it
equal to the contract.

## Logo

The logo is the cigarette case's, unchanged ([cigarette-case-text.md](cigarette-case-text.md)): the editor reads the SVG file in
the browser with `svgToLogo` into a logo string; only that string reaches the API, `decodeLogo` validates it character by
character, and `logoScad` writes it for `-D LOGO=` as numbers.

The logo stands raised in the dark filament on a **knockout pad**: a light square of whole modules in the middle of the code,
on which no module is printed. Its side is odd, as the code's is, so that it is centred on the module grid, and leaves at least
half a module round a logo `logoSize` % of the code's width (`knockoutModules`; 7 × 7 modules at the defaults).

**How large may the pad be?** Every codeword the pad touches is lost, whatever the logo on it, so the honest limit is in
codewords, block by block, not in area. `knockoutDamage` lays the codewords out exactly as the standard does (two-module
columns zigzagging from the bottom right round the function patterns; blocks interleaved codeword by codeword; ISO/IEC 18004
table 9 for the blocks), counts the codewords the pad touches in each block, and compares them with what that block can correct
(half its error-correction codewords, less the codewords reserved against misdecoding in the smallest versions). It depends
only on the version, the error correction and the pad, never on the text.

`knockoutFits` then allows a pad when:

1. it stays inside rows and columns 9 to size − 10, clear of the finder patterns, their separators, the timing lines and the
   format information (and of the alignment pattern of versions 2 to 6);
2. it costs **no block more than 60 %** of the errors it can correct (`QR_LOGO_ECC_SHARE`), leaving the rest for the print's own
   flaws (a smudged module, glare on the relief);
3. it covers at most **7 % (M), 15 % (Q) or 25 % (H)** of the code's area (`QR_LOGO_AREA_LIMIT`), the issue's figures, as a cap
   that only matters for large codes.

Why not the area alone: measured with jsQR, the largest pad that still decodes is far smaller than 15 % or 25 % for small codes
(at `Q`: 7.8 % of a version-2 code, 9.6 % of version 3, 11 % of version 4, 14 % of version 7). At 100 % of each block's
capacity, the codeword count predicts exactly the largest pad jsQR decoded for every version from 2 to 13 at `Q`. A logo is
refused below `Q`. The editor names the largest logo size that fits ("At most 16 %, or choose H").

## Joints

Every joint's sizes are on top of the `fit`, so they engage the same at any fit. The `fit` control shows bands (very tight,
snug, sliding, easy) and, per joint, the range that suits it (`QR_TAG_JOINT_FIT`): crush ribs 0.1–0.3 mm, detent 0.15–0.35 mm,
twist lock 0.2–0.4 mm, magnets 0.15–0.6 mm. These are advice, as the cigarette case's
([cigarette-case-snap.md](cigarette-case-snap.md)).

- **`crush-ribs`**: eight vertical round ribs (1 mm radius) on the seat wall, two per side of a square seat or eight round a round
  one. They stand `fit` + 0.15 mm out of the wall, so the centre squeezes each by 0.15 mm, with a lead-in at the top. Press the
  centre in; push it out through the hole in the back.
- **`detent`**: a 45° bump on the middle 40 % of each of the centre's edges (four places round a disc), reaching 0.2 mm past the
  seat wall, clicks into a groove round the seat wall, 0.2 mm + `fit` deep, at the same height (half the base). The bump must
  fit the base's edge: validation keeps `fit` + 0.2 mm within (`baseThickness` − 0.4 mm) / 2 (fit at most 0.4 mm at the
  default base).
- **`twist-lock`**: a bayonet. The centre is a round disc with the square code inscribed (a square tile gets a round seat), and
  three lugs at its foot (1.5 mm deep, 11° wide, 0.8 mm high). They drop through notches in the seat's lip into a channel under
  it, then turn **30° clockwise** (seen from the front) until they meet a stop; just before it, each lug rides over a round
  ridge under the lip, 0.15 mm into its path, which clicks. Validation keeps the lip over the lugs at least 0.6 mm thick and 1.2
  mm of wall outside the channel. The inscribed code is smaller than on a square centre, which the module-size check covers.
- **`magnets`**: a second set of the chosen magnets, `magnetCount` pairs, on the axes (the back magnets are on the diagonals):
  one in a pocket in the seat floor, one in a pocket in the centre's back. The centre's pocket is as deep as its base allows
  under 0.6 mm of base, so its magnet stands out of the centre's back into the floor's deeper pocket, which also locates the
  centre; the two magnets end 0.2 mm apart. The floor grows to hold that pocket over 0.6 mm of floor. Validation refuses a base
  too thin for the pockets, and pockets that do not fit beside the back magnets.

### Magnets

Pockets are cut to the magnet's greatest size from the parts library (`partDefines`: `MAGNET_D`, `MAGNET_T`, the `max` of each)
plus 0.2 mm of diametral play, as deep as the magnet is high. Press or glue the magnets in. `QR_TAG_MAGNETS` is every disc
magnet of the library up to 12.1 × 3.1 mm (`qrTagMagnetFits`), and a test keeps the list equal to the library; per setting,
`magnetPocketIssues` checks that the pockets fit the tile (1.2 mm of wall to the edge, to the push-out hole and between
pockets).

**Polarity.** With embedded magnets the same rules apply at the pause: drop the back magnets in all the same way up, and with the
magnet joint drop each seat magnet in with the pole you want facing the centre on top (mark it first); after printing, set each
of the centre's magnets onto the finished border over its seat magnet, so that it takes the attracting side, before gluing it into
the centre.

The back magnets only need to hold to steel: any pole may face the back, but put them all the same way round, so
that neighbours do not push each other out of their pockets while the glue sets. With the magnet joint, the pairs must attract:
glue the seat magnets in first, then set each of the centre's magnets onto its seat magnet before gluing it into the centre, so
that it takes the attracting side. The joint magnets lie on the axes and the back magnets on the diagonals, at least a pocket
and a wall apart, so the two sets do not cancel each other: each joint pair closes its field through its partner, and the back
magnets still face the steel.

## Assembly

`qrMagnetTagAssembly`: the border lies still; the centre comes in according to the joint (pressed in, clicked in, set onto the
joint magnets, or dropped in through the notches and then turned 30° as a movement of the slider), and the back magnets are
pressed in last (`linkedReferences`, a step of their own). With the magnet joint, the seat's magnets are glued in first and the
centre's move with it. The preview colours the border blue and the centre light (one STL, two colours in the slicer).

`npm run check:assembly -- qr-magnet-tag --parameters '{"joint": …}'` (default 60 mm square, 8 × 2 mm magnets):

| Joint | Assembled | Along the steps | Designed interference |
|---|---|---|---|
| `crush-ribs` | 0.80 mm³ (border × centre) | 0.80 mm³ | The ribs squeezed by 0.15 mm: within the 1 mm³ tolerance. The check's vertical rays sample the thin, side-facing ribs unevenly, so the figure is a sample, not the exact CSG volume. |
| `detent` | 0.00 mm³ | 2.78 mm³ in the last 10 mm, 0.5 mm before seated (snap tolerance 10 mm³) | The bumps passing the seat wall before they drop into the groove. |
| `twist-lock` | 0.00 mm³ | 0.00 mm³ dropping in; 0.27 mm³ at frame 12 of 15 of the turn | The lugs riding over the ridges. |
| `magnets` | 0.00 mm³ (12 magnets) | 0.00 mm³ | None. |

Every magnet in its pocket, and the exploded layout, share 0.00 mm³; the exploded layout's lowest point is 8 mm above the bed.
The same holds for a round twist lock with two magnets (0.27 mm³ while turning), a round magnet joint with 6 × 3 mm magnets,
a 120 mm twist lock at 0.6 mm fit with 12 mm magnets (0.20 mm³), a 40 mm round detent at 0.4 mm fit (1.47 mm³ clicking in) and
crush ribs at 0.6 mm fit (0.37 mm³).

Embedded magnets (`magnetMount: embedded`) share 0.00 mm³ with the border in their sealed cavities, with the crush ribs (0.80 mm³
assembled, as above), the magnet joint, and a round twist lock with two magnets at 0.32 mm layers (0.27 mm³ while turning). A
negative control raising the cavities 0.8 mm above the magnets (`--defines '{"EMBED_SKIN":1.2}'`) shares 41.05 mm³ per magnet, so
the check sees magnets inside sealed cavities.

**Negative control** (`--defines '{"FIT":-0.3}'`, the centre 0.3 mm larger than the seat on every side): border × centre shares
76.9 mm³ for the crush ribs, the detent and the magnets and 54.1 mm³ for the twist lock (58.3 mm³ while turning), and the
magnet joint's magnets miss their pockets by 6.6 mm³ (their pockets move with the centre's size). So the poses really put the
centre in its seat and every magnet in its pocket.

## Library card

`apps/web/src/QrMagnetTagIllustration.tsx` shows the default tag on a fridge door, drawn from its own layout and code
(`qrTagLayout`, `qrTagCode`: the 29 × 29 code of `https://example.com`). On hover or focus it loops: the border alone, the
centre coming in from the front into the seat, the code appearing row by row, a pause, then the centre lifting out. At rest,
and with reduced motion, it shows the finished tag. `data-tag-stage` names the stage for the browser test.

## Scanning limits

- The 1.0 mm minimum module is the validation's floor; larger modules (a shorter text, a lower error correction or a larger
  tile) are more forgiving of print defects and scan from further away.
- Dark modules on a light base is the polarity every scanner reads; do not swap the filaments.
- Use a matte, light base filament and a dark, matte relief; glossy or silk filaments reflect and can stop a scan at an angle.
- Keep the quiet zone at 2 modules or more if the border's colour is dark: it frames the code.
- A real print has not been scanned yet for this pull request; see [issue #48](https://github.com/NNTin/CanFactory/issues/48)
  criterion 7.

## Security of the text and the logo

The text is validated by the schema (printable ASCII, at most 200 characters) and reaches OpenSCAD only as the integers of its
module rectangles (`qrScad`), encoded again by the worker from the validated text (`scadEncode`, which now receives all the
parameters, since the code depends on the error correction and the logo too). The logo follows the cigarette case's security
model unchanged: the SVG file never leaves the browser; the API takes only a logo string of `M`, `L`, `Z`, digits and spaces,
checked character by character, which reaches OpenSCAD as numbers.

## Checks

- `npx vitest run packages/contracts/src/qrMagnetTag.test.ts`: the encoding (byte mode, exact error correction, determinism), the
  module rectangles, the knockout; **decode round-trips** with jsQR (a dev dependency) of the code as printed (quiet zone,
  knockout, the logo drawn on it, the border's colour round it): every error correction at payload lengths from 1 to 200, the
  fullest code of every version from 1 to 10 at every error correction, the largest allowed logo at `Q` and `H` for versions 2
  to 12, and the codeword count at full capacity for versions 2 to 9; and the contract (validation messages, SCAD defaults and
  fixed sizes, the magnet list, the assembly).
- `TEST_ONLY=qr-magnet-tag npm run test:renderer`: 33 real renders, eight of them with embedded magnets (every joint, a round magnet
  joint with 10 × 3 mm magnets, the finest and coarsest layers, the smallest tile), the border counted as one shell plus a cavity
  per magnet; the 25 others (every joint on both shapes, the smallest and largest tiles,
  the longest text at `L`, a logo at `H` and the largest logo at `Q`, the fit's extremes for every joint, the thinnest and
  thickest centres. Each part must be one closed solid of the expected size with no sliver repairs, and the **rendered
  centre's STL**, seen from above (dark where the relief stands), must decode to the text with jsQR.
- `TEST_ONLY=qr-magnet-tag npm run test:sweep`: boundaries and random settings; 78 renders (seed 1), 118 (seed 7) and 119
  (seed 11, 42 of them with embedded magnets), no repairs, no failures.
- `npm run test:browser -- qr-magnet-tag`: the editor's preview of both parts, the slider, new text and an SVG logo re-rendering,
  and the card's animation.

## Files

| File | What it is |
|---|---|
| `models/qr-magnet-tag/generator.scad` | The generator: `PART` border or centre |
| `packages/contracts/src/qrMagnetTag.ts` | Encoding, knockout, module rectangles, the layout, the fixed sizes |
| `packages/contracts/src/models.ts` | Parameters, validation, parts, assembly, magnets |
| `apps/web/src/QrMagnetTagIllustration.tsx` | The library card |
