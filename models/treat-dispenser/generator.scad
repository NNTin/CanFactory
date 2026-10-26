// Gumball-style treat dispenser: an inverted PET bottle screws into the top; a horizontal rotor with one pocket, turned directly by
// a 28BYJ-48, carries treats from under the funnel past a rigid flap, which swings by its own weight, to the drop onto a chute out of
// the front. Every part prints in PLA or PETG. After bovineblitz's "Cat treat
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
R = L("R"); ROTOR_END = L("ROTOR_END"); POCKET = L("POCKET");
BORE_R = L("BORE_R"); BORE_HALF = L("BORE_HALF"); BLOCK = L("BLOCK"); SLOT = L("SLOT");
AXIS_Z = L("AXIS_Z"); BLOCK_BOTTOM = L("BLOCK_BOTTOM"); BLOCK_TOP = L("BLOCK_TOP"); BLOCK_BACK = L("BLOCK_BACK"); CAVITY_R = L("CAVITY_R"); DROP_Y = L("DROP_Y"); FLAP = L("FLAP"); WEIGHT = L("WEIGHT"); MAGNET = L("MAGNET"); BLOCK_SLOPE = L("BLOCK_SLOPE"); CAVITY_BACK = L("CAVITY_BACK"); GABLE_HALF = L("GABLE_HALF"); LIP_Z = L("LIP_Z"); LIP_R = L("LIP_R"); BOSS_TOP = L("BOSS_TOP");
CHUTE = L("CHUTE"); CHUTE_END = L("CHUTE_END"); CHUTE_BACK = L("CHUTE_BACK"); CHUTE_SLOPE = L("CHUTE_SLOPE"); EXIT_Z = L("EXIT_Z");
CHUTE_FLOOR = L("CHUTE_FLOOR"); CHUTE_WALL = L("CHUTE_WALL"); CHUTE_SIDE = L("CHUTE_SIDE");
NECK_T = L("NECK_T"); NECK_E = L("NECK_E"); NECK_PITCH = L("NECK_PITCH"); NECK_TURNS = L("NECK_TURNS");
THREAD_CLEARANCE = L("THREAD_CLEARANCE"); THREAD_R = L("THREAD_R"); BOSS_R = L("BOSS_R");
MOTOR_FACE = L("MOTOR_FACE"); BOSS_D = L("BOSS_D"); SHAFT_D = L("SHAFT_D"); SHAFT_FLATS = L("SHAFT_FLATS"); SHAFT_ROUND = L("SHAFT_ROUND");
CAP = L("CAP"); GAP = L("GAP"); LUG = L("LUG"); FOOT = L("FOOT"); FEET = L("FEET"); RIM = L("RIM"); COLLAR = L("COLLAR"); STANDOFF = L("STANDOFF"); COLUMN_R = L("COLUMN_R");
BOLTS = L("BOLTS"); NUT = L("NUT"); M3_HOLE = L("M3_HOLE"); HEAD = L("HEAD");
CASE_POS = L("CASE_POS"); USB = L("USB");
BAND = L("BAND"); BAND_NOTCHES = L("BAND_NOTCHES");

// the ESP32 case's outline (its base 25.8 × 21.8) and its floor's depth, from the case model's own parts
CASE_L = 25.8; CASE_W = 21.8; CASE_FLOOR = 6;
TAN = tan(CHUTE_SLOPE);
// the flap's hinge (y, z), and the way its hub's mouth opens (towards the front and down: it is pushed on up and back from the bore)
HINGE = [FLAP[0], FLAP[1]]; MOUTH_DIR = [cos(FLAP[11]), -sin(FLAP[11])];
// the flap's counterweight in section (y, z, at rest): its arm straight back from the hub and the weight at its end, their tops flush with
// the hub's (the flap prints upside down on them)
module arm_section(g = 0) { translate(HINGE) offset(delta = g) translate([FLAP[5] - 0.5, FLAP[5] - WEIGHT[0]]) square([WEIGHT[3] - WEIGHT[1] / 2 - FLAP[5] + 0.5, WEIGHT[0]]); }
module block_section(g = 0) { translate(HINGE) offset(delta = g) translate([WEIGHT[3] - WEIGHT[1] / 2, FLAP[5] - WEIGHT[2]]) square([WEIGHT[1], WEIGHT[2]]); }
module weight_section(g = 0) { arm_section(g); block_section(g); }
// the arm stops short of the hinge's bosses at either end, so that they pass beside it as the flap snaps on
ARM_W = FLAP[10] - 2 * (FLAP[8] + 0.3);
// a magnet's sealed cavity (MAGNET: fitted, radius, the flap's y, z from, z to, the inner body's y, z from, z to): a flat disc
module magnet_cavity(y, z0, z1) { translate([0, y, z0]) cylinder(r = MAGNET[1], h = z1 - z0, $fn = 64); }
// turned about the hinge by a (degrees, opening: the counterweight up)
module about_hinge(a) { translate(HINGE) rotate(a) translate(-HINGE) children(); }
function chute_at(y) = EXIT_Z + (y - CHUTE_END) * TAN;

// overhangs are kept at least this steep (degrees from the horizontal), so that nothing inside needs support
STEEP = 50;
// a hole along +X from x = 0, of radius r and length h, peaked upwards (a teardrop) so that its top prints without support
module hole_x(r, h) {
  rotate([0, 90, 0]) linear_extrude(h) polygon(concat([[-r / cos(STEEP), 0]], [for (i = [0:48]) let(a = -(180 - STEEP) + i * (360 - 2 * STEEP) / 48) r * [cos(a), sin(a)]]));
}

// the shell's section across X (y, z): a gable, its front and back sloping up at STEEP to a flat top as wide as the thread's boss, so
// that the top prints without support (bridged from slope to slope; a little wider than the boss, so that its round never touches the
// slopes' edges); the side walls stay upright for the cap
function gable(front, back, base, top, half) = [[front, base], [back, base], [back, top - (back - half) * tan(STEEP)], [half, top], [-half, top], [front, top - (-half - front) * tan(STEEP)]];
// below the right side's hip: a plane down from just beyond the boss at the top to the right at STEEP, moved in by d. It starts 2.75
// further out than the gable's flat top: at 2.5 its edge with the back slope would run through the rounded box's corner edge whenever
// HALF_W = BACK − 5.5 (a 43.5 wide shell at the 49 back), leaving float32 slivers; HALF_W steps by 0.5, so 2.75 never meets it
module hip(d) { translate([GABLE_HALF + 2.75 - d / sin(STEEP), 0, LIP_Z]) rotate([0, STEEP, 0]) translate([-200, -200, -400]) cube([400, 400, 400]); }
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
// Everything the mechanism needs, on legs and four feet (in the base plate's rims, not screwed: the outer body's top presses on its
// collar round the thread's boss): the bottle's thread, the funnel, the rotor's block,
// the motor (on its +X face) and the ULN2003 board (on standoffs off the right leg), and a sleeve carrying the bore out to the left,
// with two lugs for the bearing cap's screws just inside the outer body's left wall
module inner_body_w() {
  inner_body_shell();
  // the flap's hinge: a boss on each side wall, standing out into the hub's hole; peaked like a teardrop so that it prints, the peak cut
  // inside the hub's hole so that the hub turns freely on it
  for (s = [-1, 1]) translate([s * SLOT[0], HINGE[0], HINGE[1]]) rotate([0, s * -90, 0]) translate([0, 0, -0.01]) linear_extrude(FLAP[8] + 0.01)
    rotate([0, 0, -s * 90]) intersection() {
      hull() { circle(r = FLAP[7], $fn = 32); translate([0, FLAP[7] / cos(STEEP)]) square(0.01, center = true); }
      circle(r = (FLAP[7] + FLAP[6]) / 2, $fn = 32);
    }
}
module inner_body_shell() {
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
      // the rotor's block (deep behind, round its hollow); its top slopes down to the back at STEEP, a wall clear of the hollow's round
      intersection() {
        translate([-BLOCK[0], -BLOCK[1], BLOCK_BOTTOM]) cube([2 * BLOCK[0], BLOCK[1] + BLOCK_BACK, BLOCK_TOP - BLOCK_BOTTOM]);
        translate([-BLOCK[0] - 1, BLOCK_SLOPE * sin(STEEP), AXIS_Z + BLOCK_SLOPE * cos(STEEP)]) rotate([-STEEP, 0, 0]) translate([0, -100, -200]) cube([2 * BLOCK[0] + 2, 200, 200]);
      }
      // under the block, from the base up: the chute's way is cut out of it (below), which leaves the legs either side of the chute and,
      // between them, the way's sloping ceiling
      translate([-CHUTE[3], -BLOCK[1], BASE]) cube([2 * CHUTE[3], BLOCK[1] + BLOCK_BACK, BLOCK_BOTTOM - BASE + 0.01]);
      // the feet, outside the legs at their front and back ends
      for (f = FEET) translate([f[0] - FOOT / 2 - 0.01, f[1] - FOOT / 2, BASE]) cube([FOOT + 0.02, FOOT, FOOT]);
      // the collar the outer body's top bears on, round the boss: up to the outer body's inside (its flat top and slopes), COLLAR[1]
      // thick under its flat top, on a cone (STEEP) from the funnel's top so that it prints without support
      intersection() {
        outer_cavity();
        collar_z = LIP_Z - SHELL - COLLAR[1]; collar_r = BOSS_R + COLLAR[0]; cone = (collar_r - LIP_R - WALL) * tan(STEEP);
        union() {
          translate([0, 0, collar_z]) cylinder(r = collar_r, h = LIP_Z - collar_z, $fn = 96);
          translate([0, 0, collar_z - cone]) cylinder(r1 = LIP_R + WALL, r2 = collar_r, h = cone + 0.01, $fn = 96);
        }
      }
      // the sleeve from the block's left face to the lugs, and the lugs: their undersides at STEEP down to a point under the axis
      along_x(LUG[0], -BLOCK[0] + 0.01) teardrop_yz(BORE_R + WALL);
      along_x(LUG[0], LUG[0] + LUG[1]) {
        // flat on top, so that the nuts' slots open upwards
        hull() {
          for (s = [-1, 1]) translate([s * LUG[3], AXIS_Z]) square(2 * LUG[2], center = true);
          translate([0, AXIS_Z - LUG[2] - (LUG[3] + LUG[2]) * tan(STEEP)]) square(0.01, center = true);
        }
      }
      // the rubber band's ledges outside the side walls behind the hinge, each on a gusset down the wall (STEEP), with a grooved peg
      // per notch standing on it (BAND: plane y, line z, slots y0 y1 z0 z1, ledges x0 x1 top thickness width, pegs x y top, grooves
      // depth opening floor)
      for (s = [0, 1]) mirror([s, 0, 0]) {
        hull() {
          translate([BAND[6] - 0.01, BAND[0] - BAND[10] / 2, BAND[8] - BAND[9]]) cube([BAND[7] - BAND[6] + 0.01, BAND[10], BAND[9]]);
          translate([BAND[6] - 0.01, BAND[0] - BAND[10] / 2, BAND[8] - BAND[9] - (BAND[7] - BAND[6]) * tan(STEEP)]) cube([0.01, BAND[10], BAND[9]]);
        }
        for (x = BAND_NOTCHES) translate([x + BAND[14] - BAND[11], BAND[0] - BAND[12] / 2, BAND[8] - 0.01]) cube([BAND[11], BAND[12], BAND[13] - BAND[8] + 0.01]);
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
    // between the slot's side walls, as one section (so that no two cuts end on the side walls' faces apart): the drop below the bore,
    // from the tight bore's lower front edge back into the cavity; the cavity round the rotor's descending (back) side,
    // under a roof at the flap's hinge (its round top prints as bridges between its side walls); the counterweight's recess (the room it
    // sweeps as the flap swings open, its round top bridged likewise) and the hub's recess round the hinge (peaked so that it prints
    // without support), each with the way it comes in, up and back from the bore
    translate([-SLOT[0], 0, 0]) rotate([90, 0, 90]) linear_extrude(2 * SLOT[0]) {
      translate([DROP_Y, BLOCK_BOTTOM - 1]) square([CAVITY_R - DROP_Y, AXIS_Z - BLOCK_BOTTOM + 1]);
      intersection() {
        translate([0, AXIS_Z]) circle(r = CAVITY_R, $fn = 144);
        // (from 1 mm inside the slot, which is open there anyway: the two cuts overlap rather than meet face to face)
        translate([SLOT[1] - 1, BLOCK_BOTTOM - 20]) square([CAVITY_R + 1, HINGE[1] - BLOCK_BOTTOM + 20]);
      }
      // behind, up to the roof as far back as the counterweight reaches, so that the flap goes in straight up from below
      translate([SLOT[1] - 1, AXIS_Z]) square([CAVITY_BACK - SLOT[1] + 1, HINGE[1] - AXIS_Z]);
      for (a = [0:5:WEIGHT[4] - 5]) hull() { about_hinge(a) weight_section(0.5); about_hinge(a + 5) weight_section(0.5); }
      hull() { weight_section(0.5); translate(26 * MOUTH_DIR) weight_section(0.5); }
      hull() for (d = [0, 2 * FLAP[5]]) {
        translate(HINGE + d * MOUTH_DIR) circle(r = FLAP[5] + 0.3, $fn = 48);
        translate(HINGE + d * MOUTH_DIR + [0, (FLAP[5] + 0.3) / cos(STEEP)]) square(0.01, center = true);
      }
    }
    // the motor's boss and shaft through the +X face (the motor goes on from the side; its ears' screws are bolts)
    translate([BORE_HALF - 0.01, 0, AXIS_Z]) hole_x((BOSS_D + 1) / 2, BLOCK[0] - BORE_HALF + 1);
    // the chute's way in between the legs, from below, up over its walls' tops along its slope (the legs hold it); its ceiling slopes up
    // from the legs at STEEP, beside the drop at least, and is flat only where it closes under the block's front, so that it prints
    // without support
    for (i = [0:2]) if (WAY_YS[i + 1] > WAY_YS[i] + 0.01) hull() for (y = [WAY_YS[i], WAY_YS[i + 1]]) translate([0, y, 0]) rotate([90, 0, 0]) linear_extrude(0.01, center = true) polygon(way(y));
    bolt_cuts(1);
    // the band's way across, through both side walls and the counterweight's recess (over the arm's top as high as the band lies on
    // it fully open) out over the ledges' roots, and each peg's groove round the band's line in its outer face (its faces at 45°, so
    // that it prints)
    translate([-BLOCK[0] - 0.5, BAND[2], BAND[4]]) cube([2 * BLOCK[0] + 1, BAND[3] - BAND[2], BAND[5] - BAND[4]]);
    for (s = [0, 1]) mirror([s, 0, 0]) {
      for (x = BAND_NOTCHES) translate([0, BAND[0] + BAND[12] / 2 + 1, 0]) rotate([90, 0, 0]) linear_extrude(BAND[12] + 2) {
        out = BAND[14] + 0.4; flare = (BAND[15] - BAND[16]) / BAND[14] * out;
        polygon([[x, BAND[1] - BAND[16]], [x + out, BAND[1] - BAND[16] - flare], [x + out, BAND[1] + BAND[16] + flare], [x, BAND[1] + BAND[16]]]);
      }
    }
    // the optional magnet over the counterweight, sealed in at a print pause (the faces that repel the flap's face down)
    if (MAGNET[0] == 1) magnet_cavity(MAGNET[5], MAGNET[6], MAGNET[7]);
  }
}
module inner_body() { print_pose(L("P_INNER")) inner_body_w(); }

// --------------------------------------------------------------------------------------------------------------- the outer body
// The cover: walls and a gable top, hipped down to the right side too (the left side stays upright for the cap), open at the bottom,
// lowered over the inner body (the thread's boss comes up through its top) and screwed to the base plate at its corners; the cap's
// screws clamp its left wall to the inner body's lugs. The ESP32 case in a window of its back wall.
// the outer body's inside (the inner body's collar is shaped by it, so that the outer body's top bears on it all round)
module outer_cavity() {
  inner_x = HALF_W - SHELL;
  intersection() {
    rbox(-inner_x, inner_x, FRONT + SHELL, BACK - SHELL, BASE - 1, LIP_Z, 8 - SHELL);
    along_x(-HALF_W, HALF_W) offset(delta = -SHELL) polygon(gable(FRONT, BACK, BASE - 10, LIP_Z, GABLE_HALF));
    hip(SHELL);
  }
}
module outer_body_w() {
  difference() {
    union() {
      difference() {
        intersection() {
          rbox(-HALF_W, HALF_W, FRONT, BACK, BASE, LIP_Z, 8);
          along_x(-HALF_W - 1, HALF_W + 1) polygon(gable(FRONT, BACK, BASE, LIP_Z, GABLE_HALF));
          hip(0);
        }
        outer_cavity();
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
    // one pocket, square-ended within the rotor's hubs (standing on its +X end, its −X end bridges its width): drawn mouth up, its floor
    // on the axis, its leading face (+Y) radial and its trailing face (−Y) leaning out by POCKET[2]; turned by POCKET[3] towards +Y, so
    // that its mouth is centred on the top at rest
    rotate([-POCKET[3], 0, 0]) translate([-POCKET[0] / 2, 0, 0]) rotate([90, 0, 90]) linear_extrude(POCKET[0])
      polygon([[POCKET[1] / 2, POCKET[4]], [POCKET[1] / 2, R + 1], [-POCKET[1] / 2 - (R + 1 - POCKET[4]) * tan(POCKET[2]), R + 1], [-POCKET[1] / 2, POCKET[4]]]);
    // the motor's shaft, from the +X end: round where it leaves the motor, flatted from there to its tip (its flats facing ±Y, as the
    // motor stands, its can in front of the shaft); its tip pokes into the pocket, its flats held there by the floor's half of the bore
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
// rigid (PLA or PETG): a plate hanging from a hub on the hinge, leaning back FLAP[3]° to its tip, which is trimmed to the rotor, and a
// counterweight straight back from the hub that holds the tip on the rotor; the hub's hole snaps over the side walls' bosses through a
// mouth narrower than a boss, and then turns freely on them
module flap_w() {
  difference() {
    union() {
      translate([0, HINGE[0], HINGE[1]]) rotate([FLAP[3], 0, 0]) {
        rotate([0, 90, 0]) cylinder(r = FLAP[5], h = FLAP[10], center = true, $fn = 48);
        translate([-FLAP[10] / 2, -FLAP[4] / 2, -FLAP[2] - 2]) cube([FLAP[10], FLAP[4], FLAP[2] + 2]);
      }
      // the counterweight, straight back from the hub
      translate([-FLAP[10] / 2, 0, 0]) rotate([90, 0, 90]) linear_extrude(FLAP[10]) block_section();
      translate([-ARM_W / 2, 0, 0]) rotate([90, 0, 90]) linear_extrude(ARM_W) arm_section();
    }
    translate([0, HINGE[0], HINGE[1]]) {
      rotate([0, 90, 0]) cylinder(r = FLAP[6], h = FLAP[10] + 2, center = true, $fn = 48);
      // the mouth, from the hole out through the hub
      rotate([atan2(MOUTH_DIR[1], MOUTH_DIR[0]), 0, 0]) translate([-FLAP[10] / 2 - 1, 0, -FLAP[9] / 2]) cube([FLAP[10] + 2, FLAP[5] + 1, FLAP[9]]);
    }
    translate([-FLAP[10], 0, AXIS_Z]) rotate([0, 90, 0]) cylinder(r = R, h = 2 * FLAP[10], $fn = 144);
    // the optional magnet in the counterweight, under its top face, sealed in at a print pause
    if (MAGNET[0] == 1) magnet_cavity(MAGNET[2], MAGNET[3], MAGNET[4]);
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
      // a rim round each of the inner body's feet, on its three free sides (the leg is on the fourth), so that it cannot slide
      for (f = FEET) translate([f[0], f[1], BASE - 0.01]) difference() {
        o = FOOT / 2 + GAP + RIM[0];
        translate([f[0] < 0 ? -o : -FOOT / 2, -o, 0]) cube([FOOT / 2 + o, 2 * o, RIM[1] + 0.01]);
        translate([f[0] < 0 ? -o + RIM[0] : -FOOT / 2 - 1, -o + RIM[0], -1]) cube([FOOT / 2 + o - RIM[0] + 1, 2 * (o - RIM[0]), RIM[1] + 2]);
      }
      // a keeper behind the middle of the ESP32 case's floor, between its two rows of header pins, so that it cannot be pushed in
      translate([CASE_POS[0] - 1, CASE_POS[1] + CASE_FLOOR - 2.5, BASE - 0.01]) cube([2, 2.5, CASE_POS[2] + CASE_L / 2 - BASE]);
    }
    // the screws into the outer body's corners, their heads in counterbores from below
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
