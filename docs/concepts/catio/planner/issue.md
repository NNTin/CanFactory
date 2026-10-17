# Interactive catio planner: garden layout, configurable interiors, tunnel networks, and a complete build pack

## Outcome

A cat owner can lay out a catio in their garden, configure its interior directly in the browser, connect windows and multiple enclosures with tunnels, then obtain the materials, cuts, tools, and instructions needed to build that exact design.

This is a feature specification, not a claim that arbitrary assemblies have been structurally validated. The planner must distinguish editable designs, complete construction recipes, and physical verification.

**Agreed decisions**
- Full desktop editor; phones/tablets support inspecting projects and reading/exporting build packs.
- Germany, metric dimensions, EUR where an existing supported price source supplies prices.
- Multiple enclosures and branched tunnel networks.
- Standard-module and custom-cut tunnel modes, with direct mouse editing in both.
- Full starter interior catalog.
- Named local projects and JSON import/export; no accounts or hosted project storage.
- A complete store-bought hardware path; 3D-printed fittings are optional alternatives.
- New project: flat 5 × 5 m lawn, empty 2 × 2 × 2 m enclosure, and a wall/window connected by a short tunnel.

## Design gallery

These are proposed UI designs, not screenshots of implemented functionality. The written requirements and numerical model take precedence over generated geometry, small labels, and schematic hardware.

| View | Design |
| --- | --- |
| Starting garden and enclosure manipulation | [![Starting garden](01-starting-garden.png)](01-starting-garden.png) |
| Interior placement, endpoints, and dimensions | [![Interior editor](02-interior-editor.png)](02-interior-editor.png) |
| Tunnel extension, elevation, and branching; the free end is shown mid-edit | [![Tunnel editing](03-tunnel-editing.png)](03-tunnel-editing.png) |
| Isolated component and assembly detail | [![Component detail](04-component-detail.png)](04-component-detail.png) |
| Shopping, cutting, and assembly pack | [![Build pack](05-build-pack.png)](05-build-pack.png) |

Visual reference: [IKEA planning tools](https://www.ikea.com/de/de/planners/) and [IKEA Kreativ capabilities](https://support.home-design.ikea.com/hc/en-us/articles/360038999793-What-can-I-design-in-my-space). Adopt the catalog → spatial arrangement → inspect → purchasing workflow, with CanFactory's own interface and construction-specific tools.

## Current implementation and reuse

The existing app provides React/Three.js catio scenes, orthographic/camera presets, visibility, exploded assembly, saved dimensions, window inserts, tunnel pieces, standard ports, coupling hardware, a parts library, BOM aggregation, offers, and a buy list.

The modular concept has limited placement presets; the tunnel page solves a single route from form settings. Neither is a direct-manipulation garden/interior editor. Branching is explicitly excluded from the existing standard-port document, so it requires a network model and junction construction recipes.

Relevant integration points:
- `apps/web/src/route.ts`, `CatioConcept.tsx`, `catioSettings.ts`, and `catioSubassemblies.ts`.
- `catioModularDesign.ts`, `catioTunnel.ts`, `catioTunnelPieces.ts`, `catioPort.ts`, and the existing insert/coupling builders.
- Shared `BomLine`, `Requirement[]`, part IDs, geometry, and offer matching in the workspace packages.
- [Stock materials and cutting plans #58](https://github.com/NNTin/CanFactory/issues/58): coordinate its implementation rather than creating a second stock catalog.
- [Implemented offer/buy-list scope #54](https://github.com/NNTin/CanFactory/issues/54), [BOM unification #96](https://github.com/NNTin/CanFactory/issues/96), and [standard tunnel ports #86](https://github.com/NNTin/CanFactory/issues/86).

## Functional requirements

### FR-01 — Starting project and garden

1. Add `#/concepts/catio/planner`, linked from the catio overview and enclosure entry point.
2. Start with a 5000 × 5000 mm rectangular lawn and one enclosure whose outside dimensions are 2000 W × 2000 D × 2000 H mm. Show usable inside dimensions separately.
3. The enclosure interior starts empty apart from construction-required entrance landing/access. Include a wall and one window insert using the existing defaults, connected by two standard tunnel modules. Compute the enclosure position from actual module, fitting, and port geometry.
4. Centre the window on the rear garden boundary; place the enclosure in front of it, with its maintenance door facing the garden. Keep the initial assembly inside the garden.
5. Garden width/depth and enclosure width/depth/height are editable. Use millimetres internally, metres for site dimensions, and centimetres or millimetres for component dimensions; every field states its unit.
6. Add, move, rotate, duplicate, and remove enclosures, walls/windows, and tunnels. Walls/windows are site context; existing building material is not charged to the build pack.
7. Flat rectangular gardens and rectangular enclosures are the initial scope. Garden resizing flags objects outside the boundary instead of silently scaling or deleting them.

### FR-02 — Visible, direct editing

1. Layout: left component catalog and object tree, central viewport, right selection inspector, visible project/undo/redo/build-pack actions.
2. Click to select; drag the selected object's body to move on the active plane. Dedicated handles resize, rotate, elevate, or adjust endpoints. Selecting and dragging a handle must not orbit the camera.
3. Empty-space drag orbits in 3D and pans in orthographic views; middle-button drag pans and the wheel zooms. Provide visible camera controls for users without a middle button.
4. Visible Move / Rotate / Resize controls accompany the selection; show current dimensions and changes while dragging. Inspector fields offer exact entry for the same operations.
5. General grid snap defaults to 10 mm, yaw rotation to 15°. A visible toggle enables/disables snapping. Standard tunnel length snapping follows the actual module pitch, not the garden grid.
6. Page Up / Page Down raises/lowers the selection by 10 mm; Shift changes the step to 100 mm. Equivalent up/down buttons and tooltips are required. Shortcuts do not fire while typing into a field.
7. Escape cancels an in-progress edit. Undo/redo covers add/delete/duplicate, transforms, dimensions, material changes, and connections; one complete drag is one undo step.
8. Duplicate creates new stable instance IDs. Deleting a parent explains dependent components/connections and offers cancellation or deletion of the affected assembly; a dangling reference is never silently retained.
9. Moving/rotating an enclosure carries its interior. Resizing preserves component sizes and enclosure-local positions; show fit errors for displaced/out-of-bounds items.
10. Existing supported mesh, door, port closure, and hardware choices remain available through the selection inspector; editing must not require navigating to hidden settings on another page.

### FR-03 — Inspect the whole design or individual parts

1. Orbit/pan/zoom; top/front/side/3D views; fit all and fit selection.
2. Hide/show roof, mesh, walls, fittings, site context, and individual instances without changing physical design or BOM quantities.
3. Isolate a selected assembly or component. Restore the previous visibility state on leaving isolation.
4. Show exploded components, mounting details, dimensioned projections, and assembly steps.
5. Clicking an object-tree or BOM entry selects/highlights the corresponding scene instances; clicking a component identifies its materials and construction recipe.
6. Open/closed doors and port closures are inspectable. Door sweep and maintenance access are part of placement validation.

### FR-04 — Draw and edit tunnel networks

1. Start a tunnel by selecting a catalog item or dragging from a highlighted compatible port. Expose an add/extend affordance at free ends and branch-capable side ports.
2. Drag an endpoint to lengthen/shorten; drag the elevation handle to change the whole selected run's elevation, or select an endpoint to change that endpoint's elevation and slope. Numeric fields mirror both operations.
3. **Standard modules (default):** lengthening adds/removes whole pitches; preview exact assembled length and snapped endpoint. Derive pitch from the selected port and coupling, including gaps.
4. **Custom cuts:** allow arbitrary lengths within the chosen construction recipe's limits. Generate bespoke rails, flooring, mesh, and joints. Keep standard connection interfaces at the ends.
5. Mode changes are explicit and undoable. Switching custom → standard previews snapped dimensions before applying and must not silently move an anchored enclosure.
6. Add bends and slope transitions directly in the scene. Keep floors correctly oriented; use existing supported joint families. Unsupported combinations, including unimplemented compound bends, are identified as invalid drafts.
7. Support T-junctions and connected networks leading to multiple enclosures. Branch junctions need actual geometry, supports, accessible couplings, and material/assembly recipes, not only intersecting tubes.
8. Snap connections only when opening dimensions, orientation, and fittings are compatible. One port has at most one physical mate; branches use distinct junction ports.
9. Automatically include required supports/feet, couplings, seals, fasteners, and closures for unused ports. Recompute them when routes change.
10. Moving a connected object preserves the connection graph and previews adjusted incident runs; other anchored objects stay fixed. If the run cannot be rebuilt, retain the edit as a visibly invalid draft, preserve the intended connection, and offer adjust/revert/explicit detach.
11. Distinguish disconnected in-progress endpoints from installed closed ports. Never represent an unclosed opening as a finished enclosure.
12. Validate network loops without infinite traversal and count shared junctions/supports once. Explicit branch support is required; a second independent route is not a substitute.

### FR-05 — Starter interior catalog

All items support placement, orientation, duplication, deletion, dimension controls, material choice within their recipe, isolation, and build/buy details.

| Type | Configuration | Construction information |
| --- | --- | --- |
| Scratching post | Start/end in enclosure-local XYZ; square/round wooden core; section/diameter; attachment choice; rope diameter; start/end of wrapped region | Core cut, base or end mounts, natural sisal length/rolls, concealed rope termination, fittings |
| Platform / floor | Width, depth, thickness, elevation, yaw; optional rectangular access opening | Sheet cuts, supports/brackets or legs, fasteners, cut-edge finishing |
| Ramp | Start/end, width, board thickness, cleat layout | Board and cleat cuts, endpoint brackets and screws |
| Steps | Start/end, width, number/spacing of treads | Treads, stringers/supports and fixings; show resulting rise/run |
| Bridge | End anchors, span, width, board spacing | Boards/slats, ropes or supported members, attachment fittings |
| Hammock | Support anchors, fabric size, hanging depth | Fabric, reinforced edge/attachment details, hanging hardware, support requirements |
| Shelter | Width/depth/height, entrance dimensions and face, roof | Panels, supports, fasteners, optional removable liner |
| Hanging toy | Anchor, hanging length, ball size for DIY or product variant | Ball/core, rope, attachment hardware and replacement/removal instructions |

1. A post's endpoints and its rope-covered interval are distinct settings. Post length is derived from the endpoints.
2. Use explicit attachment records to suitable structural members; mesh is not a mounting support. A platform can use a frame-mounted or independently supported recipe.
3. Anchor-dependent items move with their supports. An incompatible resize/deletion identifies the affected attachments.
4. Allow draft unsupported placement for design exploration, but show missing attachments and withhold a complete-build status.
5. DIY parts resize parametrically. Purchased products retain their published dimensions; offer variant selection instead of visually stretching a fixed product.
6. Wood-core scratching posts are the initial supported recipes. Plastic-core alternatives require a separately verified outdoor material/end-mount recipe before being added.
7. Show full-span floor access openings and ramp/step routes in collision and access checks.

### FR-06 — Design checks and feedback

1. Distinguish invalid numerical input, editable geometric/connection problems, missing construction recipes, and unverified physical properties.
2. Nonfinite/impossible numbers do not corrupt the document; retain the last valid numeric value with an inline error. Geometrically invalid drafts remain editable and saveable.
3. Check garden/enclosure bounds, component collisions except intended joints, door sweeps, window sash clearance, port continuity, attachment validity, unsupported spans against published recipe limits, and selected tunnel slope limits.
4. Show problems on the affected object and in a selectable issue list. Avoid unexplained red objects or hidden error messages.
5. Project JSON export is always available. Build-pack export remains available as a clearly marked draft with an unresolved-items section when checks fail. Do not silently omit missing materials from a supposedly complete list.
6. A complete recipe specifies supported dimensions, material sections, mounting details, and evidence for any stated capacity. Geometric checks are not structural certification.
7. Scope excludes automatic structural simulation, terrain sculpting, arbitrary CAD solids, and promises that any user-drawn assembly is buildable.

### FR-07 — Materials, purchasing, cuts, and assembly

1. Evaluate a complete BOM for all new enclosure, tunnel, insert, interior, support, fixing, closure, seal, and finishing components in the project.
2. Use stable library part/material IDs and structured cuts; do not infer cutting dimensions by parsing human-readable BOM text.
3. Each line identifies source instances, material/part, quantity/unit, dimensions, intended use, and either a verified product candidate or a specific generic hardware-store purchase specification.
4. Distinguish required consumption from purchased stock/packs and leftover material. Count shared physical items once; hiding/isolation never affects the BOM.
5. Linear stock uses a reproducible packing strategy such as first-fit decreasing with editable saw kerf (default 3 mm). Sheets use a feasible rectangular cutting layout with rotation/grain constraints; rolls use real width/length and overlap allowances. Total area alone cannot prove fit.
6. Deduct openings from appropriate cuts without treating the offcut as reusable unless the cutting layout actually makes it available. Mark required ripping/planing operations and stock substitutions.
7. Rope calculations use the core's wrapped perimeter, coverage length, rope diameter, end allowance, and visible waste allowance (default 10% for rope). Round to sold coils/lengths. Identify estimates and their assumptions.
8. Every supported recipe includes complete fixings, consumables, tools, and assembly steps. A screw or ring-nut product by itself is not a mounting recipe.
9. Store-bought fittings provide the default complete path. Printed alternatives show model links, print/material requirements and added fasteners, and replace rather than duplicate the corresponding bought fitting.
10. Consolidate shopping by shop and material, with component breakdowns retained. Use existing offer matching and disclosure; no checkout or new price-scraping service.
11. Keep generic specifications when a product is unavailable. No silent substitution of thickness, section, opening, fastener, or load-related attributes.
12. Product records include source URL, maker/retailer, SKU where available, dimensions, pack size, date checked, and relevant suitability limits. Mark uncertain attributes explicitly.
13. Retain existing Amazon/Awin display behavior: no scraped/static Amazon prices or availability; existing eligible live offer data only. An incomplete priced subset must not be labeled the total project cost.
14. Export printable HTML (browser PDF), CSV shopping/cut lists, and project JSON. The build pack includes project revision/date, dimensioned layout/elevations, component IDs, stock cuts, shopping links/specifications, tools, assembly order, and unresolved checks.
15. Refresh exports from the current project revision; never reuse a stale pack after an edit.

### FR-08 — Saving, portability, resilience

1. Named projects autosave locally after committed edits. Support new, rename, duplicate, delete with confirmation, import, and export.
2. Use a versioned JSON document with millimetre units, stable IDs, explicit connections/attachments, material choices, and view settings.
3. Validate imported versions, types, finite dimensions, unique IDs, and references before changing local storage. Preserve the current project on invalid/unsupported import.
4. Handle unavailable/full browser storage with a visible unsaved warning and working file export.
5. Offer explicit one-time import of the existing saved catio into a new planner project. Preserve legacy saved settings and routes; do not silently maintain two competing project sources.
6. Editing and construction calculations work without the backend. Offer failures leave material specifications, project saving, and build exports usable.
7. On mobile/tablet provide project-file import, inspection, component lists, and build-pack access. Full touch editing is deferred.
8. If WebGL is unavailable, explain that 3D is unavailable and retain project management, dimensions/material lists, and non-WebGL exports.

## Data and implementation boundaries

Add a planner project domain model containing:
- Project ID, schema version, name, units, revision, garden dimensions.
- Component instances with stable IDs, kind/recipe, parameters, transform, parent enclosure or site context, and material choices.
- Ports with owning instance, local frame, opening/interface and occupied/closed state.
- Connections referencing two ports; branch topology is represented by junctions with multiple ports.
- Attachments referencing structural supports and local anchor positions.
- Viewing state stored separately from physical requirements.

The evaluated assembly is the shared source for geometry, validation, material demand, cuts, and assembly steps. Keep scene objects transient; do not serialize Three.js objects. Refactor existing geometry/BOM helpers to accept project inputs rather than reading unrelated global saved settings. Share builders instead of introducing independent formulas for the preview and BOM.

Use shared contracts for structured material demands/cuts and existing `Requirement[]` offer inputs. Extend #58's stock path where needed. No new project-storage server API, authentication, or database migration is required for this scope.

For interaction, separate a transient drag preview from committed document commands and undo history. Recompute only affected geometry during movement; update stock packing after a committed edit. Each instance has selectable meshes and a stable mapping to its document ID.

## Initial product/source research

Sources reviewed 2026-10-17. Listings are examples with published dimensions, not guaranteed stock, universal substitutions, or completed engineering validation. See [the research and recipe matrix](products.md) for gaps and generic purchase specifications.

| Item | Source | How it contributes |
| --- | --- | --- |
| Natural sisal, 8 mm × 30 m | [Mamutec / HORNBACH 8442170](https://www.hornbach.de/p/seil-sisal-mamutec-gedreht-natur-o-8-mm-30-m/8442170/) | Wrapped posts; quantity derived from each core and coverage |
| Douglas-fir post, 90 × 90 × 1800 mm | [HORNBACH 10496632](https://www.hornbach.de/p/pfosten-9x9x180cm-douglasie/10496632/) | Example square post stock; not a 2 m member |
| Exterior sheet, 2500 × 1250 × 18 mm | [Garnica / BAUHAUS 28517690](https://www.bauhaus.info/siebdruckplatten/garnica-siebdruckplatte-laudio-wire-xtra-plus/p/28517690) | Platform, floor and ramp stock; actual span/mounting needs a recipe |
| Sisal ball, 60 mm, TRIXIE 4075 | [TRIXIE shop](https://trixie.shop/products/sisalball) | Purchased ball option; hanging attachment is a separate recipe |
| Two sisal balls on rope, 45 mm, TRIXIE 4077 | [Manufacturer](https://www.trixie.de/de/produktwelt/katze/katzenspielzeug/spielmaeuse-tiere-baelle/2-baelle-am-seil-1001435841-1001446903) | Existing toy reference; no assumption of permanent outdoor suitability |
| M6 stainless ring nut | [HORNBACH 7574396](https://www.hornbach.de/p/ringmutter-din582-m6-edelstahl/7574396/) | Closed eye fitting candidate; requires matching bolt, washers and structural mounting detail |
| A2 DIN 571 wood screw, 5 × 60 mm, 50 pack | [HORNBACH 6834009](https://www.hornbach.de/p/schaefer-peters-holzschraube-6-kant-din-571-5x60-mm-edelstahl-a2-50-stueck/6834009/) | Real pack-size example; select screw dimensions per connection |
| Welded mesh, 19 × 19 mm, 1.45 mm wire | [KrapTrap / Drahtexpress](https://drahtexpress.de/products/kraptrap-volierendraht-drahtgitter-19-mm-masche-100-cm-breit-1-45mm-starke) | Existing library mesh in 5/12/20 m rolls; cutting layout determines count |

Do not reuse indoor-only materials as outdoor defaults merely because their dimensions fit. The [HORNBACH DN110 PP pipe](https://www.hornbach.de/p/ht-rohr-dn-110-1000-mm/266933/) is described for indoor drainage; it does not establish an outdoor load-bearing scratching-post recipe. The [TRIXIE wall hammock](https://trixie.shop/products/hangematte-zur-wandmontage) is an inspiration/product-size reference, not evidence of outdoor suitability.

## User stories and acceptance criteria

### US-01 — Start and arrange the site
As a cat owner, I can size my garden and place an enclosure so the planned build fits the real space.
- [ ] Fresh local state opens the specified 5 m garden / 2 m enclosure / connected window scene.
- [ ] Garden and enclosure dimensions can be edited with visible controls.
- [ ] Mouse move/rotate/resize updates dimension overlays and usable interior dimensions.
- [ ] Shrinking the garden or enclosure flags affected objects without deleting them.
- [ ] Verify in the browser, including keyboard alternatives and cancellation/undo.

### US-02 — Furnish the enclosure
As a cat owner, I can arrange climbing, scratching, resting and play components with exact dimensions.
- [ ] Every catalog type in FR-05 can be added, selected, changed, duplicated and deleted.
- [ ] Post endpoints and wrapped region are independently editable.
- [ ] Floor elevation, size, support choice and access opening update geometry and material demand.
- [ ] Attached components follow their supporting enclosure/member.
- [ ] Fixed purchased products cannot be stretched into nonexistent variants.
- [ ] Verify in the browser with a mixed furnished example and component isolation.

### US-03 — Draw and modify tunnels
As a cat owner, I can construct and adjust tunnel runs using the mouse rather than hidden forms.
- [ ] Drag from a port, lengthen a run, raise/lower a segment, and change one endpoint's height.
- [ ] Standard and custom modes show their actual lengths and different cutting consequences.
- [ ] Page Up/Down and visible height buttons perform equivalent operations.
- [ ] Joints, supports, clearances and quantities follow edits.
- [ ] Undo/cancel restores the prior network, not only the visible meshes.
- [ ] Verify the complete gesture sequence in the browser.

### US-04 — Connect multiple enclosures
As a cat owner, I can branch one window connection to multiple enclosures.
- [ ] A T-junction is a real supported assembly with distinct ports and its own recipe.
- [ ] Moving a connected enclosure preserves intended connectivity and previews adjusted runs.
- [ ] Invalid geometry is editable and clearly identified; detachment is explicit.
- [ ] Shared fittings are counted once; unused ports have closures.
- [ ] Loop traversal terminates and topology survives save/export/import.
- [ ] Verify in the browser with two enclosures and one branch.

### US-05 — Inspect and resolve issues
As a builder, I can understand how each part fits and locate problems before construction.
- [ ] Top/front/side and isolated/exploded views expose selected components and their dimensions.
- [ ] Roof/mesh visibility changes do not alter BOM quantities.
- [ ] Object-tree, scene, validation and BOM selections stay linked.
- [ ] Invalid connections, missing supports, collisions and access problems link to their objects.
- [ ] Verify in the browser, including view reset and door/window clearance cases.

### US-06 — Obtain a complete build pack
As a builder, I can buy stock and hardware and follow instructions for the current design.
- [ ] Every supported recipe accounts for materials, all fittings, consumables and tools.
- [ ] Store-only settings generate a complete pack without any mandatory printed part.
- [ ] Increasing a post's wrap or a platform's dimensions changes consumption and stock/pack counts.
- [ ] Cutting layouts fit actual stock, respect kerf and report impossible cuts.
- [ ] Combined shopping counts match the component breakdown without shared-item duplication.
- [ ] CSV and printable outputs reflect the latest project revision and include source/specification links.
- [ ] Draft packs list unresolved requirements prominently.
- [ ] Verify print layout and downloads in the browser.

### US-07 — Save and take the project elsewhere
As a user, I can resume a project or transfer it using a file.
- [ ] Named local projects autosave committed changes and reload with the same topology/materials.
- [ ] JSON round-trip preserves IDs, dimensions, connections, attachments and view settings.
- [ ] Invalid/unsupported import and storage failures preserve current work and offer export.
- [ ] Legacy catio settings remain intact after explicit import to a new project.
- [ ] Verify in the browser across reload, multiple projects and file import/export.

### US-08 — Work despite service/device limitations
As a user, I can access my design and build information when shopping services or 3D are unavailable.
- [ ] Backend/offer errors do not block desktop editing or material calculations.
- [ ] No-WebGL mode retains project management, material lists and non-WebGL export.
- [ ] Phone/tablet layouts support inspecting an imported project and reading the build pack.
- [ ] Verify those states in the browser and retain keyboard focus visibility.

## Verification and delivery workstreams

1. Project model, versioned persistence, routing and explicit legacy import.
2. Garden/enclosure direct manipulation, selection, views and undo/redo.
3. Tunnel graph, branch recipes and direct extension/elevation in both length modes.
4. Parametric interior catalog with explicit attachments and construction recipes.
5. Structured stock/cut demands and complete buy/build exports, coordinated with #58.
6. Browser validation, performance checks, fallback states and regression coverage.

For each workstream: typecheck/lint and relevant unit/browser checks pass. Use the repository's Playwright workflow for visual verification; no unavailable browser skill is required.

Required automated coverage:
- Geometry and attachment transforms, port compatibility, slopes/joints, branch and loop traversal, door/window clearances.
- Material demand versus actual instances, pack rounding, rope estimation, 1D kerf and 2D sheet/roll feasibility.
- Undo transactions, JSON round trips, invalid/dangling imports, storage and network failures.
- Browser drag/resize/rotate/elevate flows, selection/isolation, project persistence and exports.
- Regressions for the existing catio, tunnel/insert/coupling pages, parts and offers/buy-list behavior.

Performance acceptance: document the desktop browser/hardware used; exercise a representative 100 editable-instance design (including multiple enclosures, tunnel sections and furnishings) and keep interaction responsive, targeting at least 30 fps during manipulation. Avoid rebuilding detailed fasteners or repacking all stock on every pointer event.

## Explicit boundaries

No cloud accounts/storage, public sharing service, collaboration, checkout, arbitrary CAD authoring, terrain sculpting, or structural simulation in this issue. Default geometry is rectangular and the initial interface remains English. Physical assembly recipes and any capacity claims need documented validation; generated artwork never serves as fabrication evidence.
