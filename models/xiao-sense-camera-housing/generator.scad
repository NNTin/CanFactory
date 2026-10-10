// Original CanFactory indoor camera housing. mm, centred XY, Z up. See docs/xiao-sense-camera-housing.md.
// Width/length resize the shell and lid screw grid; board dimensions never scale. The USB end stays at +Y.
// Mount pockets use library hole/depth/wall dimensions, not the insert's knurl diameter.
// The open inner rabbet retains half the wall; the lid tongue is half-wall thick, shifted inward by SEAM_FIT.
// SEAM_DEPTH is the overlap below SEAM; SEAM_FIT clears each mating side and the groove floor (no press fit).
// Each PART is one connected manifold print. Lid is roof down, with its exact inverse assembly transform.
PART = "base";
WIDTH = 48;
LENGTH = 46;
WALL = 2;
STANDOFF = 4;
HEADROOM = 1.2;
BOARD_FIT = 0.3;
SEAM_FIT = 0.2;
SEAM_DEPTH = 1.2;
USB_RECESS = 2;
USB_W = 14;
USB_H = 8;
CAMERA_D = 12;
CAMERA_DX = 0;
CAMERA_DY = 0;
ANTENNA_D = 5;
BATTERY_D = 4;
CHARGE_WINDOW = true;
VENTILATION = true;
MOUNT_SPACING = 34;
MOUNT_RETENTION = "heat-set";
MOUNT_NUT = [5.5, 2.4, false, 3.4]; // flats, max height, square, clearance hole
HEATSINK_ENABLED = true;
HEATSINK_H = 10;
HEATSINK_ALLOWANCE = 0;
ADHESIVE_T = 0.2;
HEATSINK_GAP = 2;
MOUNT_HOLE = 4;
MOUNT_DEPTH = 6.7;
MOUNT_WALL = 1.6;
BOARD_W = 17.8;
BOARD_L = 21;
BOARD_T = 1.25;
BOARD_H = 15;
USB_OVERHANG = 1.54;
USB_HEIGHT = 3.31;
LOCATOR_X = 7.62;
LOCATOR_Y = 10.48;
LENS_X = 8.25;
LENS_Y = 17;
EXPANSION_TOP = 5.45;
CHARGE_Y = 17.27;
CHARGE_Z = 1.475;
ANTENNA_Y = 1.73;
LID_HOLE = 3.2;
LID_DEPTH = 7.5;
LID_R = 4;
CORNER_INSET = 5.1;
SCREW_HOLE = 2.4;
SEAM_ABOVE_PCB = 5;
$fn = 48;
EPS = 0.02;
BY = LENGTH / 2 - WALL - USB_OVERHANG - USB_RECESS - BOARD_L;
CLEARANCE = HEATSINK_ENABLED ? max(STANDOFF, HEATSINK_H + HEATSINK_ALLOWANCE + ADHESIVE_T + HEATSINK_GAP) : STANDOFF;
BZ = WALL + CLEARANCE;
SEAM = BZ + BOARD_T + SEAM_ABOVE_PCB;
TONGUE_BOTTOM = SEAM - SEAM_DEPTH;
GROOVE_FLOOR = TONGUE_BOTTOM - SEAM_FIT;
ROOF = BZ + BOARD_H + HEADROOM;
TOP = ROOF + WALL;
NUT_MODE = MOUNT_RETENTION == "nut";
NUT_S = MOUNT_NUT[0] + 0.4;
MDEPTH = NUT_MODE ? WALL + MOUNT_NUT[1] + 0.3 + 2 : MOUNT_DEPTH;
MR = NUT_MODE ? NUT_S / (MOUNT_NUT[2] ? sqrt(2) : sqrt(3)) + 1.2 : MOUNT_HOLE / 2 + MOUNT_WALL;
W = WIDTH;
L = LENGTH;
BACK = -LENGTH/2;

module rounded(w, l, h, r = 3) {
  linear_extrude(h) offset(r = r) square([w - 2*r, l - 2*r], center = true);
}
// Half-facet phase avoids collinear 45° vertices in the rounded shell/boss union across custom shell sizes.
module corner_positions() {
  for (x = [-1, 1], y = [-1, 1]) translate([x * (W/2 - CORNER_INSET), y == 1 ? LENGTH/2 - CORNER_INSET : BACK + CORNER_INSET, 0]) rotate([0,0,180/$fn]) children();
}
module shell() {
  difference() {
    translate([0, 0, 0]) rounded(W, L, TOP);
    translate([0, 0, WALL]) rounded(W - 2*WALL, L - 2*WALL, ROOF - WALL, 1.4);
  }
}
// Offsets of the shell's exact inner rounded outline, not scaled copies: clearance stays constant at corners too.
module seam_outline(inset = 0) {
  offset(r = 1.4 + WALL/2 - inset) square([W - 2*WALL - 2.8, L - 2*WALL - 2.8], center = true);
}
module alignment_groove() {
  translate([0, 0, GROOVE_FLOOR]) linear_extrude(SEAM_DEPTH + SEAM_FIT + EPS) seam_outline();
}
module alignment_tongue() {
  translate([0, 0, TONGUE_BOTTOM]) linear_extrude(SEAM_DEPTH + SEAM_FIT + EPS) difference() {
    seam_outline(SEAM_FIT);
    seam_outline(WALL/2 + SEAM_FIT);
    corner_positions() circle(r = LID_R + SEAM_FIT);
  }
}
// Cable moulding clearance, split antenna/battery channels at the seam, and a side sight line to the charge LED.
module access_cuts() {
  // Extend through the tongue's inward SEAM_FIT offset, so it never bridges a cable/USB opening.
  translate([-USB_W/2, LENGTH/2 - WALL - SEAM_FIT - EPS, BZ + BOARD_T + USB_HEIGHT/2 - USB_H/2]) cube([USB_W, WALL + SEAM_FIT + 2*EPS, USB_H]);
  translate([-W/2 - EPS, BY + ANTENNA_Y, SEAM]) rotate([0, 90, 0]) cylinder(d = ANTENNA_D, h = WALL + SEAM_FIT + 2*EPS);
  translate([W/2 - WALL - SEAM_FIT - EPS, BY + 11, SEAM]) rotate([0, 90, 0]) cylinder(d = BATTERY_D, h = WALL + SEAM_FIT + 2*EPS);
  if (CHARGE_WINDOW) translate([-W/2 - EPS, BY + CHARGE_Y, BZ + CHARGE_Z]) rotate([0, 90, 0]) cylinder(d = 2.4, h = WALL + 2*EPS);
}
// A closed hole in the downward tongue would catch a pre-routed lead while lowering the hood.
// Open each notch all the way to the tongue tip, even when SEAM_DEPTH exceeds the cable radius.
module tongue_cable_cuts() {
  translate([-W/2 - EPS, BY + ANTENNA_Y - ANTENNA_D/2, TONGUE_BOTTOM - EPS])
    cube([WALL + SEAM_FIT + 2*EPS, ANTENNA_D, SEAM_DEPTH + 2*EPS]);
  translate([W/2 - WALL - SEAM_FIT - EPS, BY + 11 - BATTERY_D/2, TONGUE_BOTTOM - EPS])
    cube([WALL + SEAM_FIT + 2*EPS, BATTERY_D, SEAM_DEPTH + 2*EPS]);
}
module base() {
  difference() {
    union() {
      difference() {
        intersection() { shell(); translate([-W, BACK - 1, 0]) cube([2*W, L + 2, SEAM]); }
        alignment_groove(); // open to the cavity, leaving the outer half-wall intact
      }
      // Blind mount bores face the rear; the floor ties their bosses into the tray.
      for (x = [-1, 1]) translate([x * MOUNT_SPACING/2, 0, 0]) cylinder(r = MR + EPS, h = MDEPTH + WALL); // overlap a tangent inner wall by EPS; never reduce the required pocket wall
      // Add full bosses AFTER the shell rabbet: no coincident circle cuts or weakened insert walls.
      corner_positions() cylinder(r = LID_R, h = SEAM);
      // Narrow ledges support the PCB edges, not its underside components or battery pads.
      for (s = [-1, 1]) {
        translate([s < 0 ? -BOARD_W/2 - BOARD_FIT - 1.6 : BOARD_W/2 - 0.5, BY + 6, WALL - EPS])
          cube([2.1 + BOARD_FIT, 6, CLEARANCE + EPS]);
        translate([s < 0 ? -BOARD_W/2 - BOARD_FIT - 1.6 : BOARD_W/2 + BOARD_FIT, BY + 6, WALL - EPS])
          cube([1.6, 6, CLEARANCE + BOARD_T + 0.8 + EPS]);
      }
      // Two unsoldered pin holes locate Y positively; side guides alone would let the board slide.
      for (s = [-1, 1]) translate([s * LOCATOR_X, BY + LOCATOR_Y, WALL - EPS]) {
        cylinder(d = 1.2, h = CLEARANCE + EPS);
        translate([0, 0, CLEARANCE]) cylinder(d = 0.6, h = BOARD_T + 0.3 + EPS);
      }
      // End ledges support the board; the front ledge stays below the USB receptacle.
      for (y = [BY - BOARD_FIT - 1.4, BY + BOARD_L + BOARD_FIT])
        translate([-2, y, WALL - EPS]) cube([4, 1.4, CLEARANCE + EPS]);
    }
    access_cuts();
    for (x = [-1, 1]) translate([x*MOUNT_SPACING/2, 0, 0]) {
      translate([0, 0, -EPS]) cylinder(d = NUT_MODE ? MOUNT_NUT[3] : MOUNT_HOLE, h = MDEPTH + EPS);
      if (NUT_MODE) translate([0, 0, WALL]) {
        // Side loading at +Y: the floor and bridge capture Z; flats capture rotation.
        linear_extrude(MOUNT_NUT[1] + 0.3) {
          if (MOUNT_NUT[2]) square([NUT_S, NUT_S], center = true);
          else rotate(30) circle(r = NUT_S/sqrt(3), $fn = 6);
          translate([-NUT_S/2, 0]) square([NUT_S, MR + 2*EPS]);
        }
      }
    }
    // Low inlets feed passive convection around the backside heatsink.
    if (VENTILATION) for (s = [-1, 1], row = [0:2])
      translate([s < 0 ? -W/2 - EPS : W/2 - WALL - EPS, BY + 5, WALL + 0.8 + 3*row]) cube([WALL + 2*EPS, 12, 1.8]);
    corner_positions() translate([0, 0, SEAM - LID_DEPTH]) cylinder(d = LID_HOLE, h = LID_DEPTH + EPS);
  }
}
module lid_assembled() {
  difference() {
    union() {
      intersection() { shell(); translate([-W, BACK - 1, SEAM + SEAM_FIT]) cube([2*W, L + 2, TOP]); }
      alignment_tongue();
      // Screw tubes connect to the roof; side walls need no support when printed roof down.
      corner_positions() translate([0, 0, SEAM + SEAM_FIT]) cylinder(r = LID_R, h = TOP - SEAM - SEAM_FIT);
      // Two retainers limit lift to 0.2 mm, bearing on free edges of the expansion PCB, not on the lens or SD socket.
      for (s = [-1, 1]) translate([s < 0 ? -BOARD_W/2 + 0.55 : BOARD_W/2 - 1.15, BY + 7, BZ + EXPANSION_TOP + 0.2])
        cube([0.6, 2, ROOF - BZ - EXPANSION_TOP - 0.2 + EPS]);
    }
    access_cuts();
    tongue_cable_cuts();
    corner_positions() translate([0, 0, SEAM - EPS]) cylinder(d = SCREW_HOLE, h = TOP - SEAM + 2*EPS);
    translate([LENS_X - BOARD_W/2 + CAMERA_DX, BY + LENS_Y + CAMERA_DY, ROOF - EPS]) cylinder(d = CAMERA_D, h = WALL + 2*EPS);
    if (VENTILATION) for (x = [-5, 0, 5]) translate([x - 0.7, -LENGTH/2 + 5, ROOF - EPS]) cube([1.4, 8, WALL + 2*EPS]);
  }
}
if (PART == "base") base();
else if (PART == "lid") rotate([180, 0, 0]) translate([0, 0, -TOP]) lid_assembled();
