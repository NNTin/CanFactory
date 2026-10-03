// Latch 12mm 1 (catch) - OpenSCAD reconstruction.
//
// Adapted from "Toggle Latch" on MakerWorld (https://makerworld.com/de/models/625647-toggle-latch), a remix of
// "M3 toggle corner latch" by Hacky97 (https://www.thingiverse.com/thing:5993215). Licensed CC BY-NC 4.0
// (https://creativecommons.org/licenses/by-nc/4.0/). This file is a derivative reconstruction of the design's STL
// (Latch 12mm 1.stl) made for CanFactory; it grants no additional rights to the original. See ../ATTRIBUTION.md.
//
// Geometry: a 38 x 12 x 4 mm mounting plate standing on its long edge (front edges rounded), with two countersunk
// M3 holes, and the catch's hook: a measured side profile (Y, Z) extruded along X, its ends stepped in by the 1 mm
// end chamfer. Millimetres, in the STL's own frame moved to its bounding box's corner; printed as it lies.

// Facets around a full circle.
ROUNDNESS = 96; //[32:8:192]

PLATE_LENGTH = 37.996;
PLATE_HEIGHT = 11.998;
PLATE_FRONT  = 10.4;     // y of the face the screw heads sit in (the hook side)
PLATE_BACK   = 14.4;     // y of the face that lies on the mounting surface
EDGE_RADIUS  = 1;        // rounding of the front edges and of the plate's corners

HOLE_X       = [5.766, 32.18];
HOLE_Z       = 5.93;
HOLE_D       = 3.4;      // DIN EN 20273 medium clearance hole for M3
SINK_D       = 6.29;     // countersink diameter on the front face, 90 degrees

HOOK_X       = [12.492, 25.492];
HOOK_CHAMFER = 1;

CATCH_HOOK = [
    [10.816, 11.92], [10.508, 11.776], [10.4, 11.588], [10.35, 9.628], [10.35, 5.472], [10.17, 5.72],
    [9.978, 5.84], [9.756, 5.9], [9.256, 5.95], [9.026, 5.936], [8.79, 5.864], [8.534, 5.716], [8.168, 5.384],
    [7.35, 4.28], [7.099, 3.994], [6.7, 3.709], [6.274, 3.538], [5.749, 3.464], [5.224, 3.533], [4.8, 3.704],
    [4.401, 3.987], [4.058, 4.398], [3.862, 4.811], [3.647, 5.393], [3.399, 5.723], [3.066, 5.979], [2.683, 6.139],
    [2.276, 6.199], [1.858, 6.145], [1.473, 5.992], [1.118, 5.72], [0.871, 5.39], [0.726, 5.037], [0.032, 1.812],
    [0.0, 1.495], [0.049, 1.107], [0.2, 0.745], [0.442, 0.438], [0.75, 0.201], [1.084, 0.059], [1.498, 0.0],
    [14.4, 0.002], [14.4, 11.992], [11.402, 11.998]];

CATCH_HOOK_END = [
    [10.84, 11.924], [10.508, 11.776], [10.4, 11.588], [10.359, 9.928], [10.365, 5.435], [10.328, 5.528],
    [10.17, 5.72], [9.978, 5.84], [9.641, 5.914], [8.073, 3.757], [7.704, 3.345], [7.266, 3.007], [6.82, 2.777],
    [6.289, 2.624], [5.738, 2.572], [5.189, 2.622], [4.659, 2.783], [4.169, 3.038], [3.738, 3.384], [3.412, 3.767],
    [3.132, 4.244], [2.889, 4.926], [2.789, 5.07], [2.66, 5.185], [2.507, 5.263], [2.334, 5.305], [1.996, 5.256],
    [1.843, 5.171], [1.717, 5.054], [1.623, 4.909], [1.569, 4.746], [0.901, 1.626], [0.917, 1.322], [1.079, 1.06],
    [1.305, 0.923], [1.498, 0.89], [10.35, 0.895], [10.361, 0.05], [10.442, 0.009], [14.4, 0.027], [14.4, 11.971],
    [14.088, 11.997], [11.376, 11.998]];

module plate() {
    r = EDGE_RADIUS;
    hull() {
        for (x = [r, PLATE_LENGTH - r], z = [r, PLATE_HEIGHT - r])
            translate([x, PLATE_FRONT + r, z]) sphere(r = r, $fn = 24);
        translate([0, PLATE_BACK, 0]) rotate([90, 0, 0]) linear_extrude(0.01)
            offset(r = r, $fn = 24) offset(delta = -r) square([PLATE_LENGTH, PLATE_HEIGHT]);
    }
}

module screw_hole(x) {
    translate([x, 0, HOLE_Z]) rotate([-90, 0, 0]) {
        translate([0, 0, PLATE_FRONT - 1]) cylinder(d = HOLE_D, h = PLATE_BACK - PLATE_FRONT + 2, $fn = ROUNDNESS);
        // 90 degree cone from SINK_D on the front face down to the hole, overshooting the face by 0.5 mm
        translate([0, 0, PLATE_FRONT - 0.5]) cylinder(d1 = SINK_D + 1, d2 = 0, h = (SINK_D + 1) / 2, $fn = ROUNDNESS);
    }
}

// a side profile (Y, Z) extruded along X from x0 to x1; the part of it inside the plate is kept off the plate's back face
module along_x(profile, x0, x1) {
    translate([x0, 0, 0]) rotate([90, 0, 90]) linear_extrude(x1 - x0)
        intersection() { polygon(profile); translate([-1, -1]) square([PLATE_FRONT + 2 + 1, PLATE_HEIGHT + 2]); }
}

difference() {
    union() {
        plate();
        along_x(CATCH_HOOK, HOOK_X[0] + HOOK_CHAMFER, HOOK_X[1] - HOOK_CHAMFER);
        along_x(CATCH_HOOK_END, HOOK_X[0], HOOK_X[1]);
    }
    for (x = HOLE_X) screw_hole(x);
}
