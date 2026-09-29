// A nut of the parts library (packages/contracts/src/parts/nuts.ts), at its greatest size, given as -D overrides. `npm run
// check:assembly` renders it to check the nuts a model holds (e.g. the litter shovel's handle reinforcement). Its bore is drawn
// at the thread's diameter; the screw in it is drawn at its minor diameter (parts/screws/screw.scad).
// Frame: millimetres, as the parts library's preview: standing on z = 0, the axis along Z, H high (a nylon-insert nut's overall
// height), a hexagon with its corners on the Y axis, or a square with its sides along X and Y.

SQUARE = false;
S = 5.5;   // width across flats
H = 2.4;
D = 3;

difference() {
  if (SQUARE) translate([-S / 2, -S / 2, 0]) cube([S, S, H]);
  else rotate([0, 0, 30]) cylinder(r = S / sqrt(3), h = H, $fn = 6);
  translate([0, 0, -1]) cylinder(d = D, h = H + 2, $fn = 48);
}
