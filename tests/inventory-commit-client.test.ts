import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestInventoryCommit } from '../src/lib/inventory-commit-client.ts';
import { executeInventoryCommit } from '../src/lib/inventory-commit.ts';

test('client accepts only an acknowledged successful commit', async (t) => {
  t.mock.method(globalThis,'fetch',async () => Response.json({ok:true,units:2}));
  assert.deepEqual(await requestInventoryCommit('/commit','POST',{}),{ok:true,units:2});
});

test('client surfaces a failed inventory transaction instead of success', async (t) => {
  t.mock.method(globalThis,'fetch',async () => Response.json({error:'Inventory deduction failed'}, {status:409}));
  await assert.rejects(requestInventoryCommit('/commit','PATCH',{}),/Inventory deduction failed/);
});

test('client rejects malformed success and an unacknowledged 200 response', async (t) => {
  t.mock.method(globalThis,'fetch',async () => Response.json({stage:'shipped'}));
  await assert.rejects(requestInventoryCommit('/commit','PATCH',{}),/could not be confirmed/);
});

test('lost response gives an explicit unknown outcome and preserves the retry payload', async (t) => {
  const payloads: string[] = [];
  t.mock.method(globalThis,'fetch',async (_url: unknown, options: RequestInit) => {
    payloads.push(String(options.body));
    if (payloads.length === 1) throw new TypeError('Network failed after commit');
    return Response.json({ok:true,duplicate:true});
  });
  const body = {rows:[{name:'Card',quantity:1}],locationName:'Box'};
  await assert.rejects(requestInventoryCommit('/commit','POST',body),/will not be applied twice/);
  assert.deepEqual(await requestInventoryCommit('/commit','POST',body),{ok:true,duplicate:true});
  assert.equal(payloads[0],payloads[1]);
});

test('missing migration fails closed with 503 and no fallback writes', async () => {
  let calls = 0;
  const client = {rpc:async () => {calls++;return {data:null,error:{code:'PGRST202',message:'Missing RPC'}};}};
  await assert.rejects(executeInventoryCommit(client,'commit_order_fulfillment',{}),
    (error: Error & {status?:number}) => error.status === 503 && /Nothing was committed/.test(error.message));
  assert.equal(calls,1);
});

test('a database response without its commit acknowledgment cannot be treated as success', async () => {
  await assert.rejects(executeInventoryCommit({rpc:async () => ({data:null,error:null})},'commit_csv_inventory_import',{}),/could not be confirmed/);
});
