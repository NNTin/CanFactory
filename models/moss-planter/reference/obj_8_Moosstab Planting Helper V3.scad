// Moosstab Planting Helper V3 - parametric OpenSCAD reconstruction.
//
// Adapted from "Moss Tower Verdura - The Modular Climbing Support" by HpInvent (MakerWorld):
// https://makerworld.com/de/models/1200114-moss-tower-verdura-the-modular-climbing-support
// This file is a derivative reconstruction of that design's STL (obj_8_Moosstab Planting Helper V3.stl) made for
// CanFactory; it grants no additional rights to the original. See ../ATTRIBUTION.md.
//
// A 85 mm x 97 mm helper: a shallow slotted base plate with a rim, a hub carrying a cross of four fins that blends
// into a conical shoulder pierced by four holes, and a hollow funnel socket with a right-handed male thread (pitch
// 5 mm, the same thread as the ground spike) on top. Units are millimetres; the part is centred on the Z axis with
// its base on z = 0. Source STL sat at (1015, 160) on the print plate.
// This file is obj_6_Moosstab Planting Helper V3.scad scaled by 100/52; only SCALE and this header differ.

// Uniform scale (1 = 85 mm base diameter).
SCALE        = 100 / 52;
// Facets around a full circle.
ROUNDNESS    = 180; //[48:12:360]

THREAD_PITCH = 5;
THREAD_TURN  = 1;         // 1 = right-handed, -1 = left-handed
RING_Z0      = 87;        // where the threaded ring starts
TOP_Z        = 97;
HOLE_XY      = 8;         // the four holes sit at (+-HOLE_XY, +-HOLE_XY)
HOLE_R       = 2.25;
SLOT_R       = 2;         // the four base slots run along the diagonals
SLOT_FROM    = 15.25;     // slot end centres, measured from the axis
SLOT_TO      = 34.38;

// Revolved body (radius, z): plate with rim, hub with its fillet, cone, wall, funnel and threaded ring core.
BODY = [[0, 0], [42, 0], [42.5, 0.5], [42.5, 3.5], [42, 4], [40.5, 4], [40, 3.5], [40, 2.5], [39.5, 2],
        [14.283, 2.002], [12.121, 2.124], [10.154, 2.453], [9.651, 2.719], [9.159, 3.169], [8.816, 3.685],
        [8.581, 4.325], [8.503, 5], [8.503, 53.037], [8.584, 54.604], [8.878, 56.386], [9.239, 57.687],
        [9.715, 58.951], [10.302, 60.166], [11.187, 61.604], [25.691, 80.597], [25.983, 81.291], [26, RING_Z0],
        [18.4, RING_Z0], [18.4, TOP_Z], [17.345, TOP_Z], [16.788, 96.034], [13.993, 85.59], [13.692, 83.983],
        [13.567, 82.352], [13.563, 72], [0, 84]];

// The funnel socket, cut out again after the fins are added so the fins do not fill it.
SOCKET = [[0, 84], [13.563, 72], [13.567, 82.352], [13.692, 83.983], [13.993, 85.59], [16.788, 96.034], [17.345, TOP_Z],
          [17.345, TOP_Z + 1], [0, TOP_Z + 1]];

// Thread ridge profile: [phase from the crest, radius] (periodic with THREAD_PITCH).
RIDGE = [[-0.5, 19.708], [-0.311, 19.892], [-0.15, 19.98], [0, 20.001], [0.15, 19.98], [0.311, 19.892],
         [1.742, 18.5], [3.258, 18.5], [4.5, 19.708]];
RIDGE_CREST_Z = 92;       // height of the crest at angle 0

// Eighth of the hub-and-fins cross (between the +x axis and the diagonal): fin of half-width 2 and length 26 with a
// rounded end, blending into the round hub (radius 8.5). The full cross is this mirrored and rotated.
CROSS_EIGHTH = [[0, 0], [26, 0], [25.989, 0.636], [25.927, 0.947], [25.85, 1.143], [25.685, 1.413], [25.384, 1.708],
                [25.11, 1.868], [24.706, 1.985], [9.368, 2.0], [9.049, 2.034], [8.844, 2.094], [8.469, 2.299],
                [8.167, 2.601], [8.003, 2.876], [7.547, 3.91], [7.163, 4.576], [6.561, 5.403], [6.0, 6.0]];

module cross() {
    for (a = [0, 90, 180, 270]) rotate(a) {
        polygon(CROSS_EIGHTH);
        mirror([0, 1]) polygon(CROSS_EIGHTH);
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
    h = TOP_Z - RING_Z0;
    translate([0, 0, RING_Z0])
        linear_extrude(height = h, twist = -THREAD_TURN * 360 * h / THREAD_PITCH, slices = ceil(h / THREAD_PITCH * 72), convexity = 10)
            ridge_section(RING_Z0);
}

module helper() {
    difference() {
        union() {
            rotate_extrude($fn = ROUNDNESS) polygon(BODY);
            translate([0, 0, 1.5]) linear_extrude(height = 83.5, convexity = 6) cross();
            thread();
        }
        rotate_extrude($fn = ROUNDNESS) polygon(SOCKET);
        // Base slots on the diagonals.
        for (a = [45, 135, 225, 315]) rotate(a)
            translate([0, 0, -1]) linear_extrude(height = 3.01, convexity = 4)
                hull() {
                    translate([SLOT_FROM, 0]) circle(r = SLOT_R, $fn = 48);
                    translate([SLOT_TO, 0]) circle(r = SLOT_R, $fn = 48);
                }
        // Holes through the conical shoulder.
        for (sx = [-1, 1], sy = [-1, 1])
            translate([sx * HOLE_XY, sy * HOLE_XY, 50]) cylinder(h = 30, r = HOLE_R, $fn = 48);
    }
}

scale(SCALE) helper();
