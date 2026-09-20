// This 3D model is published under CC BY-SA 4.0 by Stefan Schönberger <mail@sniner.net>

// ---------------------------------------------------------------

// Inner diameter of opening for fruit flies
NOZZLE_DIAMETER         =  3.5;
// Object wall thickness
WALL_THICKNESS          =  0.8; //[0.8:0.1:1.6]
// Width of the brim
BRIM_WIDTH              = 10.0; //[6:10]
// Brim with handles or not
BRIM_HANDLES            = true; //[true,false]

// Height of the air gaps
GAP_HEIGHT              =  1.6; //[1.0:0.2:3.0]
// Width of the air gaps
GAP_WIDTH               =  0.4; //[0.3:0.1:0.8]
// Distance between air gaps
GAP_DISTANCE_HORIZONTAL =  1.6; //[1.2:0.2:2]
// Distance between layers of air gaps
GAP_DISTANCE_VERTICAL   =  1.6; //[1.0:0.2:3.0]

// Less than the inner diameter of the tumbler/jar
TRAP_DIAMETER           = 60.0; //[40:100]
// Height of the trap; up to 2/3 of the inner height of the tumbler/jar
TRAP_HEIGHT             = 60.0; //[40:100]

OBJECT                  = "flytrap"; //[flytrap,demo]

ROUNDNESS               = 48; //[24,48,96]

// ---------------------------------------------------------------

module cone(diameter, height)
{
    difference() {
        cylinder(h=height, d2=diameter, d1=NOZZLE_DIAMETER+2*WALL_THICKNESS);
        translate([0, 0, -0.001])
        cylinder(h=height+0.002, d2=diameter-2*WALL_THICKNESS, d1=NOZZLE_DIAMETER);
    }
}

module grill_cutter(diameter, count, angle=0)
{
    translate([0, 0, -GAP_HEIGHT/2])
    for (i = [0:count]) {
        rotate([0, 0, i*360/count+angle])
            cube([diameter/2+WALL_THICKNESS, GAP_WIDTH, GAP_HEIGHT], center=false);
    }
}

function circ(radius) = 2*PI*radius;

module cylinder_with_gaps(diameter, height)
{
    bottom_r = NOZZLE_DIAMETER*3/2;
    top_r    = diameter/2;
    bottom_h = height/6;
    top_h    = height-height/12;

    difference() {
        cylinder(d=diameter, h=height, center=false);

        l_height = top_h-bottom_h;
        layers = round((l_height+GAP_DISTANCE_VERTICAL)/(GAP_HEIGHT+GAP_DISTANCE_VERTICAL));
        layer_distance = (l_height-layers*GAP_HEIGHT)/(max(1, layers-1));
        for (l=[0:layers-1]) {
            h = l/layers;
            r = h*(top_r-bottom_r)+bottom_r;
            c = circ(r);
            lh = bottom_h+l*(GAP_HEIGHT+layer_distance);
            translate([0, 0, lh])
                grill_cutter(diameter=diameter, count=round(c/(GAP_DISTANCE_HORIZONTAL+GAP_WIDTH)));
        }

        translate([0, 0, height/2])
            cylinder(d1=NOZZLE_DIAMETER-2*WALL_THICKNESS, r2=top_r-WALL_THICKNESS, h=height+2, center=true);
    }
}

module cone_with_gaps(diameter, height)
{
    intersection() {
        cylinder_with_gaps(diameter, height);
        cone(diameter, height);
    }
}

module handle_form(w, h, c)
{
    hull() {
        translate([-w/2+c, h-c, 0]) circle(r=c);
        translate([w/2-c, h-c, 0]) circle(r=c);
        translate([-w/2, 0, 0]) square([w, h-c], center=false);
    }
}

module flytrap(diameter=60, height=60)
{
    // cone
    cone_with_gaps(diameter, height);
    // brim
    translate([0, 0, height-WALL_THICKNESS]) {
        difference() {
            cylinder(h=WALL_THICKNESS, d=diameter+2*BRIM_WIDTH);
            translate([0, 0, -WALL_THICKNESS/2]) cylinder(h=2*WALL_THICKNESS, d=diameter-2*WALL_THICKNESS);
        }
        if (BRIM_HANDLES) {
            // handle
            handle_size = 1.2*BRIM_WIDTH;
            linear_extrude(WALL_THICKNESS) {
                translate([0, diameter/2, 0])
                    handle_form(handle_size, handle_size+BRIM_WIDTH, BRIM_WIDTH/4);
                translate([0, -diameter/2, 0])
                rotate([0, 0, 180])
                    handle_form(handle_size, handle_size+BRIM_WIDTH, BRIM_WIDTH/4);
            }
        }
    }
}

module glass(diameter, height, thickness=2)
{
    translate([0, 0, (height-thickness)/2+thickness])
    difference() {
        cylinder(h=height-thickness, d=diameter, center=true);
        translate([0, 0, thickness]) cylinder(h=height, d=diameter-2*thickness, center=true);
    }
    translate([0, 0, thickness])
        hull() rotate_extrude() translate([diameter/2-thickness, 0, 0]) circle(r=thickness);
}


if (OBJECT=="flytrap") {
    translate([0, 0, TRAP_HEIGHT]) rotate([180, 0, 0])
        flytrap(TRAP_DIAMETER, TRAP_HEIGHT, $fn=ROUNDNESS);
} else {
    %color("white", 0.5) glass(TRAP_DIAMETER+10, TRAP_HEIGHT*1.3, $fn=ROUNDNESS);
    color("yellow") translate([0, 0, TRAP_HEIGHT*0.3+WALL_THICKNESS])
        flytrap(TRAP_DIAMETER, TRAP_HEIGHT, $fn=ROUNDNESS);
}

// vim: set et sw=4 ts=4: