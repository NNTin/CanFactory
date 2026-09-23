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
