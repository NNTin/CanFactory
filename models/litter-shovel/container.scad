// Litter shovel, part 1 of 3: the container. An original CanFactory design, published under CC BY 4.0.
//
// A bin for a liner bag: a gently flaring rounded-rectangle frustum on a solid floor that runs straight (the band) for its
// top 13 mm and ends in a closed lip. The lip's flat top is the container's face in the stack container, scoop, handle: the bag
// folds over it, and the scoop's cap sits on it. At the front (+X) the container has its own handle, open at the bottom like a
// hook: a thin curved sheet that leaves the wall under the lip, falls at 45 degrees, bends and runs straight down, braced under
// the slope by SUPPORT_COUNT thin fins. It is the finger side of the shovel's grip: the handle part's sheet lies on it, and the
// two make one strip. Held in the fist, they clamp the container to the handle, with the scoop's cap between the lip and the
// handle's ring (docs/litter-shovel.md).
//
// Modelled as it prints and stands: Z up, the floor at Z = 0, the lip's top at Z = 141.5. The lip has a 45 degree underside,
// the sheet's slope and the fins' lower edges are at 45 degrees, and its bend is round. With GRIP_END = "open" the grip's tip
// hangs free 30 mm above the floor, so the slicer must support it; with "floor" the sheet runs down to the bed and nothing
// needs support. In `detent` mode grooves in the mouth, just under the lip, take the bumps on the scoop's sleeve. Under the
// mouth, on the scraper side, a 45 degree dam keeps the clumps in when the shovel is turned over to scoop.

// How the scoop's sleeve holds in the mouth: a close fit only, or a detent (bumps on the sleeve, grooves in the mouth)
SCOOP_SNAP = "detent"; //[friction,detent]
// Gap per side between mating surfaces, in mm
CLEARANCE = 0.2; //[0.1:0.01:0.6]
// How far the sleeve's bumps reach past the mouth's wall, in mm, on top of the clearance
SCOOP_DETENT_ENGAGE = 0.15; //[0.02:0.01:0.4]
// How many thin fins brace the handle's sheet under its slope
SUPPORT_COUNT = 3; //[1:1:5]
// Thickness of each fin, in mm
SUPPORT_THICKNESS = 2; //[1.2:0.1:4]
// Where the grip ends: open, above the floor (the slicer supports its tip), or down on the floor (no support needed)
GRIP_END = "open"; //[open,floor]
// The grip's shape: a thin sheet, the same curved out, a round tube or a rectangular bar
HANDLE_SHAPE = "sheet"; //[sheet,curved,round,rectangular]
// How far the curved grip's middle bulges towards the palm past its edges, in mm
GRIP_BULGE = 3; //[0:0.5:6]
// The round grip's diameter, or the rectangular grip's depth, in mm
GRIP_SIZE = 14; //[10:1:24]
// How far the dam under the mouth, on the scraper side (-X), reaches in from the back wall, in mm (0 for none)
DAM_WIDTH = 8; //[0:0.5:15]
// Thickness of the shell's wall, in mm (three to five lines of a 0.4 mm nozzle at 1.2 to 2.0); the floor follows it
WALL_THICKNESS = 1.6; //[1.2:0.1:3.2]

$fa = 4; $fs = 0.5;
E = 0.01;

// Body: the floor's and the band's outer plan [width (X), length (Y), corner radius]; wall, floor, and the lip's top. The floor
// is a plate the litter's weight bends when the container is carried by its handle, so it stays at least 2 mm and never goes
// past 3.2 mm.
FLOOR = [64.7, 97, 11];
BAND = [74.5, 106.8, 14];
WALL = WALL_THICKNESS; FLOOR_T = min(3.2, WALL + 0.8); RIM_Z = 141.5;
// The handle's root pad: the wall is at least ROOT_WALL thick behind the handle's sheet, which carries the whole container, so
// a thin wall does not make its anchor weak. The pad is ROOT_PAD_W wide at its face, spans ROOT_PAD_Z there, has corners of
// radius ROOT_PAD_R, and its ends and underside are at 45 degrees, so it needs no support.
ROOT_WALL = 2.4; ROOT_PAD_Z = [124, 136]; ROOT_PAD_R = 3;
// Lip: how far it stands out from the band, and its thickness above the 45 degree chamfer.
LIP_W = 4; LIP_T = 3;
// The band is straight from 3 mm below the lip's chamfer up to the rim.
BAND_Z = RIM_Z - LIP_T - LIP_W - 3;
// The fins reach this far out from the band along the sheet's slope.
FIN_REACH = 12;
// Detent grooves: height in the mouth (mid-way down the scoop's sleeve) and length along the wall.
DETENT_Z = RIM_Z - 2.5; DETENT_L = 16;
// Dam: the scoop's sleeve reaches SLEEVE_DEPTH into the mouth; the dam's top meets the wall DAM_GAP below it (room for the bag),
// and it is a sheet as thick as the wall (at most ROOT_WALL, so that it stays clear of the band's flare), at 45 degrees (DAM_T high).
SLEEVE_DEPTH = 5; DAM_GAP = 1;
DAM_TOP = RIM_Z - SLEEVE_DEPTH - DAM_GAP;
DAM_T = min(WALL, ROOT_WALL) * sqrt(2);

module rr2d(p) { offset(r = p[2], $fn = 64) square([p[0] - 2 * p[2], p[1] - 2 * p[2]], center = true); }
module slab(p, z, h = E) { translate([0, 0, z]) linear_extrude(h) rr2d(p); }
function grow(p, d) = [p[0] + 2 * d, p[1] + 2 * d, p[2] + d];

MOUTH = grow(BAND, -WALL);

// The outer shell: the floor's plan flaring to the band's, then straight (one convex hull, so there is no seam).
module outside() { hull() { slab(FLOOR, 0); slab(BAND, BAND_Z, RIM_Z - BAND_Z); } }

// The cavity, one wall inside: it starts on the floor and runs past the rim to leave the top open.
module inside() {
  f = FLOOR_T / BAND_Z;
  low = [for (i = [0 : 2]) FLOOR[i] + (BAND[i] - FLOOR[i]) * f];
  hull() { slab(grow(low, -WALL), FLOOR_T); slab(MOUTH, BAND_Z, RIM_Z - BAND_Z + 2); }
}

// The closed lip: flat on top, a 45 degree chamfer down to the band underneath.
module lip() {
  hull() {
    slab(grow(BAND, LIP_W), RIM_Z - LIP_T, LIP_T);
    slab(BAND, RIM_Z - LIP_T - LIP_W);
  }
}

// ---- The grip's two halves: identical in container.scad and handle.scad. ----
// The grip is two halves, one on each side of a seam, the container's on the finger side and the handle part's on the palm
// side. Stacked, they make one bar: the same width, their seam faces CLEARANCE apart, and at the open tip each outer
// corner rounded, so that the pair ends in one half-round. HANDLE_SHAPE picks the bar: "sheet" (default) a 6 mm strip, its
// outer long edges rounded; "curved" the same strip bowed across its width, its middle GRIP_BULGE towards the palm past its
// edges (both halves are arcs about one axis along the run, so the gap stays CLEARANCE all over); "round" a tube of diameter
// GRIP_SIZE, each half a solid half-round; "rectangular" a box bar GRIP_SIZE deep and 26 mm wide, each half a solid slab. The round and rectangular bars move the seam out, so that the finger
// gap stays as wide, and their bends grow with them; their open tip is lower, to keep the run the sheet's leaves for the fist. The seam, in the
// container's frame (XZ), runs from the top down: at the handle part's end, up the ring's outer face; a bend of SEAM_R2 into a
// 45 degree slope through SLOPE_POINT (2.5 mm under the lip's chamfer, on the band); a bend of SEAM_R1 into the grip, vertical
// at x = SEAM_X, down to its tip. Each sheet runs from CLEARANCE / 2 to SHEET_T off the seam, so its outer face does not
// depend on the clearance.
SHEET_T = 3; EDGE_R = 2.5;
GRIP_ROUND = HANDLE_SHAPE == "round"; GRIP_THICK = GRIP_ROUND || HANDLE_SHAPE == "rectangular";
GRIP_HALF = GRIP_THICK ? GRIP_SIZE / 2 : SHEET_T;      // how far each half reaches from the seam
GRIP_W = GRIP_ROUND ? GRIP_SIZE : 26;
// The curved grip's bow: the seam's cross-section is an arc of radius BOW_R about an axis along the run, whose middle stands BOW
// past its edges, towards the palm. bow_u(y) is how far the seam stands off its edges at y.
BOW = HANDLE_SHAPE == "curved" ? GRIP_BULGE : 0;
BOW_R = BOW > 0 ? (pow(GRIP_W / 2, 2) + BOW * BOW) / (2 * BOW) : 0;
function bow_u(y) = BOW > 0 ? sqrt(BOW_R * BOW_R - y * y) - (BOW_R - BOW) : 0;
SEAM_X_BASE = 65; SEAM_X = SEAM_X_BASE + GRIP_HALF - SHEET_T;
// An inner radius of at least 5 mm round each bend. SEAM_R1's centre is on the finger side; SEAM_R2's on the palm side, which the bow reaches.
SEAM_R1 = max(15, GRIP_HALF + 5); SEAM_R2 = max(10, GRIP_HALF + BOW + 5);
SLOPE_POINT = [37.25, 132];
SHEET_TH = GRIP_HALF - CLEARANCE / 2;
function slope_z(x) = SLOPE_POINT[1] - (x - SLOPE_POINT[0]);

// Path samples [x, z, heading, sheet thickness], top down. The heading is the direction of travel in XZ, in degrees; the palm
// side is on its left.
function line_samples(a, b, n, th) = let(h = atan2(b[1] - a[1], b[0] - a[0]))
  [for (i = [1 : n]) [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, h, th]];
function arc_samples(c, r, a0, a1, n, th) = let(turn = a1 > a0 ? 90 : -90)
  [for (i = [1 : n]) let(a = a0 + (a1 - a0) * i / n) [c[0] + r * cos(a), c[1] + r * sin(a), a + turn, th]];
// The bend into the grip: it leaves the slope at R1_START, round a centre on the finger side, into the vertical at x = SEAM_X.
R1_CENTRE = [SEAM_X - SEAM_R1, slope_z(SEAM_X) - SEAM_R1 * tan(22.5)];
R1_START = [R1_CENTRE[0] + SEAM_R1 * cos(45), R1_CENTRE[1] + SEAM_R1 * sin(45)];
// The open tip: 30 mm up for the sheets; for the thick bars the run down from the bend that the sheet's open tip leaves.
OPEN_RUN = 68;
GRIP_TIP_Z = GRIP_END == "floor" ? 0 : GRIP_THICK ? max(0, R1_CENTRE[1] - OPEN_RUN) : 30;
// From the bend down to the tip. At an open tip the last TIP_R of it rounds off in a quarter circle.
TIP_R = SHEET_TH;
function grip_samples() = concat(
  arc_samples(R1_CENTRE, SEAM_R1, 45, 0, 15, SHEET_TH),
  GRIP_END == "floor" ? line_samples([SEAM_X, R1_CENTRE[1]], [SEAM_X, GRIP_TIP_Z], 1, SHEET_TH)
  : concat(line_samples([SEAM_X, R1_CENTRE[1]], [SEAM_X, GRIP_TIP_Z + TIP_R], 1, SHEET_TH),
      [for (i = [1 : 10]) let(d = TIP_R * (1 - i / 10)) [SEAM_X, GRIP_TIP_Z + d, -90, max(0.4, sqrt(TIP_R * TIP_R - (TIP_R - d) * (TIP_R - d)))]]));

// A half's cross-section at thickness `th`, as [u, y]: u from the seam's edges (positive towards the palm), y across the grip, for
// the palm side (side = 1) or the finger side (side = -1). A sheet or a slab has a flat seam face and rounds its outer long edges;
// a round bar is a half-disc of radius CLEARANCE / 2 + th; a bowed sheet is a sector of an annulus about the bow's axis, its
// long edges rounded too.
function sheet_section(th, side) = BOW > 0 ? bow_section(th, side) : GRIP_ROUND ? round_section(th, side) : box_section(th, side);
function round_section(th, side) = let(u0 = CLEARANCE / 2, r = u0 + th, a0 = acos(u0 / r), n = 24)
  [for (i = [0 : n]) let(a = -a0 + 2 * a0 * i / n) [side * r * cos(a), side * r * sin(a)]];
function box_section(th, side) = let(u0 = CLEARANCE / 2, u1 = u0 + th, r = min(EDGE_R, 0.8 * th), w = GRIP_W / 2)
  [for (q = concat([[u0, -w]], [for (i = [0 : 6]) let(a = -90 + 15 * i) [u1 - r + r * cos(a), -w + r + r * sin(a)]],
         [for (i = [0 : 6]) let(a = 15 * i) [u1 - r + r * cos(a), w - r + r * sin(a)]], [[u0, w]])) [side * q[0], side * q[1]]];
// The bowed section: an annular sector about the bow's axis, cut by radial planes at +-BOW_END (where the seam is GRIP_W wide),
// so that its ends are square to the sheet and the two halves' ends are flush; its outer long edges rounded. bow_pt gives the
// point at radius r and angle a about the axis; bow_corner a rounded corner of radius re about c from angle a0 to a1 (the
// short way); bow_seam the seam face's point at y.
BOW_END = BOW > 0 ? asin(GRIP_W / 2 / BOW_R) : 0;
function bow_pt(r, a) = [r * cos(a) - (BOW_R - BOW), r * sin(a)];
function bow_corner(c, re, a0, a1, n) = let(d = ((a1 - a0 + 540) % 360) - 180) [for (i = [0 : n]) [c[0] + re * cos(a0 + d * i / n), c[1] + re * sin(a0 + d * i / n)]];
function bow_seam(rs, y) = [sqrt(rs * rs - y * y) - (BOW_R - BOW), y];
function bow_section(th, side) = let(
    c = CLEARANCE / 2, re = min(EDGE_R, 0.8 * th),
    rs = BOW_R + side * c, ro = rs + side * th,   // the seam face's and the outer face's radius
    rc = ro - side * re, tc = BOW_END - asin(re / rc),   // the corners' centres' radius, and their angle from the middle
    cm = bow_pt(rc, -tc), cp = bow_pt(rc, tc), nc = 5, no = 12, ns = 8)
  side > 0
  ? concat([bow_pt(rs, -BOW_END)], bow_corner(cm, re, -BOW_END - 90, -tc, nc), [for (i = [1 : no - 1]) bow_pt(ro, -tc + 2 * tc * i / no)],
           bow_corner(cp, re, tc, BOW_END + 90, nc), [bow_pt(rs, BOW_END)], [for (i = [1 : ns - 1]) bow_pt(rs, BOW_END - 2 * BOW_END * i / ns)])
  : concat([bow_pt(rs, BOW_END)], bow_corner(cp, re, BOW_END + 90, tc + 180, nc), [for (i = [1 : no - 1]) bow_pt(ro, tc - 2 * tc * i / no)],
           bow_corner(cm, re, 180 - tc, 270 - BOW_END, nc), [bow_pt(rs, -BOW_END)], [for (i = [1 : ns - 1]) bow_pt(rs, -BOW_END + 2 * BOW_END * i / ns)]);

// A half swept along `samples`, on the palm side (side = 1) or the finger side (side = -1) of the seam.
module sheet(samples, side) {
  m = len(sheet_section(1, side));
  points = [for (s = samples, q = sheet_section(s[3], side))
    [s[0] - q[0] * sin(s[2]), q[1], s[1] + q[0] * cos(s[2])]];
  n = len(samples);
  faces = concat(
    [for (i = [0 : n - 2], j = [0 : m - 1]) let(a = i * m, b = (i + 1) * m, k = (j + 1) % m) [a + j, a + k, b + k, b + j]],
    [[for (j = [m - 1 : -1 : 0]) j]], [[for (j = [0 : m - 1]) (n - 1) * m + j]]);
  polyhedron(points, faces, convexity = 4);
}

// ---- The container's handle: the finger-side sheet and its fins. ----
// The sheet starts inside the wall, on the slope's line, where the cavity cuts it back to the wall, and runs down the slope,
// round the bend and down the grip.
FINGER_START = [30, slope_z(30)];
module finger_sheet() {
  // A bowed sheet's middle stands out from the seam, so its start would rise past the lip's top: cut it there.
  intersection() {
    sheet(concat([[FINGER_START[0], FINGER_START[1], -45, SHEET_TH]], line_samples(FINGER_START, R1_START, 1, SHEET_TH), grip_samples()), -1);
    if (BOW > 0) translate([0, -100, -1]) cube([200, 200, RIM_Z + 1]);
  }
}

// A fin in XZ: its lower edge rises at 45 degrees from inside the wall to meet the sheet's underside FIN_REACH out from the
// band; its top runs inside the sheet, 0.5 mm under its seam face, so that it never stands proud of it.
module fin_profile() {
  mx = SLOPE_POINT[0] + FIN_REACH;
  under = slope_z(mx) - SHEET_T * sqrt(2);             // the sheet's underside where the fin meets it
  k = (CLEARANCE / 2 + 0.5) * sqrt(2);                  // the fin's top, below the seam
  xb = mx + (SHEET_T * sqrt(2) - k) / 2;                // where the lower edge meets the top
  x0 = 30;
  polygon([[x0, under - (mx - x0)], [xb, slope_z(xb) - k], [x0, slope_z(x0) - k]]);
}

// The fins, spread evenly across the grip inside its rounded edges (one fin sits in the middle).
module fins() {
  span = GRIP_W / 2 - EDGE_R - SUPPORT_THICKNESS / 2;
  for (i = [0 : SUPPORT_COUNT - 1]) let(y = SUPPORT_COUNT == 1 ? 0 : -span + 2 * span * i / (SUPPORT_COUNT - 1))
    translate([bow_u(y) * sqrt(0.5), y, bow_u(y) * sqrt(0.5)]) rotate([90, 0, 0]) linear_extrude(SUPPORT_THICKNESS, center = true) fin_profile();
}

module handle() { finger_sheet(); if (HANDLE_SHAPE == "sheet" || HANDLE_SHAPE == "curved") fins(); }

// Places children on the middle of each straight side of plan `p`, in the wall's frame (X along the wall, Y outward).
module on_sides(p) {
  for (s = [-1, 1]) {
    translate([s * p[0] / 2, 0, 0]) rotate([0, 0, -s * 90]) children();
    translate([0, s * p[1] / 2, 0]) rotate([0, 0, s > 0 ? 0 : 180]) children();
  }
}

// The groove a bump of engagement `g` clicks into, in the mating wall's frame (the wall's face at Y = 0, the groove going
// towards +Y, into the wall): `g` + clearance deep, clearing the bump by the clearance on every side. Its flanks start 0.3 mm
// in front of the face, so that no edge of it lies in the face.
module groove(l, g) {
  c = CLEARANCE; d = g + c; w = g + c * sqrt(2); o = 0.3;
  hull() {
    translate([-(l / 2 + 2 * c + o), -o, -(w + o)]) cube([l + 4 * c + 2 * o, E, 2 * (w + o)]);
    translate([-(l / 2 + 2 * c - d), d - E, -(w - d)]) cube([l + 4 * c - 2 * d, E, 2 * (w - d)]);
  }
}

// ---- The handle's root pad: on the inside of the front wall, behind the handle's sheet. ----
// The pad is the grip's width and 4 mm each side.
ROOT_PAD_W = GRIP_W + 8;
// The wall's inner face at height z, at the middle of the front (it flares in below BAND_Z).
function front_in(z) = BAND[0] / 2 - (BAND[0] - FLOOR[0]) / 2 * (1 - min(z, BAND_Z) / BAND_Z) - WALL;
// The pad (thinner walls than ROOT_WALL only): d = ROOT_WALL - WALL deep.
module root_pad() {
  d = ROOT_WALL - WALL;
  z0 = ROOT_PAD_Z[0]; z1 = ROOT_PAD_Z[1];
  // A hull of two rounded plates, in a frame whose Z runs along +X from the pad's face: the face's plate and, 0.5 mm into the
  // wall past the inner face at the band, one d + 0.5 larger all round, so that the ends are at 45 degrees and no edge of the pad
  // lies in the wall's face.
  module plate(z, grow_by) translate([front_in(BAND_Z) - d + z, 0, (z0 + z1) / 2]) rotate([0, 90, 0]) linear_extrude(E)
    offset(r = ROOT_PAD_R + grow_by, $fn = 48) square([z1 - z0 - 2 * d - 2 * ROOT_PAD_R + 2 * grow_by, ROOT_PAD_W - 2 * ROOT_PAD_R + 2 * grow_by], center = true);
  if (d > 0) hull() { plate(0, 0); plate(d + 0.5, d + 0.5); }
}

// ---- The dam: on the scraper side only. ----
// Scooping, the shovel is turned over with the scraper side (-X) down, and the clumps already in the container slide towards the
// mouth along that side. The dam holds them back: a sheet under the mouth, as thick as the wall (at most ROOT_WALL), that leaves the back wall at
// DAM_TOP and falls inward at 45 degrees, DAM_WIDTH in from it. It continues the scoop's funnel, so clumps slide off it into the
// bag, and turned over they collect in the pocket between it and the wall. It runs along the back and round both back corners, to
// where the side walls start. Its underside is at 45 degrees too, so it prints standing without support.
// The region over a 45 degree surface through the mouth's wall at z0, falling DAM_WIDTH inward (a frustum over a column); the
// sheet is that region for its underside less the one for its top. Its corners' radius is kept at least 2 mm, so that at the
// corners a wide dam is steeper than 45 degrees rather than folding over.
// Its outlines have 70 segments, not the walls' 64 (nor a multiple of 8, which would put a vertex at 45 degrees, like theirs), so
// that none of its edges runs into one of the mouth's vertices; it ends 0.07 mm past where the mouth's corners end, for the same reason.
function inset(p, d) = [p[0] - 2 * d, p[1] - 2 * d, max(2, p[2] - d)];
module dam_slab(p, z, h = E) { translate([0, 0, z]) linear_extrude(h) offset(r = p[2], $fn = 70) square([p[0] - 2 * p[2], p[1] - 2 * p[2]], center = true); }
module over_slope(z0) {
  up = DAM_T + 1;
  hull() { dam_slab(grow(MOUTH, up), z0 + up); dam_slab(inset(MOUTH, DAM_WIDTH), z0 - DAM_WIDTH); }
  low = DAM_TOP - DAM_WIDTH - 2 * DAM_T - 1;
  dam_slab(inset(MOUTH, DAM_WIDTH), low, z0 - DAM_WIDTH - low + E);
}
// It reaches 1 mm into the wall, and only on the scraper side: the back wall and the back corners, up to where the sides start.
module dam() {
  low = DAM_TOP - DAM_WIDTH - 2 * DAM_T - 1;
  intersection() {
    difference() { over_slope(DAM_TOP - DAM_T); over_slope(DAM_TOP); }
    dam_slab(grow(MOUTH, 1), low, DAM_TOP - low + 1);
    translate([-MOUTH[0] / 2 - 2, -MOUTH[1] / 2 - 2, low]) cube([MOUTH[2] + 2 + 0.07, MOUTH[1] + 4, DAM_TOP - low + 1]);
  }
}

union() {
  difference() {
    union() { outside(); lip(); handle(); }
    inside();
    if (SCOOP_SNAP == "detent") translate([0, 0, DETENT_Z]) on_sides(MOUTH) groove(DETENT_L, SCOOP_DETENT_ENGAGE);
  }
  if (DAM_WIDTH > 0) dam();
  root_pad();
}
