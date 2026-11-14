// The embedded tinytinkerer assistant (#152 §3). Loaded behind a dynamic import() by index.tsx, and with tools.ts the only module
// that imports the package root, which isn't tree-shakeable: anything imported from it statically lands in the startup bundle.
import { useState } from 'react';
import {
  BrowserAppShell,
  ChatApp,
  createBrowserApp,
  EMBEDDED_DOCUMENT_GLOBAL_CAPABILITIES,
  genericToolTreeSummarizer,
  loadPlugins,
  NO_GLOBAL_HOST_CAPABILITIES,
  resolveBrowserShellBootstrapConfig,
  type BrowserApp,
  type BrowserShellConfig,
  type ChatPresentation,
} from '@nntin/tinytinkerer-embed';
import '@nntin/tinytinkerer-embed/embed.css';
import '@nntin/tinytinkerer-embed/styles.css';
import { callbackConfig, type AssistantConfig } from './config.ts';
import { assistantPolicy, STARTER_PROMPTS } from './policy.ts';
import { toolGroup } from './tools.ts';

/** CanFactory's own variables, so the panel follows the page's palette live (the package's tokens are --tt-*). */
const THEME = { background: 'var(--paper)', panel: 'var(--surface)', text: 'var(--ink)', border: 'var(--line)', accent: 'var(--accent)' };

let assistant: { app: BrowserApp; config: BrowserShellConfig } | null = null;

/** One app per page, created on first use (each createBrowserApp is a separate app with its own stores). */
function getAssistant(settings: AssistantConfig) {
  if (assistant) return assistant;
  const config = resolveBrowserShellBootstrapConfig({
    baseUrl: '/',
    origin: window.location.origin,
    ...callbackConfig(settings),
    // Sign-in is required: signed out, the panel shows GitHub's call to action and sends nothing to the edge.
    authMode: 'oauth',
    githubClientId: settings.githubClientId ?? undefined,
    theme: THEME,
  });
  const app = createBrowserApp(config, {
    // A reviewed subset: the tool picker and the context meter. No code execution, browser state or web search.
    plugins: () => loadPlugins(['plugin-tool-tree', 'plugin-context-usage']),
    appToolGroup: toolGroup,
    toolTreeSummarizer: genericToolTreeSummarizer,
    appAssistantPolicy: assistantPolicy,
    starterPrompts: STARTER_PROMPTS,
    // CanFactory owns its head, favicon and telemetry consent; tinytinkerer touches none of them.
    documentGlobals: EMBEDDED_DOCUMENT_GLOBAL_CAPABILITIES,
    humanInput: false,
    // No mcpServers in this phase: KiPrint comes with #152 phase 4.
    // Users may add their own MCP servers in Settings → Tools (tinytinkerer's default): intentional, the owner's decision on #152 (F8).
  });
  assistant = { app, config };
  return assistant;
}

const Loading = ({ error }: { error?: string }) =>
  <p role="status" className="assistant-status">{error ? `The assistant could not start: ${error}` : 'Starting the assistant…'}</p>;

/** `sidebar`: docked into CanFactory's assistant column. `floating`: over the page on a narrow screen, minimisable to a launcher. */
export default function AssistantHost({ settings, layout }: { settings: AssistantConfig; layout: 'sidebar' | 'floating' }) {
  const { app, config } = getAssistant(settings);
  // The reader asked for the assistant by opening it, so the floating panel starts open.
  const [presentation, setPresentation] = useState<ChatPresentation>({ mode: 'floating', minimized: false, edge: 'right' });
  return <div className="tt-app-embed assistant-host">
    <BrowserAppShell app={app} config={config} BootScreen={Loading} globalHosts={NO_GLOBAL_HOST_CAPABILITIES}>
      {layout === 'sidebar'
        ? <ChatApp mode="sidebar" side="right" fill morphable={false} storageKey="canfactory-assistant" LoadingComponent={Loading} />
        // The floating stage is laid out as a whole page; over CanFactory's it is a fixed, click-through overlay (styles.css).
        : <ChatApp presentation={presentation} onPresentationChange={setPresentation} morphable={false} storageKey="canfactory-assistant-floating" LoadingComponent={Loading}
          stageClassName="assistant-floating-stage" defaultWidth={Math.min(400, window.innerWidth - 24)} defaultHeight={Math.min(640, window.innerHeight - 96)} />}
    </BrowserAppShell>
  </div>;
}
