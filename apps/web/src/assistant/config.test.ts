import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAssistantConfig } from './config.ts';

describe('the assistant’s runtime config', () => {
  it('is off in the config the build ships', () => {
    expect(parseAssistantConfig(JSON.parse(readFileSync('apps/web/public/config.json', 'utf8')))).toBeNull();
  });

  it('is on only when enabled with an https edge', () => {
    expect(parseAssistantConfig({ assistant: { enabled: true, edgeBaseUrl: 'https://api.dev.tiny.nntin.xyz', githubClientId: 'Ov23abc' } }))
      .toEqual({ edgeBaseUrl: 'https://api.dev.tiny.nntin.xyz', githubClientId: 'Ov23abc' });
    expect(parseAssistantConfig({ assistant: { enabled: true, edgeBaseUrl: 'https://edge.example', githubClientId: '' } }))
      .toEqual({ edgeBaseUrl: 'https://edge.example', githubClientId: null });
    for (const document of [null, 'yes', {}, { assistant: true }, { assistant: { enabled: 'true', edgeBaseUrl: 'https://edge.example' } },
      { assistant: { enabled: true, edgeBaseUrl: 'http://edge.example' } }, { assistant: { enabled: true, edgeBaseUrl: 'not a url' } }, { assistant: { enabled: true } }]) {
      expect(parseAssistantConfig(document)).toBeNull();
    }
  });
});
