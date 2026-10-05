// Window cat guard (tilt window): a CanFactory generator, published under CC BY-NC-SA 4.0.
//
// An adaptation of "Tilted window cat protection" on MakerWorld
// (https://makerworld.com/de/models/3234292-tilted-window-cat-protection, CC BY-NC-SA 4.0):
// a new parametric generator built the way its parts are (references/); see ../ATTRIBUTION.md.
//
// A tilted (bottom-hung) window leaves a triangular gap on each side between
// the sash and the frame, and a gap across the top. A cat that squeezes into
// a side gap slides down into the narrowing wedge and is trapped. The guard
// closes the gaps with printed honeycomb panels:
//
// - two side panels (PART = "side", SIDE = "left" or "right"): a right-angled
//   trapezoid, HEIGHT tall, GAP wide at the top and TIP wide at the bottom,
//   with one spine along its middle;
// - a top strip (PART = "strip"), GAP deep, spanning the window's WIDTH
//   between the side panels, with two ribs along it.
//
// Every panel longer than MAX_LENGTH is split into equal segments, each its
// own part (SEGMENT; 1 = the side panel's top or the strip's left end), so
// that every part fits a print bed. This is how the reference parts in
// references/ are built (see docs/window-cat-guard.md for what was measured):
//
// - segments join edge to edge with an in-plane dovetail: a tab on one
//   segment drops into a notch in the next, perpendicular to the plate;
// - the spine (or rib) runs on over the tab and laps LAP mm onto the next
//   segment's plate, so the joint cannot fold and the segments stay flush;
// - the top strip's two end segments carry pins along the strip, which plug
//   into bosses on the side panels' top segments: the guard is one U-shaped
//   frame that stands in the window.
//
// Every part prints flat as modelled: the plate on the bed (z = 0), spine,
// ribs and bosses on top, no supports. The pins lie along the bed with a
// flat underside. A segment keeps the panel's own coordinates (a side panel:
// x across the gap from its straight edge, y up from its tip; the strip: x
// along it from its left end, y across the gap), so the assembly places every
// segment of a panel at the same pose; the slicer centres them on the bed.
//
// The joint sizes below are mirrored by WINDOW_CAT_GUARD in
// packages/contracts/src/windowCatGuard.ts (a test compares them).

// ---------------------------------------------------------------

// Which piece to make: a side panel segment or a top strip segment
PART = "side"; //[side,strip]
// Which side panel: the right one is the left one mirrored
SIDE = "left"; //[left,right]
// Which segment (1 = the side panel's top / the strip's left end)
SEGMENT = 1; //[1:1:8]

// Height of a side panel: the height of the side gap it closes
HEIGHT = 550; //[150:1:1500]
// Width of the side gap at the top: the side panels' top width and the strip's depth
GAP = 105; //[60:0.5:200]
// Width of a side panel at its bottom (tip)
TIP = 10; //[4:0.5:60]
// Window width: outside to outside of the two side panels
WIDTH = 900; //[300:1:1600]
// Longest part: a panel longer than this is split into equal segments
MAX_LENGTH = 210; //[120:1:300]
// Whether there is a top strip (and, for it, bosses on the side panels)
STRIP = true;
// Plate thickness
THICKNESS = 4; //[2.4:0.1:6]
// Height of the spine and the ribs above the plate
RIB_HEIGHT = 5; //[2:0.5:12]
// Honeycomb hole size, corner to corner (vertical); 0 for solid plates
CELL = 30; //[0:0.5:60]
// Web between two honeycomb holes
WEB = 4; //[2:0.1:10]
// Solid border round every plate
BORDER = 6; //[3:0.5:15]
// Play in every joint, on each side
FIT = 0.25; //[0.05:0.05:0.6]

// ---------------------------------------------------------------
// Joint sizes (fixed; mirrored by WINDOW_CAT_GUARD in windowCatGuard.ts)

SPINE_W = 12;      // side panel spine width
RIB_W = 4;         // top strip rib width
RIB_SPACING = 60;  // the strip's ribs (and the bosses) this far apart, at most
TAB_DEPTH = 8;     // dovetail: how far the tab reaches into the next segment
TAB_FLARE = 3;     // dovetail: how much wider the tab's tip is than its root, on each side
TAB_MARGIN = 1;    // dovetail: the tab's root is this much wider than the spine or rib, on each side
LAP = 3;           // the spine or rib laps this far onto the next segment's plate
PIN_D = 5;         // the strip's pins
PIN_FLAT = 0.3;    // a pin's axis this far below its radius, so it lies on a flat
BOSS_D = 11;       // the side panels' bosses
BOSS_H = 7;        // the bosses stand this high on the plate
BOSS_INSET = 7;    // a boss's centre this far below the side panel's top
END_GAP = 0.5;     // between the strip's end and a boss

$fn = 48;
ROOT = 1;          // a tab starts this far inside its own plate, so that the two fuse without slivers

// ---------------------------------------------------------------
// Derived layout (mirrored by windowCatGuardLayout in windowCatGuard.ts)

SIDE_SEGMENTS = max(1, ceil(HEIGHT / MAX_LENGTH - 1e-9));
SIDE_LENGTH = HEIGHT / SIDE_SEGMENTS;
// the ribs and the bosses: centred across the gap, as far apart as RIB_SPACING
// and the bosses' clearance from the plate's edge allow
SPACING = min(RIB_SPACING, GAP - 2 * (BORDER + BOSS_D / 2 + 1));
RIBS = [GAP / 2 - SPACING / 2, GAP / 2 + SPACING / 2];
PIN_Z = PIN_D / 2 - PIN_FLAT;
PIN_L = END_GAP + BOSS_H + THICKNESS - 0.5;
STRIP_START = THICKNESS + BOSS_H + END_GAP;
STRIP_UNDER = HEIGHT - BOSS_INSET - PIN_Z;  // the strip's underside, in the side panels' height
STRIP_LENGTH = WIDTH - 2 * STRIP_START;
STRIP_SEGMENTS = max(1, ceil(STRIP_LENGTH / MAX_LENGTH - 1e-9));
STRIP_PIECE = STRIP_LENGTH / STRIP_SEGMENTS;

// ---------------------------------------------------------------
// Side panel (left, in its own coordinates: x across, y up from the tip)

function side_width(y) = TIP + (GAP - TIP) * y / HEIGHT;
function spine_x(y) = side_width(y) / 2;
SIDE_OUTLINE = [[0, 0], [TIP, 0], [GAP, HEIGHT], [0, HEIGHT]];

// the dovetail tab at the joint at height y (from the segment below, reaching up),
// following the spine; `grow` widens it on every side (for the notch)
module side_tab(y, grow = 0) {
  root = SPINE_W / 2 + TAB_MARGIN + grow;
  tip = root + TAB_FLARE;
  y0 = y - FIT - ROOT; y1 = y + TAB_DEPTH + grow;
  polygon([[spine_x(y0) - root, y0], [spine_x(y0) + root, y0], [spine_x(y1) + tip, y1], [spine_x(y1) - tip, y1]]);
}

// the band along the spine from height y0 to y1
module side_spine_band(y0, y1, half) {
  polygon([[spine_x(y0) - half, y0], [spine_x(y0) + half, y0], [spine_x(y1) + half, y1], [spine_x(y1) - half, y1]]);
}

function side_bottom(k) = (SIDE_SEGMENTS - k) * SIDE_LENGTH;  // segment k from the top
function side_top(k) = side_bottom(k) + SIDE_LENGTH;

module side_plate(k) {
  y0 = side_bottom(k); y1 = side_top(k);
  difference() {
    union() {
      intersection() {
        polygon(SIDE_OUTLINE);
        translate([-1, y0]) square([GAP + 2, y1 - y0 - (k > 1 ? FIT : 0)]);
      }
      if (k > 1) side_tab(y1);
    }
    if (k < SIDE_SEGMENTS) side_tab(y0, FIT);
  }
}

// where the spine runs on this segment: from past the lap of the segment below
// to the end of its own lap onto the segment above
// The spine starts where the panel is 1 mm wider than it on either side: towards the tip it would
// otherwise meet the plate's edges.
SPINE_START = max(0, (SPINE_W + 2 - TIP) / (GAP - TIP) * HEIGHT);

module side_spine(k) {
  y0 = max(SPINE_START, side_bottom(k) + (k < SIDE_SEGMENTS ? TAB_DEPTH + LAP + FIT : 0));
  // with a top strip, the top segment's spine stops 1 mm below the strip, which lies across it
  y1 = k > 1 ? side_top(k) + TAB_DEPTH + LAP : STRIP ? STRIP_UNDER - 1 : HEIGHT;
  if (y1 > y0) intersection() { side_spine_band(y0, y1, SPINE_W / 2); polygon(SIDE_OUTLINE); }
}

module side_bosses(grow = 0) {
  if (STRIP) for (x = RIBS) translate([x, HEIGHT - BOSS_INSET]) circle(d = BOSS_D + 2 * grow);
}

// where the honeycomb may not reach: under the spine, round the dovetails and the bosses
module side_solid(k) {
  side_spine_band(-1, HEIGHT + 1, SPINE_W / 2 + WEB);
  if (k > 1) offset(delta = BORDER) side_tab(side_top(k));
  if (k < SIDE_SEGMENTS) offset(delta = BORDER) side_tab(side_bottom(k), FIT);
  if (k == 1) side_bosses(WEB);
}

module side_holes(k) {
  y0 = side_bottom(k); y1 = side_top(k);
  difference() {
    intersection() {
      offset(delta = -BORDER) intersection() { polygon(SIDE_OUTLINE); translate([-1, y0]) square([GAP + 2, y1 - y0]); }
      honeycomb(y0, y1);
    }
    side_solid(k);
  }
}

module side_segment(k) {
  plate = THICKNESS; top = THICKNESS + RIB_HEIGHT;
  difference() {
    union() {
      linear_extrude(plate) difference() { side_plate(k); if (CELL > 0) side_holes(k); }
      // the spine stands on the plate and rests on the next segment's where it laps; a key 0.2 mm inside it, sunk into its
      // own plate, fuses the two (its faces never meet theirs)
      translate([0, 0, plate]) linear_extrude(top - plate) side_spine(k);
      translate([0, 0, plate - 0.5]) linear_extrude(1) offset(delta = -0.2) intersection() { side_spine(k); side_plate(k); }
      if (k == 1) translate([0, 0, plate - 0.5]) linear_extrude(BOSS_H + 0.5) side_bosses();
    }
    if (k == 1 && STRIP) for (x = RIBS) translate([x, HEIGHT - BOSS_INSET, -1]) cylinder(d = PIN_D + 2 * FIT, h = plate + BOSS_H + 2);
  }
}

// ---------------------------------------------------------------
// Top strip (in its own coordinates: x along it from its left end, y across)

module strip_tab(x, y, grow = 0) {
  root = RIB_W / 2 + TAB_MARGIN + 2 + grow;
  tip = root + TAB_FLARE;
  x0 = x - FIT - ROOT; x1 = x + TAB_DEPTH + grow;
  polygon([[x0, y - root], [x0, y + root], [x1, y + tip], [x1, y - tip]]);
}

function strip_start(k) = (k - 1) * STRIP_PIECE;
function strip_end(k) = k * STRIP_PIECE;

module strip_plate(k) {
  x0 = strip_start(k); x1 = strip_end(k);
  difference() {
    union() {
      translate([x0, 0]) square([x1 - x0 - (k < STRIP_SEGMENTS ? FIT : 0), GAP]);
      if (k < STRIP_SEGMENTS) for (y = RIBS) strip_tab(x1, y);
    }
    if (k > 1) for (y = RIBS) strip_tab(x0, y, FIT);
  }
}

module strip_ribs(k) {
  x0 = strip_start(k) + (k > 1 ? TAB_DEPTH + LAP + FIT : 0);
  x1 = strip_end(k) + (k < STRIP_SEGMENTS ? TAB_DEPTH + LAP : 0);
  for (y = RIBS) translate([x0, y - RIB_W / 2]) square([x1 - x0, RIB_W]);
}

module strip_solid(k) {
  for (y = RIBS) translate([-1, y - RIB_W / 2 - WEB]) square([STRIP_LENGTH + 2, RIB_W + 2 * WEB]);
  if (k < STRIP_SEGMENTS) for (y = RIBS) offset(delta = BORDER) strip_tab(strip_end(k), y);
  if (k > 1) for (y = RIBS) offset(delta = BORDER) strip_tab(strip_start(k), y, FIT);
}

module strip_holes(k) {
  difference() {
    intersection() {
      translate([strip_start(k) + BORDER, BORDER]) square([STRIP_PIECE - 2 * BORDER, GAP - 2 * BORDER]);
      honeycomb_along(strip_start(k), strip_end(k));
    }
    strip_solid(k);
  }
}

module strip_pin(x, y, direction) {
  intersection() {
    translate([x, y, PIN_Z]) rotate([0, 90 * direction, 0]) translate([0, 0, -1]) cylinder(d = PIN_D, h = PIN_L + 1);
    translate([x - PIN_L - 2, y - PIN_D, 0]) cube([2 * PIN_L + 4, 2 * PIN_D, PIN_D + 1]);
  }
}

module strip_segment(k) {
  plate = THICKNESS; top = THICKNESS + RIB_HEIGHT;
  union() {
    linear_extrude(plate) difference() { strip_plate(k); if (CELL > 0) strip_holes(k); }
    translate([0, 0, plate]) linear_extrude(top - plate) strip_ribs(k);
    translate([0, 0, plate - 0.5]) linear_extrude(1) offset(delta = -0.2) intersection() { strip_ribs(k); strip_plate(k); }
    if (k == 1) for (y = RIBS) strip_pin(0, y, -1);
    if (k == STRIP_SEGMENTS) for (y = RIBS) strip_pin(STRIP_LENGTH, y, 1);
  }
}

// ---------------------------------------------------------------
// Honeycomb: hexagonal holes, a corner up, CELL corner to corner, WEB apart,
// laid out from the panel's top so that the rows line up across the segments.

HEX_R = CELL / 2;
HEX_PITCH = HEX_R * sqrt(3) + WEB;      // between two holes in a row
HEX_ROW = HEX_PITCH * sqrt(3) / 2;      // between two rows

module hexagon() { rotate(30) circle(r = HEX_R, $fn = 6); }

// The holes are clipped to the plate's open area (inside the border, off the spine
// or ribs). A hole whose centre lies outside it is left out, so that clipping
// never leaves a sliver: at most half a hole remains.

// a side panel's holes between heights y0 and y1, the rows counted down from its top
module honeycomb(y0, y1) {
  first = floor((HEIGHT - y1) / HEX_ROW) - 1; last = ceil((HEIGHT - y0) / HEX_ROW) + 1;
  for (row = [max(0, first) : last]) {
    y = HEIGHT - row * HEX_ROW;
    shift = (row % 2) * HEX_PITCH / 2;
    for (i = [-1 : ceil(GAP / HEX_PITCH) + 1]) {
      x = GAP / 2 + (i - floor(GAP / HEX_PITCH / 2)) * HEX_PITCH + shift;
      if (y > y0 + BORDER && y < y1 - BORDER && x > BORDER && x < side_width(y) - BORDER && abs(x - spine_x(y)) > SPINE_W / 2 + WEB)
        translate([x, y]) hexagon();
    }
  }
}

// the strip's holes between x0 and x1 along it, a corner pointing along it, the rows counted from its left end
module honeycomb_along(x0, x1) {
  first = floor(x0 / HEX_ROW) - 1; last = ceil(x1 / HEX_ROW) + 1;
  for (row = [max(0, first) : last]) {
    x = row * HEX_ROW;
    shift = (row % 2) * HEX_PITCH / 2;
    for (i = [-1 : ceil(GAP / HEX_PITCH) + 1]) {
      y = GAP / 2 + (i - floor(GAP / HEX_PITCH / 2)) * HEX_PITCH + shift;
      if (x > x0 + BORDER && x < x1 - BORDER && y > BORDER && y < GAP - BORDER && min([for (r = RIBS) abs(y - r)]) > RIB_W / 2 + WEB)
        translate([x, y]) rotate(-30) hexagon();
    }
  }
}

// ---------------------------------------------------------------

if (PART == "side") {
  if (SIDE == "right") mirror([1, 0, 0]) side_segment(SEGMENT); else side_segment(SEGMENT);
} else {
  strip_segment(SEGMENT);
}
