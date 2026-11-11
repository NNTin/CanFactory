// The eager side of the assistant (#152 §3): the runtime config, the panel's frame, and GitHub's sign-in redirect. Nothing here
// imports the @nntin/tinytinkerer-embed root; the assistant itself loads behind import() only when the config enables it, and on a
// narrow screen only when the reader opens it. tools/check-web-bundle.ts checks the startup bundle for it.
import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { MessageSquare, PanelRightClose } from 'lucide-react';
import { completeGitHubOAuth, isGitHubOAuthCallback } from '@nntin/tinytinkerer-embed/oauth';
import { callbackConfig, loadAssistantConfig, type AssistantConfig } from './config.ts';

const AssistantHost = lazy(() => import('./AssistantHost.tsx'));

/** The assistant's config once /config.json has loaded; null while it loads and whenever the assistant is off. */
export function useAssistantConfig(): AssistantConfig | null {
  const [config, setConfig] = useState<AssistantConfig | null>(null);
  useEffect(() => {
    let current = true;
    void loadAssistantConfig().then(loaded => { if (current) setConfig(loaded); });
    return () => { current = false; };
  }, []);
  return config;
}

const NARROW = '(max-width: 900px)';
const subscribeNarrow = (change: () => void) => { const query = window.matchMedia(NARROW); query.addEventListener('change', change); return () => { query.removeEventListener('change', change); }; };
const isNarrow = () => window.matchMedia(NARROW).matches;

const DOCK_KEY = 'canfactory:assistant:dock';
const readDock = () => { try { return localStorage.getItem(DOCK_KEY) !== 'closed'; } catch { return true; } };

let signInError: string | null = null;

const Loading = () => <p role="status" className="assistant-status">Loading the assistant…</p>;

/**
 * The assistant beside the page: on a wide screen a column docked on the right (closable; the choice is remembered), on a narrow one
 * a launcher that opens it floating over the page. Closed, nothing of tinytinkerer is downloaded.
 */
export function AssistantPanel({ config }: { config: AssistantConfig }) {
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow);
  const [docked, setDocked] = useState(readDock);
  const [launched, setLaunched] = useState(false);
  const dock = (open: boolean) => { setDocked(open); try { localStorage.setItem(DOCK_KEY, open ? 'open' : 'closed'); } catch { /* Optional preference. */ } };
  const error = signInError && <p role="alert" className="assistant-status assistant-error">GitHub sign-in did not complete: {signInError}</p>;

  if (narrow) {
    return launched
      ? <div className="assistant-floating">{error}<Suspense fallback={<Loading />}><AssistantHost settings={config} layout="floating" /></Suspense></div>
      : <button type="button" className="assistant-launcher" onClick={() => { setLaunched(true); }}><MessageSquare size={18} aria-hidden="true" /> Assistant</button>;
  }
  if (!docked) return <button type="button" className="assistant-launcher" onClick={() => { dock(true); }}><MessageSquare size={18} aria-hidden="true" /> Assistant</button>;
  return <aside className="assistant-dock" aria-label="Assistant">
    <div className="assistant-dock-heading"><span className="eyebrow"><MessageSquare size={14} aria-hidden="true" /> ASSISTANT</span>
      <button type="button" className="text-button" aria-label="Close the assistant" onClick={() => { dock(false); }}><PanelRightClose size={15} /></button></div>
    {error}
    <Suspense fallback={<Loading />}><AssistantHost settings={config} layout="sidebar" /></Suspense>
  </aside>;
}

/**
 * GitHub's redirect back to /auth/github/callback: finishes sign-in before CanFactory's hash routing reads the URL, then restores
 * the page the reader left. Uses the side-effect-free /oauth subpath, which saves the token for the assistant's next boot. Call it
 * in a promise chain before rendering, never with a top-level await (that deadlocks the entry once anything loads a lazy chunk).
 */
export async function completeSignInRedirect(): Promise<void> {
  if (!isGitHubOAuthCallback()) return;
  const config = await loadAssistantConfig();
  try {
    if (!config) throw new Error('The assistant is not enabled here.');
    window.history.replaceState(null, '', await completeGitHubOAuth(callbackConfig(config)) ?? '/');
  } catch (caught) {
    signInError = caught instanceof Error ? caught.message : 'Sign-in failed.';
    window.history.replaceState(null, '', '/');
  }
}
