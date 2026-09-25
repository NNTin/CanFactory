# Cigarette case: snap mechanisms

The cigarette case has one parameter, `snap`, an enum (`ControlSchema.kind = 'enum'`, with its `options`). It reaches the
SCAD files as `-D SNAP="<value>"` (`apps/worker/src/render.ts`, `mappedDefines`); only the parts whose `scadMapping`
names `snap` receive it: the case box, the case lid and the mini lid. Every other part renders exactly as before.

| Value | Case lid on box | Mini lid in mini box |
|---|---|---|
| `friction` (default) | Nothing added: the original, verified geometry (0.16 mm clearance per side). | Original geometry. |
| `detent` | A 0.35 mm bump on each straight side of the box's upper shell clicks into a groove (0.1 mm deeper, 0.2 mm wider) in the lid, 9 mm above the lid rim. 45-degree-ish flanks, printable without support. | Original geometry. |
| `clip` | Each straight side of the lid gets a 7.9 mm wide tongue, cut free by two 0.6 mm slits from the rim to 13 mm and thinned to the plain 1 mm wall (the honeycomb is removed there). A 0.6 mm nib at its free end snaps into a 0.5 mm deep pocket in the box. | Original geometry. |
| `magnet` | A pocket for a 6 x 2 mm round magnet (6.2 x 2.1 mm) on each side: in the box wall, backed by a boss inside the bay, and in the lid, backed by a flat boss that fills the honeycomb outside. | Original geometry. |
| `crush-ribs` | Three vertical 0.5 mm ribs, 0.32 mm proud, on each straight side of the box's upper shell; they are squeezed by the lid (0.16 mm interference). The top ends are ramped. | Three ribs, 0.3 mm proud, on each straight side of the lid; squeezed by the box's wall (0.1 mm interference). |

The mini lid's end pads and the mini box's end notches are the original design's detent; they stay in every mode, which
is why the mini pair changes only for `crush-ribs`. The mini holder is held in the case box by the original clip tab
(part of the reconstruction), and the closed mini box sits in the lid cavity with about 0.1 mm clearance; neither joint
has a snap variant.

## Where the features are

All large-case features sit on the two straight side walls (`y = +/-13.63` on the shell, `+/-13.79` in the lid cavity, for
`x` between -1 and 9.5, where both outlines are straight). Heights are measured from the lid's rim when the case is
closed (box `z = 60.38`), so the box and lid files use the same numbers: `DETENT_Z`, `CRUSH_Z0/Z1`, `CLIP_*`, `MAGNET_*`.
Tune them in the SCAD constants; nothing else needs to change.

## How it was checked

- Every part renders in every mode as one closed manifold body (`inspectStl`), with the bounding boxes of the STLs
  (`tools/test-renderer.ts` covers this in Docker; the mini lid's width grows by the ribs in `crush-ribs`).
- Assembled pose (lid moved up by 60.38 mm), volume of `intersection(box, lid)`: `friction` 0, `detent` 0, `clip` 0,
  `magnet` 0, `crush-ribs` 5.2 mm3 (the intended interference). Lifting the lid 2 mm makes `detent` (4.3 mm3) and
  `clip` (5.0 mm3) interfere, so the bump and nib do sit in their groove and pocket when closed.
- The default mode is the reconstruction that `VERIFICATION.md` measures (bounding box, volume, IoU).

## Limits

Printed tolerances differ by machine: `CRUSH_H`, `DETENT_H`, `CLIP_NIB` and the magnet pocket sizes are the first things
to adjust. The clip tongue is 1 mm thick and 13 mm long, so it will fatigue if opened many times; the magnet bosses reduce
the box bay width by about 1.8 mm locally. The mini-lid ribs and the box/lid features were checked geometrically, not by
printing.
