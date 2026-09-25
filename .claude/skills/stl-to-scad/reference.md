# STL to SCAD: recipes, pitfalls, worked example

## Recipes

**Revolved parts.** `profile <stl> --angle A --simplify 0.02` prints the (r, z) outline; paste it into
`rotate_extrude($fn = ROUNDNESS) polygon(PROFILE);`. Use an angle between features (not through fins or holes).
If two angles disagree by a z-shift proportional to the angle, the part carries a helix: pitch = shift x 360 / angle.

**Threads (helical grooves or ridges).** The cross section of a helical solid on a horizontal plane is the same shape
turning with height, so build one polar outline and `linear_extrude(height = h, twist = -TURN * 360 * h / PITCH)` it.
The outline is `radius = lookup(phase, TOOTH)` with `phase = z0 - CREST_Z - TURN * PITCH * (angle - CREST_ANGLE) / 360`
(periodic), where `TOOTH` is one period of the axial profile. OpenSCAD: negative twist = right-handed
(angle grows with height). Read the tooth off `profile`; cut internal threads with a cutter subtracted from a plain
revolved wall, add external threads as a ridge unioned onto a core.

**Helical struts (lattices).** Take one horizontal section of a strut with `sections`, convert it to (radius, arc length)
about its centroid, and `linear_extrude` it with `twist` equal to the rotation per strut. The descending strut is the
mirror image. Bars overlap the next row slightly (0.6 mm here); measure the row pitch, not the bar length. Strut
sections in the STLs vary a few percent along their length; a constant section is accepted.

**Gussets / fans between struts.** Loft a polyhedron through polygons that change with z (here the hull of the two
diverging struts in (radius, arc) space). Faces: bottom = section order, top = reversed, sides
`[k*n+i, (k+1)*n+i, (k+1)*n+j, k*n+j]` for outward-CCW sections. Keep the section vertex count constant.

**Cross sections with fins, holes and rounded ends.** Extract one octant of the outline from `sections`, mirror/rotate
it into the full outline and `linear_extrude`. Tapers: intersect with a cone.

## Recipes for thin shells with cutters (cigarette case)

**Convex plan, prismatic wall.** The plan is the convex hull of a section's points (`sections` + a hull); `polygon()` of it, extruded, with
`offset(delta = -wall)` for the cavity. Free-form ovals (not ellipses) are best kept as the measured polygon (60 points at 0.02 mm).

**Swept or scooped ends.** A wall whose end climbs like a scoop is the plan prism intersected with a 2D region in the (x, z) plane
extruded along Y: measure the section's extreme x per height (`xmax(z)` every 0.5 mm) and use it as the region's edge. The cavity is the same
with `offset(delta = -wall)` applied to the region, which also gives the floor.

**Notches and windows.** Read the opening half-width per height from the section (min |y| of the points beyond a threshold x): an
ellipse in (y, z) fits, extruded along X. Detent pads are half-ellipses standing on a floor.

**Domes.** Stack thin `linear_extrude(scale)` slices of the wall outline scaled by a `[z, factor]` table read from the section areas.

**Debugging.** `overlay` on three or four heights shows immediately which feature is missing; band IoU (`verify --bands`) says which heights.
A mirrored part is often its twin's plan mirrored and inset by wall + clearance: try that before measuring it.

## Wall patterns: `relief` and `relief_wrap()`

For a prismatic wall with a repeating pattern (honeycomb, knurling, ribs, text) and no rotational symmetry:

1. **Base outline.** Section the part at a height where the pattern is absent or only ribs are present (`--base-z`). If ribs stick out of
   that section (the cigarette case's 29 fins), `--open-radius r` takes the morphological opening of the outline with a disc of radius `r`
   (wider than half a rib), which leaves the smooth wall. The tool then shifts the outline by the median height of the plain-wall cells
   and measures again (`refine`, on by default), so the plain wall sits at d = 0 within about 0.02 mm.
2. **Height map.** Every 0.1 mm along the outline and in z, a ray along the outward normal finds the outermost surface (hits farther out
   than 6 mm are ignored, so rays cannot reach neighbouring features at corners). `d(s, z)` is the result.
3. **Levels.** Histogram peaks (share >= 0.4 %) become plateaus, each moved to the median of its cells; the level nearest to 0 is the
   wall itself. Pass `--levels` to override. The honeycomb reduced to three: 0, 1.36 and 2.39 mm (ridge network and Y ridges).
4. **Regions.** Each level above (below) zero becomes the set of cells at or above (at or below) it: nested regions, traced with a
   lattice boundary tracer (pinch points filled), simplified (`--simplify`, default 0.12 mm) and dropped below `--min-area`. Loops are
   in the unrolled (s, z) plane.
5. **SCAD.** `relief_wrap(1)` unions the plateaus, `relief_wrap(-1)` makes the cuts. Each straight piece of the outline gets its own frame
   (u along, v outward, w up); the region polygons are clipped to the piece, extruded along v and trimmed to the mitre cell between the
   bisectors at its ends, so bends neither gap nor overshoot. Put `linear_extrude(polygon(RELIEF_BASE))` under it for the wall.

What the wrapper does to keep the result one manifold body (each was a real failure with the honeycomb):

- straight walls are single pieces (the base is simplified after refining; a run of collinear vertices makes many exactly coplanar faces);
- nested levels shrink by 0.03 mm per level (`grow`) and start at different depths, so their side faces and roots never coincide;
- band ends are shifted per level (`RELIEF_ZLAP`), and each piece is lifted by a few micrometres (`RELIEF_JITTER`): neighbouring pieces overlap
  and carry the same polygon edges, and identical horizontal faces in the overlap gave thousands of zero-area triangles;
- the pattern is shifted 0.0137 mm along the outline so no lattice line passes through an outline vertex;
- no recursion deeper than a few dozen calls (the wasm runtime overflows its stack on 200 levels of recursion: sums are done with dot products).

Limits: the pattern is data (a few thousand points per part), not a generator. Regions are quantised to plateaus and 0.1 mm cells, so
sloped ridge flanks become vertical, and a pattern that is not exactly periodic cannot be compressed by periodicity. The relief
of the cigarette case is 0.4-2.4 mm high on a 1.6-5 mm wall; the IoU loss to the source is mostly ridge edges and the base outline.

## Pitfalls that produce non-manifold or degenerate meshes

- **Coincident or almost-coincident faces** between operands (a cutter root equal to the wall radius, a strut face equal
  to the collar face, a cutter top equal to a ledge). Give cutters 0.05-0.1 mm of overshoot into empty space; build
  struts and gussets oversize and clip them with **one** revolved envelope so the final faces come from a single exact
  surface; start clips 0.06 mm off any ledge.
- Twisted extrusions need enough `slices` (about one per 2-5 degrees).
- `mirror()` of a polyhedron is fine; do not mirror by negating point lists.
- OpenSCAD `polygon()` accepts either winding, `polyhedron()` faces must be clockwise seen from outside.
- Bury the end face of a loft inside a neighbouring solid instead of ending it on a surface.
- Voxel IoU on axis-parallel walls is biased by sample alignment; `verify` therefore turns both meshes 13.7 degrees
  before sampling. If you write another comparison, do the same.

## Worked example: moss planter (HpInvent "Moss Tower Verdura")

Ten STLs, five shapes; four pairs are exact 100/52 scale copies (`inspect` reports them). Parameters found:

| Part | Construction | IoU | SCAD |
|---|---|---|---|
| obj_10 / obj_7 cap | revolved profile + right-handed internal thread (pitch 5, root 18.7, crest 20.147 measured) | 0.9987 | 3.4 KB |
| obj_3 / obj_2 ground spike | revolved hollow base + external thread + fin cross clipped by a cone + 4 holes | 0.994 | 4.2 KB |
| obj_6 / obj_8 planting helper | revolved body + hub/fin cross + slots + holes + socket + external thread | 0.987 | 5.1 KB |
| obj_5 / obj_1 RAUTE (52 mm x 125) | thread collar + thread ring + 6 columns x 4 rows of 30-degree helical struts + gussets | 0.978 | 10.8 KB |
| obj_4 RAUTE (52 mm x 230) | same, 10 rows, taller end rings | 0.966 | 10.8 KB |
| obj_9 RAUTE 10cm (100 mm x 250) | same, 12 columns x 10 rows of 15-degree struts, own strut sections (odd rows wider), scaled threads | 0.978 | 11.8 KB |

Numbers that mattered: row pitch 17.5 mm (34.6 for the 10 cm part / 2), strut twist 1.656 deg/mm (0.846 for the 10 cm
part), strut radial thickness 3.0 (5.75), both threads identical between the small parts (pitch 5) and scaled by
100/52 for the big one.
