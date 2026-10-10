/**
 * Renders a model's parts and its assembly's reference objects as the worker and the preview do, for the tools that check an
 * assembly (check-assembly.ts, physics/check-physics.ts). Needs an OpenSCAD runtime (see stl-to-scad/openscad.ts).
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { activeParts, devBoardLayout, dimensionOf, findPart, partAssetPath, scadDefines, type Assembly, type ParameterValues, type Part } from '../packages/contracts/src/index.ts';
import { renderScad } from './stl-to-scad/openscad.ts';
import { bounds, g, parseStl, type Mesh } from './stl-to-scad/stl.ts';

/**
 * The generic models of the families the preview builds from their dimensions (magnets, screws, nuts, threaded inserts), so that
 * they have no STL of their own: each is rendered at the part's sizes. A thread is drawn so that a screw clears the nut or insert
 * it turns into (see each SCAD file), and an insert as the hole it is melted into.
 */
const size = (part: Part, key: string, limit: 'value' | 'max' = 'max') => part.dimensions[key] ? String(dimensionOf(part, key, limit)) : '0';
/** dev-board.scad's code for the shape on a component's body (0: none). */
const TOP_SHAPES = { round: 1, oval: 2, rectangle: 3 } as const;
export const GENERIC_MODELS: Record<string, { scad: string; defines: (part: Part) => Record<string, string> }> = {
  magnet: {
    scad: 'parts/magnets/magnet.scad',
    defines: part => {
      const shape = part.attributes['shape'] === 'block' ? 'block' : part.attributes['shape'] === 'ring' ? 'ring' : 'disc';
      return { SHAPE: JSON.stringify(shape), DIAMETER: size(part, 'diameter'), HOLE: size(part, 'innerDiameter'), LENGTH: size(part, 'length'), WIDTH: size(part, 'width'), HEIGHT: size(part, 'thickness') };
    },
  },
  screw: {
    scad: 'parts/screws/screw.scad',
    defines: part => ({
      COUNTERSUNK: String(part.attributes['head'] === 'countersunk'), D: size(part, 'd', 'value'), PITCH: size(part, 'pitch', 'value'), L: size(part, 'l', 'value'),
      HEAD_D: part.dimensions['dk'] ? size(part, 'dk') : size(part, 'e'), HEAD_K: size(part, 'k'),
      HEX: String(part.attributes['head'] === 'hex'), HEAD_S: part.attributes['head'] === 'hex' ? size(part, 's') : '0',
    }),
  },
  // a wood screw cuts its own thread: drawn at its nominal diameter, which its clearance hole clears
  'wood-screw': {
    scad: 'parts/screws/screw.scad',
    defines: part => ({ COUNTERSUNK: String(part.attributes['head'] === 'countersunk'), D: size(part, 'd', 'value'), PITCH: '0', L: size(part, 'l', 'value'), HEAD_D: size(part, 'dk'), HEAD_K: size(part, 'k'), HEX: 'false', HEAD_S: '0' }),
  },
  nut: {
    scad: 'parts/nuts/nut.scad',
    defines: part => ({ SQUARE: String(part.attributes['shape']?.startsWith('square') === true), S: size(part, 's'), H: part.dimensions['h'] ? size(part, 'h') : size(part, 'm'), D: size(part, 'd', 'value') }),
  },
  // a set screw's thread at its minor diameter, which the tap drill of its hole clears
  'set-screw': {
    scad: 'parts/set-screws/set-screw.scad',
    defines: part => ({ D: size(part, 'd', 'value'), PITCH: size(part, 'pitch', 'value'), L: size(part, 'l', 'value') }),
  },
  ball: { scad: 'parts/balls/ball.scad', defines: part => ({ D: size(part, 'd') }) },
  // a spring at its free length, its total coils being the active ones and a closed end each
  spring: {
    scad: 'parts/springs/spring.scad',
    defines: part => ({ D_WIRE: size(part, 'd', 'value'), DE: size(part, 'De'), L0: size(part, 'L0'), COILS: String(Number(/with ([\d.]+) active coils/.exec(part.description)?.[1] ?? 5) + 2) }),
  },
  // a split ring as one closed ring of its outer and inner diameter and its thickness over both turns
  'split-ring': { scad: 'parts/split-rings/split-ring.scad', defines: part => ({ D_OUT: size(part, 'D'), D_IN: size(part, 'd'), THICKNESS: size(part, 'b') }) },
  'nfc-tag': { scad: 'parts/nfc-tags/nfc-tag.scad', defines: part => ({ D: size(part, 'D'), H: size(part, 'h') }) },
  // a 60 mm piece of the strap, at its greatest thickness
  'cat-collar': { scad: 'parts/cat-collars/strap.scad', defines: part => ({ WIDTH: size(part, 'width'), THICKNESS: size(part, 'thickness') }) },
  'threaded-insert': {
    scad: 'parts/inserts/insert.scad',
    defines: part => ({ HOLE: size(part, 'hole', 'value'), L: size(part, 'l', 'value'), D: part.attributes['thread']?.slice(1) ?? '0' }),
  },
  // a board as its layout places everything: the PCB with its holes, the USB-C receptacle and each component as a box
  'dev-board': {
    scad: 'parts/dev-boards/dev-board.scad',
    defines: part => {
      const layout = devBoardLayout(part);
      if (!layout) throw new Error(`${part.id} has no layout.`);
      const { usb } = layout;
      return {
        L: size(part, 'L', 'value'), W: size(part, 'W', 'value'), T: size(part, 't', 'value'), R: size(part, 'r', 'value'), HOLE: size(part, 'd', 'value'),
        CASTELLATED: String(layout.castellated), PINS: JSON.stringify(layout.pins.map(pin => [pin.x, pin.y])),
        USB: JSON.stringify([usb.x0, usb.y0, usb.x1, usb.y1, usb.height]),
        COMPONENTS: JSON.stringify(layout.components.map(c => [c.x, c.y, c.width, c.length, c.height, c.rotation, c.top ? TOP_SHAPES[c.top.shape] : 0, c.top?.width ?? 0, c.top?.length ?? 0, c.top?.height ?? 0, c.base ?? 0])),
      };
    },
  },
};

/** Every active part and reference object of the model for these parameters, by its key in the assembly's poses. */
export async function renderAssemblyMeshes(model: Parameters<typeof activeParts>[0], assembly: Assembly, parameters: ParameterValues, overrides: Record<string, string> = {}): Promise<Map<string, Mesh>> {
  const parts = new Map<string, Mesh>();
  for (const part of activeParts(model, parameters)) {
    // As apps/worker/src/render.ts: each part gets only its own mapped parameters and chosen parts' dimensions.
    const defines = { ...Object.fromEntries(scadDefines(model, part, parameters)), ...overrides };
    const render = await renderScad(resolve(part.sourcePath), defines);
    parts.set(part.id, parseStl(render.stl));
    console.log(`rendered ${part.id} (${render.runner}, ${(render.milliseconds / 1000).toFixed(1)} s)`);
  }
  // Reference objects (e.g. a lighter in its bay) are checked like parts, rendered from their SCAD source; the preview uses the
  // STL rendered from it, so it must match.
  for (const reference of assembly.references ?? []) {
    const part = findPart(reference.part);
    if (!part) throw new Error(`${model.id}: reference ${reference.id} is not in the parts library.`);
    // A part the preview builds from its dimensions (a magnet, a screw, ...) is rendered from its family's generic model.
    const generic = GENERIC_MODELS[part.family];
    if (generic) {
      const render = await renderScad(resolve(generic.scad), generic.defines(part));
      parts.set(reference.id, parseStl(render.stl));
      console.log(`rendered reference ${reference.id} (${part.id}, ${render.runner}, ${(render.milliseconds / 1000).toFixed(1)} s)`);
      continue;
    }
    const [scad, stl] = [partAssetPath(part, 'scad'), partAssetPath(part, 'stl')];
    if (!scad || !stl) throw new Error(`${model.id}: reference ${reference.id} has neither an STL preview nor a generic model.`);
    const render = await renderScad(resolve(scad), {});
    const mesh = parseStl(render.stl);
    const committed = parseStl(await readFile(resolve(stl)));
    const [fresh, stored] = [bounds(mesh), bounds(committed)];
    if ([...fresh.min, ...fresh.max].some((value, index) => Math.abs(value - g([...stored.min, ...stored.max], index)) > 0.01))
      throw new Error(`${stl} is out of date: render ${scad} again.`);
    parts.set(reference.id, mesh);
    console.log(`rendered reference ${reference.id} (${render.runner}, ${(render.milliseconds / 1000).toFixed(1)} s)`);
  }
  return parts;
}
