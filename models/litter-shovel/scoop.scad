// Litter shovel, part 2 of 3: the scoop. An original CanFactory design, published under CC BY 4.0.
//
// A sifting blade on a cap. The cap is a closed U-shaped ring that sits over the container's rim: its outer wall stands on the
// handle's deck inside the upstand, and its inner sleeve reaches 10 mm into the container's mouth, so that clumps fall into the
// bag and never onto the rim. The bag folds over the rim, inside the U. The cap's top is a 45 degree funnel into the sleeve.
// Above it the outer wall rises as the blade: the flat back wall (-X) carries the sieve and ends in an arch, and the side walls
// fall in a straight line from the arch's shoulders to a low lip at the front (+X). See docs/litter-shovel.md.
//
// Modelled as it prints, cap down: Z up, the cap's underside (on the handle's deck) at Z = 0. Nothing needs support: the U's
// top is a 4 mm bridge and the funnel is a top surface. In `detent` mode the outer wall has grooves for the upstand's bumps.
//
// The sieve parameters only change the gaps through the back wall. They are laid out on a grid, centred across the wall,
// starting a solid root band above the cap, and only whole gaps that keep SIEVE_MARGIN of solid wall to the root band, the
// curved corners and the arch are cut, so no sliver is left. The layout is mirrored by sieveGaps() in
// packages/contracts/src/models.ts; keep the two identical.

// Sieve texture: vertical slots on a grid, slots with alternate rows offset (brick), round holes or hexagons
SIEVE_PATTERN = "slots"; //[slots,staggered,round,hex]
// Gap width: slot width, hole diameter or hexagon size across flats
GAP_WIDTH = 7.2; //[3:0.1:15]
// Slot length along Z (slot patterns only)
GAP_LENGTH = 25; //[6:0.5:40]
// Solid bar between neighbouring gaps
GAP_SPACING = 5.6; //[3:0.1:15]
// Solid border kept around the sieve
SIEVE_MARGIN = 3.2; //[3:0.1:10]
// How the scoop holds in the handle's upstand: a close fit only, or a detent (bumps on the upstand, grooves in the scoop)
SCOOP_SNAP = "detent"; //[friction,detent]
// Gap per side between mating surfaces, in mm
CLEARANCE = 0.2; //[0.1:0.01:0.6]
// How far the upstand's bumps reach past the scoop's wall, in mm, on top of the clearance
SCOOP_DETENT_ENGAGE = 0.15; //[0.02:0.01:0.4]

$fa = 4; $fs = 0.5;
E = 0.01;

// The container's band (outer plan [width (X), length (Y), corner radius]) and mouth (its inner plan at the rim); the rim is
// RIM_H above the cap's underside.
BAND = [74.5, 106.8, 14];
MOUTH = [69.7, 102, 11.6];
RIM_H = 10;
// Room for the bag's film on each side of the rim and above it; the blade's wall; the sleeve's wall.
BAG_GAP = 0.8; RIM_GAP = 1; WALL = 3.2; SLEEVE_T = 2;
// Solid cap above the U, under the funnel's lowest point over it.
CAP_T = 2;
// Blade: apex of the arch, height of its shoulders (where the side walls reach it), and the front lip's height.
HEIGHT = 136; SHOULDER_Z = 110; FRONT_Z = 22;
// Solid root band between the funnel's top and the lowest gaps.
ROOT_BAND = 10;
// Detent grooves: 4 mm up the outer wall, facing the upstand's bumps; their length along the wall.
DETENT_Z = 4; DETENT_L = 16;

function grow(p, d) = [p[0] + 2 * d, p[1] + 2 * d, p[2] + d];
module rr2d(p) { offset(r = p[2], $fn = 64) square([p[0] - 2 * p[2], p[1] - 2 * p[2]], center = true); }
module slab(p, z, h) { translate([0, 0, z]) linear_extrude(h) rr2d(p); }

OUT_IN = grow(BAND, BAG_GAP);           // the outer wall's inner face
OUT = grow(OUT_IN, WALL);               // the outer wall's outer face: 82.5 x 114.8
SLEEVE_OUT = grow(MOUTH, -BAG_GAP);
SLEEVE_IN = grow(SLEEVE_OUT, -SLEEVE_T);
U_TOP = RIM_H + RIM_GAP;
// The funnel falls at 45 degrees from the outer wall's inner face to the sleeve's inner face.
FUNNEL_DROP = (OUT_IN[0] - SLEEVE_IN[0]) / 2;
FUNNEL_TOP = U_TOP + CAP_T + (OUT_IN[0] - SLEEVE_OUT[0]) / 2;
FUNNEL_BOTTOM = FUNNEL_TOP - FUNNEL_DROP;

// The back wall: its outer and inner faces (X), and the half-width of its flat part between the corners.
BACK_X = -OUT[0] / 2;
BACK_IN_X = -OUT_IN[0] / 2;
FLAT_Y = OUT[1] / 2 - OUT[2];
// The arch over the flat part of the back wall: a circular arc from the shoulders at |y| = FLAT_Y up to the apex. Beyond the
// shoulders it falls away, under the side walls' limit.
ARCH_R = (FLAT_Y * FLAT_Y + (HEIGHT - SHOULDER_Z) * (HEIGHT - SHOULDER_Z)) / (2 * (HEIGHT - SHOULDER_Z));
function arch(y) = abs(y) <= FLAT_Y ? HEIGHT - ARCH_R + sqrt(ARCH_R * ARCH_R - y * y) : SHOULDER_Z - (abs(y) - FLAT_Y);

// ---- The cap: outer wall, U over the rim, sleeve and funnel. ----
module cap() {
  difference() {
    slab(OUT, 0, FUNNEL_TOP);
    difference() { slab(OUT_IN, -1, U_TOP + 1); slab(SLEEVE_OUT, -2, U_TOP + 3); }
    slab(SLEEVE_IN, -1, FUNNEL_TOP + 2);
    hull() { slab(SLEEVE_IN, FUNNEL_BOTTOM, E); slab(OUT_IN, FUNNEL_TOP, E); }
    slab(OUT_IN, FUNNEL_TOP, 1);
  }
}

// ---- The blade: the outer wall above the cap, trimmed by the side walls' line and the back wall's arch. ----
// XZ region kept by the side walls: flat at the shoulders over the back corners, a straight line down to the front lip,
// flat again over the front corners.
module side_limit() {
  x0 = BACK_X + OUT[2]; x1 = -x0;
  outline = [[-60, -1], [60, -1], [60, FRONT_Z], [x1, FRONT_Z], [x0, SHOULDER_Z], [-60, SHOULDER_Z]];
  translate([0, 80, 0]) rotate([90, 0, 0]) linear_extrude(160) polygon(outline);
}

// YZ region under the arch, only over the back wall (to just inside its inner face).
module arch_limit() {
  outline = concat([[OUT[1] / 2 + 1, -1]], [for (i = [0 : 96]) let(y = (OUT[1] / 2 + 1) * (1 - i / 48)) [y, arch(y)]], [[-(OUT[1] / 2 + 1), -1]]);
  translate([-60, 0, 0]) rotate([90, 0, 90]) linear_extrude(60 + BACK_IN_X + 0.5) polygon(outline);
}

module blade() {
  intersection() {
    difference() { slab(OUT, FUNNEL_TOP - 1, HEIGHT - FUNNEL_TOP + 1); slab(OUT_IN, FUNNEL_TOP - 2, HEIGHT); }
    union() { side_limit(); arch_limit(); }
  }
}

// ---- Sieve layout. Every gap is [y, z] (its centre on the back wall). ----
SIEVE_Y = FLAT_Y;
SIEVE_BOTTOM = FUNNEL_TOP + ROOT_BAND;
IS_SLOT = SIEVE_PATTERN == "slots" || SIEVE_PATTERN == "staggered";
// Extent of one gap across (Y) and along (Z) the wall.
GAP_Y = GAP_WIDTH;
GAP_Z = IS_SLOT ? GAP_LENGTH : SIEVE_PATTERN == "hex" ? GAP_WIDTH * 2 / sqrt(3) : GAP_WIDTH;
PITCH_Y = GAP_WIDTH + GAP_SPACING;
// Slots stack at their length plus a bar; round holes and hexagons are close-packed (rows 60 degrees apart).
PITCH_Z = IS_SLOT ? GAP_LENGTH + GAP_SPACING : PITCH_Y * sqrt(3) / 2;
OFFSET_ROWS = SIEVE_PATTERN != "slots";
ROWS = floor((HEIGHT - SIEVE_BOTTOM) / PITCH_Z) + 1;
COLUMNS = ceil(SIEVE_Y / PITCH_Y) + 1;

// A gap fits when its outer edge keeps the margin to the corners, its bottom to the root band, and its top outer corner to
// the arch (which falls away from the middle, so the outer corner is the closest).
function fits(y, z) = let(y1 = abs(y) + GAP_Y / 2, z0 = z - GAP_Z / 2, z1 = z + GAP_Z / 2)
  y1 <= SIEVE_Y - SIEVE_MARGIN + 1e-6 && z0 >= SIEVE_BOTTOM + SIEVE_MARGIN - 1e-6 && z1 <= arch(y1) - SIEVE_MARGIN + 1e-6;

GAPS = [for (row = [0 : ROWS - 1], column = [-COLUMNS : COLUMNS])
          let(y = (column + (OFFSET_ROWS && row % 2 == 1 ? 0.5 : 0)) * PITCH_Y,
              z = SIEVE_BOTTOM + SIEVE_MARGIN + GAP_Z / 2 + row * PITCH_Z)
          if (fits(y, z)) [y, z]];
echo(SIEVE_GAPS = len(GAPS));

// One gap, cut along X through the back wall.
module gap() {
  rotate([0, 90, 0]) {
    if (IS_SLOT) hull() for (dz = [-1, 1]) translate([dz * (GAP_LENGTH - GAP_WIDTH) / 2, 0, 0]) cylinder(d = GAP_WIDTH, h = 8);
    else if (SIEVE_PATTERN == "hex") cylinder(d = GAP_WIDTH * 2 / sqrt(3), h = 8, $fn = 6);
    else cylinder(d = GAP_WIDTH, h = 8);
  }
}

module sieve() { for (g = GAPS) translate([BACK_X - 2, g[0], g[1]]) gap(); }

// ---- Detent grooves in the outer wall, facing the upstand's bumps (handle.scad). ----
// Places children on the middle of each straight side of plan `p`, in the wall's frame (X along the wall, Y outward).
module on_sides(p) {
  for (s = [-1, 1]) {
    translate([s * p[0] / 2, 0, 0]) rotate([0, 0, -s * 90]) children();
    translate([0, s * p[1] / 2, 0]) rotate([0, 0, s > 0 ? 0 : 180]) children();
  }
}

// The groove a bump of engagement `g` clicks into, in the wall's frame (its face at Y = 0, the groove going towards -Y):
// `g` + clearance deep, clearing the bump by the clearance on every side. Its flanks start 0.3 mm outside the face, so that
// no edge of it lies in the face.
module groove(l, g) {
  c = CLEARANCE; d = g + c; w = g + c * sqrt(2); o = 0.3;
  hull() {
    translate([-(l / 2 + 2 * c + o), o, -(w + o)]) cube([l + 4 * c + 2 * o, E, 2 * (w + o)]);
    translate([-(l / 2 + 2 * c - d), -d, -(w - d)]) cube([l + 4 * c - 2 * d, E, 2 * (w - d)]);
  }
}

difference() {
  union() { cap(); blade(); }
  sieve();
  if (SCOOP_SNAP == "detent") translate([0, 0, DETENT_Z]) on_sides(OUT) groove(DETENT_L, SCOOP_DETENT_ENGAGE);
}
