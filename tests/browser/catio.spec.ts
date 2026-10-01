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
  await expect(gallery.getByRole('img')).toHaveCount(6);
  for (const img of await gallery.getByRole('img').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveJSProperty('complete', true);
    expect(await img.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(1000);
  }
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
  await expect(page.getByRole('region', { name: 'Catio concept images' }).getByRole('img')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('catio-mobile-fallback.png'), fullPage: true });
});
