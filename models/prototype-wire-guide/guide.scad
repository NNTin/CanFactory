// CanFactory prototype-board wire guide: one printed piece of a wire-guide design (#152, #170, docs/wire-guide.md): a whole print,
// one separate layer of a print, or one of its separate pegs.
//
// Every number comes from trusted code: wireGuideScad (packages/contracts/src/prototypeWireGuide.ts) works out each print's
// plate, channels, bridges, funnels, pockets and registration from the validated design and passes them as GUIDE, a list
// with one entry per print; PRINT picks this file's print. Nothing of the design but numbers reaches this file.
//
// Frame: the board's (mm). The PCB's underside on z = 0, its corner at the origin, seen from the component side: columns
// along +X, rows along +Y. The print is drawn where it sits on the board, channels open upwards.
//
// GUIDE[PRINT] = [
//   [x0, y0, pitch],                         grid: hole (c, r) at (x0 + c * pitch, y0 + r * pitch)
//   [bx0, by0, bx1, by1, zBase, zTop],       the block
//   plateTop,                                the plate's top, the lowest channel floor
//   [[floor, bridgeBottom], ...],            per channel layer, lowest first (bridgeBottom -1 for the lowest)
//   [[layer, width, [c0, r0, c1, r1, ...]], ...],   wires: their layer, channel width and grid points
//   [[x, y, bottomD, topD], ...],            funnels at the wire ends
//   [[kind, x, y, a, b, top], ...],          pockets: kind 0 a box (x, y, w = a, h = b), 1 a cylinder (centre x, y, d = a)
//   [[x, y, columnD, pinD, pinBottom, columnBottom, top], ...],   mounting-hole bosses (columnBottom -1: no column)
//   [[x, width], ...],                       edge clips at y = 0 and y = W
//   [L, W, t],                               the board
//   layered,                                 1: made as separate layers and pegs (no bosses: holes for the pegs), 0: one piece
//   [[zBottom, zTop], ...],                  layers, lowest first: the slice of the block each is (layered only)
//   [[x, y, d, bottom, top], ...],           the pegs' holes, from `bottom` to `top` (layered only)
//   [[[r, z], ...], ...],                    each peg's outline off its axis, bottom to top, from its lowest point at z = 0
// ]
//
// LAYER -1 and PEG -1: the whole print, drawn where it sits on the board (a one-piece print). LAYER k: its layer k, lying on the
// print bed (its underside on z = 0). PEG j: its peg j, upright, its lowest point on z = 0 at the origin.

GUIDE = [];
PRINT = 0;
LAYER = -1;
PEG = -1;

$fn = 32;
// Fixed dimensions, as WIRE_GUIDE_GEOMETRY.clip.
CLIP_GAP = 0.2; CLIP_WALL = 1.4; CLIP_LIP = 0.6; CLIP_BELOW = 1.4; CLIP_LIP_GAP = 0.15; CLIP_FOOT = 0.6;
// Bridges are this much narrower than the channel they carry, so that their sides never coincide with it.
BRIDGE_INSET = 0.01;

P = GUIDE[PRINT];
grid = P[0]; block = P[1]; plate_top = P[2]; layers = P[3]; wires = P[4];
funnels = P[5]; pockets = P[6]; bosses = P[7]; clips = P[8]; board = P[9];
layered = P[10] == 1; slices = P[11]; holes = P[12]; pegs = P[13];
z_base = block[4]; z_top = block[5];

function at(c, r) = [grid[0] + c * grid[2], grid[1] + r * grid[2]];

// The 2D footprint of a wire's channel: a rectangle per segment, each reaching half the width past its ends (square corners).
module channel_2d(points, width) {
  n = len(points) / 2;
  for (i = [0 : n - 2]) {
    a = at(points[2 * i], points[2 * i + 1]);
    b = at(points[2 * i + 2], points[2 * i + 3]);
    translate([min(a[0], b[0]) - width / 2, min(a[1], b[1]) - width / 2])
      square([abs(b[0] - a[0]) + width, abs(b[1] - a[1]) + width]);
  }
}

// One layer's channels: open from its floor up through the top, except under the bridges of every higher layer.
module layer_cut(layer) {
  difference() {
    translate([0, 0, layers[layer][0]]) linear_extrude(z_top + 1 - layers[layer][0])
      union() for (w = wires) if (w[0] == layer) channel_2d(w[2], w[1]);
    for (higher = [for (i = [0 : len(layers) - 1]) if (i > layer) i])
      translate([0, 0, layers[higher][1]]) linear_extrude(z_top + 2 - layers[higher][1])
        union() for (w = wires) if (w[0] == higher) channel_2d(w[2], w[1] - 2 * BRIDGE_INSET);
  }
}

// One layer's channels alone, open from its floor up through the top (a separate layer: nothing of a higher one is over them).
module own_cut(layer) {
  translate([0, 0, layers[layer][0]]) linear_extrude(z_top + 1 - layers[layer][0])
    union() for (w = wires) if (w[0] == layer) channel_2d(w[2], w[1]);
}

// A funnel at a wire end: a cone from its outlet at the plate's underside to its opening just above the plate's top (the floor of
// the lowest channels), then a shaft up through the top. Below the underside the outlet goes on as a bore, BORE_DEPTH into the
// board's thickness, so that a boss's column or a clip's foot standing on the board beside the hole never closes it. The cone's
// corners sit FUNNEL_KINK above the plate's top and below the underside, so that no ring of it lies in the underside's or a
// floor's plane.
FUNNEL_KINK = 0.05;
BORE_DEPTH = 0.3;
module funnel(f) {
  rb = f[2] / 2; rt = f[3] / 2;
  kink = plate_top + FUNNEL_KINK;
  slope = (rt - rb) / (kink - z_base);
  // the bore's top, under the underside: where the cone is a little narrower than the outlet (never less than half of it)
  below = slope > 0 ? min(FUNNEL_KINK, rb / 2 / slope) : FUNNEL_KINK;
  bore_r = rb - slope * below;
  bore_bottom = min(board[2], z_base - below) - BORE_DEPTH;
  translate([f[0], f[1], 0]) rotate_extrude()
    polygon([[0, bore_bottom], [bore_r, bore_bottom], [bore_r, z_base - below], [rt, kink], [rt, z_top + 1], [0, z_top + 1]]);
}

module pocket(p) {
  if (p[0] == 0) translate([p[1], p[2], z_base - 1]) cube([p[3], p[4], p[5] - z_base + 1]);
  else translate([p[1], p[2], z_base - 1]) cylinder(d = p[3], h = p[5] - z_base + 1);
}

// A boss in a mounting hole: a column standing on the board (when the print stands off it) and a pin into the hole.
module boss(b) {
  translate([b[0], b[1], 0]) {
    if (b[5] >= 0) translate([0, 0, b[5]]) cylinder(d = b[2], h = b[6] - b[5]);
    translate([0, 0, b[4]]) cylinder(d = b[3], h = b[6] - b[4]);
  }
}

// An edge clip at y = 0: a wall outside the board's edge, a lip under it and, when the print stands off the board, a foot on it.
module clip(c) {
  x = c[0]; width = c[1];
  translate([x - width / 2, -CLIP_GAP - CLIP_WALL, -CLIP_BELOW]) cube([width, CLIP_WALL, z_base + CLIP_BELOW + (plate_top - z_base) / 2]);
  translate([x - (width - 0.8) / 2, 0, 0]) rotate([90, 0, 90]) linear_extrude(width - 0.8)
    polygon([[-CLIP_GAP - 0.3, -CLIP_LIP_GAP], [-CLIP_GAP + CLIP_LIP, -CLIP_LIP_GAP], [-CLIP_GAP - 0.3, -CLIP_BELOW + 0.3]]);
  if (z_base - board[2] >= 0.05)
    translate([x - (width - 0.4) / 2, -CLIP_GAP - 0.3, board[2]]) cube([width - 0.4, CLIP_GAP + 0.3 + CLIP_FOOT, z_base - board[2] + (plate_top - z_base) / 2]);
}

// The whole print where it sits on the board, one piece with its bosses; or, for its layer LAYER, the block with that layer's
// channels, the funnels, pockets and the pegs' holes.
module guide() {
  difference() {
    union() {
      translate([block[0], block[1], z_base]) cube([block[2] - block[0], block[3] - block[1], z_top - z_base]);
      if (!layered) for (b = bosses) boss(b);
      for (c = clips) { clip(c); translate([0, board[1], 0]) mirror([0, 1, 0]) clip(c); }
    }
    // a layer holds only its own level's channels: it is closed over the lower levels' wires, which lie in the layers below it
    if (layered && LAYER >= 0) own_cut(LAYER);
    else for (layer = [0 : len(layers) - 1]) layer_cut(layer);
    for (f = funnels) funnel(f);
    for (p = pockets) pocket(p);
    if (layered) for (h = holes) translate([h[0], h[1], h[3]]) cylinder(d = h[2], h = h[4] - h[3], $fn = 64);
  }
}

// Layer k: the slice of the print from its underside to its top (the lowest reaches down to the clips, the highest up to the
// top), moved down onto the print bed.
module layer(k) {
  lo = k == 0 ? -10 : slices[k][0];
  hi = k == len(slices) - 1 ? z_top + 10 : slices[k][1];
  translate([0, 0, -slices[k][0]]) intersection() {
    guide();
    translate([block[0] - 10, block[1] - 10, lo]) cube([block[2] - block[0] + 20, block[3] - block[1] + 20, hi - lo]);
  }
}

// A peg: its outline's rings turned about the axis, 64 sides, closed by a flat face at each end. A polyhedron rather than
// rotate_extrude, whose outline would need points on the axis: rings of coincident points there make empty triangles.
module peg(rings) {
  n = 64; k = len(rings);
  points = [for (i = [0 : k - 1]) for (j = [0 : n - 1]) [rings[i][0] * cos(360 * j / n), rings[i][0] * sin(360 * j / n), rings[i][1]]];
  sides = [for (i = [0 : k - 2]) for (j = [0 : n - 1]) [i * n + j, (i + 1) * n + j, (i + 1) * n + (j + 1) % n, i * n + (j + 1) % n]];
  polyhedron(points, concat([[for (j = [0 : n - 1]) j]], sides, [[for (j = [n - 1 : -1 : 0]) (k - 1) * n + j]]));
}

if (PEG >= 0) peg(pegs[PEG]);
else if (LAYER >= 0) layer(LAYER);
else guide();
