import { test, expect } from '@playwright/test';
import { pressurePad } from '@canfactory/contracts';

test('the card shows the leg, and on hover its extender running up and down the screw below to set the height', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: pressurePad.title });
  const art = card.locator('svg.pressure-pad-illustration');
  await expect(art).toBeVisible();
  const upper = art.locator('.pp-upper');
  const guide = art.locator('.pp-guide');
  const lift = () => upper.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).f);
  // at rest the extender sits on its lock nut and the height guide is hidden
  expect(await lift()).toBe(0);
  await expect.poll(() => guide.evaluate(element => Number(getComputedStyle(element).opacity))).toBe(0);
  await card.hover();
  // the extender rises (to 16 px) and comes back down, looping while hovered; the guide shows
  await expect.poll(lift, { timeout: 2_000, intervals: [50] }).toBeLessThan(-10);
  await expect.poll(lift, { timeout: 3_000, intervals: [50] }).toBeGreaterThan(-4);
  await expect.poll(() => guide.evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.5);
  await page.mouse.move(0, 0);
  await expect.poll(lift).toBe(0);
  expect(errors).toEqual([]);
});
