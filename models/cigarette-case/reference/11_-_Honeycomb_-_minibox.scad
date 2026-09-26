// 11 - Honeycomb - minibox: static OpenSCAD reconstruction (small elliptical holder with a side window).
//
// Adapted from "Onz" by sez16sez (Thingiverse): https://www.thingiverse.com/thing:2739061
// Licensed CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/). This file is a derivative reconstruction of
// the design's STL (11_-_Honeycomb_-_minibox.stl) made for CanFactory: same attribution, same non-commercial terms,
// no additional rights to the original. See ../ATTRIBUTION.md.
//
// Geometry: a free-form oval tube (the bay's 11.8 x 22.8 mm, less CLEARANCE per side) closed by a flat floor and an
// ellipsoidal-profile dome, with an elliptical window cut through the +X wall. Units are millimetres; the part is
// centred on the Z axis with its floor on z = 0. The source STL sat at (260.6, 77.4) on the print plate, floor at 0.86.
// Named dimensions only; the parameters are CLEARANCE and HOLDER_SNAP. The holder slides into the large box's round bay, so its
// outer skin is that bay's outline pulled in by CLEARANCE (the source STL's skin stood 0.45 to 0.5 mm inside the bay); the
// cavity is as measured. The tab in the bay is only the upper stop: HOLDER_SNAP chooses what keeps the holder from dropping out
// through the open floor (see the holder retention block, identical in the box file).

SCALE     = 1;
ROUNDNESS = 96;

// Gap per side between mating surfaces (a -D override, mm), the same for every cigarette-case part; 0.2 is a snug fit.
CLEARANCE = 0.2;

// The large box's round bay (x, y), in the box's frame, as in the box file; the holder stands centred in it at x = BAY_X.
BAY_ROUND = [[-13.813, -10.401], [-14.397, -10.8], [-15.128, -11.136], [-15.685, -11.294], [-16.483, -11.401],
       [-17.191, -11.401], [-17.989, -11.294], [-18.546, -11.136], [-19.277, -10.8], [-19.85, -10.41], [-20.283, -10.016],
       [-20.806, -9.393], [-21.123, -8.908], [-21.497, -8.188], [-21.84, -7.326], [-22.11, -6.428], [-22.334, -5.426],
       [-22.558, -3.928], [-22.676, -2.548], [-22.732, -1.035], [-22.727, 1.236], [-22.662, 2.748], [-22.558, 3.903],
       [-22.358, 5.274], [-22.111, 6.398], [-21.766, 7.508], [-21.398, 8.373], [-20.934, 9.183], [-20.447, 9.818],
       [-19.861, 10.376], [-19.277, 10.775], [-18.546, 11.111], [-17.989, 11.269], [-17.416, 11.359], [-16.837, 11.388],
       [-16.258, 11.359], [-15.685, 11.269], [-15.128, 11.111], [-14.595, 10.884], [-14.096, 10.589], [-13.657, 10.246],
       [-13.23, 9.821], [-12.868, 9.369], [-12.551, 8.883], [-12.276, 8.373], [-11.952, 7.625], [-11.722, 6.959],
       [-11.509, 6.188], [-11.34, 5.401], [-11.188, 4.479], [-11.057, 3.326], [-10.978, 2.169], [-10.94, 0.785],
       [-10.942, -1.035], [-10.99, -2.42], [-11.091, -3.695], [-11.24, -4.854], [-11.383, -5.647], [-11.659, -6.773],
       [-11.834, -7.326], [-12.177, -8.188], [-12.551, -8.908], [-12.868, -9.393], [-13.227, -9.843]];
BAY_X = -16.84;
BAY = [for (p = BAY_ROUND) p - [BAY_X, 0]];
HOLDER_BAY = BAY;
// Cavity outline at mid height (x, y) about the part centre, as measured (free-form, not an ellipse).
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

// Dome: above z = 29.4 (outer) and 28.6 (cavity) the outline shrinks about the centre; [z, scale] pairs, scale relative to
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

// --- holder retention (this block is identical in the box file and in the holder file; a test keeps them in sync) ---
// How the mini holder is held in the case box's round bay, chosen by HOLDER_SNAP (a -D override): "friction" (nothing added),
// "detent" or "crush-ribs". The holder is pushed up into the bay through the open floor, and the tab in the bay stops it at the
// top. It must not drop out when the case is turned over, yet a lighter pushed down onto its dome from above must still push it
// out. Both features therefore sit near the holder's floor, its trailing end, so they only rub over the last few millimetres of
// the push. They come in opposing pairs: a feature on one side only would let the holder shift sideways by CLEARANCE and lose
// its engagement. Heights are above the box's underside, which is where the holder's floor sits. Frame: HOLDER_BAY is the bay
// outline about its own centre. Sizes follow CLEARANCE, so each feature engages the same amount at any clearance.
HOLDER_SNAP = "friction";
// detent: a bump on each end of the holder (the bay's +/-Y ends; the holder's +X half is its window, so it springs in along Y),
// and a groove in the bay wall that clears the bump by CLEARANCE on every side
HOLDER_DETENT_Z = 5;         // centre height of the bump
HOLDER_DETENT_ENGAGE = 0.15; // the bump reaches this far past the bay wall: less than the case lid's detent, so a push releases it
HOLDER_DETENT_W = 3.5;       // width across the bay's end (along X)
HOLDER_DETENT_TOP = 0.6;     // height of the bump's crest
HOLDER_DETENT_FLANK = 30;    // flank angle from the wall, in degrees: shallow both ways, for pushing in and pushing out
HOLDER_DETENT_ROOT = 0.2;    // the bump starts this far inside the holder's skin, so it fuses with the wall
HOLDER_DETENT_RUN = (CLEARANCE + HOLDER_DETENT_ENGAGE + HOLDER_DETENT_ROOT) / tan(HOLDER_DETENT_FLANK);   // height of each flank
// crush-ribs: four vertical ribs on the holder's skin, squeezed by HOLDER_CRUSH_SQUEEZE by the bay wall; symmetric in X and Y, so
// the holder stays centred. Nothing is cut into the box.
HOLDER_CRUSH_SQUEEZE = 0.1;
HOLDER_CRUSH_ANGLES = [60, 120, 240, 300];   // about the bay centre, from +X; below the window, which starts above z = 9.3 there
HOLDER_CRUSH_W = 0.6;
HOLDER_CRUSH_Z0 = 0.5;
HOLDER_CRUSH_Z1 = 7;         // the top end is ramped over HOLDER_CRUSH_RAMP, since the top leads into the bay
HOLDER_CRUSH_RAMP = 1.5;

// A thin band just inside the bay outline offset by d (d = 0 is the bay wall, -CLEARANCE the holder's skin), clipped to the
// children, at height z. The features are hulls of these bands, so their surfaces follow the curved bay wall. The hull's edges
// run along the bisectors of the outline's vertices, right through the bay's (and the skin's) vertical edges; HOLDER_JITTER, a
// few micrometres, moves them off those edges, which would otherwise leave zero-area triangles in the mesh.
HOLDER_JITTER = [0.0071, 0.0043];
module holder_band(z, d) {
  translate([HOLDER_JITTER[0], HOLDER_JITTER[1], z]) linear_extrude(height = 0.01) intersection() {
    difference() { offset(delta = d) polygon(HOLDER_BAY); offset(delta = d - 0.1) polygon(HOLDER_BAY); }
    children();
  }
}
// The detent bump as [z, d] stations: grow = 0 is the bump on the holder, grow = CLEARANCE the groove that clears it.
function holder_detent_profile(grow) =
  let(z0 = HOLDER_DETENT_Z - HOLDER_DETENT_TOP / 2 - HOLDER_DETENT_RUN, z1 = HOLDER_DETENT_Z + HOLDER_DETENT_TOP / 2 + HOLDER_DETENT_RUN,
      d0 = -CLEARANCE - HOLDER_DETENT_ROOT + grow, d1 = HOLDER_DETENT_ENGAGE + grow)
  [[z0 - grow, d0], [z0 + HOLDER_DETENT_RUN - grow, d1], [z1 - HOLDER_DETENT_RUN + grow, d1], [z1 + grow, d0]];
module holder_detent(grow) {
  for (s = [1, -1]) hull() for (p = holder_detent_profile(grow))
    holder_band(p[0], p[1]) translate([-HOLDER_DETENT_W / 2 - grow, s > 0 ? 5 : -20]) square([HOLDER_DETENT_W + 2 * grow, 15]);
}
module holder_crush_ribs() {
  d0 = -CLEARANCE - 0.2;
  for (a = HOLDER_CRUSH_ANGLES) hull()
    for (p = [[HOLDER_CRUSH_Z0, d0], [HOLDER_CRUSH_Z0, HOLDER_CRUSH_SQUEEZE], [HOLDER_CRUSH_Z1 - HOLDER_CRUSH_RAMP, HOLDER_CRUSH_SQUEEZE], [HOLDER_CRUSH_Z1, d0]])
      holder_band(p[0], p[1]) rotate(a) translate([0, -HOLDER_CRUSH_W / 2]) square([20, HOLDER_CRUSH_W]);
}
// --- end holder retention ---

// Outer skin: the bay pulled in by CLEARANCE.
module outer() offset(delta = -CLEARANCE) polygon(BAY);

// Stack of scaled slices following the [z, scale] table TAB over the 2D children.
module dome(tab) {
  for (k = [0 : len(tab) - 2])
    translate([0, 0, tab[k][0]])
      linear_extrude(height = tab[k + 1][0] - tab[k][0], scale = tab[k + 1][1] / tab[k][1]) scale(tab[k][1]) children();
}

module minibox() {
  difference() {
    union() {
      linear_extrude(height = DOME_OUT[0][0] + 0.01) outer();
      dome(DOME_OUT) outer();
      if (HOLDER_SNAP == "detent") holder_detent(0);
      if (HOLDER_SNAP == "crush-ribs") holder_crush_ribs();
    }
    union() {
      translate([0, 0, FLOOR_T]) linear_extrude(height = DOME_IN[0][0] - FLOOR_T + 0.01) polygon(INNER);
      dome(DOME_IN) polygon(INNER);
    }
    translate([0, 0, WINDOW_Z0]) rotate([0, 90, 0]) scale([WINDOW_C, WINDOW_A, 1]) cylinder(r = 1, h = 20, $fn = ROUNDNESS);
  }
}

scale(SCALE) minibox();
