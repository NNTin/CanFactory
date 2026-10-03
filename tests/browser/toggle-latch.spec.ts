import { test, expect } from '@playwright/test';
import { toggleLatch, toggleLatchMechanism } from '@canfactory/contracts';

test('the card shows the latch opening and closing; the preview assembles it and works its mechanism', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  // The card's side view rests locked and, on hover, loops through opening and closing.
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: toggleLatch.title });
  const art = card.locator('svg.toggle-latch-illustration');
  await expect(art).toHaveAttribute('data-latch-state', 'Locked');
  await card.hover();
  const seen = new Set<string>();
  await expect.poll(async () => { seen.add(await art.getAttribute('data-latch-state') ?? ''); return seen.size; }, { timeout: 20_000, intervals: [100] })
    .toBeGreaterThanOrEqual(toggleLatchMechanism.TOGGLE_LATCH_CYCLE.length);
  await page.mouse.move(0, 0);
  await expect(art).toHaveAttribute('data-latch-state', 'Locked');

  // The preview's slider: exploded, the assembly steps, then the movements, ending locked.
  await card.click();
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeEnabled({ timeout: 180_000 });
  await expect(page.getByTestId('stl-viewer')).toHaveAttribute('data-visible-parts', 'base lever link catch');
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  const assembly = toggleLatch.assembly;
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Parts as printed');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Lift and lay out the parts');
  for (const [index, step] of assembly.steps.entries()) {
    await slider.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', `Step ${index + 1} of ${assembly.steps.length} · ${step.title}`);
  }
  for (const [index, movement] of (assembly.motion ?? []).entries()) {
    await slider.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', `Movement ${index + 1} of 5 · ${movement.title}`);
  }
  // Play runs the whole story from the start.
  await page.getByRole('button', { name: 'Play assembly' }).click();
  await expect(page.getByRole('button', { name: 'Pause assembly' })).toBeVisible();
  await expect.poll(async () => Number(await slider.inputValue()), { timeout: 10_000 }).toBeGreaterThan(0.05);
  await page.getByRole('button', { name: 'Pause assembly' }).click();
  const paused = await slider.inputValue();
  await page.waitForTimeout(500);
  expect(await slider.inputValue()).toBe(paused);
  expect(errors).toEqual([]);
});
