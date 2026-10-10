# XIAO Sense camera housing

`#/models/xiao-sense-camera-housing` is a customizable **indoor** enclosure for the
[Seeed Studio XIAO ESP32-S3 Sense](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/),
including its camera expansion board. The project owner's
[Amazon DE listing](https://www.amazon.de/dp/B0C69FFVHH/) is linked to the new
`seeed-xiao-esp32s3-sense` entry in the development-board library.
Cat identification, feeding-event tracking, firmware, batteries and a mounting
bracket are outside this model's scope.

## Parts and access

Download a ZIP containing **only `base.stl` and `lid.stl`**. The board, six inserts
and four lid screws are reference hardware in the live preview, not prints.
The library card's SVG shows both assembled and exploded views. The live STL
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
  underside components and solder joints. Two Ø0.6 mm locating pegs enter the
  **unsoldered GPIO4 and GPIO43 holes** to prevent sliding; hood retainers limit
  lift at the expansion PCB's free side edges, not at the camera or SD socket.
  Boards with soldered pin headers/wires in these holes are not supported.

## Mounting and fasteners

The default assembled envelope is **48 × 46 × 24.2 mm**, excluding screw heads.
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

## Customization and printing

Adjust outside dimensions, wall thickness, board clearances, under-board
clearance, camera headroom, seam clearance, mounting insert/pitch, camera
alignment, USB plug envelope/recess, antenna/battery exits, ventilation and
charge window. Validation keeps mounting bosses clear of guides, preserves
blind ends and the floor under USB, and keeps the nominal lens, roof retainers
and lid screw ligaments clear of the camera aperture.

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
thermal guarantee. An upgraded heatsink is not included in the envelope.

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
their original geometry.

The housing frame is centred XY, Z up; USB points towards +Y. PCB underside is
at `wall + standoff`, with its Y origin derived from the USB recess. The seam
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
npx playwright test tests/browser/camera-housing.spec.ts tests/browser/parts.spec.ts
```

Renderer cases inspect both connected closed solids, dimensions, actual
through-openings and blind pockets, and identical preview/download ZIP bytes.
The sweep also fails on float32 sliver repairs. The assembly checker verifies
clearances of the printed parts against the board stack and linked hardware,
including the exploded layout and assembly paths. It does not simulate flexible
cables, thermal behaviour, heat-setting or a real tolerance stack-up.
