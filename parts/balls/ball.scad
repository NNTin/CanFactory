// A ball of the parts library (packages/contracts/src/parts/balls.ts), at the size given as a -D override. `npm run check:assembly`
// renders it to check the balls a model holds (e.g. the spring ball detent's). Frame: millimetres, as the parts library's preview:
// standing on z = 0, its centre at z = D / 2. D is the largest diameter of its grade.

D = 4.5;

$fn = 64;
translate([0, 0, D / 2]) sphere(d = D);
