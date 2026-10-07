// Spring ball detent: an original CanFactory design, published under CC BY 4.0.
//
// A printed spring plunger, as Ganter's GN 615: a body with a metric thread on the outside holds a bought steel ball part-way out
// of its nose on a bought compression spring. Screwed into a tapped hole, the ball clicks into a dimple or a hole of the mating
// part: indexing, positioning, or holding a lid or a slide shut until it is pushed past.
//
// The ball goes in from the back and rests on the nose's lip: a 45 degree cone narrows the bore to an opening the ball touches
// LIP_EDGE below the nose face, so that it stands PROTRUSION out. The spring follows it, and the back is closed by a printed press
// cap with crush ribs (RETENTION = "press-cap"), pushed in up to the floor of the tool feature, or by an ISO 4026 set screw in a
// hole tapped from its tap drill (RETENTION = "set-screw"), which sets the preload. The tool feature, a screwdriver slot or a hex
// socket (TOOL_FEATURE), is cut into the back face.
//
// The spring rests on the ball where its end coil's inner edge touches it. With the ball out it is compressed to its installed
// length: a quarter of the way from the shortest allowed (its least length Ln with the ball pushed TRAVEL in) to the longest (free
// length less the least preload). The press cap's face, or the set screw's point at its nominal setting, is that far behind it.
// (packages/contracts/src/springBallDetent.ts, springBallDetentLayout, computes the same, and validates the settings.)
//
// Frame: millimetres, Z along the axis, the back face on z = 0 and the nose at z = BODY_LENGTH: the body prints as generated,
// standing on its back face, nose up; no supports. PART = "cap" generates the press cap, standing, its leading end up.

PART = "body"; //[body,cap]

THREAD = "M10";        //[M6,M8,M10,M12]
PROTRUSION = 0.8;      //[0.2:0.05:3]
TRAVEL = 1;            //[0.2:0.05:6]
RETENTION = "press-cap"; //[press-cap,set-screw]
BODY_LENGTH = 22;      //[8:0.5:40]
TOOL_FEATURE = "slot"; //[slot,hex]
CLEARANCE = 0.3;       //[0.1:0.05:0.6]
THREAD_PLAY = 0.2;     //[0:0.05:0.6]
CAP_INTERFERENCE = 0.2; //[0:0.05:0.5]

// The ball, spring and set screw (from the parts library; see packages/contracts/src/models.ts, springBallDetent): the ball's
// nominal, largest and smallest diameters (ISO 3290-1 G100); the spring's wire, outer diameter, free and least length (Gutekunst
// D-107); the set screw's thread, pitch and length (ISO 4026 M6 x 6).
BALL_D = 4.5;
BALL_MAX = 4.5475;
BALL_MIN = 4.4525;
SPRING_WIRE = 0.63;
SPRING_DE = 4.63;
SPRING_FREE = 9.6;
SPRING_LEAST = 5.28;
SET_D = 6;
SET_PITCH = 1;
SET_L = 6;

// Diagnostic: false leaves the press cap's crush ribs off, to check that only they interfere with the bore
CAP_RIBS = true;
ROUNDNESS = 96; //[48:8:192]

// Fixed rules, mirrored in springBallDetent.ts (DETENT)
WALL = 0.8;
LIP_EDGE = 0.2;
MIN_PRELOAD = 0.3;
MIN_PRELOAD_SHARE = 0.1;
PRELOAD_SHARE = 0.25;
CAP_MIN = 3;
CAP_PLAY = 0.1;
CAP_RIB_COUNT = 6;
CAP_RIB_WIDTH = 0.6;
KEY_PLAY = 0.15;
HEX_KEYS = [1.5, 2, 2.5, 3, 4, 5, 6, 8];
// ISO 261 coarse threads: name, diameter, pitch; and ISO 68-1's depth of an external thread (h3 = 0.61343 P)
THREADS = [["M6", 6, 1], ["M8", 8, 1.25], ["M10", 10, 1.5], ["M12", 12, 1.75]];
THREAD_DEPTH = 0.61343;

T       = THREADS[search([THREAD], THREADS)[0]];
D       = T[1];
P       = T[2];
R_MAJ   = (D - THREAD_PLAY) / 2;
R_MIN   = R_MAJ - THREAD_DEPTH * P;
MAX_HOLE = 2 * R_MIN - 2 * WALL;

L        = BODY_LENGTH;
R        = BALL_D / 2;
BORE     = BALL_MAX + CLEARANCE;
LIP_DROP = R - PROTRUSION - LIP_EDGE;
OPENING  = 2 * sqrt(R * R - LIP_DROP * LIP_DROP);
CONTACT  = L - LIP_EDGE;
CENTRE   = CONTACT - LIP_DROP;
CONE_BOTTOM = CONTACT - (BORE - OPENING) / 2;
INNER    = SPRING_DE - 2 * SPRING_WIRE;
NEST     = sqrt(max(0, R * R - INNER * INNER / 4));
SPRING_TOP = CENTRE - NEST;
PRELOAD  = max(MIN_PRELOAD, MIN_PRELOAD_SHARE * (SPRING_FREE - SPRING_LEAST));
LONGEST  = SPRING_FREE - PRELOAD;
SHORTEST = SPRING_LEAST + TRAVEL;
INSTALLED = SHORTEST + PRELOAD_SHARE * (LONGEST - SHORTEST);
SEAT     = SPRING_TOP - INSTALLED;

PRESS    = RETENTION == "press-cap";
TAP      = SET_D - SET_PITCH;
TAP_TOP  = SPRING_TOP - SHORTEST;
RIBS_D   = BORE + CAP_INTERFERENCE;
CORE_D   = BORE - CAP_PLAY;

// The tool feature: a slot D/5 wide (at least 1.2 mm) and D/4 deep, or a socket for the smallest key that passes what goes in
THROUGH  = PRESS ? RIBS_D : SET_D;
function first_key(i) = i >= len(HEX_KEYS) ? 8 : HEX_KEYS[i] + KEY_PLAY >= THROUGH - 1e-9 ? HEX_KEYS[i] : first_key(i + 1);
KEY      = first_key(0);
ACROSS   = KEY + KEY_PLAY;
SLOT_W   = round(max(1.2, D / 5) * 10) / 10;
TOOL_DEPTH = TOOL_FEATURE == "slot" ? D / 4 : max(2, KEY);
CAP_LENGTH = SEAT - TOOL_DEPTH;

assert(BORE <= MAX_HOLE + 1e-6, "the ball's bore must leave WALL to the thread's root");
assert(SPRING_DE <= BORE + 1e-6, "the spring must fit the ball's bore");
assert(LIP_DROP > 0 && OPENING < BALL_MIN, "the lip must reach over the ball");
assert(LIP_DROP <= OPENING / 2 + 1e-6, "the ball must touch the lip's edge, not its cone");
assert(TRAVEL <= SPRING_FREE - SPRING_LEAST - PRELOAD + 1e-6, "the spring must not go solid at full travel");
assert(!PRESS || CAP_LENGTH >= CAP_MIN - 1e-6, "the press cap must be at least CAP_MIN long");
assert(PRESS || (SET_D <= MAX_HOLE + 1e-6 && TAP >= BORE - 1e-6), "the set screw's hole must leave WALL and pass the ball");
assert(PRESS || SPRING_TOP - LONGEST - SET_L >= TOOL_DEPTH - 1e-6, "the set screw, backed out, must stay below the tool feature");
assert(TOOL_FEATURE == "slot" || ACROSS * 2 / sqrt(3) <= MAX_HOLE + 1e-6, "the hex socket must leave WALL to the thread's root");

// The thread's radius at a fraction u of the pitch from a crest's middle: the crest's flat (P/8), the 60 degree flanks, the root.
FLANK = THREAD_DEPTH / tan(60);
function thread_r(u) = let (a = abs(u - round(u)))
    a <= 1 / 16 ? R_MAJ : a <= 1 / 16 + FLANK ? R_MAJ - (a - 1 / 16) * P * tan(60) : R_MIN;

// The lead-in: a 45 degree chamfer at both ends, from just inside the root (so that the end faces lie within it) to the crest.
// Behind a slot the back is a plain collar at that diameter, as deep as the slot, so that the slot never cuts through thread flanks.
R_END  = R_MIN - 0.2;
COLLAR = TOOL_FEATURE == "slot" ? TOOL_DEPTH : 0;
function envelope_r(z) = min(R_MAJ, R_END + max(0, z - COLLAR), R_END + L - z);

// The threaded body as one polyhedron: rings of ROUNDNESS points, P/48 apart, each at the thread's radius for its angle and height
// (a right-handed thread: a crest's middle at angle a lies a/360 of a pitch up), clamped to the lead-in. Built directly rather than
// intersected with the lead-in, so that no two curved surfaces cross.
module threaded_body() {
    n = ROUNDNESS;
    m = ceil(L / (P / 48));
    points = [for (j = [0 : m]) let (z = L * j / m) for (i = [0 : n - 1])
        let (a = 360 * i / n, r = min(thread_r(i / n - z / P), envelope_r(z))) [r * cos(a), r * sin(a), z]];
    sides = [for (j = [0 : m - 1]) for (i = [0 : n - 1]) let (a = j * n + i, b = (j + 1) * n + i, c = (j + 1) * n + (i + 1) % n, d = j * n + (i + 1) % n)
        each [[a, b, c], [a, c, d]]];
    polyhedron(points = points, faces = concat([[for (i = [0 : n - 1]) i]], sides, [[for (i = [n - 1 : -1 : 0]) m * n + i]]), convexity = 10);
}

// The bore: from the back (the set screw's tap drill, then a 45 degree step to the bore), the ball's bore, the cone to the lip.
module cavity() {
    back = PRESS ? [[BORE / 2, -1]] : [[TAP / 2, -1], [TAP / 2, TAP_TOP], [BORE / 2, TAP_TOP + (TAP - BORE) / 2]];
    rotate_extrude($fn = ROUNDNESS)
        polygon(concat([[0, -1]], back, [[BORE / 2, CONE_BOTTOM], [OPENING / 2, CONTACT], [OPENING / 2, L + 1], [0, L + 1]]));
}

module tool_feature() {
    if (TOOL_FEATURE == "slot") translate([-SLOT_W / 2, -R_MAJ - 1, -1]) cube([SLOT_W, 2 * R_MAJ + 2, TOOL_DEPTH + 1]);
    else translate([0, 0, -1]) cylinder(r = ACROSS / sqrt(3), h = TOOL_DEPTH + 1, $fn = 6);
}

module body() {
    difference() {
        threaded_body();
        cavity();
        tool_feature();
    }
}

// The press cap: a core a little under the bore, with crush ribs that stand out to the bore plus the interference, and a lead-in.
// The ribs overshoot and the envelope trims them, so that no face of theirs lies on the envelope's.
module cap() {
    lead = 0.5;
    intersection() {
        union() {
            cylinder(d = CORE_D, h = CAP_LENGTH, $fn = ROUNDNESS);
            if (CAP_RIBS) for (i = [0 : CAP_RIB_COUNT - 1]) rotate(360 * i / CAP_RIB_COUNT)
                translate([CORE_D / 2 - 0.3, -CAP_RIB_WIDTH / 2, -1]) cube([(RIBS_D - CORE_D) / 2 + 0.6, CAP_RIB_WIDTH, CAP_LENGTH + 2]);
        }
        rotate_extrude($fn = ROUNDNESS)
            polygon([[0, 0], [RIBS_D / 2, 0], [RIBS_D / 2, CAP_LENGTH - lead], [CORE_D / 2 - lead, CAP_LENGTH], [0, CAP_LENGTH]]);
    }
}

if (PART == "cap") cap(); else body();
