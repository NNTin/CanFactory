import assert from 'node:assert/strict';
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
  await expect(magnets).toHaveCount(magneticCatToyLayout(DEFAULT_MAGNETIC_CAT_TOY).sockets.length);
  const l = magneticCatToyLayout(DEFAULT_MAGNETIC_CAT_TOY);
  for (const [i, xy] of l.sockets.entries()) {
    await expect(magnets.nth(i)).toHaveAccessibleName(`Grid magnet ${i + 1} at X ${xy[0].toFixed(1)}, Y ${xy[1].toFixed(1)} mm`);
    await expect(magnets.nth(i)).toHaveAttribute('aria-pressed', 'false');
  }
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /grid-magnet-/);
  const selected = Math.floor((l.rows - 1) / 2) * l.columns + Math.floor((l.columns - 1) / 2);
  await expect.poll(async () => Object.keys(await poses(page)).length).toBe(l.sockets.length + 14);
  const physics = page.getByRole('group', { name: 'Physics', exact: true });
  const restart = async () => {
    const generation = Number(await viewer.getAttribute('data-physics-generation'));
    await physics.getByRole('button', { name: 'Restart', exact: true }).click();
    await expect.poll(async () => Number(await viewer.getAttribute('data-physics-generation'))).toBeGreaterThan(generation);
  };
  await controls.getByRole('button', { name: 'All off', exact: true }).click();
  for (let i = 0; i < l.sockets.length; i++) await expect(magnets.nth(i)).toHaveAttribute('aria-pressed', 'false');
  await restart();
  await expect.poll(async () => (await poses(page))['ball-lower']?.[0]).toBeCloseTo(0, 2);
  await expect.poll(async () => Number(await viewer.getAttribute('data-physics-time'))).toBeGreaterThan(0.5);
  const before = Number(await viewer.getAttribute('data-physics-time'));
  await magnets.nth(selected).click();
  await expect(magnets.nth(selected)).toHaveAttribute('aria-pressed', 'true');
  await expect(magnets.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(viewer).toHaveAttribute('data-visible-parts', new RegExp(`grid-magnet-${selected + 1}( |$)`));
  // Field toggle does not reset the running ball or time.
  expect(Number(await viewer.getAttribute('data-physics-time'))).toBeGreaterThanOrEqual(before);
  await expect.poll(async () => distance((await poses(page))['ball-lower'] ?? [], [0, 0, l.fieldTop]), { timeout: 15_000 }).toBeGreaterThan(1);
  await restart();
  await expect(magnets.nth(selected)).toHaveAttribute('aria-pressed', 'true');
  await controls.getByRole('button', { name: 'All off', exact: true }).click();
  await restart();
  // Visibility is inspection only: the fully fixed enclosure remains in the simulation.
  await page.getByTitle('Hide Protective slotted cover', { exact: true }).click();
  await expect.poll(async () => Number(await viewer.getAttribute('data-physics-time'))).toBeGreaterThan(0.3);
  // The larger map/parts list can scroll the canvas while clicking visibility controls.
  // Wait for a fresh projected point and actually hover it, rather than using pre-scroll coordinates.
  await viewer.scrollIntoViewIfNeeded();
  let x = 0, y = 0;
  await expect.poll(async () => {
    const screen = Object.fromEntries((await viewer.getAttribute('data-physics-screen') ?? '').split(';').map(entry => {
      const [id = '', numbers = ''] = entry.split(':'); return [id, numbers.split(' ').map(Number)];
    }));
    [x = 0, y = 0] = screen['ball-upper'] ?? [];
    await page.mouse.move(x, y);
    return viewer.getAttribute('data-physics-hover');
  }).toMatch(/ball-(upper|lower|magnet)/);
  const stationary = (await poses(page))['ball-lower'] ?? [];
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) { await page.mouse.move(x + i, y - i / 2); await page.waitForTimeout(40); }
  await expect.poll(async () => distance((await poses(page))['ball-lower'] ?? [], stationary)).toBeGreaterThan(3);
  await page.mouse.up();
  // The halves and internal magnet move together, while field/cover stay fixed and off grid positions stay empty.
  const moving = await poses(page);
  expect(distance(moving['ball-upper'] ?? [], moving['ball-lower'] ?? [])).toBeCloseTo(DEFAULT_MAGNETIC_CAT_TOY.ballDiameter, 2);
  expect(moving['cover']?.[2]).toBeCloseTo(l.top, 2);
  expect(moving['field']?.[2]).toBeCloseTo(l.fieldTop, 2);
  await physics.getByRole('button', { name: 'Upright', exact: true }).click();
  await expect.poll(async () => (await poses(page))['ball-lower']?.[2], { timeout: 10_000 }).toBeGreaterThan(l.fieldTop + 2.5);
  expect((await poses(page))['ball-lower']?.[2]).toBeLessThan(l.top);
  await expect(magnets.nth(selected)).toHaveAttribute('aria-pressed', 'false');
  await controls.getByRole('button', { name: 'All on', exact: true }).click();
  for (let i = 0; i < l.sockets.length; i++) await expect(magnets.nth(i)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  await expect(controls).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Assembly' })).toBeVisible();
  expect(errors).toEqual([]);
});


test('makes every dense-grid socket individually usable without overlapping controls, including initially empty edge sockets', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#/models/magnetic-cat-toy');
  await page.getByRole('spinbutton', { name: 'Toy width', exact: true }).fill('200');
  await page.getByRole('spinbutton', { name: 'Toy length', exact: true }).fill('200');
  await page.getByRole('spinbutton', { name: 'Socket spacing', exact: true }).fill('20');
  await expect(page.getByRole('button', { name: 'Download ZIP' })).toBeEnabled({ timeout: 180_000 });
  await expect(page.getByText(/9 × 9 direct sockets at 20 mm centre spacing/)).toBeVisible();
  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  const viewer = page.getByTestId('stl-viewer'), controls = page.getByRole('group', { name: 'Magnet controls', exact: true });
  await expect(viewer).toHaveAttribute('data-physics', 'running', { timeout: 120_000 });
  const magnets = controls.getByRole('button', { name: /^Grid magnet/ });
  await expect(magnets).toHaveCount(81);
  await expect(magnets.last()).toHaveAccessibleName('Grid magnet 81 at X 80.0, Y 80.0 mm');
  await expect(magnets.last()).toHaveAttribute('aria-pressed', 'false');
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /grid-magnet-/);
  const boxes = await magnets.evaluateAll(buttons => buttons.map(button => {
    const { x, y, width, height } = button.getBoundingClientRect(); return { x, y, width, height };
  }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]; assert.ok(a); assert.ok(b);
    expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
  }
  await expect.poll(async () => Number(await viewer.getAttribute('data-physics-time'))).toBeGreaterThan(0.1);
  const before = Number(await viewer.getAttribute('data-physics-time'));
  await magnets.last().click();
  await expect(magnets.last()).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer).toHaveAttribute('data-visible-parts', /grid-magnet-81( |$)/);
  expect(Number(await viewer.getAttribute('data-physics-time'))).toBeGreaterThanOrEqual(before);
  await controls.getByRole('button', { name: 'All on', exact: true }).click();
  for (let i = 0; i < 81; i++) await expect(magnets.nth(i)).toHaveAttribute('aria-pressed', 'true');
  const allOn = Number(await viewer.getAttribute('data-physics-time'));
  await expect.poll(async () => Number(await viewer.getAttribute('data-physics-time'))).toBeGreaterThan(allOn + 0.2);
  expect(Object.values(await poses(page)).flat().every(Number.isFinite)).toBe(true);
  await controls.getByRole('button', { name: 'All off', exact: true }).click();
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /grid-magnet-/);
  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  // The assembly preview returns to the capacity illustration, independent of runtime placement choices.
  await expect(viewer).toHaveAttribute('data-visible-parts', /grid-magnet-81( |$)/);
  expect(errors).toEqual([]);
});
