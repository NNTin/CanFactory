# Cigarette case: how the parts go together

The live preview's assembly slider (issue #8) moves the rendered parts from the print bed to the closed case. The data
is `cigaretteCaseAssembly` in `packages/contracts/src/models.ts`. This file records how the poses and steps were found
and how they are checked. The generic mechanism is described in [adding-models.md](adding-models.md).

## Slider stops

| Stop | What happens |
|---|---|
| 0 | The parts lie on the print bed as printed (the viewer's grid). |
| 1 | The parts lift off and move into the exploded layout (50 mm above the floor), turned the way they are used. |
| 2 | **Close the mini box**: the mini lid comes down onto the mini box. |
| 3 | **Slide the mini box into the lid**: the closed mini box rises into the case lid's open bottom. |
| 4 | **Push the holder into the box**: the holder rises into the round bay through the box's open floor. |
| 5 | **Close the case**: the case lid, with the mini box inside, comes down onto the box. The closed case settles onto the floor. |

## Assembled poses

All poses are in the case box's frame: millimetres, Z up, underside at `z = 0`. Each part's STL is used exactly as rendered;
every SCAD file centres its part at the origin.

| Part | Position | Rotation | Why |
|---|---|---|---|
| `case-box`, `case-text` | 0, 0, 0 | none | The frame itself; the text part is modelled in the box's frame. |
| `case-lid` | 0, 0, 60.38 | none | The lid is printed rim down, which is also how it is used. Its rim sits on the step at the top of the box's honeycomb (`BASE_TOP`), where the snap features are measured from (see [cigarette-case-snap.md](cigarette-case-snap.md)). |
| `mini-holder` | −16.84, 0, 0 | none | Centred in the round bay (`BAY_ROUND`), flush with the box's underside. The bay is open through the floor, and the clip tab (z 32.3 to 34.9) stops the holder's dome: collisions start about 1.6 mm higher. |
| `mini-box` | 6.45, 0, 82.84 | none | Its chamfered end has the same slope (−0.584) as the lid cavity's chamfer. At x = 6.7 it collides with the lid wall, so it sits with its chamfer against the lid's. Its closed top is against the lid ceiling (60.38 + 37.85 = 98.23 mm). |
| `mini-lid` | 6.25, 0, 98.23 | 0, 180, 0 | The lid is printed cap down and is used cap up, so it is turned over about Y; turning about Y undoes the X mirror of its plan. The cap rests on the mini box's rim (15.39 mm above the mini box's floor), which puts the end pads in the rim notches. The best fit is 0.2 mm towards −X. |

## How the poses were checked

`npm run check:assembly` (`tools/check-assembly.ts`) renders every part as the worker does, places them with the same
functions the web app uses, and measures the volume shared by parts on a 0.25 mm grid of vertical rays
(`intersectionVolume` in `tools/stl-to-scad/compare.ts`). It checks three things:

- **The assembled state:** every pair of parts.
- **The exploded layout:** every pair of parts, and that nothing is below the floor.
- **Each step:** 17 samples along the step's path, the moving parts against all the others.

Default settings (`friction`): every value is at most 0.29 mm³. The largest is the mini lid's pads touching the mini box
at its notches, which is contact rather than overlap. The `magnet` mode is just as clean, and so is second-filament text.

The other snap modes show only their intended interference, where the snap acts:

| Mode | Shared volume | Where |
|---|---|---|
| `detent` | 6.1 mm³ | While the case closes: the bump passes the lid wall before it drops into its groove. |
| `clip` | 7.4 mm³ while the case closes; 10.9 mm³ as the mini box enters the lid | The lid's clip nibs stand 0.6 mm into the cavity. The tongues flex out of the way in both steps. |
| `crush-ribs` | 8.2 mm³ lid on box, 4.1 mm³ mini lid in mini box, when closed | The ribs are squeezed (the designed interference, see the snap doc). |

A negative control: if the holder comes in from the top instead (`from: [0, 0, 90]`), the check fails with 15.3 mm³ against
the clip tab. That is why step 4 brings it in from below.

## What the collision check cannot decide

These choices fit either way, so they are judgement calls:

- **The holder's rotation about Z.** Its window faces +X, as printed. Turned 180°, it fits just as well.
- **The mini box's height in the lid.** It could hang anywhere between the box's rim and the lid ceiling; it is shown under
  the ceiling, because it comes out with the lid (issue #8, "the top minibox separates from the honeycomb top").
- **The mini box's orientation.** Floor down or floor up both fit; it is shown floor down.
