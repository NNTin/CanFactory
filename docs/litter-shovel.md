# Litter shovel

An original three-part design (`models/litter-shovel/`, CC BY 4.0): a **container** that a liner bag fits into, a cat-litter
sifting **scoop**, and a **handle** with a grip. It is registered as the `litter-shovel` assembly model
(`packages/contracts/src/models.ts`).

The whole shovel is carried by the grip. The parts stack **container, scoop, handle**, each set on from above. Every part is a
**closed ring**, and they meet on flat faces:
- The container's lip carries the scoop's cap, with the bag folded over the lip pinched between them.
- The cap's top carries the handle's ring.
- The container has its own handle, like a measuring jug's, so it can be carried on its own. The handle part's grip curves out
  over it and runs down along it on matching faces, so the two handles become one grip: the container's is the finger side, the
  handle part's the palm side.
- Held in the fist, the two halves are pressed together. That ties the container to the handle, with the scoop's cap trapped
  between the lip and the ring, and so clamps all three parts.

## Parts

Each part is modelled as it prints, Z up, in millimetres, and none needs support. No part's size depends on the parameters.

| Part | File | Size (X × Y × Z) | Prints | Assembled at |
| --- | --- | --- | --- | --- |
| Container | `container.scad` | 117.25 × 114.8 × 141.5 | standing on its floor | Z 0 |
| Scoop | `scoop.scad` | 88.9 × 121.2 × 127 | on its cap | Z 136.5 (the cap's ceiling on the lip at 141.5) |
| Handle | `handle.scad` | 132.85 × 121.2 × 99.5 | upside down, on its ring's top | Z 159.5, turned over about X (its ring on the cap's top at 144.5) |

### Container

- **Body:** a rounded-rectangle frustum with a 2.4 mm wall on a 3.2 mm floor, 64.7 × 97 at the floor. The top 13 mm is straight
  (the **band**, 74.5 × 106.8, corner radius 14).
- **Lip:** it ends the band with a closed lip, 4 mm wide and 3 mm thick, above a 45° chamfer. Its flat top, at Z 141.5 and
  6.4 mm wide from the mouth to its edge, is the container's mating face.
- **Handle:** a closed jug handle at the front (+X), 26 mm wide, so the container can be carried on its own like a measuring jug.
  - Its **arm** leaves the wall under the lip. Its flat top at Z 131 stays under the scoop's skirt, which ends at 136.5.
  - Its **bar** runs down from the arm to the floor, 14 mm thick (X 62 to 76), with a 25 mm finger opening to the wall. The bar's
    finger-side edges are rounded (5 mm). Its outer face is flat and joins the arm's top in a 20 mm curve: these are the faces the
    handle part's grip lies on.
  - A **foot** on the floor closes the loop.
  - The opening's top is a 45° gusset under the arm, and its corners are rounded (6 mm). Nothing overhangs, so it prints without
    support.

### Scoop

- **Cap:** a closed U-shaped ring over the lip.
  - Its flat **ceiling** sits on the lip's top.
  - Its **sleeve** reaches 5 mm into the mouth. Its outer face is the mouth less the clearance; its inner face is fixed, 2.2 mm
    inside the mouth.
  - Its 2.4 mm **skirt** hangs 5 mm around the lip, 0.8 mm clear of it for the bag.
  - The cap's top, 3 mm above the ceiling, is 88.9 × 121.2, flush with the skirt. The handle's ring sits on it.
  - Inside, a 45° funnel leads from the blade into the sleeve, so clumps fall into the bag and never onto the rim or the fold.
- **Blade:** a 3.2 mm wall, 81.7 × 114 outside, rising from the cap 3.6 mm inside its edge, which leaves room for the ring. Two
  limits shape it, each acting on its own walls, so they meet without a step:
  - **Back wall (−X):** flat, full thickness up to its top edge, and carries the sieve. Its top is a circular arch over the wall's
    flat part (|Y| ≤ 39.4), from the shoulders at Z 101 to the apex at Z 127.
  - **Side walls:** stay at the shoulders' height over the back corners, then fall in a straight line to the front (+X), 18 mm
    above the cap.
  - Together they make a channel. Its depth, from the back wall's outer face, is 49 mm at Z 50, 31 mm at Z 80 and 18 mm at Z 100.

### Handle

- **Ring:** closed, 15 mm high and 3.6 mm wide less the clearance. It comes down around the blade's base, one clearance clear of
  it, and sits flat on the cap's top, flush with the skirt.
- **Grip:** the palm side of the shovel's grip, 26 mm wide like the container's handle.
  - It leaves the ring's outer face over the ring's full height and comes out over the container's handle. Its outer face curves
    (26 mm) from the ring's top into the bar.
  - It runs down along the container's bar to Z 60, 12 mm thick, with a round lower end and rounded palm-side edges (5 mm).
  - Its inner face is the container's handle profile (arm top, 20 mm curve, bar face) grown by 0.4 mm. Below the ring it keeps a
    clearance outside the scoop's skirt.
  - Together with the container's bar it makes a 26.4 × 26 mm grip from Z 60 up to the curve.
- **Printing:** the handle prints upside down, with the ring's top and the grip's top on the bed, so that the grip rises from
  them with nothing overhanging. The assembly turns it over (pose rotation 180° about X).

## How it holds together

| Situation | Load path |
| --- | --- |
| Standing on a table | Everything bears on flat faces: the container on its floor, the cap on the lip, the ring on the cap. |
| Carrying by the grip | The fingers take the container's handle and the palm the handle part's. The container hangs on its own handle, and the stack sits on it. Squeezed together, the halves fix the container to the handle, with the cap trapped between the lip and the ring. If you hold only the palm half, `scoopSnap` holds the container on the scoop and `handleSnap` holds the scoop on the handle. |
| Scooping and sifting | The blade's loads go through its base into the ring and the handle part's grip, then the hand. The sleeve and the skirt also locate the cap on the container. |
| Carrying the container alone | By its own handle, like a measuring jug. |
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

## Sieve

| Parameter | SCAD | Default | Meaning |
| --- | --- | --- | --- |
| `sievePattern` | `SIEVE_PATTERN` | `slots` | `slots` (grid), `staggered` (alternate rows offset half a pitch), `round` or `hex` (close-packed rows 60° apart) |
| `gapWidth` | `GAP_WIDTH` | 7.2 | Slot width, hole diameter or hexagon size across flats (3 to 15) |
| `gapLength` | `GAP_LENGTH` | 25 | Slot length (slot textures only) |
| `gapSpacing` | `GAP_SPACING` | 5.6 | Solid bar between neighbouring gaps (at least 3 mm: 7 lines of a 0.4 mm nozzle) |
| `sieveMargin` | `SIEVE_MARGIN` | 3.2 | Solid border to the root band, the corners and the arch (at least 3 mm) |

**Where the gaps go:**
- Across the wall: its flat part, |Y| ≤ 39.4.
- From the bottom: they start above an 18 mm solid **root band** over the cap's top (Z 8). That is where the blade's bending
  load is highest, and it covers the handle's 15 mm ring. The zone's bottom is at Z 26.
- At the top: they stay under the arch.
- Every limit is shrunk by the margin.

**How they are laid out:**
- Columns are centred on Y = 0 at a pitch of `gapWidth + gapSpacing`.
- Rows start one margin above the root band, at a pitch of `gapLength + gapSpacing` (slots) or `pitch × √3/2` (round holes and
  hexagons).
- Only whole gaps are cut, so there are no slivers. A gap's top outer corner is checked against the arch, which falls away from
  the middle.
- The defaults give 13 slots: 5 columns at Y = 0, ±12.8 and ±25.6, in three rows, the top row without its two outer slots.

`sieveGaps()` and `sieveArch()` in the contract mirror this layout. They give the editor's gap count and the validation: at least
one gap, at most `MAX_SIEVE_GAPS` = 400, and slots at least as long as they are wide. Tests pin them to counts recorded from the
SCAD file's `SIEVE_GAPS` echo. `npm run test:renderer` checks that, at the default fit, the scoop's volume plus the gaps' volume is
the same solid for every texture.

## Assembly

1. **Set the scoop on the container.** It comes down from 60 mm above: the sleeve into the mouth, the skirt around the lip, the
   ceiling onto the lip's top.
2. **Lower the handle over the scoop.** It comes down from 200 mm above, around the blade. Its ring lands on the cap's top, and
   its grip comes to rest 0.4 mm outside the container's handle, all along it.

`npm run check:assembly -- litter-shovel` samples every step as usual. It also sweeps each step's last 10 mm in 0.25 mm steps,
where the detents engage, and holds those samples to a looser snap tolerance (10 mm³, `--snap-tolerance`). Results:

| Settings | Assembled, exploded, steps | Scoop's last 10 mm | Handle's last 10 mm |
| --- | --- | --- | --- |
| Defaults (detents, 0.2 mm) | 0.00 mm³ | 3.00 mm³ (1.75 mm before seated) | 2.84 mm³ (2.25 mm before seated) |
| Friction fits, 0.1 mm | 0.00 mm³ | 0.00 mm³ | 0.00 mm³ |
| Detents, 0.1 mm, finest hexagons | 0.00 mm³ | 3.06 mm³ | 0.46 mm³ |
| Detents, 0.6 mm, engagement 0.4 | 0.00 mm³ | 12.51 mm³ (over 10) | 7.40 mm³ |

That shared volume is only the bumps passing the mating wall before they drop into their grooves. Seated, every detent clears its
groove. The largest bumps (0.6 mm clearance with 0.4 mm engagement, a 1 mm ridge) exceed the default snap tolerance: check them
with `--snap-tolerance 15`.

## Printing and limits

- **The container** stands on its floor and its handle's foot. The lip has a 45° underside, and the handle's arm a 45° gusset.
- **The scoop** prints on its cap: the sleeve's and the skirt's edges are on the bed, the U's ceiling is a 7.4 mm bridge, and the
  funnel is a top surface.
- **The handle** prints upside down on its ring's top. The grip rises from it along its length, its strong direction.
- **The gap between the two grip halves** is 0.4 mm. The fist closes it: the handle part's grip is a 70 mm cantilever and flexes
  that far easily.
- **Tuning:** printed tolerances vary by machine, so adjust the clearance first, then the engagements. How firmly the detents
  click, and how the squeeze feels in the hand, still need a printed prototype.
- **Designed for PLA.** Only the bumps, the sleeve and the blade's wall flex when a detent engages, by a few tenths of a
  millimetre over long straight sides.
- **The bag:** fold it about 5 mm over the lip, so that the skirt covers it. A longer fold hangs below the skirt, and at the
  front it lies on the container handle's arm, under the handle part's grip.

## Mesh hygiene

`inspectStl` rejects zero-area triangles and edges shared by more than two faces. The rounded rectangles are all drawn with 64
segments (`$fn`), so that the lip's chamfer and the funnel meet the walls at matching vertices. The container's outer shell and
its cavity are each a single convex hull, with no seam where the band starts. A detent ridge's flanks carry on 0.3 mm into its
wall, and a groove's start 0.3 mm in front of its face, so that no edge of either lies in the face.
