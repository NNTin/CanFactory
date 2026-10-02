import { test, expect } from '@playwright/test';

test('explores the catio and its assembly without a catalogue or render service', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = []; const jobs: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/renders') && request.method() === 'POST') jobs.push(request.url()); });
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  const viewer = page.getByTestId('catio-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('heading', { name: 'A little closer to the grass.' })).toBeVisible();
  await expect(viewer).toHaveAttribute('data-visible-parts', /continuous-floor/);
  await page.getByRole('button', { name: 'Interior', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Wall cutaway' })).toBeChecked();
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /\bwall\b/);
  await page.getByRole('checkbox', { name: 'Window open' }).uncheck();
  await expect(viewer).toHaveAttribute('data-window', 'closed');
  const slider = page.getByRole('slider', { name: 'Catio assembly' });
  await slider.press('Home');
  await expect(viewer).toHaveAttribute('data-step', '0');
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /recess-collar/);
  for (let stage = 1; stage <= 6; stage++) {
    await page.getByRole('button', { name: 'Next assembly stage' }).click();
    await expect(viewer).toHaveAttribute('data-step', String(stage));
  }
  await page.getByRole('checkbox', { name: 'Exploded view' }).check();
  await expect(viewer).toHaveAttribute('data-exploded', 'true');
  await page.getByRole('button', { name: 'Metal mesh', exact: true }).click();
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /continuous-floor/);
  await page.getByRole('button', { name: 'Metal mesh', exact: true }).click();
  await expect(viewer).toHaveAttribute('data-visible-parts', /continuous-floor/);
  await page.getByRole('checkbox', { name: 'Exploded view' }).uncheck();
  await page.getByRole('button', { name: 'Reset catio view' }).click();
  await expect(page.getByRole('checkbox', { name: 'Wall cutaway' })).not.toBeChecked();
  for (const name of ['Front', 'Side', 'Top', 'Mounting', 'Exterior']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  const gallery = page.getByRole('region', { name: 'Catio concept images' });
  await expect(gallery.getByRole('img')).toHaveCount(12);
  await gallery.getByRole('button', { name: 'Direct', exact: true }).click();
  await expect(gallery.getByRole('img')).toHaveCount(6);
  for (const img of await gallery.getByRole('img').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveJSProperty('complete', true);
    expect(await img.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(1000);
  }
  const downloads = gallery.getByRole('link', { name: 'Download PNG' });
  await expect(downloads).toHaveCount(6);
  const [download] = await Promise.all([page.waitForEvent('download'), downloads.first().click()]);
  expect(download.suggestedFilename()).toBe('01-overview.png');
  await page.screenshot({ path: testInfo.outputPath('catio-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Model library', exact: false }).first().click();
  await expect(page).toHaveURL(/#\/models$/);
  await page.goBack(); await expect(viewer).toHaveAttribute('data-ready', 'true');
  expect(errors).toEqual([]); expect(jobs).toEqual([]);
});

test('keeps the gallery and all six assembly instructions available without WebGL on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.goto('/#/concepts/catio');
  await expect(page.getByText('3D preview needs WebGL', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Assembly instructions' }).getByRole('listitem')).toHaveCount(6);
  await expect(page.getByRole('region', { name: 'Catio concept images' }).getByRole('img')).toHaveCount(12);
  await page.getByRole('button', { name: 'Modular · with tunnel', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Glass width', exact: true })).toHaveValue('80');
  await expect(page.getByRole('region', { name: 'Assembly instructions' }).getByText('Fit the window insert', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('catio-mobile-fallback.png'), fullPage: true });
});

test('configures modular routes, gates and independent enclosures, retaining valid saved designs', async ({ page }, testInfo) => {
  const errors: string[] = []; const jobs: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/renders') && request.method() === 'POST') jobs.push(request.url()); });
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  const viewer = page.getByTestId('catio-viewer');
  await expect(viewer).toHaveAttribute('data-mode', 'direct');
  await page.getByRole('button', { name: 'Interior', exact: true }).click();
  await page.getByRole('button', { name: 'Modular · with tunnel', exact: true }).click();
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-mode', 'modular');
  await expect(page.getByRole('button', { name: 'Exterior', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('combobox', { name: 'Tunnel route' }).selectOption('right');
  await expect(viewer).toHaveAttribute('data-config', /"route":"right"/);
  await expect(page.getByRole('spinbutton', { name: 'Lateral modules' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Approach modules' }).fill('3');
  await page.getByRole('checkbox', { name: 'Add second enclosure' }).check();
  await page.getByRole('spinbutton', { name: 'Enclosure B width', exact: true }).fill('180');
  await expect(page.getByRole('spinbutton', { name: 'Enclosure A width', exact: true })).toHaveValue('120');
  await expect(viewer).toHaveAttribute('data-visible-parts', /b-continuous-floor/);
  await expect(page.getByRole('checkbox', { name: 'Enclosure B rear cat gate' })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Enclosure B left cat gate' })).toBeChecked();
  const before = await viewer.getAttribute('data-config');
  await page.getByRole('spinbutton', { name: 'Sash width', exact: true }).fill('60');
  await expect(page.getByRole('alert')).toContainText('Showing the last valid design.');
  await expect(viewer).toHaveAttribute('data-config', before ?? '');
  await page.getByRole('spinbutton', { name: 'Sash width', exact: true }).fill('100');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Window cat gate', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Enclosure A maintenance door', exact: true }).check();
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('modular-offset-two-enclosures.png'), fullPage: true });
  await page.reload();
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-mode', 'modular');
  await expect(page.getByRole('spinbutton', { name: 'Enclosure B width', exact: true })).toHaveValue('180');
  await expect(page.getByRole('checkbox', { name: 'Window cat gate', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Enclosure A maintenance door', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Top', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Direct · original design', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Interior', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer).toHaveAttribute('data-visible-parts', /continuous-floor/);
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /tunnel-/);
  await page.getByRole('button', { name: 'Modular · with tunnel', exact: true }).click();
  await page.getByRole('button', { name: 'Reset modular dimensions', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Sash width', exact: true })).toHaveValue('91');
  await expect(page.getByRole('combobox', { name: 'Tunnel route' })).toHaveValue('straight');
  await expect(page.getByRole('checkbox', { name: 'Add second enclosure' })).not.toBeChecked();
  const slider = page.getByRole('slider', { name: 'Catio assembly' });
  await slider.press('Home');
  for (let stage = 1; stage <= 6; stage++) {
    await page.getByRole('button', { name: 'Next assembly stage' }).click();
    await expect(viewer).toHaveAttribute('data-step', String(stage));
  }
  for (const camera of ['Exterior', 'Interior', 'Front', 'Side', 'Top', 'Mounting']) {
    await page.getByRole('button', { name: camera, exact: true }).click();
    await expect(page.getByRole('button', { name: camera, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  const gallery = page.getByRole('region', { name: 'Catio concept images' });
  await gallery.getByRole('button', { name: 'Modular', exact: true }).click();
  await expect(gallery.getByRole('img')).toHaveCount(6);
  for (const img of await gallery.getByRole('img').all()) {
    await img.scrollIntoViewIfNeeded(); await expect(img).toHaveJSProperty('complete', true);
    expect(await img.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(1000);
  }
  const [download] = await Promise.all([page.waitForEvent('download'), gallery.getByRole('link', { name: 'Download PNG' }).first().click()]);
  expect(download.suggestedFilename()).toBe('07-modular-overview.png');
  expect(errors).toEqual([]); expect(jobs).toEqual([]);
});
