# Trolley token — source conversion and assembly

Original design: **jhappone**, [Thingiverse 4126950](https://www.thingiverse.com/thing:4126950), **CC BY 4.0**.
[Attribution and original hashes](ATTRIBUTION.md) · [STL comparison report](VERIFICATION.md).

The supplied originals remain unchanged in `reference/`. The runtime uses two self-contained SCAD polyhedra converted from
STEP solids. This is a fixed technical format conversion, not a parametric reconstruction. No dimensions or features change.
The STEP remains the editable CAD source. Model version 3 replaces the previous, unrelated CanFactory implementation.

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

CadQuery 2.6.1 / cadquery-ocp 7.8.1.1.post1 tessellates with relative linear deflection 0.01 and angular deflection 0.1 rad.
Vertices are welded after rounding to six decimals; there is no decimation. `body.json` and `clip.json` record the settings,
source hash, rigid placement and analytic/tessellated volumes. The SCAD files are 100,476 and 95,834 bytes respectively.
The root STL files are conversion references, not runtime dependencies.

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

The body and clip score IoU 0.9986 and 0.9974 against the independently supplied STLs on the existing 0.2 mm oblique ray grid.
Every converted part renders as one closed, consistently wound body with no degenerates or float32 sliver repairs.

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
15°. The normal assembly checker also reports 0 mm³ overlap for the closed state, exploded layout, vertical clip insertion
and all opening/closing frames on its 0.25 mm ray grid. Its default tolerances are unchanged.

The source listing specifies a 2.5 mm axle and drilling to suit, despite the CAD's 1 mm pilots. It requires a torsion spring
but gives no spring dimensions or axle-retention specification. The preview therefore shows the two printed pieces; it does
not invent a spring or fastener model. Both hardware items are required for the real clamp and excluded from the print ZIP.

```bash
npm run check
TEST_ONLY=trolley-token npm run test:renderer
OPENSCAD_RUNNER=docker npm run check:assembly -- trolley-token
BASE_URL=http://127.0.0.1:5173 npx playwright test tests/browser/trolley-token.spec.ts
```

The renderer check verifies geometry against the original meshes, attribution headers, the exact two ZIP entries, and
identical preview/download bytes. The browser check exercises the catalogue, attribution links, required-hardware note,
assembly playback, part visibility and the downloaded STL dimensions.
