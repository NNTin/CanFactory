// Magnetic QR code tag: a CanFactory original design, published under CC BY 4.0 (see ATTRIBUTION.md).
//
// A flat tag for a fridge or a whiteboard, in two printed parts (PART):
//
// - "border": the frame. Disc magnets sit in its back, so that the tag sticks to steel: in open pockets, pressed or glued in
//   after printing (MOUNT = "pockets"), or sealed in cavities that they are dropped into when the print pauses ("embedded"). It is a shallow tray: a floor
//   that holds the magnets, and round it the visible ring, BORDER_WIDTH wide, whose inside is the seat for the centre piece. It
//   prints back down (the magnets' pockets open onto the bed: each needs only a short bridge over it, no supports).
// - "centre": a plate that carries a QR code, and in its middle an optional logo. It prints base down as ONE model in two colours:
//   a light base BASE thick, then the dark modules and logo standing RELIEF above it. Change filament once, at the base's top
//   (rounded up to a layer boundary; the editor shows the height). It sits in the seat the same way up, flush with the border.
//
// The centre is held in the seat by JOINT:
// - "crush-ribs": thin vertical ribs on the seat wall, squeezed RIB_SQUEEZE by the centre's edge;
// - "detent": bumps on the middle of the centre's edges click into a groove round the seat wall;
// - "twist-lock": a bayonet. The centre is a round disc (the square code inscribed in it; the square tile gets a round seat) with
//   LUGS lugs at its foot. They drop through notches in the seat's lip into a channel under it, and turn LOCK_ANGLE clockwise
//   (seen from the front) until they meet a stop, past a ridge that clicks;
// - "magnets": a second set of the same magnets, MAGNET_COUNT pairs: one in a pocket in the seat floor, one in a pocket in the
//   centre's back. The centre's magnet stands out of its back into the floor's pocket, which locates it too.
// A push-out hole through the middle of the floor lets the centre be pushed out again.
//
// QR is the code, written by the contract (packages/contracts/src/qrMagnetTag.ts, qrScad) from the validated text: [modules,
// pad, data, solid, columns]: the dark data modules and the dark finder and alignment patterns as rectangles of whole modules
// [x, y, w, h], row 0 at the top, with the logo's knockout pad already cleared, and (for connected dots) the data modules'
// vertical runs [x, y, h]. MODULE_STYLE draws the data modules; the finder and alignment patterns stay solid in every style. Only numbers: the text itself never reaches OpenSCAD. LOGO is the logo's outline (svgLogo.ts, logoScad).
// The code and its QUIET_ZONE fill the largest square on the centre's face; a module is CODE_W / (modules + 2 QUIET_ZONE).
//
// Frame: millimetres, both parts centred on the Z axis, z up from the face on the print bed. The layout below is repeated by
// qrTagLayout in packages/contracts/src/qrMagnetTag.ts, and the fixed sizes by QR_TAG (a test compares them).

// ---------------------------------------------------------------

// Which part to make
PART = "border"; //[border,centre]
// Outline of the tile
SHAPE = "square"; //[square,round]
// Outer width (square) or diameter (round)
SIZE = 60; //[30:1:120]
// Outer corner radius of a square tile
CORNER_RADIUS = 4; //[0:0.5:20]
// The visible ring round the centre
BORDER_WIDTH = 6; //[3:0.5:20]
// The centre's light base; the filament change is at its top
BASE = 1.6; //[0.8:0.1:3]
// How high the dark modules and logo stand on the base
RELIEF = 0.6; //[0.4:0.1:2]
// How the centre is held in the border
JOINT = "crush-ribs"; //[crush-ribs,detent,twist-lock,magnets]
// Gap per side between the centre and the seat
FIT = 0.2; //[0.05:0.01:0.6]
// Magnets in the back (and pairs of joint magnets)
MAGNET_COUNT = 4; //[2:2:4]
// How the border holds its magnets: open pockets (pressed or glued in), or sealed cavities they are dropped into at a print pause
MOUNT = "pockets"; //[pockets,embedded]
// The slicer's layer height: the pause height of embedded magnets is on a layer boundary
LAYER = 0.2; //[0.08:0.02:0.32]
// The chosen magnet's greatest diameter and height (from the parts library)
MAGNET_D = 8.1;
MAGNET_T = 2.1;
// Light margin round the code, in modules
QUIET_ZONE = 2; //[1:1:4]
// The code: [modules, logo pad, data, solid, columns] (here: https://example.com at H)
QR = [29,0,[[10,0,4,1],[16,0,1,1],[9,1,5,1],[17,1,1,1],[9,2,1,1],[11,2,1,1],[13,2,1,1],[15,2,1,1],[18,2,2,1],[10,3,2,1],[13,3,5,1],[8,4,3,1],[12,4,1,1],[14,4,3,1],[19,4,1,1],[11,5,2,1],[14,5,1,2],[16,5,4,1],[8,6,1,2],[10,6,1,1],[12,6,1,1],[16,6,1,1],[18,6,1,1],[20,6,1,2],[11,7,3,1],[15,7,2,1],[2,8,2,1],[6,8,6,1],[13,8,3,1],[18,8,1,1],[21,8,2,1],[24,8,1,1],[2,9,1,1],[4,9,1,1],[7,9,1,1],[9,9,2,1],[17,9,2,1],[20,9,7,1],[28,9,1,1],[1,10,1,1],[5,10,3,1],[11,10,1,1],[13,10,1,1],[18,10,3,1],[22,10,1,1],[24,10,1,1],[26,10,2,1],[1,11,2,2],[4,11,1,1],[10,11,3,1],[14,11,5,1],[20,11,1,1],[23,11,2,1],[28,11,1,1],[5,12,5,1],[13,12,2,1],[17,12,5,1],[23,12,1,1],[26,12,3,1],[0,13,3,1],[9,13,2,1],[12,13,1,1],[16,13,1,1],[18,13,2,1],[22,13,2,1],[25,13,2,1],[28,13,1,1],[0,14,1,1],[5,14,2,1],[8,14,1,1],[10,14,4,1],[15,14,1,1],[18,14,4,1],[23,14,3,1],[27,14,2,1],[1,15,1,1],[3,15,2,1],[8,15,3,1],[14,15,2,1],[20,15,1,1],[24,15,2,1],[27,15,1,1],[0,16,5,1],[6,16,1,1],[11,16,1,1],[15,16,2,1],[23,16,3,1],[5,17,1,1],[7,17,4,1],[12,17,4,1],[17,17,1,1],[19,17,1,1],[22,17,2,2],[0,18,1,1],[5,18,4,1],[10,18,2,1],[17,18,2,1],[20,18,1,1],[25,18,1,1],[3,19,3,1],[7,19,5,1],[13,19,1,1],[17,19,1,1],[20,19,4,1],[26,19,3,1],[1,20,2,1],[6,20,2,1],[10,20,1,1],[15,20,2,2],[18,20,2,1],[25,20,2,1],[28,20,1,2],[8,21,2,1],[13,21,1,1],[18,21,1,1],[25,21,1,1],[8,22,1,1],[10,22,4,1],[16,22,1,1],[18,22,2,1],[26,22,2,1],[10,23,1,1],[13,23,2,1],[17,23,1,1],[27,23,2,1],[9,24,1,1],[11,24,1,1],[13,24,5,1],[25,24,2,1],[28,24,1,1],[8,25,1,1],[10,25,6,1],[17,25,3,1],[24,25,2,1],[27,25,1,1],[8,26,3,1],[13,26,2,1],[16,26,3,1],[20,26,1,1],[23,26,1,1],[25,26,2,1],[28,26,1,1],[9,27,4,1],[15,27,1,1],[18,27,1,1],[22,27,1,1],[24,27,2,1],[27,27,1,2],[10,28,1,1],[12,28,1,1],[14,28,1,1],[16,28,4,1],[22,28,2,1]],[[0,0,7,1],[22,0,7,1],[0,1,1,5],[6,1,1,5],[22,1,1,5],[28,1,1,5],[2,2,3,3],[24,2,3,3],[0,6,7,1],[22,6,7,1],[20,20,5,1],[20,21,1,3],[24,21,1,3],[0,22,7,1],[22,22,1,1],[0,23,1,5],[6,23,1,5],[2,24,3,3],[20,24,5,1],[0,28,7,1]],[]];
// How the dark modules are drawn (the finder and alignment patterns stay solid)
MODULE_STYLE = "square"; //[square,rounded-blobs,rounded-squares,dots,connected-dots]
// The logo: rings of [x, y] points on a 0..2000 grid (y up) that fill even-odd; empty for none
LOGO = [];
// The logo's width as a share of the code's width, in %
LOGO_SIZE = 20; //[10:1:40]

// --- fixed sizes (QR_TAG in packages/contracts/src/qrMagnetTag.ts) ---
POCKET_PLAY = 0.2;      // a magnet pocket: the magnet's greatest diameter plus this, as deep as its greatest height
FLOOR_WALL = 0.8;       // floor between a back pocket and the seat
SIDE_WALL = 1.2;        // least wall between a pocket and an edge, the push-out hole or another pocket
JOINT_BACK_WALL = 0.6;  // under a joint pocket in the seat floor
CENTRE_WALL = 0.6;      // above a joint pocket in the centre, under its code
MAGNET_GAP = 0.2;       // between the two magnets of a joint pair
PUSH_HOLE = 5;          // the push-out hole through the floor
SEAT_RADIUS = 1;        // the least corner radius of a square seat
LUG_DEPTH = 1.5;        // twist lock: the lugs' radial depth,
LUG_ANGLE = 11;         //   angular width (its sides never on the disc's vertices, which are at whole fractions of 90°),
LUG_HEIGHT = 0.8;       //   height at the centre's foot,
LUGS = 3;               //   and count;
LOCK_ANGLE = 30;        //   the turn that locks them,
TWIST_ENGAGE = 0.15;    //   how far the ridge reaches into the lugs' path,
RIDGE_ANGLE = 2;        //   its angular width,
STOP_ANGLE = 6;         //   and the stop's
RIB_RADIUS = 1;         // crush ribs: radius,
RIB_SQUEEZE = 0.15;     //   squeeze on top of the fit,
RIBS_PER_SIDE = 2;      //   how many per side of a square seat,
RIBS_ROUND = 8;         //   and round a round one
DETENT_ENGAGE = 0.2;    // detent: how far the bumps reach past the seat wall,
DETENT_SPAN = 0.4;      //   and how much of each side they span
EMBED_SKIN = 0.4;       // embedded magnets: the least skin under them (whole layers),
EMBED_HEADROOM = 0.05;  //   and over them before the pause
GROW = 0.01;            // every module is grown by this, so that touching modules overlap rather than share an edge
BLOB_RADIUS = 0.3;      // module styles, as shares of the module (QR_MODULE_SHAPE): rounded blobs' corner radius,
ROUNDED_SIDE = 0.85;    //   a rounded square's side
ROUNDED_RADIUS = 0.25;  //   and corner radius,
DOT_DIAMETER = 0.85;    //   a dot's diameter (and the width of the bars joining connected dots)

// --- derived layout (qrTagLayout) ---
POCKET_D = MAGNET_D + POCKET_PLAY;
POCKET_DEPTH = MAGNET_T;
CENTRE_POCKET = min(POCKET_DEPTH, BASE - CENTRE_WALL);
PROTRUSION = POCKET_DEPTH - CENTRE_POCKET;
JOINT_POCKET = POCKET_DEPTH + PROTRUSION + MAGNET_GAP;
// a height rounded up to whole layers, to the micrometre
function layers(h) = round(ceil(h / LAYER - 1e-9) * LAYER * 1e6) / 1e6;
// Embedded: every magnet of the border lies in a sealed cavity from SKIN over the back up to PAUSE (where the print pauses for
// them), under FLOOR_WALL of floor; the centre's joint magnet still stands out into an open pocket above that.
EMBEDDED = MOUNT == "embedded";
SKIN = EMBEDDED ? layers(EMBED_SKIN) : 0;
PAUSE = EMBEDDED ? layers(SKIN + POCKET_DEPTH + EMBED_HEADROOM) : 0;
FLOOR = EMBEDDED ? PAUSE + FLOOR_WALL + (JOINT == "magnets" ? PROTRUSION + MAGNET_GAP : 0)
  : max(POCKET_DEPTH + FLOOR_WALL, JOINT == "magnets" ? JOINT_POCKET + JOINT_BACK_WALL : 0);
SEAT_DEPTH = BASE + RELIEF;
HEIGHT = FLOOR + SEAT_DEPTH;
ROUND_SEAT = SHAPE == "round" || JOINT == "twist-lock";
SEAT_W = SIZE - 2 * BORDER_WIDTH;
SEAT_R = ROUND_SEAT ? SEAT_W / 2 : max(CORNER_RADIUS - BORDER_WIDTH, SEAT_RADIUS);
CENTRE_W = SEAT_W - 2 * FIT;
CENTRE_R = SEAT_R - FIT;
CODE_W = ROUND_SEAT ? CENTRE_W / sqrt(2) : CENTRE_W - 2 * CENTRE_R * (1 - 1 / sqrt(2));
INSET = POCKET_D / 2 + SIDE_WALL;
CORNER = SHAPE == "round" ? (SIZE / 2 - INSET) / sqrt(2)
  : CORNER_RADIUS > INSET ? SIZE / 2 - CORNER_RADIUS + (CORNER_RADIUS - INSET) / sqrt(2) : SIZE / 2 - INSET;
BACK_POCKETS = [for (i = [0 : MAGNET_COUNT - 1]) [[1, 1], [-1, -1], [-1, 1], [1, -1]][i] * CORNER];
AXIAL = CENTRE_W / 2 - POCKET_D / 2 - SIDE_WALL;
JOINT_POCKETS = JOINT == "magnets" ? [for (i = [0 : MAGNET_COUNT - 1]) [[1, 0], [-1, 0], [0, 1], [0, -1]][i] * AXIAL] : [];
CHANNEL_R = SEAT_W / 2 + LUG_DEPTH + FIT;
LIP = SEAT_DEPTH - LUG_HEIGHT - FIT;

QR_N = QR[0];
MODULE = CODE_W / (QR_N + 2 * QUIET_ZONE);

$fa = 2;
$fs = 0.25;

// ---------------------------------------------------------------
// Outlines

// The seat's outline offset by d (the centre's is d = -FIT): a rounded square, or a circle for a round seat. Every outline that
// must stay parallel to it (the centre, the twist lock's revolved cut) is built at these same angles, so offsets are exact, never
// re-sampled. With `half`, the points sit halfway between those angles, as far out as makes each edge touch the true arc: the
// straight sides stay exact, and a feature that cuts across the outline (a groove, a bump) never puts a vertex on one of its edges.
ARC = min(45, max(12, ceil(SEAT_R * 6)));
function ring(d, half = false) = let(h = half ? 0.5 : 0, r = (SEAT_R + d) / (half ? cos(45 / ARC) : 1)) SEAT_W / 2 - SEAT_R <= 0
  ? [for (i = [0 : 4 * ARC - 1]) let(a = 90 * (i + h) / ARC) r * [cos(a), sin(a)]]
  : [for (q = [0 : 3], i = [0 : half ? ARC - 1 : ARC]) let(c = SEAT_W / 2 - SEAT_R, a = 90 * q + 90 * (i + h) / ARC)
      c * [[1, 1], [-1, 1], [-1, -1], [1, -1]][q] + r * [cos(a), sin(a)]];

// A band round the outline, at the half-step angles: the outline offset by d0 at z0, by d1 at z1 and by d2 at z2 (a groove's or
// a bump's 45° profile).
module band(z0, d0, z1, d1, z2, d2) {
  r0 = ring(d0, true); r1 = ring(d1, true); r2 = ring(d2, true);
  n = len(r0);
  polyhedron(
    points = concat([for (p = r0) [p[0], p[1], z0]], [for (p = r1) [p[0], p[1], z1]], [for (p = r2) [p[0], p[1], z2]]),
    faces = concat(
      [[for (i = [0 : n - 1]) i]],
      [[for (i = [n - 1 : -1 : 0]) 2 * n + i]],
      [for (k = [0 : 1], i = [0 : n - 1]) let(a = k * n, b = (k + 1) * n, j = (i + 1) % n) [a + i, b + i, b + j, a + j]]));
}

module rounded_square(width, radius) {
  if (radius > 0) offset(r = radius) square(width - 2 * radius, center = true);
  else square(width, center = true);
}

module outline() {
  if (SHAPE == "round") circle(d = SIZE);
  else rounded_square(SIZE, CORNER_RADIUS);
}

// ---------------------------------------------------------------
// Border

// Twist lock: the lugs' notches (unlocked) are at 90 + k 360 / LUGS degrees; they lock LOCK_ANGLE clockwise of there.
function lug_angle(k) = 90 + k * 360 / LUGS;
// The angular clearance that keeps FIT between the lugs' radial sides and the notch or stop at the seat's radius.
FIT_ANGLE = FIT / (SEAT_W / 2) * 180 / PI;

module sector(angle, width, r0, r1, z0, z1) {
  rotate([0, 0, angle - width / 2]) rotate_extrude(angle = width) polygon([[r0, z0], [r1, z0], [r1, z1], [r0, z1]]);
}

module border() {
  difference() {
    linear_extrude(height = HEIGHT) outline();
    if (JOINT == "twist-lock")
      // the seat and, under its lip, the channel that the lugs turn in: one revolved cut (its vertices at the angles of ring()),
      // so that the channel's floor is the seat's floor, not a second face in the same plane
      rotate_extrude($fn = 4 * ARC) polygon([[0, FLOOR], [CHANNEL_R, FLOOR], [CHANNEL_R, FLOOR + LUG_HEIGHT + FIT], [SEAT_W / 2, FLOOR + LUG_HEIGHT + FIT], [SEAT_W / 2, HEIGHT + 1], [0, HEIGHT + 1]]);
    else translate([0, 0, FLOOR]) linear_extrude(height = SEAT_DEPTH + 1) polygon(ring(0));
    if (EMBEDDED) {
      // sealed cavities, the back's and the seat's at the same heights, so that one pause serves them all
      for (p = concat(BACK_POCKETS, JOINT_POCKETS)) translate([p[0], p[1], SKIN]) cylinder(d = POCKET_D, h = PAUSE - SKIN, $fn = 48);
      // the open pocket the centre's joint magnet stands into
      if (JOINT == "magnets") for (p = JOINT_POCKETS) translate([p[0], p[1], FLOOR - PROTRUSION - MAGNET_GAP]) cylinder(d = POCKET_D, h = PROTRUSION + MAGNET_GAP + 1, $fn = 48);
    }
    else for (p = BACK_POCKETS) translate([p[0], p[1], -1]) cylinder(d = POCKET_D, h = POCKET_DEPTH + 1, $fn = 48);
    translate([0, 0, -1]) cylinder(d = PUSH_HOLE, h = FLOOR + 2, $fn = 32);
    if (JOINT == "magnets" && !EMBEDDED) for (p = JOINT_POCKETS) translate([p[0], p[1], FLOOR - JOINT_POCKET]) cylinder(d = POCKET_D, h = JOINT_POCKET + 1, $fn = 48);
    if (JOINT == "detent") {
      // a groove round the seat wall, DETENT_ENGAGE + FIT deep, at the height of the bumps on the centre's edge
      g = DETENT_ENGAGE + FIT;
      band(FLOOR + BASE / 2 - g - 0.05, -0.05, FLOOR + BASE / 2, g, FLOOR + BASE / 2 + g + 0.05, -0.05);
    }
    if (JOINT == "twist-lock") {
      // the notches the lugs drop through
      for (k = [0 : LUGS - 1]) sector(lug_angle(k), LUG_ANGLE + 2 * FIT_ANGLE, SEAT_W / 2 - 1, CHANNEL_R - 0.05, FLOOR + 0.1, HEIGHT + 1);
    }
  }
  if (JOINT == "crush-ribs") crush_ribs();
  if (JOINT == "twist-lock") for (k = [0 : LUGS - 1]) {
    locked = lug_angle(k) - LOCK_ANGLE;
    // the stop, just clockwise of the locked lug, filling the channel
    sector(locked - LUG_ANGLE / 2 - FIT_ANGLE - STOP_ANGLE / 2, STOP_ANGLE, SEAT_W / 2 + 0.05, CHANNEL_R + 0.05, FLOOR - 0.05, FLOOR + LUG_HEIGHT + FIT + 0.05);
    // the ridge the lug clicks past just before it locks: a round bar under the lip, TWIST_ENGAGE into the lug's path
    rotate([0, 0, locked + LUG_ANGLE / 2 + FIT_ANGLE + RIDGE_ANGLE / 2])
      translate([SEAT_W / 2 + 0.05, 0, FLOOR + LUG_HEIGHT - TWIST_ENGAGE + 0.5]) rotate([0, 90, 0]) cylinder(r = 0.5, h = CHANNEL_R - SEAT_W / 2, $fn = 24);
  }
}

// A crush rib: a vertical round rib standing FIT + RIB_SQUEEZE out of the seat wall, with a lead-in at the top.
module rib() {
  p = FIT + RIB_SQUEEZE;
  translate([RIB_RADIUS - p, 0, 0]) rotate_extrude($fn = 24)
    polygon([[0, FLOOR - 0.05], [RIB_RADIUS, FLOOR - 0.05], [RIB_RADIUS, HEIGHT - 0.5], [RIB_RADIUS - p - 0.05, HEIGHT - 0.05], [0, HEIGHT - 0.05]]);
}

module crush_ribs() {
  if (ROUND_SEAT) for (k = [0 : RIBS_ROUND - 1]) rotate([0, 0, 22.5 + k * 360 / RIBS_ROUND]) translate([SEAT_W / 2, 0, 0]) rib();
  else {
    along = min(SEAT_W / 4, SEAT_W / 2 - SEAT_R - RIB_RADIUS);
    for (side = [0 : 3], t = RIBS_PER_SIDE == 1 || along <= 0 ? [0] : [-along, along])
      rotate([0, 0, 90 * side]) translate([SEAT_W / 2, t, 0]) rib();
  }
}

// ---------------------------------------------------------------
// Centre

// The logo as one polygon (all its points, and the index list of each ring, filled even-odd), its longest side scaled to
// LOGO_SIZE % of the code's width, centred.
module logo_2d() {
  points = [for (ring = LOGO) each ring];
  starts = [for (i = 0, n = 0; i < len(LOGO); n = n + len(LOGO[i]), i = i + 1) n];
  lo = [min([for (p = points) p[0]]), min([for (p = points) p[1]])];
  hi = [max([for (p = points) p[0]]), max([for (p = points) p[1]])];
  s = LOGO_SIZE / 100 * QR_N * MODULE / max(1, hi[0] - lo[0], hi[1] - lo[1]);
  scale(s) translate(-(lo + hi) / 2) polygon(points, [for (i = [0 : len(LOGO) - 1]) [for (j = [0 : len(LOGO[i]) - 1]) starts[i] + j]]);
}

// The dark modules in MODULE_STYLE, row 0 at the top, so that the code reads from the front.
function module_centre(x, y) = [-QR_N * MODULE / 2 + (x + 0.5) * MODULE, QR_N * MODULE / 2 - (y + 0.5) * MODULE];
module rects_2d(rects) {
  half = QR_N * MODULE / 2;
  for (r = rects) translate([-half + r[0] * MODULE - GROW, half - (r[1] + r[3]) * MODULE - GROW]) square([r[2] * MODULE + 2 * GROW, r[3] * MODULE + 2 * GROW]);
}
// the rectangles' union with its outer corners rounded; modules that touch only at a corner come apart
module blobs_2d(rects) offset(r = BLOB_RADIUS * MODULE, $fn = 16) offset(delta = -BLOB_RADIUS * MODULE) rects_2d(rects);
module modules_2d() {
  if (MODULE_STYLE == "square") rects_2d(concat(QR[2], QR[3]));
  else if (MODULE_STYLE == "rounded-blobs") blobs_2d(concat(QR[2], QR[3]));
  else {
    blobs_2d(QR[3]);
    if (MODULE_STYLE == "connected-dots") {
      // each row's run of dark modules, and each column's, as a bar with round ends
      for (r = QR[2], j = [0 : r[3] - 1]) hull() for (x = [r[0], r[0] + r[2] - 1]) translate(module_centre(x, r[1] + j)) circle(d = DOT_DIAMETER * MODULE, $fn = 24);
      for (c = QR[4]) hull() for (y = [c[1], c[1] + c[2] - 1]) translate(module_centre(c[0], y)) circle(d = DOT_DIAMETER * MODULE, $fn = 24);
    }
    else for (r = QR[2], i = [0 : r[2] - 1], j = [0 : r[3] - 1]) translate(module_centre(r[0] + i, r[1] + j))
      if (MODULE_STYLE == "dots") circle(d = DOT_DIAMETER * MODULE, $fn = 24);
      else offset(r = ROUNDED_RADIUS * MODULE, $fn = 16) square((ROUNDED_SIDE - 2 * ROUNDED_RADIUS) * MODULE, center = true);
  }
}

module centre() {
  difference() {
    union() {
      linear_extrude(height = BASE) polygon(ring(-FIT));
      // the lugs, 0.05 mm clear of the bed so that they share no face with the disc's underside
      if (JOINT == "twist-lock") for (k = [0 : LUGS - 1]) sector(lug_angle(k), LUG_ANGLE, CENTRE_W / 2 - 0.05, CENTRE_W / 2 + LUG_DEPTH, 0.05, LUG_HEIGHT);
      if (JOINT == "detent") intersection() {
        // bumps on the middle of each edge (or at four places round a disc), reaching DETENT_ENGAGE past the seat wall
        e = FIT + DETENT_ENGAGE + 0.05;
        band(BASE / 2 - e, -FIT - 0.05, BASE / 2, DETENT_ENGAGE, BASE / 2 + e, -FIT - 0.05);
        span = DETENT_SPAN * (ROUND_SEAT ? CENTRE_W / sqrt(2) : CENTRE_W - 2 * CENTRE_R);
        for (a = [0, 90]) rotate([0, 0, a]) translate([-SIZE, -span / 2, -1]) cube([2 * SIZE, span, BASE + 2]);
      }
      translate([0, 0, BASE - 0.01]) linear_extrude(height = RELIEF + 0.01) {
        modules_2d();
        if (len(LOGO) > 0) logo_2d();
      }
    }
    if (JOINT == "magnets") for (p = JOINT_POCKETS) translate([p[0], p[1], -1]) cylinder(d = POCKET_D, h = CENTRE_POCKET + 1, $fn = 48);
  }
}

if (PART == "centre") centre();
else border();
