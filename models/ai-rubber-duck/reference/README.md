# Preserved OpenAI outline

`openai.svg` is the unmodified outline from
[Simple Icons 13.0.0](https://github.com/simple-icons/simple-icons/blob/13.0.0/icons/openai.svg).
See [attribution and licensing](../ATTRIBUTION.md).

From the repository root, reproduce the polygon rings embedded as
`OPENAI_RINGS` in the generator:

```sh
node --import tsx --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { svgToLogo, decodeLogo } from './packages/contracts/src/index.ts';
const svg = readFileSync('models/ai-rubber-duck/reference/openai.svg', 'utf8');
console.log(JSON.stringify(decodeLogo(svgToLogo(svg).logo)));
JS
```

The result contains the outer ring and seven holes in a 2000-unit square.
The SCAD generator subtracts the holes, recenters the profile, scales it to
36 mm (round) or 46 mm (sculpted), and expands the strokes by 0.4 mm at the
default body size. The SVG is a preserved source, not a runtime dependency;
the generator remains self-contained.
