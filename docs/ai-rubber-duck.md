# AI rubber ducks

Open **AI rubber duck** in the model library (`/#/models/ai-rubber-duck`).
**Version** selects all eight designs from the
[approved concept gallery](concepts/ai-rubber-ducks/README.md): a yellow duck
with a round head, or a cream duck with a sculpted symbol/terminal head, for
Claude, Codex, Anthropic and OpenAI. These are rigid printed desk models.

The shared body follows proportions measured from the concept sheets' side and
front views: an upright, plump body about as tall as it is long, a 24 mm
(at 90 mm) round head set high over the breast, a rump that rises into a short,
upturned tail, and low-relief wings with three feather tips. Its parts are
joined by convex hulls, so they blend like a moulded duck rather than meeting
at creases. Claude · Round is the first face reworked to match its concept;
the other faces follow.

**Body length** measures breast to tail: 70–120 mm, default 90 mm. The head,
body and insert positions scale together. **Joint clearance**, under Advanced
settings, is the radial gap around each peg core: 0.10–0.25 mm per side,
default 0.20 mm. Smaller values grip more tightly. Peg sizes and rib heights
stay constant as the appearance scales. Always generate mating pieces with
the same version, length and clearance.

## Files and colors

The ZIP contains one connected, closed STL per physical piece. The suggested
filament colors appear both on the preview and beside the part visibility
buttons. STL files themselves do not store color.

| Version | `body.stl` | `face.stl` | Extra pieces |
| --- | --- | --- | --- |
| Claude · Round | Yellow | Terracotta starburst inlay | None |
| Claude · Sculpted | Cream | Terracotta starburst head | None |
| Codex · Round | Yellow | Charcoal terminal face | White `chevron.stl`, white `bar.stl` |
| Codex · Sculpted | Cream | Charcoal terminal head | White `chevron.stl`, white `bar.stl` |
| Anthropic · Round | Yellow | Charcoal A | Charcoal `bar.stl` (I) |
| Anthropic · Sculpted | Cream | Charcoal connected AI head | None |
| OpenAI · Round | Yellow | Charcoal knot | None |
| OpenAI · Sculpted | Cream | Charcoal knot head | None |

The Claude round starburst is an inlay: it sits in a star-shaped pocket in the
head, and its pillowed top follows the head's curve, so no seat shows round it.
The Anthropic round A and I are separate pieces even though they share a color.
The sculpted AI has a joining foot so it prints as one piece. The sculpted
starburst and knot also have a small mounting foot; the knot keeps its openings.
These feet, flat seating surfaces and beveled edges adapt the illustrations
to printable parts.

## Printing and assembly

Start with PLA, a 0.4 mm nozzle, 0.2 mm layers and three perimeters. The body
exports upright on a flat base. Faces, heads and inserts export face down,
except the Claude round inlay, which exports on its flat back.
Use local slicer supports under curved body overhangs and the sculpted heads'
sideways neck pegs. Inspect the slice before printing; clear support and any
elephant's foot from mating surfaces.

1. For Codex, push the white chevron and bar into the shallow recesses in the
   terminal face. Each insert has two locating pegs.
2. For round ducks, align the pegs on the back of the symbol with the holes
   in the yellow head and press straight back. Fit the Anthropic I separately.
   For Claude, the pegs stand in the head's star-shaped pocket instead: drop
   the inlay into the pocket over them and press it home.
3. For sculpted ducks, align the downward pegs with the neck holes and press
   the head straight down. Support the part close to the joint while pressing.

The paired pegs have different diameters to key their orientation. Chamfered
tips and socket mouths guide insertion, and sockets have 0.5 mm extra depth.
Three 0.30 mm ribs on each peg provide intentional radial interference of
0.05–0.20 mm across the clearance range. The peg core itself clears the socket.
If the fit is too tight, increase clearance and regenerate the mating pieces.
Physical grip and durability still need a test print on your printer.

The **Assembly** slider shows the exported print orientations, the exploded
layout, insertion of the Codex glyphs, and the final assembly. Hide individual
parts to inspect the joints. Orbit to see the face and use the scroll wheel
to zoom. While a new version or size renders, the previous geometry retains
its own colors and assembly positions.

## Rendered views

These PNGs show the actual default STL geometry from front, three-quarter,
side and rear views. They are separate from the original AI concept images.

| Brand | Round | Sculpted |
| --- | --- | --- |
| Claude | [Four views](ai-rubber-duck/claude-v1-round.png) | [Four views](ai-rubber-duck/claude-v2-sculpted.png) |
| Codex | [Four views](ai-rubber-duck/codex-v1-round.png) | [Four views](ai-rubber-duck/codex-v2-sculpted.png) |
| Anthropic | [Four views](ai-rubber-duck/anthropic-v1-round.png) | [Four views](ai-rubber-duck/anthropic-v2-sculpted.png) |
| OpenAI | [Four views](ai-rubber-duck/openai-v1-round.png) | [Four views](ai-rubber-duck/openai-v2-sculpted.png) |

## Geometry and verification

The self-contained [SCAD generator](../models/ai-rubber-duck/generator.scad)
uses `VARIANT`, `BODY_LENGTH`, `CLEARANCE`, and an internal `PART` selector.
The shared model contract selects only the applicable parts and computes
their colors and assembly poses from the completed render's parameters.
`PART` is trusted model metadata, not an API parameter. It participates in
the render cache fingerprint. Attribution and the preserved OpenAI outline
are [beside the model](../models/ai-rubber-duck/ATTRIBUTION.md).

The renderer suite checks all eight defaults and the four size/clearance
corners for every variant: 40 assemblies, each with independently validated
parts. It checks closed edges, winding, connectivity, positive volume,
body length, ZIP contents, cache reuse and matching preview/download bytes.

```sh
TEST_ONLY=ai-rubber-duck npm run test:renderer
TEST_ONLY=ai-rubber-duck SWEEP_SAMPLES=16 SWEEP_SEED=20260930 npm run test:sweep
npm run check:assembly -- ai-rubber-duck
npm run check:assembly -- ai-rubber-duck \
  --parameters '{"variant":"codex-v2-sculpted","bodyLength":70,"clearance":0.1}' \
  --defines '{"RIBS":false}' --tolerance .02 --snap-tolerance .02
BASE_URL=http://127.0.0.1:5173 npx playwright test tests/browser/ai-duck.spec.ts
```

Repeat the assembly check for each variant at `(90, 0.20)`, `(70, 0.10)`,
`(70, 0.25)`, `(120, 0.10)` and `(120, 0.25)`. The local-only `RIBS=false`
diagnostic removes the intentional interference and checks the seating
surfaces and insertion paths strictly. Collision checks sample the meshes
on a 0.25 mm grid and the last 10 mm of insertion at 0.25 mm steps; they
provide geometric evidence, not a measurement of printed retention force.
