import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { findPart, matchOffers, offers, parseOfferParts, type AffiliateAccounts } from '@canfactory/contracts';

/** The catio planner's local saving, JSON import/export and draft build list (#115). */
const KEY = 'canfactory.catio.planner.v1';

/** The planner, its API calls failing unless a test answers them first. */
async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/concepts/catio/planner');
  await expect(page.getByTestId('planner-viewport')).toHaveAttribute('data-ready', 'true');
  return { errors, viewport: page.getByTestId('planner-viewport') };
}
const inspector = (page: Page) => page.getByRole('region', { name: 'Inspector' });
const field = (page: Page, name: string) => inspector(page).getByRole('textbox', { name, exact: true });
const tree = (page: Page) => page.getByRole('navigation', { name: 'Object tree' });
const saved = (page: Page) => page.getByTestId('planner-saved');
const buildList = (page: Page) => page.getByRole('region', { name: 'Build list' });
const stored = (page: Page) => page.evaluate(key => localStorage.getItem(key), KEY);
async function enter(page: Page, name: string, value: string) { await field(page, name).fill(value); await field(page, name).press('Enter'); }

test('saves each committed edit and opens it again after a reload', async ({ page }) => {
  const { errors, viewport } = await open(page);
  await expect(saved(page)).toHaveAttribute('data-state', 'saved');
  await enter(page, 'Width (m)', '6.5');
  await expect(saved(page)).toHaveAttribute('data-revision', '1');
  await tree(page).getByRole('button', { name: /Enclosure/ }).click();
  await enter(page, 'Height (cm)', '180');
  await expect(saved(page)).toHaveAttribute('data-revision', '2');
  expect(JSON.parse(await stored(page) ?? '{}')).toMatchObject({ revision: 2, garden: { width: 6500 } });

  await page.reload();
  await expect(viewport).toHaveAttribute('data-revision', '2');
  // the view is saved with it: the enclosure is still selected
  await expect(viewport).toHaveAttribute('data-selection', '["enclosure-1"]');
  await expect(field(page, 'Height (cm)')).toHaveValue('180');
  expect(JSON.parse(await stored(page) ?? '{}')).toMatchObject({ revision: 2, garden: { width: 6500 } });
  // a reload starts a new history: the saved project is where undo starts
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('undoing an added platform it had selected saves a project that opens again (#122)', async ({ page }) => {
  const { errors, viewport } = await open(page);
  await enter(page, 'Width (m)', '6');
  await page.getByRole('button', { name: /^Platform/ }).click();
  await expect(viewport).toHaveAttribute('data-selection', '["platform-1"]');
  await expect(viewport).toHaveAttribute('data-revision', '2');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(tree(page).getByRole('button')).toHaveText([/Window/, /Tunnel/, /Module 1/, /Module 2/, /Enclosure/]);
  await expect(viewport).toHaveAttribute('data-selection', '[]');
  await expect(saved(page)).toHaveAttribute('data-revision', '1');
  expect(JSON.parse(await stored(page) ?? '{}')).toMatchObject({ revision: 1, view: { selection: [] } });
  await page.reload();
  // the saved project opened, not a new default one beside the saved data
  await expect(viewport).toHaveAttribute('data-revision', '1');
  await expect(field(page, 'Width (m)')).toHaveValue('6');
  await expect(page.getByRole('alert').filter({ hasText: 'The saved project could not be opened' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('exports the project as JSON and imports it back into a fresh browser', async ({ page }, testInfo) => {
  const { errors, viewport } = await open(page);
  await page.getByRole('textbox', { name: 'Project name' }).fill('Garden catio');
  await page.getByRole('textbox', { name: 'Project name' }).press('Enter');
  await page.getByRole('button', { name: /^Platform/ }).click();
  await expect(viewport).toHaveAttribute('data-revision', '2');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('group', { name: 'Project file' }).getByRole('button', { name: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('garden-catio-r2.catio.json');
  const file = testInfo.outputPath('garden-catio.json');
  await download.saveAs(file);
  const exported = JSON.parse(await readFile(file, 'utf8')) as { name: string; instances: { id: string }[]; attachments: unknown[] };
  expect(exported.name).toBe('Garden catio');
  expect(exported.instances.map(i => i.id)).toEqual(['window-1', 'tunnel-1', 'enclosure-1', 'platform-1']);

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('My catio');
  await expect(tree(page).getByRole('button')).toHaveText([/Window/, /Tunnel/, /Module 1/, /Module 2/, /Enclosure/]);
  await page.getByTestId('planner-import').setInputFiles(file);
  await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('Garden catio');
  await expect(tree(page).getByRole('button')).toHaveText([/Window/, /Tunnel/, /Module 1/, /Module 2/, /Enclosure/, /Platform 1/]);
  await expect(viewport).toHaveAttribute('data-revision', '2');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  // the imported project is the saved one now
  expect(JSON.parse(await stored(page) ?? '{}')).toEqual(exported);
  expect(errors).toEqual([]);
});

test('refuses an invalid or unsupported file, listing why, and keeps the current project', async ({ page }) => {
  const { errors, viewport } = await open(page);
  await enter(page, 'Width (m)', '7');
  await expect(viewport).toHaveAttribute('data-revision', '1');
  const before = await stored(page);
  const failed = page.getByRole('alert', { name: 'Import failed' });
  await page.getByTestId('planner-import').setInputFiles({ name: 'newer.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion": 7}') });
  await expect(failed).toContainText('newer.json was not imported');
  await expect(failed).toContainText('saved by a newer planner (schema version 7)');
  await page.getByTestId('planner-import').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ not json') });
  await expect(failed).toContainText('broken.json was not imported');
  await expect(failed).toContainText('The file is not JSON');
  await expect(field(page, 'Width (m)')).toHaveValue('7');
  await expect(viewport).toHaveAttribute('data-revision', '1');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  expect(await stored(page)).toBe(before);
  await failed.getByRole('button', { name: 'Dismiss' }).click();
  await expect(failed).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('opens a new project beside invalid saved data, and keeps that data until an edit', async ({ page }) => {
  await page.addInitScript(key => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, '{"schemaVersion": 1, "id": "x"}'); sessionStorage.setItem('seeded', '1'); } }, KEY);
  const { errors } = await open(page);
  const notice = page.getByRole('alert').filter({ hasText: 'The saved project could not be opened' });
  await expect(notice).toBeVisible();
  await expect(tree(page).getByRole('button')).toHaveText([/Window/, /Tunnel/, /Module 1/, /Module 2/, /Enclosure/]);
  await expect(saved(page)).toHaveAttribute('data-state', 'pending');
  await tree(page).getByRole('button', { name: /Enclosure/ }).click();
  expect(await stored(page)).toBe('{"schemaVersion": 1, "id": "x"}');
  await enter(page, 'Height (cm)', '190');
  await expect(saved(page)).toHaveAttribute('data-revision', '1');
  await expect(notice).toHaveCount(0);
  expect(JSON.parse(await stored(page) ?? '{}')).toMatchObject({ revision: 1 });
  expect(errors).toEqual([]);
});

test('warns that nothing is saved when storage throws, and export still works', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); };
  });
  const { errors } = await open(page);
  const warning = page.getByRole('alert').filter({ hasText: 'Not saved.' });
  await expect(warning).toContainText("This browser's storage is full.");
  await expect(saved(page)).toHaveAttribute('data-state', 'failed');
  await enter(page, 'Width (m)', '6');
  await expect(field(page, 'Width (m)')).toHaveValue('6');
  await expect(warning).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), warning.getByRole('button', { name: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('my-catio-r1.catio.json');
  expect(errors).toEqual([]);
});

test('the build list follows the current revision: resizing the platform changes it, and a line selects its instances', async ({ page }, testInfo) => {
  const { errors, viewport } = await open(page);
  await page.getByRole('button', { name: 'Build list' }).click();
  const list = buildList(page);
  await expect(list).toHaveAttribute('data-revision', '0');
  await expect(list.getByText('Draft', { exact: true })).toBeVisible();
  // the enclosure's missing recipe leads the unresolved items
  const unresolved = list.getByRole('region', { name: 'Unresolved' });
  await expect(unresolved.getByRole('listitem').first()).toContainText('has no construction recipe yet');
  await expect(list.getByRole('table', { name: 'Timber parts' })).toBeVisible();
  await expect(list).toContainText('No total price');

  await page.getByRole('button', { name: /^Platform/ }).click();
  await expect(list).toHaveAttribute('data-revision', '1');
  const platformRows = list.getByRole('row').filter({ has: page.getByRole('button', { name: 'Platform 1', exact: true }) });
  await expect(platformRows.first()).toBeVisible();
  const before = await platformRows.allInnerTexts();
  await enter(page, 'Depth (cm)', '60');
  await expect(list).toHaveAttribute('data-revision', '2');
  await expect.poll(() => platformRows.allInnerTexts()).not.toEqual(before);
  expect((await platformRows.allInnerTexts()).join('\n')).toContain('600');

  // a line selects the instances it is for; an unresolved item, its own
  await list.getByRole('row').filter({ hasText: 'Collar rail' }).getByRole('button').click();
  await expect(viewport).toHaveAttribute('data-selection', '["window-1"]');
  await unresolved.getByRole('button').first().click();
  await expect(viewport).toHaveAttribute('data-selection', '["enclosure-1"]');
  await expect(inspector(page)).toContainText('ENCLOSURE');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(list).toHaveAttribute('data-revision', '1');
  await page.screenshot({ path: testInfo.outputPath('catio-planner-build-list.png') });
  expect(errors).toEqual([]);
});

const accounts: AffiliateAccounts = { amazon: { DE: 'canfactory-21', US: 'canfactory-20' }, awin: { publisherId: 12345 } };
const networks = { amazon: true, awin: true };
const market = { market: 'DE', country: 'DE', source: 'geo', networks: { DE: networks, US: networks } };

test('links library parts to Amazon only', async ({ page }) => {
  const { errors } = await open(page);
  await page.route(url => url.pathname === '/api/v1/market', route => route.fulfill({ json: market }));
  await page.route(url => url.pathname === '/api/v1/offers', route => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: matchOffers(parseOfferParts(url.searchParams.get('parts') ?? ''), 'DE', { accounts, findPart, catalogue: offers, live: [] }) });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Build list' }).click();
  const list = buildList(page);
  await expect(list.getByRole('columnheader', { name: 'Buy' }).first()).toBeVisible();
  const links = list.getByRole('link', { name: /amazon/i });
  await expect(links.first()).toBeVisible();
  for (const href of await links.evaluateAll(as => as.map(a => (a as HTMLAnchorElement).href))) expect(href).toMatch(/amazon\.de/);
  await list.getByRole('button', { name: 'Add all hardware to buy list' }).click();
  await expect(list.getByRole('link', { name: 'See the buy list' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('stays usable when the offers request fails', async ({ page }) => {
  const { errors } = await open(page);
  await page.route(url => url.pathname === '/api/v1/market', route => route.fulfill({ json: market }));
  await page.route(url => url.pathname === '/api/v1/offers', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"down"}' }));
  await page.reload();
  const offersFailed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/offers');
  await page.getByRole('button', { name: 'Build list' }).click();
  await offersFailed;
  const list = buildList(page);
  await expect(list.getByRole('table', { name: 'Hardware parts' })).toBeVisible();
  await expect(list.getByRole('link', { name: /amazon/i })).toHaveCount(0);
  await list.getByRole('row').filter({ hasText: 'Collar rail' }).getByRole('button').click();
  await expect(page.getByTestId('planner-viewport')).toHaveAttribute('data-selection', '["window-1"]');
  await tree(page).getByRole('button', { name: /Enclosure/ }).click();
  await enter(page, 'Height (cm)', '190');
  await expect(saved(page)).toHaveAttribute('data-revision', '1');
  expect(errors).toEqual([]);
});
