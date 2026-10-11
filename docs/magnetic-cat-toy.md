# Magnetic cat toy

An original hand-authored CC BY 4.0 design. Open `#/models/magnetic-cat-toy`. The SVG card shows all four functional
layers; the live STL assembly slider demonstrates placing bare magnets directly
in sockets, adding the playing field, closing/placing the ball, then lowering
the cover with its screws. Download ZIP contains **5 prints**, not magnets,
screws or nuts. There are no printed magnet holders or caps.

## Bottom to top

1. **Modular magnet socket tray**: a 1.2 mm connected floor, pitch-configurable open-topped
   circular sockets (default 5 × 4 at 30 mm centre spacing) and a narrow perimeter rim. Each socket has a
   1.2 mm radial wall and directly holds a sourced disc, with its **top face
   exposed and nominally flush with the socket top**. No crown, separate holder,
   cap, locating peg or raised cross-grid lines. The socket depth is the chosen
   product's **nominal thickness**; diameter is its greatest manufacturer size
   plus 0.2 mm diametral play. Remove the cover and field and move the **bare
   magnets**, not printed holders, to whichever sockets you choose. No adhesive
   on the grid magnets. Each socket has a **3 mm underside push-out hole**;
   use a blunt nonmagnetic tool to remove a disc without damaging its coating.
   `Socket spacing` changes the printed array, not the magnet placement.
   Reposition only away from animals and children; magnets are loose during
   maintenance. The secured field, not an individual enclosure, retains them
   during play. There is no powered movement mechanism.
2. **Thin playing field**: an uninterrupted 1.2 mm sheet by default. Its bed
   face becomes the upper rolling surface. No texture, relief, screw holes or
   joins in the playing area. A 5 mm perimeter rim supports the sheet 0.2 mm
   above the flush magnet faces; socket rims limit downward flex after that
   gap. No ribs are printed between sockets. Range 1–2 mm; the unsupported
   spans and thin tray need physical paw-load/flex testing. The default
   grid-magnet-to-field-top separation is **1.4 mm**: only 0.2 mm air plus the
   1.2 mm sheet, with no printed crown or cap in the magnetic path. Source
   magnet thickness changes socket/cover heights automatically, not this gap.
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
   field, grid magnets and ball. An internal 3 mm lip overlaps the field edges
   by 2 mm and limits upward sheet travel to 0.2 mm. Its 45° ramp prints without
   internal supports roof-down. Solid side walls offer no secondary exit.

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
the entire ball seam.** Test fit without magnets first. The ball magnet must
never be accessible after bonding. The bare grid magnets must never be
accessible during play: secure both field and cover first. Socket fit alone
is not a safe retainer. Choose a PETG-compatible adhesive, follow its curing
instructions,
and keep excess off the rolling surface. Perform a destructive sample joint
check before entrusting the ball to an animal.

### Repositioning

The owner-directed simplified base retains only material with a purpose: a
thin connected floor, direct socket walls, the field-supporting perimeter rim
and four screw ears. The original full-height slab, raised grid lines and eight
holder/cap prints are removed. A thin floor keeps the socket array one printable
part rather than an array of loose rings. The rim supports the sheet without
reinstating a cross-grid. This saves material but gives up the independently
sealed holders and stiff intermediate ribs; field flex must be tested rather
than assumed safe. The part count falls from 13 to 5. Increasing socket density
adds only socket walls, not a full-height slab or separate holders.

**Socket spacing** is a square-array centre-to-centre pitch, adjustable from
20 to 60 mm (default 30 mm). For each axis, the count is
`floor((outer size − 40 mm) / pitch) + 1`; the array is centred, with at least
20 mm from outermost socket centres to the tray edge. Default 160 × 140 mm gives
5 × 4 sockets; supported dimensions/pitch allow 2 × 2 through 9 × 9. Even the
largest selected magnet leaves over 5 mm between socket walls at minimum pitch.
No corners/zigzag/cluster presets or prescribed magnet quantity remain. The
assembly preview and BOM illustrate **full capacity**, not a placement
recommendation or a mandatory purchase quantity. Populate only the sockets you
want; the simulation lets you try any combination.

Each 3 mm ejector hole passes through the 1.2 mm floor at the socket centre,
leaving an annular bearing seat. The smallest supported disc's minimum diameter
is 7.9 mm: it cannot pass through the hole, and leaves 2.45 mm of centred
radial bearing before fit/print tolerances. Print the tray floor-down: the hole is vertical, needs no
supports and does not cover or recess the exposed magnet face. Remove the cover
and field before pushing a magnet out from beneath; work away from pets/children
and capture the released magnet. The small underside hole is not a safety
closure or access for maintenance during play.

Nominal-height sourced discs sit flush, with no plastic covering their faces.
The source's ±0.1 mm height tolerance can leave actual faces slightly recessed
or proud; the 0.2 mm field gap clears the maximum height. Measure the delivered
magnets and dry-fit: correct print/depth error by carefully adjusting the socket
floor or using a secured nonmagnetic shim if an exactly flush fit is required.
Do not glue magnets in place or add a crown/cap. The default 3 mm nominal disc
has at most 0.5 mm lift beneath the retained field (0.2 mm air + 0.1 mm source
minimum-height tolerance + 0.2 mm field-retainer clearance), far less than its
2.9 mm minimum height. This also
holds for both supported 2 mm discs: they cannot clear a socket while the
intact field stays seated. That geometric check does **not** account for a
flexed, broken or incorrectly assembled field. Never operate the toy without
the screwed cover and the field; removing either is a maintenance operation.

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

- Grid discs, **one per socket you choose to populate** (up to 20 by default):
  selectable supermagnete **S-08-02-N**, **S-10-03-N** (default), or **S-12-02-N**.
- One ball disc: **S-04-02-N**, **S-06-03-N** (default), or **S-08-03-N**.
- Four **ISO 4762 M3 × 8** socket-head screws and four **ISO 4032 M3** nuts.

Both magnet selectors link to the existing `magnet` family. `partDefines` passes
**greatest manufacturer diameters** and greatest ball-magnet depth (including
±0.1 mm tolerance) to every SCAD render. The direct grid seat instead uses the
**sourced nominal thickness** so the preview disc sits flush; no generic magnet
dimensions are invented. Standalone SCAD defaults
are explicitly the same two sourced default products. Product links/data live
in `packages/contracts/src/parts/magnets.ts`. Block/ring/pot magnets are not
silently accepted by cylindrical disc pockets.

The screw shaft ends flush with the underside; 2 mm cover ears sit on the 6 mm
mounting ears (only these stay 6 mm high, independent of the thin tray), giving
the M3 × 8 screw full engagement through the recessed nut. Nut recesses include
0.3 mm across-flats and 0.2 mm depth allowance.
Secure nuts during assembly, then inspect all four screws for adequate engagement.
Do not use longer screws or leave loose spare hardware nearby.

## Printing and assembly

Use PETG, 0.2 mm layers, at least four perimeters. Orientation is already encoded
in each exported STL:

| Prints | Orientation / supports |
| --- | --- |
| `grid.stl` | Thin floor down. Direct magnet sockets open up, 3 mm ejector holes through the floor; underside nut recess roofs need short bridges. No socket supports, caps or raised cross-grid. |
| `field.stl` | Flat on a smooth bed, solid skin throughout. The assembly turns the bed face upward. |
| `ball-lower`, `ball-upper` | Pole down, equator/pocket up; **external supports and raft**, 100% infill. Carefully remove marks and sand without materially reducing diameter. |
| `cover.stl` | Slotted roof down, walls up; local supports under the external screw ears. No roof bridges or internal support forest. |

1. Dry-fit the bare sourced discs in the direct sockets and calibrate ball
   clearance/engagement. Measure actual magnet height and check flushness;
   confirm the field sits flat on its perimeter rim without rocking.
2. Check magnet polarity through a sample sheet/ball before bonding. Seal one
   ball magnet between the ball halves. Let adhesive cure fully out of reach
   of animals and children. Grid magnets stay bare and removable.
3. Fit the nuts in the tray's underside recesses. Place any desired number of bare grid discs in
   chosen sockets; their top faces remain exposed until the field is fitted.
   The library references in the preview are purchased parts, not prints.
4. Add the playing field, smooth bed face up. Place the closed ball on it.
5. Lower the cover and tighten all four specified screws without cracking the
   ears. Verify free rolling and ball retention; load-test the field and check
   that no grid magnet can lift out of its socket or become accessible. Never
   let an animal near the toy during assembly or magnet repositioning.

## Interactive physics

Select **Simulate** to start with all four layers fully assembled and the cover
secured. The socket tray, bare grid magnets, field, cover and hardware are fixed; only the
bonded ball moves. Drag either ball half (or its magnet) to move the entire ball.
The two rendered halves and the sourced magnet contribute their own mass and
inertia to a welded rigid body. The eccentric seat therefore moves both the
magnetic force's application point and the centre of mass; this is not a wobble
animation. A smooth analytic sphere supplies the collision surface, avoiding
artificial faceted rolling. Full-density PETG and the library magnet's listed
mass are assumed; adhesive, print porosity, anisotropy and wear are omitted.

The **Grid magnets** top-view map shows **every socket**, including unoccupied
spaces, with +X right, +Y up and millimetre coordinates in each button's
accessible label/tooltip. Start with **all grid sockets empty/off**. Enable any
location to place a virtual sourced disc there and apply its forces/torques;
disable it to remove both the virtual disc mesh and its magnetic interaction.
The sealed ball magnet stays on. Toggle each independently or use **All on /
All off**, while the ball continues moving, without resetting time or poses.
Dense grids retain non-overlapping numbered controls and scroll when necessary.

Restart and reversing gravity retain your placement choices. Leaving/reopening
simulation restores all-empty; returning to the assembly animation restores the
full-capacity illustration. Fixed optional magnet bodies remain in the engine
with no collision shape; their mass cannot affect the moving ball. Pairs of
fixed magnets are skipped, so they do not generate unnecessary support-reaction
calculations. This is a virtual placement/field control, not a mechanism to
extract magnets through the secured field in real life.

These are **virtual switches for experimentation**: the physical toy contains
permanent magnets, not electromagnets. Hide the cover in Visible parts to inspect
and drag the ball easily; hiding geometry never disables its collisions. The
slotted roof and rounded inner walls remain active and retain the intact sphere,
including with gravity reversed. Slots are not replaced by a solid roof hull. The low field-retaining lip, like
the external screw ears, lies outside the intact sphere's reachable contact
region and is omitted from its collision pieces.

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
session; retire immediately for cracks, loose fasteners/bonds, magnets exposed during play,
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
socket pitch/count/edge margins, all-socket toggles (including 81-socket density),
central/eccentric pockets, ejector-hole/annular-seat probes, slot retention rules,
component topology and material probes in the renderer, real ZIP/browser
controls and assembly stops. Run:

```sh
npm run check
TEST_ONLY=magnetic-cat-toy npm run test:renderer
npm run check:assembly -- magnetic-cat-toy
npm run check:assembly -- magnetic-cat-toy --parameters '{"magnetPlacement":"eccentric","socketSpacing":40}'
npm run check:physics -- magnetic-cat-toy
npm run check:physics -- magnetic-cat-toy --parameters '{"magnetPlacement":"eccentric","socketSpacing":40}'
npm run test:browser -- tests/browser/magnetic-cat-toy*.spec.ts
```
