// A piece of a cat collar's strap from the parts library (packages/contracts/src/parts/cat-collars.ts), at the sizes given as -D
// overrides: LENGTH along X, WIDTH along Y, THICKNESS along Z. `npm run check:assembly` renders it to check the accessories a
// model puts on a collar (e.g. the cat collar tag's). Frame: millimetres, as the parts library's preview: lying on z = 0, centred
// on the Z axis.

LENGTH = 60;
WIDTH = 10;
THICKNESS = 1.18;

translate([-LENGTH / 2, -WIDTH / 2, 0]) cube([LENGTH, WIDTH, THICKNESS]);
