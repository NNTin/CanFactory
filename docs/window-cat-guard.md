# Window cat guard

`window-cat-guard` closes the gaps of a tilted (bottom-hung, *Kippfenster*) window, so that a cat cannot squeeze into the
wedge at the side and get trapped as it narrows. It is three printed honeycomb panels: a **left and a right side panel** that
fill the triangular side gaps, and a **top strip** across the gap at the top, whose pins plug into bosses on the side panels so
that the guard is one U-shaped frame that stands in the window.

Set the window's **height** and **width** and the **gap at the top**. Every panel longer than the **longest part** (your
print bed) is split into equal segments that dovetail together, up to eight per panel, and a **splice bar** is screwed over
every joint so that the segments stay together (see [Splice bars](#splice-bars)). The editor's live preview plays the assembly:
every joint, the splice bars, then the strip onto the left panel and the right panel onto the strip.

The generator is [`models/window-cat-guard/generator.scad`](../models/window-cat-guard/generator.scad); the contract
(parameters, validation, layout, assembly) is `windowCatGuard` in `packages/contracts/src/models.ts` and
`packages/contracts/src/windowCatGuard.ts`.

## The reference parts

[`models/window-cat-guard/references/`](../models/window-cat-guard/references) holds ten STLs of
[“Tilted window cat protection”](https://makerworld.com/de/models/3234292-tilted-window-cat-protection) on MakerWorld
(“Kippfenster Katzenschutz”, CC BY-NC-SA 4.0), split out of one print plate (`obj_N_…_A_B_….stl`; the letters are the
splitting tool's, not part names). This model is not a reconstruction of them: it is a new, parametric generator built the
way they are, and as an adaptation it is licensed CC BY-NC-SA 4.0 as well (see
[ATTRIBUTION.md](../models/window-cat-guard/ATTRIBUTION.md)). What they showed:

| File | Size (flattened) | What it is |
|---|---|---|
| `obj_1 …_A_A_A` | 105.6 × 212 × 10 | left side panel, top segment: 105 → 68 mm wide, one spine |
| `obj_3 …_A_A_B_B` | 69 × 207 × 10 | left side panel, middle segment: 68 → 30 mm |
| `obj_2 …_A_A_B_A` | 30 × 135 × 10 | left side panel, tip: 30 → 8 mm, solid |
| `obj_4 …_B_A` | 106 × 211 × 15 | right side panel, top segment, with two Ø 4.8 mm pins 61 mm apart |
| `obj_5 …_B_B_A` | 72 × 211 × 10 | right side panel, middle segment (mirror of `obj_3`) |
| `obj_6 …_B_B_B` | 32 × 131 × 10 | right side panel, tip |
| `obj_7 …_A_B_A_A` | 106 × 237 × 12.5 | top strip, end segment: a foot bar under its end and two Ø 5 × 5 mm pins along it |
| `obj_8 …_A_B_A_B_B` | 106 × 233 × 8.5 | top strip, middle segment |
| `obj_9 …_A_B_A_B_A_A` | 106 × 231 × 12.5 | top strip, end segment with a foot bar |
| `obj_10 …_A_B_A_B_A_B` | 106 × 201 × 8.5 | top strip, middle segment |

- **Plates.** Flat honeycomb plates, 3.5 mm (strip) to 4 mm (side panels) thick. The holes are hexagons with a corner along
  the panel, 30 mm corner to corner (25.98 mm across flats), 29.92 mm apart in a row (a 3.94 mm web), with a solid border of
  about 5.6 mm. The side panels taper at 10.5°: together, 105 mm wide at the top and about 555 mm tall.
- **Stiffeners.** The side panels carry one spine (about 15 mm wide, 6 mm high) along their middle; the strip carries two
  ribs (3.8 × 5 mm) 60 mm apart, centred.
- **Segment joints.** Segments join edge to edge in the plane: a trapezoidal (dovetail) tab on one segment's end drops into a
  notch in the next, and the spine or rib runs on over the joint and laps about 3 mm onto the neighbour's plate, so the joint
  neither pulls apart nor folds.
- **Corners.** The strip's end segment carries two pins along the strip at its ribs' spacing, and the right side panel's top
  segment two pins at the same 60 mm spacing: the strip and the side panels plug together at the top corners.
- Several STLs (the strip's segments and the right panel's) were exported tilted by 1.5–5.3°, and most are not closed
  meshes (open edges, overlapping bodies). The measurements above are from the plates laid flat again.

## How the generator builds it

Every part prints flat, as modelled: plate on the bed, spine, ribs and bosses on top, no supports. A segment keeps its panel's
own coordinates (a side panel: x across the gap from its straight edge, y up from its tip; the strip: x along it from its
left end), so all segments of a panel share one assembly pose; the slicer centres them.

- **Side panels.** A right trapezoid, `height` tall, `gap` wide at the top and `tipWidth` at the bottom: the straight edge goes
  against the window frame, the slanted edge follows the tilted sash. The right panel is the left one mirrored. The spine
  (12 mm wide, `ribHeight` high) runs along the panel's middle; towards the tip it starts where the panel is 1 mm wider than
  it on either side, and with a top strip it stops 1 mm below the strip (a spine taller than the bosses would otherwise run
  into the strip's end). The top segment has, when there is a top strip, two bosses (Ø 11, 7 mm high) with a through hole for
  the strip's pins, at the ribs' spacing, 7 mm below the top.
- **Top strip.** `gap` deep, spanning the window between the bosses: `width − 2 × (thickness + 7 + 0.5)`. Two ribs (4 mm
  wide) at most 60 mm apart, centred; across a narrow gap they move closer, so that the bosses keep a border's clearance
  (`min(60, gap − 2 × (border + 6.5))`). Its end segments carry two Ø 5 mm pins along the strip, lying on a 0.3 mm flat so
  that they print without support, `0.5 + 7 + thickness − 0.5` long: they end 0.5 mm short of the side panel's outer face.
- **Segments.** A panel is split into `ceil(length / maxPartLength)` equal segments: the side panels by `height`, the strip
  by its own length. Segment 1 is a side panel's top and the strip's left end.
- **Dovetails.** At each joint, the lower segment (the strip: the one on the left) carries a tab under its spine or rib: its
  root 1 mm wider than the spine or rib on each side, its tip 3 mm wider again, 8 mm deep, following the spine's slant. The
  next segment's notch is the tab grown by `fit`; the plates' ends are `fit` apart. The spine or rib runs on over the tab and
  laps 3 mm onto the next segment's plate, which keeps both flush (the lap is a 3 mm cantilever, as in the reference).
- **Honeycomb.** `cell` corner to corner, `web` apart, laid out from the panel's top so that rows line up across segments. The
  holes are clipped to the open area (inside the `border`, off the spine and ribs, round the dovetails, bosses and splice bars);
  a hole whose centre falls outside that area is left out, so clipping never leaves a sliver. `cell = 0` gives solid plates.

### Splice bars

The dovetail holds two segments side by side in the plate's plane, and the lap stops them folding one way, but the tab goes into
its notch perpendicular to the plate and comes out the same way. Nothing in the reference holds it there. A printed side
panel came apart in real use: carried to the window, or pushed by a cat from the spine's side, a segment lifts out of the one
above. So, unlike the reference, `segmentJoints` screws a **splice bar** over every joint by default:

- **The bar** (`PART = "bar"`) is 12 × 28 × 4 mm (as wide as the spine), with rounded corners, printed flat with its
  countersinks up. All bars are the same part, so the worker renders one and copies it. It lies on the two segments' spines (or
  ribs) across the joint, along the spine.
- **Two countersunk screws** go down through it, one into each segment: 2 mm past the joint into the segment with the tab (in
  the tab), and 18 mm past it into the segment with the notch (past the lap). Their heads sit flush in countersinks: as wide as
  the head plus 0.2 mm, as deep as the head's cylindrical edge, then 90°, as on the litter shovel's scoop.
- **`nut-bolt`** (default): a clearance hole (ISO 273, medium) through the spine and plate, and a nut pocket from the plate's
  back, 0.2 mm wider than the nut, corners along the spine. The nut sits on the screw's tip, at least 0.2 mm inside the back,
  with at least 1.2 mm of spine over it. The pocket is open at the bed and its ceiling is a short bridge, so it prints without
  supports.
- **`threaded-insert`**: a hole of the maker's diameter from the spine's top, as deep as the maker asks, or deeper (to 0.5 mm
  past the screw's tip, through the plate if need be). Melt the insert in flush with the spine's top.
- **The top strip** has a bar on each rib at every joint (4 screws per joint). Under a bar, the 4 mm rib widens to the bar's
  12 mm, and the honeycomb keeps a `web` clear of it.
- **`glue`** leaves the dovetails as in the reference, with no bars and no holes (the geometry is unchanged from before
  splice bars). Glue each joint: epoxy or gel superglue for PETG (the 0.25 mm play is too wide for thin superglue).

The fasteners come from the parts library. Screws are countersunk (ISO 10642, ISO 7046-1) with a head that leaves 0.8 mm of the
bar under it and fits within 5.5 mm of the axis. Nuts (ISO 4032, ISO 4035, ISO 10511, DIN 562) and inserts (CNC Kitchen, ruthex)
fit when their pocket or hole plus wall stays within 5.5 mm of the axis: inside the spine, and inside the strip's tab. That
offers M2 to M4. The default is an ISO 4032 M3 nut on an ISO 10642 M3 × 10.

## Parameters

| Parameter | Default | Range | Meaning |
|---|---|---|---|
| `height` | 550 | 150–1500 | Height of the side panels: the side gap they close, tip to top. |
| `gap` | 105 | 60–200 | The side gap at the top: the side panels' top width and the strip's depth. |
| `width` | 900 | 300–1600 | Window width, outside face to outside face of the side panels. |
| `topStrip` | on | | The strip across the top, with its bosses on the side panels. Off: two side panels on their own. |
| `maxPartLength` | 210 | 120–300 | Longest part: anything longer is split into equal segments. |
| `tipWidth` | 10 | 4–60 | Width of the side panels at the bottom. |
| `thickness` | 4 | 2.4–6 | Plate thickness. |
| `ribHeight` | 5 | 2–12 | Height of the spine and ribs above the plate. |
| `cell` | 30 | 0–40 | Honeycomb holes, corner to corner (0: solid). 40 mm (35 mm across flats) is the most: a paw does not get through. |
| `web` | 4 | 2–10 | Bars between the holes. |
| `border` | 6 | 3–15 | Solid border round every plate. |
| `fit` | 0.25 | 0.05–0.6 | Play in the dovetails, round the pins and between the segments, per side. |
| `segmentJoints` | `nut-bolt` | `nut-bolt`, `threaded-insert`, `glue` | What holds the segments together: a splice bar over every joint, screwed into nuts or heat-set inserts; or the dovetails alone, glued. |
| `jointThread` | M3 | M2–M4 | The screws' thread; the lists below offer only parts of it. |
| `jointNut` / `jointInsert` | ISO 4032 M3 / CNC Kitchen M3 × 5.7 | library parts that fit | The nut or the insert in each segment. |
| `jointScrew` | ISO 10642 M3 × 10 | countersunk, library | The two screws per splice bar. |

The settings are refused when:

- a panel would need more than eight segments (the message names the shortest `maxPartLength` that fits);
- the side panels are not narrower at the bottom than at the top;
- the lowest joint of a side panel is narrower than its dovetail needs: `2 × (6 + 1 + 3 + fit + border)`, 32.5 mm by default.
  Widen the bottom, or allow longer parts so that the joint sits higher;
- with a top strip, the bosses do not fit either side of the spine across the gap (the ribs at least 25 mm apart);
- the holes are smaller than twice the web;
- with splice bars, the screw does not hold in its nut or insert through `thickness + ribHeight` of plate and spine. Into an insert,
  it must reach past the bar at least as far as the insert is long, and no further than the plate's back. Into a nut, its tip
  must stay inside the back, and the nut round it must leave 1.2 mm of spine. The message names the shortest screw that works:
  e.g. with the thinnest plate and ribs (4.4 mm) the default M3 × 10 is too long, and the M3 × 8 fits.

## Assembly

The assembly preview (`windowCatGuardAssembly`) places every segment with `windowCatGuardPieces`: the side panels stand in
the window's side planes (x = 0 and x = `width`), their spines facing in; the strip lies across the top with its pins' axes
on the bosses' axes. A test checks that the poses map each panel's print frame onto the window and each pin onto its boss.

0. Push the nuts into their pockets in the plates' backs (or melt the inserts into the spines).
1. **Left panel**, top down: drop each segment's dovetail into the segment above, from the spine's side, so that its spine laps
   onto the plate above. Then lay a splice bar over every joint and drive its two screws.
2. **Right panel**, the same.
3. **Top strip**, from its right end: lay each segment's dovetails into the next one from above, then screw a splice bar on
   each rib over every joint.
4. Plug the strip's pins into the left panel's bosses.
5. Push the right panel's bosses onto the strip's other pins, and stand the guard in the window.

Each step brings the rest of its panel along, so that the exploded layout shows every segment apart; a splice bar rides with
the segment it is screwed into through the tab. The screws and the nuts or inserts are shown as parts-library references
(`windowCatGuardBolts`): each screw rides with its bar, each nut or insert with its segment. A test checks that every bar's
holes lie on its two screws' axes, which the contract computes from the same spine line as the SCAD file's holes.
`npm run check:assembly -- window-cat-guard` renders every part and measures the volume shared by any two of them in the
assembled and exploded layouts and along every step: 0 mm³ throughout. With negative play
(`--defines '{"FIT":-0.3}'`), every dovetail pair and both pin-in-boss corners collide, which proves that the poses really
put each tab in its notch and each pin in its boss.

## Library card

The model library's card (`apps/web/src/WindowCatGuardIllustration.tsx`) shows the guard standing in a tilted window, from
the room. On hover or focus it loops through the assembly: the sash tilts open, the left side panel goes in segment by segment
from the top, then the right one, then the top strip lands segment by segment from its right end; then the guard comes out
and the window closes. It draws the default guard's own layout (`windowCatGuardLayout`: three segments per side panel, five in
the strip), with the gap drawn 2.6 times deeper than to scale so that the side panels read at card size. With reduced motion
it stays at rest. `data-guard-stage` names the current stage for the browser test.

## Printing and fitting

- Print every segment and splice bar flat, as generated, in PETG; no supports. PLA softens behind a sunny window. The splice
  bars are all alike.
- Measure the gap at the top with the window tilted, and the height from where the gap is about `tipWidth` wide up to the
  top. Measure the width between the frame's side faces.
- Join the segments as above. The dovetails are a slip fit at the default 0.25 mm; the splice bars hold them. With
  `segmentJoints = glue`, glue each joint instead.
- The guard is held by the window: the side panels stand in the side gaps against the frame and the strip lies in the top
  gap. Close the window only after taking the guard out.

## Checks

- `npx vitest run packages/contracts/src/windowCatGuard.test.ts`: the contract (segment counts, splice bars, validation, the
  fastener lists equal to the library's fitting parts, SCAD defaults and fixed sizes equal to the contract, poses, the bars' holes
  on the screws' axes, steps).
- `TEST_ONLY=window-cat-guard npm run test:renderer`: real renders of ten settings (defaults, solid glued side panels alone,
  the smallest window, eight segments per panel, the finest and the coarsest honeycomb, inserts, M4 nylon-insert nuts, M2 square
  nuts, the largest window). Each part must be one closed solid of the expected size, with no float32 sliver repairs.
- `TEST_ONLY=window-cat-guard npm run test:sweep`: boundaries and random settings.
- `npm run test:browser -- window-cat-guard`: the editor's preview, its slider steps, and the segments following the height.

## Files

| File | What it is |
|---|---|
| `models/window-cat-guard/generator.scad` | The generator: `PART` side or strip, `SIDE`, `SEGMENT` |
| `models/window-cat-guard/references/` | The reference STLs this design follows (not used by the generator) |
| `packages/contracts/src/windowCatGuard.ts` | Fixed joint sizes, the layout, the poses |
| `packages/contracts/src/models.ts` | Parameters, validation, parts, assembly steps |
