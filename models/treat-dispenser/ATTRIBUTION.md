# Attribution

**PET-bottle treat dispenser** (CanFactory model `treat-dispenser`, issue #138).

## The mechanism: after bovineblitz and cylus80

The dispenser's principle (a bottle or jar screwed in upside down over a funnel, a horizontal rotor with pockets under it, turned
to carry treats to a ramp) follows **Cat treat gumball-style dispenser** by **bovineblitz**
([MakerWorld 190887](https://makerworld.com/en/models/190887)), published under
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). That model is itself a remix of **Mason Jar Candy Dispenser** by
**cylus80** ([Thingiverse 2103924](https://www.thingiverse.com/thing:2103924)), published under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

bovineblitz's three STL files are kept unchanged in [`reference/`](reference/README.md) (arm, clip, gumball body), with their
checksums. They were measured to understand the mechanism; **no geometry of theirs is copied**. Every printed part here (body,
rotor, flap, bearing cap, chute, base plate, thread coupon) is redrawn from scratch in `generator.scad` for a different purpose: a
PET bottle's thread instead of a mason jar's, a rotor turned directly by a 28BYJ-48 instead of a hand crank, a TPU flap and a cavity
against jams, a chute, and the electronics inside the body. Changes: everything except the principle.

## The ESP32-C3 case: Vinors3DLab

The body holds the **ESP32-C3 SuperMini case** unchanged: its two printed parts (`case-bottom`, `case-top`) are rendered from
`models/esp32-c3-supermini-case/bottom.scad` and `top.scad` with that model's default settings (LED openings, flush pin headers,
taller enclosure). That case is **Ultra-Compact Case for ESP32-C3 SuperMini** by **Vinors3DLab**, adapted by CanFactory under the
author's MakerOnline **CC BY-NC-SA 4.0** release; see [the case's attribution](../esp32-c3-supermini-case/ATTRIBUTION.md). The
separately preserved MakerWorld files keep their CC BY-NC-ND 4.0 notices and are not used here.

## License of this model

The mechanism's source is NonCommercial and the case is ShareAlike, so **the whole treat dispenser model is shared under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)**: attribution (bovineblitz, cylus80, Vinors3DLab and
CanFactory), noncommercial use, share alike. This does not imply any original author's endorsement.

The ESPHome configuration in `esphome/` is part of this model and shared under the same license. The bottle-neck dimensions are read
off ISBT's voluntary-guideline drawings (PCO 1881: 3784253-21; PCO 1810: 1165362-2); no drawing is redistributed. The motor, driver
board, SuperMini board and pin headers in the preview are the parts library's procedural dimension models, with their own sources
there.
