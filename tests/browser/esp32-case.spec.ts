import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { esp32C3SuperminiCase as model } from '@canfactory/contracts';

test('previews the original ESP32 case, plays the sliding assembly and downloads attributed parts', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: model.title });
  await expect(card.getByRole('img', { name: 'ESP32-C3 SuperMini case: assembled and sliding lid views' })).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/#/models/${model.id}$`));
  const download = page.getByRole('button', { name: 'Download ZIP' });
  await expect(download).toBeEnabled();
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  const credit = page.getByRole('link', { name: 'Vinors3DLab (MakerWorld)' });
  await expect(credit).toHaveAttribute('href', model.attributionLinks[0]?.url ?? '');
  await expect(page.getByRole('link', { name: model.license, exact: true })).toHaveAttribute('href', model.licenseUrl);
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  await expect(slider).toBeVisible();
  await slider.press('Home');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Lift and lay out the parts');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Assembled');
  await page.getByRole('button', { name: 'Play assembly', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause assembly', exact: true })).toBeVisible();
  await expect(slider).toHaveAttribute('aria-valuetext', 'Assembled', { timeout: 20_000 });
  await expect(page.getByTitle('Hide Case base')).toBeVisible();
  await page.getByTitle('Hide Sliding button lid').click();
  await expect(page.getByTitle('Show Sliding button lid')).toBeVisible();
  await page.getByTitle('Show Sliding button lid').click();
  const pending = page.waitForEvent('download');
  await download.click();
  const file = await pending, path = await file.path();
  if (!path) throw new Error('Expected a completed ZIP download.');
  const entries = unzipSync(new Uint8Array(await readFile(path)));
  expect(Object.keys(entries)).toEqual(['bottom.stl', 'top.stl']);
  for (const stl of Object.values(entries)) {
    const header = new TextDecoder().decode(stl.subarray(0, 80));
    expect(header).toContain('Vinors3DLab');
    expect(header).toContain('CC BY-NC-ND 4.0');
  }
  await page.screenshot({ path: testInfo.outputPath('esp32-case-preview.png'), fullPage: true });
  expect(errors).toEqual([]);
});
