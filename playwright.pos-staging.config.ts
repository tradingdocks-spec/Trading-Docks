import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';

// This separate suite only accepts our verified isolated fixture and loopback
// server. It does not relax the public suite's remote deployment guard.
const fixture = JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json', 'utf8'));
if (fixture.project !== 'ukrcbmujzdyclrkghbvo') throw Error('Verified isolated staging fixture required');
process.env.PLAYWRIGHT_BASE_URL = 'https://localhost:4173';
process.env.PLAYWRIGHT_AUTH_EMAIL = fixture.users.owner.email;
process.env.PLAYWRIGHT_AUTH_PASSWORD = fixture.users.owner.password;
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /auth\.setup\.ts|dashboard-auth\.spec\.ts/,
  outputDir: '.local-fixtures/phase7b-hosted-browser-results',
  globalSetup: './tests/pos-staging-target-check.mjs',
  workers: 1,
  timeout: 90000,
  reporter: [['list'], ['json', { outputFile: '.local-fixtures/phase7b-hosted-dashboard.json' }]],
  use: { baseURL: 'https://localhost:4173', ignoreHTTPSErrors: true, contextOptions: { reducedMotion: 'reduce' }, trace: 'off', video: 'off', screenshot: 'only-on-failure' },
  projects: [
    { name: 'auth-setup', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
    ...[
      ['desktop-chromium-1440','Desktop Chrome',1440,900],
      ['desktop-chromium-1920','Desktop Chrome',1920,1080],
      ['desktop-firefox-1280','Desktop Firefox',1280,800],
      ['desktop-webkit-1024','Desktop Safari',1024,768],
      ['tablet-chromium-768','Desktop Chrome',768,1024],
      ['mobile-chromium-430','Pixel 7',430,932],
      ['mobile-webkit-390','iPhone 13',390,844],
      ['mobile-webkit-375','iPhone SE',375,812],
    ].map(([name, device, width, height]) => ({
      name: String(name), dependencies: ['auth-setup'], testMatch: /dashboard-auth\.spec\.ts/,
      grepInvert: new RegExp([
        ...(name === 'desktop-chromium-1440' ? [] : ['Settings Data', 'navigation exposes expected', 'authenticated session survives']),
        ...(['desktop-chromium-1440', 'tablet-chromium-768', 'mobile-chromium-430'].includes(String(name)) ? [] : ['route renders for representative']),
        ...(String(name).startsWith('mobile-') ? [] : ['mobile dashboard drawer']),
      ].join('|') || '(?!)'),
      use: { ...devices[String(device)], viewport: { width: Number(width), height: Number(height) } },
    })),
  ],
});
