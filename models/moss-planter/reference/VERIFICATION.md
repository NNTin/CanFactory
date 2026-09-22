# Moss planter: STL to SCAD verification

Renderer: wasm — OpenSCAD version 2025.01.19 via openscad-wasm-prebuilt (Manifold backend). Tolerance: bbox ≤ 0.1 mm, volume ≤ 2 %, IoU ≥ 0.96, one closed manifold body; cell 0.2 mm.

| Part | Result | Size Δ (mm) | Volume Δ | IoU | Mean dev (mm) | Ref tris | SCAD bytes | Render (s) |
|---|---|---|---|---|---|---|---|---|
| obj_1_Moosstab Middle RAUTE small | PASS | 0.000 / 0.000 / -0.000 | 0.50 % | 0.9782 | 0.054 | 531784 | 10870 | 9.7 |
| obj_2_erdspiessV2 | PASS | -0.003 / -0.003 / -0.003 | 0.05 % | 0.9938 | 0.031 | 112886 | 4260 | 2.2 |
| obj_3_erdspiessV2 | PASS | -0.001 / -0.001 / -0.000 | 0.06 % | 0.9936 | 0.017 | 112886 | 4222 | 2.1 |
| obj_4_Moosstab Middle RAUTE | PASS | 0.000 / 0.000 / 0.000 | 0.20 % | 0.9664 | 0.038 | 1048348 | 10766 | 18.1 |
| obj_5_Moosstab Middle RAUTE small | PASS | 0.000 / 0.000 / 0.000 | 0.50 % | 0.9784 | 0.028 | 531784 | 10834 | 9.3 |
| obj_6_Moosstab Planting Helper V3 | PASS | 0.000 / 0.002 / 0.000 | -0.30 % | 0.9821 | 0.041 | 147048 | 6629 | 3.4 |
| obj_7_Moosstab AbdeckkappeV2 | PASS | 0.000 / 0.000 / -0.006 | -0.02 % | 0.9987 | 0.005 | 84996 | 3395 | 1.6 |
| obj_8_Moosstab Planting Helper V3 | PASS | -0.002 / 0.002 / -0.002 | -0.30 % | 0.9821 | 0.078 | 147048 | 6666 | 3.5 |
| obj_9_Moosstab Middle RAUTE 10cm | PASS | 0.000 / 0.000 / 0.000 | -0.37 % | 0.9784 | 0.041 | 770918 | 11814 | 29.0 |
| obj_10_Moosstab AbdeckkappeV2 | PASS | 0.000 / 0.000 / -0.003 | -0.02 % | 0.9987 | 0.002 | 84996 | 3357 | 1.7 |

## Sources

- `obj_1_Moosstab Middle RAUTE small`: source STL SHA-256 `173bc5355baa068b798ad88b5f0df599eb2466f6fecbcaaeca6c17aed215ab89`, 100.00 × 100.00 × 240.38 mm
- `obj_2_erdspiessV2`: source STL SHA-256 `e3ecd58ec65fc7546c2048b93bb14f619b01a23b544135e4d1d4004dcca22dab`, 79.13 × 79.13 × 238.47 mm
- `obj_3_erdspiessV2`: source STL SHA-256 `757c2446aa30ff7030df27b3b8e92419a1ad940e9452050fe3ced5ff3f1aeb91`, 41.15 × 41.15 × 124.00 mm
- `obj_4_Moosstab Middle RAUTE`: source STL SHA-256 `d7fd8bb57f52b673b1298f73b00dc0778a9e15bfba6cd16d1c3ce27849087fcc`, 52.00 × 52.00 × 230.00 mm
- `obj_5_Moosstab Middle RAUTE small`: source STL SHA-256 `41003cab6fc9c7ff44cd0cfae7f90e0eca7e5a0849b1756c813791908fdc1175`, 52.00 × 52.00 × 125.00 mm
- `obj_6_Moosstab Planting Helper V3`: source STL SHA-256 `9dd158432663769b05e4fcb2b8646f442ad2ef7c2f62c10028c50eca7660c98f`, 85.00 × 85.00 × 97.00 mm
- `obj_7_Moosstab AbdeckkappeV2`: source STL SHA-256 `8cf60eba0da7d60aa8cba5d0e0e93b933c0ca60e6c2da227bf81dd6972ec895a`, 100.00 × 100.00 × 28.85 mm
- `obj_8_Moosstab Planting Helper V3`: source STL SHA-256 `93bb30236d1e03927cd14c956471f81ddb810b833a6cd8059a598a78ffee21a4`, 163.46 × 163.46 × 186.54 mm
- `obj_9_Moosstab Middle RAUTE 10cm`: source STL SHA-256 `6e410762617b7e32bcd39e3a3658da1d0a8c0056af69fa9b8b873c8d9d7d6132`, 100.00 × 100.00 × 250.00 mm
- `obj_10_Moosstab AbdeckkappeV2`: source STL SHA-256 `030095e5f43543a557ddffc52929db3bf87ed7ad846f34de9c0772ac86d19bde`, 52.00 × 52.00 × 15.00 mm

## Scaled copies

The ten STLs contain five distinct shapes; four pairs are exact uniform scale copies of each other at 100/52
(same triangle order, largest vertex deviation 1.4e-4 mm after translating and scaling; no two files are
byte-identical). Each pair is reconstructed by one SCAD whose twin differs only in its header and `SCALE`.

| Small (52 mm family) | Large (100 mm family) | Relation |
|---|---|---|
| obj_5 Middle RAUTE small | obj_1 Middle RAUTE small | obj_1 = obj_5 x 1.9231 |
| obj_3 erdspiess V2 | obj_2 erdspiess V2 | obj_2 = obj_3 x 1.9231 |
| obj_6 Planting Helper V3 | obj_8 Planting Helper V3 | obj_8 = obj_6 x 1.9231 |
| obj_10 Abdeckkappe V2 | obj_7 Abdeckkappe V2 | obj_7 = obj_10 x 1.9231 |

obj_4 (52 mm x 230 mm) and obj_9 (100 mm x 250 mm, 12 columns) are not scale copies of anything; they share the
RAUTE construction with obj_5/obj_1 and have their own SCADs.

## Method and limits

Every part is rebuilt from primitives measured on the STL (revolved profiles, twisted extrusions for threads and
helical struts, extruded cross sections, lofted gussets). The lattice struts in the STLs vary by a few percent in
section along their length, which the SCAD models as constant; that is why the three RAUTE lattices score lower
(0.966 to 0.978) than the solid caps, spikes and helpers (0.987 to 0.999). Volume, bounding box and manifoldness are computed exactly from the meshes; IoU is
sampled on a 0.2 mm grid of vertical rays (rotated 13.7 degrees against the axes) and is exact along Z.

Reproduce with `npm run stl-scad -- verify --manifest models/moss-planter/reference/manifest.json --report models/moss-planter/reference/VERIFICATION.md` (needs the source STLs and an OpenSCAD runtime; see `.claude/skills/stl-to-scad/SKILL.md`).
