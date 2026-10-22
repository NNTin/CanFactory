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
BETA = L("BETA"); UP = L("UP"); MOUTH = L("MOUTH"); MOUTH_CLEAR = L("MOUTH_CLEAR"); TUBE_BORE = L("TUBE_BORE"); TUBE_WALL = L("TUBE_WALL"); TUBE_LENGTH = L("TUBE_LENGTH");
NECK_T = L("NECK_T"); NECK_E = L("NECK_E"); NECK_PITCH = L("NECK_PITCH"); NECK_TURNS = L("NECK_TURNS");
THREAD_CLEARANCE = L("THREAD_CLEARANCE"); ADAPTER_H = L("ADAPTER_H");
M3_HOLE = L("M3_HOLE"); M3_NUT_S = L("M3_NUT_S"); M3_NUT_M = L("M3_NUT_M"); M25_PILOT = L("M25_PILOT");
INSERT_HOLE = L("INSERT_HOLE"); INSERT_DEPTH = L("INSERT_DEPTH");
WALL_Y = L("WALL_Y"); LUGS = L("LUGS"); SEAT_W = L("SEAT_W"); BOTTLE_D = L("BOTTLE_D"); OFFSET = L("OFFSET"); ROT = L("ROT");
POD = L("POD"); POD_WALL = L("POD_WALL"); POD_COVER = L("POD_COVER"); POD_R = L("POD_R"); POD_PLUG = L("POD_PLUG"); LID_PROUD = L("LID_PROUD");
FEED_COLLAR = L("FEED_COLLAR"); FEED_COLLAR_H = L("FEED_COLLAR_H"); FEED_TAB = L("FEED_TAB"); FEED_TAB_PAD = L("FEED_TAB_PAD"); FEED_FIT = L("FEED_FIT"); FEED_BOSS = L("FEED_BOSS");
MOTOR_D = L("MOTOR_D"); MOTOR_L = L("MOTOR_L"); MOTOR_FACE = L("MOTOR_FACE"); HOUSING_W = L("HOUSING_W"); HOUSING_R = L("HOUSING_R"); EAR_R = L("EAR_R");
HOOD_WALL = L("HOOD_WALL"); HOOD_CLEAR = L("HOOD_CLEAR"); HOOD_EAR_GAP = L("HOOD_EAR_GAP"); HOOD_TAB = L("HOOD_TAB");
DRIVER_POS = L("DRIVER_POS"); DRIVER_HOLES = L("DRIVER_HOLES"); CASE_POS = L("CASE_POS"); CASE_ROT = L("CASE_ROT"); CASE_BASE = L("CASE_BASE");

// the spindle: a round collar through the plate's bushing (the disc sits on its shoulder), then a D into the disc
COLLAR = SPINDLE + 2;
// the gear rests on a thrust boss on the cover around its pin
PIN_D = 4; THRUST = GEAR_BOTTOM - COVER_FRONT - 0.2;
// lugs on the plate's rim: three for the chamber, two (±X) for the bracket's arms
HOPPER_LUGS = [90, 240, 300]; LUG_R = PLATE_R + 6; LUG_PAD = 11;
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

// ---------------------------------------------------------------------------------------- the chamber (rim wall and lid), the feed tube
// The chamber prints lid down: its rim wall rises from the lid, with no roof to support. The feed tube is a separate part that prints
// flange down; it passes through the lid down to its mouth inside the chamber, its collar on the lid, two M3 screws into inserts.
module tube_frame() { translate(MOUTH) rotate([-BETA, 0, 0]) children(); }
TUBE_OUT = TUBE_BORE / 2 + TUBE_WALL;
// where the tube's axis crosses the lid's outer plane (D), and the tube's outline there: an ellipse, r across and r / cos β along
LID_CY = MOUTH[1] + UP[1] * (LID_TOP - MOUTH[2]) / UP[2];
module lid_ellipse(r) { translate([0, LID_CY]) scale([1, 1 / cos(BETA)]) circle(r = r, $fn = 72); }
module hopper() {
  difference() {
    union() {
      difference() {
        translate([0, 0, PLATE_TOP]) cylinder(r = RIM_OUT, h = LID_TOP - PLATE_TOP, $fn = 144);
        translate([0, 0, PLATE_TOP - 1]) cylinder(r = RIM_IN, h = LID - PLATE_TOP + 1, $fn = 144);
      }
      // lugs from inside the rim wall (never into the chamber) out to the plate's lugs
      for (a = HOPPER_LUGS) rotate([0, 0, a]) hull() {
        translate([RIM_IN + 0.5 + LUG_PAD / 2, 0, PLATE_TOP]) cylinder(r = LUG_PAD / 2, h = 4);
        translate([LUG_R, 0, PLATE_TOP]) cylinder(r = LUG_PAD / 2, h = 4);
        // a gusset up the rim wall, steep enough to print without support (the chamber prints lid down)
        translate([RIM_OUT - 0.5, -LUG_PAD / 2, PLATE_TOP + 4 + 1.5 * (LUG_R + LUG_PAD / 2 - RIM_OUT)]) cube([0.5, LUG_PAD, 0.01]);
      }
      // under each lug's gusset a rib down the rim wall to the lid, so that the gusset's first layers stand on something
      for (a = HOPPER_LUGS) rotate([0, 0, a]) translate([RIM_OUT - 1, -3, PLATE_TOP + 4 + 1.5 * (LUG_R + LUG_PAD / 2 - RIM_OUT) - 1]) cube([2.5, 6, LID_TOP - (PLATE_TOP + 4 + 1.5 * (LUG_R + LUG_PAD / 2 - RIM_OUT) - 1)]);
      // bosses under the lid for the feed tube's inserts (pressed in from inside), high in the chamber, away from the pile
      for (s = [-1, 1]) translate([s * FEED_TAB[0], LID_CY + FEED_TAB[1], LID - INSERT_DEPTH - 1]) cylinder(d = FEED_BOSS, h = INSERT_DEPTH + 1.01, $fn = 32);
    }
    tube_frame() translate([0, 0, -1]) cylinder(r = TUBE_OUT + FEED_FIT, h = TUBE_LENGTH + 2, $fn = 72);
    for (s = [-1, 1]) translate([s * FEED_TAB[0], LID_CY + FEED_TAB[1], 0]) {
      translate([0, 0, LID - INSERT_DEPTH - 1.01]) cylinder(d = INSERT_HOLE, h = INSERT_DEPTH, $fn = 24);
      translate([0, 0, LID - 2]) cylinder(d = M3_HOLE, h = 10, $fn = 24);
    }
    for (a = HOPPER_LUGS) rotate([0, 0, a]) translate([LUG_R, 0, PLATE_TOP - 1]) cylinder(d = M3_HOLE, h = 10, $fn = 24);
    // index mark on the rim, in line with the disc's mark when a notch rests either side of the outlet
    rotate([0, 0, NOTCH_ANGLES[0] - 45]) translate([RIM_IN - 0.5, -0.5, PLATE_TOP - 1]) cube([1.2, 1, 9]);
    // nothing may reach below the plate's top
    translate([0, 0, PLATE_TOP - 50]) cylinder(r = 200, h = 50);
  }
}
module feed_d() {
  difference() {
    union() {
      // the mouth: cut level, and nearer the disc parallel to its face, MOUTH_CLEAR off it (no treat can be wedged under the edge)
      intersection() {
        tube_frame() cylinder(r = TUBE_OUT, h = TUBE_LENGTH, $fn = 72);
        translate([-200, -200, MOUTH_CLEAR]) cube([400, 400, 400]);
      }
      tube_frame() translate([0, 0, TUBE_LENGTH - FLANGE_T]) cylinder(d = FLANGE_D, h = FLANGE_T, $fn = 72);
      // the collar: a plate on the lid's outer face round the downhill half of the tube, out to the two screw tabs (only where the
      // lid is); as the tube prints flange down, each of its layers stands on the one below
      translate([0, 0, LID_TOP]) linear_extrude(FEED_COLLAR_H) intersection() {
        hull() {
          intersection() { lid_ellipse(TUBE_OUT + FEED_COLLAR); translate([-50, LID_CY - 100]) square([100, 100]); }
          for (s = [-1, 1]) translate([s * FEED_TAB[0], LID_CY + FEED_TAB[1]]) circle(d = FEED_TAB_PAD, $fn = 32);
        }
        circle(r = RIM_OUT, $fn = 144);
      }
    }
    tube_frame() {
      translate([0, 0, -1]) cylinder(r = TUBE_BORE / 2, h = TUBE_LENGTH + 2, $fn = 72);
      for (s = [-1, 1]) translate([s * FLANGE_HOLE, 0, TUBE_LENGTH - FLANGE_T - 8]) {
        cylinder(d = M3_HOLE, h = 20, $fn = 24);
        cylinder(d = M3_NUT_S / cos(30) + 0.3, h = 8 + FLANGE_T - 1.6, $fn = 6);
      }
    }
    for (s = [-1, 1]) translate([s * FEED_TAB[0], LID_CY + FEED_TAB[1], LID_TOP - 1]) cylinder(d = M3_HOLE, h = FEED_COLLAR_H + 2, $fn = 24);
  }
}
// printed upside down in W about the adapter's seat: the flange's top on the bed
module feed() { F = L("F_FEED"); rotate([180, 0, 0]) translate([-F[0], -F[1], -F[2]]) translate(OFFSET) rotate(ROT) feed_d(); }

// ------------------------------------------------------------------------- the motor hood: a cup over the 28BYJ-48, clamped by its ear screws
module hood_profile(d) {
  offset(delta = d) hull() {
    circle(d = MOTOR_D + 2 * HOOD_CLEAR, $fn = 96);
    translate([-HOUSING_W / 2 - HOOD_CLEAR, -HOUSING_R - HOOD_CLEAR]) square([HOUSING_W + 2 * HOOD_CLEAR, HOUSING_R + HOOD_CLEAR]);
  }
}
module hood() {
  rim = MOTOR_FACE - HOOD_EAR_GAP; depth = MOTOR_L - HOOD_EAR_GAP + HOOD_CLEAR; cap = 16; inset = 10.5;
  translate([CAN_AT[0], CAN_AT[1], 0]) difference() {
    union() {
      // wall and a dome closing it, its sides about 35° off its axis and a small flat top (prints without support)
      hull() {
        translate([0, 0, rim - depth]) linear_extrude(depth) hood_profile(HOOD_WALL);
        translate([0, 0, rim - depth - cap]) linear_extrude(0.01) hood_profile(HOOD_WALL - inset);
      }
      // tabs under the motor's ear screws, behind its ears
      for (s = [-1, 1]) hull() {
        translate([s * EAR_SPAN / 2, 0, rim - HOOD_TAB]) cylinder(r = EAR_R + 1.5, h = HOOD_TAB, $fn = 32);
        translate([s * (MOTOR_D / 2), 0, rim - HOOD_TAB]) cylinder(r = EAR_R + 1.5, h = HOOD_TAB, $fn = 32);
      }
    }
    hull() {
      translate([0, 0, rim - depth]) linear_extrude(depth + 1) hood_profile(0);
      translate([0, 0, rim - depth - cap + HOOD_WALL * 1.75]) linear_extrude(0.01) hood_profile(-inset);
    }
    for (s = [-1, 1]) translate([s * EAR_SPAN / 2, 0, 0]) {
      translate([0, 0, rim - 10]) cylinder(d = M3_HOLE, h = 20, $fn = 24);
      // room for the screw's head over the tab, through the wall
      translate([0, 0, rim - HOOD_TAB - 40]) cylinder(d = 6.5, h = 40, $fn = 32);
    }
    // the lead leaves the wire housing's outer face just behind the ears
    translate([-5, -HOUSING_R - HOOD_CLEAR - HOOD_WALL - 1, rim - 6]) cube([10, HOOD_WALL + 2, 7]);
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

// ----------------------------------------------------------------- the wall bracket: electronics pod, spine, arms, bottle saddle
// All in W. The pod is a box against the wall under the chamber, open in front (its cover is a separate part); the spine runs up
// from it to a saddle whose two ribs cradle the bottle and carry a strap; two arms run from the pod's top corners to the plate's lugs.
// Prints on its wall face: every wall rises from the bed.
module rbox(size, r) {
  // a box with rounded vertical (Y) edges, as seen from the front
  hull() for (x = [r, size[0] - r]) for (z = [r, size[2] - r]) translate([x, 0, z]) rotate([-90, 0, 0]) cylinder(r = r, h = size[1], $fn = 32);
}
CASE_W = 21.8; CASE_L = 25.8; LID_W = 19.8; LIP = 0.6;
// the cover's right-hand screws: between the ULN2003 board and the case's header plugs
COVER_SCREW_X = 5;
SADDLE = [SEAT_W[2] + 40, SEAT_W[2] + 70]; RIB_X = 30; SPINE_W = 32; FLANGE = 8;
BACK = 2.5;
module pod_shell() {
  x0 = POD[0]; x1 = POD[1]; y0 = POD[2]; y1 = POD[3]; z0 = POD[4]; z1 = POD[5]; w = POD_WALL;
  cy = CASE_POS[1];
  difference() {
    union() {
      translate([x0, y0, z0]) rbox([x1 - x0, y1 - y0 + BACK, z1 - z0], POD_R);
    }
    translate([x0 + w, y0 - 1, z0 + w]) rbox([x1 - x0 - 2 * w, y1 - y0 + 1, z1 - z0 - 2 * w], POD_R - w);
    // the case's slot in the +X wall, from its foot to the roof (the lid slides up in it) and open to the front (no bridge to print);
    // a lip at its back holds the base's wall, the cover's lip its front
    translate([x1 - w - 1, y0 - 1, CASE_POS[2] - CASE_L / 2 - 0.3]) cube([w + 2 - LIP, cy + CASE_W / 2 + 0.3 - y0 + 1, z1 - w - (CASE_POS[2] - CASE_L / 2) + 0.3]);
    translate([x1 - LIP - 0.01, y0 - 1, CASE_POS[2] - CASE_L / 2 - 0.3]) cube([LIP + 1, cy + LID_W / 2 + 0.4 - y0 + 1, z1 - w - (CASE_POS[2] - CASE_L / 2) + 0.3]);
    // USB-C: the plug comes up through the floor under the case's foot, in a notch open to the front (the cover closes it)
    translate([CASE_POS[0] + 4, y0 - 1, z0 - 1]) cube([x1 - CASE_POS[0] - 4 + 1, cy + 7 - y0 + 1, w + 2]);
    // keyholes, low in the back
    for (x = [x0 + 14, x1 - 14]) translate([x, y1 - 1, z0 + 14]) keyhole();
  }
  // cover screws: columns with M2.5 pilots from the front, in the corners on the board's side and between the board and the case
  for (x = [x0 + w, COVER_SCREW_X - 3]) for (z = [z0 + w, z1 - w - 6]) difference() {
    translate([x, y0, z]) cube([6, y1 - y0, 6]);
    translate([x + 3, y0 - 1, z + 3]) rotate([-90, 0, 0]) cylinder(d = M25_PILOT, h = 12, $fn = 16);
  }
  // a keeper behind the case's floor at its back edge (clear of its header pins), so that it cannot be pushed in (the cover has the other)
  translate([CASE_POS[0] + CASE_BASE[2] - 2.5, cy + CASE_W / 2 - 1.5, CASE_POS[2] - CASE_L / 2]) cube([2.5, y1 - (cy + CASE_W / 2 - 1.5) + 0.01, CASE_L]);
  // ULN2003 standoffs
  for (h = DRIVER_HOLES) translate([DRIVER_POS[0] + h[0], y1 + 0.01, DRIVER_POS[2] + h[1]]) rotate([90, 0, 0]) difference() {
    cylinder(d = 6, h = y1 - DRIVER_POS[1] + 0.01, $fn = 24);
    translate([0, 0, 1]) cylinder(d = M25_PILOT, h = 20, $fn = 16);
  }
}
module keyhole() { rotate([-90, 0, 0]) { cylinder(d = 8, h = BACK + 2, $fn = 32); translate([-2, -10, 0]) cube([4, 10, BACK + 2]); } }
module bracket_w() {
  x0 = POD[0]; x1 = POD[1]; y0 = POD[2]; y1 = POD[3]; z1 = POD[5];
  by = SEAT_W[1]; br = BOTTLE_D / 2;
  difference() {
    union() {
      pod_shell();
      // the spine: a plate on the wall with two flanges, from inside the pod's roof to the saddle
      translate([-SPINE_W / 2, y1, z1 - POD_R]) cube([SPINE_W, BACK, SADDLE[1] - z1 + POD_R]);
      for (s = [-1, 1]) translate([s > 0 ? SPINE_W / 2 - 2.4 : -SPINE_W / 2, y1 - FLANGE, z1 - 0.01]) cube([2.4, FLANGE + 0.01, SADDLE[0] - z1 + 0.01]);
      // the saddle: a band on the wall and two ribs that touch the bottle, slots for a strap round it
      translate([-RIB_X - 1.2, y1, SADDLE[0]]) cube([2 * RIB_X + 2.4, BACK, SADDLE[1] - SADDLE[0]]);
      for (s = [-1, 1]) difference() {
        translate([s * RIB_X - 1.2, by + sqrt(br * br - (RIB_X + 1.2) * (RIB_X + 1.2)) - 2, SADDLE[0]]) cube([2.4, y1 - by - sqrt(br * br - (RIB_X + 1.2) * (RIB_X + 1.2)) + 2.01, SADDLE[1] - SADDLE[0]]);
        translate([s * RIB_X - 2, y1 - 9, SADDLE[0] + 4]) cube([4, 4, SADDLE[1] - SADDLE[0] - 8]);
      }
      // arms: from a pad on each lug on the plate's rim (on its chamber side) to a block on the pod's roof, behind the cover
      for (q = LUGS) hull() {
        translate(q) rotate([-BETA, 0, 0]) translate([0, 0, PLATE_TOP - PLATE_BOTTOM]) cylinder(d = LUG_PAD, h = 3, $fn = 32);
        translate([q[0] > 0 ? x1 - 12 : x0 + 2, y0 + 3, z1 - 0.01]) cube([10, y1 + BACK - y0 - 3, 5]);
      }
    }
    // the bottle, 0.5 mm clear
    translate([0, by, SADDLE[0] - 1]) cylinder(r = br + 0.5, h = SADDLE[1] - SADDLE[0] + 2, $fn = 192);
    for (q = LUGS) translate(q) rotate([-BETA, 0, 0]) translate([0, 0, -20]) cylinder(d = M3_HOLE, h = 40, $fn = 24);
    for (x = [-RIB_X + 9, RIB_X - 9]) translate([x, y1 - 1, SADDLE[1] - 12]) keyhole();
  }
}
module bracket() { translate([0, 0, WALL_Y + BACK]) rotate([-90, 0, 0]) bracket_w(); }

// the pod's cover, in W: a plate over its open front, four M2.5 screws, a notch for the motor's lead; printed outer face down
module pod_cover_w() {
  x0 = POD[0]; x1 = POD[1]; y0 = POD[2]; z0 = POD[4]; z1 = POD[5]; w = POD_WALL;
  difference() {
    translate([x0, y0 - POD_COVER, z0]) rbox([x1 - x0, POD_COVER, z1 - z0], POD_R);
    for (x = [x0 + w + 3, COVER_SCREW_X]) for (z = [z0 + w + 3, z1 - w - 3]) translate([x, y0 - POD_COVER - 1, z]) rotate([-90, 0, 0]) cylinder(d = 2.9, h = POD_COVER + 2, $fn = 16);
    translate([-6, y0 - POD_COVER - 1, z1 - 8]) cube([12, POD_COVER + 2, 9]);
  }
  // the keeper in front of the case's floor, and the lip over the front of its base's wall
  translate([CASE_POS[0] + CASE_BASE[2] - 2.5, y0 - 0.01, CASE_POS[2] - CASE_L / 2 + 2]) cube([2.5, CASE_POS[1] - CASE_W / 2 + 1.5 - y0 + 0.01, CASE_L - 4]);
  translate([x1 - LIP, y0 - 0.01, CASE_POS[2] - CASE_L / 2]) cube([LIP, CASE_POS[1] - LID_W / 2 - 1 - y0 + 0.01, z1 - w - (CASE_POS[2] - CASE_L / 2)]);
}
module pod_cover() { F = L("F_POD_COVER"); rotate([90, 0, 0]) translate([-F[0], -F[1], -F[2]]) pod_cover_w(); }

if (PART == "disc") print_frame(L("F_DISC")) disc();
else if (PART == "gear") print_frame(L("F_GEAR")) gear();
else if (PART == "pinion") print_frame(L("F_PINION")) pinion();
else if (PART == "body") print_frame(L("F_BODY")) body();
else if (PART == "cover") print_frame(L("F_COVER")) cover();
else if (PART == "hopper") print_frame(L("F_HOPPER")) hopper();
else if (PART == "feed") feed();
else if (PART == "hood") print_frame(L("F_HOOD")) hood();
else if (PART == "pod-cover") pod_cover();
else if (PART == "adapter") adapter();
else if (PART == "coupon") coupon();
else if (PART == "bracket") bracket();
