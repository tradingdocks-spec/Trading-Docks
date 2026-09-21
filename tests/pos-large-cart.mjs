import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

export async function verifyLargeCart({ admin, a, b, command, workspace, owner, setup, check }) {
  const measurements = [];
  const pay = async (action, body, client = a) => (await client.query('select pos_payment_command($1,$2,$3) result', [workspace, action, body])).rows[0].result;
  await admin.query('update pos_private.payment_test_config set enabled=true');
  for (const count of [25, 100, 250, 500]) await check(`${count} distinct lines reconcile quote/payment/atomic finalization/inventory/receipt`, async () => {
    const timing = {};
    const measure = async (name, fn) => { const t = performance.now(); const result = await fn(); timing[name] = Math.round(performance.now() - t); return result; };
    const prefix = `scale-${count}-`;
    const reg = await command(a, 'configure_register', { siteId: setup.siteId, name: `Scale ${count}` });
    const session = await command(a, 'open', { registerId: reg.id, openingMinor: 0 });
    await a.query(`insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price)
      select $1||lpad(i::text,4,'0'),$2,$3,'case','Scale card '||i,$1||i,3,(101+i%17)::numeric/100 from generate_series(0,$4-1) i`, [prefix, owner, workspace, count]);
    let subtotal = 0, discount = 0, tax = 0;
    const lines = Array.from({ length: count }, (_, i) => {
      const unit = 101 + i % 17, reduction = i % 3 === 0 ? Math.floor((unit * 1250 + 5000) / 10000) : 0;
      subtotal += unit; discount += reduction; tax += Math.floor(((unit - reduction) * 850 + 5000) / 10000);
      return { ownerId: owner, itemId: prefix + String(i).padStart(4, '0'), quantity: 1, discountBps: i % 3 === 0 ? 1250 : 0 };
    });
    const total = subtotal - discount + tax;
    const intent = { key: randomUUID(), siteId: setup.siteId, sessionId: session.id, expectedMinor: total, discountReason: 'Scale acceptance', lines };
    const quote = await measure('quoteMs', () => command(a, 'quote', intent));
    assert.equal(quote.totalMinor, total);
    if (count === 500) await assert.rejects(command(a, 'quote', { ...intent, lines: [...lines, { ...lines[0], itemId: '501st-line' }] }), /POS_INVALID/);
    const request = { key: randomUUID(), provider: 'MOCK', outcome: 'APPROVE', intent };
    const attempt = await measure('snapshotAndAttemptMs', () => pay('create', request));
    assert.equal(attempt.amountMinor, total);
    await pay('dispatch', { id: attempt.id }); await pay('observe', { id: attempt.id });
    if (count === 500) {
      // The 251st inventory update fails after earlier rows have been processed.
      await admin.query(`create function pos_private.scale_failure() returns trigger language plpgsql as $$ begin
        if new.id='scale-500-0250' then raise exception 'SCALE_INJECTED'; end if; return new; end $$;
        create trigger scale_failure before update on inventory_items for each row execute function pos_private.scale_failure()`);
      try {
        const failed = await pay('finalize', { id: attempt.id });
        assert.equal(failed.saleState, 'RECOVERY_REQUIRED');
        const partial = (await admin.query('select count(*)::int n from inventory_items where user_id=$1 and id like $2 and quantity<>3', [owner, prefix + '%'])).rows[0];
        assert.equal(partial.n, 0);
        assert.equal((await admin.query('select count(*)::int n from inventory_events where inventory_item_id like $1', [prefix + '%'])).rows[0].n, 0);
      } finally { await admin.query('drop trigger scale_failure on inventory_items; drop function pos_private.scale_failure()'); }
    }
    const pair = await measure('finalizeAndConcurrentRetryMs', () => Promise.all([pay('finalize', { id: attempt.id }), pay('finalize', { id: attempt.id }, b)]));
    assert.equal(pair[0].saleId, pair[1].saleId);
    assert.ok(pair[0].saleId);
    const receipt = await measure('receiptMs', () => command(a, 'receipt', { saleId: pair[0].saleId }));
    assert.equal(receipt.receipt.lines.length, count);
    assert.equal(receipt.receipt.totalMinor, total);
    const sale = (await admin.query('select subtotal_minor,discount_minor,tax_minor,total_minor from pos_sales where id=$1', [pair[0].saleId])).rows[0];
    assert.deepEqual(Object.values(sale).map(Number), [subtotal, discount, tax, total]);
    const stocks = (await admin.query('select quantity from inventory_items where user_id=$1 and id like $2', [owner, prefix + '%'])).rows;
    assert.equal(stocks.length, count); assert.ok(stocks.every(r => r.quantity === 2));
    const events = (await admin.query("select inventory_item_id,count(*)::int n from inventory_events where inventory_item_id like $1 and related_entity_type='pos_sale' group by inventory_item_id", [prefix + '%'])).rows;
    assert.equal(events.length, count); assert.ok(events.every(e => e.n === 1));
    const closed = await command(a, 'close', { registerId: reg.id, sessionId: session.id, countedMinor: 0 });
    assert.equal(Number(closed.variance_minor), 0);
    measurements.push({ lines: count, payloadBytes: Buffer.byteLength(JSON.stringify(request)), subtotal, discount, tax, total, ...timing, status: 'PASS', midFinalizationFailure: count === 500 ? 'PASS' : 'not injected' });
    if (count === 500) writeFileSync('.local-fixtures/phase7b-large-receipt.json', JSON.stringify(receipt.receipt));
  });
  writeFileSync(`docs/pos-phase7b-large-cart-${process.argv.includes('--enum-ledger') ? 'enum' : 'text'}.json`, JSON.stringify({ at: new Date().toISOString(), scope: 'Disposable real PostgreSQL; independent integer totals, canonical mock payment state machine and concurrent finalization', measurements }, null, 2));
}
