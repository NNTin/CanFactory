---
name: step-to-scad
description: Inspect STEP CAD solids, convert them into self-contained OpenSCAD, and integrate verified parts, preview, assembly animation and attribution into CanFactory. Use for STEP/STP source models; use stl-to-scad for STL-only reconstruction.
---

# STEP to SCAD

Read `docs/adding-models.md` before catalogue integration. Preserve supplied originals.
STEP carries boundary geometry, not the original modelling history: do not claim
that a tessellated SCAD is an editable parametric reconstruction.

## Inspect and choose representation

Use the repo helper from the repository root:

```sh
uv venv .data/step-tools --python 3.12
uv pip install --python .data/step-tools/bin/python -r tools/step-to-scad/requirements.txt
.data/step-tools/bin/python tools/step-to-scad/convert.py inspect models/<id>/references/source.step
```

The helper uses CadQuery/OCCT, converts STEP units to millimetres and lists every
solid's validity, bounds, analytic volume and surface types. It runs locally;
production needs only the committed SCAD. If installation fails for permissions,
report the failed command and the installation command the user should run.
Do not add CAD tooling to the web or worker dependencies.

Prefer readable primitive/extrusion-based SCAD when the user needs editable
parameters and the source license permits distributing a reconstruction. Use the
STEP face types and sections to measure features; verify against a tessellation
of the source with the existing `npm run stl-scad -- verify` tool.

For a technical format conversion, especially a NoDerivatives source, keep fixed
geometry, lettering and nominal dimensions. The helper creates a compact indexed
`polyhedron()` directly from OCCT tessellation, without decimation or redesign:

```sh
.data/step-tools/bin/python tools/step-to-scad/convert.py convert source.step \
  --solid 0 -o models/<id>/bottom.scad --stl \
  --creator 'Original author' --source-url 'https://original/model' \
  --license 'CC BY-NC-ND 4.0' --license-url 'https://creativecommons.org/licenses/by-nc-nd/4.0/'
```

Convert each physical solid separately. `--rotate X Y Z` applies a rigid print
orientation, then centres XY and grounds Z. The JSON sidecar records that transform,
source hash, CAD and mesh volumes, version and tessellation settings. Derive inverse
assembly poses from these transforms; retain relative source positions. Inspect
before naming parts: STEP solid indices are file-specific. The converter refuses
invalid BReps, open or inconsistently wound meshes, degenerates, excessive volume
error and SCAD over 500 KB by default. Inspect large outputs before changing the
limit. Rendered output still needs the worker's connected-body and topology check.

## Integrate and prove

- Add `ATTRIBUTION.md` with author, original link, exact source license/link,
  changes or format-conversion statement. Keep those in catalogue metadata and
  generated SCAD headers too. Do not replace the source license with the repo's.
- Register `ModelDefinition.parts`, an empty strict schema and no controls for
  fixed geometry. Each SCAD must be self-contained: the cache fingerprints only
  its own bytes. Never depend on `import()` or `include` for runtime CAD assets.
- Add a catalogue SVG schematic and live assembly poses/steps. Use the real
  insertion direction (rails, hinge or snap), not a convenient visual direction.
  Keep reference electronics out of the print ZIP. Do not add hardware solely to
  decorate the animation.
- Verify dimensions, volume, winding, manifold edges and one connected body for
  every rendered part. Compare against independently supplied meshes (e.g. 3MF)
  when available, in addition to the STEP tessellation. Preserve coordinate
  transforms; do not let bounding-box registration hide an incorrect assembly.
  `python3 tools/step-to-scad/reference_3mf.py input.3mf .data/reference.stl`
  extracts one directly built millimetre mesh; `--flip-x` matches a roof-down lid.
  It refuses assemblies/transforms instead of guessing their placement.
- Run `npm run check:assembly -- <id>` and record actual collisions. Small designed
  detent interference needs a measured, stated allowance; do not loosen tolerances
  to conceal a wrong insertion direction. Never edit original geometry to make
  a format conversion pass.
- Add contract, renderer and browser coverage for preview, assembly playback,
  ZIP parts and attribution. Generate contracts and run `npm run check`, relevant
  real-render and browser checks. Registration also changes the pinned invocation
  snapshot: update `packages/server/src/__snapshots__/openscad-invocations.json`
  with `npx vitest run packages/server/src/render-invocations.test.ts --update=all`, then
  inspect that the diff adds only the new model's expected calls.
  Record reproducible conversion commands and
  measured results alongside the model; commit and push as requested.

Worked example: `models/esp32-c3-supermini-case/CONVERSION.md`.
