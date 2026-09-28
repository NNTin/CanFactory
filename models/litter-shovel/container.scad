// Litter shovel, part 1 of 3: the container. An original CanFactory design, published under CC BY 4.0.
//
// A bin for a liner bag: a gently flaring rounded-rectangle frustum on a solid floor that runs straight (the band) for its
// top 30 mm. Around the band, 22 mm below the rim, a closed ledge carries the handle: the handle's ring comes down over the
// band and rests on the ledge's flat top. At the front (+X) a finger lever runs out from under the ledge, its top in the
// ledge's plane, to beneath the handle's grip: the index finger pulls it up against the grip, which clamps the container to
// the handle (docs/litter-shovel.md). The bag goes inside and folds over the rim, under the scoop's cap.
//
// Modelled as it prints and stands: Z up, the floor at Z = 0, the rim at Z = 141.5. Nothing needs support: the ledge and the
// lever have 45 degree undersides. In `detent` mode four bumps on the band click into grooves in the handle's ring.

// How the handle's ring holds on the band: a close fit only, or a detent (bumps on the band, grooves in the ring)
HANDLE_SNAP = "detent"; //[friction,detent]
// Gap per side between mating surfaces, in mm
CLEARANCE = 0.2; //[0.1:0.01:0.6]
// How far a detent bump reaches past the ring's wall, in mm, on top of the clearance
HANDLE_DETENT_ENGAGE = 0.2; //[0.02:0.01:0.4]

$fa = 4; $fs = 0.5;
E = 0.01;

// Body: the floor's and the band's outer plan [width (X), length (Y), corner radius]; wall, floor and heights.
FLOOR = [64.7, 97, 11];
BAND = [74.5, 106.8, 14];
WALL = 2.4; FLOOR_T = 3.2; RIM_Z = 141.5;
// Ledge the handle rests on: its flat top, how far it stands out from the band, and its thickness above the 45 degree chamfer.
LEDGE_Z = 119.5; LEDGE_W = 4; LEDGE_T = 3;
// The band is straight from 3 mm below the ledge's chamfer up to the rim.
BAND_Z = LEDGE_Z - LEDGE_T - LEDGE_W - 3;
// Finger lever: width (Y), its tip (X, under the handle's grip) and the tip's height; its underside rises at 45 degrees.
LEVER_W = 14; LEVER_X = 95; LEVER_TIP = 8;
// Detent bumps: height of their ridge above the ledge (mid-way up the handle's ring) and their length along the wall.
DETENT_Z = LEDGE_Z + 6; DETENT_L = 16;

module rr2d(w, l, r) { offset(r = r, $fn = 64) square([w - 2 * r, l - 2 * r], center = true); }
module slab(p, z, h = E) { translate([0, 0, z]) linear_extrude(h) rr2d(p[0], p[1], p[2]); }
function grow(p, d) = [p[0] + 2 * d, p[1] + 2 * d, p[2] + d];

// A detent ridge on a wall face, in the wall's frame (X along the wall, Y out of it, Z up): 45 degree flanks and ends,
// standing `p` proud. Its flanks carry on 0.3 mm into the wall, so that no edge of it lies in the wall's face.
module ridge(l, p) {
  d = 0.3;
  hull() {
    translate([-(l / 2 + d), -d - E, -(p + d)]) cube([l + 2 * d, E, 2 * (p + d)]);
    translate([-(l / 2 - p), p - E, -E / 2]) cube([l - 2 * p, E, E]);
  }
}

module bumps() {
  p = CLEARANCE + HANDLE_DETENT_ENGAGE;
  for (s = [-1, 1]) {
    translate([s * BAND[0] / 2, 0, DETENT_Z]) rotate([0, 0, -s * 90]) ridge(DETENT_L, p);
    translate([0, s * BAND[1] / 2, DETENT_Z]) rotate([0, 0, s > 0 ? 0 : 180]) ridge(DETENT_L, p);
  }
}

// The outer shell: the floor's plan flaring to the band's, then straight (one convex hull, so there is no seam).
module outside() { hull() { slab(FLOOR, 0); slab(BAND, BAND_Z, RIM_Z - BAND_Z); } }

// The cavity, one wall inside: it starts on the floor and runs past the rim to leave the top open.
module inside() {
  f = FLOOR_T / BAND_Z;
  low = [for (i = [0 : 2]) FLOOR[i] + (BAND[i] - FLOOR[i]) * f];
  hull() { slab(grow(low, -WALL), FLOOR_T); slab(grow(BAND, -WALL), BAND_Z, RIM_Z - BAND_Z + 2); }
}

// The closed ledge: flat on top, a 45 degree chamfer down to the band underneath.
module ledge() {
  hull() {
    slab(grow(BAND, LEDGE_W), LEDGE_Z - LEDGE_T, LEDGE_T);
    slab(BAND, LEDGE_Z - LEDGE_T - LEDGE_W);
  }
}

// The finger lever, rooted in the wall (the cavity is cut out of it afterwards).
module lever() {
  root = 20;
  outline = [[root, LEDGE_Z], [LEVER_X, LEDGE_Z], [LEVER_X, LEDGE_Z - LEVER_TIP], [root, LEDGE_Z - LEVER_TIP - (LEVER_X - root)]];
  translate([0, LEVER_W / 2, 0]) rotate([90, 0, 0]) linear_extrude(LEVER_W) polygon(outline);
}

difference() {
  union() {
    outside();
    ledge();
    lever();
    if (HANDLE_SNAP == "detent") bumps();
  }
  inside();
}
