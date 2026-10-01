# Adding a model

1. Create `models/<model-id>/` containing original reference assets, attribution,
   and a self-contained editable SCAD generator. Preserve the original source
   and STL unchanged. The generator must produce one connected closed solid,
   with units interpreted as millimetres.
2. Define a TypeBox parameter object with `additionalProperties: false`. Document
   each property’s title, meaning, units, default, and numeric bounds/steps. The
   current generic editor supports numeric fields, boolean switches, enums and short text (a `Type.Enum` string parameter with an
   `enumControl` listing each value's label and description, or a `Type.String` with `maxLength` and a `textControl`; the value reaches SCAD as a quoted string, see
   [cigarette-case-snap.md](cigarette-case-snap.md)). A number control can also carry `bands` (named sub-ranges; the editor
   names the one the value is in) and `recommended` (a list of enum controls, each with a sub-range per value; the editor
   highlights the range that suits all their current values on the slider, and names the controls whose range the value is
   outside of; the slider also marks the control's default); both are advice only. `visibleWhen` shows a control only while
   another enum control has one of the listed values (e.g. a detent's engagement only in `detent` mode); its value still
   applies, so the SCAD file must only use it in those modes. See the cigarette case's `clearance`.
3. Add a `ModelDefinition` with stable ID, explicit version, display metadata,
   reference/source paths, control grouping, defaults, SCAD variable mapping,
   dependent validation, and derived metadata. Variable names must use uppercase
   letters/underscores. Validate all finite ranges and bound geometry complexity.
4. Register the definition in `models` and its typed request branch in
   `RenderRequestSchema`. Keep request schemas in an explicit TypeBox tuple so
   static inference retains the discriminated union. The React editor, API
   routes, and worker need no model-specific changes.
5. Add contract and real-render cases, including extremes and invalid
   combinations. Verify closed edges, winding, connectedness, positive volume,
   expected dimensions, and a preview matching the downloaded STL.
6. Run `npm run contracts:generate`, `npm run check`, `npm run test:renderer`, and
   browser tests. Rebuild Compose to include the model in the catalogue.

If the only source is an STL, reconstruct the SCAD with the `stl-to-scad` skill (`.claude/skills/stl-to-scad/`,
tooling in `tools/stl-to-scad/`, `npm run stl-scad -- --help`): inspect and dedupe the mesh, rebuild it from primitives,
and prove the result with `verify` (bounding box, volume, IoU and one closed manifold body). Commit the SCAD next to the
original in `reference/` together with a manifest and the generated `VERIFICATION.md`; `models/moss-planter/reference/`
is the worked example.

### Multi-part assemblies

A model that is really a set of independent parts (e.g. moss-planter's five: ground spike, planting helper, cover cap,
and two lattice segments) uses `ModelDefinition.parts: { id, title, sourcePath, scadMapping? }[]` instead of
`sourcePath`. This changes the shape end to end, generically (no per-model code elsewhere): the worker
(`apps/worker/src/render.ts`) renders each part with its own OpenSCAD invocation, validates each with the same
`inspectStl`, and packages them as one ZIP (`packages/server/src/mesh.ts`'s `combineParts`); the artifact is served from
`/api/v1/renders/{id}/zip` instead of `/stl` (`artifactFormat()` in `packages/contracts` decides which); and the web
viewer loads every part and arranges them on an auto-sized grid instead of one centred mesh (see the assembly slider below). Each part must
independently be one closed, connected solid — `inspectStl` rejects multi-body meshes, so parts are never merged into
a single STL before validation. `referencePath` is optional: omit it (as moss-planter does) when there is no small,
permanent original file to preserve — do not point it at a large STL that will not stay in the repository, since
`Store.seed()` reads it at every startup.

**Parameters are model-wide, mappings are per part.** The model has one `parameterSchema`/`controls`/`defaults` (and an
empty model-level `scadMapping`); each part's own `scadMapping` names the parameter keys it consumes and the SCAD
variable each becomes, and the worker passes only those as `-D`. One key may feed several parts (moss-planter's
`towerDiameter` feeds all five, which is what makes their threads mate), and several parts may share a source file with
different mappings (both lattice segments are `raute.scad`, with `ROWS` fed by `shortRauteRows` or `tallRauteRows`). A part that only exists for some settings (the cigarette case's `case-text`) sets `ModelPart.includedWhen`; the worker renders
`activeParts(model, parameters)`, and `separateBodies` relaxes the one-connected-body check for a part that is several closed
bodies by design (see [cigarette-case-text.md](cigarette-case-text.md)). A
model with no adjustable parameters simply leaves every mapping empty (empty `parameterSchema`, no controls); the catalogue then reports `customizable: false` and the web app shows it as an assembly preview. The cigarette case is registered this way: its five parts point at the verified static reconstructions in `models/cigarette-case/reference/`, and a later iteration replaces them with parametric generators (add the parameters, bump the version). Part
mappings are part of the cache fingerprint, as are all part sources. Because a part receives no other `-D`, its own
constants (`ROUNDNESS` etc.) apply exactly as written.

A shared generator can select a physical piece with `ModelPart.scadConstants`
(e.g. the AI duck's `{ PART: 'face' }`). These are trusted number, boolean or
string literals, not editable parameters. `scadDefines` validates their
uppercase names and rejects collisions with mapped variables. Constants are
included in the cache fingerprint, and both the worker and assembly checker
pass them to OpenSCAD.

**Values that are not plain literals.** The worker writes each mapped value after `-D NAME=` with `scadLiteral`: JSON for
numbers, booleans and strings (which OpenSCAD reads as they are), unless the model's `scadEncode` has a function for that key.
The cigarette case's `logo` uses one: the parameter is a validated logo string, and `logoScad` writes it as a vector of numbers.
Its control is of kind `svg`: the editor reads an SVG file the user picks into that string, in the browser
(`packages/contracts/src/svgLogo.ts`, see [cigarette-case-text.md](cigarette-case-text.md)), so a file never reaches the server.

**Assembly slider (optional).** An assembly may also set `ModelDefinition.assembly` (`AssemblySchema` in
`packages/contracts/src/models.ts`): the assembled `poses` of its parts (position in mm and optional rotation in degrees,
in the parts' own SCAD frame, Z up), the ordered `steps` that put them together (each lists the parts that move together
and the offset `from` which they start), and a `lift` for the exploded layout. The catalogue serves it, and the live
preview then shows a slider below the viewer: the parts rise from the print-bed grid into the exploded layout, then each
step plays in turn until the finished assembly stands on the floor (`assemblyState`/`assemblyOffset` in
`packages/contracts/src/assembly.ts` do the maths, for the web app and for the check). Give every part a pose, including
optional ones such as the cigarette case's `case-text`. Derive the poses from the geometry, never by eye, and prove them
with `npm run check:assembly -- <model-id>`. It renders the parts and measures the volume shared by colliding parts: in
the assembled state, in the exploded layout and along each step's path (see [cigarette-case-assembly.md](cigarette-case-assembly.md)).
Under the slider, a parts list names every part and reference object (their `title`s). All of them are shown by default, and each
button hides or shows its part, at any point of the slider, so that the parts inside can be seen. Nothing needs to be added to the
model for this. Models without `assembly` keep the plain grid.

For dimensions or optional pieces that change the layout,
`assemblyForParameters(parameters)` returns the matching poses and steps;
keep `assembly` as the default catalogue layout. `resolveAssembly` applies
this function before adding linked reference objects. Poses need only name
the active pieces for these parameters. Optional `assembly.partColors` maps
part ids to suggested `#RRGGBB` filament colors. The viewer uses these colors
for the meshes and part-list swatches; they are not encoded in STL. The editor
keeps assembly metadata with the completed render while newer settings are
being rendered or downloaded. See [AI rubber ducks](ai-rubber-duck.md).

**Reference objects (optional).** `assembly.references` lists real-world objects the assembly holds, such as the lighter that
the cigarette case's round bay is sized for. They get poses and steps like parts, so the preview shows how they fit, but they are
never printed: they are not in `parts`, the worker does not render them and they are not in the ZIP. Each is a parts-library
entry with an STL preview, added with `referencePart(poseId, partId)` (see [adding-parts.md](adding-parts.md)): its SCAD file
under `parts/` has the real dimensions as named values, and the STL beside it is that file rendered with
`openscad --backend Manifold --export-format binstl`, which the web app bundles (`apps/web/src/referenceObjects.ts`). Render the
STL again after changing the SCAD file: `npm run check:assembly` renders the SCAD file, fails if the committed STL's bounds
differ, and includes the object in its collision checks.

**Real-world parts.** When a setting chooses a real part (a screw size, a magnet), link the control to the parts library: set
`part: { family, attribute }` on it. With `attribute: null` each option value is a part id; otherwise each value is a value of
that attribute (the plank connector's `screwHoles` = `M3` stands for every M3 screw). The editor then links the chosen option to
the library, and the library lists the model under the part's “Used by”. Take the sizes a model needs (e.g. `ISO_273_CLEARANCE_HOLES`)
from the library rather than copying them. For a setting whose values are part ids (e.g. the cigarette case's `magnet`):

- **The control:** `partControl(schema, key, group, family, partIds)` names and describes each option from the library. Offer only the
  parts the geometry can take, and prove it with a test (the case's `magnetFits`, the litter shovel's `handleScrewFits`).
- **Parts that must match another setting:** `part.filter = { control, attribute }` offers only the parts whose attribute equals
  that (enum) control's value. The litter shovel's inserts, nuts and screws are filtered by `handleThread`. The editor lists only
  those and, when the other control changes, moves the choice to the first part it now offers that the model accepts. While the
  control is shown, `validateParameters` rejects any other part (`offeredOptions`, `partOptionOffered`).
- **The geometry:** `partDefines` on the part (or the model) passes the chosen part's dimensions to the SCAD file:
  `{ magnet: { MAGNET_D: ['diameter', 'max'], MAGNET_T: ['thickness', 'max'] } }` gives `-D MAGNET_D=6.1` for a 6 ± 0.1 mm magnet.
  Size a pocket from the `max`. Not every part of a family has every dimension. A list takes the first one the part has
  (`NUT_H: [['h', 'm'], 'max']`: a nylon-insert nut's overall height, else the nut's height). `{ attribute: 'shape' }` passes an
  attribute as a string. The worker and `npm run check:assembly` both use `scadDefines`, and the library data behind every
  selectable part is part of the cache fingerprint (`linkedPartData`).
- **The preview:** `linkedReferences(parameters)` returns reference objects that depend on the settings: the part, its pose, the part
  it is mounted in (`movesWith`), or a `step` of its own after the assembly's steps (the litter shovel's screws, driven in once
  the parts are together). `resolveAssembly` adds them to the assembly for the editor and the collision check. Parts without an
  STL are built from their dimensions in the preview. The check renders magnets, screws, nuts and threaded inserts from the generic
  models in `parts/` (`GENERIC_MODELS` in `tools/check-assembly.ts`). A screw's thread is drawn at its minor diameter and a nut's
  or insert's bore at the thread's diameter, so a screw in its nut does not count as a collision. An insert is drawn as the hole
  it is melted into.

Generators for continuous parameters need extra care. Choose which dimensions scale with each parameter and record it in
the SCAD header (moss-planter: tube radius, thread and end rings scale with the tower diameter; strut width and row
pitch do not). Every reachable parameter combination must yield one closed solid, and `inspectStl` rejects zero-area
triangles: avoid coincident faces between separately built features (pull a clip surface 0.05 mm off the surface it
would otherwise share, end a thread 0.01 mm short of a flush face, scale a profile point by point instead of with
`scale()` when it must stay coincident with another). Sweep the parameter ranges with a real renderer; the
`tools/test-renderer.ts` cases and the contract's dependent-validation rules (e.g. minimum spike length, lattice
complexity limit) are where a failing region is excluded.

`npm run test:sweep` (`tools/sweep-geometry.ts`) renders every model at each parameter's minimum, one step above it
and its maximum, every option, and seeded random settings (`SWEEP_SAMPLES`, `SWEEP_SEED`, `TEST_ONLY`), and prints
the settings that differ from the defaults for anything that fails. Pull requests run a small fixed-seed sample of it;
the nightly Geometry sweep workflow runs it wide with a new seed each night. It fails not only on failed renders but
also on float32 sliver repairs: the worker repairs those so that users still get their model, but each one marks
geometry that is valid only by a micrometre, and the next setting over may not be.

Bump the model version when parameter meanings or defaults change. Browser
preferences are isolated by version and stale API requests receive a conflict.
Source/schema/mapping changes also alter the cache fingerprint. The current
fingerprint assumes a self-contained generator: if adding includes, libraries,
or imported geometry, extend fingerprinting to cover every dependency first.

Do not accept arbitrary uploaded SCAD or construct shell commands from parameter
values. Provided models are trusted repository code; users supply only values
validated against the registered schema.
