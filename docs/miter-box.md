# Adjustable miter box

An original printable miter box (`miter-box`, `models/miter-box/generator.scad`, `packages/contracts/src/miterBox.ts`) with two
mechanisms: a **saw guide that turns and locks at any angle** up to 45° either way, and **hold-down clamps** that adjust to the
stock's width and height. Every dimension comes from `miterBoxLayout` in `miterBox.ts`; the generator receives them as one
`LAYOUT` list (`miterBoxScadValues`), and the assembly preview and the checks use the same numbers.

Nine printed parts: the base (with the fence), the turntable, two hold-downs, two thrust pads and three knobs. The base takes
no nuts; four stainless dowel pins hold the turntable and the hold-downs in.

## Layout

Frame: X along the fence, Y from the fence's face towards the user, Z up; the pivot is on the fence's face, at x = y = 0.

- **Base**, one print: a slab with a raised strip for the bed (the stock lies on it), the **fence** standing on that strip, and a
  block behind the fence for each hold-down's socket. Outside the strip the base's top is 4 mm lower, so a saw cutting through
  clears it. A round socket holds the turntable; a recess lets its arm sweep ±45°. The bed is 12.2 mm thick: the turntable (7 mm)
  over the index pin's 4 mm stops, with 1.2 mm under them (the first design's bed was 17.7 mm, over the lock nut's channel).
- **Fence**: printed with the base, so it cannot reach over the turntable: it stops just beyond the turntable's socket, a gap of
  about 70 mm (with the defaults) round the saw's line. The stock still lies against both halves, and on the turntable across the
  gap.
- **Turntable**: a disc, its top flush with the bed, and an arm reaching out in front. It carries the **guide**: two posts on a
  line through the pivot, one behind the stock's face and one in front of the widest stock, each with a slot `bladeKerf + 2 ×
  slotClearance` wide that runs down into a 3 mm kerf groove along the whole arm. The posts are placed so that, at every angle,
  the rear one stays behind the stock's face and the front one in front of the stock (`miterBox.test.ts` sweeps it). The groove's
  end points at the engraved scale.
- **Retainers**: two stainless ISO 2338 A1 4 × 12 dowel pins reach 3 mm over the turntable's rim, 0.2 mm over its top, just
  behind the stock's face: they hold the turntable down in its socket and let it turn. Each lies in a bore through the fence's
  end, 45° off the fence in plan, from the end face out to the back face: once the turntable is in, the pin is pushed in from
  behind until it stands out of the end face; to take the turntable out, tap the pins back with a punch from the gap. (Pins
  pushed straight into the fence's ends would have to go in from the gap, over the turntable, and could only be pulled out
  again.) Nothing that turns over the turntable (the rear post, the index pin) reaches them, and the hold-downs' blocks stand
  clear of the ground behind the fence the pins are pushed in across.
- **Hold-downs**: a column standing in a socket in the block behind the fence and a beam over the stock. A stainless ISO 2338 A1
  4 × 30 pin pressed across the block's walls through the column holds it down; the socket's walls take the clamp's tipping.

## Angle lock (continuous) and stops

**Lock**: a knob on the arm, beside the saw's line, turns an ISO 4017 screw down through a regular nut held in a hexagon pocket
under the arm, until the screw's tip presses on the floor of the arm's recess in the base. That lifts the arm against the
retainers and locks the turntable by friction, **at any angle** in the range: no nut and no slot in the base. The turntable tips
about its back edge, so the retainers take about four times the screw's force: hand-tight is enough, and is why they are 4 mm
pins. The knob stands a
millimetre or two over the arm when it is tight. A knob clamping by a screw is the mechanism of commercial adjustable miter boxes:
infinitely fine, one hand, no tools, and nothing protrudes into the saw's path or the stock's. The knob is placed beside the line
(the saw passes it) and in front of the widest stock at every angle.

**Stops**: a stainless ISO 2338 A1 4 × 20 dowel pin drops through the turntable into holes in the socket's floor at 0, ±22.5 and
±45°: the square cut, the octagon miter and the picture-frame miter. Holes closer together than 22.5° would overlap at the pin's
radius, so the other angles are on the **scale**: a tick every 5°, long ticks and labels at 0, 15, 22.5, 30 and 45. The scale
reads the miter angle: 0 is the square (90°) cut.

## Width and height clamp

Each hold-down's beam has a **T-slot**: a regular nut slides in a channel under it (its flats against the walls, so it cannot
turn) and the clamp screw turns down through it. On the screw's tip a nylon-insert nut sits in a **thrust pad**, the pressure
pad's (`PAD_TYPE = thrust`): the nut turns freely in the pad's round chamber, so the pad presses the stock without turning and
scrubbing it. Tightening pushes the nut up against the slot's lip, which also locks its position along the slot.

- **Width**: slide the pad along the slot to sit over the stock (from 10.5 mm to `stockWidth − 11` mm from the fence by default).
- **Height**: the screw's travel takes the pad from just over the tallest stock down to `clampLow`; the clamp screw must reach
  at least a third of the tallest stock (validated; choose a longer screw for thinner stock).

Pressing down onto the bed was chosen over pushing against the fence from the front: a front screw clamp must stick out in front
of the stock by its whole travel, right where the saw's blade runs at 45°; the hold-downs stand behind the fence and over the
stock, beside the saw's line at every angle (`holdX` is computed from the guide's sweep, with the socket blocks' width), and
release with a quarter turn.

## Dowel pins: stainless, from the parts library

The pins are ISO 2338 parallel pins in austenitic stainless steel A1 (`iso-2338-<d>x<l>-a1` in the parts library, every size
of the steel ISO 2338 pins; fasteners.eu's ISO 2338 table lists the stainless grades A1 and A4). All three sizes the box uses are
4 mm: 4 × 12 (retainers), 4 × 20 (index pin), 4 × 30 (hold-downs). Their holes in the base are printed at the pin's largest (m6)
diameter: printed holes come out a little small, so the pins press in. If one is too tight,
open the hole with a drill of the pin's size. The hold-downs' columns have a slip fit (0.1 mm round the pin), so the pin is held
by the base's walls. The base's pin holes lie flat: they are pointed at the top (a teardrop) so that they print without support;
the hold-down's hole is upright as it prints.

## Hand tightening: printed knobs on library screws

There is no wing nut or knurled knob in the parts library. Rather than adding a parts family, the knobs are the pressure pad's
`foot` (an ISO 4017 head locked in a hexagon pocket, slid in past two snap bumps) with an optional `GRIP` setting in its
generator: flutes round the rim (default 0, so the pressure pad itself is unchanged). The thrust pads are the same generator's
`thrust` pads. Every fastener is a library part: ISO 4017 screws, ISO 4032 and ISO 10511 nuts, the ISO 2338 A1 pins.

## Base and feet

The library's only feet are Ganter GN 343.2 levelling feet: swivelling feet on M8/M10 studs that would lift the box 20 mm and let
it rock under a saw stroke (and the owner prints pads rather than buying them). A miter box wants a flat, wide, fixed base: the
base has a flat bottom across its whole footprint and four countersunk holes for DIN 7997 4 mm wood screws to fix it to a bench
or a board.

## Assembly

`miterBoxAssembly` puts it together in twelve steps (the turntable with the lock nut in its arm, its retaining pins, the lock, the
index pin, the hold-downs and their pins, the clamp hardware, the pads slid on from the side) and then plays six movements: the
guide swung to the 45° stop, across to 22.5°, to 10° between the stops (pin up, locked by the knob), back to 0; the pads slid
across the slot; and screwed down to the lowest stock and back. `npm run check:assembly -- miter-box --tolerance 2` finds no
collision except the pads' snap bumps (up to ~1.5 mm³ as each pad's nut passes them, by design).

## Checks

- `packages/contracts/src/miterBox.test.ts`: the generator reads exactly the layout's values; the offered parts are the
  library's; the guide clears the stock, the hold-downs and the turntable's retainers at every angle over a spread of settings;
  the pins are stainless library parts with enough grip and wall; no nut sits in the base; the lock's nut is covered and its
  screw reaches the base; the assembly's movements end where the layout says.
- `tools/test-renderer.ts` (`TEST_ONLY=miter-box`): four settings, nine closed solids each, at the layout's sizes, with the
  slots, groove, lock nut's pocket, stops, retaining pins' holes, hold-down sockets and their pins' holes open.
- `tests/browser/miter-box.spec.ts`: the card's swinging guide, the editor's assembly slider and parts list, a finer kerf, the ZIP.

Prototype: not yet cut-tested. Check the guide square with a try square before the first cut.
