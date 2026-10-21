# Attribution

**PET-bottle treat dispenser** (CanFactory model `treat-dispenser`): the notch disc, spindle gear, pinion, body, gearbox cover,
chamber, bottle adapter, thread coupon and wall bracket are original CanFactory designs (`generator.scad`, issue #138).

The electronics bay holds the **ESP32-C3 SuperMini case** unchanged: its two printed parts (`case-bottom`, `case-top`) are rendered
from `models/esp32-c3-supermini-case/bottom.scad` and `top.scad` with that model's default settings (LED openings, flush pin
headers, taller enclosure). That case is **Ultra-Compact Case for ESP32-C3 SuperMini** by **Vinors3DLab**, adapted by CanFactory
under the author's MakerOnline **CC BY-NC-SA 4.0** release; see
[the case's attribution](../esp32-c3-supermini-case/ATTRIBUTION.md). The separately preserved MakerWorld files keep their
CC BY-NC-ND 4.0 notices and are not used here.

Because the downloadable ZIP contains those ShareAlike parts, **the whole treat dispenser model is shared under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)**: attribution, noncommercial use, share alike. This does
not imply the case author's endorsement.

The ESPHome configuration in `esphome/` is part of this model and shared under the same license. The bottle-neck dimensions
are read off ISBT's voluntary-guideline drawings (PCO 1881: 3784253-21; PCO 1810: 1165362-2); no drawing is redistributed.
The motor, driver board, SuperMini board and pin headers in the preview are the parts library's procedural dimension models,
with their own sources there.
