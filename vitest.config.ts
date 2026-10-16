import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'tools/**/*.test.ts'],
    testTimeout: 15000,
    // One real PostgreSQL and Garage for the storage tests (README.md, "Tests").
    globalSetup: ['tools/unit-storage.ts'],
    // The test files share that one database and truncate its queue: run them one at a time.
    fileParallelism: false,
  },
});
