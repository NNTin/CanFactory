# Trolley token — source conversion and assembly

Original design: **jhappone**, [Thingiverse 4126950](https://www.thingiverse.com/thing:4126950), **CC BY 4.0**.
[Attribution and original hashes](ATTRIBUTION.md) · [STL comparison report](VERIFICATION.md).

The supplied originals remain unchanged in `reference/`. The runtime uses two self-contained SCAD files. Each holds a polyhedron
converted from a STEP solid (`source_body()`, `source_clip()`), a fixed technical format conversion with no dimensional changes,
and CanFactory's fittings for the hardware around it (see [Fittings for the M2 hardware](#fittings-for-the-m2-hardware)).
`M2_HARDWARE = false` renders the conversion alone. The STEP remains the editable CAD source. Model version 3 replaces the
previous, unrelated CanFactory implementation.

## Source measurements

`Shopping_list_holder.step` SHA-256: `e8b91a6793234231c4c39c2f3755e163f5880837bbbb541843a088df75126d0c`.
Both STEP solids are valid BReps. Solid 0 is the clip; solid 1 is the token body. Source units are millimetres.

| Part | STEP volume (mm³) | Print envelope (mm) | Tessellated volume (mm³) |
| --- | --- | --- | --- |
| Body, solid 1 | 2534.427783 | 51.625 × 30 × 7.5 | 2534.115892 |
| Clip, solid 0 | 1073.421755 | 25 × 30 × 7 | 1073.445186 |

The token's cylinder has radius 11.625 mm and thickness 2.5 mm. Both axle pilot cylinders have radius 0.5 mm.
The source body axle is parallel to Y through `[25, 0, 4.5]`. The clip's axle is coaxial in the supplied STEP assembly.
The clip's largest plane has outward normal `[0.004562011835761121, 0, 0.9999895939698624]`;
`atan2(nx, nz)` gives its assembled tilt of **0.26138493093829307°**. This tilt is source placement, not an adjustable paper angle.

## Reproduce

From the repository root:

```bash
uv venv .data/step-tools --python 3.12
uv pip install --python .data/step-tools/bin/python -r tools/step-to-scad/requirements.txt
.data/step-tools/bin/python tools/step-to-scad/convert.py inspect \
  models/trolley-token/reference/Shopping_list_holder.step

credit=(--creator jhappone \
  --source-url https://www.thingiverse.com/thing:4126950 \
  --license 'CC BY 4.0' --license-url https://creativecommons.org/licenses/by/4.0/)
.data/step-tools/bin/python tools/step-to-scad/convert.py convert \
  models/trolley-token/reference/Shopping_list_holder.step --solid 1 \
  -o models/trolley-token/body.scad --stl "${credit[@]}"
.data/step-tools/bin/python tools/step-to-scad/convert.py convert \
  models/trolley-token/reference/Shopping_list_holder.step --solid 0 \
  --rotate 180 0.26138493093829307 0 \
  -o models/trolley-token/clip.scad --stl "${credit[@]}"
```

The converter writes a bare polyhedron. The committed files wrap it in `module source_body()` / `module source_clip()` unchanged,
with the fittings above it; redo that wrapping after converting again.

CadQuery 2.6.1 / cadquery-ocp 7.8.1.1.post1 tessellates with relative linear deflection 0.01 and angular deflection 0.1 rad.
Vertices are welded after rounding to six decimals; there is no decimation. `body.json` and `clip.json` record the settings,
source hash, rigid placement and analytic/tessellated volumes. The converted polyhedra were 100,476 and 95,834 bytes. The root
STL files are references of the conversion alone (`M2_HARDWARE = false`), not runtime dependencies.

The body is centred in XY and grounded. The clip is turned flat outer face down, centred and grounded.
For independent comparison, `reference/Clip.print.stl` is the original `Clip.stl` rotated 180° about X. Recreate it without
modifying the original:

```bash
python3 - <<'PY'
from pathlib import Path
import struct
root = Path('models/trolley-token/reference')
raw = bytearray((root / 'Clip.stl').read_bytes())
for i in range(struct.unpack_from('<I', raw, 80)[0]):
    offset = 84 + 50 * i
    values = list(struct.unpack_from('<12f', raw, offset))
    for k in range(0, 12, 3):
        values[k + 1] *= -1
        values[k + 2] *= -1
    struct.pack_into('<12f', raw, offset, *values)
(root / 'Clip.print.stl').write_bytes(raw)
PY
OPENSCAD_RUNNER=docker npm run stl-scad -- verify \
  --manifest models/trolley-token/manifest.json --report models/trolley-token/VERIFICATION.md
```

The manifest renders both files with `M2_HARDWARE = false`. The body and clip score IoU 0.9986 and 0.9974 against the
independently supplied STLs on the existing 0.2 mm oblique ray grid. Every converted part renders as one closed, consistently wound
body with no degenerates or float32 sliver repairs, with or without the fittings.

## Assembly placement and movement

The converter applies `print = R × source + T`, with X then Y then Z rotations. The preview applies its inverse and shifts
by `[-14.1875, 0, 0.0000001]` to centre the assembly on the body's print origin.

| Part | Print rotation (degrees) | Print translation T (mm) | Assembled position (mm) | Assembled rotation (degrees) |
| --- | --- | --- | --- | --- |
| Body | `[0, 0, 0]` | `[-14.1875, 0, 0.0000001]` | `[0, 0, 0]` | `[0, 0, 0]` |
| Clip | `[180, 0.26138493093829307, 0]` | `[-27.479210796295398, 0, 8.61400346875841]` | `[13.330722033, 0, 8.488553446]` | `[180, 0.26138493093829307, 0]` |

For this particular rotation, R is its own inverse. The axle in the clip's print frame is `[-2.5, 0, 4]`; the assembled axle is
`[10.8125, 0, 4.5]`, matching the body. Contract tests keep it fixed throughout both movements. The clip is lowered between
the body's hinge ears from +Z. Opening rotates the clip −15° about the Y axle, sampled every degree; releasing reverses it.
The demonstrated movement changes only assembly poses, never the printable geometry.

Exact OCCT intersections of the original STEP solids are 0 mm³ when closed and at each of the 16 sampled angles from 0° to
15°.

## Fittings for the M2 hardware

The source listing specifies a 2.5 mm axle and drilling its 1 mm pilots to suit, and a torsion spring with no dimensions or
axle retention. CanFactory replaces those with hardware from the parts library: an ISO 4762 M2 × 16 screw (`iso-4762-m2x16`), an
ISO 4032 M2 nut (`iso-4032-m2`) and a Gutekunst T-16102L torsion spring (`gutekunst-t-16102l`), whose data and sources are in
the library. [docs/trolley-token.md](../../docs/trolley-token.md#how-the-hardware-fits) explains the fit. The fittings are drawn
in the assembled frame; the clip's are taken back into its print frame by undoing its closed pose. Every number below is a named
value at the top of `body.scad` or `clip.scad`, and `trolleyToken.test.ts` keeps them equal to the library and to
`TROLLEY_TOKEN_HARDWARE`.

| Fitting | Part | Geometry (assembled frame, mm) |
| --- | --- | --- |
| M2 clearance hole, Ø2.4 (ISO 273 medium) | both | Through the ears and the knuckles on the source's axle, `[10.8125, y, 4.5]`, replacing the 1 mm pilots |
| Nut boss | body | The −Y ear's outline at radius 3.5, from y = −7.5 to −9, standing on the bed beside the clip |
| Nut trap, hexagonal, 4.3 across the flats | body | From the seat at y = −6.9 out through the boss, its corners up and down so that its roof prints unsupported |
| Coil relief | body | The plate under the coil lowered from z = 2.5 to 2, 4.6 × 3.6 |
| First leg's seat | body | A ramp under the leg turned 18° (raising its front), 2.2 to 5 mm along it, for y −1.9 to −0.25 |
| Second leg's seat | clip | A ramp over the leg at −10° when closed, 2.2 to 6 mm along it, for y 0.25 to 1.9, under the pad |

The spring is drawn by the parts library's builder (`@canfactory/part-geometry`), its legs cut to 5 and 6 mm. Its pose turns its
first leg onto the body's seat, and its wind (`Pose.wind`) is 28° closed, which puts its second leg on the clip's seat. The
second leg turns with the clip, so that seat holds it throughout. The motion frames wind the spring a degree per degree of
opening, to 43° at 15°. The screw goes in from +Y, its head on the ear at y = 7.5 and its tip at y = −8.5, flush with the
seated nut and 0.5 mm inside the boss.

The assembly checker reports 0 mm³ overlap on its 0.25 mm ray grid for every pair of the five pieces: closed, in the exploded
layout, through the three steps (the clip and spring lowered from +Z, the nut from −Y, the screw from +Y) and at every frame of
opening and closing. Its default tolerances are unchanged. On a 0.05 mm grid, winding the spring 1° less pushes its second leg
0.05 mm³ into the clip's seat. Turning it 3° lower pushes its first leg 0.16 mm³ into the body's seat. So both legs bear on their
seats, as the spring's preload needs.

```bash
npm run check
TEST_ONLY=trolley-token npm run test:renderer
OPENSCAD_RUNNER=docker npm run check:assembly -- trolley-token
BASE_URL=http://127.0.0.1:5173 npx playwright test tests/browser/trolley-token.spec.ts
```

The renderer check verifies:
- the conversion inside each file against the original meshes (rendered with `M2_HARDWARE = false`);
- the fittings, probed in the delivered STLs: the clearance holes, the trap and boss, the relief and the seats;
- the attribution headers, the exact two ZIP entries, and identical preview/download bytes.

The browser check exercises:
- the catalogue, the attribution links and the hardware notes;
- the screw, nut and spring in the parts list, and assembly playback;
- part visibility and the downloaded STL dimensions.
