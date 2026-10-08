# Window insert

The window insert is the removable timber collar that sits in the exterior window recess. It carries the cat's way out
(the open passage of the original design, or the small gated cat port of the modular design). **Nothing is drilled into the
wall or the window**: by default the insert hangs on the window's fixed frame like an insect screen (see
[Hung on the window frame](#hung-on-the-window-frame)), so the window still closes with the insert in place; it can instead be
pressed into the recess by spreader feet or folding wedges.

Live page: `#/concepts/catio/window-insert`, also linked from the catio concept page under **Sub-assemblies**. For local
development, `npm run dev --workspace @canfactory/web -- --port 5181`, then
<http://127.0.0.1:5181/#/concepts/catio/window-insert>. It needs no API.

The page shows both variants (**Direct · original design** and **Modular · with tunnel**), the insert's individual pieces,
a six-stage assembly with exploded view, the **Window open** and **Wall cutaway** toggles (same meaning as the whole catio),
a parts list with every piece's dimensions, and the design decisions below. Choices and viewing state persist per browser.

## Parameters

| Parameter | Default | Options | Applies to |
| --- | --- | --- | --- |
| Collar corners | Butt joint + 2 screws + flat corner bracket | Corner bracket; half-lap, glued + 2 screws; butt joint + 2 screws | Both |
| Corner bracket | Printed (model), 100 × 100 × 20 mm | Printed ([printed-corner-bracket](../../printed-corner-bracket.md)); GAH Alberts Stuhlwinkel 75, 90, 100, 125, 150 mm | Corner bracket (hung: up to 100 mm, clear of the hooks) |
| Port transom & jambs | Housed 10 mm + screw | Housed; butt joint + screws | With tunnel |
| Mesh to timber | Staples under cover battens | Staples + battens; staples only; battens only | Both |
| Fixing spacing | 15 cm | 10, 15, 20 cm | Both |
| Held in the recess by | Hooks on the window frame + feet | Hooks on the window frame + feet; spreader feet; folding timber wedges | Both |
| Screen hooks | Printed screen hooks (model) | Printed ([printed-screen-hook](../../printed-screen-hook.md), made for the window below); Windhager 03651, bent | Hooks on the window frame |
| Overlap on the frame | 15 mm | 10, 15, 20, 25 mm | Hooks on the window frame |
| Spreader feet | Printed pads on M8 screws | Printed pads; Ganter GN 343.2 levelling feet | Spreader feet, and the feet under a hung insert |
| Pad height | 24.5 mm | 18 to 40 mm, in 0.5 mm steps | Printed pads |
| Pad sole | Grooved | Flat; grooved; domed | Printed pads |
| Clamps per side | 2 (8 in all) | 2; 3 | Both (hung: the feet under the sill rail only) |
| Foot diameter | 32 mm | 25, 32, 40 mm | Spreader feet (the pads' or the Ganter feet's) |
| Frame width, from outside | 73 mm | 40 to 120 mm | The window (all options) |
| Frame lip thickness | 15.5 mm | 5 to 35 mm, in 0.5 mm steps | The window |
| Seal gap | 3.5 mm | 1 to 10 mm, in 0.5 mm steps | The window |
| Frame depth | 82 mm | 58 to 120 mm | The window (drawing only) |

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

## The window

The window is modelled as the tilt-and-turn (Dreh-Kipp) window it is ([catioWindow.ts](../../../apps/web/src/catioWindow.ts)),
not as a hole: a fixed frame (Blendrahmen) and an inward-opening sash that turns on its hinge side and tilts about its sill.
Seen from outside, the fixed frame's **outer lip** (Blendrahmenüberschlag) overlaps the closed sash; the sash's face lies behind
the lip across the gap its outer seal fills, and a 12 mm rebate gap (Falzluft) runs round the sash's edge behind the lip.

Its four values are set under **The window** and are used by every option (the hung insert depends on them). The defaults are
a VEKA Softline 82 MD window ([VEKA technical product information 07/2020, p. 22](https://architekten.veka.de/downloads/VEKA_BR_TECHNIK2020_210x297_DE_13_AUSZUG_VEKA-SOFTLINE-82-MD.pdf)):

| Value | Default | Basis |
| --- | --- | --- |
| Frame width, from outside | 73 mm | VEKA: dimensioned (71 mm at the sill; one value is used all round) |
| Frame depth | 82 mm | VEKA: dimensioned; the sash is drawn as deep |
| Frame lip thickness | 15.5 mm | Estimated: scaled from VEKA's section drawing (82 mm = its dimension line) |
| Seal gap, lip to closed sash | 3.5 mm | Estimated: scaled from the same drawing |

With these, the 1000 mm frame's lip leaves an 854 mm opening and covers the 910 mm sash by 28 mm a side (VEKA: 33 mm). The
page refuses a frame whose lip covers the sash by less than 10 mm. **Measure your own window**: open it and measure the frame's
outermost leg from its face to its seal (the lip), and the step from the frame's face to the closed sash's face (lip + seal gap).

## Hung on the window frame

**Held in the recess by → Hooks on the window frame + feet**, the default, hangs the insert the way insect screens (Spannrahmen) hang on
tilt-and-turn windows without drilling. Their hooks catch the **fixed frame's outer lip**, not the sash: Neher's catalogue
(Spannrahmen 04/2025, pp. 9–10) has its sprung stainless angles press “gegen den Blendrahmenüberschlag”, and its section
drawings show the angle's tip at the lip's end, beside the seal. The closed sash offers no edge of its own to hook: from outside,
its face runs flat from the frame's seal to the glass.

- **The collar lies on the frame's outer face**, overlapping it 15 mm beyond the lip's tips at the head and sides (Neher's
  screens overlap 14 mm and need at least 15 mm of frame at the sides). The rest of each 40 mm stile lies over the window
  opening. The collar is the lip's opening plus the overlap: 88.4 cm wide on the default window.
- **Four printed screen hooks** (**Screen hooks**, the default), the [printed-screen-hook](../../printed-screen-hook.md) model
  in PETG, two long and two short, are screwed to the stiles' backs with one DIN 7997 3 × 20 screw each (the model's default):
  the long ones at the head, their barbs up behind the head lip, the short ones at the sill, their barbs down behind the sill
  lip. Each is a 4 mm leg, a 4 mm turn into the window and a 2 mm barb, 10 mm wide. On its one screw, near the turn, a hook can
  be turned while it is fitted, set straight along the stile and then tightened, and swung aside later without unscrewing it
  (see [Screws and holes](../../printed-screen-hook.md#screws-and-holes)).
- **Made for the window, so it still closes.** The model is set to the window's **Frame lip thickness** and **Seal gap** (the
  parts list gives both): each turn reaches into the window just inside the lip's tip, and its barb stands in the middle of the
  seal gap, 0.75 mm clear of the lip's back and of the closed sash on the default window. Nothing is bent on site. The 2 mm barb
  needs a seal gap of 3 mm; in a narrower one the page says to choose the bought hooks. The seal is pressed locally at the four
  hooks, as with any hooked insect screen. With the tunnel, the cat gate's latch also stands 12 mm behind the collar's back, in
  front of the sash, and the page checks there is room for it.
- **Or bought hooks, bent** (**Screen hooks → Windhager 03651**): two long and two short stainless strips (in the parts
  library as `screen-hook`), screwed on with two DIN 7997 3 × 16 screws each, their 15 mm and 7 mm tips behind the lips. Each
  strip is bent so that its tip lies in the middle of the seal gap, 0.5 mm clear of the lip's back and of the closed sash (16 mm
  on the default window, to 0.5 mm). Windhager's own rule, the lip measured with the window open plus 3 mm, is for windows with
  room behind the lip; here the page bends to the window's real profile and refuses a seal gap too narrow for the 0.8 mm strip
  (it takes gaps down to about 2.5 mm).
- **The feet carry it.** The sill rail keeps its bearing feet (printed feet or levelling feet, as chosen), standing on the recess
  floor; the side and head spreaders are left out. The insert (about 10 kg of timber and mesh, estimated) never hangs on the
  frame's lip: once the feet stand, the short hooks clear the sill lip by 1 mm, and the hooks only keep it from tipping out.
  This keeps the earlier decision that the frame is not loaded.
- **Lift and drop.** To hang it, the insert is lifted by the short hooks' reach behind the lip plus 1 mm (7 mm with the printed
  hooks, 6.2 mm with the bought ones), the long hooks are slipped up behind the head lip, its foot is swung in against the frame,
  and it is let down: the short hooks drop behind the sill lip. The long hooks' turns stay 1 mm below the head lip's tip
  meanwhile, 8 mm (7.2 mm) below it once down, and their barbs reach 6 mm (7 mm) behind it. The printed long hook's barb is made
  longer by just that lift, so both printed hooks reach the same 6 mm behind their lips. The page checks the room above the
  collar for the lift.
- **Turning and tilting** move the sash's face into the room, away from the hooks; the tests turn the sash 0–90° and tilt it
  0–12° against every piece of the insert.
- **The collar lies 27.5 mm deeper** than when pressed into the recess, so the [insert–tunnel coupling](window-insert-tunnel-coupling.md)'s
  docking frame is that much thicker and takes DIN 7997 6 × 90 screws. The cat port's floor does not change: the same feet set it.
- **Everywhere the insert is drawn.** The tunnel and coupling pages draw the installed insert with its hooks and feet, and the
  whole catio's scenes (direct and modular) draw the real tilt-and-turn window with the collar on the frame's face, its hooks
  and feet, and say so in their insert step; they follow how this page holds the insert. Those scenes keep their schematic
  collar height, so that their passage and ramp still meet the sill.

Not published, and estimated in the parts library from Windhager's instruction drawings: the strip's width (8 mm), thickness
(0.8 mm), leg length (40 mm) and hole (4.2 mm). Neither Windhager nor Neher gives a spring force or load rating, and the printed
hook has none either: it has not been printed and tested. That is why the feet carry the insert with either kind of hook, as
before; the printed hooks are no reason to leave the feet out or make them smaller.

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
   collar with 10 mm clearance, too little for any real clamp. Pressed into the recess, **the whole-catio scenes still
   draw their schematic 98 cm collar**; adopting this sizing there is a follow-up. Hung (the default), they draw the hung
   collar's width on the frame's face.
5. **Flat corner brackets at the collar corners.** Each corner is a butt joint (the rails between the stiles, two DIN 7997
   5 × 70 screws through the stile into the rail's end grain) with a flat corner bracket across it, let in flush on the
   room-side face. A plate across both members holds the corner square and closed against the spreaders' push and the racking
   of a cat or the wind better than a lap's glue or screws in end grain alone.
   - **Printed, by default:** the [printed-corner-bracket](../../printed-corner-bracket.md) model in PETG, sized from the 40 mm
     member: legs of 2.5 members (100 mm, as the steel bracket it replaces), half a member wide (20 mm) and 5 mm thick, let in
     5 mm. Each leg's three holes lie past the joint (50, 70 and 90 mm from the corner), on the member the leg runs along, so
     every DIN 7997 4 × 35 screw holds that member and bites 30 mm into it; they are staggered on the leg's thirds, so that
     they do not line up along the member's grain and split it. Its strength is not rated.
   - **Or bought:** a GAH Alberts Stuhlwinkel, 100 × 100 × 19 the one the printed bracket replaces, 2 mm sendzimir-galvanised
     steel, let in 2 mm and screwed through its six countersunk 5.3 mm holes with DIN 7997 5 × 35 screws. Alberts gives each
     bracket's hole count and size but not where the holes are: the page spaces them evenly along each leg beyond the corner
     square (an estimate), and checks they miss the corner screws.
   - It goes on the room-side face because the outdoor face carries the mesh and battens, and it is let in so that a hung
     collar still lies flat on the window frame.
   - Hung on the window frame, the brackets must stay clear of the screen hooks screwed to the stiles' backs: 20 mm wide, the
     printed bracket leaves them 2.5 mm (19 mm wide, the 100 mm Alberts bracket at least 3 mm) with the default 15 mm overlap; the
     125 and 150 mm Alberts ones (22 and 25 mm wide), or only 10 mm of overlap on the frame (the head hooks then turn in 17–18 mm
     below the collar's top, under the bracket's rail leg), are refused.
6. **Half-lapped collar corners (option).** The spreaders push the corners apart; a glued half-lap (30 mm, half the 60 mm depth)
   with two DIN 7997 4 × 50 screws carries that on long grain and timber shoulders. A butt joint (two DIN 7997 5 × 70 screws
   through the stile into the rail's end grain) remains selectable.
7. **Mesh clamped under battens.** DIN 1159 2.5 × 25 staples locate the tensioned mesh every 15 cm; 40 × 15 cover battens,
   screwed through the mesh with DIN 7997 4 × 35 screws, clamp the whole edge and cover the cut wire ends. Where the direct
   variant's passage sleeve meets a threshold edge there is no face for a batten, so it is stapled in every option; the
   modular insert's mesh lies only on faces, so "battens only" needs no staples there.
8. **The modular cat port.** A full-width transom over the port and two jambs give every infill mesh panel timber on all
   four edges. They sit in 10 mm housings (or butt joints), the jambs screwed from under the sill rail with DIN 7997 6 × 90.
   The sliding gate runs in tracks on the room side of the port.
9. **The cat port ends at its frame.** Nothing of the insert continues the port out to the wall face. The
   [insert–tunnel coupling](window-insert-tunnel-coupling.md) screws a docking frame onto the jambs and transom, which
   carries the passage on to the tunnel. The frame **stays on the insert from then on**, also when it is lifted out. Its
   parts are on the coupling's parts list. Its screws are placed between this page's batten screws and staples, so
   **Mesh to timber** and **Fixing spacing** change it. An earlier mesh "throat" from the port to the wall face was
   dropped, as it duplicated (and clashed with) that frame.

## Assembly

1. **Join the collar** on a bench outside: butt joints screwed, then a flat corner bracket let into the room-side face of each
   corner and screwed through every hole (or half-laps glued and screwed, or butt joints screwed alone); check the diagonals.
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

Hung on the window frame, steps 2, 4 and 5 change: **fit the feet and hooks** (insert nuts and feet under the sill rail only;
the four hooks, printed for the window or bent to the page's size, screwed to the stiles' backs), **hang it on the window frame** (open the sash, lift
the insert, slip the long hooks up behind the head lip, swing it in and let it down onto its feet), and **level it and close
the window** (turn the feet until the short hooks stand 1 mm clear of the sill lip, then close the sash over the hooks).

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
| Flat corner brackets (`corner-bracket`) | GAH Alberts Stuhlwinkel 25–150 mm (10 sizes, sendzimir galvanised); Simpson Strong-Tie L150PB | Alberts' page for each article (a × b × c, thickness, holes); Simpson's L-PB data sheet. Hole positions are not published (estimated) |
| Insect screen hooks (`screen-hook`) | Windhager 03651, long (5a) and short (5b) | Windhager's product page (5–35 mm lips) and assembly instructions QA468 (15 and 7 mm tips, X + 3 mm); width, thickness, leg and hole estimated from its drawings |

The printed pads use parts already in the library: ISO 4017 M8 × 80 and M8 × 30, ISO 10511 M8 and ISO 4032 M8. The pads
themselves are the [pressure-pad](../../pressure-pad.md) model. The parts list links them there with their size, sole and
nut or screw. The same goes for the printed corner brackets ([printed-corner-bracket](../../printed-corner-bracket.md), with
DIN 7997 4 × 35 screws) and the printed screen hooks ([printed-screen-hook](../../printed-screen-hook.md), with DIN 7997 3 × 20
screws): their parts-list lines link to the models with the settings to print them at (for the hooks, this window's lip and
seal gap), and each model's editor names this page under “Used by” (`modelUsage`, from the concept page's `models`).

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
- [The window: frame and sash profile, defaults and checks](../../../apps/web/src/catioWindow.ts)
- [Window insert scene](../../../apps/web/src/catioWindowInsertScene.ts) and the shared
  [window context](../../../apps/web/src/catioWindowContext.ts), which draws that window
- [Tests](../../../apps/web/src/catioWindowInsert.test.ts): every option in both variants clears the 0–90° sash sweep and
  stays inside the recess (hung, the hooks reach only behind the lip, clear of the closed sash, turned 0–90° and tilted 0–12°);
  the hooks' barbs lie in the seal gap and reach behind the lip at the head and the sill, printed or bought, and the printed
  hooks are where the model, set to the window, makes them; spreader pads reach the reveals only once tightened and the sill feet stand on the recess floor;
  the bench-to-recess staging; parts-list counts against the layout; settings restoration. Browser coverage is in
  [catio.spec.ts](../../../tests/browser/catio.spec.ts).

This is a concept: the recess, reveal material, sill and window profile are unmeasured (the profile's defaults are a VEKA
Softline 82 MD's), and clamp preload, friction and timber sizing are
not yet calculated. Measure the recess and check the reveal is sound masonry before relying on pressure fixing.
