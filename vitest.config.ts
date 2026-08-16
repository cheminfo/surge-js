import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // browser/ holds the Playwright e2e spec, run by `npm run test-browser`.
    exclude: [...configDefaults.exclude, 'browser/**'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/wasm/data.ts', 'src/wasm/glue.ts'],
      provider: 'v8',
    },
    snapshotFormat: {
      maxOutputLength: Number.MAX_SAFE_INTEGER,
    },
  },
});
