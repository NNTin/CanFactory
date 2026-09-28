// Litter shovel, part 3 of 3: the handle. An original CanFactory design, published under CC BY 4.0.
//
// The top of the stack container, scoop, handle: a closed ring that comes down around the base of the scoop's blade and sits
// flat on the scoop's cap, flush with its skirt, and a pan-style grip: a closed loop pointing straight out at the front (+X).
// Just under the grip's root lies the container's finger lever, as wide as the grip, so the two make one grip. The index finger
// pulls the lever up and the palm presses the grip down, which pinches the scoop's cap between the ring and the container's lip
// and clamps the three parts together (docs/litter-shovel.md).
//
// Modelled as it prints: flat underside down at Z = 0, which sits on the scoop's cap (Z = 144.5 in the container's frame). The
// ring and the grip both stand on that face, so nothing needs support, and the grip's layers run along it. In `detent` mode
// grooves in the ring take the bumps on the blade's base.

// How the ring holds on the blade's base: a close fit only, or a detent (bumps on the blade, grooves in the ring)
HANDLE_SNAP = "detent"; //[friction,detent]
// Gap per side between mating surfaces, in mm
CLEARANCE = 0.2; //[0.1:0.01:0.6]
// How far the blade's bumps reach past the ring's wall, in mm, on top of the clearance
HANDLE_DETENT_ENGAGE = 0.15; //[0.02:0.01:0.4]

$fa = 4; $fs = 0.5;
E = 0.01;

// The scoop's cap (its skirt's outer face, which the ring is flush with) and its blade's outer face (scoop.scad), as outer plans
// [width (X), length (Y), corner radius].
CAP_OUT = [88.9, 121.2, 21.2];
BLADE = [81.7, 114, 17.6];
// Ring height.
RING_H = 15;
// Grip: a closed loop from the ring out to GRIP_X, GRIP_W wide (Y) and GRIP_H high, with fully rounded ends; the finger slot in
// it runs from SLOT_X0 (past the container's finger lever, under the solid root) to SLOT_X1 and is SLOT_W wide.
GRIP_X = 154.45; GRIP_W = 34; GRIP_H = 20;
SLOT_X0 = 74; SLOT_X1 = 140; SLOT_W = 12;
// Top edges of the ring and the grip are eased by a 2 mm, 45 degree chamfer, in steps of CHAMFER_STEP.
CHAMFER = 2; CHAMFER_STEP = 0.25;
// Detent grooves: 4 mm up the ring, facing the blade's bumps; their length along the wall.
DETENT_Z = 4; DETENT_L = 16;

function grow(p, d) = [p[0] + 2 * d, p[1] + 2 * d, p[2] + d];
module rr2d(p) { offset(r = p[2], $fn = 64) square([p[0] - 2 * p[2], p[1] - 2 * p[2]], center = true); }

RING_IN = grow(BLADE, CLEARANCE);

// The handle's plan: the ring, and the grip from inside the ring out to its rounded end, less the finger slot and the blade.
module plan() {
  difference() {
    union() {
      rr2d(CAP_OUT);
      translate([0, -GRIP_W / 2]) offset(r = GRIP_W / 2 - E) offset(delta = -(GRIP_W / 2 - E)) square([GRIP_X, GRIP_W]);
    }
    translate([SLOT_X0, -SLOT_W / 2]) offset(r = SLOT_W / 2 - E) offset(delta = -(SLOT_W / 2 - E)) square([SLOT_X1 - SLOT_X0, SLOT_W]);
    rr2d(RING_IN);
  }
}

// The grip's part of the plan (outside the ring).
module grip_plan() { difference() { plan(); rr2d(CAP_OUT); } }

// A prism of plan `h` high whose top edges are eased by the chamfer, in steps.
module chamfered(h) {
  steps = round(CHAMFER / CHAMFER_STEP);
  linear_extrude(h - CHAMFER) children();
  for (i = [1 : steps]) translate([0, 0, h - CHAMFER + (i - 1) * CHAMFER_STEP])
    linear_extrude(CHAMFER_STEP) offset(delta = -i * CHAMFER_STEP) children();
}

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

difference() {
  union() {
    chamfered(RING_H) difference() { rr2d(CAP_OUT); rr2d(RING_IN); }
    chamfered(GRIP_H) grip_plan();
    // where the grip meets the ring, the ring's own chamfer is filled up to the grip's height
    linear_extrude(RING_H) intersection() { plan(); translate([0, -GRIP_W / 2]) square([GRIP_X, GRIP_W]); }
  }
  if (HANDLE_SNAP == "detent") translate([0, 0, DETENT_Z]) on_sides(RING_IN) groove(DETENT_L, HANDLE_DETENT_ENGAGE);
}
