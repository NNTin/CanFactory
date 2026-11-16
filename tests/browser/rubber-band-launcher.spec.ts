import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { inspectStl } from '@canfactory/server';
import { rubberBandLauncher as model } from '@canfactory/contracts';

test('previews FerryTeacher’s launcher as one print-in-place piece, pulls its trigger and downloads the one attributed print', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: model.title });
  await expect(card.getByRole('img', { name: 'Rubber band launcher with its trigger between the frame\'s side plates' })).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/#\/models\/rubber-band-launcher$/);
  const download = page.getByRole('button', { name: 'Download ZIP', exact: true });
  await expect(download).toBeEnabled();
  await expect(page.getByRole('link', { name: 'FerryTeacher', exact: true })).toHaveAttribute('href', 'https://cults3d.com/en/users/FerryTeacher');
  await expect(page.getByRole('link', { name: 'Cults3D', exact: true })).toHaveAttribute('href', 'https://cults3d.com/en/3d-model/game/rubber-band-launcher');
  await expect(page.getByRole('link', { name: 'CC BY-NC-SA', exact: true })).toHaveAttribute('href', model.licenseUrl);
  await expect(page.getByText(/One print: the trigger is printed in place on its pins/)).toBeVisible();
  await expect(page.getByText(/2 moving parts are printed in place, together, and cannot be put together afterwards/)).toBeVisible();
  await expect(page.getByText('2 bodies printed in place', { exact: false })).toBeVisible();
  await expect(page.getByTitle('Hide Frame', { exact: true })).toBeVisible();
  await expect(page.getByTitle('Hide Trigger', { exact: true })).toBeVisible();
  // the two bodies of the one print lie together on the bed, as printed, and both are shown
  const viewer = page.getByTestId('stl-viewer');
  await expect(viewer).toHaveAttribute('data-bed-cells', '1');
  await expect(viewer).toHaveAttribute('data-visible-parts', 'frame trigger');
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  await slider.press('Home');
  const captions = ['As printed', 'Step 1 of 1 · Free the trigger: work it gently until it turns on its pins', 'Movement 1 of 2 · Pull the trigger to its stop', 'Movement 2 of 2 · Release the trigger'];
  for (const caption of captions) {
    await slider.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', caption);
  }
  await page.screenshot({ path: testInfo.outputPath('rubber-band-launcher-released.png'), fullPage: true });
  const pending = page.waitForEvent('download');
  await download.click();
  const path = await (await pending).path();
  if (!path) throw new Error('Expected the completed print ZIP.');
  const entries = unzipSync(new Uint8Array(await readFile(path)));
  // one print, both bodies: nothing to print separately and put together
  expect(Object.keys(entries)).toEqual(['launcher.stl']);
  const stl = Buffer.from(entries['launcher.stl'] ?? []), info = inspectStl(stl, { allowDisconnected: true });
  expect(stl.subarray(0, 80).toString()).toContain('FerryTeacher');
  expect(stl.subarray(0, 80).toString()).toContain('CC BY-NC-SA');
  for (const [i, axis] of (['x', 'y', 'z'] as const).entries()) expect(Math.abs(info.dimensions[axis] - ([126.875, 20.6, 109.613][i] ?? NaN))).toBeLessThan(0.1);
  expect(errors).toEqual([]);
});
