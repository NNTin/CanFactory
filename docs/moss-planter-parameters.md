# Moss planter: parameter specification (draft, pre-implementation)

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

## Parameter catalogue

`Verified` = both endpoints reproduce a source STL. `New` = would need new geometry work and verification.

### Shared

| Key | Type | Applies to | Maps to | Notes |
|---|---|---|---|---|
| `towerSize` | enum {52, 100} mm outer diameter (default 52) | all five parts | `SCALE` (spike, helper, cap, RAUTE short); `SIZE` preset (RAUTE tall) | Verified. One shared value keeps threads mating. |

### Ground spike

| Key | Type | Range | Maps to | Status |
|---|---|---|---|---|
| `spikeLength` | number, mm at 52 size | ~60–124 (default 124) | `TIP_Z` | New. `TIP_SLOPE` fixed, fins clipped by the cone; needs min > `FIN_START_Z` (24) plus the base, and a manifold check. |

Everything else (thread, fins, drain holes) stays fixed. Drain hole radius (`HOLE_R`) is technically free but has
no reason to vary.

### Planting helper

None beyond size. Height/funnel are baked into the `BODY` point list (funnel curve from z 53 to 80), so changing
height would mean re-fitting the profile. Base slots/holes (`SLOT_*`, `HOLE_*`) are possible but low value.

### Cover cap

None beyond size (profile and groove fixed).

### RAUTE short

| Key | Type | Range | Maps to | Status |
|---|---|---|---|---|
| `shortRows` | integer | 4 (fixed) | `ROWS` | Not exposed: see below. |

### RAUTE tall

| Key | Type | Range | Maps to | Status |
|---|---|---|---|---|
| `tallSize` | (uses `towerSize`) | 52 / 100 | preset block: `COLUMNS`, `COLUMN_PHASE`, `ROW_DZ`, `STRUT_TWIST`, `OUTER_R`, `LATTICE_INNER_R`, `STRUT*`, `K` | Verified. Each value selects a full constant set inside one SCAD. |

### RAUTE rows (candidate, open)

`ROWS` is the only thing separating RAUTE short from tall at 52 mm. A `rows` parameter (say 2–12) with
`TOP_Z = NODE_Z0 + (rows-1)*ROW_DZ + tail` would make short and tall one part with a continuous height. Two
problems: (a) at 100 mm the short and tall designs disagree (finding 3), so `rows` would only be valid at 52 mm or
would need obj_9's construction for every 100 mm row count; (b) it collapses 5 parts to 4, contradicting the target.
Recommended: do not expose `rows`; keep short and tall as two parts with presets.

## Resulting contract

- Model parameters: `towerSize` (enum/boolean), `spikeLength` (number). Everything else fixed.
- Parts (5): `spike` (`SCALE`, `TIP_Z`), `helper` (`SCALE`), `cap` (`SCALE`), `raute-short` (`SCALE`),
  `raute-tall` (`SIZE`).
- Generators: 5 SCAD files (merging the 10 existing files), each reusing the verified geometry with `SCALE` /
  `SIZE` as the only new inputs.
- Shared change (option A): `ModelPart.scadMapping?: Record<string, string>` naming the parameter keys the part
  consumes; worker passes `-D` per part from its own mapping; fingerprint hashes all part sources plus mappings; a
  new generic `enum` control kind (or a boolean).
- Version bump `1` → `2`. Update `docs/adding-models.md` ("Static multi-part assemblies" becomes "Multi-part
  assemblies"; per-part mapping documented) and the "All ten parts" comment.
