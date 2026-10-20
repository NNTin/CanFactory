# Catio planner specification and design studies

This directory contains the requirements and original interface studies for an in-browser catio planner.

- [Full issue specification](issue.md): agreed scope, numbered requirements, user stories and acceptance criteria.
- [Product research and construction-recipe matrix](products.md): sourced German products, generic hardware-store specifications and quantity examples.
- [Image prompts and provenance](prompts.md): exact prompts, correction passes and artifact mapping.

## Gallery

| Study | Image |
| --- | --- |
| 01 · Garden and enclosure | [![Garden editor](01-starting-garden.png)](01-starting-garden.png) |
| 02 · Interior customization | [![Interior editor](02-interior-editor.png)](02-interior-editor.png) |
| 03 · Tunnel extension and elevation | [![Tunnel editor](03-tunnel-editing.png)](03-tunnel-editing.png) |
| 04 · Isolated component and assembly | [![Component detail](04-component-detail.png)](04-component-detail.png) |
| 05 · Build pack | [![Build pack](05-build-pack.png)](05-build-pack.png) |

These are proposed interfaces, not implemented screenshots or manufacturing drawings. Numeric fields, hardware and perspective in generated images are schematic; the written requirements and evaluated project geometry govern the implementation. Study 03 shows a branch in progress with a free end/extension preview, not a completed connection to the second enclosure.

All five images were generated with the built-in image tool using the imagegen skill workflow, then inspected. Study 02 was corrected to show a supported post; study 04 was corrected to retain a continuous wooden core; study 05 was corrected to remove unsupported material claims and show the researched stock sizes. The first image supplies the style reference for the other views.

The documentation is published separately from application implementation. The GitHub issue uses immutable commit URLs for these assets so subsequent branch changes do not alter its embedded design references.

## Implementation status

Built on `feat/catio-planner` (umbrella PR #111, tracking issue #109). Each PR edits only its own row.

| Issue | Phase | Scope | Status |
| --- | --- | --- | --- |
| #112 | PoC 1/4 | Move the pure catio domain into `@canfactory/catio`, with explicit inputs | In review: `packages/catio`, `enclosureLayout` |
| #113 | PoC 2/4 | Project document, commands, undo/redo, `evaluate()`, one platform | In review: `catioProject*.ts`, `catioPlatform.ts` in `@canfactory/catio` |
| #114 | PoC 3/4 | Planner page, scene and direct manipulation | In review (#120): `CatioPlanner.tsx`, `catioPlanner*.ts`; shared store `catioPlannerStore.ts` |
| #115 | PoC 4/4 | Local persistence, JSON import/export, draft build list | In review: `catioPlannerSaved.ts`, `catioPlannerDraft.ts`, `CatioPlannerBuildList.tsx` |
| #116 | Full scope | Replace the Direct and Modular concept page; no legacy code | In review: `#/concepts/catio` is an overview (`CatioOverview.tsx`); Direct/Modular page, scenes and `canfactory.catio.v1` settings deleted; window and cat-port settings in the window's inspector (`resizeWindow`, `setCatPorts`); one-time **Import my existing catio** (`catioLegacyImport.ts`) |
| #117 | Full scope | One settings source: sub-assembly pages read and write the project | In review: the sub-assembly pages are views of a project instance (`#/concepts/catio/<id>/<instance>`; subjects and `configureSubassembly` in `catioProjectDetail.ts`), sharing the planner's store and undo history (`projectSession`); the inspector edits every construction choice (`CatioControls.tsx`); per-page storage, `follows`/`shares`, `CatioCrossPage.tsx` and `catioSaved.ts` deleted |
| #125 | PoC fixes | Platform turns West–East or North–South, is locked inside its enclosure, and has a horizontal move arrow | In review: `platformRange` / `clampPlatform` and the North–South recipe in `catioPlatform.ts`; Move tool's double arrow, orientation control |
| #126 | PoC fixes | Select one or more tunnel elements and raise or lower them; the coupled insert or enclosure port follows | In review: schema v2 route model (`RouteElement`, `tunnelLayout`'s described route, `solveRoute`), `Port.raise`, `raiseElements`, v1 migration in `catioProjectMigrate.ts`; element picking, tree, inspector and arrow |
| #127 | PoC fixes | Extend the tunnel system: tunnels between any two cat ports, each end coupled or free; connect added enclosures | In review: schema v3 (tunnels on the site, framed by their start port: `tunnelFrame`, v2 migration), `addTunnel`, `extendTunnel`/`shortenTunnel`, `turnTunnel`, `connect`/`connectProblems`, `detach`; port markers, extend arrow, turn buttons, Tunnel catalogue entry, port and tunnel inspectors |

The PoC review (#122) found five defects, which are fixed on `feat/catio-planner`:
- undo leaving a dangling view reference;
- a platform added to an undersized enclosure;
- board screws ignoring board thickness;
- an incomplete tunnel preview;
- "Fit all" missing objects outside the garden.

The FR-02 controls #114 deferred (#123) are delivered in the same PR:
- resize handles on each face and a platform's elevation arrow (FR-02.2);
- orthographic Top, Front and Side views that pan on an empty-space drag (FR-02.3);
- Move, Rotate and Resize selection tools with dimension readouts (FR-02.4);
- Page Up / Page Down with Raise and Lower buttons (FR-02.6).

Tunnel route editing and hide/isolate remain later #109 work.
