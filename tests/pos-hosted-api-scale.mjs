import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import checkStagingServer from './pos-staging-target-check.mjs';
await checkStagingServer();
const fixture = JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json', 'utf8'));
assert.equal(fixture.project, 'ukrcbmujzdyclrkghbvo');
const base = 'https://localhost:4173';
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${base}/sign-in`);
  await page.getByLabel(/email address/i).fill(fixture.users.owner.email);
  await page.getByLabel(/^password$/i).fill(fixture.users.owner.password);
  await page.getByRole('button', { name: /^sign in$/i }).focus(); await page.keyboard.press('Enter');
  await page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 45000 });
  const request = data => context.request.post(`${base}/api/pos`, { headers: { origin: base }, data });
  const command = async (action, body) => { const response = await request({ action, key: randomUUID(), ...body }); assert.equal(response.status(), 200, `${action}: ${await response.text()}`); return response.json(); };
  const reg = await command('configure_register', { siteId: fixture.setup.siteId, name: `HTTP 500 ${Date.now()}` });
  const session = await command('open', { registerId: reg.id, openingMinor: 0 });
  const lines = Array.from({ length: 500 }, (_, i) => ({ itemId: `${fixture.prefix}-perf-${i}`, ownerId: fixture.users.owner.id, quantity: 1 }));
  const intent = { siteId: fixture.setup.siteId, sessionId: session.id, lines };
  const bytes = Buffer.byteLength(JSON.stringify(intent)); assert.ok(bytes > 32768 && bytes < 262144);
  let start = performance.now();
  const quote = await command('quote', intent); assert.equal(quote.totalMinor, 54500);
  results.push({ name: '500-line authenticated Next HTTP quote above former 32 KiB limit', bytes, ms: Math.round(performance.now()-start), status: 'PASS' });
  const tooMany = await request({ action: 'quote', ...intent, lines: [...lines, lines[0]] }); assert.equal(tooMany.status(), 409); assert.equal((await tooMany.json()).code, 'POS_INVALID');
  const tooLarge = await request({ action: 'quote', padding: 'x'.repeat(262145) }); assert.equal(tooLarge.status(), 413);
  results.push({ name: '501 lines and oversized streamed HTTP body rejected', status: 'PASS' });
  start = performance.now();
  const sale = await command('checkout', { ...intent, expectedMinor: 54500, cashMinor: 54500 });
  const receipt = await context.request.get(`${base}/api/pos?action=receipt&saleId=${sale.saleId}`); assert.equal(receipt.status(),200); const detail = await receipt.json();
  assert.equal(detail.receipt.lines.length,500); assert.equal(detail.receipt.totalMinor,54500);
  await command('close',{registerId:reg.id,sessionId:session.id,countedMinor:54500});
  results.push({ name:'500-line Next HTTP checkout, complete canonical receipt and exact drawer close', ms:Math.round(performance.now()-start),status:'PASS'});
  const managerGrantBody = { siteId: fixture.setup.siteId, employeeId: fixture.users.manager.id, capabilities: ['sell'] };
  const managerGrant = await command('grant', managerGrantBody);
  await command('revoke', { id: managerGrant.id });
  try {
  for (const role of ['nondelegated', 'manager', 'other']) {
    const staffContext = await browser.newContext({ ignoreHTTPSErrors: true, reducedMotion: 'reduce' });
    const staff = await staffContext.newPage();
    await staff.goto(`${base}/sign-in`);
    await staff.getByLabel(/email address/i).fill(fixture.users[role].email);
    await staff.getByLabel(/^password$/i).fill(fixture.users[role].password);
    await staff.getByRole('button', { name: /^sign in$/i }).focus(); await staff.keyboard.press('Enter');
    await staff.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 45000 });
    for (const action of ['quote', 'checkout']) {
      const response = await staffContext.request.post(`${base}/api/pos`, { headers: { origin: base }, data: { action, key: randomUUID(), ...intent, expectedMinor: 54500, cashMinor: 54500 } });
      assert.equal(response.status(), 403, `${role} ${action}`);
    }
    const search = await staffContext.request.get(`${base}/api/pos?action=search&siteId=${fixture.setup.siteId}&query=P7-PERF-0&exact=true`);
    assert.equal(search.status(), 403, `${role} barcode`);
    results.push({ name: `${role} actual Next API barcode/quote/checkout denied for owner inventory`, status: 'PASS' });
    await staffContext.close();
  }
  } finally { await command('grant', managerGrantBody); await context.close(); }
} finally { await browser.close(); writeFileSync('docs/pos-phase7b-hosted-http-scale.json',JSON.stringify({results},null,2)); }
console.log('PASS hosted Next HTTP cart-scale boundaries and checkout');
