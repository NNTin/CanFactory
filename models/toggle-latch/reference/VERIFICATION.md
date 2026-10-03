# Toggle latch: STL to SCAD verification

Renderer: docker — openscad/openscad:dev.2026-01-19@sha256:0af06bc2aa7a45d18b01a23cfb9dae6dddcd9542611e7be50edea6beb3b52fa7 (Manifold backend). Tolerance: bbox ≤ 0.1 mm, volume ≤ 2 %, IoU ≥ 0.96, one closed manifold body; cell 0.2 mm.

| Part | Result | Size Δ (mm) | Volume Δ | IoU | Mean dev (mm) | Ref tris | SCAD bytes | Render (s) |
|---|---|---|---|---|---|---|---|---|
| Latch 12mm 1 | PASS | -0.000 / -0.000 / 0.000 | -1.45 % | 0.9846 | 0.021 | 2158 | 4284 | 0.8 |
| Latch 12mm 2 | PASS | -0.000 / -0.000 / -0.002 | -0.46 % | 0.9896 | 0.016 | 2036 | 3084 | 0.7 |
| Latch 12mm 3 | PASS | -0.001 / -0.000 / -0.001 | -0.04 % | 0.9956 | 0.004 | 1750 | 4371 | 0.8 |
| Latch 12mm 3 HiTol | PASS | -0.001 / 0.002 / 0.001 | -0.10 % | 0.9950 | 0.005 | 1634 | 4382 | 0.8 |
| Latch 12mm 4 | PASS | -0.000 / 0.000 / 0.000 | -0.67 % | 0.9914 | 0.009 | 1752 | 3373 | 0.7 |

## Sources

- `Latch 12mm 1`: source STL SHA-256 `1633d8bb6fb03c0adad402a862a81e755904c44f932452bb8cf33d939979d7a8`, 38.00 × 14.40 × 12.00 mm
- `Latch 12mm 2`: source STL SHA-256 `ddabcd1478af9249d0a316d830853cdc6e10b1dc9fd85bdf4ecf29037a1ce550`, 38.00 × 15.37 × 12.00 mm
- `Latch 12mm 3`: source STL SHA-256 `3bc39eea6f1943d9bce05be33bf274b5bc5450a8318c5128e2b8deb06ce1a28e`, 31.62 × 18.40 × 13.90 mm
- `Latch 12mm 3 HiTol`: source STL SHA-256 `5c2fa8760582d6a11acb7c653097aa307031b5aff24062bf2066710cab9e6f10`, 31.62 × 18.40 × 13.90 mm
- `Latch 12mm 4`: source STL SHA-256 `ba0bd37ea5191591ae4a93dfeca9ce87318e9427ad0feb7f32d64210ef2c38cc`, 34.15 × 17.40 × 10.03 mm

## Parts

| STL | Part |
|---|---|
| Latch 12mm 1 | Catch: mounting plate and the hook the link closes over |
| Latch 12mm 2 | Base: mounting plate and the knuckle with the lever's pivot pins |
| Latch 12mm 3 | Lever, standard tolerance |
| Latch 12mm 3 HiTol | Lever, high tolerance: a 5.14 mm pivot hole (instead of 4.99) and 4.41 mm link pins (instead of 4.64) |
| Latch 12mm 4 | Link: the loop that hooks over the catch |

None of the five is a scaled copy of another. The two levers share one SCAD that differs only in `HITOL`.

## Method and limits

Every part is a few measured side profiles extruded along one axis: the catch's hook and the base's knuckle along
X, the lever's and the link's side plates and bridges along Y. The plates are hulls of r = 1 mm spheres (rounded
front edges), the holes are cylinders with a 90 degree countersink, the pins cylinders. The 45 degree chamfers on
the outer faces of the lever and the link are three 0.2 mm offset steps, and the catch's 1 mm hook-end chamfer one
step; the small fillets at the bottom of the catch's plate are left out, which is most of its -1.5 % volume.
Volume, bounding box and manifoldness are computed exactly from the meshes; IoU is sampled on a 0.2 mm grid of
vertical rays (rotated 13.7 degrees against the axes) and is exact along Z.

Reproduce with `npm run stl-scad -- verify --manifest models/toggle-latch/reference/manifest.json --report models/toggle-latch/reference/VERIFICATION.md` (needs the source STLs and an OpenSCAD runtime; see `.claude/skills/stl-to-scad/SKILL.md`).
