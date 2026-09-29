import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The commit the app is built from, for the footer: Vercel's, the one a Docker build is given (`GIT_COMMIT_SHA`, since the image
 * has no .git), or the checkout's. Empty when none is known; the footer then says `dev`.
 */
function commitSha(): string {
  const fromEnvironment = process.env['VERCEL_GIT_COMMIT_SHA'] || process.env['GIT_COMMIT_SHA'];
  if (fromEnvironment) return fromEnvironment;
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}

export default defineConfig({
  plugins: [react()],
  define: { __COMMIT_SHA__: JSON.stringify(commitSha()) },
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  build: { rollupOptions: { output: { manualChunks: { three: ['three', 'three/addons/loaders/STLLoader.js', 'three/addons/controls/OrbitControls.js'] } } } },
});
