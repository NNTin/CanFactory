// Outside-corner toggle latch: catch. Millimetres; print as generated.
// Adapted from CanFactory's toggle-latch reconstruction of "Toggle Latch" on MakerWorld,
// a remix of Hacky97's "M3 toggle corner latch". CC BY-NC 4.0; see ATTRIBUTION.md.
// Changed mounting feet and screw axes; the knuckle, hook, lever and link geometry is unchanged.

// Facets around a full circle.
ROUNDNESS = 96; //[32:8:192]

PLATE_LENGTH = 37.996;
PLATE_HEIGHT = 11.998;
PLATE_FRONT  = 10.4;     // y of the face the screw heads sit in (the hook side)
PLATE_BACK   = 14.4;     // y of the face that lies on the mounting surface
EDGE_RADIUS  = 1;        // rounding of the front edges and of the plate's corners

HOLE_X       = [5.766, 32.18];
// Mounting feet: a 4 mm plate, two face-normal wood screws, past the butt joint.
// The mechanism does not scale. PLANK_T and EDGE_DISTANCE only extend the feet and move the holes.
PLANK_T = 18;
EDGE_DISTANCE = 18;
HOLE_AT = PLANK_T + EDGE_DISTANCE;
LEG_LENGTH = HOLE_AT + 8;
HOLE_FIT = "medium"; //[fine,medium,coarse]
WOOD_HOLES = [4.3,4.5,4.8];
WOOD_D = 4;
WOOD_DK = 7.5;
WOOD_K = 2.2;
SINK_PLAY = 0.4;
FIT = HOLE_FIT == "fine" ? 0 : HOLE_FIT == "coarse" ? 2 : 1;
HOLE_D = WOOD_HOLES[FIT];
SINK_D = WOOD_DK + SINK_PLAY;
SINK_RIM = max(0, WOOD_K - (WOOD_DK - WOOD_D) / 2);

// The seat is at local z = 0; positive z goes through the plate and into wood.
module wood_hole() {
    translate([0, 0, -0.5]) cylinder(d = HOLE_D, h = 5, $fn = ROUNDNESS);
    translate([0, 0, -0.5]) cylinder(d = SINK_D, h = SINK_RIM + 0.5, $fn = ROUNDNESS);
    translate([0, 0, SINK_RIM - 0.01]) cylinder(d1 = SINK_D, d2 = 0, h = SINK_D / 2, $fn = ROUNDNESS);
}

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

// The flange's back is z = 0 (the upright plank's outside face).
// In the assembled frame its screws point horizontally, perpendicular to the base's screws.
module screw_hole(x) {
    translate([x, PLATE_BACK + HOLE_AT, 4]) rotate([180, 0, 0]) wood_hole();
}

module corner_foot() {
    // Positive-volume overlap with the old hook shelf; no coplanar-only joint.
    // Inset the flange ends 0.05 mm from the rounded shelf’s tangent planes to avoid float32 slivers.
    translate([0.05, PLATE_FRONT + 1, 0]) cube([PLATE_LENGTH - 0.1, LEG_LENGTH + PLATE_BACK - PLATE_FRONT - 1, 4]);
    // Central gusset, below the moving mechanism and away from the screw heads.
    translate([HOOK_X[0], 0, 0]) rotate([90, 0, 90]) linear_extrude(HOOK_X[1] - HOOK_X[0])
        polygon([[PLATE_FRONT + 1, 3], [PLATE_FRONT + 1, 11], [PLATE_BACK + 12, 3]]);
}

// a side profile (Y, Z) extruded along X from x0 to x1; the part of it inside the plate is kept off the plate's back face
module along_x(profile, x0, x1) {
    translate([x0, 0, 0]) rotate([90, 0, 90]) linear_extrude(x1 - x0)
        intersection() { polygon(profile); translate([-1, -1]) square([PLATE_FRONT + 2 + 1, PLATE_HEIGHT + 2]); }
}

difference() {
    union() {
        plate();
        corner_foot();
        along_x(CATCH_HOOK, HOOK_X[0] + HOOK_CHAMFER, HOOK_X[1] - HOOK_CHAMFER);
        along_x(CATCH_HOOK_END, HOOK_X[0], HOOK_X[1]);
    }
    for (x = HOLE_X) screw_hole(x);
}
