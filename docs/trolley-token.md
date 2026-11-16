# Trolley token and shopping-list holder

[Shopping list holder for shopping cart coin slot](https://www.thingiverse.com/thing:4126950) by
[jhappone](https://www.thingiverse.com/jhappone/designs), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
[Attribution and preserved originals](../models/trolley-token/ATTRIBUTION.md).

The original design combines a 23.25 mm trolley token, 2.5 mm thick, with a spring-operated paper clamp.
CanFactory keeps the source's shape and fits it for hardware you can buy: an M2 × 16 screw as the pivot, an M2 nut in a trap and
a stock torsion spring. Both printed parts come as a ZIP: `body.stl` and `clip.stl`. The design has no adjustable settings in
the editor. Model version 3 replaced the discarded CanFactory designs; saved settings and render requests for those versions do
not apply.

## Hardware

Not in the print ZIP. All three are in the [parts library](../packages/contracts/src/parts/), and the editor's parts list links
to them.

| Qty | Part | Library id | Key dimensions |
| --- | --- | --- | --- |
| 1 | Socket head cap screw ISO 4762 (DIN 912) M2 × 16 | `iso-4762-m2x16` | 16 mm under the Ø3.8 × 2 mm head, 1.5 mm hex key |
| 1 | Hexagon nut ISO 4032 (DIN 934) M2 | `iso-4032-m2` | 4 mm across the flats, 1.6 mm high |
| 1 | Torsion spring, Gutekunst T-16102L | `gutekunst-t-16102l` | See below |

The torsion spring is [Gutekunst T-16102L](https://www.federnshop.com/en/products/torsion_springs/t-16102l.html) (read 2026-11-16):
- 1.4310 stainless spring steel, left-hand.
- 0.5 mm wire, 2.5 ± 0.08 mm inside and 3.5 mm outside.
- 4.5 coils, 2.75 mm long.
- Two straight 25 mm tangential legs in the 180° leg position: they leave the coil at opposite sides and lie side by side, pointing
  the same way, as on a clothes peg.
- Largest torque 14.86 ± 4.16 N·mm at 63.74°, about 0.23 N·mm per degree.
- Mandrel 2–2.25 mm, which takes the M2 screw's 2 mm thread as the coil narrows when wound.

Any spring of the same wire, coil, coil count and leg position fits, from another maker too.

## Print and assemble

Print the body flat underside down and the clip flat outer face down, in the supplied orientations, without supports. The body
is 51.625 × 30 × 8 mm (the nut's boss is the 8 mm); the clip is 25 × 30 × 7 mm. Check the token against your trolley lock.

The holes are printed 2.4 mm, ISO 273's medium clearance for M2, so there is nothing to drill.

1. **Cut the spring's legs** to 5 mm and 6 mm, measured from where each leaves the coil.
2. **Fit the spring.** Put it between the clip's two knuckles, with its legs crossed: the 6 mm leg goes on the seat under the pad
   (the clip's short end). Lower the clip between the body's hinge ears, setting the 5 mm leg on the body's seat ahead of the hinge.
3. **Fit the nut.** Push the nut into the hexagonal trap in the ear with the round boss, corners up and down.
4. **Fit the screw.** Push the screw in from the other ear, through the clip and the spring, and turn it into the nut until the
   head just seats. Do not clamp the ears onto the clip; a drop of threadlocker keeps the screw there.
5. **Check it.** Press the pad: the rear grip should open freely and the spring should close it again.

The preview shows each step:
- the spring going in with the clip;
- the nut going into its trap;
- the screw going through.

It then demonstrates pressing the pad to open the rear grip and releasing it. The spring winds and unwinds as the clip turns.

## How the hardware fits

- **The pivot:** the source's axle. The screw's head bears on the outer face of one ear (y = +7.5 mm). Its 16 mm end at
  y = −8.5 mm, flush with the nut's outer face, so the whole nut's 1.6 mm of thread (four turns) is engaged.
- **The nut boss:** the nut-side ear is extended outwards by a 1.5 mm boss, beside the clip, not under it. It holds the nut's
  trap and keeps the screw's tip 0.5 mm inside its face, so nothing protrudes but the head.
- **The trap:** 4.3 mm across the flats, the nut's largest 4 mm plus 0.3 mm. It reaches 0.6 mm into the original ear and leaves
  a 1.9 mm wall to the clip.
- **The spring's coil:** it sits in the original 4.4 mm gap between the clip's knuckles, about 0.8 mm clear each side. It is
  0.25 mm clear of the clip above; a 0.5 mm relief in the body below takes its sag on the screw.
- **Leg seats:** the body has a ramp under the first leg, at 18°. The clip has a ramp over the second leg under the pad, at −10°
  when closed. Each ramp lies along its leg from 2.2 mm out to the leg's end, on that leg's side of the coil. The legs pass each
  other there.
- **Working range:** closed, the spring is wound 28° from free, about 6.5 N·mm, which holds the pad up and the grip shut. Pressed
  15° open, it is wound 43°, about 10 N·mm. That is 68% of its largest angle.
- **Clearance:** the 5 and 6 mm legs keep at least 0.5 mm from the other part throughout the movement.

## Source verification

Both STEP solids are valid, and both converted prints are closed, consistently wound, connected solids. Rendered without the
fittings (`M2_HARDWARE = false`), comparison with the supplied STLs gives:
- 99.86% overlap for the body and 99.74% for the clip;
- less than 0.01 mm bounding-box difference;
- 0.02% volume difference.

With the fittings, each part is still one closed manifold body. Assembly placement reverses the measured print transforms.

The assembly check collides the printed parts with the screw, the nut and the wound spring:
- assembled, exploded and in each step: 0 mm³ of overlap;
- at every degree of the opening and closing movements: also 0 mm³.

Turning either spring leg 1° into its seat makes them overlap, so the legs bear on their seats.

[Reproducible conversion, fittings and assembly checks](../models/trolley-token/CONVERSION.md)
· [Generated verification report](../models/trolley-token/VERIFICATION.md).
