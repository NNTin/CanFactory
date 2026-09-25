# Moss planter: parameters and generators

The moss planter is one model with five parts — ground spike, planting helper, cover cap, and two lattice ("RAUTE")
segments, short and tall — generated for any tower diameter. `ModelPart.scadMapping` (see
[adding-models.md](adding-models.md#multi-part-assemblies)) feeds each part the parameters it uses.

## Parameters

| Key | Range | Default | Used by | SCAD variable |
|---|---|---|---|---|
| `towerDiameter` | 40–120 mm, step 1 | 52 | all five parts | `TOWER_DIAMETER` |
| `spikeLength` | 50–300 mm, at least `60 x towerDiameter / 52` | 124 | ground spike | `SPIKE_LENGTH` |
| `shortRauteRows` | 2–20 | 4 | short lattice | `ROWS` |
| `tallRauteRows` | 2–24 | 10 | tall lattice | `ROWS` |
| `rauteColumns` | 0 (automatic) or 4–16 | 0 | both lattices | `COLUMNS` |

Dependent rules (`validateMossPlanter`): the spike must be long enough to clear its base (about 50 mm at 52 mm), and
`rows x columns` for a lattice may not exceed 340, which bounds the render time under the worker's 120-second limit.

## Why every part fits every other

The 100 mm family of the original design is the 52 mm family uniformly scaled by 100/52, thread included (pitch
`5 x 100/52`). The generators generalise that: every part is the 52 mm design scaled by `s = towerDiameter / 52`, so
parts built for the same `towerDiameter` share one thread (pitch `5 s`, root and crest radii `~18 s` and `~20 s`) and
screw together at every diameter, 53, 54 … 99 included. Only the parts' threaded ends have to scale; the lattice
between them may grow differently.

## What scales, and how the lattice grows

| Part | Behaviour |
|---|---|
| Ground spike, planting helper, cover cap | The reconstruction, scaled uniformly by `s`. The spike's length is set separately (`TIP_Z = length / s`). |
| Lattice collar and top ring, both threads | The 52 mm design, scaled by `s`. |
| Lattice tube | Radius and wall thickness scale by `s`. Strut width (about 4 mm), row pitch (17.5 mm) and helix angle do not, so the number of columns grows with the circumference (about one per 8.66 mm of diameter: 6 at 52 mm, 12 at 100 mm). |
| Lattice height | `rows x 17.5 mm` between the rings. |

This follows the original 100 mm tall lattice (`obj_9`: same 4 mm struts as the 52 mm part, twice the columns), not the
scaled short lattice (`obj_1`: 7.9 mm struts, 6 columns).

## Fidelity to the originals

`models/moss-planter/reference/` keeps the ten verified reconstructions; they are the baseline for the generators.

- Spike, helper and cap: identical to `obj_3/2`, `obj_6/8`, `obj_10/7` at 52 and 100 mm.
- Short lattice at 52 mm, 4 rows: 125 mm, IoU 0.974 against `obj_5`. Tall lattice at 52 mm, 10 rows: 230 mm, IoU
  about 0.96 against `obj_4` (the two originals differ in ring heights by 0.8 mm; `LIFT` interpolates them).
- At 100 mm the lattices are close to, not identical with, `obj_1`/`obj_9`: constant strut width is kept, but `obj_9`'s
  wider odd rows, phase offset and its own strut tables are not reproduced (IoU about 0.8 against `obj_9`).
- The lattice's inner wall is 22.97 mm (x `s`) rather than the measured 23.013: the strut sections have vertices within
  0.001 mm of the latter and the near-tangent cuts leave zero-area triangles at some diameters.

## Known limits

The lattice is built from many overlapping solids, and `inspectStl` rejects zero-area triangles. Sweeping the whole
range (every diameter 40–120 at 4 rows, 250+ random combinations of diameter, rows and columns, and 60 spike lengths)
renders all but about 1 in 300 lattice combinations (seen once: 2 rows, 8 columns, 111 mm), which fail with
"The mesh contains a zero-area triangle"; a neighbouring value normally renders. Two earlier failure
classes were real bugs and are fixed: the top gusset was not turned for an odd number of rows, which left slivers or
disconnected pieces at every odd row count, and the lattice's root/clip surfaces sat within 0.001 mm of ring and strut
vertices.

## Verification

`tools/test-renderer.ts` renders five settings end to end (the two original towers, 77 mm with custom rows and columns,
and both extremes) and checks that every part is a valid closed solid whose width follows the tower diameter and whose
spike has the requested length. `tools/stl-to-scad/moss-planter-generators.test.ts` (opt in with
`STL_TO_SCAD_RENDER_TESTS=1`) compares the generators with the reference STLs and renders intermediate sizes.
