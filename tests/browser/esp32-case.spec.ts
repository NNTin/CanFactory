import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { esp32C3SuperminiCase as model, ESP32_CASE_HEADER } from '@canfactory/contracts';

test('previews LED openings, board and headers, plays assembly and downloads all four opening combinations', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: model.title });
  await expect(card.getByRole('img', { name: 'ESP32-C3 SuperMini case: assembled and sliding lid views' })).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/#/models/${model.id}$`));
  const download = page.getByRole('button', { name: 'Download ZIP' });
  await expect(download).toBeEnabled();
  const toggle = page.getByRole('switch', { name: 'LED openings', exact: true });
  await expect(toggle).toBeChecked();
  const flushToggle = page.getByRole('switch', { name: 'Flush pin headers', exact: true });
  await expect(flushToggle).toBeChecked();
  await expect(page.getByRole('link', { name: 'MakerOnline', exact: true })).toHaveAttribute('href', /makeronline.com/);
  await expect(page.getByRole('link', { name: model.license, exact: true })).toHaveAttribute('href', model.licenseUrl);
  await expect(page.getByTitle('Hide ESP32-C3 SuperMini', { exact: true })).toBeVisible();
  for (const row of [1, 2]) await expect(page.getByTitle(`Hide Würth 1 × 8 straight pin header, 2.54 mm (row ${row})`, { exact: true })).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  await slider.press('Home');
  for (const caption of ['Lift and lay out the parts', 'Step 1 of 2 · With the board seated, insert both headers from below and solder', 'Assembled']) {
    await slider.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', caption);
  }
  await page.getByRole('button', { name: 'Play assembly', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause assembly', exact: true })).toBeVisible();
  await expect(slider).toHaveAttribute('aria-valuetext', 'Assembled', { timeout: 25_000 });
  await page.getByTitle('Hide Sliding button lid').click();
  await expect(page.getByTitle('Show Sliding button lid')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('esp32-case-electronics.png'), fullPage: true });
  await page.getByTitle('Show Sliding button lid').click();
  const variants: { ledHoles: boolean; flushHeaders: boolean; base: Uint8Array; lid: Uint8Array }[] = [];
  for (const enabled of [true, false]) for (const flushHeaders of [true, false]) {
    await toggle.setChecked(enabled);
    await flushToggle.setChecked(flushHeaders);
    await expect(download).toBeEnabled();
    const pending = page.waitForEvent('download');
    await download.click();
    const file = await pending, path = await file.path();
    if (!path) throw new Error('Expected a completed ZIP download.');
    const entries = unzipSync(new Uint8Array(await readFile(path)));
    expect(Object.keys(entries)).toEqual(['bottom.stl', 'top.stl']);
    for (const stl of Object.values(entries)) {
      const header = new TextDecoder().decode(stl.subarray(0, 80));
      expect(header).toContain('Vinors3DLab');
      expect(header).toContain('CC BY-NC-SA 4.0');
    }
    const lid = entries['top.stl']; if (!lid) throw new Error('Missing lid');
    const base = entries['bottom.stl']; if (!base) throw new Error('Missing base');
    variants.push({ ledHoles: enabled, flushHeaders, base, lid });
    if (!flushHeaders) await expect(page.getByText('Original narrow slots: pin-header insulators stay outside the case floor.')).toBeVisible();
    if (!enabled) await expect(page.getByText('Closed lid: LED openings disabled.')).toBeVisible();
  }
  for (const a of variants) for (const b of variants) {
    expect(Buffer.from(a.base).equals(Buffer.from(b.base))).toBe(a.flushHeaders === b.flushHeaders);
    expect(Buffer.from(a.lid).equals(Buffer.from(b.lid))).toBe(a.ledHoles === b.ledHoles);
  }
  expect(errors).toEqual([]);
});

test('the new eight-pin headers have a library preview, dimensions, source and model usage', async ({ page }) => {
  await page.goto(`/#/parts/pin-header/${ESP32_CASE_HEADER}`);
  const details = page.getByRole('article', { name: 'Würth 1 × 8 straight pin header, 2.54 mm details' });
  await expect(details).toBeVisible();
  await expect(details.getByRole('link', { name: /ESP32-C3 SuperMini case/ })).toBeVisible();
  await expect(details.getByRole('link', { name: /WR-PHD 61300811121/ })).toBeVisible();
  await expect(page.getByTestId('parts-viewer')).toHaveAttribute('data-parts', ESP32_CASE_HEADER);
  await expect(page.locator('canvas')).toBeVisible();
});
