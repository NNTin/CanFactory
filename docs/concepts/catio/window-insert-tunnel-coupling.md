# Insert–tunnel coupling

The coupling is the joint between the window insert's cat port and the tunnel's first flange. It is a deliberate
connection that you dock and undock **by hand, without tools**: a docking frame on the insert, a squashed seal, and toggle
latches across the joint. The tunnel's own wall support still carries all of its weight; **the insert carries nothing**.

Live page: `#/concepts/catio/insert-tunnel-coupling`, also linked from the catio concept page's heading under
**Sub-assemblies**. For local development, run `npm run dev --workspace @canfactory/web -- --port 5181`, then open
<http://127.0.0.1:5181/#/concepts/catio/insert-tunnel-coupling>. It needs no API.

The page shows only the modular variant, because the direct design has no tunnel. It reuses the sub-assembly page:

- the six camera presets, two of them renamed: **Side · the joint** and **Latch detail**. The joint lies in the recess,
  so **Side**, **Top** and **Latch detail** open with the wall cut away (`cutawayViews` on the definition), as **Interior** does
- **Wall cutaway** and **Exploded view**
- **Released · latches open**: every lever opens and its hook leaves the catch, showing the undocked joint. The page starts
  docked. (This is the page's open/closed toggle; a new `defaultViewing` on the definition makes it start off.)
- the four layer buttons, with hardware labelled **Latches, seal & screws**
- a five-stage assembly with a caption naming what moves and how
- a parts list with every piece's dimensions, and the design decisions

## Why a new joint

Before this page, the window end of the tunnel was not joined to anything. The tunnel page described a foam strip "pressed
between the first flange and the wall", and a first flange on its own support. Two things were wrong with that:

- **The strip had nothing to press against.** The flange (44 × 44 cm by default) stands entirely in front of the open recess
  (100 × 100 cm). The insert's port face is 28 mm inside the recess, behind the wall face, so there is no wall round the
  flange.
- **Nothing located or held the tunnel against the port.** The gap and the seal depended on where the two sides happened to
  end up.

## Interfaces (fixed)

Neither side is redesigned. Both are read as their own pages set them (or from their defaults):

- **Window insert.** The modular insert's cat port: 40 × 40 jambs and transom, with the infill mesh on their outdoor face at
  `yOut + 2` (Y = −28 mm by default) and, unless the mesh is fixed with staples only, 15 mm cover battens over that
  (Y = −13). The threshold ends at the wall face (Y = 0), and the port's floor is the threshold's top.
- **Tunnel.** The first section's flange ring is 30 × 70 round the clear opening, with its back 10 mm off the wall face. It
  sits on the tunnel's wall support (a bearer under the flange, on levelling feet). The clear size and floor are the port's.

## Parameters

| Parameter | Default | Options | Group |
| --- | --- | --- | --- |
| Latches | Printed toggle latch | Printed toggle latch (the `toggle-latch` model); Ganter GN 831 (steel) | Latches |
| Latch | With safety catch (S) | S; plain lever (A); with padlock eye (SV); GN 831 only | Latches |
| Material | Stainless steel | Stainless steel (NI); steel, zinc plated (ST); GN 831 only | Latches |
| Latches per side | 1 (2 in all) | 1, 2 | Latches |
| Floor gap | EPDM lip over it | EPDM lip; left open | Seal |

With the defaults (a 30 × 30 cm cat port, set on the catio concept page), the docking frame is 44 × 37 cm outside and 35
mm deep. Ten 5 × 60 screws fix it to the port frame. Two printed toggle latches close the 3 mm gap. A 1.04 m E-profile
seal and a 296 × 65 mm lip close the joint. With **Latches: Ganter GN 831**, the frame is 32 mm deep and the gap 6 mm. The
two GN 831-100-S-NI-2 latches each hold 1000 N, and their hooks take up ±4 mm of the gap.

### The printed toggle latch

**Latches: Printed toggle latch**, the default, puts the library's [toggle latch](../../toggle-latch.md) on the joint. Its base plate goes
on the flange's outer side and its catch plate on the docking frame's, lever and link snapped on. The coupling places it with the
latch's shared mechanism (`packages/contracts/src/toggleLatchMechanism.ts`), the same one its model page and card use.

- **Locked spacing:** locked, the plates stand 1.31 mm apart (its over-centre lock). It has no adjustable hook and is short
  (25.3 mm over both plates), so a 6 mm gap would leave its screws next to the timber's edges.
- **Gap and seal:** the docking frame comes to 3 mm of the flange, 3 mm deeper (35 mm) than with GN 831 latches. A
  self-adhesive EPDM E-profile (9 × 4, made for 2–3.5 mm gaps) takes the place of the GN 831's D-profile. The frame screws
  then reach 23 mm into the jambs (26 mm with GN 831 latches).
- **Plates and screws:** each plate stands 0.84 mm proud of its face into the gap. Its two DIN 7997 4 × 25 screws (the
  model's default) sit 5.1 mm in from the frame's face and the flange's back: pre-drill them.
- **Draw:** hooked on with the joint up to about 1.7 mm further open, the lever draws it in.
- **Limits:** it has no safety catch or padlock eye, and its holding force is not rated. Choose the GN 831 for a joint
  that must hold a rated load, or must be locked.
- **Parts list:** the latch line links to the model (`#/models/toggle-latch`), not the parts library.
- **Shared:** its sizes, placement and screws (`PRINTED_LATCH`, `printedLatchScrews` in
  [catioPrintedLatch.ts](../../../apps/web/src/catioPrintedLatch.ts)) and its drawing (`buildPrintedLatches`) are the same
  code the [tunnel–tunnel coupling](tunnel-tunnel-coupling.md) uses between sections.
- **Live assembly:**
  - Its four parts are built from their real profiles.
  - Stage 2 screws the catch plates on and stage 3 the base plates, with the lever and link on them.
  - Stage 5 closes each lever over centre with the mechanism.
  - **Released** turns the lever back over centre and swings the link off the hook.
  - Its catch stays where the lock holds it: near the dead centre, the 0.32 mm over-centre draw squashes the seal instead.

## The pieces and how they fit

All of it is in [catioCoupling.ts](../../../apps/web/src/catioCoupling.ts) (`couplingLayout`). It is the one source for
the scene, the parts list and the tests.

1. **Docking frame (on the insert).** Two stiles stand on the threshold, over the port jambs. A head lies across them, on
   the transom.
   - **Section:** 35 × 70 (32 × 70 with GN 831 latches). 70 is the flange's width, so the frame's outline above the floor
     is the flange's. 35 is the depth from the mesh face to 3 mm short of the flange (6 mm with GN 831 latches).
   - **Rebate:** where a cover batten lies under it, the frame's back is rebated 15 × 40 over the batten. Whether there are
     battens is the window insert's **Mesh to timber** setting, changed on that page. The coupling page's brief states it
     (**Cover battens at the port**, "Set on the window insert page: Mesh to timber"). With staples only, the frame sits flat
     on the mesh, unrebated.
   - **Fixing:** DIN 7997 5 × 60 screws from its face, every 15 cm or less. Each reaches 23 mm into the jamb or transom
     (26 mm with GN 831 latches), whichever mesh fixing the insert has. The insert's batten screws and staples lie on the same centre lines. With the
     defaults, one batten screw sat exactly where the middle stile screw went. So each frame screw is moved to the nearest
     spot at least 12 mm from all of them (`clearOf`), and the page reports a clash if none is found (`fastenerClashes`).
     The window insert's **Fixing spacing** therefore moves these screws too.
   - **No sill.** Its inner faces are the port's edges, so the cat's clear size is unchanged.
   - It stays on the insert, also when the insert is lifted out.
2. **Seal.** A self-adhesive EPDM E-profile, 9 × 4 mm, runs along the middle of the frame's face: down both stiles and
   across the head. It is squashed to the **3 mm gap** between the frame and the flange. With GN 831 latches it is a hollow
   EPDM D-profile, about 12 × 10 mm, in a 6 mm gap.
3. **Floor lip.** A 3 mm EPDM sheet is screwed to the first flange's sill (three 4 × 25 screws). It reaches 25 mm past the
   flange's back and lies on the threshold over the 10 mm floor gap.
4. **Toggle latches.** The printed toggle latch by default (above). Or Ganter GN 831, size 100, **short type**
   (identification no. 2):
   - **Body:** on the first flange's outer side, its pivot end 2 mm in from the flange's face.
   - **Catch bracket:** on the docking frame's outer side, in line with it, where the hook falls when set to the middle of
     its adjustable range.
   - **Height:** one each side at half height, or two each side at 20% and 80%.
   - **Fixing:** two DIN 7997 4 × 25 screws in each body and each catch.

**Checks.** The page checks that:

- the latch body fits on the flange
- the catch bracket fits on the docking frame's side (the joint is 68 mm deep, from the flange's face to the frame's back)
- the frame fits between the collar stiles and under the collar's head rail

## Design decisions (defaults to redirect)

1. **Toggle latches, not bolts.** *Open call: the mechanism.* The printed toggle latch by default; Ganter GN 831
   selectable.
   - **Why:** docking and undocking are one movement per lever, without tools, and nothing loose can be lost. The printed
     latch is cheap and to hand, but has a fixed spacing and no rated hold. A GN 831 holds 1000 N and draws 5.5 mm as it
     closes. Its hook can be set over 8 mm (12 mm for types A and SV), which takes up
     how far the two sides end up from the design gap.
   - **Rejected:**
     - M8 bolts like the section couplings: a spanner and six nuts every time.
     - Wing nuts or star knobs on studs: many turns, loose parts, and not in the library.
     - Drop pins through lugs: loose pins, and slack.
     - A sleeve or spigot into the port: it narrows the cat's passage, or rests on the threshold so the insert would carry
       the tunnel.
     - Magnets: a cat can push them apart.
2. **The insert carries nothing.**
   - **Load path:** the tunnel's wall support carries the first flange, as before. The joint touches the insert only through
     the soft seal and the latches, which pull along the tunnel. The docking frame has no sill, and only the rubber lip
     lies on the threshold.
   - **No locating pins or spigot.** They would hand the tunnel's weight to the insert as soon as the support settled. The
     support's levelling feet set the height. If a latch has to lift or push the flange to close, re-level the wall
     support, not the latch.
3. **A docking frame on the insert.** The port face is 28 mm inside the recess and broken up by battens. The frame brings a
   flat face to the joint, with the flange's outline, and gives the catches a side in line with the flange's side.
4. **A squashed seal and a floor lip.** A hollow profile squashes with little force, so the latches need not pull hard and
   the insert is not dragged out of its recess. The lip closes the floor gap to claws and draughts, and bends out of the
   way when the joint opens.
5. **With GN 831 latches, the short type.** The long type is 67 mm closed (74 mm for type S) before its hook is set at all, so its catch
   bracket would hang off the back of the frame. The short type is 54 mm closed (61 mm for S), so it fits with its hook at
   mid-range. The page checks this.

## Assembly

1. **Docking frame onto the insert.**
   - From outdoors, offer the stiles to the port jambs, rebates over the battens, then lay the head across them.
   - Screw the frame on with 5 × 60 screws.
2. **Seal and catch brackets.**
   - Stick the seal round the frame's face.
   - Screw the catch plates of the printed latches (or GN 831 catch brackets) onto the stiles' outer sides.
3. **Latches on the first section.** Where it was framed (the tunnel page, stages 3–4):
   - Screw the latches' base plates, lever and link snapped on (or GN 831 bodies), onto the first flange's outer sides.
   - Screw the floor lip onto its sill.
4. **Lay the first section.**
   - Lower it onto its wall support, square to the port. Its flange stands 3 mm off the frame (6 mm with GN 831 latches)
     and squashes the seal, and
     the lip lies on the threshold.
   - Fix it down and couple the rest of the tunnel as the tunnel page describes.
5. **Dock.** Hook each latch over its catch and press the lever down over centre. With GN 831 latches, type S's safety
   catch clicks over the lever; type SV takes a padlock. Then open the cat gate.

**To undock:** lift the levers and unhook them. The insert can come out of its recess and the tunnel stays on its supports.
No tools either way.

The scene shows stages 1–2 at the window. In stage 3 the first section arrives raised (it was framed on the tunnel page) to
take its latches and lip. Stage 4 lowers it onto its support, and stage 5 closes the levers. Screws come in point first along
their own axis. The exploded view freezes every piece on its way in, with the levers open.

## Parts library additions

New family **toggle latches** (`toggle-latch`), with
[Ganter GN 831](https://www.ganternorm.com/en/products/2.4-Tensioning-with-clamping-mechanisms/Toggle-latches/GN-831-Toggle-latches-Steel-Stainless-Steel)
size 100: types A, S and SV, steel (ST) and stainless (NI), long (1) and short (2). That is 12 parts in
[toggle-latches.ts](../../../packages/contracts/src/parts/toggle-latches.ts).

- **Source:** every value was read from Ganter's product-page table (accessed 2026-10-02): F_H 1000 N, b1–b4, d, h1–h4,
  l1–l5, m1–m4, r, w1 and w2. Its drawing was used to map the columns.
- **Least lengths:** Ganter gives l1/l5 and l2/l4 as least values, so they are stored as nominal values, with the hook's
  range in w2.
- **Preview:** a procedural preview (`partGeometry.ts`) and a lock icon.

Existing parts: DIN 7997 5 × 60 and 4 × 25. All are listed by role in
[concepts.ts](../../../packages/contracts/src/concepts.ts) (`COUPLING_HARDWARE`, `couplingLatch`,
`insertTunnelCouplingConcept`), so the library lists the page under each part's “Used by”.

Custom lines (not library parts): the docking frame's timber, the seal and the lip. The seal and lip have no published
part behind them. Their sizes are this design's, not a product's.

## Implementation

- [Coupling design: parameters, layout, latch fit, parts list, steps, decisions](../../../apps/web/src/catioCoupling.ts)
- [Coupling scene](../../../apps/web/src/catioCouplingScene.ts), with the window, the insert and the tunnel's wall support
  as fixed context
- [Tests](../../../apps/web/src/catioCoupling.test.ts) check:
  - the frame sits on the insert's own faces (battens or mesh, for every mesh fixing), keeps the port's clear size and has
    the flange's outline
  - the frame screws' 23 mm bite (26 mm with GN 831 latches)
  - the brief names whether the insert has cover battens and that the window insert page sets it
  - no frame screw within 12 mm of a batten screw or staple, for every window insert setting and mesh fixing
  - the design decisions quote the sizes the layout uses
  - the load path: the wall support's bearer under the flange, a real gap filled only by the seal, and the lip lying on the
    threshold
  - every latch body and catch on its face, with the hook at mid-range, and the long type not fitting
  - the printed latch: its plates at its lock's spacing, as far into the 3 mm gap each, screws 5 mm or more inside the
    timber, the parts list linking its model, and in the scene the lever on the base's pins and the link on the lever's
    while it opens and closes
  - the error messages
  - parts-list counts and the parts-library cross-links, and that the tunnel no longer lists a foam strip
  - staging, the lowering, the levers closing and opening outwards, fastener directions, and restoring saved settings

  Browser coverage is in [catio.spec.ts](../../../tests/browser/catio.spec.ts).
- **Changes to the other pages:** the tunnel page drops its foam strip from the parts list and the scene, and its last step
  and design note now point here. The sub-assembly contract gains `follows` (the pages a page fits, linked from its brief)
  and `defaultViewing`.

This is a concept: the seal's and the lip's sizes are illustrative and the latch loads are the maker's. Check the as-built
gap before fixing the catch brackets.
