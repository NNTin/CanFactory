// Adjustable miter box: an original CanFactory design, published under CC BY 4.0.
//
// One base, printed with the fence's two halves and the hold-downs' sockets, and a turntable whose arm carries the saw guide: two
// slotted posts on a line through the pivot, one behind the fence's face and one in front of the stock. The turntable turns in a
// round socket in the base; two stainless dowel pins, pushed in from behind through the fence's ends, reach over its rim and
// hold it in. A knob on its arm locks it at any angle: the knob's screw turns down through a nut in a pocket under the arm onto
// the base's floor. An index pin dropped through the turntable into holes in the base stops it at 0, ±22.5 and ±45°; a scale is
// engraved round the arm's tip, where the kerf groove points at it. Two hold-downs stand in sockets behind the fence, a dowel pin across each: each presses a
// thrust pad down onto the stock with a screw through a T-nut that slides along the hold-down's slot. The base takes no nuts.
//
// The knobs and the thrust pads are the pressure pad's (models/pressure-pad/generator.scad), not this file's.
//
// Frame: X along the fence, Y from the fence's face (y = 0) towards the user, Z up; the base's bottom at z = 0, the bed at
// z = BED, the pivot at x = y = 0. Every dimension comes from LAYOUT, a list of [name, value] pairs written by
// packages/contracts/src/miterBox.ts (miterBoxScadValues), which also places the parts in the assembly. Each part is drawn where it
// goes and then moved (and turned) to lie on the print bed as it prints.

// ---------------------------------------------------------------

// Which piece to make
PART = "base"; //[base,turntable,holddown]
LAYOUT = [];
// The library parts' sizes (largest values): the regular nut, and the clamp screw (only for the cache fingerprint here).
NUT_D = 6; NUT_S = 10; NUT_M = 5.2;
SCREW_D = 6; SCREW_S = 10; SCREW_K = 4.15;

function L(name) = let(i = search([name], LAYOUT, 1, 0)[0]) assert(i != undef && i != [], str("LAYOUT has no ", name)) LAYOUT[i][1];

BED = L("BED"); APRON = L("APRON"); ARM = L("ARM"); KERF_DEPTH = L("KERF_DEPTH");
SLOT = L("SLOT"); POST_W = L("POST_W"); POST_L = L("POST_L"); POST_H = L("POST_H"); LEAD = L("LEAD");
REAR_POST = L("REAR_POST"); FRONT_POST = L("FRONT_POST"); TURNTABLE = L("TURNTABLE");
ARM_HALF = L("ARM_HALF"); ARM_TIP = L("ARM_TIP"); KNOB_X = L("KNOB_X"); KNOB_Y = L("KNOB_Y"); WING_R = L("WING_R"); MAX_ANGLE = L("MAX_ANGLE");
CHANNEL = L("CHANNEL"); FENCE = L("FENCE"); FENCE_H = L("FENCE_H"); FENCE_START = L("FENCE_START");
HOLE = L("HOLE"); NS = L("NUT_S"); NM = L("NUT_M"); SD = L("SCREW_D"); LOCK_POCKET = L("LOCK_POCKET");
PIN_X = L("PIN_X"); PIN_Y = L("PIN_Y"); PIN_R = L("PIN_R"); PIN_DEPTH = L("PIN_DEPTH"); STOPS = L("STOPS");
RETAIN_D = L("RETAIN_D"); RETAIN_X = L("RETAIN_X"); RETAIN_Y = L("RETAIN_Y"); RETAIN_Z = L("RETAIN_Z"); RETAIN_ANGLE = L("RETAIN_ANGLE");
HOLD_W = L("HOLD_W"); COLUMN_BACK = L("COLUMN_BACK"); COLUMN_FRONT = L("COLUMN_FRONT"); SOCKET_FLOOR = L("SOCKET_FLOOR"); BLOCK_BACK = L("BLOCK_BACK");
HOLD_PIN_L = L("HOLD_PIN_L"); HOLD_PIN_D = L("HOLD_PIN_D"); HOLD_PIN_PLAY = L("HOLD_PIN_PLAY"); HOLD_PIN_Y = L("HOLD_PIN_Y"); HOLD_PIN_Z = L("HOLD_PIN_Z");
SLOT_FROM = L("SLOT_FROM"); SLOT_TO = L("SLOT_TO"); BEAM_TIP = L("BEAM_TIP"); BEAM_BOTTOM = L("BEAM_BOTTOM"); BEAM_TOP = L("BEAM_TOP"); HOLD_X = L("HOLD_X");
SCALE_FROM = L("SCALE_FROM"); TICK = L("TICK"); TICK_LONG = L("TICK_LONG"); LABEL_AT = L("LABEL_AT"); LABELS = L("LABELS");
ENGRAVE = L("ENGRAVE"); LINE = L("LINE"); LABEL_SIZE = L("LABEL_SIZE");
HALF_LENGTH = L("HALF_LENGTH"); BACK = L("BACK"); FRONT = L("FRONT"); FIT = L("FIT");
BENCH_HOLE = L("BENCH_HOLE"); BENCH_SINK = L("BENCH_SINK");

ROUNDNESS = 96; //[48,96,144]
$fn = ROUNDNESS;
E = 0.01;
NUT_E = NS*2/sqrt(3);

// ---------------------------------------------------------------
// The turntable's arm in plan, in its own frame (its line along +Y): the disc, the bar to the tip, the knob's wing.

module bar_plan() { translate([-ARM_HALF, 0]) square([2*ARM_HALF, ARM_TIP]); }
module wing_plan() { hull() { translate([KNOB_X, KNOB_Y]) circle(r = WING_R); translate([KNOB_X, KNOB_Y - WING_R]) square([ARM_HALF - KNOB_X, 2*WING_R]); } }
module arm_plan() { circle(r = TURNTABLE); bar_plan(); wing_plan(); }

// The ground the arm sweeps over its whole swing (each convex piece hulled between turns 2° apart), for the base's recess.
SWEEP_STEP = 2;
module arm_sweep() {
    circle(r = TURNTABLE);
    for (a = [-MAX_ANGLE : SWEEP_STEP : MAX_ANGLE - E]) {
        hull() { rotate(a) bar_plan(); rotate(a + SWEEP_STEP) bar_plan(); }
        hull() { rotate(a) wing_plan(); rotate(a + SWEEP_STEP) wing_plan(); }
    }
}

// ---------------------------------------------------------------
// The turntable: the disc and its arm (the bed round the cut), the two slotted guide posts, the kerf groove along the line.

module post(y) {
    difference() {
        translate([-POST_W/2, y - POST_L/2, BED - E]) cube([POST_W, POST_L, POST_H + E]);
        // a lead-in at the slot's top
        hull() {
            translate([-SLOT/2, y - POST_L/2 - 1, BED + POST_H - LEAD]) cube([SLOT, POST_L + 2, E]);
            translate([-SLOT/2 - LEAD, y - POST_L/2 - 1, BED + POST_H + E]) cube([SLOT + 2*LEAD, POST_L + 2, E]);
        }
    }
}

module turntable() {
    difference() {
        union() {
            translate([0, 0, BED - ARM]) linear_extrude(ARM) arm_plan();
            post(-REAR_POST);
            post(FRONT_POST);
        }
        // the saw's line: the kerf groove along the whole arm (it points at the scale) and the slots through both posts
        translate([-SLOT/2, -TURNTABLE - 1, BED - KERF_DEPTH]) cube([SLOT, TURNTABLE + ARM_TIP + 2, POST_H + KERF_DEPTH + 1]);
        // the lock screw's hole, the lock nut's pocket from below (its flats along the arm's X), and the index pin's hole
        translate([KNOB_X, KNOB_Y, BED - ARM - 1]) cylinder(d = HOLE, h = ARM + 2, $fn = 48);
        translate([KNOB_X, KNOB_Y, BED - ARM - 1]) cylinder(r = (NS + 2*FIT)/sqrt(3), h = LOCK_POCKET + 1, $fn = 6);
        translate([PIN_X, PIN_Y, BED - ARM - 1]) cylinder(r = PIN_R, h = ARM + 2, $fn = 48);
    }
}

// ---------------------------------------------------------------
// The base, in one piece: a slab, the raised bed strip, the fence's two halves (stopping short of the turntable's socket), the
// hold-downs' sockets behind the fence, the turntable's socket and the arm's recess, the index pin's stops, the retaining pins'
// bores through the fence's ends, holes for bench screws, the scale. No nuts: the lock's screw presses on the recess's floor.

// A countersunk wood screw's hole down through the slab.
module bench_hole(x, y) {
    top = BED - APRON;
    translate([x, y, -1]) cylinder(d = BENCH_HOLE, h = top + 2, $fn = 32);
    translate([x, y, top - (BENCH_SINK - BENCH_HOLE)/2]) cylinder(d1 = BENCH_HOLE, d2 = BENCH_SINK, h = (BENCH_SINK - BENCH_HOLE)/2 + E, $fn = 32);
    translate([x, y, top]) cylinder(d = BENCH_SINK, h = 1, $fn = 32);
}

// The scale: a tick every TICK° (longer every 15° and at the stops), labels at LABELS, where the arm's kerf groove points
// (its line turned to the angle).
module scale_marks() {
    for (a = [-MAX_ANGLE : TICK : MAX_ANGLE]) tick(a);
    for (a = [-22.5, 22.5]) tick(a);
    for (v = LABELS) for (s = v == 0 ? [1] : [-1, 1]) {
        a = s*v;
        rotate(a) translate([0, LABEL_AT]) rotate(180 - a) rotate(a) linear_extrude(ENGRAVE + 1)
            text(str(v), size = LABEL_SIZE, font = "Liberation Sans:style=Bold", halign = "center", valign = "center");
    }
}
module tick(a) {
    major = abs(a) % 15 == 0 || abs(a) == 22.5;
    length = (a == 0 || abs(a) == 22.5 || abs(a) == 45) ? TICK_LONG : major ? TICK_LONG*0.75 : TICK_LONG/2;
    rotate(a) translate([-LINE/2, SCALE_FROM]) linear_extrude(ENGRAVE + 1) square([LINE, length]);
}

// A horizontal hole along X (a pin's), from x0 to x1, its top pointed so that it prints without support.
module pin_hole(x0, x1, y, z, d) {
    translate([x0, y, z]) rotate([0, 90, 0]) linear_extrude(x1 - x0) rotate(180) teardrop(d/2);
}
// A circle with a 45° point towards +X (the hole's top once it is turned to lie along X).
module teardrop(r) { circle(r = r, $fn = 32); polygon([[r*sqrt(2), 0], [r/sqrt(2), r/sqrt(2)], [r/sqrt(2), -r/sqrt(2)]]); }

module base() {
    top = BED - APRON;
    block_half = HOLD_PIN_L/2;
    difference() {
        union() {
            translate([-HALF_LENGTH, BACK, 0]) cube([2*HALF_LENGTH, FRONT - BACK, top]);
            // the bed and the fence's strip
            translate([-HALF_LENGTH, -FENCE, 0]) cube([2*HALF_LENGTH, FENCE + CHANNEL, BED]);
            for (s = [-1, 1]) {
                // the fence's half, from beyond the socket to the base's end
                translate([s > 0 ? FENCE_START : -HALF_LENGTH, -FENCE, 0]) cube([HALF_LENGTH - FENCE_START, FENCE, BED + FENCE_H]);
                // the hold-down's socket block, behind the fence and as high
                translate([s*HOLD_X - block_half, BLOCK_BACK, 0]) cube([2*block_half, -FENCE - BLOCK_BACK + E, BED + FENCE_H]);
            }
        }
        // the turntable's socket and the arm's recess
        translate([0, 0, BED - ARM]) cylinder(r = TURNTABLE + FIT, h = ARM + 1, $fn = 4*ROUNDNESS);
        translate([0, 0, BED - ARM]) linear_extrude(ARM + 1) offset(delta = FIT) arm_sweep();
        // the index pin's stops
        for (a = STOPS) for (s = a == 0 ? [1] : [-1, 1]) rotate(s*a)
            translate([PIN_X, PIN_Y, BED - ARM - PIN_DEPTH]) cylinder(r = PIN_R, h = PIN_DEPTH + 1, $fn = 48);
        for (s = [-1, 1]) {
            // the turntable's retaining pin's bore: from its tip over the turntable's rim, back through the fence's end at
            // RETAIN_ANGLE° in plan and out of its back face (the pin is pushed in from behind)
            translate([s*RETAIN_X, RETAIN_Y, 0]) rotate(s > 0 ? -RETAIN_ANGLE : 180 + RETAIN_ANGLE)
                pin_hole(-1, (FENCE + RETAIN_Y)/sin(RETAIN_ANGLE) + RETAIN_D + 2, 0, RETAIN_Z, RETAIN_D);
            // the hold-down's socket, and its pin's hole across the block
            translate([s*HOLD_X - HOLD_W/2 - FIT, COLUMN_BACK - FIT, SOCKET_FLOOR]) cube([HOLD_W + 2*FIT, COLUMN_FRONT - COLUMN_BACK + 2*FIT, BED + FENCE_H]);
            pin_hole(s*HOLD_X - block_half - 1, s*HOLD_X + block_half + 1, HOLD_PIN_Y, HOLD_PIN_Z, HOLD_PIN_D);
        }
        // bench screws at the corners
        for (x = [-1, 1]) for (y = [BACK + 7, FRONT - 7]) bench_hole(x*(HALF_LENGTH - 7), y);
        translate([0, 0, top - ENGRAVE]) scale_marks();
    }
}

// ---------------------------------------------------------------
// A hold-down, centred on x = 0: a column standing in its socket behind the fence (a dowel pin across it), and a beam over the
// stock, with a gusset over the fence. Its slot takes the clamp screw; a nut slides in the channel under it.

module holddown() {
    w = HOLD_W;
    fence_top = BED + FENCE_H;
    gusset = min(-1 - COLUMN_FRONT, BEAM_BOTTOM - fence_top - 0.5);
    difference() {
        union() {
            translate([-w/2, COLUMN_BACK, SOCKET_FLOOR]) cube([w, COLUMN_FRONT - COLUMN_BACK, BEAM_TOP - SOCKET_FLOOR]);
            translate([-w/2, COLUMN_BACK, BEAM_BOTTOM]) cube([w, BEAM_TIP - COLUMN_BACK, BEAM_TOP - BEAM_BOTTOM]);
            translate([-w/2, 0, 0]) rotate([90, 0, 90]) linear_extrude(w) polygon([
                [COLUMN_FRONT - E, BEAM_BOTTOM - gusset], [COLUMN_FRONT + gusset, BEAM_BOTTOM + E], [COLUMN_FRONT - E, BEAM_BOTTOM + E]]);
        }
        // the slot, and the T-nut's channel under it (open below; the nut's flats against its walls)
        hull() for (y = [SLOT_FROM, SLOT_TO]) translate([0, y, BEAM_BOTTOM - 1]) cylinder(d = SD + 2*FIT, h = BEAM_TOP - BEAM_BOTTOM + 2, $fn = 32);
        translate([-(NS/2 + FIT), SLOT_FROM - NUT_E/2 - 0.5, BEAM_BOTTOM - 1]) cube([NS + 2*FIT, SLOT_TO - SLOT_FROM + NUT_E + 1, NM + FIT + 1]);
        // the dowel pin's hole across the column (a slip fit: the pin is pressed into the socket's walls); round, as the
        // hold-down prints on its side with this hole upright
        translate([-w/2 - 1, HOLD_PIN_Y, HOLD_PIN_Z]) rotate([0, 90, 0]) cylinder(d = HOLD_PIN_D + 2*HOLD_PIN_PLAY, h = w + 2, $fn = 32);
    }
}

// ---------------------------------------------------------------
// Each piece as it prints (the assembly's poses undo these moves).

if (PART == "base") base();
else if (PART == "turntable") translate([0, 0, -(BED - ARM)]) turntable();
// on its side: the U of column and beam flat on the bed
else if (PART == "holddown") translate([0, 0, HOLD_W/2]) rotate([0, 90, 0]) holddown();
else assert(false, str("Unknown PART ", PART));
