// Gumball-style treat dispenser: an inverted PET bottle screws into the top; a horizontal rotor with two pockets, turned directly by
// a 28BYJ-48, carries treats from under the funnel to the drop onto a chute out of the front. After bovineblitz's "Cat treat
// gumball-style dispenser" (MakerWorld 190887, CC BY-NC 4.0), itself after cylus80's "Mason Jar Candy Dispenser" (Thingiverse
// 2103924, CC BY 4.0); see ATTRIBUTION.md. Redrawn for CanFactory: PET thread, motor, electronics inside.
//
// Every dimension comes from LAYOUT, a list of [name, value] pairs written by packages/contracts/src/treatDispenser.ts
// (treatScadValues): the same numbers the physics' collision pieces and the assembly poses are made from. Every part is drawn in the
// assembled frame W (Z up, floor at z = 0, the rotor's axis along X at y = 0, the front at −Y) and then laid on the bed by the inverse
// of its pose (P_*: [x, y, z, rx, ry, rz]). Millimetres.

PART = "body";
LAYOUT = [];

function L(name) = let(i = search([name], LAYOUT, 1, 0)[0]) i == undef ? undef : LAYOUT[i][1];

$fn = 64;
WALL = L("WALL"); BASE = L("BASE"); HALF_W = L("HALF_W"); FRONT = L("FRONT"); BACK = L("BACK"); BASE_RECT = L("BASE_RECT");
R = L("R"); ROTOR_END = L("ROTOR_END"); POCKET = L("POCKET"); POCKETS = L("POCKETS");
BORE_R = L("BORE_R"); BORE_HALF = L("BORE_HALF"); BLOCK = L("BLOCK"); SLOT = L("SLOT");
AXIS_Z = L("AXIS_Z"); BLOCK_BOTTOM = L("BLOCK_BOTTOM"); BLOCK_TOP = L("BLOCK_TOP"); BLOCK_BACK = L("BLOCK_BACK"); CAVITY_R = L("CAVITY_R"); FLAP = L("FLAP"); LIP_Z = L("LIP_Z"); LIP_R = L("LIP_R"); BOSS_TOP = L("BOSS_TOP");
CHUTE = L("CHUTE"); CHUTE_END = L("CHUTE_END"); CHUTE_BACK = L("CHUTE_BACK"); CHUTE_SLOPE = L("CHUTE_SLOPE"); EXIT_Z = L("EXIT_Z");
CHUTE_FLOOR = L("CHUTE_FLOOR"); CHUTE_WALL = L("CHUTE_WALL"); CHUTE_SIDE = L("CHUTE_SIDE");
NECK_T = L("NECK_T"); NECK_E = L("NECK_E"); NECK_PITCH = L("NECK_PITCH"); NECK_TURNS = L("NECK_TURNS");
THREAD_CLEARANCE = L("THREAD_CLEARANCE"); THREAD_R = L("THREAD_R"); BOSS_R = L("BOSS_R");
MOTOR_FACE = L("MOTOR_FACE"); CAN_Z = L("CAN_Z"); CAN_R = L("CAN_R"); MOTOR_L = L("MOTOR_L"); EAR_SPAN = L("EAR_SPAN");
BOSS_D = L("BOSS_D"); SHAFT_D = L("SHAFT_D"); SHAFT_FLATS = L("SHAFT_FLATS");
CAP = L("CAP"); M3_HOLE = L("M3_HOLE"); M3_NUT_S = L("M3_NUT_S"); M3_NUT_M = L("M3_NUT_M"); M25_PILOT = L("M25_PILOT");
INSERT_HOLE = L("INSERT_HOLE"); INSERT_DEPTH = L("INSERT_DEPTH");
CASE_POS = L("CASE_POS"); USB = L("USB"); DRIVER_POS = L("DRIVER_POS"); DRIVER_HOLES = L("DRIVER_HOLES");

// the ESP32 case's outline (its base 25.8 × 21.8, its lid 25.4 × 19.8) and its roof, from the case model's own parts
CASE_L = 25.8; CASE_W = 21.8; LID_L = 25.4; LID_W = 19.8; LIP = 0.6; CASE_ROOF = 14.4; CASE_FLOOR = 6;
// the cap's screws: on the bore's −X face, outside the bore, into heat-set inserts
CAP_SCREW_R = (BORE_R + CAP[1]) / 2;
// the base plate's screws: into inserts in four columns inside the body's sides, clear of the boards
BASE_SCREWS = [[HALF_W - 6, -22], [-(HALF_W - 6), -22], [HALF_W - 6, -4], [-(HALF_W - 6), -4]];
// the flap: its root (y, z) on the slot's back wall, length, angle from the vertical (towards the back), thickness, root bead
FLAP_DIR = [sin(FLAP[3]), -cos(FLAP[3])]; FLAP_BACK = [cos(FLAP[3]), sin(FLAP[3])];
FLAP_BEAD = [FLAP[0] + FLAP_BACK[0] * FLAP[5] / 2, FLAP[1] + FLAP_BACK[1] * FLAP[5] / 2];
DROP_Y = -BORE_R * sin(30);
TAN = tan(CHUTE_SLOPE);
function chute_at(y) = EXIT_Z + (y - CHUTE_END) * TAN;

// rounded box: x0..x1, y0..y1, z0..z1, its vertical edges rounded
module rbox(x0, x1, y0, y1, z0, z1, r) {
  hull() for (x = [x0 + r, x1 - r]) for (y = [y0 + r, y1 - r]) translate([x, y, z0]) cylinder(r = r, h = z1 - z0);
}
// the inverse of a part's pose: W → its print frame
module print_pose(P) { rotate([-P[3], 0, 0]) rotate([0, -P[4], 0]) rotate([0, 0, -P[5]]) translate([-P[0], -P[1], -P[2]]) children(); }

// -------------------------------------------------------------------------------------------------------------------------- the body
module body_w() {
  inner_x = HALF_W - WALL;
  difference() {
    union() {
      // the shell: walls and the deck the bottle's lip rests on; open at the bottom (the base plate closes it)
      difference() {
        rbox(-HALF_W, HALF_W, FRONT, BACK, BASE, LIP_Z, 8);
        rbox(-inner_x, inner_x, FRONT + WALL, BACK - WALL, BASE - 1, LIP_Z - WALL, 8 - WALL);
      }
      // the thread's boss
      translate([0, 0, LIP_Z - 0.01]) cylinder(r = BOSS_R, h = BOSS_TOP - LIP_Z + 0.01, $fn = 96);
      // the funnel's walls, from the lip's opening down to the slot
      hull() {
        translate([0, 0, LIP_Z - WALL]) cylinder(r = LIP_R + WALL, h = WALL, $fn = 72);
        translate([-SLOT[0] - WALL, -SLOT[1] - WALL, BLOCK_TOP - 0.01]) cube([2 * (SLOT[0] + WALL), 2 * (SLOT[1] + WALL), 0.02]);
      }
      // the rotor's block (deep behind, round the cavity), its +X face carrying the motor (wide enough for its ears), its −X face a ring
      // for the cap
      translate([-BLOCK[0], -BLOCK[1], BLOCK_BOTTOM]) cube([2 * BLOCK[0], BLOCK[1] + BLOCK_BACK, BLOCK_TOP - BLOCK_BOTTOM]);
      translate([BLOCK[0] - WALL - 2, -(EAR_SPAN / 2 + 5), CAN_Z - 6]) cube([WALL + 2, EAR_SPAN + 10, BLOCK_TOP - CAN_Z + 6]);
      translate([-BLOCK[0], 0, AXIS_Z]) rotate([0, 90, 0]) cylinder(r = CAP[1], h = 5, $fn = 96);
      // the legs either side of the chute, from the base to the block
      for (s = [-1, 1]) translate([s > 0 ? CHUTE[2] : -CHUTE[3], -BLOCK[1], BASE]) cube([CHUTE[3] - CHUTE[2], BLOCK[1] + BLOCK_BACK, BLOCK_BOTTOM - BASE + 0.01]);
      // the base plate's screw columns
      for (q = BASE_SCREWS) translate([q[0], q[1], BASE]) cylinder(d = INSERT_HOLE + 4, h = INSERT_DEPTH + 3, $fn = 32);
      // standoffs for the ULN2003 board on the right side wall
      for (h = DRIVER_HOLES) translate([HALF_W - WALL + 0.01, DRIVER_POS[1] + h[0], DRIVER_POS[2] + h[1]]) rotate([0, -90, 0]) cylinder(d = 6, h = HALF_W - WALL - DRIVER_POS[0] + 0.01, $fn = 24);
    }
    // the thread, and the lip's opening into the funnel
    translate([0, 0, LIP_Z]) bottle_bore(BOSS_TOP - LIP_Z, NECK_TURNS, BOSS_TOP - LIP_Z - 1);
    translate([0, 0, LIP_Z - WALL - 1]) cylinder(r = LIP_R, h = WALL + 2, $fn = 72);
    hull() {
      translate([0, 0, LIP_Z - WALL - 0.01]) cylinder(r = LIP_R, h = 0.02, $fn = 72);
      translate([-SLOT[0], -SLOT[1], BLOCK_TOP - 0.01]) cube([2 * SLOT[0], 2 * SLOT[1], 0.02]);
    }
    // the bore (open at −X for the rotor and its cap), the slot above it and the drop below it
    translate([-BLOCK[0] - 1, 0, AXIS_Z]) rotate([0, 90, 0]) cylinder(r = BORE_R, h = BLOCK[0] + 1 + BORE_HALF, $fn = 96);
    translate([-SLOT[0], -SLOT[1], AXIS_Z]) cube([2 * SLOT[0], 2 * SLOT[1], BLOCK_TOP - AXIS_Z + 0.02]);
    // the drop: from the tight bore's lower front edge back into the cavity
    translate([-SLOT[0], DROP_Y, BLOCK_BOTTOM - 1]) cube([2 * SLOT[0], CAVITY_R - DROP_Y, AXIS_Z - BLOCK_BOTTOM + 1]);
    // the cavity round the rotor's descending (back) side, under a roof at the flap's root
    intersection() {
      translate([-SLOT[0], 0, AXIS_Z]) rotate([0, 90, 0]) cylinder(r = CAVITY_R, h = 2 * SLOT[0], $fn = 144);
      translate([-SLOT[0] - 1, SLOT[1], BLOCK_BOTTOM - 20]) cube([2 * SLOT[0] + 2, CAVITY_R, FLAP[1] - BLOCK_BOTTOM + 20]);
    }
    // the flap's groove: its bead along X, the slit for its strip
    translate([-SLOT[0] - 0.4, FLAP_BEAD[0], FLAP_BEAD[1]]) rotate([0, 90, 0]) cylinder(d = FLAP[5] + 0.2, h = 2 * SLOT[0] + 0.8, $fn = 24);
    translate([-SLOT[0], FLAP[0], FLAP[1]]) rotate([FLAP[3] - 90, 0, 0]) translate([0, -1, -0.1]) cube([2 * SLOT[0], 3, FLAP[4] + 0.2]);
    // the motor: its boss and shaft through the +X face, its ears' screws with nuts on the block's side
    translate([BORE_HALF - 0.01, 0, AXIS_Z]) rotate([0, 90, 0]) cylinder(d = BOSS_D + 1, h = BLOCK[0] - BORE_HALF + 1, $fn = 48);
    for (s = [-1, 1]) translate([BLOCK[0] - WALL - 3, s * EAR_SPAN / 2, CAN_Z]) rotate([0, 90, 0]) {
      cylinder(d = M3_HOLE, h = 10, $fn = 24);
      translate([0, 0, -1]) cylinder(d = M3_NUT_S / cos(30) + 0.3, h = M3_NUT_M + 1, $fn = 6);
    }
    // the cap's inserts
    for (a = [45, 225]) translate([-BLOCK[0] - 0.01, CAP_SCREW_R * cos(a), AXIS_Z + CAP_SCREW_R * sin(a)]) rotate([0, 90, 0]) cylinder(d = INSERT_HOLE, h = INSERT_DEPTH, $fn = 24);
    // the chute's way out of the front, its top pointed so that it prints without support
    hull() {
      translate([-CHUTE[1] - 0.5, FRONT - 1, BASE - 1]) cube([2 * CHUTE[1] + 1, WALL + 2, chute_at(FRONT) + CHUTE_SIDE - BASE + 1]);
      translate([0, FRONT - 1, chute_at(FRONT) + CHUTE_SIDE + CHUTE[1]]) cube([0.01, WALL + 2, 0.01]);
    }
    // the chute's way in between the legs, under the block (the legs hold it)
    translate([-CHUTE[2], -BLOCK[1] - 1, BASE - 1]) cube([2 * CHUTE[2], BLOCK[1] + BLOCK_BACK + 2, BLOCK_BOTTOM - BASE + 1]);
    // the ESP32 case's window in the back wall (it stands upright, its width across): its base's walls held by lips at the outer face,
    // its lid flush
    translate([CASE_POS[0] - CASE_W / 2 - 0.3, BACK - WALL - 1, CASE_POS[2] - CASE_L / 2 - 0.3]) cube([CASE_W + 0.6, WALL + 1 - LIP, CASE_L + 0.6]);
    translate([CASE_POS[0] - LID_W / 2 - 0.3, BACK - LIP - 0.01, CASE_POS[2] - LID_L / 2 - 0.3]) cube([LID_W + 0.6, LIP + 1, LID_L + 0.6]);
    // the USB cable comes in at the foot of the back wall, under the case
    translate([CASE_POS[0] - 6, BACK - WALL - 1, BASE - 1]) cube([12, WALL + 2, 9]);
    // the base plate's screws
    for (q = BASE_SCREWS) translate([q[0], q[1], BASE - 0.01]) cylinder(d = INSERT_HOLE, h = INSERT_DEPTH, $fn = 24);
    for (h = DRIVER_HOLES) translate([HALF_W - WALL + 1, DRIVER_POS[1] + h[0], DRIVER_POS[2] + h[1]]) rotate([0, -90, 0]) cylinder(d = M25_PILOT, h = 20, $fn = 16);
  }
}
module body() { print_pose(L("P_BODY")) body_w(); }

// -------------------------------------------------------------------------------------------------------------------------- the rotor
module rotor_w() {
  translate([0, 0, AXIS_Z]) difference() {
    union() {
      rotate([0, 90, 0]) translate([0, 0, -ROTOR_END]) cylinder(r = R, h = 2 * ROTOR_END, $fn = 96);
      // the stub into the cap's bearing
      rotate([0, -90, 0]) translate([0, 0, ROTOR_END - 0.01]) cylinder(d = CAP[2], h = CAP[3] + 0.01, $fn = 48);
    }
    // two pockets, top and bottom; each one's −X end sloped (it prints as an overhang otherwise, the rotor standing on its +X end)
    for (s = [1, -1]) hull() {
      translate([-POCKET[0] / 2, -POCKET[1] / 2, s > 0 ? R - POCKET[2] : -R - 1]) cube([POCKET[0], POCKET[1], POCKET[2] + 1]);
      translate([-POCKET[0] / 2 - POCKET[2], -POCKET[1] / 2, s > 0 ? R : -R - 1]) cube([0.01, POCKET[1], 1]);
    }
    // the motor's flatted shaft, from the +X end
    translate([ROTOR_END + 0.01, 0, 0]) rotate([0, -90, 0]) linear_extrude(8) intersection() {
      circle(d = SHAFT_D + 0.2, $fn = 48);
      square([SHAFT_FLATS + 0.15, SHAFT_D + 1], center = true);
    }
  }
}
module rotor() { print_pose(L("P_ROTOR")) rotor_w(); }

// ---------------------------------------------------------------------------------------------------------------------- the flap
// TPU, printed flat: a strip from its root's bead to its tip, which rests on the rotor just behind the slot
module flap_w() {
  intersection() {
    union() {
      translate([-SLOT[0] + 0.2, FLAP[0], FLAP[1]]) rotate([FLAP[3] - 90, 0, 0]) cube([2 * SLOT[0] - 0.4, FLAP[2], FLAP[4]]);
      translate([-SLOT[0] - 0.2, FLAP_BEAD[0], FLAP_BEAD[1]]) rotate([0, 90, 0]) cylinder(d = FLAP[5], h = 2 * SLOT[0] + 0.4, $fn = 24);
    }
    // its tip trimmed to the rotor's surface
    difference() {
      translate([-50, -50, -50]) cube([100, 200, 300]);
      translate([-50, 0, AXIS_Z]) rotate([0, 90, 0]) cylinder(r = R, h = 100, $fn = 144);
    }
  }
}
module flap() { print_pose(L("P_FLAP")) flap_w(); }

// --------------------------------------------------------------------------------------------------------------- the bearing cap
module cap_w() {
  translate([-BLOCK[0], 0, AXIS_Z]) rotate([0, 90, 0]) difference() {
    union() {
      translate([0, 0, -CAP[0]]) cylinder(r = CAP[1], h = CAP[0], $fn = 96);
      cylinder(r = BORE_R - 0.15, h = BLOCK[0] - BORE_HALF, $fn = 96);
    }
    translate([0, 0, BLOCK[0] - BORE_HALF - CAP[3] - 0.5]) cylinder(d = CAP[2] + 0.4, h = CAP[3] + 1, $fn = 48);
    for (a = [45, 225]) rotate([0, 0, 0]) translate([-CAP_SCREW_R * sin(a), CAP_SCREW_R * cos(a), -CAP[0] - 1]) cylinder(d = M3_HOLE, h = CAP[0] + 2, $fn = 24);
  }
}
module cap() { print_pose(L("P_CAP")) cap_w(); }

// -------------------------------------------------------------------------------------------------------------------------- the chute
module chute_w() {
  y0 = CHUTE_END; y1 = CHUTE_BACK;
  // a slab following the slope: from `below` under the floor's surface to `above` over it, between x0 and x1
  module slab(x0, x1, below, above) {
    hull() for (y = [y0, y1]) translate([x0, y, chute_at(y) - below]) cube([x1 - x0, 0.01, below + above]);
  }
  slab(-CHUTE[1], CHUTE[1], CHUTE_FLOOR, 0);
  for (s = [-1, 1]) slab(s > 0 ? CHUTE[0] : -CHUTE[1], s > 0 ? CHUTE[1] : -CHUTE[0], CHUTE_FLOOR, CHUTE_SIDE);
  translate([-CHUTE[1], y1 - CHUTE_WALL, chute_at(y1) - CHUTE_FLOOR]) cube([2 * CHUTE[1], CHUTE_WALL, CHUTE_FLOOR + CHUTE_SIDE]);
  // feet down to the base plate, under its high end, between the legs
  translate([-CHUTE[1], y1 - 8, BASE]) cube([2 * CHUTE[1], 8, chute_at(y1 - 8) - CHUTE_FLOOR - BASE + 0.01]);
}
module chute() { print_pose(L("P_CHUTE")) chute_w(); }

// ----------------------------------------------------------------------------------------------------------------- the base plate
module base() {
  difference() {
    union() {
      hull() for (x = [BASE_RECT[0] + 8, BASE_RECT[1] - 8]) for (y = [BASE_RECT[2] + 8, BASE_RECT[3] - 8]) translate([x, y, 0]) cylinder(r = 8, h = BASE, $fn = 48);
      // a keeper behind the ESP32 case's floor, beside its header pins, so that it cannot be pushed in
      translate([CASE_POS[0] + CASE_W / 2 - 2.5, CASE_POS[1] + CASE_FLOOR - 2.5, BASE - 0.01]) cube([2, 2.5, CASE_POS[2] + CASE_L / 2 - BASE]);
      // a lip either side of the chute's foot, to locate it
      for (s = [-1, 1]) translate([s * (CHUTE[1] + 0.2) - (s < 0 ? 2 : 0), CHUTE_BACK - 10, BASE - 0.01]) cube([2, 10, 2]);
    }
    for (q = BASE_SCREWS) translate([q[0], q[1], -1]) {
      cylinder(d = M3_HOLE, h = BASE + 2, $fn = 24);
      cylinder(d1 = 6.5, d2 = M3_HOLE, h = 1.8, $fn = 24);
    }
  }
}

// -------------------------------------------------------------------------------------------------------------- the thread coupon
// The bottle's thread ridge grown by the clearance, swept along its helix: cut from a bore just over the bottle's root diameter.
module thread_cutter(turns) {
  fn = 72; steps = ceil(turns * fn);
  r0 = NECK_E / 2 - 0.3; r1 = NECK_T / 2 + THREAD_CLEARANCE;
  base = NECK_PITCH * 0.6 + 2 * THREAD_CLEARANCE; crest = NECK_PITCH * 0.3 + 2 * THREAD_CLEARANCE;
  profile = [[r0, -base / 2], [r0, base / 2], [r1, crest / 2], [r1, -crest / 2]];
  n = len(profile);
  points = [for (i = [0:steps]) let(a = i * 360 / fn, z = i * NECK_PITCH / fn) for (q = profile) [q[0] * cos(a), q[0] * sin(a), z + q[1]]];
  faces = concat(
    [[for (k = [0:n - 1]) k]],
    [[for (k = [n - 1:-1:0]) steps * n + k]],
    [for (i = [0:steps - 1]) for (k = [0:n - 1]) [i * n + k, (i + 1) * n + k, (i + 1) * n + (k + 1) % n, i * n + (k + 1) % n]]
  );
  polyhedron(points, faces, convexity = 6);
}
module bottle_bore(h, turns, top) {
  translate([0, 0, -0.01]) cylinder(d = NECK_E + 2 * THREAD_CLEARANCE, h = h + 0.02, $fn = 96);
  translate([0, 0, top - turns * NECK_PITCH - NECK_PITCH]) thread_cutter(turns);
}
module coupon() {
  h = 10;
  difference() {
    cylinder(d = NECK_T + 2 * THREAD_CLEARANCE + 6, h = h, $fn = 96);
    bottle_bore(h, min(NECK_TURNS, (h - 2) / NECK_PITCH - 1), h - 1);
  }
}

if (PART == "body") body();
else if (PART == "rotor") rotor();
else if (PART == "flap") flap();
else if (PART == "cap") cap();
else if (PART == "chute") chute();
else if (PART == "base") base();
else if (PART == "coupon") coupon();
