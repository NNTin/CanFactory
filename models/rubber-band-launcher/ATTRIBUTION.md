# Rubber band launcher — attribution

**Rubber Band Launcher** by **FerryTeacher**.

- Original model: <https://cults3d.com/en/3d-model/game/rubber-band-launcher>
- Author: <https://cults3d.com/en/users/FerryTeacher>
- Licence: **CC BY-NC-SA** (Creative Commons Attribution-NonCommercial-ShareAlike), recorded as supplied with the model.
  No licence version was given; the catalogue links the current deed, <https://creativecommons.org/licenses/by-nc-sa/4.0/>.
  (The listing could not be fetched automatically on 2026-11-15; check it for the exact version.)

Licence terms that apply to this model and everything CanFactory derives from it:

- **Attribution**: credit FerryTeacher, link the original listing and the licence, and say that changes were made.
- **NonCommercial**: neither the original nor any adaptation (including these SCAD files and the STLs rendered from
  them) may be used for commercial purposes. Do not sell the prints or the files.
- **ShareAlike**: adaptations must be distributed under the same licence. The reconstructions in this directory
  (`frame.scad`, `trigger.scad`, and the comparison STLs in `references/`) are adaptations and are shared under
  CC BY-NC-SA too. The repository's own licence does not replace the source model's licence.

## Preserved original and reconstruction

The user supplied the original STL on 2026-11-15. It is preserved unchanged in `references/`.

| Original file | SHA-256 |
| --- | --- |
| `references/Rubber Band Launcher.stl` | `35bf58e7e2dbfe9ae6805ca7ab6513c857222fb986bd169a062914500543f1a5` |

The STL holds two separate closed bodies, posed as they print together: the **frame** (the pistol with its barrel, spring
arm and grip) and the **trigger**, held between the frame's side plates on two conical pivot pins. CanFactory splits them
into two parts and reconstructs each as a self-contained, editable OpenSCAD file (`frame.scad`, `trigger.scad`) from
measured sections and fitted fillets; see [references/VERIFICATION.md](references/VERIFICATION.md) for the comparison with
the source. Changes from the original: both parts keep the source's print orientation (standing on the barrel's top
edge), moved so that the frame is centred on the Z axis with its base on z = 0; the trigger keeps its place relative to
the frame, so the two prints together are still the original print-in-place layout. The reconstruction approximates the
source's curved surfaces with stacked slices and leaves out the ramps at the ends of the barrel rail's slot; the
deviations are listed in the verification report.

`references/Rubber Band Launcher.frame.stl` and `references/Rubber Band Launcher.trigger.stl` are comparison copies of the
two bodies of the original (the same triangles, unmoved, one body per binary STL), against which the SCAD files are
verified.

The catalogue and the generated STL headers retain the author and CC BY-NC-SA credit.
