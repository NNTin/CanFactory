import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
});

test('selects removable doors, operates and persists the panel, and keeps sliding gates optional', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/concepts/catio/window-insert');
  await page.getByRole('button', { name: 'Modular · with tunnel', exact: true }).click();
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  const choice = page.getByRole('combobox', { name: 'Cat-port closure', exact: true });
  await expect(choice).toHaveValue('removable');
  await expect(viewer).toHaveAttribute('data-visible-parts', /window-cat-turn-buttons/);
  const panel = page.getByRole('checkbox', { name: 'Window cat panel', exact: true });
  await panel.check(); await expect(panel).toBeChecked();
  await page.reload(); await expect(panel).toBeChecked();
  await page.getByRole('slider', { name: 'Window insert assembly' }).press('Home');
  await expect(panel).toBeDisabled();
  await page.getByRole('slider', { name: 'Window insert assembly' }).press('End');
  await page.getByRole('checkbox', { name: 'Window open', exact: true }).uncheck();
  await expect(panel).toBeDisabled(); await expect(panel).not.toBeChecked();
  await choice.selectOption('sliding');
  await expect(viewer).toHaveAttribute('data-visible-parts', /window-cat-tracks/);
  await expect(viewer).not.toHaveAttribute('data-visible-parts', /window-cat-turn-buttons/);
  await page.getByRole('button', { name: 'Reset to the recommended defaults', exact: true }).click();
  await expect(choice).toHaveValue('removable');
  expect(errors).toEqual([]);
});

test('adds removable tunnel access without changing roofs, and shares its context with the coupling', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/concepts/catio/tunnel');
  const viewer = page.getByTestId('subassembly-viewer');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('combobox', { name: 'Tunnel maintenance access' })).toHaveValue('true');
  const panels = page.getByRole('group', { name: 'Doors and access panels' });
  const access = panels.getByRole('checkbox', { name: /maintenance panel/ }).first();
  await expect(access).toBeEnabled(); await access.check(); await expect(access).toBeChecked();
  await page.reload(); await expect(access).toBeChecked();
  const visible = (await viewer.getAttribute('data-visible-parts')) ?? '';
  await page.getByRole('combobox', { name: 'Tunnel maintenance access' }).selectOption('false');
  await expect(panels.getByRole('checkbox', { name: /maintenance panel/ })).toHaveCount(0);
  expect((await viewer.getAttribute('data-visible-parts'))?.split(' ').filter(id => id.includes('roof'))).toEqual(visible.split(' ').filter(id => id.includes('roof')));
  await page.getByRole('combobox', { name: 'Tunnel maintenance access' }).selectOption('true');
  await page.getByRole('button', { name: 'Side · the climb', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('removable-tunnel-panels.png'), fullPage: true });
  await page.goto('/#/concepts/catio/insert-tunnel-coupling');
  await expect(page.getByTestId('subassembly-viewer')).toHaveAttribute('data-visible-parts', /window-cat-turn-buttons/);
  await expect(page.getByRole('checkbox', { name: 'Window cat panel', exact: true })).toBeEnabled();
  await page.getByRole('checkbox', { name: 'Released · latches open', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Window cat panel', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('migrates old saved designs and switches to the new default only on reset', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('legacy-seeded')) return;
    sessionStorage.setItem('legacy-seeded', 'true');
    localStorage.setItem('canfactory.catio.window-insert.v1', JSON.stringify({ version: 1, variant: 'modular', config: { footDiameter: 40 }, views: { modular: { progress: 6, view: 'Top' } } }));
  });
  await page.goto('/#/concepts/catio/window-insert');
  const choice = page.getByRole('combobox', { name: 'Cat-port closure', exact: true });
  await expect(choice).toHaveValue('sliding');
  await expect(page.getByRole('combobox', { name: 'Foot diameter' })).toHaveValue('40');
  await expect(page.getByRole('button', { name: 'Top', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Reset to the recommended defaults', exact: true }).click();
  await expect(choice).toHaveValue('removable');
  await page.goto('/#/concepts/catio');
  await page.getByRole('button', { name: 'Modular · with tunnel', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Enclosure cat-port closure' })).toHaveValue('removable');
  await page.getByRole('combobox', { name: 'Enclosure cat-port closure' }).selectOption('sliding');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Enclosure cat-port closure' })).toHaveValue('sliding');
  await page.getByRole('button', { name: 'Reset modular dimensions' }).click();
  await expect(page.getByRole('combobox', { name: 'Enclosure cat-port closure' })).toHaveValue('removable');
});


test('reports an incompatible window closure without crashing or replacing saved dimensions', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/concepts/catio');
  await page.getByRole('button', { name: 'Modular · with tunnel', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Glass height', exact: true }).fill('50');
  await page.getByRole('spinbutton', { name: 'Sash height', exact: true }).fill('60');
  await expect(page.getByTestId('catio-viewer')).toHaveAttribute('data-config', /"sashHeight":600/);
  await page.goto('/#/concepts/catio/window-insert');
  await page.getByRole('button', { name: 'Modular · with tunnel', exact: true }).click();
  await page.getByRole('combobox', { name: 'Cat-port closure', exact: true }).selectOption('sliding');
  await page.goto('/#/concepts/catio');
  await expect(page.getByText(/The saved window closure no longer fits/)).toBeVisible();
  await expect(page.getByTestId('catio-viewer')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('catio-viewer')).toHaveAttribute('data-config', /"sashHeight":600/);
  expect(errors).toEqual([]);
});
