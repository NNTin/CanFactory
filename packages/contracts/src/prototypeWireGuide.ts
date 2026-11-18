import { dimensionOf, findPart, hookupWireChannelWidth } from './parts/index.ts';
import { validateWireGuideDesign, wireGuideBoard, type Keepout, type WireGuideDesign } from './wireGuide.ts';

/**
 * The `prototype-wire-guide` model's geometry, worked out from a valid `WireGuideDesign` by trusted code: every print's plate,
 * channels, bridges, funnels, pockets and registration as numbers, which `wireGuideScad` writes for the SCAD generator
 * (models/prototype-wire-guide/guide.scad). Ids, net names, footprints and part ids never reach SCAD: only numbers do. See
 * docs/wire-guide.md, “The guide prints”.
 *
 * Frame: `prototypeBoardLayout`'s (mm, the PCB's underside on z = 0, the board's corner at the origin, seen from the component
 * side). Each print is drawn where it sits on the board, the right way up: its channels open upwards, its plate over the board.
 */

/** The fixed dimensions of the guide (mm): not settings, so that every design renders the same way. */
export const WIRE_GUIDE_GEOMETRY = {
  /** The plate beyond the outermost channel or funnel. */
  margin: 1.2,
  /** The bridge a higher channel's wire rests on where it crosses a lower channel: a short tunnel for the lower wire. */
  bridge: 0.6,
  /** Round keep-outs and component bodies, so that the plate clears them. */
  pocketClearance: 0.3,
  /** A pocket that would leave less than this under the top goes through the print. */
  minimumSkin: 0.4,
  /** Mounting-hole bosses: the column's wall round the hole, the pin's play in the hole, and how far down the board's thickness
   * the pin goes (as a fraction of it). */
  boss: { wall: 1.2, pinPlay: 0.3, pinDepth: 0.75 },
  /** Edge clips on the board's two edges along X: gap to the edge, wall thickness, width along X, the lip's reach under the board,
   * how far the wall goes below the board's underside, the lip's gap under it, and the foot's reach over the board's top. */
  clip: { gap: 0.2, wall: 1.4, width: 10, lip: 0.6, below: 1.4, lipGap: 0.15, foot: 0.6 },
  /**
   * Separate pegs (`guide.parts` `layers`, see `WireGuideStack`). A board peg stands in a mounting hole: a tip (the hole −
   * `pinPlay`, `pinDepth` of the board's thickness down it), a 45° seat that sits on the hole's rim, a shoulder up to the guide's
   * underside (the hole + up to 2 × `wall`) that the bottom layer rests on, and a shaft up through every layer, or, where a channel
   * passes over the hole, only into a socket in the bottom layer's plate that stops `minimumSkin` under its channels' floor
   * (`socketDepth` deep at least). A dowel (`dowel` across) stands in a blind hole in the bottom layer, `dowelFloor` above its
   * underside, and up through the layers above. Every layer's hole is the shaft + `holePlay` across (a sliding fit), `keepClear`
   * from every channel, funnel, pocket and other hole. A shaft stops `topGap` under the top of its hole, with a `chamfer` to lead
   * it in. The shoulder rests on at least `bearing` of the bottom layer round its hole. Shafts are at least `minShaft` across.
   */
  peg: { pinPlay: 0.3, pinDepth: 0.75, wall: 1.2, shaftOver: 0.6, holePlay: 0.3, keepClear: 0.6, bearing: 0.4, topGap: 0.2, chamfer: 0.3, minShaft: 1.5, socketDepth: 0.6, dowel: 2, dowelFloor: 0.6 },
} as const;

/**
 * A separately printed layer of a print (`WireGuideStack`): the slice of the print's block that holds one of its levels' channels.
 * It is closed over the lower levels' wires, which lie in the layers below it (its underside comes down on them as their bridge),
 * and open over its own: each channel has a floor `WIRE_GUIDE_GEOMETRY.bridge` thick (the bottom layer's: the plate).
 */
export interface WireGuideLayerPart {
  /** The design's wire level whose channels it holds (a print's layers are its levels, compressed). */
  level: number;
  /** The ids of the print's wires on that level. */
  wireIds: string[];
  /** Its underside and top as assembled, in the board's frame (mm). The STL lies with its underside (its clips', for a bottom layer
   * with edge clips) on z = 0, the print bed; its assembled pose lifts it by `zBottom`. */
  zBottom: number; zTop: number;
}

/** A separately printed peg (`WireGuideStack`): its axis at (x, y) and its outline, turned about that axis. */
export interface WireGuidePegPart {
  /** `board`: in a mounting hole of the board; `dowel`: in a blind hole of the bottom layer, to line the layers up. */
  kind: 'board' | 'dowel';
  /** Whether its shaft goes up through every layer (and so lines them up); a board peg under a channel only reaches into a socket
   * in the bottom layer's plate. */
  through: boolean;
  x: number; y: number;
  /** The mounting hole's diameter, for a board peg. */
  holeDiameter: number | null;
  /** Where its lowest point sits as assembled (board frame): the STL stands on that point at z = 0, upright. */
  zBottom: number;
  /** Its outline, [radius, height above its lowest point], from the axis at the bottom round to the axis at the top. */
  profile: [number, number][];
  /** Its shaft's diameter, and the layers' hole for it (the shaft + play across) from `holeBottom` to `holeTop` (board frame). */
  shaft: number; hole: number; holeBottom: number; holeTop: number;
  /** The shoulder the bottom layer rests on (a board peg with a standoff), else null. */
  shoulder: number | null;
}

/** How a print is made: as separate stacked layers and pegs, or as one piece (`guide.parts` `single`, or a print that can't be
 * layered, with the reason). */
export interface WireGuideStack {
  pieces: 'layers' | 'single';
  /** Why a print asked for in layers is one piece (a print with `single` asked for has none). */
  reason: string | null;
  layers: WireGuideLayerPart[];
  pegs: WireGuidePegPart[];
  /** Facts the assembly notes state (e.g. a mounting hole left without a peg, and why). */
  notes: string[];
}

/** One print's geometry, in mm. */
export interface WireGuidePrintGeometry {
  /** The grid: hole (column, row) is at (x0 + column × pitch, y0 + row × pitch). */
  grid: { x0: number; y0: number; pitch: number };
  /** The print's block: a rectangle from (x0, y0) to (x1, y1), from its underside `zBase` to its top `zTop`. */
  block: { x0: number; y0: number; x1: number; y1: number; zBase: number; zTop: number };
  /** The top of the plate, the floor of the lowest channel layer. */
  plateTop: number;
  /** Per channel layer of this print (the design's levels it uses, lowest first): its floor and, above the lowest, the bottom of
   * the bridges its wires rest on where they cross a lower channel. */
  layers: { level: number; floor: number; bridgeBottom: number | null }[];
  /** Each wire: its layer (index into `layers`), its channel's width, and its grid points from one end to the other. */
  wires: { layer: number; width: number; points: [number, number][] }[];
  /** A funnel at each wire end: its centre, outlet diameter (at `zBase`) and opening diameter (at `plateTop`), from where it rises
   * as a shaft to the top. */
  funnels: { x: number; y: number; bottom: number; top: number }[];
  /** Pockets over component bodies and keep-outs, from below the underside up to `top`. */
  pockets: ({ kind: 'box'; x: number; y: number; w: number; h: number; top: number } | { kind: 'cylinder'; x: number; y: number; d: number; top: number })[];
  /** Mounting-hole bosses: a column (when there is a standoff) from the board's top, and a pin into the hole. */
  bosses: { x: number; y: number; column: number; pin: number; pinBottom: number; columnBottom: number | null; top: number }[];
  /** Edge clips at y = 0 and y = W, centred on `x`, `width` along X. */
  clips: { x: number; width: number }[];
  /** The board's outline, for the clips. */
  board: { L: number; W: number; t: number };
  /** How it is made: separate stacked layers and pegs, or one piece (`wireGuideStack`). */
  stack: WireGuideStack;
}

const round = (value: number) => Math.round(value * 10000) / 10000;

/** The channel width of each wire of a valid design: its own part's (or the design's) insulation OD max, plus the clearance. */
function channelWidths(design: WireGuideDesign): number[] {
  return design.wires.map(wire => {
    const part = findPart(wire.wirePartId ?? design.wirePartId);
    if (!part) throw new Error(`No hookup wire ${wire.wirePartId ?? design.wirePartId}.`);
    return hookupWireChannelWidth(part, design.guide.channelClearance);
  });
}

/** Moves `value` off each of `planes` by at least 0.02 mm (upwards, or downwards for `direction` -1), so that a pocket's top or
 * side never coincides with another face. */
function offPlanes(value: number, planes: readonly number[], direction: 1 | -1 = 1): number {
  let result = value;
  for (let pass = 0; pass < planes.length + 1; pass++) {
    const near = planes.find(plane => Math.abs(result - plane) < 0.02);
    if (near === undefined) break;
    result = near + direction * 0.02;
  }
  return result;
}

/** The geometry of every print of a valid design, in the order of `design.prints`. Throws for a design that is not valid. */
export function wireGuideGeometry(design: WireGuideDesign): WireGuidePrintGeometry[] {
  const issues = validateWireGuideDesign(design);
  if (issues.length) throw new Error(`Invalid wire-guide design: ${issues.map(issue => `${issue.path || '/'}: ${issue.message}`).join(' ')}`);
  const board = wireGuideBoard(design);
  if (!board) throw new Error(`${design.boardPartId} is not a prototype board.`);
  const G = WIRE_GUIDE_GEOMETRY;
  const { guide } = design;
  const { grid, outline } = board;
  const widths = channelWidths(design);
  const wireIndex = new Map(design.wires.map((wire, index) => [wire.id, index]));
  const mm = (column: number, row: number) => ({ x: grid.x0 + column * grid.pitch, y: grid.y0 + row * grid.pitch });
  const obstacles: Keepout[] = [...(design.components ?? []).map(component => component.body), ...design.keepouts ?? []];

  return design.prints.map(print => {
    const wires = print.wireIds.flatMap(id => {
      const index = wireIndex.get(id);
      const [wire, width] = index === undefined ? [] : [design.wires[index], widths[index]];
      return wire && width !== undefined ? [{ wire, width }] : [];
    });
    const widest = Math.max(...wires.map(wire => wire.width));
    const step = widest + G.bridge;
    const levels = [...new Set(wires.map(({ wire }) => wire.level))].sort((a, b) => a - b);

    const zBase = outline.t + guide.funnelStandoff;
    const plateTop = zBase + guide.coverThickness;
    const layers = levels.map((level, layer) => {
      const floor = plateTop + layer * step;
      return { level, floor: round(floor), bridgeBottom: layer === 0 ? null : round(floor - G.bridge) };
    });
    const zTop = (layers.at(-1)?.floor ?? plateTop) + widest;

    // The funnel's shaft must not be tangent to its channel's sides.
    const funnelTop = (width: number) => Math.abs(guide.funnelTopDiameter - width) < 0.04 ? width + 0.04 : guide.funnelTopDiameter;

    // --- the block: the wires' channels and funnels (and the print's region), with a margin ---
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    const grow = (x: number, y: number, half: number) => {
      x0 = Math.min(x0, x - half); x1 = Math.max(x1, x + half); y0 = Math.min(y0, y - half); y1 = Math.max(y1, y + half);
    };
    for (const { wire, width } of wires)
      for (const [column, row] of [wire.from, ...wire.path, wire.to]) {
        const { x, y } = mm(column, row);
        grow(x, y, Math.max(width, funnelTop(width)) / 2 + G.margin);
      }
    if (print.region) for (const [column, row] of [print.region.from, print.region.to]) {
      const { x, y } = mm(column, row);
      grow(x, y, grid.pitch / 2);
    }
    // The plate may overhang the outline by its margin, never more.
    [x0, x1] = [Math.max(x0, -G.margin), Math.min(x1, outline.L + G.margin)];
    [y0, y1] = [Math.max(y0, -G.margin), Math.min(y1, outline.W + G.margin)];

    // --- registration ---
    const bosses: WireGuidePrintGeometry['bosses'] = [];
    const clips: WireGuidePrintGeometry['clips'] = [];
    if (guide.registration === 'mounting-holes') {
      // The two mounting holes nearest the print's middle (one, on a board with one). A print with a region takes only the holes in
      // its region, so that separate prints never share one; it may have none (it is then located by its wire ends alone).
      const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
      const region = print.region && (() => {
        const [a, b] = [mm(...print.region.from), mm(...print.region.to)];
        const half = grid.pitch / 2;
        return { x0: Math.min(a.x, b.x) - half, x1: Math.max(a.x, b.x) + half, y0: Math.min(a.y, b.y) - half, y1: Math.max(a.y, b.y) + half };
      })();
      const chosen = board.mountingHoles.map((hole, index) => ({ hole, index, distance: Math.hypot(hole.x - cx, hole.y - cy) }))
        .filter(({ hole }) => !region || (hole.x >= region.x0 && hole.x <= region.x1 && hole.y >= region.y0 && hole.y <= region.y1))
        .sort((a, b) => a.distance - b.distance || a.index - b.index).slice(0, 2);
      for (const { hole } of chosen) {
        const column = hole.d + 2 * G.boss.wall;
        const top = zBase + guide.coverThickness / 2;
        bosses.push({
          x: hole.x, y: hole.y, column: round(column), pin: round(hole.d - G.boss.pinPlay),
          pinBottom: round(outline.t * (1 - G.boss.pinDepth)), columnBottom: guide.funnelStandoff >= 0.05 ? outline.t : null, top: round(top),
        });
        grow(hole.x, hole.y, column / 2 + 0.5);
      }
      [x0, x1] = [Math.max(x0, -G.margin), Math.min(x1, outline.L + G.margin)];
      [y0, y1] = [Math.max(y0, -G.margin), Math.min(y1, outline.W + G.margin)];
    } else {
      // Clips on both edges along X: the plate spans the board's width, into the clips' walls.
      [y0, y1] = [-G.clip.gap - G.clip.wall / 2, outline.W + G.clip.gap + G.clip.wall / 2];
      const width = Math.min(G.clip.width, x1 - x0 - 2);
      if (width >= 2) clips.push({ x: round((x0 + x1) / 2), width: round(width) });
    }

    // --- funnels at the wire ends ---
    const funnels = wires.flatMap(({ wire, width }) => [wire.from, wire.to].map(([column, row]) => {
      const { x, y } = mm(column, row);
      return { x: round(x), y: round(y), bottom: guide.funnelBottomDiameter, top: round(funnelTop(width)) };
    }));

    // --- pockets over the obstacles that reach the print's underside ---
    const planes = [zBase, plateTop, zTop, ...layers.flatMap(layer => [layer.floor, ...layer.bridgeBottom === null ? [] : [layer.bridgeBottom]])];
    // A pocket's sides (a round one's extremes along X and Y) are moved out off the channels' sides and the block's: a channel
    // half its width + the clearance from a body would have a side on the pocket's, which leaves float32 slivers or breaks the mesh.
    const [xSides, ySides] = [[x0, x1], [y0, y1]];
    for (const { wire, width } of wires) for (const [column, row] of [wire.from, ...wire.path, wire.to]) {
      const { x, y } = mm(column, row);
      xSides.push(x - width / 2, x + width / 2); ySides.push(y - width / 2, y + width / 2);
    }
    const c = G.pocketClearance;
    const pockets = obstacles.flatMap((keepout): WireGuidePrintGeometry['pockets'] => {
      const height = outline.t + keepout.height + c;
      if (height <= zBase) return [];
      const top = round(height >= zTop - G.minimumSkin ? zTop + 1 : offPlanes(Math.max(height, zBase + 0.3), planes));
      if (keepout.kind === 'cylinder') {
        const { cx, cy } = keepout;
        const radius = offPlanes(keepout.d / 2 + c, [...xSides.map(x => Math.abs(x - cx)), ...ySides.map(y => Math.abs(y - cy))]);
        return [{ kind: 'cylinder', x: cx, y: cy, d: round(2 * radius), top }];
      }
      const [left, right] = [offPlanes(keepout.x - c, xSides, -1), offPlanes(keepout.x + keepout.w + c, xSides)];
      const [front, back] = [offPlanes(keepout.y - c, ySides, -1), offPlanes(keepout.y + keepout.h + c, ySides)];
      return [{ kind: 'box', x: round(left), y: round(front), w: round(right - left), h: round(back - front), top }];
    });

    const geometry: Omit<WireGuidePrintGeometry, 'stack'> = {
      grid: { x0: grid.x0, y0: grid.y0, pitch: grid.pitch },
      block: { x0: round(x0), y0: round(y0), x1: round(x1), y1: round(y1), zBase: round(zBase), zTop: round(zTop) },
      plateTop: round(plateTop), layers,
      wires: wires.map(({ wire, width }) => ({
        layer: levels.indexOf(wire.level), width: round(width),
        points: [wire.from, ...wire.path, wire.to].map(([column, row]) => [column, row] as [number, number]),
      })),
      funnels, pockets, bosses, clips,
      board: { L: outline.L, W: outline.W, t: outline.t },
    };
    const pins = (design.components ?? []).flatMap(component => component.pins.map(([column, row]) => mm(column, row)));
    const cells = { columns: grid.columns, rows: grid.rows };
    return { ...geometry, stack: wireGuideStack(geometry, wires.map(({ wire }) => wire), guide, pins, cells) };
  });
}

const distanceToBox = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) =>
  Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
const show = (value: number) => `${round(Math.round(value * 100) / 100)}`;

/** Each wire's channel as boxes, one per segment (each reaching half the width past its ends, as guide.scad draws them), by layer. */
function channelBoxes(print: Omit<WireGuidePrintGeometry, 'stack'>): { layer: number; box: [number, number, number, number] }[] {
  const { grid } = print;
  const at = ([column, row]: [number, number]) => [grid.x0 + column * grid.pitch, grid.y0 + row * grid.pitch] as const;
  return print.wires.flatMap(wire => wire.points.slice(1).map((b, i) => {
    const [ax, ay] = at(wire.points[i] ?? b), [bx, by] = at(b), half = wire.width / 2;
    return { layer: wire.layer, box: [Math.min(ax, bx) - half, Math.min(ay, by) - half, Math.max(ax, bx) + half, Math.max(ay, by) + half] as [number, number, number, number] };
  }));
}

/**
 * How many separate bodies one layer of a print would be (`WireGuideLayerPart`), on a 0.2 mm grid over its block: at each point it
 * is solid from its underside to its top, but through its funnels' shafts and the pegs' holes, over its own channels (solid to their
 * floor) and above a pocket's top. Neighbouring points join where their solid spans overlap. An estimate for deciding
 * (`wireGuideStack`); the renderer tests count the real meshes' shells.
 */
export function wireGuideLayerBodies(print: Omit<WireGuidePrintGeometry, 'stack'>, layer: number, holes: readonly { x: number; y: number; d: number; bottom: number; top: number }[]): number {
  // fine enough for the thinnest wall a design can have (0.84 mm between channels on neighbouring rows)
  const step = 0.2;
  const { block, layers, plateTop } = print;
  const bottom = layer === 0 ? block.zBase : layers[layer]?.bridgeBottom ?? block.zBase;
  const top = layers[layer + 1]?.bridgeBottom ?? block.zTop;
  const floor = layer === 0 ? plateTop : layers[layer]?.floor ?? plateTop;
  const nx = Math.max(1, Math.round((block.x1 - block.x0) / step)), ny = Math.max(1, Math.round((block.y1 - block.y0) / step));
  const lo = new Float64Array(nx * ny).fill(bottom), hi = new Float64Array(nx * ny).fill(top);
  const empty = new Uint8Array(nx * ny);
  // every cell whose centre is inside
  const cells = (x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean, mark: (index: number) => void) => {
    const [i0, i1] = [Math.max(0, Math.floor((x0 - block.x0) / step)), Math.min(nx - 1, Math.ceil((x1 - block.x0) / step))];
    const [j0, j1] = [Math.max(0, Math.floor((y0 - block.y0) / step)), Math.min(ny - 1, Math.ceil((y1 - block.y0) / step))];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const [x, y] = [block.x0 + (i + 0.5) * step, block.y0 + (j + 0.5) * step];
      if (inside(x, y)) mark(j * nx + i);
    }
  };
  const box = ([x0, y0, x1, y1]: readonly [number, number, number, number], mark: (index: number) => void) =>
    cells(x0, y0, x1, y1, (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1, mark);
  const disc = (cx: number, cy: number, r: number, mark: (index: number) => void) =>
    cells(cx - r, cy - r, cx + r, cy + r, (x, y) => Math.hypot(x - cx, y - cy) <= r, mark);
  for (const channel of channelBoxes(print))
    if (channel.layer === layer) box(channel.box, index => { hi[index] = Math.min(hi[index] ?? top, floor); });
  for (const pocket of print.pockets) {
    const raise = (index: number) => { lo[index] = Math.max(lo[index] ?? bottom, pocket.top); };
    if (pocket.kind === 'box') box([pocket.x, pocket.y, pocket.x + pocket.w, pocket.y + pocket.h], raise);
    else disc(pocket.x, pocket.y, pocket.d / 2, raise);
  }
  for (const funnel of print.funnels) disc(funnel.x, funnel.y, funnel.top / 2, index => { empty[index] = 1; });
  for (const hole of holes) if (hole.bottom <= bottom + 0.05 && hole.top >= top - 0.05) disc(hole.x, hole.y, hole.d / 2, index => { empty[index] = 1; });
  const solid = (index: number) => !empty[index] && (hi[index] ?? 0) - (lo[index] ?? 0) > 0.05;
  const seen = new Uint8Array(nx * ny);
  let bodies = 0;
  for (let start = 0; start < nx * ny; start++) {
    if (seen[start] || !solid(start)) continue;
    bodies++;
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const index = queue.pop() ?? 0;
      const [i, j] = [index % nx, Math.floor(index / nx)];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const [a, b] = [i + di, j + dj];
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const next = b * nx + a;
        if (seen[next] || !solid(next)) continue;
        if (Math.min(hi[index] ?? 0, hi[next] ?? 0) - Math.max(lo[index] ?? 0, lo[next] ?? 0) <= 0.05) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
  }
  return bodies;
}

/**
 * How a print is made (`WireGuideStack`), for `guide.parts` `layers` (the default): one separate layer per level the print uses
 * (`WireGuideLayerPart`), the print's block sliced at its bridges' undersides, so that the stacked layers hold every wire where the
 * one-piece print does (its channels and their floors and bridges, funnels and pockets, the same heights), and separate pegs through
 * matching holes instead of the fused bosses.
 *
 * - **Board pegs** stand in the mounting holes the one-piece print would have bosses in, up through every layer, or into a socket in
 *   the plate where a channel passes over the hole. A hole whose peg would cut a channel, funnel or pocket even so, or whose shoulder
 *   would cover a wire end's hole or a component's lead or body, gets none (a note says so).
 * - **Dowels**: a print of two or more layers is lined up by two pegs through every layer. Where it has fewer, dowels stand in blind
 *   holes of the bottom layer, at the free points between the board's holes farthest apart (and from a peg through the layers).
 * - A print that can't be lined up so, or one of whose layers above the bottom would be loose pieces (`wireGuideLayerBodies`), is
 *   made as one piece instead, with the reason.
 */
export function wireGuideStack(print: Omit<WireGuidePrintGeometry, 'stack'>, wires: readonly { id: string; level: number }[], guide: WireGuideDesign['guide'],
  pins: readonly { x: number; y: number }[], cells: { columns: number; rows: number }): WireGuideStack {
  const G = WIRE_GUIDE_GEOMETRY, P = G.peg;
  const { block, layers, board, grid } = print;
  if (guide.parts === 'single') return { pieces: 'single', reason: null, layers: [], pegs: [], notes: [] };
  const single = (reason: string): WireGuideStack => ({ pieces: 'single', reason, layers: [], pegs: [], notes: [] });
  const notes: string[] = [];
  const boxes = channelBoxes(print);
  const pegs: WireGuidePegPart[] = [];
  const socketTop = round(print.plateTop - G.minimumSkin);

  // what a vertical hole of radius r at (x, y) would cut, through every layer or only up into the plate
  const blocked = (x: number, y: number, r: number, through: boolean): string | null => {
    const need = r + P.keepClear;
    if (x - need < block.x0 || x + need > block.x1 || y - need < block.y0 || y + need > block.y1) return 'the print’s edge';
    if (through && boxes.some(({ box }) => distanceToBox(x, y, ...box) < need)) return 'a channel';
    if (print.funnels.some(funnel => Math.hypot(funnel.x - x, funnel.y - y) < need + funnel.top / 2)) return 'a funnel';
    if (print.pockets.some(pocket => pocket.kind === 'box' ? distanceToBox(x, y, pocket.x, pocket.y, pocket.x + pocket.w, pocket.y + pocket.h) < need
      : Math.hypot(pocket.x - x, pocket.y - y) < need + pocket.d / 2)) return 'a component’s pocket';
    if (pegs.some(peg => Math.hypot(peg.x - x, peg.y - y) < r + peg.hole / 2 + P.keepClear)) return 'another peg';
    return null;
  };
  const chamferedTop = (radius: number, top: number): [number, number][] => [[radius, top - P.chamfer], [radius - P.chamfer, top], [0, top]];

  // --- board pegs, in the mounting holes the one-piece print has bosses in ---
  const t = board.t, standoff = block.zBase - t;
  for (const boss of print.bosses) {
    const d = round(boss.column - 2 * G.boss.wall), rHole = d / 2, rTip = rHole - P.pinPlay / 2;
    const tipBottom = round(t * (1 - P.pinDepth));
    const where = `The mounting hole at (${show(boss.x)}, ${show(boss.y)}) mm`;
    // its seat: a 45° cone from the tip, on the hole's rim at the board's top, out to the shoulder (or straight to the shaft)
    const rTop = standoff >= 0.05 ? rHole + Math.min(P.wall, standoff) : null;
    const rShaft = round(rTop === null ? rHole + P.shaftOver / 2 : Math.min(rHole + P.shaftOver / 2, rTop - P.holePlay / 2 - P.bearing));
    if (2 * rShaft < P.minShaft) { notes.push(`${where} has no peg: the standoff leaves no room for a shoulder round a shaft of ${P.minShaft} mm.`); continue; }
    const hole = round(2 * rShaft + P.holePlay);
    let through = true;
    let cut = blocked(boss.x, boss.y, hole / 2, true);
    if (cut === 'a channel') {
      through = false;
      cut = socketTop - block.zBase < P.socketDepth + P.topGap - 1e-6 ? 'a channel (the plate is too thin for a socket under it)' : blocked(boss.x, boss.y, hole / 2, false);
    }
    if (cut) { notes.push(`${where} has no peg: its hole would cut ${cut}.`); continue; }
    if (rTop !== null) {
      const bore = print.funnels.some(funnel => Math.hypot(funnel.x - boss.x, funnel.y - boss.y) < rTop + funnel.bottom / 2 + 0.2);
      const lead = pins.some(pin => Math.hypot(pin.x - boss.x, pin.y - boss.y) < rTop + 0.5);
      const body = print.pockets.some(pocket => pocket.kind === 'box' ? distanceToBox(boss.x, boss.y, pocket.x, pocket.y, pocket.x + pocket.w, pocket.y + pocket.h) < rTop + 0.2
        : Math.hypot(pocket.x - boss.x, pocket.y - boss.y) < rTop + 0.2 + pocket.d / 2);
      if (bore || lead || body) { notes.push(`${where} has no peg: its shoulder under the guide would cover ${bore ? 'a wire end’s hole' : lead ? 'a component’s lead' : 'a component'}.`); continue; }
    }
    const holeTop = through ? round(block.zTop + 1) : socketTop;
    const profile: [number, number][] = [[0, tipBottom], [rTip, tipBottom], [rTip, t - P.pinPlay / 2]];
    if (rTop !== null) {
      profile.push([rTop, t + (rTop - rHole)]);
      if (t + (rTop - rHole) < block.zBase - 1e-6) profile.push([rTop, block.zBase]);
      profile.push([rShaft, block.zBase]);
    } else profile.push([rShaft, t + (rShaft - rHole)]);
    profile.push(...chamferedTop(rShaft, (through ? block.zTop : socketTop) - P.topGap));
    if (!through) notes.push(`${where}: a channel passes over it, so its peg reaches only into a socket in the bottom layer's plate.`);
    pegs.push({
      kind: 'board', through, x: boss.x, y: boss.y, holeDiameter: d, zBottom: tipBottom,
      profile: profile.map(([r, z]) => [round(r), round(z - tipBottom)]), shaft: round(2 * rShaft), hole, holeBottom: round(block.zBase - 1), holeTop,
      shoulder: rTop === null ? null : round(2 * rTop),
    });
  }
  if (guide.registration === 'mounting-holes' && pegs.length === 0)
    notes.push('No peg locates this print on the board: it is located by its wire ends’ funnels alone.');

  // --- dowels, so that two pegs through every layer line up a stack ---
  const lining = () => pegs.filter(peg => peg.through);
  if (layers.length >= 2 && lining().length < 2) {
    const r = P.dowel / 2, hole = round(P.dowel + P.holePlay);
    const candidates: { x: number; y: number }[] = [];
    for (let row = -1; row < cells.rows; row++) for (let column = -1; column < cells.columns; column++) {
      const [x, y] = [round(grid.x0 + (column + 0.5) * grid.pitch), round(grid.y0 + (row + 0.5) * grid.pitch)];
      if (!blocked(x, y, hole / 2, true)) candidates.push({ x, y });
    }
    const [cx, cy] = [(block.x0 + block.x1) / 2, (block.y0 + block.y1) / 2];
    while (lining().length < 2) {
      const free = candidates.filter(point => !blocked(point.x, point.y, hole / 2, true));
      const from = lining()[0] ?? { x: cx, y: cy };
      const best = free.reduce<{ x: number; y: number } | undefined>((found, point) =>
        !found || Math.hypot(point.x - from.x, point.y - from.y) > Math.hypot(found.x - from.x, found.y - from.y) + 1e-9 ? point : found, undefined);
      if (!best) return single(`there is no room for ${lining().length === 1 ? 'an alignment peg' : 'two alignment pegs'} clear of its channels, funnels and pockets`);
      const bottom = round(block.zBase + P.dowelFloor);
      pegs.push({
        kind: 'dowel', through: true, x: best.x, y: best.y, holeDiameter: null, zBottom: bottom,
        profile: [[0, 0], [r - P.chamfer, 0], [r, P.chamfer], ...chamferedTop(r, round(block.zTop - P.topGap - bottom))], shaft: P.dowel, hole, holeBottom: bottom,
        holeTop: round(block.zTop + 1), shoulder: null,
      });
    }
  }

  const parts: WireGuideLayerPart[] = layers.map((layer, k) => ({
    level: layer.level, wireIds: wires.filter(wire => wire.level === layer.level).map(wire => wire.id),
    zBottom: k === 0 ? (print.clips.length ? -G.clip.below : block.zBase) : layer.bridgeBottom ?? block.zBase,
    zTop: layers[k + 1]?.bridgeBottom ?? block.zTop,
  }));
  const holes = pegs.map(peg => ({ x: peg.x, y: peg.y, d: peg.hole, bottom: peg.holeBottom, top: peg.holeTop }));
  for (let k = 1; k < layers.length; k++) {
    const bodies = wireGuideLayerBodies(print, k, holes);
    if (bodies > 1) return single(`its layer ${k + 1} would be ${bodies} loose pieces between its pockets and holes`);
  }
  const plate = wireGuideLayerBodies(print, 0, holes);
  if (plate > 1) notes.push(`Its bottom layer is ${plate} pieces where pockets go through it, as a one-piece print would be.`);
  return { pieces: 'layers', reason: null, layers: parts, pegs, notes };
}

/**
 * The `-D GUIDE=` literal: every print's geometry as nested lists of numbers, in the order guide.scad reads them (the generator
 * picks its print with `PRINT`). Only numbers: no id, net name, footprint or part id of the design reaches OpenSCAD.
 */
export function wireGuideScad(design: WireGuideDesign): string {
  const finite = (value: number) => { if (!Number.isFinite(value)) throw new Error('A wire-guide number is not finite.'); return round(value); };
  const prints = wireGuideGeometry(design).map(print => [
    [print.grid.x0, print.grid.y0, print.grid.pitch],
    [print.block.x0, print.block.y0, print.block.x1, print.block.y1, print.block.zBase, print.block.zTop],
    print.plateTop,
    print.layers.map(layer => [layer.floor, layer.bridgeBottom ?? -1]),
    print.wires.map(wire => [wire.layer, wire.width, wire.points.flat()]),
    print.funnels.map(funnel => [funnel.x, funnel.y, funnel.bottom, funnel.top]),
    print.pockets.map(pocket => pocket.kind === 'box' ? [0, pocket.x, pocket.y, pocket.w, pocket.h, pocket.top] : [1, pocket.x, pocket.y, pocket.d, 0, pocket.top]),
    print.bosses.map(boss => [boss.x, boss.y, boss.column, boss.pin, boss.pinBottom, boss.columnBottom ?? -1, boss.top]),
    print.clips.map(clip => [clip.x, clip.width]),
    [print.board.L, print.board.W, print.board.t],
    print.stack.pieces === 'layers' ? 1 : 0,
    print.stack.layers.map(layer => [layer.zBottom, layer.zTop]),
    print.stack.pegs.map(peg => [peg.x, peg.y, peg.hole, peg.holeBottom, peg.holeTop]),
    print.stack.pegs.map(peg => peg.profile),
  ]);
  return JSON.stringify(prints, (_key, value: unknown) => typeof value === 'number' ? finite(value) : value);
}

/** One printed piece of a design: a one-piece print, a layer of a print, or a peg. `id` is its part (and STL) name in the ZIP. */
export interface WireGuidePiece {
  id: string; title: string; kind: 'print' | 'layer' | 'peg';
  /** The print's index in `design.prints`, and the layer's or peg's index in its stack. */
  print: number; index: number;
  /** Where its STL goes as assembled, in the board's frame (a translation: every piece is printed the way up it is used). */
  position: [number, number, number];
}

const geometryCache = new Map<string, WireGuidePrintGeometry[]>();
/** `wireGuideGeometry`, remembered for the last few designs: the parts' `includedWhen`, the assembly and the notes all ask for it. */
function cachedGeometry(design: WireGuideDesign): WireGuidePrintGeometry[] {
  const key = JSON.stringify(design);
  const found = geometryCache.get(key);
  if (found) return found;
  const geometry = wireGuideGeometry(design);
  if (geometryCache.size >= 8) geometryCache.delete(geometryCache.keys().next().value ?? '');
  geometryCache.set(key, geometry);
  return geometry;
}

/** The ZIP name of print `print`'s one piece, its layer `layer` or its peg `peg` (1-based numbers, layers from the bottom). */
export const wireGuidePieceId = (print: number, kind: WireGuidePiece['kind'], index = 0) =>
  kind === 'print' ? `print-${print + 1}` : `print-${print + 1}-${kind}-${index + 1}`;

/** Every printed piece of a valid design, print by print: its one piece, or its layers from the bottom up and then its pegs. */
export function wireGuidePieces(design: WireGuideDesign): WireGuidePiece[] {
  return cachedGeometry(design).flatMap((print, p): WireGuidePiece[] => {
    const name = `Print ${p + 1} (${design.prints[p]?.id ?? ''})`;
    if (print.stack.pieces === 'single') return [{ id: wireGuidePieceId(p, 'print'), title: `${name}, one piece`, kind: 'print', print: p, index: 0, position: [0, 0, 0] }];
    const count = print.stack.layers.length;
    return [
      ...print.stack.layers.map((layer, k): WireGuidePiece => ({
        id: wireGuidePieceId(p, 'layer', k), kind: 'layer', print: p, index: k, position: [0, 0, layer.zBottom],
        title: `${name}, layer ${k + 1} of ${count}${count > 1 ? k === 0 ? ' (bottom)' : k === count - 1 ? ' (top)' : '' : ''}: level ${layer.level}`,
      })),
      ...print.stack.pegs.map((peg, j): WireGuidePiece => ({
        id: wireGuidePieceId(p, 'peg', j), kind: 'peg', print: p, index: j, position: [peg.x, peg.y, peg.zBottom],
        title: `${name}, ${peg.kind === 'board' ? 'board peg' : 'alignment dowel'} ${j + 1} of ${print.stack.pegs.length}`,
      })),
    ];
  });
}

/** The editor map's level colours, for the layers in the preview. */
export const WIRE_GUIDE_LEVEL_COLORS = ['#c46543', '#3f6fb5', '#637655', '#9a5bb0', '#b08a2e', '#2e8f8a'] as const;
const PEG_COLOR = '#8a8f80';

/**
 * The assembly of a valid design's pieces, as the preview plays it: each piece at its place on the board; for each print, its board
 * pegs go into the mounting holes, then each layer goes down over the pegs from the bottom up (the dowels into the bottom layer
 * after it), each followed by its level's wires. A one-piece print is pressed on as a whole.
 */
export function wireGuideAssembly(design: WireGuideDesign): { poses: Record<string, { position: [number, number, number] }>; steps: { title: string; parts: string[]; from: [number, number, number] }[]; partColors: Record<string, string>; lift: number } {
  const pieces = wireGuidePieces(design), geometry = cachedGeometry(design);
  const poses = Object.fromEntries(pieces.map(piece => [piece.id, { position: piece.position }]));
  const partColors: Record<string, string> = {};
  const steps: { title: string; parts: string[]; from: [number, number, number] }[] = [];
  geometry.forEach((print, p) => {
    const id = design.prints[p]?.id ?? `${p + 1}`;
    const mine = pieces.filter(piece => piece.print === p);
    const pegs = (kind: 'board' | 'dowel') => mine.filter(piece => piece.kind === 'peg' && print.stack.pegs[piece.index]?.kind === kind).map(piece => piece.id);
    for (const piece of mine) {
      const level = piece.kind === 'layer' ? print.stack.layers[piece.index]?.level ?? 0 : print.layers[0]?.level ?? 0;
      partColors[piece.id] = piece.kind === 'peg' ? PEG_COLOR : WIRE_GUIDE_LEVEL_COLORS[level % WIRE_GUIDE_LEVEL_COLORS.length] ?? PEG_COLOR;
    }
    if (print.stack.pieces === 'single') { steps.push({ title: `Press print ${id} onto the board`, parts: [wireGuidePieceId(p, 'print')], from: [0, 0, 20] }); return; }
    if (pegs('board').length) steps.push({ title: `Print ${id}: push the pegs into the board’s mounting holes`, parts: pegs('board'), from: [0, 0, 30] });
    print.stack.layers.forEach((layer, k) => {
      steps.push({ title: `Print ${id}: slide layer ${k + 1} down over the pegs, then lay level ${layer.level}’s wires in it (${layer.wireIds.join(', ')})`, parts: [wireGuidePieceId(p, 'layer', k)], from: [0, 0, 20 + 4 * k] });
      if (k === 0 && pegs('dowel').length) steps.push({ title: `Print ${id}: drop the alignment dowels into layer 1’s holes`, parts: pegs('dowel'), from: [0, 0, 30] });
    });
  });
  return { poses, steps, partColors, lift: 10 };
}

/**
 * The ZIP's `wire-guide-assembly.txt` for a valid design: what each STL is, how many of each to print and which way up, the pegs'
 * fit, and the order to put them together in. Only ids, numbers and fixed text: the design's own ids are its schema's plain names.
 */
export function wireGuideAssemblyText(design: WireGuideDesign): string {
  const G = WIRE_GUIDE_GEOMETRY, P = G.peg;
  const geometry = cachedGeometry(design), pieces = wireGuidePieces(design), summary = wireGuideSummary(design);
  const mmText = (value: number) => `${show(value)} mm`;
  const lines = [
    'CanFactory prototype-board wire guide: the printed pieces',
    '',
    `Board: ${summary.board} (${design.boardPartId}). Wire: ${summary.wire}.`,
    `${summary.wires} wire${summary.wires === 1 ? '' : 's'} on ${summary.levels} level${summary.levels === 1 ? '' : 's'}, in ${design.prints.length} print${design.prints.length === 1 ? '' : 's'}; ${pieces.length} STL file${pieces.length === 1 ? '' : 's'}.`,
    `Pieces: ${design.guide.parts ?? 'layers'}${design.guide.parts === undefined ? ' (the default)' : ''}. Registration: ${design.guide.registration}.`,
    ...design.source ? [`Planned by ${design.source.tool} ${design.source.version}, project ${design.source.projectId}.`] : [],
    'wire-guide-design.json is the design these pieces were made from.',
    '',
    'Print one of each STL file. Each lies the way up it is used: print it as it is in the file, with no supports.',
    'The fit below is as designed (nominal sizes); it has not been checked with a printed guide. 0.2 mm layers or finer.',
    '',
  ];
  geometry.forEach((print, p) => {
    const id = design.prints[p]?.id ?? `${p + 1}`;
    const mine = pieces.filter(piece => piece.print === p);
    lines.push(`Print ${id} (${p + 1} of ${geometry.length}): ${mine.length} piece${mine.length === 1 ? '' : 's'}`);
    if (print.stack.pieces === 'single') {
      lines.push(`  ${wireGuidePieceId(p, 'print')}.stl  the whole print in one piece${print.stack.reason ? `, because ${print.stack.reason}` : ' (pieces: single)'}.`);
      lines.push(`    Its ${print.bosses.length ? 'bosses' : print.clips.length ? 'clips' : 'registration'} are part of it and stand below its underside: print it plate down${print.bosses.length || print.clips.length ? ' on supports' : ''}.`);
    } else {
      print.stack.layers.forEach((layer, k) => {
        lines.push(`  ${wireGuidePieceId(p, 'layer', k)}.stl  layer ${k + 1} from the bottom: the channels of level ${layer.level} (${layer.wireIds.join(', ')}); ${mmText(layer.zTop - layer.zBottom)} thick, from ${mmText(layer.zBottom)} to ${mmText(layer.zTop)} over the board's underside.`);
        if (k === 0 && print.clips.length) lines.push('    Its clips stand below it: print it on supports under the plate.');
      });
      print.stack.pegs.forEach((peg, j) => {
        const name = `${wireGuidePieceId(p, 'peg', j)}.stl`;
        if (peg.kind === 'board') lines.push(`  ${name}  board peg in the mounting hole at (${show(peg.x)}, ${show(peg.y)}) mm: a ${mmText((peg.holeDiameter ?? 0) - P.pinPlay)} tip in the ${mmText(peg.holeDiameter ?? 0)} hole, a 45° seat on its rim, ${peg.shoulder === null ? 'no shoulder (no standoff)' : `a ${mmText(peg.shoulder)} shoulder the bottom layer rests on`}, and a ${mmText(peg.shaft)} shaft. Print it standing on its tip (a brim helps).`);
        else lines.push(`  ${name}  alignment dowel at (${show(peg.x)}, ${show(peg.y)}) mm: ${mmText(peg.shaft)} across, in a blind hole in layer 1. Print it standing on end.`);
      });
      if (print.stack.pegs.length) {
        const peg = print.stack.pegs[0];
        lines.push(`  Fit: every layer has a hole for each peg, ${mmText(P.holePlay)} wider than its shaft (a sliding fit${peg ? `, e.g. ${mmText(peg.shaft)} in ${mmText(peg.hole)}` : ''}); the shafts stop ${mmText(P.topGap)} under the top layer's top.`);
      }
      for (const note of print.stack.notes) lines.push(`  Note: ${note}`);
      lines.push('  Assembly:');
      let step = 1;
      lines.push(`    ${step++}. Fit the components to the board.`);
      if (print.stack.pegs.some(peg => peg.kind === 'board')) lines.push(`    ${step++}. Push the board pegs, tip first, into their mounting holes from the component side.`);
      if (print.clips.length) lines.push(`    ${step++}. Clip layer 1 over the board's edges.`);
      print.stack.layers.forEach((layer, k) => {
        if (k > 0 || !print.clips.length) lines.push(`    ${step++}. Slide layer ${k + 1} down over the pegs${k === 0 ? ' onto the board' : ` onto layer ${k}`}.`);
        if (k === 0 && print.stack.pegs.some(peg => peg.kind === 'dowel')) lines.push(`    ${step++}. Drop the alignment dowels into layer 1's holes.`);
        lines.push(`    ${step++}. Lay level ${layer.level}'s wires (${layer.wireIds.join(', ')}): push one end down its funnel into the hole, press the wire into its channel${k > 0 ? ', over the lower layers' : ''}, and push the other end down its funnel.`);
      });
      lines.push(`    ${step}. Solder the ends on the solder side. The stack stays on the board; each layer's wires hold it down.`);
    }
    lines.push('');
  });
  return lines.join('\n');
}

/** What the editor's summary shows of a design: its board, wires and prints (titles from the parts library). */
export function wireGuideSummary(design: WireGuideDesign): { board: string; wire: string; wires: number; prints: { id: string; wires: number; layers: number; pegs: number; pieces: number; reason: string | null }[]; levels: number; pieces: number } {
  const board = findPart(design.boardPartId);
  const wire = findPart(design.wirePartId);
  const geometry = cachedGeometry(design);
  const prints = design.prints.map((print, index) => {
    const stack = geometry[index]?.stack;
    const [layers, pegs] = stack?.pieces === 'layers' ? [stack.layers.length, stack.pegs.length] : [0, 0];
    return { id: print.id, wires: print.wireIds.length, layers, pegs, pieces: stack?.pieces === 'layers' ? layers + pegs : 1, reason: stack?.reason ?? null };
  });
  return {
    board: board?.title ?? design.boardPartId,
    wire: wire ? `${wire.title} (Ø${dimensionOf(wire, 'D', 'max')} mm)` : design.wirePartId,
    wires: design.wires.length,
    prints,
    levels: new Set(design.wires.map(wire => wire.level)).size,
    pieces: prints.reduce((sum, print) => sum + print.pieces, 0),
  };
}

/** A print's pieces in words, e.g. “3 layers + 2 pegs” or “1 piece”. */
export function wireGuidePrintPieces(print: { layers: number; pegs: number; pieces: number }): string {
  if (!print.layers) return '1 piece';
  return `${print.layers} layer${print.layers === 1 ? '' : 's'}${print.pegs ? ` + ${print.pegs} peg${print.pegs === 1 ? '' : 's'}` : ''}`;
}

/**
 * The model's default design (models/prototype-wire-guide/samples/perfboard-one-level.json, which a test keeps equal to it): four
 * 22 AWG wires on one level of a 40 × 60 mm perfboard, beside a DIP-8 and a tall capacitor, in one print on two mounting holes.
 */
export const DEFAULT_WIRE_GUIDE_DESIGN: WireGuideDesign = {
  schemaVersion: 1,
  boardPartId: 'generic-proto-board-40x60',
  wirePartId: 'alpha-wire-3051-1',
  components: [
    { ref: 'U1', footprint: 'DIP-8', pins: [[14, 5], [15, 5], [16, 5], [17, 5], [14, 8], [15, 8], [16, 8], [17, 8]],
      body: { kind: 'box', x: 40.2, y: 17.2, w: 10.1, h: 5.6, height: 3.5 } },
  ],
  wires: [
    { id: 'W1', net: 'VCC', from: [2, 2], to: [10, 2], path: [], level: 0 },
    { id: 'W2', net: 'SIG', from: [2, 4], to: [8, 8], path: [[8, 4]], level: 0 },
    { id: 'W3', net: 'GND', from: [12, 3], to: [12, 10], path: [], level: 0 },
    { id: 'W4', net: 'OUT', from: [13, 5], to: [13, 12], path: [], level: 0 },
  ],
  prints: [{ id: 'G1', wireIds: ['W1', 'W2', 'W3', 'W4'] }],
  guide: { registration: 'mounting-holes', coverThickness: 1.2, channelClearance: 0.2, funnelTopDiameter: 2.2, funnelBottomDiameter: 1.2, funnelStandoff: 1 },
  keepouts: [{ kind: 'cylinder', cx: 15, cy: 30, d: 5, height: 11 }],
};
