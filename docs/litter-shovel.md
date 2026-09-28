# Litter shovel

An original three-part design (`models/litter-shovel/`, CC BY 4.0): a cat-litter sifting **scoop**, a **container** that a
liner bag fits into, and a **handle** that clips the scoop onto the container for storage. It is registered as the
`litter-shovel` assembly model (`packages/contracts/src/models.ts`). The parameters change only the sieve; every fit is fixed.

## Parts

All three are modelled in the container's frame (Z up, millimetres) and printed as generated.

| Part | File | Size (X × Y × Z) | Assembled at |
| --- | --- | --- | --- |
| Container | `container.scad` | 110.95 × 106.8 × 162.5 | Z 0 |
| Scoop | `scoop.scad` | 87.4 × 119.7 × 141.8 | Z 126 |
| Handle | `handle.scad` | 139.8 × 125.7 × 74.29 | Z 140 − `DROP` (49.5896) |

- **Container**: a rounded-rectangle frustum (64.7 × 97 at the floor, 74.5 × 106.8 at the rim, 141.5 high) with a rolled bead
  inside the rim that grips a folded-over bag. A haunch at the rear (+X) rises to a pad at Z 158 with four split snap pegs
  (Ø4.65 stem, Ø4.95 barbed head, 0.7 mm split) on a 12.8 × 14.4 mm grid.
- **Scoop**: an open blade on a collar. The flat back wall (−X) carries the sieve. The side cheeks fall along a Bézier curve
  to the collar, and the top is a half-ellipse arch. Inside the collar, a ledge (Z 15.5) rests on the container's rim. Outside,
  a flange (Z 30–32) is captured by the handle.
- **Handle**: a collar whose lower opening clears the flange by 0.6 mm per side and whose shoulder (opening 84.1 × 116.4, which
  clears the blade by 1 mm per side) stops on the flange. Two spring fingers, rooted in side windows, hook under the flange
  with 0.3 mm of play. A boss at the rear has four blind sockets (Ø4.8 throat, Ø5.1 retention recess, 4.7 mm deep) for the
  pegs, and an oval grip hangs down beside the container.

## Sieve

| Parameter | SCAD | Default | Meaning |
| --- | --- | --- | --- |
| `sievePattern` | `SIEVE_PATTERN` | `slots` | `slots` (grid), `staggered` (alternate rows offset half a pitch), `round` or `hex` (close-packed rows 60° apart) |
| `gapWidth` | `GAP_WIDTH` | 7.2 | Slot width, hole diameter or hexagon size across flats |
| `gapLength` | `GAP_LENGTH` | 25 | Slot length (slot textures only) |
| `gapSpacing` | `GAP_SPACING` | 5.6 | Solid bar between neighbouring gaps |
| `sieveMargin` | `SIEVE_MARGIN` | 3.2 | Solid border to the flange, the corner radii, the arch and the thinning top edge |

The gaps sit in the flat part of the back wall: |Y| ≤ 45.2 (half of 114.4, minus the 12 mm corner radius), from the
flange's top (Z 32) up to Z 128, where the cheek curve starts to thin the wall, and under the arch (centre Z 103, semi-axes
57.2 × 38.8), all shrunk by the margin. Columns are centred on Y = 0 at a pitch of `gapWidth + gapSpacing`. Rows start one
margin above the flange at a pitch of `gapLength + gapSpacing` (slots) or `pitch × √3/2` (round holes and hexagons). Only
whole gaps are cut, so there are no slivers. The defaults reproduce the reference scoop: 7 × 3 slots at Y = 0, ±12.8,
±25.6, ±38.4.

`sieveGaps()` in the contract mirrors this layout. It gives the editor's gap count and validation (at least one gap, at
most `MAX_SIEVE_GAPS` = 400, and slots at least as long as they are wide). Tests pin it to counts recorded from the SCAD
file's `SIEVE_GAPS` echo. `npm run test:renderer` checks that the scoop's volume plus the gaps' volume is the same solid for
every texture.

## Assembly

1. **Set the scoop on the container**: its ledge rests on the rim (the scoop's Z 0 at 126).
2. **Clip the handle over the scoop**: it comes down from 200 mm above, so the scoop never passes through it. Its shoulder
   stops on the flange at Z 158, and its sockets meet the pegs on the pad at Z 158.

`npm run check:assembly -- litter-shovel` reports 0.00 mm³ assembled, exploded and along both steps, for every texture.
Its 17 samples over the handle's 200 mm step do not land on the last few millimetres, where the snaps engage. Measured there
with CSG (the handle lifted off its seat):

| Lift | Handle × scoop | Handle × container |
| --- | --- | --- |
| 0 (seated) | 0 | 0 |
| 1 mm | 8 mm³ | 2 mm³ |
| 2 mm | 16 mm³ | 2 mm³ |
| 4 mm | 1 mm³ | 0 |
| 5 mm or more | 0 | 0 |

This is the designed deflection: the spring fingers' hooks pass the flange, and the split pegs' heads pass the socket
throats. How hard the snaps are to push on and pull off, and how they hold up to fatigue, needs a printed prototype.

## Mesh hygiene

`inspectStl` rejects zero-area triangles and edges shared by more than two faces. Where two features would share a face, one
of them stops 0.01–0.05 mm inside the other: the haunch inside the pad, the spring finger 0.05 mm proud of the collar's inner
face (the flange still clears it by 0.55 mm), the hook inside its stem, and the socket's cones and recess overlapping the
throat.
