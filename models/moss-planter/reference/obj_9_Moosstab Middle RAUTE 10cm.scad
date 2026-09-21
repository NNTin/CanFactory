// Moosstab Middle RAUTE 10cm (100 mm diamond-lattice tower segment) - parametric OpenSCAD reconstruction.
//
// Adapted from "Moss Tower Verdura - The Modular Climbing Support" by HpInvent (MakerWorld):
// https://makerworld.com/de/models/1200114-moss-tower-verdura-the-modular-climbing-support
// This file is a derivative reconstruction of that design's STL (obj_9_Moosstab Middle RAUTE 10cm.stl) made for
// CanFactory; it grants no additional rights to the original. See ../ATTRIBUTION.md.
//
// A 100 mm x 250 mm tube segment: a female-threaded collar at the bottom, a male-threaded ring at the top, and between them a
// diamond ("Raute") lattice of 2 x COLUMNS helical struts that fan out into V-shaped gussets at both ends.
// Right-handed threads, pitch 100/52 x 5 mm (the threads are the 52 mm design's, scaled). Units are millimetres; the part is centred on the Z axis with its base on z = 0.
// Same construction as obj_5_Moosstab Middle RAUTE small.scad, with 12 columns and its own strut section.
// Source STL sat at (595, 160) on the print plate.

// Uniform scale (1 = 100 mm outer diameter).
SCALE        = 1;
// Facets around a full circle.
ROUNDNESS    = 180; //[48:12:360]

// Struts / gussets around the tube.
COLUMNS      = 12;
// Angle of the first column (gusset axis).
COLUMN_PHASE = 15;
// Rhombus rows.
ROWS         = 10;
// Height where the first row of struts starts, and the height step between rows.
NODE_Z0      = 36.99;
ROW_DZ       = 17.31;
// The gusset's sides are the first struts extended downwards; its apex sits slightly higher than the strut start.
GUSSET_APEX  = 37.6;
GUSSET_INNER_EXT = 37;
// Fine adjustment of the top gusset (the lattice is not exactly mirror-symmetric).
TOP_MIRROR_TRIM = 1;
// Height at which the top gusset ends inside the top ring.
TOP_GUSSET_END = 226.1;
// Strut rotation about the axis, degrees per mm of height.
STRUT_TWIST  = 0.846;
OUTER_R      = 50;
LATTICE_INNER_R = 44.249;
// Height of the top thread ring's upper face.
TOP_Z        = 250;

// The threads are the 52 mm design's scaled by K.
K            = 100 / 52;
THREAD_PITCH = 5 * K;
THREAD_TURN  = 1;       // 1 = right-handed, -1 = left-handed

// ---- Lattice ------------------------------------------------------------------------------------------------
// The lattice is built slightly oversize in radius and then clipped to a clean revolved envelope (LATTICE_ENVELOPE),
// so its inner and outer faces come from one exact surface instead of many almost-coincident ones.
//
// Rounded, sheared strut section on a horizontal plane: [radius, arc length] about the strut centre; this is the
// ascending strut (angle grows with height); the descending strut is its mirror image. The flat faces at radius 26
// and 23.013 are extended outwards (26.6 / 22.4) for clipping.
STRUT = [[49.376, 2.048], [44.691, 1.415], [44.53, 1.331], [44.458, 1.267], [44.354, 1.128], [44.276, 0.938],
         [44.249, 0.726], [43.6, 0.726], [43.6, -0.783], [44.25, -0.783], [44.276, -0.988], [44.307, -1.085],
         [44.354, -1.185], [44.465, -1.332], [44.612, -1.44], [44.779, -1.493], [49.379, -2.086], [49.551, -2.077],
         [49.634, -2.049], [49.782, -1.949], [49.899, -1.799], [49.942, -1.708], [49.993, -1.508], [50.6, -1.508],
         [50.6, 1.02], [50.0, 1.02], [49.998, 1.365], [49.972, 1.573], [49.898, 1.761], [49.78, 1.912], [49.631, 2.012],
         [49.463, 2.052]];
// The end of the ascending section facing -arc (from the inner extension to the outer one): the gusset's outline.
STRUT_END = [for (i = [8 : 23]) STRUT[i]];
// Odd rows of this lattice use a wider strut (about 4.9 mm instead of 4.1 mm across).
STRUT_ODD = [[43.6, -1.254], [44.256, -1.254], [44.275, -1.357], [44.351, -1.548], [44.405, -1.631], [44.513, -1.742],
             [44.62, -1.814], [44.789, -1.864], [49.388, -2.389], [49.562, -2.377], [49.722, -2.302], [49.853, -2.173],
             [49.942, -2.014], [49.975, -1.911], [50.0, -1.709], [50.6, -1.709], [50.6, 1.813], [49.999, 1.813],
             [49.967, 2.042], [49.898, 2.209], [49.844, 2.29], [49.776, 2.363], [49.63, 2.457], [49.462, 2.495],
             [49.373, 2.49], [44.773, 1.808], [44.623, 1.76], [44.526, 1.701], [44.391, 1.557], [44.309, 1.407],
             [44.267, 1.262], [44.249, 1.096], [43.6, 1.096]];
STRUT_END_ODD = [for (i = [0 : 15]) STRUT_ODD[i]];

BAR_ANGLE = 180 / COLUMNS;                      // rotation of one strut: half the column spacing
BAR_DZ = BAR_ANGLE / STRUT_TWIST;               // height of one strut
LATTICE_TOP = NODE_Z0 + (ROWS - 1) * ROW_DZ + BAR_DZ; // where the last struts end
// The top gusset is the bottom one mirrored about the plane z = TOP_MIRROR_Z / 2 (the lattice is symmetric).
TOP_MIRROR_Z = NODE_Z0 + LATTICE_TOP + TOP_MIRROR_TRIM;

// Revolved clip: outer radius 50, inner radius 44.249 with the chamfers under the gussets (45 degrees; 0.1 mm inside
// the collar's own chamfer so the two cones are never coincident). It starts 0.06 mm above the collar's inner ledge
// (z = 19.231) so their horizontal faces are not coplanar.
LATTICE_ENVELOPE = [[39.403, 19.291], [OUTER_R, 19.291], [OUTER_R, 228], [35.83, 228], [LATTICE_INNER_R, 219.58],
                    [LATTICE_INNER_R, 24.14]];

function deg(s, r) = s / r * 180 / PI;
function xy(r, angle) = r * [cos(angle), sin(angle)];

module strut_section(mirrored, odd) {
    polygon([for (p = odd ? STRUT_ODD : STRUT) xy(p[0], deg(mirrored ? -p[1] : p[1], p[0]))]);
}

// One helical strut starting at height z0 at `angle`; dir = +1 rises counter-clockwise, -1 clockwise. Each strut turns
// 30 degrees and is 0.6 mm longer than the row pitch, so neighbouring rows overlap at the nodes.
module strut(angle, dir, z0, odd) {
    translate([0, 0, z0]) rotate(angle)
        linear_extrude(height = BAR_DZ, twist = -dir * BAR_ANGLE, slices = ceil(BAR_ANGLE / 1.5), convexity = 10)
            strut_section(dir < 0, odd);
}

// Outline of the gusset at height z: the convex hull, in (radius, arc) space, of the ascending strut pushed clockwise
// and the descending strut pushed counter-clockwise by the angle they have drifted from the apex. Its inner and outer
// faces are the oversize extensions (radius 19.5 / 26.6); the envelope trims them.
function gusset_outline(z, apex, end) =
    let (drift = STRUT_TWIST * max(0, apex - z),
         last = end[len(end) - 1],
         first = end[0],
         a = [for (p = end) xy(p[0] < LATTICE_INNER_R + 1 ? min(p[0], GUSSET_INNER_EXT) : p[0], -drift + deg(p[1], p[0]))],
         b = [for (i = [len(end) - 1 : -1 : 0]) let (p = end[i]) xy(p[0] < LATTICE_INNER_R + 1 ? min(p[0], GUSSET_INNER_EXT) : p[0], drift + deg(-p[1], p[0]))],
         outer_from = -drift + deg(last[1], last[0]),
         outer_to = drift - deg(last[1], last[0]),
         outer = [for (i = [1 : 7]) xy(last[0], outer_from + (outer_to - outer_from) * i / 8)],
         inner_from = drift - deg(first[1], first[0]),
         inner_to = -drift + deg(first[1], first[0]),
         inner = [for (i = [1 : 7]) xy(GUSSET_INNER_EXT, inner_from + (inner_to - inner_from) * i / 8)])
    concat(a, outer, b, inner);

module loft(sections) {
    n = len(sections[0]);
    m = len(sections);
    pts = [for (s = sections) each s];
    polyhedron(points = pts,
        faces = concat([[for (i = [0 : n - 1]) i]],
                       [[for (i = [n - 1 : -1 : 0]) (m - 1) * n + i]],
                       [for (k = [0 : m - 2], i = [0 : n - 1]) [k * n + i, (k + 1) * n + i, (k + 1) * n + (i + 1) % n, k * n + (i + 1) % n]]),
        convexity = 10);
}

// Gusset joining a strut apex at `apex` to the collar (from z_from); the top one is this mirrored.
module gusset(angle, apex, z_from, end) {
    zs = [for (i = [0 : 16]) z_from + (apex + 1 - z_from) * i / 16];
    rotate(angle)
        loft([for (z = zs) [for (p = gusset_outline(z, apex, end)) [p[0], p[1], z]]]);
}

module lattice() {
    intersection() {
        rotate_extrude($fn = ROUNDNESS) polygon(LATTICE_ENVELOPE);
        union() {
            for (i = [0 : COLUMNS - 1]) {
                a = COLUMN_PHASE + 360 * i / COLUMNS;
                for (k = [0 : ROWS - 1]) {
                    strut(a + BAR_ANGLE * k, 1, NODE_Z0 + k * ROW_DZ, k % 2 == 1);
                    strut(a - BAR_ANGLE * k, -1, NODE_Z0 + k * ROW_DZ, k % 2 == 1);
                }
                gusset(a, GUSSET_APEX, 17.5, STRUT_END);
                // Top gusset: the bottom one mirrored (z -> TOP_MIRROR_Z - z).
                translate([0, 0, TOP_MIRROR_Z]) mirror([0, 0, 1]) gusset(a, GUSSET_APEX, TOP_MIRROR_Z - TOP_GUSSET_END, (ROWS - 1) % 2 == 1 ? STRUT_END_ODD : STRUT_END);
            }
        }
    }
}

// ---- Thread helpers -------------------------------------------------------------------------------------------
function tooth_r(table, phase) = lookup(((phase + 0.5 * K) % THREAD_PITCH + THREAD_PITCH) % THREAD_PITCH - 0.5 * K, table);
function scaled(table) = [for (p = table) [p[0] * K, p[1] * K]];

// Polar cross-section on z0 of a thread whose deepest/highest point sits at height crest_z at crest_angle.
module thread_section(table, z0, crest_z, crest_angle, r_inner) {
    n = ROUNDNESS;
    difference() {
        polygon([for (i = [0 : n - 1]) let (a = 360 * i / n,
                 ph = z0 - crest_z - THREAD_TURN * THREAD_PITCH * (a - crest_angle) / 360)
                 tooth_r(table, ph) * [cos(a), sin(a)]]);
        circle(r = r_inner, $fn = n);
    }
}

module thread_extrude(table, z_from, z_to, crest_z, crest_angle, r_inner) {
    h = z_to - z_from;
    translate([0, 0, z_from])
        linear_extrude(height = h, twist = -THREAD_TURN * 360 * h / THREAD_PITCH, slices = ceil(h / THREAD_PITCH * 72), convexity = 10)
            thread_section(table, z_from, crest_z, crest_angle, r_inner);
}

// ---- Collar with internal (female) thread ---------------------------------------------------------------------
// Groove profile of the 52 mm design: [phase from the deepest point, radius]; scaled by K below. The flat root sits
// 0.1 mm inside the 18.7 mm wall.
FEMALE = scaled([[-0.5, 19.913], [-0.389, 20.008], [-0.212, 20.109], [0, 20.147], [0.212, 20.109], [0.391, 20.009],
                 [1.831, 18.6], [3.157, 18.6], [4.5, 19.913]]);
BOTTOM = [[35.962, 0], [50, 0], [50, 22.567], [49.972, 22.745], [49.937, 22.828], [49.831, 22.975], [49.685, 23.081],
          [49.513, 23.136], [49.423, 23.144], [43.595, 23.144], [43.416, 23.115], [43.333, 23.081], [43.187, 22.975],
          [39.443, 19.231], [35.962, 19.231]];

module collar() {
    difference() {
        rotate_extrude($fn = ROUNDNESS) polygon(BOTTOM);
        thread_extrude(FEMALE, -1, 19.281, 5.385 * K, 30, 18.0 * K);   // the cutter ends 0.05 above the ledge so their faces are not coplanar
    }
}

// ---- Top ring with external (male) thread ---------------------------------------------------------------------
MALE = scaled([[-0.5, 19.708], [-0.311, 19.892], [-0.15, 19.98], [0, 20.001], [0.15, 19.98], [0.311, 19.892],
               [1.742, 18.5], [3.258, 18.5], [4.5, 19.708]]);
TOP = [[39.117, 224.801], [49.423, 224.801], [49.601, 224.829], [49.762, 224.911], [49.89, 225.039], [49.937, 225.116],
       [49.972, 225.199], [50, 225.378], [50, 230.769], [18.4 * K, 230.769], [18.4 * K, TOP_Z], [31.251, TOP_Z],
       [31.251, 236.577], [31.279, 235.839], [31.315, 235.472], [31.364, 235.106], [31.505, 234.381], [31.701, 233.67],
       [31.951, 232.975], [32.096, 232.636], [32.424, 231.974], [32.802, 231.34], [33.228, 230.737], [33.698, 230.168],
       [33.95, 229.898], [38.702, 224.977], [38.849, 224.866], [38.934, 224.83]];

module top_ring() {
    rotate_extrude($fn = ROUNDNESS) polygon(TOP);
    thread_extrude(MALE, TOP_Z - 10.1 * K, TOP_Z, TOP_Z - 4.581 * K, 30, 18.0 * K);
}

scale(SCALE) union() {
    collar();
    lattice();
    top_ring();
}
