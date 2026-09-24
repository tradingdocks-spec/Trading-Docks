import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/scan-albums", workers: 1, timeout: 300_000,
  outputDir: ".playwright-results/scan-albums", reporter: "list",
  use: { baseURL: "http://127.0.0.1:4321", actionTimeout: 20_000, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure" },
  webServer: { command: "node tests/chaos-live-preview.mjs", env: { TD_CHAOS_TEST_PORT: "4321", NEXT_PUBLIC_SCANNER_BRIDGE_V1: "1", CHAOS_SCAN_ALBUMS_V2: "1" }, url: "http://127.0.0.1:4321", reuseExistingServer: false, timeout: 120_000 },
});
