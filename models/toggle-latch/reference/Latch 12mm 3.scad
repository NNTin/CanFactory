// Latch 12mm 3 (lever) - OpenSCAD reconstruction.
//
// Adapted from "Toggle Latch" on MakerWorld (https://makerworld.com/de/models/625647-toggle-latch), a remix of
// "M3 toggle corner latch" by Hacky97 (https://www.thingiverse.com/thing:5993215). Licensed CC BY-NC 4.0
// (https://creativecommons.org/licenses/by-nc/4.0/). This file is a derivative reconstruction of the design's STL
// (Latch 12mm 3.stl) made for CanFactory; it grants no additional rights to the original. See ../ATTRIBUTION.md.
//
// Geometry: two 2 mm side plates (a measured side profile (X, Z) extruded along Y, with a 0.6 mm chamfer on their
// outer faces) joined by the thumb bridge, each with the pivot hole for the base's pins and a pin standing out of
// it for the link. Millimetres, in the STL's own frame moved to its bounding box's corner; printed as it lies.
// Latch 12mm 3.scad and Latch 12mm 3 HiTol.scad are the same file but for HITOL: the high-tolerance lever has a
// larger pivot hole (5.14 instead of 4.99 mm) and thinner link pins (4.41 instead of 4.64 mm), each grown or shrunk
// from one side, as in the STL.

// true: the high-tolerance variant (Latch 12mm 3 HiTol.stl).
HITOL = false;
// Facets around a full circle.
ROUNDNESS = 96; //[32:8:192]

PIVOT_D      = HITOL ? 5.14 : 4.99;
PIVOT_CENTRE = HITOL ? [4.924, 8.965] : [4.999, 8.89];    // (x, z)
PIN_D        = HITOL ? 4.41 : 4.642;
PIN_CENTRE   = HITOL ? [14.771, 5.587] : [14.655, 5.705];

PIN_LENGTH   = 2.7;      // out of each side plate's outer face
PIN_CHAMFER  = 0.5;
SIDE         = 2;        // side plate thickness
SIDE_CHAMFER = 0.6;
WIDTH        = 18.4;     // over both pins

LEVER_SIDE = [
    [3.078, 13.506], [2.636, 13.3], [2.22, 13.05], [1.832, 12.76], [1.47, 12.436], [1.144, 12.074],
    [0.854, 11.688], [0.602, 11.272], [0.394, 10.834], [0.224, 10.377], [0.106, 9.91], [0.03, 9.428],
    [0.001, 8.944], [0.02, 8.46], [0.084, 7.978], [0.196, 7.506], [0.352, 7.048], [0.552, 6.604], [0.798, 6.184],
    [1.078, 5.788], [1.396, 5.422], [1.752, 5.092], [2.136, 4.793], [2.544, 4.534], [2.978, 4.318], [3.432, 4.144],
    [13.272, 0.9], [17.566, 0.001], [30.156, 0.003], [30.369, 0.02], [30.624, 0.087], [30.862, 0.194],
    [31.081, 0.343], [31.265, 0.526], [31.419, 0.74], [31.531, 0.979], [31.601, 1.231], [31.624, 1.494],
    [31.603, 1.756], [31.539, 2.009], [31.402, 2.285], [31.276, 2.464], [31.092, 2.648], [19.654, 9.318],
    [5.788, 13.898], [4.482, 13.866], [4.004, 13.792], [3.534, 13.67]];

LEVER_BRIDGE = [
    [23.14, 6.07], [22.966, 5.88], [22.822, 5.655], [22.719, 5.406], [22.665, 5.142], [22.656, 1.502],
    [22.699, 1.14], [22.791, 0.876], [22.924, 0.643], [23.1, 0.436], [23.303, 0.265], [23.537, 0.132],
    [23.791, 0.047], [24.058, 0.004], [30.294, 0.008], [30.554, 0.062], [30.804, 0.164], [31.034, 0.308],
    [31.232, 0.488], [31.396, 0.702], [31.516, 0.942], [31.596, 1.198], [31.624, 1.466], [31.606, 1.735],
    [31.542, 1.996], [31.432, 2.238], [31.276, 2.463], [31.09, 2.65], [30.878, 2.796], [24.91, 6.267],
    [24.655, 6.384], [24.38, 6.453], [24.126, 6.47], [23.86, 6.438], [23.602, 6.363], [23.36, 6.241]];

// a profile (X, Z) extruded along Y from y0 to y1
module along_y(y0, y1) { translate([0, y1, 0]) rotate([90, 0, 0]) linear_extrude(y1 - y0) children(); }

// one side plate with its outer face at y = 0 (chamfered in three 0.2 mm steps) and its inner face at y = SIDE
module side() {
    for (i = [0:2]) along_y(i * SIDE_CHAMFER / 3, (i + 1) * SIDE_CHAMFER / 3 + 0.01)
        offset(delta = -SIDE_CHAMFER * (5 - 2 * i) / 6) polygon(LEVER_SIDE);
    along_y(SIDE_CHAMFER, SIDE) polygon(LEVER_SIDE);
    // the link pin, chamfered at its end
    translate([PIN_CENTRE[0], 0, PIN_CENTRE[1]]) rotate([90, 0, 0]) {
        translate([0, 0, -0.01]) cylinder(d = PIN_D, h = PIN_LENGTH - PIN_CHAMFER + 0.01, $fn = ROUNDNESS);
        translate([0, 0, PIN_LENGTH - PIN_CHAMFER]) cylinder(d1 = PIN_D, d2 = PIN_D - 2 * PIN_CHAMFER, h = PIN_CHAMFER, $fn = ROUNDNESS);
    }
}

difference() {
    union() {
        translate([0, PIN_LENGTH, 0]) side();
        translate([0, WIDTH - PIN_LENGTH, 0]) mirror([0, 1, 0]) side();
        along_y(PIN_LENGTH + SIDE - 0.01, WIDTH - PIN_LENGTH - SIDE + 0.01) polygon(LEVER_BRIDGE);
    }
    translate([PIVOT_CENTRE[0], -1, PIVOT_CENTRE[1]]) rotate([-90, 0, 0]) cylinder(d = PIVOT_D, h = WIDTH + 2, $fn = ROUNDNESS);
}
