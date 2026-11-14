# Wire-guide designs

A wire-guide design (`WireGuideDesign`, `packages/contracts/src/wireGuide.ts`) is the contract between KiPrint, the assistant
and the renderer (#152). It describes the solid-core wires routed on a prototype board and the separate guide prints that hold
them. The guide sits on the component side and stays on the board. Only the wire ends are soldered, on the solder side.

A design is data, never code. The renderer (the `prototype-wire-guide` model, see [The guide prints](#the-guide-prints)) turns it
into geometry with trusted code, and `validateWireGuideDesign` checks it the same way everywhere it is used.

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

1. **Size:** a design is at most 200 kB as JSON (`WIRE_GUIDE_LIMITS.bytes`), and its wires have at most 2000 grid points
   (ends and waypoints) together (`WIRE_GUIDE_LIMITS.points`). A design over 200 kB gets that issue only. The schema can't
   express either bound, so its description states them.
2. **Schema:** a design that doesn't match the schema gets the schema's issues only. The schema enforces these bounds:
   - at most 200 wires, 64 waypoints per wire, 8 prints, 6 levels (0–5), 100 components of up to 64 pins each, and 64
     keep-outs;
   - grid indices from 0 to 255;
   - every dimension within its bounds: cover 0.6–4 mm, clearance 0–1 mm, funnel opening 1–5 mm, outlet 0.3–3 mm, standoff
     0–10 mm, keep-outs up to 500 mm across and 100 mm high.
3. **Parts:**
   - `boardPartId` is a prototype board of the library;
   - `wirePartId` and every per-wire `wirePartId` are hookup-wire parts;
   - each wire's conductor passes the board's holes and the funnel's outlet;
   - each wire's channel is narrower than the pitch.
4. **Ids:** wire ids, print ids and component refs are unique.
5. **Guide:**
   - the funnel's outlet is no wider than its opening;
   - the opening is no wider than the pitch, so neighbouring funnels don't merge;
   - `mounting-holes` registration needs a board with mounting holes.
6. **Components:** every pin is a drilled hole, and no hole is the pin of two components. A component's body is a keep-out.
7. **Wire ends:**
   - every end is a drilled hole (`hole(column, row)`);
   - each hole takes at most one wire end;
   - no end is in a component's pin hole, or under a component's body or a keep-out;
   - a wire doesn't start and end at the same hole.
8. **Paths:**
   - every point is on the board's grid;
   - every segment runs along a column or a row and has a length;
   - the channel stays inside the outline;
   - no segment runs through a component's body or a keep-out, grown by half the channel's width.
   - A waypoint may lie over an empty grid position, such as the Perma-Proto's middle channel.
9. **Levels:**
   - two wires on the same level never cross or overlap;
   - a wire never crosses itself;
   - no wire, on any level, passes over another wire's end (that wire drops into its hole there) or over a component's pin
     hole. A lower wire's end under a higher wire isn't buildable either way: its funnel's shaft would open the higher wire's
     bridge and floor;
   - a wire runs straight through every grid position that a wire on a higher level covers. It may not turn there, so that it
     can be threaded under that wire's bridge. A straight run under a higher wire may be any length. The issue is at the
     corner's waypoint (`/wires/<i>/path/<j>`): `Wire C turns at [5, 6] under wire B on level 2: a wire runs straight under a
     wire on a higher level, so that it can be threaded under its bridge.`
10. **Prints:**
   - every wire belongs to exactly one print, and every wire a print lists exists;
   - a print's `region`, when given, lies on the grid, holds all of its wires, and doesn't overlap another print's region.

## Board data for KiPrint

KiPrint runs server-side and can't import the bundle, so it reads the board data from the read-only parts API (see
[interfaces.md](interfaces.md#parts-library)):

- `GET /api/v1/parts/{id}`: a part, its family and its resolved sources.
- `GET /api/v1/parts/{id}/layout`: the layout of a prototype or development board.

## The guide prints

The `prototype-wire-guide` model renders a design: one STL per print, in a ZIP (`print-1.stl` …), on the usual
`/api/v1/renders/{id}/zip` route.

### The design as a parameter

The model has one parameter, `design`, a **structured document** (control kind `document`, `ModelDefinition.documents`):

- **Schema:** `WireGuideDesignSchema`. A render request carries the design as a JSON object: `parameters: { design: {…} }`.
- **Validation:** `validateParameters` checks it with `validateWireGuideDesign` itself, the one function the assistant, KiPrint,
  the API, the worker and the editor share; its size bounds included. The API takes request bodies up to 256 KiB.

  Each issue's field is `design` followed by its JSON Pointer, e.g. `design/wires/3/path/1`. The API (422
  `INVALID_PARAMETERS`) and the worker (`SETTINGS_INVALID`) report the same issues.
- **SCAD input:** `wireGuideScad` works out every print's geometry (`wireGuideGeometry`) and writes it as `-D GUIDE=`, nested
  lists of numbers only. Each print's part picks its own print with the trusted constant `PRINT`. Ids, net names, footprints
  and part ids never reach OpenSCAD.
- **Cache key:** the parameters, as for every model, as canonical JSON (keys sorted at every depth). The board and wire parts'
  data is part of the fingerprint (`linkedFamilies`).

### Geometry

Each print is drawn where it sits on the board (the board's frame), the right way up:

- **Block and plate.** A block over the print's wires and funnels, plus a 1.2 mm margin, and over its region if it has one. It
  may overhang the outline by at most the margin. Its underside is at the PCB's top + `funnelStandoff`. The bottom
  `coverThickness` of it is the **cover plate**: it lies over the board, under the lowest channel layer.
- **Channels.** Each wire's channel is as wide as its own wire's insulation OD `max` + `channelClearance`
  (`hookupWireChannelWidth`; a per-wire `wirePartId` overrides the design's). Channels are open upwards, from the floor of
  their layer to the top.
  - The floors step up by the print's widest channel + 0.6 mm per layer. A print uses only the levels it has, so its
    layers are those levels, compressed.
  - The top is the highest floor + the widest channel.
- **Bridges.** Where a higher channel crosses or runs over a lower one, a 0.6 mm bridge carries the higher wire. The lower wire
  passes under it, in a tunnel at least as tall as the widest channel.
- **Funnels.** Every wire end has a funnel: a cone from the outlet (`funnelBottomDiameter`) at the underside to the opening
  (`funnelTopDiameter`) just above the plate's top, then a shaft of the opening's diameter up through the top.
  - Below the underside, the outlet goes on as a bore 0.3 mm into the board's thickness. A boss's column or a clip's foot
    standing on the board beside the hole is cut through and never closes it. On a stripboard, the four holes 2.54 mm from a
    mounting hole lie under its boss's column.
- **Pockets.** Every component body and keep-out is pocketed from below, grown by 0.3 mm on every side and on top.
  - A pocket that would leave less than 0.4 mm under the top goes through the print.
  - A pocket side (or a round pocket's edge along X or Y) within 0.02 mm of a channel's or the block's side moves 0.02 mm
    further out. Coincident sides leave float32 slivers, or a mesh that can't be repaired.
  - A body lower than the underside gets no pocket.
  - A print may therefore be several bodies (`separateBodies`), though the samples are one.
- **Registration.**
  - `mounting-holes`: a boss on the two mounting holes nearest the print's middle. Each boss is a column (the hole + 1.2 mm
    wall), standing on the board when there is a standoff, with a pin (the hole − 0.3 mm) three quarters of the way down
    the hole. A print with a `region` takes only the mounting holes in its region, so prints never share one; it may have
    none.
  - `edge-clips`: the print spans the board's width, and a clip on each edge along X grips the board. Each clip is a wall
    0.2 mm off the edge, a 0.6 mm lip under the board, and a foot on its top.

### Keep-out conventions (for KiPrint)

- A box is given by its lowest corner (`x`, `y`), `w` along X and `h` along Y. A cylinder has a vertical axis, centre
  (`cx`, `cy`) and diameter `d`.
- `height` is the top of the body above the PCB's top surface (z = t + height in the board frame).
- Give the real body envelope. The renderer adds its own 0.3 mm clearance (`WIRE_GUIDE_GEOMETRY.pocketClearance`).
- Keep-outs may overlap each other, the outline and print boundaries. Validation keeps channels clear of them by half a
  channel's width, and wire ends off them. Component pins may lie under their body.
- Half a channel's width is all the renderer needs. Its 0.3 mm pocket clearance may cut into a channel's side, which leaves the
  channel open. A router doesn't need to add the clearance to its own margin.
- With `mounting-holes` registration, wire ends may use the holes beside a mounting hole (see Funnels).

### Samples and tests

The sample designs in `models/prototype-wire-guide/samples/` are:

| Sample | Board | What it covers |
| --- | --- | --- |
| `perfboard-one-level.json` | perfboard | one print, one level; bosses; DIP-8 and tall-capacitor pockets. It is the model's default. |
| `perfboard-two-levels.json` | perfboard | crossings on two levels, a per-wire 22 AWG override; edge clips |
| `stripboard-three-prints.json` | stripboard | three prints by region |
| `perma-proto-bus.json` | Perma-Proto | rails and strips (bus) |
| `stripboard-boss-neighbours.json` | stripboard | wire ends on the four holes beside a mounting hole, under its boss's column |
| `pockets-on-channel-sides.json` | perfboard | box and round bodies exactly half a channel + 0.3 mm from their channels |
| `kiprint-perma-proto-timer.json` | Perma-Proto quarter | KiPrint's `plan_guide` output: 4 components, 8 wires on 2 levels (W7, W8 rerouted) |
| `kiprint-crossing-two-levels.json` | perfboard | KiPrint: 4 wires on 3 levels, crossing (C rerouted) |
| `kiprint-stripboard-regulator.json` | stripboard | KiPrint: a 19 mm tall TO-220, pocketed through |

- `invalid/` keeps KiPrint's original two designs, whose lower wires turn under a higher wire, as fixtures. A unit test pins
  their issues. The samples differ from them only in those wires' paths.
- `npm run test:renderer` (`TEST_ONLY=prototype-wire-guide`) renders each sample. It checks every print with
  `tools/wire-guide-checks.ts` against the encoder's geometry: one closed solid with no float32 repairs; open channels, tunnels
  and funnels, each funnel's bore open down to the board; solid bridges, plate, pins and clips; open pockets.
- The unit tests cover the samples, the numbers-only encoding, the bounds, and the API–worker parity of issues.

### Editor

The editor's document field (`apps/web/src/WireGuideField.tsx`) shows:

- a map and summary of the design: board, wire, wire count, levels and prints;
- the guide's settings;
- **Import design (.json)** and **Download design**.

An imported file is checked in the browser with the same function. Only a valid design replaces the current one; an invalid
one is listed with its issues. So the model works without the assistant.

The assistant opens a design with `canfactory_open_wire_guide_design` (`apps/web/src/assistant/controller.ts`). It checks the
design with `validateWireGuideDesign` first and returns the same `{ path, message }` issues as
`canfactory_validate_wire_guide_design`, opening nothing. A valid design replaces the editor's own, through the editor's
parameters as an import does, so the editor's render queue and its one-job rule apply. `canfactory_set_model_parameters`
rejects this model: a design is never set as a parameter.
