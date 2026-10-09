import { test, expect, type Page } from '@playwright/test';
import { toggleLatch } from '@canfactory/contracts';

/** The bodies' poses the viewer last reported (`data-physics-poses`): id → [x, y, z, qw, qx, qy, qz]. */
async function poses(page: Page): Promise<Record<string, number[]>> {
  const text = await page.getByTestId('stl-viewer').getAttribute('data-physics-poses') ?? '';
  return Object.fromEntries(text.split(';').filter(Boolean).map(entry => {
    const [id = '', values = ''] = entry.split(':');
    return [id, values.split(' ').map(Number)];
  }));
}

/** The angle (degrees) between two orientations (w, x, y, z). */
const angle = (a: number[], b: number[]) => 2 * Math.acos(Math.min(1, Math.abs(a.slice(3).reduce((sum, value, index) => sum + value * (b[index + 3] ?? 0), 0)))) * 180 / Math.PI;

test('simulates the toggle latch: the physics starts closed, a dragged lever swings on its hinge, gravity turns over', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models');
  await page.locator('.model-card', { hasText: toggleLatch.title }).click();
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeEnabled({ timeout: 180_000 });
  const viewer = page.getByTestId('stl-viewer');

  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  await expect(viewer).toHaveAttribute('data-physics', 'running', { timeout: 120_000 });
  const bar = page.getByRole('group', { name: 'Physics' });
  await expect(bar.getByRole('status')).toHaveText('Drag a part to move it');
  await expect(page.getByRole('slider', { name: 'Assembly' })).toHaveCount(0);
  // it runs: the simulated time goes on, and the parts report their poses
  const started = Number(await viewer.getAttribute('data-physics-time'));
  await expect.poll(async () => Number(await viewer.getAttribute('data-physics-time')), { timeout: 10_000 }).toBeGreaterThan(started + 0.5);
  await expect.poll(async () => Object.keys(await poses(page)).sort()).toEqual(['base', 'catch', 'lever', 'link']);

  // find the lever under the pointer, and drag it up and away: it swings open on its hinge, and stays where it is let go
  const over = async (x: number, y: number) => { await page.mouse.move(x, y); return viewer.getAttribute('data-physics-hover'); };
  // the lever's thumb end on the screen: from its centre towards the catch, the furthest point still on the lever
  const screen = Object.fromEntries((await viewer.getAttribute('data-physics-screen') ?? '').split(';').map(entry => {
    const [id = '', xy = ''] = entry.split(':');
    return [id, xy.split(' ').map(Number)];
  }));
  const [cx = 0, cy = 0] = screen['lever'] ?? [], [kx = 0, ky = 0] = screen['catch'] ?? [];
  const points: { x: number; y: number }[] = [];
  for (let f = 0.9; f >= -0.5 && points.length < 5; f -= 0.1) for (const [dx, dy] of [[0, 0], [0, -6], [0, 6], [-6, 0], [6, 0]] as const) {
    const x = cx + (kx - cx) * f + dx, y = cy + (ky - cy) * f + dy;
    if (points.length < 5 && !points.some(p => Math.hypot(p.x - x, p.y - y) < 10) && await over(x, y) === 'lever') points.push({ x, y });
  }
  expect(points.length, 'points on the lever').toBeGreaterThan(0);
  const closed = (await poses(page))['lever'] ?? [];
  // as a user would: take it somewhere and pull it up; a point close to its hinge has too little leverage, so try another
  let opened = 0;
  for (const point of points) {
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    for (let i = 1; i <= 25; i++) { await page.mouse.move(point.x + i, point.y - i * 4); await page.waitForTimeout(40); }
    await page.waitForTimeout(1000);
    opened = angle((await poses(page))['lever'] ?? [], closed);
    await page.mouse.up();
    if (opened > 15) break;
    await page.getByRole('group', { name: 'Physics' }).getByRole('button', { name: 'Restart' }).click();
    await page.waitForTimeout(500);
  }
  expect(opened, 'the lever swung open').toBeGreaterThan(15);
  // the base is fixed, whatever happens
  const base = (await poses(page))['base'] ?? [];
  const fixed = toggleLatch.physics().poses?.['base']?.position ?? [];
  base.slice(0, 3).forEach((value, axis) => { expect(value).toBeCloseTo(fixed[axis] ?? Number.NaN, 2); });

  // gravity turned over, then a fresh start
  await bar.getByRole('button', { name: 'Upright' }).click();
  await expect(bar.getByRole('button', { name: 'Upside down' })).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer).toHaveAttribute('data-physics', 'running');
  await bar.getByRole('button', { name: 'Restart' }).click();
  await expect.poll(async () => angle((await poses(page))['lever'] ?? [], closed), { timeout: 10_000 }).toBeLessThan(2);

  // closing the mode puts the slider back
  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  await expect(viewer).not.toHaveAttribute('data-physics', /.*/);
  await expect(page.getByRole('slider', { name: 'Assembly' })).toBeVisible();
  expect(errors).toEqual([]);
});
