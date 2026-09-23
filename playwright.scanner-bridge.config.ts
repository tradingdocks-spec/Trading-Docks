import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/scanner-bridge", workers: 1, timeout: 180_000,
  outputDir: ".playwright-results/scanner-bridge", reporter: "list",
  use: { baseURL: "http://127.0.0.1:4320", actionTimeout: 15_000, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure" },
  webServer: { command: "node tests/chaos-live-preview.mjs", env: { NEXT_PUBLIC_SCANNER_BRIDGE_V1: "1" }, url: "http://127.0.0.1:4320", reuseExistingServer: false, timeout: 120_000 },
});
