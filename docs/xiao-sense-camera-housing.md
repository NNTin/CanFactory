# XIAO Sense camera housing

`#/models/xiao-sense-camera-housing` is a customizable **indoor** enclosure for the
[Seeed Studio XIAO ESP32-S3 Sense](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/),
including its camera expansion board. The project owner's
[Amazon DE listing](https://www.amazon.de/dp/B0C69FFVHH/) is linked to the new
`seeed-xiao-esp32s3-sense` entry in the development-board library.
Cat identification, feeding-event tracking, firmware, batteries and a mounting
bracket are outside this model's scope.

## Parts and access

Download a ZIP containing **only `base.stl` and `lid.stl`**. The board, selected fasteners and optional fan are reference hardware in the
live preview, not prints.
The library card's SVG shows assembled and exploded views of the optional
fan-bay variant, labelled as such (fan mode defaults off). The live STL
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

## Optional active cooling

Enable **Cooling fan**, then choose one of the new parts-library fans:

| Fan | Envelope used | Mounts | Published free-air rating | Power |
| --- | --- | --- | --- | --- |
| [Sunon MF30100V2-1000U-A99](https://www.sunon.com/eu/MANAGE/Docs/WEBCONT/Files/1236/DC_20240630%28255-E%29_web.pdf) | 30.5 × 30.5 × 10.5 mm tolerance maximum | 3, 24 mm pitch | 4.7 CFM; 21 dB(A) | 5 V; 0.08 A; 0.4 W |
| [Noctua NF-A4x10 5V PWM](https://www.noctua.at/en/products/nf-a4x10-5v-pwm/specifications) | 40 × 40 × **12 mm with pads** | 4, 32 mm pitch | 5.24 CFM; 19.6 dB(A) maximum | 5 V; 0.07 A / 0.35 W maximum |

The 30 mm option is more compact; the 40 mm option has a lower published noise
rating and a USB power adaptor. These are manufacturer free-air figures, **not
predicted enclosure performance**. Re-check the delivered fan: Sunon's 3-hole
frame needs the missing corner/leads oriented at −X/−Y. Noctua's mounting-hole
diameter is estimated; pitch and 12 mm installed thickness are published.

The shell grows **rearwards**, preserving board position, USB front plane,
optical alignment and rear-mount pitch. Actual length is `length + fan max
length + wall + 15`; width is `max(width, fan max width + 2*wall + 2)`. Thus the
default 40 mm fan grows **48 × 46 × 24.2** to **48 × 103 × 24.2 mm**; the 30 mm
option becomes **48 × 93.5 × 24.2 mm**. Disabling the fan restores the compact
shell with no fan holes or hardware. At the minimum stack settings the roof
also rises just enough to keep the selected fan bolt 0.8 mm above the floor.
The derived notes show actual dimensions.

A circular roof grille with 1.8 mm gaps / 1.4 mm bridges guards the exhaust.
Six lower side intake slots provide a separate air path near the board. These
are mandatory in fan mode, even when **Ventilation** (passive roof slots) is
off. Pre-bolt the fan to the hood's 2 mm spacers, exhaust towards the roof,
using the listed ISO 4762 screws and ISO 4032 nuts (M2.5 Sunon, M3 Noctua).
The preview moves this preassembled fan/fastener group with the hood. Keep the
lead above the floor, below the rotor sweep and restrained; the existing split
battery exit can also route fan power wires when sized for both bundles.

**Power and thermal limits:** do not power a fan from GPIO or 3V3. Provide a
regulated 5 V supply with verified current/start-up margin for the fan **and**
board; a battery's voltage is not regulated 5 V. Wiring, drivers, PWM and
firmware are out of scope. Cooling has not been thermally tested. Seeed's
[getting-started guide](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)
discusses board heat and an upgraded heatsink; that heatsink is **not** included
in this fit envelope. Measure sustained streaming/charging temperatures in the
real enclosure, choose heat-appropriate print material, and keep dust/food,
paws and cables away from the vents. This is not a fire-safe or unattended-use
certification.

## Customization and printing

Adjust outside dimensions, wall thickness, board clearances, under-board
clearance, camera headroom, seam clearance, mounting retention/fastener/pitch, optional fan, camera
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

The compact housing frame is centred XY, Z up; fan mode extends the −Y end; USB points towards +Y. PCB underside is
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
npm run check:assembly -- xiao-sense-camera-housing --parameters '{"fanEnabled":true,"mountRetention":"nut"}'
npm run check:assembly -- xiao-sense-camera-housing --parameters '{"fanEnabled":true,"fan":"sunon-mf30100v2-1000u-a99"}'
npx playwright test tests/browser/camera-housing.spec.ts tests/browser/parts.spec.ts
```

Renderer cases inspect both connected closed solids, dimensions, actual
through-openings and blind pockets, and identical preview/download ZIP bytes.
The sweep also fails on float32 sliver repairs. The assembly checker verifies
clearances of the printed parts against the board stack and linked hardware,
including the exploded layout and assembly paths. It does not simulate flexible
cables, thermal behaviour, heat-setting or a real tolerance stack-up.
