// Plank connector: an original CanFactory design, published under CC BY 4.0.
//
// A symmetric sleeve that joins two planks end to end. Each plank end slides
// into its own rectangular pocket, one from each end of the sleeve, and butts
// against a solid stop in the middle. Optional screw holes cross the sleeve
// through its wide faces (and through the planks), sized as clearance holes
// per DIN EN 20273 (ISO 273).
//
// The part is modelled standing up, as it prints: Z is the insertion axis,
// X the wide side of the pocket, Y its thin side. Nothing scales implicitly:
// every size below is exactly the millimetres given.

// ---------------------------------------------------------------

// Pocket cross-section: the wide side (plank width plus clearance)
POCKET_WIDTH     = 50.22; //[5:0.01:200]
// Pocket cross-section: the thin side (plank thickness plus clearance)
POCKET_THICKNESS =  4.80; //[1:0.01:50]
// How far each plank end goes into the connector
INSERTION_DEPTH  = 20.0;  //[5:0.5:150]
// Material around the pockets, on every side
WALL_THICKNESS   =  2.0;  //[0.8:0.1:10]
// Solid stop between the two pockets; 0 makes one open sleeve
STOP_THICKNESS   =  2.0;  //[0:0.1:20]
// 45 degree lead-in at each pocket mouth; 0 for none
ENTRY_CHAMFER    =  0.5;  //[0:0.1:5]

// Screw size of the through-holes, or "none"
SCREW_SIZE       = "none"; //[none,M2,M2.5,M3,M4,M5,M6,M8]
// DIN EN 20273 series: fine (H12), medium (H13) or coarse (H14)
HOLE_FIT         = "medium"; //[fine,medium,coarse]
// Holes per plank end, spread evenly across the wide side
HOLES_PER_END    = 2; //[1:4]

ROUNDNESS        = 48; //[24,48,96]

// ---------------------------------------------------------------

// DIN EN 20273 (ISO 273) clearance holes: [screw, fine, medium, coarse], in mm.
// Mirrored by CLEARANCE_HOLES in packages/contracts/src/models.ts (a test
// compares the two).
DIN_EN_20273 = [
    ["M2",   2.2,  2.4,  2.6],
    ["M2.5", 2.7,  2.9,  3.1],
    ["M3",   3.2,  3.4,  3.6],
    ["M4",   4.3,  4.5,  4.8],
    ["M5",   5.3,  5.5,  5.8],
    ["M6",   6.4,  6.6,  7.0],
    ["M8",   8.4,  9.0, 10.0],
];

FIT_COLUMN = HOLE_FIT == "fine" ? 1 : HOLE_FIT == "coarse" ? 3 : 2;

function hole_diameter(screw) =
    let (row = [for (r = DIN_EN_20273) if (r[0] == screw) r])
    len(row) == 0 ? 0 : row[0][FIT_COLUMN];

HOLE_DIAMETER = hole_diameter(SCREW_SIZE);

OUTER_WIDTH     = POCKET_WIDTH + 2*WALL_THICKNESS;
OUTER_THICKNESS = POCKET_THICKNESS + 2*WALL_THICKNESS;
OUTER_HEIGHT    = 2*INSERTION_DEPTH + STOP_THICKNESS;

// Keeps cutters from sharing a face with the part they cut.
EPS = 0.01;

// ---------------------------------------------------------------

// One pocket, opening at z = 0 and reaching `depth` up into the part, with
// its lead-in chamfer at the mouth.
module pocket(depth)
{
    translate([-POCKET_WIDTH/2, -POCKET_THICKNESS/2, -EPS])
        cube([POCKET_WIDTH, POCKET_THICKNESS, depth+EPS]);
    if (ENTRY_CHAMFER > 0) hull() {
        translate([0, 0, -EPS/2])
            cube([POCKET_WIDTH+2*ENTRY_CHAMFER+2*EPS, POCKET_THICKNESS+2*ENTRY_CHAMFER+2*EPS, EPS], center=true);
        translate([0, 0, ENTRY_CHAMFER])
            cube([POCKET_WIDTH, POCKET_THICKNESS, EPS], center=true);
    }
}

// The screw holes of one plank end, centred at height z: straight through
// both wide walls, spread evenly across the pocket width.
module holes(z)
{
    if (HOLE_DIAMETER > 0) for (i = [0:HOLES_PER_END-1]) {
        x = -POCKET_WIDTH/2 + (i+0.5)*POCKET_WIDTH/HOLES_PER_END;
        translate([x, 0, z]) rotate([90, 0, 0])
            cylinder(d=HOLE_DIAMETER, h=OUTER_THICKNESS+2, center=true, $fn=ROUNDNESS);
    }
}

module plank_connector()
{
    // Without a stop the two pockets meet; let them overlap so that they
    // form one clean through-opening.
    reach = INSERTION_DEPTH + (STOP_THICKNESS > 0 ? 0 : EPS);
    difference() {
        translate([-OUTER_WIDTH/2, -OUTER_THICKNESS/2, 0])
            cube([OUTER_WIDTH, OUTER_THICKNESS, OUTER_HEIGHT]);
        // lower pocket, open at the bottom
        pocket(reach);
        // upper pocket, open at the top
        translate([0, 0, OUTER_HEIGHT]) mirror([0, 0, 1]) pocket(reach);
        holes(INSERTION_DEPTH/2);
        holes(OUTER_HEIGHT - INSERTION_DEPTH/2);
    }
}

plank_connector();

// vim: set et sw=4 ts=4:
