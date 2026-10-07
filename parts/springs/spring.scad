// A compression spring of the parts library (packages/contracts/src/parts/springs.ts), at the sizes given as -D overrides. `npm run
// check:assembly` renders it to check the springs a model shows (e.g. the spring ball detent's, beside its body). The wire is drawn
// as a helix at the mean diameter over the free length, its ends left open (unground).
// Frame: millimetres, as the parts library's preview: standing on z = 0, the axis along Z.

D_WIRE = 0.63;
DE = 4.63;
L0 = 9.6;
COILS = 7.5;

$fn = 16;
linear_extrude(height = L0 - D_WIRE, twist = -360 * COILS, slices = ceil(COILS * 24), convexity = 10)
    translate([(DE - D_WIRE) / 2, 0]) circle(d = D_WIRE);
