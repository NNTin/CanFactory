import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';
import { findPart, prototypeBoardLayout, type Part, type PrototypeBoardLayout } from './parts/index.ts';

/**
 * A wire-guide design: the solid-core wires routed on a prototype board and the printed guides that hold them, as KiPrint plans
 * them and the `prototype-wire-guide` model renders them. It is data, never code: the renderer turns it into geometry with
 * trusted code, and `validateWireGuideDesign` checks it the same way in the assistant, the API and the worker. See
 * docs/wire-guide.md.
 *
 * Frame: `prototypeBoardLayout`'s. Millimetres, the PCB's underside on z = 0 with the board's corner at the origin, seen from
 * the component side; columns along +X and rows along +Y, both from 0. Holes and waypoints are grid positions [column, row];
 * keep-outs are in millimetres.
 */

/** The size limits of a design, so that validating and rendering one stays bounded. */
export const WIRE_GUIDE_LIMITS = {
  wires: 200, waypoints: 64, prints: 8, levels: 6, components: 100, pinsPerComponent: 64, keepouts: 64, gridIndex: 255, issues: 100,
} as const;

const Id = (description: string) => Type.String({ pattern: '^[A-Za-z0-9][A-Za-z0-9_.+-]{0,31}$', description });
const PartId = (description: string) => Type.String({ pattern: '^[a-z0-9]+(-[a-z0-9]+)*$', maxLength: 64, description });
const Mm = (minimum: number, maximum: number, description: string) => Type.Number({ minimum, maximum, description });
const GridIndex = Type.Integer({ minimum: 0, maximum: WIRE_GUIDE_LIMITS.gridIndex });

/** A grid position [column, row] of the board, 0-based: column along +X, row along +Y (`PrototypeBoardHoleRef`). */
export const WireGuideHoleRefSchema = Type.Tuple([GridIndex, GridIndex], { description: 'A grid position [column, row], 0-based: column along +X, row along +Y.' });
export type WireGuideHoleRef = Static<typeof WireGuideHoleRefSchema>;

/**
 * Where nothing of the guide may go, in the board's frame (mm): a box from its corner (`x`, `y`, its lowest X and Y) `w` along X
 * and `h` along Y, or a cylinder of diameter `d` round (`cx`, `cy`). `height` is the top of the obstacle above the PCB's top.
 */
export const KeepoutSchema = Type.Union([
  Type.Object({
    kind: Type.Literal('box'),
    x: Mm(-50, 500, 'Lowest X of the box (mm).'), y: Mm(-50, 500, 'Lowest Y of the box (mm).'),
    w: Mm(0.1, 500, 'Size along X (mm).'), h: Mm(0.1, 500, 'Size along Y (mm).'),
    height: Mm(0.1, 100, 'Top of the obstacle above the PCB top (mm).'),
  }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal('cylinder'),
    cx: Mm(-50, 500, 'Centre X (mm).'), cy: Mm(-50, 500, 'Centre Y (mm).'), d: Mm(0.1, 500, 'Diameter (mm).'),
    height: Mm(0.1, 100, 'Top of the obstacle above the PCB top (mm).'),
  }, { additionalProperties: false }),
], { description: 'An obstacle in the board frame (mm): a box from its lowest corner, or a vertical cylinder.' });
export type Keepout = Static<typeof KeepoutSchema>;

export const WireGuideComponentSchema = Type.Object({
  ref: Id('Reference designator, e.g. "U1".'),
  footprint: Type.String({ minLength: 1, maxLength: 64, description: 'Footprint name, display only (e.g. "DIP-8").' }),
  pins: Type.Array(WireGuideHoleRefSchema, { minItems: 1, maxItems: WIRE_GUIDE_LIMITS.pinsPerComponent, description: 'The holes its leads use.' }),
  body: KeepoutSchema,
}, { additionalProperties: false, description: 'A placed through-hole part: its pin holes take no wire end, and its body is a keep-out.' });
export type WireGuideComponent = Static<typeof WireGuideComponentSchema>;

export const WireGuideWireSchema = Type.Object({
  id: Id('Wire id, e.g. "W1".'),
  wirePartId: Type.Optional(PartId('A hookup-wire part for this wire only (e.g. a thicker power wire); the design’s `wirePartId` otherwise.')),
  net: Type.Optional(Type.String({ maxLength: 64, description: 'KiCad net name, display only.' })),
  from: WireGuideHoleRefSchema,
  to: WireGuideHoleRefSchema,
  path: Type.Array(WireGuideHoleRefSchema, { maxItems: WIRE_GUIDE_LIMITS.waypoints, description: 'The grid waypoints between `from` and `to` (both excluded): the wire runs from → path… → to in axis-aligned segments. Empty for a straight wire.' }),
  level: Type.Integer({ minimum: 0, maximum: WIRE_GUIDE_LIMITS.levels - 1, description: 'Channel layer, 0 = the lowest above the board.' }),
}, { additionalProperties: false });
export type WireGuideWire = Static<typeof WireGuideWireSchema>;

export const WireGuidePrintSchema = Type.Object({
  id: Id('Print id, e.g. "G1".'),
  wireIds: Type.Array(Id('A wire id.'), { minItems: 1, maxItems: WIRE_GUIDE_LIMITS.wires }),
  region: Type.Optional(Type.Object({ from: WireGuideHoleRefSchema, to: WireGuideHoleRefSchema }, {
    additionalProperties: false, description: 'The grid rectangle the print covers, corners included; its wires must lie inside it.',
  })),
}, { additionalProperties: false, description: 'One separate guide print and the wires it holds.' });
export type WireGuidePrint = Static<typeof WireGuidePrintSchema>;

export const WireGuideSettingsSchema = Type.Object({
  registration: Type.Union([Type.Literal('mounting-holes'), Type.Literal('edge-clips')], { description: 'How a print locates on the board.' }),
  coverThickness: Mm(0.6, 4, 'Cover plate over the top channel layer (mm).'),
  channelClearance: Mm(0, 1, 'Added to the insulation’s largest outer diameter for a channel’s width (mm).'),
  funnelTopDiameter: Mm(1, 5, 'Funnel opening at the cover (mm).'),
  funnelBottomDiameter: Mm(0.3, 3, 'Funnel outlet above the hole (mm).'),
  funnelStandoff: Mm(0, 10, 'Gap between the funnel outlet and the PCB top (mm).'),
}, { additionalProperties: false });
export type WireGuideSettings = Static<typeof WireGuideSettingsSchema>;

export const WireGuideDesignSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  boardPartId: PartId('A prototype-board part of the parts library.'),
  wirePartId: PartId('The hookup-wire part of every wire without its own.'),
  source: Type.Optional(Type.Object({
    tool: Type.Literal('kiprint'),
    version: Type.String({ minLength: 1, maxLength: 32 }),
    projectId: Type.String({ minLength: 1, maxLength: 64 }),
  }, { additionalProperties: false, description: 'Where the design came from: display and traceability only.' })),
  components: Type.Optional(Type.Array(WireGuideComponentSchema, { maxItems: WIRE_GUIDE_LIMITS.components })),
  wires: Type.Array(WireGuideWireSchema, { minItems: 1, maxItems: WIRE_GUIDE_LIMITS.wires }),
  prints: Type.Array(WireGuidePrintSchema, { minItems: 1, maxItems: WIRE_GUIDE_LIMITS.prints }),
  guide: WireGuideSettingsSchema,
  keepouts: Type.Optional(Type.Array(KeepoutSchema, { maxItems: WIRE_GUIDE_LIMITS.keepouts, description: 'Obstacles that are not components.' })),
}, {
  additionalProperties: false, title: 'WireGuideDesign',
  description: 'Solid-core wires routed on a prototype board and the guide prints that hold them. Frame: prototypeBoardLayout’s (mm, PCB underside on z = 0, board corner at the origin, seen from the component side, columns along +X and rows along +Y, 0-based).',
});
export type WireGuideDesign = Static<typeof WireGuideDesignSchema>;

/** The URL the exported JSON Schema is identified by: the generated file in the repository. */
export const WIRE_GUIDE_DESIGN_SCHEMA_ID = 'https://github.com/NNTin/CanFactory/blob/develop/docs/schemas/wire-guide-design.schema.json';

/** `WireGuideDesignSchema` as a standalone JSON Schema document (draft-07, as TypeBox writes tuples), for tools that cannot import TypeBox (KiPrint). */
export function wireGuideDesignJsonSchema(): Record<string, unknown> {
  const schema = JSON.parse(JSON.stringify(WireGuideDesignSchema)) as Record<string, unknown>;
  return { $schema: 'http://json-schema.org/draft-07/schema#', $id: WIRE_GUIDE_DESIGN_SCHEMA_ID, ...schema };
}

/** A problem with a design: the JSON Pointer of the field (`/wires/3/path/1`, `` for the whole design) and what is wrong. */
export interface WireGuideIssue { path: string; message: string }

type Ref = readonly [number, number];
const key = ([column, row]: Ref) => `${column},${row}`;
const same = (a: Ref, b: Ref) => a[0] === b[0] && a[1] === b[1];
const show = ([column, row]: Ref) => `[${column}, ${row}]`;

/** The grid positions a run of axis-aligned segments passes, each once in order (the corners not repeated). */
function rasterize(points: readonly Ref[]): Ref[] {
  const cells: Ref[] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (!previous) { cells.push(point); return; }
    const steps = Math.abs(point[0] - previous[0]) + Math.abs(point[1] - previous[1]);
    const [dc, dr] = [Math.sign(point[0] - previous[0]), Math.sign(point[1] - previous[1])];
    for (let step = 1; step <= steps; step++) cells.push([previous[0] + dc * step, previous[1] + dr * step]);
  });
  return cells;
}

/** Whether a point (mm) lies in a keep-out grown by `margin`. */
function pointIn(keepout: Keepout, x: number, y: number, margin = 0): boolean {
  if (keepout.kind === 'box') return x >= keepout.x - margin && x <= keepout.x + keepout.w + margin && y >= keepout.y - margin && y <= keepout.y + keepout.h + margin;
  return Math.hypot(x - keepout.cx, y - keepout.cy) <= keepout.d / 2 + margin;
}

/** Whether an axis-aligned segment (mm) comes within `margin` of a keep-out. */
function segmentHits(keepout: Keepout, a: { x: number; y: number }, b: { x: number; y: number }, margin: number): boolean {
  const [x0, x1, y0, y1] = [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.y, b.y), Math.max(a.y, b.y)];
  if (keepout.kind === 'box')
    return x0 <= keepout.x + keepout.w + margin && x1 >= keepout.x - margin && y0 <= keepout.y + keepout.h + margin && y1 >= keepout.y - margin;
  const [nx, ny] = [Math.min(Math.max(keepout.cx, x0), x1), Math.min(Math.max(keepout.cy, y0), y1)];
  return Math.hypot(nx - keepout.cx, ny - keepout.cy) <= keepout.d / 2 + margin;
}

/** The wire's insulation outer diameter at its largest, and its conductor, or undefined when the part is not a hookup wire. */
function wireOf(part: Part | undefined): { D: number; d: number } | undefined {
  const [D, d] = [part?.dimensions['D'], part?.dimensions['d']];
  return part?.family === 'hookup-wire' && D && d ? { D: D.max ?? D.value, d: d.max ?? d.value } : undefined;
}

/**
 * Every problem with a wire-guide design, as field-level issues (empty when it is valid): the schema first (a design that does
 * not match it is not checked further), then the board, the parts, the holes, the paths, the levels and the prints. Pure: it
 * reads only the bundled parts library, so the assistant, the API and the worker report the same issues. At most
 * `WIRE_GUIDE_LIMITS.issues` issues are returned.
 */
export function validateWireGuideDesign(design: unknown): WireGuideIssue[] {
  if (!Value.Check(WireGuideDesignSchema, design)) {
    const seen = new Set<string>();
    const issues: WireGuideIssue[] = [];
    for (const error of Value.Errors(WireGuideDesignSchema, design)) {
      const issue = { path: error.instancePath, message: error.message };
      const id = `${issue.path}\n${issue.message}`;
      if (seen.has(id)) continue;
      seen.add(id); issues.push(issue);
      if (issues.length >= WIRE_GUIDE_LIMITS.issues) break;
    }
    return issues.length ? issues : [{ path: '', message: 'The design does not match the WireGuideDesign schema.' }];
  }
  return designIssues(design).slice(0, WIRE_GUIDE_LIMITS.issues);
}

/** The checks beyond the schema, for a design that matches it. */
function designIssues(design: WireGuideDesign): WireGuideIssue[] {
  const issues: WireGuideIssue[] = [];
  const issue = (path: string, message: string) => { issues.push({ path, message }); };

  // --- the board and the wire parts ---
  const boardPart = findPart(design.boardPartId);
  const board = boardPart ? prototypeBoardLayout(boardPart) : undefined;
  if (!boardPart) issue('/boardPartId', `${design.boardPartId} is not in the parts library.`);
  else if (!board) issue('/boardPartId', `${design.boardPartId} is a ${boardPart.family}, not a prototype board.`);

  const defaultWire = wireOf(findPart(design.wirePartId));
  if (!defaultWire) issue('/wirePartId', findPart(design.wirePartId) ? `${design.wirePartId} is not a hookup wire.` : `${design.wirePartId} is not in the parts library.`);
  const wires = design.wires.map((wire, index) => {
    if (wire.wirePartId === undefined) return defaultWire;
    const part = findPart(wire.wirePartId); const own = wireOf(part);
    if (!own) issue(`/wires/${index}/wirePartId`, part ? `${wire.wirePartId} is not a hookup wire.` : `${wire.wirePartId} is not in the parts library.`);
    return own;
  });

  // --- unique ids ---
  const duplicates = (ids: string[], path: (index: number) => string, what: string) => {
    const first = new Map<string, number>();
    ids.forEach((id, index) => {
      const earlier = first.get(id);
      if (earlier === undefined) first.set(id, index); else issue(path(index), `${what} ${id} is used twice (also at index ${earlier}).`);
    });
  };
  duplicates(design.wires.map(wire => wire.id), index => `/wires/${index}/id`, 'Wire id');
  duplicates(design.prints.map(print => print.id), index => `/prints/${index}/id`, 'Print id');
  duplicates((design.components ?? []).map(component => component.ref), index => `/components/${index}/ref`, 'Component ref');

  // --- the guide's own settings ---
  const { guide } = design;
  if (guide.funnelBottomDiameter > guide.funnelTopDiameter)
    issue('/guide/funnelBottomDiameter', `The funnel’s outlet (${guide.funnelBottomDiameter} mm) is wider than its opening (${guide.funnelTopDiameter} mm).`);

  // --- the prints: every wire in exactly one ---
  const wireIndex = new Map(design.wires.map((wire, index) => [wire.id, index]));
  const printOf = new Map<string, number>();
  design.prints.forEach((print, p) => print.wireIds.forEach((id, w) => {
    if (!wireIndex.has(id)) { issue(`/prints/${p}/wireIds/${w}`, `Wire ${id} is not in the design.`); return; }
    const earlier = printOf.get(id);
    if (earlier === undefined) printOf.set(id, p);
    else issue(`/prints/${p}/wireIds/${w}`, `Wire ${id} is already in print ${design.prints[earlier]?.id ?? earlier}: every wire belongs to exactly one print.`);
  }));
  design.wires.forEach((wire, index) => { if (!printOf.has(wire.id)) issue(`/wires/${index}`, `Wire ${wire.id} is in no print: every wire belongs to exactly one print.`); });

  // Everything below needs the board.
  if (!board) return issues;
  const { grid, outline } = board;
  const onGrid = ([column, row]: Ref) => column < grid.columns && row < grid.rows;
  const mm = ([column, row]: Ref) => board.point(column, row);

  if (guide.registration === 'mounting-holes' && board.mountingHoles.length === 0)
    issue('/guide/registration', `${design.boardPartId} has no mounting holes: use edge clips.`);
  if (guide.funnelTopDiameter > grid.pitch)
    issue('/guide/funnelTopDiameter', `The funnel’s opening (${guide.funnelTopDiameter} mm) is wider than the board’s pitch (${grid.pitch} mm): the funnels of neighbouring holes would merge.`);

  // --- the wire parts against the board and the guide ---
  const reportedParts = new Set<string>();
  design.wires.forEach((wire, index) => {
    const part = wires[index]; if (!part) return;
    const id = wire.wirePartId ?? design.wirePartId; const path = wire.wirePartId === undefined ? '/wirePartId' : `/wires/${index}/wirePartId`;
    if (reportedParts.has(path)) return;
    const width = part.D + guide.channelClearance;
    const before = issues.length;
    if (part.d >= board.drill) issue(path, `The conductor of ${id} (${part.d} mm) does not pass the board’s ${board.drill} mm holes.`);
    if (part.d >= guide.funnelBottomDiameter) issue(path, `The conductor of ${id} (${part.d} mm) does not pass the funnel’s ${guide.funnelBottomDiameter} mm outlet.`);
    if (width >= grid.pitch) issue(path, `A channel for ${id} (${Math.round(width * 1000) / 1000} mm with the clearance) is not narrower than the board’s pitch (${grid.pitch} mm).`);
    if (issues.length > before) reportedParts.add(path);
  });

  // --- components: pins on drilled holes, no hole shared ---
  const pinOwner = new Map<string, string>();
  (design.components ?? []).forEach((component, c) => {
    component.pins.forEach((pin, p) => {
      if (!board.hole(pin[0], pin[1])) { issue(`/components/${c}/pins/${p}`, `${component.ref}’s pin ${show(pin)} is not a drilled hole of ${design.boardPartId}.`); return; }
      const owner = pinOwner.get(key(pin));
      if (owner !== undefined) issue(`/components/${c}/pins/${p}`, `${component.ref}’s pin ${show(pin)} is also a pin of ${owner}.`);
      else pinOwner.set(key(pin), component.ref);
    });
  });
  const obstacles: { keepout: Keepout; path: string; name: string }[] = [
    ...(design.components ?? []).map((component, c) => ({ keepout: component.body, path: `/components/${c}/body`, name: `${component.ref}’s body` })),
    ...(design.keepouts ?? []).map((keepout, k) => ({ keepout, path: `/keepouts/${k}`, name: `keep-out ${k}` })),
  ];

  // --- wire ends: drilled holes, one end per hole, not in a pin hole or under an obstacle ---
  const endOwner = new Map<string, string>();
  design.wires.forEach((wire, index) => {
    for (const end of ['from', 'to'] as const) {
      const ref = wire[end]; const path = `/wires/${index}/${end}`;
      if (!board.hole(ref[0], ref[1])) { issue(path, `Wire ${wire.id} ends at ${show(ref)}, which is not a drilled hole of ${design.boardPartId}.`); continue; }
      const owner = endOwner.get(key(ref));
      if (owner !== undefined) issue(path, `Wire ${wire.id} ends at ${show(ref)}, where wire ${owner} already ends: one wire end per hole.`);
      else endOwner.set(key(ref), wire.id);
      const pin = pinOwner.get(key(ref));
      if (pin !== undefined) issue(path, `Wire ${wire.id} ends at ${show(ref)}, a pin hole of ${pin}.`);
      const { x, y } = mm(ref);
      for (const obstacle of obstacles) if (pointIn(obstacle.keepout, x, y)) issue(path, `Wire ${wire.id} ends at ${show(ref)}, under ${obstacle.name}.`);
    }
    if (same(wire.from, wire.to)) issue(`/wires/${index}/to`, `Wire ${wire.id} starts and ends at the same hole.`);
  });

  // --- paths: on the grid, axis-aligned, inside the outline, clear of obstacles; the levels: no crossing or overlap ---
  const occupied = new Map<string, string>();
  const regions = design.prints.map(print => print.region && {
    c0: Math.min(print.region.from[0], print.region.to[0]), c1: Math.max(print.region.from[0], print.region.to[0]),
    r0: Math.min(print.region.from[1], print.region.to[1]), r1: Math.max(print.region.from[1], print.region.to[1]),
  });
  design.wires.forEach((wire, index) => {
    const points: Ref[] = [wire.from, ...wire.path, wire.to];
    const pathOf = (p: number) => p === 0 ? `/wires/${index}/from` : p === points.length - 1 ? `/wires/${index}/to` : `/wires/${index}/path/${p - 1}`;
    const before = issues.length;
    points.forEach((point, p) => {
      if (!onGrid(point)) issue(pathOf(p), `${show(point)} is off ${design.boardPartId}’s ${grid.columns} × ${grid.rows} grid.`);
      const previous = points[p - 1];
      if (!previous) return;
      if (same(previous, point)) issue(pathOf(p), `Wire ${wire.id} repeats ${show(point)}: a segment has no length.`);
      else if (previous[0] !== point[0] && previous[1] !== point[1]) issue(pathOf(p), `Wire ${wire.id} runs diagonally from ${show(previous)} to ${show(point)}: segments must be along a column or a row.`);
    });
    if (issues.length > before) return; // its geometry is undefined; the checks below would only repeat the problem

    const part = wires[index]; const half = ((part?.D ?? 0) + guide.channelClearance) / 2;
    points.forEach((point, p) => {
      const { x, y } = mm(point);
      if (x - half < 0 || y - half < 0 || x + half > outline.L || y + half > outline.W)
        issue(pathOf(p), `Wire ${wire.id}’s channel at ${show(point)} leaves the board’s outline.`);
      const previous = points[p - 1];
      if (!previous) return;
      for (const obstacle of obstacles) if (segmentHits(obstacle.keepout, mm(previous), mm(point), half))
        issue(pathOf(p), `Wire ${wire.id} runs from ${show(previous)} to ${show(point)} through ${obstacle.name}.`);
    });

    const cells = rasterize(points);
    const visited = new Set<string>();
    const reported = new Set<string>();
    cells.forEach((cell, c) => {
      const k = key(cell);
      if (visited.has(k)) { issue(`/wires/${index}/path`, `Wire ${wire.id} crosses or doubles back over itself at ${show(cell)}.`); return; }
      visited.add(k);
      const inner = c > 0 && c < cells.length - 1;
      if (inner) {
        const end = endOwner.get(k);
        if (end !== undefined) issue(`/wires/${index}/path`, `Wire ${wire.id} passes over ${show(cell)}, where wire ${end} drops into its hole.`);
        const pin = pinOwner.get(k);
        if (pin !== undefined) issue(`/wires/${index}/path`, `Wire ${wire.id} passes over ${show(cell)}, a pin hole of ${pin}.`);
      }
      const levelKey = `${wire.level}:${k}`;
      const other = occupied.get(levelKey);
      if (other === undefined) occupied.set(levelKey, wire.id);
      else if (!reported.has(other)) { reported.add(other); issue(`/wires/${index}/level`, `Wire ${wire.id} crosses or overlaps wire ${other} at ${show(cell)} on level ${wire.level}: put one of them on another level.`); }
    });

    const print = printOf.get(wire.id);
    const region = print === undefined ? undefined : regions[print];
    if (region && cells.some(([column, row]) => column < region.c0 || column > region.c1 || row < region.r0 || row > region.r1))
      issue(`/wires/${index}`, `Wire ${wire.id} leaves the region of print ${design.prints[print ?? 0]?.id}.`);
  });

  // --- prints: their regions on the board, and apart ---
  regions.forEach((region, p) => {
    if (!region) return;
    if (!onGrid([region.c1, region.r1])) issue(`/prints/${p}/region`, `Print ${design.prints[p]?.id}’s region runs off ${design.boardPartId}’s ${grid.columns} × ${grid.rows} grid.`);
    regions.slice(0, p).forEach((other, q) => {
      if (other && region.c0 <= other.c1 && other.c0 <= region.c1 && region.r0 <= other.r1 && other.r0 <= region.r1)
        issue(`/prints/${p}/region`, `Print ${design.prints[p]?.id}’s region overlaps print ${design.prints[q]?.id}’s.`);
    });
  });
  return issues;
}

/** The layout a valid design is drawn on (undefined when its board is not a prototype board of the library). */
export function wireGuideBoard(design: Pick<WireGuideDesign, 'boardPartId'>): PrototypeBoardLayout | undefined {
  const part = findPart(design.boardPartId);
  return part ? prototypeBoardLayout(part) : undefined;
}
