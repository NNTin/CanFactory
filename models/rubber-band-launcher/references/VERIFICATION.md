# Rubber band launcher: STL to SCAD verification

Renderer: wasm — OpenSCAD version 2025.01.19 via openscad-wasm-prebuilt (Manifold backend). Tolerance: bbox ≤ 0.1 mm, volume ≤ 2 %, IoU ≥ 0.96, one closed manifold body; cell 0.2 mm.

| Part | Result | Size Δ (mm) | Volume Δ | IoU | Mean dev (mm) | Ref tris | SCAD bytes | Render (s) |
|---|---|---|---|---|---|---|---|---|
| Rubber Band Launcher frame | PASS | -0.020 / -0.000 / 0.007 | -0.37 % | 0.9716 | 0.059 | 85268 | 54843 | 5.5 |
| Rubber Band Launcher trigger | PASS | -0.002 / -0.001 / 0.003 | 0.03 % | 0.9978 | 0.006 | 34518 | 4880 | 0.7 |

## Sources

- `Rubber Band Launcher frame`: source STL SHA-256 `4546ebe181ec7104b7927a6620d0a1136b64877ebe12b67785a4dd219549f4c8`, 126.87 × 20.60 × 109.61 mm
- `Rubber Band Launcher trigger`: source STL SHA-256 `3ebb6cdced9ec52635b188ed7b1ce2d879026b1dc24f14e4279ef29566ebebb6`, 46.34 × 16.57 × 57.09 mm

## Source and parts

`Rubber Band Launcher.stl` (ASCII, 119 786 triangles, SHA-256 `35bf58e7…f1a5`) by FerryTeacher, CC BY-NC-SA, holds two
separate closed bodies posed as they print together (print in place). They are split into the comparison copies
`Rubber Band Launcher.frame.stl` (85 268 triangles) and `Rubber Band Launcher.trigger.stl` (34 518 triangles): the
same triangles, unchanged and unmoved, one body per file (binary STL).

| STL | Part | SCAD |
|---|---|---|
| Rubber Band Launcher.frame | Frame: barrel with its tip and arm under the barrel, side plates, oval handle with grip pockets | `../frame.scad` |
| Rubber Band Launcher.trigger | Trigger: plate with grip ridges and the two conical pivot pins | `../trigger.scad` |

## Method and limits

Both bodies are modelled lying flat (the 20 mm thickness along Z) and stood up as the source prints them, on the
barrel's top edge; the trigger keeps its place in the frame, so the two prints together are the original
print-in-place layout. The frame is mirror-symmetric about its mid plane except for the 0.6 mm embossed plus.

- Frame, side plates (0 to 3.25 mm from each face): 14 slices, each the measured section at its middle height
  (simplified to 0.03 mm), because the edge rounding varies around the outline (about 3 mm wide on the rail, 5.5 mm
  on the grip). Every other slice is shifted by 3 µm so that neighbouring sections never share a vertex.
- Frame, between the plates: the rail (to 4.5 mm), the arm under the barrel and the spine as measured outlines; the grip and
  the barrel's tip with a fitted oval cross section (6 x 8.47 mm, faces 1.53 mm inside the plates' faces); the grip
  pockets with fitted 3.47 mm rim and 4 mm floor fillets down to the 2 mm web; cones for the pivot sockets (slope 0.83).
- Trigger: its measured outline, 12 mm thick with 0.9 mm rounded edges, five ellipsoid grip ridges and two cones
  (slope 0.84) for the pivot pins.

Rounded surfaces are stacks of offset slices, so they are stepped. Left out: the 45-degree ramps at the ends of the
barrel rail's slot (most of the frame's remaining difference, with the steps).
Volume, bounding box and manifoldness are computed exactly from the meshes; IoU is sampled on a 0.2 mm grid of
vertical rays (rotated 13.7 degrees against the axes) and is exact along Z.
