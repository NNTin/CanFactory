# Cigarette case (Onz): STL to SCAD verification

Renderer: wasm — OpenSCAD version 2025.01.19 via openscad-wasm-prebuilt (Manifold backend). Tolerance: bbox ≤ 0.1 mm, volume ≤ 2 %, IoU ≥ 0.96, one closed manifold body; cell 0.2 mm.

| Part | Result | Size Δ (mm) | Volume Δ | IoU | Mean dev (mm) | Ref tris | SCAD bytes | Render (s) |
|---|---|---|---|---|---|---|---|---|
| 11_-_Honeycomb_-_minibox | PASS | -0.007 / -0.013 / 0.001 | -0.44 % | 0.9664 | 0.016 | 15404 | 4976 | 0.7 |
| 11_-_Honeycomb_-_topminibox_-_box | PASS | -0.049 / -0.002 / -0.000 | 1.12 % | 0.9719 | 0.014 | 11082 | 4333 | 0.2 |
| 11_-_Honeycomb_-_topminibox_-_top | PASS | -0.001 / -0.002 / -0.000 | 1.57 % | 0.9747 | 0.013 | 10512 | 5233 | 0.2 |
| 11_v11.3__-_honeycomb_-_box | PASS | 0.019 / -0.002 / -0.000 | 0.65 % | 0.9810 | 0.016 | 571808 | 66212 | 12.7 |
| 11_v11.3__-_honeycomb_-_top | PASS | -0.001 / -0.001 / 0.000 | 1.06 % | 0.9729 | 0.018 | 423568 | 56979 | 9.3 |

## Sources

- `11_-_Honeycomb_-_minibox`: source STL SHA-256 `e9b976e23c96951b7d711e13a9117d286b17bbe5bb14e2c640a8b16720f35951`, 10.88 × 21.84 × 32.69 mm
- `11_-_Honeycomb_-_topminibox_-_box`: source STL SHA-256 `6c05e03e126aceb9f5035ca5eee1343da4eb8a85619a55762c521ac8e9e1d1b0`, 34.48 × 27.52 × 14.39 mm
- `11_-_Honeycomb_-_topminibox_-_top`: source STL SHA-256 `be058a2f67c75a1742a1b2466e1dc14d8a6c7a2a4d2c6d7cfa574ade278c8c0c`, 34.48 × 25.12 × 13.39 mm
- `11_v11.3__-_honeycomb_-_box`: source STL SHA-256 `60fcee1d38b5622a0b71535830a14ae86f6655b1a5af6dc043c42114bc3dc1c0`, 55.89 × 34.40 × 77.17 mm
- `11_v11.3__-_honeycomb_-_top`: source STL SHA-256 `e4df9a299667373e8b1e5997b5f8e690696b0c53043fe0b58eab1cbbedae755e`, 55.89 × 34.40 × 41.87 mm

## The five parts

Only the two large v11.3 parts carry the honeycomb. The three mini parts (`minibox`, `topminibox box`, `topminibox top`) are smooth
thin-walled shells without any relief; none of the five STLs is a scaled copy of another (`inspect` reports no scale copies).
The large box and lid share one outline (a rounded D shape, 55.9 x 34.4 mm) and one honeycomb; the lid slides over the box's upper 17 mm.
The topminibox lid is the topminibox box's plan mirrored in X and pulled in by 1.2 mm (wall 1 mm + 0.2 mm clearance).

## Method and limits

The mini parts are rebuilt from measured primitives: the plan outline as a polygon, walls and floors of 1 mm, an elliptical window or notch,
a curved end profile swept along Y, half-ellipse detent pads and a dome traced as a stack of scaled slices.

The honeycomb of the large parts is a relief of three plateaus (0, 1.36 and 2.39 mm above the plain wall: a hexagonal ridge network with a Y-shaped
ridge in every cell) on a rounded outline. It was measured with `npm run stl-scad -- relief` (a height map of the wall against its smooth base
outline, cut into plateau regions, written as data) and is bent back around the outline by the `relief_wrap()` module inside each SCAD. The
regions are data, not a generator: the lattice in the STL is a stretched hexagonal grid (10.0 mm across flats, rows 9.14 mm apart, ridges 1.16 mm
wide) but its phase drifts along the outline (the corners compress it by up to 7 %), so a single ideal lattice fitted only 91 % of the wall cells.
Regenerating it procedurally, with the corner compression, is left to the parametrisation phase.

The lid's lattice top is two extruded section polygons (pockets included). The box's plain upper wall, flange and cavities are extruded section polygons.

## Source meshes

The two large source STLs are not watertight (box: 56 open or non-manifold edges, lid: 45; 570 k and 420 k triangles). Volume and IoU use them as is.

Reproduce with `npm run stl-scad -- verify --manifest models/cigarette-case/reference/manifest.json --report models/cigarette-case/reference/VERIFICATION.md`
(needs the source STLs and an OpenSCAD runtime; see `.claude/skills/stl-to-scad/SKILL.md`).
