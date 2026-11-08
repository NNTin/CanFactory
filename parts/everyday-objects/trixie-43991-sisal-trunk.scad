// TRIXIE replacement sisal trunk for cat trees, article 43991, the parts library's `trixie-43991-sisal-trunk`
// (packages/contracts/src/parts/everyday-objects.ts, which lists the same dimensions with their sources). The wand holder shows it
// as a reference object in its assembly preview: the holder's clip snaps round it. It is the thinnest post the clip is made for
// (Ø 90 mm, docs/wand-holder.md). It is never printed and never part of the ZIP. The parts library and the assembly preview load
// trixie-43991-sisal-trunk.stl, which is this file rendered (see docs/adding-parts.md); render it again after any change here.
//
// Frame: millimetres, Z up along the trunk, its bottom end on z = 0, centred on the Z axis.
//
// Confirmed by the listings (heise preisvergleich, product 43991: "Abmessungen 40x9x9cm", "ø 9 x 40 cm ... inkl. Gewindestange
// M8 und 2 Schrauben"): the diameter over the rope and the length. The rope's thickness is estimated (sisal rope for cat posts is
// commonly about 6 mm); it is drawn as rings of rope, one per turn, rather than as a helix. The M8 fixings are left out.

$fn = 56;

// --- Confirmed ---
HEIGHT = 400;       // length
DIAMETER = 90;      // over the rope

// --- Estimated ---
ROPE = 6;           // the rope's thickness: one ring per ROPE along the trunk
GROOVE = 1.2;       // how deep the hollow between two turns is
END_BAND = 4;       // the bare core's ends above and below the rope

function profile() = let(n = floor((HEIGHT - 2 * END_BAND) / ROPE), r = DIAMETER / 2, z0 = (HEIGHT - n * ROPE) / 2)
  concat([[0, 0], [r - GROOVE, 0], [r - GROOVE, z0]],
    [for (i = [0 : n - 1]) each [[r, z0 + i * ROPE + ROPE / 2], [r - GROOVE, z0 + (i + 1) * ROPE]]],
    [[r - GROOVE, HEIGHT], [0, HEIGHT]]);

rotate_extrude() polygon(profile());
