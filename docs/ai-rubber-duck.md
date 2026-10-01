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
at creases. The faces follow their concepts too: round ducks wear the symbol as
a relief that hugs the head, and on sculpted ducks the chunky, rounded symbol
is the head, resting directly on the shoulders.

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
| Codex · Round | Yellow | Charcoal terminal visor | White `chevron.stl`, white `bar.stl` |
| Codex · Sculpted | Cream | Charcoal terminal head | White `chevron.stl`, white `bar.stl` |
| Anthropic · Round | Yellow | Charcoal A inlay | Charcoal `bar.stl` (I inlay) |
| Anthropic · Sculpted | Cream | Charcoal AI head | None |
| OpenAI · Round | Yellow | Charcoal knot inlay | None |
| OpenAI · Sculpted | Cream | Charcoal knot head | None |

Every round face is an inlay: it sits in a pocket of its own shape in the
head, and its rounded top follows the head's curve, so no seat shows round it.
The Codex glyphs inlay into the visor the same way. The Anthropic round A and I
are separate inlays even though they share a color; the knot's openings show
the yellow head through them.

Sculpted heads sit in a shallow cavity sunk into the shoulders, cut flat at
the bottom so that the head rests on its floor. The Claude rays, the A and I,
the knot strands and the terminal are rounded on both sides. A low link along
the baseline joins the A to the I, which overhangs the shoulder as in the
concept, so the head prints as one piece. Flat backs (and the terminal's flat
front) and the cut seats adapt the illustrations to printable parts.

## Printing and assembly

Start with PLA, a 0.4 mm nozzle, 0.2 mm layers and three perimeters. The body
exports upright on a flat base. Inlays and sculpted heads export on their flat
backs; the Codex terminal head and its white inserts export face down.
Use local slicer supports under curved body overhangs and the pegs that stand
sideways in the round heads' pockets. Inspect the slice before printing; clear
support and any elephant's foot from mating surfaces.

1. For Codex, push the white chevron and bar into their recesses in the visor
   or terminal. Each insert has two locating pegs: on the round visor they
   stand in the recess, on the sculpted terminal they are on the insert.
2. For round ducks, two pegs stand in the head's pocket. Drop the inlay into
   the pocket over them and press it home. Fit the Anthropic I separately.
3. For sculpted ducks, two pegs stand on the floor of the shoulder cavity.
   Lower the head straight down onto them and press. Support the part close to
   the joint while pressing.

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
