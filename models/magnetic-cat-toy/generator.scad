// CanFactory original, CC BY 4.0. Four functional layers; individual print-oriented components.
// Magnet defaults below are sourced supermagnete S-10-03-N / S-06-03-N, NOT generic magnets.
// Flush grid depth uses nominal thickness; pocket diameters and ball dimensions use greatest sizes.
PART = "grid";
WIDTH = 160;
LENGTH = 140;
GRID_D = 10.1;
GRID_T = 3;
BALL_MAGNET_D = 6.1;
BALL_MAGNET_T = 3.1;
FIELD_T = 1.2;
BALL_D = 36;
PLACEMENT = "centred";
OFFSET = 6;
SLOT_W = 18;
CLEARANCE = 0.2;
DETENT_ENGAGE = 0.15;
NUT_S = 5.5;
NUT_T = 2.4;
SCREW_D = 3.4;
ROUNDNESS = 64;
$fn = ROUNDNESS;
EPS = 0.01;
FLOOR = 1.2;
SOCKET_WALL = 1.2;
RIM = 5;
MOUNT_BASE = 6;
PLAY = 0.2;
AIR = 0.2;
WALL = 3;
ROOF = 3;
FIELD_LIP = 3;
FIELD_RETAIN_GAP = 0.2;
PIN = 1.6;
PIN_L = 2.4;
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
            for(i=[0:3],j=[0:3]) translate([(i-1.5)*(WIDTH-40)/3,(j-1.5)*(LENGTH-40)/3,0])
                cylinder(d=SOCKET_D+2*SOCKET_WALL,h=SOCKET_TOP);
            // Field rests on a narrow perimeter rim, 0.2 mm above the magnet faces.
            difference() {
                rounded(WIDTH,LENGTH,BASE);
                translate([0,0,-EPS]) rounded(WIDTH-2*RIM,LENGTH-2*RIM,BASE+2*EPS,r=3);
            }
        }
        for(i=[0:3],j=[0:3]) translate([(i-1.5)*(WIDTH-40)/3,(j-1.5)*(LENGTH-40)/3,FLOOR])
            cylinder(d=SOCKET_D,h=GRID_T+EPS);
        ear_holes(MOUNT_BASE,true);
    }
}
// Both identical halves print pole-down, equator up, with external supports/raft; remove and sand the support marks.
// Three pins and three mirrored sockets balance the centred solid ball. Turning the upper half 180 degrees about X mates them.
// Clearance + independent engagement follows litter-shovel/cigarette-case; triangular detent flanks have 45 degree lead-ins.
module ridge(radius,z,amount) {
    // One revolved profile, overlapping its bore/core: no coincident cone faces at the ridge peak.
    rotate_extrude() polygon([[radius-EPS,z-amount-EPS],[radius+amount,z],[radius-EPS,z+amount+EPS]]);
}
module ball() {
    difference() {
        union() {
            // Explicit pole/equator samples give a true bed-plane pole and full nominal diameter;
            // OpenSCAD sphere() places its latitude rings half a facet away from the equator.
            rotate_extrude() polygon(concat([[0,R],[0,0]],
                [for(i=[1:ROUNDNESS/2]) [R*cos(-90+i*180/ROUNDNESS),R+R*sin(-90+i*180/ROUNDNESS)]]));
            for(a=[30,150,270]) translate([0.72*R*cos(a),0.72*R*sin(a),R-EPS]) {
                cylinder(r=PIN,h=PIN_L+EPS-0.4);
                translate([0,0,PIN_L-0.4]) cylinder(r1=PIN,r2=PIN-0.4,h=0.4);
                ridge(PIN,1.3,CLEARANCE+DETENT_ENGAGE);
            }
        }
        // Half of a single split seat; opposite half traps the disc, with 0.1 mm axial headroom per half.
        translate([MX,0,R-BALL_MAGNET_T/2-0.1]) cylinder(d=BALL_MAGNET_D+PLAY,h=BALL_MAGNET_T/2+0.1+EPS);
        for(a=[-30,-150,-270]) translate([0.72*R*cos(a),0.72*R*sin(a),R]) {
            translate([0,0,-PIN_L-CLEARANCE]) cylinder(r=PIN+CLEARANCE,h=PIN_L+CLEARANCE+EPS);
            // The receiving relief is larger than the ridge when seated, so only insertion flexes the fit.
            ridge(PIN+CLEARANCE,-1.3,DETENT_ENGAGE+CLEARANCE);
        }
    }
}
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
