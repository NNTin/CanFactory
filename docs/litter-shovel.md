# Litter shovel

An original three-part design (`models/litter-shovel/`, CC BY 4.0): a **container** that a liner bag fits into, a cat-litter
sifting **scoop**, and a **handle** with a grip. It is registered as the `litter-shovel` assembly model
(`packages/contracts/src/models.ts`).

The whole shovel is carried by the handle. The parts stack **container, scoop, handle**, each set on from above. Every part is a
**closed ring**, and they meet on flat faces:
- The container's lip carries the scoop's cap, with the bag folded over the lip pinched between them.
- The cap's top carries the handle's ring.
- The container's finger lever lies just under the handle's grip, as wide as the grip, so the two make one grip. Pulling the lever
  up with the index finger, while the palm presses the grip down, pinches the scoop's cap between the lip and the ring. That
  clamps all three parts.

## Parts

Each part is modelled as it prints, Z up, in millimetres, and none needs support. No part's size depends on the parameters.

| Part | File | Size (X × Y × Z) | Prints | Assembled at |
| --- | --- | --- | --- | --- |
| Container | `container.scad` | 111.25 × 114.8 × 144 | standing on its floor | Z 0 |
| Scoop | `scoop.scad` | 88.9 × 121.2 × 127 | on its cap | Z 136.5 (the cap's ceiling on the lip at 141.5) |
| Handle | `handle.scad` | 198.9 × 121.2 × 20 | on its flat underside | Z 144.5 (on the cap's top) |

### Container

- **Body:** a rounded-rectangle frustum with a 2.4 mm wall on a 3.2 mm floor, 64.7 × 97 at the floor. The top 13 mm is straight
  (the **band**, 74.5 × 106.8, corner radius 14).
- **Lip:** it ends the band with a closed lip, 4 mm wide and 3 mm thick, above a 45° chamfer. Its flat top, at Z 141.5 and
  6.4 mm wide from the mouth to its edge, is the container's mating face.
- **Finger lever:** 34 mm wide, as wide as the grip, at the front (+X).
  - Its arm runs out under the scoop's skirt, 0.5 mm clear of it.
  - It then rises outside the skirt to an 8 mm pad from X 45 to 70, whose top is 0.5 mm under the grip's underside.
  - Its underside rises at 45° from the wall to the pad's tip, so it prints without support and forms a deep fin, not a thin
    cantilever.

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
- **Grip:** pan-style, a closed loop pointing straight out at the front (+X), 20 mm high and 34 mm wide, with fully rounded ends,
  to X 154.45.
  - Its root is solid out to X 74, over the container's finger lever.
  - A 12 mm wide finger slot runs from there to X 140.
  - The top edges of the ring and the grip are eased by a 2 mm, 45° chamfer (0.25 mm steps).

The ring and the grip stand on one flat face, so the grip's layers run along it, its strong direction.

## How it holds together

| Situation | Load path |
| --- | --- |
| Standing on a table | Everything bears on flat faces: the container on its floor, the cap on the lip, the ring on the cap. |
| Carrying by the grip | The index finger pulls the container's lever up while the palm holds the grip. That pinches the cap between the lip and the ring, and clamps the three parts. Without the squeeze, `scoopSnap` holds the container on the scoop and `handleSnap` holds the scoop on the handle. |
| Scooping and sifting | The blade's loads go through its base into the ring and the grip. The sleeve and the skirt also locate the cap on the container. |
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
   its grip's root comes to rest 0.5 mm above the finger lever.

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

- **The container** stands on its floor. The lip and the lever have 45° undersides.
- **The scoop** prints on its cap: the sleeve's and the skirt's edges are on the bed, the U's ceiling is a 7.4 mm bridge, and the
  funnel is a top surface.
- **The handle** prints on its flat underside.
- **Tuning:** printed tolerances vary by machine, so adjust the clearance first, then the engagements. How firmly the detents
  click, and how the squeeze feels in the hand, still need a printed prototype.
- **Designed for PLA.** Only the bumps, the sleeve and the blade's wall flex when a detent engages, by a few tenths of a
  millimetre over long straight sides.
- **The bag:** fold it about 5 mm over the lip, so that the skirt covers it. A longer fold hangs below the skirt, and at the
  front it drapes over the lever's arm.

## Mesh hygiene

`inspectStl` rejects zero-area triangles and edges shared by more than two faces. The rounded rectangles are all drawn with 64
segments (`$fn`), so that the lip's chamfer and the funnel meet the walls at matching vertices. The container's outer shell and
its cavity are each a single convex hull, with no seam where the band starts. A detent ridge's flanks carry on 0.3 mm into its
wall, and a groove's start 0.3 mm in front of its face, so that no edge of either lies in the face.
