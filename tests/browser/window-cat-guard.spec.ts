import { test, expect } from '@playwright/test';
import { windowCatGuard, windowCatGuardAssembly } from '@canfactory/contracts';

test('the preview splits the guard into segments and plays its assembly; a taller window gets more segments', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models/window-cat-guard');
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeEnabled({ timeout: 180_000 });
  const viewer = page.getByTestId('stl-viewer');
  await expect(viewer).toHaveAttribute('data-visible-parts', 'left-1 left-2 left-3 right-1 right-2 right-3 strip-1 strip-2 strip-3 strip-4 strip-5');

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
