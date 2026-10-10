// Library fan reference: max frame, centred XY, z=0 underside, exhaust +Z.
// Frame and mounting holes are dimensioned. Hub/struts are schematic; pads and leads omitted.
W = 40;
L = 40;
H = 12;
HOLE = 4.3;
MOUNTS = [[-16,-16],[-16,16],[16,-16],[16,16]];
R = min(W,L)/2 - 2;
$fn = 48;
union() {
  difference() {
    translate([-W/2,-L/2,0]) cube([W,L,H]);
    translate([0,0,-0.02]) cylinder(r=R,h=H+0.04);
    for (xy=MOUNTS) translate([xy[0],xy[1],-0.02]) cylinder(d=HOLE,h=H+0.04);
  }
  cylinder(r=R*0.35,h=H);
  for (a=[0:90:270]) rotate([0,0,a]) translate([0,-0.6,0]) cube([R+0.5,1.2,1]);
}
