// Spike 4's spur gear (docs/physics-plan.md): an involute gear drawn with the same formulas as spurGearTooth() in
// packages/contracts/src/spurGear.ts, so that tools/physics/check-physics.ts can compare that function's convex pieces with this
// render. Not a catalogue model. Millimetres; the gear lies on z = 0..WIDTH about the Z axis, tooth 0 centred on +X.
MODULE = 1.5;
TEETH = 20;
WIDTH = 6;
PRESSURE_ANGLE = 20;
BACKLASH = 0.05;   // each tooth thinned by this at the pitch circle
STEPS = 8;

PITCH = MODULE * TEETH / 2;
BASE = PITCH * cos(PRESSURE_ANGLE);
TIP = PITCH + MODULE;
ROOT = PITCH - 1.25 * MODULE;

// the involute function, in degrees: tan(phi) - phi
function inv(phi) = tan(phi) * 180 / PI - phi;
// half the tooth's angle at radius r (degrees)
function half(r) = 90 / TEETH - BACKLASH / (2 * PITCH) * 180 / PI + inv(PRESSURE_ANGLE) - inv(acos(min(1, BASE / r)));
START = max(BASE, ROOT);
RADII = [for (i = [0 : STEPS]) START + (TIP - START) * i / STEPS];
function flank(side) = [for (p = concat(ROOT < BASE ? [[ROOT, half(BASE)]] : [], [for (r = RADII) [r, half(r)]])) [p[0] * cos(side * p[1]), p[0] * sin(side * p[1])]];
function reverse(list) = [for (i = [len(list) - 1 : -1 : 0]) list[i]];
TOOTH = concat(flank(-1), [[TIP, 0]], reverse(flank(1)));

linear_extrude(height = WIDTH) union() {
  circle(r = ROOT, $fn = TEETH * 4);
  for (k = [0 : TEETH - 1]) rotate(360 * k / TEETH) polygon(TOOTH);
}
