// Magnetic lighter keychain: a CanFactory original design, published under CC BY 4.0 (see ATTRIBUTION.md).
//
// A holder for the BIC Mini lighter (J25) that snaps onto a keychain with magnets, and comes off again with a pull. Four prints
// (PART), all from this file:
//
// - "lighter-holder": a sleeve the lighter slides into, base first, over a solid foot. The foot holds MAGNETS magnets sealed in
//   cavities (dropped in at a print pause); its underside, the face on the print bed, is flat and unbroken, so the holder also
//   sticks to a fridge on its own. Four crush ribs on the lighter's flat faces hold it, as it hangs mouth down from the keychain.
// - "keychain-holder": a plate of the foot's outline with the same sealed magnets, and on its back an eyelet for a split ring.
//   Its bed face meets the holder's foot, flat to flat, the magnets pair by pair, so the plate hangs the holder in a straight line
//   under the ring: the lighter's weight pulls the magnets straight apart, their strongest direction.
// - "lighter-fit-check": a short ring of the sleeve, with its ribs and its mouth chamfer, to try the lighter in before printing the
//   holder (FIT and SQUEEZE).
// - "keychain-fit-check": the magnet floor that both the foot and the plate share, up to the pause height (so the pockets are open:
//   the print as it stands at the pause), and beside it a flat sample of the eyelet. Press the magnets in to try MAGNET_FIT, hold it
//   to steel to feel the pull through the skin, and wind the split ring onto the sample.
//
// The lighter's plan is the parts library's (parts/everyday-objects/bic-j25-mini-lighter.scad: THICKNESS, WIDTH, PROFILE_N and plan(),
// copied as LIGHTER_*; a test keeps them equal). Every fit lives here: the bore is that plan grown by FIT on every side.
//
// Frame: millimetres, z up from the face on the print bed, centred on the Z axis; the lighter's width (22 mm) along Y, its thickness
// (11 mm) along X. The layout below is repeated by lighterKeychainLayout in packages/contracts/src/magneticLighterKeychain.ts, and
// the fixed sizes by LIGHTER_KEYCHAIN (a test compares them).

// ---------------------------------------------------------------

// Which print to make
PART = "lighter-holder"; //[lighter-holder,keychain-holder,lighter-fit-check,keychain-fit-check]
// Gap per side between the lighter and the sleeve's bore
FIT = 0.2; //[0.1:0.05:0.6]
// How far the lighter squeezes each crush rib
SQUEEZE = 0.15; //[0:0.05:0.4]
// The sleeve's wall (and the outline's margin round the bore)
WALL = 1.6; //[1.2:0.1:3]
// How deep the sleeve holds the lighter, above the foot
SLEEVE = 35; //[15:1:45]
// Gap per side between a magnet and its cavity
MAGNET_FIT = 0.1; //[0.05:0.05:0.3]
// The least skin between the magnets and the bed face (rounded up to whole layers)
SKIN = 0.4; //[0.4:0.05:1.2]
// The slicer's layer height: the skin and the pause height are on layer boundaries
LAYER = 0.2; //[0.08:0.02:0.32]
// The chosen magnet's greatest diameter and height (from the parts library)
MAGNET_D = 8.1;
MAGNET_T = 2.1;
// The chosen split ring's band width (radial) and thickness over both turns (from the parts library)
RING_A = 1.778;
RING_B = 2.667;

// --- the lighter (parts/everyday-objects/bic-j25-mini-lighter.scad) ---
LIGHTER_THICKNESS = 11;
LIGHTER_WIDTH = 22;
LIGHTER_PROFILE_N = 2.5;

// --- fixed sizes (LIGHTER_KEYCHAIN in packages/contracts/src/magneticLighterKeychain.ts) ---
MAGNETS = 2;            // magnets in the foot, and in the plate
SIDE_WALL = 1.2;        // least wall between a cavity and the outline, and between the two cavities
CAP = 0.8;              // over the cavities, after the pause: under the lighter, and under the eyelet
HEADROOM = 0.05;        // least room over a magnet before the pause
RIB_W = 1;              // crush ribs: width (along Y),
RIB_Y = 3.5;            //   their places on the flat faces, at y = +/- this,
RIB_START = 3;          //   how far above the foot they start (clear of the lighter's rounded base),
RIB_RAMP = 2;           //   the lead-in at their top,
MOUTH = 0.6;            // the chamfer round the sleeve's mouth
EYE_T = 3;              // eyelet: thickness (along X),
EYE_WALL = 2;           //   the plastic round its hole (the bridge the ring goes round),
EYE_BASE = 1;           //   and between the hole and the plate's back
HOLE_PLAY = 0.4;        // the eyelet's hole: the ring's band (both turns, its diagonal) plus this (COLLAR_TAG.holePlay),
HOLE_MIN = 3;           //   and at least this (COLLAR_TAG.holeMin)
CHECK_H = 10;           // the lighter fit check's height

// --- derived layout (lighterKeychainLayout) ---
// a height rounded up to whole layers, to the micrometre
function layers(h) = round(ceil(h / LAYER - 1e-9) * LAYER * 1e6) / 1e6;
function ceil1(v) = ceil(v * 10 - 1e-9) / 10;
POCKET_D = MAGNET_D + 2 * MAGNET_FIT;
SKIN_H = layers(SKIN);                          // the cavities' floor
PAUSE = layers(SKIN_H + MAGNET_T + HEADROOM);   // the cavities' top: pause here, drop the magnets in
FLOOR = PAUSE + CAP;                            // the foot's top (the lighter rests on it), and the plate's back
MAGNET_Y = POCKET_D / 2 + SIDE_WALL / 2;        // the cavities' centres, at y = +/- this
OUTSET = FIT + WALL;                            // the outline: the lighter's plan grown by this
TOP = FLOOR + SLEEVE;
HOLE = max(HOLE_MIN, ceil1(sqrt(RING_A * RING_A + RING_B * RING_B) + HOLE_PLAY));
EYE_R = HOLE / 2 + EYE_WALL;                    // the eyelet's rounded end, round the hole
EYE_Z = EYE_BASE + HOLE / 2;                    // the hole's centre above the plate's back
OUTLINE_Y = LIGHTER_WIDTH / 2 + OUTSET;         // the outline's half-length

$fa = 2;
$fs = 0.25;

// ---------------------------------------------------------------
// The lighter's plan (the library's plan() and plan_x(), under these names)

function lighter_plan(d = 0, steps = 96) = [for (i = [0 : steps - 1]) let (t = 360 * i / steps, c = cos(t), s = sin(t))
  [(LIGHTER_THICKNESS / 2 - d) * sign(c) * pow(abs(c), 2 / LIGHTER_PROFILE_N), (LIGHTER_WIDTH / 2 - d) * sign(s) * pow(abs(s), 2 / LIGHTER_PROFILE_N)]];
function lighter_plan_x(y, d = 0) = (LIGHTER_THICKNESS / 2 - d) * pow(1 - pow(abs(y) / (LIGHTER_WIDTH / 2 - d), LIGHTER_PROFILE_N), 1 / LIGHTER_PROFILE_N);

module outline() { offset(r = OUTSET) polygon(lighter_plan()); }
module bore(grow = 0) { offset(r = FIT + grow) polygon(lighter_plan()); }

// ---------------------------------------------------------------
// Pieces

// The magnet floor shared by the foot and the plate: sealed cavities from SKIN_H to PAUSE, or (open) up through the top.
module cavities(open = false) {
  for (s = [-1, 1]) translate([0, s * MAGNET_Y, SKIN_H]) cylinder(d = POCKET_D, h = open ? PAUSE - SKIN_H + 1 : PAUSE - SKIN_H, $fn = 64);
}

// Four crush ribs on the flat faces (+/-X), from z0 to z1, their crests SQUEEZE inside the lighter's plan, a ramp at the top that
// leads the lighter onto them. Each runs out into the wall, so that it joins the sleeve without a shared face.
module ribs(z0, z1) {
  for (sx = [-1, 1], sy = [-1, 1]) let (crest = lighter_plan_x(RIB_Y) - SQUEEZE, back = lighter_plan_x(RIB_Y) + FIT + WALL / 2)
    mirror([sx < 0 ? 1 : 0, 0, 0]) translate([0, sy * RIB_Y - RIB_W / 2, 0]) rotate([90, 0, 0]) mirror([0, 0, 1])
      linear_extrude(height = RIB_W) polygon([[crest, z0], [back, z0], [back, z1], [crest + FIT + SQUEEZE, z1], [crest, z1 - RIB_RAMP]]);
}

// The sleeve's mouth chamfer, cut from the top down by MOUTH.
module mouth(top) {
  hull() {
    translate([0, 0, top - MOUTH]) linear_extrude(height = 0.01) bore();
    translate([0, 0, top]) linear_extrude(height = 0.01) bore(MOUTH);
  }
  translate([0, 0, top]) linear_extrude(height = 1) bore(MOUTH);
}

// The eyelet's profile in its own plane (u along Y, v up from the plate's back): a tab rounded over its hole, which is a teardrop
// pointing up and cut flat at the circle's top, so that it prints without supports when it stands upright.
module eyelet_profile(teardrop = true, base = 0.01) {
  difference() {
    hull() {
      translate([-EYE_R, -base]) square([2 * EYE_R, base]);
      translate([0, EYE_Z]) circle(r = EYE_R);
    }
    translate([0, EYE_Z]) if (teardrop) intersection() {
      hull() { circle(d = HOLE); translate([0, HOLE / 2 * sqrt(2)]) square(0.01, center = true); }
      translate([-HOLE / 2, -HOLE / 2]) square([HOLE, HOLE]);
    } else circle(d = HOLE);
  }
}

module lighter_holder() {
  difference() {
    linear_extrude(height = TOP) outline();
    translate([0, 0, FLOOR]) linear_extrude(height = SLEEVE + 1) bore();
    mouth(TOP);
    cavities();
  }
  ribs(FLOOR + RIB_START, TOP - MOUTH - 0.2);
}

module keychain_holder() {
  difference() {
    linear_extrude(height = FLOOR) outline();
    cavities();
  }
  // upright on the back, across the outline's narrow way: its hole runs along X
  translate([0, 0, FLOOR]) rotate([90, 0, 90]) linear_extrude(height = EYE_T, center = true) eyelet_profile();
}

module lighter_fit_check() {
  difference() {
    linear_extrude(height = CHECK_H) outline();
    translate([0, 0, -1]) linear_extrude(height = CHECK_H + 2) bore();
    mouth(CHECK_H);
  }
  ribs(0.3, CHECK_H - MOUTH - 0.2);
}

module keychain_fit_check() {
  difference() {
    linear_extrude(height = PAUSE) outline();
    cavities(open = true);
  }
  // the eyelet laid flat beyond the outline's +Y end (its hole EYE_BASE past it, as over the plate's back), as thick as the real
  // one, its base reaching 2 mm back into the outline
  translate([0, OUTLINE_Y, 0]) linear_extrude(height = EYE_T) eyelet_profile(teardrop = false, base = 2);
}

if (PART == "lighter-holder") lighter_holder();
else if (PART == "keychain-holder") keychain_holder();
else if (PART == "lighter-fit-check") lighter_fit_check();
else if (PART == "keychain-fit-check") keychain_fit_check();
