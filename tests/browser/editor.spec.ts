import { readFile } from 'node:fs/promises';
import { test, expect, type Route } from '@playwright/test';
import { unzipSync } from 'fflate';
import { Value } from 'typebox/value';
import { activeParts, cigaretteCase, mossPlanter, RenderRequestSchema, type Render } from '@canfactory/contracts';
import { inspectStl } from '@canfactory/server';

test('customize, inspect, download identical geometry, and restore local settings', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fruit fly trap', exact: true })).toBeVisible();
  const downloadButton = page.getByRole('button', { name: 'Download STL', exact: true });
  await expect(downloadButton).toBeEnabled({ timeout: 90_000 });
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
  await expect(page.getByRole('slider', { name: 'Assembly' })).toHaveCount(0);
  await page.getByRole('switch', { name: 'Ventilation slots' }).click();
  await page.getByRole('spinbutton', { name: 'Funnel diameter', exact: true }).fill('70');
  await page.getByRole('spinbutton', { name: 'Funnel height', exact: true }).fill('72');
  await page.getByRole('spinbutton', { name: 'Brim width', exact: true }).fill('8');
  await expect(downloadButton).toBeDisabled();
  await expect(downloadButton).toBeEnabled({ timeout: 90_000 });
  await expect(page.getByText('86.0 × 105.2 × 72.0')).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).not.toBeNull();
  if (!path) throw new Error('Missing download');
  const bytes = await readFile(path);
  const mesh = inspectStl(bytes);
  expect(mesh.dimensions.x).toBeCloseTo(86, 3);
  expect(mesh.dimensions.z).toBeCloseTo(72, 3);
  expect(mesh.triangles).toBeLessThan(2000);
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Funnel height', exact: true })).toHaveValue('72');
  await expect(page.getByRole('switch', { name: 'Ventilation slots' })).not.toBeChecked();
  await expect(downloadButton).toBeEnabled();
  await page.getByRole('button', { name: 'Advanced settings' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Slot width', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Funnel height', exact: true })).toHaveValue('60');
  expect(errors).toEqual([]);
});

test('keeps stale results out of the viewer and coalesces pending edits', async ({ page }) => {
  const pending: Route[] = [];
  const previews: string[] = [];
  await page.route('**/api/v1/renders', route => { pending.push(route); });
  page.on('request', request => { if (request.url().includes('reference.stl')) previews.push(request.url()); });
  await page.goto('/');
  await expect.poll(() => pending.length).toBe(1);
  await page.getByRole('spinbutton', { name: 'Funnel height', exact: true }).fill('75');
  await page.getByRole('spinbutton', { name: 'Funnel height', exact: true }).fill('80');
  await page.waitForTimeout(650);
  expect(pending).toHaveLength(1);
  const result = (id: string): Render => ({
    id, modelId: 'fruit-fly-trap', modelVersion: '1', status: 'succeeded', createdAt: Date.now(), expiresAt: Date.now() + 3600000,
    slotCount: 792, error: null,
    artifact: { url: `/api/v1/models/fruit-fly-trap/reference.stl?revision=${id}`, sha256: 'test', bytes: 100, triangles: 22314, dimensions: { x: 80, y: 104, z: 60 }, volume: 100 },
  });
  const old = pending[0]; if (!old) throw new Error('Missing initial request');
  await old.fulfill({ status: 200, json: result('old') });
  await expect.poll(() => pending.length).toBe(2);
  await expect(page.getByRole('button', { name: 'Download STL', exact: true })).toBeDisabled();
  expect(previews.some(url => url.includes('revision=old'))).toBe(false);
  const current = pending[1]; if (!current) throw new Error('Missing current request');
  const body: unknown = current.request().postDataJSON();
  expect(Value.Check(RenderRequestSchema, body)).toBe(true);
  if (!Value.Check(RenderRequestSchema, body)) throw new Error('Invalid request body');
  if (body.modelId !== 'fruit-fly-trap') throw new Error('Expected a fruit fly trap request');
  expect(body.parameters.trapHeight).toBe(80);
  await current.fulfill({ status: 200, json: result('new') });
  await expect(page.getByRole('button', { name: 'Download STL', exact: true })).toBeEnabled();
  expect(previews.some(url => url.includes('revision=new'))).toBe(true);
});

test('shows validation and render errors with a working retry', async ({ page }) => {
  await page.route('**/api/v1/renders', async route => {
    await route.fulfill({ status: 429, json: { code: 'QUEUE_FULL', message: 'The render queue is full. Wait a moment and try again.', issues: [] } });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('queue is full');
  await page.unroute('**/api/v1/renders');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Download STL', exact: true })).toBeEnabled();
  await page.getByRole('spinbutton', { name: 'Funnel diameter', exact: true }).fill('20');
  await page.getByRole('spinbutton', { name: 'Central opening', exact: true }).fill('30');
  await expect(page.getByRole('alert')).toContainText('smaller than the funnel diameter');
  await expect(page.getByRole('button', { name: 'Download STL', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Advanced settings' }).click();
  await page.getByRole('spinbutton', { name: 'Slot height', exact: true }).fill('1.3');
  await expect(page.getByRole('button', { name: 'Download STL', exact: true })).toBeDisabled();
  await page.getByRole('switch', { name: 'Ventilation slots' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Slot height', exact: true })).toBeDisabled();
  await expect(page.getByRole('spinbutton', { name: 'Slot height', exact: true })).toHaveValue('1.6');
  await expect(page.getByRole('button', { name: 'Download STL', exact: true })).toBeEnabled();
});

test('renders a usable mobile layout and model library', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Download STL', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'CanFactory model library' }).click();
  await expect(page.getByRole('heading', { name: 'Useful things. Made to fit.' })).toBeVisible();
  await page.getByRole('button', { name: /CUSTOMIZABLE · STL Fruit fly trap/ }).click();
  await expect(page.getByRole('heading', { name: 'Fruit fly trap', exact: true })).toBeVisible();
});

test('customizes the moss planter tower diameter and downloads a ZIP of all five parts', async ({ page }) => {
  // Five sequential OpenSCAD invocations (two are lattices) take much longer than fruit-fly-trap's single render.
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'CanFactory model library' }).click();
  await page.getByRole('button', { name: /CUSTOMIZABLE · ZIP Moss planter/ }).click();
  await expect(page.getByRole('heading', { name: 'Moss planter (Verdura)', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Make it yours', exact: true })).toBeVisible();
  await page.getByLabel('Tower diameter', { exact: true }).fill('75');
  await page.getByLabel('Ground spike length', { exact: true }).fill('180');
  const downloadButton = page.getByRole('button', { name: 'Download ZIP', exact: true });
  await expect(downloadButton).toBeEnabled({ timeout: 270_000 });
  await expect(page.getByText(/5\s*·\s*[\d.]+\s*cm³ total/)).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).not.toBeNull();
  if (!path) throw new Error('Missing download');
  const bytes = await readFile(path);
  const entries = unzipSync(new Uint8Array(bytes));
  expect(Object.keys(entries).sort()).toEqual(mossPlanter.parts.map(part => `${part.id}.stl`).sort());
  for (const [name, entryBytes] of Object.entries(entries)) {
    const asBuffer = Buffer.from(entryBytes.buffer, entryBytes.byteOffset, entryBytes.byteLength);
    expect(inspectStl(asBuffer).volume, name).toBeGreaterThan(0);
  }
  const cap = entries['cover-cap.stl'];
  const spike = entries['ground-spike.stl'];
  if (!cap || !spike) throw new Error('Missing parts in the ZIP');
  expect(inspectStl(Buffer.from(cap.buffer, cap.byteOffset, cap.byteLength)).dimensions.x).toBeCloseTo(75, 1);
  expect(inspectStl(Buffer.from(spike.buffer, spike.byteOffset, spike.byteLength)).dimensions.z).toBeCloseTo(180, 1);
  expect(errors).toEqual([]);
});

test('shows the cigarette case, offers snap, clearance and text settings and downloads a ZIP with the second-filament text part', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'CanFactory model library' }).click();
  await page.getByRole('button', { name: /CUSTOMIZABLE · ZIP Cigarette case/ }).click();
  await expect(page.getByRole('heading', { name: 'Cigarette case (Onz)', exact: true })).toBeVisible();
  await expect(page.getByText('PARAMETRIC MODEL')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Make it yours', exact: true })).toBeVisible();
  const snap = page.getByLabel('Case lid snap');
  await expect(snap).toHaveValue('friction');
  for (const label of ['Mini box lid', 'Holder in the box', 'Lighter in the box', 'Mini box in the lid']) await expect(page.getByLabel(label, { exact: true })).toHaveValue('friction');
  // Clearance, in advanced settings: the fit is named as the value changes, and the range that suits every joint's setting is shown,
  // with the joints the value is outside of.
  await page.getByRole('button', { name: 'Advanced settings' }).click();
  const clearance = page.getByRole('spinbutton', { name: 'Clearance' });
  const fit = page.getByTestId('parameter-clearance-note');
  await expect(clearance).toHaveValue('0.2');
  await expect(fit).toContainText('Snug fit');
  await expect(fit).toContainText('In the 0.10–0.20 mm recommended for these settings');
  await snap.selectOption('clip');
  await expect(page.getByText('A flexible tongue on the lid')).toBeVisible();
  await expect(fit).toContainText('In the 0.20 mm recommended for these settings');
  await expect(page.getByRole('slider', { name: 'Clearance slider' })).toHaveClass(/range-recommended/);
  await clearance.fill('0.12');
  await expect(fit).toContainText('Very tight (press fit)');
  await expect(fit).toContainText('Outside the 0.20 mm recommended for these settings');
  await expect(fit).toContainText('Case lid snap (Clip): 0.20–0.40 mm');
  await clearance.fill('0.3');
  await expect(fit).toContainText('Sliding fit');
  await expect(fit).toContainText('Holder in the box (Friction fit): 0.10–0.20 mm');
  await expect(fit).toContainText('Lighter in the box (Friction fit): 0.10–0.25 mm');
  await expect(fit).not.toContainText('Case lid snap (Clip)');
  await page.getByLabel('Holder in the box', { exact: true }).selectOption('detent');
  await expect(page.getByText('push it out from above', { exact: false })).toBeVisible();
  await page.getByLabel('Mini box in the lid', { exact: true }).selectOption('crush-ribs');
  await page.getByLabel('Mini box lid', { exact: true }).selectOption('detent');
  // the lighter's friction fit is recommended only up to 0.25 mm, so at 0.3 mm it is still listed until it uses crush ribs too
  await expect(fit).toContainText('Outside the 0.20–0.25 mm recommended for these settings');
  await expect(fit).toContainText('Lighter in the box (Friction fit): 0.10–0.25 mm');
  await expect(page.getByRole('spinbutton', { name: 'Crush-rib squeeze (lighter in the box)' })).toHaveCount(0);
  await page.getByLabel('Lighter in the box', { exact: true }).selectOption('crush-ribs');
  await expect(page.getByRole('spinbutton', { name: 'Crush-rib squeeze (lighter in the box)' })).toHaveValue('0.1');
  await expect(fit).toContainText('In the 0.20–0.40 mm recommended for these settings');
  await expect(fit).not.toContainText('Friction fit');
  // Each joint's engagement or squeeze appears in advanced settings only while that joint uses the mechanism, with its default and
  // recommended range; a groove too deep for its 1 mm wall is refused.
  const holderEngage = page.getByRole('spinbutton', { name: 'Detent engagement (holder in the box)' });
  const holderNote = page.getByTestId('parameter-holderDetentEngage-note');
  await expect(holderEngage).toHaveValue('0.15');
  await expect(holderNote).toContainText('Default 0.15 mm');
  await expect(holderNote).toContainText('In the 0.10–0.20 mm recommended for Detent');
  await expect(page.getByRole('slider', { name: 'Detent engagement (holder in the box) slider' })).toHaveClass(/range-recommended/);
  await expect(page.getByRole('spinbutton', { name: 'Crush-rib squeeze (mini box in the lid)' })).toHaveValue('0.1');
  const miniLidEngage = page.getByRole('spinbutton', { name: 'Detent engagement (mini box lid)' });
  await expect(miniLidEngage).toHaveValue('0.12');
  await expect(page.getByRole('spinbutton', { name: 'Detent engagement (case lid)' })).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Crush-rib squeeze (holder in the box)' })).toHaveCount(0);
  await holderEngage.fill('0.25');
  await expect(holderNote).toContainText('Outside the 0.10–0.20 mm recommended for Detent');
  await miniLidEngage.fill('0.4');
  await clearance.fill('0.45');
  await expect(page.locator('#parameter-miniLidDetentEngage-error')).toContainText('deep groove');
  await clearance.fill('0.3');
  await expect(page.locator('#parameter-miniLidDetentEngage-error')).toHaveCount(0);
  await miniLidEngage.fill('0.12');
  await holderEngage.fill('0.15');
  await page.getByLabel('Holder in the box', { exact: true }).selectOption('friction');
  await expect(holderEngage).toHaveCount(0);
  await page.getByLabel('Holder in the box', { exact: true }).selectOption('detent');
  await expect(holderEngage).toHaveValue('0.15');
  const text = page.getByLabel('Underside text');
  await expect(text).toHaveValue('');
  await text.fill('Tom');
  await page.getByLabel('Text font').selectOption('mono');
  await page.getByLabel('Text style').selectOption('second-filament');
  await text.fill('W'.repeat(14));
  await expect(page.locator('#parameter-engraveText-error')).toContainText('mm wide at this font and size');
  await text.fill('Tom');
  await expect(page.locator('#parameter-engraveText-error')).toHaveCount(0);
  await expect(page.getByText(/mm wide at this font and size/)).toHaveCount(0);
  const downloadButton = page.getByRole('button', { name: 'Download ZIP', exact: true });
  await expect(downloadButton).toBeEnabled({ timeout: 270_000 });
  // The assembly slider: from the print bed, stop by stop (arrow keys), to the finished case.
  const assembly = page.getByRole('slider', { name: 'Assembly' });
  await expect(assembly).toHaveAttribute('aria-valuetext', 'Parts as printed');
  await assembly.press('ArrowRight');
  await expect(assembly).toHaveAttribute('aria-valuetext', 'Lift and lay out the parts');
  await assembly.press('ArrowRight');
  await expect(assembly).toHaveAttribute('aria-valuetext', `Step 1 of ${cigaretteCase.assembly.steps.length} · Close the mini box`);
  await assembly.press('End');
  await expect(assembly).toHaveAttribute('aria-valuetext', 'Assembled');
  await assembly.press('ArrowLeft');
  await expect(assembly).toHaveAttribute('aria-valuetext', `Step ${cigaretteCase.assembly.steps.length - 1} of ${cigaretteCase.assembly.steps.length} · Insert the lighter into its bay`);
  // Every part, and the lighter, is shown by default; each can be hidden and shown again from the parts list under the slider.
  const viewer = page.getByTestId('stl-viewer');
  const visibleParts = [...activeParts(cigaretteCase, { ...cigaretteCase.defaults, engraveText: 'Tom', textMode: 'second-filament' }).map(part => part.id), 'mini-bic-lighter'];
  const partsList = page.getByRole('group', { name: 'Visible parts' });
  for (const title of [...cigaretteCase.parts.filter(part => part.id !== 'case-text').map(part => part.title), 'BIC Mini lighter (J25)'])
    await expect(partsList.getByRole('button', { name: title, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer).toHaveAttribute('data-visible-parts', visibleParts.join(' '));
  const caseBox = partsList.getByRole('button', { name: 'Case box (large)', exact: true });
  await caseBox.click();
  await expect(caseBox).toHaveAttribute('aria-pressed', 'false');
  await expect(viewer).toHaveAttribute('data-visible-parts', visibleParts.filter(id => id !== 'case-box').join(' '));
  await caseBox.click();
  await expect(caseBox).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer).toHaveAttribute('data-visible-parts', visibleParts.join(' '));
  const downloadEvent = page.waitForEvent('download');
  await downloadButton.click();
  const path = await (await downloadEvent).path();
  if (!path) throw new Error('Missing download');
  const entries = unzipSync(new Uint8Array(await readFile(path)));
  expect(Object.keys(entries).sort()).toEqual(activeParts(cigaretteCase, { ...cigaretteCase.defaults, engraveText: 'Tom', textMode: 'second-filament' }).map(part => `${part.id}.stl`).sort());
  expect(Object.keys(entries)).toContain('case-text.stl');
  // The lighter is shown in the preview only: it is a real object, not a part to print.
  expect(Object.keys(entries)).not.toContain('mini-bic-lighter.stl');
  for (const [name, entryBytes] of Object.entries(entries)) {
    expect(inspectStl(Buffer.from(entryBytes.buffer, entryBytes.byteOffset, entryBytes.byteLength), { allowDisconnected: name === 'case-text.stl' }).volume, name).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

test('customizes the plank connector pocket, depth and screw holes and downloads the matching STL', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'CanFactory model library' }).click();
  const card = page.getByRole('button', { name: /CUSTOMIZABLE · STL Plank connector/ });
  await card.hover();
  await page.screenshot({ path: testInfo.outputPath('library.png'), fullPage: true });
  await card.click();
  await expect(page.getByRole('heading', { name: 'Plank connector', exact: true })).toBeVisible();
  const downloadButton = page.getByRole('button', { name: 'Download STL', exact: true });
  await expect(page.getByRole('spinbutton', { name: 'Pocket width', exact: true })).toHaveValue('50.22');
  await expect(page.getByRole('spinbutton', { name: 'Pocket thickness', exact: true })).toHaveValue('4.8');
  const screwHoles = page.getByLabel('Screw holes');
  await expect(screwHoles).toHaveValue('none');
  await expect(downloadButton).toBeEnabled({ timeout: 90_000 });
  await expect(page.getByText('54.2 × 8.8 × 42.0')).toBeVisible();
  // a hole too large for a shallow pocket is rejected before rendering
  await page.getByRole('spinbutton', { name: 'Insertion depth', exact: true }).fill('8');
  await screwHoles.selectOption('M8');
  await expect(page.locator('#parameter-insertionDepth-error')).toContainText('insertion depth of at least 11 mm');
  await expect(downloadButton).toBeDisabled();
  await screwHoles.selectOption('M4');
  await expect(page.getByText('Through-holes for M4 screws: 4.3 / 4.5 / 4.8 mm')).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Insertion depth', exact: true }).fill('25');
  await page.getByRole('spinbutton', { name: 'Pocket width', exact: true }).fill('60.3');
  await expect(downloadButton).toBeEnabled({ timeout: 90_000 });
  await page.screenshot({ path: testInfo.outputPath('plank-connector.png'), fullPage: true });
  const downloadEvent = page.waitForEvent('download');
  await downloadButton.click();
  const path = await (await downloadEvent).path();
  if (!path) throw new Error('Missing download');
  const mesh = inspectStl(await readFile(path));
  expect(mesh.dimensions.x).toBeCloseTo(64.3, 3);
  expect(mesh.dimensions.y).toBeCloseTo(8.8, 3);
  expect(mesh.dimensions.z).toBeCloseTo(52, 3);
  expect(errors).toEqual([]);
});
