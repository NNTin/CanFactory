// Printed insect-screen hook: an original CanFactory design, published under CC BY 4.0.
//
// A hook that hangs a screen frame (the window catio's insert) on a tilt-and-turn window's fixed frame, without drilling: its leg
// is screwed to the back of the frame's stile, where the stile lies over the window opening; a turn runs into the window just
// inside the fixed frame's outer lip; and a barb reaches behind the lip, in the seal gap in front of the closed sash, so the sash
// still closes over it. It is generated for one window: the barb stands where the lip's thickness (FRAME_LIP) and the seal gap
// (SEAL_GAP) put it, centred in the gap, so nothing is bent on site.
//
// Two parts: the long hook for the head (its barb up behind the head lip) and the short one for the sill (barb down behind the
// sill lip, the same hook turned over). The short barb rises ENGAGE + CLEARANCE past the turn: it reaches ENGAGE behind the sill
// lip with its turn CLEARANCE off the lip's tip. To hang the frame it is lifted that much, so the long hooks' turns stand that
// and CLEARANCE more below the head lip's tip, and their barbs rise ENGAGE past the tip from there:
// 2 x (ENGAGE + CLEARANCE) past the turn (packages/contracts/src/printedScreenHook.ts, printedScreenHookShape).
//
// Section, in X and Y, extruded WIDTH along Z: X from the leg's face on the stile (x = 0) into the window; Y along the stile from
// the turn's outer face (y = 0, towards the lip's tip) away from the leg: the leg runs to y = -LEG_LENGTH, the barb rises to +y.
// It prints as generated, lying on its side (z = 0) with the section on the bed, so the layers run along the barb and the turn
// and no supports are needed. The leg's holes run across it (along X), countersunk on its inner face (x = LEG_THICKNESS): the
// screws go in from the room side into the stile. A fillet (gusset) stiffens the leg's corner with the turn.
//
// One screw (SCREW_COUNT = 1, the default) or two. One sits just past the fillet, as near the turn as its countersink allows:
// the barb's pull acts close to it and the leg's tail bears on the stile against prying, and, eased, the hook turns on it, to be
// set square while fitting or swung aside, its barb down clear of the lip. Two (the second near the leg's end) hold it square.

// Which hook: the long one (head) or the short one (sill)
PART = "long"; //[long,short]

// The window: the fixed frame's lip, from its outer face to its back (where its seal is), and the gap from there to the closed sash
FRAME_LIP = 15.5; //[5:0.5:35]
SEAL_GAP = 3.5;   //[1:0.5:10]
// How far both barbs reach behind the lip once hung, and how far the short hooks' turns stand off the sill lip's tip
ENGAGE = 6;       //[3:0.5:15]
CLEARANCE = 1;    //[0.5:0.5:3]

WIDTH = 10;          //[8:0.5:20]
LEG_LENGTH = 40;     //[25:1:80]
LEG_THICKNESS = 4;   //[2.5:0.5:8]
TURN_THICKNESS = 4;  //[2.5:0.5:8]
BARB_THICKNESS = 2;  //[1.2:0.1:4]
// Screws through the leg: one (the hook turns on it) or two (held square)
SCREW_COUNT = 1;     //[1:1:2]

// The wood screw (DIN 7997, from the parts library; see packages/contracts/src/models.ts, printedScreenHook): its clearance holes
// (fine, medium, coarse: d + 0.3 / 0.5 / 0.8 mm), diameter and head.
HOLE_FIT = "medium"; //[fine,medium,coarse]
WOOD_HOLES = [3.3,3.5,3.8];
WOOD_D = 3;
WOOD_DK = 5.6;
WOOD_K = 1.65;
SINK_PLAY = 0.4;

ROUNDNESS = 64; //[32:8:192]

// Fixed sizes, mirrored in printedScreenHook.ts: the largest fillet, the material round a countersink, the barb's least gap
GUSSET_MAX = 3;
SINK_WALL = 1.5;
GAP = 0.5;

FIT      = HOLE_FIT == "fine" ? 0 : HOLE_FIT == "coarse" ? 2 : 1;
HOLE_D   = WOOD_HOLES[FIT];
SINK_D   = WOOD_DK + SINK_PLAY;
SINK_RIM = max(0, WOOD_K - (WOOD_DK - WOOD_D) / 2);

FRONT  = FRAME_LIP + (SEAL_GAP - BARB_THICKNESS) / 2;
BACK   = FRONT + BARB_THICKNESS;
SHORT_RISE = ENGAGE + CLEARANCE;
RISE   = PART == "long" ? ENGAGE + SHORT_RISE + CLEARANCE : SHORT_RISE;
GUSSET = max(0, min(GUSSET_MAX, FRONT - LEG_THICKNESS - 0.5));
SINK   = SINK_D / 2 + SINK_WALL;
FIRST  = -(TURN_THICKNESS + GUSSET + SINK);
HOLES  = SCREW_COUNT == 1 ? [FIRST] : [FIRST, -(LEG_LENGTH - SINK)];

assert(BARB_THICKNESS + 2 * GAP <= SEAL_GAP + 1e-6, "the barb must leave GAP each side in the seal gap");
assert(FRONT - LEG_THICKNESS >= 1 - 1e-6, "the turn must reach on from the leg to the barb");
assert(LEG_THICKNESS >= WOOD_K + 1 - 1e-6, "LEG_THICKNESS must leave 1 mm of hole under the screw's countersunk head");
assert(WIDTH >= SINK_D + 2 * SINK_WALL - 1e-6, "WIDTH must leave SINK_WALL round the countersinks");
assert(SCREW_COUNT == 1 || SCREW_COUNT == 2, "SCREW_COUNT must be 1 or 2");
assert(SCREW_COUNT != 1 || LEG_LENGTH >= -2 * FIRST - 1e-6, "with one screw the leg must run on past it as far as it stands from the turn");
assert(SCREW_COUNT != 2 || HOLES[0] - HOLES[1] >= 2 * SINK - 1e-6, "the leg must be long enough for two screws");

module section() {
    polygon([
        [0, -LEG_LENGTH], [LEG_THICKNESS, -LEG_LENGTH], [LEG_THICKNESS, -TURN_THICKNESS - GUSSET],
        [LEG_THICKNESS + GUSSET, -TURN_THICKNESS], [BACK, -TURN_THICKNESS], [BACK, RISE], [FRONT, RISE], [FRONT, 0], [0, 0],
    ]);
}

module screw_hole() {
    rotate([0, 90, 0]) {
        translate([0, 0, -1]) cylinder(d = HOLE_D, h = LEG_THICKNESS + 2, $fn = ROUNDNESS);
        // the head's rim, then a 90 degree cone from SINK_D down to the hole; the rim overshoots the inner face by 0.5 mm
        translate([0, 0, LEG_THICKNESS - SINK_RIM]) cylinder(d = SINK_D, h = SINK_RIM + 0.5, $fn = ROUNDNESS);
        translate([0, 0, LEG_THICKNESS - SINK_RIM - SINK_D / 2 + 0.01]) cylinder(d1 = 0, d2 = SINK_D, h = SINK_D / 2, $fn = ROUNDNESS);
    }
}

difference() {
    linear_extrude(WIDTH) section();
    for (y = HOLES) translate([0, y, WIDTH / 2]) screw_hole();
}
