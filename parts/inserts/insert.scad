// A heat-set insert of the parts library (packages/contracts/src/parts/inserts.ts), as installed, given as -D overrides. `npm run
// check:assembly` renders it to check the inserts a model holds (e.g. the litter shovel's handle reinforcement). Melted in, the
// insert fills the printed hole it was pushed into, so it is drawn as that hole's diameter (HOLE, not its wider knurls), L long,
// with its bore at the thread's diameter; the screw in it is drawn at its minor diameter (parts/screws/screw.scad).
// Frame: millimetres, as the parts library's preview: its leading end on z = 0, the axis along Z.

HOLE = 4;
L = 5.7;
D = 3;

difference() {
  cylinder(d = HOLE, h = L, $fn = 48);
  translate([0, 0, -1]) cylinder(d = D, h = L + 2, $fn = 48);
}
