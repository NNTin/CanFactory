# Cigarette case: snap mechanisms

The cigarette case has five joints, and each has its own snap setting. The other parameters are the underside text or logo (see
[cigarette-case-text.md](cigarette-case-text.md)) and the [clearance](#clearance). Each setting is an enum
(`ControlSchema.kind = 'enum'`, with its `options`). It reaches the SCAD files as `-D <VAR>="<value>"`
(`apps/worker/src/render.ts`, `mappedDefines`), and only the printed parts of its joint receive it (their `scadMapping`):

| Setting (editor label) | Joint | SCAD variable | Parts | Modes |
|---|---|---|---|---|
| `snap` (Case lid snap) | case lid on the case box's upper shell | `SNAP` | `case-box`, `case-lid` | friction, detent, clip, magnet, crush ribs |
| `miniLidSnap` (Mini box lid) | mini lid in the mini box | `MINI_LID_SNAP` | `mini-box`, `mini-lid` | friction ("Clearance fit"), detent, crush ribs |
| `holderSnap` (Holder in the box) | mini holder in the case box's round bay | `HOLDER_SNAP` | `mini-holder`, `case-box` | friction, detent, crush ribs |
| `lighterSnap` (Lighter in the box) | BIC Mini lighter in the case box's round bay, above the tab | `LIGHTER_SNAP` | `case-box` only (the lighter is a reference object, not printed) | friction, crush ribs |
| `miniBoxSnap` (Mini box in the lid) | closed mini box in the case lid's cavity | `MINI_BOX_SNAP` | `mini-box`, `case-lid` | friction, detent, crush ribs |

Every setting defaults to `friction`, which adds nothing: the default geometry is the fitted reconstruction of issue #7.
Clip and magnet are offered only for the case lid (issue #11): the holder and the mini box have 1 to 1.2 mm walls with no room for a
magnet pocket, except behind bosses that would fill the holder's inside or collide with the mini lid, and a clip tongue would have
to be slit into walls that already carry the other features. The lighter's joint offers only what the case box can do alone, since
the lighter cannot be changed: no detent (it would need a bump or a groove on the lighter) and no clip or magnet.

The features that reach into the mating part are sized from the clearance, so each mechanism engages the same amount at any
clearance (see [Clearance](#clearance)):
- A bump stands `CLEARANCE + ENGAGE` proud of its wall, so it always reaches `ENGAGE` past the mating face.
- Its groove clears it by `CLEARANCE` on every side, so the groove is `ENGAGE + CLEARANCE` deep.
- A crush rib stands `CLEARANCE + SQUEEZE` proud.

The two files of each of the three smaller joints share one block of constants and modules, and a test keeps the two copies
identical (`packages/contracts/src/models.test.ts`):
- `holder retention`: the case box and the holder.
- `mini box retention`: the case lid and the mini box.
- `mini lid retention`: the mini box and the mini lid.

## Two rules for where the features go

- **Short rubbing distance.** A feature near the *leading* end of the part that slides in rubs along the whole mating wall on the
  way in: about 30 mm for the holder and 25 to 36 mm for the mini box. A feature near the *trailing* end of the moving part rubs
  only over the last few millimetres. So does a feature on the fixed part near where the moving part's leading end comes to rest.
  Each joint uses whichever of these suits it.
- **Opposing pairs.** A bump on one side only lets the part shift sideways by `CLEARANCE`. Its engagement then drops to
  `ENGAGE − CLEARANCE`, which is nothing at the defaults. Every feature therefore has a partner on the opposite side.

## Case lid on the case box (`snap`)

| Value | What is added |
|---|---|
| `friction` (default) | Nothing: the plain walls, one clearance apart. |
| `detent` | A bump on each straight side of the box's upper shell stands clearance + 0.19 mm proud, so it reaches 0.19 mm past the lid's wall. It clicks into a groove in the lid, 9 mm above the lid rim, that clears it by the clearance. The flanks are about 45°, printable without support. |
| `clip` | Each straight side of the lid gets a 7.9 mm wide tongue. It is cut free by two 0.6 mm slits from the rim to 13 mm and thinned to the plain 1 mm wall, with the honeycomb removed there. A 0.6 mm nib at its free end snaps into a pocket in the box that clears the nib by the clearance on every side. |
| `magnet` | A pocket for a round magnet on each side, sized for the magnet chosen in `magnet` (see [Magnets](#magnets)): in the box wall, backed by a boss inside the bay, and in the lid, backed by a flat boss that fills the honeycomb outside. The pockets do not depend on the clearance. |
| `crush-ribs` | Three vertical 0.5 mm ribs on each straight side of the box's upper shell, clearance + 0.16 mm proud. The lid squeezes them by 0.16 mm. The top ends are ramped. |

### Magnets

In `magnet` mode the `magnet` setting chooses the magnets: real products from the parts library ([adding-parts.md](adding-parts.md)),
linked to their library page from the editor. The chosen magnet's greatest size (its nominal size plus its stated tolerance) reaches
both SCAD files as `MAGNET_D` and `MAGNET_T` (`partDefines`; the defaults are S-06-02-N's). Each pocket is `MAGNET_PLAY` (0.1 mm)
wider than that and exactly as deep, so the magnet sits flush with the wall face; the bosses grow with the pocket. The four magnets
are shown in the assembly preview, in their pockets, and the collision check includes them.

A magnet is offered when it fits (`magnetFits` in `packages/contracts/src/models.ts`; a test keeps the list equal to the library's
fitting magnets):

- **Round:** a disc, since the pockets are round.
- **No higher than 2.1 mm:** the depth of the original 6 x 2 mm pocket. The box's boss ends at `BOSS_IN_Y` (10.9 mm), which leaves
  0.19 mm behind such a pocket at the largest clearance; a deeper pocket would need a larger boss in the bay.
- **No wider than the wall allows:** the pocket and the lid's boss around it (0.4 mm each side) must fit on the 10.5 mm straight
  stretch of the side wall (`SNAP_X0` to `SNAP_X1`).

| Magnet | Size (±0.1 mm) | Grade | Pull force | Pocket |
|---|---|---|---|---|
| supermagnete S-04-02-N | Ø 4 × 2 mm | N45 | approx. 420 g | 4.2 × 2.1 mm |
| supermagnete S-05-01-N | Ø 5 × 1 mm | N45 | approx. 320 g | 5.2 × 1.1 mm |
| supermagnete S-05-02-N52N | Ø 5 × 2 mm | N52 | approx. 680 g | 5.2 × 2.1 mm |
| supermagnete S-06-01-N | Ø 6 × 1 mm | N45 | approx. 400 g | 6.2 × 1.1 mm |
| supermagnete S-06-02-N (default) | Ø 6 × 2 mm | N45 | approx. 740 g | 6.2 × 2.1 mm, the original pocket |
| supermagnete S-08-01-N | Ø 8 × 1 mm | N45 | approx. 540 g | 8.2 × 1.1 mm |
| supermagnete S-08-02-N | Ø 8 × 2 mm | N45 | approx. 1.1 kg | 8.2 × 2.1 mm |

The 3 mm discs are too high, the 10 and 12 mm discs too wide, and the blocks and the ring are not round. Glue the magnets in, and
mind their poles: each magnet in the box must attract the one facing it in the lid.

## Mini box lid (`miniLidSnap`)

The mini lid's end pads sit in the mini box's rim notches, one clearance all round, in every mode. They locate the lid but do not
latch it.

| Value | What is added |
|---|---|
| `friction` ("Clearance fit", default) | Nothing: the original pads and notches. |
| `detent` | A bump on each straight side wall of the mini lid, 2.2 mm below its cap, stands clearance + 0.12 mm proud (`ML_DETENT_ENGAGE`). It clicks into a groove on the inside of the mini box's side wall, just under the rim. The lid's bump rides over the box's free rim for only about 2 mm, and the rim gives way outwards. |
| `crush-ribs` | Three ribs on each straight side of the mini lid, clearance + 0.1 mm proud. The box's wall squeezes them by 0.1 mm. |

The detent sits on the side walls and not on the pads, for two reasons:
- The rim notches are widest at the rim, so nothing on a pad can hook under them.
- A bump on a pad's flank would have to spread the notch's posts sideways, in the plane of the end wall, which is far too stiff.

## Holder in the box (`holderSnap`)

The holder is pushed up into the round bay through the box's open floor. The tab in the bay (z 32.3 to 34.9) is only its upper
stop. What `holderSnap` adds keeps the holder from dropping out of the floor when the case is turned over. It is also sized so that
a lighter turned upside down and pushed down from above, its hood and wheel beside the tab, pushes it out again (upright, the
lighter rests on the tab and cannot reach the holder). Both features sit near the holder's
floor, its trailing end, so they rub only over the last few millimetres of the push. There is nothing on the 0.79 mm wall between
the round bay and the next bay (+X).

| Value | What is added |
|---|---|
| `friction` (default) | Nothing. Only the fit holds the holder, so it is recommended only up to 0.20 mm clearance. |
| `detent` | A 3.5 mm wide bump on each end of the holder (the bay's ±Y ends), centred 5 mm above the underside. It reaches 0.15 mm past the bay wall (`HOLDER_DETENT_ENGAGE`), less than the case lid's detent. Both flanks are 30° from the wall (`HOLDER_DETENT_FLANK`), so the holder goes in and out without a hard stop. The holder's +X half is its window, so the holder is a C shape and gives way along Y. The groove in the bay wall clears the bump by the clearance on every side, and at least 1.35 mm of the 2.1 mm wall remains even at 0.6 mm clearance. |
| `crush-ribs` | Four vertical 0.6 mm ribs on the holder's skin at 60°, 120°, 240° and 300° about the bay centre, from 0.5 to 7 mm. Their tops are ramped, since the top of the holder enters first. They stand clearance + 0.1 mm proud and are squeezed by 0.1 mm. The layout is symmetric in X and Y, so the holder stays centred. Nothing is cut into the box. |

The bumps and ribs follow the curved bay wall: each is the hull of thin bands of the bay outline, offset by the right amount at
each height. A few-micrometre offset (`HOLDER_JITTER`) keeps the hull's edges off the bay's own vertical edges, which would
otherwise leave zero-area triangles.

A latch at the tab was considered and left out. The tab is on −Y only, so a catch there would be one-sided and lose its engagement
to the holder's sideways play. The holder also has about 1.6 mm of vertical play below the tab. The tab stays the upper stop.

## Lighter in the box (`lighterSnap`)

A BIC Mini lighter (J25) goes into the round bay from the top and rests on the clip tab, above the holder (see
[cigarette-case-assembly.md](cigarette-case-assembly.md#reference-objects)). It is a third-party object and cannot be changed,
so everything is in the case box (the `lighter bay` block of the box file).

**The fitted bay.** Up to the tab's top (`TAB_TOP`, z 35.11) the bay stays the traced `BAY_ROUND`: the holder's part and the tab
are unchanged. Above it the bay is the lighter's plan pushed out by the clearance (`lighter_bay_2d`): the same superellipse as
`plan()` in `parts/everyday-objects/bic-j25-mini-lighter.scad`, copied as `LIGHTER_THICKNESS`, `LIGHTER_WIDTH` and `LIGHTER_PROFILE_N` (a test keeps them
equal), centred like the lighter. Before, the lighter stood 0.31 to 0.41 mm from the traced wall; now the gap is the clearance
all round. A 0.4 mm tall loft (`LIGHTER_LEAD`) joins the two outlines, at 52° or steeper. It centres a lighter coming back up,
and funnels one going down into the narrower `BAY_ROUND` at large clearances. The gap is `LIGHTER_GAP`, which is always
`CLEARANCE`. Only `VERIFICATION.md` sets it to 0.36 mm, the traced bay's own gap, to compare the box with its source STL.

**Minimum wall.** At the bay's −X end, the upper shell's outside (the lid's cavity pulled in by the clearance) is only 1.33 mm
from the lighter's plan, so a bay fitted at clearance c leaves a wall of 1.33 − 2c there: 0.93 mm at 0.2 mm, but 0.13 mm at
0.6 mm. The bay therefore keeps at least `LIGHTER_WALL` (0.4 mm, one nozzle line) of wall to that outline. Up to 0.46 mm
clearance this changes nothing. Above that, the gap at that end only is 0.93 − c: 0.33 mm at 0.6, still more than the traced
bay's 0.31. The wall to the next bay (+X) is 1.12 − c (0.52 mm at 0.6), so it needs no limit.

| Value | What is added |
|---|---|
| `friction` (default) | Nothing: the fitted bay, one clearance from the lighter. The closed case lid traps the lighter (its top is 1.1 mm under the lid's ceiling), so the fit only has to hold it while the lid is off. |
| `crush-ribs` | Four vertical 0.6 mm ribs on the bay wall, on the lighter's flat faces (±X, at y = ±3.5 mm about the bay centre), from z 37 to 45. That is just above the rest height (35.12) and clear of the lighter's rounded base, so it rubs over them only for the last 8 to 10 mm. Both ends are ramped over 1.5 mm, since an upside-down lighter that pushes the holder out passes them both ways. They stand clearance + `LIGHTER_CRUSH_SQUEEZE` proud of the wall, so the lighter squeezes them by 0.1 mm. The layout is symmetric in X and Y, so the lighter stays centred. |

The ribs are built like the holder's: hulls of thin bands of the lighter's plan, offset by the right amount at each height,
from their root inside the wall to their face. `LIGHTER_JITTER` keeps the hull's edges off the plan's vertices.

**The push-out still works.** The whole lighter, including the hood, wheel and lever, stays inside its plan, so the fitted bay
passes it upside down as freely as upright. The ribs grip only the body's and the hood's flat faces. The tab, its chord and the
lower bay are unchanged. See [cigarette-case-assembly.md](cigarette-case-assembly.md#upside-down-the-push-out) for the
figures, measured again in both modes.

## Mini box in the lid (`miniBoxSnap`)

The closed mini box slides up into the case lid upside down, until its floor meets the ceiling. It has to stay there when the lid is lifted off
(issue #8), and it is pulled out with a finger. The features sit on the lid's cavity wall near the ceiling, on both straight
sides (lid x 0.5 to 9, where the cavity and the mini box are both straight). Nothing is added below lid z 23, clear of the case lid
detent's groove, the clip tongues and the magnet bosses.

| Value | What is added |
|---|---|
| `friction` (default) | Nothing. Only the fit holds the mini box, so it is recommended only up to 0.20 mm clearance. |
| `detent` | A bump on each side of the cavity at lid z 30.5, halfway up the seated mini box, so it rubs over 7 mm. It reaches 0.15 mm past the mini box's face (`MB_DETENT_ENGAGE`), no more than the smallest clearance recommended for it. The mini box's wall can therefore give way into its own gap to the mini lid inside it. The groove in the mini box's side walls clears the bump by the clearance, and at least 0.45 mm of the 1 mm wall remains at 0.4 mm clearance. |
| `crush-ribs` | Three ribs on each side of the cavity (lid x 1, 4.75 and 8.5), from lid z 26 to the ceiling, with the lower end ramped. They stand clearance + 0.1 mm proud and are squeezed by 0.1 mm by the mini box's upper 11 mm. |

The mini box's two grooves stay apart: the outer one is at mini box z 7.35 (from `miniBoxSnap`) and the inner one is just under the rim
(from `miniLidSnap`). The 1 mm wall is never thinned from both sides at the same height.

## Clearance

Every SCAD file has `CLEARANCE`, the gap per side between mating surfaces, 0.2 mm by default (a snug fit). It is the
`clearance` parameter in the editor's advanced settings: 0.10 to 0.60 mm in 0.01 mm steps, reaching every part except
the text part. The editor names the fit as the value changes (the bands of issue #7): very tight 0.10–0.15, snug
0.15–0.25, sliding 0.25–0.40, easy sliding 0.40–0.60.

Each joint's current mode has a recommended range (`SNAP_CLEARANCE`, `MINI_LID_SNAP_CLEARANCE`, `HOLDER_SNAP_CLEARANCE`,
`LIGHTER_SNAP_CLEARANCE` and `MINI_BOX_SNAP_CLEARANCE` in `packages/contracts/src/models.ts`). The control's `recommended` lists the
five settings. The editor highlights the range that suits all five current values, and lists the settings whose own range the value is outside of. For
example, at 0.30 mm with the defaults it shows "Holder in the box (Friction fit): 0.10–0.20 mm". If no single value suits them
all, nothing is highlighted and every range is listed.

| Joint | friction | detent | clip | magnet | crush ribs |
|---|---|---|---|---|---|
| Case lid | 0.10–0.60 | 0.20–0.40 | 0.20–0.40 | 0.10–0.60 | 0.20–0.40 |
| Mini box lid | 0.10–0.25 | 0.20–0.40 | – | – | 0.20–0.40 |
| Holder in the box | 0.10–0.20 | 0.20–0.40 | – | – | 0.20–0.40 |
| Lighter in the box | 0.10–0.25 | – | – | – | 0.20–0.40 |
| Mini box in the lid | 0.10–0.20 | 0.20–0.40 | – | – | 0.20–0.40 |

Why these ranges:
- **Friction:** on the case lid, the walls themselves hold, so pick the fit you want. The holder and the mini box in the lid are held
  against their own weight by nothing but the fit, so they get no more than a snug fit. The mini lid is trapped in the case lid
  once it is in, and the lighter under the closed case lid, so they get a little more.
- **Magnet:** as friction. The magnets hold, and their pockets are sized from the magnet, not from the clearance (6.2 x 2.1 mm for
  the default 6 x 2 mm magnets).
- **Clip:** the nib stands 0.6 mm into the lid cavity, so it reaches 0.6 mm − clearance into the box's pocket: 0.4 mm at 0.2, only
  0.2 mm at 0.4, and nothing at 0.6. Below 0.2 the tongue has to flex further than it is designed to.
- **Detent:** the bump always reaches its engagement past the mating wall, so a wall must flex. The walls should clear each other so
  that only the bump touches, and above 0.4 mm the groove leaves little of a 1 mm wall.
- **Crush ribs:** the ribs always squeeze by the same amount. The walls should clear each other so that only the ribs touch, and
  above 0.4 mm the ribs grow tall and thin.

Values outside the range stay valid; the editor only says so. The source STLs had a different gap at each joint, which the assembly
slider made visible (issue #7). Each fitted part is now derived from the surface it fits into, so the gap is exactly the clearance
all round:

| Joint | Female (reference) | Male (derived) | Source STL gap |
|---|---|---|---|
| Case lid on case box | lid cavity (`CAVITY`) | box upper shell: the cavity pulled in by the clearance | 0.15 to 0.31 mm (sides 0.16, ends 0.27) |
| Mini box in case lid | lid cavity | mini box: its measured outline, which stood 0.031 mm inside the cavity, offset to stand the clearance inside | 0.02 to 0.04 mm |
| Mini lid in mini box | mini box (plan, swept end, rim notches) | mini lid: plan and swept end pulled in by wall + clearance, pads the notches less the clearance | 0.2 mm plan, pads 0.15 to 0.25 mm, swept end colliding |
| Mini holder in case box | round bay (`BAY_ROUND`) | holder's outer skin: the bay pulled in by the clearance (its cavity is as measured) | 0.45 to 0.5 mm |
| Lighter in case box | the lighter's plan (reference object, not printed) | the round bay above the tab: the plan pushed out by the clearance, keeping 0.4 mm of shell wall (see [Lighter in the box](#lighter-in-the-box-lightersnap)) | 0.31 to 0.41 mm |

The lid cavity, the round bay below the tab and the lighter do not change with the clearance, so the assembly poses hold for every
value. This was checked by
slicing the rendered, assembled parts at several heights: the gap on each joint is the clearance to within 0.01 mm at 0.1, 0.2 and
0.6 mm (the mini box's rounded end is a little further from the cavity than its sides and chamfer). The lighter's gap was measured
the same way, from slices of the box at z 36, 40, 50, 65 and 75 against the lighter's plan: exactly the clearance all round at
0.1, 0.2 and 0.46 mm; at 0.6 mm, 0.6 except 0.333 at the −X end (the minimum wall, above).

## Engagement and squeeze (advanced settings)

Each joint's detent engagement and crush-rib squeeze is its own advanced setting: `SNAP_TUNING` in
`packages/contracts/src/models.ts`, nine in all. Each one appears only while its joint uses that mechanism
(`Control.visibleWhen`). Its slider runs from 0.02 to 0.40 mm in 0.01 mm steps, marks the default, and highlights the recommended
range (a one-entry `Control.recommended`, keyed on the joint's mode). The value reaches every part that carries the feature or its
groove.

| Setting | SCAD variable (parts) | Default | Recommended |
|---|---|---|---|
| `snapDetentEngage` | `DETENT_ENGAGE` (case box, case lid) | 0.19 | 0.12–0.25 |
| `snapCrushSqueeze` | `CRUSH_SQUEEZE` (case box) | 0.16 | 0.08–0.20 |
| `miniLidDetentEngage` | `ML_DETENT_ENGAGE` (mini box, mini lid) | 0.12 | 0.08–0.18 |
| `miniLidCrushSqueeze` | `CRUSH_SQUEEZE` (mini lid) | 0.10 | 0.06–0.15 |
| `holderDetentEngage` | `HOLDER_DETENT_ENGAGE` (case box, holder) | 0.15 | 0.10–0.20 |
| `holderCrushSqueeze` | `HOLDER_CRUSH_SQUEEZE` (holder) | 0.10 | 0.06–0.15 |
| `lighterCrushSqueeze` | `LIGHTER_CRUSH_SQUEEZE` (case box) | 0.10 | 0.06–0.15 |
| `miniBoxDetentEngage` | `MB_DETENT_ENGAGE` (case lid, mini box) | 0.15 | 0.10–0.20 |
| `miniBoxCrushSqueeze` | `MB_CRUSH_SQUEEZE` (case lid) | 0.10 | 0.06–0.15 |

The recommended ranges keep each mechanism close to the value it was designed and checked at:
- Less than the lower end hardly holds.
- More than the upper end makes the part hard to close, or to push or pull out: the holder is pushed out with a lighter, and the
  mini box in the lid is pulled out with a finger. The lighter must slide past its ribs to rest on the tab, and again, upside down,
  to push the holder out. The mini box's detent should also stay at or below the clearance, so its wall can
  give way into its gap to the mini lid.

A detent's groove is engagement + clearance deep. In the 1 mm walls the grooves are cut into (the case lid's wall, and the mini
box's for its two joints), at least 0.2 mm must remain. The contract therefore refuses engagement + clearance above 0.80 mm, but
only while that detent is in use (`GROOVE_WALL`). The holder's groove is in the 2.1 mm bay wall, so it has no such limit. Every
engagement and squeeze was rendered at 0.02 to 0.40 mm against clearances of 0.1 to 0.6 mm, within that limit, and inspected like
the worker does: every part is one clean closed body.

## Where the features are

**Case lid:** all features sit on the two straight side walls: `y = +/-13.59` on the shell at 0.2 mm clearance, `+/-13.79` in the
lid cavity, for `x` between -1 and 9.5, where both outlines are straight. Heights are measured from the lid's rim when the case is
closed (box `z = 60.38`), so the box and lid files use the same numbers: `DETENT_Z`, `CRUSH_Z0/Z1`, `CLIP_*`, `MAGNET_*`.

**Smaller joints:** the constants are in each joint's shared block, `HOLDER_*`, `MB_*` and `ML_*`, in the frames described there.
The lighter's are `LIGHTER_*` in the box file's `lighter bay` block, in the bay's own frame (centred at x = −16.84).

Tune them in the SCAD constants; nothing else needs to change.

## How it was checked

- **One closed body per part.** Every part renders in every mode of every joint as one closed manifold body with the expected
  bounding box (`tools/test-renderer.ts`). This includes every joint in `detent`, and every joint in `crush-ribs`, at 0.1, 0.4 and
  0.6 mm. The mini lid's width grows by its ribs or bumps, and the holder's by its bumps. The three new modes were also rendered
  from 0.10 to 0.60 mm in 0.05 mm steps and inspected like the worker does: no degenerate or open meshes. The lighter's ribs are
  rendered on their own at 0.1, 0.2, 0.46 and 0.6 mm, and with every other joint in `crush-ribs`; they are inside the bay, so the
  box's bounding box does not change. The lighter itself is never in the ZIP.
- **Designed interference only.** `npm run check:assembly -- --parameters '{"<setting>":"<mode>"}'` (see
  [cigarette-case-assembly.md](cigarette-case-assembly.md)) shows no shared volume anywhere for `friction`, and for the case lid's
  `magnet`. A detent shares volume only while its joint closes, as the bump passes the mating wall before it drops into its groove.
  Crush ribs share volume also when closed: the designed interference.
- **Constant squeeze.** Measured exactly as the CSG intersection of the rendered, assembled parts, the crush-rib interference stays
  the same from 0.2 to 0.4 mm clearance:
  - holder: 1.53 mm³;
  - mini box in lid: 3.08 to 3.06 mm³;
  - mini lid: 3.13 to 3.10 mm³;
  - lighter in the box: 1.30 to 1.27 mm³ (0.2, 0.3 and 0.4 mm).

  The case lid (from issue #10) was measured on a 0.2 mm grid: 6.0 mm³ box/lid and 5.7 mm³ for the mini pair. The collision check's
  vertical-ray grid (0.25 mm) samples thin side-facing ribs unevenly, so its figures for them vary with the clearance.
- **Seated detents are clear.** Each new detent shares no volume when seated, at 0.1 to 0.6 mm.
- **Reconstructions.** `VERIFICATION.md` measures the reconstructions against the source STLs at the source's own clearance, with
  every setting at `friction`.

## Limits

Printed tolerances differ by machine. The clearance is the first thing to adjust. Then adjust each joint's engagement and
squeeze in the advanced settings (above), and, in the SCAD constants, `CLIP_NIB` and the magnets' pocket play (`MAGNET_PLAY`).

The clip tongue is 1 mm thick and 13 mm long, so it will fatigue if opened many times. The magnet bosses reduce the box bay width by
about 1.8 mm locally, over the pocket's width plus 0.4 mm. All features were checked geometrically, not by printing. How hard a lighter has to push the holder out, and a
finger has to pull the mini box, depends on the printer and filament: lower the engagement if it is too firm.
