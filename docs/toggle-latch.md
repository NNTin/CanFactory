# Toggle latch

`toggle-latch` is a printed over-centre latch, 12 mm wide, in four parts: the **base** (a 38 × 12 × 4 mm plate with the
knuckle that carries the lever), the **lever**, the **link** that the lever swings over the catch, and the **catch** (the same
plate with the hook). It is an adaptation of “Toggle Latch” on MakerWorld, a remix of Hacky97's “M3 toggle corner latch”
(CC BY-NC 4.0; see [models/toggle-latch/ATTRIBUTION.md](../models/toggle-latch/ATTRIBUTION.md)).

## Files

| Part | Source | What it is |
|---|---|---|
| base | `models/toggle-latch/base.scad` | Reconstruction of `Latch 12mm 2`, with parametric screw holes |
| lever | `models/toggle-latch/reference/Latch 12mm 3.scad` | Reconstruction; `HITOL` picks the original's high-tolerance variant |
| link | `models/toggle-latch/reference/Latch 12mm 4.scad` | Reconstruction |
| catch | `models/toggle-latch/catch.scad` | Reconstruction of `Latch 12mm 1`, with parametric screw holes |

The reconstructions were made with the `stl-to-scad` tooling and match the original STLs to IoU 0.985–0.996
([reference/VERIFICATION.md](../models/toggle-latch/reference/VERIFICATION.md)). The base and catch share one block of SCAD
for the screw holes (a test keeps the two identical).

## Screws

Both plates take two screws each, chosen from the [parts library](adding-parts.md):

- **Wood screws** (`screwKind = wood`): a DIN 7997 countersunk wood screw, picked by diameter (`woodScrewDiameter`) and then
  by length (`woodScrew`). The default is 4 × 25, the screw the catio's latches use.
- **Machine screws** (`screwKind = machine`): any metric screw in the library, picked by thread (`screwThread`) and then by
  standard and length (`machineScrew`): countersunk (ISO 10642, ISO 7046-1), pan (ISO 7045), button (ISO 7380), socket cap
  (ISO 4762) or hexagon head (ISO 4017).

`holeFit` sets the clearance hole: the DIN EN 20273 fine / medium / coarse hole for a machine screw, and the same allowances
over the diameter (+0.3 / +0.5 / +0.8 mm) for a wood screw. A countersunk head gets a 90° countersink 0.4 mm wider than the
head and as deep as the head is high (with a short cylindrical rim where the head has one), so it sits flush. Any other head
sits on the plate's front face.

The choice reaches the SCAD files in two ways: `scadEncode` writes the chosen screw's three clearance holes as a vector
(`WOOD_HOLES`, `MACHINE_HOLES`), and `partDefines` passes its thread, head diameter (across corners for a hexagon head),
head height and head type. Only the screws that fit are offered (`latchScrewFits`, `TOGGLE_LATCH_SEAT` in
`packages/contracts/src/models.ts`):

- the coarse hole leaves at least 1.5 mm of plate above and below it;
- a countersink is at most 11 mm across (0.5 mm from the plate's ends and edges) and leaves at least 1 mm of straight hole;
- any other head is at most 8 mm across, so that it stays 0.5 mm clear of the link's 17.4 mm wide side bars;
- the screw reaches at least 4 mm past the plate's back (a countersunk screw's length includes its head).

That offers DIN 7997 3 to 5 mm, and M2 to M5 machine screws (no M5 pan or socket heads, and nothing larger). The screw's
length never changes the geometry; it is offered so that the parts list names the screw you buy.

## Lever fit

`highTolerance` (“Loose pivots”) prints the original's `Latch 12mm 3 HiTol` lever: a 5.14 mm pivot hole instead of 4.99 mm
on the base's 4.4 mm pins, and 4.41 mm link pins instead of 4.64 mm in the link's 5 mm holes.

## Mechanism

`packages/contracts/src/toggleLatchMechanism.ts` is the latch's one kinematic model: the catalogue card's side view
(`apps/web/src/ToggleLatchIllustration.tsx`) and the preview's assembly slider (`toggleLatchAssembly` in `models.ts`) both place
the parts with it, and they share its timeline of movements. It reads everything from the SCAD files: the six side profiles
verbatim, the joints from their centres, and two circles fitted to profile points (to 0.005 mm): the dip under the catch's hook
(r 1.99 at y 5.745, z 5.455) and the nose of the link's bar (r 1.408 at x 7.99, z 3.997). A test compares all of it with the
SCAD files.

All four parts are side profiles extruded along one axis, with their joints parallel to it, so the latch moves in one plane:
u along the pull, v up from the mounting surface. Across the latch's width, the knuckle (8.6 mm) sits between the lever's side
plates (9.0 mm apart), the lever (13.0 mm over its side plates) between the link's side bars (13.4 mm apart), and the hook
(13 mm) between the link's side bars, under the link's bar.

- **Base**, fixed. Its pivot pins (4.4 mm) stand 10.26 mm off the mounting surface, 4.89 mm from the plate's edge on the catch's
  side.
- **Lever**, on the base's pins (pivot hole 4.99 mm). Its link pins sit on a crank of 10.17 mm. It lies with its flat edge (the
  thumb pad over the bridge) outwards: the high-tolerance lever's holes grow, and its pins shrink, on the faces away from the pull.
  This way up, those are the faces that the closed latch's pull bears on, so the loose lever keeps the standard lever's geometry.
- **Link**, on the lever's pins (5 mm holes). The nose of its bar seats in the dip under the catch's hook, on the side away from the
  base.
- **Catch**, turned end for end so that its hook faces the base's knuckle across the gap between the plates. It is screwed to the
  part the latch draws in, so it slides along u, driven by the link.

With the link taut, the catch is pulled away from the base as far as the link lets it, and the link turns freely on the lever's
pins. For each lever angle, the model slides the catch until its hook meets the link's bar, or its plate meets the link's side
bars, for every link direction. The link takes the direction that lets the catch go furthest, following that direction from one
angle to the next. That is a slider-crank, solved on the real profiles. The result is tabulated every half degree
(`TOGGLE_LATCH_HOOKED`, which a test recomputes) and interpolated, to within 2 µm of contact.

| Lever (° from the pull) | State | Gap between the plates |
|---|---|---|
| −8.18 (`CLOSED`) | locked: the link's side bars rest on the base's plate | 1.311 mm |
| 13.5 (`DEAD_CENTRE`) | the catch drawn in closest | 0.988 mm |
| 60 (`RELEASED`) | the link goes slack; the catch stays | 2.56 mm |
| 119.4 (`OPEN`) | the lever rests on the catch's hook | 2.56 mm |

So the lock is over centre. Closing draws the catch in to 0.99 mm. The lever then turns on 21.7° past that, and the catch eases
back 0.32 mm until the lever and link come to rest on the base. From there, the pull in the link holds the lever down, and opening
has to push the catch back in over the dead centre first. Opened past `RELEASED`, the slack link rides on the lever's pins with
its nose out of the dip. At `OPEN`, it swings up 62° (`SWING`) off the hook.

`npm run check:assembly -- toggle-latch --snap-tolerance 50` renders the four parts and checks the assembled latch, the exploded
layout, the steps and every frame of the five movements: none shares any volume. The two snap steps share 41–45 mm³ in their
last 3 mm. Each is one part's side plates passing over pin ends: the lever's plates spread over the base's pins, the link's over
the lever's, as the print notes say.

## Not yet

The catio's insert–tunnel coupling still uses the Ganter GN 831. Using this latch there needs the latch's dimensions as a library
part or a linked model. The model now gives them: hole spacing 26.4 mm, a closed gap of 1.31 mm between the plates, and the
catch's 1.57 mm of draw from `RELEASED`.
