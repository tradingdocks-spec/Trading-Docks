import checkStagingServer from './pos-staging-target-check.mjs';
import { chromium, webkit, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
await checkStagingServer();
const fixture = JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json', 'utf8'));
assert.equal(fixture.project, 'ukrcbmujzdyclrkghbvo');
const base = 'https://localhost:4173';
const role = process.argv.includes('--delegated') ? 'delegated' : 'owner';
let staffRegister, staffSession, ownerCommand;
if (role === 'delegated') {
  const keys = JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json', 'utf8').replace(/^\uFEFF/, ''));
  const owner = createClient(`https://${fixture.project}.supabase.co`, keys.find(k => k.name === 'anon').api_key, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await owner.auth.signInWithPassword(fixture.users.owner); assert.equal(login.error, null);
  ownerCommand = async (action, body) => { const r = await owner.rpc('pos_command', { p_workspace_id: fixture.workspace, p_action: action, p_body: { key: randomUUID(), ...body } }); if (r.error) throw Error(r.error.message); return r.data; };
  staffRegister = await ownerCommand('configure_register', { siteId: fixture.setup.siteId, name: `Employee browser ${Date.now()}` });
  staffSession = await ownerCommand('open', { registerId: staffRegister.id, openingMinor: 0 });
}
const channel = process.argv.includes('--edge') ? 'msedge' : process.argv.includes('--webkit') ? 'webkit' : 'chrome';
const browser = channel === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ channel, headless: true });
const results = [];
let page;
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, reducedMotion: 'reduce', viewport: { width: 1920, height: 1080 } });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith('.supabase.co') && url.hostname !== `${fixture.project}.supabase.co`) return route.abort();
    return route.continue();
  });
  page = await context.newPage();
  page.on('response', async response => {
    if (response.url().includes('/api/pos') && response.status() >= 400) console.log('POS response', response.status(), await response.text());
  });
  await page.goto(`${base}/sign-in`);
  await page.getByLabel(/email address/i).fill(fixture.users[role].email);
  await page.getByLabel(/^password$/i).fill(fixture.users[role].password);
  await page.getByRole('button', { name: /^sign in$/i }).focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 45000 });
  results.push({ name: 'Actual Next.js sign-in with hosted Supabase Auth', status: 'PASS' });
  await page.goto(`${base}/dashboard/pos`);
  await expect(page.getByRole('heading', { name: 'Current sale' })).toBeVisible({ timeout: 30000 });
  results.push({ name: 'Authenticated production Register screen using staging database', status: 'PASS' });
  if (staffRegister) await page.getByLabel('Register', { exact: true }).selectOption(staffRegister.id);
  else {
    await page.getByRole('button', { name: 'Open register', exact: true }).focus();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('button', { name: 'Close register', exact: true })).toBeVisible();
  await page.getByLabel('Scan barcode or search inventory').focus();
  await page.keyboard.type('P7-PERF-0', { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('1', { timeout: 15000 });
  await page.getByLabel('Cash received').focus();
  await page.keyboard.type('2.00');
  if (ownerCommand) {
    const grantBody = { siteId: fixture.setup.siteId, employeeId: fixture.users.delegated.id, capabilities: ['sell'] };
    const grant = await ownerCommand('grant', grantBody);
    await ownerCommand('revoke', { id: grant.id });
    try {
      await page.getByRole('button', { name: 'Complete cash sale', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'You do not have permission' })).toBeVisible();
      await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('1');
      results.push({ name: 'Owner revokes in independent hosted Auth session; existing employee browser cart is denied', status: 'PASS' });
    } finally { await ownerCommand('grant', grantBody); }
  }
  if (ownerCommand) {
    let loseResponse = true;
    await page.route('**/api/pos', async route => {
      if (loseResponse && route.request().method() === 'POST' && route.request().postDataJSON()?.action === 'checkout') {
        loseResponse = false;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await route.abort('connectionreset');
      } else await route.continue();
    });
  }
  await page.getByRole('button', { name: 'Complete cash sale', exact: true }).focus();
  await page.keyboard.press('Enter');
  if (ownerCommand) {
    await expect(page.getByText('Checkout needs confirmation')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Checkout needs confirmation')).toBeVisible();
    await page.getByRole('button', { name: 'Check checkout status', exact: true }).click();
    results.push({ name: 'Hosted cash response lost after commit; browser reload recovers original sale', status: 'PASS' });
  }
  await expect(page.getByText('Paid $1.09 · Change $0.91')).toBeVisible({ timeout: 15000 });
  const receipt = await page.getByRole('link', { name: 'Print receipt', exact: true }).getAttribute('href');
  if (ownerCommand) {
    const saleId = receipt.split('/').at(-2);
    const detail = await ownerCommand('receipt', { saleId });
    assert.equal(detail.receipt.actorId, fixture.users.delegated.id);
    assert.equal(detail.receipt.lines[0].ownerId, fixture.users.owner.id);
    results.push({ name: 'Delegated employee UI sale retains owner inventory and employee attribution', status: 'PASS' });
  }
  const receiptPage = await context.newPage();
  await receiptPage.goto(new URL(receipt, base).href);
  await expect(receiptPage.getByRole('button', { name: 'Print receipt', exact: true })).toBeVisible();
  if (channel !== 'webkit') await receiptPage.pdf({ path: '.local-fixtures/phase7-hosted-receipt.pdf', width: '80mm', printBackground: true });
  await receiptPage.close();
  await page.getByRole('button', { name: 'New Sale', exact: true }).focus();
  await page.keyboard.press('Enter');
  results.push({ name: 'Hosted keyboard-driven cash checkout, canonical receipt and new sale', status: 'PASS' });
  if (ownerCommand) {
    const reason = `Browser approval ${Date.now()}`;
    await page.getByLabel('Register', { exact: true }).selectOption(staffRegister.id);
    await page.getByLabel('Scan barcode or search inventory').fill('P7-PERF-0');
    await page.getByLabel('Scan barcode or search inventory').press('Enter');
    await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('1');
    await page.getByLabel('Discount %', { exact: true }).fill('50');
    await page.getByLabel('Discount reason').fill(reason);
    await page.getByLabel('Cash received').fill('2');
    await page.getByRole('button', { name: 'Complete cash sale', exact: true }).click();
    await expect(page.getByText('Checkout needs confirmation')).toBeVisible();
    await page.getByRole('button', { name: 'Request manager approval', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Approval requested', exact: true })).toBeVisible();
    const managerContext = await browser.newContext({ ignoreHTTPSErrors: true, reducedMotion: 'reduce', viewport: { width: 1366, height: 900 } });
    await managerContext.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname.endsWith('.supabase.co') && url.hostname !== `${fixture.project}.supabase.co`) return route.abort();
      return route.continue();
    });
    const manager = await managerContext.newPage();
    await manager.goto(`${base}/sign-in`);
    await manager.getByLabel(/email address/i).fill(fixture.users.manager.email);
    await manager.getByLabel(/^password$/i).fill(fixture.users.manager.password);
    await manager.getByRole('button', { name: /^sign in$/i }).press('Enter');
    await manager.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 45000 });
    await manager.goto(`${base}/dashboard/pos/registers`);
    const approval = manager.locator('article.pos-session').filter({ hasText: reason });
    await approval.getByRole('button', { name: 'Approve this request', exact: true }).click();
    await expect(approval.getByText('Approved', { exact: true })).toBeVisible();
    await manager.setViewportSize({ width: 375, height: 812 });
    assert.ok(await manager.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await manager.screenshot({ path: '.local-fixtures/phase7-mobile-management.png' });
    results.push({ name: 'Hosted manager register management at 375x812 without horizontal overflow', status: 'PASS' });
    await page.getByRole('button', { name: 'Retry original checkout', exact: true }).click();
    await expect(page.getByText('Paid $0.54 · Change $1.46')).toBeVisible();
    results.push({ name: 'Independent manager browser Auth approves employee discount; original checkout completes once', status: 'PASS' });
    await managerContext.close();
    await page.getByRole('button', { name: 'New Sale', exact: true }).click();
    await ownerCommand('close', { registerId: staffRegister.id, sessionId: staffSession.id, countedMinor: 163 });
  }
  else {
    await page.getByRole('button', { name: 'Close register', exact: true }).click();
    await page.getByLabel('Counted cash').fill('1.09');
    await page.getByRole('button', { name: 'Confirm drawer close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open register', exact: true })).toBeVisible();
  }
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `.local-fixtures/phase7-hosted-${viewport.width}.png`, fullPage: true });
    results.push({ name: `Hosted register layout ${viewport.width}x${viewport.height}`, status: 'PASS' });
  }
  for (const path of ['/api/pos', '/api/pos/payments', '/api/pos/payments/square', '/api/pos/payments/terminals']) {
    const denied = await context.request.post(`${base}${path}`, { headers: { origin: 'https://untrusted.example' }, data: { action: 'checkout' } });
    assert.equal(denied.status(), 403, path);
  }
  results.push({ name: 'Actual Next.js cross-origin POS mutation denied', status: 'PASS' });
  const anon = await browser.newContext({ ignoreHTTPSErrors: true });
  for (const path of ['/api/pos?action=bootstrap', '/api/pos/payments', '/api/pos/payments/square', '/api/pos/payments/terminals']) {
    const r = await anon.request.get(`${base}${path}`);
    assert.ok([401, 403].includes(r.status()), `${path}: ${r.status()}`);
  }
  results.push({ name: 'Actual Next.js anonymous POS/payment/Square/device APIs denied', status: 'PASS' });
} catch (error) { if (page) { await page.screenshot({ path: `.local-fixtures/phase7-browser-failure-${role}.png`, fullPage: true }); console.log((await page.locator('body').innerText()).slice(0,1800)); } results.push({ name: 'Hosted browser acceptance', status: 'FAIL', error: error.message }); process.exitCode = 1; }
finally { await browser.close(); writeFileSync(`docs/pos-phase7-hosted-browser-${channel}${role === 'delegated' ? '-delegated' : ''}.json`, JSON.stringify({ at: new Date().toISOString(), role, transport: 'Loopback HTTPS Next.js production build; real hosted staging Auth and database', results }, null, 2)); console.log(JSON.stringify(results, null, 2)); }
