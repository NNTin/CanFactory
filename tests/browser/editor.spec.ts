import { readFile } from 'node:fs/promises';
import { test, expect, type Route } from '@playwright/test';
import { unzipSync } from 'fflate';
import { Value } from 'typebox/value';
import { mossPlanter, RenderRequestSchema, type Render } from '@canfactory/contracts';
import { inspectStl } from '@canfactory/server';

test('customize, inspect, download identical geometry, and restore local settings', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fruit fly trap', exact: true })).toBeVisible();
  const downloadButton = page.getByRole('button', { name: 'Download STL', exact: true });
  await expect(downloadButton).toBeEnabled({ timeout: 90_000 });
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
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
