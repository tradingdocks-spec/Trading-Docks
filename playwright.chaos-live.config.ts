import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/chaos-live", workers: 1, timeout: 120_000,
  outputDir: ".playwright-results/chaos-live", reporter: "list",
  use: { baseURL: "http://127.0.0.1:4320", viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure" },
  webServer: { command: "node tests/chaos-live-preview.mjs", url: "http://127.0.0.1:4320", reuseExistingServer: true, timeout: 120_000 },
});
