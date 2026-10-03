// Latch 12mm 2 (base) - parametric generator.
//
// Adapted from "Toggle Latch" on MakerWorld (https://makerworld.com/de/models/625647-toggle-latch), a remix of
// "M3 toggle corner latch" by Hacky97 (https://www.thingiverse.com/thing:5993215). Licensed CC BY-NC 4.0
// (https://creativecommons.org/licenses/by-nc/4.0/). This file is a derivative of the reconstruction of Latch 12mm 2.stl
// in reference/, made for CanFactory, with the screw holes sized for a chosen screw; it grants no additional rights to the
// original. See ATTRIBUTION.md.
//
// Geometry: the same 38 x 12 x 4 mm mounting plate as the catch, with two screw holes sized for the chosen screw, and the lever's
// knuckle: a measured side profile (Y, Z) extruded along X, with the pivot pins (4.4 mm) standing out of both ends.
// Millimetres, in the STL's own frame moved to its bounding box's corner; printed as it lies.

// Facets around a full circle.
ROUNDNESS = 96; //[32:8:192]

PLATE_LENGTH = 38;
PLATE_HEIGHT = 11.998;
PLATE_FRONT  = 11.376;   // y of the face the screw heads sit in (the knuckle side)
PLATE_BACK   = 15.372;   // y of the face that lies on the mounting surface
EDGE_RADIUS  = 1;

HOLE_X       = [5.769, 32.184];
HOLE_Z       = 5.932;

// Screws (from the parts library; see packages/contracts/src/models.ts, toggleLatch). Both plates take the same two
// screws. A wood screw (DIN 7997) always has a countersunk head; a machine screw's head is countersunk, or sits on the
// front face (pan, button, socket cap, hexagon). The hole is the screw's clearance hole for HOLE_FIT; a countersunk head
// sits flush in a countersink as deep as the head is high, SINK_PLAY wider than the head.
SCREW_KIND = "wood"; //[wood,machine]
HOLE_FIT = "medium"; //[fine,medium,coarse]
// clearance holes (fine, medium, coarse) for the wood screw: its d + 0.3 / 0.5 / 0.8 mm
WOOD_HOLES = [4.3,4.5,4.8];
WOOD_D = 4;
WOOD_DK = 7.5;
WOOD_K = 2.2;
// DIN EN 20273 clearance holes (fine, medium, coarse) for the machine screw's thread
MACHINE_HOLES = [4.3,4.5,4.8];
MACHINE_HEAD = "countersunk"; //[countersunk,pan,button,socket-cap,hex]
MACHINE_D = 4;
// head diameter (across corners for a hexagon head)
MACHINE_DK = 8;
MACHINE_K = 2.3;
SINK_PLAY = 0.4;

WOOD        = SCREW_KIND == "wood";
FIT         = HOLE_FIT == "fine" ? 0 : HOLE_FIT == "coarse" ? 2 : 1;
HOLE_D      = (WOOD ? WOOD_HOLES : MACHINE_HOLES)[FIT];
COUNTERSUNK = WOOD || MACHINE_HEAD == "countersunk";
SINK_D      = (WOOD ? WOOD_DK : MACHINE_DK) + SINK_PLAY;
// the head's cylindrical rim above its 90 degree cone (0 for a pure cone)
SINK_RIM    = max(0, (WOOD ? WOOD_K : MACHINE_K) - ((WOOD ? WOOD_DK : MACHINE_DK) - (WOOD ? WOOD_D : MACHINE_D)) / 2);

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
        for (x = [r, PLATE_LENGTH - r], z = [r, PLATE_HEIGHT - r])
            translate([x, PLATE_FRONT + r, z]) sphere(r = r, $fn = 24);
        translate([0, PLATE_BACK, 0]) rotate([90, 0, 0]) linear_extrude(0.01)
            offset(r = r, $fn = 24) offset(delta = -r) square([PLATE_LENGTH, PLATE_HEIGHT]);
    }
}

module screw_hole(x) {
    translate([x, 0, HOLE_Z]) rotate([-90, 0, 0]) {
        translate([0, 0, PLATE_FRONT - 1]) cylinder(d = HOLE_D, h = PLATE_BACK - PLATE_FRONT + 2, $fn = ROUNDNESS);
        if (COUNTERSUNK) {
            // the head's rim, then a 90 degree cone from SINK_D down to the hole; both overshoot the front face by 0.5 mm
            translate([0, 0, PLATE_FRONT - 0.5]) cylinder(d = SINK_D, h = SINK_RIM + 0.5, $fn = ROUNDNESS);
            translate([0, 0, PLATE_FRONT + SINK_RIM - 0.01]) cylinder(d1 = SINK_D, d2 = 0, h = SINK_D / 2, $fn = ROUNDNESS);
        }
    }
}

difference() {
    union() {
        plate();
        // the knuckle, kept off the plate's back face
        translate([KNUCKLE_X[0], 0, 0]) rotate([90, 0, 90]) linear_extrude(KNUCKLE_X[1] - KNUCKLE_X[0])
            intersection() { polygon(BASE_KNUCKLE); translate([-1, -1]) square([PLATE_FRONT + 2 + 1, PLATE_HEIGHT + 2]); }
        translate([PIN_X[0], PIN_CENTRE[0], PIN_CENTRE[1]]) rotate([0, 90, 0]) cylinder(d = PIN_D, h = PIN_X[1] - PIN_X[0], $fn = ROUNDNESS);
    }
    for (x = HOLE_X) screw_hole(x);
}
