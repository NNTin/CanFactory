import { test, expect, type Page } from '@playwright/test';

test('opens the catio concept’s overview: the planner and every sub-assembly linked, without a catalogue or render service, on a phone too', async ({ page }, testInfo) => {
  const errors: string[] = []; const jobs: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/renders') && request.method() === 'POST') jobs.push(request.url()); });
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/models');
  await page.getByRole('button', { name: /Window catio/ }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio$/);
  await expect(page.getByRole('heading', { name: 'A little closer to the grass.' })).toBeVisible();
  const links = page.getByRole('navigation', { name: 'Catio planner and sub-assemblies' }).getByRole('link');
  await expect(links).toHaveText([/Catio planner/, /Window insert/, /Insert–tunnel coupling/, /^Tunnelpieces/, /Tunnel–tunnel coupling/]);
  await expect(links.first()).toHaveAttribute('href', '#/concepts/catio/planner');
  // no second design here: the planner is where the catio is designed
  await expect(page.getByTestId('catio-viewer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Direct|Modular/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('catio-overview.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // the overview renders nothing (the planner asks for the printed latch's render)
  expect(jobs).toEqual([]);
  await links.first().click();
  await expect(page.getByTestId('planner-viewport')).toHaveAttribute('data-ready', 'true');
  await page.goBack(); await expect(page.getByRole('heading', { name: 'A little closer to the grass.' })).toBeVisible();
  expect(errors).toEqual([]);
});
/** The sub-assemblies' views keep nothing of their own: the planner's project is the one source (#117). */
const ownSaves = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('canfactory.catio.') && key !== 'canfactory.catio.planner.v1'));

test('opens the window insert of the project’s window, adjusts its joints and clamps, and stages its assembly with a parts list', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  await page.getByRole('navigation', { name: 'Catio planner and sub-assemblies' }).getByRole('link', { name: /Window insert/ }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/window-insert$/);
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  // the window of the project open in the planner (a new one here), with tunnel: no variants to choose
  await expect(viewer).toHaveAttribute('data-instance', 'window-1');
  await expect(page.getByRole('group', { name: 'Project' })).toContainText('Of the project My catio');
  await expect(page.getByRole('combobox', { name: 'Window', exact: true })).toHaveValue('window-1');
  await expect(page.getByRole('button', { name: /Direct|Modular/ })).toHaveCount(0);
  const hardware = page.getByRole('table', { name: 'Hardware parts' });
  // hung on the window frame by default: printed screen hooks, made for the window, behind the frame's lip, printed feet under the
  // sill rail; Windhager's bought hooks stay selectable
  await expect(viewer).toHaveAttribute('data-visible-parts', /screen-hooks/);
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /spreader-clamps/);
  await expect(page.getByRole('combobox', { name: 'Screen hooks' })).toHaveValue('printed');
  await expect(hardware.getByRole('link', { name: 'Printed screen hook, long (head)' })).toHaveAttribute('href', '#/models/printed-screen-hook');
  await expect(hardware.getByRole('link', { name: 'Printed screen hook, short (sill)' })).toHaveAttribute('href', '#/models/printed-screen-hook');
  await expect(hardware.getByText(/For a 15.5 mm frame lip and a 3.5 mm seal gap/).first()).toBeVisible();
  await expect(page.getByText('Hooks · printed for')).toBeVisible();
  await page.getByRole('combobox', { name: 'Screen hooks' }).selectOption('windhager-03651');
  await expect(hardware.getByRole('link', { name: 'Insect screen hook, short (Windhager 03651, 5b)' })).toHaveAttribute('href', '#/parts/screen-hook/windhager-03651-5b');
  await expect(hardware.getByRole('link', { name: 'Printed screen hook, long (head)' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Screen hooks' }).selectOption('printed');
  await expect(hardware.getByRole('link', { name: 'Pressure pad, foot' })).toBeVisible();
  await expect(hardware.getByRole('link', { name: 'Pressure pad, thrust pad' })).toHaveCount(0);
  // printed flat corner brackets across the collar's butt joints by default, linked to their model; GAH Alberts' bought ones stay
  // selectable from the parts library
  await expect(viewer).toHaveAttribute('data-visible-parts', /corner-brackets/);
  await expect(page.getByRole('combobox', { name: 'Corner bracket' })).toHaveValue('printed');
  await expect(hardware.getByRole('link', { name: 'Printed corner bracket' })).toHaveAttribute('href', '#/models/printed-corner-bracket');
  await page.getByRole('combobox', { name: 'Corner bracket' }).selectOption('gah-alberts-stuhlwinkel-100x100x19');
  await expect(hardware.getByRole('link', { name: 'Flat corner bracket 100 × 100 × 19' })).toHaveAttribute('href', '#/parts/corner-bracket/gah-alberts-stuhlwinkel-100x100x19');
  await expect(hardware.getByRole('link', { name: 'Printed corner bracket' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Corner bracket' }).selectOption('gah-alberts-stuhlwinkel-150x150x25');
  await expect(page.getByText(/would lie over the screen hooks/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Corner bracket' }).selectOption('printed');
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
  await page.getByRole('combobox', { name: 'Spreader feet' }).selectOption('ganter');
  await expect(hardware.getByRole('link', { name: 'Levelling foot 32 mm, M8 × 63, rubber pad' })).toHaveAttribute('href', '#/parts/levelling-foot/ganter-gn-343-2-32-m8-63-kr');
  await expect(hardware.getByRole('link', { name: 'Pressure pad, thrust pad' })).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Pad height' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Collar corners' }).selectOption('butt-screwed');
  await expect(viewer).toHaveAttribute('data-config', /"cornerJoint":"butt-screwed"/);
  await expect(hardware.getByRole('link', { name: 'Countersunk wood screw 5 × 70' })).toBeVisible();
  // hung on the window frame like an insect screen: printed hooks behind the frame's lip, the feet only under the sill rail
  await page.getByRole('combobox', { name: 'Held in the recess by' }).selectOption('frame-hooks');
  await expect(viewer).toHaveAttribute('data-visible-parts', /screen-hooks/);
  await expect(page.getByRole('combobox', { name: 'Overlap on the frame' })).toBeVisible();
  await expect(page.getByText('Hooks · printed for')).toBeVisible();
  // a seal gap too narrow for the printed barb: the view says to choose the bought hooks, whose strip takes it
  await page.getByRole('spinbutton', { name: 'Seal gap' }).fill('2.5');
  await expect(page.getByText(/too narrow for the printed hooks’ 2 mm barb/).first()).toBeVisible();
  await page.getByRole('combobox', { name: 'Screen hooks' }).selectOption('windhager-03651');
  await expect(page.getByText('Hooks · bent at')).toBeVisible();
  await expect(hardware.getByRole('link', { name: 'Insect screen hook, long (Windhager 03651, 5a)' })).toBeVisible();
  await expect(page.getByText(/too narrow for the printed hooks/)).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Seal gap' }).fill('1');
  await expect(page.getByText(/too narrow for the hooks’ 0.8 mm strip/).first()).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Seal gap' }).fill('3.5');
  await page.getByRole('combobox', { name: 'Screen hooks' }).selectOption('printed');
  await page.getByRole('combobox', { name: 'Held in the recess by' }).selectOption('folding-wedges');
  await expect(viewer).toHaveAttribute('data-visible-parts', /folding-wedges/);
  await expect(page.getByRole('combobox', { name: 'Foot diameter' })).toBeVisible();
  // the mesh is the whole catio's, the tunnels' too
  const brief = page.getByRole('complementary', { name: 'Window insert parameters' });
  await expect(brief.locator('label', { has: page.getByRole('combobox', { name: 'Mesh', exact: true }) }).locator('.subassembly-affects')).toHaveText('The whole catio’s: the window insert and every tunnel.');
  await expect(brief.locator('label', { has: page.getByRole('combobox', { name: 'Clamps per side' }) }).locator('.subassembly-affects')).toHaveCount(0);
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
  const last = Number(await slider.getAttribute('max'));
  for (let stage = 1; stage <= last; stage++) {
    await page.getByRole('button', { name: 'Next assembly stage' }).click();
    await expect(viewer).toHaveAttribute('data-step', String(stage));
  }
  // the cat port is shut by a removable panel (the project's default for every cat port), named in the brief and the parts list
  await expect(viewer).toHaveAttribute('data-visible-parts', /port-panel port-panel-hardware/);
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /gate/);
  await expect(brief).toContainText('Removable panel with turn buttons');
  await expect(brief).toContainText('Set in the catio planner: Cat-port closure');
  await expect(page.getByRole('table', { name: 'Hardware parts' })).toContainText('Door turn button, printed (custom)');
  await expect(page.getByRole('table', { name: 'Timber parts' })).toContainText('Door stop, side');
  await expect(page.getByRole('region', { name: 'Assembly instructions' })).toContainText('Panel and check');
  // shut and retained until it is opened: the buttons turn clear, the panel comes out
  await expect(viewer).toHaveAttribute('data-door', 'closed');
  await page.getByRole('checkbox', { name: 'Cat port open' }).check();
  await expect(viewer).toHaveAttribute('data-door', 'open');
  await expect(viewer).toHaveAttribute('data-door-travel', '1');
  await page.screenshot({ path: testInfo.outputPath('window-insert-panel-removed.png'), fullPage: true });
  // an unfinished assembly keeps it shut; the last stage seats the panel and turns the buttons over it
  await slider.fill(String(last - 0.5));
  await expect(page.getByRole('checkbox', { name: 'Cat port open' })).toBeDisabled();
  await expect(viewer).toHaveAttribute('data-door', 'closed');
  await expect(page.getByTestId('assembly-action')).toContainText('3 × Door turn button: screwed onto the port frame’s room face on its washer');
  await slider.fill(String(last - 0.05));
  await expect(page.getByTestId('assembly-action')).toContainText('turned a quarter turn over the panel');
  await slider.press('End');
  await expect(page.getByRole('combobox', { name: 'Port transom & jambs' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Mesh parts' }).getByRole('row')).toHaveCount(5);
  await expect(brief.getByText('Cat port floor · above the grass')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Exploded view' }).check();
  await expect(viewer).toHaveAttribute('data-exploded', 'true');
  await page.screenshot({ path: testInfo.outputPath('window-insert-modular.png'), fullPage: true });
  // the design is the project's, saved with it; how the view was looked at is not
  await page.reload();
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-config', /"attachment":"folding-wedges"/);
  await expect(viewer).toHaveAttribute('data-exploded', 'false');
  expect(await ownSaves(page)).toEqual([]);
  await page.getByRole('button', { name: 'Catio concept', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/concepts\/catio$/);
  expect(errors).toEqual([]);
});

test('edits the project from a sub-assembly’s view: the planner shows it, and one undo takes it back, either side', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio/window-insert');
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  const history = page.getByRole('group', { name: 'Undo and redo' });
  await expect(history.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Collar corners' }).selectOption('half-lap');
  await expect(viewer).toHaveAttribute('data-config', /"cornerJoint":"half-lap"/);
  // in the planner: the window selected, its insert's corners as set on the view
  await page.getByRole('link', { name: 'Show in the planner' }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/planner$/);
  await expect(page.getByTestId('planner-viewport')).toHaveAttribute('data-selection', '["window-1"]');
  const inspector = page.getByRole('region', { name: 'Inspector' });
  const insert = inspector.locator('details[data-subassembly="window-insert"]');
  await insert.locator('summary').click();
  await expect(insert.getByRole('combobox', { name: 'Collar corners' })).toHaveValue('half-lap');
  await page.screenshot({ path: testInfo.outputPath('planner-window-insert-settings.png') });
  // the planner's undo takes the view's edit back, and redoes it
  await page.getByRole('group', { name: 'Undo and redo' }).getByRole('button', { name: 'Undo' }).click();
  await expect(insert.getByRole('combobox', { name: 'Collar corners' })).toHaveValue('corner-bracket');
  await page.getByRole('group', { name: 'Undo and redo' }).getByRole('button', { name: 'Redo' }).click();
  await expect(insert.getByRole('combobox', { name: 'Collar corners' })).toHaveValue('half-lap');
  // edited in the inspector: the coupling's view shows it, and its own undo takes it back
  const coupling = inspector.locator('details[data-subassembly="insert-tunnel-coupling"]');
  await coupling.locator('summary').click();
  await coupling.getByRole('combobox', { name: 'Latches', exact: true }).selectOption('gn-831');
  await expect(page.getByTestId('planner-saved')).toHaveAttribute('data-state', 'saved');
  await coupling.getByRole('link', { name: 'Its pieces, steps and parts list' }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/insert-tunnel-coupling\/window-1$/);
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-config', /"latch":"gn-831"/);
  await history.getByRole('button', { name: 'Undo' }).click();
  await expect(viewer).toHaveAttribute('data-config', /"latch":"printed"/);
  // the tunnel and its couplings hold it on its supports alike: one setting of the project
  await page.goto('/#/concepts/catio/planner');
  await page.getByRole('navigation', { name: 'Object tree' }).getByRole('button', { name: /^Tunnel/ }).click();
  const tunnel = inspector.locator('details[data-subassembly="tunnel"]');
  await tunnel.locator('summary').click();
  await tunnel.getByRole('combobox', { name: 'Held on the supports by' }).selectOption('strap');
  await page.goto('/#/concepts/catio/tunnel-tunnel-coupling/tunnel-1');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('combobox', { name: 'Held on the supports by' })).toHaveValue('strap');
  // saved with the project, read back after a reload; nothing saved by the views themselves
  await page.reload();
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('combobox', { name: 'Held on the supports by' })).toHaveValue('strap');
  await page.goto('/#/concepts/catio/window-insert');
  await expect(viewer).toHaveAttribute('data-config', /"cornerJoint":"half-lap"/);
  expect(await ownSaves(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('opens the project’s tunnel, laid out on its route, switches its feet and supports and stages them', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  await page.getByRole('navigation', { name: 'Catio planner and sub-assemblies' }).getByRole('link', { name: /^Tunnel pieces/ }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/tunnel$/);
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-instance', 'tunnel-1');
  await expect(viewer).toHaveAttribute('data-visible-parts', /levelling-feet/);
  // its route is the planner's: no ports, turns or presets to set here
  await expect(page.getByRole('spinbutton', { name: 'Port floor height' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Turns and bends' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Presets' })).toHaveCount(0);
  const hardware = page.getByRole('table', { name: 'Hardware parts' });
  // printed feet on the coupling bolts' M8 × 80 by default; the Ganter feet stay selectable
  await expect(hardware.getByRole('link', { name: 'Pressure pad, foot' })).toHaveAttribute('href', '#/models/pressure-pad');
  await expect(hardware.getByRole('link', { name: 'Hexagon head screw M8 × 80' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Feet', exact: true }).selectOption('ganter');
  await expect(hardware.getByRole('link', { name: 'Levelling foot 40 mm, M8 × 80, rubber pad' })).toHaveAttribute('href', '#/parts/levelling-foot/ganter-gn-343-2-40-m8-80-kr');
  await expect(hardware.getByRole('link', { name: 'Pressure pad, foot' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Feet', exact: true }).selectOption('printed');
  // how the tunnel is held on its supports: screws by default, dowels instead, and gravity only on self-standing supports
  const holding = page.getByRole('combobox', { name: 'Held on the supports by' });
  await expect(holding).toHaveValue('screws');
  await expect(page.locator('label', { has: holding }).locator('.subassembly-affects')).toHaveText('Every tunnel’s supports: the tunnel and its couplings show the same.');
  await holding.selectOption('dowels');
  await expect(hardware.getByRole('link', { name: 'Parallel pin 8 × 40' })).toHaveAttribute('href', '#/parts/pin/iso-2338-8x40');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await holding.selectOption('gravity');
  await expect(page.getByRole('alert')).toContainText('Choose self-standing supports');
  await page.getByRole('combobox', { name: 'Supports stand' }).selectOption('self-standing');
  await expect(page.getByRole('alert')).toHaveCount(0);
  // the project's tunnel is low by the wall: its supports are wide low bearers, each on its own feet
  await expect(page.getByRole('table', { name: 'Timber parts' }).getByRole('cell', { name: 'Low bearer, wide', exact: true }).first()).toBeVisible();
  await holding.selectOption('strap');
  await expect(hardware.getByRole('cell', { name: 'EPDM tarp strap with S-hooks (custom)' }).first()).toBeVisible();
  await holding.selectOption('screws');
  await page.getByRole('combobox', { name: 'Supports stand' }).selectOption('trestle');
  // the window port's floor, where it starts, is the window insert's
  await expect(page.getByText('Window port floor · above the grass')).toBeVisible();
  await expect(page.locator('.catio-dimensions .subassembly-source').first()).toHaveText('Set on the window insert: Held in the recess by, Spreader feet, Pad height, Foot diameter');
  await expect(page.locator('.catio-dimensions .subassembly-source').first().getByRole('link')).toHaveAttribute('href', '#/concepts/catio/window-insert');
  await expect(page.getByRole('table', { name: 'Timber parts' }).getByRole('cell', { name: 'Collar floor' })).toHaveCount(0);
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
  const last = Number(await slider.getAttribute('max'));
  for (let stage = 1; stage <= last; stage++) {
    await page.getByRole('button', { name: 'Next assembly stage' }).click();
    await expect(viewer).toHaveAttribute('data-step', String(stage));
  }
  // every coupling latched by default, the enclosure's port too: a standard port; the end bays' doors set in
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /port-bolts/);
  await expect(viewer).toHaveAttribute('data-visible-parts', /doors door-mesh door-hardware.*section-latches/);
  await page.getByRole('checkbox', { name: 'Exploded view' }).check();
  await expect(viewer).toHaveAttribute('data-exploded', 'true');
  await page.getByRole('button', { name: 'Exterior', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('tunnel.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('opens the insert–tunnel coupling of the project’s window, switches its latches, stages the docking and releases it', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  await page.getByRole('navigation', { name: 'Catio planner and sub-assemblies' }).getByRole('link', { name: /Insert–tunnel coupling/ }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/insert-tunnel-coupling$/);
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-instance', 'window-1');
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
  await expect(battens.locator('.subassembly-source')).toHaveText('Set on the window insert: Mesh to timber');
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
  const slider = page.getByRole('slider', { name: 'Insert–tunnel coupling assembly' });
  await slider.fill('2.2');
  await expect(page.getByTestId('assembly-action')).toContainText('Printed toggle latch');
  await slider.press('Home');
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /docking-frame/);
  await slider.fill('3.5');
  await expect(page.getByTestId('assembly-action')).toContainText('Lowering the first section');
  await slider.press('End');
  await expect(viewer).toHaveAttribute('data-step', '5');
  await page.getByRole('button', { name: 'Latch detail', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Released · latches open' }).check();
  await expect(viewer).toHaveAttribute('data-window', 'open');
  await page.screenshot({ path: testInfo.outputPath('coupling.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('draws the printed latch from its render, says when it is missing and tries again', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // the render service is down: the latches are shown without their parts, and the viewer says so
  const down = (route: import('@playwright/test').Route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  await page.route('**/api/**', down);
  await page.goto('/#/concepts/catio/insert-tunnel-coupling');
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-latch-parts', 'missing');
  await expect(viewer.getByRole('status')).toContainText('could not be loaded');
  // back up: the retry renders the toggle latch model and fills the scene, without a reload
  await page.unroute('**/api/**', down);
  await expect(viewer).toHaveAttribute('data-latch-parts', 'loaded', { timeout: 180_000 });
  await expect(viewer.getByRole('status')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('opens the tunnel–tunnel coupling of the project’s tunnel, brings the second section in, switches to bolts and releases the latches', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  await page.getByRole('navigation', { name: 'Catio planner and sub-assemblies' }).getByRole('link', { name: /Tunnel–tunnel coupling/ }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/tunnel-tunnel-coupling$/);
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(viewer).toHaveAttribute('data-instance', 'tunnel-1');
  await expect(viewer).toHaveAttribute('data-window', 'closed');
  const hardware = page.getByRole('table', { name: 'Hardware parts' });
  // the printed toggle latch by default, linked to its model, with its library screws and the seal
  await expect(hardware.getByRole('link', { name: 'Toggle latch, printed' })).toHaveAttribute('href', '#/models/toggle-latch');
  await expect(hardware.getByRole('row', { name: /Toggle latch, printed/ }).getByRole('cell').first()).toHaveText('4');
  await expect(hardware.getByRole('link', { name: 'Countersunk wood screw 4 × 25' })).toBeVisible();
  await expect(hardware.getByRole('cell', { name: 'EPDM E-profile seal, self-adhesive (custom)' })).toBeVisible();
  await expect(hardware.getByRole('link', { name: 'Hexagon head screw M8 × 80' })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Timber parts' }).getByRole('cell', { name: 'Floor board', exact: true })).toBeVisible();
  await expect(page.locator('.catio-dimensions > div', { hasText: 'Gap · seal' }).locator('dd')).toHaveText('3 mm · squashed from 4 mm');
  // the section length is the tunnel's
  const length = page.locator('.catio-dimensions > div', { hasText: 'Section length' });
  await expect(length.locator('.subassembly-source')).toHaveText('Set on the tunnel: Longest section');
  const brief = page.getByRole('complementary', { name: 'Tunnel–tunnel coupling parameters' });
  await expect(brief.locator('label', { has: page.getByRole('combobox', { name: 'Coupling', exact: true }) }).locator('.subassembly-affects')).toHaveText('Every coupling of the project’s tunnels: the tunnel follows.');
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
  // two on each side of the standard port by default, the same on all four sides
  await expect(hardware.getByRole('row', { name: /Hexagon head screw M8 × 80/ }).getByRole('cell').first()).toHaveText('8');
  await expect(hardware.getByRole('row', { name: /Large washer/ }).getByRole('cell').first()).toHaveText('16');
  await page.getByRole('combobox', { name: 'Bolts per coupling' }).selectOption('12');
  await expect(hardware.getByRole('row', { name: /Hexagon head screw M8 × 80/ }).getByRole('cell').first()).toHaveText('12');
  await expect(viewer).toHaveAttribute('data-visible-parts', /\bbolts\b/);
  await expect(page.getByText('Push 12 M8 × 80 bolts through both flanges')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Exploded view' }).check();
  await expect(viewer).toHaveAttribute('data-exploded', 'true');
  await page.screenshot({ path: testInfo.outputPath('tunnel-tunnel-coupling.png'), fullPage: true });
  // bolted face to face, the module pitch loses the latches' gap: the project says the enclosure is now off its whole modules
  await expect(page.getByRole('status', { name: 'Problems in the project' })).toContainText("cannot reach Enclosure's rear port in whole standard modules");
  // the tunnel's view follows: bolted at every coupling now, and its doors set in on turn buttons: no latch left
  await page.goto('/#/concepts/catio/tunnel');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('table', { name: 'Hardware parts' })).toContainText('Door turn button, printed (custom)');
  await expect(page.getByRole('table', { name: 'Hardware parts' }).getByRole('row', { name: /Toggle latch, printed/ })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Bolts per coupling' })).toHaveCount(0);
  // how the tunnel is held on its supports is one setting: set on the tunnel, it shows here, and the other way round
  await page.getByRole('combobox', { name: 'Held on the supports by' }).selectOption('strap');
  await page.goBack();
  await expect(page).toHaveURL(/#\/concepts\/catio\/tunnel-tunnel-coupling$/);
  const holding = page.getByRole('combobox', { name: 'Held on the supports by' });
  await expect(holding).toHaveValue('strap');
  await expect(viewer).toHaveAttribute('data-visible-parts', /support-fittings/);
  await holding.selectOption('dowels');
  await page.getByRole('combobox', { name: 'Supports stand' }).selectOption('self-standing');
  await expect(page.getByText(/Over dowels|over its dowels|lifted over the dowels/).first()).toBeVisible();
  await page.goto('/#/concepts/catio/tunnel');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('combobox', { name: 'Held on the supports by' })).toHaveValue('dowels');
  await expect(page.getByRole('combobox', { name: 'Supports stand' })).toHaveValue('self-standing');
  // back to the latches by undoing the edits, on either view
  const undo = page.getByRole('group', { name: 'Undo and redo' }).getByRole('button', { name: 'Undo' });
  for (let n = 0; n < 5; n++) await undo.click();
  await expect(page.getByRole('combobox', { name: 'Held on the supports by' })).toHaveValue('screws');
  await expect(page.getByRole('table', { name: 'Hardware parts' }).getByRole('row', { name: /Toggle latch, printed/ })).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test('builds the tunnel of flush standard elements: turning into side openings, every opening not coupled shut by a door', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  // in the planner: the tunnel's far end detached, then a side-port turn and a module more, in sections of two pitches
  await page.goto('/#/concepts/catio/planner');
  await expect(page.getByTestId('planner-viewport')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('navigation', { name: 'Object tree' }).getByRole('button', { name: /^Tunnel/ }).click();
  const inspector = page.getByRole('region', { name: 'Inspector' });
  await inspector.locator('[data-tunnel-end="tunnel-1-end"]').getByRole('button', { name: 'Detach' }).click();
  await inspector.getByRole('button', { name: 'Turn right' }).click();
  await inspector.getByRole('button', { name: 'Module', exact: true }).first().click();
  await inspector.getByRole('button', { name: 'Module', exact: true }).first().click();
  const tunnel = inspector.locator('details[data-subassembly="tunnel"]');
  await tunnel.locator('summary').click();
  await tunnel.getByRole('combobox', { name: 'Longest section' }).selectOption('2');
  await tunnel.getByRole('link', { name: 'Its pieces, steps and parts list' }).click();
  await expect(page).toHaveURL(/#\/concepts\/catio\/tunnel\/tunnel-1$/);
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  const facts = page.locator('.catio-dimensions');
  await expect(facts).toContainText(/at the turns/);
  await expect(facts).toContainText(/Doors · held by\s*\d+ \(\d+ in the end bays’ sides\) · set in, turn buttons on the port’s ring/);
  // the side doors' frames on the cut list, no pocket post or side ring; every frame is marked from one template
  await expect(page.getByRole('table', { name: 'Timber parts' }).getByRole('cell', { name: 'Door frame, upright', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Timber parts' }).getByRole('cell', { name: /Pocket post|Side ring/ })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Drawings' }).getByRole('link', { name: /Download port-template-300\.svg/ })).toHaveAttribute('download', 'port-template-300.svg');
  // its free end is an unfinished opening, which the project reports
  await expect(page.getByRole('status', { name: 'Problems in the project' })).toContainText('far end is free');
  // the doors open together: the end bays' sides, and the sections' starts at the turns
  await page.getByRole('checkbox', { name: 'Doors open' }).check();
  await expect(viewer).toHaveAttribute('data-door-travel', '1');
  await page.screenshot({ path: testInfo.outputPath('tunnel-side-ports-doors-open.png'), fullPage: true });
  // the coupling's view shows a section's end meeting a side port (its own choice); held by the ports' latches instead, the tunnel follows
  await page.goto('/#/concepts/catio/tunnel-tunnel-coupling');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('combobox', { name: 'Joint shown' })).toHaveValue('end-end');
  await page.getByRole('combobox', { name: 'Joint shown' }).selectOption('end-side');
  await expect(page.locator('.catio-dimensions')).toContainText('Section end to a side port: the standard port either way');
  await expect(viewer).toHaveAttribute('data-visible-parts', /second-section-doors/);
  await page.getByRole('combobox', { name: 'Door held by' }).selectOption('latches');
  await expect(page.locator('.catio-dimensions')).toContainText('4 on these two sections, every opening not coupled · a blank on the port’s own toggle latches');
  await page.screenshot({ path: testInfo.outputPath('coupling-end-to-side-port.png'), fullPage: true });
  await page.goto('/#/concepts/catio/tunnel');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(facts).toContainText('in the end bays’ sides) · a blank on the port’s own toggle latches');
  await expect(page.getByRole('table', { name: 'Timber parts' }).getByRole('cell', { name: 'Door ring, stile', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
