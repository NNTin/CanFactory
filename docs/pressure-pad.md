# Pressure pad

`pressure-pad` is a round printed pad for the end of a metric screw, in place of a bought levelling foot. Screws and nuts
are cheap and to hand; the pad is printed. It is an original design (CC BY 4.0, see
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

## Parameters

| Parameter | Default | Range | What it does |
| --- | --- | --- | --- |
| Pad | Thrust pad (nut) | Thrust pad; foot | What the pad holds, above |
| Diameter | 32 mm | 16–80 mm | Outside diameter |
| Height | 24.5 mm | 8–80 mm | From the back (against the insert nut or timber) to the sole |
| Sole | Grooved | Flat; grooved; domed | The pressing face, below |
| Relief | 1 mm | 0.4–3 mm | Depth of the grooves, or height of the dome (not for a flat sole) |
| Thread | M8 | M4, M5, M6, M8 | Filters the nuts and screws below |
| Nut | ISO 10511 M8 | ISO 10511 or ISO 4032, M4–M8 | Thrust pad: the nut the chamber is sized for |
| Screw | ISO 4017 M8 × 30 | ISO 4017, M4–M8, every library length | Foot: the head the pocket is sized for (the length does not change the pad) |
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
- foot on an ISO 4017 M8: at least 12.85 mm high.

`pressurePadSeat` gives how far into the pad the screw is held, from its back:

- thrust pad: the screw's tip, the lip and the nut's height in (11 mm for ISO 10511 M8);
- foot: the head's underside, on the lip (3 mm).

The catio pages size their screws from it.

## Printing

- Print in **PETG**, as generated: the slotted back on the bed and the sole on top, so a domed sole prints too. No supports:
  the chamber's ceiling bridges the chamber.
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
  `pressurePadMinDiameter`, `pressurePadSeat`, `hexScrew`), and the model definition (`pressurePad`) in
  [models.ts](../packages/contracts/src/models.ts)
- [Contract tests](../packages/contracts/src/pressurePad.test.ts). Real renders are in `tools/test-renderer.ts`
  (`TEST_ONLY=pressure-pad`): both kinds, every sole, the lowest and narrowest pads and the largest. Each is checked as one
  closed solid of exactly its diameter and height.
