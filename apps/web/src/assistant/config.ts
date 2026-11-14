// The assistant's runtime config (#152): read from /config.json at startup, so one build serves every environment. The chart
// writes it from `web.assistant` (charts/canfactory/templates/web-config.yaml); the build ships apps/web/public/config.json, which
// leaves the assistant off. Eager code: it may import @nntin/tinytinkerer-embed/oauth (side-effect free), never the package root.
import { GITHUB_OAUTH_CALLBACK_PATH, type GitHubOAuthCallbackConfig } from '@nntin/tinytinkerer-embed/oauth';

/** The IndexedDB database and sessionStorage prefix the assistant owns on CanFactory's origin. */
export const STORAGE_NAMESPACE = 'canfactory';

export interface AssistantConfig {
  /**
   * The tinytinkerer edge: https://api.dev.tiny.nntin.xyz for the preview and production until it is stable, then
   * https://api.tiny.nntin.xyz for production. The CSP's connect-src allows its origin.
   */
  edgeBaseUrl: string;
  /** tinytinkerer's GitHub OAuth App client id; null when the environment has none yet (sign-in is then unavailable). */
  githubClientId: string | null;
  /** Host-provided MCP servers (#152 phase 4: KiPrint); empty unless the environment configures them. */
  mcpServers: HostMcpServerConfig[];
}

/**
 * One of the assistant's host MCP servers, as tinytinkerer's `HostMcpServer` takes it. No token: the edge adds it for the
 * hostnames in its MCP_HOST_SERVERS. CanFactory's policy builds on these servers' tools, so each is `required`: while its tools
 * are missing, every turn tells the model so, and it says the server is unavailable instead of claiming to use it.
 */
export interface HostMcpServerConfig {
  id: string;
  name: string;
  url: string;
  required: true;
}

/** The well-formed entries of `assistant.mcpServers`: an id tools can be named after (`mcp:<id>:<tool>`), a name and an https URL. */
function parseMcpServers(value: unknown): HostMcpServerConfig[] {
  if (!Array.isArray(value)) return [];
  const servers: HostMcpServerConfig[] = [];
  for (const entry of value as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, name, url } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(id) || servers.some(server => server.id === id)) continue;
    if (typeof name !== 'string' || name.trim() === '' || typeof url !== 'string') continue;
    try {
      if (new URL(url).protocol !== 'https:') continue;
    } catch { continue; }
    servers.push({ id, name: name.trim(), url, required: true });
  }
  return servers;
}

/** The assistant's settings in a /config.json document, or null when it is off or the document is malformed. */
export function parseAssistantConfig(document: unknown): AssistantConfig | null {
  if (typeof document !== 'object' || document === null) return null;
  const assistant: unknown = (document as { assistant?: unknown }).assistant;
  if (typeof assistant !== 'object' || assistant === null) return null;
  const { enabled, edgeBaseUrl, githubClientId, mcpServers } = assistant as Record<string, unknown>;
  if (enabled !== true || typeof edgeBaseUrl !== 'string') return null;
  try {
    if (new URL(edgeBaseUrl).protocol !== 'https:') return null;
  } catch { return null; }
  return {
    edgeBaseUrl,
    githubClientId: typeof githubClientId === 'string' && githubClientId !== '' ? githubClientId : null,
    mcpServers: parseMcpServers(mcpServers),
  };
}

let loading: Promise<AssistantConfig | null> | undefined;

/** The assistant's config, fetched once per page; null when it is off, or when /config.json is missing or unreadable. */
export function loadAssistantConfig(): Promise<AssistantConfig | null> {
  loading ??= fetch('/config.json', { cache: 'no-cache', headers: { accept: 'application/json' } })
    .then(response => response.ok ? response.json() as Promise<unknown> : null)
    .then(parseAssistantConfig)
    .catch(() => null);
  return loading;
}

/** What the eager OAuth callback and the lazy assistant both pass to tinytinkerer, so the two halves agree. */
export function callbackConfig(config: AssistantConfig): Required<GitHubOAuthCallbackConfig> {
  return { edgeBaseUrl: config.edgeBaseUrl, storageNamespace: STORAGE_NAMESPACE, githubRedirectUri: `${window.location.origin}${GITHUB_OAUTH_CALLBACK_PATH}` };
}
