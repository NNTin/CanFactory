// Underside text or logo of the cigarette case box as a separate part, for printers with a second nozzle (or a filament change):
// the exact shapes that the box file carves into its underside when TEXT or LOGO is set, filling the carving flush. It sits in the
// box's coordinate frame (underside on z = 0), so importing it together with the box in a slicer aligns the two.
//
// Original design "Onz" by sez16sez (Thingiverse): https://www.thingiverse.com/thing:2739061, licensed CC BY-NC 4.0
// (https://creativecommons.org/licenses/by-nc/4.0/). This text is CanFactory's addition to that design; same terms.
// Units are millimetres. The letters (or the logo's shapes) are separate bodies by design.

// --- underside text (this block is identical in the box file and in underside-text.scad; a test keeps them in sync) ---
// Text or a logo on the underside of the box, the face that sits on the print bed. It reads correctly when the box is turned
// over, so it is mirrored here. Carved TEXT_DEPTH deep into the box; underside-text.scad is the same shapes as a separate part
// that fills the carving exactly, for a printer with a second nozzle. All of these can be overridden with -D.
MARK = "text";          // "text" or "logo": which of the two goes on the underside
TEXT = "";              // the text, one line; empty for none
TEXT_FONT = "sans";     // "sans", "serif", "mono" or "wide": the bold fonts bundled in models/fonts
TEXT_SIZE = 6;          // letter height in mm (OpenSCAD's text size: about the height of a capital)
// The logo: rings of [x, y] points (y up) that fill even-odd, simple outlines and holes, on an integer grid whose longest side
// is 2000. The editor writes it from an SVG file's filled shapes (packages/contracts/src/svgLogo.ts); empty for none.
LOGO = [];
LOGO_SIZE = 12;         // height of the logo in mm; less if it would be wider than LOGO_W
TEXT_DEPTH = 0.8;       // the floor above the underside is 2.45 mm, so this leaves 1.65 mm
// The flat underside that is free for text: clear of the round bay (x < -10.9) and of the flange edge, centred on the middle.
TEXT_X0 = -9;
TEXT_X1 = 26;
TEXT_HALF_H = 8;
LOGO_W = TEXT_X1 - TEXT_X0 - 0.5;   // widest logo, with the same margin as the text

function text_font(name) = name == "serif" ? "Liberation Serif:style=Bold" : name == "mono" ? "Liberation Mono:style=Bold"
  : name == "wide" ? "DejaVu Sans:style=Bold" : "Liberation Sans:style=Bold";
function has_mark() = MARK == "logo" ? len(LOGO) > 0 : len(TEXT) > 0;

// The logo as one polygon: all its points, and the index list of each ring (polygon() fills them even-odd), scaled to
// LOGO_SIZE high, or less if it would be wider than LOGO_W, and centred.
module logo_2d() {
  points = [for (ring = LOGO) each ring];
  starts = [for (i = 0, n = 0; i < len(LOGO); n = n + len(LOGO[i]), i = i + 1) n];
  lo = [min([for (p = points) p[0]]), min([for (p = points) p[1]])];
  hi = [max([for (p = points) p[0]]), max([for (p = points) p[1]])];
  s = min(LOGO_SIZE / max(1, hi[1] - lo[1]), LOGO_W / max(1, hi[0] - lo[0]));
  scale(s) translate(-(lo + hi) / 2) polygon(points, [for (i = [0 : len(LOGO) - 1]) [for (j = [0 : len(LOGO[i]) - 1]) starts[i] + j]]);
}

// The text or logo, clipped to the free area so that nothing can ever reach the bay or the flange edge.
module underside_text_2d() {
  intersection() {
    translate([(TEXT_X0 + TEXT_X1) / 2, 0]) mirror([1, 0])
      if (MARK == "logo") { if (len(LOGO) > 0) logo_2d(); }
      else text(TEXT, size = TEXT_SIZE, font = text_font(TEXT_FONT), halign = "center", valign = "center");
    translate([TEXT_X0, -TEXT_HALF_H]) square([TEXT_X1 - TEXT_X0, 2 * TEXT_HALF_H]);
  }
}
// --- end underside text ---

linear_extrude(height = TEXT_DEPTH) underside_text_2d();
