# Trolley token and shopping-list holder

[Shopping list holder for shopping cart coin slot](https://www.thingiverse.com/thing:4126950) by
[jhappone](https://www.thingiverse.com/jhappone/designs), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
[Attribution and preserved originals](../models/trolley-token/ATTRIBUTION.md).

The original design combines a 23.25 mm trolley token, 2.5 mm thick, with a spring-operated paper clamp.
CanFactory preserves the source geometry and provides both printed parts as a ZIP: `body.stl` and `clip.stl`.
The source design has no adjustable settings in the editor. Model version 3 replaces the discarded CanFactory designs;
saved settings and render requests for those versions do not apply.

## Print and assemble

Print the body flat underside down and the clip flat outer face down, in the supplied print orientations.
The body is 51.625 × 30 × 7.5 mm; the clip is 25 × 30 × 7 mm. Check the token against your trolley lock.

The clamp requires a metal torsion spring and an axle. The author uses a 2.5 mm axle and instructs users to drill the holes
to suit it; the original CAD holes are 1 mm pilots. Spring dimensions and axle-retention details are not specified in the
source listing. Follow the [author's build notes](https://www.thingiverse.com/thing:4126950), fit a spring that closes the jaws,
and secure the axle. Check that the clamp opens freely and holds your paper. Hardware is not included in the print ZIP.

The preview lowers the clip between the hinge ears and demonstrates pressing the pad to open the rear grip, then releasing
it to close. The spring and axle are required for the real mechanism; the preview shows the two printed pieces.

## Source verification

Both STEP solids are valid, and both converted prints are closed, consistently wound, connected solids. Comparison with the
supplied STLs gives 99.86% overlap for the body and 99.74% for the clip, with less than 0.01 mm bounding-box difference and
0.02% volume difference. Assembly placement reverses the measured print transforms. The source parts have zero analytic
intersection when assembled and throughout the demonstrated 15° opening movement.

[Reproducible conversion and assembly checks](../models/trolley-token/CONVERSION.md)
· [Generated verification report](../models/trolley-token/VERIFICATION.md).
