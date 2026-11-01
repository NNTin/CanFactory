# Adjustable miter box

An original printable miter box (`miter-box`, `models/miter-box/generator.scad`, `packages/contracts/src/miterBox.ts`) with two
mechanisms: a **saw guide that turns and locks at any angle** up to 45° either way, and **hold-down clamps** that adjust to the
stock's width and height. Every dimension comes from `miterBoxLayout` in `miterBox.ts`; the generator receives them as one
`LAYOUT` list (`miterBoxScadValues`), and the assembly preview and the checks use the same numbers.

## Layout

Frame: X along the fence, Y from the fence's face towards the user, Z up; the pivot is on the fence's face, at x = y = 0.

- **Base**: a slab with a raised strip for the bed (the stock lies on it) and the fence; outside the strip the base's top is
  4 mm lower, so a saw cutting through clears it. A round socket holds the turntable; a recess lets its arm sweep ±45°.
- **Turntable**: a disc, its top flush with the bed, and an arm reaching out in front. It carries the **guide**: two posts on a
  line through the pivot, one behind the fence and one in front of the widest stock, each with a slot `bladeKerf + 2 ×
  slotClearance` wide that runs down into a 3 mm kerf groove along the whole arm. The posts are placed so that, at every angle,
  the rear one stays behind the fence and the front one in front of the stock (`miterBox.test.ts` sweeps it). The groove's end
  points at the engraved scale.
- **Fence**: two halves screwed onto pads 0.4 mm above the bed, so they reach over the turntable's rear without touching it (and
  keep it down). They meet in a V-notch that is only the slot's width at the face and opens behind for the saw turned either
  way: the stock is supported to within about a millimetre of the cut at every angle.
- **Hold-downs**: a column behind the fence and a beam over the stock, screwed down from above into nuts under the base.

## Angle lock (continuous) and stops

**Lock**: a knob on the arm, beside the saw's line, turns an ISO 4017 screw down through the arm and a curved slot in the base
into a regular nut that slides in a curved channel under the base. The channel's walls are the nut's width across flats, so the
nut follows the arm but cannot turn; tightening the knob clamps the arm onto the base by friction, **at any angle** in the range.
A knob on a screw clamping through an arc slot is the mechanism of commercial adjustable miter boxes and table-saw miter gauges:
infinitely fine, one hand, no tools, and nothing protrudes into the saw's path or the stock's. The knob is placed beside the line
(the saw passes it) and in front of the widest stock at every angle.

**Stops**: an ISO 8734 5 × 20 dowel pin drops through the turntable into holes in the socket's floor at 0, ±22.5 and ±45° — the
square cut, the octagon miter and the picture-frame miter. Holes closer together than 22.5° would overlap at the pin's radius,
so the other angles are on the **scale**: a tick every 5°, long ticks and labels at 0, 15, 22.5, 30 and 45. The scale reads the
miter angle: 0 is the square (90°) cut.

## Width and height clamp

Each hold-down's beam has a **T-slot**: a regular nut slides in a channel under it (its flats against the walls, so it cannot
turn) and the clamp screw turns down through it. On the screw's tip a nylon-insert nut sits in a **thrust pad**, the pressure
pad's (`PAD_TYPE = thrust`): the nut turns freely in the pad's round chamber, so the pad presses the stock without turning and
scrubbing it. Tightening pushes the nut up against the slot's lip, which also locks its position along the slot.

- **Width**: slide the pad along the slot to sit over the stock (from 10.5 mm to `stockWidth − 11` mm from the fence by default).
- **Height**: the screw's travel takes the pad from just over the tallest stock down to `clampLow`; the clamp screw must reach
  at least a third of the tallest stock (validated; choose a longer screw for thinner stock).

Pressing down onto the bed was chosen over pushing against the fence from the front: a front screw clamp must stick out in front
of the stock by its whole travel, right where the saw's blade runs at 45°, which made the base about 280 mm long; the hold-downs
stand behind the fence and over the stock, beside the saw's line at every angle (`holdX` is computed from the guide's sweep),
and release with a quarter turn.

## Hand tightening: printed knobs on library screws

There is no wing nut or knurled knob in the parts library. Rather than adding a parts family, the knobs are the pressure pad's
`foot` (an ISO 4017 head locked in a hexagon pocket, slid in past two snap bumps) with a new optional `GRIP` setting in its
generator: flutes round the rim (default 0, so the pressure pad itself is unchanged). The thrust pads are the same generator's
`thrust` pads. Every fastener is a library part: ISO 4017 and ISO 4762 screws, ISO 4032 and ISO 10511 nuts, the ISO 8734 pin.
The fence and hold-down screws are socket heads in counterbores, turned once with a hex key at assembly.

## Base and feet

The library's only feet are Ganter GN 343.2 levelling feet: swivelling feet on M8/M10 studs that would lift the box 20 mm and let
it rock under a saw stroke (and the owner prints pads rather than buying them). A miter box wants a flat, wide, fixed base: the
base has a flat bottom across its whole footprint and four countersunk holes for DIN 7997 4 mm wood screws to fix it to a bench
or a board.

## Assembly

`miterBoxAssembly` puts it together in eleven steps (nuts from below, the turntable, the lock, the pin, the fence, the
hold-downs, the clamp hardware, the pads slid on from the side) and then plays six movements: the guide swung to the 45° stop,
across to 22.5°, to 10° between the stops (pin up, locked by the knob), back to 0; the pads slid across the slot; and screwed down
to the lowest stock and back. `npm run check:assembly -- miter-box --tolerance 2` finds no collision except the pads' snap bumps
(up to ~1.5 mm³ as each pad's nut passes them, by design).

## Checks

- `packages/contracts/src/miterBox.test.ts`: the generator reads exactly the layout's values; the offered parts are the
  library's; the guide clears the stock, the fence and the hold-downs at every angle over a spread of settings; the lock and
  base screws are fully engaged and never reach the bench; the assembly's movements end where the layout says.
- `tools/test-renderer.ts` (`TEST_ONLY=miter-box`): four settings, eleven closed solids each, at the layout's sizes, with the
  slots, groove, lock slot and channel, stops and nut pockets open.
- `tests/browser/miter-box.spec.ts`: the card's swinging guide, the editor's assembly slider and parts list, a finer kerf, the ZIP.

Prototype: not yet cut-tested. Check the guide square with a try square before the first cut.
