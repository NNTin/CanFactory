# Cat collar tag

`cat-collar-tag` is a name tag for a cat's collar (issue #63). It carries your own text or SVG logo on each face, an optional NFC tag
that a phone reads, and optional magnets to stick it to a fridge or a board. You choose how it goes on the collar (`attachment`). It
is an original design (CC BY 4.0, see [models/cat-collar-tag/ATTRIBUTION.md](../models/cat-collar-tag/ATTRIBUTION.md)). One file,
`models/cat-collar-tag/generator.scad`, makes the printed parts: the **tag**, printed back down, and for the clip-on and sleeve
attachments a **clip** or **sleeve** round the strap, printed standing on an end. Neither needs supports; PETG suits the clip and
the sleeve, which flex onto the strap.

The split ring, the collar, the NFC tag and the magnets are products from the [parts library](adding-parts.md): their real sizes size
the bail's hole, the slots, the pockets and the cavities, and they show in the assembly preview and on the hardware list.
`packages/contracts/src/catCollarTag.ts` repeats the generator's layout, so the contract checks every setting before a render.

## One model, one tag face

The issue asks for four ways to attach a tag (A–D). They are one model with an `attachment` setting, not four models, because:

- **The tag face is most of the model.** Its size, shape, thickness, text, logo, NFC tag, magnets and print pause are the same for
  every attachment.
- **A SCAD file cannot share code with another.** Every generator in this repository is self-contained, so four models would need
  four copies of the face, kept equal by a test. The cigarette case already keeps two copies of its text block this way.
- **The issue's acceptance criterion is "select an attachment mechanism"**: an enum, as the litter shovel's `handleShape`, with each
  attachment's own settings shown only while it is chosen (`visibleWhen`).

The window catio's printed hardware is separate models, because each of those is a part on its own (a bracket, a screen hook) that is
useful without the others. A collar clip without its tag face is not.

| `attachment` | Issue | How it goes on |
|---|---|---|
| `hanging` | A | A bail at the top, round a hole for a split ring, which hangs it from the collar's D-ring or O-ring. |
| `slide-on` | B | A slot near each end. The strap runs in front of the end bars and behind the middle, through both. |
| `clip` | C | A clip that snaps onto the strap from the outside; the tag hangs from a tab under it on the split ring. |
| `sleeve` | D | A sleeve round the strap, closed or wrapping round it; the tag hangs from a tab under it on the split ring. |

The tag face is the same for all four. A hanging, clip-on or sleeve tag has the bail; a slide-on tag has the slots.

## Parameters

| Key | Default | Range | Meaning |
|---|---|---|---|
| `attachment` | `hanging` | `hanging` `slide-on` | How the tag goes on the collar. |
| `shape` | `round` | `round` `rounded-rectangle` `bone` `heart` `fish` | The outline. |
| `width`, `height` | 30, 22 mm | 15–60, 10–45 | Without the bail; a round tag is as high as it is wide, a bone at least 1.4 times as wide as high. |
| `thickness` | 2.4 mm | 1–6 | Without an embossed mark. Embedded or pocketed hardware needs a minimum (see below). |
| `edgeRadius` | 0.6 mm | 0–2 | The front and back edges' rounding, at most half the thickness. |
| `frontMark`, `backMark` | `text` | `none` `text` `logo` | What each face carries. |
| `frontLine1`, `frontLine2`, `backLine1`, `backLine2` | "Luna", "", "If found:", "555 0100" | 16 printable ASCII characters | Each face's lines: two, or one if the other is blank. |
| `frontFont`, `backFont` | `sans` | `sans` `serif` `mono` `wide` | The bundled bold fonts, as the cigarette case's. |
| `frontTextSize`, `backTextSize` | 5.5, 3 mm | 2.5–12 | Letter height (a capital's). |
| `frontLogo`, `backLogo` | none | an SVG file | Each face's logo, read in the browser into a logo string (`svgLogo.ts`), as the cigarette case's and the QR tag's. |
| `frontLogoSize`, `backLogoSize` | 10 mm | 3–30 | The logo's height, less for a logo that would be wider than the free area. |
| `frontStyle` | `engrave` | `engrave` `emboss` | The front's mark carved in, or raised (in another colour with a filament change). The back lies on the bed, so its mark is always engraved, mirrored. |
| `nfc` | `none` | `none` `pocket` `embedded` | An NFC tag in an open pocket in the back (stuck in with its own adhesive), or sealed in at a print pause. |
| `nfcTag` | GoToTags NTAG213, Ø18 × 0.2 mm | the library's NFC tags | |
| `magnetMount` | `none` | `none` `pocket` `embedded` | Disc magnets, to stick the tag to steel: in open pockets in the back, or sealed in at a print pause. |
| `magnet`, `magnetCount` | supermagnete S-06-01-N (6 × 1 mm), 1 | the library's discs up to 10 × 2 mm; 1 or 2 | |
| `splitRing` | Avco ½″ stainless (keyring.com KR-9335-001) | the library's split rings | Hanging: the ring the hole is sized for. |
| `dRingWire`, `bailWall` | 2, 2 mm | 1–4, 1.2–4 | Hanging: the collar's D-ring wire (no maker publishes it: measure yours), and the wall round the hole. |
| `collar` | TRIXIE 4180 (10 mm) | the library's cat collars | Slide-on: the strap the slots are cut for. |
| `slotFit`, `barWidth` | 0.3, 3 mm | 0–1, 2–8 | Slide-on: the slots' play over the strap's thickness, and the bars outside them. |
| `sleeveStyle` | `closed` | `closed` `wrap` | Sleeve: a closed loop, or one that wraps round the strap and clicks shut. |
| `carrierLength`, `carrierWall`, `carrierFit` | 8, 1.6, 0.2 mm | 5–20, 1.2–3, 0–0.8 | Clip and sleeve: the length along the strap, the wall, and the play round the strap per side (advice: 0.05–0.25 for a clip, 0.2–0.5 for a sleeve). |
| `lipDepth` | 1.2 mm | 0.6–4 | How far a clip's lips reach over the strap's edges; a wrap sleeve's flaps overlap by as much, plus the click. |
| `engraveDepth`, `embossHeight` | 0.6, 0.6 mm | 0.3–1.2, 0.4–1.5 | |
| `layerHeight` | 0.2 mm | 0.08–0.32 | Puts the print pause and the filament change on a layer boundary. |

## The tag face

**Outlines.** Each shape has a *free area* (`shapeGeometry`): a rectangle inside the outline that holds the text, the logo and
the hardware. A test samples it against the outline (`insideShape`) at several sizes.

| Shape | Outline | Free area |
|---|---|---|
| Round | a disc of the width | its inscribed square |
| Rounded rectangle | corners rounded by a quarter of the shorter side | to the corners' arcs at 45° |
| Bone | a bar 0.6 H high between four lobes of radius H/4 | the bar between the lobes' centres |
| Heart | a square turned 45° with a half-circle on each upper side, scaled to W × H | 0.53 W × 0.32 H, round its middle |
| Fish | an oval body (0.72 W × H) and a triangular tail | the body's inscribed rectangle |

Every corner of the outline, outer and inner, is rounded to 1 mm, and the front and back edges to `edgeRadius`: the edge is built
of steps of at most 0.1 mm, each inset by a multiple of 0.02 mm and reaching 0.01 mm into the next. The 0.02 mm grid keeps
neighbouring steps from making float32 slivers, and the overlap makes the steps fuse instead of touching (both failed the mesh
check before).

**Text.** Each line is measured with the bundled fonts' advance widths (`lineWidth`, as the cigarette case's `textWidth`). The
lines are set one `1.35 × size` below the other, the block centred in the free area. The contract refuses text wider or higher
than the free area less 0.5 mm, and the SCAD file also clips the mark to it. The back's mark is mirrored, so that it reads when the
tag is turned over. An embossed front stands `embossHeight` above the face: change filament at the face's top (the editor names the
layer) to print it in another colour.

## NFC tag and magnets

The NFC tag goes in the middle of the free area. With no NFC tag, one magnet goes in the middle, and two go at the ends of the free
area. Next to an NFC tag, the magnets go at the ends, and must stay **5 mm outside its antenna** (`nfcGap`), or outside its edge
for a coin whose antenna size isn't published. NdFeB and its nickel plating conduct, and metal near a 13.56 MHz antenna detunes it
and shortens the read range (NXP's AN11564 recommends ferrite against it). The gap is a design rule to confirm with a phone, so the
editor asks you to try the NFC tag once it is printed. Every pocket and cavity is the item's greatest diameter plus 0.2 mm.

**Pockets** open on the back, as deep as the item is thick: the magnets sit flush to touch the steel; the NFC tag sticks in with
its own adhesive. A marked back would be cut through, so pockets need a blank back.

**Embedded** items lie in sealed cavities, dropped in when the print pauses. This is the QR tag's mechanism, now shared as
`embedCavity` in `packages/contracts/src/printPause.ts`. The cavity's floor is a skin of at least 0.4 mm over the back (plus the
back's engraving), in whole layers. Its top, the pause height, is the skin plus the item's greatest height plus 0.05 mm, rounded up
to a layer boundary. The editor names the height and the layer to pause before. The STL encloses the cavities as inward-facing
shells (`sealedVoids`). **Only one of the NFC tag and the magnets can be embedded**: one print pause per tag. The other may still
be in a pocket.

### The thickness rule

The contract works out the least thickness (`minThickness`) and refuses a thinner tag, naming the minimum and what sets it:

- **Embedded:** pause height + 0.6 mm cover + the front's engraving.
- **Pockets:** the deepest pocket + 0.6 mm cover + the front's engraving.
- **Engravings alone:** the back's + the front's + 0.6 mm between them.
- **Edges:** twice `edgeRadius`.

At 0.2 mm layers, both faces engraved 0.6 mm deep:

| What | Least thickness | Both faces blank |
|---|---|---|
| Nothing | 1.8 mm | 1.2 mm (`edgeRadius` 0.6) |
| NFC inlay (0.2 mm), pocket | — (needs a blank back) | 0.8 mm (1.2 mm with the default 0.6 mm edges) |
| NFC inlay (0.2 mm), embedded | 2.6 mm | 1.4 mm |
| 1 mm magnet, embedded | 3.4 mm | 2.2 mm |
| 2 mm magnet, embedded | 4.4 mm | 3.2 mm |

So thin tags can carry an NFC tag but not magnets. Magnets need about 2.2 mm with 1 mm discs, and more with engraved faces. The
editor's thickness slider marks the range that suits the chosen NFC and magnet settings.

## Hanging (A)

The bail is a tab at the top of the outline (at a heart's dip, at a fish's back) round a hole for the split ring. The hole takes
the ring's band through it, both turns at once, so the ring winds through easily: its diameter is √(A² + B²) + 0.4 mm, at least
3 mm, rounded up to 0.1 mm. A and B are the ring's band width and its thickness over both turns, from the library. Its edge is
0.3 mm above the outline's top, and the bail is `bailWall` wide round it.

The contract checks that the ring goes round the bail: the ring's circle passes through the hole's centre, and the bail (its wall,
at the tag's full thickness) must lie inside the ring's opening with 0.2 mm to spare. It also checks that the opening holds the
bail and the collar's D-ring side by side: `bailWall + dRingWire + 0.5 mm`. With the default 2 mm bail wall, the ½″ stainless ring
takes tags up to 5.4 mm thick, and the 9 mm ring up to 4.3 mm.

## Slide-on (B)

Two slots, `collar thickness + slotFit` wide and `collar width + 1 mm` long, stand `barWidth` in from the ends of the free area. The
strap runs in front of the end bars, down through one slot, behind the middle and up through the other. Bending it round the
bars holds the tag in place on the collar, and it slides off when the collar's end is threaded back out. The text and the
hardware go between the slots, which must leave at least 8 mm. A collar's width is the maker's. Its thickness is estimated (no
maker publishes it), and the slot is cut for the estimate's greatest value. Raise `slotFit` if your strap is thicker.

**Keep the collar's breakaway buckle free**: the tag must never sit across it.

## Clip-on (C) and sleeve (D)

Both are a second printed part, the *carrier*: a profile round the strap, extruded along it by `carrierLength`. It prints standing
on an end, so every feature is in the profile and nothing overhangs.

- **The channel** is the collar's width and thickness plus `carrierFit` on each side, inside walls `carrierWall` thick. The
  thickness is the library's estimate, at its greatest value.
- **Rounding:** the outer corners are rounded to 0.5 mm and the ends to 0.3 mm. The cat's side is a plain wall.
- **The tab** under the channel carries the split ring the tag hangs from, as a hanging tag hangs from the D-ring. It is flush
  with the cat's side, at the end on the bed, and its hole is the same size as the bail's. It is only 2.4 mm thick: a split ring
  cannot pass through a long hole, because over 8 mm its curve leaves the hole's axis by more than a millimetre.
- **The ring checks** are those of a hanging tag. The ring must go round the tag's bail and round the tab (its wall, 2.4 mm
  thick), and its opening must hold the bail and the tab side by side (`bailWall` twice, plus 0.5 mm).

The three carriers:

- **Clip (C).** The front is open between two lips that reach `lipDepth` over the strap's edges, with 45° lead-ins.
  - **On and off:** bow the strap a little and press the clip onto it from the outside until both lips are past its edges. Pull
    it off the same way.
  - **Limits:** the lips must leave at least 3 mm between them. A tight `carrierFit` keeps the clip in place.
- **Closed sleeve (D).** A closed loop: open the collar, thread its end through, and slide the sleeve where you want it.
- **Wrap-around sleeve (D).** The front is two flaps, each on a 0.8 mm hinge next to its wall.
  - **The flaps:** the inner one comes from the bottom wall, the outer one from the top wall, 0.3 mm outside the inner one. They
    are printed 0.3 mm apart, so they never fuse.
  - **The click:** the flaps overlap by `lipDepth` plus the click, a 0.5 mm bump on the outer flap that drops into a notch
    0.15 mm larger in the inner one.
  - **On:** open both flaps, lay the strap in, close the inner flap, and press the outer one over it until it clicks. The collar
    stays on.

## Assembly preview

The tag is the base, standing as high as it must for nothing to hang below the floor. Embedded items are in their cavities from
the start. Pocketed ones are pressed or stuck in from the back as a step. The split ring stands across the bail, its band through
the hole. A slide-on tag shows the collar's strap as five pieces of the library's strap (scaled to length), touching end to end:
in front of each end bar, through each slot and behind the middle. A clip or sleeve stands on an end round a piece of the strap.
The ring hangs from its tab, through the tab's hole at the ring's top and the tag's hole at its bottom, and the tag lies under it.
`npm run check:assembly -- cat-collar-tag --parameters '…'` finds no collisions for every attachment, with embedded and pocketed
hardware.

## Checks

- `packages/contracts/src/catCollarTag.test.ts`:
  - the SCAD file's defaults and fixed sizes, and the fonts' extents, match the contract;
  - the part lists match the library;
  - each free area lies inside its outline;
  - the thickness rule and its messages, the one-embedded and pocket rules, and the NFC gap;
  - the bail and ring checks, the slots, the clip's and sleeve's layout and checks, the text fit, the notes;
  - the preview's hardware sits where the generator cuts for it.
- `npm run test:renderer` (`TEST_ONLY=cat-collar-tag`) renders 36 cases:
  - every shape hanging and slid on, and the widest collar;
  - the hardware in pockets, embedded, and side by side;
  - logos, two lines in each font, the thinnest tag, the roundest edges, and the smallest ring;
  - clips and sleeves (closed and wrap-around) on the narrowest and widest collars, at the extremes of their length, wall, fit
    and lips.

  Each part must be one closed solid of the layout's size, with a sealed cavity per embedded item. The rounded edges are built so
  that both the pinned renderer image (OpenSCAD 2026.01.19) and newer builds give clean meshes.

## Testing on a real collar

The collars' thickness and D-rings are not published. Before relying on a tag, print one and check it on the collar it is for:

- [ ] **Slide-on:** the strap goes through both slots without forcing, and the tag does not slide along by itself. Raise `slotFit`
  if it is too tight; lower it if the tag slides.
- [ ] **Clip:** it snaps on and off by hand and stays put when the collar is flexed. Adjust `carrierFit` and `lipDepth` to suit.
- [ ] **Closed sleeve:** it slides along the strap.
- [ ] **Wrap sleeve:** it closes over the strap and clicks, and opens again by hand.
- [ ] **Hanging:** the split ring winds through the bail (and the clip's or sleeve's tab) and holds the D-ring, and the tag hangs
  free.
- [ ] **NFC:** a phone reads the tag through the plastic, also next to the magnets.
- [ ] **Breakaway:** the collar's safety buckle still opens with the tag on, and nothing sits across it.
- [ ] **Safety:** no edge or point catches the skin or the fur.
