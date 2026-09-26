// Underside text of the cigarette case box as a separate part, for printers with a second nozzle (or a filament change): the
// exact letters that the box file carves into its underside when TEXT is set, filling the carving flush. It sits in the
// box's coordinate frame (underside on z = 0), so importing it together with the box in a slicer aligns the two.
//
// Original design "Onz" by sez16sez (Thingiverse): https://www.thingiverse.com/thing:2739061, licensed CC BY-NC 4.0
// (https://creativecommons.org/licenses/by-nc/4.0/). This text is CanFactory's addition to that design; same terms.
// Units are millimetres. The letters are separate bodies by design.

// --- underside text (this block is identical in the box file and in underside-text.scad; a test keeps them in sync) ---
// Text on the underside of the box, the face that sits on the print bed. It reads correctly when the box is turned over, so it is
// mirrored here. Carved TEXT_DEPTH deep into the box; underside-text.scad is the same letters as a separate part that fills the
// carving exactly, for a printer with a second nozzle. All of these can be overridden with -D.
TEXT = "";              // the text, one line; empty for none
TEXT_FONT = "sans";     // "sans", "serif", "mono" or "wide": the bold fonts bundled in models/fonts
TEXT_SIZE = 6;          // letter height in mm (OpenSCAD's text size: about the height of a capital)
TEXT_DEPTH = 0.8;       // the floor above the underside is 2.45 mm, so this leaves 1.65 mm
// The flat underside that is free for text: clear of the round bay (x < -10.9) and of the flange edge, centred on the middle.
TEXT_X0 = -9;
TEXT_X1 = 26;
TEXT_HALF_H = 8;

function text_font(name) = name == "serif" ? "Liberation Serif:style=Bold" : name == "mono" ? "Liberation Mono:style=Bold"
  : name == "wide" ? "DejaVu Sans:style=Bold" : "Liberation Sans:style=Bold";

// The letters, clipped to the free area so that a string that is too long can never reach the bay or the flange edge.
module underside_text_2d() {
  intersection() {
    translate([(TEXT_X0 + TEXT_X1) / 2, 0]) mirror([1, 0]) text(TEXT, size = TEXT_SIZE, font = text_font(TEXT_FONT), halign = "center", valign = "center");
    translate([TEXT_X0, -TEXT_HALF_H]) square([TEXT_X1 - TEXT_X0, 2 * TEXT_HALF_H]);
  }
}
// --- end underside text ---

linear_extrude(height = TEXT_DEPTH) underside_text_2d();
