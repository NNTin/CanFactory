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

## Print

Print `launcher.stl` as it is, standing on the barrel's top edge, without separating or moving its bodies. It is
126.9 × 20.6 × 109.6 mm; the trigger (46.3 × 16.6 × 57.1 mm) prints inside the frame. After printing, work the trigger
gently until it turns freely.

The preview shows the piece as printed (the frame and the trigger are separate bodies of the one print, so each can be
hidden), frees the trigger, then pulls it 8° to its stop: it meets the frame's spine at about 8.5°.
`npm run check:assembly -- rubber-band-launcher` checks the printed position and every frame of the movement for
collisions between the bodies.

## Reconstruction

The source is one STL (119 786 triangles) with the two bodies. Both are rebuilt in one self-contained OpenSCAD file,
`models/rubber-band-launcher/launcher.scad` (`PART` = `print`, `frame` or `trigger`), and each body is verified against its
source body with `tools/stl-to-scad`:

| Part | Bounding box Δ | Volume Δ | IoU | Closed manifold |
|---|---|---|---|---|
| Frame | ≤ 0.020 mm | −0.37 % | 0.9716 | one body |
| Trigger | ≤ 0.003 mm | +0.03 % | 0.9978 | one body |

The frame's side plates are measured sections, one per 0.04 to 0.45 mm slice, because their edge rounding changes around
the outline. The grip, the barrel's tip and the grip pockets use fitted ovals and fillets, and the pivot sockets and pins
are cones. The trigger is its measured outline with rounded edges, grip ridges and pins. The ramps at the ends of the
barrel rail's slot are left out. Method, limits and the source hashes:
[VERIFICATION.md](../models/rubber-band-launcher/references/VERIFICATION.md).
