import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/print", testMatch: "chaos-sort-print.spec.ts", workers: 1, timeout: 30_000,
  use: { baseURL: "http://localhost:4187", viewport: { width: 1200, height: 900 } },
  projects: [{ name: "chrome-print", use: { channel: "chrome" } }, { name: "edge-print", use: { channel: "msedge" } }],
  webServer: { command: "node --experimental-strip-types tests/helpers/chaos-sort-print-server.mjs", url: "http://localhost:4187", reuseExistingServer: true },
});
