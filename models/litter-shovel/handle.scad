// Litter shovel, part 3 of 3: the handle. An original CanFactory design, published under CC BY 4.0.
//
// A closed ring that comes down over the container's band and rests on its ledge, with a flat D-loop grip for the whole hand
// at the front (+X). The ring's flat top is the deck the scoop stands on, inside a short upstand at its outer edge. Under
// the grip lies the container's finger lever: the index finger pulls it up against the grip's flat underside, which clamps
// the container to the handle (docs/litter-shovel.md).
//
// Modelled as it prints: flat underside down at Z = 0, which rests on the container's ledge (Z = 119.5 in the container's
// frame). Ring, deck, upstand and grip all stand on that face, so nothing needs support. The detents are optional: grooves in
// the ring for the container's bumps (`HANDLE_SNAP`), and bumps on the upstand for grooves in the scoop (`SCOOP_SNAP`).

// How the ring holds on the container's band: a close fit only, or a detent (bumps on the band, grooves in the ring)
HANDLE_SNAP = "detent"; //[friction,detent]
// How the scoop holds in the upstand: a close fit only, or a detent (bumps on the upstand, grooves in the scoop)
SCOOP_SNAP = "detent"; //[friction,detent]
// Gap per side between mating surfaces, in mm
CLEARANCE = 0.2; //[0.1:0.01:0.6]
// How far the container's bumps reach past the ring's wall, in mm, on top of the clearance
HANDLE_DETENT_ENGAGE = 0.2; //[0.02:0.01:0.4]
// How far the upstand's bumps reach past the scoop's wall, in mm, on top of the clearance
SCOOP_DETENT_ENGAGE = 0.15; //[0.02:0.01:0.4]

$fa = 4; $fs = 0.5;
E = 0.01;

// The container's band (outer plan [width (X), length (Y), corner radius]) and the scoop's outer wall, which is the band grown
// by the bag's gap (0.8) and the scoop's 3.2 mm wall.
BAND = [74.5, 106.8, 14];
SCOOP = [82.5, 114.8, 18];
// Ring height (to the deck), upstand height above it and upstand wall.
RING_H = 12; UPSTAND_H = 8; UPSTAND_T = 2.4;
// Grip: the D-loop's opening (from the ring to the bar) and the bar, in X; its outer half-length (Y), the opening's
// half-length and corner radii; height. The bar's underside lies on the container's finger lever.
BAR_X0 = 79; BAR_X1 = 97; GRIP_Y = 55; OPENING_Y = 45; GRIP_R = 18; OPENING_R = 10;
GRIP_H = RING_H + UPSTAND_H;
// Top edges of the grip are eased by a 2 mm, 45 degree chamfer, in steps of CHAMFER_STEP.
CHAMFER = 2; CHAMFER_STEP = 0.25;
// Detents: the container's bumps sit mid-way up the ring; the upstand's bumps 4 mm above the deck. Length along the wall.
HANDLE_DETENT_Z = 6; SCOOP_DETENT_Z = RING_H + 4; DETENT_L = 16;

function grow(p, d) = [p[0] + 2 * d, p[1] + 2 * d, p[2] + d];
module rr2d(p) { offset(r = p[2], $fn = 64) square([p[0] - 2 * p[2], p[1] - 2 * p[2]], center = true); }
module slab(p, z, h) { translate([0, 0, z]) linear_extrude(h) rr2d(p); }

RING_IN = grow(BAND, CLEARANCE);
UPSTAND_IN = grow(SCOOP, CLEARANCE);
RING_OUT = grow(UPSTAND_IN, UPSTAND_T);

// Places children on the middle of each straight side of plan `p`, in the wall's frame (X along the wall, Y outward).
module on_sides(p) {
  for (s = [-1, 1]) {
    translate([s * p[0] / 2, 0, 0]) rotate([0, 0, -s * 90]) children();
    translate([0, s * p[1] / 2, 0]) rotate([0, 0, s > 0 ? 0 : 180]) children();
  }
}

// A detent ridge in the wall's frame, standing `p` proud (towards -Y, into the opening): 45 degree flanks and ends. Its flanks
// carry on 0.3 mm into the wall, so that no edge of it lies in the wall's face.
module ridge(l, p) {
  d = 0.3;
  hull() {
    translate([-(l / 2 + d), d, -(p + d)]) cube([l + 2 * d, E, 2 * (p + d)]);
    translate([-(l / 2 - p), -p, -E / 2]) cube([l - 2 * p, E, E]);
  }
}

// The groove a ridge of engagement `g` clicks into, in the mating wall's frame (the wall's face at Y = 0, the groove going
// towards +Y): `g` + clearance deep, clearing the ridge by the clearance on every side. Its flanks start 0.3 mm outside the
// face, so that no edge of it lies in the face.
module groove(l, g) {
  c = CLEARANCE; d = g + c; w = g + c * sqrt(2); o = 0.3;
  hull() {
    translate([-(l / 2 + 2 * c + o), -o, -(w + o)]) cube([l + 4 * c + 2 * o, E, 2 * (w + o)]);
    translate([-(l / 2 + 2 * c - d), d - E, -(w - d)]) cube([l + 4 * c - 2 * d, E, 2 * (w - d)]);
  }
}

// The D-loop's plan: from inside the ring out to the bar, less the opening; the scoop's space is cut out below.
module grip2d() {
  difference() {
    translate([0, -GRIP_Y]) offset(r = GRIP_R) offset(delta = -GRIP_R) square([BAR_X1, 2 * GRIP_Y]);
    // it starts inside the ring, so that its rounded corners at that end are hidden in the ring
    translate([RING_OUT[0] / 2 - OPENING_R, -OPENING_Y]) offset(r = OPENING_R) offset(delta = -OPENING_R)
      square([BAR_X0 - RING_OUT[0] / 2 + OPENING_R, 2 * OPENING_Y]);
    rr2d(UPSTAND_IN);
  }
}

module grip() {
  steps = round(CHAMFER / CHAMFER_STEP);
  linear_extrude(GRIP_H - CHAMFER) grip2d();
  for (i = [1 : steps]) translate([0, 0, GRIP_H - CHAMFER + (i - 1) * CHAMFER_STEP])
    linear_extrude(CHAMFER_STEP) offset(delta = -i * CHAMFER_STEP) grip2d();
}

difference() {
  union() {
    slab(RING_OUT, 0, RING_H);
    slab(RING_OUT, RING_H - E, UPSTAND_H + E);
    grip();
    if (SCOOP_SNAP == "detent")
      translate([0, 0, SCOOP_DETENT_Z]) on_sides(UPSTAND_IN) ridge(DETENT_L, CLEARANCE + SCOOP_DETENT_ENGAGE);
  }
  slab(RING_IN, -1, RING_H + 2);
  difference() {
    slab(UPSTAND_IN, RING_H, UPSTAND_H + 1);
    if (SCOOP_SNAP == "detent")
      translate([0, 0, SCOOP_DETENT_Z]) on_sides(UPSTAND_IN) ridge(DETENT_L, CLEARANCE + SCOOP_DETENT_ENGAGE);
  }
  if (HANDLE_SNAP == "detent")
    translate([0, 0, HANDLE_DETENT_Z]) on_sides(RING_IN) groove(DETENT_L, HANDLE_DETENT_ENGAGE);
}
