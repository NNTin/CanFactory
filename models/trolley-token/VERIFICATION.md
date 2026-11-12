# Trolley token — STEP conversion versus the original STLs

Renderer: docker — openscad/openscad:dev.2026-01-19@sha256:0af06bc2aa7a45d18b01a23cfb9dae6dddcd9542611e7be50edea6beb3b52fa7 (Manifold backend). Tolerance: bbox ≤ 0.1 mm, volume ≤ 2 %, IoU ≥ 0.96, one closed manifold body; cell 0.2 mm.

| Part | Result | Size Δ (mm) | Volume Δ | IoU | Mean dev (mm) | Ref tris | SCAD bytes | Render (s) |
|---|---|---|---|---|---|---|---|---|
| Token body | PASS | 0.009 / 0.000 / -0.001 | 0.02 % | 0.9986 | 0.001 | 1178 | 100476 | 2.4 |
| Paper clamp | PASS | 0.000 / 0.000 / 0.005 | -0.01 % | 0.9974 | 0.002 | 1196 | 95834 | 2.2 |

## Sources

- `Token body`: source STL SHA-256 `deab1a297fc49cf754e6135a650b30c6a7f041c9af9f3af18ece16c6000d2ac3`, 51.62 × 30.00 × 7.50 mm
- `Paper clamp`: source STL SHA-256 `100615505c3fa0b906a2b3eb6a893a02de2e27d38634a873d4b04527c84bd746`, 25.00 × 30.00 × 6.99 mm

Original design by jhappone, Thingiverse 4126950, CC BY 4.0. No design changes; rigid print placement only.
Clip.print.stl is the supplied Clip.stl rotated 180 degrees about X; the supplied originals remain unchanged.
The STEP clip carries a 0.26138493093829307 degree assembled tilt. The conversion flattens its outer face for printing, then the assembly pose reverses this rigid transform.
