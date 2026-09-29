// Litter shovel, part 3 of 3: the handle. An original CanFactory design, published under CC BY 4.0.
//
// The top of the stack container, scoop, handle: a closed ring that comes down around the base of the scoop's blade and sits
// flat on the scoop's cap, flush with its skirt, and the palm side of the shovel's grip. The grip leaves the ring at the front
// (+X), comes over the container's own handle and runs down along its bar: the container's bar is the finger side, this is the
// palm side, and on their matching faces the two halves make one grip. Held in the fist, they clamp the container to the
// handle, with the scoop's cap between the container's lip and the ring (docs/litter-shovel.md).
//
// Modelled as it prints: upside down, the ring's top on the bed at Z = 0, so that the grip rises from it; nothing needs
// support. In use it is turned over (the assembly's pose), and the ring's underside sits on the scoop's cap at Z = 144.5 in the
// container's frame. In `detent` mode grooves in the ring take the bumps on the blade's base.

// How the ring holds on the blade's base: a close fit only, or a detent (bumps on the blade, grooves in the ring)
HANDLE_SNAP = "detent"; //[friction,detent]
// Gap per side between mating surfaces, in mm
CLEARANCE = 0.2; //[0.1:0.01:0.6]
// How far the blade's bumps reach past the ring's wall, in mm, on top of the clearance
HANDLE_DETENT_ENGAGE = 0.15; //[0.02:0.01:0.4]

$fa = 4; $fs = 0.5;
E = 0.01;

// The scoop's cap (its skirt's outer face, which the ring is flush with) and its blade's outer face (scoop.scad), as outer plans
// [width (X), length (Y), corner radius]; the cap's top, in the container's frame.
CAP_OUT = [88.9, 121.2, 21.2];
BLADE = [81.7, 114, 17.6];
CAP_TOP_Z = 144.5;
// Ring height.
RING_H = 15;
// The container's handle (container.scad): its width, its bar's outer (mating) face, its arm's flat top and the curve between.
GRIP_W = 26; BAR_X1 = 76; TOP_Z = 131; CURVE_R = 20;
// This half of the grip: the gap to the container's handle on their matching faces, its thickness along the bar, the height
// its bar runs down to (in the container's frame), the curve of its outer face from the ring's top into the bar, and the
// rounding of its palm-side edges.
GRIP_GAP = 0.4; GRIP_T = 12; GRIP_Z0 = 60; OUTER_R = 26; GRIP_R = 5;
// Detent grooves: 4 mm up the ring, facing the blade's bumps; their length along the wall.
DETENT_Z = 4; DETENT_L = 16;

function grow(p, d) = [p[0] + 2 * d, p[1] + 2 * d, p[2] + d];
module rr2d(p) { offset(r = p[2], $fn = 64) square([p[0] - 2 * p[2], p[1] - 2 * p[2]], center = true); }
module slab(p, z, h) { translate([0, 0, z]) linear_extrude(h) rr2d(p); }

RING_IN = grow(BLADE, CLEARANCE);
RING_TOP_Z = CAP_TOP_Z + RING_H;
BAR_IN = BAR_X1 + GRIP_GAP;            // this half's inner (mating) face
BAR_OUT = BAR_IN + GRIP_T;             // its outer (palm) face

// Places children on the middle of each straight side of plan `p`, in the wall's frame (X along the wall, Y outward).
module on_sides(p) {
  for (s = [-1, 1]) {
    translate([s * p[0] / 2, 0, 0]) rotate([0, 0, -s * 90]) children();
    translate([0, s * p[1] / 2, 0]) rotate([0, 0, s > 0 ? 0 : 180]) children();
  }
}

// The groove a bump of engagement `g` clicks into, in the mating wall's frame (the wall's face at Y = 0, the groove going
// towards +Y, into the wall): `g` + clearance deep, clearing the bump by the clearance on every side. Its flanks start 0.3 mm
// in front of the face, so that no edge of it lies in the face.
module groove(l, g) {
  c = CLEARANCE; d = g + c; w = g + c * sqrt(2); o = 0.3;
  hull() {
    translate([-(l / 2 + 2 * c + o), -o, -(w + o)]) cube([l + 4 * c + 2 * o, E, 2 * (w + o)]);
    translate([-(l / 2 + 2 * c - d), d - E, -(w - d)]) cube([l + 4 * c - 2 * d, E, 2 * (w - d)]);
  }
}

// The grip, in the container's frame: a side profile (XZ) from the ring's outer face out over the container's handle and down
// along its bar, whose outer face curves from the ring's top into the bar and whose lower end is round. Its inner face is the
// container's handle profile grown by GRIP_GAP, and it stays a clearance outside the scoop's skirt below the ring. The bar's
// palm-side edges are rounded.
module grip() {
  x0 = CAP_OUT[0] / 2;
  arc = [for (i = [0 : 16]) let(a = 90 - 90 * i / 16) [BAR_OUT - OUTER_R + OUTER_R * cos(a), RING_TOP_Z - OUTER_R + OUTER_R * sin(a)]];
  outline = concat([[x0 - 1, RING_TOP_Z]], arc, [[BAR_OUT, GRIP_Z0], [BAR_IN, GRIP_Z0], [BAR_IN, TOP_Z - CURVE_R],
                    [BAR_X1 - CURVE_R, TOP_Z + GRIP_GAP], [x0 - 1, TOP_Z + GRIP_GAP]]);
  intersection() {
    translate([0, GRIP_W / 2, 0]) rotate([90, 0, 0]) linear_extrude(GRIP_W) difference() {
      union() {
        offset(r = GRIP_T / 2 - 0.5) offset(delta = -(GRIP_T / 2 - 0.5)) polygon(outline);
        // the root, where the grip meets the ring, stays square
        translate([x0 - 1, CAP_TOP_Z]) square([9, RING_H]);
      }
      offset(r = GRIP_GAP) container_profile();
      translate([x0 - 2, -1]) square([2 + CLEARANCE, CAP_TOP_Z + 1]);
    }
    linear_extrude(RING_TOP_Z + 1) union() {
      translate([BAR_OUT - 3 * GRIP_R, -GRIP_W / 2]) offset(r = GRIP_R) offset(delta = -GRIP_R) square([3 * GRIP_R, GRIP_W]);
      translate([-100, -GRIP_W / 2]) square([100 + BAR_OUT - GRIP_R, GRIP_W]);
    }
  }
}

// The container's handle's side profile (container.scad's grip_profile).
module container_profile() { offset(r = CURVE_R) offset(delta = -CURVE_R) translate([-100, -100]) square([BAR_X1 + 100, TOP_Z + 100]); }

// The handle in the container's frame, as used.
module handle() {
  difference() {
    union() {
      slab(CAP_OUT, CAP_TOP_Z, RING_H);
      grip();
    }
    slab(RING_IN, CAP_TOP_Z - 1, RING_H + 2);
    if (HANDLE_SNAP == "detent") translate([0, 0, CAP_TOP_Z + DETENT_Z]) on_sides(RING_IN) groove(DETENT_L, HANDLE_DETENT_ENGAGE);
  }
}

// Turned over to print: the ring's top on the bed.
rotate([180, 0, 0]) translate([0, 0, -RING_TOP_Z]) handle();
