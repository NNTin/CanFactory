# Wire-guide designs

A wire-guide design (`WireGuideDesign`, `packages/contracts/src/wireGuide.ts`) is the contract between KiPrint, the assistant
and the renderer (#152). It describes the solid-core wires routed on a prototype board and the separate guide prints that hold
them. The guide sits on the component side and stays on the board. Only the wire ends are soldered, on the solder side.

A design is data, never code. The renderer (the `prototype-wire-guide` model, a later phase) turns it into geometry with
trusted code, and `validateWireGuideDesign` checks it the same way everywhere it is used.

## Where the schema lives

- **TypeBox:** `WireGuideDesignSchema` in `@canfactory/contracts`, with `Keepout`, `WireGuideWire`, `WireGuidePrint`,
  `WireGuideComponent` and `WIRE_GUIDE_LIMITS`.
- **JSON Schema:** [`docs/schemas/wire-guide-design.schema.json`](schemas/wire-guide-design.schema.json), draft-07 (the dialect
  TypeBox writes tuples in), for tools that cannot import TypeBox, such as KiPrint.
  - `npm run contracts:generate` writes it from the TypeBox schema, next to `docs/openapi.json`.
  - `npm run contracts:check` fails when it is stale.
  - Its `$id` is the file's URL on `develop`.

## Frame

The frame is `prototypeBoardLayout`'s, which `GET /api/v1/parts/{id}/layout` also serves:

- **Units and origin:** millimetres, Z up, the PCB's underside on z = 0 and the board's corner at the origin.
- **View:** seen from the component side.
- **Grid:** columns along +X and rows along +Y, both 0-based. Hole `[column, row]` is at
  (`x0` + column × `pitch`, `y0` + row × `pitch`).

Holes and waypoints are grid positions `[column, row]`. Keep-outs are in millimetres. KiPrint converts to and from KiCad itself.

## The document

```ts
{
  schemaVersion: 1,
  boardPartId: 'adafruit-perma-proto-half',     // a prototype-board part
  wirePartId: 'alpha-wire-3051-1',              // a hookup-wire part
  source?: { tool: 'kiprint', version, projectId },
  components?: [{ ref: 'U1', footprint: 'DIP-8', pins: [[20, 7], …], body: Keepout }],
  wires: [{ id: 'W1', wirePartId?, net?, from: [0, 3], to: [5, 3], path: [], level: 0 }],
  prints: [{ id: 'G1', wireIds: ['W1'], region?: { from: [0, 0], to: [9, 17] } }],
  guide: { registration: 'mounting-holes' | 'edge-clips', coverThickness, channelClearance,
           funnelTopDiameter, funnelBottomDiameter, funnelStandoff },
  keepouts?: Keepout[],
}

Keepout =
  | { kind: 'box', x, y, w, h, height }        // from its lowest corner (x, y): w along X, h along Y
  | { kind: 'cylinder', cx, cy, d, height }    // diameter d round (cx, cy)
// height: the top of the obstacle above the PCB's top
```

- **Wire routes:** a wire runs `from` → `path…` → `to`. `path` holds only the waypoints between the ends, so a straight wire
  has an empty `path`.
- **Levels:** `level` is the channel layer, where 0 is the lowest above the board.
- **Channel width:** a wire's channel is its insulation's largest outer diameter plus `channelClearance`. The width comes from
  `hookupWireChannelWidth(part, clearance)`, which reads `dimensionOf(part, 'D', 'max')`.
- **Display-only fields:** ids and net names are for display. They never reach SCAD.

## Validation

`validateWireGuideDesign(design: unknown): { path, message }[]` is one pure function, used by the assistant tool, the API and
the worker. `path` is the JSON Pointer of the field the issue is about (`/wires/3/path/1`), and an empty list means the design
is valid. It returns at most 100 issues.

1. **Schema:** a design that doesn't match the schema gets the schema's issues only. The schema enforces these bounds:
   - at most 200 wires, 64 waypoints per wire, 8 prints, 6 levels (0–5), 100 components of up to 64 pins each, and 64
     keep-outs;
   - grid indices from 0 to 255;
   - every dimension within its bounds: cover 0.6–4 mm, clearance 0–1 mm, funnel opening 1–5 mm, outlet 0.3–3 mm, standoff
     0–10 mm, keep-outs up to 500 mm across and 100 mm high.
2. **Parts:**
   - `boardPartId` is a prototype board of the library;
   - `wirePartId` and every per-wire `wirePartId` are hookup-wire parts;
   - each wire's conductor passes the board's holes and the funnel's outlet;
   - each wire's channel is narrower than the pitch.
3. **Ids:** wire ids, print ids and component refs are unique.
4. **Guide:**
   - the funnel's outlet is no wider than its opening;
   - the opening is no wider than the pitch, so neighbouring funnels don't merge;
   - `mounting-holes` registration needs a board with mounting holes.
5. **Components:** every pin is a drilled hole, and no hole is the pin of two components. A component's body is a keep-out.
6. **Wire ends:**
   - every end is a drilled hole (`hole(column, row)`);
   - each hole takes at most one wire end;
   - no end is in a component's pin hole, or under a component's body or a keep-out;
   - a wire doesn't start and end at the same hole.
7. **Paths:**
   - every point is on the board's grid;
   - every segment runs along a column or a row and has a length;
   - the channel stays inside the outline;
   - no segment runs through a component's body or a keep-out, grown by half the channel's width.
   - A waypoint may lie over an empty grid position, such as the Perma-Proto's middle channel.
8. **Levels:**
   - two wires on the same level never cross or overlap;
   - a wire never crosses itself;
   - no wire, on any level, passes over another wire's end (that wire drops into its hole there) or over a component's pin
     hole.
9. **Prints:**
   - every wire belongs to exactly one print, and every wire a print lists exists;
   - a print's `region`, when given, lies on the grid, holds all of its wires, and doesn't overlap another print's region.

## Board data for KiPrint

KiPrint runs server-side and can't import the bundle, so it reads the board data from the read-only parts API (see
[interfaces.md](interfaces.md#parts-library)):

- `GET /api/v1/parts/{id}`: a part, its family and its resolved sources.
- `GET /api/v1/parts/{id}/layout`: the layout of a prototype or development board.
