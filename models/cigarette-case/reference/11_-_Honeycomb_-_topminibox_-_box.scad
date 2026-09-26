// 11 - Honeycomb - topminibox - box: static OpenSCAD reconstruction (shallow box with a scooped end and a notch).
//
// Adapted from "Onz" by sez16sez (Thingiverse): https://www.thingiverse.com/thing:2739061
// Licensed CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/). This file is a derivative reconstruction of
// the design's STL (11_-_Honeycomb_-_topminibox_-_box.stl) made for CanFactory: same attribution, same non-commercial
// terms, no additional rights to the original. See ../ATTRIBUTION.md.
//
// Geometry: a 1 mm shell over a D-shaped plan (rounded -X end, chamfered +X end) with a 1 mm floor. The +X end is swept
// away by a curved profile (the outer surface climbs from x = 6 at the floor to x = 17.2 at the rim) and an elliptical
// notch is cut through the rim at both ends. Units are millimetres; the part is centred on the Z axis with its floor on z = 0.
// The source STL sat at (239.3, -84.8) on the print plate. Named dimensions only; no snap parameter (its notches already are
// the detent the lid latches into). The one parameter is CLEARANCE: the closed box slides into the case lid's cavity, so the
// measured outline is pulled in until it stands CLEARANCE inside that cavity (the source STL stood only FIT_GAP inside).

SCALE     = 1;
ROUNDNESS = 96;

HEIGHT = 14.391;      // rim height
WALL   = 1;           // wall and floor thickness
// Gap per side between mating surfaces (a -D override, mm), the same for every cigarette-case part; 0.2 is a snug fit.
CLEARANCE = 0.2;
FIT_GAP = 0.031;      // how far the measured outline (PLAN, END_CURVE) stands inside the case lid's cavity on its straight sides
FIT = FIT_GAP - CLEARANCE;   // the outline is offset by this much

// Plan outline (x, y) about the part centre, as measured; the part uses it offset by FIT (plan()).
PLAN = [[16.982, -6.369], [17.106, -5.977], [17.184, -5.568], [17.24, -4.666], [17.239, 4.701], [17.175, 5.631], [17.081,
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

// Outer surface of the swept +X end: [x, z] pairs; everything to the +X side of this curve is removed.
END_CURVE = [[7.26, 0.1], [9.72, 0.6], [11.02, 1.1], [11.96, 1.6], [12.7, 2.1], [13.31, 2.6], [13.83, 3.1], [14.27, 3.6], [14.66,
        4.1], [15, 4.6], [15.29, 5.1], [15.56, 5.6], [15.79, 6.1], [16, 6.6], [16.19, 7.1], [16.35, 7.6], [16.5, 8.1],
        [16.63, 8.6], [16.74, 9.1], [16.84, 9.6], [16.93, 10.1], [17, 10.6], [17.06, 11.1], [17.12, 11.6], [17.16,
        12.1], [17.19, 12.6], [17.22, 13.1], [17.23, 13.6], [17.24, 14.1]];
END_TOP_X = 20;       // any x beyond the rim, closes the cutter polygon

// Notch through both end walls: an elliptical cylinder along X (half-width along Y, half-height along Z, centre height).
NOTCH_A  = 4.4;
NOTCH_C  = 6.4;
NOTCH_Z0 = 14.391;
NOTCH_LEN = 60;       // longer than the part

// Region kept below the swept end, in the (x, z) plane: from far -X across the floor and up the curve. HEADROOM makes the
// region taller than the part so that insetting it does not create a lid.
HEADROOM = 10;
module keep_region() {
  polygon(concat([[-30, -HEADROOM], [END_CURVE[0][0], -HEADROOM]], END_CURVE, [[END_TOP_X, HEIGHT + HEADROOM], [-30, HEIGHT + HEADROOM]]));
}

module plan() offset(delta = FIT) polygon(PLAN);
module fitted_keep_region() offset(delta = FIT) keep_region();

module across_y(len) rotate([90, 0, 0]) linear_extrude(height = len, center = true) children();

module topminibox_box() {
  difference() {
    intersection() {
      linear_extrude(height = HEIGHT) plan();
      across_y(40) fitted_keep_region();
    }
    intersection() {
      translate([0, 0, WALL]) linear_extrude(height = HEIGHT) offset(delta = -WALL) plan();
      across_y(40) offset(delta = -WALL) fitted_keep_region();
    }
    translate([0, 0, NOTCH_Z0]) rotate([0, 90, 0]) scale([NOTCH_C, NOTCH_A, 1]) cylinder(r = 1, h = NOTCH_LEN, center = true, $fn = ROUNDNESS);
  }
}

scale(SCALE) topminibox_box();
