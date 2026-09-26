# Cigarette case: snap mechanisms

The cigarette case's `snap` parameter (the others are the underside text, see [cigarette-case-text.md](cigarette-case-text.md), and the [clearance](#clearance)) is an enum (`ControlSchema.kind = 'enum'`, with its `options`). It reaches the
SCAD files as `-D SNAP="<value>"` (`apps/worker/src/render.ts`, `mappedDefines`); only the parts whose `scadMapping`
names `snap` receive it: the case box, the case lid and the mini lid. Every other part renders exactly as before. The
features that reach into the mating part are sized from the clearance (see [Clearance](#clearance)), so each mechanism
engages the same amount whatever the clearance.

| Value | Case lid on box | Mini lid in mini box |
|---|---|---|
| `friction` (default) | Nothing added: the plain walls, one clearance apart. | Original pads and notches. |
| `detent` | A bump on each straight side of the box's upper shell (clearance + 0.19 mm proud, so it reaches 0.19 mm past the lid's wall) clicks into a groove in the lid that clears it by the clearance, 9 mm above the lid rim. 45-degree-ish flanks, printable without support. | Original pads and notches. |
| `clip` | Each straight side of the lid gets a 7.9 mm wide tongue, cut free by two 0.6 mm slits from the rim to 13 mm and thinned to the plain 1 mm wall (the honeycomb is removed there). A 0.6 mm nib at its free end snaps into a pocket in the box that clears the nib by the clearance on every side. | Original pads and notches. |
| `magnet` | A pocket for a 6 x 2 mm round magnet (6.2 x 2.1 mm) on each side: in the box wall, backed by a boss inside the bay, and in the lid, backed by a flat boss that fills the honeycomb outside. The pockets do not depend on the clearance. | Original pads and notches. |
| `crush-ribs` | Three vertical 0.5 mm ribs, clearance + 0.16 mm proud, on each straight side of the box's upper shell; they are squeezed by the lid (0.16 mm interference). The top ends are ramped. | Three ribs, clearance + 0.1 mm proud, on each straight side of the lid; squeezed by the box's wall (0.1 mm interference). |

The mini lid's end pads and the mini box's end notches are the original design's detent; they stay in every mode, which
is why the mini pair changes only for `crush-ribs`. The mini holder is held in the case box by the original clip tab
(part of the reconstruction), and the closed mini box sits in the lid cavity; both are friction fits at the clearance, and
neither joint has a snap variant.

## Clearance

Every SCAD file has `CLEARANCE`, the gap per side between mating surfaces, 0.2 mm by default (a snug fit). It is the
`clearance` parameter in the editor's advanced settings: 0.10 to 0.60 mm in 0.01 mm steps, reaching every part except
the text part. The editor names the fit as the value changes (the bands of issue #7: very tight 0.10–0.15, snug
0.15–0.25, sliding 0.25–0.40, easy sliding 0.40–0.60) and highlights the range recommended for the selected snap mode
(`SNAP_CLEARANCE` in `packages/contracts/src/models.ts`):

| Snap mode | Recommended clearance | Why |
|---|---|---|
| `friction` | 0.10–0.60 mm | The walls themselves hold; pick the fit you want. |
| `magnet` | 0.10–0.60 mm | As friction: the magnets hold, and their pockets are oversized on their own (6.2 x 2.1 mm for 6 x 2 mm magnets). |
| `clip` | 0.20–0.40 mm | The nib stands 0.6 mm into the lid cavity, so it reaches 0.6 mm − clearance into the box's pocket: 0.4 mm at 0.2, only 0.2 mm at 0.4, nothing at 0.6. Below 0.2 the tongue has to flex further than it is designed to. |
| `detent` | 0.20–0.40 mm | The bump always reaches 0.19 mm past the lid wall, so the lid must flex; the walls should clear each other so that only the bump touches, and above 0.4 mm the groove leaves little of the 1 mm lid wall. |
| `crush-ribs` | 0.20–0.40 mm | The ribs always squeeze by 0.16 mm (0.1 on the mini lid); the walls should clear each other so that only the ribs touch, and above 0.4 mm the ribs grow tall and thin. |

Values outside the range stay valid; the editor only says so. The source STLs
had a different gap at each joint, which the assembly slider made visible (issue #7). Each fitted part is now derived from
the surface it fits into, so the gap is exactly the clearance all round:

| Joint | Female (reference) | Male (derived) | Source STL gap |
|---|---|---|---|
| Case lid on case box | lid cavity (`CAVITY`) | box upper shell: the cavity pulled in by the clearance | 0.15 to 0.31 mm (sides 0.16, ends 0.27) |
| Mini box in case lid | lid cavity | mini box: its measured outline, which stood 0.031 mm inside the cavity, offset to stand the clearance inside | 0.02 to 0.04 mm |
| Mini lid in mini box | mini box (plan, swept end, rim notches) | mini lid: plan and swept end pulled in by wall + clearance, pads the notches less the clearance | 0.2 mm plan, pads 0.15 to 0.25 mm, swept end colliding |
| Mini holder in case box | round bay (`BAY_ROUND`) | holder's outer skin: the bay pulled in by the clearance (its cavity is as measured) | 0.45 to 0.5 mm |

The lid cavity and the round bay do not change with the clearance, so the assembly poses hold for every value. Checked by
slicing the rendered, assembled parts at several heights: the gap on each joint is the clearance to within 0.01 mm at 0.1,
0.2 and 0.6 mm (the mini box's rounded end is a little further from the cavity than its sides and chamfer).

## Where the features are

All large-case features sit on the two straight side walls (`y = +/-13.59` on the shell at 0.2 mm clearance, `+/-13.79` in the lid cavity, for
`x` between -1 and 9.5, where both outlines are straight). Heights are measured from the lid's rim when the case is
closed (box `z = 60.38`), so the box and lid files use the same numbers: `DETENT_Z`, `CRUSH_Z0/Z1`, `CLIP_*`, `MAGNET_*`.
Tune them in the SCAD constants; nothing else needs to change.

## How it was checked

- Every part renders in every mode as one closed manifold body (`inspectStl`), with the bounding boxes of the STLs
  (`tools/test-renderer.ts` covers this in Docker; the mini lid's width grows by the ribs in `crush-ribs`).
- `npm run check:assembly -- --parameters '{"snap":"<mode>"}'` (see [cigarette-case-assembly.md](cigarette-case-assembly.md)):
  `friction` and `magnet` share no volume anywhere; `detent` and `clip` only while the case closes (the bump and nib pass
  the lid wall before they drop into their groove and pocket); `crush-ribs` also when closed (the designed interference).
- The crush-rib interference stays the same from 0.2 to 0.4 mm clearance (6.0 mm3 box/lid, 5.7 mm3 mini pair on a 0.2 mm grid).
- `VERIFICATION.md` measures the reconstructions against the source STLs at the source's own clearance.

## Limits

Printed tolerances differ by machine: `CLEARANCE` is the first thing to adjust, then `CRUSH_SQUEEZE`, `DETENT_ENGAGE`,
`CLIP_NIB` and the magnet pocket sizes. The clip tongue is 1 mm thick and 13 mm long, so it will fatigue if opened many times; the magnet bosses reduce
the box bay width by about 1.8 mm locally. The mini-lid ribs and the box/lid features were checked geometrically, not by
printing.
