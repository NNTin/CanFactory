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

- **Edge.** The cube's edge is the outline plus a ring's depth each side: `cubeEdge(s) = s + 2 (F + T)`, which is 50 cm for a
  30 cm opening.
- **Pitch.** A cube's edge plus a coupling's gap is the **pitch**: 50.3 cm latched, 50 cm bolted.
- **Rings.** Each face is a standard ring with its mating face flush with the cube's face. The rings of two adjacent faces meet
  edge to edge at the inside of the corner between them, so the cube's inside is closed without anything more.
- **Pockets.** Along each edge, outside both rings, that leaves a notch 30 × 30 mm. Both faces' latch plates stand in it: the
  closed printed latch is about 15 mm off the ring's side, and its two plates are 12 mm along the joint each. The test checks
  that every face's latch stays clear of the other faces' rings, latches and coupled elements, for every size and latch count.
- **Corner blocks.** A 40 × 40 × 40 block in each of the eight corners sits behind the three rings that meet there. It is
  screwed through each ring with a 5 × 70, the three screws offset so they pass each other. The blocks are clear of every
  latch and bolt station, which lie within the opening's middle 70 %.
- **Doors.** Every face the tunnel does not run through is closed by a door: at a corner, the front and the other side; in a
  run of cubes, both sides. The roof and floor faces are always doors. The floor face's door is solid and carries a plug that
  fills the opening, so the cat stands on a flat floor 70 mm below the tunnel's.
- **Supports.** A cube stands on the supports under its couplings, like a section: its end ring's sill is at the same height
  as a section's flange, and the bearer under a coupling lies under the end ring, clear of the floor door.

## Doors (`Door held by`, on the tunnel–tunnel coupling page)

| | Held by the port's latches (default) | Held by turn buttons |
| --- | --- | --- |
| The door | A blank: a ring like the port's (30 × 70) with mesh under cover strips on its outer face, or a 12 mm plywood sheet | A panel the opening plus 13 mm all round (mesh in a frame, or plywood) laid on the ring |
| Held | By the port's own latches across the 3 mm gap: the door carries the other halves, as a coupled element would | By door turn buttons on locating strips on all four sides of the ring, the same on every side |
| Floor face | Plywood sheet and a plug filling the gap and the opening | Plywood panel and a plug filling the opening |
| Builder | `blankPanel` | `portPanel` |

The turn buttons are the removable doors' buttons from [removable-doors.md](removable-doors.md), placed on the ring's face.
They are not the turn buttons that can hold the tunnel on its supports, nor the couplings' toggle latches.

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

**Cube routes.** With cube corners, the port faces straight out or along the wall (±90°), whichever is nearer to the asked
facing. A port beside the window (more than 25 cm to one side) is reached out, along the wall, and out again. **Straight in
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

The modular catio page uses the same standard. Its straight modules are one pitch long (50.3 cm) and its corners are cubes
(50 cm), and one **Tunnel clear size** sets the port both ways. Its scene is still schematic: the corner cubes are drawn as
frames, without the doors.

## Out of scope

- **Branching.** A cube with three or more coupled faces leading to separate routes would need a network model. The tunnel is
  still a single route, but the port allows a branch later without changing it.
- **Roofs of long sections** are unchanged. Only a cube's roof face is a port.

## Unverified: check on a built element

- **The latch pocket.** Is the 30 mm notch enough room to work a lever? Both faces' latches can stand in the same notch, 1.6 mm
  apart closed, and a lever swings out as it opens. Check by hand with two latched faces at one edge.
- **Rings meeting edge to edge.** Rings that meet only along a line, held by the corner blocks, may not be stiff enough. A cube
  may need glue on the meeting edges, or a fillet strip inside them. Check a built cube for racking.
- **The floor door.** It carries the cat. Held by latches, the load is on the latches; held by turn buttons, on the buttons.
  Test a cat's weight, and its jumping, on each before use.
- **Quarter turns in practice.** A turned port is only as good as the stations it was marked out to. Mark every ring from one
  template, and test a turned cube against a section.
- **Doors cats can't work loose.** Test the printed latches and the door turn buttons against a cat pawing at them from
  inside, as for the other removable doors.
