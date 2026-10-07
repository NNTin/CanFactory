// A set screw of the parts library (packages/contracts/src/parts/set-screws.ts), at the sizes given as -D overrides. `npm run
// check:assembly` renders it to check the set screws a model holds (e.g. the spring ball detent's adjustable preload). As
// parts/screws/screw.scad, the thread is drawn as a plain shank at its minor diameter (ISO 68-1: d - 1.0825 P), so that it clears
// the hole it is turned into; its hex socket is left out.
// Frame: millimetres, as the parts library's preview: the flat point on z = 0, the axis along Z, the socket end up.

D = 6;
PITCH = 1;
L = 8;

$fn = 64;
cylinder(d = D - 1.0825 * PITCH, h = L);
