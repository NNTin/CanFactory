# ESP32-C3 SuperMini case

Original by **Vinors3DLab**. [Attribution and source licenses](ATTRIBUTION.md).
Model version 4 provides independent, default-on toggles for LED openings, pin-header insulator openings and a taller enclosure, with a matching board/header assembly preview.
The adaptation uses the author's matching **MakerOnline CC BY-NC-SA 4.0** release;
the supplied MakerWorld originals retain their CC BY-NC-ND 4.0 notices.

## Geometry and reproduction

STEP SHA-256:
`585a8cd17c842e73d1cced65d44ce4af3e3e7029bf83b4024b1a71100d33ec31`.
Both original BReps are valid. The base is solid 0; the lid is solid 1.
The originals in `references/` remain unchanged. The root STL/JSON files are
baseline conversion references without LED openings, insulator openings or the base extension, not runtime dependencies.

From the repository root, reproduce the original conversion in a scratch folder:

```bash
uv venv .data/step-tools --python 3.12
uv pip install --python .data/step-tools/bin/python -r tools/step-to-scad/requirements.txt
credit=(--creator Vinors3DLab \
  --source-url https://makerworld.com/de/models/3419196-ultra-compact-case-esp32-c3-supermini-step-file \
  --license 'CC BY-NC-ND 4.0' \
  --license-url https://creativecommons.org/licenses/by-nc-nd/4.0/)
.data/step-tools/bin/python tools/step-to-scad/convert.py convert \
  models/esp32-c3-supermini-case/references/Case_ESP32-C3-cad.step \
  --solid 0 -o .data/esp32-source/bottom.scad --stl "${credit[@]}"
.data/step-tools/bin/python tools/step-to-scad/convert.py convert \
  models/esp32-c3-supermini-case/references/Case_ESP32-C3-cad.step \
  --solid 1 --rotate 180 0 0 --angular-tolerance 0.3 \
  -o .data/esp32-source/top.scad --stl "${credit[@]}"
```

These commands reproduce the unmodified baseline; they do not overwrite the live
SCAD wrappers for the LED openings, pin-header openings and base extension. CadQuery 2.6.1 / cadquery-ocp 7.8.1.1.post1 performs
conversion offline; production only renders self-contained SCAD. Coordinates are
welded at six decimals without decimation. CadQuery uses relative linear
deflection factor 0.01, not a millimetre error bound; angular deflection is
0.1 rad for the base and 0.3 rad for the lid. Original lettering is retained.

With all three toggles disabled, each part matches its original tessellation-reference
STL with IoU 1.000000. Independent comparison against the supplied 3MFs gives:

| Part | Print dimensions (mm) | STEP volume (mm³) | Baseline rendered volume (mm³) | IoU vs 3MF |
| --- | --- | --- | --- | --- |
| Base | 25.8 × 21.8 × 7.56 | 1330.878302 | 1330.888214 | 0.999971 |
| Closed lid | 25.4 × 19.8 × 2.50 | 570.158588 | 570.173957 | 0.999884 |

Bounds differ from 3MF by less than 0.000001 mm. The IoU verifier uses its existing
0.2 mm oblique ray grid. All eight setting combinations produce one connected, closed,
consistently wound manifold per printed part, without float32 sliver repairs.
The worker tests aperture interiors and adjacent source surfaces at several roof
heights, and confirms preview/download bytes match. These are numerical checks,
not physical fit or button-stiffness tests.

## LED openings

`ledHoles` defaults to `true`. The lid receives
`LED_HOLES`, plus trusted coordinates derived from the existing board library's
LED components. Each cutter is a 2 mm cylinder through the roof.

| LED | Board library XY | Roof-down lid XY |
| --- | --- | --- |
| Red power | 2.99, 17.31 | −6.31, 6.01 |
| Blue GPIO8 | 13.56, 11.44 | −0.44, −4.56 |

The blue LED's axis already falls under a narrow button-relief slot. Its cutter
widens the optical clearance there, rather than creating an isolated circular
rim. The red aperture is separate. Turning the setting off restores the original
lid, including its existing relief slots. LED/component positions are estimated
in the Nologo board entry; SuperMini clones may differ. Check the delivered board
and button operation before using a print.

## Electronics and coordinates

The existing `nologo-esp32-c3-supermini` part supplies the board outline,
components, two eight-pin rows and LED positions. No duplicate or scaled board
model is introduced. Source case frame: long axis +X, width +Y, PCB underside
z=0, USB towards **negative X**. The board library frame has width +X, length +Y,
USB +Y: rotate +90° about Z and translate by `[22.6, 0, 0]` into the source case.
This aligns the board with the slots and its buttons with the lid actuators,
within the existing board component-position estimates.

The source base floor extends from z=−1.7 to −0.2. Its two slots are 20.18 ×
2.40 mm, centred at y=1.38 and 16.62. The new `pin-header` library family contains
Würth WR-PHD 61300811121: one row of eight 0.64 mm square pins at 2.54 mm pitch,
20.32 × 2.54 mm plastic, 3 mm solder tails and 6 mm mating posts. Dimensions and
stated tolerances come from the manufacturer's drawing.

`flushHeaders` defaults to `true`. Two 21.07 × 3.09 mm rectangular openings
replace the narrow slots through the selected floor. Their centres are derived
from the actual library pin rows: source XY `[10.54, 1.38]` and `[10.54, 16.62]`,
or print XY `[-0.86, ±7.62]`. They clear the manufacturer's maximum
20.67 × 2.69 mm insulator envelope by 0.2 mm on every side. Header insulators
seat against the PCB underside at source z=0. Disabling this toggle restores
narrow slots and places the spacers 0.1 mm outside the selected case floor.

`tallerEnclosure` is a separate, independent toggle, also defaulting to `true`.
It extends the base downward by 0.84 mm: exterior height becomes **8.40 mm**
instead of **7.56 mm**. The source bottom moves from z=−1.7 to **−2.54**, matching
the bottom of the nominal 2.54 mm insulator when it seats against the PCB.
Thus the two housing bottoms are coplanar with both toggles on. Only the mating
pins project below them. With flush headers on but the height toggle off, the
insulators extend 0.84 mm below the shorter case.

The base extension uses an extrusion of the original constant floor cross-section
at print z=0.1, joined with 0.01 mm overlap to a vertically translated original
base. This thickens the floor from 1.50 to 2.34 mm and keeps the internal floor
surface, board seating, USB opening, rails and lid unchanged relative to the PCB.
The new floor starts at print z=0; all original features above it shift up by
0.84 mm in the part's print frame. The header cutters extend from print z=−0.1
to 0.1 mm above the PCB underside in either height, so the wider slots remain
through-holes. Neither the preserved source mesh nor the source files are edited.

Nominal 3 mm solder tails extend 2 mm beyond the 1 mm PCB with flush headers on.
With flush headers off, they reach 0.2 mm beyond the PCB in the shorter case.
In the **taller case with narrow slots**, the shown 3 mm tails enter the PCB by
only **0.36 mm** and stop inside it; use longer solder tails for through-board
soldering (at least 3.64 mm to reach the top at nominal dimensions, plus the
required projection). The editor shows a note for this combination. Check actual
header dimensions, board variants and solder access before fitting replacements.

The assembly adapts both seating and enclosure height, grounding the mating-pin
tips in all four combinations (LED openings do not change placement). Final poses
are computed in `packages/contracts/src/esp32Case.ts`:

| Object | Flush + taller (default) | Flush + shorter | External + taller | External + shorter |
| --- | --- | --- | --- | --- |
| Base | `[0, 0, 6.00]` | `[0, 0, 6.84]` | `[0, 0, 8.64]` | `[0, 0, 8.64]` |
| Roof-down lid | `[0.2, 0, 14.40]` | `[0.2, 0, 14.40]` | `[0.2, 0, 17.04]` | `[0.2, 0, 16.20]` |
| Board | `[11.2, −9, 8.54]` | `[11.2, −9, 8.54]` | `[11.2, −9, 11.18]` | `[11.2, −9, 10.34]` |
| Headers | `[-0.86, ±7.62, 11.54]` | `[-0.86, ±7.62, 11.54]` | `[-0.86, ±7.62, 11.54]` | `[-0.86, ±7.62, 11.54]` |

The lid rotates `[180, 0, 0]`, board `[0, 0, 90]` and headers `[180, 0, 90]`.

The animation starts with the board seated. It inserts the two headers from
below, then slides the lid from positive X, the **antenna end**. Straight-line
board insertion intersects the original case, so no unverified insertion path
is animated. The printed-parts grid and exploded arrangement are layout views.
The board and each header are individually hideable and excluded from the ZIP.

## Assembly verification

All ten assembled object pairs have zero sampled overlap in all height/header/LED combinations. Header insertion also
has zero sampled overlap. The lid retains the original detent interference:
the coarse 0.2 mm ray sampler reports 3.31 mm³ during insertion, 0.02 mm³ near
seating, and 0.00 mm³ when closed. Exact OCCT intersection of the original two
solids during insertion is 0.665733 mm³; the coarse sampler exaggerates the small
curved intersections. Existing CI allowances remain 4 mm³ along the path and
0.1 mm³ in its last 10 mm. The animation does not simulate elastic deformation.
The earlier version's “USB end” insertion caption was incorrect and is fixed.

```bash
.data/step-tools/bin/python -m unittest discover -s tools/step-to-scad
STL_TO_SCAD_RENDER_TESTS=1 OPENSCAD_RUNNER=docker npx vitest run tools/step-to-scad
TEST_ONLY=esp32-c3-supermini-case npm run test:renderer
for led in true false; do
  for flush in true false; do
    for taller in true false; do
      OPENSCAD_RUNNER=docker npm run check:assembly -- esp32-c3-supermini-case \
        --tolerance 4 --snap-tolerance 0.1 \
        --parameters "{\"ledHoles\":$led,\"flushHeaders\":$flush,\"tallerEnclosure\":$taller}"
    done
  done
done
BASE_URL=http://127.0.0.1:5273 npx playwright test tests/browser/esp32-case.spec.ts
```

The independent 3MF comparison test extracts the reference meshes using
`tools/step-to-scad/reference_3mf.py` and disables all three adaptations during comparison. Renderer coverage checks the
maximum insulator footprint through both floor thicknesses, restored source bands when
flush seating is disabled, retained side walls, and the LED apertures. Browser
coverage downloads all eight combinations, checks both actual STL heights and
editor notes, and verifies that height/header settings affect only the base while
LED settings affect only the lid. Contracts assert that the insulator bottom is
coplanar with the exterior base when both height and flush settings are enabled.
