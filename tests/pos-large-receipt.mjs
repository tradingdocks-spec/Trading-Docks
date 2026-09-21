import { chromium, webkit } from '@playwright/test';
import { renderReceipt } from '../src/lib/pos/receipt.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const receipt = JSON.parse(readFileSync('.local-fixtures/phase7b-large-receipt.json', 'utf8'));
assert.equal(receipt.lines.length, 500);
const results = [];
for (const channel of ['chrome', 'msedge', 'webkit']) {
  const browser = channel === 'webkit' ? await webkit.launch() : await chromium.launch({ channel });
  try {
    const page = await browser.newPage();
    for (const width of ['80', 'Letter']) {
      await page.setContent(renderReceipt({ ...receipt, settings: { ...receipt.settings, receiptWidth: width } }));
      await page.emulateMedia({ media: 'print' });
      await page.evaluate(() => { window.dispatchEvent(new Event('beforeprint')); });
      assert.equal(await page.locator('tbody tr').count(), 500);
      assert.ok((await page.locator('body').innerText()).includes(receipt.lines[499].name));
      let pages;
      if (channel !== 'webkit') {
        const pdf = await page.pdf({ path: `.local-fixtures/phase7b-large-${channel}-${width}.pdf`, preferCSSPageSize: true, printBackground: true });
        pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length;
        assert.ok(pages > 0 && pages < 60);
      }
      await page.screenshot({ path: `.local-fixtures/phase7b-large-${channel}-${width}.png` });
      results.push({ channel, width, lines: 500, pages, status: 'PASS', scope: channel === 'webkit' ? 'Print CSS browser rendering; no PDF API' : 'Print CSS and PDF pagination' });
    }
  } finally { await browser.close(); }
}
writeFileSync('docs/pos-phase7b-large-receipts.json', JSON.stringify(results, null, 2));
console.log('PASS six large-receipt browser/format checks');
