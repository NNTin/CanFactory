import { resolve } from 'node:path';

/** Fingerprint changes invalidate cached geometry. Keep in sync with Dockerfile.worker. */
export const RENDERER_IMAGE = 'openscad/openscad:dev.2026-01-19@sha256:0af06bc2aa7a45d18b01a23cfb9dae6dddcd9542611e7be50edea6beb3b52fa7';
export const RENDERER_FINGERPRINT = `${RENDERER_IMAGE};Manifold;binstl;ROUNDNESS=48;OBJECT=flytrap`;
export const RENDER_TIMEOUT_MS = 120_000;
export const CACHE_TTL_MS = 3_600_000;
export const LEASE_MS = 30_000;
export const QUEUE_LIMIT = 16;

export function config() {
  return {
    projectRoot: resolve(process.env['PROJECT_ROOT'] ?? process.cwd()),
    dataDir: resolve(process.env['DATA_DIR'] ?? '.data'),
    port: Number(process.env['PORT'] ?? 3001),
  };
}
