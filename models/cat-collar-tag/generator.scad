// Cat collar tag: a CanFactory original design, published under CC BY 4.0 (see ATTRIBUTION.md).
//
// A name tag for a cat's collar, printed back down in one piece (PART = "tag"). Each face carries a mark of its own (FRONT_MARK,
// BACK_MARK): one or two lines of text in a bundled font, or a logo from an SVG file. The back's mark is engraved, mirrored so that
// it reads when the tag is turned over; the front's is engraved or embossed (FRONT_STYLE), an embossed one in another colour with a
// filament change. An NFC tag (NFC) and disc magnets (MAGNET_MOUNT, to stick the tag to a fridge) can sit in open pockets in the
// back, or sealed in cavities that they are dropped into when the print pauses; only one of them can be embedded.
//
// ATTACHMENT says how it goes on the collar:
// - "hanging": a bail at the top with a hole for a split ring, which hangs it from the collar's D-ring;
// - "slide-on": a slot near each end; the collar's strap runs in front of the end bars and behind the middle, through both.
//
// Frame: millimetres, the tag lying back down (back on z = 0, front at z = THICKNESS), its outline centred on the origin, x across
// its width and y up its height (the bail on top). The layout below is repeated by collarTagLayout in
// packages/contracts/src/catCollarTag.ts, and the fixed sizes by COLLAR_TAG (a test compares them).

// ---------------------------------------------------------------

// Which part to make
PART = "tag"; //[tag,clip,sleeve]
// How the tag goes on the collar
ATTACHMENT = "hanging"; //[hanging,slide-on,clip,sleeve]
// The tag's outline
SHAPE = "round"; //[round,rounded-rectangle,bone,heart,fish]
// Width (a round tag's diameter)
WIDTH = 30; //[15:0.5:60]
// Height (not for a round tag)
HEIGHT = 22; //[10:0.5:45]
// Thickness of the tag, without an embossed mark
THICKNESS = 2.4; //[1:0.1:6]
// Radius of the rounded edges, front and back
EDGE_R = 0.6; //[0:0.1:2]
// The front's mark, its two lines, font, text size, logo and logo height; engraved or embossed
FRONT_MARK = "text"; //[none,text,logo]
FRONT_LINE_A = "Luna";
FRONT_LINE_B = "";
FRONT_FONT = "sans"; //[sans,serif,mono,wide]
FRONT_SIZE = 5.5; //[2.5:0.5:12]
FRONT_LOGO = [];
FRONT_LOGO_SIZE = 10; //[3:0.5:30]
FRONT_STYLE = "engrave"; //[engrave,emboss]
// The back's mark, always engraved
BACK_MARK = "text"; //[none,text,logo]
BACK_LINE_A = "If found:";
BACK_LINE_B = "555 0100";
BACK_FONT = "sans"; //[sans,serif,mono,wide]
BACK_SIZE = 3; //[2.5:0.5:12]
BACK_LOGO = [];
BACK_LOGO_SIZE = 10; //[3:0.5:30]
// Engraving depth, and how high an embossed mark stands
ENGRAVE = 0.6; //[0.3:0.1:1.2]
EMBOSS = 0.6; //[0.4:0.1:1.5]
// The NFC tag and the magnets: none, an open pocket in the back, or embedded at a print pause
NFC = "none"; //[none,pocket,embedded]
MAGNET_MOUNT = "none"; //[none,pocket,embedded]
MAGNET_COUNT = 1; //[1:1:2]
// The chosen parts' greatest sizes (from the parts library): NFC tag, magnet, split ring band (A, and B over both turns), collar
NFC_D = 18;
NFC_T = 0.2;
MAGNET_D = 6.1;
MAGNET_T = 1.1;
RING_A = 1.778;
RING_B = 2.667;
COLLAR_W = 10;
COLLAR_T = 1.18;
// Hanging: the bail's wall round its hole
BAIL_WALL = 2; //[1.2:0.1:4]
// Slide-on: the slots' play over the strap's thickness, and the end bars' width
SLOT_FIT = 0.3; //[0:0.05:1]
BAR_WIDTH = 3; //[2:0.5:8]
// Clip and sleeve: the sleeve's style, the length along the strap, the wall, the play round the strap per side, and the clip's lips
// (a wrap sleeve's flaps' overlap)
SLEEVE_STYLE = "closed"; //[closed,wrap]
CARRIER_L = 8; //[5:0.5:20]
CARRIER_WALL = 1.6; //[1.2:0.1:3]
CARRIER_FIT = 0.2; //[0:0.05:0.8]
LIP = 1.2; //[0.6:0.1:4]
// The slicer's layer height: the pause height of an embedded item is on a layer boundary
LAYER = 0.2; //[0.08:0.02:0.32]

// --- fixed sizes (COLLAR_TAG in packages/contracts/src/catCollarTag.ts) ---
SIDE_WALL = 1.2;          // least wall round a pocket, a cavity, a slot or the text
COVER_WALL = 0.6;         // least plastic over a pocket or a cavity, under the front and its engraving
CORE_WALL = 0.6;          // least plastic between the back's and the front's engravings
EMBED_SKIN = 0.4;         // embedded items: the least skin under them (whole layers),
EMBED_HEADROOM = 0.05;    //   and over them before the pause
POCKET_PLAY = 0.2;        // a pocket or cavity: the item's greatest diameter plus this
NFC_GAP = 5;              // magnets stay this far outside an NFC tag's antenna (checked by the contract)
HOLE_PLAY = 0.4;          // hanging: the bail's hole takes the ring's band, both turns, with this play,
HOLE_MIN = 3;             //   is at least this wide,
HANG_GAP = 0.3;           //   and its edge is this far above the outline's top
RING_PLAY = 0.5;          // the ring holds the bail and the D-ring with this play (checked by the contract),
RING_CLEARANCE = 0.2;     //   and clears the bail by this
SLOT_LENGTH_PLAY = 0.5;   // slide-on: each slot is this much longer than the strap is wide, at each end,
MIN_MIDDLE = 8;           //   and leaves at least this much face between them (checked by the contract)
TEXT_MARGIN = 0.5;        // text: margin inside its area,
LINE_PITCH = 1.35;        //   and the distance between baselines per mm of text size
CORNER_ROUND = 1;         // the outline's corners, inner and outer, are rounded to this
CARRIER_ROUND = 0.5;      // clip and sleeve: their outer corners are rounded to this,
CARRIER_EDGE = 0.3;       //   their ends to this;
TAB_GAP = 0.8;            //   the ring's hole is this far below the channel's wall,
TAB_T = 2.4;              //   in a tab this thick at the end on the bed (a ring cannot pass through a long hole);
MIN_OPENING = 3;          //   a clip's lips leave at least this between them (checked by the contract);
FLAP_GAP = 0.3;           //   a wrap sleeve's flaps are this far apart,
BUMP = 0.5;               //   its click a bump of this radius,
BUMP_PLAY = 0.15;         //   in a notch this much larger,
HINGE = 0.8;              //   and its hinges this thick
EDGE_STEP = 0.1;          // the rounded edges are built of slices this high (or a little less) on each face,
INSET_GRID = 0.02;        //   each inset by a multiple of this,
OVERLAP = 0.01;           //   reaching this far into the next

// --- derived layout (collarTagLayout) ---
HANGING = ATTACHMENT != "slide-on";
H = SHAPE == "round" ? WIDTH : HEIGHT;
// The heart: a square turned 45° (half-diagonal √½) with a circle of diameter 1 on each upper side, in units of the square's side
HEART_C = sqrt(0.5) / 2;
HEART_W = 2 * (HEART_C + 0.5);
HEART_TOP = HEART_C + 0.5;
HEART_BOTTOM = -sqrt(0.5);
HEART_H = HEART_TOP - HEART_BOTTOM;
HEART_SHIFT = (HEART_TOP + HEART_BOTTOM) / 2;
RR_K = 2 * min(WIDTH, H) / 4 * (1 - sqrt(0.5));
// Each outline's free area [x, y, w, h], a rectangle inside it for the text and the hardware, and its hanging point
BOX = SHAPE == "round" ? [0, 0, WIDTH * sqrt(0.5), WIDTH * sqrt(0.5)]
  : SHAPE == "rounded-rectangle" ? [0, 0, WIDTH - RR_K, H - RR_K]
  : SHAPE == "bone" ? [0, 0, WIDTH - H / 2, 0.6 * H]
  : SHAPE == "heart" ? [0, (0.05 - HEART_SHIFT) * H / HEART_H, 0.9 * WIDTH / HEART_W, 0.5 * H / HEART_H]
  : [-0.14 * WIDTH, 0, 0.72 * WIDTH * sqrt(0.5), H * sqrt(0.5)];
HANG = SHAPE == "bone" ? [0, 0.3 * H] : SHAPE == "heart" ? [0, (sqrt(0.5) - HEART_SHIFT) * H / HEART_H]
  : SHAPE == "fish" ? [-0.14 * WIDTH, H / 2] : [0, H / 2];
// The bail round the hole for the split ring (a hanging tag, or one hung from a clip or sleeve)
HOLE_D = HANGING ? max(HOLE_MIN, ceil((sqrt(RING_A * RING_A + RING_B * RING_B) + HOLE_PLAY) * 10 - 1e-9) / 10) : 0;
HOLE = [HANG[0], HANG[1] + HOLE_D / 2 + HANG_GAP];
EAR_R = HOLE_D / 2 + BAIL_WALL;
// Slide-on: a slot near each end of the free area; the text and hardware between them
SLOT_W = COLLAR_T + SLOT_FIT;
SLOT_L = COLLAR_W + 2 * SLOT_LENGTH_PLAY;
SLOT_X = BOX[2] / 2 - BAR_WIDTH - SLOT_W / 2;
SLOTS = HANGING ? [] : [[BOX[0] - SLOT_X, BOX[1]], [BOX[0] + SLOT_X, BOX[1]]];
AREA = HANGING ? BOX : [BOX[0], BOX[1], 2 * (SLOT_X - SLOT_W / 2 - SIDE_WALL), BOX[3]];
// Through the thickness: the engravings, an embedded item's cavity (one print pause) or the pockets' depth
function visible(s) = len([for (c = s) if (c != " ") c]) > 0;
function has_mark(mark, a, b, logo) = mark == "text" ? visible(a) || visible(b) : mark == "logo" ? len(logo) > 0 : false;
HAS_FRONT = has_mark(FRONT_MARK, FRONT_LINE_A, FRONT_LINE_B, FRONT_LOGO);
HAS_BACK = has_mark(BACK_MARK, BACK_LINE_A, BACK_LINE_B, BACK_LOGO);
BACK_DEPTH = HAS_BACK ? ENGRAVE : 0;
FRONT_DEPTH = HAS_FRONT && FRONT_STYLE == "engrave" ? ENGRAVE : 0;
EMBOSSED = HAS_FRONT && FRONT_STYLE == "emboss";
// a height rounded up to whole layers, to the micrometre
function layers(h) = round(ceil(h / LAYER - 1e-9) * LAYER * 1e6) / 1e6;
EMBEDDED = NFC == "embedded" ? "nfc" : MAGNET_MOUNT == "embedded" ? "magnet" : "none";
EMBED_H = EMBEDDED == "nfc" ? NFC_T : EMBEDDED == "magnet" ? MAGNET_T : 0;
SKIN = EMBEDDED == "none" ? 0 : layers(EMBED_SKIN + BACK_DEPTH);
PAUSE = EMBEDDED == "none" ? 0 : layers(SKIN + EMBED_H + EMBED_HEADROOM);
// The hardware in the free area: the NFC tag in its middle, the magnets beside it, or one in the middle, or two far apart
NFC_POCKET = NFC_D + POCKET_PLAY;
MAGNET_POCKET = MAGNET_D + POCKET_PLAY;
SPREAD = AREA[2] / 2 - MAGNET_POCKET / 2 - SIDE_WALL;
MAGNETS = MAGNET_MOUNT == "none" ? []
  : NFC != "none" && MAGNET_COUNT == 1 ? [[AREA[0] + SPREAD, AREA[1]]]
  : MAGNET_COUNT == 1 ? [[AREA[0], AREA[1]]] : [[AREA[0] - SPREAD, AREA[1]], [AREA[0] + SPREAD, AREA[1]]];

// Clip and sleeve (the carrier): its profile round the strap, x through the strap's thickness (the cat's side at x < 0), y across its
// width, extruded along it (z); a tab below, flush with the cat's side, round the ring's hole
CHANNEL_T = COLLAR_T + 2 * CARRIER_FIT;
CHANNEL_W = COLLAR_W + 2 * CARRIER_FIT;
WRAP = ATTACHMENT == "sleeve" && SLEEVE_STYLE == "wrap";
// a wrap sleeve's flaps overlap by the lip depth, plus room for the click in the middle of the overlap
FLAP_OVERLAP = LIP + 2 * (BUMP + BUMP_PLAY);
TAB_R = HOLE_D / 2 + BAIL_WALL;
TAB_HOLE = [-CARRIER_WALL + TAB_R, -CHANNEL_W / 2 - CARRIER_WALL - TAB_GAP - HOLE_D / 2];

$fa = 2;
$fs = 0.25;

// ---------------------------------------------------------------
// The outline

module raw_outline() {
  if (SHAPE == "round") circle(d = WIDTH);
  else if (SHAPE == "rounded-rectangle") offset(r = min(WIDTH, H) / 4) square([WIDTH - min(WIDTH, H) / 2, H - min(WIDTH, H) / 2], center = true);
  else if (SHAPE == "bone") {
    square([WIDTH - H / 2, 0.6 * H], center = true);
    for (sx = [-1, 1], sy = [-1, 1]) translate([sx * (WIDTH / 2 - H / 4), sy * H / 4]) circle(r = H / 4);
  }
  else if (SHAPE == "heart") scale([WIDTH / HEART_W, H / HEART_H]) translate([0, -HEART_SHIFT]) {
    rotate(45) square(1, center = true);
    for (sx = [-1, 1]) translate([sx * HEART_C, HEART_C]) circle(d = 1, $fn = 120);
  }
  else {
    translate([-0.14 * WIDTH, 0]) scale([0.36 * WIDTH, H / 2]) circle(r = 1, $fn = 120);
    polygon([[0.12 * WIDTH, 0], [0.5 * WIDTH, 0.42 * H], [0.5 * WIDTH, -0.42 * H]]);
  }
}

// Hanging: the bail, a tab round the hole that runs down into the outline
module bail_2d() {
  hull() {
    translate(HOLE) circle(r = EAR_R);
    translate([HANG[0], HANG[1] - EAR_R]) circle(r = EAR_R);
  }
}

// The outline with the bail, every corner rounded, outer and inner (an opening, then a closing)
module outline() {
  offset(r = -CORNER_ROUND) offset(r = 2 * CORNER_ROUND) offset(r = -CORNER_ROUND) union() {
    raw_outline();
    if (HANGING) bail_2d();
  }
}

// A 2D shape extruded `h` high with its bottom and top edges rounded to `r`: slices of at most EDGE_STEP, each inset to the round
// profile on an INSET_GRID grid. Slices with the same inset are merged (two equal prisms overlapping leave collinear vertices that
// float32 turns into zero-area triangles), and each reaches OVERLAP into the wider one towards the middle, so that they fuse.
function edge_slices(r, h) =
  let(steps = ceil(r / EDGE_STEP - 1e-9),
      insets = [for (i = [0 : steps - 1]) let(zm = r * (i + 0.5) / steps) round((r - sqrt(r * r - (r - zm) * (r - zm))) / INSET_GRID) * INSET_GRID],
      raw = concat([for (i = [0 : steps - 1]) [r * i / steps, r * (i + 1) / steps, insets[i]]],
        h > 2 * r ? [[r, h - r, 0]] : [],
        [for (i = [steps - 1 : -1 : 0]) [h - r * (i + 1) / steps, h - r * i / steps, insets[i]]]))
  merge_slices(raw);
function merge_slices(s, i = 0, acc = []) = i >= len(s) ? acc
  : len(acc) > 0 && acc[len(acc) - 1][2] == s[i][2]
    ? merge_slices(s, i + 1, concat(len(acc) > 1 ? [for (k = [0 : len(acc) - 2]) acc[k]] : [], [[acc[len(acc) - 1][0], s[i][1], s[i][2]]]))
    : merge_slices(s, i + 1, concat(acc, [s[i]]));
module rounded_extrude(h, r) {
  slices = r > 0 ? edge_slices(r, h) : [[0, h, 0]];
  widest = min([for (s = slices) s[2]]);
  middle = [for (k = [0 : len(slices) - 1]) if (slices[k][2] == widest) k][0];
  for (k = [0 : len(slices) - 1]) {
    lo = slices[k][0] - (k > middle ? OVERLAP : 0);
    hi = slices[k][1] + (k < middle ? OVERLAP : 0);
    translate([0, 0, lo]) linear_extrude(hi - lo) offset(r = -slices[k][2]) children();
  }
}

// The tag's body: the outline, its front and back edges rounded to EDGE_R
module slab() { rounded_extrude(THICKNESS, EDGE_R) outline(); }

// ---------------------------------------------------------------
// The marks

function text_font(name) = name == "serif" ? "Liberation Serif:style=Bold" : name == "mono" ? "Liberation Mono:style=Bold"
  : name == "wide" ? "DejaVu Sans:style=Bold" : "Liberation Sans:style=Bold";
// The lowest and highest point of any glyph, per mm of text size (TEXT_EXTENTS in packages/contracts/src/textMetrics.ts)
function font_extents(name) = name == "serif" ? [-0.307, 1.006] : name == "mono" ? [-0.309, 1.027]
  : name == "wide" ? [-0.328, 1.111] : [-0.309, 1.031];

// A logo (rings of [x, y] points that fill even-odd) as one polygon, `size` high, or less if it would be wider than `widest`, centred
module logo_2d(logo, size, widest) {
  points = [for (ring = logo) each ring];
  starts = [for (i = 0, n = 0; i < len(logo); n = n + len(logo[i]), i = i + 1) n];
  lo = [min([for (p = points) p[0]]), min([for (p = points) p[1]])];
  hi = [max([for (p = points) p[0]]), max([for (p = points) p[1]])];
  s = min(size / max(1, hi[1] - lo[1]), widest / max(1, hi[0] - lo[0]));
  scale(s) translate(-(lo + hi) / 2) polygon(points, [for (i = [0 : len(logo) - 1]) [for (j = [0 : len(logo[i]) - 1]) starts[i] + j]]);
}

// A face's mark, centred in the free area and clipped to it: its lines, each on a baseline LINE_PITCH sizes below the one before,
// the block centred; or its logo. The back's is mirrored, so that it reads when the tag is turned over.
module mark_2d(mark, a, b, font, size, logo, logo_size, mirrored) {
  lines = [for (l = [a, b]) if (visible(l)) l];
  extents = font_extents(font);
  block = (len(lines) - 1) * LINE_PITCH * size + (extents[1] - extents[0]) * size;
  room = [AREA[2] - 2 * TEXT_MARGIN, AREA[3] - 2 * TEXT_MARGIN];
  translate([AREA[0], AREA[1]]) mirror([mirrored ? 1 : 0, 0]) intersection() {
    union() {
      if (mark == "text" && len(lines) > 0) for (i = [0 : len(lines) - 1])
        translate([0, block / 2 - extents[1] * size - i * LINE_PITCH * size])
          text(lines[i], size = size, font = text_font(font), halign = "center", valign = "baseline");
      if (mark == "logo" && len(logo) > 0) logo_2d(logo, logo_size, room[0]);
    }
    square(room, center = true);
  }
}
module front_2d() { mark_2d(FRONT_MARK, FRONT_LINE_A, FRONT_LINE_B, FRONT_FONT, FRONT_SIZE, FRONT_LOGO, FRONT_LOGO_SIZE, false); }
module back_2d() { mark_2d(BACK_MARK, BACK_LINE_A, BACK_LINE_B, BACK_FONT, BACK_SIZE, BACK_LOGO, BACK_LOGO_SIZE, true); }

// ---------------------------------------------------------------
// The clip and the sleeve

module rounded_rect(x0, y0, x1, y1, r = CARRIER_ROUND) { translate([x0 + r, y0 + r]) offset(r = r) square([x1 - x0 - 2 * r, y1 - y0 - 2 * r]); }

// The profile (without the tab): walls round the channel; a clip's front is open between two lips, with lead-in chamfers; a wrap sleeve's front is two
// flaps on thin hinges, the upper one outside the lower, overlapping by LIP, with a bump on the upper that clicks into a notch in the
// lower. Only the outer corners are rounded, so that the flaps' gap and the hinges stay as drawn.
module carrier_2d() {
  w = CARRIER_WALL; t = CHANNEL_T; h = CHANNEL_W / 2; e = 0.01;
  o = h - LIP;                                   // half the clip's opening
  upper_x = t + w + FLAP_GAP;                    // a wrap sleeve's upper flap, outside the lower one
  difference() {
    union() {
      rounded_rect(-w, -h - w, t + w, h + w);
      if (WRAP) {
        rounded_rect(t, h, upper_x + w, h + w);                         // the top wall, out over both flaps
        rounded_rect(upper_x, -FLAP_OVERLAP / 2, upper_x + w, h + w);   // the upper flap
      }
    }
    translate([0, -h]) square([t, 2 * h]);
    if (ATTACHMENT == "clip") {
      translate([t - e, -o]) square([w + 2 * e, 2 * o]);
      polygon([[t + 0.4 * w, o], [t + w + e, o + 0.6 * w], [t + w + e, -o - 0.6 * w], [t + 0.4 * w, -o]]);
    }
    if (WRAP) {
      // the lower flap: the front from the bottom wall up to the overlap, thinned to its hinge just above the wall
      translate([t - e, FLAP_OVERLAP / 2]) square([w + 2 * e, h - FLAP_OVERLAP / 2 + e]);
      translate([t + HINGE, -h]) square([w - HINGE + e, 1.5]);
      // the notch for the click, in the lower flap only
      intersection() {
        translate([upper_x, 0]) circle(r = BUMP + BUMP_PLAY);
        translate([t, -h]) square([w, 2 * h]);
      }
      // the upper flap's hinge, just below the top wall
      translate([upper_x + HINGE, h - 1.5]) square([w - HINGE + e, 1.5]);
    }
  }
  // the click: a bump on the upper flap's inside, in the middle of the overlap
  if (WRAP) intersection() {
    translate([upper_x, 0]) circle(r = BUMP);
    translate([t + w + e, -h]) square([FLAP_GAP + w, 2 * h]);
  }
}

// The tab, flush with the cat's side, round the ring's hole, joined to the bottom wall
module tab_2d() {
  difference() {
    hull() {
      translate(TAB_HOLE) circle(r = TAB_R);
      translate([-CARRIER_WALL, -CHANNEL_W / 2 - CARRIER_WALL]) square([2 * TAB_R, CARRIER_WALL]);
    }
    translate(TAB_HOLE) circle(d = HOLE_D);
  }
}

// The carrier stands on an end: the profile along the strap, the tab at the end on the bed
module carrier() {
  rounded_extrude(CARRIER_L, CARRIER_EDGE) carrier_2d();
  rounded_extrude(TAB_T, CARRIER_EDGE) tab_2d();
}

// ---------------------------------------------------------------
// The tag

module tag() {
  difference() {
    slab();
    // hanging: the hole for the split ring; slide-on: the slots for the strap
    if (HANGING) translate([HOLE[0], HOLE[1], -1]) cylinder(d = HOLE_D, h = THICKNESS + 2);
    for (s = SLOTS) translate([s[0], s[1], THICKNESS / 2]) cube([SLOT_W, SLOT_L, THICKNESS + 2], center = true);
    // the engravings
    if (HAS_FRONT && FRONT_STYLE == "engrave") translate([0, 0, THICKNESS - ENGRAVE]) linear_extrude(ENGRAVE + 1) front_2d();
    if (HAS_BACK) translate([0, 0, -1]) linear_extrude(ENGRAVE + 1) back_2d();
    // the NFC tag and the magnets: open pockets in the back, or the embedded one's sealed cavities, all up to the pause height
    if (NFC == "pocket") translate([AREA[0], AREA[1], -1]) cylinder(d = NFC_POCKET, h = NFC_T + 1);
    if (NFC == "embedded") translate([AREA[0], AREA[1], SKIN]) cylinder(d = NFC_POCKET, h = PAUSE - SKIN);
    for (m = MAGNETS) {
      if (MAGNET_MOUNT == "pocket") translate([m[0], m[1], -1]) cylinder(d = MAGNET_POCKET, h = MAGNET_T + 1);
      if (MAGNET_MOUNT == "embedded") translate([m[0], m[1], SKIN]) cylinder(d = MAGNET_POCKET, h = PAUSE - SKIN);
    }
  }
  if (EMBOSSED) translate([0, 0, THICKNESS]) linear_extrude(EMBOSS) front_2d();
}

if (PART == "tag") tag();
if (PART == "clip" || PART == "sleeve") carrier();
