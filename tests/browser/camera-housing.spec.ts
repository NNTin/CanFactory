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
    'Step 1 of 3 · Seat the camera stack in the guides; route battery and antenna leads',
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

test('optional cooling grows the shell and previews fan hardware; rear mounts also accept nuts', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models/xiao-sense-camera-housing');
  const download = page.getByRole('button', { name: 'Download ZIP' });
  await expect(download).toBeEnabled();
  const fan = page.getByRole('combobox', { name: 'Fan', exact: true });
  await expect(fan).toBeDisabled();
  await page.getByLabel('Rear mounting', { exact: true }).selectOption('nut');
  await expect(page.getByRole('combobox', { name: 'Mounting inserts', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Mounting nuts', exact: true })).toBeVisible();
  await page.getByLabel('Cooling fan', { exact: true }).check();
  await expect(fan).toBeEnabled();
  await page.getByLabel('Ventilation', { exact: true }).uncheck();
  await expect(page.getByText(/Assembled envelope: 48.0 × 103.0 × 24.20 mm/)).toBeVisible();
  await expect(download).toBeEnabled();
  await expect(page.getByTitle(/Hide Noctua 40 mm 5 V PWM fan/)).toBeVisible();
  await expect(page.locator('[data-visible-parts]')).toHaveAttribute('data-visible-parts', /cooling-fan/);
  await expect(page.getByText(/no thermal-performance guarantee/)).toBeVisible();
  await fan.selectOption('sunon-mf30100v2-1000u-a99');
  await expect(page.getByText(/Assembled envelope: 48.0 × 93.5 × 24.20 mm/)).toBeVisible();
  await expect(download).toBeEnabled();
  await expect(page.getByTitle(/Hide Sunon 30 mm 5 V fan/)).toBeVisible();
  const pending = page.waitForEvent('download');
  await download.click();
  const file = await pending, path = await file.path();
  if (!path) throw new Error('Expected a completed ZIP download.');
  const { readFile } = await import('node:fs/promises');
  expect(Object.keys(unzipSync(new Uint8Array(await readFile(path))))).toEqual(['base.stl', 'lid.stl']);
  await page.getByLabel('Cooling fan', { exact: true }).uncheck();
  await expect(page.getByText(/Assembled envelope: 48.0 × 46.0 × 24.20 mm/)).toBeVisible();
  await expect(download).toBeEnabled();
  await expect(page.getByTitle(/Hide Sunon 30 mm 5 V fan/)).toHaveCount(0);
  await page.goto('/#/parts/fan/noctua-nf-a4x10-5v-pwm');
  await expect(page.getByRole('article', { name: /Noctua 40 mm 5 V PWM fan/ })).toBeVisible();
  expect(errors).toEqual([]);
});
