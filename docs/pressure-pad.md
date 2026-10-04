# Pressure pad

`pressure-pad` is a round printed pad for the end of a metric screw, in place of a bought levelling foot. Screws and nuts
are cheap and to hand; the pad is printed. Printed **extenders** join screws end to end, so a leg can be longer than the
longest screw. The model downloads as a ZIP: the pad and one STL per extender. It is an original design (CC BY 4.0, see
[models/pressure-pad/ATTRIBUTION.md](../models/pressure-pad/ATTRIBUTION.md)), one parametric file:
`models/pressure-pad/generator.scad`.

The window catio uses it by default: on the window insert's clamps and under the tunnel's supports (see
[In the catio](#in-the-catio)).

## Two kinds

- **Thrust pad** (`padType = thrust`), for a clamp. Run a nut onto the screw's tip until the tip is flush with its far face,
  then slide it sideways into the pad's round chamber. The nut turns freely in the chamber, so a screw turned from its other
  end pushes the pad out without turning it. The sole does not scrub the surface it presses on.
- **Foot** (`padType = foot`), a levelling foot or thumbwheel. Slide the head of a hexagon head screw sideways into the pad's
  hexagon pocket. The head cannot turn in it, so turning the pad turns the screw.

Either way, the screw's shank leaves through a slot in the pad's back, the **lip**. The lip holds the nut or head in when the
screw pulls. Two small bumps narrow the chamber's mouth 0.15 mm each below the width across flats. Press the nut or head
in past them, and it stays in when the pad hangs loose, e.g. while the insert is carried to the window.

## Extenders

An extender is a printed sleeve, as wide as the pad, that joins two screws end to end.

- **Nut end:** a nut is locked in a hexagon pocket at one end. The screw below is turned into it until its tip bears on the
  solid floor above the nut. That jams the screw, so the joint does not unscrew when the leg is turned.
- **Head end:** the next screw's hexagon head is locked in a hexagon pocket at the other end, its shank out through the
  lip.
- **Fitting:** both pockets are entered sideways through slots along the same side, with the same snap bumps as the pad.
- **Stacking:** extenders stack; **Extenders** sets how many, 0 to 3.

On a **foot**, each extender stands nut end down on the screw below, and the leg goes on up. On a **thrust pad**, it is the
other way round: the extender's head pocket goes over the screw's head and the next screw comes down into its nut.

## Parameters

| Parameter | Default | Range | What it does |
| --- | --- | --- | --- |
| Pad | Foot (screw head) | Foot; thrust pad | What the pad holds, above |
| Diameter | 32 mm | 16–80 mm | Outside diameter |
| Height | 24.5 mm | 8–80 mm | From the back (against the insert nut or timber) to the sole |
| Sole | Grooved | Flat; grooved; domed | The pressing face, below |
| Relief | 1 mm | 0.4–3 mm | Depth of the grooves, or height of the dome (not for a flat sole) |
| Extenders | 1 | 0–3 | Printed sleeves that join screws end to end (above) |
| Extender length | 40 mm | 20–150 mm | Each extender's length, end to end |
| Thread | M8 | M4, M5, M6, M8 | Filters the nuts and screws below |
| Nut | ISO 10511 M8 | ISO 10511 or ISO 4032, M4–M8 | The nut of a thrust pad, and the nut locked in each extender |
| Screw | ISO 4017 M8 × 30 | ISO 4017, M4–M8, every library length | The head a foot and the extenders lock; its length sets the leg's length in the assembly, not the printed parts |
| Fit | 0.4 mm | 0.1–0.8 mm | Play round the nut or head, and round the shank, on each side |

The **soles**:

- **Flat:** the whole sole bears. Best on a smooth, even surface.
- **Grooved:** concentric grooves, as wide as they are deep (at least 1.2 mm) and 2.5 widths apart, bite into a rough
  surface such as render. Four channels at 45° run out to the rim, so water does not stand in the rings.
- **Domed:** a spherical cap. It bears in the middle first and rocks to follow a surface that is not square to the screw.
  This stands in for a bought foot's ball swivel.

The nut's and head's sizes come from the parts library (`partDefines`): the largest width across flats and height (a
nylon-insert nut's overall height `h`). A nylon-insert lock nut is the default because it does not unscrew from the tip
when the screw turns against it.

## Sizes and limits

Fixed sizes, the same in the SCAD file and in `PRESSURE_PAD` (`packages/contracts/src/pressurePad.ts`); a test compares them:

| | |
| --- | --- |
| Lip (the back over the nut or head) | 3 mm |
| Floor between the chamber and the sole's relief | 3 mm |
| Thrust pad: recess under the nut for the screw's tip | 2 mm |
| Wall round the chamber, at least | 3 mm |
| Snap bumps at the chamber's mouth | 0.15 mm each |
| Chamfer on the outer edges | 0.8 mm (0.75 mm on the sole, so a groove's floor never meets the chamfer's edge) |

A pad must be at least `lip + (nut or head height + fit) + tip recess (thrust only) + floor + relief` high, and at least
`chamber + 2 × wall` across. A thrust pad's chamber is round, over the nut's corners. A foot's pocket is a hexagon. The
editor refuses a smaller pad, and says how small it may be. For the defaults:

- thrust pad on an ISO 10511 M8: at least 17.4 mm high and 21.8 mm across;
- foot on an ISO 4017 M8: at least 12.85 mm high and 21.9 mm across.

An extender must be at least `lip + (nut height + fit) + floor + (head height + fit) + lip` long: 23.25 mm for an ISO 10511
M8 nut and an ISO 4017 M8 head. It must also be at least `(width across flats + 2 × fit) × 2/√3 + 2 × wall` across, for the
wider of its two pockets. The library's nuts and heads of one thread are equally wide, so that is a foot's least diameter.

`pressurePadSeat` gives how far into the pad the screw is held, from its back:

- thrust pad: the screw's tip, the lip and the nut's height in (11 mm for ISO 10511 M8);
- foot: the head's underside, on the lip (3 mm).

The catio pages size their screws from it.

## Assembly

The editor's live preview shows the leg going together, with the library's screws and nuts drawn from their dimensions.
`pressurePadLeg` (`packages/contracts/src/pressurePad.ts`) places every piece; the assembly and the tests read it.

- The leg stands on its sole, with every slot opening the same way.
- **Foot:**
  1. Slide the screw's head into the foot from the side.
  2. For each extender:
     1. Run a nut down onto the screw's end.
     2. Slide the extender over the nut from the side, then turn the foot until the screw's tip bears.
     3. Slide the next screw's head into the extender's top pocket.
- **Thrust pad:**
  1. Run the nut onto the screw's tip until it is flush, then slide both into the pad.
  2. For each extender:
     1. Slide the extender over the screw's head.
     2. Slide a nut into its top pocket.
     3. Turn the next screw down into that nut until its tip bears.

`npm run check:assembly -- pressure-pad --tolerance 4` checks the assembled and exploded layouts and every step's path. The
assembled and exploded layouts share no volume. While a nut or head slides into its slot, it passes the two snap bumps,
0.15 mm each, by design: up to 3.5 mm³ for the worst settings tried (M5, two extenders). With the bumps taken out
(`--defines '{"SNAP":-0.01}'`), every check is 0 mm³.

The parts library's generic screw for the check draws a hexagon head as a hexagon (`HEX`, `HEAD_S` in
`parts/screws/screw.scad`), as the nut is drawn. A round head as wide as its corners would cut into a hexagon pocket.

## Printing

- Print in **PETG**, as generated: the pad with its slotted back on the bed and the sole on top, so a domed sole prints too.
  Each extender prints standing on its nut end. No supports: each pocket's ceiling bridges it.
- Print the load path solid (100% infill, or enough walls to fill a small pad).
- PETG creeps under a constant load, more so in summer sun. Check clamps and feet again after the first warm season.

## In the catio

- **Window insert**, **Spreader feet** = *Printed pads on M8 screws* (the default). Ganter GN 343.2 feet stay selectable.
  - At each spreader, an ISO 4017 M8 × 80 is turned from inside through the collar's insert nut. An ISO 4032 nut locks it
    on the collar's inner face. Its tip carries an ISO 10511 lock nut in a thrust pad.
  - Under the sill rail, an M8 × 30's head sits in a foot.
  - **Pad height** (18–40 mm, default 24.5 mm) and **Pad sole** (default grooved) are the page's. **Foot diameter** is the
    pads' diameter.
  - The clamp gap is the pad's height plus 8 mm of travel. The default 24.5 mm keeps the 32.5 mm gap of the 32 mm Ganter
    foot, so the collar and the cat port's floor are unchanged.
  - See [window-insert.md](concepts/catio/window-insert.md).
- **Tunnel**, **Feet** = *Printed feet on M8 × 80 screws* (the default). Ganter feet stay selectable.
  - Each foot holds the head of an ISO 4017 M8 × 80, the library's longest M8 hexagon head screw and the same part as the
    coupling bolts. It is screwed up into the leg's insert nut by turning the foot, and an ISO 4032 nut is jammed against
    the timber.
  - **Foot height** (13–40 mm, default 27.5 mm, the 40 mm Ganter foot's height) and **Foot sole** are the page's.
  - See [tunnel.md](concepts/catio/tunnel.md).

Each page lists the pads as **Pressure pad, thrust pad** or **Pressure pad, foot**, linked to this model, with their size,
sole and nut or screw. Set the editor to match when you print them.

## Files

- [Generator](../models/pressure-pad/generator.scad)
- [Contract and helpers](../packages/contracts/src/pressurePad.ts) (`PRESSURE_PAD`, `pressurePadPocket`, `pressurePadMinHeight`,
  `pressurePadMinDiameter`, `pressurePadMinExtenderLength`, `pressurePadMinExtenderDiameter`, `pressurePadSeat`,
  `pressurePadLeg`, `hexScrew`), and the model definition (`pressurePad`, `pressurePadAssembly`) in
  [models.ts](../packages/contracts/src/models.ts)
- [Contract tests](../packages/contracts/src/pressurePad.test.ts). Real renders are in `tools/test-renderer.ts`
  (`TEST_ONLY=pressure-pad`): both kinds, every sole, the lowest and narrowest pads and the largest, and the extenders,
  shortest and longest. Each part is checked as one closed solid of exactly its diameter and height (or length).
