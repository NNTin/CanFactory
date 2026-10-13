# Removable doors with turn buttons

A catio door that is **lifted out of its opening** once every **turn button** over it has been turned clear. It is the
default closure of every cat port (the window insert's and the enclosures'), and the tunnel's side access. The vertical
sliding gate remains selectable for the cat ports.

This page keeps three things apart, because only the first is known:

1. [What the reference product's photos show](#1-observed-the-pawhut-doors).
2. [What CanFactory proposes to build](#2-proposed-canfactorys-construction), which the photos do not show.
3. [What nobody has checked yet](#3-unverified-physical-assumptions), and [the checks](#4-physical-validation-before-any-claim-of-safety)
   that have to be done on a built door before it is called safe for cats.

Nothing here has been built. The pages are concept previews and parts lists; this document does not establish that the
design is safe to build or to leave cats behind.

**Roofs are not part of this.** The tunnel's and the enclosures' roofs are unchanged: no roof feature, material, default,
geometry, support, fixing or parts-list line differs, for new, reset or saved designs. The reference product's roof cover is
not a design requirement here.

## 1. Observed: the PawHut doors

Reference: [PawHut outdoor cat tunnel, Amazon.de, ASIN B0GLFJRNKD](https://www.amazon.de/PawHut-Katzentunnel-T%C3%BCren-Katzen-Grau/dp/B0GLFJRNKD/).
Read on 2026-10-13 from two of the listing's images: the one for its doors
([“Mehrere Eingänge”](https://m.media-amazon.com/images/I/81IrzxOvi-L._AC_SL1500_.jpg)) and its
[overview](https://m.media-amazon.com/images/I/81844vSSKcL._AC_SL1500_.jpg). They are the supplier's renderings, not
photographs of a tunnel in use. Nothing was measured: the product was not in hand. The reading agrees with the analysis in
[issue #82](https://github.com/NNTin/CanFactory/issues/82), which this implements.

- The door is a separate **timber-framed wire-mesh panel**, fitted inside the opening it closes. The images show removable
  panels at both ends of the tunnel and one in its side, next to an end.
- Small rectangular **turn buttons** are mounted on the uprights beside the opening, each on a screw through its middle.
  Closed, a button lies across the joint with one end over the door's frame, so the panel cannot be drawn out. Each door
  shown has **two**: one at about mid-height on each side. None is on the head or the sill.
- **To open:** the buttons are turned clear of the panel (the image marks each with a rotation arrow) and the panel is
  taken out and put aside. The opening is then unobstructed.
- **To close:** the panel is put back and the buttons are turned over its frame again.
- The image labels them “Abnehmbare Türen” (removable doors) and “Drehbare Verschlüsse” (rotating closures). It is
  **not** a hinged door, a swinging cat flap, a vertical sliding gate or an over-centre toggle latch. The panels shown
  lying on the ground beside the tunnel are doors that were taken out, not fold-down ramps.
- In the overview the end door stands a little inside its frame, which shows as a border round it. Whether that is a
  rebate that seats it cannot be told from the image.

**Not shown, so not known:** how the panel is seated or stopped from being pushed in; the clearances; how far a button
turns; whether anything but friction keeps a button from turning; how much force a cat can put on the door. None of these
was reverse-engineered, and none of the sizes below comes from the product. Where this design differs from what is shown
(more buttons, on more edges; a solid panel at the window), that is deliberate and said below.

## 2. Proposed: CanFactory's construction

One layout ([catioDoor.ts](../../../apps/web/src/catioDoor.ts)) and one 3D builder
([catioDoorScene.ts](../../../apps/web/src/catioDoorScene.ts)) serve every door, so the window insert, tunnel,
coupling and whole-catio previews cannot disagree. All sizes are this design's choices, in millimetres.

### What every door has

| Requirement | How it is met here |
| --- | --- |
| A **continuous seat**, so the panel cannot be pushed in | Timber on all four edges of the panel: the frame round the opening and a stop strip across its floor, or four stop strips inside it. At least 10 mm of seat everywhere. |
| **Buttons over the panel**, so it cannot be drawn out | Printed turn buttons lying 12 mm over the panel's edge, their undersides on the panel's face. |
| Carried and located **by timber, not by screws** | The panel stands on the opening's floor and sits between locating strips, or inside the opening, with 2 mm to spare each side. The screws only keep it from coming out. |
| It must not **tilt or flex free** between buttons | No two buttons along an edge farther apart than 250 mm, no corner farther than 125 mm from one; buttons on at least two opposite edges. That is more than the reference's one button a side. A mesh panel longer than 600 mm has a mullion. |
| Buttons in **sound timber** | Each pivot is a DIN 7997 screw through the button and an ISO 7093 M4 washer it turns on, at least 18 mm into timber, 12 mm of that in the member behind a strip. |
| Not turned **by accident** | A 1 mm pip under the button's short end drops into a dimple in the timber at the closed and at the open position: opening takes a deliberate twist of every button, a quarter turn each. |
| **Mesh edges covered** | A mesh panel's mesh lies between its frame and cover strips screwed on over every cut edge, on the cat side. |
| Straight **withdrawal** | Open, every button stands at least 1 mm clear of the panel's outline; the panel comes straight out, and is clear of everything fixed after its own depth and 20 mm. |

The buttons are **door turn buttons**. They are not the turn buttons that can hold the tunnel on its supports
(**Held on the supports by → Turn buttons**, a button on a post over a keeper on a flange), nor the **toggle latches** that
couple sections and dock the tunnel to the insert. Those are unchanged.

### The three places

| | Window port | Enclosure cat ports | Tunnel side access |
| --- | --- | --- | --- |
| Panel | **Solid** 12 mm exterior plywood, pressed onto an E-profile seal | Framed mesh, 30 mm thick | Framed mesh, 30 mm thick |
| Why | Undocked, it is all that closes the window opening against draught and weather. The mechanism is copied, not the mesh. | Outdoors; an unused port stands under the sky | Outdoors |
| Fitted | On the port frame's **room side**, lapping 13 mm onto the jambs and transom | On the port frame's **inside**, the same way | **Inset** between the section's two flanges and its top and bottom rails, flush with the rails |
| Seat | Jambs' and transom's faces, and a 12 × 10 stop across the port's floor | The same | Four 12 × 10 stops inside the opening |
| Located by | The threshold, and 25 × 14 locating strips on the jambs and transom | The landing, and locating strips | The opening itself |
| Buttons | 2 on each jamb, 1 or 2 on the transom, on the strips | The same | 2 or more on the top rail, as many on the bottom rail |
| Operated from | The room, with the tunnel docked | Inside the enclosure, through the maintenance door | Outside |
| A cat pushing out pushes it onto | Its **seat** (the port frame) | Its **seat** | Its **buttons** |
| Stowed, removed | Shown on the room side of the wall beside the window | Not shown: carried away | Not shown: carried away |

- **Window port** ([window-insert.md](window-insert.md)). The panel, its strips and buttons lie within the depth of the
  collar but for 5 mm: the page checks that this fits between the frame's face and the closed sash when the insert hangs
  on the window frame (a sliding gate's latch needs 12 mm there). Everything is reached from the room through the open
  sash; the page checks that no screen hook, corner bracket or clamp stud stands in the panel's way. Nothing of the door
  touches the port's outdoor face, which the [coupling](window-insert-tunnel-coupling.md)'s docking frame, seal and
  latches have to themselves, so the panel comes out with the tunnel docked. The door adds no load path: the tunnel still
  stands on its own wall support, and drawing the panel out pulls on the collar with no more than the seal's grip.
- **Docking-frame screws.** The coupling's frame screws go into the same jambs and transom from outdoors. They are placed
  at least 12 mm from the panel's pivot and strip screws, as they already are from the batten screws and staples.
- **Enclosure ports** (the whole-catio concept). The enclosure has no page of its own yet, so these panels are drawn and
  validated but have no parts list.
- **Tunnel side access** ([tunnel.md](tunnel.md)). **Side access**: none, one panel near the middle (the default for a new
  tunnel), or one in every section that can take one; **Access side**: left or right. A section takes one if both its ends
  are square and it is at least 36 cm long. The panel lies wholly between its section's flanges, in the depth of the
  rails: the route, the sections, the flanges, every coupling and every support are the same with or without it, and a
  section still lifts off with its panel in. Its pivots are 10 mm inside the rails' edges and stop short of the rails'
  middle, clear of the roof's staples and the floor's screws. Where a rubber strap holds the tunnel down, the first, the
  last and the sloped sections take no panel: a strap would cross it.

### What the choice changes, and what it does not

- **Sliding travel is a sliding gate's limit only.** A gate rises by its own height, so a port needs twice its height
  inside the window collar and under an enclosure's top rail. A removable panel leaves its opening, so with it a port only
  has to fit, with its frame, where it stands. One rule (`slidingGateRise`) now serves the whole-catio page and the window
  insert page, each applying it only to a sliding gate; the panel is checked from its own layout instead (fit, seat,
  button sweep, withdrawal, access).
- **One step in the floor.** The seat under a face-fitted panel is a 12 mm high stop strip across the port's floor, which
  stays when the panel is out. It is the only step in the otherwise level walkway, like the cleats on a sloped floor. A
  rebate in the threshold would avoid it at the cost of a slot across the walkway.
- **Roofs:** nothing. Under a net, the hood of a section with side access ends 10 mm down the outer face of that side's
  top rail instead of running on down the side; its roof part, the roof's staples and the roof's parts-list lines are the
  same.

### Settings and saved designs

| Setting | Where | New or reset design | A design saved before the setting existed |
| --- | --- | --- | --- |
| **Cat-port closure** | Catio concept page, **Cat ports** | Removable panel with turn buttons | **Vertical sliding gate**, as it was drawn |
| **Side access** | Tunnel page, **Sections** | One panel, near the middle | **None**, as it was |
| **Access side** | Tunnel page, **Sections** | Right | (no panel) |

- The whole-catio settings are now version 2. Version 1 settings are migrated when read
  (`migrateCatioSettings` in [catioSettings.ts](../../../apps/web/src/catioSettings.ts)): every dimension and all viewing
  state are kept, and the closure is set to the sliding gate. Before, settings lacking a field were rejected whole and
  replaced by the defaults.
- **No whole-catio settings, but a saved sub-assembly page.** Someone who saved a window insert, tunnel or coupling page
  before the choice existed, and never the concept page, has a design drawn with sliding gates and no closure recorded
  anywhere. Such a page's save is recognised by what it lacks (`savedBeforeClosure`: it names its variant but no view has
  `doorOpen`), and the whole-catio settings are then started, and saved, with the sliding gate, so the choice holds once
  the page saves itself again. A page first saved now, or only another page's shared settings, starts a new design.
- A saved tunnel that lacks **Side access** was saved before it existed and gets none (`TUNNEL_LEGACY`). A saved config
  that is only the settings another page shares with the tunnel page is not a saved tunnel, and takes the defaults.
- The sub-assembly pages follow the concept page's closure, as they follow its window and cat-port sizes, and name it in
  their briefs as set there. Each page with a door has a toggle that opens it (**Cat port open**, **Side access open**)
  once its assembly is complete; older saved pages start with it shut.

### Using the doors

- **Unused ports stay shut**, their panels seated and every button over them.
- **Both ends before disconnecting.** Before any part of a tunnel is uncoupled or undocked, shut the ports at both of its
  ends and turn every button back over their panels. An open port at a tunnel that is no longer there is an open catio.
- **An outside panel opens the catio.** Taking out a tunnel side-access panel, like opening an enclosure's maintenance
  door, breaches containment: secure the cats elsewhere first, with both ends' ports shut, and reseat and retain the
  panel before they return.
- **Stow a removed panel clear of the route**, where it cannot fall onto a cat or be walked on. A hook or shelf for it is
  not designed yet.

## 3. Unverified: physical assumptions

Every item is a guess that the geometry cannot settle.

- **The detent.** That a 1 mm pip in a dimple gives a button enough resistance to stay put under a paw, a push on the
  panel, vibration or wind, and still lets a hand turn it. On a jamb or a sill the buttons are not held by gravity: turned
  loose, one falls open. Only the head buttons hang closed.
- **The printed button.** A PETG bar 6 mm thick on one screw: its strength, its creep in summer sun and how its pivot hole
  wears are unknown. It is a custom part, not yet a model of the library.
- **The overlap and spacing.** That 12 mm of button over the panel and 250 mm between buttons hold a panel a cat throws
  itself at, without the panel tilting or flexing free. On the tunnel's side the buttons, not the seat, take a cat's push.
- **Panel stiffness.** That 12 mm plywood, and a 30 × 20 frame with its mesh and cover strips, are stiff enough at these
  sizes; that the frame's butt joints stay square.
- **The seal.** That an E-profile squashed from 4 to 3 mm closes the window port against draught and rain, and that the
  buttons can hold it squashed.
- **Clearances.** That 2 mm each side is enough for timber that swells outdoors, and not so much that a panel rattles or a
  paw gets under an edge.
- **Reach.** That every button of an enclosure's port can be reached through the maintenance door, and those of the window
  port through the open sash over the collar.
- **The stop strip.** That cats step over a 12 mm strip in a port without catching a claw, and that it stays glued and
  screwed under their feet.
- **Soft netting in a small frame.** That a net clamped only under cover strips, without staples (the library's shortest
  staple is longer than the frame is thick), holds at every mesh.

## 4. Physical validation, before any claim of safety

To be done on a built door of each kind, from **both sides**. Until then no page says the door is cat-proof.

- [ ] **Push-out and push-in.** Lean and strike on the panel's middle, edges and corners from each side: it neither passes
      its seat nor rides over a button.
- [ ] **Tilt.** Push one corner and one edge at a time: the panel does not tilt out between two buttons or lift off its
      floor far enough to clear a strip.
- [ ] **Accidental unlatching.** Try to turn each button with a paw-sized object, by rattling the panel, and from the far
      side through the mesh or past the panel's edge: none turns out of its dimple. Repeat after a season outdoors.
- [ ] **Every button missed.** Leave one button open, then two: the panel still cannot be worked out. Note which
      combination frees it.
- [ ] **Sharp and pinch edges.** No mesh end, staple, screw point or screw head can be reached by a paw or a tail, in the
      panel or round the opening; nothing pinches between panel and strip, or under a button, as the panel goes in or out.
- [ ] **Window access.** With the tunnel docked and the sash turned open, take the window panel out and put it back from
      the room: nothing fouls the sash, the screen hooks, the clamps, the seal or the coupling's latches; the insert does
      not shift or lift on its hooks and feet. Close the sash over the shut panel.
- [ ] **Disconnection drill.** Shut both ends, undock, uncouple a section, put it back: no port was open to the garden at
      any moment.
- [ ] **Stowing.** A removed panel has a place where it stays, clear of the route.

## Implementation

- [Door layout, parts lists and poses](../../../apps/web/src/catioDoor.ts): `facePanel` (window and enclosure ports),
  `insetPanel` (tunnel side access), `doorPose`, `doorBom`, `slidingGateRise`
- [Door 3D builder](../../../apps/web/src/catioDoorScene.ts): `buildDoorPanel`, used by `buildPortClosure`
  ([catioWindowInsertScene.ts](../../../apps/web/src/catioWindowInsertScene.ts): the insert's own page, and as context on
  the tunnel's and the coupling's), `port` ([catioModularScene.ts](../../../apps/web/src/catioModularScene.ts)) and
  `buildAccessPanels` ([catioTunnelPieces.ts](../../../apps/web/src/catioTunnelPieces.ts): the tunnel's and the
  tunnel–tunnel coupling's pages)
- Hardware by role: `CATIO_DOOR_HARDWARE` in [concepts.ts](../../../packages/contracts/src/concepts.ts)
- [Tests](../../../apps/web/src/catioDoor.test.ts): seating, retention both ways, button sweep, withdrawal, the sliding
  gate's travel applied only to a sliding gate over every permitted size, migration of saved settings, each scene's closed
  and removed states, agreement of parts lists and stage captions with what is drawn, clearance from couplings and
  supports, and that routes, couplings, supports and roofs are the same with and without the doors
- [Browser tests](../../../tests/browser/catio.spec.ts)
