# Printed screen hook

`printed-screen-hook` hangs a screen frame on a tilt-and-turn window without drilling, as insect screens hang: a leg screwed to
the frame's back, a turn into the window just inside the fixed frame's outer lip, and a barb that reaches behind the lip, in the
seal gap in front of the closed sash, so the sash still closes over it. It is an original design (CC BY 4.0, see
[models/printed-screen-hook/ATTRIBUTION.md](../models/printed-screen-hook/ATTRIBUTION.md)): it does the job of a bought hook
such as Windhager's 03651 set, but it is a printed section generated for one window, not a copy of a bent strip. One parametric
file, `models/printed-screen-hook/generator.scad`, makes both parts; the model downloads as a ZIP of the **long hook** (for the
head) and the **short hook** (for the sill). Print two of each.

The window catio uses it by default, to hang the [window insert](concepts/catio/window-insert.md) on the window frame (see
[In the catio](#in-the-catio)).

## Made for the window

A bought hook is a strip bent with pliers to the window's lip, by eye against a gauge (Windhager: at the lip's thickness plus
3 mm). This one is generated for the window as measured, so it fits as it comes off the printer:

- **Frame lip thickness** (X): open the window and measure the fixed frame's outermost leg, from its outer face to the seal on its
  back.
- **Seal gap** (g): from the lip's back to the closed sash's face, where the outer seal is.

The barb stands in the middle of the seal gap: its lip-side face lies X + (g − barb) / 2 from the leg's face on the stile. On a
VEKA Softline 82 MD (X = 15.5 mm, g = 3.5 mm, the defaults) a 2 mm barb lies 16.25 mm in, 0.75 mm clear of the lip's back and of
the sash.

The window's **frame depth** does not change the hook: it reaches only to the seal gap. Its **frame width from outside** only
has to leave room above the collar to lift it while it is hung, which the window insert page checks.

## Shape

The section, extruded **Width** across, is drawn in X (from the leg's face on the stile into the window) and Y (along the
stile, from the turn's outer face, the face towards the lip's tip):

- the **leg**, **Leg thickness** thick and **Leg length** long from the turn's outer face, with two countersunk holes across it;
- the **turn**, **Turn thickness** thick, from the leg to the barb;
- the **barb**, **Barb thickness** thick, rising past the turn's outer face;
- a 45° fillet, up to 3 mm, in the leg's corner with the turn, on the side away from the lip.

### Long and short

The short (sill) hook's barb reaches **Reach behind the lip** (e) behind the sill lip while its turn stands **Clearance** (c) off
the lip's tip: it rises e + c past the turn. To hang the frame it is lifted by that much, so the long (head) hooks' turns stand
c more below the head lip's tip, and once let down their barbs must still reach e behind it: the long barb rises
2 × (e + c). With the defaults (6 mm and 1 mm) that is 7 mm and 14 mm, close to Windhager's 7 and 15 mm tips. The editor says
where to screw them and how far to lift the frame: the long hooks' turns 8 mm below the head lip's tip, the short ones 1 mm above
the sill lip's tip, a 7 mm lift (`printedScreenHookShape` in `packages/contracts/src/printedScreenHook.ts`).

## Screws and holes

Two holes through the leg, countersunk on its inner face: the screws go in from the room side into the stile. They are sized
from a **DIN 7997 countersunk wood screw** chosen from the parts library, with the same clearance allowances (0.3 / 0.5 / 0.8 mm
over its diameter, **Hole fit**) and countersink as the [printed corner bracket](printed-corner-bracket.md). The first hole sits
past the fillet, the second near the leg's end.

## Parameters

| Parameter | Default | Range | What it does |
| --- | --- | --- | --- |
| Frame lip thickness | 15.5 mm | 5–35 mm | The window's lip, above |
| Seal gap | 3.5 mm | 1–10 mm | The window's seal gap, above |
| Reach behind the lip | 6 mm | 3–15 mm | How far both barbs reach behind the lip once hung |
| Width | 10 mm | 8–20 mm | Of the strip |
| Wood screw diameter, Wood screw | 3 mm, DIN 7997 3 × 20 | every DIN 7997 screw in the library | Through the leg into the stile |
| Leg length (advanced) | 40 mm | 25–80 mm | From the turn's outer face to the leg's end |
| Leg thickness (advanced) | 4 mm | 2.5–8 mm | Takes the countersunk heads |
| Turn thickness (advanced) | 4 mm | 2.5–8 mm | Of the turn into the window |
| Barb thickness (advanced) | 2 mm | 1.2–4 mm | Of the barb in the seal gap |
| Clearance (advanced) | 1 mm | 0.5–3 mm | The short hooks' turns off the sill lip; the long ones' off the head lip while lifted |
| Hole fit (advanced) | Medium | Fine, medium, coarse | Play over the screw's diameter |

## Checks

The editor refuses, before anything is rendered:

- a barb that leaves less than 0.5 mm each side in the seal gap: the sash would not close. It names the thinnest barb that
  prints (1.2 mm), and the bought hooks, whose strip is 0.8 mm. The default 2 mm barb needs a 3 mm gap.
- a leg too thick to stand clear of the closed sash, or too thick for the turn to reach on to the barb;
- a leg too short for two screws, and screws that do not seat (as the corner bracket's).

Every other combination renders as two closed solids (`npm run test:renderer`, and the geometry sweep).

## Load

The hook's holding force is **not rated**: it has not been printed and tested. In the catio it does not need one. The window
insert's feet carry its weight, as they do with bought hooks, and the hooks only keep it from tipping out. A figure for the
printed hook would be no reason to leave out the feet or make them smaller.

## In the catio

**Screen hooks → Printed screen hooks (model)** is the [window insert](concepts/catio/window-insert.md)'s default when it hangs
on the window frame: two long hooks at the head of the stiles and two short ones at the sill, with two DIN 7997 3 × 20 screws
each. The insert page sets the model to its window's lip and seal gap, places the hooks where the model makes them, and its
parts list links each hook's line to this model with the lip and seal gap to enter. Windhager 03651's bought, bent hooks remain
selectable, and are the choice for a seal gap under 3 mm. This model's editor lists the window insert under “Used by”.

## Printing

Print in PETG as generated, lying on its side, no supports: the layers then run along the barb and the turn, which bend, and the
holes run across them.

## Assembly preview

The preview stands the long hook at the head of a stile, barb up, and the short one at the sill, barb down, then drives the
library screws into their legs from the room side (`printedScreenHookAssembly`, `printedScreenHookScrews`). `npm run
check:assembly -- printed-screen-hook` renders both hooks and the screws and checks that no screw meets a hook.
