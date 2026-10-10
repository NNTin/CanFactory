# XIAO Sense camera housing

`#/models/xiao-sense-camera-housing` is a customizable **indoor** enclosure for the
[Seeed Studio XIAO ESP32-S3 Sense](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/),
including its camera expansion board. The project owner's
[Amazon DE listing](https://www.amazon.de/dp/B0C69FFVHH/) is linked to the new
`seeed-xiao-esp32s3-sense` entry in the development-board library.
Cat identification, feeding-event tracking, firmware, batteries and a mounting
bracket are outside this model's scope.

## Parts and access

Download a ZIP containing **only `base.stl` and `lid.stl`**. The board, selected fasteners and optional heatsink are reference hardware in the
live preview, not prints.
The library card's SVG shows assembled and exploded views with the default
backside heatsink. Heatsinks are optional but **enabled by default**. The live STL
preview has the existing assembly slider, Play and individual part visibility:
seat the stack, lower the hood, then tighten the four screws. Hide the hood to
inspect the board in place.

- **Camera:** circular roof aperture, adjustable diameter and XY alignment.
  Defaults use the published **21 × 17.8 × 15 mm** Sense stack envelope.
- **USB-C:** front opening for charging, power and data, with adjustable plug
  width, height and socket recess (wall thickness plus additional recess).
- **Charging indicator:** optional 2.4 mm left-side sight hole at the red LED's
  height. This is not a light pipe; visibility depends on viewing angle.
- **Battery wires:** adjustable split right-side exit. An external battery is
  wired to the underside BAT+/BAT− pads; there is no second charging connector
  or internal battery compartment.
- **External antenna:** adjustable split left-side exit for the U.FL pigtail.
  Attach the connector first, then lay the lead into the notch before closing
  the hood: the tiny connector need not be threaded through a closed hole.
- **Retention:** edge ledges and guides support the main PCB clear of its
  underside thermal pad, heatsink and battery solder joints. Two Ø0.6 mm locating pegs enter the
  **unsoldered GPIO4 and GPIO43 holes** to prevent sliding; hood retainers limit
  lift at the expansion PCB's free side edges, not at the camera or SD socket.
  Boards with soldered pin headers/wires in these holes are not supported.

## Mounting and fasteners

The default assembled envelope is **48 × 46 × 32.4 mm** (with the default heatsink), excluding screw heads.
Two blind rear-facing mount pockets are **34 mm** apart, centred across the
width on Y = 0. Select ruthex M3 × 5.7 (default), CNC Kitchen short M3 × 3,
CNC Kitchen short M4 × 4, or ruthex M4 × 8.1 inserts. The pockets take their
**recommended hole diameter, minimum depth and surrounding wall** from the
parts library. Their closed ends separate mounting screws from electronics.

The four closure inserts are ruthex RX-M2x4, installed from the tray's upper
face. Closure bores are 7.5 mm deep (longer than the maker's 5 mm minimum),
leaving space below each insert for the screw tip. Lid holes are Ø2.4 mm.
The preview/hardware list automatically chooses an ISO 4762 M2 screw long
enough for at least 3 mm engagement and short enough not to bottom out.
Defaults use **four M2 × 16 screws**. Rear mounting screws depend on your own
bracket's thickness: **do not penetrate farther than the chosen insert's
length**, as listed under the settings. They are intentionally not selected
or shown as if a bracket thickness were known.

### Self-locating seam

An **open-sided alignment groove (perimeter rabbet)** in the tray rim receives
a matching downward tongue on the hood. The opposed faces locate the hood in
X/Y before tightening the screws; the screws clamp it rather than providing
the only lateral location. This is a clearance fit, not a snap or press fit.
Lower the hood squarely until the tongue enters the groove, check the cable
notches, then tighten the four M2 screws evenly. Do not use them to force a
tight or misaligned tongue into place.

| Setting / dimension | Default | Convention |
| --- | --- | --- |
| **Alignment overlap** (`seamDepth`) | 1.2 mm | 0.8–2.4 mm, in 0.2 mm steps; overlap below the tray rim. |
| **Lid seam clearance** (`seamFit`) | 0.2 mm | Existing 0.15–0.45 mm range, in 0.05 mm steps; now also the gap **per side** at the tongue and beneath its tip. Larger is looser, as with this repo's other mating-part clearances. |
| Tongue / remaining outer rim thickness | 1.0 mm each | Each is `wall / 2`, at least 0.8 mm with the minimum 1.6 mm wall. The tongue shifts inward by `seamFit`, keeping its thickness rather than thinning it to add clearance. |
| Groove depth below the tray rim | 1.4 mm | `seamDepth + seamFit`; the hood's main rim still starts `seamFit` above the tray. |

The groove is open towards the cavity so thin walls do not need two fragile
groove cheeks. Both profiles follow offsets of the existing rounded inner
wall. Full-radius corner insert bosses remain intact; tongue reliefs clear
each boss by `seamFit`. The USB and split cable openings cut through the
tongue too; cable notches stay open to its tip so lowering the hood does not
catch pre-routed leads. The groove and tongue do not change the outside envelope, board
position, camera headroom, screw grid, insert depth or screw-length selection.
Validation keeps the rear mounting pockets' blind caps below the groove floor;
deep overlaps in a compact housing may require more under-board clearance or
a shallower overlap.

The overlapping seam removes a direct path through most of the former flat
gap and may reduce dust/draught ingress. It is **not a weather seal**: the
boss reliefs, cable/USB openings and optional vents interrupt it, and there is
no gasket or waterproof rating. Test-print the fit for your printer/material;
remove burrs and increase `seamFit` if the hood binds. Model version 4 parts
are a matched pair: reprint both tray and hood rather than mixing seam revisions.

### Captive nuts instead of rear heat-set inserts

Set **Rear mounting → Captive nuts** and select ISO 4032 M3/M4 hex nuts or
DIN 562 M3/M4 thin square nuts. Each pocket has a bottom screw-clearance bore,
a side-loading slot opening into the tray, flats to prevent rotation, a floor
and a closed roof. Slide nuts in from +Y **before seating the board**; the
mounting screw secures them against sliding back out. Do not heat-set nuts.
The four M2 **lid** inserts are unchanged. Enlarge the width/spacing as the
validator requires for larger nuts. Pocket fit is 0.2 mm per flat side and
0.3 mm total height clearance; test-print the pocket for your printer.

Rear nut mounting screws must reach through the floor and nut but stop below
the blind cap. The live notes give the maximum penetration **from the outer
floor**, excluding your bracket. Bracket thickness is not guessed.

## Optional passive cooling (default on)

**Heatsink** is enabled by default. There are no fan options, bays or fan
parts. Fit **one** small heatsink to the **backside thermal pad** of the main
PCB, fins towards the floor, before seating the stack. Do not insert a sink
between the main PCB and the Sense expansion board: the camera, SD socket and
board-to-board connector leave very limited space there.

| Part | Envelope used, excluding adhesive | Compatibility / limits |
| --- | --- | --- |
| [Seeed XIAO aluminium sink, SKU 114010001](https://files.seeedstudio.com/Bazaar/product_pdf/114010001.pdf) (default) | Published 10 × 10 mm footprint; **10 mm height estimate, not published** | Seeed-designed for XIAO ESP32S3 (Sense), includes thermal adhesive; sold in packs of two, but this housing uses one. Measure height before printing. |
| [Same Sky HSB02-101007](https://www.sameskydevices.com/product/resource/hsb02-101007.pdf) | 10 × 10 × 7 mm nominal, ±0.38 mm general tolerance; **10.38 × 10.38 × 7.38 mm maximum** | Dimensional alternative, not Seeed-approved or thermally validated on this board. Supply separate electrically insulating thermal adhesive. Drawing rev. 1.03, 2025-12-12. |

Seeed's [installation guide](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/#installing-the-upgraded-heat-sink)
prioritizes the backside thermal pad and keeping BAT pads unobstructed. Its
single-sink layout preserves GPIO access; the dual layout can obstruct pins.
This housing deliberately supports only **one** sink to preserve the battery
connections and unsoldered locating holes. The estimated placement is centred
at PCB X=10.5, Y=5.5 mm in the USB-at-+Y frame. Check alignment on your delivered
board **before bonding**, keep solder joints/lead insulation clear, and prevent
metal or conductive adhesive bridging any pads. Do not rely on anodizing as
electrical insulation. Larger 14–15 mm Raspberry Pi sinks and dual sinks are
not supported simply by increasing the height setting.

The housing grows **vertically**, not in footprint. Effective floor-to-PCB
clearance is:

```
heatsink on: max(standoff, sink maximum height + extra height + adhesive thickness + 2 mm air gap)
heatsink off: standoff
```

The default estimated 10 mm sink and 0.2 mm adhesive raise the PCB clearance
from 4 to **12.2 mm**, giving **48 × 46 × 32.4 mm** overall. Same Sky gives
**48 × 46 × 29.78 mm**; disabling the sink restores **48 × 46 × 24.2 mm**.
Board supports, seam, USB opening, cable exits and roof rise together, keeping
the camera headroom unchanged. **Extra heatsink height** adds 0–10 mm clearance
for measured height differences; **Thermal adhesive thickness** allows
0.1–1 mm. Extra clearance is empty space, not a scaled reference part. Seeed's
unpublished height must be measured; the 10 mm estimate is not a guaranteed
maximum. Derived notes report the actual shell height and clearance.

**Ventilation** adds lower side intakes and passive roof outlets; both default
on. Disabling ventilation removes both and requires particular attention to
heat buildup. No power wiring, rotor, fan fasteners or extended rear bay remain.
The sink appears in the parts library, SVG exploded view and live assembly,
and moves with the camera stack; it is never included in the printable ZIP.

**Thermal limits:** Seeed's guide reports improvements in its own open-board
camera test, not in this printed enclosure. Those measurements do not predict
this housing's operating temperature. Test sustained streaming and charging
in the assembled housing at the intended ambient temperature, keep vents free
of dust/food, and choose a heat-appropriate material. There is **no thermal-performance guarantee**, fire-safe certification or unattended-use approval.

## Customization and printing

Adjust outside dimensions, wall thickness, board clearances, under-board
clearance, camera headroom, seam clearance/alignment overlap, mounting retention/fastener/pitch, optional heatsink/extra height/adhesive, camera
alignment, USB plug envelope/recess, antenna/battery exits, ventilation and
charge window. Validation keeps mounting bosses clear of guides, preserves
blind ends and the floor under USB, and keeps the nominal lens, roof retainers
and lid screw ligaments clear of the camera aperture, and keeps mounting caps
below the alignment groove.

Print the generated tray floor down and hood roof down, preferably in PETG,
with 0.2 mm layers and 3–4 perimeters. Local supports/bridging may be needed at
side openings. The tiny locating pegs need a calibrated printer. Install all
heat-set inserts **with the electronics removed**, then connect wires/antenna,
seat the board, route leads and close the hood. Keep the external antenna away
from metal mounting hardware. Add external strain relief; none is provided.

This is a prototype, **not physically fit-tested**, not waterproof, and not a
sealed food-contact enclosure. Keep it away from wet food/water and protect
cables and small hardware from cats. Check screw length, electrical isolation,
USB cable fit, camera field of view and operating temperature on the real
assembly before leaving it unattended. Optional ventilation slots are not a
thermal guarantee. The selected sink is included in the clearance envelope, subject to its stated dimension estimates.

## Hardware provenance and coordinate frame

The source values are catalogued with their provenance in `dev-boards.ts` and
`parts/sources.ts`. Seeed's specification supplies the assembled envelope. Its
[2023 STEP assembly](https://files.seeedstudio.com/wiki/SeeedStudio-XIAO-ESP32S3/res/seeed-studio-xiao-esp32s3-sense-3d_model.zip)
has a 1.25 mm main PCB; the simplified component layout follows that assembly
and the v1.5 KiCad placements linked in Seeed's resources. The camera,
expansion PCB, SD socket and interconnect are **estimated envelopes**. Older
OV2640 and newer OV3660 camera modules differ: measure the delivered lens and
check the aperture/field of view, rather than treating the schematic preview
as production CAD. The antenna is directly connected through U.FL, not a C6's
GPIO-controlled RF switch.

Development-board components now support an optional `base` height above the
main PCB top (default zero). Body and top heights are local to that base;
negative bases represent underside components. The procedural web preview and
generic SCAD reference renderer apply the same offset. Existing boards retain
their original geometry. The Sense underside is bare (apart from flat pads);
its shield is on top below the expansion PCB, not underneath the thermal pad.

The housing frame is centred XY, Z up; USB points towards +Y. PCB underside is
at `wall + effective clearance`, with its Y origin derived from the USB recess. The seam
is 5 mm above the main PCB top. The roof underside is the PCB underside plus
the 15 mm stack and headroom. The hood prints roof down; its assembled pose
rotates it 180° about X and translates by the overall housing height. Reference
hardware uses these same formulas, including at non-default settings.

## Verification

```sh
npm run check
npm run build
TEST_ONLY=xiao-sense-camera-housing npm run test:renderer
TEST_ONLY=xiao-sense-camera-housing SWEEP_SAMPLES=100 npm run test:sweep
npm run check:assembly -- xiao-sense-camera-housing
npm run check:assembly -- xiao-sense-camera-housing --parameters '{"heatsinkEnabled":false,"mountRetention":"nut"}'
npm run check:assembly -- xiao-sense-camera-housing --parameters '{"heatsink":"same-sky-hsb02-101007","heatsinkAllowance":4}'
npm run check:assembly -- xiao-sense-camera-housing --parameters '{"wall":1.6,"seamFit":0.45,"seamDepth":2.4}'
npm run check:assembly -- xiao-sense-camera-housing --parameters '{"width":54,"mountSpacing":36,"wall":3.6,"seamFit":0.15,"seamDepth":2.4}'
npx playwright test tests/browser/camera-housing.spec.ts tests/browser/parts.spec.ts
```

Renderer cases inspect both connected closed solids, dimensions, actual
through-openings and blind pockets, and identical preview/download ZIP bytes.
They probe the groove, tongue, lateral/bottom/vertical gaps, preserved screw
bosses and openings through the tongue, including thin/thick walls and the
clearance/overlap extremes. Contract tests check the same derived dimensions,
SCAD mappings and compact-housing blind-cap validation without changing
headroom or fastener layout.
The sweep also fails on float32 sliver repairs. The assembly checker verifies
clearances of the printed parts against the board stack and linked hardware,
including the exploded layout and assembly paths. It does not simulate flexible
cables, thermal behaviour, heat-setting or a real tolerance stack-up.
