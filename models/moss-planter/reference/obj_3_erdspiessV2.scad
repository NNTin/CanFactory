// Moosstab Erdspiess V2 (ground spike) - parametric OpenSCAD reconstruction.
//
// Adapted from "Moss Tower Verdura - The Modular Climbing Support" by HpInvent (MakerWorld):
// https://makerworld.com/de/models/1200114-moss-tower-verdura-the-modular-climbing-support
// This file is a derivative reconstruction of that design's STL (obj_3_erdspiessV2.stl) made for CanFactory; it
// grants no additional rights to the original. See ../ATTRIBUTION.md.
//
// A 41 mm x 124 mm spike: a threaded, hollow base (right-handed male thread, pitch 5 mm, that screws into the RAUTE
// segments' female thread) with a conical roof pierced by four drain holes, carrying a cross of four fins that taper
// to a point. Units are millimetres; the part is centred on the Z axis with its base on z = 0.
// Source STL sat at (178.6, -615.4) on the print plate.
// obj_2_erdspiessV2.scad is the same part scaled by 100/52.

// Uniform scale (1 = 41 mm flange diameter).
SCALE        = 1;
// Facets around a full circle.
ROUNDNESS    = 180; //[48:12:360]

TIP_Z        = 124.003;   // apex of the tapering fins / cone
TIP_SLOPE    = 0.335;     // fin length lost per mm of height above the taper start
FIN_START_Z  = 24;        // the fins rise from inside the base
HOLE_XY      = 5.2;       // the four drain holes sit at (+-HOLE_XY, +-HOLE_XY)
HOLE_R       = 2.25;
THREAD_PITCH = 5;
THREAD_TURN  = 1;         // 1 = right-handed, -1 = left-handed

// Revolved body (radius, z): thread core, flange, wall, conical roof, and the hollow underneath.
BODY = [[16.81, 0], [18.4, 0], [18.4, 10], [18.767, 10], [20.149, 10.806], [20.44, 11.125], [20.57, 11.537],
        [20.573, 13.367], [20.483, 13.783], [20.227, 14.124], [18.985, 14.772], [18.784, 14.932], [18.558, 15.293],
        [18.5, 15.63], [18.5, 25.3], [18.437, 25.729], [18.192, 26.211], [0, 50.02], [0, 26.369], [13.563, 11.274],
        [13.563, 11], [16.251, 0.966]];

// Thread ridge profile: [phase from the crest, radius] (periodic with THREAD_PITCH).
RIDGE = [[-0.5, 19.708], [-0.311, 19.892], [-0.15, 19.98], [0, 20.001], [0.15, 19.98], [0.311, 19.892],
         [1.742, 18.5], [3.258, 18.5], [4.5, 19.708]];
RIDGE_CREST_Z = 5;        // height of the crest at angle 0

// Eighth of the fin cross (between the +x axis and the diagonal): fin of half-width 2 with a rounded end and a
// generous concave blend into the neighbouring fin. The full cross is this mirrored and rotated.
CROSS_EIGHTH = [[0, 0], [18.5, 0], [18.492, 0.544], [18.471, 0.753], [18.386, 1.056], [18.239, 1.334], [17.96, 1.647],
                [17.699, 1.823], [17.306, 1.967], [16.993, 2.0], [5.37, 2.004], [5.054, 2.061], [4.763, 2.181],
                [4.57, 2.306], [4.343, 2.519], [3.866, 3.171], [3.532, 3.532]];

module cross() {
    for (a = [0, 90, 180, 270]) rotate(a) {
        polygon(CROSS_EIGHTH);
        mirror([0, 1]) polygon(CROSS_EIGHTH);
    }
}

// Fins: the cross clipped by a cone that starts at the fin length and ends in a point at TIP_Z.
module fins() {
    intersection() {
        translate([0, 0, FIN_START_Z]) linear_extrude(height = TIP_Z - FIN_START_Z, convexity = 6) cross();
        cylinder(h = TIP_Z, r1 = TIP_SLOPE * TIP_Z, r2 = 0, $fn = ROUNDNESS);
    }
}

function ridge_r(phase) = lookup(((phase + 0.5) % THREAD_PITCH + THREAD_PITCH) % THREAD_PITCH - 0.5, RIDGE);

// Ridge cross-section on plane z0 (polar outline that turns with height).
module ridge_section(z0) {
    n = ROUNDNESS;
    difference() {
        polygon([for (i = [0 : n - 1]) let (a = 360 * i / n,
                 ph = z0 - RIDGE_CREST_Z - THREAD_TURN * THREAD_PITCH * a / 360)
                 ridge_r(ph) * [cos(a), sin(a)]]);
        circle(r = 18, $fn = n);
    }
}

module thread() {
    h = 10;
    linear_extrude(height = h, twist = -THREAD_TURN * 360 * h / THREAD_PITCH, slices = ceil(h / THREAD_PITCH * 72), convexity = 10)
        ridge_section(0);
}

module spike() {
    difference() {
        union() {
            rotate_extrude($fn = ROUNDNESS) polygon(BODY);
            thread();
            fins();
        }
        for (sx = [-1, 1], sy = [-1, 1])
            translate([sx * HOLE_XY, sy * HOLE_XY, 10]) cylinder(h = 40, r = HOLE_R, $fn = 48);
    }
}

scale(SCALE) spike();
