# Attribution

**Ultra-Compact Case for ESP32-C3 SuperMini (step file)** by **Vinors3DLab**.

- MakerWorld original: https://makerworld.com/de/models/3419196-ultra-compact-case-esp32-c3-supermini-step-file
  — [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/), as supplied by the user.
- Author's matching MakerOnline release: https://www.makeronline.com/en/model/Ultra-Compact-Case-for-ESP---C--SuperMini--step-file-/338531.html
  — [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), verified 2026-10-19.

**The LED-hole and pin-header-opening adaptation uses the author's CC BY-NC-SA 4.0 release.** The
MakerOnline listing names the same author, model and three source files
(`case_esp32-c3-cad.step`, `bottom.3mf`, `top.3mf`), with matching byte sizes
265782, 7199 and 33087. Its license link explicitly resolves to BY-NC-SA 4.0.
Direct file downloads require access to MakerOnline's private storage, so an
independent byte-for-byte download comparison was not available.

The supplied files in `references/` remain unmodified. The root `bottom.stl`,
`top.stl` and JSON records document the earlier technical conversion of the
original, without LED or insulator openings; their original MakerWorld license notices remain.
They are comparison references, not dependencies of the live model.

CanFactory's changes through model version 3:

- Two optional 2 mm openings above the board library's red power and blue GPIO8
  LEDs, enabled by default; disabling them retains the original closed lid.
- Two optional 21.07 × 3.09 mm floor openings for pin-header insulators, enabled
  by default, so the headers seat against the PCB. Disabling them restores the
  original narrow slots and external spacer placement.
- A preview with the existing Nologo SuperMini board and two sourced 1 × 8 pin
  headers. These reference objects are not included in the print ZIP.
- Rigid print placement and assembly animation. All original case details and
  lettering are retained apart from the optional LED and pin-header openings.

The adapted model and its downloaded STLs use **CC BY-NC-SA 4.0**: attribution,
noncommercial use and share alike. This does not change the license of the
separately preserved MakerWorld originals or imply the creator's endorsement.

The board and pin-header previews are CanFactory's procedural dimension models,
with their own manufacturer sources in the parts library; no manufacturer CAD
files are redistributed. LED and component positions are partly estimated in
the existing SuperMini entry; clone boards can differ.
