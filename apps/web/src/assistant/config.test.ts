import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAssistantConfig } from './config.ts';

describe('the assistant’s runtime config', () => {
  it('is off in the config the build ships', () => {
    expect(parseAssistantConfig(JSON.parse(readFileSync('apps/web/public/config.json', 'utf8')))).toBeNull();
  });

  it('is on only when enabled with an https edge', () => {
    expect(parseAssistantConfig({ assistant: { enabled: true, edgeBaseUrl: 'https://api.dev.tiny.nntin.xyz', githubClientId: 'Ov23abc' } }))
      .toEqual({ edgeBaseUrl: 'https://api.dev.tiny.nntin.xyz', githubClientId: 'Ov23abc', mcpServers: [] });
    expect(parseAssistantConfig({ assistant: { enabled: true, edgeBaseUrl: 'https://edge.example', githubClientId: '' } }))
      .toEqual({ edgeBaseUrl: 'https://edge.example', githubClientId: null, mcpServers: [] });
    for (const document of [null, 'yes', {}, { assistant: true }, { assistant: { enabled: 'true', edgeBaseUrl: 'https://edge.example' } },
      { assistant: { enabled: true, edgeBaseUrl: 'http://edge.example' } }, { assistant: { enabled: true, edgeBaseUrl: 'not a url' } }, { assistant: { enabled: true } }]) {
      expect(parseAssistantConfig(document)).toBeNull();
    }
  });

  it('lists KiPrint as a required host MCP server only when configured', () => {
    const edge = { enabled: true, edgeBaseUrl: 'https://api.dev.tiny.nntin.xyz', githubClientId: 'Ov23abc' };
    expect(parseAssistantConfig({ assistant: { ...edge, mcpServers: [{ id: 'kiprint', name: 'KiPrint', url: 'https://kiprint-preview.nntin.xyz/mcp' }] } })?.mcpServers)
      .toEqual([{ id: 'kiprint', name: 'KiPrint', url: 'https://kiprint-preview.nntin.xyz/mcp', required: true }]);
    expect(parseAssistantConfig({ assistant: edge })?.mcpServers).toEqual([]);
    expect(parseAssistantConfig({ assistant: { ...edge, mcpServers: 'kiprint' } })?.mcpServers).toEqual([]);
    // Malformed entries are dropped, the rest kept: no ':' in an id (tools are mcp:<id>:<tool>), https only, ids unique.
    expect(parseAssistantConfig({ assistant: { ...edge, mcpServers: [
      null, { id: 'ki:print', name: 'KiPrint', url: 'https://kiprint.nntin.xyz/mcp' }, { id: 'kiprint', name: 'KiPrint', url: 'http://kiprint.nntin.xyz/mcp' },
      { id: 'kiprint', name: ' ', url: 'https://kiprint.nntin.xyz/mcp' }, { id: 'kiprint', name: 'KiPrint', url: 'not a url' },
      { id: 'kiprint', name: 'KiPrint', url: 'https://kiprint.nntin.xyz/mcp' }, { id: 'kiprint', name: 'Again', url: 'https://other.example/mcp' },
    ] } })?.mcpServers).toEqual([{ id: 'kiprint', name: 'KiPrint', url: 'https://kiprint.nntin.xyz/mcp', required: true }]);
  });
});
