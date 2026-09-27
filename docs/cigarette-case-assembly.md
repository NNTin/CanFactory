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
| 5 | **Insert the lighter into its bay**: a BIC Mini lighter (a reference object, not printed) drops into the round bay from the top, onto the clip tab above the holder. |
| 6 | **Close the case**: the case lid, with the mini box inside, comes down onto the box. The closed case settles onto the floor. |

The lid starts 100 mm above its closed position so that the lighter, which drops 50 mm and stands 20 mm proud of the box's rim
when it is in, fits under the lid in the exploded layout.

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

| `mini-bic-lighter` | −16.84, 0, 35.12 | none | A reference object (see below). In the round bay above the holder, centred like it, base down, width along Y. It rests on the clip tab: 35.12 mm is the lowest height at which it is clear of the box and the holder. |

## Reference objects

The round bay (`BAY_ROUND`) is a tube open at both ends. The mini holder is pushed up into it from below, and the clip tab stops
it. A BIC Mini lighter goes in from the top and rests on the tab, above the holder. Upright, the tab stops it, so it cannot reach
the holder, which is intended. Turned upside down, wheel side towards the tab, its hood and wheel pass beside the tab and push
the holder out through the floor (see [below](#upside-down-the-push-out) and [cigarette-case-snap.md](cigarette-case-snap.md)).
The lighter is the parts library's `bic-j25-mini-lighter` (see [adding-parts.md](adding-parts.md)), modelled in
`parts/everyday-objects/bic-j25-mini-lighter.scad` and shown in the preview, in blue, so that its fit can be seen. It is not
printed and not in the ZIP (see [adding-models.md](adding-models.md), “Reference objects”). The table below is also its entry in
the parts library, with the same sources.

| Dimension | Value | Source |
|---|---|---|
| Height, width, thickness | 62 × 22 × 11 mm | Confirmed: BIC's own specification ([BIC Graphic, J25](https://www.bicgraphic.com/gb/bic-j25-lighter-3460002360.html)), [4imprint UK](https://www.4imprint.co.uk/product/502972/BIC-J25-Standard-Lighter) and [WE MAG](https://wemag.gr/en/product/bic-mini-lighter-j25-2360/); US listings give 7/8 × 2 7/16 in (22.2 × 61.9 mm). |
| Plan: a superellipse, exponent 2.5 | | Estimated from photographs. |
| Body height 50 mm, hood wall 0.4 mm, wheel 7.4 mm (thumb rings) and 6 mm (flint wheel), lever | | Estimated from photographs and the overall height. |

The body is opaque, as on every BIC lighter, so it has no fuel window. The inside of the hood (burner, flint, child-guard spring)
is left out.

The hood is the body's oval carried on upwards: its outside is the same superellipse plan (`plan()`, `PROFILE_N`), flush with the
body, as a sheet-metal wall 0.4 mm thick from its crimped lower edge (1.5 mm below the 50 mm shoulder) to the top. Seen from
the side it is flat on top from its front end (the burner side, −Y) to the wheel, and rounds down around the wheel at the rear;
behind that it is open, so the wheel's rear half and the lever show. Its front end and its two cheeks therefore follow the body's
curve; the cheeks carry the wheel's axle, whose ends sit in them, which also makes the lighter one closed body. The top covers the
front of the plan up to the wheel, with the 3.6 × 4 mm flame slot over the burner. The wheel fills the space between the cheeks
(0.1 mm from each, where they are narrowest along the wheel). The flint tube and the lever stand on the shoulder inside the
cheeks; the lever reaches back past the hood's rear end, to 9 mm behind the centre.

The pose follows from the shapes. The lighter is centred in the round bay, as the holder is, and rests on the clip tab at
35.12 mm, 2.4 mm above the holder's top. Its top is then at 97.12 mm: 20 mm above the box's rim and 1.1 mm under the lid's
ceiling (98.23 mm). So the lighter's height is what the bay and the lid were sized for. The hood does not change the pose: the
lighter rests on its base, and the hood stays inside the body's plan.

**The fit (issue #17).** The traced bay (11.8 × 22.8 mm) left the lighter 0.31 to 0.41 mm from the wall. Above the tab's top
(35.11 mm) the bay is now the lighter's plan pushed out by the clearance, like every other joint. Below it, the holder's part and
the tab are the traced bay, unchanged. The gap is the clearance all round up to 0.46 mm; above that, the −X end keeps a
0.4 mm shell wall. `lighterSnap` adds crush ribs if wanted. See
[cigarette-case-snap.md](cigarette-case-snap.md#lighter-in-the-box-lightersnap). The pose does not depend on the clearance.

The fit rests on the plan's estimated shape (a superellipse with exponent 2.5). No measured profile of the J25 was found to
check it against: BIC publishes only the 62 × 22 × 11 mm envelope, and the CAD models found online (Printables, GrabCAD) are not
openly readable. If a real lighter shows a different oval, change `PROFILE_N` (or the plan) in `bic-j25-mini-lighter.scad` (and the
library entry's `profileExponent`), render
its STL again, and copy the value to `LIGHTER_PROFILE_N` in the box file. The bay follows, and a test fails until both agree.

### Upside down: the push-out

Measured with the parts as rendered at default settings (the lighter centred in the bay, lowered in 0.25 mm steps to its first
contact, then refined; the same vertical-ray volume test as the collision check below). Measured again with the fitted bay of
#17, in steps of 0.25 mm: `friction` at 0.1 and 0.2 mm clearance, `crush-ribs` at 0.2 and 0.6 mm. Every figure below is
unchanged. With the ribs, the shared volume with the box stays at the ribs' squeeze (0.9 to 1.3 mm³) all the way down, and only
jumps when the lever reaches the tab. So neither the fitted wall nor the ribs stop the lighter. Upright, it still first touches
the box on the tab, between 35.25 and 35.00 mm, and never the holder. The heights are of the lighter's lowest
point, the top of its hood and wheel.

- **Wheel side towards the tab** (the lighter turned over about X, so its wheel and lever face the bay's −Y end, where the tab
  is): the tab only covers the bay's −Y end, beyond 6.32 mm from the centre (`TAB_CHORD`). The hood's cheeks end 5.4 mm behind
  the centre (around the wheel) and the wheel 4.7 mm, so both pass beside the tab's flat ends, 0.9 and 1.6 mm clear. The hood's
  oval front end and flat top are at the other end of the bay, away from the tab. The hood and wheel reach the holder's dome
  together, at 32.52 mm (the dome's top is at 32.70 mm; the thumb rings straddle it and the hood's top meets its slope). The
  first part to meet the tab is the lever, behind the wheel (7.8 mm below the hood's top where it crosses the tab's edge), at
  27.34 mm. So the lighter pushes the holder 5.2 mm down, out through the box's underside, before the lever lands on the tab;
  the body's shoulder would only land on it at 23.12 mm.
- **Hood's front end towards the tab** (turned over about Y): the hood's front end, the body's oval carried up, is over the tab,
  and lands on its top at 34.92 mm, 2.4 mm short of the dome. There is no push-out that way round.

This is why the bay of [#17](https://github.com/NNTin/CanFactory/issues/17) could be fitted without breaking the push-out. The hood
has the body's outline, so a bay fitted to the body is fitted to the hood too, and ribs that grip the body pass the hood. What the push-out needs is that the tab stays at the bay's −Y end,
no nearer the centre than the hood's cheeks (5.4 mm), and that the lighter goes in wheel side towards it. The lever landing on the
tab is what limits the push to 5.2 mm: moving the tab's top or its chord changes that.

## How the poses were checked

`npm run check:assembly` (`tools/check-assembly.ts`) renders every part as the worker does, places them with the same
functions the web app uses, and measures the volume shared by parts on a 0.25 mm grid of vertical rays
(`intersectionVolume` in `tools/stl-to-scad/compare.ts`). It checks three things:

- **The assembled state:** every pair of parts.
- **The exploded layout:** every pair of parts, and that nothing is below the floor.
- **Each step:** 17 samples along the step's path, the moving parts against all the others.

It includes the reference objects, rendered from their SCAD files, and fails if the committed STL that the preview uses no
longer matches the SCAD file's bounds.

Default settings (`friction` on every joint, 0.2 mm clearance): every value is 0.00 mm³. The `magnet` mode is just as clean, and so is
second-filament text. The measured gap on each of the five mating surfaces (case lid on box, mini lid in mini box, mini box in
case lid, holder in bay, lighter in bay) is the clearance, from 0.1 to 0.6 mm (the lighter's up to 0.46 mm, then the −X end is
capped by the minimum wall); see [cigarette-case-snap.md](cigarette-case-snap.md#clearance).

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
| `lighterSnap` | `crush-ribs` | 1.4 mm³ when assembled, and while the lighter goes in (step 4) | The bay's ribs are squeezed by the lighter; they sit just above its rest height. |
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
