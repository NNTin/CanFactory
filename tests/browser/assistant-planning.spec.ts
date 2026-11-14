import { test, expect, type BrowserContext, type Page } from '@playwright/test';

// Real next.4 embed + scripted edge: pins the prompt/tool exposure contract and execution,
// not a probabilistic claim about an unpinned remote model. No real OAuth/MCP/model calls.
const EDGE = 'https://api.dev.tiny.nntin.xyz';
const KIPRINT = 'https://kiprint-preview.nntin.xyz/mcp';
const BOARD = 'adafruit-perma-proto-half';
const PROMPT = 'Plan a 555 blinker on a half Perma-Proto';
const MCP_TOOLS = ['create_project', 'list_footprints', 'add_components', 'add_wires', 'cut_strips', 'remove_items', 'get_project', 'check_project', 'plan_guide', 'export_project'];
interface ChatBody {
  stream?: boolean;
  tool_choice?: string;
  response_format?: unknown;
  tools?: { function: { name: string; description: string } }[];
  messages?: { role: string; content?: unknown }[];
}
const systemPrompt = (body: ChatBody): string => {
  const content = body.messages?.find(message => message.role === 'system')?.content;
  return typeof content === 'string' ? content : '';
};

async function signIn(page: Page, context: BrowserContext) {
  await context.route('https://api.github.com/user', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' },
    json: { login: 'canfactory-test', id: 1, name: 'Test', avatar_url: '' } }));
  await page.goto('/#/models');
  await page.evaluate(() => {
    sessionStorage.setItem('canfactory:oauth_state', 'test-state');
    sessionStorage.setItem('canfactory:oauth_return_url', `${location.origin}/#/models`);
  });
  await page.goto('/auth/github/callback?code=0123456789abcdef0123&state=test-state');
  await expect(page.getByRole('complementary', { name: 'Assistant' }).getByRole('textbox').first()).toBeVisible();
}

for (const scenario of [
  { agent: 'react', discovery: 'available' },
  { agent: 'plan-execute', discovery: 'available' },
  { agent: 'react', discovery: 'unavailable' },
] as const) {
  test(`555 first turn researches the board (${scenario.agent}, KiPrint ${scenario.discovery})`, async ({ page, context }) => {
    // Deliberately omit required, matching the live config: CanFactory must normalize it.
    await context.route('**/config.json', route => route.fulfill({ json: { assistant: { enabled: true, edgeBaseUrl: EDGE,
      githubClientId: 'Ov23test', mcpServers: [{ id: 'kiprint', name: 'KiPrint', url: KIPRINT }] } } }));
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const chats: ChatBody[] = [];
    const discoveries: Record<string, unknown>[] = [];
    const mcpCalls: Record<string, unknown>[] = [];
    const authorizations: (string | null)[] = [];
    const steps = [
      { name: 'canfactory_search_parts', args: { query: 'perma proto half', family: 'prototype-board' } },
      { name: 'canfactory_get_prototype_board_layout', args: { partId: BOARD } },
      { name: 'canfactory_query_prototype_board', args: { partId: BOARD, labels: ['A1'], connected: [[[0, 3], [0, 7]]] } },
      ...(scenario.discovery === 'available' ? [{ name: 'mcp_kiprint_create_project', args: { boardPartId: BOARD, title: '555 blinker' } }] : []),
    ];
    const answer = 'Assuming 5 V, about 1 Hz and one LED, I looked up the half Perma-Proto and checked its copper connections.';
    await context.route(`${EDGE}/**`, async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const json = (body: unknown, status = 200) => route.fulfill({ status, headers: cors, json: body });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (path === '/auth/github/exchange') return json({ accessToken: 'gho_test_token' });
      if (path === '/api/models/chat' || path.startsWith('/api/mcp/')) authorizations.push(await request.headerValue('authorization'));
      if (path === '/health') return json({ auth: { state: 'ready', detail: 'stub' }, models: { state: 'ready', detail: 'stub' } });
      if (path === '/api/models/list') return json({ models: [{ provider: 'litellm', id: 'stub/model', label: 'Stub model', kind: 'chat', publisher: 'stub', limits: { max_input_tokens: 128000, max_output_tokens: 8000 } }] });
      if (path === '/api/mcp/discover') {
        discoveries.push(JSON.parse(request.postData() ?? '{}') as Record<string, unknown>);
        return json({ serverName: 'KiPrint', syncedAt: new Date().toISOString(),
          ...(scenario.discovery === 'unavailable' ? { error: 'stub discovery failure', tools: [] } : { tools: MCP_TOOLS.map(toolName => ({ toolName,
            description: `KiPrint ${toolName}`, inputSchema: toolName === 'create_project'
              ? { type: 'object', properties: { boardPartId: { type: 'string' }, title: { type: 'string' } }, required: ['boardPartId', 'title'] }
              : { type: 'object', properties: {} } })) }) });
      }
      if (path === '/api/mcp/call') {
        const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
        mcpCalls.push(body);
        const text = JSON.stringify({ projectId: 'stub-project', board: { partId: BOARD } });
        return json({ serverName: 'KiPrint', toolName: body['toolName'], text, raw: { content: [{ type: 'text', text }] }, isError: false });
      }
      if (path !== '/api/models/chat') return json({ error: 'not stubbed' }, 404);
      const body = JSON.parse(request.postData() ?? '{}') as ChatBody;
      chats.push(body);
      const system = systemPrompt(body);
      const results = body.messages?.filter(message => message.role === 'tool') ?? [];
      // Simulate the observed question-first decision if the host loses its first-turn instruction.
      const researchFirst = system.includes('start this turn by calling canfactory_search_parts');
      const step = researchFirst ? steps[results.length] : undefined;
      const delta = body.response_format
        ? { content: JSON.stringify({ complexity: 'medium', steps: [
          { id: 'understand', summary: 'Use 5 V, about 1 Hz and one LED', toolCall: null },
          ...(researchFirst ? steps.map((item, index) => ({ id: `tool-${index}`, summary: item.name, toolCall: { toolId: item.name, input: JSON.stringify(item.args) } })) : []),
          { id: 'compose', summary: 'Report checked board facts', toolCall: null },
        ] }) }
        : step && body.tool_choice !== 'none'
          ? { tool_calls: [{ index: 0, id: `call-${results.length}`, type: 'function', function: { name: step.name, arguments: JSON.stringify(step.args) } }] }
          : { content: researchFirst ? answer : 'What supply voltage and blink rate do you want?' };
      const finish = 'tool_calls' in delta ? 'tool_calls' : 'stop';
      if (body.stream === false) return json({ choices: [{ index: 0, message: { role: 'assistant', ...delta }, finish_reason: finish }] });
      const events = [{ choices: [{ index: 0, delta: { role: 'assistant', ...delta }, finish_reason: null }] },
        { choices: [{ index: 0, delta: {}, finish_reason: finish }] }].map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('');
      return route.fulfill({ headers: { ...cors, 'content-type': 'text/event-stream' }, body: `${events}data: [DONE]\n\n` });
    });
    await signIn(page, context);
    const panel = page.getByRole('complementary', { name: 'Assistant' });
    await panel.getByRole('button', { name: 'Choose available tools' }).click();
    const picker = page.getByTestId('tool-tree-panel');
    await expect(picker.getByTestId('tool-tree-host-server-kiprint')).toHaveAttribute('data-status', scenario.discovery);
    for (const tool of steps.filter(step => step.name.startsWith('canfactory_'))) {
      await expect(picker.getByTestId(`tool-tree-tool-${tool.name}`)).toBeChecked();
    }
    if (scenario.discovery === 'available') await expect(picker.getByTestId('tool-tree-host-server-kiprint')).toContainText('10 tools');
    await picker.getByRole('button', { name: /close/i }).click();
    if (scenario.agent === 'plan-execute') {
      await panel.getByRole('button', { name: /settings/i }).click();
      await page.getByRole('tab', { name: 'Models', exact: true }).click();
      await page.getByLabel('Agent strategy').selectOption('plan-execute');
      await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Close settings', exact: true }).click();
    }
    const composer = panel.getByRole('textbox').first();
    await composer.fill(PROMPT);
    await composer.press('Enter');
    await expect(panel.getByText(answer, { exact: true }).first()).toBeVisible();

    expect(discoveries).toEqual([{ url: KIPRINT }]);
    expect(authorizations.every(value => value === 'Bearer gho_test_token')).toBe(true);
    const first: ChatBody = chats[0] ?? {};
    const offered = first.tools?.map(tool => tool.function.name) ?? [];
    expect(offered).toEqual(expect.arrayContaining(steps.map(step => step.name)));
    const system = systemPrompt(first);
    expect(system).toContain('assume 5 V, about 1 Hz, one LED');
    expect(system).toContain('Never claim you cannot verify copper connectivity without trying this tool');
    expect(system).toContain('When KiPrint functions are in the available tool list');
    expect(system).toContain('mcp_kiprint_create_project');
    if (scenario.discovery === 'available') {
      expect(offered).toEqual(expect.arrayContaining(MCP_TOOLS.map(name => `mcp_kiprint_${name}`)));
      expect(system).not.toContain('KiPrint is unavailable right now');
      expect(mcpCalls).toEqual([{ url: KIPRINT, toolName: 'create_project', arguments: { boardPartId: BOARD, title: '555 blinker' } }]);
    } else {
      expect(offered.some(name => name.startsWith('mcp_kiprint_'))).toBe(false);
      expect(system).toContain('KiPrint is unavailable right now');
      expect(mcpCalls).toEqual([]);
    }
    // Real browser tools executed and their outputs reached the model, including sourced board/net data.
    const results = chats.flatMap(chat => chat.messages ?? []).filter(message => message.role === 'tool')
      .map(message => typeof message.content === 'string' ? message.content : '');
    expect(results.some(result => result.includes(BOARD) && result.includes('parts'))).toBe(true);
    expect(results.some(result => result.includes('holeCount') && result.includes('nets'))).toBe(true);
    expect(results.some(result => result.includes('"connected":true') && result.includes('A1'))).toBe(true);
    expect(chats.some(chat => Boolean(chat.response_format))).toBe(scenario.agent === 'plan-execute');
    await expect(panel.getByText('What supply voltage and blink rate do you want?', { exact: true })).toHaveCount(0);
  });
}
