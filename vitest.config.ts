import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    testTimeout: 15000,
    // better-sqlite3 is a native module; do not load separate database workers concurrently.
    fileParallelism: false,
  },
});
