# Magnetic cat toy

An original hand-authored CC BY 4.0 design. Open `#/models/magnetic-cat-toy`. The SVG card shows all four functional
layers; the live STL assembly slider demonstrates sealing the holders, seating
them on the grid, adding the playing field, closing/placing the ball, then
lowering the cover with its screws. Download ZIP contains **13 prints**, not
magnets, screws or nuts.

## Bottom to top

1. **Modular magnet grid**: a base with 16 blind sockets (4 × 4), four holder
   bodies and four bonded caps. Each cap has a 6 mm locating peg, 3 mm long,
   with configurable per-side clearance (default 0.2 mm). The peg prevents
   lateral drift; the installed playing field limits lift to 0.2 mm, so pegs
   cannot disengage during play. Remove the cover and field, lift and move any
   sealed holder to another socket. No glue on the pegs, no fixed magnets in the
   grid. `Holder layout` selects corners/zigzag/cluster for the preview; any four
   sockets can be used physically. There is no powered movement mechanism.
2. **Thin playing field**: an uninterrupted 1.2 mm sheet by default, supported
   by a perimeter ledge and thin ribs between socket cells (not by bridging a
   whole 150 mm span). Its bed face becomes the upper rolling surface. No
   texture, relief, screw holes or joins in the playing area. Range 1–2 mm;
   verify flex under paw pressure. Holder crowns are 0.6 mm thick, with 0.2 mm
   magnet headroom at the crown and 0.2 mm air below the sheet: the default
   grid-magnet-to-field-top separation is **2.2 mm**. Magnet thickness changes
   the ledge/cover height automatically, not this separation.
3. **Magnetic ball**: two solid mirrored hemispheres, each with three pins and
   three complementary sockets, enclosing one axial disc. Select `Centred`
   (zero offset) or `Eccentric` (default 6 mm radial offset, tunable 2–8 mm).
   Both modes split the same cylindrical seat across the equator; no loose
   removable internal insert can rattle. Each pocket half has 0.1 mm axial
   allowance, with library greatest diameter plus 0.2 mm diametral play. The
   selected mode changes the **printed pocket location**, not an animation or
   label alone. Changing mode/magnet requires printing a new bonded ball.
4. **Protective cover**: a full perimeter skirt and 3 mm slotted roof with
   3 mm clearance over the ball. Four external ears take M3 × 8 screws into
   underside captive hex nuts. The cover surrounds and captures the playing
   field, grid holders and ball. Solid side walls offer no secondary exit.

## Deliberate design choices

### Ball joint and mass balance

The cigarette-case `SNAP_TUNING` and litter-shovel friction/detent implementation
were inspected first, along with the printed-screen-hook and corner-bracket
clearance/hardware conventions. This ball uses the **clearance + independent
engagement** detent pattern, not a new screw thread or a clearance-dependent
interference. Three alternating pins at 30°, 150°, 270° mate with three sockets
at their mirrored angles when the upper half rotates 180° about X. Lead-ins are
45°; 0.15 mm default detent engagement is above the clearance. Seated receiving
reliefs clear the ridges, while insertion briefly interferes.

Print both halves with **100% infill**, identical settings/material and minimal,
evenly distributed adhesive. Centred cavities and threefold-balanced pins/holes
put the magnet at the nominal geometric/mass centre. Manufacturing, uneven
adhesive, support removal and the pocket's tiny allowance prevent a guarantee of
perfect physical balance. The eccentric pocket shifts magnet mass radially and
brings it nearer the field in some orientations, deliberately changing rolling
resistance and producing an unbalanced response. Validation reserves 2 mm
around the magnet and 1.2 mm between its pocket and joint seats.

**Detents are alignment/curing aids, not the safety closure. Permanently bond
the entire ball seam and every holder cap.** Test fit without magnets first.
Magnets must never be accessible after assembly. Pocket fit alone is not a safe
retainer. Choose a PETG-compatible adhesive, follow its curing instructions,
and keep excess off the rolling surface. Perform a destructive sample joint
check before entrusting the ball to an animal.

### Repositioning

A straight round peg and blind socket is simpler and more support-friendly than
sliding dovetails, and accepts any grid position without removing a row of
holders. Rotation is irrelevant for axial discs. The field positively limits
vertical travel while the peg takes lateral loads; the peg is intentionally
not a permanent press fit. Each magnet has its own bonded enclosure even when
the field is removed. The underside cap shoulder needs local print support;
it is not hidden as an unsupported feature.

### Slot width versus ball diameter

Slot length is `min(3 × ball diameter, toy length − 24 mm)`: long enough for broad
paw access. Slot **width must be ≤ 0.60 × ball diameter** (default 18 mm versus
36 mm); neighbouring webs are at least 4 mm and roof margins at least 12 mm.
An intact rigid sphere must present its full diameter to pass through a planar
opening, irrespective of slot length. Thus width, **not shorter slot length**,
retains it. The 40% nominal margin allows some print error but is not a claim
that an arbitrarily flexed/broken cover is safe. Check actual dimensions and
load-test the roof. Round/sand all paw-contact edges; do not enlarge the slots.
Slot width does not prove paw comfort or freedom from claw entrapment for every
cat; inspect with the intended animal and stop if it catches.

## Purchased hardware (parts library)

- Four grid discs: selectable supermagnete **S-08-02-N**, **S-10-03-N** (default),
  or **S-12-02-N**.
- One ball disc: **S-04-02-N**, **S-06-03-N** (default), or **S-08-03-N**.
- Four **ISO 4762 M3 × 8** socket-head screws and four **ISO 4032 M3** nuts.

Both magnet selectors link to the existing `magnet` family. `partDefines` passes
**greatest manufacturer dimensions** (including ±0.1 mm tolerance) to every
SCAD render; no generic magnet dimensions are invented. Standalone SCAD defaults
are explicitly the same two sourced default products. Product links/data live
in `packages/contracts/src/parts/magnets.ts`. Block/ring/pot magnets are not
silently accepted by cylindrical disc pockets.

The screw shaft ends flush with the underside; 2 mm cover ears sit on the 6 mm
base ears, giving the M3 × 8 screw full engagement through the recessed nut. Nut recesses include 0.3 mm across-flats and 0.2 mm depth allowance.
Secure nuts during assembly, then inspect all four screws for adequate engagement.
Do not use longer screws or leave loose spare hardware nearby.

## Printing and assembly

Use PETG, 0.2 mm layers, at least four perimeters. Orientation is already encoded
in each exported STL:

| Prints | Orientation / supports |
| --- | --- |
| `grid.stl` | Bottom down. Blind sockets open up; underside nut recess roofs need short bridges. |
| `holder-1` … `holder-4` | Thin crown down; open magnet seat up. No supports. |
| `holder-cap-1` … `holder-cap-4` | Plug down, locating peg up. Local supports under the annular shoulder; clear them before bonding. |
| `field.stl` | Flat on a smooth bed, solid skin throughout. The assembly turns the bed face upward. |
| `ball-lower`, `ball-upper` | Pole down, equator/pocket up; **external supports and raft**, 100% infill. Carefully remove marks and sand without materially reducing diameter. |
| `cover.stl` | Slotted roof down, walls up; local supports under the external screw ears. No roof bridges or internal support forest. |

1. Dry-fit caps, pegs and ball detents; calibrate clearance/engagement if needed.
2. Check magnet polarity through a sample sheet/ball before bonding. Seal four
   grid magnets in their holders and one ball magnet between the ball halves.
   Let adhesive cure fully out of reach of animals and children.
3. Fit the nuts in the grid's underside recesses. Seat the four sealed holders
   in chosen sockets; the library references in the preview are not prints.
4. Add the playing field, smooth bed face up. Place the closed ball on it.
5. Lower the cover and tighten all four specified screws without cracking the
   ears. Verify the ball rolls freely and cannot pass any opening; verify the
   field stays seated and the holders cannot lift out of their sockets.

## Interactive physics

Select **Simulate** to start with all four layers fully assembled and the cover
secured. The grid, sealed holders, field, cover and hardware are fixed; only the
bonded ball moves. Drag either ball half (or its magnet) to move the entire ball.
The two rendered halves and the sourced magnet contribute their own mass and
inertia to a welded rigid body. The eccentric seat therefore moves both the
magnetic force's application point and the centre of mass; this is not a wobble
animation. A smooth analytic sphere supplies the collision surface, avoiding
artificial faceted rolling. Full-density PETG and the library magnet's listed
mass are assumed; adhesive, print porosity, anisotropy and wear are omitted.

The **Grid magnets** top-view map shows the **four occupied sockets**, numbered
like the holders, with +X right and +Y up and millimetre coordinates in each
button's accessible label/tooltip. Toggle each magnet independently, or use
**All on / All off**, while the ball continues moving. Disabling a magnet
removes its pairwise forces and torques, **not** its mesh, mass or enclosure.
The sealed ball magnet stays on. Restart and reversing gravity retain the
switch states; leaving/reopening simulation restores the initial all-on state.
The selected corners/zigzag/cluster layout changes the actual control locations;
empty sockets are not additional simulated magnets. Repositioning holders is
still an assembly operation, not dragging them through the secured field.

These are **virtual switches for experimentation**: the physical toy contains
permanent magnets, not electromagnets. Hide the cover in Visible parts to inspect
and drag the ball easily; hiding geometry never disables its collisions. The
slotted roof and rounded inner walls remain active and retain the intact sphere,
including with gravity reversed. Slots are not replaced by a solid roof hull.

### Magnetic approximation and sources

Each selected library disc is an axial point dipole. Its nominal product
volume and grade give the estimate `m = Br × volume / μ₀` (A·m²); mass comes
from the same library product record. `Br` is the midpoint of
[supermagnete's remanence ranges](https://www.supermagnete.de/eng/physical-magnet-data)
(read 2026-10-10): N42 1.29–1.32 T, N45 1.32–1.37 T. All grid moments initially
point +Z and the ball starts +Z, so coaxial magnets attract; the ball's moment
rotates with it, allowing alignment torque and repulsion when reversed. The
manufacturer's steel-plate pull force is **not** treated as a magnet-to-magnet
force or fitted to an invented inverse-distance curve.

The shared Node/browser engine applies equal/opposite, position- and
orientation-dependent forces and `m × B` torques at each step, including the
lever-arm torque from an eccentric seat. The point-dipole limit follows the
[Feynman lectures' dipole field](https://www.feynmanlectures.caltech.edu/II_14.html#Ch14-S5)
and [mechanical energy/torque](https://www.feynmanlectures.caltech.edu/II_15.html#Ch15-S1).
For stability near coincidence we **derive** forces and torques from one
softened potential:

`U = 10⁻⁷ [(a·b)/s³ − 3(a·r)(b·r)/s⁵]`,
`s² = |r|² + radiusA² + radiusB²`, with SI units throughout.

This radius-based regularisation is an explicit modelling choice, not
manufacturer calibration. The dipole approximation is best far from a magnet;
it does not solve the finite-disc near field, demagnetisation, steel fastener
attraction, eddy currents or shielding. Results show qualitative interaction,
not measured forces, guaranteed rolling smoothness, retention strength or pet
safety. Rigid contact also cannot predict field/slot flex or bond failure.

## Limits and verification

**Not physically fit-tested or safety-certified. Supervised prototype only.**
Loose magnets and small hardware are ingestion hazards. Inspect before every
session; retire immediately for cracks, loose fasteners/bonds, exposed magnets,
rough edges or enlarged slots. No unattended use; keep children away from loose
parts. Digital watertightness and collision checks are not a safety certification.

Static magnets bias/retain a **paw-driven** ball; they cannot continuously power
it. Centre placement keeps the ball magnet about half a ball diameter above the
sheet, so a thin field alone does not guarantee a strong response. Actual force,
rolling friction, polarity effects, paw loading, print tolerances and bond life
need physical prototype testing. The approximate magnetic preview below is not
a calibrated field solver or animal-interaction simulation. Do not promise
smooth autonomous motion.

Automated coverage: contract registration/invalid combinations, sourced sizes,
all three holder layouts, central/eccentric pockets, slot retention rules,
component topology and material probes in the renderer, real ZIP/browser
controls and assembly stops. Run:

```sh
npm run check
TEST_ONLY=magnetic-cat-toy npm run test:renderer
npm run check:assembly -- magnetic-cat-toy
npm run check:assembly -- magnetic-cat-toy --parameters '{"magnetPlacement":"eccentric","layout":"cluster"}'
npm run check:physics -- magnetic-cat-toy
npm run check:physics -- magnetic-cat-toy --parameters '{"magnetPlacement":"eccentric","layout":"cluster"}'
npm run test:browser -- tests/browser/magnetic-cat-toy*.spec.ts
```
