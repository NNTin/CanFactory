# Rubber band launcher

[Rubber Band Launcher](https://cults3d.com/en/3d-model/game/rubber-band-launcher) by
[FerryTeacher](https://cults3d.com/en/users/FerryTeacher), licensed under CC BY-NC-SA
(recorded as supplied, without a version; the catalogue links the current [4.0 deed](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
[Attribution and preserved original](../models/rubber-band-launcher/ATTRIBUTION.md).

**NonCommercial, ShareAlike.** Do not sell the prints or the files. CanFactory's SCAD files are adaptations and carry the
same licence; anything you derive from them must too.

The design is a rubber band pistol made as **one print-in-place piece**: the **frame** (barrel, side plates, an arm under
the barrel and an oval grip with a pocket on each side) and the **trigger**, which is printed on two conical pins in
sockets in the frame's side plates. The trigger cannot be fitted after printing; once printed and freed, it turns on its
pins. The ZIP holds the one print, `launcher.stl`, with both bodies in place. The model has no adjustable settings.

## How it shoots

A **shot band** is hooked into the groove in the front of the barrel's tip, stretched back along both sides of the barrel
and dropped into the notch at the back of the frame's top edge, where it lies against the notch's front lip on the
trigger's top end. Pulling the trigger turns it about its pins: its finger end moves back towards the grip and its top end
rises through the notch, lifting the band. When the top end is level with the lip (the trigger's printed position), the
band slips over the lip and flies off the barrel.

CanFactory adds a **return band** (not in the source design) down the back of the grip: it lies across the trigger's top
end, in a groove in the notch (behind the shot band's place), and runs down both sides of the frame to the bottom of the
grip, where it crosses in a groove round the grip. It holds the trigger back at rest, against the frame's back wall with
its top end 3.5 mm down in the notch. Pulling the trigger lifts that end away from the grip (the span between the grooves
grows from 101.4 to 109.0 mm), so the band stretches further and springs the trigger back for the next band by itself.
Its strands lie flat on the frame's sides, over the back half of the grip; they cross the grip pockets without touching them.

| | Rubber band | Size | Where |
|---|---|---|---|
| Shot band | #19 (3½″ × 1/16″): 88.9 mm flat, 1.6 mm wide | the 1/16″ width fits the 2.2 mm groove in the tip | from the barrel’s tip into the notch, stretched about 1.3× |
| Return band | #18 (3″ × 1/16″): 76.2 mm flat, 1.6 mm wide | fits the 2.2 mm groove round the grip and the trigger's V groove | from the trigger's top end round the bottom of the grip, stretched about 1.54× at rest, 1.60× as the shot leaves and 1.64× pulled |

Both are in the parts library (Alliance Rubber's numbered sizes; any maker's band of the same number will do) and listed
under the model's hardware. Never aim at faces, people or animals.

## Print

Print `launcher.stl` as it is, standing on the barrel's top edge, without separating or moving its bodies. It is
126.9 × 20.6 × 109.6 mm; the trigger prints inside the frame. No supports: the groove across the trigger's top end (a V,
2.2 mm deep, 4.4 mm across) faces the print bed with 45° flanks, and the groove round the bottom of the grip (2.2 mm wide,
1.5 mm deep, up 6 mm on each side) opens upwards at the top of the print. After printing, work the trigger gently until it
turns freely, then hook the return band into the groove under the grip, stretch it up both sides and lay it across the
trigger's top end in its groove.

## Preview and checks

The preview turns the print upright, frees the trigger to rest and fits the return band (hooked under the grip and let
down into the trigger's groove), loads a shot band (the frame,
the trigger and both bands can each be hidden), then pulls the trigger from rest (−12°, against the frame's back wall)
to its stop on the frame's spine (+8°; it meets it at about 8.5°). The shot band rides up on the trigger's top end until it
is over the lip (0°) and flies off, while the return band stretches with the trigger's top end; letting go, it pulls the
trigger back to rest. The return band is drawn round the outline it hugs: the hull of both bodies within its width, in its
plane, measured on `launcher.scad` at every frame of the pull.
`npm run check:assembly -- rubber-band-launcher` checks the rest position, both band steps and every frame of both
movements for collisions between the bodies and the bands.

## Reconstruction

The source is one STL (119 786 triangles) with the two bodies. Both are rebuilt in one self-contained OpenSCAD file,
`models/rubber-band-launcher/launcher.scad` (`PART` = `print`, `frame` or `trigger`), and each body is verified against its
source body with `tools/stl-to-scad` (without CanFactory's grooves, `RETURN_BAND=false`; with them, the download's bodies still
match the source at IoU 0.971 and 0.994, which the renderer test holds to ≥ 0.96):

| Part | Bounding box Δ | Volume Δ | IoU | Closed manifold |
|---|---|---|---|---|
| Frame | ≤ 0.020 mm | −0.37 % | 0.9716 | one body |
| Trigger | ≤ 0.003 mm | +0.03 % | 0.9978 | one body |

The frame's side plates are measured sections, one per 0.04 to 0.45 mm slice, because their edge rounding changes around
the outline. The grip, the barrel's tip and the grip pockets use fitted ovals and fillets, and the pivot sockets and pins
are cones. The trigger is its measured outline with rounded edges, grip ridges and pins. The ramps at the ends of the
barrel rail's slot are left out. Method, limits and the source hashes:
[VERIFICATION.md](../models/rubber-band-launcher/references/VERIFICATION.md).
