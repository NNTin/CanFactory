import { test, expect, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';
import { DEFAULT_WIRE_GUIDE_DESIGN, type Render } from '@canfactory/contracts';

// The activity panel's summaries of CanFactory's tools (#169), against a scripted edge: the real embed runs the real registered
// tools in the page, and the panel renders what they returned. No real OAuth, model or KiPrint call. Renders are intercepted, so
// the test decides when one is queued and when it finishes, on any deployment (and no render job reaches a shared worker).
const EDGE = 'https://api.dev.tiny.nntin.xyz';
const BOARD = 'adafruit-perma-proto-half';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
interface ChatBody { stream?: boolean; tool_choice?: string; messages?: { role: string; content?: unknown }[] }
interface Step { name: string; args: Record<string, unknown>; before?: () => Promise<void> }

const invalidDesign = { ...DEFAULT_WIRE_GUIDE_DESIGN, boardPartId: 'm3-hex-nut' };

async function signIn(page: Page, context: BrowserContext, route: string) {
  await context.route('https://api.github.com/user', fulfil => fulfil.fulfill({ headers: { 'access-control-allow-origin': '*' },
    json: { login: 'canfactory-test', id: 1, name: 'Test', avatar_url: '' } }));
  await page.goto(route);
  await page.evaluate(target => {
    sessionStorage.setItem('canfactory:oauth_state', 'test-state');
    sessionStorage.setItem('canfactory:oauth_return_url', `${location.origin}/${target}`);
  }, route);
  await page.goto('/auth/github/callback?code=0123456789abcdef0123&state=test-state');
  await expect(page.getByRole('complementary', { name: 'Assistant' }).getByRole('textbox').first()).toBeVisible();
}

/** A minimal binary STL (one triangle): the viewer needs real bytes to call the render ready. */
function stl(): Buffer {
  const bytes = Buffer.alloc(84 + 50);
  bytes.writeUInt32LE(1, 80);
  [0, 0, 1, 0, 0, 0, 80, 0, 0, 0, 104, 60].forEach((value, index) => bytes.writeFloatLE(value, 84 + index * 4));
  return bytes;
}
const succeeded = (id: string, modelId: string): Render => ({
  id, modelId, modelVersion: '1', status: 'succeeded', createdAt: Date.now(), expiresAt: Date.now() + 3600000, slotCount: 792, error: null,
  artifact: { url: `/api/v1/models/${modelId}/reference.stl?revision=${id}`, sha256: 'test', bytes: 134, triangles: 1, dimensions: { x: 80, y: 104, z: 60 }, volume: 100 },
});

/** One completed tool's activity entry in a turn's panel: its collapsed line, and its badge. */
const entry = (panel: Locator, title: string | RegExp) => panel.locator('details').filter({ has: panel.page().locator('summary > span.flex-1', { hasText: title }) });
const badge = (item: Locator) => item.locator('[data-activity-status]');

test('CanFactory tool activity names each real result, its issues and the render it observed', async ({ page, context }) => {
  // Opening the wire guide from a long conversation can keep the page busy for a while (seen: 10–35 s on a small machine).
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/config.json', route => route.fulfill({ json: { assistant: { enabled: true, edgeBaseUrl: EDGE, githubClientId: 'Ov23test' } } }));
  // Renders: the page's first one finishes at once; later ones wait until the test releases them.
  const held: Route[] = [];
  let hold = false;
  await context.route('**/api/v1/renders', async route => {
    const body = route.request().postDataJSON() as { modelId: string };
    if (hold) held.push(route);
    else await route.fulfill({ status: 200, json: succeeded(`job-${Date.now()}`, body.modelId) });
  });
  await context.route('**/reference.stl?revision=*', route => route.fulfill({ contentType: 'model/stl', body: stl() }));

  const turns: Step[][] = [[
    { name: 'canfactory_search_parts', args: { query: 'perma proto half' } },
    { name: 'canfactory_search_parts', args: { query: 'zzz-no-such-part' } },
    { name: 'canfactory_get_part', args: { id: 'no-such-part' } },
    { name: 'canfactory_get_prototype_board_layout', args: { partId: BOARD } },
    { name: 'canfactory_query_prototype_board', args: { partId: BOARD, labels: ['A1'], connected: [[[0, 3], [0, 7]], [[0, 3], [1, 3]]] } },
    { name: 'canfactory_validate_wire_guide_design', args: { design: invalidDesign } },
    { name: 'canfactory_open_wire_guide_design', args: { design: invalidDesign } },
    { name: 'canfactory_set_model_parameters', args: { modelId: 'fruit-fly-trap', parameters: { trapHeight: 1e6 } } },
    { name: 'canfactory_set_model_parameters', args: { modelId: 'fruit-fly-trap', parameters: { trapHeight: 80 } } },
    // Read the state once the editor shows the new render waiting for the renderer (held above).
    { name: 'canfactory_get_editor_state', args: {}, before: () => page.getByText('Waiting for renderer').waitFor() },
  ], [
    { name: 'canfactory_get_editor_state', args: {} },
    { name: 'canfactory_validate_wire_guide_design', args: { design: DEFAULT_WIRE_GUIDE_DESIGN } },
    { name: 'canfactory_open_wire_guide_design', args: { design: DEFAULT_WIRE_GUIDE_DESIGN } },
  ]];
  const answers = ['Checked the board; the trap is re-rendering.', 'The trap rendered, and the wire guide is open.'];
  /** What each turn's tool calls returned to the model, in order: the evidence the tools really ran in the page. */
  const results: string[][] = [];
  await context.route(`${EDGE}/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: cors, json: body });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (path === '/auth/github/exchange') return json({ accessToken: 'gho_test_token' });
    if (path === '/health') return json({ auth: { state: 'ready', detail: 'stub' }, models: { state: 'ready', detail: 'stub' } });
    if (path === '/api/models/list') return json({ models: [{ provider: 'litellm', id: 'stub/model', label: 'Stub model', kind: 'chat', publisher: 'stub', limits: { max_input_tokens: 128000, max_output_tokens: 8000 } }] });
    if (path !== '/api/models/chat') return json({ error: 'not stubbed' }, 404);
    const body = JSON.parse(request.postData() ?? '{}') as ChatBody;
    const messages = body.messages ?? [];
    const turn = messages.filter(message => message.role === 'user').length - 1;
    const lastUser = messages.map(message => message.role).lastIndexOf('user');
    const returned = messages.slice(lastUser).filter(message => message.role === 'tool').map(message => typeof message.content === 'string' ? message.content : JSON.stringify(message.content));
    results[turn] = returned;
    const done = returned.length;
    const step = body.tool_choice === 'none' ? undefined : turns[turn]?.[done];
    if (step?.before) await step.before();
    const delta = step
      ? { tool_calls: [{ index: 0, id: `call-${turn}-${done}`, type: 'function', function: { name: step.name, arguments: JSON.stringify(step.args) } }] }
      : { content: answers[turn] ?? 'Done.' };
    const finish = step ? 'tool_calls' : 'stop';
    if (body.stream === false) return json({ choices: [{ index: 0, message: { role: 'assistant', ...delta }, finish_reason: finish }] });
    const events = [{ choices: [{ index: 0, delta: { role: 'assistant', ...delta }, finish_reason: null }] }, { choices: [{ index: 0, delta: {}, finish_reason: finish }] }]
      .map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('');
    return route.fulfill({ headers: { ...cors, 'content-type': 'text/event-stream' }, body: `${events}data: [DONE]\n\n` });
  });

  await signIn(page, context, '#/models/fruit-fly-trap');
  const download = page.getByRole('button', { name: 'Download STL', exact: true });
  await expect(download).toBeEnabled({ timeout: 30_000 });
  const assistant = page.getByRole('complementary', { name: 'Assistant' });
  // The panel shows tool activity only when the user turns it on (off by default).
  await assistant.getByRole('button', { name: /settings/i }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await settings.getByRole('tab', { name: 'Models', exact: true }).click();
  const show = settings.getByLabel('Show reasoning & activity');
  await settings.getByText('Show reasoning & activity', { exact: true }).click();
  await expect(show).toBeChecked();
  await settings.getByRole('button', { name: 'Close settings', exact: true }).click();
  const composer = assistant.getByRole('textbox').first();
  // Each turn's activity panel: a section headed “Reasoning & activity” (not the conversation section around them).
  const panels = assistant.locator('section:has(> div > h3)').filter({ hasText: 'Reasoning & activity' });
  /** A finished turn's activity panel, expanded: it is open while the turn runs and folds when it ends. */
  const open = async (index: number) => {
    const panel = panels.nth(index);
    const toggle = panel.getByRole('button', { name: 'Toggle reasoning and activity' });
    await expect(panel.getByRole('heading', { name: 'Reasoning & activity', exact: true })).toBeVisible();
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    return panel;
  };
  /** Waits for turn `index` to finish: its panel folds itself. */
  const finished = (index: number) => expect(panels.nth(index).getByRole('button', { name: 'Toggle reasoning and activity' })).toHaveAttribute('aria-expanded', 'false');

  // Turn 1: reads, rejections, an exception, and a parameter change whose render the test holds.
  hold = true;
  await composer.fill('Check the half Perma-Proto, then make the trap 80 mm tall');
  await composer.press('Enter');
  await expect(assistant.getByRole('paragraph').filter({ hasText: answers[0] ?? '' })).toBeVisible();
  await finished(0);
  const first = await open(0);
  await expect(first.locator('details')).toHaveCount(9);
  const expected: [string | RegExp, string][] = [
    ['Search parts: 1 part matches “perma proto half”', 'ok'],
    ['Search parts: no parts match “zzz-no-such-part”', 'ok'],
    [/^Board layout: adafruit-perma-proto-half, \d+ × \d+ grid at 2\.5 mm, \d+ holes, \d+ nets$/, 'ok'],
    [`Board query: ${BOARD}, 1 label (1 found); 2 pairs: 1 connected, 1 not connected`, 'ok'],
    [/^Validate design: design invalid, 1 issue: \/boardPartId: /, 'error'],
    [/^Open design: design rejected, nothing opened, 1 issue: \/boardPartId: /, 'error'],
    [/^Set parameters: rejected, nothing changed, \d+ issues?: trapHeight: /, 'error'],
    ['Set parameters: fruit-fly-trap, set trapHeight; render requested, not ready yet', 'ok'],
    ['Editor state: Fruit fly trap, render queued when read, not ready', 'ok'],
  ];
  for (const [title, status] of expected) await expect(badge(entry(first, title)), String(title)).toHaveAttribute('data-activity-status', status);
  // Known results are never Unknown, and the exception stays an execution failure, outside the summaries.
  await expect(first.locator('[data-activity-status="unknown"]')).toHaveCount(0);
  await expect(first.locator('div', { has: page.getByText('canfactory_get_part failed:', { exact: true }) }).last()).toContainText('There is no part “no-such-part”');
  // The rejection is legible collapsed; the raw result stays in the expanded entry.
  const rejected = entry(first, /^Validate design: design invalid/);
  await expect(rejected.locator('summary')).toContainText('m3-hex-nut');
  await rejected.locator('summary').click();
  await expect(rejected).toContainText('"valid": false');
  // The board layout's raw result is in its expanded entry only, not in the collapsed line.
  const layout = entry(first, /^Board layout:/);
  await expect(layout.locator('summary')).not.toContainText('holeCount');
  await layout.locator('summary').click();
  await expect(layout).toContainText('"holeCount"');

  // The tools really ran in the page: their actual results went back to the model.
  const sent = results[0] ?? [];
  expect(sent).toHaveLength(10);
  expect(sent.some(content => content.includes(`"id":"${BOARD}"`) && content.includes('"total"'))).toBe(true);
  expect(sent.some(content => content.includes('"total":0'))).toBe(true);
  expect(sent.some(content => content.includes('no-such-part'))).toBe(true);
  expect(sent.some(content => content.includes('"holeCount"'))).toBe(true);
  expect(sent.some(content => content.includes('"connected":false'))).toBe(true);
  expect(sent.some(content => content.includes('"valid":false') && content.includes('/boardPartId'))).toBe(true);
  expect(sent.some(content => content.includes('"status":"queued"'))).toBe(true);
  expect(held).toHaveLength(1);
  expect(held[0]?.request().postDataJSON()).toMatchObject({ modelId: 'fruit-fly-trap', parameters: { trapHeight: 80 } });

  // The held render finishes; turn 2 reads it ready, then opens a design, whose render is only requested.
  const render = held.shift();
  await render?.fulfill({ status: 200, json: succeeded('job-trap-80', 'fruit-fly-trap') });
  await expect(download).toBeEnabled();
  await composer.fill('Is it ready? Then open the default wire guide');
  await composer.press('Enter');
  await expect(assistant.getByRole('paragraph').filter({ hasText: answers[1] ?? '' })).toBeVisible({ timeout: 120_000 });
  await finished(1);
  const second = await open(1);
  await expect(badge(entry(second, 'Editor state: Fruit fly trap, render ready (80 × 104 × 60 mm)'))).toHaveAttribute('data-activity-status', 'ok');
  await expect(badge(entry(second, 'Validate design: design valid, no issues'))).toHaveAttribute('data-activity-status', 'ok');
  await expect(badge(entry(second, /^Open design: opened the design on .+; render requested, not ready yet$/))).toHaveAttribute('data-activity-status', 'ok');
  await expect(second.locator('[data-activity-status="unknown"]')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/models\/prototype-wire-guide$/);
  // The first turn's record still says what it saw: queued, not ready.
  await expect(entry(await open(0), 'Editor state: Fruit fly trap, render queued when read, not ready')).toHaveCount(1);
  expect(results[1]).toHaveLength(3);
  expect(results[1]?.[0]).toContain('"status":"ready"');
  expect(results[1]?.[2]).toContain('"ok":true');
  expect(errors).toEqual([]);
});
