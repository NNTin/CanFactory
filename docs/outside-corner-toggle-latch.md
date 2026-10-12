# Outside-corner toggle latch

`outside-corner-toggle-latch` is a **separate model** from the flat [toggle latch](toggle-latch.md). It joins the outside of
an equal-thickness, **90° wooden butt joint**, with four printed parts and four countersunk wood screws. It is not an inside
corner bracket. The original flat latch, its settings and its catio users are unchanged.

## Arrangement

Looking along the pivot axes, with the lever on top:

```text
                  lever + link
             catch <=========> base
             ┌─────┐            ────────────────  top mounting foot
             │     │ upright   │ horizontal plank →
 catch foot  │ → • │ plank     │
             │     ├───────────┘
             │     │          ↓ base screws (further from the joint)
             │     │
             ↓     ↓
```

The upright plank covers the horizontal plank's end; their top edges are flush. The base's foot extends across the top,
but its screws are **in the horizontal plank's broad face**, beyond its end. The catch's L-shaped foot runs down the
upright plank's outside face; its screws point horizontally **into that plank's broad face**. Neither pair screws into
end grain. The latch draws the upright plank towards the horizontal plank's end. Choose timber wide enough to support
the 38 mm-wide feet and leave suitable side margins around the screws; the model does not prescribe timber grades or
structural fastener spacing.

The original knuckle, hook and moving parts keep their geometry and relative orientation: simply turning the original
catch by 90° would no longer seat the original link. Instead, the catch gets a perpendicular mounting flange and a
central gusset **below** the mechanism. The base gets a longer mounting plate, relieved under the moving link and thumb
pad, with 2.5 mm of backing below the relief. Both original screw rows are removed.

## Settings and holes

- **Plank thickness**: 10–40 mm, the same for both planks. This sizes the footprint and checks screw penetration; it does
  not scale the linkage. Unequal planks and non-right-angle joints are not supported by this version.
- **Screw setback**: 12–30 mm beyond the butt joint. The local screw row is at `plankThickness + edgeDistance`; each
  mounting foot ends 8 mm after its row. Setback must be at least three screw diameters, a layout allowance rather than a
  structural timber rule. Pre-drill and choose actual edge distances for the timber and application.
- **Wood screws**: library DIN 7997, diameters 3–5 mm. Two per foot, approximately 26.4 mm apart across the width, through
  nominally 4 mm plates. Heads sit in outward-facing, 90° countersinks with 0.4 mm diametral play. **Hole fit** uses the
  original latch's fine / medium / coarse wood-screw allowances. The selected length includes the countersunk head;
  validation requires at least 8 mm penetration and at least 2 mm nominal timber remaining before the tip exits.
- **Loose pivots**: the original high-tolerance lever, unchanged.

Defaults: **18 mm planks, 18 mm setback, four DIN 7997 4 × 20 screws**, medium hole fit. The feet are 44 mm long;
nominal penetration is 16 mm. The original latch's 4 × 25 default is deliberately **not** used: it would penetrate 21 mm
and break through these planks.

The locked mechanism's catch origin is 1.311 mm before the base origin. Thus, measure the base screw row **37.31 mm along
the top face from the outside corner**, and the catch row **36 mm down the upright face**, at defaults. The editor's notes
calculate both dimensions for other settings. These are nominal assembly positions, not a substitute for fitting the
printed parts to the actual joint.

## Fit, printing and limits

Print the parts as generated: base on its short end, catch's long flange flat, original lever and link in their original
orientations. The catch flange is inset 0.05 mm at each end relative to the hook shelf to avoid coincident tangent faces
and float32 sliver triangles. Snap the lever onto the base, then the link onto the lever. Mount the base; fit the catch
with the lever closed, then test the **whole** opening and closing travel before final drilling. Tighten gently.

The over-centre mechanism needs approximately **0.32 mm elastic take-up** between its closest draw and its locked
position. Provide compliant packing at the butt joint or appropriate joint flex; do not force a rigid wooden joint
through dead centre. There is no threaded preload adjustment. Printer fit and timber movement affect operation.

This is a **digitally checked prototype**, not physically fit- or load-tested, with no rated holding force. It is not a
structural connector, safety latch or substitute for a rated commercial fitting.

## Sources and checks

- `models/outside-corner-toggle-latch/base.scad` / `catch.scad`: self-contained, plank-aware feet, copied original joint profiles.
- `models/toggle-latch/reference/Latch 12mm 3.scad` / `Latch 12mm 4.scad`: shared lever and link, without duplication.
- `packages/contracts/src/outsideCornerToggleLatch.ts`: dimensions, penetration/setback validation and assembly positioning.
- The catalogue illustration shows the outside wooden corner, perpendicular screws and the shared animated mechanism.
  The 3D assembly uses the real STL feet and the original five movements, lifted by the catch flange's length so it stays
  above the preview floor. No flat-latch physics approximation is advertised for this variant.
- Contract tests prove independent registration, strict requests, source/profile reuse, screw validation and frame transforms.
- Renderer tests check defaults, minimum/maximum/fractional footprints, every screw diameter, extreme fits and loose pivots;
  inspect the ZIP's closed manifold meshes and probe the delivered holes, countersinks, intact rims and filled original holes.

```sh
npm run check
TEST_ONLY=outside-corner-toggle-latch npm run test:renderer
TEST_ONLY=outside-corner-toggle-latch SWEEP_BOUNDARIES=1 SWEEP_SAMPLES=8 npm run test:sweep
npm run check:assembly -- outside-corner-toggle-latch --snap-tolerance 50
npm run test:browser -- tests/browser/toggle-latch.spec.ts
```

The snap tolerance applies only while the side plates spread over the original pivot pins, not to ordinary movement
frames. All later movements use the normal collision tolerance. Attribution and CC BY-NC 4.0 terms are in
[ATTRIBUTION.md](../models/outside-corner-toggle-latch/ATTRIBUTION.md).
