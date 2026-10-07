import { test, expect } from '@playwright/test';
import { findPart, PRINTED_SCREEN_HOOK_DEFAULT, PRINTED_SCREEN_HOOK_SCREW, printedScreenHook, printedScreenHookShape } from '@canfactory/contracts';

test('the card shows the long hook behind the window’s head lip, and on hover lifts the insert as it is hung', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: printedScreenHook.title });
  const art = card.locator('svg.printed-screen-hook-illustration');
  await expect(art).toBeVisible();
  const insert = art.locator('.psh-insert');
  const lift = () => insert.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).f);
  expect(await lift()).toBe(0);
  await card.hover();
  // lifted by the short hooks' rise (7 mm, drawn at 1.6 px/mm), then let down again, looping while hovered
  const screw = findPart(PRINTED_SCREEN_HOOK_SCREW.screw); if (!screw) throw new Error('screw');
  const rise = printedScreenHookShape({ ...PRINTED_SCREEN_HOOK_DEFAULT, frameLip: 15.5, sealGap: 3.5 }, screw).lift * 1.6;
  await expect.poll(lift, { timeout: 2_000, intervals: [50] }).toBeLessThan(-rise + 1);
  await expect.poll(lift, { timeout: 3_000, intervals: [50] }).toBeGreaterThan(-2);
  await page.mouse.move(0, 0);
  await expect.poll(lift).toBe(0);
  expect(errors).toEqual([]);
});

test('the editor takes the window’s lip and seal gap, says where the hooks go, and refuses a gap too narrow for the barb', async ({ page }) => {
  await page.goto('/#/models/printed-screen-hook');
  await expect(page.locator('.model-footer').getByRole('link', { name: 'Window catio: window insert' })).toHaveAttribute('href', '#/concepts/catio/window-insert');
  await expect(page.getByText('lift the frame 7 mm to hang it')).toBeVisible();
  // one screw by default, that the hook turns on; two hold it square
  await expect(page.getByText(/One screw in each leg, 11.5 mm from the turn.*swung 53° either way/)).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Screws per hook' }).fill('2');
  await expect(page.getByText('Two screws in each leg: the hooks are held square and cannot turn.')).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Seal gap' }).fill('2.5');
  await expect(page.getByRole('alert')).toContainText('or use bought hooks');
  await page.getByRole('spinbutton', { name: 'Seal gap' }).fill('6');
  await expect(page.getByText(/2 mm clear of the lip’s back and of the sash/)).toBeVisible();
});
