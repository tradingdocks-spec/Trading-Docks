import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["market-artwork.spec.ts", "market-preview.spec.ts"],
  workers: 1,
  timeout: 180_000,
  use: { baseURL: "http://localhost:4186", browserName: "chromium" },
  webServer: { command: "node node_modules/next/dist/bin/next start -p 4186", url: "http://localhost:4186", reuseExistingServer: true },
});
