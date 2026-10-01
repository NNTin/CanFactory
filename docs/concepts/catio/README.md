# Window catio concepts

A ground-supported timber enclosure connects a souterrain apartment window to the lawn. A removable collar clamps into the solid exterior recess and can be tightened by reaching through the open window. The existing sash opens inward and can close with the attachment installed. Four short legs support the timber base; a continuous metal-mesh floor and low mesh skirts enclose the grass. A narrow cleated ramp descends from the sill.

## Design gallery

Each image opens as a full-resolution 1536 × 1024 PNG. These are design references for review and later SCAD work. Generated illustrations can differ in perspective, hinge placement and small construction details; the dimensions below and the live geometry take precedence. Hardware is schematic, pending measured recess dimensions and detailed sizing.

| Study | Image |
| --- | --- |
| Exterior and interior overview | [![Overview](01-overview.png)](01-overview.png) |
| Front, side and top orientations | [![Orientations](02-orientations.png)](02-orientations.png) |
| Interior adjustment, exterior connection and clearance section | [![Window attachment](03-window-attachment.png)](03-window-attachment.png) |
| Legs, ramp, mesh floor and grass | [![Ground details](04-ground-details.png)](04-ground-details.png) |
| Exploded components | [![Exploded assembly](05-exploded.png)](05-exploded.png) |
| Six assembly stages | [![Assembly sequence](06-assembly.png)](06-assembly.png) |

Created using the imagegen skill and built-in image tool. The [exact prompts and corrections](prompts.md) record how the sheets were made from inspected browser screenshots.

## Live concept

Open **Catio concept** in the CanFactory header or the **Window catio** card in the model library: `#/concepts/catio`.

For local development:

```sh
npm run dev --workspace @canfactory/web -- --port 5181
```

Then open <http://127.0.0.1:5181/#/concepts/catio>. This page works without an API or worker. The existing app may still request catalogue metadata for its navigation, but failures do not block the concept.

The preview provides six camera presets, orbit/pan/zoom, a window open/closed toggle, wall cutaway, exploded view, component visibility, and a six-stage assembly slider. The gallery and written assembly instructions remain available when WebGL is unavailable. Images can be opened or downloaded individually.

## Dimensions and assumptions

| Item | Value | Basis |
| --- | --- | --- |
| Glass | 800 × 800 mm | User measurement |
| Movable sash | 910 × 910 mm | User measurement; excludes fixed frame |
| Sill above grass | 200 mm | User measurement |
| Enclosure, width along wall × projection × height above grass | 1200 × 1000 × 1200 mm | Selected concept size |
| Fixed window frame | 1000 × 1000 mm | Illustrative estimate |
| Wall thickness / exterior recess depth | 300 / 150 mm | Illustrative estimates |
| Timber members | 45 × 45 mm | Concept default |
| Mesh openings / wire thickness | Nominal 20 / 2 mm | Concept defaults |
| Floor mesh plane | 4 mm above lawn datum | Concept depiction of mesh touching grass |
| Ramp width / horizontal run | 300 / 700 mm | Concept defaults |
| Hinges | Left, viewed from indoors | Assumed orientation |

The model uses millimetres, X along the wall, +Y outdoors and Z up. Grass is Z=0 and the exterior wall face is Y=0. The collar and its four padded side clamps sit entirely beyond the closed sash. The timber rear portal is connected with removable exterior brackets and a mesh-sided passage with a timber threshold. Mesh surrounds the rear portal and covers the other sides, roof and floor. Covered edges and a low perimeter skirt join the floor to the raised base rails. The garden-facing maintenance door is timber and mesh, with hinges and a latch.

The geometry, dimensions and assembly stages live in [catioDesign.ts](../../../apps/web/src/catioDesign.ts) and [catioScene.ts](../../../apps/web/src/catioScene.ts). Measured recess size, hardware fit and structural sizing need to be established before fabrication. The current stage has no SCAD files, printable export or editable size controls.

## Assembly sequence

The existing window, wall and grass remain stationary. The window is existing context, not a new window installation.

1. **Fit the recess collar:** open the sash inward and tighten the four padded clamps from inside.
2. **Position the base:** set the feet on the lawn and secure the continuous mesh floor and low perimeter skirt.
3. **Build the enclosure:** assemble the posts, upper rails and side mesh panels.
4. **Connect to the window:** attach the rear portal, enclosed passage and removable brackets.
5. **Fit ramp, roof and door:** install the cleated ramp, mesh roof and maintenance door.
6. **Completed catio:** latch the door and inspect the original window in its open and closed positions.

## Verification

Unit tests inspect the actual procedural geometry for glass/sash dimensions, enclosure bounds, floor/skirt continuity, ramp endpoints, stationary context and clearance throughout a 0–90° sash sweep. This checks the illustrative scene, not structural capacity or the fit of an unmeasured real window.

Browser tests cover the concept with unavailable backend services, camera controls, assembly stages, visibility, window state, all six image downloads, history navigation and mobile WebGL fallback. Run:

```sh
npm run check
npm run build
BASE_URL=http://127.0.0.1:5181 npx playwright test tests/browser/catio.spec.ts
```
