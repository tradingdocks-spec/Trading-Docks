import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/chaos-upload', workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4321', headless: true },
  webServer: { command: 'node tests/chaos-upload-preview.mjs', url: 'http://127.0.0.1:4321', reuseExistingServer: !process.env.CI, timeout: 120000 },
});
