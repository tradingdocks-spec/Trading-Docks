import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { expect } from '@playwright/test';

export async function verifyMixedShiftBrowser({ page, admin, a, command, owner, workspace, setup, reg, priorSession }) {
  await command(a, 'close', { registerId: reg.id, sessionId: priorSession.id });
  const session = await command(a, 'open', { registerId: reg.id, openingMinor: 20000 });
  const batches = [randomUUID(), randomUUID()];
  await a.query("insert into inventory_locations(id,user_id,name) values('shift-second-case',$1,'Shift second case')", [owner]);
  await admin.query("insert into pos_location_inventory_locations(workspace_id,site_id,inventory_user_id,location_id) values($1,$2,$3,'shift-second-case')", [workspace, setup.siteId, owner]);
  for (let index = 0; index < 2; index++) await admin.query('insert into chaos_sort_batches(id,user_id,batch_code,current_quantity,initial_quantity) values($1,$2,$3,100,100)', [batches[index], owner, `MIXED-${index}`]);
  for (let i = 0; i < 10; i++) {
    const location = i % 2 ? 'shift-second-case' : 'case';
    await a.query('insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price) values($1,$2,$3,$4,$1,$1,20,1)', [`UI-MIX-${i}`, owner, workspace, location]);
    await a.query('insert into chaos_sort_inventory_positions(id,user_id,batch_id,item_id,quantity,location_id) values($1,$2,$3,$4,20,$5)', [`mixed-position-${i}`, owner, batches[i % 2], `UI-MIX-${i}`, location]);
  }
  await page.goto('http://127.0.0.1:4204');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const samples = [], latencies = [];
  const sample = async completed => {
    await cdp.send('HeapProfiler.collectGarbage');
    const metrics = await cdp.send('Performance.getMetrics');
    samples.push({ completed, liveElements: await page.evaluate(() => document.querySelectorAll('*').length), heapBytes: metrics.metrics.find(m => m.name === 'JSHeapUsedSize').value, ...(await cdp.send('Memory.getDOMCounters')) });
  };
  for (let i = 0; i < 100; i++) {
    if (i % 25 === 0) await sample(i);
    const start = performance.now();
    await page.getByLabel('Scan barcode or search inventory').fill(`UI-MIX-${i % 10}`);
    await page.getByLabel('Scan barcode or search inventory').press('Enter');
    await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('1');
    if (i % 4 === 0) {
      await page.getByLabel('Discount %', { exact: true }).fill('50');
      await page.getByLabel('Discount reason').fill('Mixed shift markdown');
    }
    await page.getByLabel('Payment method', { exact: true }).selectOption(i % 2 ? 'MOCK' : 'CASH');
    if (i % 2) {
      await page.getByRole('button', { name: 'Pay with Mock Card', exact: true }).click();
      await expect(page.getByText('Payment Complete', { exact: true })).toBeVisible();
    } else {
      await page.getByLabel('Cash received').fill('2');
      await page.getByRole('button', { name: 'Complete cash sale', exact: true }).click();
      await expect(page.getByText(i % 4 === 0 ? 'Paid $0.54 · Change $1.46' : 'Paid $1.09 · Change $0.91')).toBeVisible();
    }
    await page.getByRole('button', { name: 'New Sale', exact: true }).click();
    latencies.push(Math.round(performance.now() - start));
    await page.waitForTimeout(1100);
  }
  await sample(100);
  const sales = (await admin.query('select id,subtotal_minor,discount_minor,tax_minor,total_minor from pos_sales where session_id=$1 order by created_at,id', [session.id])).rows;
  assert.equal(sales.length, 100);
  const sums = key => sales.reduce((n, s) => n + Number(s[key]), 0);
  assert.equal(sums('subtotal_minor'), 10000); assert.equal(sums('discount_minor'), 1250); assert.equal(sums('tax_minor'), 775); assert.equal(sums('total_minor'), 9525);
  await page.goto(`http://127.0.0.1:4204?mode=refund&saleId=${sales[0].id}`);
  await page.getByLabel('Processing drawer').selectOption(session.id);
  await page.getByRole('spinbutton').fill('1');
  await page.getByLabel('Inventory decision').selectOption('true');
  await page.getByLabel('Notes', { exact: true }).fill('Mixed shift return');
  await page.getByRole('button', { name: 'Record cash refund', exact: true }).click();
  await expect(page.getByText('Refund recorded.', { exact: false })).toBeVisible();
  const stocks = (await admin.query("select id,quantity,location_id from inventory_items where user_id=$1 and id like 'UI-MIX-%' order by id", [owner])).rows;
  assert.equal(stocks.length, 10);
  for (let i = 0; i < 10; i++) assert.equal(stocks[i].quantity, i === 0 ? 11 : 10);
  const positions = (await admin.query("select id,quantity,location_id from chaos_sort_inventory_positions where user_id=$1 and id like 'mixed-position-%' order by id", [owner])).rows;
  for (let i = 0; i < 10; i++) { assert.equal(positions[i].quantity, stocks[i].quantity); assert.equal(positions[i].location_id, stocks[i].location_id); }
  for (let i = 0; i < 2; i++) assert.equal(Number((await admin.query('select current_quantity from chaos_sort_batches where id=$1', [batches[i]])).rows[0].current_quantity), i ? 50 : 51);
  const cash = Number((await admin.query("select sum(amount_minor) n from pos_cash_events where session_id=$1 and kind in ('CASH_SALE','CASH_REFUND')", [session.id])).rows[0].n);
  assert.equal(cash, 4021);
  const closed = await command(a, 'close', { registerId: reg.id, sessionId: session.id, countedMinor: 24021 });
  assert.equal(Number(closed.variance_minor), 0);
  assert.ok(samples.at(-1).liveElements <= samples[1].liveElements + 8);
  assert.ok(samples.at(-1).jsEventListeners <= samples[1].jsEventListeners + 10);
  assert.ok(samples.at(-1).heapBytes < samples[1].heapBytes * 2 + 5_000_000);
  const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];
  assert.ok(median(latencies.slice(-25)) < median(latencies.slice(0,25)) * 3 + 500);
  writeFileSync('docs/pos-phase7b-mixed-browser-shift.json', JSON.stringify({ status: 'PASS', transactions: 100, cashSales: 50, mockSales: 50, gross: 10000, discount: 1250, tax: 775, refunds: 54, net: 9471, cash: 4021, card: 5450, drawer: 24021, startingStock: 200, sold: 100, returned: 1, endingStock: 101, positions: 10, batches: 2, locations: 2, samples, latencies }, null, 2));
}
