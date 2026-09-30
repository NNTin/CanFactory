# Litter shovel

An original three-part design (`models/litter-shovel/`, CC BY 4.0): a **container** that a liner bag fits into, a cat-litter
sifting **scoop**, and a **handle** with a grip. It is registered as the `litter-shovel` assembly model
(`packages/contracts/src/models.ts`).

The whole shovel is carried by the grip. The parts stack **container, scoop, handle**, each set on from above. Every part is a
**closed ring**, and they meet on flat faces:
- The container's lip carries the scoop's cap, with the bag folded over the lip pinched between them.
- The cap's top carries the handle's ring.
- The container has its own handle, open at the bottom like a hook, so it can be carried on its own. The handle part's grip lies
  on it: both halves stack into one smooth bar, the container's on the finger side, the handle part's on the palm side. By
  default they are thin sheets; `handleShape` can make them a curved sheet, a round tube or a rectangular bar
  (see [Grip](#grip)).
- Held in the fist, the two halves are pressed together. That ties the container to the handle, with the scoop's cap trapped
  between the lip and the ring, and so clamps all three parts.

## Parts

Each part is modelled as it prints, Z up, in millimetres. Only the container's open grip tip needs slicer supports (see
`gripEnd` below). Sizes are at the defaults: the handle part is 30 mm taller with the grip down to the floor, and the
container's grip keeps half the clearance off the seam, so its X shrinks by half the clearance.

| Part | File | Size (X × Y × Z) | Prints | Assembled at |
| --- | --- | --- | --- | --- |
| Container | `container.scad` | 106.15 × 114.8 × 141.5 | standing on its floor | Z 0 |
| Scoop | `scoop.scad` | 88.9 × 121.2 × 127 (the scoop's length) | on its cap | Z 136.5 (the cap's ceiling on the lip at 141.5) |
| Handle | `handle.scad` | 112.45 × 121.2 × 129.5 | upside down, on its ring's top | Z 159.5, turned over about X (its ring on the cap's top at 144.5) |

### Container

- **Body:** a rounded-rectangle frustum with a wall of `wallThickness` (1.6 mm by default, see [Wall thickness](#wall-thickness))
  on a floor `min(3.2, wall + 0.8)` thick (2.4 mm), 64.7 × 97 at the floor. The top 13 mm is straight
  (the **band**, 74.5 × 106.8, corner radius 14).
- **Root pad:** where the handle's sheet joins the wall, a wall thinner than 2.4 mm gets a pad on its inside. The wall is 2.4 mm
  thick there (`ROOT_WALL`), so the anchor that carries the whole container stays as strong as before. The pad is 34 mm wide
  (the 26 mm grip and 4 mm each side) and spans Z 124 to 136 on the front wall; its ends and underside are at 45°, and its
  corners rounded, so it prints without support. It is 0.8 mm deep at the default wall, and absent from 2.4 mm up.
- **Lip:** it ends the band with a closed lip, 4 mm wide and 3 mm thick, above a 45° chamfer. Its flat top, at Z 141.5 and
  6.4 mm wide from the mouth to its edge, is the container's mating face.
- **Handle:** the finger half of the grip (see [Grip](#grip)), at the front (+X), 26 mm wide (a round tube is as wide as it is
  thick). By default it is a thin curved sheet, open at the bottom like a hook, so the container can be carried on its own.
  - It leaves the wall 2.5 mm under the lip's chamfer, falls outward at 45°, bends (15 mm) and runs straight down to its tip.
    The finger opening between it and the wall is 25 to 28 mm.
  - **Supports** (the sheets, `sheet` and `curved`; a round or rectangular bar is solid and has none): `supportCount` thin fins (1 to 5, default 3), `supportThickness` thick (1.2 to 4 mm, default 2), brace it under
    the slope. Each is a triangle from the wall to the sheet's underside, 12 mm out along the slope, with a 45° lower edge. They
    stand side by side across the grip, inside its rounded edges; a single fin stands in the middle. The finger opening below stays
    free.
- **Dam (`damWidth`):** a dam under the mouth, on the scraper side (−X) only, that keeps the clumps in when the shovel is turned
  over to scoop again. `damWidth` is 0 to 15 mm, default 8; 0 leaves it out.
  - **Shape:** a sheet as thick as the wall (at most 2.4 mm) that leaves the back wall at Z 135.5 and falls inward at 45°, `damWidth`
    in from the wall. Its inner edge is vertical, and it reaches 1 mm into the wall.
  - **Extent:** it runs along the back wall and round both back corners, and ends where the side walls start
    (`X = −MOUTH_X / 2 + corner radius`, −23.25). The sides and the front stay open.
  - **Height:** its top is 1 mm under the scoop's sleeve (`SLEEVE_DEPTH` 5 mm, `DAM_GAP` 1 mm), which leaves room for the bag.
    It meets the wall where the mouth is straight, above the band's start (Z 131.5) and below the detent grooves (Z 139).
  - **How it works:** it continues the scoop's 45° funnel, so clumps slide off it into the bag. Scooping, the shovel is turned
    over with the scraper side down, and the clumps already inside slide towards the mouth along that side. They collect in the
    pocket between the dam and the back wall (`damWidth` deep) instead of falling back out.
  - **Corners:** at the back corners the mouth's radius (11.6 mm) runs out for a wider dam. There, its outline keeps a 2 mm
    radius, and the sheet is steeper than 45° rather than folding over.
  - **Printing:** its underside is at 45° as well, so it prints standing without support.

### Scoop

- **Cap:** a closed U-shaped ring over the lip.
  - Its flat **ceiling** sits on the lip's top.
  - Its **sleeve** reaches 5 mm into the mouth. Its outer face is the mouth less the clearance; its inner face is fixed, 2.2 mm
    inside the mouth.
  - Its 2.4 mm **skirt** hangs 5 mm around the lip, 0.8 mm clear of it for the bag.
  - The cap's top, 3 mm above the ceiling, is 88.9 × 121.2, flush with the skirt. The handle's ring sits on it.
  - Inside, a 45° funnel leads from the blade into the sleeve, so clumps fall into the bag and never onto the rim or the fold.
- **Blade:** a wall of `wallThickness` (1.6 mm by default), 81.7 × 114 outside, rising from the cap 3.6 mm inside its edge, which leaves room for the ring.
  - **Length (`scoopLength`):** the blade's height, from the cap's lower edges to the scraping edge: 90 to 180 mm, 127 by
    default (`SCOOP_LENGTH`). A longer scoop takes more litter in one go and has a taller sieve: longer slots, or more rows of gaps. Everything above the
    root band follows it: the tip, the side walls' curve, the bevel and the sieve. The cap, the ring and the front stay as they
    are.
  - **Tip (the scraping edge):** the back wall (−X) and most of the back corners rise to a straight edge at Z `scoopLength`
    (127), across the whole back. This edge scrapes along the floor. The outer face runs flat right up to it. The inner face is bevelled over the
    top `tipBevel` (12 mm by default) down to `tipThickness` (0.8 mm, two lines of a 0.4 mm nozzle), so the edge is sharp. The
    bevel faces up and inward, so it prints without support.
  - **Side walls:** they stay level with the tip until 8 mm into the back corners, then fall in half a cosine to the front (+X),
    18 mm above the cap, where the front corners start. The curve leaves the tip and meets the front tangentially, so there is no
    kink anywhere.
  - **Top edge:** the sides, the front corners and the front have a full round top edge (half the wall: 0.8 mm at the default), so the hand
    never meets a square edge. Round the back corners, the tip's square outer edge rounds off gradually into it (radius 0 over the
    back and the first 15° of each corner, growing to 1.6 mm where the sides start to fall), so the sharp tip and the round sides
    meet without a step.
  - Together they make a channel. At the default length, its depth from the back wall's outer face is 46 mm at Z 50, 36 mm at
    Z 80, 28 mm at Z 100 and 22 mm at Z 115. A longer scoop's sides fall more gently, and a shorter one's more steeply.

### Handle

- **Ring:** closed, 15 mm high and 3.6 mm wide less the clearance. It comes down around the blade's base, one clearance clear of
  it, and sits flat on the cap's top, flush with the skirt.
- **Grip:** the palm half of the grip (see [Grip](#grip)). By default the sheet runs down the ring's outer face (a root joins it to the
  ring over the ring's height) and past the skirt, a clearance clear of it. It bends (10 mm) into the shared 45° slope, then
  follows the container's handle round its bend and down to the tip.
- **Printing:** the handle prints upside down, with the ring's top and the sheet's top end on the bed. The sheet rises from
  them, bends outward at 45°, and runs straight up, with nothing overhanging. The assembly turns it over (pose rotation 180° about X).

### Grip

The two halves are swept along one shared seam by the same code in both files. `handleShape` sets what is swept: a thin sheet
(`sheet`, the default, described first), the same sheet bowed across its width (`curved`), or a solid round or rectangular bar (see
[Handle shapes](#handle-shapes)). The seam, in the container's
frame, starts at the ring's outer face and runs down past the skirt. It bends (10 mm) into a 45° slope through the band just under
the lip's chamfer, bends again (15 mm), and runs straight down at X 65 to the tip.

- **Sheets:** each is 26 mm wide and runs from half the clearance to 3 mm off the seam: the container's on the finger side (X 62
  to 65 on the straight), the handle part's on the palm side (X 65 to 68). Their outer faces never move with the clearance.
- **One surface:** the seam faces are flat and a clearance apart. Each sheet rounds only its outer long edges (2.5 mm), so the
  stacked pair reads as one 6 mm strip with rounded edges, with no step at the seam.
- **Tip (`gripEnd`):** `open` (default) ends the grip at Z 30, 100 mm below the lip. Each sheet's outer corner rounds off in a
  quarter circle, so the pair ends in one half-round. `floor` runs both sheets down to Z 0 and ends them flat.
- The container's sheet only follows the slope: past the skirt it runs straight on into the wall. The handle part's sheet bends up
  along the skirt to the ring instead.

#### Handle shapes

Every shape is two halves that stack along the same seam, so the container keeps its own hook and the halves still only
press against each other in the fist: the parts are held by the detents (and the screws), as before. All shapes keep every
tangent of the seam within 45° of vertical, so each part still prints without support (apart from the container's open tip).

| `handleShape` | Halves | Settings |
| --- | --- | --- |
| `sheet` (default) | Two 3 mm sheets, 26 mm wide, as above. Output is unchanged from before the setting existed. | `supportCount` fins |
| `curved` | The same sheets, bowed across their width: the seam's cross-section is an arc about an axis along the run, its middle `gripBulge` (0 to 6 mm, default 3) towards the palm past its edges (at 3 mm a 23 mm radius, at 6 mm 17 mm). Both halves are concentric arcs, so the gap stays the clearance all over, and the sheets keep their 3 mm thickness, 26 mm width and rounded long edges. At 0 it is the flat sheet. The path (slope, bends, run) is the sheet's, so the parts grow only by `gripBulge` in X, at the middle. The handle's ring is joined to the sheet's middle by a solid fill behind it, and the fins follow the bow. | `gripBulge`, `supportCount` fins |
| `round` | A tube of diameter `gripSize` (10 to 24 mm, default 14), each half a solid half-round with a flat seam face. The tube is as wide as it is thick. | `gripSize` |
| `rectangular` | A box bar `gripSize` deep (10 to 24 mm, default 14) and 26 mm wide, each half a solid slab `gripSize` / 2 thick, with 2.5 mm rounded long edges. | `gripSize` |

- **Round and rectangular bars:** the finger half's face stays where the sheet's is (X 61.9 at the default clearance), so the
  finger gap stays 25 mm. The seam therefore moves out by `gripSize` / 2 − 3 mm, and the palm half reaches `gripSize` / 2 past
  it: the handle grows by `gripSize` − 6 mm in X (8 mm at the default 14) and the container's handle by `gripSize` / 2 − 3 mm (4 mm).
  The bends grow to `gripSize` / 2 + 5 mm where that is more than their 15 and 10 mm (only above 20 mm for the first bend), so each half's inner face keeps a radius of at
  least 5 mm. A lower bend leaves less vertical run, so with `gripEnd` `open` their tip is lower, to keep the run the sheet has
  (68 mm from the bend): Z 26.0 at the default 14 mm, 28.0 at 10 and 20.2 at 24. `floor` still ends them on the bed.
- **Tip:** the round bar ends in a hemisphere at an open tip; the rectangular bar, like the sheet, in a half-round seen from the
  side. Both are flat cut at the floor.
- **Root:** the root pad on the container and the root block on the handle are as wide as the grip (plus 4 mm each side for the
  pad). The widest round tube (24 mm) still clears the widest boss a `handleReinforcement` can have (6.5 mm round the screw,
  21 mm from the middle) by 2.5 mm.
- **Solid halves:** print them with sparse infill, so that the slicer's walls carry the load and the bulk stays light. A tube or
  bar is far stiffer than the sheets, so the fist does not close the clearance. The parts are held by the detents (and screws); the squeeze only adds friction.
- **Untested:** nothing has been printed. Whether a 14 mm tube or bar feels right in the hand, and how long the vertical run must be,
  need a print. The shapes' curves are geometry only: they have no ergonomic study behind them.

## How it holds together

| Situation | Load path |
| --- | --- |
| Standing on a table | Everything bears on flat faces: the container on its floor, the cap on the lip, the ring on the cap. |
| Carrying by the grip | The fingers take the container's handle and the palm the handle part's. The container hangs on its own handle, and the stack sits on it. Squeezed together, the halves fix the container to the handle, with the cap trapped between the lip and the ring. If you hold only the palm half, `scoopSnap` holds the container on the scoop, and `handleSnap` (or, with a `handleReinforcement`, its two screws) holds the scoop on the handle. |
| Scooping and sifting | The tip's flat outer face slides on the floor, its sharp edge first. The blade's loads go through its base into the ring and the handle part's grip, then the hand. The sleeve and the skirt also locate the cap on the container. |
| Carrying the container alone | By its own handle, like a hook: the sheet's root in the wall and its fins carry it. |
| Scooping again with clumps inside | Turned over, the scraper side is down. The clumps already in the container slide towards the mouth along the back wall and collect behind the dam (`damWidth`), in the bag, instead of falling out through the scoop. Upright again, they fall back to the floor. |
| Changing the bag | Lift the handle, then the scoop, off. |

### Snap settings

`scoopSnap` (the scoop's sleeve in the container's mouth) and `handleSnap` (the handle's ring on the blade's base) are each
`friction` or `detent`, and both default to `detent`. The detents are sized as on the cigarette case
([cigarette-case-snap.md](cigarette-case-snap.md)):

- A bump stands `clearance + engagement` proud, so it reaches the engagement past the mating wall at any clearance.
- Its groove clears it by the clearance on every side: it is `engagement + clearance` deep.
- Each bump is a 16 mm ridge with 45° flanks and ends, in the middle of each of the four straight sides. The four sides are two
  opposing pairs.

| Joint | Bumps | Grooves | Default engagement (recommended) |
| --- | --- | --- | --- |
| Scoop on the container | on the sleeve's outer face, mid-way down it | in the mouth, 2.5 mm under the lip's top | 0.15 mm (0.10–0.25) |
| Handle on the scoop | on the blade's base, 4 mm above the cap | in the ring, 4 mm up | 0.15 mm (0.10–0.25) |

The scoop's detent works through the bag's film, which lies in the mouth under the sleeve. Both detents rub only over the last
few millimetres of the push. The engagements are advanced settings, shown only while their joint uses a detent. The `clearance`
(0.1 to 0.6, default 0.2) recommends 0.10–0.25 mm for a friction fit and 0.20–0.40 mm for a detent.

### Reinforcement

`handleReinforcement` (default `none`) fastens the handle to the scoop for good, on top of `handleSnap`:

| Value | What holds the handle |
| --- | --- |
| `none` | Only `handleSnap`. |
| `threaded-insert` | Two countersunk screws into two brass heat-set inserts in the handle's ring. |
| `nut-bolt` | Two countersunk screws into two nuts in the handle's ring. No soldering iron needed. |

The bag sits between the container and the scoop, so a fastened handle still comes off with the scoop to change it. The detent
still helps: it holds the handle in place while you drive the screws in.

**Where:** both screws are on the grip side (+X), 21 mm either side of the middle, 8 mm above the cap's top (Z 152.5). That
places them beside the 26 mm grip, in the ring and the blade's solid root band. Nothing sits under the palm, the countersinks
stay above the funnel (Z 11 in the scoop) and below the sieve, and the bosses stay clear of the cap and the grip sheet.

**How:** each screw is driven horizontally from inside the scoop. Its countersunk head sits flush with the blade's inner face, so
clumps do not catch on it. It passes the blade's wall and the ring, into an insert or a nut in a boss on the ring's outer face.
- **In the scoop:** a clearance hole (ISO 273 medium for the thread, e.g. 3.4 mm for M3) through the wall. It is countersunk
  from the inner face: a rim as wide as the head plus 0.2 mm, as deep as the head's cylindrical edge, then 90° down to the hole.
- **On the handle:** the boss's face is where the screw's tip ends. The blade's inner face to the ring's outer face is always
  6.8 mm (3.2 + c + 3.6 − c: the seat's wall, see below), so the boss is `screw length − 6.8` deep (1.2 mm for an 8 mm screw, 9.2 mm for a 16 mm one). It is
  round about the screw's axis and runs straight up to the ring's top, which is on the print bed, so nothing overhangs.
  - **Insert:** a hole of the maker's recommended diameter and depth (`hole`, `holeDepth`) from the boss's face, with the maker's
    least wall (`wall`) round it. Melt the insert in from outside, flush with the face.
  - **Nut:** a pocket 0.2 mm wider than the nut's greatest size and 0.2 mm deeper than its greatest height (a nylon-insert nut's
    overall `h`). It is hexagonal (corners at the sides, flats top and bottom) or square. The nut goes in from outside, and the
    screw's pull presses it onto the pocket's floor.
  - Either way, the clearance hole runs on through the ring.

**The parts** are real items from the parts library ([adding-parts.md](adding-parts.md)):
- **`handleThread`:** M2, M2.5, M3 (default) or M4.
- **`handleInsert`, `handleNut`, `handleScrew`:** each offers only parts of the chosen thread (`part.filter`), and each is linked
  to the part's library page.

The contract offers a part when it fits (`handleScrewFits`, `handleInsertFits` and `handleNutFits` in
`packages/contracts/src/models.ts`, with the room in `HANDLE_FASTENER_SEAT`). A test keeps each list equal to the library's
fitting parts.

| Setting | Offered | Why |
| --- | --- | --- |
| Screws | ISO 10642 M3/M4 and ISO 7046-1 M2 to M4, 8 to 16 mm | Countersunk, with a head no higher than 2.4 mm (at least 0.8 mm of the 3.2 mm seat wall under it), a countersink within 4.2 mm of the axis, and a boss 0 to 10 mm deep |
| Inserts | CNC Kitchen and ruthex, M2 to M4 | Hole radius plus wall at most 6.5 mm, and a screw long enough exists |
| Nuts | ISO 4032, ISO 4035, ISO 10511 (M3/M4) and DIN 562, M2 to M4 | Pocket radius plus a 1.2 mm wall at most 6.5 mm, and a screw long enough exists |

ISO 10642 starts at M3, so the cross-recessed ISO 7046-1 screws cover M2 and M2.5. An M5 countersunk head is too high for the
wall.

**Validation:** the screw must reach far enough past the seat's wall and the clearance (`length − 3.2 − c`):
- **Insert:** its hole depth plus 0.4 mm of the ring.
- **Nut:** its height plus the 0.2 mm recess and a 1.2 mm floor.

The message names the shortest screw that works. For example, a 5.7 mm insert (6.7 mm hole) needs a 12 mm screw, and a 3 mm
insert needs an 8 mm one up to 0.4 mm clearance.

**In the editor:** changing the thread moves each part to the first one of that thread that the other settings accept. The
assembly preview shows the inserts or nuts in the handle, and a third step drives the screws in from inside the scoop.

## Sieve

| Parameter | SCAD | Default | Meaning |
| --- | --- | --- | --- |
| `sievePattern` | `SIEVE_PATTERN` | `slots` | `slots` (grid), `staggered` (alternate rows offset half a pitch), `round` or `hex` (close-packed rows 60° apart) |
| `gapWidth` | `GAP_WIDTH` | 7.2 | Slot width, hole diameter or hexagon size across flats (1 to 15) |
| `sieveSizing` | `SIEVE_SIZING` | `rows` | How the slots are sized (slot textures only): `rows` (by `sieveRows`) or `length` (by `gapLength`) |
| `sieveRows` | `SIEVE_ROWS` | 1 | Rows of slots, one above the other (1 to 5; slot textures sized by rows) |
| `gapLength` | `GAP_LENGTH` | 25 | Slot length (6 up to the sieve's height, at most 143; slot textures sized by length) |
| `gapSpacing` | `GAP_SPACING` | 5.6 | Solid bar between neighbouring gaps (1 to 15: at 1 mm, two to three lines of a 0.4 mm nozzle) |
| `sieveMargin` | `SIEVE_MARGIN` | 3.2 | Solid border to the root band, the bevel under the tip, the side walls' top and the front corners (at least 3 mm) |

The scraping tip has two more parameters, both advanced settings:

| Parameter | SCAD | Default | Meaning |
| --- | --- | --- | --- |
| `tipThickness` | `TIP_THICKNESS` | 0.8 | Thickness of the straight scraping edge (0.4 to 2): one to five lines of a 0.4 mm nozzle |
| `tipBevel` | `TIP_BEVEL` | 12 | How far down from the edge the inner face is bevelled (5 to 20). The sieve stays below it. |

The shell's wall is an advanced setting too, [`wallThickness`](#wall-thickness) (1.2 to 3.2, default 1.6).

## Wall thickness

`wallThickness` (`WALL_THICKNESS` in the container and the scoop, an advanced setting) sets the shell's wall: the container's and
the scoop's blade's, together. It is 1.2 to 3.2 mm in 0.1 mm steps, **1.6 mm by default**. 3.2 mm was the blade's wall before it was
a parameter (the container's was 2.4 mm), so today's shovel is the top of the range.

| Band | Range | Perimeters (0.4 mm nozzle) |
| --- | --- | --- |
| Thin | 1.2–1.6 mm | 3 to 4 |
| Standard | 1.6–2.4 mm | 4 to 6 |
| Heavy | 2.4–3.2 mm | more than 6 |

**Why 1.6.** A 0.4 mm nozzle prints a 0.45 mm line by default (see [Prusa's layers and perimeters guide](https://help.prusa3d.com/article/layers-and-perimeters_1748)):
one perimeter is about 0.45 mm and two just under 0.9 mm. Three to four perimeters is the usual choice for a handled functional
part, and strength comes mostly from perimeters, not infill ([CNC Kitchen's tests](https://www.cnckitchen.com/blog/brick-layers-make-3d-prints-stronger)),
but each extra one adds less. The old walls were 5 to 7 perimeters thick, mostly print time and weight. The loads here are a scraped
blade, a gripped handle and detents 0.35 mm deep. Nothing has been printed or load-tested at these walls: flex the blade's sides
and the container's hook on a first print before trusting the default.

**What follows the wall, and what does not:**
- **Follows:** the blade's inner face (so the inner corner radius, the sieve's layout, the funnel's height, the tip's bevel slope and
  the round top edge), the container's mouth (so the scoop's sleeve moves with it: `scoop.scad` takes the same `WALL_THICKNESS`), the
  cavity, and the dam's thickness (at most 2.4 mm, so that it stays clear of the band's start).
- **Floor:** `min(3.2, wall + 0.8)`, from 2 to 3.2 mm. The litter's weight bends it when the container hangs from its handle, and a
  plate's stiffness falls with the cube of its thickness, so it does not go as thin as the wall.
- **Root pad (container):** the hook's root is the weakest place: the whole container hangs from a sheet 26 mm wide and 3 mm thick,
  and it levers on the wall. A thinner wall gets the pad described under the container, so it is 2.4 mm there whatever the wall.
- **Screw pads (scoop):** a countersunk head needs the wall to be at least its height plus 0.8 mm (2.5 mm for M3). A thinner blade
  has a pad round each screw that makes it 3.2 mm there (`FASTENER_WALL`; a cone with 45° flanks and a 5.25 mm radius at its face). The
  screws' seat (`HANDLE_FASTENER_SEAT`: the head's plane, the ring's distance, the boss depth and the screws' reach) is therefore
  the same at every wall, and so is the validation of the screws, inserts and nuts. The funnel's top (11.8 mm over the cap's lower
  edges at every wall) stays under the countersinks: hence the 4.2 mm they may reach from the axis.
- **Does not follow:** the ring, the skirt, the sleeve, the cap's ceiling and the grip's sheets (fit and feel), and the detents: the
  container's grooves are in the lip, which is 4 mm thicker than the wall there, and the ring's are in its own wall.
- **Tip:** the scraping edge stays at least 0.4 mm thinner than the wall (`tipThickness` at most `wallThickness − 0.4`, so 0.8 mm at
  1.2), so that its bevel is one; the editor's slider ends there, and a value outside is rejected.

**Where the gaps go:** all round the blade's wall, on the back, the curved back corners and the sides.
- Along the wall: the layout is unrolled along the wall's inner face. `s` runs from the middle of the back (s = 0) across its flat
  part (|s| ≤ 39.4), round the corner (25.1 mm of arc at the inner face's radius, 17.6 mm less the wall: 16 mm at the default) and
  along the side (46.5 mm), up to where the front corners start (|s| = 111.0 at the default wall). Each gap is cut square to the wall:
  - **On the back and the sides:** straight through.
  - **In the corners:** radially, as the gap's outline seen from the corner's centre. There it is `gapWidth` wide along the inner
    face, and so are the bars `gapSpacing`, and both widen outward with the wall.
  - A gap is cut by the rule of the part its centre is on. Where it reaches over a corner's edge, the cut runs on far enough to
    go through the wall there too.
- From the bottom: the gaps start above an 18 mm solid **root band** over the cap's top (Z 8). That is where the blade's bending
  load is highest, and it covers the handle's 15 mm ring. The zone's bottom is at Z 26.
- At the top: the gaps stay under the tip's bevel (Z `scoopLength − tipBevel`, 115 by default), so they never cut the thin edge. On the sides they also stay
  under the falling top edge.
- Every limit is shrunk by the margin. Against the side walls' sloping top, the margin is measured square to the slope.
- What is left is the **sieve's height**, `sieveHeight = (scoopLength − tipBevel) − 26 − 2 × sieveMargin` (82.6 mm by default):
  on the back, whose top is the tip, one gap this tall just fits.

**How slots are sized:** by rows (the default) or by length.
- **By rows:** `sieveRows` rows and the bars between them fill the sieve's height exactly, so the slots are as long as it lets
  them be: `slot length = (sieveHeight − (sieveRows − 1) × gapSpacing) / sieveRows`. The bottom row starts one margin above the
  root band and, on the back, the top row ends one margin under the bevel. `gapLength` is not used (the editor hides it).
  - **Along the sides** the top falls, so each slot's height is chosen where it is: every row keeps its bottom all round, and
    a slot ends at the row's length or, if lower, one margin under the side walls' top (square to it) at its outer upper
    corner. It is cut if it is still at least as long as it is wide; a row with less room than that has no slot there.
  - The rows stay level, so the bars between them stay `gapSpacing` wide, staggered or not, and only whole slots are cut.
  The slots must still be at least as long as they are wide, which allows at most
  `floor((sieveHeight + gapSpacing) / (gapWidth + gapSpacing))` rows: 6 at the defaults, 4 on the shortest scoop. Validation
  names that number when there are more.
- **By length:** the slots are `gapLength` long, and as many rows as fit are cut. A slot can be no longer than the sieve's height,
  rounded down to the 0.5 mm step: 82.5 mm at the defaults, from 24 mm (the shortest scoop, the longest bevel and the widest
  margin) to 143 mm (the longest scoop, the shortest bevel and the narrowest margin), which is the schema's bound. The editor's
  slider ends at the limit for the current settings, and a slot that no longer fits once the scoop is shortened (or the bevel
  or the margin grown) is rejected with that limit.

**How they are laid out:**
- Columns are centred on s = 0 at a pitch of `gapWidth + gapSpacing`.
- Rows start one margin above the root band, at a pitch of `slot length + gapSpacing` (slots) or `pitch × √3/2` (round holes
  and hexagons).
- Only whole gaps are cut, so there are no slivers. A gap's top outer corner (the end farther from the back) is checked against
  the side walls' top, which falls away towards the front.
- The defaults give one row of 15 slots. On each side of the middle, going round from the back, they are 82.6 mm long on the
  back's flat part and in the corner, then 81.5, 47.4 and 12.6 mm along the side, under its falling top. Two rows give 26 slots
  (38.5 mm on the back), five give 63 (12.04 mm). (Both depend on the wall: it sets the inner corner radius.)
- Sized by length at 25 mm, the defaults give 24 slots in two rows: 14 centred on the back's flat part and, on each side, 2 in
  the corner and 3 on the side. The shortest scoop (90 mm) has room for 13 of them in one row, the longest (180 mm) for 48 in
  four.

`sieveGaps()` (each gap as `[s, z, length]`, scoop.scad's `GAPS`) and `scoopSideTop()` in the contract mirror this layout, with the blade's dimensions in `SCOOP_BLADE` and its length
in `scoopLength`; `sieveHeight()`, `slotLength()`, `slotLengthLimit()` and `sieveRowsLimit()` mirror scoop.scad's `SIEVE_HEIGHT`
and `SLOT_LENGTH` and the limits above. They give the editor's gap count, the slot length's range (the model's `limits`, see
`controlRange()`) and the validation: at least one gap, at most `MAX_SIEVE_GAPS` = 600, slots at least as long as they are
wide, and no longer than the sieve's height. Gaps and bars go down to 1 mm, so fine sieves reach the limit sooner: 1 mm round
holes and bars would make 3938 gaps at the default length, and 1 mm slots 6 mm long 905, so validation asks for larger gaps or
wider bars. Five rows of 1 mm slots and bars (427 gaps) render in about 2 s. At the default length 3 mm round holes with 3 mm
bars and margin and a 5 mm bevel have 455 gaps and render in about 2 s; on the longest scoop they would have 720. Tests pin the layout
to counts recorded from the SCAD file's `SIEVE_GAPS` echo, at 90, 127 and 180 mm, sized by rows and by length, and at several walls (the counts above are for the default 1.6 mm; the tests' tables were recorded at 3.2 mm, the blade's wall before it was a parameter). The layout itself was compared gap by gap with the echo of `GAPS` at every wall from 1.2 to 3.2 mm.
Sized by rows, the slots along the sides are shorter; the volume test counts each gap at its own length. `npm run test:renderer` checks that, at the
default fit, tip and length, the scoop's volume plus the gaps' volume is the same solid for every texture. There, a gap in a corner counts
(R + r) / 2r times its area × wall (about 1.11 at the default), because it widens with the radius.

## Assembly

1. **Set the scoop on the container.** It comes down from 60 mm above: the sleeve into the mouth, the skirt around the lip, the
   ceiling onto the lip's top.
2. **Lower the handle over the scoop.** It comes down from 200 mm above, around the blade. Its ring lands on the cap's top, and
   its sheet comes to rest on the container's, a clearance off it, all along the slope and the grip.
3. **Drive the screws in** (with a `handleReinforcement` only). The two countersunk screws go in from inside the scoop, starting
   their length plus 8 mm inward, through the blade's wall into the inserts or nuts. The inserts or nuts are already in the
   handle and come down with it in step 2.

`npm run check:assembly -- litter-shovel` samples every step as usual. It also sweeps each step's last 10 mm in 0.25 mm steps,
where the detents engage, and holds those samples to a looser snap tolerance (10 mm³, `--snap-tolerance`). Results:

| Settings | Assembled, exploded, steps | Scoop's last 10 mm | Handle's last 10 mm |
| --- | --- | --- | --- |
| Defaults (detents, 0.2 mm) | 0.00 mm³ | 3.00 mm³ (1.75 mm before seated) | 2.84 mm³ (2.25 mm before seated) |
| Friction fits, 0.1 mm | 0.00 mm³ | 0.00 mm³ | 0.00 mm³ |
| Detents, 0.1 mm, finest hexagons | 0.00 mm³ | 3.06 mm³ | 0.46 mm³ |
| Detents, 0.6 mm, engagement 0.4 | 0.00 mm³ | 12.51 mm³ (over 10) | 7.40 mm³ |
| Grip to the floor, 5 supports of 4 mm | 0.00 mm³ | 3.00 mm³ | 2.84 mm³ |
| Longest scoop, widest dam (180 mm, 15 mm) | 0.00 mm³ | 3.00 mm³ | 2.84 mm³ |
| Shortest scoop, no dam (90 mm, 0) | 0.00 mm³ | 3.00 mm³ | 2.84 mm³ |
| M3 inserts or M3 nuts (default screws) | 0.00 mm³ | 3.00 mm³ | 2.84 mm³ |
| M2 square nuts, M2 × 8; M2.5 inserts, M2.5 × 10 | 0.00 mm³ | 3.00 mm³ | 2.84 mm³ |
| M4 nylon-insert nuts, M4 × 12, 0.6 mm | 0.00 mm³ | 2.88 mm³ | 0.43 mm³ |
| M4 inserts, M4 × 16, friction, 0.1 mm | 0.00 mm³ | 3.06 mm³ | 0.00 mm³ |

With a reinforcement, the screws, inserts and nuts are checked too, from the generic models in `parts/`. A screw's thread is drawn
at its minor diameter, a nut's or insert's bore at the thread's diameter, and an insert as the hole it fills. The step that drives
the screws in shares 0.00 mm³ in every case above.

That shared volume is only the bumps passing the mating wall before they drop into their grooves. Seated, every detent clears its
groove. The largest bumps (0.6 mm clearance with 0.4 mm engagement, a 1 mm ridge) exceed the default snap tolerance: check them
with `--snap-tolerance 15`.

## Printing and limits

- **The container** stands on its floor. The lip has a 45° underside, the handle's slope, its fins' lower edges and the dam's
  underside are at 45°, and the handle's bend is round. A round or rectangular handle's slope is a solid slab with a 45° underside
  (a round one's normals are all at least 45° from straight down), and a curved handle keeps every tangent within 45° of vertical. With the default `open` grip end, the grip's tip starts 30 mm above the bed (26 mm for a round or rectangular one of 14 mm): let the slicer add supports
  under it (they are not modelled). With `floor`, the sheet starts on the bed and nothing needs support.
- **The scoop** prints on its cap: the sleeve's and the skirt's edges are on the bed, the U's ceiling is a 7.4 mm bridge, and the
  funnel is a top surface. The tip's bevel faces up and inward, and the round top edge is a top surface, so the blade needs no support either.
- **Fine sieves:** gaps and bars go down to 1 mm. A 1 mm bar is only two to three lines of a 0.4 mm nozzle, and a 1 mm gap can
  close up if the printer over-extrudes, so print a small test first; 3 mm or more is sturdier.
- **The handle** prints upside down on its ring's top. The sheet rises from it along its length, its strong direction. The
  reinforcement's bosses also stand on the bed; their holes and pockets are horizontal, at most 5.7 mm across.
- **The gap between the two grip halves** is the clearance. The fist closes it: the handle part's sheet is a long, thin
  cantilever and flexes that far easily.
- **Material:** each grip half is a 3 mm sheet instead of a solid bar, and the container's handle has no arm, gusset or foot.
- **Tuning:** printed tolerances vary by machine, so adjust the clearance first, then the engagements. How firmly the detents
  click, and how the squeeze feels in the hand, still need a printed prototype.
- **Designed for PLA.** Only the bumps, the sleeve and the blade's wall flex when a detent engages, by a few tenths of a
  millimetre over long straight sides.
- **The bag:** fold it about 5 mm over the lip, so that the skirt covers it. A longer fold hangs below the skirt, and at the
  front it lies over the root of the container's handle, under the handle part's sheet. Inside, the bag drapes over the dam. Leave it loose enough
  to fill the pocket behind the dam.

## Mesh hygiene

`inspectStl` rejects zero-area triangles and edges shared by more than two faces. The rounded rectangles are all drawn with 64
segments (`$fn`), so that the lip's chamfer and the funnel meet the walls at matching vertices. The dam is the exception: its
outlines have 70 segments (not a multiple of 8, so that it has no vertex at 45° like the walls' 64), so that the line where its
underside meets the mouth's wall never runs into one of the wall's vertices (with 64 it left a zero-area triangle in a back
corner), and it ends 0.07 mm past where the back corners end. Every dam width from 0.5 to 15 mm, at every wall from 1.2 to 3.2 mm
in 0.1 mm steps, passes the same test as `inspectStl` (zero-area triangles at float precision). The container's outer shell and
its cavity are each a single convex hull, with no seam where the band starts. The funnel's solid stops half a millimetre inside the blade's wall, so that the cap and the blade share no coplanar outer face, and the blade's
round top edge is a chain of spheres 0.13 mm larger than their narrowest point needs (0.1 mm left a zero-area triangle at some
walls), hulled pairwise round one closed loop of the wall's centre line that has no point on Y = 0 (two mirrored half chains met
there, and their nearly tangent surfaces left a zero-area triangle or float32-identical vertices at the front's middle at about
one wall in eight). A sieve gap through a curved corner widens with the wall only inside it: through each face it is a straight
prism, so the facets of a slot's round ends that the faces meet are flat (a hull all the way through split them along diagonals
that could cross the inner face a micrometre off the next staggered row's side: 2.1 mm slots with 1 mm bars failed so). The wall thickness was swept in 0.1 mm steps from 1.2 to 3.2 mm, on the container (dam width, clearance, grip end) and on the
scoop (length, bevel, tip, snap modes, clearance, reinforcement), each render checked for zero-area triangles at float precision
(the test of `inspectStl`); `npm run test:renderer` renders the extremes. The root pad is a hull of two rounded plates whose 45° flanks carry on 0.5 mm into the wall; so do the screws' pads (0.3 mm). A detent ridge's flanks carry on 0.3 mm into its
wall, and a groove's start 0.3 mm in front of its face, so that no edge of either lies in the face. Each grip sheet is a single
`polyhedron()` swept along its sampled seam, with its cross-section computed per sample (flat seam face, rounded outer edges,
the tip's quarter round), rather than built from overlapping CSG pieces whose faces would nearly coincide.

Two places are still fragile, found by the geometry sweep (`npm run test:sweep`, about 1 random setting in 25): the round top
where it turns the front corners (z ≈ 26.1, where neighbouring sphere hulls meet at a shallow angle), and large sieve gaps that
straddle the line where the back's flat wall meets a corner. Binary STL's float32 coordinates turn the slivers there into
zero-area triangles; the worker repairs those without moving any vertex (see docs/interfaces.md), logs a warning and counts it
in `canfactory_mesh_repairs`, so these settings still render. The nightly sweep fails on them until they are fixed here.
