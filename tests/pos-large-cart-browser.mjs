import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

export async function verifyLargeCartBrowser({ page, browser, a, admin, owner, workspace }) {
  const measurements = [];
  for (const count of [25, 100, 250, 500]) {
    // Each size is a separate burst below the unchanged 600/min scanner budget.
    await admin.query("delete from pos_private.request_limits where actor_id=$1 and bucket='search'", [owner]);
    const prefix = `UI-SCALE-${count}-`;
    await a.query(`insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price)
      select $1||i,$2,$3,'case','UI scale '||i,$1||i,3,1.01 from generate_series(0,$4-1) i`, [prefix, owner, workspace, count]);
    await page.goto('http://127.0.0.1:4199');
    await page.getByRole('button', { name: 'Open register', exact: true }).click();
    await expect(page.getByLabel('Scan barcode or search inventory')).toBeEnabled();
    await page.locator('h1').click();
    const started = performance.now();
    // Keyboard-wedge event simulation, not physical-scanner certification.
    await page.evaluate(({ count, prefix }) => {
      for (let i = 0; i < count; i++) for (const key of [...`${prefix}${i}`, 'Enter'])
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }, { count, prefix });
    await expect(page.getByLabel('Quantity', { exact: true })).toHaveCount(count, { timeout: 120000 });
    const constructMs = Math.round(performance.now() - started);
    await page.getByLabel('Cash received').fill((count * 1.10).toFixed(2));
    const checkoutStart = performance.now();
    await page.getByRole('button', { name: 'Complete cash sale', exact: true }).click();
    await expect(page.getByText(`Paid $${(count * 1.10).toFixed(2)} · Change $0.00`)).toBeVisible({ timeout: 30000 });
    const checkoutMs = Math.round(performance.now() - checkoutStart);
    const href = await page.getByRole('link', { name: 'Print receipt', exact: true }).getAttribute('href');
    const receipt = await browser.newPage();
    const receiptStart = performance.now();
    await receipt.goto(`http://127.0.0.1:4199${href}`);
    await expect(receipt.locator('tbody tr')).toHaveCount(count);
    const pdf = await receipt.pdf({ path: `.local-fixtures/phase7b-receipt-${count}.pdf`, preferCSSPageSize: true, printBackground: true });
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
    assert.ok(pages > 0 && pages < count / 2 + 5, `Unexpected pagination ${pages}`);
    const receiptMs = Math.round(performance.now() - receiptStart);
    await receipt.close();
    assert.equal((await admin.query('select count(*)::int n from inventory_items where id like $1 and quantity=2', [prefix + '%'])).rows[0].n, count);
    await page.getByRole('button', { name: 'New Sale', exact: true }).click();
    await page.getByRole('button', { name: 'Close register', exact: true }).click();
    await page.getByLabel('Counted cash').fill((count * 1.10).toFixed(2));
    await page.getByRole('button', { name: 'Confirm drawer close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open register', exact: true })).toBeVisible();
    measurements.push({ lines: count, constructMs, checkoutMs, receiptMs, receiptPages: pages, receiptBytes: pdf.length, status: 'PASS' });
  }
  writeFileSync('docs/pos-phase7b-large-cart-browser.json', JSON.stringify({ at: new Date().toISOString(), measurements }, null, 2));
}
