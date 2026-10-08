// Printed corner bracket: an original CanFactory design, published under CC BY 4.0.
//
// A flat L-shaped plate screwed across the corner of a timber frame, one leg on each member, so that the corner cannot open or
// rack: the printed counterpart of a bought flat corner bracket (Stuhlwinkel). The window catio's insert has one across each
// corner of its collar, let in flush on the room-side face.
//
// Geometry: the outer corner at the origin, leg A along +X, leg B along +Y, both WIDTH wide; the plate's back (against the
// timber) on z = 0, its face at z = THICKNESS. It prints as it lies, back down, with no supports. Each leg has HOLES_PER_LEG
// holes, HOLE_SPACING apart, the first FIRST_HOLE from the outer corner (along the leg). HOLE_LAYOUT "staggered" (the default)
// puts every other hole a sixth of the width either side of the leg's middle line, the first towards its inner edge, so that the
// screws do not line up along the timber's grain and split it; "straight" puts them all on the middle line. Each hole is the
// chosen wood screw's clearance hole, countersunk from the face so that its head sits flush.
//
// Nothing scales implicitly: every size is exactly the millimetres given. The defaults follow the catio insert's 40 mm collar
// member (packages/contracts/src/printedCornerBracket.ts, printedCornerBracketFor): 100 mm legs, 20 mm wide, 5 mm thick, three
// holes 20 mm apart on the part of each leg past the joint, staggered.

// Facets around a full circle.
ROUNDNESS = 64; //[32:8:192]

LEG_A = 100;          //[40:1:250]
LEG_B = 100;          //[40:1:250]
WIDTH = 20;           //[10:0.5:40]
THICKNESS = 5;        //[3:0.5:10]
HOLES_PER_LEG = 3;    //[1:1:5]
HOLE_SPACING = 20;    //[8:0.5:80]
FIRST_HOLE = 50;      //[10:0.5:240]
HOLE_LAYOUT = "staggered"; //[staggered,straight]

// The wood screw (DIN 7997, from the parts library; see packages/contracts/src/models.ts, printedCornerBracket): its clearance
// holes (fine, medium, coarse: d + 0.3 / 0.5 / 0.8 mm, DIN EN 20273's allowances for M4 and M5), diameter and head.
HOLE_FIT = "medium"; //[fine,medium,coarse]
WOOD_HOLES = [4.3,4.5,4.8];
WOOD_D = 4;
WOOD_DK = 7.5;
WOOD_K = 2.2;
SINK_PLAY = 0.4;

// Rounding of the plate's outer corners, seen from above.
EDGE_RADIUS = 1;

FIT     = HOLE_FIT == "fine" ? 0 : HOLE_FIT == "coarse" ? 2 : 1;
HOLE_D  = WOOD_HOLES[FIT];
SINK_D  = WOOD_DK + SINK_PLAY;
// the head's cylindrical rim above its 90 degree cone (0 for a pure cone)
SINK_RIM = max(0, WOOD_K - (WOOD_DK - WOOD_D) / 2);

assert(THICKNESS >= WOOD_K + 1 - 1e-6, "THICKNESS must leave 1 mm of hole under the screw's countersunk head");
assert(WIDTH >= SINK_D + 3 - 1e-6, "WIDTH must leave 1.5 mm round the countersinks");
// how far a hole lies off the leg's middle line (packages/contracts/src/printedCornerBracket.ts, printedCornerBracketStagger)
STAGGER = HOLE_LAYOUT == "staggered" && HOLES_PER_LEG > 1 ? WIDTH / 6 : 0;
assert(WIDTH / 2 - STAGGER >= SINK_D / 2 + 1.5 - 1e-6, "staggered, WIDTH must leave 1.5 mm round the countersinks on the leg's thirds");
LAST_HOLE = FIRST_HOLE + (HOLES_PER_LEG - 1) * HOLE_SPACING;
assert(LAST_HOLE + SINK_D / 2 + 1.5 <= min(LEG_A, LEG_B) + 1e-6, "the holes must lie on the legs");
assert(FIRST_HOLE - SINK_D / 2 - 1.5 >= WIDTH - 1e-6, "the first hole must lie past the corner square");

module outline() {
    offset(r = EDGE_RADIUS, $fn = 24) offset(delta = -EDGE_RADIUS)
        union() { square([LEG_A, WIDTH]); square([WIDTH, LEG_B]); }
}

module screw_hole() {
    translate([0, 0, -1]) cylinder(d = HOLE_D, h = THICKNESS + 2, $fn = ROUNDNESS);
    // the head's rim, then a 90 degree cone from SINK_D down to the hole; the rim overshoots the face by 0.5 mm
    translate([0, 0, THICKNESS - SINK_RIM]) cylinder(d = SINK_D, h = SINK_RIM + 0.5, $fn = ROUNDNESS);
    translate([0, 0, THICKNESS - SINK_RIM - SINK_D / 2 + 0.01]) cylinder(d1 = 0, d2 = SINK_D, h = SINK_D / 2, $fn = ROUNDNESS);
}

difference() {
    linear_extrude(THICKNESS) outline();
    for (i = [0 : HOLES_PER_LEG - 1]) {
        along = FIRST_HOLE + i * HOLE_SPACING;
        across = WIDTH / 2 + (i % 2 == 0 ? STAGGER : -STAGGER);
        translate([along, across, 0]) screw_hole();
        translate([across, along, 0]) screw_hole();
    }
}
