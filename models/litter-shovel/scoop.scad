// Litter shovel, part 2 of 3: the scoop. An original CanFactory design, published under CC BY 4.0.
//
// An open sifting blade on a rounded-rectangle collar. The tall, flat back wall (-X) is the sieve; the side cheeks
// curve down from it to the collar at the front (+X). Inside the collar a ledge rests on the container's rim, and
// outside it a flange is captured from above by the handle (docs/litter-shovel.md). Modelled as it prints, open
// collar down: Z up, the collar's lower edge at Z = 0.
//
// The parameters only change the sieve, the pattern of gaps through the back wall. Every other surface is fitted
// to the container and the handle and stays fixed. The gaps are laid out on a grid, centred across the wall and
// starting just above the flange, and only whole gaps that keep SIEVE_MARGIN of solid wall to the flange, the
// curved corners, the arched top and the thinning top edge are cut, so no sliver is left. The layout is mirrored
// by sieveGaps() in packages/contracts/src/models.ts; keep the two identical.

// Sieve texture: vertical slots on a grid, slots with alternate rows offset (brick), round holes or hexagons
SIEVE_PATTERN = "slots"; //[slots,staggered,round,hex]
// Gap width: slot width, hole diameter or hexagon size across flats
GAP_WIDTH = 7.2; //[3:0.1:15]
// Slot length along Z (slot patterns only)
GAP_LENGTH = 25; //[6:0.5:40]
// Solid bar between neighbouring gaps
GAP_SPACING = 5.6; //[2:0.1:15]
// Solid border kept around the sieve
SIEVE_MARGIN = 3.2; //[2:0.1:10]

$fa = 4; $fs = 0.5;
E = 0.01;

// Blade: outer plan, wall, height and corner radius.
BLADE_W = 82.1; BLADE_L = 114.4; WALL = 3.2; HEIGHT = 141.8; CORNER = 12;
// Top arch (YZ): a half-ellipse centred at Z = ARCH_Z with semi-axes BLADE_L / 2 (Y) and ARCH_H (Z).
ARCH_Z = 103; ARCH_H = 38.8;
// Side profile (XZ): the cheeks fall from the back wall's top to the collar along this Bezier.
CHEEK = [[41.1, 36], [-16, 36], [-22, 60], [-41, 141.8]];
// Flange (captured by the handle) and container seat (inside ledge).
FLANGE_Z = 30; FLANGE_H = 2;
SEAT_Z = 15.5;

// Sieve zone on the back wall. Flat between the corner radii; the cheek curve cuts into the wall above SIEVE_TOP.
SIEVE_Y = BLADE_L / 2 - CORNER;
SIEVE_BOTTOM = FLANGE_Z + FLANGE_H;
SIEVE_TOP = 128;

module rr2d(w, l, r) { offset(r = r) square([w - 2 * r, l - 2 * r], center = true); }
module rr(w, l, r, h, z = 0) { translate([0, 0, z]) linear_extrude(h) rr2d(w, l, r); }
module ring(w, l, r, t, h, z = 0) {
  difference() { rr(w, l, r, h, z); rr(w - 2 * t, l - 2 * t, r - t, h + 2, z - 1); }
}

function bezier(p, t) = let(u = 1 - t) u * u * u * p[0] + 3 * u * u * t * p[1] + 3 * u * t * t * p[2] + t * t * t * p[3];

// XZ region kept by the side profile, extruded across the whole blade (Y).
module cheek_limit() {
  outline = concat([[-44, -1], [44, -1], [44, 36]], [for (i = [0 : 48]) bezier(CHEEK, i / 48)], [[-44, HEIGHT]]);
  translate([0, 70, 0]) rotate([90, 0, 0]) linear_extrude(140) polygon(outline);
}

// YZ region under the arched top, extruded along X.
module arch_limit() {
  outline = concat([[BLADE_L / 2, -1]], [for (i = [0 : 64]) let(a = 180 * i / 64) [BLADE_L / 2 * cos(a), ARCH_Z + ARCH_H * sin(a)]], [[-BLADE_L / 2, -1]]);
  translate([-50, 0, 0]) rotate([90, 0, 90]) linear_extrude(150) polygon(outline);
}

// ---- Sieve layout. Every gap is [y, z] (its centre on the back wall). ----
IS_SLOT = SIEVE_PATTERN == "slots" || SIEVE_PATTERN == "staggered";
// Extent of one gap across (Y) and along (Z) the wall.
GAP_Y = GAP_WIDTH;
GAP_Z = IS_SLOT ? GAP_LENGTH : SIEVE_PATTERN == "hex" ? GAP_WIDTH * 2 / sqrt(3) : GAP_WIDTH;
PITCH_Y = GAP_WIDTH + GAP_SPACING;
// Slots stack at their length plus a bar; round holes and hexagons are close-packed (rows 60 degrees apart).
PITCH_Z = IS_SLOT ? GAP_LENGTH + GAP_SPACING : PITCH_Y * sqrt(3) / 2;
OFFSET_ROWS = SIEVE_PATTERN != "slots";
ROWS = floor((SIEVE_TOP - SIEVE_BOTTOM) / PITCH_Z) + 1;
COLUMNS = ceil(SIEVE_Y / PITCH_Y) + 1;

function inside_arch(y, z) = let(a = BLADE_L / 2 - SIEVE_MARGIN, b = ARCH_H - SIEVE_MARGIN)
  z <= ARCH_Z || pow(y / a, 2) + pow((z - ARCH_Z) / b, 2) <= 1;
function fits(y, z) = let(y1 = abs(y) + GAP_Y / 2, z0 = z - GAP_Z / 2, z1 = z + GAP_Z / 2)
  y1 <= SIEVE_Y - SIEVE_MARGIN + 1e-6 && z0 >= SIEVE_BOTTOM + SIEVE_MARGIN - 1e-6 && z1 <= SIEVE_TOP - SIEVE_MARGIN + 1e-6 && inside_arch(y1, z1);

GAPS = [for (row = [0 : ROWS - 1], column = [-COLUMNS : COLUMNS])
          let(y = (column + (OFFSET_ROWS && row % 2 == 1 ? 0.5 : 0)) * PITCH_Y,
              z = SIEVE_BOTTOM + SIEVE_MARGIN + GAP_Z / 2 + row * PITCH_Z)
          if (fits(y, z)) [y, z]];
echo(SIEVE_GAPS = len(GAPS));

// One gap, cut along X through the back wall.
module gap() {
  rotate([0, 90, 0]) {
    if (IS_SLOT) hull() for (dz = [-1, 1]) translate([dz * (GAP_LENGTH - GAP_WIDTH) / 2, 0, 0]) cylinder(d = GAP_WIDTH, h = 14);
    else if (SIEVE_PATTERN == "hex") cylinder(d = GAP_WIDTH * 2 / sqrt(3), h = 14, $fn = 6);
    else cylinder(d = GAP_WIDTH, h = 14);
  }
}

module sieve() { for (g = GAPS) translate([-48, g[0], g[1]]) gap(); }

// Rear notch: clears the container's snap support in the collar.
module rear_relief() { translate([34, -13.5, -0.1]) cube([50, 27, 32.2]); }

difference() {
  union() {
    difference() {
      intersection() {
        ring(BLADE_W, BLADE_L, CORNER, WALL, HEIGHT);
        cheek_limit();
        arch_limit();
      }
      sieve();
    }
    // Inside ledge that rests on the container's rim.
    difference() { rr(BLADE_W - E, BLADE_L - E, CORNER, 2, SEAT_Z); rr(70.9, 103.2, 12.2, 4, SEAT_Z - 1); }
    // Outside flange, captured from above by the handle's shoulder.
    ring(87.4, 119.7, 14.65, 5.85, FLANGE_H, FLANGE_Z);
  }
  rear_relief();
}
