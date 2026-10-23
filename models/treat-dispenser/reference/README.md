# Reference: bovineblitz's gumball-style dispenser

The three STL files of **Cat treat gumball-style dispenser** by **bovineblitz** ([MakerWorld 190887](https://makerworld.com/en/models/190887),
print profile 210737), [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), a remix of cylus80's **Mason Jar Candy
Dispenser** ([Thingiverse 2103924](https://www.thingiverse.com/thing:2103924), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
Unchanged, as downloaded (MakerWorld requires a login; the owner supplied them). See [../ATTRIBUTION.md](../ATTRIBUTION.md).

They are **not used by the model**: nothing renders or imports them, and no SCAD reconstruction was made (the dispenser is redrawn,
not rebuilt). They are kept so that the measurements below can be checked.

| File | What it is | Size (mm, as exported) | Volume (cm³) | Mesh | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `obj_1_arm.stl` | the rotor ("arm") with its crank | 24 × 70 × 86.3 | 24.9 | 2910 triangles, one open edge | `9a10677c22878a33fa72df9680f4311ca8501e02d6e119e413ac349f95f70457` |
| `obj_2_clip.stl` | the clip that holds the arm in the body | 28.7 × 24.0 × 2 | 0.56 | 768 triangles, closed | `0f1126b45379559b7a5839c0bc1884565d114676ff6b0a32b458594813abd5db` |
| `obj_3_gumball.stl` | the body: jar thread, funnel, bore, ramp | 87 × 87 × 65.6 | 101.2 | 5148 triangles, closed | `14a00f03646e719df9a266b3df97f6e4ea62363291d0219e060ee9630d8ca8e3` |

Sizes, volumes, meshes and checksums are from `npm run stl-scad -- inspect` (2026-10-22). Read off horizontal and vertical sections of
the body and arm (approximate, to the nearest millimetre or degree): a hollow 87 × 87 × 66 mm shell; a mason-jar thread ring over a
funnel into a slot about 25 mm wide; a horizontal bore of about Ø20 mm under it; the arm's shaft Ø19.2 mm with one pocket; a ramp at
about 26° that leaves under the crank.

What CanFactory took from them is the principle only (bottle over a funnel, a pocketed horizontal rotor, a ramp out). The rotor's
size, its pockets, the slot, the flap, the cavity and the chute were worked out in simulation for 14 × 9 × 5 mm treats
(docs/treat-dispenser.md).
