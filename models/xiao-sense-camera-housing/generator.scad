// Original CanFactory indoor camera housing. mm, centred XY, Z up. See docs/xiao-sense-camera-housing.md.
// Width/length resize the shell and lid screw grid; board dimensions never scale. The USB end stays at +Y.
// Mount pockets use library hole/depth/wall dimensions, not the insert's knurl diameter.
// Each PART is one connected manifold print. Lid is roof down, with its exact inverse assembly transform.
PART = "base";
WIDTH = 48;
LENGTH = 46;
WALL = 2;
STANDOFF = 4;
HEADROOM = 1.2;
BOARD_FIT = 0.3;
SEAM_FIT = 0.2;
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
BZ = WALL + STANDOFF;
SEAM = BZ + BOARD_T + SEAM_ABOVE_PCB;
ROOF = BZ + BOARD_H + HEADROOM;
TOP = ROOF + WALL;
MR = MOUNT_HOLE / 2 + MOUNT_WALL;

module rounded(w, l, h, r = 3) {
  linear_extrude(h) offset(r = r) square([w - 2*r, l - 2*r], center = true);
}
module corner_positions() {
  for (x = [-1, 1], y = [-1, 1]) translate([x * (WIDTH/2 - CORNER_INSET), y * (LENGTH/2 - CORNER_INSET), 0]) children();
}
module shell() {
  difference() {
    rounded(WIDTH, LENGTH, TOP);
    translate([0, 0, WALL]) rounded(WIDTH - 2*WALL, LENGTH - 2*WALL, ROOF - WALL, 1.4);
  }
}
// Cable moulding clearance, split antenna/battery channels at the seam, and a side sight line to the charge LED.
module access_cuts() {
  translate([-USB_W/2, LENGTH/2 - WALL - EPS, BZ + BOARD_T + USB_HEIGHT/2 - USB_H/2]) cube([USB_W, WALL + 2*EPS, USB_H]);
  translate([-WIDTH/2 - EPS, BY + ANTENNA_Y, SEAM]) rotate([0, 90, 0]) cylinder(d = ANTENNA_D, h = WALL + 2*EPS);
  translate([WIDTH/2 - WALL - EPS, BY + 11, SEAM]) rotate([0, 90, 0]) cylinder(d = BATTERY_D, h = WALL + 2*EPS);
  if (CHARGE_WINDOW) translate([-WIDTH/2 - EPS, BY + CHARGE_Y, BZ + CHARGE_Z]) rotate([0, 90, 0]) cylinder(d = 2.4, h = WALL + 2*EPS);
}
module base() {
  difference() {
    union() {
      intersection() { shell(); translate([-WIDTH, -LENGTH, 0]) cube([2*WIDTH, 2*LENGTH, SEAM]); }
      // Blind mount bores face the rear; the floor ties their bosses into the tray.
      for (x = [-1, 1]) translate([x * MOUNT_SPACING/2, 0, 0]) cylinder(r = MR, h = MOUNT_DEPTH + WALL);
      corner_positions() cylinder(r = LID_R, h = SEAM);
      // Narrow ledges support the PCB edges, not its underside components or battery pads.
      for (s = [-1, 1]) {
        translate([s < 0 ? -BOARD_W/2 - BOARD_FIT - 1.6 : BOARD_W/2 - 0.5, BY + 6, WALL - EPS])
          cube([2.1 + BOARD_FIT, 6, STANDOFF + EPS]);
        translate([s < 0 ? -BOARD_W/2 - BOARD_FIT - 1.6 : BOARD_W/2 + BOARD_FIT, BY + 6, WALL - EPS])
          cube([1.6, 6, STANDOFF + BOARD_T + 0.8 + EPS]);
      }
      // Two unsoldered pin holes locate Y positively; side guides alone would let the board slide.
      for (s = [-1, 1]) translate([s * LOCATOR_X, BY + LOCATOR_Y, WALL - EPS]) {
        cylinder(d = 2, h = STANDOFF + EPS);
        translate([0, 0, STANDOFF]) cylinder(d = 0.6, h = BOARD_T + 0.3 + EPS);
      }
      // End ledges support the board; the front ledge stays below the USB receptacle.
      for (y = [BY - BOARD_FIT - 1.4, BY + BOARD_L + BOARD_FIT])
        translate([-2, y, WALL - EPS]) cube([4, 1.4, STANDOFF + EPS]);
    }
    access_cuts();
    for (x = [-1, 1]) translate([x*MOUNT_SPACING/2, 0, -EPS]) cylinder(d = MOUNT_HOLE, h = MOUNT_DEPTH + EPS);
    corner_positions() translate([0, 0, SEAM - LID_DEPTH]) cylinder(d = LID_HOLE, h = LID_DEPTH + EPS);
  }
}
module lid_assembled() {
  difference() {
    union() {
      intersection() { shell(); translate([-WIDTH, -LENGTH, SEAM + SEAM_FIT]) cube([2*WIDTH, 2*LENGTH, TOP]); }
      // Screw tubes connect to the roof; side walls need no support when printed roof down.
      corner_positions() translate([0, 0, SEAM + SEAM_FIT]) cylinder(r = LID_R, h = TOP - SEAM - SEAM_FIT);
      // Two retainers limit lift to 0.2 mm, bearing on free edges of the expansion PCB, not on the lens or SD socket.
      for (s = [-1, 1]) translate([s < 0 ? -BOARD_W/2 + 0.55 : BOARD_W/2 - 1.15, BY + 7, BZ + EXPANSION_TOP + 0.2])
        cube([0.6, 2, ROOF - BZ - EXPANSION_TOP - 0.2 + EPS]);
    }
    access_cuts();
    corner_positions() translate([0, 0, SEAM - EPS]) cylinder(d = SCREW_HOLE, h = TOP - SEAM + 2*EPS);
    translate([LENS_X - BOARD_W/2 + CAMERA_DX, BY + LENS_Y + CAMERA_DY, ROOF - EPS]) cylinder(d = CAMERA_D, h = WALL + 2*EPS);
    if (VENTILATION) for (x = [-5, 0, 5]) translate([x - 0.7, -LENGTH/2 + 5, ROOF - EPS]) cube([1.4, 8, WALL + 2*EPS]);
  }
}
if (PART == "base") base();
else if (PART == "lid") rotate([180, 0, 0]) translate([0, 0, -TOP]) lid_assembled();
