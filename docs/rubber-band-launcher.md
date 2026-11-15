# Rubber band launcher

[Rubber Band Launcher](https://cults3d.com/en/3d-model/game/rubber-band-launcher) by
[FerryTeacher](https://cults3d.com/en/users/FerryTeacher), licensed under CC BY-NC-SA
(recorded as supplied, without a version; the catalogue links the current [4.0 deed](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
[Attribution and preserved original](../models/rubber-band-launcher/ATTRIBUTION.md).

**NonCommercial, ShareAlike.** Do not sell the prints or the files. CanFactory's SCAD files are adaptations and carry the
same licence; anything you derive from them must too.

The design is a rubber band pistol in two pieces that print together, in place: the **frame** (barrel, side plates, an
arm under the barrel and an oval grip with a pocket on each side) and the **trigger**, which turns on two conical pins in
sockets in the frame's side plates. The ZIP holds both as `frame.stl` and `trigger.stl`. The model has no adjustable settings.

## Print

Load both STLs together at their own coordinates, as one object with two parts (in PrusaSlicer or Bambu Studio: import both
and keep their positions), standing on the barrel's top edge as provided. The trigger is printed on its pins inside the
frame; do not move either part. The frame is 126.9 × 20.6 × 109.6 mm, the trigger 46.3 × 16.6 × 57.1 mm. After printing,
work the trigger gently until it turns freely.

The preview shows both parts as printed, then pulls the trigger 8° to its stop: it meets the frame's spine at about 8.5°.
`npm run check:assembly -- rubber-band-launcher` checks the rest position and every frame of the movement for collisions.

## Reconstruction

The source is one STL (119 786 triangles) with the two bodies. Each is rebuilt as a self-contained OpenSCAD file
(`models/rubber-band-launcher/frame.scad`, `trigger.scad`) and verified against its body with `tools/stl-to-scad`:

| Part | Bounding box Δ | Volume Δ | IoU | Closed manifold |
|---|---|---|---|---|
| Frame | ≤ 0.020 mm | −0.37 % | 0.9716 | one body |
| Trigger | ≤ 0.003 mm | +0.03 % | 0.9978 | one body |

The frame's side plates are measured sections, one per 0.04 to 0.45 mm slice, because their edge rounding changes around
the outline. The grip, the barrel's tip and the grip pockets use fitted ovals and fillets, and the pivot sockets and pins
are cones. The trigger is its measured outline with rounded edges, grip ridges and pins. The ramps at the ends of the
barrel rail's slot are left out. Method, limits and the source hashes:
[VERIFICATION.md](../models/rubber-band-launcher/references/VERIFICATION.md).
