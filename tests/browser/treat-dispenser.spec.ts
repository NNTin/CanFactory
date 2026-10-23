import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_TREAT_DISPENSER, treatBolts, treatDispenser } from '@canfactory/contracts';

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

interface Report { state: string; cycles: number; exits: number; idleExits: number; commanded: number; actual: number; lost: number; rejected: number }
async function report(page: Page): Promise<Report | undefined> {
  const text = await page.getByTestId('stl-viewer').getAttribute('data-physics-controller');
  return text ? JSON.parse(text) as Report : undefined;
}

test('dispenses from the BOOT button on the case in the back wall: the motor turns the rotor half a turn, and treats leave down the chute', async ({ page }) => {
  // the mechanism's 0.1 ms steps with a pile of treats in contact run in slow motion
  test.setTimeout(1_500_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models/treat-dispenser');
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeEnabled({ timeout: 300_000 });
  const viewer = page.getByTestId('stl-viewer');
  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  await expect(viewer).toHaveAttribute('data-physics', 'running', { timeout: 300_000 });
  await expect(page.getByRole('group', { name: 'Physics' }).getByRole('status')).toHaveText(/Press B on the case/);

  // B and R are drawn on the case's lid, apart from each other, and the panel offers every control
  const boot = page.locator('.controller-hotspot[data-control="boot"]'), reset = page.locator('.controller-hotspot[data-control="reset"]');
  await expect(boot).toBeVisible(); await expect(reset).toBeVisible();
  const [b, r] = [await boot.boundingBox(), await reset.boundingBox()];
  expect(b && r && Math.hypot(b.x - r.x, b.y - r.y)).toBeGreaterThan(25);
  const panel = page.getByRole('group', { name: 'Dispenser controller' });
  for (const name of ['BOOT', 'RESET', 'Prime', 'Jog', 'Aligned']) await expect(panel.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await expect.poll(async () => (await report(page))?.state, { timeout: 60_000 }).toBe('ready');
  // eight treats, each its own body
  await expect.poll(async () => Object.keys(await poses(page)).filter(id => id.startsWith('treat-')).length, { timeout: 60_000 }).toBe(8);

  // the visible B on the model: one press commands one cycle, and the rotor, on the motor's shaft, turns half a turn forwards
  const start = await poses(page);
  await boot.click();
  await expect.poll(async () => (await report(page))?.state, { timeout: 120_000 }).toBe('running');
  await expect.poll(async () => { const now = await report(page); return now?.state === 'ready' && now.cycles; }, { timeout: 900_000, intervals: [2_000] }).toBe(1);
  const one = await report(page);
  expect(one?.commanded).toBeCloseTo(-180, 0);
  expect(Math.abs((one?.actual ?? 0) + 180)).toBeLessThan(2);
  expect(one?.lost).toBeLessThan(1);
  await expect.poll(async () => angle((await poses(page))['rotor'] ?? [], start['rotor'] ?? []), { timeout: 30_000 }).toBeGreaterThan(178);

  // Prime (one cycle) from the panel, then B again: treats actually leave past the chute's end, none between cycles (0, 1 or more
  // per press is accepted; at least one over the three cycles from a fresh fill)
  await panel.getByRole('button', { name: /Prime/ }).click();
  await expect.poll(async () => (await report(page))?.state, { timeout: 120_000 }).toBe('running');
  await expect.poll(async () => (await report(page))?.state, { timeout: 900_000, intervals: [2_000] }).toBe('ready');
  await boot.click();
  await expect.poll(async () => (await report(page))?.cycles, { timeout: 900_000, intervals: [2_000] }).toBe(2);
  await expect.poll(async () => (await report(page))?.state, { timeout: 120_000 }).toBe('ready');
  const after = await report(page);
  expect(after?.exits).toBeGreaterThanOrEqual(1);
  expect(after?.idleExits).toBe(0);
  await expect(panel.locator('[data-figure="exits"]')).toHaveText(String(after?.exits));

  // R reboots the device: nothing moves, and it is ready again (it was not interrupted)
  const travel = after?.commanded ?? 0;
  await reset.click();
  await expect.poll(async () => (await report(page))?.state, { timeout: 60_000 }).toBe('booting');
  await expect.poll(async () => (await report(page))?.state, { timeout: 120_000 }).toBe('ready');
  expect((await report(page))?.commanded).toBeCloseTo(travel, 3);

  // Refill restarts the scene and the device; closing the mode removes the treats
  await page.getByRole('group', { name: 'Physics' }).getByRole('button', { name: 'Refill' }).click();
  await expect.poll(async () => (await report(page))?.cycles, { timeout: 60_000 }).toBe(0);
  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  await expect(viewer).not.toHaveAttribute('data-physics', /.*/);
  await expect(page.locator('.controller-hotspot')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('shows the inner and outer bodies, the motor, the ULN2003 and every M3 screw and nut in the live assembly; the outer body hides', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models/treat-dispenser');
  await expect(page.getByRole('button', { name: 'Download ZIP', exact: true })).toBeEnabled({ timeout: 300_000 });
  const viewer = page.getByTestId('stl-viewer');
  const slider = page.getByRole('slider', { name: 'Assembly' });
  await slider.press('Home');
  await slider.press('ArrowRight');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', /^Step 1 of \d+ · Push two M3 nuts into the inner body’s motor bays, from the front$/);
  await slider.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Assembled');
  const bolts = treatBolts(DEFAULT_TREAT_DISPENSER);
  const fasteners = bolts.flatMap(bolt => [`${bolt.id}-screw`, `${bolt.id}-nut`]);
  expect(fasteners).toHaveLength(24);
  const visible = async () => new Set((await viewer.getAttribute('data-visible-parts') ?? '').split(' '));
  await expect.poll(async () => [...await visible()].filter(id => fasteners.includes(id)).length, { timeout: 60_000 }).toBe(24);
  for (const id of ['inner-body', 'outer-body', 'motor', 'driver', 'board', 'header-1', 'header-2']) expect((await visible()).has(id), id).toBe(true);
  // hide the outer body: the mechanism, the boards and every fastener stay in view
  const outer = treatDispenser.parts.find(part => part.id === 'outer-body');
  await page.getByTitle(`Hide ${outer?.title ?? ''}`).click();
  await expect.poll(async () => (await visible()).has('outer-body')).toBe(false);
  for (const id of ['inner-body', 'motor', 'driver', ...fasteners]) expect((await visible()).has(id), id).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('inside.png'), fullPage: true });
  expect(errors).toEqual([]);
});
