# Tunnel

The tunnel is the enclosed, supported walkway of the modular catio. It runs from the window insert's cat port to the
enclosure's rear cat port.

- **Standard elements.** It is built of standard elements ([standard-port.md](standard-port.md)): every piece ends in the same
  square port, so any element couples to any other. It turns 90° at **side ports**: the run before couples its end onto the
  standard port in the side of the next run's first section, which runs on past it by a short stub closed by a door.
  Every section is a whole number of pitches (58.3 cm). Climbs are sloped long sections between angle collars, solved so
  that the tunnel reaches a door at a different height exactly.
- **Where it ends.** The tunnel is whole elements, so it ends as near the enclosure port as they come, and the brief says
  where.
- **Supports.** They stand on levelling feet (printed [pressure pads](../../pressure-pad.md) on M8 screws by default), because
  nothing on the site is assumed to be level.
- **Couplings.** Its elements are coupled as the [tunnel–tunnel coupling](tunnel-tunnel-coupling.md) page sets: printed
  toggle latches across a sealed 3 mm gap by default, or bolted flanges. The stub's end behind every side port is closed by
  a door, held as that page's **Door held by** sets.

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
  the wall, its distance out, the way it faces and its floor height.
  - The tunnel's last flange couples to a **standard port** on the enclosure, latched or bolted as every coupling is. **That
    port is the one requirement the tunnel places on the enclosure page.**
  - The four values are the asked position. The tunnel ends where its whole elements end, and the brief shows **Enclosure
    port · placed by whole elements** when that is a millimetre or more away.
  - With side-port turns the port faces straight out or along the wall, whichever is nearer to the asked facing.

## Presets

Above the parameters, one click sets a whole design; the active one is highlighted, and any edit makes it your own:

| Preset | What it shows |
| --- | --- |
| Recommended | The defaults: two side-port turns, out, 1.1 m along the wall and out again, and a 25.45 cm climb at 11.5° in the run into the port (the same as **Reset to the recommended defaults**) |
| Straight | Straight out 2.3 m to a port at the window floor's height: no turns, no bends |
| 90° turn right | Out from the wall, one side port turning 90° to the right, 2 m along the wall to a level port |
| Rising | Straight out about 3.7 m to a door 90 cm above the grass: a 65.45 cm climb at up to 20° |

Every preset's port is set where its whole elements end, so none shows a port placed elsewhere.

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
| Port along the wall | 109.6 cm | −400 to 400 cm, in 0.1 cm steps | Enclosure port |
| Port out from the wall | 304.4 cm | 50 to 800 cm, in 0.1 cm steps | Enclosure port |
| Port faces | 0° | −120° to 120° (+ to the right); with side-port turns 0° or ±90°, the nearest | Enclosure port |
| Port floor | At its own height | Level with the window port; at its own height | Enclosure port |
| Port floor height | 50 cm | 15 to 140 cm, in 0.05 cm steps (only at its own height) | Enclosure port |
| Straight out from the wall | 70 cm | 30 to 500 cm | Route |
| Straight into the port | 200 cm | 30 to 500 cm (not with side-port turns: it follows from the port) | Route |
| Climb in | The run into the port | Run out from the wall; middle run; run into the port | Route |
| Steepest slope | 20° | 10°, 15°, 20°, 25° | Route |
| Turns and bends | Side ports (90°) | Side ports; angle collars (any angle); mitred ends, bolted | Joints |
| Mesh | Soft cat netting (TRIXIE 44294, 3 cm meshes) | Soft cat netting; welded wire mesh (KrapTrap, 19 mm meshes of 1.45 mm wire) | Sections |
| Longest section | 2 pitches (about 1.2 m) | 1, 2, 3, 4 pitches | Sections |
| Side access | One panel, near the middle | None; one panel near the middle; a panel in every long section that takes one | Sections |
| Access side | Right | Left; right (looking along the tunnel from the window) | Sections |
| Feet | Printed feet on M8 × 80 screws | Printed feet; Ganter GN 343.2 levelling feet | Supports |
| Foot height | 27.5 mm | 13 to 40 mm, in 0.5 mm steps (printed feet) | Supports |
| Foot sole | Grooved | Flat; grooved; domed (printed feet) | Supports |
| Foot diameter | 40 mm | 25, 32, 40 mm | Supports |
| Ground falls away | 2% | 0, 1, 2, 4% | Supports |
| Uneven by up to | ±15 mm | ±10, 15, 20, 25 mm | Supports |
| Held on the supports by | Screwed up through the bearer | Screws; rubber strap; dowels; turn buttons; gravity only | Supports |
| Supports stand | Held up by the tunnel (trestles) | Trestles; on their own (legs on soles, or a wide low bearer) | Supports |

How the sections are coupled is not set here: **Coupling**, **Latches per side**, **Bolts per coupling** and **Seal** are on
the [tunnel–tunnel coupling](tunnel-tunnel-coupling.md) page, which this page follows. (**Bolts per coupling** used to be
here; settings saved before simply drop it.)

With the defaults the tunnel is 4.27 m of pieces, with seven 3 mm gaps between them and at the port. It runs out from the
wall and turns 90° right at a side port. It runs 1.1 m along the wall to a second side port and turns 90° left. It then climbs
25.45 cm at 11.5° on one 1.16 m section between two angle collars, into the port at 109.6 cm along and 304.4 cm out.

- **Elements:** five sections (three of one pitch, two of two), two of them with a side port, and two angle collars.
- **Doors:** the two stubs' end doors.
- **Supports:** six, three low bearers near the wall and three trestles.
- **Latches:** all seven couplings, the port end too, are latched: 28 printed latches.

Bolted, the pitch is 58.0 cm, so the same elements end at 109.0 cm along and 302.4 cm out.

## The geometry

All of it is in [catioTunnel.ts](../../../packages/catio/src/catioTunnel.ts) (`tunnelLayout`). It is the one source for the
scene, the parts list and the tests.

1. **Route in plan.** The centre line leaves the window port straight out from the wall and arrives square to the port.
   - **Angle collars and mitred ends:** it runs out `approach`, to a point `final` short of the enclosure port along the port's
     facing, and a middle leg joins the two points. Both turn angles come from the geometry: any angle, and always summing
     to the port's facing.
   - **Side ports** (`squareRoute`): a side port turns only 90°, so the port faces straight out or along the wall, whichever
     is nearer. A port facing out, beside the window, is reached out `approach`, along the wall to its line and out again. A
     port facing along the wall is reached out to its line and along it. A port within 29 cm of the window's line is reached
     straight out.
   - **Whole elements:** every run between the joints is rounded to the nearest whole number of pitches, at least one. The
     route then ends where those elements end: `E`, as against the asked `asked`, `moved` apart (`facingMoved` for the
     facing).
   - **Defaults and presets:** they are set to where they end (`placedRoute`), so they show no move.
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
4. **Elements.** Each run's pitches go into as few long sections as take them, none longer than the chosen number of
   pitches.
   - **A long section** is a whole number of pitches long, less the gap after it.
     It is two 30 × 70 flange rings around the clear opening, four 40 × 40 corner rails, an 18 mm exterior plywood floor on
     the bottom rails, mesh down both sides and over the roof, and 20 × 20 cleats across sloped floors.
   - **A side port** is a third flange ring, on the rails' outer faces of the first section after a turn, 29 cm
     from its start, with a 40 mm pocket and a pocket post each side; the section's stub behind it ends in a port closed by a
     door ([standard-port.md](standard-port.md)).
   - **A climb** is the fewest whole pitches of long section that climb it within the steepest slope, sloped exactly to the
     port's floor.

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
   - **Always bolted:** mitred joints (their side faces do not line up for a latch). The enclosure end is a standard port and
     is coupled like any other.
   - **Standard stations:** latches and bolts stand at the standard port's stations, the same on all four sides: the bolts
     4, 8 (default) or 12, one, two or three on each side. Seen from outside, every port has its latches' base plates on its
     left and their catch plates on its right.
3. **A support at both ends, at every straight coupling and under every collar or mitre.** A section with a side port stands
   on the support under its side-port coupling (across the run before, under its end flange and the side ring's sill) and the
   one at its far end; its stub has none of its own.
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
   | **Turn buttons** | Yes | Yes | A hardwood keeper (15 × 12 × 15) on each flange's side just above the bearer; beside it, a printed post on the bearer's end rising to the keeper's top, with a printed button on a vertical 4 × 25 screw that turns flat over the keeper, 0.5 mm above it. Open, the button points straight out from the tunnel |
   | **Gravity only** | No | No | Nothing: the tunnel rests on self-standing supports, held in line by its couplings |

   - **Where they fit.** Turn buttons fit under any flanges flush with the bearer's ends (not under angle collars or at
     mitred turns). Each post stands at the end of its flange nearer the bearer's middle, so it is screwed to the bearer
     (the page checks it), and its keeper at the flange's other end. The keeper belongs to the section and the post and
     button to the support, so any section lifts off on its own.
   - **Why it turns flat.** A button turns about a vertical screw, at right angles to the load it holds, so it slides
     over its keeper and never swings into it. Its end is rounded about the pivot so it never swings into the flange's
     side either. An earlier button on the flange's side turned in the plane of its keeper, so its foot swept through the
     keeper as it closed, and stood open across the joint.
   - **Rejected:** a printed cradle on the bearer (it locates no better than dowels, holds nothing down and is hard to
     print), and an upright printed toggle latch (its 38 mm plate is wider than one 30 mm flange, so it would span two
     sections and tie them together, breaking the modular system).
   - **Standing up.** Along the tunnel a trestle is only 45 mm wide, one foot per leg: it stands because it is fixed to
     the tunnel. Where a fixing does not fit, and with gravity only, the page reports the supports left loose and asks for
     self-standing ones.
6. **Self-standing supports (an option).** The support then stands on its own: supports can be set out and levelled
   first, and sections lifted on and off. Two more feet per support, on the same two slabs.
   - **Trestles:** each leg stands on a 45 × 70 sole set on edge, 300 long, along the tunnel, with an insert nut and a
     foot 40 mm in from each of its ends. Two DIN 7997 6 × 100 screws go up through the sole into the leg, inside its
     45 × 45 (across it, clear of the bearer's screws down into the leg). Where there is room for the sole but not for a
     leg, the bearer sits straight on its soles and is screwed down into them.
   - **Low bearers:** a support too low for soles becomes a low bearer 195 mm wide along the tunnel (ripped to depth),
     on a foot near each corner, its feet's screws straight into it. At the wall end it reaches out from the first
     flange, not into the wall gap.
   - **The feet's screws stay in the timber.** A foot's insert nut and screw are in the sole, not in a leg above it, so
     the sole is 70 mm deep: the screw's tip stays inside it over the whole travel the ground needs. A printed foot takes
     the shortest library ISO 4017 M8 that gives that travel: M8 × 60 for ±10 mm, M8 × 80 for ±15 and ±20 mm (the
     library has no 65 or 70). An earlier 22 mm sole let the M8 × 80 come out of its top, and the sole's screws missed
     the leg; both are fixed, and the page now checks every foot: a screw or stud that would come out of the top of a
     sole or a low bearer is reported. (That check also catches shallow low bearers on trestle routes, which went
     unnoticed before.)
7. **20° steepest slope, climbed in the run into the port.** Cats manage 25° on cleats, but a gentler slope is kinder to old
   cats. The leg that climbs, and the limit, are both parameters. The climb is whole pitches of long section, sloped exactly
   to the port's floor: with the defaults one of two pitches at 11.5°. A leg too short for its climb is made as long as the
   climb's elements take, and the port moves.
8. **Two pitches (about 1.2 m) longest section.** One person can carry it. With a support at every coupling, no span exceeds a
   section.

## Side access

**Side access** puts a removable mesh panel in place of one side's mesh in a long section, kept in by door turn buttons on
the rails: one panel near the middle (the default for a new tunnel), one in every long section that takes one, or none (what
a tunnel saved before the setting keeps). Never on the side of a section where its side port is. [removable-doors.md](removable-doors.md) has the construction, what the reference product
shows, what is unverified and the checks to make on a built panel.

- **Where.** A long section takes a panel if the square part of its side, between its flanges' inner faces all the way up,
  is at least 30 cm long. Beside a mitre the panel sits in that square part and mesh fills the rest of the side (issue #85);
  collars take none. Held on the supports by a rubber strap, the first, the last and the sloped sections take none either:
  a strap would cross the panel there.
- **Locked.** Each of its door turn buttons has a captive locking pin: lift the pins, then turn the buttons.
- **What stays the same.** The route, the sections' lengths, the flanges, every coupling and every support. The panel lies
  between its section's flanges, in the depth of the rails: clear of the latches on the flanges' sides, of the supports
  and what holds the tunnel on them, and of the roof. The roof mesh, its staples and its parts-list lines do not change.
  Under a net, the hood of such a section ends 10 mm down that side's top rail instead of running down the side.
- **Not the same turn buttons.** These door turn buttons keep a panel in. **Held on the supports by → Turn buttons** is
  another part (a button on a post over a keeper on a flange) and is unchanged; so are the couplings' toggle latches.
- **Use.** Opening a panel opens the tunnel to the garden. Secure the cats elsewhere first, with both ends' ports shut.

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
   - at each turn, the first section after it: a side ring on the rails' outer faces, screwed into the rails (5 × 70), and a
     40 × 36 pocket post each side of it, screwed down through the top rail and up through the bottom rail
   - the latches' plates on every port's sides: seen from outside it, base plates on its left, catch plates on its right
4. **Net the sections.** By default each section gets one piece of soft cat netting as a hood: down one side, over both
   top rails and down the other, its ends turned onto the flanges.
   - Pulled taut by its own sides, the roof does not sag, and it has no seam at the top rails.
   - It is stapled (DIN 1159 2.5 × 25) every 15 cm along the top rails, and over every mesh (3 cm) along its cut edges, the
     bottom rails and the flanges: a net's edge opens between fixings a hand apart.
   - With welded wire mesh (**Mesh**) it is three panels a section, stapled every 15 cm all round.
   - **Close the stubs.** The end port of the stub behind every side port gets its door
     ([standard-port.md](standard-port.md)). Leave the side mesh out between the stub's flange and the far pocket post.
     - By default the door is set into the ring's opening on its seat (stop strips, or a rebate: the catio page's **Door
       seat**): a slim framed mesh panel, and its four door turn buttons, one at the middle of each side, are turned over it.
     - With **Door held by** = *a blank on the latches*, it is a blank flange ring with mesh clamped over it under cover
       strips (or a sheet), held off the port across the 3 mm gap and latched like a coupling.
5. **Lay and couple.** Lower the pieces onto the supports one by one from the window end, sticking the seal round each
   flange's face before the next piece goes down. Then close every latch over centre (or bolt every coupling) as the
   coupling page sets. The latches' plates were screwed onto the flanges' sides while framing (stage 3).
6. **Fix down and dock.**
   - Hold the tunnel on its supports as chosen: screw up through the bearers (the default), hook the straps over, or turn
     the buttons flat over their keepers. With dowels or gravity only there is nothing to do. The dowels, and the turn
     buttons on their posts, went onto the levelled supports in stage 2; the keepers onto the flanges while framing.
   - Close the latches between the first flange and the insert's docking frame (the coupling page).
   - Couple the last flange to the enclosure's port, a standard port: latched (by default) or bolted, as every coupling.
   - Open the cat ports at both ends: turn every button clear and lift each panel out, or slide the gates up, as the
     catio concept page's **Cat-port closure** sets.
   - Before any part of the tunnel is uncoupled again, shut both ends' ports first.
   - A side-access panel is for reaching in from outside. Opening one opens the tunnel to the garden: secure the cats
     elsewhere first, with both ends' ports shut.

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
- **DIN 7997**: 4 × 25 (the printed latches' plates, the turn buttons' pivots, the door turn buttons' pivots), 4 × 35,
  4 × 40 (also strap cleats, keepers and turn buttons' posts), 5 × 50, 5 × 70 (also side rings into the rails and pocket posts),
  6 × 100 (also soles into legs); for the side-access panels also 3 × 25 (stops), 3.5 × 25 (cover strips) and 4 × 50
  (panel frames); for the stubs' doors also 3.5 × 25 (cover strips, on the latches) and, held by turn buttons, 4 × 25
  (pivots), 4 × 50 (door frames) and 3 × 25 (door stops), and DIN 1159 staples (mesh onto the door frames)
- **ISO 7093-1** M4 (under each door turn button)
- **ISO 4017** M8 × 60 (printed feet, for ±10 mm of uneven ground)
- **ISO 2338** 8 × 40 parallel pins (dowels in the bearers)
- **DIN 1159** 2.5 × 25
- **GN 343.2 KR** with M8 studs: 25 and 32 mm with 63 mm studs, 40 mm with 80 mm (the longest stud of each diameter,
  `tunnelFoot`)

The printed feet use the ISO 4017 M8 × 80 and ISO 4032 M8 above (`tunnelPadScrew`); the feet themselves are the
[pressure-pad](../../pressure-pad.md) model, linked from the parts list with their size and sole.

They are listed once, by role, in [concepts.ts](../../../packages/contracts/src/concepts.ts) (`TUNNEL_HARDWARE`,
`tunnelConcept`). The parts library lists the page under each part's “Used by”, and a test keeps the page's parts list and
that list identical.

The mesh is one roll of the parts library (the net, or the welded mesh), linked to a shop; the list does not plan the cuts,
so more rolls may be needed.

Custom lines (not library parts): the timber cut list (with soles, strap cleats and keepers, the side-access panels'
frames, cover strips and stops, the side ports' pocket posts and the stubs' doors), the net hoods or mesh panels cut from that roll, the couplings'
E-profile seals, the straps, the turn buttons with their posts, the side-access panels' printed door turn buttons, and the
paving slabs.
The printed latches link to their model (`#/models/toggle-latch`). The window end's seal and latches are listed on the
insert–tunnel coupling page.

## Implementation

- [Tunnel design: parameters, solved layout, joint geometry, supports, parts list, steps, decisions](../../../packages/catio/src/catioTunnel.ts)
- [Tunnel scene](../../../apps/web/src/catioTunnelScene.ts): the window context (without its flat ground), uneven
  terrain, the window insert (`buildInsertContext`) with the coupling's docking frame (`buildCouplingPieces`), and the
  enclosure's port flange as fixed context. Its sections, supports and couplings are drawn by the builders it shares with
  the tunnel–tunnel coupling page ([catioTunnelPieces.ts](../../../apps/web/src/catioTunnelPieces.ts)).
- [Sub-assembly contract](../../../apps/web/src/catioSubassembly.ts) and [page](../../../apps/web/src/CatioSubassemblyPage.tsx).
  New for the tunnel: numeric controls (`range`), presets (`presets`), single-variant pages, per-page view, layer and toggle labels, the brief
  and assembly headings, a stage scale, and a Groundwork group in the parts list. The window insert page is unchanged.
- [Standard port](../../../packages/catio/src/catioPort.ts) and its [tests](../../../packages/catio/src/catioPort.test.ts): the
  stations under quarter turns, the genderless latches across any joint, a side port's pocket the least that keeps its and
  the stub's latches clear of each other, and both doors ([standard-port.md](standard-port.md)).
- [Tests](../../../packages/catio/src/catioTunnel.test.ts) check:
  - both ends square to their ports across left, right, odd-angle, climbing, falling and 90° routes, with side ports,
    angle collars and mitred ends
  - every straight run whole pitches, every side-port turn exactly 90° with the run before coupled onto the side port and
    every latch there clear of the section's end, posts and rails, the port placed where the elements end and reported
    when that is not where it was asked, the defaults and presets with no move, and saved tunnels snapped on load
  - no roll anywhere, and turns only on the level
  - coupling outlines identical on both sides, 3 mm apart where latched, and the route ending exactly at the port with
    either coupling mechanism
  - every way of holding the tunnel on its supports: the screws by default; dowels half in the bearer; the strap over the
    tunnel and under its cleats; turn buttons under flush flanges; gravity only, and the loose trestles it reports;
    self-standing legs on soles and wide low bearers, two feet along the tunnel on one slab at each end; and each one
    staged in the scene
  - every self-standing foot's screw inside its sole or low bearer over the travel the ground needs (M8 × 60 for ±10 mm),
    the soles' screws inside the legs, and a screw that would come out of a shallow low bearer reported
  - latches at every square coupling, the port end too (bolts at mitres), base and catch on the sides the standard port
    sets, their screws in the timber and clear of the bearer's and rails' screws, and closing over centre in the scene
  - bolted, the same number of bolts on each of the four sides of every port
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
The side ports, their latch pockets and the stubs' doors are unbuilt: [standard-port.md](standard-port.md) lists what to check.
