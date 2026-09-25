# Moss planter: parameter specification (draft 2, pre-implementation)

Goal: show 5 parts (ground spike, planting helper, cover cap, RAUTE short, RAUTE tall) instead of 10 fixed files, with
size and other parameters adjustable in the editor. Architecture: option A — `ModelPart` gains its own parameter
mapping (shared, generic change). This document fixes *which* parameters exist and which part each applies to.

## Findings that constrain the design

1. **Threads must mate.** Every part carries the same thread (pitch 5 mm at the 52 mm design; the 100 mm family
   scales it to 5 x 100/52). Two parts only screw together if they use the same scale. A free per-part size lets a
   user render parts that do not fit each other.
2. **Only two sizes are verified.** Each SCAD was verified against its source STL at exactly two sizes
   (`VERIFICATION.md`: IoU 0.966–0.999). Intermediate scales are the same geometry scaled, but nothing has been
   checked, and the printed thread tolerances change with scale.
3. **RAUTE is one construction with two different 100 mm variants.** At 52 mm, short (obj_5) and tall (obj_4) differ
   mainly in `ROWS` (4 vs 10), `TOP_Z` (125 vs 230), `TOP_GUSSET_END`, `TOP_MIRROR_TRIM`; strut section is shared.
   At 100 mm the short one (obj_1) is obj_5 x 100/52 (6 columns, 4 rows, row pitch 33.6), but the tall one (obj_9)
   is *not* obj_4 x 100/52: 12 columns, `COLUMN_PHASE` 15, its own strut section (odd rows wider), row pitch 17.31
   (unscaled), `STRUT_TWIST` 0.846, height 250 (scaled obj_4 would be 442). So "size = 100" does not mean the
   same thing for the short and tall RAUTE.
4. **Editor controls are `number` | `boolean` only** (`ControlSchema.kind`). A size choice needs either a new
   `enum`/select kind (generic) or is expressed as a boolean ("Large (100 mm)").
5. **Limits on tuned constants.** Several SCAD constants are hand-fitted to the measured STL (e.g. `TOP_GUSSET_END`,
   `TOP_MIRROR_TRIM`, the `BODY`/`PROFILE` point lists). Parameters that move geometry beyond the two verified
   configurations need new bounds tests, not just plumbing.

## Decisions so far

- Tower size is **continuous**, not two presets: any outer diameter `D` (52 and 100 must stay exactly reproducible,
  and every value in between and around them must work: 53, 54 ... 99).
- All five parts must mate at every `D`. Spike, helper, cap, and the two collar/top-ring end sections of the RAUTE
  are the 52 mm design uniformly scaled by `s = D / 52` (thread pitch `5 * s`), so their threads mate by construction.
- RAUTE size (height) and spike length are user-adjustable.

## Additional finding: strut width is not scaled

obj_4 (52 mm) and obj_9 (100 mm) have the *same* strut width (about 4.1 mm; odd rows 4.9 mm at 100 mm) while the tube
radius doubles; obj_1 (short RAUTE, scaled x100/52) instead has 7.9 mm struts and 6 columns. Wall thickness also
differs (3 mm at 52, 5.75 mm at 100), and obj_9 uses 12 columns and unscaled row pitch. Two different ways to grow a
lattice exist in the source data, so the generator must pick one for the lattice zone.

## Parameter catalogue

| Key | Applies to | Type / range | Maps to | Notes |
|---|---|---|---|---|
| `towerDiameter` | all five | number, 40–120 mm, default 52 | `SCALE = D/52` (rings, threads, spike, helper, cap); RAUTE lattice radius | 52 and 100 verified; the rest interpolate. Thread clearance scales with `D`, so very small values may print too tight. |
| `spikeLength` | spike | number, mm, ~60–250 | `TIP_Z` (fins clipped by the taper cone), measured after scaling | New geometry; needs min above the base + fin start. |
| `shortRauteRows` | RAUTE short | integer, 1–20, default 4 | `ROWS` (+ `TOP_Z`, `TOP_GUSSET_END` derived) | Height = collar + rows x row pitch + top ring. |
| `tallRauteRows` | RAUTE tall | integer, 1–24, default 10 | `ROWS` | Same generator, different default. |
| `rauteColumns` | both RAUTE | integer, 4–16 (even), default derived from `D` | `COLUMNS` | Default about `round(D / 8.5)`: 6 at 52, 12 at 100. Optional; the same value for both RAUTEs. |

Ground spike (drain holes), planting helper (funnel curve, slots) and cover cap (profile) have no other parameters:
their profiles are point tables fitted to the STL and only scale.

## Open forks (need your call before building)

1. **Lattice growth.** (a) uniform scale: identical look at every size, strut width grows with `D`; reproduces
   obj_1 and obj_5 exactly, but obj_9 becomes an approximation (6 columns, thick struts). (b) constant strut width
   (about 4.1 mm), column count grows with `D`, wall thickness grows with `D`; reproduces obj_4/obj_5 at 52 and
   approximates obj_9 at 100 (its wider odd rows are dropped), but obj_1 no longer matches. Recommended: (b).
   It is what the 100 mm tall part actually does, and it keeps struts printable.
2. **Rows vs mm height.** Rows (integer) are recommended: height derives from row pitch, gusset constants stay
   valid. Free millimetre height would need row pitch to stretch.
3. **Regression.** Without a source STL for most sizes, verification is: closed, single-body, positive volume,
   expected bounding box, and thread mating checked by mating two parts' thread sections at several `D`.

## Resulting contract

- Parts (5): `spike`, `helper`, `cap`, `raute-short`, `raute-tall`.
- Model parameters: `towerDiameter`, `spikeLength`, `shortRauteRows`, `tallRauteRows` (+ optional `rauteColumns`).
- Shared change (option A): `ModelPart.scadMapping` naming the parameter keys each part consumes; worker passes `-D`
  per part from its own mapping; fingerprint hashes all part sources plus mappings; per-part validation.
- 5 SCAD generators replace the 10 files; the reconstructed sources stay in `reference/` as the regression baseline.
- Version `1` to `2`; update `docs/adding-models.md` and the "All ten parts" comment.
