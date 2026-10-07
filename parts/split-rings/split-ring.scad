// A split ring of the parts library (packages/contracts/src/parts/split-rings.ts), at the sizes given as -D overrides: two flat
// turns of the band, one on the other, from the inside diameter D_IN to the outside diameter D_OUT, THICKNESS over both turns.
// `npm run check:assembly` renders it to check the rings a model hangs on (e.g. the cat collar tag's). Frame: millimetres, as the
// parts library's preview: lying on z = 0, centred on the Z axis. Drawn as one closed ring (the split and the turns' gap left out).

D_OUT = 17.02;
D_IN = 13.36;
THICKNESS = 2.67;

$fn = 96;
difference() {
  cylinder(d = D_OUT, h = THICKNESS);
  translate([0, 0, -1]) cylinder(d = D_IN, h = THICKNESS + 2);
}
