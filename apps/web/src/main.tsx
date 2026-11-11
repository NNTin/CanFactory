import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { completeSignInRedirect } from './assistant/index.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root.');
// GitHub's sign-in redirect is finished before App reads the hash; a promise chain, not a top-level await (see completeSignInRedirect).
void completeSignInRedirect().finally(() => { createRoot(root).render(<App />); });
