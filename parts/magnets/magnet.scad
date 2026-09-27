// A magnet of the parts library (packages/contracts/src/parts/magnets.ts), at the sizes given as -D overrides: a disc
// (DIAMETER x HEIGHT), a ring (a disc with a HOLE) or a block (LENGTH x WIDTH x HEIGHT). `npm run check:assembly` renders it at
// the magnet's greatest size, as its pocket is cut, to check the magnets a model holds (e.g. the cigarette case's magnet snap).
// Frame: millimetres, Z is the magnetisation axis (the height), the magnet stands on z = 0, centred on the Z axis.

SHAPE = "disc";   // "disc", "ring" or "block"
DIAMETER = 6;
HOLE = 0;
LENGTH = 10;
WIDTH = 5;
HEIGHT = 2;

$fn = 96;

if (SHAPE == "block")
  translate([-LENGTH / 2, -WIDTH / 2, 0]) cube([LENGTH, WIDTH, HEIGHT]);
else
  difference() {
    cylinder(d = DIAMETER, h = HEIGHT);
    if (HOLE > 0) translate([0, 0, -1]) cylinder(d = HOLE, h = HEIGHT + 2);
  }
