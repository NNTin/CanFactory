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
// bumps on the blade's base.

// How the ring holds on the blade's base: a close fit only, or a detent (bumps on the blade, grooves in the ring)
HANDLE_SNAP = "detent"; //[friction,detent]
// Gap per side between mating surfaces, in mm
CLEARANCE = 0.2; //[0.1:0.01:0.6]
// How far the blade's bumps reach past the ring's wall, in mm, on top of the clearance
HANDLE_DETENT_ENGAGE = 0.15; //[0.02:0.01:0.4]
// Where the grip ends: open, 30 mm above the floor, or down on the floor (matching the container's handle)
GRIP_END = "open"; //[open,floor]

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
}

// The handle in the container's frame, as used.
module handle() {
  difference() {
    union() {
      slab(CAP_OUT, CAP_TOP_Z, RING_H);
      grip();
    }
    slab(RING_IN, CAP_TOP_Z - 1, RING_H + 2);
    if (HANDLE_SNAP == "detent") translate([0, 0, CAP_TOP_Z + DETENT_Z]) on_sides(RING_IN) groove(DETENT_L, HANDLE_DETENT_ENGAGE);
  }
}

// Turned over to print: the ring's top on the bed.
rotate([180, 0, 0]) translate([0, 0, -RING_TOP_Z]) handle();
