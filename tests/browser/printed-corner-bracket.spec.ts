import { test, expect } from '@playwright/test';
import { printedCornerBracket } from '@canfactory/contracts';

test('the card shows the bracket across a collar corner, and on hover lifts it off with its screws', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: printedCornerBracket.title });
  const art = card.locator('svg.printed-corner-bracket-illustration');
  await expect(art).toBeVisible();
  // six holes, three on each leg, each with its screw
  await expect(art.locator('.pcb-plate circle')).toHaveCount(6);
  await expect(art.locator('.pcb-screws circle')).toHaveCount(6);
  const lift = () => art.locator('.pcb-plate').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).f);
  expect(await lift()).toBe(0);
  await card.hover();
  await expect.poll(lift, { timeout: 2_000, intervals: [50] }).toBeLessThan(-6);
  await page.mouse.move(0, 0);
  await expect.poll(lift).toBe(0);
  expect(errors).toEqual([]);
});

test('the editor names the window insert that uses it, and its screws link to the parts library', async ({ page }) => {
  await page.goto('/#/models/printed-corner-bracket');
  const footer = page.locator('.model-footer');
  await expect(footer.getByRole('link', { name: 'Window catio: window insert' })).toHaveAttribute('href', '#/concepts/catio/window-insert');
  await expect(footer).toContainText('collar corners, the default');
  await expect(page.getByRole('combobox', { name: 'Wood screw', exact: true })).toHaveValue('din-7997-4x35');
  await expect(page.getByRole('link', { name: 'See this part in the parts library' })).toHaveAttribute('href', '#/parts/wood-screw/din-7997-4x35');
  // holes that do not fit the legs are refused before anything is rendered
  await page.getByRole('spinbutton', { name: 'Leg A' }).fill('80');
  await expect(page.getByRole('alert')).toContainText('need the leg at least 96 mm long');
  await page.getByRole('spinbutton', { name: 'Leg A' }).fill('100');
  // staggered holes by default; a leg too narrow for them names the width they need, and straight holes are the way out
  const layout = page.getByRole('combobox', { name: 'Hole layout', exact: true });
  await expect(layout).toHaveValue('staggered');
  await page.getByRole('spinbutton', { name: 'Width' }).fill('16');
  await expect(page.getByRole('alert')).toContainText('need the legs at least 16.35 mm wide');
  await layout.selectOption('straight');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
