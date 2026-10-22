// PET-bottle treat dispenser: an inclined disc with four rim notches lifts treats out of the pile and drops them through
// the back plate into the chute; a 28BYJ-48 turns it through a 15:30 spur pair. Original CanFactory design, CC BY 4.0.
//
// Every dimension comes from LAYOUT, a list of [name, value] pairs written by packages/contracts/src/treatDispenser.ts
// (treatScadValues): the same numbers the physics' collision pieces and the assembly poses are made from. Parts drawn in the disc
// frame D (origin on the disc's axis in the plane of its face, +Z out of the face, +Y up the incline) are moved into their print frame
// by their F_* entry: [flip (180° about X), dx, dy, dz]. Parts that stand upright in the world (adapter, coupon, bracket) are drawn in
// the assembled frame W and laid on the bed. Millimetres.

PART = "disc";
LAYOUT = [];

function L(name) = let(i = search([name], LAYOUT, 1, 0)[0]) i == undef ? undef : LAYOUT[i][1];

$fn = 64;
TD = L("TD"); DISC_R = L("DISC_R"); NOTCH = L("NOTCH"); NOTCH_ANGLES = L("NOTCH_ANGLES"); OUTLET = L("OUTLET");
PLATE_TOP = L("PLATE_TOP"); PLATE_BOTTOM = L("PLATE_BOTTOM"); PLATE_R = L("PLATE_R");
SPINDLE = L("SPINDLE"); SPINDLE_FLAT = L("SPINDLE_FLAT"); FIT = L("FIT");
GEAR = L("GEAR"); GEAR_TIP = L("GEAR_TIP"); PINION = L("PINION"); PINION_TIP = L("PINION_TIP");
GEAR_TOP = L("GEAR_TOP"); GEAR_BOTTOM = L("GEAR_BOTTOM"); PINION_AT = L("PINION_AT"); CAN_AT = L("CAN_AT");
COVER_FRONT = L("COVER_FRONT"); COVER_BACK = L("COVER_BACK"); EAR_SPAN = L("EAR_SPAN");
BOSS_D = L("BOSS_D"); SHAFT_D = L("SHAFT_D"); SHAFT_FLATS = L("SHAFT_FLATS");
CHUTE_FLOOR = L("CHUTE_FLOOR"); CHUTE_DEPTH = L("CHUTE_DEPTH"); CHUTE_WALL = L("CHUTE_WALL"); WALL = L("WALL");
RIM_IN = L("RIM_IN"); RIM_OUT = L("RIM_OUT"); LID = L("LID"); LID_TOP = L("LID_TOP");
BETA = L("BETA"); MOUTH = L("MOUTH"); TUBE_BORE = L("TUBE_BORE"); TUBE_WALL = L("TUBE_WALL"); TUBE_LENGTH = L("TUBE_LENGTH");
NECK_T = L("NECK_T"); NECK_E = L("NECK_E"); NECK_PITCH = L("NECK_PITCH"); NECK_TURNS = L("NECK_TURNS");
THREAD_CLEARANCE = L("THREAD_CLEARANCE"); ADAPTER_H = L("ADAPTER_H");
M3_HOLE = L("M3_HOLE"); M3_NUT_S = L("M3_NUT_S"); M3_NUT_M = L("M3_NUT_M"); M25_PILOT = L("M25_PILOT");
INSERT_HOLE = L("INSERT_HOLE"); INSERT_DEPTH = L("INSERT_DEPTH");
WALL_Y = L("WALL_Y"); LUGS = L("LUGS"); SEAT_W = L("SEAT_W"); BOTTLE_D = L("BOTTLE_D"); BAY = L("BAY");
DRIVER_POS = L("DRIVER_POS"); DRIVER_HOLES = L("DRIVER_HOLES"); CASE_POS = L("CASE_POS"); CASE_ROT = L("CASE_ROT"); CASE_BASE = L("CASE_BASE");

// the spindle: a round collar through the plate's bushing (the disc sits on its shoulder), then a D into the disc
COLLAR = SPINDLE + 2;
// the gear rests on a thrust boss on the cover around its pin
PIN_D = 4; THRUST = GEAR_BOTTOM - COVER_FRONT - 0.2;
// lugs on the plate's rim: three for the chamber, two (±X) for the bracket's arms
HOPPER_LUGS = [90, 210, 330]; LUG_R = PLATE_R + 6; LUG_PAD = 11;
FLANGE_D = 50; FLANGE_T = 4; FLANGE_HOLE = 18;

module print_frame(f) {
  translate([f[1], f[2], f[3]]) if (f[0] == 1) rotate([180, 0, 0]) children(); else children();
}
module d_shape(r, flat) { intersection() { circle(r = r, $fn = 64); translate([-r, -r]) square([r + flat, 2 * r]); } }
module pad(r) { circle(r = r, $fn = 48); }

// ------------------------------------------------------------------------------------------------------------------- the disc
module disc() {
  difference() {
    translate([0, 0, -TD]) cylinder(r = DISC_R, h = TD, $fn = 192);
    for (a = NOTCH_ANGLES) rotate([0, 0, a]) translate([0, 0, -TD - 1]) linear_extrude(TD + 2) polygon(NOTCH);
    translate([0, 0, -TD - 1]) linear_extrude(TD + 2) d_shape(SPINDLE / 2 + FIT, SPINDLE_FLAT + FIT);
    // index mark: a 1 mm groove on the face, half way between notch 1 and notch 4, to line up with the chamber's mark
    rotate([0, 0, NOTCH_ANGLES[0] - 45]) translate([DISC_R - 7, -0.5, -0.8]) cube([8, 1, 1]);
  }
}

// --------------------------------------------------------------------------------------------- the gear and its spindle, one part
module gear() {
  difference() {
    union() {
      translate([0, 0, GEAR_BOTTOM]) linear_extrude(GEAR_TOP - GEAR_BOTTOM) polygon(GEAR);
      // collar from the gear up through the bushing to the disc's underside, then the D into the disc (0.5 below its face)
      translate([0, 0, GEAR_TOP - 0.01]) cylinder(d = COLLAR, h = -TD - GEAR_TOP + 0.01, $fn = 64);
      translate([0, 0, -TD - 0.01]) linear_extrude(TD - 0.5 + 0.01) d_shape(SPINDLE / 2, SPINDLE_FLAT);
    }
    translate([0, 0, GEAR_BOTTOM - 0.01]) cylinder(d = PIN_D + 2 * FIT, h = 3, $fn = 32);
  }
}

// ---------------------------------------------------------------------------------------- the pinion, on the motor's flatted shaft
module pinion() {
  translate([PINION_AT[0], PINION_AT[1], GEAR_BOTTOM]) difference() {
    linear_extrude(GEAR_TOP - GEAR_BOTTOM) polygon(PINION);
    translate([0, 0, -1]) linear_extrude(GEAR_TOP - GEAR_BOTTOM + 2) intersection() {
      circle(d = SHAFT_D + 0.15, $fn = 48);
      square([SHAFT_D + 1, SHAFT_FLATS + 0.15], center = true);
    }
    // the shaft is round, not flatted, for up to 0.7 mm below its flats' longest start: a counterbore
    translate([0, 0, -0.01]) cylinder(d = SHAFT_D + 0.3, h = 0.8, $fn = 48);
  }
}

// ------------------------------------------------------------------------------------------- the body: plate, gearbox and chute
// 0.05 mm past the gear's clearance, so its wall overlaps the chute's rather than sharing a face with it
module gearbox_inner() { hull() { pad(GEAR_TIP + 1.05); translate(PINION_AT) pad(PINION_TIP + 1); } }
module gearbox_outer() { offset(r = WALL) gearbox_inner(); }
// the chute is the outlet's own outline carried straight back, its walls round it: one cut through the plate and the chute
module chute_walls() { difference() { offset(delta = CHUTE_WALL) polygon(OUTLET); polygon(OUTLET); } }
// cover screws: outside the gearbox wall, either side of the gear and below the pinion
COVER_SCREWS = [[GEAR_TIP + 1 + WALL + 3.5, 0], [-(GEAR_TIP + 1 + WALL + 3.5), 0], [0, PINION_AT[1] - PINION_TIP - 1 - WALL - 3.5]];
module body() {
  difference() {
    union() {
      translate([0, 0, PLATE_BOTTOM]) cylinder(r = PLATE_R, h = PLATE_TOP - PLATE_BOTTOM, $fn = 144);
      for (a = concat(HOPPER_LUGS, [0, 180])) rotate([0, 0, a]) hull() {
        translate([PLATE_R - 4, 0, PLATE_BOTTOM]) cylinder(r = LUG_PAD / 2, h = PLATE_TOP - PLATE_BOTTOM);
        translate([LUG_R, 0, PLATE_BOTTOM]) cylinder(r = LUG_PAD / 2, h = PLATE_TOP - PLATE_BOTTOM);
      }
      translate([0, 0, PLATE_BOTTOM - 0.6]) cylinder(r = COLLAR / 2 + FIT + 2, h = 0.61);
      translate([0, 0, COVER_FRONT]) linear_extrude(PLATE_BOTTOM - COVER_FRONT + 0.01) difference() { gearbox_outer(); gearbox_inner(); }
      translate([0, 0, PLATE_BOTTOM - CHUTE_DEPTH]) linear_extrude(CHUTE_DEPTH + 0.01) chute_walls();
      for (q = COVER_SCREWS) translate([q[0], q[1], COVER_FRONT]) cylinder(d = INSERT_HOLE + 2 * 1.8, h = PLATE_BOTTOM - COVER_FRONT + 0.01);
    }
    translate([0, 0, PLATE_BOTTOM - CHUTE_DEPTH - 1]) linear_extrude(CHUTE_DEPTH + PLATE_TOP - PLATE_BOTTOM + 2) polygon(OUTLET);
    translate([0, 0, PLATE_BOTTOM - 2]) cylinder(d = COLLAR + 2 * FIT, h = PLATE_TOP - PLATE_BOTTOM + 3, $fn = 64);
    for (a = concat(HOPPER_LUGS, [0, 180])) rotate([0, 0, a]) translate([LUG_R, 0, PLATE_BOTTOM - 1]) cylinder(d = M3_HOLE, h = 10, $fn = 24);
    for (q = COVER_SCREWS) translate([q[0], q[1], COVER_FRONT - 0.01]) cylinder(d = INSERT_HOLE, h = INSERT_DEPTH, $fn = 24);
  }
}

// ------------------------------------------------------------------------------- the cover: closes the gearbox, carries the motor
module cover_outline() {
  // cut short of the chute's floor, which closes the gearbox on that side
  intersection() {
    hull() { gearbox_outer(); for (q = COVER_SCREWS) translate(q) pad(4.5); for (s = [-1, 1]) translate([CAN_AT[0] + s * EAR_SPAN / 2, CAN_AT[1]]) pad(4.5); }
    translate([-100, -200]) square([200, 200 + CHUTE_FLOOR - CHUTE_WALL - 0.2]);
  }
}
module cover() {
  difference() {
    union() {
      translate([0, 0, COVER_BACK]) linear_extrude(COVER_FRONT - COVER_BACK) cover_outline();
      translate([0, 0, COVER_FRONT - 0.01]) cylinder(d = PIN_D + 4, h = THRUST + 0.01, $fn = 32);
      translate([0, 0, COVER_FRONT - 0.01]) cylinder(d = PIN_D, h = THRUST + 2.2, $fn = 32);
    }
    // the motor's boss and shaft, its two ears
    translate([PINION_AT[0], PINION_AT[1], COVER_BACK - 1]) cylinder(d = BOSS_D + 1, h = COVER_FRONT - COVER_BACK + 2, $fn = 48);
    for (s = [-1, 1]) translate([CAN_AT[0] + s * EAR_SPAN / 2, CAN_AT[1], COVER_BACK - 1]) {
      cylinder(d = M3_HOLE, h = 10, $fn = 24);
      // the nut on the gearbox side, outside the wall
      translate([0, 0, COVER_FRONT - COVER_BACK + 1 - M3_NUT_M]) cylinder(d = M3_NUT_S / cos(30) + 0.3, h = M3_NUT_M + 1, $fn = 6);
    }
    for (q = COVER_SCREWS) translate([q[0], q[1], COVER_BACK - 1]) cylinder(d = M3_HOLE, h = 10, $fn = 24);
  }
}

// ------------------------------------------------------------------------- the chamber: rim wall, lid and the bottle's feed tube
module tube_frame() { translate(MOUTH) rotate([-BETA, 0, 0]) children(); }
module hopper() {
  difference() {
    union() {
      // the rim wall and lid round the chamber, then the feed tube down through the lid to its mouth inside it
      difference() {
        translate([0, 0, PLATE_TOP]) cylinder(r = RIM_OUT, h = LID_TOP - PLATE_TOP, $fn = 144);
        translate([0, 0, PLATE_TOP - 1]) cylinder(r = RIM_IN, h = LID - PLATE_TOP + 1, $fn = 144);
      }
      // lugs from inside the rim wall (never into the chamber) out to the plate's lugs
      for (a = HOPPER_LUGS) rotate([0, 0, a]) hull() {
        translate([RIM_IN + 0.5 + LUG_PAD / 2, 0, PLATE_TOP]) cylinder(r = LUG_PAD / 2, h = 4);
        translate([LUG_R, 0, PLATE_TOP]) cylinder(r = LUG_PAD / 2, h = 4);
      }
      tube_frame() {
        cylinder(r = TUBE_BORE / 2 + TUBE_WALL, h = TUBE_LENGTH, $fn = 72);
        translate([0, 0, TUBE_LENGTH - FLANGE_T]) cylinder(d = FLANGE_D, h = FLANGE_T, $fn = 72);
      }
    }
    tube_frame() {
      translate([0, 0, -1]) cylinder(r = TUBE_BORE / 2, h = TUBE_LENGTH + 2, $fn = 72);
      for (s = [-1, 1]) translate([s * FLANGE_HOLE, 0, TUBE_LENGTH - FLANGE_T - 8]) {
        cylinder(d = M3_HOLE, h = 20, $fn = 24);
        cylinder(d = M3_NUT_S / cos(30) + 0.3, h = 8 + FLANGE_T - 1.6, $fn = 6);
      }
    }
    for (a = HOPPER_LUGS) rotate([0, 0, a]) translate([LUG_R, 0, PLATE_TOP - 1]) cylinder(d = M3_HOLE, h = 10, $fn = 24);
    // index mark on the rim, in line with the disc's mark when a notch rests either side of the outlet
    rotate([0, 0, NOTCH_ANGLES[0] - 45]) translate([RIM_IN - 0.5, -0.5, PLATE_TOP + 2]) cube([1.2, 1, 6]);
    // nothing may reach below the plate's top
    translate([0, 0, PLATE_TOP - 50]) cylinder(r = 200, h = 50);
  }
}

// -------------------------------------------------------------------------------------------------- bottle thread: adapter, coupon
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
module adapter() {
  difference() {
    union() {
      cylinder(d = FLANGE_D, h = FLANGE_T, $fn = 96);
      cylinder(d = NECK_T + 2 * THREAD_CLEARANCE + 6, h = ADAPTER_H, $fn = 96);
    }
    translate([0, 0, -1]) cylinder(d = TUBE_BORE, h = FLANGE_T + 1, $fn = 96);
    translate([0, 0, FLANGE_T]) bottle_bore(ADAPTER_H - FLANGE_T, NECK_TURNS, ADAPTER_H - FLANGE_T - 1);
    for (s = [-1, 1]) translate([s * FLANGE_HOLE, 0, -1]) cylinder(d = M3_HOLE, h = FLANGE_T + 2, $fn = 24);
  }
}
module coupon() {
  h = 10;
  difference() {
    cylinder(d = NECK_T + 2 * THREAD_CLEARANCE + 6, h = h, $fn = 96);
    bottle_bore(h, min(NECK_TURNS, (h - 2) / NECK_PITCH - 1), h - 1);
  }
}

// ----------------------------------------------------------------------- the wall bracket: arms to the body, strap, electronics bay
module bracket_w() {
  y0 = WALL_Y; t = 3;
  z0 = 2; z1 = SEAT_W[2] + 70;
  x0 = -50; x1 = BAY[1] + 3;
  plate_n = [0, sin(BETA), cos(BETA)];
  difference() {
    union() {
      translate([x0, y0, z0]) cube([x1 - x0, t, z1 - z0]);
      // arms: from a pad on each lug on the plate's rim (on its chamber side, so the arm rises away from the plate) back to the wall
      for (q = LUGS) hull() {
        translate(q) rotate([-BETA, 0, 0]) translate([0, 0, PLATE_TOP - PLATE_BOTTOM]) cylinder(d = LUG_PAD, h = 3, $fn = 32);
        translate([q[0] - LUG_PAD / 2, y0, q[2] - LUG_PAD / 2]) cube([LUG_PAD, 0.01, LUG_PAD]);
      }
      // the bay's walls
      translate([BAY[0], y0 - 22, BAY[2]]) difference() {
        cube([BAY[1] - BAY[0], 22.01, BAY[3] - BAY[2]]);
        translate([2, -1, 2]) cube([BAY[1] - BAY[0] - 4, 22, BAY[3] - BAY[2] - 4]);
      }
      // ULN2003 standoffs
      for (h = DRIVER_HOLES) translate([DRIVER_POS[0] + h[0], y0 + 0.01, DRIVER_POS[2] + h[1]]) rotate([90, 0, 0]) cylinder(d = 6, h = y0 - DRIVER_POS[1] + 0.01, $fn = 24);
      // the case's cradle, built in the case's own frame
      translate(CASE_POS) rotate(CASE_ROT) cradle();
    }
    for (q = LUGS) translate(q) rotate([-BETA, 0, 0]) translate([0, 0, -20]) cylinder(d = M3_HOLE, h = 40, $fn = 24);
    for (h = DRIVER_HOLES) translate([DRIVER_POS[0] + h[0], y0 + 1, DRIVER_POS[2] + h[1]]) rotate([90, 0, 0]) cylinder(d = M25_PILOT, h = 20, $fn = 16);
    // keyholes, and slots for a strap round the bottle
    for (x = [x0 + 15, x1 - 15]) translate([x, y0 - 1, z1 - 15]) rotate([-90, 0, 0]) { cylinder(d = 8, h = t + 2); translate([-2, -10, 0]) cube([4, 10, t + 2]); }
    for (s = [-1, 1]) translate([s * (BOTTLE_D / 2 + 6) - 2.5, y0 - 1, SEAT_W[2] + 35]) cube([5, t + 2, 25]);
    // the USB cable leaves the bay downwards, under the case
    translate([CASE_POS[0] - 7, y0 - 23, BAY[2] - 1]) cube([14, 22, 4]);
  }
}
module cradle() {
  l = CASE_BASE[0]; w = CASE_BASE[1]; zb = CASE_BASE[2];
  back = -(WALL_Y - CASE_POS[1]);
  difference() {
    // from the wall (at case z = back) up to 4 mm over the case's floor
    translate([-l / 2 - 2.5, -w / 2 - 2.5, back]) cube([l + 5, w + 5, zb + 4 - back]);
    // the case base, a sliding fit
    translate([-l / 2 - 0.3, -w / 2 - 0.3, zb]) cube([l + 0.6, w + 0.6, 10]);
    // room behind it for the pins and the jumper wires' plugs, open at the sides
    translate([-l / 2 + 1.5, -w / 2 - 5, back + 3]) cube([l - 3, w + 10, zb - back - 3 + 0.01]);
    // USB-C end open but for a lip, so the case cannot fall out; the plug passes through it
    translate([-l / 2 - 5, -6, zb - 0.01]) cube([5, 12, 8]);
  }
}
module bracket() { translate([0, 0, WALL_Y + 3]) rotate([-90, 0, 0]) bracket_w(); }

if (PART == "disc") print_frame(L("F_DISC")) disc();
else if (PART == "gear") print_frame(L("F_GEAR")) gear();
else if (PART == "pinion") print_frame(L("F_PINION")) pinion();
else if (PART == "body") print_frame(L("F_BODY")) body();
else if (PART == "cover") print_frame(L("F_COVER")) cover();
else if (PART == "hopper") print_frame(L("F_HOPPER")) hopper();
else if (PART == "adapter") adapter();
else if (PART == "coupon") coupon();
else if (PART == "bracket") bracket();
