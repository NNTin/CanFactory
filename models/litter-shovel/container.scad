// Litter shovel, part 1 of 3: the container. An original CanFactory design, published under CC BY 4.0.
//
// A bag-holding bin: a gently flaring rounded-rectangle frustum on a solid floor, with a rolled bead inside the rim
// that grips a liner bag folded over the edge. At the rear (+X) a haunch rises past the rim into a raised pad carrying
// four split snap pegs; the handle's four blind sockets clip onto them and hold the scoop captured in between
// (see docs/litter-shovel.md). The container is modelled standing, as it prints and as it is used: Z up, the rim at
// Z = 141.5, the peg pad at Z = 158. Nothing here is a parameter: the scoop and handle are fitted to these surfaces
// with fixed clearances (0.6 mm per side around the rim, pegs 0.15 mm under their sockets).

$fa = 4; $fs = 0.5;
E = 0.01;

// Snap pad: centre X, top Z and plan size; the peg grid pitch along X and Y.
PAD_X = 61.2; PAD_Z = 158; PAD_W = 25; PAD_L = 23.4;
PITCH_X = 12.8; PITCH_Y = 14.4;
// Split snap peg: stem and head diameters, overall length and the width of the split that lets it flex.
PEG_D = 4.65; PEG_HEAD_D = 4.95; PEG_SPLIT = 0.7;

// Outer and inner wall as lofted sections [z, width (X), length (Y), corner radius]. The inner table's narrowing
// between Z = 135 and 140 is the rolled bead; the inner loft runs past the rim to leave the top open.
OUTSIDE = [[0, 64.7, 97, 11], [7, 65.7, 98.1, 11.5], [106, 74.2, 106.6, 14], [136, 74.5, 106.8, 14],
           [140, 74.5, 106.8, 14], [141.5, 72.9, 105.2, 13.2]];
INSIDE = [[3.2, 60.4, 92.7, 8.9], [7, 60.9, 93.3, 9.1], [106, 69.4, 101.8, 11.6], [135, 69.7, 102, 11.6],
          [137, 68.3, 100.6, 10.9], [139, 66.1, 98.4, 9.8], [140, 67.5, 99.8, 10.5], [141.5, 69.7, 102, 11.6],
          [143, 69.7, 102, 11.6]];
// Rear haunch from the rim up to the pad, as an XZ outline 20 mm wide (Y). Where it meets the pad (X 48.7 to 73.7, top at
// Z 158) its faces stop 0.05 mm inside the pad's, so the two never share a face.
HAUNCH = [[33, 134], [39, 134], [65, 152], [73.65, 154], [73.65, 157.95], [48.75, 157.95], [48.75, 151], [33, 141]];

module rr2d(w, l, r) { offset(r = r) square([w - 2 * r, l - 2 * r], center = true); }

module rr(w, l, r, h, z = 0, x = 0) { translate([x, 0, z]) linear_extrude(h) rr2d(w, l, r); }

// A loft through rounded-rectangle sections: each span is the hull of its two end sections, so it may narrow again.
module rr_loft(sections) {
  for (i = [0 : len(sections) - 2]) {
    a = sections[i]; b = sections[i + 1];
    hull() {
      translate([0, 0, a[0]]) linear_extrude(E) rr2d(a[1], a[2], a[3]);
      translate([0, 0, b[0] - E]) linear_extrude(E) rr2d(b[1], b[2], b[3]);
    }
  }
}

// One split snap peg standing on the pad at (x, y): a stem, a barbed head and a slot across it along Y.
module peg(x, y) {
  r = PEG_D / 2; head = PEG_HEAD_D / 2;
  translate([x, y, PAD_Z]) difference() {
    union() {
      translate([0, 0, -0.05]) cylinder(r = r, h = 3.05);
      translate([0, 0, 3]) cylinder(r1 = r, r2 = head, h = 0.45);
      translate([0, 0, 3.45]) cylinder(r = head, h = 0.35);
      translate([0, 0, 3.8]) cylinder(r1 = head, r2 = 2.1, h = 0.7);
    }
    translate([-PEG_SPLIT / 2, -3, 0.8]) cube([PEG_SPLIT, 6, 4]);
  }
}

union() {
  difference() {
    rr_loft(OUTSIDE);
    rr_loft(INSIDE);
  }
  rr(PAD_W, PAD_L, 3, 4, PAD_Z - 4, PAD_X);
  translate([0, 10, 0]) rotate([90, 0, 0]) linear_extrude(20) polygon(HAUNCH);
  for (dx = [-PITCH_X / 2, PITCH_X / 2], dy = [-PITCH_Y / 2, PITCH_Y / 2]) peg(PAD_X + dx, dy);
}
