# Shopping-list holder — attribution

**Shopping list holder for shopping cart coin slot** by **jhappone**.

- Original model: <https://www.thingiverse.com/thing:4126950>
- Author: <https://www.thingiverse.com/jhappone/designs>
- Licence: **Creative Commons Attribution 4.0 International (CC BY 4.0)**.
- Licence URL: <https://creativecommons.org/licenses/by/4.0/>
- Published: 2020-01-25; source listing checked on 2026-11-10.
- Source listing retrieved through <https://r.jina.ai/https://www.thingiverse.com/thing:4126950>.

The model page explicitly links CC BY 4.0, also recorded in its structured metadata. Preserve this attribution and identify
any changes when distributing an adaptation. The repository's licence does not replace the source model's licence.

## Preserved originals and conversion

The user supplied the three original files on 2026-11-11. They are preserved unchanged in `reference/`.

| Original file | SHA-256 |
| --- | --- |
| `Main_body.stl` | `deab1a297fc49cf754e6135a650b30c6a7f041c9af9f3af18ece16c6000d2ac3` |
| `Clip.stl` | `a8f413d4c7835bb0e56ddd74098ac2b07050256006fd7e8b2088a4e2cec2652e` |
| `Shopping_list_holder.step` | `e8b91a6793234231c4c39c2f3755e163f5880837bbbb541843a088df75126d0c` |

CanFactory converts each STEP solid into a self-contained, fixed-geometry OpenSCAD file. The conversion changes only the rigid
print placement: the body is centred and grounded; the clip is turned flat outer face down, centred and grounded. The STEP
remains the editable CAD source; the tessellated SCAD is a format conversion, not a parametric reconstruction.
`reference/Clip.print.stl` is a comparison copy of `Clip.stl` rotated 180° about X.

**Changes (CC BY 4.0 §3(a)(1)(B)):** CanFactory modified the printed parts for an M2 × 16 screw, an M2 nut and a stock torsion
spring, around the unchanged conversion:
- 2.4 mm clearance holes replace the 1 mm axle pilots;
- the body has a boss with a nut trap on one hinge ear, a relief under the spring's coil, and a seat for one spring leg;
- the clip has a seat for the other spring leg.

The original shape, dimensions and lettering are otherwise unchanged. `M2_HARDWARE = false` renders each file without these
changes.

[Conversion commands and assembly measurements](CONVERSION.md) · [Verification against the supplied STLs](VERIFICATION.md).
The catalogue and generated STL headers retain the author and CC BY 4.0 credit. The screw, nut and spring are additional
hardware, not included in the printable ZIP.

The creator also shared the project as **happomies** at
<https://www.reddit.com/r/functionalprint/comments/etqlw9/>.
