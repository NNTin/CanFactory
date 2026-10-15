# Standard port and cube elements

Every element of the tunnel ends in the same port, so any element couples to any other (issue #86). A port is either
**coupled** to another element (another tunnel element, the enclosure or the window insert) or **closed by a door**, which
blocks it off. There are two kinds of element:

- a **long section**: a rectangular box with a standard port at each end and fixed mesh sides, as before;
- a **cube**: the standard port on all six faces, roof and floor included.

Turns are made at cubes (90° each). Climbs keep the sloped long sections and the angle collars at their bends. The geometry is
one module, [catioPort.ts](../../../apps/web/src/catioPort.ts), which the tunnel's layout, its scenes and parts lists, the
couplings and the tests all use.

Everything below is this design's proposal. None of it has been built, and the open questions are listed at the end.

## The port

| | Value | Where |
| --- | --- | --- |
| Clear opening | Square, the tunnel's clear size: 30 × 30 cm by default | `tunnelSite`, the catio page's **Tunnel clear size** |
| Flange ring | 30 deep, 70 wide round the opening (outline 44 × 44 cm) | `STANDARD_PORT.ring`, `portRing` |
| Latch stations | `latchHeights(n)` fractions along each side (1: ½; 2: 0.2, 0.8; 3: 0.15, ½, 0.85) | `portLatches` |
| Bolt stations | The same fractions on each of the four sides, on the middle line of the ring's outer 30 mm | `boltStations` |
| Bolts per coupling | 4, 8 (default) or 12: one, two or three on each side | `BOLTS_PER_SIDE` |
| Latch halves | Seen from outside, base plates on the port's left, catch plates on its right | `portHalf` |

**Four-fold symmetry.** The stations are the same on all four sides of the ring. A quarter turn about the opening's middle maps
them onto themselves, because the latch fractions are symmetric. A port therefore fits another at any rotation, and a cube can
be turned to put any face on the route. The bolts used to be three a side and two on top; that pattern is not symmetric, so
`boltsPerCoupling` now offers 4, 8 or 12, and a saved 6 loads as the default 8.

**Genderless latches.** A printed toggle latch has a base (with the lever and link) on one face and a catch on the other.
Every port carries the base plates on its left side and the catch plates on its right, seen from outside. Two ports facing
each other are mirror images, so the left side of one is the right side of the other, and every base is across from a catch,
whatever the two elements are. At a coupling along the tunnel:

- the element before the joint carries the bases on the tunnel's right, looking along it;
- the element after the joint carries them on the left.

The window insert's docking frame follows the same rule. The tunnel's first flange is a port: its left side, seen from the
window, has the base and the docking frame's the catch; on its right side it is the other way round. The latches stand at the
same stations, up the opening's height. Only the printed latch follows the rule: the GN 831 alternative keeps its body on the
flange and its bracket on the frame.

Only the two sides across a face's frame (its left and right) are populated with latches. Along a horizontal tunnel these are
the vertical sides, clear of the bearer under the sill and of the roof. The stations on the other two sides are where the
latches go when the port is turned a quarter round.

## The cube

- **Edge.** The cube's edge is the outline, a ring's depth and a pocket each side: `cubeEdge(s) = s + 2 (F + T + CUBE_POCKET)`,
  which is 53.8 cm for a 30 cm opening.
- **Pitch.** A cube's edge plus a coupling's gap is the **pitch**: 54.1 cm latched, 53.8 cm bolted.
- **Rings.** Each face is a standard ring with its mating face flush with the cube's face.
- **Pockets, from the latch's real movement.** Along each edge, outside both rings, is a pocket in which both faces' latches
  stand and swing. Its size, `CUBE_POCKET`, is computed (`cubePocket` in catioPort.ts) from the latch's own mechanism
  (`LATCH_REACH`, the poses `buildPrintedLatches` draws).
  - **Closed,** the lever lies 32 mm along the joint, 2 mm past the 30 mm ring.
  - **Opening,** the lever swings 38 mm out from the ring's side, and the link swings off its hook.
  - **Size:** the pocket is the least that keeps every face's latch clear of the other faces' rings, latches and coupled
    elements: closed, and swinging open with 2 mm to spare. That is 19 mm.
  - **History:** the first version's rings met edge to edge with a 30 × 30 mm notch. That was enough for closed latches but
    not for a lever opening; the test shows it.
- **Edge strips.** A 49 × 49 strip in each of the 12 edges fills the corner square outside both rings' outlines (the pocket
  and a ring's depth).
  - **Fixing:** glued and screwed (5 × 70) into both rings' sides.
  - **Pockets kept open:** they run between the corner blocks, in lengths that stop 21 mm short of every latch station's
    middle on either side (`edgeStripSegments`).
  - **Why:** they stiffen the cube and close the edge, which would otherwise be open to the pocket.
- **Corner blocks.** A 40 × 40 × 40 block in each of the eight corners sits behind the three rings that meet there. It is
  screwed through each ring with a 5 × 70, the three screws offset so they pass each other. The blocks are clear of every
  latch and bolt station, which lie within the opening's middle 70 %.
- **Doors.** Every face the tunnel does not run through is closed by a door: at a corner, the front and the other side; in a
  run of cubes, both sides. The roof and floor faces are always doors. The floor face's door is solid and carries a plug that
  fills the opening, so the cat stands on a flat floor 70 mm below the tunnel's.
- **Supports.** A cube stands on the supports under its couplings, like a section: its end ring's sill is at the same height
  as a section's flange, and the bearer under a coupling lies under the end ring, clear of the floor door.
- **Floor prop.** Under the middle of every cube's floor door, a 70 × 70 post stands on its own slab, cut on site to the gap
  (`TUNNEL.floorProp`, `FloorProp`).
  - **Load path:** the door is clamped between the cube and the prop, so a cat's weight on the floor goes into the ground, not
    into the door's latches or turn buttons.
  - **Clearance:** the prop stands clear of every button, latch and plug screw of the door.
  - **Opening the floor door:** take the prop out first.
  - **Why a prop:** a trestle would not fit; near the wall a floor door is only about 8 cm above the grass.

## Doors (`Door held by`, on the tunnel–tunnel coupling page)

The doors look like the PawHut tunnel's: a slim panel set into the opening, about flush with the ring, with a turn button at the
middle of each side. The first version laid a panel over the ring between locating strips, or latched a whole blank ring onto
it; on a cube, with a door on four or five faces, that was bulky.

| | Set in, held by turn buttons (default) | A blank, held by the port's latches |
| --- | --- | --- |
| The door | A slim panel set into the opening, 1 mm behind the ring's face: mesh stapled on the back of a 25 × 17 frame, or an 18 mm plywood sheet | A ring like the port's (30 × 70) with mesh under cover strips on its outer face, or a 12 mm plywood sheet |
| Seated | **Door seat** (catio page): 12 × 10 stop strips inside the ring's opening (default, the easier to make), or a 12 mm rebate round it | On the port's face, across the 3 mm gap |
| Held | Four door turn buttons on the ring's face, one at the middle of each side: the same on every side | By the port's own latches: the door carries the other halves, as a coupled element would |
| Floor face | Plywood sheet and a plug filling the ring's depth behind it | Plywood sheet and a plug filling the gap and the opening |
| Builder | `setInDoor` | `blankPanel` |

The turn buttons are the removable doors' buttons from [removable-doors.md](removable-doors.md), placed on the ring's face. With
stop strips the cats' opening is 24 mm smaller each way while the door is in; the strips stay when it is out.
Each has a captive locking pin (issue #85): a 2.5 × 16 parallel pin under a printed knob drops 6 mm into the strip, and the
button turns only once it is lifted.
They are not the turn buttons that can hold the tunnel on its supports, nor the couplings' toggle latches.

## Marking template

`portTemplate`, drawn 1:1 by `portTemplateSvg`, is downloadable from the tunnel and the tunnel–tunnel coupling pages and listed
in the cut list.

- **What it is:** a 6 mm plywood sheet with the ring's outline and the opening.
- **Bolt holes:** every bolt station of every count (one, two or three a side) as a 9 mm drill guide.
- **Latch notches:** a notch at every latch station on all four edges.
- **Which way up:** it is marked "this side out" and is the same on all four sides.

Every ring is marked and pre-drilled from it, so every port is the same and a cube turned a quarter round still fits.

## Elements and the route

| Setting | Default | Options |
| --- | --- | --- |
| Turns and bends | Cube corners (90°) | Cube corners; angle collars (any angle); mitred ends, bolted |
| Straight runs | Long sections | Long sections; cubes |
| Longest section | 2 pitches (about 1 m) | 1–4 pitches |

**Snapped route.** Every straight run is a whole number of pitches, and the enclosure port lands where the elements end. The
port's position stays an input, as the asked target, and the brief shows **Enclosure port · placed by whole elements** with
the asked position whenever the two are a millimetre or more apart. The defaults and the presets are set where their elements
end (`placedRoute`).

**Cube routes.** With cube corners, **Port faces** is a choice: straight out, or along the wall to the left or right. A facing
saved at another angle is kept and laid out at the nearest of those. A port beside the window (more than 25 cm to one side) is reached out, along the wall, and out again. **Straight in
to the port** then follows from where the port is, so it is hidden.

**Climbs.** A climb is the one length solved exactly. It uses the fewest whole long sections that climb to the port's floor
within the steepest slope, sloped as steeply as that takes. A climb is always made of long sections, even when the straight
runs are cubes.

## Saved designs (snapped on load)

- **Tunnel page.** A saved tunnel keeps its route settings and its joint type, so a saved design with angle collars keeps them.
  Its longest section, saved in millimetres, becomes the nearest whole number of pitches (500 → 1, 750 and 1000 → 2). The
  layout then snaps the route to whole elements, and the brief reports how far that puts the port from where it was saved.
- **Catio page.** Settings version 3. A design saved with a tunnel that was not square becomes the standard square port at its
  larger size, so the cats' opening never shrinks. Version 1 designs also keep their sliding gates.

## The whole catio

The modular catio page uses the same standard. Its straight modules are one pitch long (54.1 cm) and its corners are cubes
(53.8 cm), and one **Tunnel clear size** sets the port both ways. A saved width and height load as their larger size.
- **Corner cubes:** drawn with their six rings and a door on every free face, held as the tunnel–tunnel coupling page sets
  (the latches themselves are not drawn there). Each cube's doors open together from the page's door controls.
- **Side access:** the straight modules carry it as the tunnel page sets it.

The tunnel–tunnel coupling page can show any joint (**Joint shown**): section to section, section to cube, or cube to cube.

## Out of scope

- **Branching.** A cube with three or more coupled faces leading to separate routes would need a network model. The tunnel is
  still a single route, but the port allows a branch later without changing it.
- **Roofs of long sections** are unchanged. Only a cube's roof face is a port.

## Unverified: check on a built element

The geometry is checked in the tests. What only a built cube can show:

- **The lever by hand.** The pocket leaves the swing 2 mm clear of everything, but nothing yet checks finger room to lift a
  lever there. Try it with two latched faces at one edge.
- **Stiffness.** The rings are held by corner blocks and glued edge strips. Check a built cube for racking under a push at a
  corner.
- **The floor door.** Its prop carries a cat standing still. A cat jumping on the floor, or a prop left out, still loads the
  door's fixings, so test a cat's weight dropped on it.
- **Quarter turns.** A turned port is as good as the template it was marked from. Test a turned cube against a section.
- **Cats against the doors.** Test the locking pins and the printed latches (which have no catch of their own) against a cat
  pawing at them from inside.
