// BIC Mini lighter (model J25), as a reference object: a real-world item the cigarette case holds, shown in the assembly
// preview so that its fit can be seen: it goes into the box's round bay (BAY_ROUND) from the top and rests on the clip tab,
// above the mini holder. Upright (base down, as shown) the tab stops it, so it cannot reach the holder, which is intended.
// Turned upside down, its hood and wheel pass beside the tab and push the holder out through the box's floor.
// TODO(#17): the bay is not fitted to the lighter yet, so it sits loose. The lighter is a third-party object: the fix goes
// into the case box, never into this file's confirmed dimensions. It is never printed and never part of the ZIP. The
// preview loads mini-bic-lighter.stl, which is this file rendered (see docs/cigarette-case-assembly.md#reference-objects);
// render it again after any change here.
//
// Frame: millimetres, Z up, underside on z = 0, centred on the Z axis. The width (WIDTH) runs along Y, the thickness
// (THICKNESS) along X. The top, from -Y to +Y: the metal hood over the burner, the spark wheel (axle along X, its rear half
// outside the hood) and the plastic lever (fork) that the thumb presses after rolling the wheel.
//
// Overall size, confirmed by BIC's own specification (BIC Graphic, product 3460002360: 62 x 22 x 11 mm) and two retailer
// listings (4imprint UK and WE MAG: 22 x 62 x 11 mm; US listings give 7/8 x 2 7/16 in, 22.2 x 61.9 mm). The profile and
// the top are estimated from photographs and proportions: no published figure exists for them. Every estimated value is
// marked below. The body is opaque, as on every BIC lighter, so there is no fuel window. Detail inside the hood (burner,
// flint, child guard spring) is left out; only the outside shape matters for the fit.

$fn = 48;

// --- Confirmed ---
HEIGHT = 62;            // overall, underside to the top of the hood and wheel
WIDTH = 22;             // across the flat faces' long axis (Y)
THICKNESS = 11;         // across the flat faces (X)

// --- Estimated ---
PROFILE_N = 2.5;        // superellipse exponent of the body's oval plan: 2 is an ellipse, higher is squarer
BODY_H = 50;            // plastic body, underside to the shoulder the hood is crimped onto
BASE_ROUND = 1.5;       // rounded bottom edge
TOP_ROUND = 1;          // rounded shoulder edge
HOOD_W = 9.4;           // hood across X (sheet metal, HOOD_WALL thick)
HOOD_WALL = 0.4;
HOOD_Y0 = -9.5;         // front end of the hood (the burner side)
HOOD_Z0 = BODY_H - 1.5; // the hood's lower edge, crimped over the shoulder
FLAME_SLOT = [3.6, 4];  // opening in the hood's top over the burner, X by Y
FLAME_SLOT_Y = -6;      // its centre
WHEEL_D = 7.4;          // the two knurled thumb rings
WHEEL_W = 2.6;          // width of each thumb ring (X)
FLINT_WHEEL_D = 6;      // the steel wheel between them, which strikes the flint
WHEEL_Y = 1;            // wheel axle position (Y); the hood's rear edge follows the wheel
WHEEL_Z = HEIGHT - WHEEL_D / 2;
KNURLS = 30;            // grooves around each thumb ring
LEVER_W = 6.4;           // lever across X
LEVER_Y = [3.4, 9];     // lever from the wheel to near the rear edge (Y)
LEVER_TOP = BODY_H + 5; // the thumb pad next to the wheel; the lever slopes down towards the rear

// Superellipse |x/a|^n + |y/b|^n = 1, inset by d on both axes (the body is convex, so the hull of insets rounds its edges).
function plan(d = 0, steps = 96) = [for (i = [0 : steps - 1]) let (t = 360 * i / steps, c = cos(t), s = sin(t))
  [(THICKNESS / 2 - d) * sign(c) * pow(abs(c), 2 / PROFILE_N), (WIDTH / 2 - d) * sign(s) * pow(abs(s), 2 / PROFILE_N)]];

// Rounded edges as quarter-circle steps: an inset slice at each height, hulled together.
module body() {
  arc = 6;
  hull() {
    for (i = [0 : arc]) let (a = 90 * i / arc) {
      translate([0, 0, BASE_ROUND * (1 - sin(a))]) linear_extrude(height = 0.01) polygon(plan(BASE_ROUND * (1 - cos(a))));
      translate([0, 0, BODY_H - TOP_ROUND * (1 - sin(a)) - 0.01]) linear_extrude(height = 0.01) polygon(plan(TOP_ROUND * (1 - cos(a))));
    }
  }
}

// The hood's side profile (Y, Z): square at the front, rounded around the wheel at the rear.
module hood_profile() {
  intersection() {
    translate([HOOD_Y0, HOOD_Z0]) square([WHEEL_Y + WHEEL_D - HOOD_Y0, HEIGHT - HOOD_Z0]);
    hull() {
      translate([HOOD_Y0, HOOD_Z0]) square([0.01, HEIGHT - HOOD_Z0]);
      translate([WHEEL_Y, HOOD_Z0]) square([0.01, 0.01]);
      translate([WHEEL_Y, WHEEL_Z]) circle(d = WHEEL_D + 2 * HOOD_WALL + 0.6);
    }
  }
}

// Sheet-metal hood: two cheeks that carry the wheel's axle, a front wall and a top with the flame slot. Open at the rear
// (where the wheel shows) and at the bottom.
// TODO(#18): wrong shape. This hood is a rectangular box standing inside the body's outline; the real hood continues the body's
// oval outline (plan(), PROFILE_N) upwards. It matters because the hood is what pushes the holder out when the lighter is
// upside down (#17).
module hood() {
  for (m = [0, 1]) mirror([m, 0, 0]) translate([HOOD_W / 2 - HOOD_WALL, 0, 0]) rotate([90, 0, 90]) linear_extrude(height = HOOD_WALL) hood_profile();
  translate([-HOOD_W / 2, HOOD_Y0, HOOD_Z0]) cube([HOOD_W, HOOD_WALL, HEIGHT - HOOD_Z0]);
  difference() {
    translate([-HOOD_W / 2, HOOD_Y0, HEIGHT - HOOD_WALL]) cube([HOOD_W, WHEEL_Y - WHEEL_D / 2 - 0.6 - HOOD_Y0, HOOD_WALL]);
    translate([-FLAME_SLOT[0] / 2, FLAME_SLOT_Y - FLAME_SLOT[1] / 2, HEIGHT - 1]) cube([FLAME_SLOT[0], FLAME_SLOT[1], 2]);
  }
}

// Spark wheel: two knurled thumb rings either side of the smaller flint wheel, on an axle through the hood's cheeks.
module wheel() {
  translate([0, WHEEL_Y, WHEEL_Z]) rotate([0, 90, 0]) {
    cylinder(d = 2, h = HOOD_W - HOOD_WALL, center = true);
    cylinder(d = FLINT_WHEEL_D, h = HOOD_W - 2 * HOOD_WALL - 2 * WHEEL_W + 0.02, center = true);
    for (m = [0, 1]) mirror([0, 0, m]) translate([0, 0, HOOD_W / 2 - HOOD_WALL - WHEEL_W - 0.1]) difference() {
      cylinder(d = WHEEL_D, h = WHEEL_W);
      for (k = [0 : KNURLS - 1]) rotate([0, 0, 360 * k / KNURLS]) translate([WHEEL_D / 2, 0, -1]) rotate([0, 0, 45]) cube([0.5, 0.5, WHEEL_W + 2], center = false);
    }
  }
}

// Flint tube: the plastic column that holds the flint up against the wheel.
module flint_tube() {
  translate([0, WHEEL_Y, BODY_H - 0.5]) cylinder(d = 3.4, h = WHEEL_Z - FLINT_WHEEL_D / 2 - BODY_H + 0.7);
}

// Lever: the thumb pad next to the wheel, sloping down towards the rear.
module lever() {
  translate([-LEVER_W / 2, 0, 0]) rotate([90, 0, 90]) linear_extrude(height = LEVER_W) polygon([
    [LEVER_Y[0], BODY_H - 0.5], [LEVER_Y[1], BODY_H - 0.5], [LEVER_Y[1], BODY_H + 2.5],
    [LEVER_Y[0] + 1.6, LEVER_TOP], [LEVER_Y[0], LEVER_TOP]]);
}

union() {
  body();
  hood();
  wheel();
  flint_tube();
  lever();
}
