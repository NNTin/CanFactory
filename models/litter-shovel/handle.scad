// Litter shovel, part 3 of 3: the handle. An original CanFactory design, published under CC BY 4.0.
//
// The top of the stack container, scoop, handle: a closed ring that comes down around the base of the scoop's blade and sits
// flat on the scoop's cap, flush with its skirt, and the palm side of the shovel's grip. The grip is a thin curved sheet: it
// runs down the ring's outer face and past the skirt, bends out down a 45 degree slope over the container's own handle, and
// runs straight down along it. The container's sheet is the finger side, this one the palm side, and stacked they make one
// strip. Held in the fist, they clamp the container to the handle, with the scoop's cap between the container's lip and the
// ring (docs/litter-shovel.md).
//
// Modelled as it prints: upside down, the ring's top on the bed at Z = 0, so that the sheet rises from it, outward at 45
// degrees along the slope, then straight up; nothing needs support. In use it is turned over (the assembly's pose), and the
// ring's underside sits on the scoop's cap at Z = 144.5 in the container's frame. In `detent` mode grooves in the ring take the
// bumps on the blade's base. With a HANDLE_REINFORCEMENT, a boss either side of the grip holds a threaded insert or a nut for a
// countersunk screw driven from inside the scoop.

// How the ring holds on the blade's base: a close fit only, or a detent (bumps on the blade, grooves in the ring)
HANDLE_SNAP = "detent"; //[friction,detent]
// Gap per side between mating surfaces, in mm
CLEARANCE = 0.2; //[0.1:0.01:0.6]
// How far the blade's bumps reach past the ring's wall, in mm, on top of the clearance
HANDLE_DETENT_ENGAGE = 0.15; //[0.02:0.01:0.4]
// Where the grip ends: open, above the floor, or down on the floor (matching the container's handle)
GRIP_END = "open"; //[open,floor]
// The grip's shape (matching the container's handle): a thin sheet, the same curved out, a round tube or a rectangular bar
HANDLE_SHAPE = "sheet"; //[sheet,curved,round,rectangular]
// How far the curved grip's middle bulges towards the palm past its edges, in mm
GRIP_BULGE = 3; //[0:0.5:6]
// The round grip's diameter, or the rectangular grip's depth, in mm
GRIP_SIZE = 14; //[10:1:24]
// Whether two countersunk screws, driven from inside the scoop, also fasten the ring: none, into threaded inserts or into nuts
HANDLE_REINFORCEMENT = "none"; //[none,threaded-insert,nut-bolt]
// The screws' clearance hole (ISO 273 medium for their thread) and length (a countersunk screw's includes its head), in mm
SCREW_HOLE = 3.4;
SCREW_L = 12;
// The threaded inserts' hole diameter, least hole depth and least wall around the hole, in mm (CNC Kitchen M3 x 5.7)
INSERT_HOLE = 4;
INSERT_DEPTH = 6.7;
INSERT_WALL = 1.6;
// The nuts' greatest width across flats and height, in mm, and shape (ISO 4032 M3)
NUT_S = 5.5;
NUT_H = 2.4;
NUT_SHAPE = "hex";

$fa = 4; $fs = 0.5;
E = 0.01;

// The scoop's cap (its skirt's outer face, which the ring is flush with) and its blade's outer face (scoop.scad), as outer plans
// [width (X), length (Y), corner radius]; the cap's top, in the container's frame.
CAP_OUT = [88.9, 121.2, 21.2];
BLADE = [81.7, 114, 17.6];
CAP_TOP_Z = 144.5;
// Ring height.
RING_H = 15;
// Detent grooves: 4 mm up the ring, facing the blade's bumps; their length along the wall.
DETENT_Z = 4; DETENT_L = 16;
// The screws: either side of the grip (+X), FASTENER_Z up the ring; the blade's wall under the heads (a pad makes it that thick, whatever the blade's), whose inner face they are flush with.
// A nut's pocket is NUT_PLAY wider than the nut and NUT_RECESS deeper; the boss keeps NUT_WALL round it, and at least BOSS_WALL
// round the clearance hole.
FASTENER_Y = 21; FASTENER_Z = 8; FASTENER_WALL = 3.2;
NUT_PLAY = 0.2; NUT_RECESS = 0.2; NUT_WALL = 1.2; BOSS_WALL = 1.2;

function grow(p, d) = [p[0] + 2 * d, p[1] + 2 * d, p[2] + d];
module rr2d(p) { offset(r = p[2], $fn = 64) square([p[0] - 2 * p[2], p[1] - 2 * p[2]], center = true); }
module slab(p, z, h) { translate([0, 0, z]) linear_extrude(h) rr2d(p); }

RING_IN = grow(BLADE, CLEARANCE);
RING_TOP_Z = CAP_TOP_Z + RING_H;

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

// ---- The handle part's grip: the palm-side sheet. ----
// Along the ring's outer face and down past the skirt, its inner face CLEARANCE clear of the skirt; then the bend of SEAM_R2
// into the slope, whose line the container's sheet shares; then the shared bend and grip.
SEAM_X_TOP = CAP_OUT[0] / 2 + CLEARANCE / 2;
R2_CENTRE = [SEAM_X_TOP + SEAM_R2, slope_z(SEAM_X_TOP) + SEAM_R2 * tan(22.5)];
module palm_sheet() {
  sheet(concat([[SEAM_X_TOP, RING_TOP_Z, -90, SHEET_TH]], line_samples([SEAM_X_TOP, RING_TOP_Z], [SEAM_X_TOP, R2_CENTRE[1]], 1, SHEET_TH),
               arc_samples(R2_CENTRE, SEAM_R2, 180, 225, 10, SHEET_TH),
               line_samples([R2_CENTRE[0] + SEAM_R2 * cos(225), R2_CENTRE[1] + SEAM_R2 * sin(225)], R1_START, 1, SHEET_TH),
               grip_samples()), 1);
}

// The grip: the sheet, and a root that joins it to the ring's outer face over the ring's height.
module grip() {
  palm_sheet();
  translate([CAP_OUT[0] / 2 - 1, -GRIP_W / 2, CAP_TOP_Z]) cube([1 + CLEARANCE + 0.5, GRIP_W, RING_H]);
  // A bowed sheet's middle stands off the ring's face: fill the space behind it over the ring's height, 0.5 mm into the sheet.
  if (BOW > 0) translate([0, 0, CAP_TOP_Z]) linear_extrude(RING_H)
    polygon(concat([[CAP_OUT[0] / 2 - 1, -GRIP_W / 2]], [for (i = [0 : 12]) let(y = -GRIP_W / 2 + GRIP_W * i / 12) [SEAM_X_TOP + bow_seam(BOW_R + CLEARANCE / 2 + 0.5, y)[0], y]], [[CAP_OUT[0] / 2 - 1, GRIP_W / 2]]));
}

// ---- The reinforcement: a boss either side of the grip, holding an insert or a nut for a screw from inside the scoop. ----
// The screw's head is flush with the blade's inner face, so its tip is SCREW_L out from it; the boss's face is there too. The
// boss is round about the screw's axis and runs straight up to the ring's top, which is on the print bed: nothing overhangs.
IS_SQUARE_NUT = NUT_SHAPE[0] == "s";   // "square" or "square-thin"; the others are hexagonal
NUT_R = NUT_S / (IS_SQUARE_NUT ? sqrt(2) : sqrt(3)) + NUT_PLAY / 2;
BOSS_R = max(SCREW_HOLE / 2 + BOSS_WALL, HANDLE_REINFORCEMENT == "threaded-insert" ? INSERT_HOLE / 2 + INSERT_WALL : NUT_R + NUT_WALL);
BLADE_IN_X = BLADE[0] / 2 - FASTENER_WALL;
BOSS_FACE = BLADE_IN_X + SCREW_L;
RING_OUT_X = CAP_OUT[0] / 2;
FASTENER_ZC = CAP_TOP_Z + FASTENER_Z;

// Places children on each screw's axis, turned so that their Z runs outward (+X).
module on_fasteners() { for (s = [-1, 1]) translate([0, s * FASTENER_Y, FASTENER_ZC]) rotate([0, 90, 0]) children(); }

module bosses() {
  for (s = [-1, 1]) hull() {
    translate([RING_OUT_X - 1, s * FASTENER_Y, FASTENER_ZC]) rotate([0, 90, 0]) cylinder(r = BOSS_R, h = BOSS_FACE - RING_OUT_X + 1, $fn = 48);
    translate([RING_OUT_X - 1, s * FASTENER_Y - BOSS_R, FASTENER_ZC]) cube([BOSS_FACE - RING_OUT_X + 1, 2 * BOSS_R, RING_TOP_Z - FASTENER_ZC]);
  }
}

// The clearance hole through the ring, and the insert's hole or the nut's pocket from the boss's face. A hexagonal pocket has its
// corners at the sides and its flats top and bottom; a square one is upright. Both open outward, so the nut goes in from outside
// and the screw's pull presses it on the pocket's floor.
module fastener_cuts() {
  on_fasteners() {
    translate([0, 0, RING_IN[0] / 2 - 1]) cylinder(d = SCREW_HOLE, h = BOSS_FACE - RING_IN[0] / 2 + 2, $fn = 48);
    if (HANDLE_REINFORCEMENT == "threaded-insert")
      translate([0, 0, BOSS_FACE - INSERT_DEPTH]) cylinder(d = INSERT_HOLE, h = INSERT_DEPTH + 1, $fn = 48);
    else
      translate([0, 0, BOSS_FACE - NUT_RECESS - NUT_H]) rotate([0, 0, IS_SQUARE_NUT ? 45 : 30]) cylinder(r = NUT_R, h = NUT_H + NUT_RECESS + 1, $fn = IS_SQUARE_NUT ? 4 : 6);
  }
}

// The handle in the container's frame, as used.
module handle() {
  difference() {
    union() {
      slab(CAP_OUT, CAP_TOP_Z, RING_H);
      grip();
      if (HANDLE_REINFORCEMENT != "none") bosses();
    }
    slab(RING_IN, CAP_TOP_Z - 1, RING_H + 2);
    if (HANDLE_SNAP == "detent") translate([0, 0, CAP_TOP_Z + DETENT_Z]) on_sides(RING_IN) groove(DETENT_L, HANDLE_DETENT_ENGAGE);
    if (HANDLE_REINFORCEMENT != "none") fastener_cuts();
  }
}

// Turned over to print: the ring's top on the bed.
rotate([180, 0, 0]) translate([0, 0, -RING_TOP_Z]) handle();
