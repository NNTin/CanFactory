import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { inspectStl } from '@canfactory/server';
import { magneticLighterKeychain as model, lighterKeychainLayout, DEFAULT_LIGHTER_KEYCHAIN } from '@canfactory/contracts';

test('the card shows the lighter hanging from the keychain, and on a fridge by its flat foot', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: model.title });
  const art = card.locator('svg.lighter-keychain-illustration');
  await expect(art).toBeVisible();
  const box = await art.boundingBox();
  expect(box?.width).toBeCloseTo(250, 0);
  await expect(art).toContainText('FLAT FOOT: A FRIDGE MAGNET');
  expect(errors).toEqual([]);
});

test('previews the holder on the lighter and the keychain on its magnets, and downloads the four prints for 6 × 3 mm magnets', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  await page.locator('.model-card', { hasText: model.title }).click();
  await expect(page).toHaveURL(new RegExp(`/#/models/${model.id}$`));
  const download = page.getByRole('button', { name: 'Download ZIP' });
  await expect(download).toBeEnabled();
  // the pause and the polarity are worked out for the chosen magnet and layer height
  await expect(page.getByText('pause the print at 2.6 mm, before layer 14 at 0.2 mm layers', { exact: false })).toBeVisible();
  await expect(page.getByText('stack all 4 magnets into one column', { exact: false })).toBeVisible();
  // the parts list names the four prints, the lighter and the linked magnets and ring
  for (const title of ['Lighter holder', 'Keychain holder', 'Lighter fit check (a ring of the sleeve)', 'BIC Mini lighter (J25)'])
    await expect(page.getByTitle(`Hide ${title}`, { exact: true })).toBeVisible();
  await expect(page.getByTitle(/^Hide Split ring .*through the eyelet/)).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  await slider.press('Home');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Lift and lay out the parts');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', /^Step 1 of 2 · Slide the lighter into the holder/);
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Assembled');
  await page.screenshot({ path: testInfo.outputPath('magnetic-lighter-keychain-assembly.png'), fullPage: true });
  // thicker magnets: the floor (and the pause) rise with them
  await page.getByRole('combobox', { name: 'Magnets', exact: true }).selectOption('supermagnete-s-06-03-n');
  await expect(page.getByText('pause the print at 3.6 mm', { exact: false })).toBeVisible();
  await expect(download).toBeEnabled();
  const pending = page.waitForEvent('download');
  await download.click();
  const path = await (await pending).path();
  if (!path) throw new Error('Expected a completed ZIP download.');
  const entries = unzipSync(new Uint8Array(await readFile(path)));
  expect(Object.keys(entries)).toEqual(['lighter-fit-check.stl', 'keychain-fit-check.stl', 'keychain-holder.stl', 'lighter-holder.stl']);
  const l = lighterKeychainLayout({ ...DEFAULT_LIGHTER_KEYCHAIN, magnet: 'supermagnete-s-06-03-n' });
  const holder = Buffer.from(entries['lighter-holder.stl'] ?? []);
  expect(new TextDecoder().decode(holder.subarray(0, 80))).toContain('CanFactory');
  expect(inspectStl(holder, { allowVoids: true }).dimensions.z).toBeCloseTo(l.top, 1);
  expect(inspectStl(Buffer.from(entries['lighter-fit-check.stl'] ?? [])).dimensions.z).toBeCloseTo(10, 1);
  expect(errors).toEqual([]);
});
