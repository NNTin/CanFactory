# Litter shovel

An original three-part design (`models/litter-shovel/`, CC BY 4.0): a cat-litter sifting **scoop**, a **container** that a
liner bag fits into, and a **handle** with a grip, which holds them together. It is registered as the `litter-shovel` assembly
model (`packages/contracts/src/models.ts`).

The whole shovel is carried by the handle. Every part is a **closed ring**, and each joint is a pair of flat faces: one rests on
the other, and a close fit or a detent keeps them together. Nothing is a flexing peg, finger or clip.

## Parts

Each part is modelled as it prints, Z up, in millimetres. None needs support.

| Part | File | Size (X × Y × Z) at 0.2 mm clearance | Prints | Assembled at |
| --- | --- | --- | --- | --- |
| Container | `container.scad` | 136.25 × 114.8 × 141.5 | standing on its floor | Z 0 |
| Handle | `handle.scad` | 140.85 × 120 × 20 | on its flat underside | Z 119.5 (the ledge) |
| Scoop | `scoop.scad` | 82.5 × 114.8 × 136 | on its cap | Z 131.5 (the handle's deck) |

The handle's size grows with the clearance: 140.65 + c by 119.6 + 2c. The other two parts don't change.

### Container

- **Body:** a rounded-rectangle frustum with a 2.4 mm wall on a 3.2 mm floor. It is 64.7 × 97 at the floor and straight (the
  **band**, 74.5 × 106.8, corner radius 14) for its top 32 mm, up to the rim at Z 141.5. The bag goes inside and folds over the rim.
- **Ledge:** a closed ring around the band, 22 mm below the rim. Its top is flat at Z 119.5 and stands out 4 mm. It is 3 mm thick
  above a 45° chamfer down to the band, so its underside prints without support. The handle rests on its top.
- **Finger lever:** a 14 mm wide fin at the front (+X). Its top continues the ledge's plane out to X 95, under the handle's grip.
  Its underside rises at 45° from the wall to an 8 mm tip, so it is a deep, printable beam and not a thin cantilever.

### Handle

- **Ring:** closed, 6.4 mm wide and 12 mm high. It comes down over the band (one clearance per side) and rests on the ledge.
  Its top is the **deck** the scoop stands on.
- **Upstand:** a 2.4 mm wall, 8 mm high, around the deck's outer edge. The scoop fits inside it, one clearance per side.
- **Grip:** a flat D-loop, 20 mm high like the ring and upstand. The bar is 18 mm deep (X 79 to 97) and the arms 10 mm wide. The
  opening for the fingers is 35 × 90 mm. Its top edges are eased by a 2 mm, 45° chamfer (0.25 mm steps). Its flat underside
  lies on the container's finger lever.

The ring, the upstand and the grip all stand on one flat face. The grip's layers therefore run along it, its strong direction.

### Scoop

- **Cap:** a closed U-shaped ring that sits over the rim.
  - Its outer wall (3.2 mm, 82.5 × 114.8) stands on the handle's deck, inside the upstand.
  - Its inner sleeve (2 mm) reaches 10 mm down into the container's mouth.
  - The U leaves 0.8 mm on each side of the rim and 1 mm above it for the bag.
  - The cap's top is a 45° funnel from the blade's inside down into the sleeve, so clumps fall into the bag and never onto the
    rim or the folded bag.
- **Blade:** the outer wall rises above the cap. Two limits shape it, and each acts on its own walls, so they meet without a step:
  - **Back wall (−X):** flat, 3.2 mm thick up to its top edge, and carries the sieve. Its top is a circular arch over the wall's
    flat part, from the shoulders (Z 110) at |Y| 39.4 to the apex (Z 136).
  - **Side walls:** stay at the shoulders' height over the back corners, then fall in a straight line to a 22 mm lip at the front
    (+X).
  - Together they make a channel. Its depth, from the back wall's outer face, is 50 mm at Z 50, 34 mm at Z 80 and 23 mm at Z 100.

## How it holds together

| Situation | Load path |
| --- | --- |
| Standing on a table | Everything bears on flat faces: the container on its floor, the handle on the ledge, the scoop on the deck. |
| Carrying by the grip | The index finger pulls the container's finger lever up against the grip's underside. That clamps the container to the handle, and the ledge presses against the ring. With `handleSnap` = `detent`, the detent also holds the container without the squeeze. |
| Scooping and sifting | The blade's loads go through the cap's outer wall into the deck and the upstand, then the ring and the grip. The sleeve and the U also locate the scoop on the rim. `scoopSnap` keeps the scoop from lifting out while you shake it. |
| Changing the bag | Lift the scoop off. The handle stays on the container. |

The handle has to go onto the container **from above**. The finger lever sticks out below the ring, so a ring sliding up from the
floor would have to pass it, and could only do that with a slot cut through it. That is why the ring rests *on* the ledge, and why
the squeeze (or the detent) carries the container's weight when you lift it.

### Snap settings

`handleSnap` (the handle on the container) and `scoopSnap` (the scoop in the handle) are each `friction` or `detent`, and both
default to `detent`. The detents are sized as on the cigarette case ([cigarette-case-snap.md](cigarette-case-snap.md)):

- A bump stands `clearance + engagement` proud, so it reaches the engagement past the mating wall at any clearance.
- Its groove clears it by the clearance on every side: it is `engagement + clearance` deep.
- Each bump is a 16 mm ridge with 45° flanks and ends, in the middle of each of the four straight sides. The four sides are two
  opposing pairs.

| Joint | Bumps | Grooves | Default engagement (recommended) |
| --- | --- | --- | --- |
| Handle on the container | on the band, 6 mm above the ledge (mid-way up the ring) | in the ring | 0.20 mm (0.12–0.30) |
| Scoop in the handle | on the upstand, 4 mm above the deck | in the cap's outer wall | 0.15 mm (0.10–0.25) |

Both sit where the moving part's leading edge comes to rest, so they rub only over the last 6 mm (handle) and 4 mm (scoop) of the
push. The engagements are advanced settings, shown only while their joint uses a detent. The `clearance` (0.1 to 0.6, default 0.2)
recommends 0.10–0.25 mm for a friction fit and 0.20–0.40 mm for a detent.

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
- From the bottom: they start above a 10 mm solid **root band** over the funnel's top (Z 17), where the blade's bending load is
  highest. That puts the zone's bottom at Z 27.
- At the top: they stay under the arch.
- Every limit is shrunk by the margin.

**How they are laid out:**
- Columns are centred on Y = 0 at a pitch of `gapWidth + gapSpacing`.
- Rows start one margin above the root band, at a pitch of `gapLength + gapSpacing` (slots) or `pitch × √3/2` (round holes and
  hexagons).
- Only whole gaps are cut, so there are no slivers. A gap's top outer corner is checked against the arch, which falls away from
  the middle.
- The defaults give 5 × 3 slots at Y = 0, ±12.8 and ±25.6.

`sieveGaps()` and `sieveArch()` in the contract mirror this layout. They give the editor's gap count and the validation: at least
one gap, at most `MAX_SIEVE_GAPS` = 400, and slots at least as long as they are wide. Tests pin them to counts recorded from the
SCAD file's `SIEVE_GAPS` echo. `npm run test:renderer` checks that, at the default fit, the scoop's volume plus the gaps' volume is
the same solid for every texture.

## Assembly

1. **Lower the handle onto the container's ledge.** It comes down from 40 mm above, over the rim. Its grip's underside lands on
   the finger lever as its ring lands on the ledge.
2. **Set the scoop on the handle.** It comes down from 100 mm above. Its cap straddles the rim, and its outer wall stands on the
   deck inside the upstand.

`npm run check:assembly -- litter-shovel` samples every step as usual. It also sweeps each step's last 10 mm in 0.25 mm steps,
where the detents engage, and holds those samples to a looser snap tolerance (10 mm³, `--snap-tolerance`). Results:

| Settings | Assembled, exploded, steps | Handle's last 10 mm | Scoop's last 10 mm |
| --- | --- | --- | --- |
| Defaults (detents, 0.2 mm) | 0.00 mm³ | 1.29 mm³ (5.75 mm before seated) | 0.69 mm³ (3.00 mm before seated) |
| Friction fits, 0.1 mm | 0.00 mm³ | 0.00 mm³ | 0.00 mm³ |
| Detents, 0.1 mm, finest hexagons | 0.00 mm³ | 4.20 mm³ | 0.70 mm³ |
| Detents, 0.6 mm, engagement 0.4 | 0.00 mm³ | 12.51 mm³ (over 10) | 8.43 mm³ |

That shared volume is only the bumps passing the mating wall before they drop into their grooves. Seated, every detent clears its
groove. The largest bumps (0.6 mm clearance with 0.4 mm engagement, a 1 mm ridge) exceed the default snap tolerance: check them
with `--snap-tolerance 15`.

## Printing and limits

- **The container** stands on its floor. The ledge and the lever have 45° undersides.
- **The handle** prints on its underside: the ring's bottom, which rests on the ledge, and the grip's, which lies on the lever.
- **The scoop** prints on its cap: the U's top is a 4 mm bridge, and the funnel is a top surface.
- **Tuning:** printed tolerances vary by machine, so adjust the clearance first, then the engagements. How firmly a detent
  clicks, and how the squeeze feels in the hand, still need a printed prototype.
- **Designed for PLA.** Only the bumps and the container's 2.4 mm band flex when a detent engages: a few tenths of a millimetre
  over the long straight sides, well within PLA's elastic range.
- **The bag:** fold it about 1 cm over the rim. A longer fold ends up on the deck, under the scoop's cap, where it is pinched and
  held.

## Mesh hygiene

`inspectStl` rejects zero-area triangles and edges shared by more than two faces. The rounded rectangles are all drawn with 64
segments (`$fn`), so that the ledge's chamfer and the funnel meet the walls at matching vertices. The container's outer shell and
its cavity are each a single convex hull, with no seam where the band starts. A detent ridge's flanks carry on 0.3 mm into its
wall, and a groove's start 0.3 mm outside its face, so that no edge of either lies in the face.
