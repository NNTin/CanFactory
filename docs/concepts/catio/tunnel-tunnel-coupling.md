# Tunnel–tunnel coupling

The coupling is how two of the tunnel's sections are joined, flange to flange, on the support under the joint. By default
they are joined by **printed toggle latches** (the [toggle latch](../../toggle-latch.md) model) across a sealed 3 mm gap,
which close **by hand, without tools**. **Bolted flanges** (M8 bolts through both flanges, face to face) remain an option.
This page owns the mechanism: the [tunnel](tunnel.md) page couples every section and angle collar this way.

Live page: `#/concepts/catio/tunnel-tunnel-coupling`, also linked from the catio concept page's heading under
**Sub-assemblies**. For local development, run `npm run dev --workspace @canfactory/web -- --port 5181`, then open
<http://127.0.0.1:5181/#/concepts/catio/tunnel-tunnel-coupling>. It needs no API.

The page shows only the modular variant, because the direct design has no tunnel. It reuses the sub-assembly page:

- the six camera presets, three of them renamed: **Along the tunnel**, **Side · the joint** and **Latch detail**
- **Exploded view**
- **Released · latches open**: every lever turns back over centre and its link swings off the catch, as on the insert–tunnel
  coupling page. The page starts coupled.
- the four layer buttons, with hardware labelled **Latches, bolts, feet & screws**
- a six-stage assembly with a caption naming what moves and how; the cameras follow the second section in
- a parts list with every piece's dimensions, and the design decisions

## What is shown

The joint is the same wherever it is on the route, so the page shows one: the first coupling of a straight, level tunnel
that the tunnel's own layout (`tunnelLayout`) builds. That way the sections, the support, its feet and the latches or bolts
are exactly the tunnel page's.

- **Sections.** Two identical elements of the tunnel page's:
  - long sections at its **Longest section** (two pitches, 1003 mm, by default);
  - or, when its **Straight runs** are cubes, two cubes with their doors.

  Both are at the catio's clear tunnel size (30 × 30 cm by default, set on the catio concept page). Every element ends in the
  [standard port](standard-port.md).
- **Support.** The tunnel's support under the joint: a 45 × 70 bearer on two legs, on the tunnel page's feet (printed
  pressure pads by default), on paving slabs, levelled. The feet and the ground (its fall and unevenness) are the tunnel
  page's.
- **Height.** The floor stands 45 cm above the grass (`TUNNEL_COUPLING.floor`), a typical height on the route that puts the
  support on legs. It does not follow the window insert.

## Parameters

| Parameter | Default | Options | Group |
| --- | --- | --- | --- |
| Coupling | Printed toggle latch (model) | Printed toggle latch; M8 bolts through both flanges | Coupling |
| Latches per side | 2 (4 per coupling) | 1, 2, 3; printed latch only | Coupling |
| Bolts per coupling | 8 · two on each side | 4, 8, 12: one, two or three on each of the port's four sides | Coupling |
| Seal | EPDM E-profile in the gap | EPDM E-profile; none (gap left open); printed latch only | Coupling |
| Door held by | The port's own toggle latches | The port's own latches; turn buttons on the port's ring | Doors |
| Held on the supports by | Screwed up through the bearer | Screws; rubber strap; dowels; turn buttons; gravity only | On the support (shared with the tunnel page) |
| Supports stand | Held up by the tunnel (trestles) | Trestles; on their own (legs on soles, or a wide low bearer) | On the support (shared with the tunnel page) |

**Held on the supports by** and **Supports stand** are the tunnel page's settings, shown and set here too (`shares` on the
definition). The tunnel page's saved settings hold them: this page reads them from there when it opens and writes them back
when they change here, so they can be set on either page. Under each, the page says "Shared with the tunnel page: set it here
or there."; on the tunnel page they say "Also changes the tunnel–tunnel coupling."

**Bolts per coupling**
- **Visible with the printed latch:** any mitred joint is bolted whatever the couplings are, with this many bolts.
- **Moved from the tunnel page's** **Bolts per coupling** (`couplingBolts`), so the setting lives in one place. Settings saved
  on the tunnel page before simply lose that key: `parseControlled` ignores keys it does not know.
- **Now the same on all four sides of the port,** so a port fits another at any quarter turn: 4, 8 or 12. A saved 6 (three
  a side, on two sides) is not offered any more and loads as the default 8.

**Door held by** is how a door closes a port that is not coupled: every face of a cube the tunnel does not run through
([standard-port.md](standard-port.md)). The tunnel page follows it.

With the defaults, a coupling has four printed latches (two each side, at 20 and 80 % of the clear height), sixteen
DIN 7997 4 × 25 screws and a 1.48 m E-profile seal. With **Coupling: M8 bolts**, it has eight ISO 4017 M8 × 80 bolts, two on
each side, sixteen ISO 7093 large washers and eight ISO 4032 nuts.

## The joint

All of it is in [catioTunnel.ts](../../../apps/web/src/catioTunnel.ts) (`tunnelLayout`, its `couplings`), with the page's
view of it in [catioTunnelCoupling.ts](../../../apps/web/src/catioTunnelCoupling.ts) (`tunnelCouplingLayout`). It is the
one source for both pages' scenes, parts lists and tests.

### The printed toggle latch

It is the insert–tunnel coupling's printed latch, placed by the same shared code
([catioPrintedLatch.ts](../../../apps/web/src/catioPrintedLatch.ts): `PRINTED_LATCH`, `LatchMount`, `printedLatchScrews`)
from the latch's shared mechanism (`packages/contracts/src/toggleLatchMechanism.ts`).

- **Gap and seal.** The latch locks over centre: its plates come closest at the dead centre and ease back 0.32 mm to
  1.31 mm apart where it locks. Two rigid timber faces flush give nothing for that, so the flanges stand **3 mm apart** with
  a self-adhesive EPDM E-profile (9 × 4, made for 2–3.5 mm gaps) round the middle of the flange's face. The over-centre draw
  squashes it. With **Seal: none** the gap stays and is left open.
- **Placement.** Every port carries the **base plates** (lever and link snapped on) on its left side and the **catch
  plates** on its right, seen from outside it. Two ports facing each other are mirror images, so across every joint a base
  is in line with a catch, and the pull is along the tunnel.
  - Looking along the tunnel, the flange before the joint has the bases on the right, the flange after it on the left.
  - Each plate stands 0.84 mm proud of its flange's face into the gap.
- **Heights.** Up the clear opening's height, as the bolts are: one at 50 %; two at 20 and 80 %; three at 15, 50 and 85 %.
  That keeps the plates' screws clear of the rails' screws at the flange's corners for every tunnel height the catio
  concept allows (20–45 cm).
- **Screws.** Two DIN 7997 4 × 25 (the model's default) through each plate, 5.1 mm inside the flange's timber: pre-drill
  them.

### Bolted flanges

Face to face, through both 30 mm flanges: 4, 8 or 12 ISO 4017 M8 × 80 bolts outside the mesh, one, two or three on each of
the four sides, on the middle line of the ring's outer 30 mm at the latches' fractions (`boltStations`): up the stiles,
across the head over the roof and across the sill under the floor. Each has a large washer under its head and its nut.

### Where each mechanism goes

- **Every square coupling** (section to section, to an angle collar or to a cube) uses this page's mechanism.
- **Mitred joints stay bolted.** A mitre's two flanges are cut on the bisector, so their side faces do not line up for a
  straight latch.
- **The enclosure end** is a standard port, and uses this page's mechanism too.
- **The window end** is the [insert–tunnel coupling](window-insert-tunnel-coupling.md) either way.

### The gap in the route

With the printed latch, every element and its gap is a pitch: a cube's edge and 3 mm (50.3 cm). The route is whole pitches
and ends where its elements end.

- Each straight run is whole pitches, each long section a whole number of them less the gap after it.
- A run stops a gap further short of an angle collar: 30 + r · tan(θ/2) + 3 (`Joint.stop`). The collar's own ends stay at
  its setback, so its flanges still meet at the inside of the joint.
- The bearer of a support at a coupling stands under the middle of the gap and is screwed up into both flanges.
- Bolted, the pitch is the cube's edge (50 cm), so the same elements end 2.3 cm nearer the wall.

### Checks

The tunnel's layout reports (and so both pages):

- a latch plate longer than the flange is thick (each plate is 12 mm along the joint, in a 30 mm flange);
- a plate screw less than 5 mm inside the timber;
- a latch that would stand over the bearer or above the flange;
- a latch screw within 12 mm of a screw up through the bearer or of a rail's screw in the same flange (`fastenerClashes`,
  only against screws in the same flanges, since a screw's axis runs on far past it).

## Design decisions (defaults to redirect)

1. **Toggle latches by default, bolts optional.**
   - **Why:** a latch closes by hand in one movement, so the tunnel comes apart without tools and nothing loose is dropped
     in the grass. Bolts need a 13 mm spanner and six nuts at every coupling, every time, but are rated library parts.
   - The printed latch's hold is not rated, so there are two each side by default. Choose bolts for a tunnel that stays
     put, or one a cat must not be able to work loose.
2. **A sealed gap for the over-centre lock.** The joint must give a little as the lever goes over centre; the seal does,
   and closes the gap to draughts and claws.
3. **No locating pins: the bearer locates.** Both flanges rest on the same bearer, levelled before the sections are laid
   and screwed up into each of them. Pins or a spigot would fight it wherever the support settled. If a latch has to lift
   or push a flange to close, re-level the support, not the latch.
4. **Latches only where the flanges are square.** Angle collars keep every coupling square, so they latch like straight
   ones; mitred joints stay bolted.
5. **One standard port, coupled or closed.** Every flange is the same port, its stations the same on all four sides, base
   plates on its left and catches on its right. The enclosure's port is one too, coupled like any other. A port that is not
   coupled is closed by a door, held by the port's own latches (a blank ring) by default, or by turn buttons on its ring.
   One port, with the latches' halves on fixed sides of it, lets any element meet any other; see
   [standard-port.md](standard-port.md).

## Assembly

The slider shows, in order:

0. **The site.** Grass, and the support that will carry the joint, levelled on its feet (the tunnel page, stages 1–2). No
   tunnel yet.
1. **Build one section.** Two flange rings, four rails, the floor board, then the net (or welded mesh, as the tunnel page
   sets it), each moving in along its real
   direction, framed raised over its place. Then it is laid on the support, its outgoing flange over the bearer.
2. **Ready its joint.** Printed latch: stick the seal round the outgoing flange's face, then screw the base plates (lever and
   link already on) onto its sides. Bolted: nothing yet.
3. **The second section comes in.** An identical section (catch plates already on its incoming flange) comes into view
   from beyond the first and travels along the tunnel's axis onto the same bearer. It stops 3 mm short (bolted: flange to
   flange). The cameras follow it in.
4. **Couple.** Printed latch: each link is hooked over its catch and each lever closed over centre, with the shared
   mechanism's movements (`TOGGLE_LATCH_MOVEMENTS`), as the model page plays them. Bolted: bolts through both flanges with
   a washer, then washers and nuts run on from the far side, turning as they go.
5. **Hold it on the support**, as **Held on the supports by** sets it (here or on the tunnel page) (see [tunnel.md](tunnel.md),
   "Held on the supports, but not for good"): four 6 × 100 screws up through the bearer (the default); a rubber strap
   hooked over both flanges; or the turn buttons turned flat over the keepers on the flanges. With dowels or gravity only
   there is nothing left to do.
   - The support's fittings (dowels, strap cleats, the turn buttons on their posts, pointing out) are on it from stage 0;
     each section brings its keepers on its flange.
   - A test turns every button through its quarter turn and checks that no point of it ever enters a keeper, another
     button or the flange.
   - Over dowels, the second section comes in along the axis lifted clear of them and is set down at the end of stage 3.
   - With self-standing supports, the support's legs stand on 45 × 70 soles (or it is a wide low bearer).

Screws come in point first along their own axis. The exploded view freezes the same assembly: the first section raised,
the second waiting beyond it, every piece on its way in and the latches open.

The tunnel page shows the same joints: its latch plates go on while the sections are framed (stage 3), the seal before each
piece is laid, and the levers close over centre once every piece is down (stage 5).

## Parts library

No new parts. The page uses ISO 4017 M8 × 80, ISO 7093-1 M8 and ISO 4032 M8 for the bolted option and DIN 7997 4 × 25 for
the latch plates, listed by role in [concepts.ts](../../../packages/contracts/src/concepts.ts)
(`tunnelTunnelCouplingConcept`; the tunnel's `TUNNEL_HARDWARE.latchScrew`). The parts library lists the page under each
part's “Used by”.

Custom lines: the two sections' timber and their net hoods or mesh panels (the tunnel's cut list for those two pieces,
`tunnelCutList`, with the roll they are cut from as a library part), the seal,
and the printed latches, which link to their model (`#/models/toggle-latch`).

## Implementation

- [Coupling settings](../../../apps/web/src/catioTunnelJoint.ts): the config, controls and defaults, apart from the page so
  that the tunnel's layout can follow them
- [Coupling page: layout, steps, parts list, facts, views, decisions](../../../apps/web/src/catioTunnelCoupling.ts)
- [Coupling scene](../../../apps/web/src/catioTunnelCouplingScene.ts): the staged assembly
- [Shared tunnel pieces](../../../apps/web/src/catioTunnelPieces.ts): `buildSectionPieces`, `buildSupportPieces` and
  `buildCouplingJoint`, which draw the sections, supports and joints for this page and the tunnel page alike
- [Shared printed latch](../../../apps/web/src/catioPrintedLatch.ts) and
  [its drawing](../../../apps/web/src/catioPrintedLatchScene.ts) (`buildPrintedLatches`), used by both coupling pages and the
  tunnel page
- **Cross-page wiring** (`follows` in [catioSubassemblies.ts](../../../apps/web/src/catioSubassemblies.ts)): the tunnel
  follows this page's **Coupling**, **Latches per side**, **Bolts per coupling** and **Seal**; this page follows the
  tunnel's **Longest section**, its **Side access** and **Access side** (a panel beside the joint lies between its own
  section's flanges, clear of the latches), its feet and ground (**Feet**, **Foot height**, **Foot sole**, **Foot diameter**,
  **Ground falls away**, **Uneven by up to**). It shares the tunnel's **Held on the supports by** and **Supports stand**
  (`shares`), set on either page.
- [Tests](../../../apps/web/src/catioTunnelCoupling.test.ts) check:
  - two identical sections at the tunnel's length, the gap between them (3 mm latched, none bolted), and the bearer under
    the middle of the gap screwed into both flanges, for every option, section length, feet and clear size
  - each latch placed with the shared mechanism: base on the first flange, catch on the second, in line, pulling along the
    tunnel; plates within the flange, screws at least 5 mm into the timber and clear of the bearer's and rails' screws
  - the bolt patterns
  - the design decisions quote the sizes they use, and the brief names where the section length is set
  - parts-list counts per option, and the parts-library cross-links
  - the staging: context still, one section framed and laid, the second coming in whole along the axis from beyond the
    first and stopping at the gap, the cameras following it, the latches opening and closing with each part on its pins,
    every piece along its own way in, each kind together, and the exploded view
  - restoring saved settings, and the tunnel's old `couplingBolts` dropped

  [catioTunnel.test.ts](../../../apps/web/src/catioTunnel.test.ts) checks that the route ends exactly at the enclosure port
  with either mechanism, the outlines across each gap, the latched and bolted couplings, and the tunnel's latches closing in
  its scene. [catioSubassemblies.test.ts](../../../apps/web/src/catioSubassemblies.test.ts) checks that exactly the declared
  settings change each page, in both directions. Browser coverage is in
  [catio.spec.ts](../../../tests/browser/catio.spec.ts).

This is a concept: the printed latch's hold is not rated, and the seal's size is this design's, not a product's. Check the
as-built gap before fixing the plates.
