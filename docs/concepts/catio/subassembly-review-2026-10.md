# Catio sub-assemblies: consistency review (2026-10-03)

A review of the window insert, tunnel and insert–tunnel coupling pages for settings that do not reach, or are not shown on,
the pages that depend on them, for geometry that clashes or repeats across page boundaries, and for missing context.
These are findings only. None is fixed yet; the owner picks what to fix next.

Fixed on this branch before the review: the modular insert's mesh "throat" from the port to the wall face, which repeated
the coupling's docking frame (A), and the coupling page now states whether the insert has cover battens and which window
insert setting decides that (B).

Line numbers are on this branch.

## Geometry that clashes across pages

1. **The docking-frame screws land on the insert's batten screws.** *High.*
   `catioCoupling.ts:122-127` puts the 5 × 60 frame screws on the jamb's centre line (x = ±(w/2 + 20)) and on the
   transom's centre line. `catioWindowInsert.ts:200-208` puts the 4 × 35 cover-batten screws on the same centre lines.
   With the defaults (battens, 15 cm pitch), the middle frame screw on each stile is at **0 mm** from a batten screw
   (z = 396), and the stile's other screws are 10 mm away. Pitches 10 and 20 cm also give 10–11 mm near-misses on the
   head. In the real build, a 5 mm screw goes into the hole of an existing 4 mm screw, or splits a 40 mm jamb with two
   screws 10 mm apart. Neither page checks this. The coupling test "26 mm bite whatever the mesh fixing" only checks depth.
   Possible fixes: put the frame screws off the centre line, or between the batten screws. Or let the frame's screws do the
   batten screws' job where the frame covers a batten, and drop those batten screws from the insert's list when a tunnel
   is fitted.

2. **The tunnel page draws no docking frame, seal or latches at the window end.** *Medium.*
   `catioTunnelScene.ts:110-112` draws the insert as timber only: no mesh, no docking frame. The tunnel's last step
   (`catioTunnel.ts:511`) says to close the latches onto the docking frame, but its scene shows a flange standing 10 mm
   off a bare port frame, joined to nothing. The coupling page draws the tunnel's first section (`catioCouplingScene.ts:148`),
   so the context only goes one way. At least the docking frame (and the insert mesh) should be drawn as context.

3. **The whole-catio modular scene still draws a window throat.** *Low.*
   `catioModularScene.ts:97-100` draws `window-throat-±1` and `window-throat-roof` mesh in front of the window collar.
   That is the schematic version of what (A) just removed from the insert page. The scene does not use the sub-assembly
   layouts yet (window-insert.md, decision 3, keeps the 98 cm collar as a known follow-up), but the throat now contradicts
   the insert and coupling pages.

## Settings that do not show where they act

4. **The window port's floor height is used by the tunnel but shown nowhere.** *Medium.*
   The insert's floor (`windowInsertLayout().floor`) moves with the insert's clamp settings: 229 mm with folding wedges,
   241.5 / 245.5 / 248.5 mm with 25 / 32 / 40 mm feet. The tunnel's start height (`tunnelSite().floorZ`,
   `catioTunnel.ts:86`) and the coupling's frame both follow it. But:
   - `windowInsertFacts` (`catioWindowInsert.ts:341-350`) does not list it;
   - `tunnelFacts` (`catioTunnel.ts:608-619`) gives "Rise · floor to floor" but neither floor;
   - the insert's **Held in the recess by** and **Foot diameter** help texts (`catioWindowInsert.ts:377-382`) do not say
     that they move the tunnel's start.

   The tunnel page should show "Window port floor · from the window insert", as (B) does for battens. The insert page
   should show the floor, and say that the tunnel and coupling follow it.

5. **A level tunnel preset goes silently sloped when the insert changes.** *Medium.*
   `TUNNEL_PRESETS` (`catioTunnel.ts:679-682`) copy `tunnelSite().floorZ` into `portHeight` once, when clicked. Change the
   insert afterwards (e.g. to folding wedges) and the window floor drops 16.5 mm. The saved "Straight" tunnel then gets a
   **4.19° bend up and a 4.19° bend down** with a 15 cm ramp, and no error. The preset button also stops showing as active,
   because `preset.config()` is recomputed with the new floor. Nothing tells the user why their straight tunnel now has two
   bends. Possible fixes: store "level with the window" as a mode, or warn when the rise is a few mm.

6. **The window insert page never mentions the pages that depend on it.** *Medium.*
   `CatioSubassemblyPage.tsx:120` writes "It fits the … as set on its page" for every page except the window insert. The
   insert page has no link to the coupling or the tunnel. Its last step says "Keep the gate shut until a tunnel is coupled"
   (`catioWindowInsert.ts:284`) without naming the coupling page. **Mesh to timber**, **Held in the recess by** and
   **Foot diameter** all change the coupling or the tunnel, and none of their help texts say so. This is the reverse
   direction of (B). A "used by" line in the brief, built from the other definitions' `follows`, would cover it generically.

7. **Cross-page validity is only checked on the dependent page.** *Medium.*
   The coupling's errors (`catioCoupling.ts:97-98`) appear only on the coupling page: the docking frame is wider than the
   collar opening, or its head stands above the collar head. So do the tunnel's errors (e.g. "too close to the ground"
   after a floor change). A tunnel clear size on the catio concept page, or an insert setting, can be valid on its own page
   and break the coupling with no warning where it was changed. `validateWindowInsert` (`catioWindowInsert.ts:252-253`)
   checks the gate's travel but not the docking frame's head (transomZ + 70 ≤ collar head − 40).

8. **Who owns the docking frame is not clear.** *Low.*
   The coupling says the frame "stays on the insert from now on, also when it is lifted out" (`catioCoupling.ts:160`, and
   its decision), but the insert page's scene, parts list and steps never show it. Someone building from the insert page
   alone doesn't learn that the insert gets a permanent 32 mm frame on its face. One sentence in the insert's modular
   decision 6 ("The modular cat port") and a link would fix it. The parts correctly stay on the coupling's list.

## Viewing and wording

9. **The coupling's Top view mostly shows the top of the wall.** *Low.*
   `couplingViews` Top (`catioCoupling.ts:234`) looks straight down at the joint, but `selectView`
   (`CatioSubassemblyPage.tsx:83`) only turns on the wall cutaway for Interior and Mounting. The docking frame lies in the
   recess (Y −28…4), so the wall hides it, and the view shows the flange and the wall top. Side ("Side · the joint") has the
   same problem for the part of the frame inside the recess. Per-definition cutaway defaults per view would fix both.

10. **The mesh-fixing help text described geometry that no longer exists everywhere.** *Low, fixed in (A).*
    "Where mesh meets the threshold edge it is always stapled" was true only of the direct sleeve once the throat was
    gone. The text now says so. Noted here because the coupling's floor lip help (`catioCoupling.ts:247`, "a 10 mm gap")
    and its decisions ("44 × 37", "68 mm deep", "32 × 70") are similar fixed numbers. They hold for the defaults and the
    fixed sizes. But "44 × 37 cm" in window-insert-tunnel-coupling.md changes with the tunnel clear size set on the catio
    concept page.

## Checked and fine

- Route remounts: `App.tsx:580` keys `CatioSubassemblyRoute` by sub-assembly, so switching pages reloads each page's own
  settings and re-reads the others' from storage.
- The coupling's latch catch sits on the frame's outer, unrebated part, at mesh depth, for every mesh fixing. The frame
  screws' 26 mm bite holds for every fixing.
- The threshold still ends at the wall face (Y = 0) and carries the docking frame's stiles. The floor lip's 25 mm overlap
  lands on it.
- Transom-end and jamb screws (`catioWindowInsert.ts:171-174`) are clear of the frame screws. Only the batten screws clash
  (finding 1).
