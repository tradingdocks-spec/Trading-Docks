import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

export async function verifyMixedShift({ admin, a, command, workspace, owner, setup, check }) {
  await check('100 mixed cash/mock sales reconcile gross discounts tax refunds drawer and stock', async () => {
    const reg = await command(a, 'configure_register', { siteId: setup.siteId, name: 'Mixed shift acceptance' });
    const session = await command(a, 'open', { registerId: reg.id, openingMinor: 20000 });
    await a.query("insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price) values('shift-stock',$1,$2,'case','Shift stock','SHIFT',200,1)", [owner, workspace]);
    await admin.query('update pos_private.payment_test_config set enabled=true');
    const pay = async (action, body) => (await a.query('select pos_payment_command($1,$2,$3) result', [workspace, action, body])).rows[0].result;
    let cash = 0, card = 0, discount = 0, tax = 0;
    const sales = [];
    for (let i = 0; i < 100; i++) {
      const discounted = i % 4 === 0;
      const total = discounted ? 54 : 109;
      const intent = { key: randomUUID(), siteId: setup.siteId, sessionId: session.id, expectedMinor: total, cashMinor: 200, discountReason: discounted ? 'Acceptance markdown' : '', lines: [{ ownerId: owner, itemId: 'shift-stock', quantity: 1, discountBps: discounted ? 5000 : 0 }] };
      let sale;
      if (i % 2 === 0) { sale = await command(a, 'checkout', intent); cash += total; }
      else {
        const p = await pay('create', { key: randomUUID(), provider: 'MOCK', outcome: 'APPROVE', intent });
        await pay('dispatch', { id: p.id }); await pay('observe', { id: p.id });
        sale = await pay('finalize', { id: p.id }); card += total;
      }
      sales.push(sale.saleId); discount += discounted ? 50 : 0; tax += discounted ? 4 : 9;
    }
    assert.equal(new Set(sales).size, 100);
    const sums = (await admin.query('select count(*)::int count,sum(subtotal_minor)::int gross,sum(discount_minor)::int discount,sum(tax_minor)::int tax,sum(total_minor)::int total from pos_sales where id=any($1::uuid[])', [sales])).rows[0];
    assert.deepEqual(sums, { count: 100, gross: 10000, discount, tax, total: cash + card });
    const detail = await command(a, 'receipt', { saleId: sales[0] });
    await command(a, 'refund', { key: randomUUID(), saleId: sales[0], sessionId: session.id, expectedMinor: 54, reason: 'Acceptance return', lines: [{ saleItemId: detail.items[0].id, quantity: 1, returnInventory: true }] });
    const stock = (await admin.query("select quantity from inventory_items where user_id=$1 and id='shift-stock'", [owner])).rows[0].quantity;
    assert.equal(stock, 101);
    const close = await command(a, 'close', { registerId: reg.id, sessionId: session.id, countedMinor: 20000 + cash - 54 });
    assert.equal(Number(close.variance_minor), 0);
    assert.equal(Number(close.expected_minor), 20000 + cash - 54);
    console.log(JSON.stringify({ mixedShift: { sales: 100, cashSales: 50, mockSales: 50, gross: 10000, discount, tax, refund: 54, net: cash + card - 54, cash: cash - 54, card, drawer: 20000 + cash - 54, stock } }));
    const ledger = process.argv.includes('--enum-ledger') ? 'enum' : 'text';
    writeFileSync(`docs/pos-phase7-mixed-shift-${ledger}.json`, JSON.stringify({ ledger, at: new Date().toISOString(), status: 'PASS', amounts: 'integer USD cents', sales: 100, cashSales: 50, mockSales: 50, gross: 10000, discount, tax, refund: 54, net: cash + card - 54, cash: cash - 54, card, drawer: 20000 + cash - 54, initialStock: 200, sold: 100, returned: 1, endingStock: stock }, null, 2));
  });
}
