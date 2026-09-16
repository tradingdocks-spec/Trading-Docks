// Read-only failure injection: executes the real route with an in-memory database double.
// Run from the repository root: node .launch-audit/reproduce-fulfillment.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

const writes = [];
const supabase = {
  from(table) {
    let operation = 'select';
    let payload;
    const query = {
      select() { return query; },
      eq() { return query; },
      update(value) { operation = 'update'; payload = value; return query; },
      insert(value) { operation = 'insert'; payload = value; return query; },
      maybeSingle() { return query; },
      then(resolve, reject) {
        let result;
        if (operation !== 'select') {
          writes.push({ table, operation, payload });
          result = { data: null, error: table === 'inventory_items' ? { message: 'Injected inventory write failure' } : null };
        } else if (table === 'marketplace_orders') {
          result = { data: { id: 'order-a', fulfillment_stage: 'packed' }, error: null };
        } else if (table === 'marketplace_order_items') {
          result = { data: [{ id: 'line-a', title: 'Test card', quantity: 1, inventory_item_id: 'item-a', inventory_deducted_at: null }], error: null };
        } else {
          result = { data: { id: 'item-a', quantity: 2, card_name: 'Test card' }, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return query;
  },
};
const source = fs.readFileSync('src/app/api/orders/fulfillment/route.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports, crypto: globalThis.crypto,
  require(name) {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } };
    if (name === '@/lib/platform/server-access') return { requireApiCapability: async () => ({ ok: true, supabase, user: { id: 'user-a' } }) };
    throw new Error(`Unexpected dependency: ${name}`);
  },
});
const response = await exports.PATCH(new Request('http://audit.invalid/api/orders/fulfillment', {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: 'order-a', action: 'ship' }),
}));
const body = await response.json();
assert.equal(response.status, 200);
assert.equal(body.stage, 'shipped');
assert.ok(writes.some(entry => entry.table === 'marketplace_order_items' && entry.payload.inventory_deducted_at));
console.log(JSON.stringify({ reproduced: true, injectedFailure: 'inventory_items UPDATE', actualStatus: response.status, actualBody: body, lineMarkedDeductedDespiteFailure: true, expected: 'Reject shipping and roll back all writes', limitation: 'Route-level database double; no real database or production mutation' }, null, 2));
