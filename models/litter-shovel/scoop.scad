// Litter shovel, part 2 of 3: the scoop. An original CanFactory design, published under CC BY 4.0.
//
// A sifting blade on a cap, the middle of the stack container, scoop, handle. The cap is a closed U-shaped ring over the
// container's lip. Its flat ceiling sits on the lip's flat top (the bag folded over the lip is pinched between them), its sleeve
// reaches 5 mm into the container's mouth and its skirt hangs 5 mm around the lip. The cap's flat top carries the handle's ring,
// flush with the skirt. Inside, a 45 degree funnel leads from the blade into the sleeve, so clumps fall into the bag and never
// onto the rim. The blade rises from the cap. Its back wall (-X) ends in a straight, sharp edge that scrapes along the floor: the
// outer face runs flat to it and the inner face is bevelled down to a thin tip. The side walls fall from it in a smooth curve to
// a low front (+X), with a full round top edge. SCOOP_LENGTH sets how high the tip stands over the cap; the sides fall from it
// to the same low front, and the sieve fills the taller or shorter wall. See docs/litter-shovel.md.
//
// Modelled as it prints, cap down: Z up, the sleeve's and the skirt's lower edges at Z = 0. Nothing needs support: the U's
// ceiling is a 7.4 mm bridge and the funnel is a top surface. In `detent` mode the sleeve has bumps for the grooves in the
// container's mouth (SCOOP_SNAP), and the blade's base has bumps for the grooves in the handle's ring (HANDLE_SNAP). With a
// HANDLE_REINFORCEMENT, the blade's base has two countersunk holes near the grip for the screws that fasten the handle, on pads
// that keep the wall there thick enough for their heads however thin the blade is.
//
// The sieve parameters only change the gaps through the blade's wall. They are laid out on a grid unrolled along the wall's inner
// face, centred on the back and running round the curved corners onto the sides, starting above a solid root band (covered by
// the handle's ring and a little more). Only whole gaps that keep SIEVE_MARGIN of solid wall to the root band, to the bevel under
// the tip, to the side walls' top and to the front corners are cut, so no sliver is left. The layout is mirrored by sieveGaps()
// in packages/contracts/src/models.ts; keep the two identical.

// The scoop's length: the blade's height from the cap's lower edges to the straight scraping edge, in mm
SCOOP_LENGTH = 127; //[90:1:180]
// Sieve texture: vertical slots on a grid, slots with alternate rows offset (brick), round holes or hexagons
SIEVE_PATTERN = "slots"; //[slots,staggered,round,hex]
// Gap width: slot width, hole diameter or hexagon size across flats
GAP_WIDTH = 7.2; //[1:0.1:15]
// How the slots are sized (slot patterns only): by the number of rows, which share the sieve's height, or by their length
SIEVE_SIZING = "rows"; //[rows,length]
// Rows of slots, one above the other (slot patterns sized by rows)
SIEVE_ROWS = 1; //[1:1:5]
// Slot length along Z (slot patterns sized by length); at most SIEVE_HEIGHT
GAP_LENGTH = 25; //[6:0.5:143]
// Solid bar between neighbouring gaps
GAP_SPACING = 5.6; //[1:0.1:15]
// Solid border kept around the sieve
SIEVE_MARGIN = 3.2; //[3:0.1:10]
// Thickness of the shell's walls (the blade and the container's, whose mouth the sleeve fits), in mm; the scraping edge stays thinner
WALL_THICKNESS = 1.6; //[1.2:0.1:3.2]
// Thickness of the scraping edge at the tip, in mm
TIP_THICKNESS = 0.8; //[0.4:0.1:2]
// How far down from the tip the inner face is bevelled, in mm
TIP_BEVEL = 12; //[5:0.5:20]
// How the sleeve holds in the container's mouth: a close fit only, or a detent (bumps on the sleeve, grooves in the mouth)
SCOOP_SNAP = "detent"; //[friction,detent]
// How the handle's ring holds on the blade's base: a close fit only, or a detent (bumps on the blade, grooves in the ring)
HANDLE_SNAP = "detent"; //[friction,detent]
// Gap per side between mating surfaces, in mm
CLEARANCE = 0.2; //[0.1:0.01:0.6]
// How far the sleeve's bumps reach past the mouth's wall, in mm, on top of the clearance
SCOOP_DETENT_ENGAGE = 0.15; //[0.02:0.01:0.4]
// How far the blade's bumps reach past the handle's ring, in mm, on top of the clearance
HANDLE_DETENT_ENGAGE = 0.15; //[0.02:0.01:0.4]
// Whether two countersunk screws also fasten the handle, near the grip: none, into threaded inserts or into nuts on the handle
HANDLE_REINFORCEMENT = "none"; //[none,threaded-insert,nut-bolt]
// The screws' clearance hole (ISO 273 medium for their thread), in mm
SCREW_HOLE = 3.4;
// The countersunk screws' thread, greatest head diameter and greatest head height, in mm (ISO 10642 M3)
SCREW_D = 3;
SCREW_DK = 6;
SCREW_K = 1.7;

$fa = 4; $fs = 0.5;
E = 0.01;

// The container's band, mouth and lip (outer plan [width (X), length (Y), corner radius]); the lip's top is RIM_H above the
// cap's lower edges. The mouth is the band less the container's wall (the same WALL_THICKNESS, in container.scad).
BAND = [74.5, 106.8, 14];
MOUTH = grow(BAND, -WALL_THICKNESS);
LIP = [82.5, 114.8, 18];
RIM_H = 5;
// Cap: its ceiling's thickness above the lip; the bag's gap between the lip and the skirt, the skirt's wall; the sleeve's
// inner face (fixed: the sleeve's outer face is the mouth less the clearance).
CAP_T = 3; BAG_GAP = 0.8; SKIRT_T = 2.4; SLEEVE_IN_OFFSET = 2.2;
// Blade: its outer wall stands RING_T inside the skirt's outer face (room for the handle's ring); wall thickness.
RING_T = 3.6; WALL = WALL_THICKNESS;
// Blade: height of the tip (the scoop's length), and of the front.
HEIGHT = SCOOP_LENGTH; FRONT_Z = 26;
// Solid root band between the cap's top and the lowest gaps: the handle's 15 mm ring and 3 mm more.
ROOT_BAND = 18;
// Detent bumps: on the sleeve (mid-way down it) and on the blade's base (4 mm above the cap); length along the wall.
SLEEVE_DETENT_Z = 2.5; BLADE_DETENT_Z = 4; DETENT_L = 16;
// The handle's screws: either side of the grip (+X), in the root band; the countersink's diametral play around the head.
FASTENER_Y = 21; FASTENER_Z = 8; SINK_PLAY = 0.2;
// The wall under the screws' heads, whatever the blade's: a thinner blade has a pad on its inner face round each screw that
// makes it FASTENER_WALL there, so the head, the countersink and the ring's boss stay as they are (handle.scad's FASTENER_WALL).
// The pad is a cone with 45 degree flanks, so that it needs no support, PAD_R wide at its face: the widest countersink
// (4.2 mm from the axis, packages/contracts HANDLE_FASTENER_SEAT.sinkRadius) and a little more (1.05 mm, so that the
// pad's lowest point is not tangent to the funnel at any wall on the slider's 0.1 mm grid).
FASTENER_WALL = 3.2; PAD_R = 5.25;

function grow(p, d) = [p[0] + 2 * d, p[1] + 2 * d, p[2] + d];
module rr2d(p) { offset(r = p[2], $fn = 64) square([p[0] - 2 * p[2], p[1] - 2 * p[2]], center = true); }
module slab(p, z, h) { translate([0, 0, z]) linear_extrude(h) rr2d(p); }

CAP_TOP = RIM_H + CAP_T;
SKIRT_IN = grow(LIP, BAG_GAP);
CAP_OUT = grow(SKIRT_IN, SKIRT_T);         // 88.9 x 121.2: the skirt's and the handle's ring's outer face
SLEEVE_OUT = grow(MOUTH, -CLEARANCE);
SLEEVE_IN = grow(MOUTH, -SLEEVE_IN_OFFSET);
OUT = grow(CAP_OUT, -RING_T);              // the blade's outer face: 81.7 x 114
OUT_IN = grow(OUT, -WALL);                 // the blade's inner face
// The funnel falls at 45 degrees from the blade's inner face to the sleeve's inner face, 1 mm above the lip's top at its foot.
FUNNEL_BOTTOM = RIM_H + 1;
FUNNEL_TOP = FUNNEL_BOTTOM + (OUT_IN[0] - SLEEVE_IN[0]) / 2;

// The back wall: its outer and inner faces (X), and the half-width of its flat part between the corners. The blade's corners:
// their radius outside and inside, and the X of the back corners' centres.
BACK_X = -OUT[0] / 2;
BACK_IN_X = -OUT_IN[0] / 2;
FLAT_Y = OUT[1] / 2 - OUT[2];
R_OUT = OUT[2]; R_IN = OUT_IN[2];
CORNER_X = BACK_X + R_OUT;
// The side walls' top, along X: level with the tip until DESCENT_START (8 mm into the back corners), then half a cosine down to
// FRONT_Z where the front corners start, and level from there on. It leaves and meets both levels tangentially: no kink.
DESCENT_START = CORNER_X - 8; DESCENT_END = -CORNER_X;
function descent(x) = 180 * (x - DESCENT_START) / (DESCENT_END - DESCENT_START);
function side_top(x) = x <= DESCENT_START ? HEIGHT : x >= DESCENT_END ? FRONT_Z : FRONT_Z + (HEIGHT - FRONT_Z) * (1 + cos(descent(x))) / 2;
function side_slope(x) = x <= DESCENT_START || x >= DESCENT_END ? 0
  : -(HEIGHT - FRONT_Z) * PI / (2 * (DESCENT_END - DESCENT_START)) * sin(descent(x));
// The side walls' top lowered by d, measured square to it (exact where it runs straight).
function side_below(x, d) = side_top(x) - d * sqrt(1 + side_slope(x) * side_slope(x));

// ---- The cap: skirt, ceiling, sleeve and funnel. ----
module cap() {
  difference() {
    // The funnel's solid reaches half a mm into the blade's wall, whose outer face the blade makes: the cap and the blade
    // share no coplanar outer face.
    union() { slab(CAP_OUT, 0, CAP_TOP); slab(grow(OUT_IN, 0.5), 0, FUNNEL_TOP); }
    difference() { slab(SKIRT_IN, -1, RIM_H + 1); slab(SLEEVE_OUT, -2, RIM_H + 3); }
    slab(SLEEVE_IN, -1, FUNNEL_TOP + 2);
    hull() { slab(SLEEVE_IN, FUNNEL_BOTTOM, E); slab(OUT_IN, FUNNEL_TOP, E); }
    slab(OUT_IN, FUNNEL_TOP, 1);
  }
}

// ---- The blade: a wall rising from the cap. ----
// Over the back wall and most of the back corners it runs up to the tip, a straight edge at HEIGHT, where the inner face is
// bevelled down to TIP_THICKNESS: the outer face stays one flat plane to the edge, which scrapes along the floor. From there the
// top falls along side_top(), and the whole of it (sides, front corners and front) has a full round top edge. Round the back
// corners the tip's outer edge rounds off gradually into that round top, so there is no step where one meets the other.
RND = WALL / 2;
// The round top is a chain of spheres along the wall's centre line. A sphere's facets fall short of its radius, so it is grown
// until its narrowest point still spans the wall, and then trimmed back to the wall. The extra 0.13 mm was chosen by rendering every
// wall from 1.2 to 3.2 mm (0.1 mm steps) at three scoop lengths and bevels: other values left a zero-area triangle at some walls.
BEAD_FN = 24;
BEAD_R = RND / (cos(180 / BEAD_FN) * cos(180 / BEAD_FN)) + 0.13;
MID = grow(OUT, -RND);
R_MID = R_OUT - RND;
// The wall's centre line round the +Y half, from the back corner to the front one. Round the corners it is sampled at 2 + 4k
// degrees, clear of the corners' vertices (every 5.625 degrees, and where they meet the straight walls), so that no bead edge
// runs into one of them. It has no point on Y = 0: the back and the front are each spanned by one straight hull.
BEAD_ANGLES = [for (a = [86 : -4 : 2]) a];
BEAD_HALF = concat(
  [for (i = [len(BEAD_ANGLES) - 1 : -1 : 0]) let(a = BEAD_ANGLES[i]) [CORNER_X - R_MID * cos(a), FLAT_Y + R_MID * sin(a)]],
  [for (x = [CORNER_X + 1 : 1 : -CORNER_X - 1]) [x, MID[1] / 2]],
  [for (a = BEAD_ANGLES) [-CORNER_X + R_MID * cos(a), FLAT_Y + R_MID * sin(a)]]);
// The whole centre line as one closed loop: the half, then its mirror image back. (A mirrored copy of a half path from the
// back's middle to the front's left two chains meeting on Y = 0, whose nearly tangent surfaces crossed there: at many walls
// the front's middle rendered a zero-area triangle, or two vertices float32 could not tell apart.)
BEAD_LOOP = concat(BEAD_HALF, [for (i = [len(BEAD_HALF) - 1 : -1 : 0]) [BEAD_HALF[i][0], -BEAD_HALF[i][1]]]);

module ring() { difference() { slab(OUT, CAP_TOP - 1, HEIGHT - CAP_TOP + 1); slab(OUT_IN, CAP_TOP - 2, HEIGHT); } }

// XZ region under the side walls' top, lowered by the round's radius, across the whole blade.
module under_round() {
  outline = concat([[-60, 0]], [for (x = [-60 : 0.5 : 60]) [x, side_below(x, RND)]], [[60, 0]]);
  translate([0, 80, 0]) rotate([90, 0, 0]) linear_extrude(160) polygon(outline);
}

module bead() {
  for (i = [0 : len(BEAD_LOOP) - 1]) hull()
    for (p = [BEAD_LOOP[i], BEAD_LOOP[(i + 1) % len(BEAD_LOOP)]]) translate([p[0], p[1], side_below(p[0], RND)]) sphere(r = BEAD_R, $fn = BEAD_FN);
}

// The tip's rim, from the middle of the back round the back corner to where the side walls start to fall: the top few mm of the
// wall, with its outer top edge rounded at a radius that stays 0 over the back and the first RIM_SHARP degrees of the corner,
// then grows to RND at DESCENT_START. It is a chain of hulls of thin cross-sections, square to the wall; the section stands a
// little proud of the outer face and is trimmed back to it by the ring.
RIM_DEPTH = RND + 2;
RIM_SHARP = 15;
RIM_END = acos((CORNER_X - DESCENT_START) / R_OUT);
function rim_radius(a) = a <= RIM_SHARP ? 0 : RND * (1 - cos(180 * (a - RIM_SHARP) / (RIM_END - RIM_SHARP))) / 2;
// [frame angle, point where the outer face is at local x = n, n, radius] for each cross-section.
RIM_PATH = concat(
  [[180, [BACK_X, 0], 0, 0], [180, [BACK_X, FLAT_Y], 0, 0]],
  [for (a = concat([for (a = [3 : 3 : RIM_END - 1]) a], [RIM_END])) [180 - a, [CORNER_X, FLAT_Y], R_OUT, rim_radius(a)]]);

module rim_section(n, r) {
  d = 0.05;
  outline = concat([[n - WALL - 1, HEIGHT - RIM_DEPTH], [n + d, HEIGHT - RIM_DEPTH]],
    r <= d ? [[n + d, HEIGHT + 1]] : [for (i = [0 : 12]) [n + d - r + r * cos(90 * i / 12), HEIGHT - r + r * sin(90 * i / 12)]],
    [[n - WALL - 1, HEIGHT + (r <= d ? 1 : 0)]]);
  rotate([90, 0, 0]) linear_extrude(E, center = true) polygon(outline);
}

module rim() {
  for (m = [0, 1]) mirror([0, m, 0]) for (i = [0 : len(RIM_PATH) - 2]) hull()
    for (c = [RIM_PATH[i], RIM_PATH[i + 1]]) translate([c[1][0], c[1][1], 0]) rotate([0, 0, c[0]]) rim_section(c[2], c[3]);
}

// The bevel: it cuts the inner face from TIP_BEVEL under the tip to TIP_THICKNESS inside the outer face at the tip. It starts
// 1 mm lower, inside the wall's inner face, so that it crosses that face instead of touching it. Its corners have 72 segments,
// not the walls' 64, so that none of its edges runs into one of theirs.
TIP_SLOPE = (WALL - TIP_THICKNESS) / TIP_BEVEL;
module bevel() {
  module layer(p, z, h) { translate([0, 0, z]) linear_extrude(h) offset(r = p[2], $fn = 72) square([p[0] - 2 * p[2], p[1] - 2 * p[2]], center = true); }
  hull() { layer(grow(OUT_IN, -TIP_SLOPE), HEIGHT - TIP_BEVEL - 1, E); layer(grow(OUT, -TIP_THICKNESS), HEIGHT, 1); }
}

module blade() {
  difference() {
    intersection() {
      ring();
      union() {
        under_round();
        bead();
        rim();
      }
    }
    bevel();
  }
}

// ---- Sieve layout. Every gap is [s, z, l]: s runs along the wall's inner face from the middle of the back, round the corners
// and along the sides (negative towards -Y), z is its centre's height and l its length up the wall. ----
ARC_IN = PI / 2 * R_IN;
S_END = FLAT_Y + ARC_IN + (OUT[0] - 2 * R_OUT);   // where the front corners start
SIEVE_BOTTOM = CAP_TOP + ROOT_BAND;
SIEVE_TOP = HEIGHT - TIP_BEVEL;
// The height the gaps may take, a margin clear of the root band and of the bevel: one gap this tall just fits on the back.
SIEVE_HEIGHT = SIEVE_TOP - SIEVE_BOTTOM - 2 * SIEVE_MARGIN;
IS_SLOT = SIEVE_PATTERN == "slots" || SIEVE_PATTERN == "staggered";
// The slots' length: GAP_LENGTH, or, sized by rows, the length at which SIEVE_ROWS rows and the bars between them fill
// SIEVE_HEIGHT exactly (at least GAP_WIDTH, which the contract checks).
SLOT_LENGTH = SIEVE_SIZING == "rows" ? (SIEVE_HEIGHT - (SIEVE_ROWS - 1) * GAP_SPACING) / SIEVE_ROWS : GAP_LENGTH;
// Extent of one gap along (s) and up (Z) the wall.
GAP_Y = GAP_WIDTH;
GAP_Z = IS_SLOT ? SLOT_LENGTH : SIEVE_PATTERN == "hex" ? GAP_WIDTH * 2 / sqrt(3) : GAP_WIDTH;
PITCH_Y = GAP_WIDTH + GAP_SPACING;
// Slots stack at their length plus a bar; round holes and hexagons are close-packed (rows 60 degrees apart).
PITCH_Z = IS_SLOT ? SLOT_LENGTH + GAP_SPACING : PITCH_Y * sqrt(3) / 2;
OFFSET_ROWS = SIEVE_PATTERN != "slots";
ROWS = floor((SIEVE_TOP - SIEVE_BOTTOM) / PITCH_Z) + 1;
COLUMNS = ceil(S_END / PITCH_Y) + 1;

// The outer face's X where the inner face is at `a` (>= 0) along it.
function wall_x(a) = a <= FLAT_Y ? BACK_X : a <= FLAT_Y + ARC_IN ? CORNER_X - R_OUT * cos((a - FLAT_Y) / R_IN * 180 / PI)
  : CORNER_X + a - FLAT_Y - ARC_IN;

// A gap fits when it keeps the margin to the front corners, to the root band, to the bevel under the tip, and (square to it)
// to the side walls' top at its outer upper corner, where that top is lowest.
function fits(s, z) = let(a1 = abs(s) + GAP_Y / 2, z0 = z - GAP_Z / 2, z1 = z + GAP_Z / 2)
  a1 <= S_END - SIEVE_MARGIN + 1e-6 && z0 >= SIEVE_BOTTOM + SIEVE_MARGIN - 1e-6
  && z1 <= SIEVE_TOP - SIEVE_MARGIN + 1e-6 && z1 <= side_below(wall_x(a1), SIEVE_MARGIN) + 1e-6;

// Slots sized by rows keep every row's bottom all round, but end lower where the side walls' top falls: each slot reaches up to
// its row's length or, if lower, the margin under the top at its outer upper corner, and is cut if it is still at least as long
// as it is wide. The rows stay level, so the bars between them stay GAP_SPACING, staggered or not.
FIT_ROWS = IS_SLOT && SIEVE_SIZING == "rows";
function slot_top(s) = min(SIEVE_TOP - SIEVE_MARGIN, side_below(wall_x(abs(s) + GAP_Y / 2), SIEVE_MARGIN));
GAPS = [for (row = [0 : ROWS - 1], column = [-COLUMNS : COLUMNS])
          let(s = (column + (OFFSET_ROWS && row % 2 == 1 ? 0.5 : 0)) * PITCH_Y,
              z0 = SIEVE_BOTTOM + SIEVE_MARGIN + row * PITCH_Z,
              l = FIT_ROWS ? min(z0 + SLOT_LENGTH, slot_top(s)) - z0 : GAP_Z,
              z = FIT_ROWS ? z0 + l / 2 : SIEVE_BOTTOM + SIEVE_MARGIN + GAP_Z / 2 + row * PITCH_Z)
          if (FIT_ROWS ? abs(s) + GAP_Y / 2 <= S_END - SIEVE_MARGIN + 1e-6 && l >= GAP_Y - 1e-6 : fits(s, z)) [s, z, l]];
echo(SIEVE_GAPS = len(GAPS));

// One gap's outline, `l` long up the wall, before it is turned to face along X: its X runs down the wall, its Y along it.
module gap_outline(l) {
  if (IS_SLOT) hull() for (dz = [-1, 1]) translate([dz * (l - GAP_WIDTH) / 2, 0]) circle(d = GAP_WIDTH);
  else if (SIEVE_PATTERN == "hex") circle(d = GAP_WIDTH * 2 / sqrt(3), $fn = 6);
  else circle(d = GAP_WIDTH);
}

// A gap through a flat wall, in the wall's frame: X outward, Y along it, Z up. It starts 4 mm inside the inner face, so that a
// gap reaching round into a corner still cuts through the corner's wall, which curves away from it.
module flat_gap(l) { translate([-4, 0, 0]) rotate([0, 90, 0]) linear_extrude(WALL + 5) gap_outline(l); }

// A gap through a curved corner, in the corner's frame: X outward along the gap's middle from the corner's centre. It is the
// outline seen from the centre, so that it takes the same angle, GAP_WIDTH / R_IN, at the inner face and at the outer face: along
// the inner face it is GAP_WIDTH wide and the bars between gaps are GAP_SPACING, and it widens outward like the wall. It reaches
// from inside the inner face to well past the outer face, far enough to cut through the flat wall next to the corner too.
// It widens only inside the wall. Through each face it is a straight prism of the outline as wide as that face needs, so that
// every face of it the wall's faces meet is flat; the widening is a hull of that outline at two depths just inside the faces.
// (A hull all the way through widened a slot's round ends too, whose facets are not flat then: they were split along diagonals
// that crossed the inner face wherever the depth put them, and in staggered rows one could meet the neighbouring row's side a
// micrometre off, a sliver float32 turns into a zero-area triangle; 2.1 mm slots with 1 mm bars, for one.)
CORNER_TAN = tan(GAP_Y / (2 * R_IN) * 180 / PI);
CORNER_STEP = 0.2;   // how far inside each face the widening starts and ends; the prisms reach 0.1 mm into it
function corner_scale(d) = d * CORNER_TAN / (GAP_Y / 2);
module corner_section(d0, d1, scale, l) translate([d0, 0, 0]) scale([1, scale, 1]) rotate([0, 90, 0]) linear_extrude(d1 - d0) gap_outline(l);
module corner_gap(l) {
  corner_section(R_IN - 1, R_IN + CORNER_STEP + 0.1, corner_scale(R_IN), l);
  hull() for (d = [R_IN + CORNER_STEP, R_OUT - CORNER_STEP])
    translate([d, 0, 0]) scale([1, corner_scale(d), 1]) rotate([0, 90, 0]) linear_extrude(E) gap_outline(l);
  corner_section(R_OUT - CORNER_STEP - 0.1, 1.2 * R_OUT + 1, corner_scale(R_OUT), l);
}

// Cuts a gap `l` long at `s` along the inner face: through the back, through a corner (radially), or through a side.
module gap_at(s, l) {
  a = abs(s); k = s < 0 ? -1 : 1;
  if (a <= FLAT_Y) translate([BACK_IN_X, s, 0]) rotate([0, 0, 180]) flat_gap(l);
  else if (a <= FLAT_Y + ARC_IN) translate([CORNER_X, k * FLAT_Y, 0]) rotate([0, 0, k * (180 - (a - FLAT_Y) / R_IN * 180 / PI)]) corner_gap(l);
  else translate([CORNER_X + a - FLAT_Y - ARC_IN, k * OUT_IN[1] / 2, 0]) rotate([0, 0, k * 90]) flat_gap(l);
}

module sieve() { for (g = GAPS) translate([0, 0, g[1]]) gap_at(g[0], g[2]); }

// ---- Detent bumps. ----
// Places children on the middle of each straight side of plan `p`, in the wall's frame (X along the wall, Y outward).
module on_sides(p) {
  for (s = [-1, 1]) {
    translate([s * p[0] / 2, 0, 0]) rotate([0, 0, -s * 90]) children();
    translate([0, s * p[1] / 2, 0]) rotate([0, 0, s > 0 ? 0 : 180]) children();
  }
}

// A detent ridge on a wall face, in the wall's frame, standing `p` proud (towards +Y): 45 degree flanks and ends. Its flanks
// carry on 0.3 mm into the wall, so that no edge of it lies in the wall's face.
module ridge(l, p) {
  d = 0.3;
  hull() {
    translate([-(l / 2 + d), -d - E, -(p + d)]) cube([l + 2 * d, E, 2 * (p + d)]);
    translate([-(l / 2 - p), p - E, -E / 2]) cube([l - 2 * p, E, E]);
  }
}

// ---- The handle's screws. ----
// Two holes through the blade's wall on the grip side (+X), either side of the grip, at the height of the handle's ring. Each is
// countersunk from the inner face, so that the screw's head sits flush with it: a rim as wide as the head (plus play) as deep as
// the head's cylindrical edge, then 90 degrees down to the clearance hole. The screw goes on into an insert or a nut on the ring.
module fastener_holes() {
  sink = SCREW_DK + SINK_PLAY;
  rim = max(0, SCREW_K - (SCREW_DK - SCREW_D) / 2);
  for (s = [-1, 1]) translate([OUT[0] / 2 - FASTENER_WALL, s * FASTENER_Y, CAP_TOP + FASTENER_Z]) rotate([0, 90, 0]) {
    translate([0, 0, -1]) cylinder(d = SCREW_HOLE, h = FASTENER_WALL + 2, $fn = 48);
    translate([0, 0, -1]) cylinder(d = sink, h = rim + 1, $fn = 48);
    translate([0, 0, rim]) cylinder(d1 = sink, d2 = 0, h = sink / 2, $fn = 48);
  }
}

// The pads, on the inner face of the front wall round each screw (none once the wall is FASTENER_WALL thick). Their flanks carry
// on 0.3 mm into the wall, so that no edge of a pad lies in its face.
module fastener_pads() {
  d = FASTENER_WALL - WALL;
  if (d > 0) for (s = [-1, 1]) translate([OUT[0] / 2 - FASTENER_WALL, s * FASTENER_Y, CAP_TOP + FASTENER_Z]) rotate([0, 90, 0]) hull() {
    cylinder(r = PAD_R, h = E, $fn = 48);
    translate([0, 0, d + 0.3]) cylinder(r = PAD_R + d + 0.3, h = 0.5, $fn = 48);
  }
}

difference() {
  union() {
    cap();
    blade();
    if (HANDLE_REINFORCEMENT != "none") fastener_pads();
    if (SCOOP_SNAP == "detent") translate([0, 0, SLEEVE_DETENT_Z]) on_sides(SLEEVE_OUT) ridge(DETENT_L, CLEARANCE + SCOOP_DETENT_ENGAGE);
    if (HANDLE_SNAP == "detent") translate([0, 0, CAP_TOP + BLADE_DETENT_Z]) on_sides(OUT) ridge(DETENT_L, CLEARANCE + HANDLE_DETENT_ENGAGE);
  }
  sieve();
  if (HANDLE_REINFORCEMENT != "none") fastener_holes();
}
