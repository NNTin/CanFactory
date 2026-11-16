import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { inspectStl } from '@canfactory/server';
import { resolveAssembly, trolleyToken as model } from '@canfactory/contracts';

test('previews jhappone’s clamp with its M2 screw, nut and torsion spring, plays its hinge movement and downloads both attributed prints', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: model.title });
  await expect(card.getByRole('img', { name: 'Trolley token with spring-operated shopping-list clamp' })).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/#\/models\/trolley-token$/);
  const download = page.getByRole('button', { name: 'Download ZIP', exact: true });
  await expect(download).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Thingiverse', exact: true })).toHaveAttribute('href', 'https://www.thingiverse.com/thing:4126950');
  await expect(page.getByRole('link', { name: 'jhappone', exact: true })).toHaveAttribute('href', 'https://www.thingiverse.com/jhappone/designs');
  await expect(page.getByRole('link', { name: 'CC BY 4.0', exact: true })).toHaveAttribute('href', model.licenseUrl);
  await expect(page.getByText(/Required hardware: an M2 × 16 socket head screw, an M2 hex nut and a 0\.5 × 2\.5 mm torsion spring/)).toBeVisible();
  await expect(page.getByText(/no drilling/)).toBeVisible();
  await expect(page.getByTitle('Hide Trolley token body', { exact: true })).toBeVisible();
  await expect(page.getByTitle('Hide Shopping-list clamp', { exact: true })).toBeVisible();
  // the hardware is shown with the prints: the spring, the nut and the screw
  const assembly = resolveAssembly(model, model.assembly, {});
  if (!assembly) throw new Error('Expected the trolley token assembly.');
  for (const reference of assembly.references ?? []) await expect(page.getByTitle(`Hide ${reference.title}`, { exact: true })).toBeVisible();
  await expect(page.getByTestId('stl-viewer')).toHaveAttribute('data-visible-parts', /spring/);
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  // Compare the actual meshes at first load with returning to the print bed; the caption alone missed a framing bug.
  const canvas = page.getByTestId('stl-viewer').locator('canvas');
  const printed = await canvas.screenshot();
  await slider.press('End');
  await slider.press('Home');
  expect(await canvas.screenshot()).toEqual(printed);
  await slider.press('Home');
  const captions = ['Lift and lay out the parts', ...assembly.steps.map((step, i) => `Step ${i + 1} of 3 · ${step.title}`),
    ...(assembly.motion ?? []).map((movement, i) => `Movement ${i + 1} of 2 · ${movement.title}`)];
  expect(captions).toHaveLength(6);
  for (const caption of captions) {
    await slider.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', caption);
  }
  await page.getByRole('button', { name: 'Play assembly', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause assembly', exact: true })).toBeVisible();
  await expect(slider).toHaveAttribute('aria-valuetext', captions.at(-1) ?? '', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Play assembly', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('trolley-token-assembled.png'), fullPage: true });
  await page.getByTitle('Hide Shopping-list clamp', { exact: true }).click();
  await expect(page.getByTitle('Show Shopping-list clamp', { exact: true })).toBeVisible();
  await page.getByTitle('Show Shopping-list clamp', { exact: true }).click();
  const pending = page.waitForEvent('download');
  await download.click();
  const path = await (await pending).path();
  if (!path) throw new Error('Expected the completed print ZIP.');
  const entries = unzipSync(new Uint8Array(await readFile(path)));
  expect(Object.keys(entries)).toEqual(['body.stl', 'clip.stl']);
  for (const [id, dimensions] of [['body', [51.625, 30, 8]], ['clip', [25, 30, 7]]] as const) {
    const stl = Buffer.from(entries[`${id}.stl`] ?? []), info = inspectStl(stl);
    expect(stl.subarray(0, 80).toString()).toContain('jhappone');
    expect(stl.subarray(0, 80).toString()).toContain('CC BY 4.0');
    for (const [i, axis] of (['x', 'y', 'z'] as const).entries()) expect(Math.abs(info.dimensions[axis] - (dimensions[i] ?? NaN))).toBeLessThan(0.02);
  }
  expect(errors).toEqual([]);
});
