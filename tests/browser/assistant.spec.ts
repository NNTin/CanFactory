import { test, expect, type BrowserContext, type Page, type Request } from '@playwright/test';

// The embedded tinytinkerer assistant (#152 phase 3) against a stubbed edge. The Compose image's CSP allows the develop edge, so the
// stub answers for it: Playwright fulfils those requests in the browser and nothing reaches the network. `STATIC_PREVIEW=1` runs it
// against `vite preview` instead (no API, no CSP): the render request is still checked, the finished render and the header are not.
const EDGE = 'https://api.dev.tiny.nntin.xyz';
const STATIC_PREVIEW = process.env['STATIC_PREVIEW'] === '1';
const ENABLED = { assistant: { enabled: true, edgeBaseUrl: EDGE, githubClientId: 'Ov23test' } };

/** Everything the page asks for, to check what left the origin. */
function record(page: Page): Request[] {
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  return requests;
}
const foreign = (page: Page, requests: Request[]) => requests.map(request => request.url()).filter(url => !url.startsWith(new URL(page.url()).origin) && !url.startsWith('data:'));
const assistantChunks = (requests: Request[]) => requests.map(request => request.url()).filter(url => /\/assets\/AssistantHost-[^/]*\.js$/.test(url));

async function enable(context: BrowserContext) {
  await context.route('**/config.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(ENABLED) }));
}

test('with the assistant off, the page is as before and loads none of it', async ({ page }) => {
  const requests = record(page);
  const document = page.waitForResponse(response => response.request().resourceType() === 'document');
  await page.goto('/#/models/fruit-fly-trap');
  await expect(page.getByRole('heading', { name: 'Fruit fly trap', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('complementary', { name: 'Assistant' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Assistant' })).toHaveCount(0);
  expect(assistantChunks(requests)).toEqual([]);
  expect(foreign(page, requests)).toEqual([]);
  if (!STATIC_PREVIEW) {
    const policy = (await document).headers()['content-security-policy'] ?? '';
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(policy).toContain(`connect-src 'self' ${EDGE} https://api.github.com`);
    expect(policy).not.toContain("'unsafe-eval'");
    // The physics worker gets its own policy, the only one with eval (physics.spec.ts runs the engine under it).
    const entry = /\/assets\/index-[^"]+\.js/.exec(await (await page.request.get('/')).text())?.[0] ?? '/missing';
    const script = /physicsWorker-[^"/]+\.js/.exec(await (await page.request.get(entry)).text())?.[0] ?? 'missing';
    const worker = await page.request.get(`/assets/${script}`);
    expect(worker.ok()).toBe(true);
    expect(worker.headers()['content-security-policy']).toContain("script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'");
  }
});

test('signed out, the panel asks for GitHub sign-in and nothing reaches the edge', async ({ page, context }) => {
  await enable(context);
  const requests = record(page);
  await page.goto('/#/models/fruit-fly-trap');
  const panel = page.getByRole('complementary', { name: 'Assistant' });
  await expect(panel.getByRole('button', { name: 'Sign in with GitHub' })).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByRole('textbox')).toHaveCount(0);
  // The panel's boot settles; still nothing for the edge (models, status, MCP, chat) or GitHub's API.
  await page.waitForTimeout(3000);
  expect(foreign(page, requests)).toEqual([]);
  // Its colours are CanFactory's: the page's own --accent is untouched, and the panel's (theme: var(--accent)) resolves to it.
  const colours = await page.evaluate(() => ({ page: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    panel: getComputedStyle(document.querySelector('.assistant-host [style*="--tt-accent"]') as Element).getPropertyValue('--tt-accent').trim() }));
  expect(colours.page).toBe('#bd5839');
  expect(colours.panel).toBe('#bd5839');
});

test('on a narrow screen the assistant waits behind a launcher', async ({ page, context }) => {
  await enable(context);
  await page.setViewportSize({ width: 600, height: 900 });
  const requests = record(page);
  await page.goto('/#/models/fruit-fly-trap');
  const launcher = page.getByRole('button', { name: 'Assistant' });
  await expect(launcher).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(assistantChunks(requests)).toEqual([]);
  await launcher.click();
  // Floating over the page, on screen, and the page under it still takes clicks.
  await expect(page.getByRole('button', { name: 'Sign in with GitHub' })).toBeInViewport({ ratio: 1, timeout: 30_000 });
  expect(assistantChunks(requests)).toHaveLength(1);
  await page.getByRole('button', { name: 'Model library', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/models$/);
});

interface ChatBody { stream?: boolean; tools?: { function?: { name?: string } }[]; messages?: { role: string; content?: unknown; tool_call_id?: string }[] }

test('signed in, a chat turn calls the CanFactory tools and the editor renders the change', async ({ page, context }) => {
  await enable(context);
  const cors = { 'access-control-allow-origin': new URL(test.info().project.use.baseURL ?? 'http://127.0.0.1:5173').origin, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const chats: { body: ChatBody; authorization: string | undefined }[] = [];
  // The model's turn: read the editor, then change the funnel's height, then answer.
  const reply = (body: ChatBody) => {
    const tools = (body.tools ?? []).map(tool => tool.function?.name);
    const results = (body.messages ?? []).filter(message => message.role === 'tool').length;
    if (tools.includes('canfactory_get_editor_state') && results === 0) return { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'canfactory_get_editor_state', arguments: '{}' } }] };
    if (tools.includes('canfactory_set_model_parameters') && results === 1) return { tool_calls: [{ index: 0, id: 'call_2', type: 'function', function: { name: 'canfactory_set_model_parameters', arguments: JSON.stringify({ modelId: 'fruit-fly-trap', parameters: { trapHeight: 80 } }) } }] };
    return { content: 'Done: the funnel is now 80 mm tall.' };
  };
  await context.route(`${EDGE}/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (path === '/auth/github/exchange') return json({ accessToken: 'gho_test_token' });
    if (path === '/health') return json({ auth: { state: 'ready', detail: 'stub' }, models: { state: 'ready', detail: 'stub' } });
    if (path === '/api/models/list') return json({ models: [{ provider: 'litellm', id: 'stub/model', label: 'Stub model', kind: 'chat', publisher: 'stub', limits: { max_input_tokens: 128000, max_output_tokens: 8000 } }] });
    if (path === '/api/models/chat') {
      const body = JSON.parse(request.postData() ?? '{}') as ChatBody;
      chats.push({ body, authorization: await request.headerValue('authorization') ?? undefined });
      const delta = reply(body);
      const finish = 'tool_calls' in delta ? 'tool_calls' : 'stop';
      if (body.stream === false) return json({ id: 'chat', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: delta.content ?? null, ...('tool_calls' in delta ? { tool_calls: delta.tool_calls } : {}) }, finish_reason: finish }] });
      // Streamed: the delta, then the finish, as server-sent events.
      const events = [{ choices: [{ index: 0, delta: { role: 'assistant', ...delta }, finish_reason: null }] }, { choices: [{ index: 0, delta: {}, finish_reason: finish }] }]
        .map(chunk => `data: ${JSON.stringify({ id: 'chat', object: 'chat.completion.chunk', ...chunk })}\n\n`).join('');
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: `${events}data: [DONE]\n\n` });
    }
    return json({ error: 'not stubbed' }, 404);
  });
  await context.route('https://api.github.com/user', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ login: 'canfactory-test', id: 1, name: 'Test', avatar_url: '' }) }));

  // GitHub's redirect back, as the sign-in button would have set it up: the state and the page to return to.
  await page.goto('/#/models');
  await page.evaluate(() => { sessionStorage.setItem('canfactory:oauth_state', 'test-state'); sessionStorage.setItem('canfactory:oauth_return_url', `${location.origin}/#/models/fruit-fly-trap`); });
  await page.goto('/auth/github/callback?code=0123456789abcdef0123&state=test-state');
  await expect(page.getByRole('heading', { name: 'Fruit fly trap', exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  const height = page.getByRole('spinbutton', { name: 'Funnel height', exact: true });
  await expect(height).toHaveValue('60');

  const panel = page.getByRole('complementary', { name: 'Assistant' });
  const composer = panel.getByRole('textbox').first();
  await expect(composer).toBeVisible({ timeout: 30_000 });
  const render = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/api/v1/renders') && request.postData()?.includes('"trapHeight":80') === true);
  await composer.fill('Make the fly trap 20 mm taller');
  await composer.press('Enter');
  await expect(panel.getByText('Done: the funnel is now 80 mm tall.').first()).toBeVisible({ timeout: 30_000 });

  // The editor took the change through its own path, and rendered it.
  await expect(height).toHaveValue('80');
  await render;
  if (!STATIC_PREVIEW) await expect(page.getByText(/× 80\.0/)).toBeVisible({ timeout: 90_000 });

  // The tools were offered under their prefixed ids, every call was signed in, and the model read each result.
  expect(chats.length).toBeGreaterThanOrEqual(3);
  expect(chats.every(chat => chat.authorization === 'Bearer gho_test_token')).toBe(true);
  const offered = (chats[0]?.body.tools ?? []).map(tool => tool.function?.name);
  expect(offered).toEqual(expect.arrayContaining(['canfactory_get_editor_state', 'canfactory_set_model_parameters', 'canfactory_get_part']));
  const results = chats.flatMap(chat => chat.body.messages ?? []).filter(message => message.role === 'tool').map(message => typeof message.content === 'string' ? message.content : JSON.stringify(message.content));
  expect(results.some(result => result.includes('trapHeight') && result.includes('60'))).toBe(true);
  expect(results.some(result => result.includes('"ok":true'))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('canfactory:settings:fruit-fly-trap:1'))).toContain('"trapHeight":80');
});
