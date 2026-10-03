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

## Not yet

The model has no assembly slider: poses for the lever and the link (open and closed) are still to be derived and checked
with `npm run check:assembly`. The catio's insert–tunnel coupling still uses the Ganter GN 831; using this latch there needs
the latch's dimensions (hole spacing 26.4 mm, closed length, stroke) as a library part or a linked model.
