import { test, expect, type Page } from '@playwright/test';
import { findPart } from '@canfactory/contracts';

/** Waits until the parts preview has built its scene, and returns the ids it shows. */
async function shownParts(page: Page): Promise<string[]> {
  const viewer = page.getByTestId('parts-viewer');
  await expect(page.getByText('Preparing the parts')).toHaveCount(0, { timeout: 60_000 });
  await expect(viewer).toHaveAttribute('data-parts', /\S/);
  return (await viewer.getAttribute('data-parts'))?.split(' ') ?? [];
}

/** Moves the pointer over the preview until a part is under it, and returns the id of that part. */
async function hoverSomePart(page: Page): Promise<string> {
  const viewer = page.getByTestId('parts-viewer');
  const box = await viewer.boundingBox();
  if (!box) throw new Error('No preview');
  for (let y = box.y + box.height * 0.3; y < box.y + box.height * 0.85; y += 10) {
    for (let x = box.x + box.width * 0.25; x < box.x + box.width * 0.75; x += 10) {
      await page.mouse.move(x, y);
      const id = await viewer.getAttribute('data-highlighted');
      if (id) return id;
    }
  }
  throw new Error('No part found under the pointer');
}

test('browses the parts library: families, filters in the link, a hovered part named in the preview, and its details', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/parts');
  await expect(page.getByRole('heading', { name: 'Real parts. Exact sizes.' })).toBeVisible();
  // "Wood screws" is a family too: match the metric screws' card only.
  await page.getByRole('button', { name: /PARTS Screws Metric/ }).click();
  await expect(page).toHaveURL(/#\/parts\/screw$/);
  await page.getByLabel('Thread').selectOption('M3');
  await page.getByLabel('Head').selectOption('socket-cap');
  await expect(page).toHaveURL(/#\/parts\/screw\?thread=M3&head=socket-cap$/);
  const shown = await shownParts(page);
  expect(shown.every(id => id.startsWith('iso-4762-m3x'))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('screws.png'), fullPage: true });

  // Hovering a part in the list highlights it in the preview and names it under the preview.
  await page.getByRole('button', { name: /ISO 4762 M3 × 16/ }).hover();
  await expect(page.getByTestId('parts-viewer')).toHaveAttribute('data-highlighted', 'iso-4762-m3x16');
  await expect(page.getByTestId('part-caption')).toContainText(findPart('iso-4762-m3x16')?.description ?? 'missing');

  // Hovering a part in the preview highlights it and shows its title and description beside the pointer.
  const hovered = await hoverSomePart(page);
  const part = findPart(hovered);
  if (!part) throw new Error(`Unknown part ${hovered}`);
  await expect(page.getByRole('tooltip')).toContainText(part.title);
  await expect(page.getByRole('tooltip')).toContainText(part.description);
  await page.screenshot({ path: testInfo.outputPath('hover.png') });

  // Selecting a part links to it and shows its dimensions and sources.
  await page.getByRole('button', { name: /ISO 4762 M3 × 16/ }).click();
  await expect(page).toHaveURL(/#\/parts\/screw\/iso-4762-m3x16\?thread=M3&head=socket-cap$/);
  const details = page.getByRole('article', { name: 'Socket head cap screw M3 × 16 details' });
  await expect(details.getByRole('row', { name: /dk Head diameter 5.5 5.32 5.5 Standard/ })).toBeVisible();
  await expect(details.getByRole('link', { name: 'ISO 4762 dimension table' })).toHaveAttribute('href', 'https://www.fasteners.eu/standards/ISO/4762/');
  await expect(details.getByRole('link', { name: 'Plank connector' })).toBeVisible();

  // The link works on its own, as a fresh page.
  await page.goto('/#/parts/everyday-object/bic-j25-mini-lighter');
  expect(await shownParts(page)).toEqual(['bic-j25-mini-lighter']);
  await expect(page.getByRole('article', { name: 'BIC Mini lighter (J25) details' }).getByText('Estimated').first()).toBeVisible();

  // The window catio's hardware families build their previews from their own dimensions.
  for (const [family, first] of [['levelling-foot?thread=M8', 'ganter-gn-343-2-25-m8-40-kr'], ['insert-nut', 'din-7965-m6x15'], ['nail', 'din-1159-2-5x25'], ['wood-screw?diameter=4+mm', 'din-7997-4x20'], ['screen-hook', 'windhager-03651-5a'], ['corner-bracket', 'gah-alberts-stuhlwinkel-25x25x14']] as const) {
    await page.goto(`/#/parts/${family}`);
    expect(await shownParts(page)).toContain(first);
  }
  // A part the window insert can use (the bought flat corner bracket, the alternative to its printed one) links back to that
  // concept page, and the link opens it, with its default printed bracket.
  await page.goto('/#/parts/corner-bracket/gah-alberts-stuhlwinkel-100x100x19');
  const used = page.getByRole('article', { name: 'Flat corner bracket 100 × 100 × 19 details' }).getByRole('link', { name: 'Window catio: window insert' });
  await expect(used).toHaveAttribute('href', '#/concepts/catio/window-insert');
  await used.click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/window-insert$/);
  await expect(page.getByRole('table', { name: 'Hardware parts' }).getByRole('link', { name: 'Printed corner bracket' })).toHaveAttribute('href', '#/models/printed-corner-bracket');
  expect(errors).toEqual([]);
});

test('links a model’s part choice to the library, and comes back', async ({ page }) => {
  await page.goto('/#/models/plank-connector');
  await page.getByLabel('Screw holes').selectOption('M4');
  await page.getByRole('link', { name: 'See the M4 screws in the parts library' }).click();
  await expect(page).toHaveURL(/#\/parts\/screw\?thread=M4$/);
  await expect(page.getByLabel('Thread')).toHaveValue('M4');
  expect((await shownParts(page)).every(id => /-m4x\d+$/.test(id))).toBe(true);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Plank connector', exact: true })).toBeVisible();
  await page.getByLabel('Screw holes').selectOption('none');
  await expect(page.getByRole('link', { name: /parts library/ })).toHaveCount(0);
});

test('sizes the cigarette case’s magnet pockets for a library magnet, and shows the magnets in the assembly', async ({ page }, testInfo) => {
  await page.goto('/#/models/cigarette-case');
  await expect(page.getByLabel('Magnets', { exact: true })).toHaveCount(0);
  await page.getByLabel('Case lid snap').selectOption('magnet');
  const magnets = page.getByLabel('Magnets', { exact: true });
  await expect(magnets.locator('option')).toHaveText([/S-04-02-N/, /S-05-02-N52N/, /S-06-02-N/, /S-08-02-N/]);
  await expect(magnets).toHaveValue('supermagnete-s-06-02-n');
  await magnets.selectOption('supermagnete-s-08-02-n');
  await expect(page.getByText(findPart('supermagnete-s-08-02-n')?.description ?? 'missing')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeEnabled({ timeout: 120_000 });
  // the four magnets stand in their pockets in the preview, listed with the parts, and are not in the ZIP
  const ids = ['magnet-box-plus-y', 'magnet-box-minus-y', 'magnet-lid-plus-y', 'magnet-lid-minus-y'];
  await expect(page.getByTestId('stl-viewer')).toHaveAttribute('data-visible-parts', new RegExp(ids.join('.*')));
  const group = page.getByRole('group', { name: 'Visible parts' });
  await expect(group.getByRole('button', { name: /Disc magnet Ø 8 × 2 mm, N45/ })).toHaveCount(4);
  await page.getByRole('slider', { name: 'Assembly' }).fill('1');
  await page.screenshot({ path: testInfo.outputPath('magnets.png') });
  // the choice links to the magnet's library page, which lists the case under “Used by”
  await page.getByRole('link', { name: 'See this part in the parts library' }).click();
  await expect(page).toHaveURL(/#\/parts\/magnet\/supermagnete-s-08-02-n$/);
  await expect(page.getByRole('article', { name: /Disc magnet Ø 8 × 2 mm/ }).getByRole('link', { name: 'Cigarette case (Onz)' })).toBeVisible();
});
