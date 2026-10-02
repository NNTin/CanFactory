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
| Clamps per side | 2 (8 in all) | 2; 3 | Both |
| Foot diameter | 32 mm | 25, 32, 40 mm | Spreader feet |

The direct variant uses the original fixed window (100 × 100 cm recess, 91 cm sash). With tunnel follows the window and
tunnel clear size saved on the catio concept page (recess = sash + 9 cm, as the modular scene assumes).

## Design decisions (defaults to redirect)

1. **Held by pressure, not fixings.** Rubber-padded swivelling levelling feet, Ganter GN 343.2 type KR, are turned out of
   DIN 7965 M8 insert nuts in the collar. The feet on the stiles and head press on the recess reveals; the feet under the
   sill rail stand on the recess floor (exterior sill) and carry the weight. Each spreader stud is long enough
   (63 mm) to pass the 40 mm member, 8 mm of travel and two jammed ISO 4032 M8 nuts on its inner end, so it is turned with
   a 13 mm spanner **from inside, through the open window**, as the original concept intended. The 15° swivel and TPE pads
   (about 78 Shore A) follow an uneven render. Releasing the studs frees the insert.
   - Alternative kept as an option: **folding timber wedges** (pairs, 150 × 40, 14 mm to 0, driven 2 mm proud), cheaper,
     but driven and loosened from outside, and they can creep loose with seasonal timber movement.
   - Rejected: a bar or strap across the inside of the window frame (the sash could not close), adhesive or suction mounts
     (unreliable outdoors), and fixing to the window frame (drilling, and the frame is not designed for the load).
2. **Clamps on all four sides, in opposed pairs.** Left–right and head–sill pairs cancel each other's force inside the
   collar, so the insert is squeezed in place rather than pushed out. Weight goes straight down through the sill feet.
3. **Collar size follows the clamp.** The gap round the collar is the foot's height with its cap (l3) plus 8 mm of travel:
   32.5 mm for the 32 mm foot, so the collar is 93.5 × 93.5 cm in the 100 cm recess. The original concept drew a 98 cm
   collar with 10 mm clearance, too little for any real clamp. **The whole-catio scenes still draw their schematic 98 cm
   collar**; adopting this sizing there is a follow-up.
4. **Half-lapped collar corners.** The spreaders push the corners apart; a glued half-lap (30 mm, half the 60 mm depth)
   with two DIN 7997 4 × 50 screws carries that on long grain and timber shoulders. A butt joint (two DIN 7997 5 × 70 screws
   through the stile into the rail's end grain) remains selectable.
5. **Mesh clamped under battens.** DIN 1159 2.5 × 25 staples locate the tensioned mesh every 15 cm; 40 × 15 cover battens,
   screwed through the mesh with DIN 7997 4 × 35 screws, clamp the whole edge and cover the cut wire ends. Where mesh meets
   a threshold edge there is no face for a batten, so it is stapled in every option.
6. **The modular cat port.** A full-width transom over the port and two jambs give every infill mesh panel timber on all
   four edges. They sit in 10 mm housings (or butt joints), the jambs screwed from under the sill rail with DIN 7997 6 × 90.
   The sliding gate runs in tracks on the room side of the port.

## Assembly

1. **Join the collar** on a bench outside: half-laps glued and screwed (or butt joints screwed); check the diagonals.
2. **Fit the clamp hardware**: insert nuts, then short-stud bearing feet under the sill rail and long-stud spreaders with
   their jammed nuts in the stiles and head (or prepare the wedges).
3. **Threshold and mesh**: threshold on the sill rail; the passage sleeve (direct) or transom, jambs, infill and throat mesh
   (with tunnel); staples and battens.
4. **Set it into the recess** from the garden, standing on the bearing feet, clear of the closed sash.
5. **Tighten from inside** in opposite pairs until the pads bear (or drive the wedges).
6. **Docking brackets** (direct) or **gate tracks, gate and latch** (with tunnel); open and close the window to check.

## Parts library additions

All with the source of every value (see [adding-parts.md](../../adding-parts.md)):

| Family | Parts | Source |
| --- | --- | --- |
| Wood screws (`wood-screw`) | DIN 7997 countersunk cross-recess, d 3–6 mm, trade lengths | fasteners.eu DIN 7997 table |
| Nails and staples (`nail`) | DIN 1159 staples 2.5 × 25, 3.1 × 31, 3.4 × 34, 3.8 × 38 | Keller & Kalmbach DIN 1159 sizes |
| Insert nuts for wood (`insert-nut`) | DIN 7965 M6 × 15, M8 × 18, M10 × 25 | fasteners.eu DIN 7965 table |
| Levelling feet and pressure pads (`levelling-foot`) | Ganter GN 343.2 KR, d1 25/32/40, M8/M10, all listed studs | Ganter's table, drawing and specification |

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
