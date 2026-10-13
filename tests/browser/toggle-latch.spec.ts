import { test, expect } from '@playwright/test';
import { toggleLatch, toggleLatchMechanism } from '@canfactory/contracts';

test('the card shows the latch opening and closing; the preview assembles it and works its mechanism', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  // The card's side view rests locked and, on hover, loops through opening and closing.
  await page.goto('/#/models');
  const card = page.locator('.model-card', { has: page.getByRole('heading', { name: toggleLatch.title, exact: true }) });
  const art = card.locator('svg.toggle-latch-illustration');
  await expect(art).toHaveAttribute('data-latch-state', 'Locked');
  // it answers the hover at once, as the other cards' transitions do: the lever is already moving within 300 ms
  const lever = art.locator('.tl-lever');
  const resting = await lever.getAttribute('transform');
  await card.hover();
  await expect.poll(() => lever.getAttribute('transform'), { timeout: 300, intervals: [30] }).not.toBe(resting);
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

test('outside-corner latch is separate, uses plank-aware wood screws, and downloads four parts', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/#/models');
  const card = page.locator('.model-card', { has: page.getByRole('heading', { name: 'Outside-corner toggle latch', exact: true }) });
  const illustration = card.locator('[data-latch-mount="outside-corner"]');
  await expect(illustration).toHaveAttribute('data-latch-state', 'Locked');
  await expect(illustration.locator('.tl-corner-mounts')).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/#\/models\/outside-corner-toggle-latch$/);
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeEnabled({ timeout: 180_000 });
  await expect(page.getByTestId('stl-viewer')).toHaveAttribute('data-visible-parts', 'base lever link catch');
  await expect(page.getByText(/16 mm penetration into 18 mm planks/)).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  await slider.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', /Close again: over centre and locked/);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ZIP', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.zip$/);

  // A longer screw must not silently break through an 18 mm plank.
  const screw = page.getByRole('combobox', { name: 'Wood screw', exact: true });
  await screw.selectOption('din-7997-4x25');
  await expect(page.getByRole('complementary').getByText(/This screw penetrates 21 mm/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeDisabled();
  // Thickness is a real geometry control: thicker planks make the feet longer and allow this screw.
  await page.getByRole('spinbutton', { name: 'Plank thickness', exact: true }).fill('24');
  await page.getByRole('spinbutton', { name: 'Plank thickness', exact: true }).blur();
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeEnabled({ timeout: 180_000 });
  await expect(page.getByText(/21 mm penetration into 24 mm planks/)).toBeVisible();
  await expect(page.getByText(/Feet 38 mm wide × 50 mm long/)).toBeVisible();
});
