// A screw of the parts library (packages/contracts/src/parts/screws.ts), at the sizes given as -D overrides. `npm run
// check:assembly` renders it to check the screws a model holds (e.g. the litter shovel's handle reinforcement). The thread is
// drawn as a plain shank at its minor diameter (ISO 68-1: d - 1.0825 P), so that it clears the bore of the nut or insert it
// turns into, which is drawn at the thread's diameter; the head is drawn at its greatest size.
// Frame: millimetres, as the parts library's preview: the tip on z = 0, the axis along Z, the head up. A countersunk screw's
// length includes its head (a 90 degree cone from the thread up to the head's diameter, then its cylindrical edge); any other
// head (HEAD_D x HEAD_K) sits on top of the length: a hexagon HEAD_S across the flats when HEX (corners on the Y axis, as
// parts/nuts/nut.scad), else round.

COUNTERSUNK = true;
D = 3;
PITCH = 0.5;
L = 12;
HEAD_D = 6;
HEAD_K = 1.7;
HEX = false;
HEAD_S = 5.5;

$fn = 64;
MINOR = D - 1.0825 * PITCH;

if (COUNTERSUNK) {
  cone = (HEAD_D - D) / 2;
  cylinder(d = MINOR, h = L - HEAD_K + 0.01);
  translate([0, 0, L - HEAD_K]) cylinder(d1 = D, d2 = HEAD_D, h = min(cone, HEAD_K));
  if (HEAD_K > cone) translate([0, 0, L - HEAD_K + cone - 0.01]) cylinder(d = HEAD_D, h = HEAD_K - cone + 0.01);
} else {
  cylinder(d = MINOR, h = L + 0.01);
  if (HEX) translate([0, 0, L]) rotate([0, 0, 30]) cylinder(r = HEAD_S / sqrt(3), h = HEAD_K, $fn = 6);
  else translate([0, 0, L]) cylinder(d = HEAD_D, h = HEAD_K);
}
