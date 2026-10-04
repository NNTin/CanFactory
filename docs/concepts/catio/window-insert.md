# Window insert

The window insert is the removable timber collar that sits in the exterior window recess. It carries the cat's way out
(the open passage of the original design, or the small gated cat port of the modular design) and is held in the recess
**by pressure alone: nothing is drilled into the wall or the window**.

Live page: `#/concepts/catio/window-insert`, also linked from the catio concept page under **Sub-assemblies**. For local
development, `npm run dev --workspace @canfactory/web -- --port 5181`, then
<http://127.0.0.1:5181/#/concepts/catio/window-insert>. It needs no API.

The page shows both variants (**Direct · original design** and **Modular · with tunnel**), the insert's individual pieces,
a six-stage assembly with exploded view, the **Window open** and **Wall cutaway** toggles (same meaning as the whole catio),
a parts list with every piece's dimensions, and the design decisions below. Choices and viewing state persist per browser.

## Parameters

| Parameter | Default | Options | Applies to |
| --- | --- | --- | --- |
| Collar corners | Half-lap, glued + 2 screws | Half-lap; butt joint + 2 screws | Both |
| Port transom & jambs | Housed 10 mm + screw | Housed; butt joint + screws | With tunnel |
| Mesh to timber | Staples under cover battens | Staples + battens; staples only; battens only | Both |
| Fixing spacing | 15 cm | 10, 15, 20 cm | Both |
| Held in the recess by | Padded spreader feet | Spreader feet; folding timber wedges | Both |
| Spreader feet | Printed pads on M8 screws | Printed pads; Ganter GN 343.2 levelling feet | Spreader feet |
| Pad height | 24.5 mm | 18 to 40 mm, in 0.5 mm steps | Printed pads |
| Pad sole | Grooved | Flat; grooved; domed | Printed pads |
| Clamps per side | 2 (8 in all) | 2; 3 | Both |
| Foot diameter | 32 mm | 25, 32, 40 mm | Spreader feet (the pads' or the Ganter feet's) |

The direct variant uses the original fixed window (100 × 100 cm recess, 91 cm sash). With tunnel follows the window and
tunnel clear size saved on the catio concept page (recess = sash + 9 cm, as the modular scene assumes). How a tunnel docks to the
cat port (a docking frame on the port, a seal and toggle latches) is on the
[insert–tunnel coupling](window-insert-tunnel-coupling.md) page.

The tunnel and the coupling are fitted to this page, and the brief says so. **Held in the recess by**, **Spreader feet**,
**Pad height** and **Foot diameter** set the clamp gap, and with it the cat port's floor (24.6 cm above the grass by default, shown in the brief). The tunnel
starts from that floor, and the coupling's frame stands on it. **Mesh to timber** and **Fixing spacing** decide the
coupling frame's rebate and where its screws go. Each of these controls says what else it changes. If the current
settings break the tunnel or the coupling as they are saved, their errors are listed here, linked to their pages (see
[How the sub-assembly pages fit each other](README.md#how-the-sub-assembly-pages-fit-each-other)).

## Design decisions (defaults to redirect)

1. **Held by pressure, not fixings.** Spreaders are turned out of DIN 7965 M8 insert nuts in the collar: by default printed
   pads on library screws (see 2), or Ganter GN 343.2 type KR levelling feet. Those on the stiles and head press on the
   recess reveals; those under the sill rail stand on the recess floor (exterior sill) and carry the weight. Each spreader
   is turned with a 13 mm spanner **from inside, through the open window**, as the original concept intended. Releasing
   them frees the insert.
   - With Ganter feet, each spreader stud is long enough (63 mm) to pass the 40 mm member, 8 mm of travel and two jammed
     ISO 4032 M8 nuts on its inner end. The 15° swivel and TPE pads (about 78 Shore A) follow an uneven render.
   - Alternative kept as an option: **folding timber wedges** (pairs, 150 × 40, 14 mm to 0, driven 2 mm proud), cheaper,
     but driven and loosened from outside, and they can creep loose with seasonal timber movement.
   - Rejected: a bar or strap across the inside of the window frame (the sash could not close), adhesive or suction mounts
     (unreliable outdoors), and fixing to the window frame (drilling, and the frame is not designed for the load).
2. **Printed pads on library screws.** By default, each spreader is an ISO 4017 M8 × 80 hexagon head screw, turned from
   inside through the insert nut and locked by an ISO 4032 nut on the collar's inner face. An ISO 10511 lock nut on its tip
   turns freely in a printed thrust pad, the [pressure-pad](../../pressure-pad.md) model, in PETG.
   - Under the sill rail, an ISO 4017 M8 × 30's head sits in a printed foot, which is turned by hand.
   - Screws and nuts are cheap and to hand; bought levelling feet are not. The screw's own head is the drive, so one nut
     locks it instead of two jammed on a stud.
   - The thrust pad does not turn with the screw, so it does not scrub the render, just as the Ganter foot's ball swivel
     does not.
   - A printed pad does not swivel. **Pad sole** chooses grooves that bite into render and drain, a flat sole, or a dome
     that follows a reveal that is not square to the screw.
   - PETG creeps under a constant load in summer sun, so check the clamps again after the first warm season.
   - The screws' lengths follow from the layout (`windowInsertPadScrews`). The spreader passes the thrust pad's lip and
     nut (11 mm), the 8 mm travel, the 40 mm member, the 6.8 mm lock nut and 1 mm of play: 66.8 mm, so M8 × 80. The
     bearing screw passes the lip, the travel and the 18 mm insert nut: 29 mm, so M8 × 30.
   - **Ganter GN 343.2 levelling feet** remain selectable as **Spreader feet**: the long-stud spreaders with two jammed
     nuts and the short-stud bearing feet described in 1.
3. **Clamps on all four sides, in opposed pairs.** Left–right and head–sill pairs cancel each other's force inside the
   collar, so the insert is squeezed in place rather than pushed out. Weight goes straight down through the sill feet.
4. **Collar size follows the clamp.** The gap round the collar is the printed pad's height (or the Ganter foot's height with
   its cap, l3) plus 8 mm of travel. That is 32.5 mm for the default 24.5 mm pad, the same as for the 32 mm Ganter foot, so
   the collar is 93.5 × 93.5 cm in the 100 cm recess. The original concept drew a 98 cm
   collar with 10 mm clearance, too little for any real clamp. **The whole-catio scenes still draw their schematic 98 cm
   collar**; adopting this sizing there is a follow-up.
5. **Half-lapped collar corners.** The spreaders push the corners apart; a glued half-lap (30 mm, half the 60 mm depth)
   with two DIN 7997 4 × 50 screws carries that on long grain and timber shoulders. A butt joint (two DIN 7997 5 × 70 screws
   through the stile into the rail's end grain) remains selectable.
6. **Mesh clamped under battens.** DIN 1159 2.5 × 25 staples locate the tensioned mesh every 15 cm; 40 × 15 cover battens,
   screwed through the mesh with DIN 7997 4 × 35 screws, clamp the whole edge and cover the cut wire ends. Where the direct
   variant's passage sleeve meets a threshold edge there is no face for a batten, so it is stapled in every option; the
   modular insert's mesh lies only on faces, so "battens only" needs no staples there.
7. **The modular cat port.** A full-width transom over the port and two jambs give every infill mesh panel timber on all
   four edges. They sit in 10 mm housings (or butt joints), the jambs screwed from under the sill rail with DIN 7997 6 × 90.
   The sliding gate runs in tracks on the room side of the port.
8. **The cat port ends at its frame.** Nothing of the insert continues the port out to the wall face. The
   [insert–tunnel coupling](window-insert-tunnel-coupling.md) screws a docking frame onto the jambs and transom, which
   carries the passage on to the tunnel. The frame **stays on the insert from then on**, also when it is lifted out. Its
   parts are on the coupling's parts list. Its screws are placed between this page's batten screws and staples, so
   **Mesh to timber** and **Fixing spacing** change it. An earlier mesh "throat" from the port to the wall face was
   dropped, as it duplicated (and clashed with) that frame.

## Assembly

1. **Join the collar** on a bench outside: half-laps glued and screwed (or butt joints screwed); check the diagonals.
2. **Fit the clamp hardware**: insert nuts. Then, with printed pads, a foot on an M8 × 30 under the sill rail, and in the
   stiles and head an M8 × 80 with its lock nut from inside, its tip's lock nut and the thrust pad slid on from outside. With
   Ganter feet, short-stud bearing feet under the sill rail and long-stud spreaders with their jammed nuts. Or prepare the
   wedges.
3. **Threshold and mesh**: threshold on the sill rail; the passage sleeve (direct) or transom, jambs and infill mesh
   (with tunnel); staples and battens.
4. **Set it into the recess** from the garden, standing on the bearing feet, clear of the closed sash.
5. **Tighten from inside** in opposite pairs until the pads bear, then run the lock nuts up to the collar (or drive the
   wedges).
6. **Docking brackets** (direct) or **gate tracks, gate and latch** (with tunnel); open and close the window to check.

### How the animation shows it

Every piece moves along the direction it is really fitted, in the order above. Pieces of one kind move together (all
corner screws at once, then all insert nuts, and so on), each along its own axis; a caption under the stage names the
group and how it goes in ("Now: 8 × Countersunk wood screw 4 × 50: driven from the outdoor face"):

- Half-laps close across the timber's depth: the rails come from the room side (laps facing outdoors), the stiles from
  outdoors onto them. Butt joints: the stiles stand first, then the rails slide in between them from outdoors.
- Every screw and staple comes in along its own driving axis, point first, and screws turn as they go: corner screws from
  the outdoor face (half-lap) or through the stiles (butt), threshold screws down from above, port jamb screws up from
  under the sill rail, batten screws from the outdoor face.
- At each clamp, the insert nut is screwed into the collar's outer face first.
  - Printed pads: under the sill rail, the foot and its screw are screwed up into it. In the stiles and head, the screw
    (with its lock nut) comes through the member from inside, the lock nut is run onto its tip from outside, and the thrust
    pad slides on sideways without turning.
  - Ganter feet: the foot's stud goes through it from outside; on a spreader, the foot's own nut and then a second nut are
    run onto the stud's inner end from inside.
- Stage 5 turns each spreader screw or stud so the pad or foot moves out to the reveal. A printed thrust pad moves out
  without turning. Wedges are driven along the member instead.
- With tunnel, the gate tracks come from the room side and the gate is lowered into them from above.

Stages 1–3 happen on a bench in the garden, and the cameras follow the insert there. The exploded view is the same
assembly frozen: each piece waits on its own way in, with the insert on the bench, clear of the wall.

## Parts library additions

All with the source of every value (see [adding-parts.md](../../adding-parts.md)):

| Family | Parts | Source |
| --- | --- | --- |
| Wood screws (`wood-screw`) | DIN 7997 countersunk cross-recess, d 3–6 mm, trade lengths | fasteners.eu DIN 7997 table |
| Nails and staples (`nail`) | DIN 1159 staples 2.5 × 25, 3.1 × 31, 3.4 × 34, 3.8 × 38 | Keller & Kalmbach DIN 1159 sizes |
| Insert nuts for wood (`insert-nut`) | DIN 7965 M6 × 15, M8 × 18, M10 × 25 | fasteners.eu DIN 7965 table |
| Levelling feet and pressure pads (`levelling-foot`) | Ganter GN 343.2 KR, d1 25/32/40, M8/M10, all listed studs | Ganter's table, drawing and specification |

The printed pads use parts already in the library: ISO 4017 M8 × 80 and M8 × 30, ISO 10511 M8 and ISO 4032 M8. The pads
themselves are the [pressure-pad](../../pressure-pad.md) model. The parts list links them there with their size, sole and
nut or screw.

The parts the insert can use (every option) are listed once in
[packages/contracts/src/concepts.ts](../../../packages/contracts/src/concepts.ts). The page's layout takes its hardware from
there, and the parts library lists the page under each part's “Used by” (`partUsage`, `kind: 'concept'`); a test keeps the
page's parts list and that list identical.

Known gaps, stated in each part's notes: DIN 1159 gives no width across the legs (the preview draws one for illustration
only); the DIN 7965 reference does not label its d5 column, read as the hole size (it lies between the wood thread's core
and outer diameter).

## Implementation

- [Sub-assembly contract, settings and parsing](../../../apps/web/src/catioSubassembly.ts) and the generic
  [page](../../../apps/web/src/CatioSubassemblyPage.tsx): a later tunnel or enclosure page is one more definition.
- [Window insert design: parameters, layout, parts list, steps, decisions](../../../apps/web/src/catioWindowInsert.ts)
- [Window insert scene](../../../apps/web/src/catioWindowInsertScene.ts) and the shared
  [window context](../../../apps/web/src/catioWindowContext.ts)
- [Tests](../../../apps/web/src/catioWindowInsert.test.ts): every option in both variants clears the 0–90° sash sweep and
  stays inside the recess; spreader pads reach the reveals only once tightened and the sill feet stand on the recess floor;
  the bench-to-recess staging; parts-list counts against the layout; settings restoration. Browser coverage is in
  [catio.spec.ts](../../../tests/browser/catio.spec.ts).

This is a concept: the recess, reveal material and sill are unmeasured, and clamp preload, friction and timber sizing are
not yet calculated. Measure the recess and check the reveal is sound masonry before relying on pressure fixing.
