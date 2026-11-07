import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { inspectStl } from '@canfactory/server';
import { wandHolder as model, wandHolderLayout, DEFAULT_WAND_HOLDER, WAND_HOLDER } from '@canfactory/contracts';

test('the card shows the holder on a post with a wand, and the clip from above', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: model.title });
  const art = card.locator('svg.wand-holder-illustration');
  await expect(art).toBeVisible();
  const box = await art.boundingBox();
  expect(box?.width).toBeCloseTo(250, 0);
  await expect(art).toContainText(`POSTS ${WAND_HOLDER.postMin}–${WAND_HOLDER.postMax} MM`);
  expect(errors).toEqual([]);
});

test('previews the clip snapping round the post, and downloads a deeper socket for a thicker handle', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  await page.locator('.model-card', { hasText: model.title }).click();
  await expect(page).toHaveURL(new RegExp(`/#/models/${model.id}$`));
  const download = page.getByRole('button', { name: 'Download ZIP' });
  await expect(download).toBeEnabled();
  // the grip range and the bend are worked out for the fixed clip; there is no post-diameter setting
  await expect(page.getByText(`Grips posts ${WAND_HOLDER.postMin} to ${WAND_HOLDER.postMax} mm across the rope`)).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: /post/i })).toHaveCount(0);
  // the parts list names the clip and the post it is shown on
  await expect(page.getByTitle('Hide Wand holder: post clip with wand socket', { exact: true })).toBeVisible();
  await expect(page.getByTitle(/^Hide TRIXIE replacement sisal trunk/)).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  await slider.press('Home');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Lift and lay out the parts');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', /^Step 1 of 2 · Press the clip’s mouth against the post/);
  // the next stop is the end of step 2: the arms sprung shut round the post
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Assembled');
  await page.screenshot({ path: testInfo.outputPath('wand-holder-assembly.png'), fullPage: true });
  // a 10 mm handle in a 50 mm socket
  for (const [name, value] of [['Wand handle diameter', '10'], ['Socket depth', '50']] as const) {
    const field = page.getByRole('spinbutton', { name });
    await field.fill(value);
    await field.press('Enter');
  }
  await expect(download).toBeEnabled();
  const pending = page.waitForEvent('download');
  await download.click();
  const path = await (await pending).path();
  if (!path) throw new Error('Expected a completed ZIP download.');
  const entries = unzipSync(new Uint8Array(await readFile(path)));
  expect(Object.keys(entries)).toEqual(['clip.stl']);
  const clip = Buffer.from(entries['clip.stl'] ?? []);
  expect(new TextDecoder().decode(clip.subarray(0, 80))).toContain('CanFactory');
  const l = wandHolderLayout({ ...DEFAULT_WAND_HOLDER, handleDiameter: 10, socketDepth: 50 });
  expect(inspectStl(clip).dimensions.z).toBeCloseTo(l.tubeHeight, 1);
  expect(errors).toEqual([]);
});
