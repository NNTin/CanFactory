# Window cat guard

This model is an adaptation of **“Tilted window cat protection”** on MakerWorld:
<https://makerworld.com/de/models/3234292-tilted-window-cat-protection>

The original design is licensed under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International**
(CC BY-NC-SA 4.0): <https://creativecommons.org/licenses/by-nc-sa/4.0/>

`references/` holds ten STLs of the original design (“Kippfenster Katzenschutz”), unchanged, as provided.

`generator.scad` was written in OpenSCAD for this application. It contains no geometry from the original STLs, but it builds
the same guard the same way (honeycomb plates, segments joined by a dovetail under a lapping spine or rib, a top strip plugged
into the side panels with pins), at any size. What was measured from the original is recorded in
[docs/window-cat-guard.md](../../docs/window-cat-guard.md#the-reference-parts). Changes: the panels are parametric (height,
width, gap, plate, ribs, honeycomb, play), split automatically into segments up to a set length, and both top corners use
the same pin-in-boss joint.

As an adaptation, the model source and the geometry generated from it are licensed under the same terms,
**CC BY-NC-SA 4.0**: credit the original design, no commercial use, and share adaptations under the same licence.

These model terms do not establish a license for unrelated application code.
