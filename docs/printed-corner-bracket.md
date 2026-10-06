# Printed corner bracket

`printed-corner-bracket` is a flat L-shaped plate screwed across the corner of a timber frame, one leg on each member, so that
the corner cannot open or rack: the printed counterpart of a bought flat corner bracket (Stuhlwinkel). It is an original design
(CC BY 4.0, see [models/printed-corner-bracket/ATTRIBUTION.md](../models/printed-corner-bracket/ATTRIBUTION.md)), one
parametric file: `models/printed-corner-bracket/generator.scad`. The model downloads as a ZIP with one STL, the bracket; its
preview drives the screws in.

The window catio uses it by default, across each corner of the [window insert](concepts/catio/window-insert.md)'s collar (see
[In the catio](#in-the-catio)).

## Shape

- **Two legs**, A and B, each **Width** wide, meeting square at the outer corner. Leg A runs along +X, leg B along +Y; the
  plate's back (against the timber) lies on z = 0 and its face at z = **Thickness**. Its outer corners are rounded 1 mm.
- **Holes**: **Holes per leg** on each leg's middle line, **Hole spacing** apart, the first **First hole** from the outer
  corner, measured along the leg. Each is the chosen screw's clearance hole, countersunk from the face so that the head sits
  flush: the head's cylindrical rim, then a 90° cone down to the hole, 0.4 mm wider than the head, as the
  [toggle latch](toggle-latch.md)'s plates have it.
- **Where the holes go.** Put the first hole past the member the other leg lies on: then every screw holds the member its leg
  runs along, and none sits in the joint. The defaults do this for a 40 mm member.

## Screws and holes

The holes are sized from a **DIN 7997 countersunk wood screw** chosen from the parts library (**Wood screw diameter**, then
**Wood screw**). DIN EN 20273 gives clearance holes for metric screws only, so a wood screw's hole is its diameter plus the
allowances the standard gives for M4 and M5: 0.3 / 0.5 / 0.8 mm (**Hole fit**: fine, medium, coarse), as the toggle latch's
wood-screw holes are (`clearanceHoles` in `packages/contracts/src/screwHoles.ts`). The countersink takes the head's largest
diameter from the library. The screw's length does not change the bracket; choose one that bites far enough into the timber.

## Parameters

| Parameter | Default | Range | What it does |
| --- | --- | --- | --- |
| Leg A, Leg B | 100 mm | 40–250 mm | Each leg's length over the outer corner |
| Width | 20 mm | 10–40 mm | Both legs' width |
| Thickness | 5 mm | 3–10 mm | Plate thickness: also how deep it is let in to lie flush |
| Holes per leg | 3 | 1–5 | On each leg's middle line |
| Hole spacing | 20 mm | 8–80 mm | Between neighbouring holes |
| First hole | 50 mm | 10–240 mm | From the outer corner, along the leg |
| Wood screw diameter, Wood screw | 4 mm, DIN 7997 4 × 35 | every DIN 7997 screw in the library | The screw the holes and countersinks are sized for |
| Hole fit (advanced) | Medium | Fine, medium, coarse | Play over the screw's diameter |

### Defaults from the collar's member

The defaults are not a generic size: they follow the catio insert's 40 mm collar member (`printedCornerBracketFor` in
`packages/contracts/src/printedCornerBracket.ts`, `WINDOW_INSERT_MEMBER`):

- **Legs** of 2.5 members, 100 mm: as long as the 100 × 100 steel bracket it replaces.
- **Width** half a member, 20 mm: the bracket lies on the member's outer half, beside a hung insert's screen hooks on the
  stiles' inner half.
- **Holes** three a leg, spread over the part of the leg past the other member (40–100 mm): 20 mm apart from 50 mm.
- **Thickness** 5 mm of PETG for the steel's 2 mm; a DIN 7997 4 × 35 through it bites 30 mm into the timber, as the steel
  bracket's 5 × 35 does through 2 mm.

A test keeps the model's defaults equal to `printedCornerBracketFor(INSERT.member)` on the window insert page, so changing the
collar's member shows up there.

## Checks

The editor refuses, before anything is rendered:

- a head too high for the plate (it must leave 1 mm of hole under the countersink), a countersink too wide for the leg (1.5 mm
  of plate either side), or a screw that does not reach 4 mm past the plate;
- holes closer than two countersinks and their walls;
- a first hole inside the corner square, where it would meet the other leg's holes;
- holes that run off a leg, with the length the leg needs.

Every other combination renders as one closed solid, its genus the number of holes (`npm run test:renderer`, and the geometry
sweep).

## In the catio

**Corner bracket → Printed (model)** is the [window insert](concepts/catio/window-insert.md)'s default: one across each of the
collar's four butt joints, let in 5 mm on the room-side face, screwed through all six holes with DIN 7997 4 × 35 screws. The
parts list links its line to this model with its size and screw. GAH Alberts' steel Stuhlwinkel (75–150 mm, in the parts
library) remain selectable. Its strength is not rated: it has not been printed and tested. This model's editor lists the window
insert under “Used by”.

## Printing

Print in PETG as generated, back down, no supports. Use 100 % infill, or at least five walls round the holes, so the screws
clamp solid plastic.

## Assembly preview

The preview lays the bracket down, then drives a library screw into every hole, its head flush with the face (the screws are
linked references: `printedCornerBracketScrews` in `packages/contracts/src/models.ts`). `npm run check:assembly --
printed-corner-bracket` renders the bracket and the screws and checks that no screw meets the plate: shifting a hole by 2 mm
makes it fail.
