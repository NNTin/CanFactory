// Outside-corner toggle latch: base. Millimetres; print as generated.
// Adapted from CanFactory's toggle-latch reconstruction of "Toggle Latch" on MakerWorld,
// a remix of Hacky97's "M3 toggle corner latch". CC BY-NC 4.0; see ATTRIBUTION.md.
// Changed mounting feet and screw axes; the knuckle, hook, lever and link geometry is unchanged.

// Facets around a full circle.
ROUNDNESS = 96; //[32:8:192]

PLATE_LENGTH = 38;
PLATE_HEIGHT = 11.998;
PLATE_FRONT  = 11.376;   // y of the face the screw heads sit in (the knuckle side)
PLATE_BACK   = 15.372;   // y of the face that lies on the mounting surface
EDGE_RADIUS  = 1;

HOLE_X       = [5.769, 32.184];
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

KNUCKLE_X    = [14.7, 23.298];
PIN_X        = [12.5, 25.498];
PIN_D        = 4.41;
PIN_CENTRE   = [5.115, 4.891];   // (y, z)

BASE_KNUCKLE = [
    [0.0, 4.86], [0.082, 4.092], [0.278, 3.348], [0.588, 2.642], [1.004, 1.994], [1.51, 1.414], [2.106, 0.922],
    [2.764, 0.526], [3.48, 0.236], [4.23, 0.058], [4.998, 0.002], [15.372, 0.002], [15.372, 11.994],
    [12.296, 11.998], [11.918, 11.956], [11.564, 11.83], [11.426, 11.716], [11.376, 11.59], [11.326, 9.63],
    [2.466, 9.63], [1.318, 8.384], [0.842, 7.778], [0.464, 7.104], [0.196, 6.384], [0.038, 5.63]];

module plate() {
    r = EDGE_RADIUS;
    hull() {
        for (x = [r, PLATE_LENGTH - r], z = [r, LEG_LENGTH - r])
            translate([x, PLATE_FRONT + r, z]) sphere(r = r, $fn = 24);
        translate([0, PLATE_BACK, 0]) rotate([90, 0, 0]) linear_extrude(0.01)
            offset(r = r, $fn = 24) offset(delta = -r) square([PLATE_LENGTH, LEG_LENGTH]);
    }
}

module screw_hole(x) {
    translate([x, PLATE_FRONT, HOLE_AT]) rotate([-90, 0, 0]) wood_hole();
}

difference() {
    union() {
        plate();
        // the knuckle, kept off the plate's back face
        translate([KNUCKLE_X[0], 0, 0]) rotate([90, 0, 90]) linear_extrude(KNUCKLE_X[1] - KNUCKLE_X[0])
            intersection() { polygon(BASE_KNUCKLE); translate([-1, -1]) square([PLATE_FRONT + 2 + 1, PLATE_HEIGHT + 2]); }
        translate([PIN_X[0], PIN_CENTRE[0], PIN_CENTRE[1]]) rotate([0, 90, 0]) cylinder(d = PIN_D, h = PIN_X[1] - PIN_X[0], $fn = ROUNDNESS);
    }
    // Clearance for BOTH moving side bars: the link near the pivot, then the narrower
    // thumb pad. Keep the original stop and 2.5 mm of backing; the taper prints without
    // an unsupported ledge. The screw seats sit outside this relief for all valid settings.
    translate([9.5, PLATE_FRONT - 0.1, PLATE_HEIGHT])
        cube([19, PLATE_BACK - 2.5 - PLATE_FRONT + 0.1, 20 - PLATE_HEIGHT]);
    hull() {
        translate([9.5, PLATE_FRONT - 0.1, 19.99])
            cube([19, PLATE_BACK - 2.5 - PLATE_FRONT + 0.1, 0.01]);
        translate([11.75, PLATE_FRONT - 0.1, 23])
            cube([14.5, PLATE_BACK - 2.5 - PLATE_FRONT + 0.1, 0.01]);
    }
    translate([11.75, PLATE_FRONT - 0.1, 23])
        cube([14.5, PLATE_BACK - 2.5 - PLATE_FRONT + 0.1, LEG_LENGTH]);
    for (x = HOLE_X) screw_hole(x);
}
