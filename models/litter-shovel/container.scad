// Litter shovel, part 1 of 3: the container. An original CanFactory design, published under CC BY 4.0.
//
// A bin for a liner bag: a gently flaring rounded-rectangle frustum on a solid floor that runs straight (the band) for its
// top 13 mm and ends in a closed lip. The lip's flat top is the container's face in the stack container, scoop, handle: the bag
// folds over it, and the scoop's cap sits on it. At the front (+X) the container has its own handle, like a measuring jug's: an
// arm under the lip, a vertical bar and a foot back to the floor, so it can be carried on its own. The bar is the finger side
// of the shovel's grip: the handle part's grip comes down over the arm and along the bar's flat outer face, and the two halves
// make one grip. Held in the fist, they clamp the container to the handle, with the scoop's cap between the lip and the
// handle's ring (docs/litter-shovel.md).
//
// Modelled as it prints and stands: Z up, the floor at Z = 0, the lip's top at Z = 141.5. Nothing needs support: the lip has a
// 45 degree underside, the arm a 45 degree gusset, and the foot lies on the bed. In `detent` mode grooves in the mouth, just
// under the lip, take the bumps on the scoop's sleeve.

// How the scoop's sleeve holds in the mouth: a close fit only, or a detent (bumps on the sleeve, grooves in the mouth)
SCOOP_SNAP = "detent"; //[friction,detent]
// Gap per side between mating surfaces, in mm
CLEARANCE = 0.2; //[0.1:0.01:0.6]
// How far the sleeve's bumps reach past the mouth's wall, in mm, on top of the clearance
SCOOP_DETENT_ENGAGE = 0.15; //[0.02:0.01:0.4]

$fa = 4; $fs = 0.5;
E = 0.01;

// Body: the floor's and the band's outer plan [width (X), length (Y), corner radius]; wall, floor, and the lip's top.
FLOOR = [64.7, 97, 11];
BAND = [74.5, 106.8, 14];
WALL = 2.4; FLOOR_T = 3.2; RIM_Z = 141.5;
// Lip: how far it stands out from the band, and its thickness above the 45 degree chamfer.
LIP_W = 4; LIP_T = 3;
// The band is straight from 3 mm below the lip's chamfer up to the rim.
BAND_Z = RIM_Z - LIP_T - LIP_W - 3;
// Handle: width (Y); the bar's inner (finger) and outer (mating) faces; the arm's flat top (under the scoop's skirt, which ends
// 5 mm below the lip's top) and its thickness at the bar; the foot's height; the rounding of the bar's finger-side edges and of
// the finger opening.
GRIP_W = 26; BAR_X0 = 62; BAR_X1 = 76; TOP_Z = 131; ARM_T = 12; FOOT_H = 5; GRIP_R = 5; OPENING_R = 6;
// The handle's outer corner, from the arm's top into the bar's outer face, is a curve of this radius; the handle part's grip
// follows it.
CURVE_R = 20;
// Detent grooves: height in the mouth (mid-way down the scoop's sleeve) and length along the wall.
DETENT_Z = RIM_Z - 2.5; DETENT_L = 16;

module rr2d(p) { offset(r = p[2], $fn = 64) square([p[0] - 2 * p[2], p[1] - 2 * p[2]], center = true); }
module slab(p, z, h = E) { translate([0, 0, z]) linear_extrude(h) rr2d(p); }
function grow(p, d) = [p[0] + 2 * d, p[1] + 2 * d, p[2] + d];

MOUTH = grow(BAND, -WALL);

// The outer shell: the floor's plan flaring to the band's, then straight (one convex hull, so there is no seam).
module outside() { hull() { slab(FLOOR, 0); slab(BAND, BAND_Z, RIM_Z - BAND_Z); } }

// The cavity, one wall inside: it starts on the floor and runs past the rim to leave the top open.
module inside() {
  f = FLOOR_T / BAND_Z;
  low = [for (i = [0 : 2]) FLOOR[i] + (BAND[i] - FLOOR[i]) * f];
  hull() { slab(grow(low, -WALL), FLOOR_T); slab(MOUTH, BAND_Z, RIM_Z - BAND_Z + 2); }
}

// The closed lip: flat on top, a 45 degree chamfer down to the band underneath.
module lip() {
  hull() {
    slab(grow(BAND, LIP_W), RIM_Z - LIP_T, LIP_T);
    slab(BAND, RIM_Z - LIP_T - LIP_W);
  }
}

// The side profile (XZ) the handle stays inside: everything left of the bar's outer face and under the arm's top, with the
// corner between them curved. The handle part's grip is fitted to it (handle.scad).
module grip_profile() { offset(r = CURVE_R) offset(delta = -CURVE_R) translate([-100, -100]) square([BAR_X1 + 100, TOP_Z + 100]); }

// The handle, rooted in the wall (the cavity is cut out of it afterwards). The arm and the foot are a side profile (XZ) less
// the finger opening, whose top is a 45 degree gusset under the arm; the bar is a vertical prism whose finger-side edges are
// rounded. Its outer face and the arm's top, joined by the curve, are the faces the handle part's grip lies on.
module handle() { intersection() { handle_body(); translate([0, GRIP_W / 2 + 1, 0]) rotate([90, 0, 0]) linear_extrude(GRIP_W + 2) grip_profile(); } }

module handle_body() {
  root = 20; x = BAR_X0 + GRIP_R + 1;
  opening = [[0, FOOT_H], [x, FOOT_H], [x, TOP_Z - ARM_T], [0, TOP_Z - ARM_T - x]];
  translate([0, GRIP_W / 2, 0]) rotate([90, 0, 0]) linear_extrude(GRIP_W) difference() {
    polygon([[root, 0], [BAR_X0 + GRIP_R, 0], [BAR_X0 + GRIP_R, TOP_Z], [root, TOP_Z]]);
    offset(r = OPENING_R) offset(delta = -OPENING_R) polygon(opening);
  }
  linear_extrude(TOP_Z) union() {
    translate([BAR_X0, -GRIP_W / 2]) offset(r = GRIP_R) offset(delta = -GRIP_R) square([BAR_X1 - BAR_X0, GRIP_W]);
    translate([(BAR_X0 + BAR_X1) / 2, -GRIP_W / 2]) square([(BAR_X1 - BAR_X0) / 2, GRIP_W]);
  }
}

// Places children on the middle of each straight side of plan `p`, in the wall's frame (X along the wall, Y outward).
module on_sides(p) {
  for (s = [-1, 1]) {
    translate([s * p[0] / 2, 0, 0]) rotate([0, 0, -s * 90]) children();
    translate([0, s * p[1] / 2, 0]) rotate([0, 0, s > 0 ? 0 : 180]) children();
  }
}

// The groove a bump of engagement `g` clicks into, in the mating wall's frame (the wall's face at Y = 0, the groove going
// towards +Y, into the wall): `g` + clearance deep, clearing the bump by the clearance on every side. Its flanks start 0.3 mm
// in front of the face, so that no edge of it lies in the face.
module groove(l, g) {
  c = CLEARANCE; d = g + c; w = g + c * sqrt(2); o = 0.3;
  hull() {
    translate([-(l / 2 + 2 * c + o), -o, -(w + o)]) cube([l + 4 * c + 2 * o, E, 2 * (w + o)]);
    translate([-(l / 2 + 2 * c - d), d - E, -(w - d)]) cube([l + 4 * c - 2 * d, E, 2 * (w - d)]);
  }
}

difference() {
  union() { outside(); lip(); handle(); }
  inside();
  if (SCOOP_SNAP == "detent") translate([0, 0, DETENT_Z]) on_sides(MOUTH) groove(DETENT_L, SCOOP_DETENT_ENGAGE);
}
