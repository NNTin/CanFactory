// Wand holder: an original CanFactory design, published under CC BY 4.0.
//
// A holder for a cat's feather or spring wand toy that snaps onto a scratching post from the side, at any height: a C-shaped
// spring clip round the post, and an upright socket at its back that holds the wand's rigid handle end by friction.
//
// The clip: a band BAND thick and HEIGHT high that wraps WRAP degrees round the post, open towards +X. Relaxed, its grip
// face (the crests of the ridges inside) is GRIP_D across, less than the thinnest post it is for (POST_MIN), so on any post
// from POST_MIN to POST_MAX it stands opened a little and squeezes the post. It goes on by pressing its mouth against the post:
// the flared lips at its tips (FLARE long, FLARE_ANGLE out) spread the arms until the post's widest line has passed, and they
// spring back round it. It comes off the same way, pulled back by the socket. One fixed design for every post in the range:
// the band's own bend takes up the post's diameter, so there is no diameter setting
// (packages/contracts/src/wandHolder.ts, wandHolderFlex, works out the bend's strain at both ends of the range).
//
// Sisal rope is soft and uneven, so the grip face is not a smooth bore: rounded-off horizontal ridges (RIDGE proud, RIDGE_PITCH
// apart, 45 degree flanks) press into the rope between its turns and keep the clip from sliding down the post.
//
// The socket: a tube at the back of the clip, opposite its mouth, its bore upright (parallel to the post), HANDLE_D + 2 x
// CLEARANCE across and SOCKET_DEPTH deep above a closed floor with a small vent hole (so the handle does not pump air).
// RIBS crush ribs inside stand CLEARANCE + SQUEEZE proud of the bore, so the handle squeezes each of them by SQUEEZE whatever the
// clearance; their tops are ramped and the mouth is chamfered, as a lead-in. The tube is joined to the band by a web, which
// is also the clip's stiff back: the arms bend from its ends.
//
// Frame: millimetres, Z up along the post's axis, the post's centre on the Z axis, the clip's mouth towards +X and the socket
// towards -X. It prints as generated, standing on its bottom face (z = 0): no supports. The arms bend in the plane of the
// layers, along the printed lines, so a bend never pulls layers apart. Every dimension also lives in wandHolder.ts (a test
// keeps the fixed ones equal).

// The wand: its handle end's diameter, how deep the socket holds it, the bore's play round it and how far the ribs squeeze it
HANDLE_D = 8;       //[5:0.1:12]
SOCKET_DEPTH = 40;  //[25:1:60]
CLEARANCE = 0.2;    //[0.1:0.05:0.5]
SQUEEZE = 0.15;     //[0:0.05:0.4]

// --- Fixed: the clip (wandHolder.ts, WAND_HOLDER) ---
POST_MIN = 90;      // the thinnest post it grips (its rope's outside)
POST_MAX = 110;     // the thickest one it goes over
GRIP_D = 88;        // the ridges' crests, relaxed
RIDGE = 0.8;        // how far a ridge stands proud of the band's inside
RIDGE_PITCH = 4;
RIDGE_LAND = 0.4;   // the flat on each ridge's crest
BAND = 3.5;         // the band behind the ridges
HEIGHT = 36;        // along the post
WRAP = 270;         // degrees round the post, relaxed
FLARE = 12;         // each lip's length beyond the tip
FLARE_ANGLE = 35;   // and how far it turns outwards from the band's tangent
BACK = 12;          // the web joins the band from -BACK to +BACK degrees about -X

// --- Fixed: the socket ---
WALL = 3;           // round the bore
FLOOR = 2;
VENT_D = 2;
RIBS = 3;
RIB_W = 1.2;
LEAD = 0.8;         // chamfer at the bore's mouth
RIB_RAMP = 3;       // the ribs' ramped tops end this far below the mouth
SINK = 0.8;         // the tube runs this far into the band

$fn = 128;
E = 0.01;

R_CREST = GRIP_D / 2;
R_IN = R_CREST + RIDGE;          // the band's inside, between the ridges
R_OUT = R_IN + BAND;
R_MID = (R_IN + R_OUT) / 2;
TIP = 180 - WRAP / 2;            // the +Y tip's angle from +X (the -Y tip is its mirror)
BORE_R = HANDLE_D / 2 + CLEARANCE;
TUBE_R = BORE_R + WALL;
TUBE_X = -(R_OUT + TUBE_R - SINK);
TUBE_H = FLOOR + SOCKET_DEPTH;

// The band's section (radius, height): its outside straight, its inside ridged.
function ridge_count() = floor((HEIGHT - RIDGE_PITCH / 2) / RIDGE_PITCH);
function ridge_points() = let(n = ridge_count(), first = (HEIGHT - (n - 1) * RIDGE_PITCH) / 2)
  [for (i = [0 : n - 1]) let(zc = first + i * RIDGE_PITCH, half = RIDGE + RIDGE_LAND / 2)
    each [[R_IN, zc - half], [R_CREST, zc - RIDGE_LAND / 2], [R_CREST, zc + RIDGE_LAND / 2], [R_IN, zc + half]]];
module band_section() {
  polygon(concat([[R_OUT, 0], [R_OUT, HEIGHT], [R_IN, HEIGHT]], [for (i = [len(ridge_points()) - 1 : -1 : 0]) ridge_points()[i]], [[R_IN, 0]]));
}

module band() { rotate([0, 0, TIP]) rotate_extrude(angle = WRAP) band_section(); }

// A lip at the +Y tip, mirrored for the other: it leaves the band's end along its tangent turned FLARE_ANGLE outwards.
module lip() {
  r = BAND / 2 - 0.02;
  tangent = [sin(TIP), -cos(TIP)];
  normal = [cos(TIP), sin(TIP)];
  dir = cos(FLARE_ANGLE) * tangent + sin(FLARE_ANGLE) * normal;
  a = R_MID * normal;
  linear_extrude(HEIGHT) hull() { translate(a) circle(r = r, $fn = 48); translate(a + FLARE * dir) circle(r = r, $fn = 48); }
}

// The web: the tube's outline hulled with the band's back, from -BACK to +BACK degrees about -X.
module web() {
  linear_extrude(HEIGHT) hull() {
    translate([TUBE_X, 0]) circle(r = TUBE_R);
    polygon([for (a = [180 - BACK : 2 : 180 + BACK]) (R_IN + BAND / 2) * [cos(a), sin(a)], for (a = [180 + BACK : -2 : 180 - BACK]) (R_OUT - E) * [cos(a), sin(a)]]);
  }
}

module tube() { translate([TUBE_X, 0, 0]) cylinder(r = TUBE_R, h = TUBE_H); }

module bore() {
  translate([TUBE_X, 0, 0]) {
    translate([0, 0, FLOOR]) cylinder(r = BORE_R, h = TUBE_H);
    translate([0, 0, TUBE_H - LEAD]) cylinder(r1 = BORE_R, r2 = BORE_R + LEAD + E, h = LEAD + E);
    translate([0, 0, -1]) cylinder(d = VENT_D, h = FLOOR + 2, $fn = 24);
  }
}

// The crush ribs, one every 360 / RIBS degrees starting towards the post (+X), each standing CLEARANCE + SQUEEZE proud of the
// bore, from the floor up to RIB_RAMP below the mouth, then ramped back into the wall.
module ribs() {
  proud = CLEARANCE + SQUEEZE;
  top = TUBE_H - LEAD - RIB_RAMP;
  if (proud > 0) translate([TUBE_X, 0, 0]) for (i = [0 : RIBS - 1]) rotate([0, 0, i * 360 / RIBS]) hull() {
    translate([BORE_R - proud, -RIB_W / 2, FLOOR - E]) cube([proud + 0.5, RIB_W, top - FLOOR + E]);
    translate([BORE_R + 0.05, -RIB_W / 2, top + RIB_RAMP - 0.01]) cube([0.5, RIB_W, 0.01]);
  }
}

union() {
  difference() {
    union() { band(); lip(); mirror([0, 1, 0]) lip(); web(); tube(); }
    bore();
  }
  ribs();
}
