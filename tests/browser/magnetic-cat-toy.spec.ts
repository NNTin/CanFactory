import { test, expect } from '@playwright/test';
import { magneticCatToy } from '@canfactory/contracts';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';

test('shows an original four-layer SVG card and a live bottom-to-top assembly including the ball', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: magneticCatToy.title });
  const art = card.getByRole('img', { name: 'Magnetic cat toy: grid, thin field, magnetic ball and slotted cover' });
  await expect(art).toBeVisible();
  for (const layer of ['grid', 'field', 'ball', 'cover']) await expect(art.locator(`[data-layer="${layer}"]`)).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/#\/models\/magnetic-cat-toy/);
  await expect(page.getByText(/Static magnetic puzzle, not a self-moving toy/)).toBeVisible();
  const download = page.getByRole('button', { name: 'Download ZIP' });
  await expect(download).toBeEnabled();
  const slider = page.getByRole('slider', { name: 'Assembly' });
  await expect(slider).toBeVisible();
  await slider.press('Home');
  for (const caption of ['Lift and lay out the parts',
    'Step 1 of 6 · Bond the caps over the four grid magnets',
    'Step 2 of 6 · Seat the repositionable holders in the socket grid',
    'Step 3 of 6 · Seat the thin playing field, smooth face up',
    'Step 4 of 6 · Bond the ball halves around the selected magnet mount',
    'Step 5 of 6 · Place the magnetic ball on the playing field', 'Assembled']) {
    await slider.press('ArrowRight'); await expect(slider).toHaveAttribute('aria-valuetext', caption);
  }
  await slider.press('Home');
  await page.getByRole('button', { name: 'Play assembly', exact: true }).click();
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause assembly', exact: true }).click();
  await slider.press('End');
  await expect(page.getByTitle('Hide Protective slotted cover')).toBeVisible();
  await expect(page.getByTitle('Hide Ball lower half')).toBeVisible();
  await expect(page.locator('[data-visible-parts]')).toHaveAttribute('data-visible-parts', /ball-magnet/);
  const pending = page.waitForEvent('download'); await download.click();
  const file = await pending, path = await file.path(); if (!path) throw new Error('Expected ZIP path');
  expect(Object.keys(unzipSync(new Uint8Array(await readFile(path))))).toEqual(magneticCatToy.parts.map(p => `${p.id}.stl`));
  expect(errors).toEqual([]);
});

test('configures real library magnets, eccentric seat and modular layout, rejecting an escapable ball', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#/models/magnetic-cat-toy');
  const download = page.getByRole('button', { name: 'Download ZIP' });
  await expect(download).toBeEnabled();
  await expect(page.getByRole('spinbutton', { name: 'Eccentric offset', exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Ball magnet placement', exact: true }).selectOption('eccentric');
  await expect(page.getByRole('spinbutton', { name: 'Eccentric offset', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Holder layout', exact: true }).selectOption('cluster');
  await page.getByRole('combobox', { name: 'Grid magnets', exact: true }).selectOption('supermagnete-s-12-02-n');
  await page.getByRole('combobox', { name: 'Ball magnet', exact: true }).selectOption('supermagnete-s-08-03-n');
  await expect(page.getByText(/Ball seat: eccentric, 6 mm radial offset/)).toBeVisible();
  await expect(page.getByText(/cluster preview layout/)).toBeVisible();
  await expect(download).toBeEnabled();
  await page.getByRole('spinbutton', { name: 'Paw slot width', exact: true }).fill('24');
  await expect(page.getByRole('alert')).toContainText('60% of the ball diameter');
  await expect(download).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Ball diameter', exact: true }).fill('44');
  await expect(download).toBeEnabled();
  await expect(page.getByText(/24 × 116 mm/)).toBeVisible();
  // Verify the preview's real visibility control, not just a static illustration.
  await page.getByTitle('Hide Protective slotted cover').click();
  await expect(page.getByTitle('Show Protective slotted cover')).toBeVisible();
  expect(errors).toEqual([]);
});
