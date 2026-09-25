---
name: stl-to-scad
description: Reconstruct an STL as a parametric, self-contained OpenSCAD file and prove it matches the source (bounding box, volume, IoU, one closed manifold body). Use when a Canfactory model arrives as STL-only assets (e.g. models/moss-planter/reference) or when an STL must become an editable generator.
---

# STL to SCAD

Canfactory models must be **self-contained, editable SCAD** (see `docs/adding-models.md`). When the only source is an
STL, do not dump the mesh into `polyhedron()`: measure it, rebuild it from primitives, and verify the result with
`tools/stl-to-scad`. The moss planter (10 STLs, 174 MB) became ten 3–12 KB SCAD files this way, all with IoU ≥ 0.966.

Worked example and recipes: [reference.md](reference.md). Results: `models/moss-planter/reference/VERIFICATION.md`.

## Tools

Run from the repository root (`npm ci` first). Big SCADs render faster with a native OpenSCAD (`OPENSCAD_BIN`); the wasm runtime is enough for everything checked in. All commands are `npm run stl-scad -- <command>` (= `tsx tools/stl-to-scad/cli.ts`).

| Command | Purpose |
|---|---|
| `inspect <stl...>` | format, size, volume, watertightness, SHA-256; **detects scaled copies** among the inputs (e.g. `SCALE COPY obj_1 = obj_5 x 1.9231`) |
| `sections <stl> --z a,b,c` or `--step s` `[--svg f]` | horizontal cuts: pieces, net area, centroid angle/radius (finds lattices, fins, holes) |
| `profile <stl> --angle deg [--simplify mm] [--full]` | axial (r, z) outline through the axis: the polygon for `rotate_extrude()`; angle-to-angle changes reveal helical features such as threads |
| `overlay <stl> <stl\|scad> --z a,b,c -o out.svg [-D ..]` | the source's cuts (black) and the reconstruction's (red) on top of each other, heights from each part's lowest point, registered by bounding-box centre: shows where and how a SCAD deviates |
| `render <scad> -o out.stl [-D VAR=val]` | render with OpenSCAD (Manifold backend, as the production worker does) |
| `verify <scad> <stl> [-D ..] [--scale k] [--bands mm]` | render and compare with the STL; exit code 1 if outside tolerance; `--bands 10` prints IoU/volume per 10 mm of height to localise errors |
| `verify --manifest m.json [--only name] [--report out.md]` | batch verify and write a Markdown report |
| `relief <stl> --base-z z --z0 a --z1 b -o f.scad [--open-radius r] [--levels h,..] [--px mm] [--simplify mm] [--min-area mm2] [--origin x,y,z] [--no-refine]` | **wall patterns** (honeycomb, knurling, ribs): height map of the wall against its smooth base outline, cut into plateau levels and written as SCAD data plus `relief_wrap()`, which bends it back around the outline (see "Wall patterns" in reference.md) |
| `polyhedron <stl> -o f.scad [--cluster mm]` | **fallback only**: welded `polyhedron()` dump, refuses > 5 MB |

OpenSCAD runtime, first match wins: `$OPENSCAD_BIN` / `openscad` on PATH, then `openscad-wasm-prebuilt`
(`npm i --no-save openscad-wasm-prebuilt`, not a repo dependency), then Docker with the pinned image from
`packages/server/src/config.ts`. Force one with `OPENSCAD_RUNNER=native|wasm|docker`.

## Workflow

1. **Inspect and dedupe.** `inspect` every STL. Files that differ only by a uniform scale are twins: reconstruct once
   and make the twin a copy that differs only in `SCALE` and its header. Note each STL's plate offset (SCAD parts are
   centred on the Z axis with the base on z = 0; `verify` registers by bounding-box centre, so offsets do not matter).
2. **Look before modelling.** `sections` at many heights and `profile` at several angles. Decide per feature:
   revolved profile, extruded cross section, twisted extrusion (threads, helical struts), loft, boolean.
   A change of profile with angle at fixed height means a helix; measure its pitch and handedness.
3. **Write the SCAD** in `models/<id>/reference/<same basename as the STL>.scad` (fruit-fly-trap layout). Rules:
   - one file, no `include`/`use`; uppercase variable names; millimetres; `SCALE` and `ROUNDNESS` at the top;
   - header credits the original author and link, says it is a reconstruction, and points at `../ATTRIBUTION.md`;
   - the result must be one connected closed solid (the worker rejects open edges and zero-area triangles).
4. **Verify and iterate.** `verify ... --bands 10`; the worst band tells you where to look. Sweep single parameters
   with `-D NAME=value` instead of editing the file.
5. **Fix manifold problems by construction**, not by nudging numbers: see "Pitfalls" in reference.md.
6. **Record**: put every pair in `manifest.json`, run `verify --manifest ... --report .../VERIFICATION.md`, update
   `ATTRIBUTION.md`, and mention any accepted deviation.

## Wall patterns (relief)

When a prismatic wall carries a repeating surface pattern (the cigarette case's honeycomb, 570 k triangles per part) primitives do not
fit, but the pattern is only a height field over the wall. `relief` measures it and `relief_wrap()` rebuilds it: 66 KB of SCAD per part,
IoU 0.973-0.981, renders in 2 s. Use it for the pattern only; the body (base prism, cavities, floor, flange, cap) is still extruded
section polygons, and a lattice that lies flat (a lid top) is just two extruded sections. Procedural generation of a regular pattern is
preferable when the pattern really is regular; check with `relief`'s level regions (a lattice fitted at 91 % here because its phase drifts
around the corners). Details, the wrapper's design and the manifold pitfalls it avoids: reference.md.

## Acceptance (defaults, override per manifest)

Per axis after registering by bounding-box centre: bounding box within **0.1 mm**, volume within **2 %**, IoU
≥ **0.96** on a 0.2 mm ray grid, and the rendered mesh must be **one closed, consistently wound body with no
degenerate triangles**. Thin lattices score lower than solids (0.966 vs 0.999 here); report actuals and never loosen the
tolerance silently.

## When polyhedron is acceptable

Only for organic surfaces that resist primitives, per part, decimated (`--cluster`) to ≤ ~0.5 MB, and flagged in the
PR. Never commit a full-resolution dump (an STL of 500 k triangles is roughly 10–25 MB of SCAD, estimated, and renders
slowly). Quadric decimation trial on a 532 k-triangle part: 20 k triangles (~545 KB of SCAD, estimated) gave 0.5 % volume
error and 0.15 mm maximum deviation; 5 k triangles gave 4 % and 3 mm.

## Tests

`npx vitest run tools` (synthetic meshes only; nothing depends on the source STLs). Rendering tests are opt-in:
`STL_TO_SCAD_RENDER_TESTS=1` (set in the Docker integration workflow). `npm run check` must stay green.
