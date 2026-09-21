// Moosstab Middle RAUTE small (diamond-lattice tower segment) - parametric OpenSCAD reconstruction.
//
// Adapted from "Moss Tower Verdura - The Modular Climbing Support" by HpInvent (MakerWorld):
// https://makerworld.com/de/models/1200114-moss-tower-verdura-the-modular-climbing-support
// This file is a derivative reconstruction of that design's STL (obj_1_Moosstab Middle RAUTE small.stl) made for
// CanFactory; it grants no additional rights to the original. See ../ATTRIBUTION.md.
//
// A 52 mm tube segment: a female-threaded collar at the bottom, a male-threaded ring at the top, and between them a
// diamond ("Raute") lattice of 2 x COLUMNS helical struts that fan out into V-shaped gussets at both ends.
// Right-handed threads, pitch 5 mm. Units are millimetres; the part is centred on the Z axis with its base on z = 0.
// Source STL sat at (175, 160) on the print plate.
// This file is obj_5_Moosstab Middle RAUTE small.scad scaled by 100/52; only SCALE and this header differ.

// Uniform scale (1 = 52 mm outer diameter).
SCALE        = 100 / 52;
// Facets around a full circle.
ROUNDNESS    = 180; //[48:12:360]

// Struts / gussets around the tube.
COLUMNS      = 6;
// Angle of the first column (gusset axis).
COLUMN_PHASE = 0;
// Rhombus rows.
ROWS         = 4;
// Height where the first row of struts starts, and the height step between rows.
NODE_Z0      = 25.76;
ROW_DZ       = 17.5;
// The gusset's sides are the first struts extended downwards; its apex sits slightly higher than the strut start.
GUSSET_APEX  = 26.36;
GUSSET_INNER_EXT = 19.5;
// Fine adjustment of the top gusset (the lattice is not exactly mirror-symmetric).
TOP_MIRROR_TRIM = 0;
// Height at which the top gusset ends inside the top ring.
TOP_GUSSET_END = 111.5;
// Strut rotation about the axis, degrees per mm of height.
STRUT_TWIST  = 1.656;
OUTER_R      = 26;
LATTICE_INNER_R = 23.013;
// Height of the top thread ring's upper face.
TOP_Z        = 125;

THREAD_PITCH = 5;
THREAD_TURN  = 1;       // 1 = right-handed, -1 = left-handed

// ---- Lattice ------------------------------------------------------------------------------------------------
// The lattice is built slightly oversize in radius and then clipped to a clean revolved envelope (LATTICE_ENVELOPE),
// so its inner and outer faces come from one exact surface instead of many almost-coincident ones.
//
// Rounded, sheared strut section on a horizontal plane: [radius, arc length] about the strut centre; this is the
// ascending strut (angle grows with height); the descending strut is its mirror image. The flat faces at radius 26
// and 23.013 are extended outwards (26.6 / 22.4) for clipping.
STRUT = [[25.773, 1.745], [25.633, 1.88], [25.451, 1.979], [25.282, 2.012], [25.068, 1.99], [23.515, 1.372],
         [23.309, 1.216], [23.196, 1.075], [23.072, 0.823], [23.014, 0.541], [22.4, 0.541], [22.4, -0.876],
         [23.013, -0.876], [23.073, -1.156],
         [23.151, -1.328], [23.255, -1.48], [23.453, -1.658], [23.603, -1.736], [23.76, -1.777], [25.23, -1.974],
         [25.456, -1.938], [25.596, -1.869], [25.721, -1.769], [25.826, -1.639], [25.941, -1.399], [25.995, -1.125],
         [26.6, -1.125], [26.6, 1.053], [26.0, 1.053], [25.985, 1.246], [25.941, 1.431], [25.869, 1.599]];
// The end of the ascending section facing -arc (from the inner extension to the outer one): the gusset's outline.
STRUT_END = [for (i = [11 : 26]) STRUT[i]];
STRUT_ODD = STRUT;
STRUT_END_ODD = STRUT_END;   // (all rows share one strut section in this part)
STRUT_END_FIRST = [22.4, -0.876];

BAR_ANGLE = 180 / COLUMNS;                      // rotation of one strut: half the column spacing
BAR_DZ = BAR_ANGLE / STRUT_TWIST;               // height of one strut
LATTICE_TOP = NODE_Z0 + (ROWS - 1) * ROW_DZ + BAR_DZ; // where the last struts end
// The top gusset is the bottom one mirrored about the plane z = TOP_MIRROR_Z / 2 (the lattice is symmetric).
TOP_MIRROR_Z = NODE_Z0 + LATTICE_TOP + TOP_MIRROR_TRIM;

// Revolved clip: outer radius 26, inner radius 23.013 with the chamfers under the gussets (45 degrees; 0.05 mm inside
// the collar's own chamfer so the two cones are never coincident). It starts 0.06 mm above the collar's inner ledge
// (z = 10) so their horizontal faces are not coplanar.
LATTICE_ENVELOPE = [[20.519, 10.06], [OUTER_R, 10.06], [OUTER_R, TOP_Z - 12], [19.16, TOP_Z - 12], [LATTICE_INNER_R, 109.147 + TOP_Z - 125],
                    [LATTICE_INNER_R, 12.554]];

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
                gusset(a, GUSSET_APEX, 9.5, STRUT_END);
                // Top gusset: the bottom one mirrored (z -> TOP_MIRROR_Z - z).
                translate([0, 0, TOP_MIRROR_Z]) mirror([0, 0, 1]) gusset(a, GUSSET_APEX, TOP_MIRROR_Z - TOP_GUSSET_END, (ROWS - 1) % 2 == 1 ? STRUT_END_ODD : STRUT_END);
            }
        }
    }
}

// ---- Thread helpers -------------------------------------------------------------------------------------------
function tooth_r(table, phase) = lookup(((phase + 0.5) % THREAD_PITCH + THREAD_PITCH) % THREAD_PITCH - 0.5, table);

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
// Groove profile: [phase from the deepest point, radius]; the flat root sits 0.1 mm inside the 18.7 mm wall.
FEMALE = [[-0.5, 19.913], [-0.389, 20.008], [-0.212, 20.109], [0, 20.147], [0.212, 20.109], [0.391, 20.009],
          [1.831, 18.6], [3.157, 18.6], [4.5, 19.913]];
BOTTOM = [[18.7, 0], [26, 0], [26, 10.617], [25.985, 10.773], [25.939, 10.923], [25.865, 11.061], [25.766, 11.183],
          [25.644, 11.282], [25.506, 11.356], [25.356, 11.401], [25.2, 11.418], [22.259, 11.417], [22.102, 11.401],
          [21.952, 11.356], [21.814, 11.282], [21.693, 11.183], [20.509, 10], [18.7, 10]];

module collar() {
    difference() {
        rotate_extrude($fn = ROUNDNESS) polygon(BOTTOM);
        thread_extrude(FEMALE, -1, 10.05, 5.385, 30, 18.0);   // the cutter ends 0.05 above the ledge so their faces are not coplanar
    }
}

// ---- Top ring with external (male) thread ---------------------------------------------------------------------
MALE = [[-0.5, 19.708], [-0.311, 19.892], [-0.15, 19.98], [0, 20.001], [0.15, 19.98], [0.311, 19.892],
        [1.742, 18.5], [3.258, 18.5], [4.5, 19.708]];
TOP = [[21.576, 110.837], [25.2, 110.837], [25.356, 110.853], [25.506, 110.899], [25.708, 111.019], [25.818, 111.13],
       [25.905, 111.261], [25.966, 111.405], [25.996, 111.559], [26, 115], [18.4, 115], [18.4, TOP_Z], [16.25, TOP_Z],
       [16.25, 118.02], [16.265, 117.637], [16.342, 117.066], [16.485, 116.508], [16.615, 116.147], [16.772, 115.797],
       [17.057, 115.297], [17.278, 114.983], [17.653, 114.547], [21, 111.081], [21.108, 110.988], [21.231, 110.916],
       [21.364, 110.866]];

module top_ring() {
    rotate_extrude($fn = ROUNDNESS) polygon(TOP);
    thread_extrude(MALE, TOP_Z - 10.1, TOP_Z, TOP_Z - 4.581, 30, 18.0);
}

scale(SCALE) union() {
    collar();
    lattice();
    top_ring();
}
