// 11 - Honeycomb - topminibox - top: static OpenSCAD reconstruction (lid that slides into the topminibox box).
//
// Adapted from "Onz" by sez16sez (Thingiverse): https://www.thingiverse.com/thing:2739061
// Licensed CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/). This file is a derivative reconstruction of
// the design's STL (11_-_Honeycomb_-_topminibox_-_top.stl) made for CanFactory: same attribution, same non-commercial
// terms, no additional rights to the original. See ../ATTRIBUTION.md.
//
// Geometry: the box's D-shaped plan mirrored in X and pulled in by the sliding clearance, as a 1 mm shell with a 1 mm
// cap at z = 0 (the lid is modelled as printed, cap down). The -X (chamfered) end is swept away by a curved profile and its
// end sheet stops at SHEET_TOP; a half-ellipse pad on each end (a detent for the box notch) stands on the cap.
// Units are millimetres; the part is centred on the Z axis with the cap's underside on z = 0. The source STL sat at
// (244.0, -84.8) on the print plate. Static reconstruction: named dimensions only, no parameter interface yet.

SCALE     = 1;
ROUNDNESS = 96;

HEIGHT = 13.391;      // rim height
WALL   = 1;           // wall and cap thickness
CLEARANCE = 1.2;      // gap between the box's outer wall and this lid's outer wall (the box's wall + 0.2)

// Box plan outline (x, y) about the box centre: rounded -X end, chamfered +X end. The lid uses it mirrored and inset.
BOX_PLAN = [[16.982, -6.369], [17.106, -5.977], [17.184, -5.568], [17.24, -4.666], [17.239, 4.701], [17.175, 5.631], [17.081,
        6.07], [16.94, 6.474], [16.771, 6.817], [16.453, 7.294], [16.141, 7.637], [15.749, 7.972], [15.043, 8.463],
        [13.397, 9.458], [6.903, 13.252], [6.483, 13.466], [6.088, 13.608], [5.633, 13.709], [5.133, 13.75], [-6.87,
        13.759], [-7.375, 13.747], [-8.364, 13.651], [-9.292, 13.472], [-9.833, 13.327], [-10.81, 12.982], [-11.34,
        12.746], [-12.169, 12.303], [-13.086, 11.69], [-13.899, 11.014], [-14.64, 10.257], [-15.329, 9.388], [-15.622,
        8.952], [-16.088, 8.14], [-16.531, 7.158], [-16.719, 6.635], [-16.973, 5.728], [-17.072, 5.252], [-17.192,
        4.39], [-17.192, -4.391], [-17.049, -5.371], [-16.808, -6.353], [-16.463, -7.33], [-16.227, -7.859], [-15.784,
        -8.689], [-15.172, -9.605], [-14.495, -10.418], [-13.738, -11.16], [-12.869, -11.849], [-12.433, -12.141],
        [-11.621, -12.607], [-10.639, -13.051], [-9.687, -13.37], [-8.781, -13.582], [-8.182, -13.676], [-7.244,
        -13.753], [4.741, -13.758], [5.279, -13.744], [5.812, -13.676], [6.277, -13.546], [6.662, -13.383], [7.098,
        -13.138], [13.816, -9.213], [15.056, -8.455], [15.787, -7.944], [16.209, -7.567], [16.601, -7.095], [16.813,
        -6.743]];

// Outer surface of the swept -X end: [x, z] pairs; everything to the -X side of this curve is removed.
END_CURVE = [[-15.57, 6.6], [-15.39, 7.1], [-15.2, 7.6], [-14.97, 8.1], [-14.72, 8.6], [-14.43, 9.1], [-14.09, 9.6], [-13.7,
        10.1], [-13.25, 10.6], [-12.72, 11.1], [-12.07, 11.6], [-11.25, 12.1], [-10.15, 12.6], [-8.43, 13.1], [-6.58,
        13.35]];
END_LOW_X = -16.04;   // x of the curve below its first pair
SHEET_TOP = 8;        // the swept end sheet is removed above this height (the ring walls keep following the curve)

// Detent pads: half-ellipses in the (y, z) plane standing on the cap, at both ends, out to PAD_X.
PAD_A = 4.2;          // half-width along Y
PAD_C = 6.25;         // height
PAD_X = 17.24;
PAD_IN_X = 15.5;      // pad reaches this far towards the centre so it overlaps the wall

HEADROOM = 10;
module lid_plan() { mirror([1, 0]) offset(delta = -CLEARANCE) polygon(BOX_PLAN); }

// Region kept above the swept end, in the (x, z) plane, open at the top so that insetting it does not create a lid.
module keep_region() {
  polygon(concat([[END_LOW_X, -HEADROOM], [END_LOW_X, END_CURVE[0][1]]], END_CURVE, [[END_CURVE[len(END_CURVE) - 1][0], HEIGHT + HEADROOM], [30, HEIGHT + HEADROOM], [30, -HEADROOM]]));
}

module across_y(len) rotate([90, 0, 0]) linear_extrude(height = len, center = true) children();

module pad() {   // toward +X; mirror for the other end
  translate([PAD_IN_X, 0, 0]) rotate([90, 0, 90]) linear_extrude(height = PAD_X - PAD_IN_X)
    intersection() { scale([PAD_A, PAD_C]) circle(r = 1, $fn = ROUNDNESS); translate([-PAD_A, 0]) square([2 * PAD_A, PAD_C]); }
}

module topminibox_top() {
  // walls follow the curve all the way up; the swept sheet exists only below SHEET_TOP
  union() {
    intersection() {
      difference() {
        linear_extrude(height = HEIGHT) lid_plan();
        translate([0, 0, WALL]) linear_extrude(height = HEIGHT) offset(delta = -WALL) lid_plan();
      }
      across_y(40) keep_region();
    }
    intersection() {
      difference() {
        intersection() { linear_extrude(height = HEIGHT) lid_plan(); across_y(40) keep_region(); }
        intersection() {
          translate([0, 0, WALL]) linear_extrude(height = HEIGHT) offset(delta = -WALL) lid_plan();
          across_y(40) offset(delta = -WALL) keep_region();
        }
      }
      translate([-30, -30, 0]) cube([60, 60, SHEET_TOP]);
    }
    pad();
    mirror([1, 0, 0]) pad();
  }
}

scale(SCALE) topminibox_top();
