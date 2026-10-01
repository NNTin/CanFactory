import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { unzipSync } from 'fflate';
import { activeParts, aiDuckAssembly, aiRubberDuck, AI_DUCK_VARIANTS } from '@canfactory/contracts';
import { inspectStl } from '@canfactory/server';

test('prints all eight ducks as separate colored pieces and assembles the downloaded geometry', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/models/ai-rubber-duck');
  const version = page.getByRole('combobox', { name: 'Version', exact: true });
  const download = page.getByRole('button', { name: 'Download ZIP', exact: true });
  const assembly = page.getByRole('slider', { name: 'Assembly', exact: true });
  const viewer = page.getByTestId('stl-viewer');
  await expect(version.locator('option')).toHaveCount(8);
  for (const variant of AI_DUCK_VARIANTS) {
    await version.selectOption(variant);
    await expect(download).toBeEnabled({ timeout: 120_000 });
    const parameters = { ...aiRubberDuck.defaults, variant };
    const parts = activeParts(aiRubberDuck, parameters);
    await expect(viewer).toHaveAttribute('data-visible-parts', parts.map(part => part.id).join(' '));
    const controls = page.getByRole('group', { name: 'Visible parts' });
    for (const part of parts) {
      const color = aiDuckAssembly(parameters).partColors?.[part.id];
      await expect(controls.getByRole('button', { name: part.title, exact: true }).locator('.part-color'))
        .toHaveAttribute('title', `Suggested filament: ${color}`);
    }
    await assembly.press('Home');
    await expect(assembly).toHaveAttribute('aria-valuetext', 'Parts as printed');
    await assembly.press('ArrowRight');
    await expect(assembly).toHaveAttribute('aria-valuetext', 'Lift and lay out the parts');
    await assembly.press('End');
    await expect(assembly).toHaveAttribute('aria-valuetext', 'Assembled');
    const body = controls.getByRole('button', { name: 'Duck body', exact: true });
    await body.click();
    await expect(viewer).toHaveAttribute('data-visible-parts', parts.filter(part => part.id !== 'body').map(part => part.id).join(' '));
    await body.click();
    const event = page.waitForEvent('download');
    await download.click();
    const path = await (await event).path();
    if (!path) throw new Error('Missing ZIP');
    const entries = unzipSync(await readFile(path));
    expect(Object.keys(entries)).toEqual(parts.map(part => `${part.id}.stl`));
    for (const bytes of Object.values(entries)) expect(inspectStl(Buffer.from(bytes)).volume).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath(`${variant}.png`), fullPage: true });
  }
  await page.getByRole('spinbutton', { name: 'Body length', exact: true }).fill('70');
  await page.getByRole('button', { name: 'Advanced settings' }).click();
  await page.getByRole('spinbutton', { name: 'Joint clearance', exact: true }).fill('0.25');
  await expect(download).toBeEnabled({ timeout: 120_000 });
  await page.reload();
  await expect(version).toHaveValue('openai-v2-sculpted');
  await expect(page.getByRole('spinbutton', { name: 'Body length', exact: true })).toHaveValue('70');
  await expect(download).toBeEnabled({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Toggle wireframe' }).click();
  await expect(page.getByRole('button', { name: 'Toggle wireframe' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('keeps the old colors and assembly while a different duck and size render', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/#/models/ai-rubber-duck');
  const download = page.getByRole('button', { name: 'Download ZIP', exact: true });
  await expect(download).toBeEnabled({ timeout: 120_000 });
  const assembly = page.getByRole('slider', { name: 'Assembly', exact: true });
  await assembly.press('End');
  const viewer = page.getByTestId('stl-viewer');
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const imageHash = async () => createHash('sha256').update(await viewer.locator('canvas').evaluate(canvas => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing preview canvas');
    return new Promise<string>(resolve => requestAnimationFrame(() => resolve(canvas.toDataURL())));
  })).digest('hex');
  const before = await imageHash();
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  let captured: () => void = () => {};
  const waiting = new Promise<void>(resolve => { captured = resolve; });
  await page.route('**/api/v1/renders', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    captured(); await held; await route.continue();
  });
  await page.getByRole('combobox', { name: 'Version', exact: true }).selectOption('codex-v2-sculpted');
  await waiting;
  await page.getByRole('spinbutton', { name: 'Body length', exact: true }).fill('120');
  await expect(download).toBeDisabled();
  await expect(viewer).toHaveAttribute('data-visible-parts', 'body face');
  await expect(page.getByRole('group', { name: 'Visible parts' }).getByRole('button', { name: 'Face / head', exact: true }).locator('.part-color'))
    .toHaveAttribute('title', 'Suggested filament: #d7774b');
  expect(await imageHash()).toBe(before);
  release();
  await expect(download).toBeEnabled({ timeout: 120_000 });
  await expect(viewer).toHaveAttribute('data-visible-parts', 'body face chevron bar');
  await expect(page.getByRole('group', { name: 'Visible parts' }).getByRole('button', { name: 'Face / head', exact: true }).locator('.part-color'))
    .toHaveAttribute('title', 'Suggested filament: #292b2e');
  await assembly.press('Home'); await assembly.press('ArrowRight'); await assembly.press('ArrowRight');
  await expect(assembly).toHaveAttribute('aria-valuetext', 'Step 1 of 2 · Push the white inserts into the terminal face');
});
