# ESP32-C3 SuperMini case

Original by **Vinors3DLab**. [Attribution and source licenses](ATTRIBUTION.md).
Model version 3 adds default-on pin-header insulator openings and selectable header seating to the LED openings and board/header assembly preview.
The adaptation uses the author's matching **MakerOnline CC BY-NC-SA 4.0** release;
the supplied MakerWorld originals retain their CC BY-NC-ND 4.0 notices.

## Geometry and reproduction

STEP SHA-256:
`585a8cd17c842e73d1cced65d44ce4af3e3e7029bf83b4024b1a71100d33ec31`.
Both original BReps are valid. The base is solid 0; the lid is solid 1.
The originals in `references/` remain unchanged. The root STL/JSON files are
baseline conversion references without LED or insulator openings, not runtime dependencies.

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
SCAD wrappers for the LED and pin-header openings. CadQuery 2.6.1 / cadquery-ocp 7.8.1.1.post1 performs
conversion offline; production only renders self-contained SCAD. Coordinates are
welded at six decimals without decimation. CadQuery uses relative linear
deflection factor 0.01, not a millimetre error bound; angular deflection is
0.1 rad for the base and 0.3 rad for the lid. Original lettering is retained.

With both LED openings and Flush pin headers disabled, each part matches its original tessellation-reference
STL with IoU 1.000000. Independent comparison against the supplied 3MFs gives:

| Part | Print dimensions (mm) | STEP volume (mm³) | Baseline rendered volume (mm³) | IoU vs 3MF |
| --- | --- | --- | --- | --- |
| Base | 25.8 × 21.8 × 7.56 | 1330.878302 | 1330.888214 | 0.999971 |
| Closed lid | 25.4 × 19.8 × 2.50 | 570.158588 | 570.173957 | 0.999884 |

Bounds differ from 3MF by less than 0.000001 mm. The IoU verifier uses its existing
0.2 mm oblique ray grid. All four setting combinations produce one connected, closed,
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
replace the narrow slots through the floor. Their centres are derived from the
actual library pin rows: source XY `[10.54, 1.38]` and `[10.54, 16.62]`, or
print XY `[-0.86, ±7.62]`. The dimensions clear the manufacturer's maximum
20.67 × 2.69 mm insulator envelope by 0.2 mm on every side. The cutters run from
print z=−0.1 to 1.8, clearing the floor and seated insulator without cutting the
upper rails or relocating the PCB, USB port or lid.

In the default mode, each insulator's upper face seats against the PCB underside
at source z=0. Its 2.54 mm thickness extends 0.84 mm below the exterior case floor:
“flush” refers to seating against the PCB, not a coplanar exterior face. Nominal
solder tails project 2 mm beyond the nominal 1 mm PCB. The lowest mating-pin tips
are at source z=−8.54. With `flushHeaders: false`, the original base is restored:
insulators stay at source z=−1.8, 0.1 mm below the floor, and only solder tails
pass through the slots. The nominal 3 mm tails then reach z=1.2 (0.2 mm above
the PCB); minimum-length tails can be flush with its top. Check delivered parts,
board variants and solder access before fitting replacements.

The live assembly adapts the header seating and grounds the mating-pin tips for
both modes. Final poses, computed in `packages/contracts/src/esp32Case.ts`:

| Object | Flush headers (default) | Original narrow slots |
| --- | --- | --- |
| Base | `[0, 0, 6.84]` | `[0, 0, 8.64]` |
| Roof-down lid | `[0.2, 0, 14.40]` | `[0.2, 0, 16.20]` |
| Board | `[11.2, −9, 8.54]` | `[11.2, −9, 10.34]` |
| Headers | `[-0.86, ±7.62, 11.54]` | `[-0.86, ±7.62, 11.54]` |

The lid rotates `[180, 0, 0]`, board `[0, 0, 90]` and headers `[180, 0, 90]`.
The board-to-case relationship stays constant; the case and board move down
1.8 mm relative to the grounded headers when flush seating is enabled.

The animation starts with the board seated. It inserts the two headers from
below, then slides the lid from positive X, the **antenna end**. Straight-line
board insertion intersects the original case, so no unverified insertion path
is animated. The printed-parts grid and exploded arrangement are layout views.
The board and each header are individually hideable and excluded from the ZIP.

## Assembly verification

All ten assembled object pairs have zero sampled overlap in both header seating modes. Header insertion also
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
OPENSCAD_RUNNER=docker npm run check:assembly -- esp32-c3-supermini-case --tolerance 4 --snap-tolerance 0.1
OPENSCAD_RUNNER=docker npm run check:assembly -- esp32-c3-supermini-case --tolerance 4 --snap-tolerance 0.1 --parameters '{"ledHoles":false}'
OPENSCAD_RUNNER=docker npm run check:assembly -- esp32-c3-supermini-case --tolerance 4 --snap-tolerance 0.1 --parameters '{"flushHeaders":false}'
OPENSCAD_RUNNER=docker npm run check:assembly -- esp32-c3-supermini-case --tolerance 4 --snap-tolerance 0.1 --parameters '{"ledHoles":false,"flushHeaders":false}'
BASE_URL=http://127.0.0.1:5273 npx playwright test tests/browser/esp32-case.spec.ts
```

The independent 3MF comparison test extracts the reference meshes using
`tools/step-to-scad/reference_3mf.py` and disables both adaptations during comparison. Renderer coverage checks the
maximum insulator footprint at three floor heights, restored source bands when
flush seating is disabled, retained side walls, and the LED apertures. Browser
coverage downloads all four combinations and checks that each switch changes
only the corresponding printed part.
