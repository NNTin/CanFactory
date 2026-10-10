// A development board of the parts library (packages/contracts/src/parts/dev-boards.ts), at the layout given as -D overrides
// (`devBoardLayout`): the PCB with its pin holes (and their half holes at the edge, for a castellated board), the USB-C
// receptacle and every component as a box. `npm run check:assembly` renders it to check the boards a model holds, so that a
// case's walls, posts and openings can be tested against the receptacle and the components.
// Frame: millimetres, as the layout: the PCB's underside on z = 0 with its corner at the origin, its width along X and its length
// along Y, the receptacle at the +Y end, components on top.
// The defaults are the ESP32-C3 SuperMini's outline, with no pins or components.

L = 22.52;              // board length
W = 18;                 // board width
T = 1;                  // PCB thickness
R = 0;                  // corner radius
HOLE = 1;               // pin hole diameter
CASTELLATED = false;    // a half hole at the board's edge beside each pin
PINS = [];              // [x, y] of each pin hole
USB = [4.14, 16.71, 13.39, 24.45, 3.2];      // [x0, y0, x1, y1, height above the PCB]
// [x, y, width (X), length (Y), height above the PCB, rotation about Z in degrees, top shape (0 none, 1 round, 2 oval,
// 3 rectangle), top width, top length, top's height above the local base, optional base above the PCB top]: the body, and a button's plunger or an LED's lens on it
COMPONENTS = [];

$fn = 24;

module outline() {
  if (R > 0) translate([R, R]) offset(r = R) square([W - 2 * R, L - 2 * R]);
  else square([W, L]);
}

difference() {
  linear_extrude(T) outline();
  for (pin = PINS) {
    translate([pin[0], pin[1], -1]) cylinder(d = HOLE, h = T + 2);
    if (CASTELLATED) translate([pin[0] < W / 2 ? 0 : W, pin[1], -1]) cylinder(d = HOLE, h = T + 2);
  }
}

// the receptacle's shell: a stadium across X and up Z, along Y
hull() for (x = [USB[0] + USB[4] / 2, USB[2] - USB[4] / 2])
  translate([x, USB[1], T + USB[4] / 2]) rotate([-90, 0, 0]) cylinder(d = USB[4], h = USB[3] - USB[1]);

module top_plan(shape, width, length) {
  if (shape == 1) circle(d = width);
  else if (shape == 2) hull() for (s = [-1, 1]) translate(width < length ? [0, s * (length - width) / 2] : [s * (width - length) / 2, 0]) circle(d = min(width, length));
  else square([width, length], center = true);
}

for (c = COMPONENTS) translate([c[0], c[1], T + (len(c) > 10 ? c[10] : 0)]) rotate([0, 0, c[5]]) {
  translate([-c[2] / 2, -c[3] / 2, 0]) cube([c[2], c[3], c[4]]);
  if (len(c) > 6 && c[6] > 0) translate([0, 0, c[4] - 0.01]) linear_extrude(c[9] - c[4] + 0.01) top_plan(c[6], c[7], c[8]);
}
