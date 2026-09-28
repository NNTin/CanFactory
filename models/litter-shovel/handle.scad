// Litter shovel, part 3 of 3: the handle. An original CanFactory design, published under CC BY 4.0.
//
// An outer collar that slides down over the scoop's flange: its lower opening clears the flange by 0.6 mm per side,
// and its top shoulder, whose opening clears the blade by 1 mm per side, stops on the flange. Two spring fingers,
// rooted at the collar's lower edge in side windows, hook under the flange (0.3 mm axial play). At the rear (+X) a
// boss carries four blind sockets that clip onto the container's split pegs, and an oval grip hangs down beside the
// container (docs/litter-shovel.md). Nothing here is a parameter: every surface is fitted to the scoop and the
// container. The handle is modelled upright, as it is used, and lifted so that the grip's tip is at Z = 0; the
// collar's lower edge is at Z = DROP.

$fa = 4; $fs = 0.5;
E = 0.01;

// Grip sections [z, width (X), length (Y), centre X], tip to root; the tip is capped by a half ellipsoid.
GRIP = [[-41, 10.2, 16.5, 88], [17, 13.7, 23.5, 84], [23, 20, 29, 78]];
TIP_DEPTH = 8.6;
// The grip's tip (the lowest ring of its 64-segment ellipsoid) lies this far below the collar's lower edge, about 49.6.
DROP = -GRIP[0][0] + TIP_DEPTH * cos(180 / 64);
// Collar (outer plan, corner radius, wall, height) and shoulder opening.
COLLAR_W = 93.4; COLLAR_L = 125.7; COLLAR_R = 17.65; COLLAR_T = 2.4; COLLAR_H = 18;
SHOULDER_W = 84.1; SHOULDER_L = 116.4; SHOULDER_R = 13; SHOULDER_H = 2;
// Socket boss: centre X, plan and height; the socket grid pitch.
PAD_X = 61.2; BOSS_W = 30; BOSS_L = 34; SOCKET_DEPTH = 4.7; BOSS_H = SOCKET_DEPTH + 2; BOSS_FILLET = 1.1;
PITCH_X = 12.8; PITCH_Y = 14.4;
// Socket: throat, and the wider recess the peg heads snap into.
SOCKET_D = 4.8; SOCKET_RETENTION_D = 5.1;

module rr2d(w, l, r) { offset(r = r) square([w - 2 * r, l - 2 * r], center = true); }
module rr(w, l, r, h, z = 0, x = 0) { translate([x, 0, z]) linear_extrude(h) rr2d(w, l, r); }
module ring(w, l, r, t, h, z = 0) {
  difference() { rr(w, l, r, h, z); rr(w - 2 * t, l - 2 * t, r - t, h + 2, z - 1); }
}
module box(w, l, h, x = 0, y = 0, z = 0) { translate([x - w / 2, y - l / 2, z]) cube([w, l, h]); }

module collar() {
  difference() {
    ring(COLLAR_W, COLLAR_L, COLLAR_R, COLLAR_T, COLLAR_H);
    box(50, 27, COLLAR_H + 0.1, x = 68.8, z = -0.1);                  // rear notch around the container's support
    for (y = [-61.5, 61.5]) box(14, 6, 16, y = y, z = 2);             // windows for the spring fingers
  }
  difference() {
    rr(COLLAR_W, COLLAR_L, COLLAR_R, SHOULDER_H, COLLAR_H);
    rr(SHOULDER_W, SHOULDER_L, SHOULDER_R, SHOULDER_H + 2, COLLAR_H - 1);
  }
}

// The socket boss, its top edges eased by a 45 degree chamfer.
module boss() {
  hull() {
    rr(BOSS_W, BOSS_L, 4, BOSS_H - BOSS_FILLET, COLLAR_H, PAD_X);
    rr(BOSS_W - 2 * BOSS_FILLET, BOSS_L - 2 * BOSS_FILLET, 4 - BOSS_FILLET, BOSS_H, COLLAR_H, PAD_X);
  }
}

module grip() {
  for (i = [0 : len(GRIP) - 2]) {
    a = GRIP[i]; b = GRIP[i + 1];
    hull() {
      translate([a[3], 0, a[0]]) linear_extrude(E) scale([a[1] / 2, a[2] / 2]) circle(r = 1, $fn = 64);
      translate([b[3], 0, b[0] - E]) linear_extrude(E) scale([b[1] / 2, b[2] / 2]) circle(r = 1, $fn = 64);
    }
  }
  tip = GRIP[0];
  translate([tip[3], 0, tip[0]]) intersection() {
    scale([tip[1] / 2, tip[2] / 2, TIP_DEPTH]) sphere(r = 1, $fn = 64);
    translate([-tip[1], -tip[2], -TIP_DEPTH - 1]) cube([2 * tip[1], 2 * tip[2], TIP_DEPTH + 1 + E]);
  }
}

// A blind socket opening on the boss's underside at (x, y): a lead-in, the throat and the retention recess.
module socket(x, y) {
  r = SOCKET_D / 2; c = SOCKET_RETENTION_D / 2;
  translate([x, y, COLLAR_H]) {
    translate([0, 0, -0.1]) cylinder(r = r, h = SOCKET_DEPTH + 0.1);
    translate([0, 0, -E]) cylinder(r1 = r + 0.25, r2 = r, h = 0.6 + E);
    translate([0, 0, 2.8]) cylinder(r1 = r, r2 = c, h = 0.4);
    translate([0, 0, 3.2]) cylinder(r = c, h = SOCKET_DEPTH - 3.2);
  }
}

// The two spring fingers: a 1.2 mm stem rooted below each window, with an inward hook under the scoop's flange.
module spring_catches() {
  for (sign = [-1, 1]) {
    box(10, 1.2, 14.2, y = sign * 61.05, z = 1.5);
    hook = [[60.45, 11.7], [61.65, 11.7], [61.65, 15.7], [59.25, 15.7], [59.25, 15.0], [60.45, 12.3]];
    translate([-5, 0, 0]) rotate([90, 0, 90]) linear_extrude(10) polygon([for (p = hook) [sign * p[0], p[1]]]);
  }
}

translate([0, 0, DROP]) union() {
  difference() {
    union() { collar(); boss(); grip(); }
    for (dx = [-PITCH_X / 2, PITCH_X / 2], dy = [-PITCH_Y / 2, PITCH_Y / 2]) socket(PAD_X + dx, dy);
  }
  spring_catches();
}
