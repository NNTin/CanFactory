import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { inspectStl } from '@canfactory/server';
import { miterBox as model, miterBoxLayout, DEFAULT_MITER_BOX, MITER_BOX_PARTS } from '@canfactory/contracts';

test('the card shows the box from above, and on hover its guide swings to the stops', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: model.title });
  const art = card.locator('svg.miter-box-illustration');
  await expect(art).toBeVisible();
  const box = await art.boundingBox();
  expect(box?.width).toBeCloseTo(250, 0);
  const guide = art.locator('.mb-guide').first();
  const angle = () => guide.evaluate(element => { const m = new DOMMatrixReadOnly(getComputedStyle(element).transform); return Math.atan2(m.b, m.a) * 180 / Math.PI; });
  expect(await angle()).toBe(0);
  await card.hover();
  await expect.poll(angle, { timeout: 3_000, intervals: [50] }).toBeGreaterThan(30);
  await expect.poll(angle, { timeout: 4_000, intervals: [50] }).toBeLessThan(-15);
  await page.mouse.move(0, 0);
  await expect.poll(angle).toBe(0);
  expect(errors).toEqual([]);
});

test('previews the assembly and its movements, sizes the saw slots and downloads the eleven parts', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  await page.locator('.model-card', { hasText: model.title }).click();
  await expect(page).toHaveURL(new RegExp(`/#/models/${model.id}$`));
  const download = page.getByRole('button', { name: 'Download ZIP' });
  await expect(download).toBeEnabled();
  // the parts list names the printed parts and the library hardware
  for (const title of ['Turntable with the two slotted guide posts', 'Hold-down, left', 'Knob, angle lock']) await expect(page.getByTitle(`Hide ${title}`, { exact: true })).toBeVisible();
  await expect(page.getByTitle(/^Hide Hardened dowel pin 5 × 20/).first()).toBeVisible();
  // the slider: the steps, then the guide's and the clamps' movements
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  await slider.press('Home');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Lift and lay out the parts');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', /^Step 1 of 11 · Press a nut into each pocket under the base/);
  await slider.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', /Screw the pads down onto the stock/);
  await page.screenshot({ path: testInfo.outputPath('miter-box-assembly.png'), fullPage: true });
  // a finer saw: narrower slots in the turntable's posts
  const kerf = page.getByRole('spinbutton', { name: 'Saw kerf' });
  await kerf.fill('0.6');
  await kerf.press('Enter');
  await expect(download).toBeEnabled();
  const pending = page.waitForEvent('download');
  await download.click();
  const path = await (await pending).path();
  if (!path) throw new Error('Expected a completed ZIP download.');
  const entries = unzipSync(new Uint8Array(await readFile(path)));
  expect(Object.keys(entries)).toEqual(MITER_BOX_PARTS.map(id => `${id}.stl`));
  const l = miterBoxLayout({ ...DEFAULT_MITER_BOX, bladeKerf: 0.6 });
  for (const [name, stl] of Object.entries(entries)) {
    expect(new TextDecoder().decode(stl.subarray(0, 80)), name).toContain('CanFactory');
    expect(inspectStl(Buffer.from(stl)).triangles, name).toBeGreaterThan(0);
  }
  expect(inspectStl(Buffer.from(entries['turntable.stl'] ?? [])).dimensions.z).toBeCloseTo(7 + l.postHeight, 1);
  expect(errors).toEqual([]);
});
