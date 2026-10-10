// Simplified reference only: centred XY, adhesive face at z=0, fins +Z.
// Fin/base shape is illustrative; dimensions are the selected part's tolerance maxima.
W = 10;
L = 10;
H = 10;
B = min(1.8, H/4);
F = W/12;
union() {
  translate([-W/2, -L/2, 0]) cube([W, L, B]);
  for (i = [0:3]) translate([-W/2 + i*(W-F)/3, -L/2, B-0.01]) cube([F, L, H-B+0.01]);
}
