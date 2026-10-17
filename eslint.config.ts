import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['packages/physics/src/wasm/**', '**/dist/**', '**/node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'packages/client/src/schema.d.ts'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }]
    }
  },
  {
    // The catio's pure domain: it takes every input explicitly, so that the planner's evaluation depends on the project alone. No
    // drawing, no UI, no browser globals and no saved settings; its tsconfig.json also leaves out the DOM library.
    files: ['packages/catio/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['three', 'three/*', 'react', 'react/*', 'react-dom', 'react-dom/*', 'lucide-react'], message: 'packages/catio is pure: draw and render in apps/web.' },
        { group: ['**/apps/**', '@canfactory/web', '@canfactory/web/*'], message: 'packages/catio must not depend on the web app.' },
      ] }],
      'no-restricted-globals': ['error', ...['localStorage', 'sessionStorage', 'indexedDB', 'window', 'document', 'navigator', 'location', 'fetch'].map(name => ({ name, message: 'packages/catio takes its inputs explicitly: resolve saved settings and browser state in apps/web.' }))],
    }
  }
);
