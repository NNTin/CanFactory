# Cigarette case: how the parts go together

The live preview's assembly slider (issue #8) moves the rendered parts from the print bed to the closed case. The data
is `cigaretteCaseAssembly` in `packages/contracts/src/models.ts`. This file records how the poses and steps were found
and how they are checked. The generic mechanism is described in [adding-models.md](adding-models.md).

## Slider stops

| Stop | What happens |
|---|---|
| 0 | The parts lie on the print bed as printed (the viewer's grid). |
| 1 | The parts lift off and move into the exploded layout (50 mm above the floor), turned the way they are used. |
| 2 | **Close the mini box**: the mini box hangs upside down, as it goes into the case lid; the mini lid comes up into it from below. |
| 3 | **Slide the mini box into the lid**: the closed mini box rises into the case lid's open bottom, floor first. |
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
| `mini-box` | 6.43, 0, 98.23 | 180, 0, 0 | Upside down: its floor, whose +X end is the curved sweep, lies against the lid's flat ceiling (60.38 + 37.85 = 98.23 mm), and its rim, closed by the mini lid's flat cap, faces the case box 14.391 mm lower. It is turned over about X, not Y, so that its chamfered end stays at +X: it has the same slope (−0.584) as the lid cavity's chamfer and sits one clearance (0.2 mm) from it, the same gap as its straight sides. |
| `mini-lid` | 6.43, 0, 83.839 | 0, 0, 180 | The lid is printed cap down and, in the upside-down mini box, is used cap down too. Relative to the mini box it is turned over about Y (the box's X turnover followed by a half turn about Z), which undoes the X mirror of its plan. It sits flush: the cap is level with the mini box's rim, the end pads are centred in the rim notches and the lid's rim stands on the mini box's floor. |

## How the poses were checked

`npm run check:assembly` (`tools/check-assembly.ts`) renders every part as the worker does, places them with the same
functions the web app uses, and measures the volume shared by parts on a 0.25 mm grid of vertical rays
(`intersectionVolume` in `tools/stl-to-scad/compare.ts`). It checks three things:

- **The assembled state:** every pair of parts.
- **The exploded layout:** every pair of parts, and that nothing is below the floor.
- **Each step:** 17 samples along the step's path, the moving parts against all the others.

Default settings (`friction` on every joint, 0.2 mm clearance): every value is 0.00 mm³. The `magnet` mode is just as clean, and so is
second-filament text. The measured gap on each of the four mating surfaces (case lid on box, mini lid in mini box, mini box in
case lid, holder in bay) is the clearance, from 0.1 to 0.6 mm; see [cigarette-case-snap.md](cigarette-case-snap.md#clearance).

The other modes show only their intended interference, where each joint's snap acts (0.2 mm clearance, one setting changed at a
time; each joint's own setting, see [cigarette-case-snap.md](cigarette-case-snap.md)):

| Setting | Mode | Shared volume | Where |
|---|---|---|---|
| `snap` | `detent` | 5.9 mm³ | While the case closes: the bump passes the lid wall before it drops into its groove. |
| `snap` | `clip` | 7.4 mm³ while the case closes; 8.7 mm³ as the mini box enters the lid | The lid's clip nibs stand 0.6 mm into the cavity. The tongues flex out of the way in both steps. |
| `snap` | `crush-ribs` | 8.2 mm³ when closed | The ribs are squeezed (the designed interference). |
| `miniLidSnap` | `detent` | 1.5 mm³ in step 1 only | The lid's bumps pass the mini box's rim before they drop into its grooves. |
| `miniLidSnap` | `crush-ribs` | 3.7 mm³ when closed | The ribs are squeezed. |
| `holderSnap` | `detent` | 1.0 mm³ in step 3 only | The holder's bumps pass the bay wall over the last 5 mm. |
| `holderSnap` | `crush-ribs` | 1.6 mm³ when assembled | The ribs are squeezed. |
| `miniBoxSnap` | `detent` | 4.3 mm³ in step 2 only | The lid's bumps pass the mini box's side walls over the last 7 mm. |
| `miniBoxSnap` | `crush-ribs` | 4.0 mm³ when assembled | The ribs are squeezed. |

The check's vertical rays sample thin, side-facing ribs unevenly, so its rib figures vary with the clearance; the snap doc gives
the exact CSG volumes, which do not.

A negative control: if the holder comes in from the top instead (`from: [0, 0, 90]`), the check fails with 15.1 mm³ against
the clip tab. That is why step 4 brings it in from below.

## What the collision check cannot decide

These choices fit either way, so they are judgement calls:

- **The holder's rotation about Z.** Its window faces +X, as printed. Turned 180°, it fits just as well.
- **The mini box's height in the lid.** It could hang anywhere between the box's rim and the lid ceiling; it is shown under
  the ceiling, because it comes out with the lid (issue #8, "the top minibox separates from the honeycomb top").
- **The mini box's orientation.** Floor down or floor up both fit. It is shown floor up, so that its curved end faces the lid's
  flat ceiling and the mini lid's flat cap faces the case box. Turned floor down, the curved sweep
  would hang into the case box and the flat cap would face the flat ceiling.
