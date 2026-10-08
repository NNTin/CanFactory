import { test, expect } from '@playwright/test';
import { qrMagnetTag, qrMagnetTagAssembly } from '@canfactory/contracts';

test('the preview shows both parts and plays the assembly; new text and an SVG logo re-render the centre', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const sent: { parameters: Record<string, unknown> }[] = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/renders')) sent.push(request.postDataJSON() as { parameters: Record<string, unknown> }); });
  await page.goto('/#/models/qr-magnet-tag');
  const download = page.getByRole('button', { name: 'Download ZIP', exact: true });
  await expect(download).toBeEnabled({ timeout: 180_000 });
  const viewer = page.getByTestId('stl-viewer');
  // both printed parts, and the four magnets in the back
  await expect(viewer).toHaveAttribute('data-visible-parts', /^border centre magnet-back-1 magnet-back-2 magnet-back-3 magnet-back-4$/);
  // the filament change and the code's size, under the settings
  await expect(page.getByText('Change to the dark filament at 1.6 mm, before layer 9')).toBeVisible();
  await expect(page.getByText('QR version 3: 29 × 29 modules of 1.43 mm')).toBeVisible();

  // The slider: parts as printed, laid out, the centre pressed in, then the magnets into the back.
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Parts as printed');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Lift and lay out the parts');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Step 1 of 2 · Press the centre into the border');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Assembled');
  await page.getByRole('button', { name: 'Play assembly' }).click();
  await expect(page.getByRole('button', { name: 'Pause assembly' })).toBeVisible();
  await expect.poll(async () => Number(await slider.inputValue()), { timeout: 10_000 }).toBeGreaterThan(0.05);
  await page.getByRole('button', { name: 'Pause assembly' }).click();

  // Embedded magnets: the border is rendered with sealed cavities, and the editor says where to pause the print.
  await page.getByLabel('Magnet mounting').selectOption('embedded');
  await expect(page.getByText('Border: pause the print at 2.6 mm, before layer 14 at 0.2 mm layers, and drop the 4 magnets into their cavities; then resume.')).toBeVisible();
  await expect(download).toBeEnabled({ timeout: 180_000 });
  // they are in the border from the start: the slider has no step for them
  await slider.press('End');
  await slider.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Lift and lay out the parts');
  await page.getByLabel('Magnet mounting').selectOption('pockets');
  await expect(download).toBeEnabled({ timeout: 180_000 });

  // New text renders a new code: the API gets the text, never a matrix.
  await page.getByLabel('QR code text').fill('https://github.com/NNTin/CanFactory');
  await expect(page.getByText('QR version 5: 37 × 37 modules')).toBeVisible();
  await expect.poll(() => sent.at(-1)?.parameters['qrText'], { timeout: 30_000 }).toBe('https://github.com/NNTin/CanFactory');
  await expect(download).toBeEnabled({ timeout: 180_000 });

  // An SVG logo, read in the browser: only its outline is sent.
  await page.locator('#parameter-logo').setInputFiles({ name: 'leaf.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" d="M50 4 C82 18 96 58 50 96 C4 58 18 18 50 4Z M47 30 L53 30 L53 82 L47 82Z"/></svg>') });
  await expect(page.locator('#parameter-logo-error')).toHaveCount(0);
  await expect(page.getByText(/a \d+ × \d+ module pad for the logo/)).toBeVisible();
  await expect.poll(() => sent.at(-1)?.parameters['logo'], { timeout: 30_000 }).toMatch(/^M[MLZ0-9 ]+Z$/);
  await expect(download).toBeEnabled({ timeout: 180_000 });
  // a logo needs Q or H
  await page.getByLabel('Error correction').selectOption('M');
  await expect(page.getByText('With a logo, the error correction must be at least Q').first()).toBeVisible();
  await page.getByLabel('Error correction').selectOption('H');

  // The twist lock drops the centre in and turns it. Its round centre's inscribed code is smaller: this text's modules would be
  // under the minimum on a 60 mm tile, so the editor says so until the tile is larger.
  await page.getByLabel('Joint').selectOption('twist-lock');
  await expect(page.locator('#parameter-qrText-error')).toContainText('squares with a 0.4 mm nozzle and 0.1 mm of bleed need at least 0.91 mm');
  await page.getByRole('spinbutton', { name: 'Size', exact: true }).fill('80');
  await expect(page.locator('#parameter-qrText-error')).toHaveCount(0);
  await expect(download).toBeEnabled({ timeout: 180_000 });
  const twist = qrMagnetTagAssembly({ ...qrMagnetTag.defaults, joint: 'twist-lock' });
  await slider.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', new RegExp(twist.motion?.[0]?.title ?? 'missing'));
  expect(errors).toEqual([]);
});

test('the card shows the tag and, on hover, the centre going into the border and its code appearing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: qrMagnetTag.title });
  const art = card.locator('svg.qr-magnet-tag-illustration');
  await expect(art).toHaveAttribute('data-tag-stage', 'Tag');
  const modules = await art.locator('.qrt-module').count();
  expect(modules).toBeGreaterThan(100);
  await card.hover();
  const seen: string[] = [];
  await expect.poll(async () => {
    const stage = await art.getAttribute('data-tag-stage') ?? '';
    if (seen.at(-1) !== stage) seen.push(stage);
    return seen.includes('Lift out');
  }, { timeout: 15_000, intervals: [100] }).toBe(true);
  expect(seen.slice(0, 4)).toEqual(['Border', 'Centre in', 'Code', 'Tag']);
  await page.mouse.move(0, 0);
  await expect(art).toHaveAttribute('data-tag-stage', 'Tag');
  await expect(art.locator('.qrt-module')).toHaveCount(modules);
  expect(errors).toEqual([]);
});
