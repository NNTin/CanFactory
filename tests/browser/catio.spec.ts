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

test('opens the window insert, adjusts its joints and clamps, and stages its assembly with a parts list', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  await page.getByRole('navigation', { name: 'Catio sub-assemblies' }).getByRole('link', { name: /Window insert/ }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/window-insert$/);
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-variant', 'direct');
  const hardware = page.getByRole('table', { name: 'Hardware parts' });
  // hung on the window frame by default: bought screen hooks behind the frame's lip, printed feet under the sill rail
  await expect(viewer).toHaveAttribute('data-visible-parts', /screen-hooks/);
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /spreader-clamps/);
  await expect(hardware.getByRole('link', { name: 'Insect screen hook, short (Windhager 03651, 5b)' })).toHaveAttribute('href', '#/parts/screen-hook/windhager-03651-5b');
  await expect(hardware.getByRole('link', { name: 'Pressure pad, foot' })).toBeVisible();
  await expect(hardware.getByRole('link', { name: 'Pressure pad, thrust pad' })).toHaveCount(0);
  // pressed into the recess instead: printed pads on library screws; the Ganter feet stay selectable
  await page.getByRole('combobox', { name: 'Held in the recess by' }).selectOption('spreader-feet');
  await expect(viewer).toHaveAttribute('data-visible-parts', /spreader-clamps/);
  await expect(hardware.getByRole('link', { name: 'Pressure pad, thrust pad' })).toHaveAttribute('href', '#/models/pressure-pad');
  await expect(hardware.getByRole('link', { name: 'Pressure pad, foot' })).toHaveAttribute('href', '#/models/pressure-pad');
  await expect(hardware.getByRole('link', { name: 'Hexagon head screw M8 × 80' })).toBeVisible();
  await expect(hardware.getByRole('link', { name: 'Nylon-insert lock nut M8' })).toBeVisible();
  await expect(hardware.getByRole('link', { name: 'Insert nut for wood M8 × 18' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Pad height' }).fill('30');
  await expect(viewer).toHaveAttribute('data-config', /"padHeight":30/);
  await expect(hardware.getByText('Ø 32 × 30 mm · grooved sole · PETG · for an ISO 10511 M8 nut')).toBeVisible();
  await page.getByRole('combobox', { name: 'Pad sole' }).selectOption('domed');
  await expect(viewer).toHaveAttribute('data-config', /"padSurface":"domed"/);
  // the feet and the pads' height set the clamp gap, and with it the port's floor the tunnel and the coupling start from
  const parameters = page.getByRole('complementary', { name: 'Window insert parameters' });
  for (const name of ['Spreader feet', 'Pad height']) await expect(parameters.locator('label', { has: page.getByRole(name === 'Pad height' ? 'spinbutton' : 'combobox', { name }) }).locator('.subassembly-affects')).toHaveText('Also changes the tunnel and the insert–tunnel coupling.');
  await page.getByRole('combobox', { name: 'Spreader feet' }).selectOption('ganter');
  await expect(hardware.getByRole('link', { name: 'Levelling foot 32 mm, M8 × 63, rubber pad' })).toHaveAttribute('href', '#/parts/levelling-foot/ganter-gn-343-2-32-m8-63-kr');
  await expect(hardware.getByRole('link', { name: 'Pressure pad, thrust pad' })).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Pad height' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Collar corners' }).selectOption('butt-screwed');
  await expect(viewer).toHaveAttribute('data-config', /"cornerJoint":"butt-screwed"/);
  await expect(hardware.getByRole('link', { name: 'Countersunk wood screw 5 × 70' })).toBeVisible();
  // hung on the window frame like an insect screen: bought hooks behind the frame's lip, the feet only under the sill rail
  await page.getByRole('combobox', { name: 'Held in the recess by' }).selectOption('frame-hooks');
  await expect(viewer).toHaveAttribute('data-visible-parts', /screen-hooks/);
  await expect(page.getByRole('combobox', { name: 'Overlap on the frame' })).toBeVisible();
  await expect(page.getByText('Hooks · bent at')).toBeVisible();
  await expect(hardware.getByRole('link', { name: 'Insect screen hook, long (Windhager 03651, 5a)' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Seal gap' }).fill('1');
  await expect(page.getByText(/too narrow for the hooks’ 0.8 mm strip/)).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Seal gap' }).fill('3.5');
  await page.getByRole('combobox', { name: 'Held in the recess by' }).selectOption('folding-wedges');
  await expect(viewer).toHaveAttribute('data-visible-parts', /folding-wedges/);
  await expect(page.getByRole('combobox', { name: 'Foot diameter' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Window open' }).uncheck();
  await expect(viewer).toHaveAttribute('data-window', 'closed');
  await page.getByRole('button', { name: 'Mounting', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Wall cutaway' })).toBeChecked();
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /\bwall\b/);
  const slider = page.getByRole('slider', { name: 'Window insert assembly' });
  await slider.press('Home');
  await expect(viewer).toHaveAttribute('data-step', '0');
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /collar-head/);
  // mid-stage, the caption names the piece moving and how it goes in
  await slider.fill('0.8');
  await expect(page.getByTestId('assembly-action')).toContainText('8 × Countersunk wood screw 5 × 70: driven through the stiles');
  await slider.press('Home');
  for (let stage = 1; stage <= 6; stage++) {
    await page.getByRole('button', { name: 'Next assembly stage' }).click();
    await expect(viewer).toHaveAttribute('data-step', String(stage));
  }
  await expect(viewer).toHaveAttribute('data-visible-parts', /docking-brackets/);
  await page.getByRole('button', { name: 'Modular · with tunnel', exact: true }).click();
  await expect(viewer).toHaveAttribute('data-variant', 'modular');
  await expect(viewer).toHaveAttribute('data-visible-parts', /cat-gate/);
  await expect(page.getByRole('combobox', { name: 'Port transom & jambs' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Mesh parts' }).getByRole('row')).toHaveCount(4);
  // the pages fitted to the insert, and the settings that change them
  const brief = page.getByRole('complementary', { name: 'Window insert parameters' });
  await expect(brief.getByText(/is fitted to this one|are fitted to this one/)).toContainText('The tunnel and the insert–tunnel coupling are fitted to this one');
  await expect(brief.locator('label', { has: page.getByRole('combobox', { name: 'Foot diameter' }) }).locator('.subassembly-affects')).toHaveText('Also changes the tunnel and the insert–tunnel coupling.');
  await expect(brief.locator('label', { has: page.getByRole('combobox', { name: 'Mesh to timber' }) }).locator('.subassembly-affects')).toHaveText('Also changes the insert–tunnel coupling.');
  await expect(brief.locator('label', { has: page.getByRole('combobox', { name: 'Clamps per side' }) }).locator('.subassembly-affects')).toHaveCount(0);
  await expect(brief.getByText('Cat port floor · above the grass')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Exploded view' }).check();
  await expect(viewer).toHaveAttribute('data-exploded', 'true');
  await page.screenshot({ path: testInfo.outputPath('window-insert-modular.png'), fullPage: true });
  await page.reload();
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-variant', 'modular');
  await page.getByRole('button', { name: 'Direct · original design', exact: true }).click();
  await expect(viewer).toHaveAttribute('data-config', /"attachment":"folding-wedges"/);
  await page.getByRole('button', { name: 'Reset to the recommended defaults' }).click();
  await expect(viewer).toHaveAttribute('data-config', /"attachment":"frame-hooks"/);
  await page.getByRole('button', { name: 'Catio concept', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/concepts\/catio$/);
  expect(errors).toEqual([]);
});

test('opens the tunnel, solves its route to the enclosure port, switches its joints and stages its supports', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  await page.getByRole('navigation', { name: 'Catio sub-assemblies' }).getByRole('link', { name: /^Tunnel pieces/ }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/tunnel$/);
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-variant', 'modular');
  await expect(page.getByRole('button', { name: 'Direct · original design', exact: true })).toHaveCount(0);
  await expect(viewer).toHaveAttribute('data-visible-parts', /levelling-feet/);
  const hardware = page.getByRole('table', { name: 'Hardware parts' });
  // printed feet on the coupling bolts' M8 × 80 by default; the Ganter feet stay selectable
  await expect(hardware.getByRole('link', { name: 'Pressure pad, foot' })).toHaveAttribute('href', '#/models/pressure-pad');
  await expect(hardware.getByRole('link', { name: 'Hexagon head screw M8 × 80' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Feet', exact: true }).selectOption('ganter');
  await expect(hardware.getByRole('link', { name: 'Levelling foot 40 mm, M8 × 80, rubber pad' })).toHaveAttribute('href', '#/parts/levelling-foot/ganter-gn-343-2-40-m8-80-kr');
  await expect(hardware.getByRole('link', { name: 'Pressure pad, foot' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Feet', exact: true }).selectOption('printed');
  // how the tunnel is held on its supports: screws by default, dowels instead, and gravity only on self-standing supports
  await expect(page.getByRole('combobox', { name: 'Held on the supports by' })).toHaveValue('screws');
  await page.getByRole('combobox', { name: 'Held on the supports by' }).selectOption('dowels');
  await expect(hardware.getByRole('link', { name: 'Parallel pin 8 × 40' })).toHaveAttribute('href', '#/parts/pin/iso-2338-8x40');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Held on the supports by' }).selectOption('gravity');
  await expect(page.getByRole('alert')).toContainText('Choose self-standing supports');
  await page.getByRole('combobox', { name: 'Supports stand' }).selectOption('self-standing');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Timber parts' }).getByRole('cell', { name: 'Sole', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Held on the supports by' }).selectOption('strap');
  await expect(hardware.getByRole('cell', { name: 'EPDM tarp strap with S-hooks (custom)' }).first()).toBeVisible();
  await page.getByRole('combobox', { name: 'Held on the supports by' }).selectOption('screws');
  await page.getByRole('combobox', { name: 'Supports stand' }).selectOption('trestle');
  const timber = page.getByRole('table', { name: 'Timber parts' });
  await expect(timber.getByRole('cell', { name: 'Collar floor' }).first()).toBeVisible();
  // the enclosure's door higher up: the tunnel climbs more, steeper
  await page.getByRole('spinbutton', { name: 'Port floor height' }).fill('75');
  await expect(viewer).toHaveAttribute('data-config', /"portHeight":750/);
  await expect(page.getByText(/\+50\.5 cm at 20°/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Turns and bends' }).selectOption('mitred-ends');
  await expect(viewer).toHaveAttribute('data-config', /"angleJoint":"mitred-ends"/);
  await expect(timber.getByRole('cell', { name: 'Collar floor' })).toHaveCount(0);
  await expect(timber.getByText(/mitre face/).first()).toBeVisible();
  // a turn too sharp for a mitre is explained
  await page.getByRole('spinbutton', { name: 'Port out from the wall' }).fill('90');
  await page.getByRole('spinbutton', { name: 'Port along the wall' }).fill('260');
  await page.getByRole('spinbutton', { name: 'Port faces' }).fill('60');
  await expect(page.getByRole('alert')).toContainText('mitred ends go to 90°');
  await page.getByRole('button', { name: 'Reset to the recommended defaults' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const presets = page.getByRole('group', { name: 'Presets' });
  await expect(presets.getByRole('button', { name: 'Recommended' })).toHaveAttribute('aria-pressed', 'true');
  await presets.getByRole('button', { name: 'Straight' }).click();
  await expect(presets.getByRole('button', { name: 'Straight' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('level', { exact: true })).toBeVisible();
  // level with the window port: no height of its own to set
  await expect(page.getByRole('combobox', { name: 'Port floor', exact: true })).toHaveValue('window');
  await expect(page.getByRole('spinbutton', { name: 'Port floor height' })).toHaveCount(0);
  await expect(page.getByText('Window port floor · above the grass')).toBeVisible();
  await expect(page.locator('.catio-dimensions .subassembly-source').first()).toHaveText('Set on the window insert page: Held in the recess by, Spreader feet, Pad height, Foot diameter');
  await expect(timber.getByRole('cell', { name: 'Collar floor' })).toHaveCount(0);
  await presets.getByRole('button', { name: '90° turn right' }).click();
  await expect(viewer).toHaveAttribute('data-config', /"portFacing":90/);
  await expect(page.getByText('90° right', { exact: true })).toBeVisible();
  await presets.getByRole('button', { name: 'Rising' }).click();
  await expect(viewer).toHaveAttribute('data-config', /"portHeight":900/);
  await page.getByRole('spinbutton', { name: 'Port floor height' }).fill('85');
  await expect(presets.getByRole('button', { name: 'Rising' })).toHaveAttribute('aria-pressed', 'false');
  await presets.getByRole('button', { name: 'Recommended' }).click();
  await page.getByRole('button', { name: 'Top · the turns', exact: true }).click();
  await page.getByRole('button', { name: 'Support detail', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Tunnel assembly' });
  await slider.press('Home');
  await expect(viewer).toHaveAttribute('data-step', '0');
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /flanges/);
  await slider.fill('0.5');
  await expect(page.getByTestId('assembly-action')).toContainText('Printed foot on an ISO 4017 M8 × 80: screwed up into the insert nut by turning the foot');
  await slider.fill('1.5');
  await expect(page.getByTestId('assembly-action')).toContainText('Each foot is turned on its stud');
  await slider.press('Home');
  for (let stage = 1; stage <= 6; stage++) {
    await page.getByRole('button', { name: 'Next assembly stage' }).click();
    await expect(viewer).toHaveAttribute('data-step', String(stage));
  }
  await expect(viewer).toHaveAttribute('data-visible-parts', /port-bolts/);
  await page.getByRole('checkbox', { name: 'Exploded view' }).check();
  await expect(viewer).toHaveAttribute('data-exploded', 'true');
  await page.getByRole('button', { name: 'Exterior', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('tunnel.png'), fullPage: true });
  await page.reload();
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-exploded', 'true');
  expect(errors).toEqual([]);
});

test('opens the insert–tunnel coupling, switches its latches, stages the docking and releases it', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  await page.getByRole('navigation', { name: 'Catio sub-assemblies' }).getByRole('link', { name: /Insert–tunnel coupling/ }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/insert-tunnel-coupling$/);
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-variant', 'modular');
  await expect(viewer).toHaveAttribute('data-window', 'closed');
  await expect(viewer).toHaveAttribute('data-visible-parts', /docking-frame/);
  const hardware = page.getByRole('table', { name: 'Hardware parts' });
  // the printed toggle latch by default: linked to its model, the frame close to the flange with a thin seal
  await expect(hardware.getByRole('link', { name: 'Toggle latch, printed' })).toHaveAttribute('href', '#/models/toggle-latch');
  await expect(hardware.getByRole('cell', { name: 'EPDM E-profile seal, self-adhesive (custom)' })).toBeVisible();
  await expect(hardware.getByRole('link', { name: /GN 831/ })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Latch', exact: true })).toHaveCount(0);
  // the insert hangs on the window frame by default, so its port frame lies deeper and the docking frame takes 6 × 90 screws
  await expect(hardware.getByRole('link', { name: 'Countersunk wood screw 6 × 90' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Timber parts' }).getByRole('cell', { name: 'Docking frame stile' })).toBeVisible();
  // the window insert's setting behind the frame's fit, linked to where it is changed
  const battens = page.locator('.catio-dimensions > div', { hasText: 'Cover battens at the port' });
  await expect(battens.locator('dd')).toHaveText('Yes · frame rebated 15 mm over them');
  await expect(battens.locator('.subassembly-source')).toHaveText('Set on the window insert page: Mesh to timber');
  await expect(battens.getByRole('link', { name: 'window insert' })).toHaveAttribute('href', '#/concepts/catio/window-insert');
  // the joint lies in the recess: looking from above or the side cuts the wall away
  for (const view of ['Top', 'Side · the joint']) {
    await page.getByRole('button', { name: view, exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Wall cutaway' })).toBeChecked();
  }
  await page.getByRole('button', { name: 'Exterior', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Wall cutaway' })).not.toBeChecked();
  // the Ganter GN 831 instead, with its own settings
  await page.getByRole('combobox', { name: 'Latches', exact: true }).selectOption('gn-831');
  await expect(hardware.getByRole('link', { name: 'Toggle latch GN 831, short, with safety catch, stainless' })).toHaveAttribute('href', '#/parts/toggle-latch/ganter-gn-831-100-s-ni-2');
  await expect(hardware.getByRole('link', { name: 'Toggle latch, printed' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Latch', exact: true }).selectOption('SV');
  await page.getByRole('combobox', { name: 'Latches per side' }).selectOption('2');
  await expect(viewer).toHaveAttribute('data-config', /"latchType":"SV","latchMaterial":"NI","latchesPerSide":2/);
  await expect(hardware.getByRole('row', { name: /Toggle latch GN 831, short, with padlock eye, stainless/ }).getByRole('cell').first()).toHaveText('4');
  await page.getByRole('combobox', { name: 'Floor gap' }).selectOption('none');
  await expect(hardware.getByRole('cell', { name: 'EPDM sheet floor lip (custom)' })).toHaveCount(0);
  // back to the printed toggle latch: the GN 831's own settings gone, the frame closer with a thinner seal
  await page.getByRole('combobox', { name: 'Latches', exact: true }).selectOption('printed');
  await expect(viewer).toHaveAttribute('data-config', /"latch":"printed"/);
  await expect(page.getByRole('combobox', { name: 'Latch', exact: true })).toHaveCount(0);
  await expect(hardware.getByRole('link', { name: 'Toggle latch, printed' })).toHaveAttribute('href', '#/models/toggle-latch');
  await expect(hardware.getByRole('row', { name: /Toggle latch, printed/ }).getByRole('cell').first()).toHaveText('4');
  await expect(hardware.getByRole('cell', { name: 'EPDM E-profile seal, self-adhesive (custom)' })).toBeVisible();
  await expect(hardware.getByRole('link', { name: /GN 831/ })).toHaveCount(0);
  await expect(page.locator('.catio-dimensions > div', { hasText: 'Gap · seal' }).locator('dd')).toHaveText('3 mm · squashed from 4 mm');
  await page.getByRole('slider', { name: 'Insert–tunnel coupling assembly' }).fill('2.2');
  await expect(page.getByTestId('assembly-action')).toContainText('Printed toggle latch');
  await page.getByRole('button', { name: 'Reset to the recommended defaults' }).click();
  const slider = page.getByRole('slider', { name: 'Insert–tunnel coupling assembly' });
  await slider.press('Home');
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /docking-frame/);
  await slider.fill('2.2');
  await expect(page.getByTestId('assembly-action')).toContainText('Printed toggle latch');
  await slider.fill('3.5');
  await expect(page.getByTestId('assembly-action')).toContainText('Lowering the first section');
  await slider.press('End');
  await expect(viewer).toHaveAttribute('data-step', '5');
  await page.getByRole('button', { name: 'Latch detail', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Released · latches open' }).check();
  await expect(viewer).toHaveAttribute('data-window', 'open');
  await page.screenshot({ path: testInfo.outputPath('coupling.png'), fullPage: true });
  await page.reload();
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-window', 'open');
  expect(errors).toEqual([]);
});

test('opens the tunnel–tunnel coupling, brings the second section in, switches to bolts and releases the latches', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  await page.getByRole('navigation', { name: 'Catio sub-assemblies' }).getByRole('link', { name: /Tunnel–tunnel coupling/ }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/tunnel-tunnel-coupling$/);
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-variant', 'modular');
  await expect(viewer).toHaveAttribute('data-window', 'closed');
  const hardware = page.getByRole('table', { name: 'Hardware parts' });
  // the printed toggle latch by default, linked to its model, with its library screws and the seal
  await expect(hardware.getByRole('link', { name: 'Toggle latch, printed' })).toHaveAttribute('href', '#/models/toggle-latch');
  await expect(hardware.getByRole('row', { name: /Toggle latch, printed/ }).getByRole('cell').first()).toHaveText('4');
  await expect(hardware.getByRole('link', { name: 'Countersunk wood screw 4 × 25' })).toBeVisible();
  await expect(hardware.getByRole('cell', { name: 'EPDM E-profile seal, self-adhesive (custom)' })).toBeVisible();
  await expect(hardware.getByRole('link', { name: 'Hexagon head screw M8 × 80' })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Timber parts' }).getByRole('cell', { name: 'Floor board' })).toBeVisible();
  await expect(page.locator('.catio-dimensions > div', { hasText: 'Gap · seal' }).locator('dd')).toHaveText('3 mm · squashed from 4 mm');
  // the section length comes from the tunnel page, which follows this page's coupling
  const length = page.locator('.catio-dimensions > div', { hasText: 'Section length' });
  await expect(length.locator('.subassembly-source')).toHaveText('Set on the tunnel page: Longest section');
  const brief = page.getByRole('complementary', { name: 'Tunnel–tunnel coupling parameters' });
  await expect(brief.locator('label', { has: page.getByRole('combobox', { name: 'Coupling', exact: true }) }).locator('.subassembly-affects')).toHaveText('Also changes the tunnel.');
  // the staged assembly: the site, one section, its joint readied, the second section coming in, coupled, fixed down
  const slider = page.getByRole('slider', { name: 'Tunnel–tunnel coupling assembly' });
  await slider.press('Home');
  await expect(viewer).toHaveAttribute('data-step', '0');
  await expect(viewer).toHaveAttribute('data-visible-parts', /\bsupport\b/);
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /first-section/);
  await slider.fill('0.9');
  await expect(page.getByTestId('assembly-action')).toContainText('Laying the first section on the support');
  await slider.fill('1.5');
  await expect(page.getByTestId('assembly-action')).toContainText('Printed toggle latch: base plate, lever and link on it');
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /second-section/);
  await slider.fill('2.4');
  await expect(viewer).toHaveAttribute('data-visible-parts', /second-section/);
  await expect(page.getByTestId('assembly-action')).toContainText('The second section, identical');
  await slider.fill('3.15');
  await expect(page.getByTestId('assembly-action')).toContainText('hook the link over the catch');
  await slider.press('Home');
  for (let stage = 1; stage <= 5; stage++) {
    await page.getByRole('button', { name: 'Next assembly stage' }).click();
    await expect(viewer).toHaveAttribute('data-step', String(stage));
  }
  await expect(viewer).toHaveAttribute('data-visible-parts', /\bfixings\b/);
  await page.getByRole('button', { name: 'Latch detail', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Released · latches open' }).check();
  await expect(viewer).toHaveAttribute('data-window', 'open');
  await page.getByRole('checkbox', { name: 'Released · latches open' }).uncheck();
  // bolts instead: the latches' own settings gone, the bolt pattern, its parts and steps
  await page.getByRole('combobox', { name: 'Coupling', exact: true }).selectOption('bolts');
  await expect(viewer).toHaveAttribute('data-config', /"mechanism":"bolts"/);
  await expect(page.getByRole('combobox', { name: 'Latches per side' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Seal' })).toHaveCount(0);
  await expect(hardware.getByRole('link', { name: 'Toggle latch, printed' })).toHaveCount(0);
  await expect(hardware.getByRole('row', { name: /Hexagon head screw M8 × 80/ }).getByRole('cell').first()).toHaveText('6');
  await expect(hardware.getByRole('row', { name: /Large washer/ }).getByRole('cell').first()).toHaveText('12');
  await page.getByRole('combobox', { name: 'Bolts per coupling' }).selectOption('8');
  await expect(hardware.getByRole('row', { name: /Hexagon head screw M8 × 80/ }).getByRole('cell').first()).toHaveText('8');
  await expect(viewer).toHaveAttribute('data-visible-parts', /\bbolts\b/);
  await expect(page.getByText('Push 8 M8 × 80 bolts through both flanges')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Exploded view' }).check();
  await expect(viewer).toHaveAttribute('data-exploded', 'true');
  await page.screenshot({ path: testInfo.outputPath('tunnel-tunnel-coupling.png'), fullPage: true });
  // the tunnel page follows: bolted at every coupling now
  await page.goto('/#/concepts/catio/tunnel');
  await expect(page.getByTestId('subassembly-viewer')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('table', { name: 'Hardware parts' }).getByRole('link', { name: 'Toggle latch, printed' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Bolts per coupling' })).toHaveCount(0);
  // how the tunnel is held on its supports is shared with the tunnel page: set it there, it shows here, and the other way round
  await page.getByRole('combobox', { name: 'Held on the supports by' }).selectOption('strap');
  await page.goBack();
  await expect(page).toHaveURL(/#\/concepts\/catio\/tunnel-tunnel-coupling$/);
  const holding = page.getByRole('combobox', { name: 'Held on the supports by' });
  await expect(holding).toHaveValue('strap');
  await expect(page.locator('label', { has: holding }).locator('.subassembly-affects')).toHaveText('Shared with the tunnel page: set it here or there.');
  await expect(viewer).toHaveAttribute('data-visible-parts', /support-fittings/);
  await holding.selectOption('dowels');
  await page.getByRole('combobox', { name: 'Supports stand' }).selectOption('self-standing');
  await expect(page.getByText(/Over dowels|over its dowels|lifted over the dowels/).first()).toBeVisible();
  await page.goto('/#/concepts/catio/tunnel');
  await expect(page.getByTestId('subassembly-viewer')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('combobox', { name: 'Held on the supports by' })).toHaveValue('dowels');
  await expect(page.getByRole('combobox', { name: 'Supports stand' })).toHaveValue('self-standing');
  await expect(page.locator('label', { has: page.getByRole('combobox', { name: 'Held on the supports by' }) }).locator('.subassembly-affects')).toHaveText('Also changes the tunnel–tunnel coupling.');
  await page.getByRole('button', { name: 'Reset to the recommended defaults' }).click();
  await page.goto('/#/concepts/catio/tunnel-tunnel-coupling');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(holding).toHaveValue('screws');
  await page.getByRole('button', { name: 'Reset to the recommended defaults' }).click();
  await expect(viewer).toHaveAttribute('data-config', /"mechanism":"printed-latch"/);
  expect(errors).toEqual([]);
});
