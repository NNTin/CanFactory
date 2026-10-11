# Magnetic cat toy

Original hand-authored CC BY 4.0 design. Open `#/models/magnetic-cat-toy`.
The SVG card shows four functional layers; live assembly demonstrates bare
magnets into sockets → thin field → ball closure → ball placement → cover and
screws. The ZIP contains **5 prints**: tray, field, two identical hollow ball
halves and cover. Magnets and fasteners are purchased library parts.

## Bottom to top

1. **Magnet socket tray**: a connected 1.2 mm floor, open-topped direct sockets,
   narrow perimeter rim and four screw ears. Each sourced disc sits **exposed
   and nominally flush** at the socket top. No holder/cap prints, locating pegs
   or raised cross-grid lines. Move bare magnets between sockets after removing
   field and cover. Every socket has a **3 mm underside push-out hole**.
2. **Playing field**: an uninterrupted smooth sheet, **1.2 mm** by default,
   adjustable 1–2 mm. Its bed face becomes the rolling surface. The perimeter
   rim holds it **0.2 mm above the magnets**; socket rims limit downward flex.
   No intermediate ribs. The default magnet-to-field-top gap is **1.4 mm**.
3. **Hollow magnetic ball**: two perforated hemispheres, **2 mm shell** by
   default (1.6–2.4 mm). **Fourteen 8 mm grip holes** by default, with diameter
   adjustable **6–12 mm**, subject to the web-clearance rule below. One sourced
   disc per half loads from the **rear/interior side** of its socket, not the
   seam. Two **continuous 0.6 mm printed floors** face one another and **touch**
   when assembled. Magnets attract through these floors; they cannot jump
   towards each other out of their seats. Straight pins align, not latch, the
   halves. No seam glue or separate magnet caps.
4. **Slotted cover**: a full perimeter skirt and 3 mm roof, 3 mm above the ball.
   Four M3 × 8 screws into captive underside nuts secure it. Internal tapered
   lips overlap field edges by 2 mm, limiting lift to 0.2 mm. The cover retains
   the **closed intact ball**; it is not independent containment of loose discs
   or a ball half if the seam opens.

## Ball: rear loading and thin contacting floors

The cigarette-case `SNAP_TUNING`, litter-shovel friction/detent implementation
and printed-screen-hook/corner-bracket fits were inspected first. This ball
reuses **per-side clearance and lead-ins** for alignment only: three 2 mm pins
at 30°, 150°, 270° and three mirrored sockets per half. Default clearance is
0.2 mm per side, adjustable to 0.4 mm. Pins are 1.6 mm long and sockets are
slightly deeper, so they do not bottom out before the mating faces touch.
One identical half flips 180° about X.

### Load path and magnetic gap

Each socket has its **closed floor at the equator** and its insertion opening
facing away from the seam, into the hollow half. Insert the magnet from that
rear side. With opposite facing poles, attraction presses the discs **into**
their bearing floors, transmitting the closing force to the printed halves.
It does not pull them towards the rear opening or rely on a small retaining
lip to carry the seam load. The joint-facing magnet faces are fully covered,
not directly exposed to each other.

`Ball magnet floor thickness` is an advanced control, **0.6 mm** by default,
range **0.4–1 mm** in 0.2 mm steps. The two flat floor faces and equatorial rims
meet at the same split plane: **no deliberate air gap, recess or intervening
cap**. With discs seated against the floors, face separation is exactly twice
floor thickness: **1.2 mm default**, range 0.8–2 mm. This gap does not depend on
magnet thickness tolerance. Keep both floors flat and fully dense; 0.6 mm is
three 0.2 mm layers. Do not sand them thinner or leave support residue between
them. Thinner floors reduce magnetic separation but also reduce durability;
choose whole layers and physically test them. Geometry alone cannot guarantee
holding force, floor strength or a safe pet toy.

The sourced **maximum diameter + 0.2 mm** sizes the pocket; sourced maximum
thickness sizes its depth. A 1.2 mm wall, four relief cuts and a **rear** tapered
0.4 mm lip (opening: minimum sourced diameter − 0.3 mm) retain each disc during
handling. These rear features do not carry the attraction load. Four 2 mm-wide
spokes, as thick as the floor, join the boss to the shell. No loose mount insert.
Check polarity before insertion and test that discs cannot rattle or withdraw
unintentionally, including when the halves are separated.

### Removal without puncturing the floors

Two opposed **3.2 mm rear finger/tool scallops** expose each disc's edges for
withdrawal. Separate the ball away from pets/children, reach into the open half,
and grip the edges with a blunt nonmagnetic tool through these cutouts. Capture
the magnet and gently withdraw it past the relieved rear lip. Do not pry against
its coating, puncture the thin floor, or use damaged lips.

This deliberately replaces the previous through-floor push-out channel:
**continuous mating floors and rear removal access**, rather than exposing the
opposed faces through ejector bores. The tray's 3 mm underside ejector holes
are unchanged. Access must be physically fit-tested with the intended tool;
small rear seats may need nonmagnetic tweezers rather than fingers.

### Centred / eccentric

Both seats are mirrored axially about the sphere centre. `Centred` places the
pair's midpoint and nominal centre of mass at the sphere centre, using identical
shells and matching magnets. The two magnets lie just either side of the centre.
`Eccentric` shifts **both seats radially**: 6 mm default, adjustable 2–8 mm.
This moves both magnetic application points and mass for a wobble. Validation
keeps the complete boss inside the shell and clear of alignment seats. Changing
mode requires new halves, but magnets can be removed and reused. Support cleanup,
print/source tolerances and layer anisotropy still affect real balance.

### Larger configurable grip holes

Each half has **six radial holes at 35° latitude, 60° apart, plus one pole hole**.
The lower ring is staggered 30° from the alignment seats. This replaces twelve
smaller holes per half: fewer, larger holes preserve shell webs and alignment
seats while improving access. Default diameter is **8 mm**, formerly 4 mm;
choose **6–12 mm**. The shell remains hollow, not a solid sphere.

Both TypeScript validation and standalone SCAD require **at least 1.2 mm of
inner-shell web** between adjacent apertures. For inner radius `r`, nearest
hole-axis angle `a`, and hole diameter `d`, the web is
`r × (a − 2 asin(d / (2r)))` (angles in radians). For the six-hole ring,
`a = acos(sin(35°)² + cos(35°)² cos(60°))`; the pole-to-ring spacing is larger.
Large holes on a small/thick-walled ball are rejected rather than merged into
weak slots. Enlarge the ball or reduce hole diameter/wall thickness if needed.
Round every rim and check claw comfort/entrapment with the intended animal.

**Grip holes are not magnet containment.** Large holes can pass a loose disc.
The intact seats, floors and tested closure must retain the magnets. Retire
immediately for a released magnet, cracked floor/lip or seam that opens in play.

## Repositionable grid, not layout presets

`Socket spacing` is a square-array centre pitch, **20–60 mm**, default 30 mm.
Each axis gets `floor((outer size − 40 mm) / pitch) + 1` sockets, centred with
at least 20 mm from the outermost centre to the edge. Default 160 × 140 mm gives
**5 × 4**; supported sizes span **2 × 2 to 9 × 9**. Minimum pitch leaves over
5 mm between the largest socket walls. No corners/zigzag/cluster presets or
prescribed quantity. Assembly/BOM show **full capacity**, not a recommended
layout or mandatory purchase. Populate whichever sockets you choose.

Direct socket diameter is the product's greatest diameter + 0.2 mm play; depth
uses its **nominal thickness**. Source ±0.1 mm height tolerance can leave a face
slightly recessed/proud; the 0.2 mm field gap clears the maximum. Measure and
dry-fit actual discs, adjusting a seat floor or secured nonmagnetic shim if
needed for exact flushness. Do not glue grid magnets or add a crown/cap.

The 3 mm push-out holes leave annular bearing floors under even the smallest
7.9 mm minimum-diameter grid discs. Remove field/cover, use a blunt nonmagnetic
tool from underneath and capture each released magnet. The secured field—not
friction alone—retains them during play: maximum lift clearance is smaller than
even the thinnest supported disc. This assumes an intact, seated field. Thin
unsupported sheet spans and tray flex still need physical paw-load tests.

## Slots and retention

Slot length is `min(3 × ball diameter, toy length − 24 mm)`, default **108 mm**.
Width must be **≤60% of ball diameter**, default 18 mm versus a 36 mm ball;
webs are at least 4 mm, roof margins at least 12 mm. An intact rigid sphere
cannot pass a planar opening narrower than its diameter, regardless of length.
Width—not making the slots short—provides retention and broad paw access.

This rule applies only to a **closed intact ball and intact cover**. A separated
half, released magnet or deformed/broken cover is not covered by it. Load-test
the roof, inspect actual widths and round paw-contact edges. It does not certify
paw comfort or freedom from claw entrapment. No unattended use.

## Purchased parts and printing

- Grid: one disc per chosen socket, up to 20 by default; library supermagnete
  **S-08-02-N**, **S-10-03-N** (default), **S-12-02-N**.
- Ball: **two matching discs**, **S-06-02-N**, **S-06-03-N** (default), **S-08-03-N**.
- Cover: four library **ISO 4762 M3 × 8** screws and four **ISO 4032 M3** nuts.

Both selectors reuse the existing `magnet` family. Minimum/maximum dimensions
and nominal grid thickness come from `packages/contracts/src/parts/magnets.ts`,
not invented generic sizes. Standalone SCAD defaults name the same sourced
products. Blocks/rings/pots are not accepted by disc sockets.

Use PETG, 0.2 mm layers, at least four perimeters, solid walls/floors/spokes.

| Print | Orientation / supports |
| --- | --- |
| `grid` | Floor down; vertical ejector bores need no supports. Short bridges over underside nut recesses. |
| `field` | Smooth bed face down; turn it up in assembly. Fully solid sheet. |
| `ball-lower`, `ball-upper` | Identical dome-up/equator-down shells, pin tips at bed level. Brim/raft and removable supports under rim, thin floor/spokes and dome as needed. Clean the open halves before inserting magnets; don't damage thin mating floors. |
| `cover` | Roof down/walls up; local supports under external screw ears. Tapered field-retaining lips need no internal supports. |

Dry-fit pins and rear magnet seats, test polarity, insert one disc behind each
floor, then close with floors touching. Physically test floor durability, seam
pull/impact resistance, individual retention and repeatable removal first.
Place chosen grid magnets and nuts, fit the smooth field, place the closed ball,
and secure the cover with all four specified screws. Six-millimetre base ears
plus 2 mm cover flanges give full M3 × 8 nut engagement and flush tips; do not
substitute longer screws. Never assemble/reposition magnets with animals nearby,
and never play without the screwed cover and retained field.

## Interactive physics

**Simulate** starts fully assembled, with every grid socket available but
initially **empty/off**. Drag either ball half or magnet to move the composite
ball. The two actual hollow meshes contribute printed PETG mass/inertia; both
selected product records contribute sourced magnet mass. The two dipoles are
behind the floors at their real nominal centres. World +Z moments give opposite
facing poles in the assembly pose; they rotate with the ball.

The top-view **Grid magnets** map labels every socket, coordinates included,
with +X right/+Y up. On reveals a virtual disc and enables its field; off hides
it and disables its magnetic interaction. Individual and All on/off switches
keep time/poses running. Dense maps scroll without overlapping controls. Both
closure magnets stay on. Restart/gravity preserve choices, reopening restores
empty, returning to assembly restores full-capacity illustration. These are
virtual placement controls for permanent magnets, not switchable hardware.
Visibility never disables collisions: hide the cover to inspect/drag inside.

**Closed-ball assumption:** halves and discs are welded for assembled play,
with mesh-derived mass/inertia and a smooth spherical collision envelope.
No seam separation, magnet pull-out, floor deformation, claw grip or hole-edge
contact is simulated. The internal welded pair is excluded from force evaluation,
not used to validate closure strength. Eccentric comparison scenarios start
heavy-axis down to isolate fields from gravity settling; interactive play starts
in the assembly pose and may settle even with all grid magnets off. The authored
slotted roof remains open in collision geometry and retains the intact sphere
under reversed gravity. Low field lips/external ears are outside its reach and
omitted from collision pieces.

### Magnetic approximation and sources

Each axial library disc uses `m = Br × nominal volume / μ₀` (A·m²) and its listed
mass. `Br` is the midpoint of [supermagnete's published remanence ranges](https://www.supermagnete.de/eng/physical-magnet-data)
(read 2026-10-10): N42 1.29–1.32 T, N45 1.32–1.37 T. Manufacturer steel-plate pull
force is **not** used as pair force. Equal/opposite forces, `m × B` torques and
eccentric lever-arm torques come from the shared Node/browser engine.

The point-dipole limit follows [Feynman's dipole field](https://www.feynmanlectures.caltech.edu/II_14.html#Ch14-S5)
and [mechanical energy/torque](https://www.feynmanlectures.caltech.edu/II_15.html#Ch15-S1).
For stability, one radius-softened potential supplies consistent derivatives:

`U = 10⁻⁷ [(a·b)/s³ − 3(a·r)(b·r)/s⁵]`,
`s² = |r|² + radiusA² + radiusB²`, in SI units.

This regularisation is a modelling choice, not calibration. It does not solve
the finite-disc near field, shielding, steel fasteners, eddy currents or
material flex. In particular it is **not suitable for predicting very-close
closure strength**. Use physical pull tests, or a calibrated finite-disc solver
with separate contact bodies. Actual print porosity, wear and friction differ
from the full-density PETG approximation. Results are qualitative, not measured
holding-force or pet-safety guarantees.

## Verification and limits

**Not physically fit-tested or safety-certified. Supervised prototype only.**
Loose magnets/hardware are ingestion hazards. Inspect before every session and
stop immediately for any released magnet, opening seam, damaged floor/lip,
loose screw, rough hole or enlarged slot. Keep children away from loose parts.
Digital watertightness and collision checks do not certify safety.

Static magnets only bias a **paw-driven** ball; no motor or autonomous motion.
A thin field alone does not guarantee strong control when ball magnets remain
near its centre. Real force, friction, floor/field flex, polarity, claw comfort
and long-term closure durability require physical testing.

Coverage includes sourced dimensions/poses/polarity, adjustable holes and web
validation, continuous thin floors/contacting seam, rear insertion/removal
access, actual hollow interiors, material budget, sockets/ejector holes, intact
alignment seats, through-slots, live assembly, ZIP downloads and browser physics
with all-socket placement. Commands:

```sh
npm run check
TEST_ONLY=magnetic-cat-toy npm run test:renderer
TEST_ONLY=magnetic-cat-toy npm run test:sweep
npm run check:assembly -- magnetic-cat-toy
npm run check:assembly -- magnetic-cat-toy --parameters '{"magnetPlacement":"eccentric","socketSpacing":40}'
npm run check:physics -- magnetic-cat-toy
npm run check:physics -- magnetic-cat-toy --parameters '{"magnetPlacement":"eccentric","socketSpacing":40}'
npm run test:browser -- tests/browser/magnetic-cat-toy*.spec.ts
```
