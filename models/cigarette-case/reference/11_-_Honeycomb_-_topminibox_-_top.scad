// 11 - Honeycomb - topminibox - top: static OpenSCAD reconstruction (lid that slides into the topminibox box).
//
// Adapted from "Onz" by sez16sez (Thingiverse): https://www.thingiverse.com/thing:2739061
// Licensed CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/). This file is a derivative reconstruction of
// the design's STL (11_-_Honeycomb_-_topminibox_-_top.stl) made for CanFactory: same attribution, same non-commercial
// terms, no additional rights to the original. See ../ATTRIBUTION.md.
//
// Geometry: the lid sits flush in the box, its cap level with the box's rim and its rim on the box's floor. Its outer surface is
// the box's inner surface pulled in by CLEARANCE: the box's D-shaped plan (mirrored in X) and the box's swept end (mirrored in X
// and turned over about the rim), as a 1 mm shell with a 1 mm cap at z = 0 (the lid is modelled as printed, cap down). The
// swept end sheet stops at SHEET_TOP; a half-ellipse pad on each end, concentric with the box's notch and CLEARANCE smaller,
// stands on the cap. Units are millimetres; the part is centred on the Z axis with the cap's underside on z = 0. The source
// STL sat at (244.0, -84.8) on the print plate. Named dimensions only; the parameters are SNAP and CLEARANCE. The swept end
// and pads are derived from the box, not the source STL's, whose end sheet collided with the box's swept end.

SCALE     = 1;
ROUNDNESS = 96;

HEIGHT = 13.391;      // rim height
WALL   = 1;           // wall and cap thickness
// Gap per side between mating surfaces (a -D override, mm), the same for every cigarette-case part; 0.2 is a snug fit.
CLEARANCE = 0.2;
// The box's outline, as in the box file: its measured plan and swept end are offset by FIT so that the closed box stands
// CLEARANCE inside the case lid's cavity.
BOX_HEIGHT = 14.391;  // the box's rim height; the lid's cap is level with it
FIT_GAP = 0.031;
FIT = FIT_GAP - CLEARANCE;
INSET = WALL + CLEARANCE - FIT;   // from the measured box outline to this lid's outer surface

// Box plan outline (x, y) about the box centre, as measured: rounded -X end, chamfered +X end. The lid uses it mirrored and inset.
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

// Outer surface of the box's swept +X end, as measured: [x, z] pairs in the box's frame (everything to the +X side is removed).
BOX_END_CURVE = [[7.26, 0.1], [9.72, 0.6], [11.02, 1.1], [11.96, 1.6], [12.7, 2.1], [13.31, 2.6], [13.83, 3.1], [14.27, 3.6], [14.66,
        4.1], [15, 4.6], [15.29, 5.1], [15.56, 5.6], [15.79, 6.1], [16, 6.6], [16.19, 7.1], [16.35, 7.6], [16.5, 8.1],
        [16.63, 8.6], [16.74, 9.1], [16.84, 9.6], [16.93, 10.1], [17, 10.6], [17.06, 11.1], [17.12, 11.6], [17.16,
        12.1], [17.19, 12.6], [17.22, 13.1], [17.23, 13.6], [17.24, 14.1]];
BOX_END_TOP_X = 20;
SHEET_TOP = 8;        // the swept end sheet is removed above this height (the ring walls keep following the curve)

// Detent pads: half-ellipses in the (y, z) plane standing on the cap, at both ends, out to PAD_X (the box's outer end face).
// They sit in the box's rim notches (half-width NOTCH_A, depth NOTCH_C, centred on the rim) with CLEARANCE all round.
NOTCH_A = 4.4;
NOTCH_C = 6.4;
PAD_A = NOTCH_A - CLEARANCE;   // half-width along Y
PAD_C = NOTCH_C - CLEARANCE;   // height
PAD_X = 17.24 + FIT;
PAD_IN_X = 17.192 - INSET - WALL / 2;   // pad reaches into the middle of the lid's end wall (the box plan's nearer end is at 17.192)

// Snap mechanism, chosen by SNAP (a -D override): "friction" (the original geometry, nothing added), "detent", "clip",
// "magnet" or "crush-ribs". The end pads above already latch into the box's notches, so they stay in every mode; only
// "crush-ribs" adds anything: three ribs on each straight side wall, squeezed by the box's wall.
SNAP = "friction";
LID_Y = 13.759 - INSET;   // outer face of the straight side walls (the box's inner face is CLEARANCE further out)
CRUSH_SQUEEZE = 0.1;
CRUSH_H = CLEARANCE + CRUSH_SQUEEZE;
CRUSH_X = [-2, 1.5, 5];
CRUSH_W = 0.5;
CRUSH_Z0 = 2;
CRUSH_Z1 = 13.2;      // the rim end is ramped so the box finds the ribs

module crush_ribs() {
  for (x = CRUSH_X, m = [0, 1]) mirror([0, m, 0]) translate([x - CRUSH_W / 2, 0, 0]) rotate([90, 0, 90]) linear_extrude(height = CRUSH_W)
    polygon([[LID_Y - 0.3, CRUSH_Z0], [LID_Y + CRUSH_H, CRUSH_Z0], [LID_Y + CRUSH_H, CRUSH_Z1 - 1.4], [LID_Y, CRUSH_Z1], [LID_Y - 0.3, CRUSH_Z1]]);
}

HEADROOM = 10;
module lid_plan() { mirror([1, 0]) offset(delta = -INSET) polygon(BOX_PLAN); }

// The box's region below its swept end, in its (x, z) plane (as keep_region() in the box file), taller than the box so that
// insetting it does not create a lid.
module box_keep_region() {
  polygon(concat([[-30, -HEADROOM], [BOX_END_CURVE[0][0], -HEADROOM]], BOX_END_CURVE, [[BOX_END_TOP_X, BOX_HEIGHT + HEADROOM], [-30, BOX_HEIGHT + HEADROOM]]));
}
// Region kept by the lid, in its own (x, z) plane: the box's region pulled in by INSET, turned over about the box's rim
// (lid z = BOX_HEIGHT - box z) and mirrored in X, as the lid is.
module keep_region() { translate([0, BOX_HEIGHT]) rotate(180) offset(delta = -INSET) box_keep_region(); }

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
    if (SNAP == "crush-ribs") crush_ribs();
  }
}

scale(SCALE) topminibox_top();
