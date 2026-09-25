// Moosstab Abdeckkappe V2 (cover cap) - parametric OpenSCAD reconstruction.
//
// Adapted from "Moss Tower Verdura - The Modular Climbing Support" by HpInvent (MakerWorld):
// https://makerworld.com/de/models/1200114-moss-tower-verdura-the-modular-climbing-support
// This file is a derivative of the reconstruction in reference/ made for CanFactory; it grants no additional
// rights to the original. See ATTRIBUTION.md.
//
// Geometry: a revolved profile (outer skirt, inner plug wall, roof ridge) plus a right-handed internal thread
// (pitch 5 mm, single start) cut into the skirt. Units are millimetres; the part is centred on the Z axis with its
// open end on z = 0.

// Outer diameter of the tower this part belongs to (52 = the original design). Parts built for the same diameter
// share one thread (pitch 5 x TOWER_DIAMETER / 52) and screw together.
TOWER_DIAMETER = 52;
SCALE          = TOWER_DIAMETER / 52;
// Facets around a full circle.
ROUNDNESS   = 180; //[48:12:360]

THREAD_PITCH = 5;
THREAD_TURN  = 1;       // 1 = right-handed, -1 = left-handed
THREAD_TOP   = 10;      // groove ends on this plane
THREAD_ROOT_R = 18.7;   // skirt inner wall between grooves
THREAD_INNER_R = 18.0;  // any radius below the root, only used to keep the cutter a ring
CREST_Z      = 0.5;     // z where the groove is deepest at CREST_ANGLE
CREST_ANGLE  = 37;

// Groove depth: [phase mm from the deepest point, radius]; periodic with THREAD_PITCH, phase in [-0.5, 4.5).
// The flat root sits 0.1 mm inside the skirt wall (THREAD_ROOT_R) so cutter and wall never share a surface.
TOOTH = [[-0.5, 19.858], [-0.4, 19.956], [-0.33, 20.01], [-0.23, 20.066], [-0.11, 20.103], [0, 20.115],
         [0.1, 20.108], [0.2, 20.087], [0.31, 20.04], [0.36, 20.01], [0.446, 19.94], [1.818, 18.6],
         [3.213, 18.6], [4.5, 19.858]];

// Revolved outline (radius, z).
PROFILE = [[26, 0], [26, 10.172], [25.967, 10.532], [25.909, 10.767], [25.712, 11.206], [25.413, 11.586],
           [22.585, 14.414], [22.308, 14.646], [21.881, 14.87], [21.532, 14.967], [21.274, 14.997],
           [17.707, 14.996], [17.233, 14.909], [16.793, 14.712], [16.413, 14.414], [13.503, 11.498],
           [13.229, 11.101], [13.058, 10.65], [13, 10.172], [13, 0], [15.5, 0], [15.5, 10.5], [17, 12],
           [18.77, 12], [20.27, 10.5], [20.27, THREAD_TOP], [THREAD_ROOT_R, THREAD_TOP], [THREAD_ROOT_R, 0]];

function tooth_r(phase) = lookup(((phase + 0.5) % THREAD_PITCH + THREAD_PITCH) % THREAD_PITCH - 0.5, TOOTH);

// Groove cross-section on the plane z = z0 (polar outline; the section turns with height).
module groove_section(z0) {
    n = ROUNDNESS;
    difference() {
        polygon([for (i = [0 : n - 1]) let (a = 360 * i / n,
                 ph = z0 - CREST_Z - THREAD_TURN * THREAD_PITCH * (a - CREST_ANGLE) / 360)
                 tooth_r(ph) * [cos(a), sin(a)]]);
        circle(r = THREAD_INNER_R, $fn = n);
    }
}

module groove_cutter() {
    z0 = -1;
    h = THREAD_TOP + 0.05 - z0;   // 0.05 past the ledge so cutter and ledge are not coplanar
    translate([0, 0, z0])
        linear_extrude(height = h, twist = -THREAD_TURN * 360 * h / THREAD_PITCH, slices = ceil(h / THREAD_PITCH * 72), convexity = 10)
            groove_section(z0);
}

module cap() {
    difference() {
        rotate_extrude($fn = ROUNDNESS) polygon(PROFILE);
        groove_cutter();
    }
}

scale(SCALE) cap();
