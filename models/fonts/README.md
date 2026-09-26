# Fonts for engraved text

These fonts are bundled so that the text on the cigarette case renders identically on every machine (the renderer would
otherwise use whatever fonts the host has, or none). The worker points OpenSCAD at this folder with `OPENSCAD_FONT_PATH`.

| Choice (`textFont`) | Font | File | License |
|---|---|---|---|
| `sans` | Liberation Sans Bold | `LiberationSans-Bold.ttf` | SIL OFL 1.1 (`LICENSE-Liberation.txt`) |
| `serif` | Liberation Serif Bold | `LiberationSerif-Bold.ttf` | SIL OFL 1.1 |
| `mono` | Liberation Mono Bold | `LiberationMono-Bold.ttf` | SIL OFL 1.1 |
| `wide` | DejaVu Sans Bold | `DejaVuSans-Bold.ttf` | Bitstream Vera / DejaVu (`LICENSE-DejaVu.txt`) |

Liberation 2.1.5 comes from <https://github.com/liberationfonts/liberation-fonts/releases>; DejaVu is the Debian
`fonts-dejavu-core` copy. All four are bold on purpose: thin strokes do not print well at 3 to 6 mm.
`packages/contracts/src/textMetrics.ts` holds per-character advance widths measured from these exact files
(`npm run stl-scad`-independent: `npx tsx tools/generate-text-metrics.ts`); regenerate it if a font file changes.
