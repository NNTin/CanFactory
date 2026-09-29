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
// Where the grip ends: open, 30 mm above the floor (the slicer supports its tip), or down on the floor (no support needed)
GRIP_END = "open"; //[open,floor]
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
// a thin wall does not make its anchor weak. The pad is ROOT_PAD_W wide, spans ROOT_PAD_Z, and has 45 degree ends and
// underside, so it needs no support.
ROOT_WALL = 2.4; ROOT_PAD_W = 34; ROOT_PAD_Z = [124, 136];
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

// ---- The grip's two sheets: identical in container.scad and handle.scad. ----
// The grip is two thin curved sheets, one on each side of a seam, the container's on the finger side and the handle part's on
// the palm side. Stacked, they make one strip: the same width, their seam faces flat and CLEARANCE apart, their outer long
// edges rounded, and at the open tip each outer corner rounded, so that the pair ends in one half-round. The seam, in the
// container's frame (XZ), runs from the top down: at the handle part's end, up the ring's outer face; a bend of SEAM_R2 into a
// 45 degree slope through SLOPE_POINT (2.5 mm under the lip's chamfer, on the band); a bend of SEAM_R1 into the grip, vertical
// at x = SEAM_X, down to its tip. Each sheet runs from CLEARANCE / 2 to SHEET_T off the seam, so its outer face does not
// depend on the clearance.
GRIP_W = 26; SHEET_T = 3; EDGE_R = 2.5;
SEAM_X = 65; SEAM_R1 = 15; SEAM_R2 = 10; SLOPE_POINT = [37.25, 132];
GRIP_TIP_Z = GRIP_END == "floor" ? 0 : 30;
SHEET_TH = SHEET_T - CLEARANCE / 2;
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
// From the bend down to the tip. At an open tip the last TIP_R of it rounds off in a quarter circle.
TIP_R = SHEET_TH;
function grip_samples() = concat(
  arc_samples(R1_CENTRE, SEAM_R1, 45, 0, 15, SHEET_TH),
  GRIP_END == "floor" ? line_samples([SEAM_X, R1_CENTRE[1]], [SEAM_X, GRIP_TIP_Z], 1, SHEET_TH)
  : concat(line_samples([SEAM_X, R1_CENTRE[1]], [SEAM_X, GRIP_TIP_Z + TIP_R], 1, SHEET_TH),
      [for (i = [1 : 10]) let(d = TIP_R * (1 - i / 10)) [SEAM_X, GRIP_TIP_Z + d, -90, max(0.4, sqrt(TIP_R * TIP_R - (TIP_R - d) * (TIP_R - d)))]]));

// A sheet's cross-section at thickness `th`, as [u, y]: u from the seam (positive towards the palm), y across the grip. Its
// seam face is flat and its outer long edges are rounded.
function sheet_section(th) = let(u0 = CLEARANCE / 2, u1 = u0 + th, r = min(EDGE_R, 0.8 * th), w = GRIP_W / 2)
  concat([[u0, -w]], [for (i = [0 : 6]) let(a = -90 + 15 * i) [u1 - r + r * cos(a), -w + r + r * sin(a)]],
         [for (i = [0 : 6]) let(a = 15 * i) [u1 - r + r * cos(a), w - r + r * sin(a)]], [[u0, w]]);

// A sheet swept along `samples`, on the palm side (side = 1) or the finger side (side = -1) of the seam.
module sheet(samples, side) {
  m = len(sheet_section(1));
  points = [for (s = samples, q = sheet_section(s[3])) let(u = side * q[0])
    [s[0] - u * sin(s[2]), side * q[1], s[1] + u * cos(s[2])]];
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
  sheet(concat([[FINGER_START[0], FINGER_START[1], -45, SHEET_TH]], line_samples(FINGER_START, R1_START, 1, SHEET_TH), grip_samples()), -1);
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
    translate([0, y, 0]) rotate([90, 0, 0]) linear_extrude(SUPPORT_THICKNESS, center = true) fin_profile();
}

module handle() { finger_sheet(); fins(); }

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
// The wall's inner face at height z, at the middle of the front (it flares in below BAND_Z).
function front_in(z) = BAND[0] / 2 - (BAND[0] - FLOOR[0]) / 2 * (1 - min(z, BAND_Z) / BAND_Z) - WALL;
// Its section in XZ: from the inner face, d deep with 45 degree ends, 1 mm into the wall (thinner walls than ROOT_WALL only).
module root_pad() {
  d = ROOT_WALL - WALL;
  z0 = ROOT_PAD_Z[0]; z1 = ROOT_PAD_Z[1];
  if (d > 0) intersection() {
    rotate([90, 0, 0]) linear_extrude(ROOT_PAD_W + 2 * d, center = true) polygon([
      [front_in(z0), z0], [front_in(z0 + d) - d, z0 + d], [front_in(BAND_Z) - d, BAND_Z], [front_in(z1 - d) - d, z1 - d],
      [front_in(z1), z1], [front_in(z1) + 1, z1], [front_in(z0) + 1, z0]]);
    // the plan's own 45 degree ends: the pad is ROOT_PAD_W wide at its face and d wider at the inner face
    xf = front_in(BAND_Z); w = ROOT_PAD_W / 2;
    translate([0, 0, z0 - 1]) linear_extrude(z1 - z0 + 2) polygon([
      [xf - d - 1, -w], [xf - d, -w], [xf + 1, -(w + d + 1)], [xf + 1, w + d + 1], [xf - d, w], [xf - d - 1, w]]);
  }
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
// Its outlines have 72 segments, not the walls' 64, so that none of its edges runs into one of the mouth's vertices.
function inset(p, d) = [p[0] - 2 * d, p[1] - 2 * d, max(2, p[2] - d)];
module dam_slab(p, z, h = E) { translate([0, 0, z]) linear_extrude(h) offset(r = p[2], $fn = 72) square([p[0] - 2 * p[2], p[1] - 2 * p[2]], center = true); }
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
    translate([-MOUTH[0] / 2 - 2, -MOUTH[1] / 2 - 2, low]) cube([MOUTH[2] + 2, MOUTH[1] + 4, DAM_TOP - low + 1]);
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
