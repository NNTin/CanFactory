import { test, expect, type Page } from '@playwright/test';
import { magneticCatToy, DEFAULT_MAGNETIC_CAT_TOY, magneticCatToyLayout } from '@canfactory/contracts';

async function poses(page: Page): Promise<Record<string, number[]>> {
  return Object.fromEntries((await page.getByTestId('stl-viewer').getAttribute('data-physics-poses') ?? '').split(';').filter(Boolean).map(entry => {
    const [id = '', numbers = ''] = entry.split(':'); return [id, numbers.split(' ').map(Number)];
  }));
}
const distance = (a: number[], b: number[]) => Math.hypot(...a.slice(0, 3).map((v, k) => v - (b[k] ?? 0)));

test('simulates the fully closed toy: drag the composite ball, switch individual mapped magnets without resetting, retain it under the cover', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#/models');
  const card = page.locator('.model-card', { hasText: magneticCatToy.title });
  await expect(card.locator('.card-physics')).toHaveText('Physics');
  await card.click();
  await expect(page.getByRole('button', { name: 'Download ZIP' })).toBeEnabled({ timeout: 180_000 });
  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  const viewer = page.getByTestId('stl-viewer'), controls = page.getByRole('group', { name: 'Magnet controls', exact: true });
  await expect(viewer).toHaveAttribute('data-physics', 'running', { timeout: 120_000 });
  await expect(controls).toBeVisible();
  const magnets = controls.getByRole('button', { name: /^Grid magnet/ });
  await expect(magnets).toHaveCount(4);
  const l = magneticCatToyLayout(DEFAULT_MAGNETIC_CAT_TOY);
  for (const [i, xy] of l.holders.entries()) {
    await expect(magnets.nth(i)).toHaveAccessibleName(`Grid magnet ${i + 1} at X ${xy[0].toFixed(1)}, Y ${xy[1].toFixed(1)} mm`);
    await expect(magnets.nth(i)).toHaveAttribute('aria-pressed', 'true');
  }
  await expect.poll(async () => Object.keys(await poses(page)).length).toBe(26);
  const physics = page.getByRole('group', { name: 'Physics', exact: true });
  const restart = async () => {
    const generation = Number(await viewer.getAttribute('data-physics-generation'));
    await physics.getByRole('button', { name: 'Restart', exact: true }).click();
    await expect.poll(async () => Number(await viewer.getAttribute('data-physics-generation'))).toBeGreaterThan(generation);
  };
  await controls.getByRole('button', { name: 'All off', exact: true }).click();
  for (let i = 0; i < 4; i++) await expect(magnets.nth(i)).toHaveAttribute('aria-pressed', 'false');
  await restart();
  await expect.poll(async () => (await poses(page))['ball-lower']?.[0]).toBeCloseTo(0, 2);
  await expect.poll(async () => Number(await viewer.getAttribute('data-physics-time'))).toBeGreaterThan(0.5);
  const before = Number(await viewer.getAttribute('data-physics-time'));
  await magnets.nth(1).click();
  await expect(magnets.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(magnets.nth(0)).toHaveAttribute('aria-pressed', 'false');
  // Field toggle does not reset the running ball or time.
  expect(Number(await viewer.getAttribute('data-physics-time'))).toBeGreaterThanOrEqual(before);
  await expect.poll(async () => distance((await poses(page))['ball-lower'] ?? [], [0, 0, l.fieldTop]), { timeout: 15_000 }).toBeGreaterThan(1);
  await restart();
  await expect(magnets.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await controls.getByRole('button', { name: 'All off', exact: true }).click();
  await restart();
  // Visibility is inspection only: the fully fixed enclosure remains in the simulation.
  await page.getByTitle('Hide Protective slotted cover', { exact: true }).click();
  await expect.poll(async () => Number(await viewer.getAttribute('data-physics-time'))).toBeGreaterThan(0.3);
  const screen = Object.fromEntries((await viewer.getAttribute('data-physics-screen') ?? '').split(';').map(entry => {
    const [id = '', numbers = ''] = entry.split(':'); return [id, numbers.split(' ').map(Number)];
  }));
  const [x = 0, y = 0] = screen['ball-upper'] ?? [];
  await page.mouse.move(x, y);
  await expect(viewer).toHaveAttribute('data-physics-hover', /ball-(upper|lower|magnet)/);
  const stationary = (await poses(page))['ball-lower'] ?? [];
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) { await page.mouse.move(x + i, y - i / 2); await page.waitForTimeout(40); }
  await expect.poll(async () => distance((await poses(page))['ball-lower'] ?? [], stationary)).toBeGreaterThan(3);
  await page.mouse.up();
  // The halves and internal magnet move together, while field/cover/holders cannot be dragged apart.
  const moving = await poses(page);
  expect(distance(moving['ball-upper'] ?? [], moving['ball-lower'] ?? [])).toBeCloseTo(DEFAULT_MAGNETIC_CAT_TOY.ballDiameter, 2);
  expect(moving['cover']?.[2]).toBeCloseTo(l.top, 2);
  expect(moving['field']?.[2]).toBeCloseTo(l.fieldTop, 2);
  await physics.getByRole('button', { name: 'Upright', exact: true }).click();
  await expect.poll(async () => (await poses(page))['ball-lower']?.[2], { timeout: 10_000 }).toBeGreaterThan(l.fieldTop + 2.5);
  expect((await poses(page))['ball-lower']?.[2]).toBeLessThan(l.top);
  await expect(magnets.nth(1)).toHaveAttribute('aria-pressed', 'false');
  await controls.getByRole('button', { name: 'All on', exact: true }).click();
  for (let i = 0; i < 4; i++) await expect(magnets.nth(i)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  await expect(controls).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Assembly' })).toBeVisible();
  expect(errors).toEqual([]);
});
