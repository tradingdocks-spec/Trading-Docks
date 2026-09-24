import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/chaos-live", workers: 1, timeout: 120_000,
  outputDir: ".playwright-results/chaos-live", reporter: "list",
  use: { baseURL: "http://127.0.0.1:4322", viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure" },
  webServer: { command: "node tests/chaos-live-preview.mjs", env: { TD_CHAOS_TEST_PORT: "4322" }, url: "http://127.0.0.1:4322", reuseExistingServer: false, timeout: 120_000 },
});
