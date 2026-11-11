import { Type, type Static } from 'typebox';
import { devBoardLayout, findPartFamily, findPartSource, PartFamilySchema, PartSchema, PartSourceSchema, prototypeBoardLayout, type Part, type PartSource } from './parts/index.ts';

/**
 * The read-only parts API (`GET /api/v1/parts/{id}` and `/layout`): the bundled parts library for callers that cannot import
 * @canfactory/contracts, such as KiPrint, which builds its KiCad projects on a prototype board's grid. See docs/interfaces.md.
 */

const Num = Type.Number();
const Point = { x: Num, y: Num };
const HoleRef = Type.Tuple([Type.Integer({ minimum: 0 }), Type.Integer({ minimum: 0 })], { description: 'A grid position [column, row], 0-based.' });
const Nullable = <T extends Parameters<typeof Type.Union>[0][number]>(schema: T) => Type.Union([schema, Type.Null()]);

export const PartResponseSchema = Type.Object({
  part: PartSchema,
  family: PartFamilySchema,
  sources: Type.Array(PartSourceSchema, { description: 'Every source the part cites, resolved.' }),
  layout: Nullable(Type.String({ description: 'Where its layout is served (prototype and development boards).' })),
}, { additionalProperties: false, description: 'A part of the parts library, with its family and its sources.' });
export type PartResponse = Static<typeof PartResponseSchema>;

const Pad = Nullable(Type.Object({ shape: Type.Union([Type.Literal('round'), Type.Literal('square')]), size: Num }, { additionalProperties: false }));
const Surface = Type.Union([Type.Literal('white mask'), Type.Literal('green mask'), Type.Literal('bare')]);

export const PrototypeBoardLayoutDataSchema = Type.Object({
  kind: Type.Literal('prototype-board'),
  partId: Type.String(),
  frame: Type.String(),
  outline: Type.Object({ L: Num, W: Num, t: Num, r: Num }, { additionalProperties: false, description: 'The board runs from x = 0 to L and y = 0 to W, t thick, corner radius r (0: square).' }),
  grid: Type.Object({
    x0: Num, y0: Num, pitch: Num, columns: Type.Integer(), rows: Type.Integer(),
  }, { additionalProperties: false, description: 'Grid position (column, row) is at (x0 + column × pitch, y0 + row × pitch): (x0, y0) is the first hole’s offset from the corner.' }),
  columnLabels: Type.Array(Nullable(Type.String()), { description: 'What the board prints beside each column, by column (null: nothing).' }),
  rowLabels: Type.Array(Nullable(Type.String()), { description: 'What the board prints beside each row, by row (null: nothing).' }),
  drill: Type.Number({ description: 'Hole (drill) diameter.' }),
  plated: Type.Boolean(),
  pads: Type.Object({ top: Pad, bottom: Pad }, { additionalProperties: false, description: 'The pad round every hole on each side (null: no copper on that side).' }),
  surface: Type.Object({ top: Surface, bottom: Surface }, { additionalProperties: false }),
  material: Type.Union([Type.Literal('FR4'), Type.Literal('FR2')]),
  finish: Type.Union([Type.Literal('gold'), Type.Literal('tin'), Type.Literal('copper')]),
  holes: Type.Array(Type.Object({
    column: Type.Integer(), row: Type.Integer(), ...Point, label: Nullable(Type.String()), net: Nullable(Type.String()),
  }, { additionalProperties: false }), { description: 'Every drilled hole of the grid (a grid position can be empty), row by row.' }),
  traces: Type.Array(Type.Object({
    from: HoleRef, to: HoleRef, side: Type.Union([Type.Literal('top'), Type.Literal('bottom')]), width: Num,
  }, { additionalProperties: false }), { description: 'Copper between neighbouring holes. Leave cut ones out and recompute the connected holes for the nets that remain.' }),
  nets: Type.Array(Type.Object({
    id: Type.String(), kind: Type.Union([Type.Literal('strip'), Type.Literal('rail'), Type.Literal('linked')]), holes: Type.Array(HoleRef),
  }, { additionalProperties: false }), { description: 'The holes the traces connect.' }),
  mountingHoles: Type.Array(Type.Object({ ...Point, d: Num, plated: Type.Boolean() }, { additionalProperties: false })),
}, { additionalProperties: false, description: 'A prototype board’s layout (prototypeBoardLayout).' });
export type PrototypeBoardLayoutData = Static<typeof PrototypeBoardLayoutDataSchema>;

const Area = { x0: Num, y0: Num, x1: Num, y1: Num };
const Pin = Type.Object({ name: Type.String(), ...Point }, { additionalProperties: false });
const Basis = Type.Union([Type.Literal('standard'), Type.Literal('manufacturer'), Type.Literal('estimated')]);

export const DevBoardLayoutDataSchema = Type.Object({
  kind: Type.Literal('dev-board'),
  partId: Type.String(),
  frame: Type.String(),
  outline: Type.Object({ W: Num, L: Num, t: Num, r: Num }, { additionalProperties: false, description: 'The board runs from x = 0 to W and y = 0 to L, t thick, corner radius r (0: square).' }),
  pins: Type.Array(Pin),
  castellated: Type.Boolean(),
  usb: Type.Object({ ...Area, height: Num }, { additionalProperties: false }),
  components: Type.Array(Type.Object({
    name: Type.String(),
    kind: Type.Enum(['camera', 'pcb', 'button', 'led', 'chip', 'regulator', 'crystal', 'diode', 'antenna', 'connector', 'shield', 'other']),
    ...Point, width: Num, length: Num, height: Num, rotation: Num,
    base: Type.Optional(Num),
    top: Type.Optional(Type.Object({
      shape: Type.Union([Type.Literal('round'), Type.Literal('oval'), Type.Literal('rectangle')]), width: Num, length: Num, height: Num,
    }, { additionalProperties: false })),
    travel: Type.Optional(Num),
    sized: Basis, source: Type.String(),
  }, { additionalProperties: false })),
  antennaKeepout: Type.Object(Area, { additionalProperties: false }),
  externalAntenna: Type.Union([
    Type.Object({ kind: Type.Literal('connector'), name: Type.String(), ...Point, matedHeight: Num, select: Type.String(), source: Type.String() }, { additionalProperties: false }),
    Type.Object({ kind: Type.Literal('solder points'), signal: Type.Object(Point, { additionalProperties: false }), ground: Type.Object(Point, { additionalProperties: false }), how: Type.String(), source: Type.String() }, { additionalProperties: false }),
    Type.Null(),
  ]),
  bottomPads: Type.Array(Pin),
  bareUnderside: Type.Boolean(),
  solderMask: Type.Union([Type.Literal('black'), Type.Literal('blue')]),
}, { additionalProperties: false, description: 'A development board’s layout (devBoardLayout).' });
export type DevBoardLayoutData = Static<typeof DevBoardLayoutDataSchema>;

export const PartLayoutSchema = Type.Union([PrototypeBoardLayoutDataSchema, DevBoardLayoutDataSchema], { description: 'A board’s layout, by `kind`.' });
export type PartLayout = Static<typeof PartLayoutSchema>;

const PROTOTYPE_FRAME = 'mm, Z up; the PCB underside on z = 0 with the board corner at the origin, seen from the component side; columns along +X and rows along +Y, both 0-based.';
const DEV_FRAME = 'mm, Z up; the PCB underside on z = 0 with its corner at the origin, seen from the component side; the width W along X and the length L along Y, the USB-C receptacle at the +Y end. Heights are above the PCB top (z = t).';

/** The part's layout as plain data, for a prototype or development board; undefined for any other part. */
export function partLayoutData(part: Part): PartLayout | undefined {
  const board = prototypeBoardLayout(part);
  if (board) {
    const { outline, grid, columnLabels, rowLabels, drill, plated, pads, surface, material, finish, holes, traces, nets, mountingHoles } = board;
    return {
      kind: 'prototype-board', partId: part.id, frame: PROTOTYPE_FRAME, outline, grid, columnLabels, rowLabels, drill, plated, pads, surface,
      material, finish, holes, mountingHoles,
      traces: traces.map(trace => ({ ...trace, from: [trace.from[0], trace.from[1]], to: [trace.to[0], trace.to[1]] })),
      nets: nets.map(net => ({ ...net, holes: net.holes.map(([column, row]) => [column, row]) })),
    };
  }
  const dev = devBoardLayout(part);
  if (dev) {
    const value = (key: string) => part.dimensions[key]?.value ?? 0;
    return { kind: 'dev-board', partId: part.id, frame: DEV_FRAME, outline: { W: value('W'), L: value('L'), t: value('t'), r: value('r') }, ...dev };
  }
  return undefined;
}

/** The part with its family and resolved sources, as `GET /api/v1/parts/{id}` serves it; undefined for a part without a family. */
export function partResponse(part: Part): PartResponse | undefined {
  const family = findPartFamily(part.family);
  if (!family) return undefined;
  const ids = new Set([...part.standard ? [part.standard] : [], ...part.sources, ...Object.values(part.dimensions).map(dimension => dimension.source)]);
  const sources = [...ids].map(findPartSource).filter((source): source is PartSource => source !== undefined);
  return { part, family, sources, layout: partLayoutData(part) ? `/api/v1/parts/${part.id}/layout` : null };
}
