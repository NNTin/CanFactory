// 11 - Honeycomb - minibox: static OpenSCAD reconstruction (small elliptical holder with a side window).
//
// Adapted from "Onz" by sez16sez (Thingiverse): https://www.thingiverse.com/thing:2739061
// Licensed CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/). This file is a derivative reconstruction of
// the design's STL (11_-_Honeycomb_-_minibox.stl) made for CanFactory: same attribution, same non-commercial terms,
// no additional rights to the original. See ../ATTRIBUTION.md.
//
// Geometry: a free-form oval tube (10.9 x 21.8 mm) closed by a flat floor and an ellipsoidal-profile dome, with a
// elliptical window cut through the +X wall. Units are millimetres; the part is
// centred on the Z axis with its floor on z = 0. The source STL sat at (260.6, 77.4) on the print plate, floor at 0.86.
// Static reconstruction: named dimensions only, no parameter interface yet.

SCALE     = 1;
ROUNDNESS = 96;

// Wall outline at mid height (x, y) about the part centre: outer skin and cavity. Both are free-form (not ellipses).
OUTER = [[0.838, 10.852], [0.225, 10.915], [-0.511, 10.895], [-1.173, 10.779], [-1.695, 10.609], [-2.157, 10.39], [-2.672,
         10.046], [-3.242, 9.514], [-3.595, 9.078], [-4.011, 8.412], [-4.306, 7.808], [-4.589, 7.075], [-4.843,
         6.215], [-5.018, 5.448], [-5.202, 4.342], [-5.326, 3.226], [-5.4, 2.107], [-5.436, 0.76], [-5.43, -1.21],
         [-5.368, -2.667], [-5.271, -3.785], [-5.119, -4.896], [-4.898, -5.996], [-4.659, -6.861], [-4.394, -7.601],
         [-4.011, -8.412], [-3.595, -9.078], [-3.242, -9.514], [-2.672, -10.046], [-2.161, -10.388], [-1.595,
         -10.648], [-0.838, -10.852], [-0.273, -10.913], [0.28, -10.914], [1.068, -10.804], [1.592, -10.649], [2.157,
         -10.39], [2.672, -10.046], [3.087, -9.677], [3.595, -9.078], [3.901, -8.608], [4.166, -8.114], [4.475,
         -7.392], [4.756, -6.539], [4.898, -5.997], [5.197, -4.38], [5.32, -3.292], [5.396, -2.191], [5.433, -1.026],
         [5.433, 1.026], [5.396, 2.191], [5.32, 3.292], [5.197, 4.38], [5.018, 5.448], [4.756, 6.539], [4.589, 7.075],
         [4.394, 7.601], [4.011, 8.412], [3.595, 9.078], [3.242, 9.514], [2.672, 10.046], [2.161, 10.388], [1.595,
         10.648]];
INNER = [[-1.424, 9.673], [-0.871, 9.862], [-0.293, 9.952], [0.29, 9.952], [0.793, 9.879], [1.356, 9.701], [1.757, 9.499],
         [2.169, 9.208], [2.59, 8.801], [2.948, 8.337], [3.25, 7.835], [3.505, 7.299], [3.736, 6.686], [3.907, 6.125],
         [4.154, 5.041], [4.395, 3.264], [4.475, 2.121], [4.512, 0.968], [4.512, -0.968], [4.475, -2.121], [4.385,
         -3.369], [4.248, -4.483], [4.038, -5.603], [3.891, -6.185], [3.53, -7.235], [3.25, -7.835], [2.948, -8.337],
         [2.537, -8.857], [2.226, -9.159], [1.934, -9.386], [1.424, -9.673], [0.871, -9.862], [0.293, -9.952],
         [-0.215, -9.957], [-0.579, -9.92], [-1.153, -9.78], [-1.427, -9.671], [-1.874, -9.425], [-2.226, -9.159],
         [-2.59, -8.801], [-2.948, -8.337], [-3.25, -7.835], [-3.505, -7.299], [-3.887, -6.199], [-4.151, -5.056],
         [-4.263, -4.38], [-4.397, -3.238], [-4.474, -2.145], [-4.51, -1.05], [-4.498, 1.559], [-4.439, 2.73],
         [-4.331, 3.871], [-4.165, 4.981], [-4.038, 5.603], [-3.891, 6.185], [-3.53, 7.235], [-3.25, 7.835], [-2.948,
         8.337], [-2.589, 8.801], [-2.226, 9.159], [-1.87, 9.428]];

// Dome: above z = 29.4 (outer) and 28.7 (cavity) the outline shrinks about the centre; [z, scale] pairs, scale relative to
// the wall outline. The last pair is a tiny flat cap.
DOME_OUT = [[29.4, 1], [29.65, 0.965], [29.9, 0.957], [30.15, 0.944], [30.4, 0.924], [30.65, 0.898], [30.9, 0.865], [31.15, 0.823],
            [31.4, 0.772], [31.65, 0.71], [31.9, 0.633], [32.15, 0.535], [32.4, 0.401], [32.65, 0.155], [32.695, 0.02]];
DOME_IN  = [[28.6, 1], [28.75, 0.965], [29, 0.958], [29.25, 0.945], [29.5, 0.925], [29.75, 0.898], [30, 0.864], [30.25, 0.821],
            [30.5, 0.768], [30.75, 0.703], [31, 0.622], [31.25, 0.516], [31.5, 0.367], [31.7, 0.15], [31.76, 0.02]];
FLOOR_T = 0.93;

// Window: an elliptical cutter running along X through the +X wall (half-width along Y, half-height and centre along Z).
WINDOW_A  = 9.16;
WINDOW_C  = 13.15;
WINDOW_Z0 = 14.5;

// Stack of scaled slices following the [z, scale] table TAB over the outline POLY.
module dome(poly, tab) {
  for (k = [0 : len(tab) - 2])
    translate([0, 0, tab[k][0]])
      linear_extrude(height = tab[k + 1][0] - tab[k][0], scale = tab[k + 1][1] / tab[k][1]) scale(tab[k][1]) polygon(poly);
}

module minibox() {
  difference() {
    union() {
      linear_extrude(height = DOME_OUT[0][0] + 0.01) polygon(OUTER);
      dome(OUTER, DOME_OUT);
    }
    union() {
      translate([0, 0, FLOOR_T]) linear_extrude(height = DOME_IN[0][0] - FLOOR_T + 0.01) polygon(INNER);
      dome(INNER, DOME_IN);
    }
    translate([0, 0, WINDOW_Z0]) rotate([0, 90, 0]) scale([WINDOW_C, WINDOW_A, 1]) cylinder(r = 1, h = 20, $fn = ROUNDNESS);
  }
}

scale(SCALE) minibox();
