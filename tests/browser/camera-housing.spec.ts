import { test, expect } from '@playwright/test';
import { cameraHousing } from '@canfactory/contracts';
import { unzipSync } from 'fflate';

test('the camera housing card shows assembled and exploded SVG views; its board is in the library', async ({ page }) => {
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: cameraHousing.title });
  const art = card.getByRole('img', { name: 'XIAO Sense housing: assembled and exploded views' });
  await expect(art).toBeVisible();
  await expect(art.locator('[data-view="assembled"]')).toBeVisible();
  await expect(art.locator('[data-view="exploded"]')).toBeVisible();
  await page.goto('/#/parts/dev-board?chip=ESP32-S3');
  await expect(page.getByLabel('Chip')).toHaveValue('ESP32-S3');
  await page.goto('/#/parts/dev-board/seeed-xiao-esp32s3-sense');
  await expect(page.getByRole('article', { name: /Seeed Studio XIAO ESP32-S3 Sense/ })).toBeVisible();
});

test('customizes the enclosure, renders the camera/hardware assembly, and downloads only the two prints', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models/xiao-sense-camera-housing');
  await expect(page.getByText(/Not physically fit-tested/)).toBeVisible();
  const download = page.getByRole('button', { name: 'Download ZIP' });
  await expect(download).toBeEnabled();
  const slider = page.getByRole('slider', { name: 'Assembly' });
  await expect(slider).toBeVisible();
  await slider.press('Home');
  for (const caption of ['Lift and lay out the parts',
    'Step 1 of 3 · Bond the heatsink to the backside thermal pad, then seat the camera stack and route leads',
    'Step 2 of 3 · Lower the camera hood over the stack',
    'Assembled']) {
    await slider.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', caption);
  }
  await expect(page.getByTitle('Hide Camera hood')).toBeVisible();
  await expect(page.getByTitle(/Hide Seeed Studio XIAO ESP32-S3 Sense/)).toBeVisible();
  const pending = page.waitForEvent('download');
  await download.click();
  const file = await pending, path = await file.path();
  if (!path) throw new Error('Expected a completed ZIP download.');
  const { readFile } = await import('node:fs/promises');
  expect(Object.keys(unzipSync(new Uint8Array(await readFile(path))))).toEqual(['base.stl', 'lid.stl']);
  await page.getByRole('spinbutton', { name: 'Mount spacing', exact: true }).fill('60');
  await expect(page.getByRole('alert')).toContainText('Widen the housing');
  await expect(download).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Housing width', exact: true }).fill('80');
  await expect(download).toBeEnabled();
  await expect(page.getByText(/rear mount centres 60 mm apart/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('default passive cooling grows height and previews the sink; disabling it restores the compact shell', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models/xiao-sense-camera-housing');
  const download = page.getByRole('button', { name: 'Download ZIP' });
  const enabled = page.getByLabel('Heatsink', { exact: true });
  const sink = page.getByRole('combobox', { name: 'Heatsink part', exact: true });
  await expect(enabled).toBeChecked();
  await expect(sink).toBeEnabled();
  await expect(page.getByText(/Assembled envelope: 48.0 × 46.0 × 32.40 mm/)).toBeVisible();
  await expect(download).toBeEnabled();
  await expect(page.locator('[data-visible-parts]')).toHaveAttribute('data-visible-parts', /cooling-heatsink/);
  await expect(page.getByTitle(/Hide Seeed XIAO 10 mm heatsink/)).toBeVisible();
  await expect(page.getByText(/no thermal-performance guarantee/)).toBeVisible();
  await expect(page.getByLabel('Cooling fan', { exact: true })).toHaveCount(0);
  await page.getByLabel('Rear mounting', { exact: true }).selectOption('nut');
  await expect(page.getByRole('combobox', { name: 'Mounting inserts', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Mounting nuts', exact: true })).toBeVisible();
  await sink.selectOption('same-sky-hsb02-101007');
  await expect(page.getByText(/Assembled envelope: 48.0 × 46.0 × 29.78 mm/)).toBeVisible();
  await expect(download).toBeEnabled();
  await expect(page.getByTitle(/Hide Same Sky 10 × 10 × 7 mm heatsink/)).toBeVisible();
  await enabled.uncheck();
  await expect(sink).toBeDisabled();
  await expect(page.getByText(/Assembled envelope: 48.0 × 46.0 × 24.20 mm/)).toBeVisible();
  await expect(download).toBeEnabled();
  await expect(page.getByTitle(/Hide Same Sky 10 × 10 × 7 mm heatsink/)).toHaveCount(0);
  await page.goto('/#/parts/heatsink/seeed-xiao-aluminium-heatsink');
  await expect(page.getByRole('article', { name: /Seeed XIAO 10 mm heatsink/ })).toBeVisible();
  await expect(page.getByText(/NOT a manufacturer dimension/)).toBeVisible();
  expect(errors).toEqual([]);
});
