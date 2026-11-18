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
           funnelTopDiameter, funnelBottomDiameter, funnelStandoff, parts?: 'layers' | 'single' },
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
- **Pieces:** `guide.parts` says how each print is made: `layers` (the default, also when it is absent) as separate stackable
  layers and pegs, `single` as one piece per print with its registration fused on, as before #170. See
  [Separate layers and pegs](#separate-layers-and-pegs).
  - **What changed for existing designs (#170).** The field is optional, so every design written before it still matches the
    schema and the API accepts it as before. Its *physical output* is not unchanged: a design without `parts` now renders as
    separate layers and pegs instead of one fused piece per print. A design that needs the old output asks for it with
    `"parts": "single"`, which renders it as before. The model's version went from 1 to 2, so a cached or queued fused render of
    version 1 is never served for it.
  - Nothing chooses `single` for a design: a design whose layers can't be made is rejected with the reason (below).

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

The `prototype-wire-guide` model renders a design as a ZIP on the usual `/api/v1/renders/{id}/zip` route: one STL per printed
piece (`wireGuidePieces`), `wire-guide-assembly.txt` (what each STL is, how many to print, which way up, the pegs' fit and the
order to assemble them in) and `wire-guide-design.json` (the design they were made from). Per print of the design:

- `layers` (the default): `print-N-layer-K.stl` for each of its layers, from the bottom (K = 1), then `print-N-peg-J.stl` for each
  peg;
- `single`, or a print that can't be layered (the assembly guide and the editor say why): `print-N.stl`, the whole print.

This ZIP is the printed guide. KiPrint's KiCad-project ZIP (`export_project`) is a different file: the board, the components and
the planned wires for KiCad, with the design it planned as `wire-guide-design.json`. Both carry the design, so a test can check
that they hold the same one.

The model is at version 2: the pieces changed, so renders queued or cached for version 1 (one fused STL per print) are not served
for it (the cache key and the worker's check include the model's version and sources).

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

Each print is worked out where it sits on the board (the board's frame), the right way up; its separate layers are slices of it:

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
- **Registration.** As here for a one-piece print; separate layers have separate pegs instead of the bosses (see
  [Separate layers and pegs](#separate-layers-and-pegs)), and the clips stay on the bottom layer.
  - `mounting-holes`: a boss on the two mounting holes nearest the print's middle. Each boss is a column (the hole + 1.2 mm
    wall), standing on the board when there is a standoff, with a pin (the hole − 0.3 mm) three quarters of the way down
    the hole. A print with a `region` takes only the mounting holes in its region, so prints never share one; it may have
    none.
  - `edge-clips`: the print spans the board's width, and a clip on each edge along X grips the board. Each clip is a wall
    0.2 mm off the edge, a 0.6 mm lip under the board, and a foot on its top.

### Separate layers and pegs

With `guide.parts` `layers` (the default), each print is made as separate layers that stack on the board, one for each wire
level the print uses, and separate pegs (`wireGuideStack`, `WIRE_GUIDE_GEOMETRY.peg`).

- **Levels to layers.** A print's layers are its levels, compressed and in order: a print using levels 0, 1 and 2 has layers
  1, 2 and 3 from the bottom (`print-N-layer-1` holds level 0); one using levels 0 and 2 has two. So the number of layers is the
  number of levels its wires occupy. Each layer's wires are listed in the assembly guide and the preview's steps.
- **What a layer is.** The print's block (above) sliced at its bridges' undersides: layer 1 from the underside up to where the
  next level's bridges start, each layer above from there to the next, the top one to the top. A layer holds only its own level's
  channels, open upwards with a floor under them (the plate, or 0.6 mm, the bridge's thickness). It is closed over the lower
  levels: its underside lies on their wires, as the one-piece print's bridges do where they cross, so the wires keep the heights,
  routes and crossing order of the one-piece print and a lower wire is held in its channel along its whole length. Every layer
  has every funnel's shaft, so each wire end can be pushed down through the layers above its own, and the component pockets where
  they reach it. The bottom layer has the funnels' cones and the edge clips.
- **Board pegs.** In the mounting holes the one-piece print had bosses in (the two nearest the print's middle, within its region),
  a separate peg each: a tip 0.3 mm narrower than the hole, three quarters of the way down it; a 45° seat that sits on the hole's
  rim at the board's top; a shoulder (the hole + up to 2 × 1.2 mm, no wider than the hole + 2 × the standoff) up to the guide's
  underside, which the bottom layer rests on and so sets the standoff; and a shaft (the hole + 0.6 mm, or narrower to leave the
  shoulder 0.4 mm of bearing round its hole) up through every layer, stopping 0.2 mm under the top, with a 0.3 mm chamfer. For a
  Ø3.2 mm hole and a 1 mm standoff: a Ø2.9 tip, a Ø5.2 shoulder and a Ø3.8 shaft. Without a standoff the seat widens straight
  to the shaft.
  - Where a channel passes over the hole, the peg's shaft only goes into a socket in the bottom layer's plate, stopping 0.4 mm
    under the channels' floor (a plate of at least 1 mm), and dowels line up the layers.
  - Every mounting hole the one-piece print would have a boss in gets a peg, so the print is located on the board as before. A
    hole whose peg would cut a funnel, pocket or the print's edge, or whose shoulder would cover a wire end's hole or a component,
    makes the layers impossible (below).
- **Dowels.** A stack of two or more layers is lined up on two pegs through all of them. Where it has fewer board pegs through it
  (edge clips, a region without mounting holes, holes under channels), Ø2 mm dowels stand in blind holes in the bottom layer, 0.6
  mm above its underside, at the free points between the board's holes that are farthest apart (or farthest from the one board
  peg), and up through the layers above. They line the layers up with each other only: they never stand in the board, so no new
  hole is drilled. The board is located by its real mounting holes' pegs, or by the bottom layer's edge clips.
- **Fit.** Every layer's hole for a peg is its shaft + 0.3 mm across: a sliding fit, so the layers go down over the pegs by hand.
  Each hole keeps 0.6 mm from every channel, funnel, pocket and other hole. These are designed sizes; they have not been checked
  with a printed guide, and a printer that prints holes small may need them reamed.
- **Orientation.** Every STL lies the way it is used, ready to print: a layer flat on its underside (z = 0), a peg upright on its
  tip. Neither needs supports: a layer's underside is flat, and a peg's outline never widens faster than 45°. A bottom layer with
  edge clips, and a one-piece print, have their registration below their underside and need supports under it. The preview's
  assembly places each STL by its pose: a layer lifted by its underside's height, a peg moved to its hole.
- **Mesh.** A peg is its outline's rings turned about its axis (64 sides) and closed by a flat face at each end: a polyhedron,
  so that no point lies on the axis (rings of coincident points there would be empty triangles).
- **Quantities.** One of each STL. Pegs are separate files even when they are alike, so that the parts count, the preview and the
  ZIP agree piece for piece.
- **Assembly.** Fit the components; push the board pegs into the mounting holes; slide layer 1 down over them (onto their
  shoulders), drop in any dowels, and lay level 0's wires; then each layer above in turn, laying its wires. Solder the ends on
  the solder side. Each layer's wires hold it down.
- **When the layers can't be made.** A mounting hole that can't take a peg, a stack with no room for two pegs through its layers,
  or a layer above the bottom that would be loose pieces (between through pockets, estimated on a 0.2 mm grid,
  `wireGuideLayerBodies`) makes the design invalid for this model: `validateParameters` reports it on `design/guide/parts`, naming
  the print, what is in the way and the two ways out (change the design, or ask for one piece). The API rejects it (422), the
  worker never renders it, and the editor lists it with a button that sets “Printed as” to one piece. It never falls back to one
  piece on its own, and `validateWireGuideDesign` (the shared contract KiPrint ports) is unchanged: the design itself stays valid.

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
| `stripboard-boss-neighbours.json` | stripboard | wire ends on the four holes beside a mounting hole, under its boss's column; asks for one piece (`"parts": "single"`): as layers, that hole could take no peg |
| `pockets-on-channel-sides.json` | perfboard | box and round bodies exactly half a channel + 0.3 mm from their channels |
| `kiprint-perma-proto-timer.json` | Perma-Proto quarter | KiPrint's `plan_guide` output: 4 components, 8 wires on 2 levels (W7, W8 rerouted) |
| `kiprint-crossing-two-levels.json` | perfboard | KiPrint: 4 wires on 3 levels, crossing (C rerouted) |
| `kiprint-stripboard-regulator.json` | stripboard | KiPrint: a 19 mm tall TO-220, pocketed through |
| `perma-proto-half-three-levels.json` | Perma-Proto half | 16 wires on 3 levels: red level-0 wires crossed by a blue level-1 wire that a green level-2 wire crosses at the same holes, as in the owner's picture (#170). Representative, made for the tests: not a reconstruction of the owner's project. 3 layers and 2 board pegs |

- `invalid/` keeps KiPrint's original two designs, whose lower wires turn under a higher wire, as fixtures. A unit test pins
  their issues. The samples differ from them only in those wires' paths.
- `npm run test:renderer` (`TEST_ONLY=prototype-wire-guide`) renders each sample as separate layers and pegs, and two of them
  also as one piece per print. On the ZIP's actual meshes (`tools/wire-guide-checks.ts`), against the encoder's geometry:
  - the ZIP holds exactly the design's pieces, its assembly guide and the design;
  - each piece is one closed solid with no float32 repairs, lying on the print bed at its size;
  - each layer: its own channels open over a solid floor, the lower levels' channels covered, every funnel open through it (and
    down to the board in the bottom layer), pockets open, each peg's hole open at its radius with a wall beyond it, sockets
    closed above, clips;
  - each peg: its mesh is its outline, turned;
  - assembled at their poses: the layers stack without gaps, every shaft has play all round in each layer's hole, and no two
    pieces share volume (voxels of 0.1 mm);
  - a one-piece print, as before: open channels, tunnels and funnels, solid bridges, plate, pins and clips, open pockets.

  It writes what it measured (each piece's triangles, shells, volume and size, the ZIP's size and SHA-256) to
  `test-results/wire-guide/wire-guide-meshes.json`, and the three-level sample's ZIP beside it; CI uploads both with the
  integration diagnostics.
- The unit tests cover the samples, the numbers-only encoding, the bounds, and the API–worker parity of issues.

### Editor

The editor's document field (`apps/web/src/WireGuideField.tsx`) shows:

- a map and summary of the design: board, wire, wire count, levels, prints and each print's pieces (e.g. “G1: 3 layers + 2
  pegs”), and, when its layers can't be made, why, with a button to print each guide in one piece instead;
- the guide's settings, “Printed as” (`guide.parts`) among them;
- **Import design (.json)** and **Download design**.

An imported file is checked in the browser with the same function. Only a valid design replaces the current one; an invalid
one is listed with its issues. So the model works without the assistant.

The assistant opens a design with `canfactory_open_wire_guide_design` (`apps/web/src/assistant/controller.ts`). It checks the
design with `validateWireGuideDesign` first and returns the same `{ path, message }` issues as
`canfactory_validate_wire_guide_design`, opening nothing. A valid design replaces the editor's own, through the editor's
parameters as an import does, so the editor's render queue and its one-job rule apply. `canfactory_set_model_parameters`
rejects this model: a design is never set as a parameter.

### What the assistant's activity panel shows

Each CanFactory tool has an activity summary (`apps/web/src/assistant/activity.ts`, over the result schemas in `results.ts`), so a
completed call reads as what it found instead of tinytinkerer's neutral “Unknown”. The summaries keep three facts apart:

- **Execution.** A tool that threw is the panel's own “failed” entry; a summary only describes a result that came back. A
  result that doesn't match the tool's output schema, or is absent, stays “Unknown” with whatever came back.
- **The domain.** No matching parts and a `connected: false` pair are successful reads (OK, with their counts). A design that is
  `valid: false`, and a parameter change or design the editor rejected (`ok: false`), are errors that name their first issue and
  list every one. A query pair that names an undrilled hole is a warning: the read worked, that pair has no answer.
- **Rendering.** Opening a design or changing parameters only requests a render: its summary says “render requested, not ready
  yet”. `canfactory_get_editor_state` reports the render status it read (queued, rendering, pending, invalid, failed or ready),
  “when read”. A summary describes its own result and never changes later, so an old “queued” stays queued; read the state again.

The collapsed line is one sentence. Expanding it shows the details and the raw result (the panel bounds its length), so a board's
layout is not dumped by default.

A new tool (such as the reference-based validate and open tools #170 adds) gets the same: an output schema in `results.ts`, a
`describe…` function in `activity.ts`, and `summarize(label, schema, describe…)` on the tool (or as the stage method's
`summarizeActivity`). Keep the rules: a rejection is an error with its issues, a requested render is not ready.
