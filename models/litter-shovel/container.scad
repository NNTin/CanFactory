// Litter shovel, part 1 of 3: the container. An original CanFactory design, published under CC BY 4.0.
//
// A bin for a liner bag: a gently flaring rounded-rectangle frustum on a solid floor that runs straight (the band) for its
// top 13 mm and ends in a closed lip. The lip's flat top is the container's face in the stack container, scoop, handle: the bag
// folds over it, and the scoop's cap sits on it. At the front (+X) a finger lever comes out from under the lip and rises past
// the scoop's cap to a pad just under the root of the handle's grip, as wide as the grip: lever and grip make one grip. The
// index finger pulls the pad up and the palm presses the grip down, which pinches the scoop's cap between the lip and the
// handle's ring and clamps the three parts together (docs/litter-shovel.md).
//
// Modelled as it prints and stands: Z up, the floor at Z = 0, the lip's top at Z = 141.5. Nothing needs support: the lip and
// the lever have 45 degree undersides. In `detent` mode grooves in the mouth, just under the lip, take the bumps on the
// scoop's sleeve.

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
// The scoop's cap (scoop.scad): its ceiling on the lip is CAP_T thick, and its skirt hangs SKIRT_H below the lip's top.
CAP_T = 3; SKIRT_H = 5;
// Finger lever: width (Y, the grip's), its pad (X, from just outside the scoop's skirt to its tip) and the pad's thickness. The
// pad's top stands LEVER_GAP under the grip's underside (the cap's top); its arm runs under the skirt, LEVER_GAP clear of it.
LEVER_W = 34; LEVER_X0 = 45; LEVER_X1 = 70; LEVER_T = 8; LEVER_GAP = 0.5;
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

// The finger lever, rooted in the wall (the cavity is cut out of it afterwards): an arm under the scoop's skirt, then the pad
// outside it, up to just under the grip. Its underside rises at 45 degrees to the pad's tip.
module lever() {
  root = 20;
  arm = RIM_Z - SKIRT_H - LEVER_GAP;
  top = RIM_Z + CAP_T - LEVER_GAP;
  outline = [[root, arm], [LEVER_X0, arm], [LEVER_X0, top], [LEVER_X1, top], [LEVER_X1, top - LEVER_T],
             [root, top - LEVER_T - (LEVER_X1 - root)]];
  translate([0, LEVER_W / 2, 0]) rotate([90, 0, 0]) linear_extrude(LEVER_W) polygon(outline);
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
  union() { outside(); lip(); lever(); }
  inside();
  if (SCOOP_SNAP == "detent") translate([0, 0, DETENT_Z]) on_sides(MOUTH) groove(DETENT_L, SCOOP_DETENT_ENGAGE);
}
