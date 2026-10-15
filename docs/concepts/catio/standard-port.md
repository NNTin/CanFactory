# Standard port and side ports

Every element of the tunnel ends in the same port, so any element couples to any other (issue #86). A port is either
**coupled** to another element (another tunnel element, the enclosure or the window insert) or **closed by a door**, which
blocks it off. The elements are:

- a **long section**: a rectangular box with a standard port at each end and fixed mesh sides;
- an **angle collar**: a short wedge between two square ports, at the bends into and out of a climb;
- a **side port**: the standard port on the side of a long section, where the tunnel turns 90°.

The run before a turn couples its end onto a side port in the first section of the run after it. That section runs on past
the side port by a short **stub**, whose own end port is closed by a door. The geometry is one module,
[catioPort.ts](../../../apps/web/src/catioPort.ts), which the tunnel's layout, its scenes and parts lists, the couplings and
the tests all use.

**Cubes are gone.** The first version turned at cubes: the port on all six faces, the faces the tunnel did not run through
(roof and floor included) closed by doors, with corner blocks, edge strips and a floor prop under each. They looked bulky
and made little sense to assemble. A corner is now an ordinary section with one more ring on its side, which looks like
the rest of the tunnel. There are no roof or floor doors.

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
them onto themselves, because the latch fractions are symmetric. A port therefore fits another at any rotation, and a side
port takes a section's end like any other port. The bolts used to be three a side and two on top; that pattern is not symmetric, so
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

## The side port

| | Value | Where |
| --- | --- | --- |
| Ring | The standard ring, 30 × 70, on the outer faces of the section's rails and floor board | `sidePortFace`, `SIDE_RING_SET` |
| Its face | Flush with the outline of the section's flanges: the rails stand 30 mm (a ring's depth) inside it | `sidePortFaces` |
| Its opening | The section's clear opening: level with the floor, as high as the tunnel | |
| Pocket | 40 mm along the section each side of the ring, from the latch's real movement | `SIDE_POCKET`, `sideClashes` |
| Pocket post | In each pocket, 40 × 36, on the floor board under the top rail | `sidePocketPost` |
| Where | 29 cm from the section's start (stub 3 cm, pocket 4 cm, half the ring's outline 22 cm) | `sidePortOffset` |
| Shortest section with one | 58 cm, both pockets and the ring | `sidePortLength` |

- **The pocket, from the latch's real movement.** The latches at the side port's two sides stand along the section, and
  their levers swing out along it as they open (38 mm). The stub's flange reaches out to the side port's face, so the
  lever needs room before it: the pocket is the least that keeps every latch of the side port and of the stub's end port,
  closed or swinging open with 2 mm to spare, clear of the other's ring, latches, coupled element and the section's rails.
  It is 40 mm, where a cube needed 19: a cube's next ring stopped a pocket short of the face.
- **Pocket posts.** Each pocket would leave a slot in the side between the ring and the mesh. A post 40 mm along the
  section and 36 mm deep closes it: from the clear opening's plane out to 2 mm behind the latches' swing. It stands on the
  floor board under the top rail, screwed down through the rail and up through the bottom rail.
- **Mesh.** None on the side port's side between the stub's flange and the far post; the side mesh (or the net) runs on
  from there. A net hood ends on the top rail's outer face, under the ring.
- **Fixing.** The ring is screwed through its head into the top rail and through its sill into the bottom rail.
- **The stub.** Its end port is a standard port, closed by a door (below).
- **Supports.** The section stands on the support under its side-port coupling (a bearer across the run before, under its
  end flange and the side ring's sill) and on the one under its own far end. The stub has no support of its own.
- **Side access** is never on the side port's side of a section.
- **The pitch** is the shortest section with a side port and a coupling's gap: 58.3 cm latched, 58.0 cm bolted. Every
  section is a whole number of pitches, so any section after a turn can carry a side port.

## Doors (`Door held by`, on the tunnel–tunnel coupling page)

A port that is not coupled is closed by a door: the stub's end behind every side port. The doors look like the PawHut
tunnel's: a slim panel set into the opening, about flush with the ring, with a turn button at the middle of each side. The
first version laid a panel over the ring between locating strips, or latched a whole blank ring onto it, which was bulky.

| | Set in, held by turn buttons (default) | A blank, held by the port's latches |
| --- | --- | --- |
| The door | A slim panel set into the opening, 1 mm behind the ring's face: mesh stapled on the back of a 25 × 17 frame, or an 18 mm plywood sheet | A ring like the port's (30 × 70) with mesh under cover strips on its outer face, or a 12 mm plywood sheet |
| Seated | **Door seat** (catio page): 12 × 10 stop strips inside the ring's opening (default, the easier to make), or a 12 mm rebate round it | On the port's face, across the 3 mm gap |
| Held | Four door turn buttons on the ring's face, one at the middle of each side: the same on every side | By the port's own latches: the door carries the other halves, as a coupled element would |
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

Every ring is marked and pre-drilled from it, the side ports' too, so every port is the same and any one fits any other at a
quarter turn.

## Elements and the route

| Setting | Default | Options |
| --- | --- | --- |
| Turns and bends | Side ports (90°) | Side ports; angle collars (any angle); mitred ends, bolted |
| Longest section | 2 pitches (about 1.2 m) | 1–4 pitches |

**Snapped route.** Every straight run is a whole number of pitches, and the enclosure port lands where the elements end. The
port's position stays an input, as the asked target, and the brief shows **Enclosure port · placed by whole elements** with
the asked position whenever the two are a millimetre or more apart. The defaults and the presets are set where their elements
end (`placedRoute`).

**Side-port routes.** A side port turns 90°, so **Port faces** is a choice: straight out, or along the wall to the left or
right. A facing saved at another angle is kept and laid out at the nearest of those. A port beside the window (more than 29 cm
to one side) is reached out, along the wall, and out again. **Straight in to the port** then follows from where the port is, so
it is hidden.

**Climbs.** A climb is the one length solved exactly. It uses the fewest whole long sections that climb to the port's floor
within the steepest slope, sloped as steeply as that takes.

## Saved designs (snapped on load)

- **Tunnel page.** A saved tunnel keeps its route settings and its joint type, so a saved design with angle collars keeps them.
  One saved with cube corners turns at side ports, the same right angles; straight runs of cubes become long sections. Its
  longest section, saved in millimetres, becomes the nearest whole number of pitches (500 → 1, 750 and 1000 → 2). The layout
  then snaps the route to whole elements, and the brief reports how far that puts the port from where it was saved.
- **Coupling page.** A page saved showing two sections shows two sections' ends; one saved showing a cube shows a section's
  end at a side port.
- **Catio page.** Settings version 3. A design saved with a tunnel that was not square becomes the standard square port at its
  larger size, so the cats' opening never shrinks. Version 1 designs also keep their sliding gates.

## The whole catio

The modular catio page uses the same standard. Its modules are one pitch long (58.3 cm), and one **Tunnel clear size** sets
the port both ways (a saved width and height load as their larger size).

- **Corners:** a module with a side port in the middle of its side, the run before coupled onto it, its back closed by the
  stub's door, held as the tunnel–tunnel coupling page sets. The door opens from the page's door controls.
- **Side access:** the straight modules carry it as the tunnel page sets it.

The tunnel–tunnel coupling page can show either joint (**Joint shown**): a section's end to the next section's, or to a side
port at a turn.

## Out of scope

- **Branching.** A section with side ports on both sides, or a side port and a run on past it, would need a network model. The
  tunnel is still a single route, but the side port allows a branch later without changing it.
- **Roof and floor access.** Only a section's ends and its side port are ports. There are no roof or floor doors.

## Unverified: check on a built section

The geometry is checked in the tests. What only a built side port can show:

- **The lever by hand.** The pocket leaves the swing 2 mm clear of everything, but nothing yet checks finger room to lift a
  lever there. Try it at the pocket between the side ring and the stub's flange.
- **Stiffness.** The side ring is screwed onto the rails only; the side between the rails is open there. Check a built
  section for racking under a push at the side port, and whether the pocket posts are enough.
- **The section on its supports.** It stands on the bearer under the side coupling and the one at its far end; the stub
  overhangs. Check it does not tip when a cat jumps onto the stub.
- **Quarter turns.** A turned port is as good as the template it was marked from. Test a side port against a section's end.
- **Cats against the doors.** Test the locking pins and the printed latches (which have no catch of their own) against a cat
  pawing at them from inside.
