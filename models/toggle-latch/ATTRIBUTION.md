Toggle Latch

This project is an adaptation of the “Toggle Latch” design published on MakerWorld:

https://makerworld.com/de/models/625647-toggle-latch

which is itself a remix of “M3 toggle corner latch” by Hacky97, originally published on Thingiverse:

https://www.thingiverse.com/thing:5993215

The MakerWorld design and its digital files are licensed under the Creative Commons Attribution-NonCommercial 4.0
International License (CC BY-NC 4.0):

https://creativecommons.org/licenses/by-nc/4.0/

The Thingiverse original by Hacky97 is published under the Creative Commons Attribution 4.0 International License
(CC BY 4.0, https://creativecommons.org/licenses/by/4.0/).

Original creator: Hacky97
Original model: M3 toggle corner latch
Original source: Thingiverse
Original model page:
https://www.thingiverse.com/thing:5993215

Remix: Toggle Latch
Remix source: MakerWorld
Remix model page:
https://makerworld.com/de/models/625647-toggle-latch
Remix license: CC BY-NC 4.0

Changes

This project adapts the design for use in this application. The adaptation reconstructs the original geometry as
OpenSCAD and makes the screw holes of the base and the catch parametric (see below). The adapted files and the geometry
generated from them are shared under the same license, CC BY-NC 4.0: they may be shared and adapted with credit to the
creators above, an indication of changes, and not for commercial purposes.

The original designs are credited here for their contribution to the adapted work. This attribution does not grant any
additional rights to the original designs or their digital files.

Unless explicitly stated otherwise, the application code and original work produced independently of the Toggle Latch
design are governed by their own applicable license terms.

Reference files

`reference/*.stl` are the five original STL files from the MakerWorld page, unchanged: `Latch 12mm 1` (catch),
`Latch 12mm 2` (base), `Latch 12mm 3` and `Latch 12mm 3 HiTol` (lever, standard and high tolerance) and `Latch 12mm 4`
(link).

SCAD reconstructions

`reference/*.scad` are OpenSCAD reconstructions of the five original STL files in `reference/`, made for this
application with the `stl-to-scad` tooling (`tools/stl-to-scad`, `.claude/skills/stl-to-scad`). Each is an adaptation of
the corresponding original geometry: the profiles were measured from the STL and the parts rebuilt from extrusions,
cylinders and hulls, and `reference/VERIFICATION.md` records how closely each one reproduces its source (bounding box,
volume, overlap, manifold check). The two levers share one file that differs only in `HITOL`. The reconstructions carry
the same credit and the same license (CC BY-NC 4.0) as the original design.

Parametric generators

`base.scad` and `catch.scad` are the generators the application renders for the two plates. They are the reconstructions
of `Latch 12mm 2` and `Latch 12mm 1` with the original countersunk M3 holes replaced by holes sized for a screw chosen from
the parts library: a countersunk wood screw (DIN 7997) or a metric machine screw, with a DIN EN 20273 clearance hole and a
countersink as deep as a countersunk head is high. The lever and the link are rendered from their reconstructions
(`reference/Latch 12mm 3.scad`, with `HITOL` chosen by the “Loose pivots” setting, and `reference/Latch 12mm 4.scad`).
They carry the same credit and the same license (CC BY-NC 4.0) as the original design, and this attribution grants no
additional rights to the original or to the generators.

Standards

The clearance-hole diameters are those of DIN EN 20273 (identical to ISO 273), and the screw heads those of the
standards cited in the parts library. Only the published values are used; the standards themselves are not reproduced.
