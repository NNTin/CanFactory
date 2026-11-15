// Rubber Band Launcher (trigger) - OpenSCAD reconstruction.
//
// Original design: "Rubber Band Launcher" by FerryTeacher (https://cults3d.com/en/users/FerryTeacher), published on
// Cults3D (https://cults3d.com/en/3d-model/game/rubber-band-launcher) under CC BY-NC-SA (Attribution-NonCommercial-
// ShareAlike). This file is a derivative reconstruction of the trigger body of the design's STL (Rubber Band
// Launcher.stl) made for CanFactory, and is shared under the same licence: no commercial use, and adaptations must carry
// the same licence. It grants no additional rights to the original. See ../ATTRIBUTION.md.
//
// Geometry: a 12 mm thick plate (the measured outline, edges rounded with EDGE_R), five lens-shaped grip ridges on its
// front edge, and a conical pivot pin on each face that sits in the frame's conical sockets. Millimetres, in the frame's
// coordinates (frame.scad: modelled flat, then stood up by print_pose): the trigger sits between the frame's side plates
// exactly as in the source STL, its top edge on the print bed beside the frame's, so both files at the same origin are
// the original print-in-place layout.

// Facets around a full circle.
ROUNDNESS = 64; //[32:8:192]
// Slices per quarter round of the rounded edges.
ROUND_STEPS = 6; //[2:1:24]

MID_Z = 10;              // the frame's mid plane
THICKNESS = 12;          // plate, face to face
EDGE_R = 0.9;            // rounded edges of the plate
PIVOT = [20.691, 36.527];// axis of the pivot pins
PIN_TIP_Z = 1.716;       // apex of the lower pin (the upper one is its mirror image about MID_Z)
PIN_SLOPE = 0.84;        // pin radius per mm from its apex
RIDGE_TIPS = [[7.14, 11.54], [7.52, 8.81], [7.88, 6.07], [8.16, 3.27], [8.34, 0.51]];
RIDGE_NORMAL = [-0.994, -0.107]; // outward normal of the front edge at the ridges
RIDGE_HEIGHT = 0.54;     // how far a ridge stands out at the mid plane
RIDGE_WIDTH = 1.14;      // along the edge
RIDGE_LENGTH = 8;        // through the thickness
FRAME_THICKNESS = 20.6;  // the frame's thickness, including its embossed plus (for print_pose)
TOP_Y = 54.813;          // top edge, which the print stands on, level with the frame's

// Measured outline (x, y) at 2 mm from the face, counter-clockwise.
TRIGGER = [
    [9.80,-1.92], [10.09,-2.09], [10.40,-2.21], [10.91,-2.28], [11.24,-2.26], [13.15,-1.76], [14.87,-1.21],
    [16.56,-0.58], [18.22,0.13], [19.09,0.54], [20.63,1.34], [22.19,2.25], [23.71,3.23], [25.17,4.28], [26.58,5.41],
    [27.94,6.60], [29.24,7.85], [30.47,9.17], [31.64,10.54], [32.74,11.97], [33.27,12.70], [34.26,14.21],
    [35.18,15.76], [35.59,16.51], [36.17,19.61], [36.83,22.72], [37.40,25.09], [38.01,27.33], [38.68,29.46],
    [39.40,31.46], [40.20,33.33], [40.84,34.61], [41.45,35.68], [42.10,36.68], [42.80,37.62], [43.58,38.53],
    [44.15,39.13], [44.90,39.85], [47.19,41.85], [48.14,42.72], [49.01,43.61], [49.82,44.55], [50.57,45.56],
    [51.29,46.66], [52.11,48.13], [52.79,49.54], [53.41,51.01], [53.48,51.47], [53.42,51.86], [53.33,52.10],
    [53.10,52.52], [52.56,53.36], [51.95,54.15], [51.57,54.57], [51.27,54.75], [50.92,54.81], [31.90,54.81],
    [31.64,54.77], [31.48,54.71], [31.26,54.57], [31.09,54.39], [11.63,27.27], [10.31,25.29], [9.49,23.94],
    [8.70,22.43], [8.17,21.20], [7.94,20.54], [7.70,19.66], [7.56,19.02], [7.42,18.03], [7.35,17.21], [7.33,16.31],
    [7.40,14.46], [7.68,11.83], [7.67,11.63], [7.73,11.44], [8.06,9.08], [8.05,8.88], [8.11,8.69], [8.18,8.18],
    [8.42,6.34], [8.41,6.13], [8.47,5.94], [8.55,5.14], [8.71,3.60], [8.68,3.39], [8.74,3.18], [8.80,2.37],
    [8.89,0.87], [8.85,0.63], [8.91,0.41], [8.95,-0.51], [9.08,-1.00], [9.22,-1.31], [9.42,-1.58]];

FACE_Z = MID_Z - THICKNESS / 2;

module plate() {
    r = EDGE_R;
    for (i = [0 : ROUND_STEPS - 1]) let (t0 = 90 * i / ROUND_STEPS, t1 = 90 * (i + 1) / ROUND_STEPS, g = -r + r * sin((t0 + t1) / 2))
        for (z = [[FACE_Z + r - r * cos(t0), FACE_Z + r - r * cos(t1)], [MID_Z * 2 - FACE_Z - r + r * cos(t1), MID_Z * 2 - FACE_Z - r + r * cos(t0)]])
            translate([0, 0, z[0]]) linear_extrude(z[1] - z[0]) offset(delta = g) polygon(TRIGGER);
    translate([0, 0, FACE_Z + r]) linear_extrude(THICKNESS - 2 * r) polygon(TRIGGER);
}

module ridges() {
    for (p = RIDGE_TIPS) {
        c = p - RIDGE_HEIGHT * RIDGE_NORMAL;
        translate([c[0], c[1], MID_Z]) scale([RIDGE_HEIGHT, RIDGE_WIDTH / 2, RIDGE_LENGTH / 2]) sphere(1, $fn = 24);
    }
}

module pins() {
    h = FACE_Z + EDGE_R - PIN_TIP_Z;
    module pin() translate([PIVOT[0], PIVOT[1], PIN_TIP_Z]) cylinder(h = h, r1 = 0, r2 = h * PIN_SLOPE, $fn = ROUNDNESS);
    pin();
    translate([0, 0, 2 * MID_Z]) mirror([0, 0, 1]) pin();
}

// Stand up as the frame does (frame.scad, print_pose).
module print_pose() translate([0, -FRAME_THICKNESS / 2, TOP_Y]) rotate([-90, 0, 0]) children();

print_pose() union() { plate(); ridges(); pins(); }
