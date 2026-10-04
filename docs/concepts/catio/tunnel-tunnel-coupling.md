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

- **Sections.** Two identical sections at the tunnel page's **Longest section** (75 cm by default), with the catio's clear
  tunnel size (30 × 30 cm by default, set on the catio concept page).
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
| Bolts per coupling | 6 · three each side | 4, 6, 8 | Coupling |
| Seal | EPDM E-profile in the gap | EPDM E-profile; none (gap left open); printed latch only | Coupling |

**Bolts per coupling** stays visible with the printed latch. The enclosure end and any mitred joint are bolted whatever the
couplings are, with this many bolts. It moved here from the tunnel page's **Bolts per coupling** (`couplingBolts`), so the
setting lives in one place. Settings saved on the tunnel page before simply lose that key: `parseControlled` ignores keys
it does not know.

With the defaults, a coupling has four printed latches (two each side, at 20 and 80 % of the clear height), sixteen
DIN 7997 4 × 25 screws and a 1.48 m E-profile seal. With **Coupling: M8 bolts**, it has six ISO 4017 M8 × 80 bolts, twelve
ISO 7093 large washers and six ISO 4032 nuts, as the tunnel had before.

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
- **Placement.** The **base plate** (lever and link snapped on) goes on the outer side face of the flange before the joint,
  the **catch plate** on the flange after it, in line, so the pull is along the tunnel. Each plate stands 0.84 mm proud of
  its flange's face into the gap.
- **Heights.** Up the clear opening's height, as the bolts are: one at 50 %; two at 20 and 80 %; three at 15, 50 and 85 %.
  That keeps the plates' screws clear of the rails' screws at the flange's corners for every tunnel height the catio
  concept allows (20–45 cm).
- **Screws.** Two DIN 7997 4 × 25 (the model's default) through each plate, 5.1 mm inside the flange's timber: pre-drill
  them.

### Bolted flanges

Face to face, through both 30 mm flanges: 4, 6 or 8 ISO 4017 M8 × 80 bolts outside the mesh, up the flange stiles at 15
(and 50) and 85 % of the clear height, and two across the head for 8. Each has a large washer under its head and its nut.

### Where each mechanism goes

- **Every square coupling** (section to section, and section to angle collar) uses this page's mechanism.
- **Mitred joints stay bolted.** A mitre's two flanges are cut on the bisector, so their side faces do not line up for a
  straight latch.
- **The enclosure end stays bolted** (a fixed interface: the enclosure's 30 mm port flange with the same bolt pattern).
- **The window end** is the [insert–tunnel coupling](window-insert-tunnel-coupling.md) either way.

### The gap in the route

With the printed latch, the tunnel's layout makes room for the 3 mm gaps, so that the route still ends exactly at the
enclosure port:

- Each straight run holds its sections **and the gaps between them**: n sections of (run − (n − 1) · 3) / n, n being the
  fewest that are no longer than the longest section.
- A run stops a gap further short of an angle collar: 30 + r · tan(θ/2) + 3 (`Joint.stop`). The collar's own ends stay at
  its setback, so its flanges still meet at the inside of the joint.
- The bearer of a support at a coupling stands under the middle of the gap and is screwed up into both flanges.
- With the defaults, the tunnel's pieces add up to 3.39 m and its eight gaps to 2.4 cm; bolted, the pieces are 3.41 m.

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
5. **The enclosure end stays bolted.** It is the one requirement the tunnel places on the enclosure, and it does not change
   with the couplings between sections.

## Assembly

The slider shows, in order:

0. **The site.** Grass, and the support that will carry the joint, levelled on its feet (the tunnel page, stages 1–2). No
   tunnel yet.
1. **Build one section.** Two flange rings, four rails, the floor board, then the mesh, each moving in along its real
   direction, framed raised over its place. Then it is laid on the support, its outgoing flange over the bearer.
2. **Ready its joint.** Printed latch: stick the seal round the outgoing flange's face, then screw the base plates (lever and
   link already on) onto its sides. Bolted: nothing yet.
3. **The second section comes in.** An identical section (catch plates already on its incoming flange) comes into view
   from beyond the first and travels along the tunnel's axis onto the same bearer. It stops 3 mm short (bolted: flange to
   flange). The cameras follow it in.
4. **Couple.** Printed latch: each link is hooked over its catch and each lever closed over centre, with the shared
   mechanism's movements (`TOGGLE_LATCH_MOVEMENTS`), as the model page plays them. Bolted: bolts through both flanges with
   a washer, then washers and nuts run on from the far side, turning as they go.
5. **Fix down.** Four 6 × 100 screws up through the bearer, two into each flange.

Screws come in point first along their own axis. The exploded view freezes the same assembly: the first section raised,
the second waiting beyond it, every piece on its way in and the latches open.

The tunnel page shows the same joints: its latch plates go on while the sections are framed (stage 3), the seal before each
piece is laid, and the levers close over centre once every piece is down (stage 5).

## Parts library

No new parts. The page uses ISO 4017 M8 × 80, ISO 7093-1 M8 and ISO 4032 M8 for the bolted option and DIN 7997 4 × 25 for
the latch plates, listed by role in [concepts.ts](../../../packages/contracts/src/concepts.ts)
(`tunnelTunnelCouplingConcept`; the tunnel's `TUNNEL_HARDWARE.latchScrew`). The parts library lists the page under each
part's “Used by”.

Custom lines: the two sections' timber and mesh (the tunnel's cut list for those two pieces, `tunnelCutList`), the seal,
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
  tunnel's **Longest section** and its feet and ground (**Feet**, **Foot height**, **Foot sole**, **Foot diameter**,
  **Ground falls away**, **Uneven by up to**).
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
