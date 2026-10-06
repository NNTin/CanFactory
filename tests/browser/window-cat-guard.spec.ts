import { test, expect } from '@playwright/test';
import { windowCatGuard, windowCatGuardAssembly } from '@canfactory/contracts';

test('the preview splits the guard into segments with a splice bar over every joint and plays its assembly; a taller window gets more segments', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models/window-cat-guard');
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeEnabled({ timeout: 180_000 });
  const viewer = page.getByTestId('stl-viewer');
  // the segments, a splice bar over every joint (two on the strip's), and each bar's two screws and nuts
  await expect(viewer).toHaveAttribute('data-visible-parts', /strip-bar-4-2-far-screw/);
  const visible = (await viewer.getAttribute('data-visible-parts') ?? '').split(' ');
  expect(visible.filter(id => !/-(screw|nut)$/.test(id))).toEqual(['left-1', 'left-2', 'left-3', 'right-1', 'right-2', 'right-3', 'strip-1', 'strip-2', 'strip-3', 'strip-4', 'strip-5',
    'left-bar-1', 'left-bar-2', 'right-bar-1', 'right-bar-2', 'strip-bar-1-1', 'strip-bar-1-2', 'strip-bar-2-1', 'strip-bar-2-2', 'strip-bar-3-1', 'strip-bar-3-2', 'strip-bar-4-1', 'strip-bar-4-2']);
  expect(visible.filter(id => id.endsWith('-screw'))).toHaveLength(24);
  expect(visible.filter(id => id.endsWith('-nut'))).toHaveLength(24);

  // The slider: parts as printed, laid out, then one stop per joint, the strip onto the left panel and the right panel onto it.
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  const steps = windowCatGuard.assembly.steps;
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Parts as printed');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Lift and lay out the parts');
  // the last stop is the finished guard
  for (const [index, step] of steps.slice(0, -1).entries()) {
    await slider.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', `Step ${index + 1} of ${steps.length} · ${step.title}`);
  }
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Assembled');
  await page.getByRole('button', { name: 'Play assembly' }).click();
  await expect(page.getByRole('button', { name: 'Pause assembly' })).toBeVisible();
  await expect.poll(async () => Number(await slider.inputValue()), { timeout: 10_000 }).toBeGreaterThan(0.05);
  await page.getByRole('button', { name: 'Pause assembly' }).click();

  // 700 mm in parts of at most 210 mm: four segments per side panel, and the steps follow
  await page.getByRole('spinbutton', { name: 'Height', exact: true }).fill('700');
  await expect(viewer).toHaveAttribute('data-visible-parts', /left-4 right-1 right-2 right-3 right-4 strip-1/, { timeout: 180_000 });
  const taller = windowCatGuardAssembly({ ...windowCatGuard.defaults, height: 700 }).steps;
  expect(taller).toHaveLength(steps.length + 2);
  await slider.press('End');
  await slider.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuetext', `Step ${taller.length - 1} of ${taller.length} · ${taller.at(-2)?.title ?? ''}`);
  expect(errors).toEqual([]);
});

test('the card shows the guard in a tilted window and, on hover, its assembly: tilt, left panel, right panel, top strip', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: windowCatGuard.title });
  const art = card.locator('svg.window-cat-guard-illustration');
  await expect(art).toHaveAttribute('data-guard-stage', 'Guarded');
  // at rest: three segments per side panel and five in the strip, all in place
  await expect(art.locator('.wcg-segment')).toHaveCount(11);
  await card.hover();
  const seen: string[] = [];
  await expect.poll(async () => {
    const stage = await art.getAttribute('data-guard-stage') ?? '';
    if (seen.at(-1) !== stage) seen.push(stage);
    return seen.includes('Close the window');
  }, { timeout: 15_000, intervals: [100] }).toBe(true);
  expect(seen.slice(0, 5)).toEqual(['Tilt the window', 'Left panel', 'Right panel', 'Top strip', 'Guarded']);
  await page.mouse.move(0, 0);
  await expect(art).toHaveAttribute('data-guard-stage', 'Guarded');
  expect(errors).toEqual([]);
});
