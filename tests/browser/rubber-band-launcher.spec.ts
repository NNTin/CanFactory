import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { inspectStl } from '@canfactory/server';
import { rubberBandLauncher as model } from '@canfactory/contracts';

test('previews FerryTeacher’s launcher, pulls its trigger and downloads both attributed prints', async ({ page }, testInfo) => {
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
  await expect(page.getByText(/Print both parts together, in place/)).toBeVisible();
  await expect(page.getByTitle('Hide Frame', { exact: true })).toBeVisible();
  await expect(page.getByTitle('Hide Trigger', { exact: true })).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  await slider.press('Home');
  const captions = ['Lift and lay out the parts', 'Step 1 of 1 · Printed in place: the trigger already sits on its pins inside the frame', 'Movement 1 of 2 · Pull the trigger to its stop', 'Movement 2 of 2 · Release the trigger'];
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
  expect(Object.keys(entries)).toEqual(['frame.stl', 'trigger.stl']);
  for (const [id, dimensions] of [['frame', [126.875, 20.6, 109.613]], ['trigger', [46.341, 16.569, 57.087]]] as const) {
    const stl = Buffer.from(entries[`${id}.stl`] ?? []), info = inspectStl(stl);
    expect(stl.subarray(0, 80).toString()).toContain('FerryTeacher');
    expect(stl.subarray(0, 80).toString()).toContain('CC BY-NC-SA');
    for (const [i, axis] of (['x', 'y', 'z'] as const).entries()) expect(Math.abs(info.dimensions[axis] - (dimensions[i] ?? NaN))).toBeLessThan(0.1);
  }
  expect(errors).toEqual([]);
});
