// CanFactory original, CC BY 4.0. Four functional layers; individual print-oriented components.
// Magnet defaults below are sourced supermagnete S-10-03-N / S-06-03-N, NOT generic magnets.
// Flush grid depth uses nominal thickness; pocket diameters and ball dimensions use greatest sizes.
PART = "grid";
WIDTH = 160;
LENGTH = 140;
SOCKET_SPACING = 30;
GRID_D = 10.1;
GRID_T = 3;
BALL_MAGNET_D = 6.1;
BALL_MAGNET_T = 3.1;
BALL_MAGNET_MIN_D = 5.9;
BALL_SHELL = 2;
FIELD_T = 1.2;
BALL_D = 36;
PLACEMENT = "centred";
OFFSET = 6;
SLOT_W = 18;
CLEARANCE = 0.2;
NUT_S = 5.5;
NUT_T = 2.4;
SCREW_D = 3.4;
ROUNDNESS = 64;
$fn = ROUNDNESS;
EPS = 0.01;
FLOOR = 1.2;
SOCKET_WALL = 1.2;
EDGE_MARGIN = 20;
PUSH_HOLE = 3;
RIM = 5;
MOUNT_BASE = 6;
PLAY = 0.2;
AIR = 0.2;
WALL = 3;
ROOF = 3;
FIELD_LIP = 3;
FIELD_RETAIN_GAP = 0.2;
PIN = 1;
PIN_L = 1.6;
BALL_LIP = 0.4;
BALL_SEAT_FLOOR = 1.2;
BALL_SEAT_WALL = 1.2;
BALL_PUSH_HOLE = 2.5;
GRIP_HOLE = 4;
SPOKE_W = 2;
COLUMNS = floor((WIDTH-2*EDGE_MARGIN)/SOCKET_SPACING)+1;
ROWS = floor((LENGTH-2*EDGE_MARGIN)/SOCKET_SPACING)+1;
SOCKET_D = GRID_D + PLAY;
SOCKET_TOP = FLOOR + GRID_T;
BASE = SOCKET_TOP + AIR;
FIELD_Z = BASE;
FIELD_TOP = FIELD_Z + FIELD_T;
R = BALL_D / 2;
MX = PLACEMENT == "eccentric" ? OFFSET : 0;
ROOF_Z = FIELD_TOP + BALL_D + 3;
TOP = ROOF_Z + ROOF;
SLOT_L = min(3 * BALL_D, LENGTH - 24);
SLOTS = floor((WIDTH - 24 + 4) / (SLOT_W + 4));
SLOT_PITCH = (WIDTH - 24 - SLOT_W) / (SLOTS - 1);

assert(SLOT_W <= 0.6 * BALL_D, "Slot width exceeds retention rule");
assert(SOCKET_SPACING >= SOCKET_D+2*SOCKET_WALL+2, "Socket walls need at least 2 mm between them");
assert(COLUMNS >= 1 && ROWS >= 1, "Socket pitch does not fit this tray");
module at_sockets() {
    for(i=[0:COLUMNS-1],j=[0:ROWS-1]) translate([(i-(COLUMNS-1)/2)*SOCKET_SPACING,(j-(ROWS-1)/2)*SOCKET_SPACING,0]) children();
}
module rounded(w, l, h, r=6) {
    linear_extrude(h) hull() for (x=[-1,1], y=[-1,1]) translate([x*(w/2-r), y*(l/2-r)]) circle(r=r);
}
module ears(h, inset=-3, play=0) {
    for (x=[-1,1], y=[-1,1]) hull() {
        translate([x*(WIDTH/2+5), y*(LENGTH/2-12), 0]) cylinder(r=6+play,h=h);
        translate([x*(WIDTH/2+inset), y*(LENGTH/2-12), 0]) cylinder(r=6+play,h=h);
    }
}
module ear_holes(h, nuts=false) {
    for (x=[-1,1], y=[-1,1]) translate([x*(WIDTH/2+5),y*(LENGTH/2-12),-EPS]) {
        cylinder(d=SCREW_D,h=h+2*EPS);
        if(nuts) rotate([0,0,30]) cylinder(d=(NUT_S+0.3)/cos(30),h=NUT_T+0.2+EPS,$fn=6);
    }
}
module grid() {
    difference() {
        union() {
            // Thin connected tray, not a full-height solid plate or a network of raised grid lines.
            rounded(WIDTH,LENGTH,FLOOR);
            ears(MOUNT_BASE,3);
            // Only socket walls rise around magnets. Their top faces remain exposed and nominally flush.
            at_sockets()
                cylinder(d=SOCKET_D+2*SOCKET_WALL,h=SOCKET_TOP);
            // Field rests on a narrow perimeter rim, 0.2 mm above the magnet faces.
            difference() {
                rounded(WIDTH,LENGTH,BASE);
                translate([0,0,-EPS]) rounded(WIDTH-2*RIM,LENGTH-2*RIM,BASE+2*EPS,r=3);
            }
        }
        // A small through-floor ejector hole leaves an annular bearing seat under each disc.
        at_sockets() {
            translate([0,0,FLOOR]) cylinder(d=SOCKET_D,h=GRID_T+EPS);
            translate([0,0,-EPS]) cylinder(d=PUSH_HOLE,h=FLOOR+2*EPS);
        }
        ear_holes(MOUNT_BASE,true);
    }
}
// Identical hollow halves. Print equator down on short supports under rim/pin seats and central spokes.
// Straight, lead-in alignment pins reuse the clearance-fit pattern, but do NOT latch the halves: two magnets close them.
BALL_SEAT = BALL_LIP + BALL_MAGNET_T;
BOSS_R = (BALL_MAGNET_D+PLAY)/2 + BALL_SEAT_WALL;
PIN_R = R-BALL_SHELL-1;
module hemisphere(radius) {
    rotate_extrude() polygon(concat([[0,0]],
        [for(i=[0:ROUNDNESS/4]) [radius*cos(i*360/ROUNDNESS),radius*sin(i*360/ROUNDNESS)]]));
}
module ball_core() {
    difference() {
        union() {
            difference() {
                hemisphere(R);
                translate([0,0,-EPS]) hemisphere(R-BALL_SHELL);
            }
            // Four slender spokes connect a central/eccentric magnet seat to the shell, not a solid hemisphere.
            intersection() {
                hemisphere(R);
                translate([0,0,BALL_SEAT]) linear_extrude(BALL_SEAT_FLOOR) union() {
                    translate([-R,-SPOKE_W/2]) square([2*R,SPOKE_W]);
                    translate([MX-SPOKE_W/2,-R]) square([SPOKE_W,2*R]);
                }
            }
            translate([MX,0,0]) cylinder(r=BOSS_R,h=BALL_SEAT+BALL_SEAT_FLOOR);
            // Locally supported alignment seats at the equator, balanced in threefold mirrored pairs.
            for(a=[30,90,150,210,270,330])
                translate([PIN_R*cos(a),PIN_R*sin(a),0]) cylinder(r=PIN+CLEARANCE+0.6,h=3);
            for(a=[30,150,270]) translate([PIN_R*cos(a),PIN_R*sin(a),-PIN_L]) {
                cylinder(r1=PIN-0.3,r2=PIN,h=0.3);
                translate([0,0,0.3]) cylinder(r=PIN,h=PIN_L-0.3+EPS);
            }
        }
        // Open face + 45-degree retaining lip. Four radial reliefs let the rim flex during insertion/removal.
        translate([MX,0,-EPS]) cylinder(d1=BALL_MAGNET_MIN_D-0.3,d2=BALL_MAGNET_D+PLAY,h=BALL_LIP+EPS);
        translate([MX,0,BALL_LIP]) cylinder(d=BALL_MAGNET_D+PLAY,h=BALL_MAGNET_T);
        for(a=[0,90,180,270]) translate([MX,0,-EPS]) rotate([0,0,a])
            translate([(BALL_MAGNET_D+PLAY)/2-0.1,-0.3,0]) cube([BALL_SEAT_WALL+0.2,0.6,BALL_SEAT+EPS]);
        // Straight tool access from the outside, through shell and seat floor, after separating the halves.
        translate([MX,0,BALL_SEAT-EPS]) cylinder(d=BALL_PUSH_HOLE,h=R+EPS);
        for(a=[-30,-150,-270]) translate([PIN_R*cos(a),PIN_R*sin(a),-EPS])
            cylinder(r=PIN+CLEARANCE,h=PIN_L+CLEARANCE+EPS);
        // Twelve radial grip windows per half, smaller than every supported ball magnet.
        for(lat=[35,65],a=[30:60:330]) rotate([0,90-lat,a])
            translate([0,0,R-BALL_SHELL-1]) cylinder(d=GRIP_HOLE,h=BALL_SHELL+2);
    }
}
module ball() { translate([0,0,PIN_L]) ball_core(); }
module cover_upright() {
    difference() {
        union() {
            difference() {
                rounded(WIDTH,LENGTH,TOP-BASE);
                translate([0,0,-EPS]) rounded(WIDTH-2*WALL,LENGTH-2*WALL,ROOF_Z-BASE+EPS,r=3);
            }
            // Retain the field at its perimeter: bare magnets rely on the screwed cover, not socket friction.
            // 45-degree ramp prints support-free roof-down; its flat assembled underside limits field lift.
            // Stop side lips before the screw ears, avoiding tangent/coplanar boolean intersections.
            for(side=[-1,1]) {
                scale([side,1,1]) translate([WIDTH/2-WALL-FIELD_LIP,0,FIELD_T+FIELD_RETAIN_GAP])
                    rotate([90,0,0]) linear_extrude(LENGTH-48,center=true)
                        polygon([[0,0],[FIELD_LIP+0.5,0],[FIELD_LIP+0.5,FIELD_LIP+0.5]]);
                rotate([0,0,90]) scale([side,1,1]) translate([LENGTH/2-WALL-FIELD_LIP,0,FIELD_T+FIELD_RETAIN_GAP])
                    rotate([90,0,0]) linear_extrude(WIDTH-24,center=true)
                        polygon([[0,0],[FIELD_LIP+0.5,0],[FIELD_LIP+0.5,FIELD_LIP+0.5]]);
            }
            // 2 mm flange + 6 mm base = 8 mm screw grip; full nut engagement, flush tip.
            translate([0,0,MOUNT_BASE-BASE]) ears(2,3);
        }
        // Taller mounting ears lie outside the field; relieve the skirt where it seats over them.
        translate([0,0,-EPS]) ears(MOUNT_BASE-BASE+EPS,3,CLEARANCE);
        ear_holes(TOP-BASE);
        for(i=[0:SLOTS-1]) translate([(i-(SLOTS-1)/2)*SLOT_PITCH,0,ROOF_Z-BASE-EPS])
            linear_extrude(ROOF+2*EPS) hull() for(y=[-1,1]) translate([0,y*(SLOT_L-SLOT_W)/2]) circle(d=SLOT_W);
    }
}
if(PART=="grid") grid();
else if(PART=="field") rounded(WIDTH-8,LENGTH-8,FIELD_T,r=4);
else if(PART=="ball") ball();
else if(PART=="cover") translate([0,0,TOP-BASE]) rotate([180,0,0]) cover_upright();
else assert(false,"Unknown part");
