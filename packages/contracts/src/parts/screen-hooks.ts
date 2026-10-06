import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Hooks for insect screens (Einhängefedern): flat stainless strips screwed to the back of a screen frame and bent to fit one window.
 * Each strip runs along the frame, turns at a right angle into the window past the fixed frame's outer lip, and its bent tip (the
 * barb) reaches behind that lip. The long hooks go at the top, the short ones at the bottom: lifted, the frame hangs on the top
 * hooks, swings in, and drops so that the bottom hooks go behind the lower lip. The window catio's insert hangs on them.
 */
export const screenHookFamily: PartFamily = {
  id: 'screen-hook', title: 'Insect screen hooks',
  description: 'Stainless spring strips that hang a frame on a window: screwed to the frame, bent to the window’s frame lip, their tips reach behind it.',
  attributes: [{ key: 'position', label: 'Position' }, { key: 'material', label: 'Material' }, { key: 'set', label: 'Set' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'h', label: 'Length of the bent tip (the barb behind the lip)', symbol: 'h', required: true },
    { key: 'x1', label: 'Thinnest frame lip it is bent for', symbol: 'X min', required: true },
    { key: 'x2', label: 'Thickest frame lip it is bent for', symbol: 'X max', required: true },
    { key: 'c', label: 'Bend allowance: the strip is bent at the lip’s thickness plus this', symbol: 'X + c', required: true },
    { key: 'l', label: 'Length of the screwed leg', symbol: 'l', required: true },
    { key: 'w', label: 'Strip width', symbol: 'b', required: true },
    { key: 't', label: 'Strip thickness', symbol: 's', required: true },
    { key: 'd', label: 'Screw hole diameter', symbol: 'd', required: true },
  ],
};

// Windhager 03651, “IS EH-Feder Montageset 5-35mm”: two long hooks (5a, top) and two short ones (5b, bottom) with their screws and a
// bending gauge. The product page gives the 5–35 mm frame range; the assembly instructions (QA468) give the tips, 15 mm and 7 mm,
// and the bend at X + 3 mm. Strip width, thickness, leg length and hole are not published: estimated from those drawings, scaled
// by the dimensioned tips.
const WINDHAGER_03651 = [
  { key: '5a', name: 'long', position: 'Top (long, 5a)', h: 15, where: 'top', mount: 36 },
  { key: '5b', name: 'short', position: 'Bottom (short, 5b)', h: 7, where: 'bottom', mount: 30 },
] as const;

const windhager = WINDHAGER_03651.map((hook): Part => {
  const manufacturer = measured('manufacturer', 'windhager-qa468');
  const range = measured('manufacturer', 'windhager-03651');
  const estimated = measured('estimated', 'canfactory-screen-hook-estimate');
  return {
    id: `windhager-03651-${hook.key}`, family: 'screen-hook', title: `Insect screen hook, ${hook.name} (Windhager 03651, ${hook.key})`,
    designation: `Windhager 03651, hook ${hook.key}`, aliases: ['Einhängefeder'],
    description: `The ${hook.name} stainless hook of Windhager’s 03651 set, for the ${hook.where} of a screen frame: its ${hook.h} mm tip is bent to reach behind a 5–35 mm frame lip.`,
    standard: null, product: { manufacturer: 'Windhager Handelsgesellschaft m.b.H.', sku: '03651', url: 'https://www.windhager.eu/de/Produkte/Einhaengefeder-Montageset_a_85263' },
    attributes: { position: hook.position, material: 'Stainless steel', set: '03651: 2 long, 2 short', manufacturer: 'Windhager' },
    dimensions: {
      h: manufacturer(hook.h), x1: range(5), x2: range(35), c: manufacturer(3),
      l: estimated(40), w: estimated(8), t: estimated(0.8), d: estimated(4.2),
    },
    sources: ['windhager-03651', 'windhager-qa468', 'hornbach-windhager-03651', 'canfactory-screen-hook-estimate'],
    notes: `Sold as a set of four (two of each), with screws and a bending gauge; stainless steel (Hornbach’s listing). The instructions bend each strip with pliers at the frame lip’s thickness X plus 3 mm, X measured with the window open, and screw the ${hook.where} hooks ${hook.mount} mm from the screen frame’s ${hook.where} edge. The strip has a hole and a slot, so its height can be set. Width, thickness, leg length and hole are not published: they are estimated from the instruction drawings, scaled by the dimensioned ${hook.h} mm tip.`,
    preview: { kind: 'procedural' },
  };
});

export const screenHookParts: Part[] = [...windhager];
