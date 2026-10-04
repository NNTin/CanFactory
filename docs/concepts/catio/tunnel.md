# Tunnel

The tunnel is the enclosed, supported walkway of the modular catio. It runs from the window insert's cat port to the
enclosure's rear cat port. Its route is **solved between the two ports**, so it can turn at any angle and climb or fall to a
door at a different height. Its **supports stand on levelling feet** (printed [pressure pads](../../pressure-pad.md) on M8
screws by default), because nothing on the site is assumed to be level. Its sections are coupled as the
[tunnel–tunnel coupling](tunnel-tunnel-coupling.md) page sets: **printed toggle latches** across a sealed 3 mm gap by
default, or bolted flanges.

Live page: `#/concepts/catio/tunnel`, also linked from the catio concept page's heading under **Sub-assemblies**. For local
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
  page. The scene draws it with its mesh and the coupling's docking frame, seal and catches from the start. The latch bodies
  and floor lip appear, closed, in the last stage (as set on the coupling page). The port's clear size is the tunnel's (30 × 30 cm by default). Its floor is the insert's threshold: 24.55 cm above
  the grass by default. The tunnel starts square to the wall, 10 mm off it. **Nothing of the tunnel rests on the wall or on
  the insert.** The insert is held only by pressure and must not carry the tunnel, so the first flange has its own support.
  It is joined to a docking frame on the insert by tool-free toggle latches across a sealed 6 mm gap: see the
  [insert–tunnel coupling](window-insert-tunnel-coupling.md), which replaced the foam strip this page used to list.
- **Enclosure end.** The enclosure is out of scope. Only its rear cat port is used, set by four values: its position along
  the wall, its distance out, the way it faces and its floor height. The tunnel's last flange bolts to a matching 30 mm flange
  with the same bolt pattern. **That flange is the one requirement the tunnel places on the enclosure page.** It stays
  bolted whatever the couplings between sections are.

## Presets

Above the parameters, one click sets a whole design; the active one is highlighted, and any edit makes it your own:

| Preset | What it shows |
| --- | --- |
| Recommended | The defaults: two 37.04° turns and a 25.45 cm climb at 20° (the same as **Reset to the recommended defaults**) |
| Straight | Straight out 2.5 m to a port at the window floor's height: no turns, no bends, square sections only |
| 90° turn right | 1 m out from the wall, one 90° turn to the right, 1.2 m along the wall to a level port |
| Rising | Straight out 4 m to a door 90 cm above the grass: a 65.45 cm climb at 20° in the middle run |

The level presets set **Port floor** to *Level with the window port*. The enclosure port's floor then follows the window
port's floor, wherever the window insert's clamps put it (229–261 mm). So a straight tunnel stays straight when the
insert changes, and the preset still shows as picked. An earlier version copied the floor height into **Port floor
height** when the preset was clicked. Changing the insert afterwards then quietly gave the tunnel two 4.19° bends.

The brief shows the **window port floor** with a link to the window insert settings that set it (**Held in the recess
by**, **Spreader feet**, **Pad height**, **Foot diameter**). With an own height less than 3 cm off the window port's floor, the rise says it is nearly
level and suggests the level setting.

## Parameters

| Parameter | Default | Options | Group |
| --- | --- | --- | --- |
| Port along the wall | 120 cm | −400 to 400 cm | Enclosure port |
| Port out from the wall | 300 cm | 80 to 800 cm | Enclosure port |
| Port faces | 0° | −120° to 120° (+ to the right) | Enclosure port |
| Port floor | At its own height | Level with the window port; at its own height | Enclosure port |
| Port floor height | 50 cm | 15 to 140 cm, in 0.05 cm steps (only at its own height) | Enclosure port |
| Straight out from the wall | 70 cm | 30 to 500 cm | Route |
| Straight into the port | 70 cm | 30 to 500 cm | Route |
| Climb in | The middle run | Run out from the wall; middle run; run into the port | Route |
| Steepest slope | 20° | 10°, 15°, 20°, 25° | Route |
| Turns and bends | Angle collar | Angle collar; mitred ends, bolted | Joints |
| Longest section | 75 cm | 50, 75, 100 cm | Sections |
| Feet | Printed feet on M8 × 80 screws | Printed feet; Ganter GN 343.2 levelling feet | Supports |
| Foot height | 27.5 mm | 13 to 40 mm, in 0.5 mm steps (printed feet) | Supports |
| Foot sole | Grooved | Flat; grooved; domed (printed feet) | Supports |
| Foot diameter | 40 mm | 25, 32, 40 mm | Supports |
| Ground falls away | 2% | 0, 1, 2, 4% | Supports |
| Uneven by up to | ±15 mm | ±10, 15, 20, 25 mm | Supports |
| Held on the supports by | Screwed up through the bearer | Screws; rubber strap; dowels; printed cradles; vertical printed toggle latches; turn buttons; gravity only | Supports |
| Supports stand | Held up by the tunnel (trestles) | Trestles; on their own (a sole under each leg) | Supports |

How the sections are coupled is not set here: **Coupling**, **Latches per side**, **Bolts per coupling** and **Seal** are on
the [tunnel–tunnel coupling](tunnel-tunnel-coupling.md) page, which this page follows. (**Bolts per coupling** used to be
here; settings saved before simply drop it.)

With the defaults, the tunnel's pieces are 3.39 m long, with eight 3 mm gaps between them (3.41 m of pieces when bolted). It
turns 37.04° right, climbs 25.45 cm at 20°, then turns 37.04° left into the port. That is five sections, four angle
collars and six supports: two low bearers near the wall and four trestles. Its eight couplings are latched, 32 printed
latches in all; the port end is bolted.

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
   - **Latched couplings leave a gap.** With the printed latch, the flanges of every square coupling stand 3 mm apart. A run
     stops a gap further short of an angle collar (`Joint.stop` = e + 3; the collar's ends stay at e), and holds its
     sections and the gaps between them, so the route still ends exactly at the port. Mitred joints are bolted, face to
     face, with no gap.
4. **Sections.** Each straight run is divided into equal sections no longer than the chosen length, less the gaps between
   them when they are latched. A section is two
   30 × 70 flange rings around the clear opening, four 40 × 40 corner rails, an 18 mm exterior plywood floor on the bottom
   rails, mesh down both sides and over the roof, and 20 × 20 cleats across sloped floors.

## Design decisions (defaults to redirect)

1. **Angle collars at every turn and bend.**
   - **What:** a short wedge between two square flange rings, cut to the joint's exact angle (up to 135°) and coupled to the
     sections either side like any coupling.
   - **Why:** every section stays a plain, square box that can move to another place in the route; only the small collars
     are cut to angles.
   - **Alternative (an option):** mitred ends, up to 90°. These need no collar, but cut the two sections at each joint, with
     their flange rings, rails, floor and mesh, to the mitre. The cut list then gives each piece's mitre angle.
2. **Flange couplings: latched, or bolted** (set on the [tunnel–tunnel coupling](tunnel-tunnel-coupling.md) page).
   - **What:** by default, every section-to-section and section-to-collar coupling is joined by printed toggle latches on
     the flange rings' outer sides (two each side), across a 3 mm gap with an EPDM E-profile seal. Or neighbours are
     bolted through both flange rings, 30 mm outside the mesh where a 13 mm spanner reaches: six ISO 4017 M8 × 80 bolts per
     coupling, each with two ISO 7093 M8 large washers and an ISO 4032 M8 nut.
   - **Why:** latches close by hand and leave nothing loose in the grass. Bolts have a rated hold and are all library parts;
     80 mm grips 2 × 30 mm of flange, two washers and the nut with thread to spare.
   - **Always bolted:** mitred joints (their side faces do not line up for a latch) and the enclosure end.
3. **A support at both ends, at every straight coupling and under every joint.**
   - **Trestles:** a 45 × 70 bearer, sitting just under the flanges, carries the tunnel on two 45 × 45 legs. The bearer is
     bevelled to the slope under sloped couplings and screwed up into the flanges with DIN 7997 6 × 100 screws.
   - **Braces:** a trestle with a leg over 30 cm gets a 22 × 70 diagonal brace.
   - **Low bearers:** where the tunnel is too low for legs (near the wall by default), the feet screw straight into a bearer
     ripped to depth from 45 × 95.
4. **Levelling feet take up the ground.**
   - **Feet:** every leg or low bearer stands on a printed foot, the [pressure-pad](../../pressure-pad.md) model in PETG
     (40 mm, 27.5 mm high, grooved sole by default).
     - Its pocket holds the head of an ISO 4017 M8 × 80, the library's longest M8 hexagon head screw and the same part as
       the coupling bolts.
     - The screw goes up into a DIN 7965 M8 × 18 insert nut in the end grain. It is screwed in by turning the foot by hand
       and locked by an ISO 4032 nut jammed against the timber.
     - **Feet** = *Ganter GN 343.2 levelling feet* uses a Ganter GN 343.2 KR levelling foot instead (40 mm pad, M8 × 80
       stud, 3 kN), locked by the nut supplied on its stud.
   - **Slabs:** each foot stands on a 30 × 30 cm paving slab bedded in the grass, so it cannot sink.
   - **Leg lengths:** legs are cut, in 5 mm steps, to the measured fall of the ground (2% away from the wall by default),
     with the foot at mid-travel.
   - **Travel:** the screw can come out from the lock nut's height (6.8 mm) to its length less the foot's 3 mm lip and the
     insert nut (59 mm). That takes up about ±26 mm at each foot, against the ±15 mm tolerance; less half a 5 mm leg step,
     it is too short for ±25 mm. The page checks every foot.
   - **Ganter feet:** the 40 mm foot's stud comes out to its length less the insert nut (62 mm), ±27 mm. The 25 and 32 mm
     feet (63 mm studs) take up ±19 mm, and the page reports them as too short for ±20 mm or more.
   - **In the scene:** the ground is uneven within the tolerance, and each foot is set to the ground it actually stands on.
5. **Held on the supports, but not for good.** How the tunnel is held on its supports is a parameter
   (`supportFixing`), because screws bind the sections to the supports: every move means unscrewing from below, and
   re-driven screws hold less.

   | Option | Locates | Holds down | What it is |
   | --- | --- | --- | --- |
   | **Screws** (default) | Yes | Yes | DIN 7997 6 × 100 up through each bearer, two into each flange or collar rail |
   | **Rubber strap** | Friction only | Yes | One EPDM tarp strap per support, over the flanges (or a collar's roof), hooked under a 20 × 20 × 60 cleat on each bearer end (two 4 × 40 screws). Stretched 25 % when hooked; the parts list gives its unstretched length |
   | **Dowels** | Yes | No | Two ISO 2338 8 × 40 parallel pins under each flange or collar rail, half in the bearer; the sections lift straight off |
   | **Printed cradles** | Yes | No | A PETG cradle on each bearer end: a 4 mm base under the tunnel (the bearer is set 4 mm lower), 20 mm lips round the flanges, or beside a collar's rails |
   | **Vertical latches** | Yes | Yes | The printed toggle latch upright: catch plate on the bearer's end, base plate across the two flanges' sides over a 3 mm EPDM pad (the bearer is set 3 mm lower) |
   | **Turn buttons** | Yes | Yes | A printed button on each flange's side, turned down so its foot hooks under a hardwood keeper on the bearer's end |
   | **Gravity only** | No | No | Nothing: the tunnel rests on self-standing supports, held in line by its couplings |

   - **Where they fit.** The latch's plates are 38 mm wide with screws 26.4 mm apart, wider than one 30 mm flange, so a
     vertical latch spans the two flanges of a joint, one screw in each; it fits only where two flanges meet over a bearer
     flush with their sides (straight section-to-section couplings). To lift a section off, open its latches and take out
     the one screw in its flange. Turn buttons fit under any flanges flush with the bearer's ends (not under angle
     collars or at mitred turns). The tunnel has no face facing up near its bearers, so a button hooks under a keeper on
     the bearer rather than over the tunnel.
   - **Standing up.** Along the tunnel a trestle is only 45 mm wide, one foot per leg: it stands because it is fixed to
     the tunnel. Where a fixing does not fit, and with gravity only, the page reports the supports left loose and asks for
     self-standing ones.
6. **Self-standing supports (an option).** Each leg (or a low bearer's end) stands on a 22 × 95 × 300 sole along the
   tunnel, screwed up into it with two DIN 7997 5 × 50 screws, with an insert nut and a foot 40 mm in from each of its
   ends, both on the one slab. The support then stands on its own: supports can be set out and levelled first, and
   sections lifted on and off. A sole costs 22 mm of height (a support too low for it is reported) and two more feet per
   support. A 45 mm sole would not fit under the low bearers near the wall on the default route; 22 mm does.
7. **20° steepest slope, climbed in the middle run.** Cats manage 25° on cleats, but a gentler slope is kinder to old cats.
   The leg that climbs, and the limit, are both parameters. The page explains how much length a climb needs when a leg is
   too short.
8. **75 cm longest section.** One person can carry it, and runs split into equal sections. With a support at every
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
5. **Lay and couple.** Lower the pieces onto the supports one by one from the window end, sticking the seal round each
   flange's face before the next piece goes down. Then close every latch over centre (or bolt every coupling) as the
   coupling page sets. The latches' plates were screwed onto the flanges' sides while framing (stage 3).
6. **Fix down and dock.**
   - Hold the tunnel on its supports as chosen: screw up through the bearers (the default), hook the straps over, close
     the vertical latches or turn the buttons down. With dowels, cradles or gravity only there is nothing to do: the
     dowels and the cradles' parts went onto the levelled supports in stage 2, and the turn buttons onto the flanges while
     framing.
   - Close the latches between the first flange and the insert's docking frame (the coupling page).
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
- **DIN 7997**: 4 × 25 (the printed latches' plates, the support cradles), 4 × 35, 4 × 40 (also strap cleats and keepers),
  5 × 50 (also soles and turn buttons' pivots), 5 × 70, 6 × 100
- **ISO 2338** 8 × 40 parallel pins (dowels in the bearers)
- **DIN 1159** 2.5 × 25
- **GN 343.2 KR** with M8 studs: 25 and 32 mm with 63 mm studs, 40 mm with 80 mm (the longest stud of each diameter,
  `tunnelFoot`)

The printed feet use the ISO 4017 M8 × 80 and ISO 4032 M8 above (`tunnelPadScrew`); the feet themselves are the
[pressure-pad](../../pressure-pad.md) model, linked from the parts list with their size and sole.

They are listed once, by role, in [concepts.ts](../../../packages/contracts/src/concepts.ts) (`TUNNEL_HARDWARE`,
`tunnelConcept`). The parts library lists the page under each part's “Used by”, and a test keeps the page's parts list and
that list identical.

Custom lines (not library parts): the timber cut list (with soles, strap cleats and keepers), mesh panels, the couplings'
E-profile seals, the straps, support cradles, latch pads and turn buttons, and the paving slabs.
The printed latches link to their model (`#/models/toggle-latch`). The window end's seal and latches are listed on the
insert–tunnel coupling page.

## Implementation

- [Tunnel design: parameters, solved layout, joint geometry, supports, parts list, steps, decisions](../../../apps/web/src/catioTunnel.ts)
- [Tunnel scene](../../../apps/web/src/catioTunnelScene.ts): the window context (without its flat ground), uneven
  terrain, the window insert (`buildInsertContext`) with the coupling's docking frame (`buildCouplingPieces`), and the
  enclosure's port flange as fixed context. Its sections, supports and couplings are drawn by the builders it shares with
  the tunnel–tunnel coupling page ([catioTunnelPieces.ts](../../../apps/web/src/catioTunnelPieces.ts)).
- [Sub-assembly contract](../../../apps/web/src/catioSubassembly.ts) and [page](../../../apps/web/src/CatioSubassemblyPage.tsx).
  New for the tunnel: numeric controls (`range`), presets (`presets`), single-variant pages, per-page view, layer and toggle labels, the brief
  and assembly headings, a stage scale, and a Groundwork group in the parts list. The window insert page is unchanged.
- [Tests](../../../apps/web/src/catioTunnel.test.ts) check:
  - both ends square to their ports across left, right, odd-angle, climbing, falling and 90° routes, in both joint types
  - no roll anywhere, and turns only on the level
  - coupling outlines identical on both sides, 3 mm apart where latched, and the route ending exactly at the port with
    either coupling mechanism
  - every way of holding the tunnel on its supports: the screws by default; dowels half in the bearer; cradles lowering the
    bearer by their base; the strap over the tunnel and under its cleats; vertical latches only where two flanges meet
    flush over a bearer, one screw into each; turn buttons under flush flanges; gravity only, and the loose trestles
    each reports; self-standing soles with two feet on one slab; and each one staged in the scene
  - latches at every square coupling (bolts at mitres and at the port), their screws in the timber and clear of the
    bearer's and rails' screws, and closing over centre in the scene
  - collar flanges meeting at the inside edge, and mitres on the bisector
  - the exact rise
  - supports at every coupling and joint, bearers touching but not cutting the underside, and every foot within its travel
    on the uneven ground
  - parts-list counts against the layout, and the parts-library cross-links
  - staging and fastener directions, and restoring saved settings
  - the presets: each is valid and restorable; straight has no joints, the 90° preset turns once by exactly 90° in both joint
    types, and the rising preset reaches its door

  Browser coverage is in [catio.spec.ts](../../../tests/browser/catio.spec.ts).

This is a concept: timber sizes, spans and bolt counts are not yet calculated for load, and the ground values are
assumptions. Measure the fall and unevenness on site, and check both ports' positions, before cutting legs and collars.
