import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'browser',
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:31230' },
  webServer: {
    command: 'node browser/serve.js',
    url: 'http://localhost:31230/surge-wasm.js',
    reuseExistingServer: false,
  },
});
