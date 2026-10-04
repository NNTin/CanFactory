// Pressure pad: an original CanFactory design, published under CC BY 4.0.
//
// A round printed pad for the end of a metric screw, in place of a bought
// levelling foot. It comes in two kinds:
//
// - "thrust": a nut (from the parts library) is run onto the screw's tip and
//   slid sideways into the pad's round chamber, where it turns freely. The
//   screw pushes the pad out without turning it, so the sole does not scrub
//   the surface it presses on (a clamp turned from the other end).
// - "foot": the screw's hexagon head is slid sideways into a hexagon pocket,
//   so turning the pad by hand turns the screw (a levelling foot or thumbwheel).
//
// An extender (PART = "extender") makes the leg longer than the longest screw:
// a printed sleeve that joins two screws end to end. A nut is locked in a
// hexagon pocket at one end and the next screw's hexagon head in a pocket at
// the other; the first screw is turned into the nut until its tip bears on the
// solid between the pockets, which locks the joint. Extenders stack.
//
// The screw's shank leaves through a slot in the pad's back (the lip), which
// holds the nut or head in. Two small bumps narrow the chamber's mouth to just
// under the nut's or head's width across flats: press it in past them and it
// stays in when the pad hangs loose.
//
// The pad is modelled as it prints: its back (the lip) on the bed at z = 0,
// its sole on top at z = HEIGHT. The extender prints standing, its nut end on the
// bed at z = 0 and its head end at z = EXT_LENGTH. The chamber's floor bridges the chamber; no
// supports are needed. Nothing scales implicitly: every size below is exactly
// the millimetres given.
//
// The sizes of the lip, floor, tip recess, wall and snap bumps are mirrored by
// PRESSURE_PAD in packages/contracts/src/pressurePad.ts (a test compares them).

// ---------------------------------------------------------------

// Which piece to make: the pad, or an extender
PART = "pad"; //[pad,extender]
// What the pad holds: a nut that turns freely in it, or a screw head locked in it
PAD_TYPE = "foot"; //[foot,thrust]
// Outside diameter of the pad
DIAMETER = 32;       //[16:0.5:80]
// Height from the back (against the screw's insert or nut) to the sole
HEIGHT = 24.5;     //[8:0.5:80]
// The sole: flat, concentric grooves with four drain channels, or a low dome
SURFACE = "grooved"; //[flat,grooved,domed]
// Depth of the grooves, or height of the dome (unused when flat)
RELIEF = 1;      //[0.4:0.1:3]
// Length of an extender, end to end
EXT_LENGTH = 40; //[20:0.5:150]
// Play round the nut or head, and round the screw's shank, on each side
FIT = 0.4;      //[0.1:0.05:0.8]

// From the parts library (largest values): the nut for a thrust pad and the extenders...
NUT_D = 8;     // thread diameter
NUT_S = 13;    // width across flats
NUT_H = 8;     // overall height (a nylon-insert nut's h, else m)
// ...and the screw for a foot and the extenders.
SCREW_D = 8;   // thread diameter
SCREW_S = 13;  // head width across flats
SCREW_K = 5.45; // head height

ROUNDNESS = 96; //[48,96,144]

// ---------------------------------------------------------------

// Fixed design sizes (mirrored by PRESSURE_PAD in pressurePad.ts).
LIP     = 3;    // the back over the nut or head
FLOOR   = 3;    // solid between the chamber (or tip recess) and the sole's relief
TIP     = 2;    // recess under a thrust pad's nut for the screw's tip
WALL    = 3;    // least wall round the chamber
SNAP    = 0.15; // each bump narrows the chamber's mouth this much below the flats
CHAMFER = 0.8;  // on the pad's outer edges
// The sole's edge chamfer stops 0.05 mm short of the relief's 0.1 mm steps, so a groove's floor never meets the chamfer's edge.
SOLE_CHAMFER = CHAMFER - 0.05;

THRUST = PAD_TYPE == "thrust";
THREAD_D = THRUST ? NUT_D : SCREW_D;
FLATS    = THRUST ? NUT_S : SCREW_S;
POCKET_H = (THRUST ? NUT_H : SCREW_K) + FIT;
// Shank hole and slot through the lip; chamber slot (as wide as the flats, plus play)
HOLE   = THREAD_D + 2*FIT;
ACROSS = FLATS + 2*FIT;
// Thrust: a round chamber the nut's corners turn in. Foot: a hexagon pocket.
CHAMBER_D = THRUST ? FLATS*2/sqrt(3) + 2*FIT : ACROSS*2/sqrt(3);
RECESS = THRUST ? TIP : 0;
R = DIAMETER/2;
R_RELIEF = SURFACE == "flat" ? 0 : RELIEF;

MIN_HEIGHT   = LIP + POCKET_H + RECESS + FLOOR + R_RELIEF;
MIN_DIAMETER = CHAMBER_D + 2*WALL;
// An extender: the nut's hexagon pocket, a solid floor, the head's hexagon pocket, a lip at each end.
NUT_POCKET  = NUT_H + FIT;
HEAD_POCKET = SCREW_K + FIT;
MIN_EXT_LENGTH   = LIP + NUT_POCKET + FLOOR + HEAD_POCKET + LIP;
MIN_EXT_DIAMETER = (max(NUT_S, SCREW_S) + 2*FIT)*2/sqrt(3) + 2*WALL;
if (PART == "pad") {
    assert(HEIGHT >= MIN_HEIGHT - 1e-6, str("HEIGHT must be at least ", MIN_HEIGHT, " mm for this nut or screw"));
    assert(DIAMETER >= MIN_DIAMETER - 1e-6, str("DIAMETER must be at least ", MIN_DIAMETER, " mm for this nut or screw"));
} else {
    assert(EXT_LENGTH >= MIN_EXT_LENGTH - 1e-6, str("EXT_LENGTH must be at least ", MIN_EXT_LENGTH, " mm for this nut and screw"));
    assert(DIAMETER >= MIN_EXT_DIAMETER - 1e-6, str("DIAMETER must be at least ", MIN_EXT_DIAMETER, " mm for this nut and screw"));
}

// Grooves: as wide as they are deep (at least 1.2 mm), 2.5 widths apart.
GROOVE_W = max(1.2, RELIEF);
GROOVE_PITCH = 2.5*GROOVE_W;
GROOVE_RADII = [for (r = [R - CHAMFER - GROOVE_PITCH/2 : -GROOVE_PITCH : GROOVE_W]) r];

$fn = ROUNDNESS;

module body() {
    if (SURFACE == "domed") {
        // a spherical cap of height RELIEF over the whole sole
        // a spherical cap of radius rs: its arc from the rim (r = R) to the top of the pad on the axis
        rs = (R*R + RELIEF*RELIEF) / (2*RELIEF);
        steps = ceil(ROUNDNESS/4);
        arc = [for (i = [0 : steps]) let (r = R*(1 - i/steps)) [r, HEIGHT - rs + sqrt(rs*rs - r*r)]];
        rotate_extrude() polygon(concat([[0, 0], [R - CHAMFER, 0], [R, CHAMFER]], arc));
    } else {
        rotate_extrude() polygon([[0, 0], [R - CHAMFER, 0], [R, CHAMFER], [R, HEIGHT - SOLE_CHAMFER], [R - SOLE_CHAMFER, HEIGHT], [0, HEIGHT]]);
    }
}

// A pocket in plan for a nut or head `flats` across: round (it turns) or a hexagon (it is locked), and the slot it is entered
// by along +X.
module pocket_plan(flats, round) {
    across = flats + 2*FIT;
    if (round) circle(d = flats*2/sqrt(3) + 2*FIT);
    else circle(r = across/sqrt(3), $fn = 6); // flats at y = ±across/2, in line with the slot
    difference() {
        translate([0, -across/2]) square([R + 1, across]);
        // the snap bumps: the mouth's last 2 mm are narrower than the flats
        for (s = [-1, 1]) translate([R - 2, s > 0 ? flats/2 - SNAP : -across/2 - 0.01]) square([3, across/2 - flats/2 + SNAP + 0.01]);
    }
}
module chamber_plan() { pocket_plan(FLATS, THRUST); }

// The shank's hole and its slot out along +X, through a lip.
module shank_plan(d) {
    circle(d = d + 2*FIT);
    translate([0, -(d + 2*FIT)/2]) square([R + 1, d + 2*FIT]);
}

module sole_relief() {
    if (SURFACE == "grooved") translate([0, 0, HEIGHT - RELIEF]) linear_extrude(RELIEF + 1) union() {
        for (r = GROOVE_RADII) difference() { circle(r = r + GROOVE_W/2); circle(r = r - GROOVE_W/2); }
        // four drain channels out to the rim, so water does not stand in the rings
        for (a = [45, 135, 225, 315]) rotate(a) translate([0, -GROOVE_W/2]) square([R + 1, GROOVE_W]);
    }
}

module pad() {
    difference() {
        body();
        // the shank: a hole and its slot out through the lip
        translate([0, 0, -1]) linear_extrude(LIP + 1.01) shank_plan(THREAD_D);
        translate([0, 0, LIP]) linear_extrude(POCKET_H) chamber_plan();
        // a thrust pad's tip recess under the nut
        if (THRUST) translate([0, 0, LIP + POCKET_H - 0.01]) cylinder(d = HOLE, h = TIP + 0.01);
        sole_relief();
    }
}

// The extender: the nut end on the bed, the head end on top; both pockets and slots open along +X.
module extender() {
    L = EXT_LENGTH;
    difference() {
        rotate_extrude() polygon([[0, 0], [R - CHAMFER, 0], [R, CHAMFER], [R, L - CHAMFER], [R - CHAMFER, L], [0, L]]);
        translate([0, 0, -1]) linear_extrude(LIP + 1.01) shank_plan(NUT_D);
        translate([0, 0, LIP]) linear_extrude(NUT_POCKET) pocket_plan(NUT_S, false);
        translate([0, 0, L - LIP - HEAD_POCKET]) linear_extrude(HEAD_POCKET) pocket_plan(SCREW_S, false);
        translate([0, 0, L - LIP - 0.01]) linear_extrude(LIP + 1.01) shank_plan(SCREW_D);
    }
}

if (PART == "extender") extender(); else pad();
