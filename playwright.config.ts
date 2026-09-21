import { defineConfig, devices } from "@playwright/test";
import { guardPlaywrightTarget } from "./tests/helpers/staging-guard";

guardPlaywrightTarget(process.env);

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://127.0.0.1:4173";
const useLocalServer = !process.env.PLAYWRIGHT_BASE_URL;

if (useLocalServer) {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_playwright_local_smoke";
}

const config = defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".playwright-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2, // Bound local image/browser contention as well as CI.
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL,
    // Only the loopback fixture uses a temporary self-signed certificate.
    ignoreHTTPSErrors: useLocalServer,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: useLocalServer
    ? {
        command: "npm run build && node tests/helpers/local-https-server.mjs",
        url: baseURL,
        ignoreHTTPSErrors: true,
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "desktop-chromium-1440",
      dependencies: ["auth-setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "desktop-chromium-1920",
      dependencies: ["auth-setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "desktop-firefox-1280",
      dependencies: ["auth-setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "desktop-webkit-1024",
      dependencies: ["auth-setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "tablet-chromium-768",
      dependencies: ["auth-setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "mobile-chromium-430",
      dependencies: ["auth-setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 430, height: 932 },
      },
    },
    {
      name: "mobile-webkit-390",
      dependencies: ["auth-setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["iPhone 13"],
      },
    },
    {
      name: "mobile-webkit-375",
      dependencies: ["auth-setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["iPhone SE"],
        viewport: { width: 375, height: 812 },
      },
    },
  ],
});

// Dedicated baseline/device cases are selected at collection time rather than
// reported as 26 redundant runtime skips on inapplicable projects.
for (const project of config.projects ?? []) {
  if (project.name === 'auth-setup') continue;
  const omitted = [];
  if (project.name !== 'desktop-chromium-1440') omitted.push('homepage desktop visual shell|pricing desktop visual shell');
  if (project.name !== 'mobile-webkit-390') omitted.push('homepage mobile visual shell');
  if (!project.name?.startsWith('mobile-')) omitted.push('mobile public menu opens closes');
  if (omitted.length) project.grepInvert = new RegExp(omitted.join('|'));
}
export default config;
