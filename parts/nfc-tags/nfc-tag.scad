// An NFC tag of the parts library (packages/contracts/src/parts/nfc-tags.ts), at the sizes given as -D overrides: a flat disc of
// diameter D and thickness H. `npm run check:assembly` renders it to check the tags a model holds (e.g. the cat collar tag's).
// Frame: millimetres, as the parts library's preview: lying on z = 0, centred on the Z axis.

D = 25;
H = 0.2;

$fn = 96;
cylinder(d = D, h = H);
