# ESP32-C3 SuperMini case conversion

Original by **Vinors3DLab**, [MakerWorld model 3419196](https://makerworld.com/de/models/3419196-ultra-compact-case-esp32-c3-supermini-step-file),
CC BY-NC-ND 4.0. See [ATTRIBUTION.md](ATTRIBUTION.md).
The fixed SCAD files are technical format conversions, with no design changes.
The STEP is the editable CAD source. There are no resizing controls.

## Reproduce

From the repository root, with Node dependencies installed:

```bash
uv venv .data/step-tools --python 3.12
uv pip install --python .data/step-tools/bin/python -r tools/step-to-scad/requirements.txt
.data/step-tools/bin/python tools/step-to-scad/convert.py inspect \
  models/esp32-c3-supermini-case/references/Case_ESP32-C3-cad.step

credit=(--creator Vinors3DLab \
  --source-url https://makerworld.com/de/models/3419196-ultra-compact-case-esp32-c3-supermini-step-file \
  --license 'CC BY-NC-ND 4.0' \
  --license-url https://creativecommons.org/licenses/by-nc-nd/4.0/)
.data/step-tools/bin/python tools/step-to-scad/convert.py convert \
  models/esp32-c3-supermini-case/references/Case_ESP32-C3-cad.step \
  --solid 0 -o models/esp32-c3-supermini-case/bottom.scad --stl "${credit[@]}"
.data/step-tools/bin/python tools/step-to-scad/convert.py convert \
  models/esp32-c3-supermini-case/references/Case_ESP32-C3-cad.step \
  --solid 1 --rotate 180 0 0 --angular-tolerance 0.3 \
  -o models/esp32-c3-supermini-case/top.scad --stl "${credit[@]}"

.data/step-tools/bin/python -m unittest discover -s tools/step-to-scad
STL_TO_SCAD_RENDER_TESTS=1 OPENSCAD_RUNNER=docker npx vitest run tools/step-to-scad
TEST_ONLY=esp32-c3-supermini-case npm run test:renderer
OPENSCAD_RUNNER=docker npm run check:assembly -- esp32-c3-supermini-case --tolerance 4 --snap-tolerance 0.1
BASE_URL=http://127.0.0.1:5173 npx playwright test tests/browser/esp32-case.spec.ts
```

The renderer uses the repository's pinned OpenSCAD Docker image. CadQuery 2.6.1 /
OCCT 7.8.1.1 performs the offline conversion; it is not a production dependency.
The converter emits self-contained `polyhedron()` SCAD, a tessellation-reference
STL and a JSON record with the source hash, analytic volume and rigid placement.
Coordinates are welded at six decimals without decimation. CadQuery 2.6.1 uses
OCCT relative linear deflection: the factor is 0.01 (not an absolute millimetre
error bound). Angular deflection is 0.1 rad for the base and 0.3 rad for the lid.
The latter keeps the curved lettering compact; the independent comparison below
checks its fidelity. No features or letters are rebuilt with replacement fonts.

## Geometry verification

STEP SHA-256:
`585a8cd17c842e73d1cced65d44ce4af3e3e7029bf83b4024b1a71100d33ec31`.

Both BReps are valid. Each SCAD renders as one connected, closed, consistently
wound manifold with no degenerate triangles and no float32 sliver repairs.
The rendered SCAD matches its tessellation-reference STL with IoU 1.000000.
Independent comparisons use the original, separately supplied 3MF meshes:

| Part | Print dimensions (mm) | STEP volume (mm³) | Rendered volume (mm³) | SCAD bytes | IoU vs 3MF |
| --- | --- | --- | --- | --- | --- |
| Base, solid 0 | 25.8 × 21.8 × 7.56 | 1330.878302 | 1330.888214 | 32,155 | 0.999971 |
| Lid, solid 1 | 25.4 × 19.8 × 2.50 | 570.158588 | 570.173957 | 108,477 | 0.999884 |

SCAD/3MF bounding-box differences are below 0.000001 mm. Volume differences
against STEP are +0.00075% and +0.00270%; against 3MF, −0.00235% and +0.00274%.
IoU uses the existing verifier's 0.2 mm ray grid with its oblique sample rotation.
These are numerical format-conversion checks, not a physical fit test.
The full source envelope includes projecting features and is wider than the
18.6 mm body width quoted in the author's description.

To reproduce the independent mesh comparisons without installing CadQuery:

```bash
python3 tools/step-to-scad/reference_3mf.py \
  models/esp32-c3-supermini-case/references/bottom.3mf .data/bottom-3mf.stl
python3 tools/step-to-scad/reference_3mf.py \
  models/esp32-c3-supermini-case/references/top.3mf .data/top-3mf.stl --flip-x
OPENSCAD_RUNNER=docker npm run stl-scad -- verify \
  models/esp32-c3-supermini-case/bottom.scad .data/bottom-3mf.stl
OPENSCAD_RUNNER=docker npm run stl-scad -- verify \
  models/esp32-c3-supermini-case/top.scad .data/top-3mf.stl
```

## Placement and assembly

The source's base bounds are `[-1.5, -1.9, -1.7]` to `[24.3, 19.9, 5.86]`.
Its print transform is translation `[-11.4, -9, 1.7]`. The lid bounds are
`[-1.1, -0.9, 3.36]` to `[24.3, 18.9, 5.86]`. Its print transform is rotation
`[180, 0, 0]`, then translation `[-11.6, 9, 5.86]`, placing the outer roof on
the bed. The catalogue inverts those transforms and grounds the original assembly:
base position `[0, 0, 0]`; lid rotation `[180, 0, 0]`, position `[0.2, 0, 7.56]`.
The 0.0000001 mm BRep tolerance expansion is below the committed mesh precision.

The lid slides from positive X (the USB end), starting 30 mm away at rail height.
The Play button and assembly slider use this path; the base and lid also remain
individually hideable. The card's assembled/exploded SVG is a schematic; the live
preview displays the actual converted geometry. Electronics are not printed or
represented as a speculative board model.

**Measured interference retained from the original.** The closed STEP solids
have zero intersection. During positive-X insertion, two small lid features pass
the USB-end wall at X offsets around 14–16 mm: exact OCCT intersections total
0.665733 mm³, localized to Y `5.531–6.869` and `11.131–12.469`, Z `3.36–4.36`
in the source frame. Near seating, the small detents intersect by 0.024 mm³ at
0.25 mm remaining travel. Sliding along Y or from negative X produces much larger
wall collisions (tens of mm³), so those are incorrect animation directions.

The existing coarse assembly ray sampler reports **3.31 mm³** maximum during
insertion, **0.02 mm³** near seating, and **0.00 mm³** in both the assembled and
exploded states. Its 0.2 mm columns exaggerate the small curved intersections.
The explicit CI allowances are 4 mm³ along the path and 0.1 mm³ in the final
10 mm. They preserve this source geometry rather than cutting away the features.
The animation uses rigid parts and does not simulate their elastic deformation.
