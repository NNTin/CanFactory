# Tunnel

The tunnel is the enclosed, supported walkway of the modular catio. It runs from the window insert's cat port to the
enclosure's rear cat port. Its route is **solved between the two ports**, so it can turn at any angle and climb or fall to a
door at a different height. Its **supports stand on levelling feet**, because nothing on the site is assumed to be level.

Live page: `#/concepts/catio/tunnel`, also linked from the catio concept page under **Sub-assemblies**. For local
development, run `npm run dev --workspace @canfactory/web -- --port 5181`, then open
<http://127.0.0.1:5181/#/concepts/catio/tunnel>. It needs no API.

The page shows only the modular variant, because the direct design has no tunnel. It reuses the window insert's page:

- the six camera presets, three of them renamed for the tunnel: **Along the tunnel**, **Side · the climb**,
  **Top · the turns** and **Support detail**
- **Wall cutaway** and **Exploded view**
- the four layer buttons (timber, mesh, bolts/feet/fixings, ground/wall/slabs)
- a six-stage assembly with a caption naming what moves and how
- a parts list with every piece's dimensions and the design decisions

The **Window open** toggle is left out because it means nothing for the tunnel. Choices and viewing state persist per
browser. Numeric parameters are typed in (cm or degrees) and checked against their range; the page introduces this kind of
control.

## Interfaces (fixed)

- **Window end.** The window insert as it is set on its own page (or its defaults), in the window saved on the catio concept
  page. The port's clear size is the tunnel's (30 × 30 cm by default). Its floor is the insert's threshold: 24.55 cm above
  the grass by default. The tunnel starts square to the wall, 10 mm off it. **Nothing is fixed to the wall or to the insert.**
  The insert is held only by pressure and must not carry the tunnel, so a foam strip fills the gap and the first flange has
  its own support.
- **Enclosure end.** The enclosure is out of scope. Only its rear cat port is used, set by four values: its position along
  the wall, its distance out, the way it faces and its floor height. The tunnel's last flange bolts to a matching 30 mm flange
  with the same bolt pattern. **That flange is the one requirement the tunnel places on the enclosure page.**

## Parameters

| Parameter | Default | Options | Group |
| --- | --- | --- | --- |
| Port along the wall | 120 cm | −400 to 400 cm | Enclosure port |
| Port out from the wall | 300 cm | 80 to 800 cm | Enclosure port |
| Port faces | 0° | −120° to 120° (+ to the right) | Enclosure port |
| Port floor height | 50 cm | 15 to 140 cm | Enclosure port |
| Straight out from the wall | 70 cm | 30 to 500 cm | Route |
| Straight into the port | 70 cm | 30 to 500 cm | Route |
| Climb in | The middle run | Run out from the wall; middle run; run into the port | Route |
| Steepest slope | 20° | 10°, 15°, 20°, 25° | Route |
| Turns and bends | Angle collar, bolted | Angle collar; mitred ends | Joints |
| Bolts per coupling | 6 | 4, 6, 8 | Joints |
| Longest section | 75 cm | 50, 75, 100 cm | Sections |
| Foot diameter | 40 mm | 25, 32, 40 mm | Supports |
| Ground falls away | 2% | 0, 1, 2, 4% | Supports |
| Uneven by up to | ±15 mm | ±10, 15, 20, 25 mm | Supports |

With the defaults, the tunnel is 3.41 m long. It turns 37.04° right, climbs 25.45 cm at 20°, then turns 37.04° left into
the port. That is five sections, four angle collars and six supports: two low bearers near the wall and four trestles.

## The geometry

All of it is in [catioTunnel.ts](../../../apps/web/src/catioTunnel.ts) (`tunnelLayout`). It is the one source for the
scene, the parts list and the tests.

1. **Route in plan.** The centre line leaves the window port straight out from the wall (`approach`). It runs to a point
   `final` short of the enclosure port, along the port's facing, and arrives square to the port. The middle leg joins the
   two points. Both turn angles therefore come from the geometry: any angle, and always summing to the port's facing.
2. **Turns only on the level, climbs only in a straight line.** A joint that turns and climbs at once is a compound mitre.
   Its two sections would meet with one rolled against the other, and the floor would tilt sideways. So the climb is a
   single straight sloped run inside one leg, between two vertical bends, with equal level runs before and after it.
   - **Every piece's cross axis is horizontal (no roll).** Every joint is a plain mitre about one axis.
   - **The slope is the steepest allowed.** A climb too small for that, over at least the 15 cm shortest run, gets a
     shallower slope over exactly 15 cm.
   - **Exact rise.** The rise is (e₁ + run + e₂) · sin φ, exactly the difference in floor height. Its footprint in plan is
     e₁ + (e₁ + run + e₂) · cos φ + e₂.
3. **Joint setback.** Each run stops short of a joint's vertex by **e = 30 + r · tan(θ/2)**. Here θ is the angle between the
   two runs and r is the distance from the floor's centre line to the profile's edge on the inside of the joint:
   - **turn:** half the width plus the flange
   - **bend up:** the height plus the flange
   - **bend down:** the flange

   With this setback, the backs of the two 30 mm flanges either side meet exactly on the bisector plane at the inside edge,
   and open into a wedge towards the outside. For mitred ends there is no setback: both sections end on the bisector plane
   through the vertex. The tests check both, and check that every coupling's outline is the same on both sides.
4. **Sections.** Each straight run is divided into equal sections no longer than the chosen length. A section is two
   30 × 70 flange rings around the clear opening, four 40 × 40 corner rails, an 18 mm exterior plywood floor on the bottom
   rails, mesh down both sides and over the roof, and 20 × 20 cleats across sloped floors.

## Design decisions (defaults to redirect)

1. **Angle collars at every turn and bend.**
   - **What:** a short wedge between two square flange rings, cut to the joint's exact angle (up to 135°) and bolted to the
     sections either side like any coupling.
   - **Why:** every section stays a plain, square box that can move to another place in the route; only the small collars
     are cut to angles.
   - **Alternative (an option):** mitred ends, up to 90°. These need no collar, but cut the two sections at each joint, with
     their flange rings, rails, floor and mesh, to the mitre. The cut list then gives each piece's mitre angle.
2. **Bolted flanges.**
   - **What:** neighbours are bolted through both flange rings, 30 mm outside the mesh where a 13 mm spanner reaches. Six
     ISO 4017 M8 × 80 bolts per coupling, each with two ISO 7093 M8 large washers and an ISO 4032 M8 nut.
   - **Why:** 80 mm grips 2 × 30 mm of flange, two washers and the nut with thread to spare. Bolts can be undone to take the
     tunnel apart or re-route it. All are library parts.
   - **Rejected:** proprietary toggle clamps, which the library does not yet have.
3. **A support at both ends, at every straight coupling and under every joint.**
   - **Trestles:** a 45 × 70 bearer, sitting just under the flanges, carries the tunnel on two 45 × 45 legs. The bearer is
     bevelled to the slope under sloped couplings and screwed up into the flanges with DIN 7997 6 × 100 screws.
   - **Braces:** a trestle with a leg over 30 cm gets a 22 × 70 diagonal brace.
   - **Low bearers:** where the tunnel is too low for legs (near the wall by default), the feet screw straight into a bearer
     ripped to depth from 45 × 95.
4. **Levelling feet take up the ground.**
   - **Feet:** every leg or low bearer stands on a Ganter GN 343.2 KR levelling foot (40 mm pad, M8 × 80 stud, 3 kN). The
     foot is screwed into a DIN 7965 M8 × 18 insert nut in the end grain and locked by the nut supplied on its stud.
   - **Slabs:** each foot stands on a 30 × 30 cm paving slab bedded in the grass, so it cannot sink.
   - **Leg lengths:** legs are cut, in 5 mm steps, to the measured fall of the ground (2% away from the wall by default),
     with the foot at mid-travel.
   - **Travel:** the stud can come out from the supplied nut's height (6.8 mm) to its length less the insert nut (62 mm).
     That takes up ±27 mm at each foot, against the ±15 mm tolerance. The page checks every foot.
   - **Smaller feet:** the 25 and 32 mm feet (63 mm studs) take up ±19 mm, and the page reports them as too short for
     ±20 mm or more.
   - **In the scene:** the ground is uneven within the tolerance, and each foot is set to the ground it actually stands on.
5. **20° steepest slope, climbed in the middle run.** Cats manage 25° on cleats, but a gentler slope is kinder to old cats.
   The leg that climbs, and the limit, are both parameters. The page explains how much length a climb needs when a leg is
   too short.
6. **75 cm longest section.** One person can carry it, and runs split into equal sections. With a support at every
   coupling, no span exceeds a section.

## Assembly

1. **Bed the slabs and build the supports.**
   - Bed a slab under every foot.
   - Stand the legs (or lay the low bearers).
   - Screw insert nuts up into their foot ends, then screw the feet into them.
   - Screw the bearers down onto the legs, and the braces across.
2. **Level the supports.** Set a string line at each bearer's design height from the window floor. Turn each foot on its stud
   until the bearer meets the line, then jam its nut.
3. **Frame the sections and collars** on trestles beside the line (shown raised over it):
   - flange rings at both ends
   - rails screwed through the flanges into their end grain (DIN 7997 5 × 70)
   - the floor board screwed onto the bottom rails (DIN 7997 4 × 40)
   - cleats on sloped floors (DIN 7997 4 × 35)
4. **Mesh the sections.** Fit side and roof mesh, stapled to the rails and turned onto the flanges with DIN 1159 2.5 × 25
   staples every 15 cm.
5. **Lay and couple.** Lower the pieces onto the supports one by one from the window end, then bolt every coupling.
6. **Fix down and dock.**
   - Screw up through the bearers into the flanges.
   - Fit the foam strip at the wall.
   - Bolt the last flange to the enclosure's port flange.
   - Open the gates.

Every piece moves along the direction it is really fitted:

- Screws, staples and bolts come in point first along their own axis; screws and nuts turn as they go.
- Insert nuts and feet come up from below.
- In stage 2 the supports rise as their feet are turned.
- The exploded view is the same assembly frozen: supports unlevelled, sections raised, every piece waiting on its own way in.

## Parts library

No new families were needed. The tunnel uses existing parts:

- **ISO 4017** M8 × 80
- **ISO 7093-1** M8
- **ISO 4032** M8
- **DIN 7965** M8 × 18
- **DIN 7997**: 4 × 35, 4 × 40, 5 × 50, 5 × 70, 6 × 100
- **DIN 1159** 2.5 × 25
- **GN 343.2 KR** with M8 studs: 25 and 32 mm with 63 mm studs, 40 mm with 80 mm (the longest stud of each diameter,
  `tunnelFoot`)

They are listed once, by role, in [concepts.ts](../../../packages/contracts/src/concepts.ts) (`TUNNEL_HARDWARE`,
`tunnelConcept`). The parts library lists the page under each part's “Used by”, and a test keeps the page's parts list and
that list identical.

Custom lines (not library parts): the timber cut list, mesh panels, the foam strip and the paving slabs.

## Implementation

- [Tunnel design: parameters, solved layout, joint geometry, supports, parts list, steps, decisions](../../../apps/web/src/catioTunnel.ts)
- [Tunnel scene](../../../apps/web/src/catioTunnelScene.ts): the window context (without its flat ground), uneven
  terrain, the window insert and the enclosure's port flange as fixed context
- [Sub-assembly contract](../../../apps/web/src/catioSubassembly.ts) and [page](../../../apps/web/src/CatioSubassemblyPage.tsx).
  New for the tunnel: numeric controls (`range`), single-variant pages, per-page view, layer and toggle labels, the brief
  and assembly headings, a stage scale, and a Groundwork group in the parts list. The window insert page is unchanged.
- [Tests](../../../apps/web/src/catioTunnel.test.ts) check:
  - both ends square to their ports across left, right, odd-angle, climbing, falling and 90° routes, in both joint types
  - no roll anywhere, and turns only on the level
  - coupling outlines identical on both sides
  - collar flanges meeting at the inside edge, and mitres on the bisector
  - the exact rise
  - supports at every coupling and joint, bearers touching but not cutting the underside, and every foot within its travel
    on the uneven ground
  - parts-list counts against the layout, and the parts-library cross-links
  - staging and fastener directions, and restoring saved settings

  Browser coverage is in [catio.spec.ts](../../../tests/browser/catio.spec.ts).

This is a concept: timber sizes, spans and bolt counts are not yet calculated for load, and the ground values are
assumptions. Measure the fall and unevenness on site, and check both ports' positions, before cutting legs and collars.
