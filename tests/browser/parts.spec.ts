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
  await page.getByRole('button', { name: /Screws/ }).click();
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
