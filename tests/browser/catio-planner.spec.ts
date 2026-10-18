import { test, expect, type Locator, type Page } from '@playwright/test';

/** The planner on a fresh browser: the default project, nothing saved. */
async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio/planner');
  const viewport = page.getByTestId('planner-viewport');
  await expect(viewport).toHaveAttribute('data-ready', 'true');
  await expect.poll(async () => (await anchors(viewport))['enclosure-1']).toBeTruthy();
  return { viewport, errors };
}

type Anchors = Record<string, [number, number]>;
const anchors = async (viewport: Locator): Promise<Anchors> => JSON.parse(await viewport.getAttribute('data-anchors') ?? '{}') as Anchors;
/** Where an anchor is on the page. */
async function at(viewport: Locator, id: string): Promise<[number, number]> {
  const box = await viewport.boundingBox(); const point = (await anchors(viewport))[id];
  if (!box || !point) throw new Error(`No anchor ${id}`);
  return [box.x + point[0], box.y + point[1]];
}
/** Drags from `from` through `path` in small steps, the mouse held down until `release` says. */
async function drag(page: Page, from: [number, number], path: [number, number][], release = true) {
  await page.mouse.move(...from); await page.mouse.down();
  let last = from;
  for (const to of path) {
    for (let i = 1; i <= 6; i++) await page.mouse.move(last[0] + (to[0] - last[0]) * i / 6, last[1] + (to[1] - last[1]) * i / 6);
    last = to;
  }
  if (release) await page.mouse.up();
}
const field = (page: Page, name: string) => page.getByRole('region', { name: 'Inspector' }).getByRole('textbox', { name, exact: true });
const tree = (page: Page) => page.getByRole('navigation', { name: 'Object tree' });
const issues = (page: Page) => page.getByRole('region', { name: 'Issues' });

test('opens the default scene from a fresh state, linked from the catio concept', async ({ page }, testInfo) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  await page.getByRole('link', { name: /Catio planner/ }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/planner$/);
  const { viewport, errors } = await open(page);
  await expect(tree(page).getByRole('button')).toHaveText([/Window/, /Tunnel/, /Enclosure/]);
  await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('My catio');
  await expect(field(page, 'Width (m)')).toHaveValue('5');
  await expect(field(page, 'Depth (m)')).toHaveValue('5');
  await expect(issues(page)).toContainText('0 ERRORS');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  // the enclosure's outside and usable inside dimensions, in centimetres
  await tree(page).getByRole('button', { name: /Enclosure/ }).click();
  await expect(viewport).toHaveAttribute('data-selection', '["enclosure-1"]');
  await expect(field(page, 'Width (cm)')).toHaveValue('200');
  await expect(page.getByRole('region', { name: 'Inspector' })).toContainText(/Usable inside.*192 × 192/);
  for (const name of ['Top', 'Front', 'Side', '3D', 'Fit all', 'Fit selection']) await page.getByRole('button', { name, exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('catio-planner-default.png') });
  expect(errors).toEqual([]);
});

test('selects and drags the enclosure: the tunnel follows in whole modules; Esc cancels, undo and redo', async ({ page }, testInfo) => {
  const { viewport, errors } = await open(page);
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  const enclosure = await at(viewport, 'enclosure-1'); const window = await at(viewport, 'window-1');
  await page.mouse.click(...enclosure);
  await expect(viewport).toHaveAttribute('data-selection', '["enclosure-1"]');
  const y0 = await field(page, 'Y (m)').inputValue(); const x0 = await field(page, 'X (m)').inputValue();
  // straight out into the garden, away from the window
  const [dx, dy] = [enclosure[0] - window[0], enclosure[1] - window[1]]; const length = Math.hypot(dx, dy);
  const away = (k: number): [number, number] => [enclosure[0] + dx / length * k, enclosure[1] + dy / length * k];

  // Esc in the middle of a drag puts everything back
  await drag(page, enclosure, [away(70)], false);
  await expect(page.locator('.planner-readout')).toContainText('Moving Enclosure');
  await expect(page.locator('.planner-readout')).toContainText(/Tunnel: \d+ modules/);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.planner-readout')).toHaveCount(0);
  await expect(viewport).toHaveAttribute('data-revision', '0');
  await expect(field(page, 'Y (m)')).toHaveValue(y0);

  // a drag is one undo step, and the tunnel's whole modules reach the enclosure where it is put
  await drag(page, enclosure, [away(40), away(90)]);
  await expect(viewport).toHaveAttribute('data-revision', '1');
  await expect(field(page, 'Y (m)')).not.toHaveValue(y0);
  await expect(issues(page)).not.toContainText('cannot reach');
  await tree(page).getByRole('button', { name: /Tunnel/ }).click();
  const inspector = page.getByRole('region', { name: 'Inspector' });
  await expect(inspector).toContainText('Reaches its portYes');
  await expect(inspector).not.toContainText(/Modules\s*2 ×/);
  await page.screenshot({ path: testInfo.outputPath('catio-planner-dragged.png') });

  // a drag on an object never orbits the camera: the window stays where it was on the screen
  expect(await at(viewport, 'window-1')).toEqual(window);
  await tree(page).getByRole('button', { name: /Enclosure/ }).click();
  await page.keyboard.press('Control+z');
  await expect(viewport).toHaveAttribute('data-revision', '0');
  await expect(field(page, 'Y (m)')).toHaveValue(y0);
  await expect(field(page, 'X (m)')).toHaveValue(x0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(field(page, 'Y (m)')).not.toHaveValue(y0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(field(page, 'Y (m)')).toHaveValue(y0);
  await page.keyboard.press('Control+Shift+z');
  await expect(field(page, 'Y (m)')).not.toHaveValue(y0);
  // shortcuts never fire while a field has the focus
  const y1 = await field(page, 'Y (m)').inputValue();
  await field(page, 'X (m)').focus();
  await page.keyboard.press('Control+z');
  await expect(field(page, 'Y (m)')).toHaveValue(y1);
  expect(errors).toEqual([]);
});

test('turns the enclosure in 15° steps with its ring and its yaw field', async ({ page }) => {
  const { viewport, errors } = await open(page);
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  await page.mouse.click(...await at(viewport, 'enclosure-1'));
  await expect(viewport).toHaveAttribute('data-selection', '["enclosure-1"]');
  const handle = await at(viewport, 'rotate'); const centre = await at(viewport, 'rotate-centre');
  const r = Math.hypot(handle[0] - centre[0], handle[1] - centre[1]); const a0 = Math.atan2(handle[1] - centre[1], handle[0] - centre[0]);
  const arc = [10, 20, 30, 40].map((deg): [number, number] => [centre[0] + r * Math.cos(a0 + deg * Math.PI / 180), centre[1] + r * Math.sin(a0 + deg * Math.PI / 180)]);
  await drag(page, handle, arc);
  await expect(viewport).toHaveAttribute('data-revision', '1');
  const yaw = Number(await field(page, 'Yaw (°)').inputValue());
  expect(Math.abs(yaw)).toBeGreaterThanOrEqual(15);
  expect(Math.abs(yaw % 15)).toBe(0);
  await field(page, 'Yaw (°)').fill('45'); await field(page, 'Yaw (°)').press('Enter');
  await expect(viewport).toHaveAttribute('data-revision', '2');
  await expect(field(page, 'Yaw (°)')).toHaveValue('45');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(field(page, 'Yaw (°)')).toHaveValue(String(yaw));
  expect(errors).toEqual([]);
});

test('shrinking the garden flags what is outside it and deletes nothing; a bad number keeps the last valid one', async ({ page }, testInfo) => {
  const { viewport, errors } = await open(page);
  await field(page, 'Depth (m)').fill('2.5'); await field(page, 'Depth (m)').press('Enter');
  await expect(viewport).toHaveAttribute('data-revision', '1');
  await expect(tree(page).getByRole('button')).toHaveCount(3);
  await expect(issues(page)).toContainText('Enclosure is outside the garden');
  await expect(tree(page).getByRole('button', { name: /Enclosure/ })).toContainText('1');
  // the issue selects what it is about
  await issues(page).getByRole('button', { name: /outside the garden/ }).click();
  await expect(viewport).toHaveAttribute('data-selection', '["enclosure-1"]');
  await expect(page.getByRole('region', { name: 'Inspector' }).getByRole('list', { name: 'Problems with this object' })).toContainText('outside the garden');
  await page.screenshot({ path: testInfo.outputPath('catio-planner-garden.png') });
  // an invalid number is not taken
  await viewport.click({ position: { x: 20, y: 20 } });
  await expect(viewport).toHaveAttribute('data-selection', '[]');
  await field(page, 'Width (m)').fill('abc');
  await expect(page.getByRole('region', { name: 'Inspector' })).toContainText('Enter a number. Keeping 5 m.');
  await field(page, 'Width (m)').press('Enter');
  await field(page, 'Width (m)').fill('-2'); await field(page, 'Width (m)').press('Enter');
  await expect(page.getByRole('region', { name: 'Inspector' })).toContainText('Must be more than 0 m.');
  await expect(viewport).toHaveAttribute('data-revision', '1');
  await field(page, 'Width (m)').press('Escape');
  await expect(field(page, 'Width (m)')).toHaveValue('5');
  expect(errors).toEqual([]);
});

test('adds a platform, moves it within its enclosure, and it follows its enclosure', async ({ page }, testInfo) => {
  const { viewport, errors } = await open(page);
  await page.getByRole('button', { name: /^Platform/ }).click();
  await expect(tree(page).getByRole('button')).toHaveText([/Window/, /Tunnel/, /Enclosure/, /Platform 1/]);
  await expect(viewport).toHaveAttribute('data-selection', '["platform-1"]');
  await expect(field(page, 'Elevation (cm)')).toHaveValue('120');
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  const platform = await at(viewport, 'platform-1');
  const y0 = await field(page, 'Y (cm)').inputValue();
  await drag(page, platform, [[platform[0] + 15, platform[1] + 15], [platform[0] + 30, platform[1] + 30]]);
  await expect(viewport).toHaveAttribute('data-revision', '2');
  await expect(viewport).toHaveAttribute('data-selection', '["platform-1"]');
  await expect(field(page, 'Y (cm)')).not.toHaveValue(y0);
  const local = [await field(page, 'X (cm)').inputValue(), await field(page, 'Y (cm)').inputValue()];
  await field(page, 'Elevation (cm)').fill('100'); await field(page, 'Elevation (cm)').press('Enter');
  await expect(viewport).toHaveAttribute('data-revision', '3');

  // moving the enclosure carries the platform: its place in the enclosure stays, its place on the screen moves with it
  const before = await at(viewport, 'platform-1');
  await tree(page).getByRole('button', { name: /^Enclosure/ }).click();
  const x = Number(await field(page, 'X (m)').inputValue());
  await field(page, 'X (m)').fill(String(x - 0.5)); await field(page, 'X (m)').press('Enter');
  await expect(viewport).toHaveAttribute('data-revision', '4');
  await expect.poll(async () => Math.hypot(...(await at(viewport, 'platform-1')).map((v, i) => v - (before[i] ?? 0)))).toBeGreaterThan(5);
  await tree(page).getByRole('button', { name: /Platform 1/ }).click();
  expect([await field(page, 'X (cm)').inputValue(), await field(page, 'Y (cm)').inputValue()]).toEqual(local);
  await page.screenshot({ path: testInfo.outputPath('catio-planner-platform.png') });
  expect(errors).toEqual([]);
});

test('Fit all frames everything, also what stands outside the garden (#122)', async ({ page }) => {
  const { viewport, errors } = await open(page);
  await tree(page).getByRole('button', { name: /Enclosure/ }).click();
  await field(page, 'X (m)').fill('20'); await field(page, 'X (m)').press('Enter');
  await expect(viewport).toHaveAttribute('data-revision', '1');
  await expect(issues(page)).toContainText('Enclosure is outside the garden');
  const inside = async () => {
    const box = await viewport.boundingBox(); const all = await anchors(viewport);
    if (!box) return false;
    return ['window-1', 'enclosure-1'].every(id => { const p = all[id]; return !!p && p[0] >= 0 && p[0] <= box.width && p[1] >= 0 && p[1] <= box.height; });
  };
  for (const name of ['Fit all', 'Top', '3D']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect.poll(inside, { message: name }).toBe(true);
  }
  expect(errors).toEqual([]);
});

const tools = (page: Page) => page.getByRole('group', { name: 'Selection tools' });

test('the Resize tool drags a face of the enclosure; the opposite face stays put; one undo step (#123)', async ({ page }, testInfo) => {
  const { viewport, errors } = await open(page);
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-projection', 'orthographic');
  await tree(page).getByRole('button', { name: /Enclosure/ }).click();
  await expect(tools(page).getByRole('button', { name: 'Move' })).toHaveAttribute('aria-pressed', 'true');
  await tools(page).getByRole('button', { name: 'Resize' }).click();
  await expect.poll(async () => (await anchors(viewport))['resize+x']).toBeTruthy();
  expect((await anchors(viewport))['rotate']).toBeUndefined();
  const x0 = Number(await field(page, 'X (m)').inputValue());
  const handle = await at(viewport, 'resize+x'); const centre = await at(viewport, 'enclosure-1');
  // outward, away from the enclosure's middle
  const [dx, dy] = [handle[0] - centre[0], handle[1] - centre[1]]; const length = Math.hypot(dx, dy);
  await drag(page, handle, [[handle[0] + dx / length * 40, handle[1] + dy / length * 40]], false);
  await expect(page.locator('.planner-readout')).toContainText(/Resizing Enclosure/);
  await expect(page.locator('.planner-readout')).toContainText(/Width \d+(\.\d)? cm \(\+\d+ mm\)/);
  await page.mouse.up();
  await expect(viewport).toHaveAttribute('data-revision', '1');
  const width = Number(await field(page, 'Width (cm)').inputValue());
  expect(width).toBeGreaterThan(200);
  // half the change on the side that moved: the other side stayed where it was
  expect(Number(await field(page, 'X (m)').inputValue())).toBeCloseTo(x0 + (width - 200) / 200, 1);
  await page.screenshot({ path: testInfo.outputPath('catio-planner-resize.png') });
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(field(page, 'Width (cm)')).toHaveValue('200');
  await expect(viewport).toHaveAttribute('data-revision', '0');
  expect(errors).toEqual([]);
});

test('raises a platform by its arrow, Page Up / Page Down and the Raise and Lower buttons, never while typing (#123)', async ({ page }, testInfo) => {
  const { viewport, errors } = await open(page);
  await page.getByRole('button', { name: /^Platform/ }).click();
  await expect(field(page, 'Elevation (cm)')).toHaveValue('120');
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  await page.getByRole('button', { name: 'Fit selection', exact: true }).click();
  await expect.poll(async () => (await anchors(viewport))['elevate']).toBeTruthy();
  const arrow = await at(viewport, 'elevate');
  await drag(page, arrow, [[arrow[0], arrow[1] - 30]], false);
  await expect(page.locator('.planner-readout')).toContainText(/Raising Platform 1/);
  await expect(page.locator('.planner-readout')).toContainText(/Elevation \d+(\.\d)? cm \(\+\d+ mm\)/);
  await page.mouse.up();
  await expect(viewport).toHaveAttribute('data-revision', '2');
  const raised = Number(await field(page, 'Elevation (cm)').inputValue());
  expect(raised).toBeGreaterThan(120);
  await page.screenshot({ path: testInfo.outputPath('catio-planner-elevate.png') });

  // Page Up 10 mm, Shift 100 mm, each one undo step; the buttons alike
  await page.locator('body').press('PageUp');
  await expect(field(page, 'Elevation (cm)')).toHaveValue(String(raised + 1));
  await page.locator('body').press('Shift+PageDown');
  await expect(field(page, 'Elevation (cm)')).toHaveValue(String(raised + 1 - 10));
  await tools(page).getByRole('button', { name: 'Raise' }).click();
  await expect(field(page, 'Elevation (cm)')).toHaveValue(String(raised - 8));
  await tools(page).getByRole('button', { name: 'Lower' }).click();
  await expect(field(page, 'Elevation (cm)')).toHaveValue(String(raised - 9));
  await expect(tools(page).getByRole('button', { name: 'Raise' })).toHaveAttribute('title', /Page Up; Shift: 100 mm/);
  const revision = await viewport.getAttribute('data-revision');
  // not while a field has the focus
  await field(page, 'Width (cm)').focus(); await page.keyboard.press('PageUp');
  await expect(viewport).toHaveAttribute('data-revision', revision ?? '');
  // an enclosure stands on the ground
  await tree(page).getByRole('button', { name: /^Enclosure/ }).click();
  await page.locator('body').press('PageUp');
  await expect(page.locator('.planner-status')).toContainText('An enclosure stands on the ground');
  await expect(tools(page).getByRole('button', { name: 'Raise' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('Top, Front and Side are orthographic and empty space pans them; 3D orbits; the Rotate tool turns the body (#123)', async ({ page }) => {
  const { viewport, errors } = await open(page);
  await expect(viewport).toHaveAttribute('data-projection', 'perspective');
  const box = await viewport.boundingBox(); if (!box) throw new Error('no viewport');
  const empty: [number, number] = [box.x + 30, box.y + box.height - 30];
  for (const name of ['Top', 'Front', 'Side']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(viewport).toHaveAttribute('data-projection', 'orthographic');
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  // a pan moves everything on the screen alike
  const before = await anchors(viewport);
  await drag(page, empty, [[empty[0] + 120, empty[1] - 60]]);
  await expect.poll(async () => ((await anchors(viewport))['enclosure-1']?.[0] ?? 0) - (before['enclosure-1']?.[0] ?? 0)).toBeGreaterThan(60);
  const after = await anchors(viewport);
  const shift = (id: string) => [(after[id]?.[0] ?? 0) - (before[id]?.[0] ?? 0), (after[id]?.[1] ?? 0) - (before[id]?.[1] ?? 0)];
  expect(Math.abs((shift('enclosure-1')[0] ?? 0) - (shift('window-1')[0] ?? 0))).toBeLessThan(3);
  expect(Math.abs((shift('enclosure-1')[1] ?? 0) - (shift('window-1')[1] ?? 0))).toBeLessThan(3);
  await expect(viewport).toHaveAttribute('data-selection', '[]');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-projection', 'perspective');

  // the Rotate tool: dragging the body turns it
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  await tree(page).getByRole('button', { name: /Enclosure/ }).click();
  await tools(page).getByRole('button', { name: 'Rotate' }).click();
  const enclosure = await at(viewport, 'enclosure-1'); const centre = await at(viewport, 'rotate-centre');
  const grip: [number, number] = [enclosure[0] + (enclosure[0] - centre[0]) * 0.2 + 25, enclosure[1] + (enclosure[1] - centre[1]) * 0.2];
  const angle = (p: [number, number], a: number): [number, number] => {
    const r = Math.hypot(p[0] - centre[0], p[1] - centre[1]); const t = Math.atan2(p[1] - centre[1], p[0] - centre[0]) + a;
    return [centre[0] + r * Math.cos(t), centre[1] + r * Math.sin(t)];
  };
  await drag(page, grip, [angle(grip, 0.3), angle(grip, 0.6)]);
  await expect(viewport).toHaveAttribute('data-revision', '1');
  expect(Math.abs(Number(await field(page, 'Yaw (°)').inputValue())) % 15).toBe(0);
  expect(await field(page, 'Yaw (°)').inputValue()).not.toBe('0');
  expect(errors).toEqual([]);
});

test('says 3D is unavailable without WebGL, and the tree and inspector still work', async ({ page }) => {
  await page.addInitScript(() => {
    // Preserve the browser method and explicitly restore its receiver with apply below.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (args[0].startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio/planner');
  await expect(page.getByText('3D is unavailable')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Top', exact: true })).toBeDisabled();
  await tree(page).getByRole('button', { name: /Enclosure/ }).click();
  await field(page, 'Height (cm)').fill('180'); await field(page, 'Height (cm)').press('Enter');
  await expect(field(page, 'Height (cm)')).toHaveValue('180');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(field(page, 'Height (cm)')).toHaveValue('200');
});
