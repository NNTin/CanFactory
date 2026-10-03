// Latch 12mm 4 (link) - OpenSCAD reconstruction.
//
// Adapted from "Toggle Latch" on MakerWorld (https://makerworld.com/de/models/625647-toggle-latch), a remix of
// "M3 toggle corner latch" by Hacky97 (https://www.thingiverse.com/thing:5993215). Licensed CC BY-NC 4.0
// (https://creativecommons.org/licenses/by-nc/4.0/). This file is a derivative reconstruction of the design's STL
// (Latch 12mm 4.stl) made for CanFactory; it grants no additional rights to the original. See ../ATTRIBUTION.md.
//
// Geometry: two 2 mm side bars (a measured side profile (X, Z) extruded along Y, with a 0.6 mm chamfer on their outer
// faces), each with the hole for the lever's pin, joined at the other end by the round bar that hooks over the catch.
// Millimetres, in the STL's own frame moved to its bounding box's corner; printed as it lies.

// Facets around a full circle.
ROUNDNESS = 96; //[32:8:192]

HOLE_D       = 5.0;
HOLE_CENTRE  = [29.15, 4.996];   // (x, z)
SIDE         = 2;
SIDE_CHAMFER = 0.6;
WIDTH        = 17.402;

LINK_SIDE = [
    [1.523, 7.132], [1.254, 6.908], [0.952, 6.592], [0.487, 5.913], [0.283, 5.477], [0.057, 4.686], [0.006, 4.253],
    [0.002, 3.817], [0.053, 3.337], [0.135, 2.958], [0.274, 2.544], [0.475, 2.102], [0.7, 1.731], [1.234, 1.105],
    [1.566, 0.824], [1.927, 0.578], [2.311, 0.373], [2.714, 0.207], [3.133, 0.089], [3.563, 0.022], [3.998, 0.0],
    [29.148, 0.0], [29.636, 0.024], [30.118, 0.09], [30.592, 0.208], [31.052, 0.372], [31.494, 0.58],
    [31.912, 0.828], [32.306, 1.12], [32.67, 1.448], [33.0, 1.804], [33.292, 2.196], [33.546, 2.612],
    [33.756, 3.052], [33.924, 3.51], [34.046, 3.982], [34.122, 4.464], [34.146, 4.948], [34.13, 5.438],
    [34.06, 5.922], [33.948, 6.396], [33.792, 6.86], [33.588, 7.3], [33.342, 7.722], [33.056, 8.118],
    [32.73, 8.484], [32.378, 8.816], [31.986, 9.112], [31.572, 9.368], [31.138, 9.586], [30.682, 9.758],
    [30.208, 9.886], [29.18, 10.026]];

LINK_BAR = [
    [3.998, 0.0], [4.44, 0.023], [4.876, 0.094], [5.302, 0.214], [5.763, 0.41], [6.148, 0.626], [6.598, 0.956],
    [9.014, 3.03], [9.178, 3.24], [9.298, 3.478], [9.374, 3.732], [9.398, 3.994], [9.374, 4.264], [9.298, 4.516],
    [9.178, 4.754], [9.014, 4.964], [6.507, 7.111], [6.148, 7.37], [5.752, 7.592], [1.514, 7.132], [1.144, 6.8],
    [0.881, 6.504], [0.624, 6.142], [0.405, 5.751], [0.23, 5.339], [0.091, 4.861], [0.023, 4.419], [0.0, 3.97],
    [0.029, 3.528], [0.101, 3.088], [0.229, 2.658], [0.403, 2.246], [0.622, 1.855], [0.879, 1.491], [1.177, 1.158],
    [1.511, 0.864], [1.876, 0.607], [2.272, 0.393], [2.683, 0.218], [3.111, 0.095], [3.552, 0.024]];

module along_y(y0, y1) { translate([0, y1, 0]) rotate([90, 0, 0]) linear_extrude(y1 - y0) children(); }

// one side bar with its outer face at y = 0 (chamfered in three 0.2 mm steps) and its inner face at y = SIDE
module side() {
    for (i = [0:2]) along_y(i * SIDE_CHAMFER / 3, (i + 1) * SIDE_CHAMFER / 3 + 0.01)
        offset(delta = -SIDE_CHAMFER * (5 - 2 * i) / 6) polygon(LINK_SIDE);
    along_y(SIDE_CHAMFER, SIDE) polygon(LINK_SIDE);
}

difference() {
    union() {
        side();
        translate([0, WIDTH, 0]) mirror([0, 1, 0]) side();
        along_y(SIDE - 0.01, WIDTH - SIDE + 0.01) polygon(LINK_BAR);
    }
    translate([HOLE_CENTRE[0], -1, HOLE_CENTRE[1]]) rotate([-90, 0, 0]) cylinder(d = HOLE_D, h = WIDTH + 2, $fn = ROUNDNESS);
}
