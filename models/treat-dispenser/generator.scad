// Gumball-style treat dispenser: an inverted PET bottle screws into the top; a horizontal rotor with two pockets, turned directly by
// a 28BYJ-48, carries treats from under the funnel to the drop onto a chute out of the front. After bovineblitz's "Cat treat
// gumball-style dispenser" (MakerWorld 190887, CC BY-NC 4.0), itself after cylus80's "Mason Jar Candy Dispenser" (Thingiverse
// 2103924, CC BY 4.0); see ATTRIBUTION.md. Redrawn for CanFactory: PET thread, motor, electronics inside.
//
// Every dimension comes from LAYOUT, a list of [name, value] pairs written by packages/contracts/src/treatDispenser.ts
// (treatScadValues): the same numbers the physics' collision pieces and the assembly poses are made from. Every part is drawn in the
// assembled frame W (Z up, floor at z = 0, the rotor's axis along X at y = 0, the front at −Y) and then laid on the bed by the inverse
// of its pose (P_*: [x, y, z, rx, ry, rz]). Millimetres.

PART = "inner-body";
LAYOUT = [];

function L(name) = let(i = search([name], LAYOUT, 1, 0)[0]) i == undef ? undef : LAYOUT[i][1];

$fn = 64;
WALL = L("WALL"); SHELL = L("SHELL"); BASE = L("BASE"); HALF_W = L("HALF_W"); FRONT = L("FRONT"); BACK = L("BACK"); BASE_RECT = L("BASE_RECT");
R = L("R"); ROTOR_END = L("ROTOR_END"); POCKET = L("POCKET"); POCKETS = L("POCKETS");
BORE_R = L("BORE_R"); BORE_HALF = L("BORE_HALF"); BLOCK = L("BLOCK"); SLOT = L("SLOT");
AXIS_Z = L("AXIS_Z"); BLOCK_BOTTOM = L("BLOCK_BOTTOM"); BLOCK_TOP = L("BLOCK_TOP"); BLOCK_BACK = L("BLOCK_BACK"); CAVITY_R = L("CAVITY_R"); FLAP = L("FLAP"); LIP_Z = L("LIP_Z"); LIP_R = L("LIP_R"); BOSS_TOP = L("BOSS_TOP");
CHUTE = L("CHUTE"); CHUTE_END = L("CHUTE_END"); CHUTE_BACK = L("CHUTE_BACK"); CHUTE_SLOPE = L("CHUTE_SLOPE"); EXIT_Z = L("EXIT_Z");
CHUTE_FLOOR = L("CHUTE_FLOOR"); CHUTE_WALL = L("CHUTE_WALL"); CHUTE_SIDE = L("CHUTE_SIDE");
NECK_T = L("NECK_T"); NECK_E = L("NECK_E"); NECK_PITCH = L("NECK_PITCH"); NECK_TURNS = L("NECK_TURNS");
THREAD_CLEARANCE = L("THREAD_CLEARANCE"); THREAD_R = L("THREAD_R"); BOSS_R = L("BOSS_R");
MOTOR_FACE = L("MOTOR_FACE"); BOSS_D = L("BOSS_D"); SHAFT_D = L("SHAFT_D"); SHAFT_FLATS = L("SHAFT_FLATS"); SHAFT_ROUND = L("SHAFT_ROUND");
CAP = L("CAP"); PIN = L("PIN"); GAP = L("GAP"); LUG = L("LUG"); FOOT = L("FOOT"); STANDOFF = L("STANDOFF"); COLUMN_R = L("COLUMN_R");
BOLTS = L("BOLTS"); NUT = L("NUT"); M3_HOLE = L("M3_HOLE"); HEAD = L("HEAD");
CASE_POS = L("CASE_POS"); USB = L("USB");

// the ESP32 case's outline (its base 25.8 × 21.8) and its floor's depth, from the case model's own parts
CASE_L = 25.8; CASE_W = 21.8; CASE_FLOOR = 6;
// the flap: its root (y, z) on the slot's back wall, length, angle from the vertical (towards the back), thickness, and its root block's
// side; the block sits over the root, behind the slot's back wall, the filament pin through its middle
FLAP_BLOCK = FLAP[5]; FLAP_PIN = [FLAP[0] + FLAP_BLOCK / 2, FLAP[1] + 0.45 * FLAP_BLOCK];
DROP_Y = -BORE_R * sin(30);
TAN = tan(CHUTE_SLOPE);
function chute_at(y) = EXIT_Z + (y - CHUTE_END) * TAN;

// overhangs are kept at least this steep (degrees from the horizontal), so that nothing inside needs support
STEEP = 50;
// a hole along +X from x = 0, of radius r and length h, peaked upwards (a teardrop) so that its top prints without support
module hole_x(r, h) {
  rotate([0, 90, 0]) linear_extrude(h) polygon(concat([[-r / cos(STEEP), 0]], [for (i = [0:48]) let(a = -(180 - STEEP) + i * (360 - 2 * STEEP) / 48) r * [cos(a), sin(a)]]));
}
// the flap's root block in section (y, z from the root): as deep as its side, its top sloping up to the front at STEEP (1.5 times its
// side high at the slot's back wall), so that the recess it sits in prints without support; grown by g for the recess
FLAP_KNEE = 1.5 * FLAP[5] - FLAP[5] * tan(STEEP);
function flap_block(g) = [[-g, -g], [FLAP_BLOCK + g, -g], [FLAP_BLOCK + g, FLAP_KNEE + g], [-g, FLAP_KNEE + g + (FLAP_BLOCK + 2 * g) * tan(STEEP)]];
module flap_block_x(x0, x1, g) { translate([x0, FLAP[0], FLAP[1]]) rotate([90, 0, 90]) linear_extrude(x1 - x0) polygon(flap_block(g)); }

// the shell's section across X (y, z): a gable, its front and back sloping up at STEEP to a flat top as wide as the thread's boss, so
// that the top prints without support (bridged from slope to slope; a little wider than the boss, so that its round never touches the
// slopes' edges); the side walls stay upright for the cap and the flap's pin
function gable(front, back, base, top, half) = [[front, base], [back, base], [back, top - (back - half) * tan(STEEP)], [half, top], [-half, top], [front, top - (-half - front) * tan(STEEP)]];
// below the right side's hip: a plane down from just beyond the boss at the top to the right at STEEP, moved in by d
module hip(d) { translate([BOSS_R + 3 - d / sin(STEEP), 0, LIP_Z]) rotate([0, STEEP, 0]) translate([-200, -200, -400]) cube([400, 400, 400]); }
module along_x(x0, x1) { translate([x0, 0, 0]) rotate([90, 0, 90]) linear_extrude(x1 - x0) children(); }

// the chute's way's section at y (x, z): up to the chute's walls (and 0.3 over them) at the legs, then sloping up at STEEP to a peak, or
// flat 0.8 under the bore's bottom where the peak would reach it, but up to (0.5 past) the drop's edges at least. Linear in y between the places
// where the peak meets that flat and the flat meets the drop's edges, so it is cut as three hulls
WAY_RISE = CHUTE[2] * tan(STEEP); WAY_EDGE = (CHUTE[2] - SLOT[0] + 0.5) * tan(STEEP); WAY_CAP = AXIS_Z - BORE_R - 0.8;
function way_c(y) = chute_at(y) + CHUTE_SIDE + 0.3;
function way_at(c) = CHUTE_END + (c - CHUTE_SIDE - 0.3 - EXIT_Z) / TAN;
WAY_Y0 = -BLOCK[1] - 1; WAY_Y1 = BLOCK_BACK + 1;
WAY_YS = [WAY_Y0, min(WAY_Y1, max(WAY_Y0, way_at(WAY_CAP - WAY_RISE))), min(WAY_Y1, max(WAY_Y0, way_at(WAY_CAP - WAY_EDGE))), WAY_Y1];
function way(y) = let(c = way_c(y), top = max(c + WAY_EDGE, min(c + WAY_RISE, WAY_CAP)), k = CHUTE[2] - (top - c) / tan(STEEP))
  [[-CHUTE[2], BASE - 1], [CHUTE[2], BASE - 1], [CHUTE[2], c], [max(k, 0.01), top], [-max(k, 0.01), top], [-CHUTE[2], c]];

// rounded box: x0..x1, y0..y1, z0..z1, its vertical edges rounded
module rbox(x0, x1, y0, y1, z0, z1, r) {
  hull() for (x = [x0 + r, x1 - r]) for (y = [y0 + r, y1 - r]) translate([x, y, z0]) cylinder(r = r, h = z1 - z0);
}
// the inverse of a part's pose: W → its print frame
module print_pose(P) { rotate([-P[3], 0, 0]) rotate([0, -P[4], 0]) rotate([0, 0, -P[5]]) translate([-P[0], -P[1], -P[2]]) children(); }

// ------------------------------------------------------------------------------------------------------------------------ the bolts
// BOLTS: [head's seat x, y, z, axis x, y, z (head to tip), the nut's way in x, y, z, screw length, the nut's face along the axis, its
// slot's length, the part its nut is in: 1 inner body, 2 outer body]. A bolt's frame: its origin on the axis `d` from the head's seat,
// Z along the screw, X the way its nut goes in.
module bolt_frame(b, d = 0) {
  a = [b[3], b[4], b[5]]; e = [b[6], b[7], b[8]]; s = cross(a, e); o = [b[0], b[1], b[2]] + d * a;
  multmatrix([[e[0], s[0], a[0], o[0]], [e[1], s[1], a[1], o[1]], [e[2], s[2], a[2], o[2]], [0, 0, 0, 1]]) children();
}
// the screw's clearance hole from its head's seat to 0.5 past its tip, and room for its head (a counterbore where the head goes in)
module bolt_hole(b) {
  bolt_frame(b) {
    translate([0, 0, -0.01]) cylinder(d = M3_HOLE, h = b[9] + 0.51, $fn = 24);
    translate([0, 0, -HEAD[1]]) cylinder(d = HEAD[0], h = HEAD[1] + 0.01, $fn = 32);
  }
}
// the nut's bay: a hexagon across its flats (NUT[0], the nut's flats with play) and as deep as the nut with play, and the slot it goes
// in by, as wide as the hexagon across its flats, so that the nut cannot turn in it
module nut_bay(b) {
  bolt_frame(b, b[10]) linear_extrude(NUT[1]) {
    circle(r = NUT[0] / sqrt(3), $fn = 6);
    translate([0, -NUT[0] / 2]) square([b[11], NUT[0]]);
  }
}
module bolt_cuts(part) { for (b = BOLTS) { bolt_hole(b); if (b[12] == part) nut_bay(b); } }

// a teardrop round the rotor's axis in the (y, z) section, its point down at STEEP (a cantilever along X that prints without support)
module teardrop_yz(r) { hull() { translate([0, AXIS_Z]) circle(r = r, $fn = 72); translate([0, AXIS_Z - r / cos(STEEP)]) square(0.01, center = true); } }

// --------------------------------------------------------------------------------------------------------------- the inner body
// Everything the mechanism needs, on legs and four feet screwed to the base plate: the bottle's thread, the funnel, the rotor's block,
// the motor (on its +X face) and the ULN2003 board (on standoffs off the right leg), and a sleeve carrying the bore out to the left,
// with two lugs for the bearing cap's screws just inside the outer body's left wall
module inner_body_w() {
  difference() {
    union() {
      // the thread's boss, on a cone (STEEP) from the funnel's top
      translate([0, 0, LIP_Z - 0.01]) cylinder(r = BOSS_R, h = BOSS_TOP - LIP_Z + 0.01, $fn = 96);
      cone = (BOSS_R - LIP_R - WALL) * tan(STEEP);
      translate([0, 0, LIP_Z - WALL - cone]) cylinder(r1 = LIP_R + WALL, r2 = BOSS_R, h = cone + WALL, $fn = 96);
      // the funnel's walls, from the lip's opening down to the slot
      hull() {
        translate([0, 0, LIP_Z - WALL]) cylinder(r = LIP_R + WALL, h = WALL, $fn = 72);
        translate([-SLOT[0] - WALL, -SLOT[1] - WALL, BLOCK_TOP - 1]) cube([2 * (SLOT[0] + WALL), 2 * (SLOT[1] + WALL), 1]);
      }
      // the rotor's block (deep behind, round the cavity); its top slopes down to the back at STEEP, a wall clear of the cavity's round
      intersection() {
        translate([-BLOCK[0], -BLOCK[1], BLOCK_BOTTOM]) cube([2 * BLOCK[0], BLOCK[1] + BLOCK_BACK, BLOCK_TOP - BLOCK_BOTTOM]);
        translate([-BLOCK[0] - 1, (CAVITY_R + WALL) * sin(STEEP), AXIS_Z + (CAVITY_R + WALL) * cos(STEEP)]) rotate([-STEEP, 0, 0]) translate([0, -100, -200]) cube([2 * BLOCK[0] + 2, 200, 200]);
      }
      // under the block, from the base up: the chute's way is cut out of it (below), which leaves the legs either side of the chute and,
      // between them, the way's sloping ceiling
      translate([-CHUTE[3], -BLOCK[1], BASE]) cube([2 * CHUTE[3], BLOCK[1] + BLOCK_BACK, BLOCK_BOTTOM - BASE + 0.01]);
      // the feet, outside the legs at their front and back ends
      for (b = BOLTS) if (b[12] == 1 && b[5] == 1) translate([b[0] - FOOT / 2 - 0.01, b[1] - FOOT / 2, BASE]) cube([FOOT + 0.02, FOOT, FOOT]);
      // the sleeve from the block's left face to the lugs, and the lugs: their undersides at STEEP down to a point under the axis
      along_x(LUG[0] + LUG[1] - 0.01, -BLOCK[0] + 0.01) teardrop_yz(BORE_R + WALL);
      along_x(LUG[0], LUG[0] + LUG[1]) {
        teardrop_yz(BORE_R + WALL);
        // flat on top, so that the nuts' slots open upwards
        hull() {
          for (s = [-1, 1]) translate([s * LUG[3], AXIS_Z]) square(2 * LUG[2], center = true);
          translate([0, AXIS_Z - LUG[2] - (LUG[3] + LUG[2]) * tan(STEEP)]) square(0.01, center = true);
        }
      }
      // the ULN2003 board's standoffs on the right leg, each with a gusset under it down the leg
      for (b = BOLTS) if (b[12] == 1 && b[3] == -1 && b[8] == 1) hull() {
        translate([MOTOR_FACE - 0.01, b[1], b[2]]) rotate([0, 90, 0]) cylinder(d = STANDOFF[0], h = STANDOFF[1] + 0.01, $fn = 32);
        translate([MOTOR_FACE - 0.01, b[1], b[2] - STANDOFF[1] * tan(STEEP)]) rotate([0, 90, 0]) cylinder(d = STANDOFF[0], h = 0.01, $fn = 32);
      }
    }
    // the thread, and the lip's opening into the funnel
    translate([0, 0, LIP_Z]) bottle_bore(BOSS_TOP - LIP_Z, NECK_TURNS, BOSS_TOP - LIP_Z - 1);
    translate([0, 0, LIP_Z - WALL - 1]) cylinder(r = LIP_R, h = WALL + 2, $fn = 72);
    hull() {
      translate([0, 0, LIP_Z - WALL - 0.01]) cylinder(r = LIP_R, h = 0.02, $fn = 72);
      translate([-SLOT[0], -SLOT[1], BLOCK_TOP - 1]) cube([2 * SLOT[0], 2 * SLOT[1], 1]);
    }
    // the bore, through the sleeve (open at −X for the rotor and its cap), the slot above it and the drop below it
    translate([LUG[0] - 1, 0, AXIS_Z]) hole_x(BORE_R, BORE_HALF - LUG[0] + 1);
    translate([-SLOT[0], -SLOT[1], AXIS_Z]) cube([2 * SLOT[0], 2 * SLOT[1], BLOCK_TOP - AXIS_Z + 0.02]);
    // the drop: from the tight bore's lower front edge back into the cavity
    translate([-SLOT[0], DROP_Y, BLOCK_BOTTOM - 1]) cube([2 * SLOT[0], CAVITY_R - DROP_Y, AXIS_Z - BLOCK_BOTTOM + 1]);
    // the cavity round the rotor's descending (back) side, under a roof at the flap's root (its round top prints as bridges between its
    // side walls)
    intersection() {
      translate([-SLOT[0], 0, AXIS_Z]) rotate([0, 90, 0]) cylinder(r = CAVITY_R, h = 2 * SLOT[0], $fn = 144);
      translate([-SLOT[0] - 1, SLOT[1], BLOCK_BOTTOM - 20]) cube([2 * SLOT[0] + 2, CAVITY_R, FLAP[1] - BLOCK_BOTTOM + 20]);
    }
    // the flap's recess over the cavity's roof, open to the slot and to the cavity below (the flap goes in from below), and its pin's hole,
    // from the block's left face, blind at the right
    flap_block_x(-SLOT[0], SLOT[0], 0.16);
    translate([-BLOCK[0] - 1, FLAP_PIN[0], FLAP_PIN[1]]) hole_x((PIN + 0.15) / 2, BLOCK[0] + SLOT[0] + 5);
    // the motor's boss and shaft through the +X face (the motor goes on from the side; its ears' screws are bolts)
    translate([BORE_HALF - 0.01, 0, AXIS_Z]) hole_x((BOSS_D + 1) / 2, BLOCK[0] - BORE_HALF + 1);
    // the chute's way in between the legs, from below, up over its walls' tops along its slope (the legs hold it); its ceiling slopes up
    // from the legs at STEEP, beside the drop at least, and is flat only where it closes under the block's front, so that it prints
    // without support
    for (i = [0:2]) if (WAY_YS[i + 1] > WAY_YS[i] + 0.01) hull() for (y = [WAY_YS[i], WAY_YS[i + 1]]) translate([0, y, 0]) rotate([90, 0, 0]) linear_extrude(0.01, center = true) polygon(way(y));
    bolt_cuts(1);
  }
}
module inner_body() { print_pose(L("P_INNER")) inner_body_w(); }

// --------------------------------------------------------------------------------------------------------------- the outer body
// The cover: walls and a gable top, hipped down to the right side too (the left side stays upright for the cap), open at the bottom,
// lowered over the inner body (the thread's boss comes up through its top) and screwed to the base plate at its corners; the cap's
// screws clamp its left wall to the inner body's lugs. The ESP32 case in a window of its back wall.
module outer_body_w() {
  inner_x = HALF_W - SHELL;
  difference() {
    union() {
      difference() {
        intersection() {
          rbox(-HALF_W, HALF_W, FRONT, BACK, BASE, LIP_Z, 8);
          along_x(-HALF_W - 1, HALF_W + 1) polygon(gable(FRONT, BACK, BASE, LIP_Z, BOSS_R + 0.5));
          hip(0);
        }
        intersection() {
          rbox(-inner_x, inner_x, FRONT + SHELL, BACK - SHELL, BASE - 1, LIP_Z, 8 - SHELL);
          along_x(-HALF_W, HALF_W) offset(delta = -SHELL) polygon(gable(FRONT, BACK, BASE - 10, LIP_Z, BOSS_R + 0.5));
          hip(SHELL);
        }
      }
      // the corner columns, for the base plate's screws
      for (b = BOLTS) if (b[12] == 2) translate([b[0], b[1], BASE]) cylinder(r = COLUMN_R, h = FOOT + 1, $fn = 40);
    }
    // the thread's boss comes up through the top
    translate([0, 0, LIP_Z - 10]) cylinder(r = BOSS_R + 1, h = 20, $fn = 96);
    // the rotor's and the cap's way in through the left wall
    translate([-HALF_W - 1, 0, AXIS_Z]) hole_x(BORE_R + GAP, SHELL + 2);
    // the chute's way out of the front, open at the bottom, its top pointed so that it prints without support
    hull() {
      translate([-CHUTE[1] - 0.5, FRONT - 1, BASE - 1]) cube([2 * CHUTE[1] + 1, WALL + 2, chute_at(FRONT) + CHUTE_SIDE - BASE + 1]);
      translate([0, FRONT - 1, chute_at(FRONT) + CHUTE_SIDE + (CHUTE[1] + 0.5) * tan(STEEP)]) cube([0.01, WALL + 2, 0.01]);
    }
    // the ESP32 case's window in the back wall (it stands upright, its width across): pushed in from behind, its lid out, a snug fit;
    // the base plate's keeper stops it behind its floor. 0.6 more at the bottom, where the board stands 0.4 out of the case's USB end
    translate([CASE_POS[0] - CASE_W / 2 - 0.15, BACK - WALL - 1, CASE_POS[2] - CASE_L / 2 - 0.75]) cube([CASE_W + 0.3, WALL + 2, CASE_L + 0.9]);
    // the USB cable comes in at the foot of the back wall, under the case
    translate([CASE_POS[0] - 6, BACK - WALL - 1, BASE - 1]) cube([12, WALL + 2, 9]);
    bolt_cuts(2);
  }
}
module outer_body() { print_pose(L("P_OUTER")) outer_body_w(); }

// -------------------------------------------------------------------------------------------------------------------------- the rotor
module rotor_w() {
  translate([0, 0, AXIS_Z]) difference() {
    union() {
      rotate([0, 90, 0]) translate([0, 0, -ROTOR_END]) cylinder(r = R, h = 2 * ROTOR_END, $fn = 96);
      // the stub into the cap's bearing
      rotate([0, -90, 0]) translate([0, 0, ROTOR_END - 0.01]) cylinder(d = CAP[2], h = CAP[3] + 0.01, $fn = 48);
    }
    // two pockets, top and bottom, square-ended within the rotor's hubs (standing on its +X end, each pocket's −X end bridges its width)
    for (s = [1, -1]) translate([-POCKET[0] / 2, -POCKET[1] / 2, s > 0 ? R - POCKET[2] : -R - 1]) cube([POCKET[0], POCKET[1], POCKET[2] + 1]);
    // the motor's shaft, from the +X end: round where it leaves the motor, flatted from there to its tip (its flats facing ±Y, as the
    // motor stands, its can in front of the shaft)
    translate([ROTOR_END + 0.01, 0, 0]) rotate([0, -90, 0]) {
      linear_extrude(8) intersection() {
        circle(d = SHAFT_D + 0.2, $fn = 48);
        square([SHAFT_D + 1, SHAFT_FLATS + 0.15], center = true);
      }
      // (a little wider than the flatted bore's round sides, so that their faces do not coincide)
      cylinder(d = SHAFT_D + 0.5, h = max(0, SHAFT_ROUND - (MOTOR_FACE - ROTOR_END)) + 0.5, $fn = 48);
    }
  }
}
module rotor() { print_pose(L("P_ROTOR")) rotor_w(); }

// ---------------------------------------------------------------------------------------------------------------------- the flap
// TPU, printed flat: a strip from its root block to its tip, which rests on the rotor just behind the slot; the block (its pin's hole
// through it) holds the strip's root square, so that the strip, not the block, bends
module flap_w() {
  intersection() {
    difference() {
      union() {
        translate([-SLOT[0] + 0.2, FLAP[0], FLAP[1]]) rotate([FLAP[3] - 90, 0, 0]) cube([2 * SLOT[0] - 0.4, FLAP[2], FLAP[4]]);
        flap_block_x(-SLOT[0] + 0.2, SLOT[0] - 0.2, 0);
      }
      translate([-SLOT[0], FLAP_PIN[0], FLAP_PIN[1]]) rotate([0, 90, 0]) cylinder(d = PIN + 0.15, h = 2 * SLOT[0], $fn = 16);
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
// a flange on the left wall's outside and a tube from it through the opening into the bore, up to the rotor's end, where it takes the
// rotor's stub; hollow, its far end closed by a cone (STEEP) so that it prints on its flange without support
module cap_tube_w() {
  long = HALF_W - BORE_HALF; r = BORE_R - 0.15; ri = r - 2;
  // 2 mm of the tube's end left under the stub's hole
  hollow = CAP[0] + long - CAP[3] - 2.5 - ri * tan(STEEP);
  translate([-HALF_W, 0, AXIS_Z]) rotate([0, 90, 0]) difference() {
    union() {
      translate([0, 0, -CAP[0]]) cylinder(r = CAP[1], h = CAP[0], $fn = 96);
      cylinder(r = r, h = long, $fn = 96);
    }
    translate([0, 0, -CAP[0] - 0.01]) cylinder(r = ri, h = hollow + 0.02, $fn = 96);
    translate([0, 0, -CAP[0] + hollow]) cylinder(r1 = ri, r2 = 0, h = ri * tan(STEEP), $fn = 96);
    translate([0, 0, long - CAP[3] - 0.5]) cylinder(d = CAP[2] + 0.4, h = CAP[3] + 1, $fn = 48);
  }
}
// with its screws' holes (its two bolts, through the flange)
module cap_w() { difference() { cap_tube_w(); for (b = BOLTS) bolt_hole(b); } }
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
}
module chute() { print_pose(L("P_CHUTE")) chute_w(); }

// ----------------------------------------------------------------------------------------------------------------- the base plate
module base() {
  difference() {
    union() {
      hull() for (x = [BASE_RECT[0] + 8, BASE_RECT[1] - 8]) for (y = [BASE_RECT[2] + 8, BASE_RECT[3] - 8]) translate([x, y, 0]) cylinder(r = 8, h = BASE, $fn = 48);
      // two thin posts under the chute's high end (it rests on them, the legs either side of it), each with a stop behind its end wall
      for (s = [-1, 1]) translate([s * (CHUTE[1] - 1.6) - 0.8, 0, 0]) {
        hull() for (y = [CHUTE_BACK - 12, CHUTE_BACK]) translate([0, y - 0.01, BASE - 0.01]) cube([1.6, 0.01, chute_at(y) - CHUTE_FLOOR - BASE + 0.01]);
        translate([0, CHUTE_BACK, BASE - 0.01]) cube([1.6, 1.6, chute_at(CHUTE_BACK) + 4 - BASE]);
      }
      // a keeper behind the middle of the ESP32 case's floor, between its two rows of header pins, so that it cannot be pushed in
      translate([CASE_POS[0] - 1, CASE_POS[1] + CASE_FLOOR - 2.5, BASE - 0.01]) cube([2, 2.5, CASE_POS[2] + CASE_L / 2 - BASE]);
    }
    // the screws into the inner body's feet and the outer body's corners, their heads in counterbores from below
    for (b = BOLTS) bolt_hole(b);
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

if (PART == "inner-body") inner_body();
else if (PART == "outer-body") outer_body();
else if (PART == "rotor") rotor();
else if (PART == "flap") flap();
else if (PART == "cap") cap();
else if (PART == "chute") chute();
else if (PART == "base") base();
else if (PART == "coupon") coupon();
