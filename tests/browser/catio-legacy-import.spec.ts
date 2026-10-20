import { test, expect, type Page } from '@playwright/test';

/**
 * The planner's one-time import of a catio the old concept page saved (#116, FR-08.5): its settings of every version, and the
 * sub-assembly pages' own saves, become a new project; the old saves are left as they were.
 */
const PLANNER = 'canfactory.catio.planner.v1';
const LEGACY = 'canfactory.catio.v1';
const viewing = { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: [], view: 'Exterior', doors: {} };
const config = {
  glassWidth: 800, glassHeight: 800, sashWidth: 1000, sashHeight: 910, enclosure: { width: 1500, depth: 1000, height: 1200 }, second: { width: 1200, depth: 1000, height: 1200 },
  secondEnabled: false, route: 'left', approach: 3, lateral: 2, final: 1, link: 2,
};
/** The old saves of each version: version 1 had no closure and the tunnel's clear width and height; version 3 one square size and the doors' seat. */
const SAVES: Record<'v1' | 'v2' | 'v3', Record<string, unknown>> = {
  v1: { version: 1, mode: 'modular', views: { direct: viewing, modular: { ...viewing, view: 'Top' } }, config: { ...config, tunnelWidth: 350, tunnelHeight: 300 } },
  v2: { version: 2, mode: 'modular', views: { direct: viewing, modular: viewing }, config: { ...config, route: 'right', approach: 2, secondEnabled: true, tunnelWidth: 280, tunnelHeight: 320, portClosure: 'removable-panel' } },
  v3: { version: 3, mode: 'direct', views: { direct: viewing, modular: viewing }, config: { ...config, route: 'straight', approach: 4, tunnelSize: 300, portClosure: 'sliding-gate', doorSeat: 'rebate' } },
};
/** The sub-assembly pages as they were saved before the cat ports' closure could be chosen. */
const PAGES = {
  'canfactory.catio.window-insert.v1': { version: 1, variant: 'modular', config: { attachment: 'frame-hooks', footDiameter: 40 }, views: {} },
  'canfactory.catio.tunnel.v1': { version: 1, variant: 'modular', views: { modular: { progress: 6, view: 'Top', hidden: ['mesh'], exploded: false, windowOpen: true, cutaway: false } }, config: {
    portX: 800, portY: 3000, portFacing: 0, portLevel: 'own', portHeight: 500, approach: 700, final: 700, slopeLeg: 'middle', maxSlope: 15, angleJoint: 'angle-collar', mesh: 'welded', sectionLength: 750,
    footPad: 'ganter', padHeight: 27.5, padSurface: 'grooved', footDiameter: 40, groundFall: 2, groundTolerance: 15, supportFixing: 'dowels', supportBase: 'trestle' } },
};

/** The planner on a browser holding `saves` (and nothing of the planner's), its API calls failing. */
async function open(page: Page, saves: Record<string, unknown>) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio');
  await page.evaluate(entries => { localStorage.clear(); for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, JSON.stringify(value)); }, saves);
  await page.goto('/#/concepts/catio/planner');
  await expect(page.getByTestId('planner-viewport')).toHaveAttribute('data-ready', 'true');
  return errors;
}
const legacyKeys = (page: Page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('canfactory.catio.') && !key.includes('planner')).map(key => [key, localStorage.getItem(key)])));
const inspector = (page: Page) => page.getByRole('region', { name: 'Inspector' });
const field = (page: Page, name: string) => inspector(page).getByRole('textbox', { name, exact: true });
const tree = (page: Page) => page.getByRole('navigation', { name: 'Object tree' });
const importButton = (page: Page) => page.getByRole('button', { name: 'Import my existing catio' });
const stored = async (page: Page) => JSON.parse(await page.evaluate(key => localStorage.getItem(key), PLANNER) ?? '{}') as { id: string; instances: { kind: string; params: Record<string, unknown> }[]; settings: Record<string, unknown> };

test('imports a version 1 catio once into a new project: its sizes, its sliding gates and its pages’ settings, leaving the old saves as they were', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await open(page, { [LEGACY]: SAVES.v1, ...PAGES });
  const before = await legacyKeys(page);
  // the planner opened a new project of its own: nothing is read from the old saves until asked
  await expect(tree(page).getByRole('button')).toHaveText([/Window/, /Tunnel/, /Module 1/, /Module 2/, /Enclosure/]);
  await importButton(page).click();
  const notice = page.getByRole('status', { name: 'Existing catio' });
  await expect(notice).toContainText('Your existing catio is open as a new project. What the old page saved is left as it was.');
  await expect(notice).toContainText('Also imported: the settings saved on the window insert and tunnel pages.');
  // the left offset: three modules out, a turn, two along the wall, a turn back and one into the enclosure's rear port
  await expect(tree(page).getByRole('button')).toHaveText([/Window/, /Tunnel/, /Module 1/, /Module 2/, /Module 3/, /Turn 4/, /Module 5/, /Module 6/, /Turn 7/, /Module 8/, /Enclosure/]);
  await expect(page.getByRole('region', { name: 'Issues' })).not.toContainText(/is not coupled|free end/);
  await tree(page).getByRole('button', { name: /Window/ }).click();
  await expect(field(page, 'Sash width (cm)')).toHaveValue('100');
  // a 35 × 30 cm tunnel saved then is the standard square port: 35 cm both ways
  await expect(field(page, 'Clear size (cm)')).toHaveValue('35');
  await expect(inspector(page).getByRole('combobox', { name: 'Cat-port closure' })).toHaveValue('sliding-gate');
  await expect(inspector(page).getByRole('combobox', { name: 'Door seat' })).toHaveValue('stops');
  await tree(page).getByRole('button', { name: /^Enclosure/ }).click();
  await expect(field(page, 'Width (cm)')).toHaveValue('150');
  await page.screenshot({ path: testInfo.outputPath('catio-legacy-import-v1.png') });
  // saved as the planner's project, and the old saves untouched
  await expect(page.getByTestId('planner-saved')).toHaveAttribute('data-state', 'saved');
  const project = await stored(page);
  expect(project.id).toBe('imported-catio');
  expect(project.settings).toMatchObject({ portClosure: 'sliding-gate', mesh: 'welded', insert: { footDiameter: 40 } });
  expect(project.instances.filter(i => i.kind === 'tunnel').map(i => i.params)).toEqual([expect.objectContaining({ footPad: 'ganter', maxSlope: 15 })]);
  expect(await legacyKeys(page)).toEqual(before);
  await page.reload();
  await expect(tree(page).getByRole('button', { name: /Turn 7/ })).toBeVisible();

  // the sub-assembly pages take the window and the cat ports from the project: the window insert has its gate
  await page.goto('/#/concepts/catio/window-insert');
  const sub = page.getByTestId('subassembly-viewer');
  await expect(sub).toHaveAttribute('data-ready', 'true');
  await expect(sub).toHaveAttribute('data-variant', 'modular');
  await expect(sub).toHaveAttribute('data-visible-parts', /gate-tracks cat-gate gate-latch/);
  await expect(page.getByRole('complementary', { name: 'Window insert parameters' })).toContainText('Set on the catio planner page: Cat-port closure');
  // the tunnel page keeps its own save as it was
  await page.goto('/#/concepts/catio/tunnel');
  await expect(sub).toHaveAttribute('data-ready', 'true');
  await expect(sub).toHaveAttribute('data-config', /"portX":800.*"mesh":"welded".*"supportFixing":"dowels"/);
  await expect(page.getByRole('complementary', { name: 'Tunnel parameters' })).toContainText('Vertical sliding gate');
  // choosing the removable panel in the planner: the pages follow
  await page.goto('/#/concepts/catio/planner');
  await tree(page).getByRole('button', { name: /Window/ }).click();
  await inspector(page).getByRole('combobox', { name: 'Cat-port closure' }).selectOption('removable-panel');
  await expect(page.getByTestId('planner-saved')).toHaveAttribute('data-revision', '1');
  await page.goto('/#/concepts/catio/window-insert');
  await expect(sub).toHaveAttribute('data-ready', 'true');
  await expect(sub).toHaveAttribute('data-visible-parts', /port-panel port-panel-hardware/);
  // (the sub-assembly pages still keep their own saves, #117, and rewrite them when opened; the old catio's stays as it was)
  expect((await legacyKeys(page))[LEGACY]).toBe(before[LEGACY]);
  expect(errors).toEqual([]);
});

test('imports version 2 and 3 catios: the larger tunnel size, a right offset with a second enclosure, a direct design’s sizes and its door seat', async ({ page }) => {
  test.setTimeout(120_000);
  // version 2: a right offset and a second enclosure linked from A's right-hand port; the tunnel 28 × 32 cm, a square 32 cm port
  let errors = await open(page, { [LEGACY]: SAVES.v2 });
  await importButton(page).click();
  await expect(page.getByRole('status', { name: 'Existing catio' })).toContainText('open as a new project');
  await expect(tree(page).getByRole('button', { name: /^Enclosure/ })).toHaveCount(2);
  await expect(tree(page).getByRole('button', { name: /^Tunnel/ })).toHaveCount(2);
  let project = await stored(page);
  expect(project.instances.find(i => i.kind === 'window')?.params).toMatchObject({ sashWidth: 1000, tunnelSize: 320 });
  expect(project.settings).toMatchObject({ portClosure: 'removable-panel', doorSeat: 'stops' });
  expect(project.instances.filter(i => i.kind === 'enclosure').map(i => i.params)).toEqual([config.enclosure, config.second]);
  expect(await legacyKeys(page)).toEqual({ [LEGACY]: JSON.stringify(SAVES.v2) });
  expect(errors).toEqual([]);

  // version 3, saved in Direct mode: the modular design's sizes, its sliding gates and its rebated doors
  errors = await open(page, { [LEGACY]: SAVES.v3 });
  await importButton(page).click();
  await expect(page.getByRole('status', { name: 'Existing catio' })).toContainText('The old page showed the direct design');
  await expect(tree(page).getByRole('button', { name: /Module \d/ })).toHaveCount(4);
  await tree(page).getByRole('button', { name: /Window/ }).click();
  await expect(field(page, 'Clear size (cm)')).toHaveValue('30');
  await expect(inspector(page).getByRole('combobox', { name: 'Door seat' })).toHaveValue('rebate');
  project = await stored(page);
  expect(project.settings).toMatchObject({ portClosure: 'sliding-gate', doorSeat: 'rebate' });
  expect(await legacyKeys(page)).toEqual({ [LEGACY]: JSON.stringify(SAVES.v3) });
  expect(errors).toEqual([]);
});

test('says when there is nothing to import, and asks before replacing an edited project', async ({ page }) => {
  const errors = await open(page, {});
  await importButton(page).click();
  await expect(page.getByRole('status', { name: 'Existing catio' })).toContainText('No catio saved by the old catio concept page was found in this browser.');
  // an edit, then an old save appears: importing asks first, and keeps the edited project when declined
  await page.getByRole('region', { name: 'Inspector' }).getByRole('textbox', { name: 'Width (m)', exact: true }).fill('6');
  await page.getByRole('region', { name: 'Inspector' }).getByRole('textbox', { name: 'Width (m)', exact: true }).press('Enter');
  await expect(page.getByTestId('planner-saved')).toHaveAttribute('data-revision', '1');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [LEGACY, JSON.stringify(SAVES.v3)] as const);
  page.once('dialog', dialog => { expect(dialog.message()).toContain('Export this one first'); void dialog.dismiss(); });
  await importButton(page).click();
  await expect(page.getByTestId('planner-viewport')).toHaveAttribute('data-revision', '1');
  expect((await stored(page)).id).toBe('catio-project');
  page.once('dialog', dialog => { void dialog.accept(); });
  await importButton(page).click();
  await expect.poll(async () => (await stored(page)).id).toBe('imported-catio');
  // an unreadable save: refused, the project kept
  await page.evaluate(key => localStorage.setItem(key, '{"version":7}'), LEGACY);
  page.once('dialog', dialog => { void dialog.accept(); });
  await importButton(page).click();
  await expect(page.getByRole('alert', { name: 'Import failed' })).toContainText('not of a version this import reads');
  expect((await stored(page)).id).toBe('imported-catio');
  expect(errors).toEqual([]);
});
