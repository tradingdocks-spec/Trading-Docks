// Explicit staging-only checks. Fixture secrets stay in memory and never enter reports.
import { chromium, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = 'https://trading-docks-pos-staging.vercel.app';
const fixture = JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json', 'utf8'));
assert.equal(fixture.project, 'ukrcbmujzdyclrkghbvo');
const handoff = process.argv.includes('--owner-handoff');
if (handoff) {
  const owner = JSON.parse(readFileSync('.local-fixtures/pos-staging-owner.json', 'utf8'));
  assert.equal(owner.project, fixture.project);
  fixture.users.owner = { email: owner.email, password: owner.password };
}
const results = [];
let activePage;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const anonymous = await browser.newContext();
  const webhook = await anonymous.request.post(`${base}/api/payments/webhooks/square`, { data: {}, maxRedirects: 0 });
  assert.equal(webhook.status(), 403, 'Unsigned webhook must reach signature verification');
  results.push('Unsigned public webhook denied with 403');
  for (const path of ['/api/pos', '/api/pos/payments/square', '/api/pos/payments/square/callback']) {
    const response = await anonymous.request.get(base + path, { maxRedirects: 0 });
    assert.ok([401, 403].includes(response.status()), `Anonymous denial: ${path}, status ${response.status()}`);
  }
  results.push('Anonymous POS, Square settings and callback denied');
  await anonymous.close();
  for (const role of ['owner', 'manager']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    let wrongDatabase = false;
    await context.route('**/*', route => {
      const hostname = new URL(route.request().url()).hostname;
      if (hostname.endsWith('.supabase.co') && hostname !== `${fixture.project}.supabase.co`) {
        wrongDatabase = true;
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    activePage = page;
    await page.goto(base + '/sign-in');
    await page.getByLabel(/email address/i).fill(fixture.users[role].email);
    await page.getByLabel(/^password$/i).fill(fixture.users[role].password);
    await page.getByRole('button', { name: /^sign in$/i }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(url => url.pathname === '/dashboard', { timeout: 60000 });
    assert.equal(wrongDatabase, false, 'No production database requests');
    results.push(`${role}: hosted staging Auth login`);
    const request = context.request;
    const settings = await request.get(base + '/api/pos/payments/square');
    if (role === 'manager') {
      assert.equal(settings.status(), 403);
      results.push('Manager denied Square administration');
      await context.close();
      continue;
    }
    assert.equal(settings.status(), 200);
    assert.equal((await settings.json()).configured, true);
    await page.goto(base + '/dashboard/pos/payments');
    await expect(page.getByRole('button', { name: 'Connect Square Sandbox', exact: true })).toBeEnabled({ timeout: 30000 });
    await page.screenshot({ path: '.local-fixtures/pos-vercel-payments.png', fullPage: true });
    results.push('Owner Square settings render with Sandbox connect enabled');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Connect Square Sandbox', exact: true })).toBeVisible({ timeout: 30000 });
    const mobileBox = await page.locator('.pos-workspace').boundingBox();
    assert.ok(mobileBox && mobileBox.x < 32 && mobileBox.width >= 340, 'Mobile POS must use the available viewport width');
    await page.screenshot({ path: '.local-fixtures/pos-vercel-payments-mobile.png', fullPage: true });
    results.push('Square settings render at mobile width');
    const start = await request.post(base + '/api/pos/payments/square', { headers: { origin: base }, data: { action: 'connect' } });
    assert.equal(start.status(), 200, 'Approved Preview runtime must allow OAuth start');
    const authorization = new URL((await start.json()).url);
    assert.equal(authorization.origin, 'https://connect.squareupsandbox.com');
    assert.equal(authorization.searchParams.get('redirect_uri'), base + '/api/pos/payments/square/callback');
    assert.ok(authorization.searchParams.get('client_id').startsWith('sandbox-'));
    results.push('OAuth start persists one-time state and returns the real Sandbox authorization URL');
    const deniedUrl = base + '/api/pos/payments/square/callback?' + new URLSearchParams({ state: authorization.searchParams.get('state'), error: 'access_denied' });
    const denied = await request.get(deniedUrl, { maxRedirects: 0 });
    assert.equal(denied.status(), 303);
    assert.equal(new URL(denied.headers().location).searchParams.get('square'), 'denied');
    const replay = await request.get(deniedUrl, { maxRedirects: 0 });
    assert.equal(replay.status(), 303);
    assert.equal(new URL(replay.headers().location).searchParams.get('square'), 'failed');
    results.push('Emulated OAuth denial consumes state; replay fails on deployed staging');
    const capabilities = await request.get(base + '/api/pos/payments/capabilities');
    assert.equal(capabilities.status(), 200);
    assert.equal((await capabilities.json()).mockEnabled, false);
    results.push('Optimized Preview keeps mock payments disabled');
    await context.close();
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: '.local-fixtures/pos-vercel-smoke-failure.png', fullPage: true });
    console.error('Failure page:', new URL(activePage.url()).pathname);
    console.error('Visible alerts:', await activePage.getByRole('alert').allTextContents());
  }
  console.error('Staging smoke failure:', error instanceof assert.AssertionError ? error.message : error.name);
  process.exitCode = 1;
} finally {
  await browser.close();
  const report = { at: new Date().toISOString(), origin: base, database: fixture.project, status: process.exitCode ? 'FAIL' : 'PASS', checks: results, realSquareConsent: 'PENDING', authenticWebhook: 'PENDING' };
  writeFileSync(handoff ? 'docs/pos-vercel-owner-smoke.json' : 'docs/pos-vercel-staging-smoke.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

