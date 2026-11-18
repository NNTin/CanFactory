import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { unzipSync } from 'fflate';
import { wireGuideGeometry, wireGuidePieces, type WireGuideDesign } from '@canfactory/contracts';
import { bounds, parseStl } from '../../tools/stl-to-scad/stl.ts';

// The prototype-board wire guide's separate layers and pegs (#170) in the editor, rendered by the stack's real worker: the
// representative three-level half Perma-Proto (models/prototype-wire-guide/samples, made for the tests, not the owner's project).
const SAMPLES = new URL('../../models/prototype-wire-guide/samples/', import.meta.url);
const sample = async (name: string) => JSON.parse(await readFile(new URL(name, SAMPLES), 'utf8')) as WireGuideDesign;

test('renders the three-level guide as three stacked layers and two separate pegs, assembles them, and downloads those pieces', async ({ page }, testInfo) => {
  test.setTimeout(400_000);
  const design = await sample('perma-proto-half-three-levels.json');
  const pieces = wireGuidePieces(design);
  const [print] = wireGuideGeometry(design);
  if (!print) throw new Error('Expected a print.');
  expect(pieces.map(piece => piece.id)).toEqual(['print-1-layer-1', 'print-1-layer-2', 'print-1-layer-3', 'print-1-peg-1', 'print-1-peg-2']);

  await page.goto('/#/models/prototype-wire-guide');
  await page.locator('#parameter-design').setInputFiles({ name: 'perma-proto-half-three-levels.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(design)) });
  await expect(page.getByTestId('wire-guide-summary')).toContainText('16 on 3 levels');
  await expect(page.getByTestId('wire-guide-pieces')).toHaveText('G1: 3 layers + 2 pegs');
  const download = page.getByRole('button', { name: 'Download ZIP', exact: true });
  await expect(download).toBeEnabled({ timeout: 300_000 });
  await expect(page.getByText('PARTS', { exact: true }).locator('xpath=following-sibling::strong')).toHaveText(/^5 /);
  const viewer = page.getByTestId('stl-viewer');
  await expect(viewer).toHaveAttribute('data-visible-parts', pieces.map(piece => piece.id).join(' '));

  // the assembly: from the bed, the pegs into the board, then each layer down over them
  const assembly = page.getByRole('slider', { name: 'Assembly' });
  await expect(assembly).toHaveAttribute('aria-valuetext', 'Parts as printed');
  await testInfo.attach('parts as printed', { body: await viewer.screenshot(), contentType: 'image/png' });
  await assembly.press('ArrowRight');
  await expect(assembly).toHaveAttribute('aria-valuetext', 'Lift and lay out the parts');
  await testInfo.attach('exploded', { body: await viewer.screenshot(), contentType: 'image/png' });
  await assembly.press('ArrowRight');
  await expect(assembly).toHaveAttribute('aria-valuetext', 'Step 1 of 4 · Print G1: push the pegs into the board’s mounting holes');
  await assembly.press('ArrowRight'); await assembly.press('ArrowRight');
  await expect(assembly).toHaveAttribute('aria-valuetext', 'Step 3 of 4 · Print G1: slide layer 2 down over the pegs, then lay level 1’s wires in it (W4, W14)');
  await assembly.press('End');
  await expect(assembly).toHaveAttribute('aria-valuetext', 'Assembled');
  await testInfo.attach('assembled', { body: await viewer.screenshot(), contentType: 'image/png' });

  // the download: exactly these pieces, each a real mesh lying on the bed at its size, the assembly guide and the design
  const downloaded = page.waitForEvent('download');
  await download.click();
  const path = await (await downloaded).path();
  if (!path) throw new Error('Missing download');
  const zip = unzipSync(new Uint8Array(await readFile(path)));
  expect(Object.keys(zip).sort()).toEqual([...pieces.map(piece => `${piece.id}.stl`), 'wire-guide-assembly.txt', 'wire-guide-design.json'].sort());
  expect(JSON.parse(new TextDecoder().decode(zip['wire-guide-design.json']))).toEqual(design);
  expect(new TextDecoder().decode(zip['wire-guide-assembly.txt'])).toContain('layer 2 from the bottom: the channels of level 1 (W4, W14)');
  print.stack.layers.forEach((layer, k) => {
    const box = bounds(parseStl(Buffer.from(zip[`print-1-layer-${k + 1}.stl`] ?? [])));
    expect(box.min[2]).toBeCloseTo(0, 2);
    expect(box.max[2]).toBeCloseTo(layer.zTop - layer.zBottom, 2);
    expect(box.max[0] - box.min[0]).toBeCloseTo(print.block.x1 - print.block.x0, 2);
  });
  for (const [j, peg] of print.stack.pegs.entries()) {
    const box = bounds(parseStl(Buffer.from(zip[`print-1-peg-${j + 1}.stl`] ?? [])));
    expect(box.min[2]).toBeCloseTo(0, 2);
    expect(box.max[2]).toBeCloseTo(Math.max(...peg.profile.map(([, z]) => z)), 2);
    expect(box.max[0] - box.min[0]).toBeCloseTo(2 * Math.max(...peg.profile.map(([r]) => r)), 1);
  }

  // one piece per print only when asked for: the same design as one fused print
  await page.getByLabel('Printed as').selectOption('single');
  await expect(page.getByTestId('wire-guide-pieces')).toHaveText('G1: 1 piece');
  await expect(download).toBeEnabled({ timeout: 300_000 });
  await expect(viewer).toHaveAttribute('data-visible-parts', 'print-1');
});

test('separate layers that can’t be made are an error with the explicit way out, never a fused print', async ({ page }) => {
  test.setTimeout(400_000);
  // the stripboard sample's wire end beside a mounting hole leaves no room for a peg there; it asks for one piece
  const design = await sample('stripboard-boss-neighbours.json');
  expect(design.guide.parts).toBe('single');
  await page.goto('/#/models/prototype-wire-guide');
  await page.locator('#parameter-design').setInputFiles({ name: 'neighbours.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(design)) });
  await expect(page.getByTestId('wire-guide-pieces')).toHaveText('G1: 1 piece');
  await page.getByLabel('Printed as').selectOption('layers');
  const problems = page.getByRole('alert').filter({ hasText: 'These separate layers can’t be made, so nothing renders' });
  await expect(problems).toContainText('G1: The mounting hole at (4.44, 4.68) mm can\'t take a peg: its hole would cut a funnel.');
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeDisabled();
  await problems.getByRole('button', { name: 'print each guide in one piece instead' }).click();
  await expect(page.getByTestId('wire-guide-pieces')).toHaveText('G1: 1 piece');
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeEnabled({ timeout: 300_000 });
});
