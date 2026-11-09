# Magnetic lighter keychain

An original printable holder (`magnetic-lighter-keychain`, `models/magnetic-lighter-keychain/generator.scad`,
`packages/contracts/src/magneticLighterKeychain.ts`) that puts a **BIC Mini lighter (J25)** on a keychain. The lighter sits in
a sleeve; two magnets sealed in the sleeve's foot pair with two in a small keychain plate with an eyelet for a split ring. Pull
the lighter off the keys, snap it back on. The foot's underside is **flat and unbroken**, so the holder also sticks to a fridge
on its own. CC BY 4.0 ([ATTRIBUTION.md](../models/magnetic-lighter-keychain/ATTRIBUTION.md)).

The ZIP has **four prints**, the two small fit checks first: print those, try them, adjust the settings, then print the real
parts.

| Print | What it is | PLA at the defaults |
|---|---|---|
| `lighter-fit-check` | A 10 mm ring of the sleeve, with its crush ribs and its mouth chamfer. Slide the lighter in. | ≈ 1.2 g (983 mm³) |
| `keychain-fit-check` | The magnet floor that the foot and the plate share, up to the pause height (pockets open), plus a flat sample of the eyelet. | ≈ 0.9 g (695 mm³) |
| `keychain-holder` | The plate: the foot's outline, two sealed magnets, an upright eyelet on its back. | ≈ 1.2 g |
| `lighter-holder` | The sleeve over a solid foot with two sealed magnets; flat underside. | ≈ 5.3 g (4301 mm³) |

The lighter, the magnets and the split ring are parts-library entries (`bic-j25-mini-lighter`, the `magnet` family, the
`split-ring` family). They are shown in the assembly preview and never printed.

## Parameters

| Key | Default | Range | What it does |
|---|---|---|---|
| `fit` | 0.2 mm | 0.1–0.6 | Gap per side between the lighter's plan and the sleeve's bore, in the holder **and** the lighter fit check. Also part of the outline (plan + `fit` + `wall`) that both holders and the keychain fit check share. |
| `magnet` | `supermagnete-s-08-02-n` (8 × 2 mm, N45) | the library's disc magnets up to 10 × 3 mm | The two magnets in each holder. Cavities are its **greatest** diameter + 2 × `magnetFit` across and its greatest height + 0.05 mm deep. |
| `splitRing` | `avco-kr-9335` (½″ stainless) | every split ring of the library | The ring through the eyelet. The hole is sized for its band. |
| `sleeveDepth` | 35 mm | 15–45 | How much of the lighter's 50 mm body the sleeve holds above the foot. The hood, wheel and lever stay clear, so the lighter works in the holder. |
| `layerHeight` | 0.2 mm | 0.08–0.32 | Your slicer's layer height. Puts the skin and the pause on layer boundaries. |
| `squeeze` | 0.15 mm | 0–0.4 | How far the lighter squeezes each of the four crush ribs. |
| `magnetFit` | 0.1 mm | 0.05–0.3 | Gap per side between a magnet and its cavity, in both holders and the keychain fit check. |
| `skin` | 0.4 mm | 0.4–1.2 | Least plastic between the magnets and the flat bed face, rounded up to whole layers. |
| `wall` | 1.6 mm | 1.2–3 | The sleeve's wall, and the outline's margin round the bore. |

`fit` and `magnetFit` are the two tolerances. Each is used by the real print and by the fit check that tests it, so what fits in
the check fits in the real print. The editor names the chosen parts' "Used by" in the parts library.

Validation: a magnet's cavities must stay 1.2 mm inside the outline. At a 1.2 mm wall and 0.1 mm fit the 10 mm magnets do not
fit, and the editor says so. The split ring must go round the eyelet's bridge (the cat collar tag's rule) and still have room for a
2 mm key-ring wire beside it. Every ring in the library passes.

## The lighter's fit

The bore is the lighter's plan grown by `fit` on every side. The plan is the parts library's: the generator copies `THICKNESS`,
`WIDTH`, `PROFILE_N`, `plan()` and `plan_x()` from `parts/everyday-objects/bic-j25-mini-lighter.scad` as `LIGHTER_*`, as the
cigarette case does. A test keeps the copy equal, and the library's lighter is never changed for a fit. Nothing is measured
again.

On the keys the holder hangs **mouth down**, so friction alone is not enough. Four **crush ribs** (1 mm wide, on the lighter's
flat faces at y = ±3.5 mm, as the cigarette case's) stand `fit` + `squeeze` proud of the bore. Their crests sit `squeeze` inside
the lighter's plan whatever `fit` is (10.44 mm across the 11 mm flat faces by default), so changing `fit` does not change the
grip. They start 3 mm above the foot, clear of the lighter's rounded base, and end in a 2 mm lead-in under a 0.6 mm mouth
chamfer. The lighter fit check has the same ribs and mouth, so it tests the grip as well as the bore.

## Embedded magnets (print pause)

Both holders seal their two magnets in closed cavities, as the [QR tag](qr-magnet-tag.md#embedded-magnets-print-pause) and the
cat collar tag do (`embedCavity` in `packages/contracts/src/printPause.ts`). The magnets are never exposed.

- Each print has a cavity from the **skin** over the bed face up to the **pause height**, under a 0.8 mm cap. Both holders share
  this floor exactly (same outline, cavities, skin and pause), so **one pause height serves both prints**.
- The pause height is skin + magnet's greatest height + 0.05 mm of headroom, rounded up to a layer: **2.6 mm, before layer 14**
  at 0.2 mm layers for the default 8.1 × 2.1 mm magnets (3.6 mm for 6 × 3 mm ones). The cavity's top is that layer boundary, so
  the next layer is the first to bridge over the magnets and the nozzle never meets one. The editor shows the height and layer
  under the settings. In the slicer add a pause before that layer (PrusaSlicer/OrcaSlicer: *Add pause print*; Cura: *Pause at
  height*).
- The cavities sit in a row along the lighter's width, one side wall (1.2 mm) apart: centres at y = ±(pocket/2 + 0.6), ±4.75 mm
  by default. The holder's foot and the plate have the same outline, so they line up when the plate is on the foot.
- The STLs enclose the cavities as inward-facing shells (`ModelPart.sealedVoids`). The renderer test counts **3 shells** per
  holder: one outer shell and one per cavity.

### Skin thickness: 0.4 mm

The default and least `skin` is **0.4 mm, two full layers at 0.2 mm** (it is rounded up to whole layers: 0.48 mm at 0.12 mm,
0.64 mm at 0.32 mm). This is the repository's embedding skin (`QR_TAG`/`COLLAR_TAG` `embedSkin`). Why this value:

- **Pull force.** The magnets do not touch: between a magnet in the foot and its partner in the plate are both skins, **0.8 mm
  of plastic** by default. A disc pair's pull falls off steeply with the gap, so the skin is as thin as prints reliably. The
  library's figure for the S-08-02-N is ≈ 1.1 kg (10.8 N) per magnet *at contact*. Through 0.8 mm it is noticeably less, but
  the load is small: the lighter is 13 g (BIC's figure) and the holder ≈ 5 g, about 0.18 N, which the joint takes with a wide
  margin. The keychain fit check lets you feel the real pull before committing (below). On a fridge only one skin (0.4 mm) is in
  the way.
- **A flat, closed face.** One layer over a cavity can show pin holes or sag. Two layers give a closed, flat bed face (the
  kitchen-magnet face) printed on the sheet. The cavities stay closed above the skin, so the underside is unbroken.
- Raise `skin` (up to 1.2 mm) for a stronger face at the cost of pull, e.g. with a 10 × 3 mm magnet.

### Polarity: which pole faces out

Both magnets of a print go **the same way up**, and the two prints opposite ways. The plate then attracts the foot in **either
turn** (it is symmetric). Each pair pulls itself coaxial, so the plate self-aligns flat on the foot, outline on outline.

1. Stack all four magnets into one column (they line up by themselves) and mark the **top** face of each with a pen. Every mark is
   now on the same pole.
2. **Lighter holder**: at the pause, put both magnets **marked side down** (towards the bed, i.e. facing out of the foot).
3. **Keychain holder**: at the pause, put both magnets **marked side up** (into the plate). The face on the bed then shows the
   other pole.
4. The two bed faces meet: marked pole against unmarked pole on both pairs, so they attract.

A steel print sheet pulls the magnets down flat into their cavities, which helps. Drop each in with tweezers and check that both
lie flat before resuming. The polarity is also a note under the settings.

## The keychain plate and eyelet

The plate's bed face meets the foot. The eyelet stands **upright on its back, in line with the holder**, so the lighter hangs
straight under the ring and its weight pulls the magnets straight apart (their strongest direction). A side tab would load them
in peel. The eyelet is 3 mm thick (along X), with 2 mm of plastic round its hole and 1 mm between the hole and the plate. The
hole is the cat collar tag's bail hole for the ring's band (`bailHole`: the band's diagonal + 0.4 mm, at least 3 mm; **3.7 mm**
for the default ring). It runs along X, so it prints as a **teardrop cut flat at the circle's top** without supports.

To mount: open the split ring with a fingernail or a ring opener, wind it through the eyelet, then onto your key ring.

## The fit checks

Print both first, at the settings you will use:

- **Lighter fit check**: push the lighter in from the chamfered end. It should go in with a light push and stay put when turned
  over. Too tight: raise `fit` (the bore) or lower `squeeze` (the ribs). Loose or falling out: raise `squeeze`.
- **Keychain fit check**: the shared magnet floor as it stands at the pause, so its pockets are open. Drop a magnet into each.
  It should drop in without force and lie **below the top** (otherwise raise `magnetFit`). Hold the bed face to the fridge, or to
  a magnet, to feel the pull through the skin. Print it **twice** to try the polarity steps above and the pull through two
  skins, bed face to bed face. The flat **eyelet sample** beyond its end is the eyelet's section with the same hole size: wind
  your split ring onto it.

## Assembly preview

The preview shows the keychain **as it hangs from the keys**: the lighter upside down with its hood on the floor, the lighter
holder turned over onto it, the keychain plate on the foot as printed (bed face down, eyelet up) and the split ring on top. The fit
checks lie beside it as printed. The steps:

1. *Slide the lighter into the holder, base first, past the crush ribs* (shown as the holder coming down over it).
2. *Bring the keychain holder to the foot: the magnets pull it flat against it, in line.*

The four magnets and the split ring are linked references (`lighterKeychainReferences`). The magnets are in their prints from the
start and move with them; the ring rides with the plate. All poses come from `lighterKeychainLayout`, not by eye.

`npm run check:assembly -- magnetic-lighter-keychain` measures **≈ 15 mm³** between the lighter and the holder. This is the four
crush ribs' designed contact (0.15 mm of squeeze, measured on the check's 0.25 mm cells, which is why `squeeze: 0` still reads
≈ 15). With the ribs pulled back (`--defines '{"SQUEEZE":-1}'`) the lighter and the holder share **0.00 mm³**, and everything
else clears in every state and step. CI runs the defaults at `--tolerance 20 --snap-tolerance 20` and the rib-free diagnostic at
the default 1 mm³.

## Verification

- `packages/contracts/src/magneticLighterKeychain.test.ts`: the generator's fixed sizes and defaults equal the contract's; the
  lighter's plan copy equals the library's SCAD and data; each print's `-D` mapping; the offered magnets and rings equal the
  library's; pause and skin on layer boundaries at every layer height, never under two layers; every offered magnet fits at the
  defaults and the misfit is refused; every ring goes round the eyelet; the ribs' grip does not move with `fit`; the preview's
  poses and steps.
- `tools/test-renderer.ts` → `tools/lighter-keychain-checks.ts`: five real renders (defaults; largest magnets and ring, thickest
  skin, coarsest layers, loosest fits; smallest at the finest layers and tightest fits; 1 mm magnets without squeeze; 10 mm magnets
  at a 1.4 mm wall). Each print is one closed solid (holders with a sealed cavity per magnet) at the layout's size. Point tests
  check the cavities, skins, caps, ribs, bore, mouth, eyelet hole and bridge, the fit check's open pockets and its eyelet sample.
- `tests/browser/magnetic-lighter-keychain.spec.ts`: the card, the notes, the parts list, the slider, a changed magnet and the
  four-STL ZIP.
