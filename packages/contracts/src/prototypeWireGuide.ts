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
} as const;

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

    return {
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
  });
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
  ]);
  return JSON.stringify(prints, (_key, value: unknown) => typeof value === 'number' ? finite(value) : value);
}

/** What the editor's summary shows of a design: its board, wires and prints (titles from the parts library). */
export function wireGuideSummary(design: WireGuideDesign): { board: string; wire: string; wires: number; prints: { id: string; wires: number }[]; levels: number } {
  const board = findPart(design.boardPartId);
  const wire = findPart(design.wirePartId);
  return {
    board: board?.title ?? design.boardPartId,
    wire: wire ? `${wire.title} (Ø${dimensionOf(wire, 'D', 'max')} mm)` : design.wirePartId,
    wires: design.wires.length,
    prints: design.prints.map(print => ({ id: print.id, wires: print.wireIds.length })),
    levels: new Set(design.wires.map(wire => wire.level)).size,
  };
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
