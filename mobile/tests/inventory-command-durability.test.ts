import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createOfflineQueue, createQueueLock, type OfflineOperation } from '../services/storage/offline-core.ts';
import { classifyInventoryCommandError, deliverInventoryCommand, readInventoryCommand, type InventoryCommand } from '../services/inventory-command.ts';
import { scannerIntentFingerprint, type ScannerConfirmation } from '../services/scanner-foundation.ts';

const type = 'collector_scanner_collection_add';
function command(id = 'intent-a'): InventoryCommand {
  return { version: 1, operationId: id, inventoryItemId: id, userId: 'owner', workspaceId: 'workspace', createdAt: '2026-09-24T00:00:00Z',
    endpoint: 'create_inventory_item_with_event', args: { p_idempotency_key: id, p_source: 'scanner', p_related_entity_type: 'scanner_confirmation', p_related_entity_id: id,
      p_inventory: { id, user_id: 'owner', workspace_id: 'workspace', quantity: 1, location_id: 'box-a', data: { scannerAddedAt: '2026-09-24T00:00:00Z', exactPrintingId: 'exact-printing' } } } };
}
function harness() {
  let raw = '[]', seq = 0, dropAck = false;
  const lock = createQueueLock();
  const storage = { getItem: async () => raw, setItem: async (_: string, value: string) => {
    if (dropAck && JSON.parse(value).some((r: OfflineOperation) => r.status === 'committed')) throw new Error('crash before local acknowledgement');
    raw = value;
  } };
  const fresh = () => createOfflineQueue({ storage, lock, newId: () => `claim-${++seq}`, runtimeId: `runtime-${++seq}` });
  let queue = fresh();
  const calls: InventoryCommand['args'][] = [], receipts = new Map<string, string>();
  const transport = { context: async () => ({ userId: 'owner', workspaceId: 'workspace' }), rpc: async (_: string, args: Record<string, unknown>) => {
    calls.push(JSON.parse(JSON.stringify(args)));
    const key = String(args.p_idempotency_key), serialized = JSON.stringify(args);
    if (receipts.has(key) && receipts.get(key) !== serialized) return { data: null, error: { code: '22023', message: 'INVENTORY_IDEMPOTENCY_CONFLICT' } };
    receipts.set(key, serialized);
    return { data: args.p_inventory, error: null };
  } };
  const process = (id: string, deliver = (op: OfflineOperation) => deliverInventoryCommand(op, transport)) => queue.process(id, 'owner', type,
    async op => { await deliver(op); }, { retrySafe: true, classify: classifyInventoryCommandError });
  const enqueue = (c = command()) => queue.enqueue(type, { command: c }, { userId: 'owner', operationId: c.operationId });
  return { get queue() { return queue; }, enqueue, process, calls, receipts, transport,
    restart() { queue = fresh(); }, failAcknowledgement(value: boolean) { dropAck = value; }, stored: () => JSON.parse(raw) as OfflineOperation[] };
}

test('persist-before-send and committed tombstone preserve original command', async () => {
  const h = harness(); await h.enqueue();
  await h.process('intent-a', async op => { assert.equal(h.stored()[0].status, 'processing'); assert.deepEqual(readInventoryCommand(op), command()); return deliverInventoryCommand(op, h.transport); });
  assert.equal(h.stored()[0].status, 'committed'); assert.equal((await h.queue.list()).length, 0);
  assert.equal(h.receipts.size, 1);
});
test('unsent operation survives force-close with exactly the same serialized payload', async () => {
  const h = harness(); await h.enqueue(); const before = h.stored()[0].payload;
  h.restart(); await h.process('intent-a'); assert.deepEqual(h.stored()[0].payload, before); assert.deepEqual(h.calls[0], command().args);
});
test('server commit / lost response / restart replays original command', async () => {
  const h = harness(); await h.enqueue();
  await h.process('intent-a', async op => { await deliverInventoryCommand(op, h.transport); throw new Error('response lost'); });
  assert.equal(h.stored()[0].status, 'retryable'); h.restart(); await h.process('intent-a');
  assert.equal(h.receipts.size, 1); assert.deepEqual(h.calls[0], h.calls[1]); assert.equal(h.stored()[0].status, 'committed');
});
test('crash after definitive result but before local ack recovers PROCESSING through same RPC', async () => {
  const h = harness(); await h.enqueue(); h.failAcknowledgement(true);
  await assert.rejects(h.process('intent-a'), /crash/); assert.equal(h.stored()[0].status, 'processing');
  h.restart(); h.failAcknowledgement(false); await h.process('intent-a'); assert.equal(h.receipts.size, 1); assert.deepEqual(h.calls[0], h.calls[1]);
});
test('UI edits cannot change the command even before asynchronous persistence finishes', async () => {
  const h = harness(), c = command(); const pending = h.enqueue(c);
  (c.args.p_inventory as Record<string, unknown>).quantity = 3;
  (c.args.p_inventory as Record<string, unknown>).location_id = 'box-b';
  await pending; await h.process('intent-a'); assert.deepEqual(h.calls[0], command().args);
});
test('conflict preserves original evidence, never rekeys, and remains review-required after restart', async () => {
  const h = harness(); h.receipts.set('intent-a', 'different committed request'); await h.enqueue(); await h.process('intent-a');
  h.restart(); await h.process('intent-a'); assert.equal(h.calls.length, 1); assert.equal(h.stored()[0].errorCode, 'IDEMPOTENCY_CONFLICT');
  assert.equal(h.stored()[0].id, 'intent-a'); assert.deepEqual(h.stored()[0].payload.command, command());
});
test('legacy confirmation-only entry is held without recognition or network', async () => {
  const h = harness(); await h.queue.enqueue(type, { confirmation: { name: 'unresolved' } }, { userId: 'owner', operationId: 'intent-a' });
  await h.process('intent-a'); h.restart(); await h.process('intent-a'); assert.equal(h.calls.length, 0); assert.equal(h.stored()[0].status, 'review_required');
});
test('permanent validation rejection is not retried after restart', async () => {
  const h = harness(); await h.enqueue(); let attempts = 0;
  await h.process('intent-a', async () => { attempts++; throw { code: 'P0002', message: 'Invalid location' }; });
  h.restart(); await h.process('intent-a'); assert.equal(attempts, 1); assert.equal(h.calls.length, 0); assert.equal(h.stored()[0].errorCode, 'VALIDATION_REJECTED');
});
test('reconnect and app-resume race use the same claim and payload', async () => {
  const h = harness(); await h.enqueue(); await Promise.all([h.process('intent-a'), h.process('intent-a')]);
  assert.equal(h.calls.length, 1); assert.equal(h.receipts.size, 1); assert.equal(h.stored()[0].status, 'committed');
});
test('partial batch restart does not regenerate successful A/C or failed B identity', async () => {
  const h = harness(); for (const id of ['a', 'b', 'c']) await h.enqueue(command(id));
  await h.process('a'); await h.process('b', async () => { throw new Error('offline'); }); await h.process('c');
  h.restart(); for (const id of ['a', 'b', 'c']) await h.process(id);
  assert.equal(h.receipts.size, 3); assert.deepEqual(h.calls.map(c => c.p_idempotency_key), ['a', 'c', 'b']);
});
test('prepare serializes duplicate initial taps and never rebuilds an existing command', async () => {
  const h = harness(); let resolved = 0;
  const prepare = () => h.queue.prepare(type, 'owner', 'intent-a', async () => { resolved++; return { payload: { command: command() } }; });
  const [a, b] = await Promise.all([prepare(), prepare()]); assert.deepEqual(a, b); assert.equal(resolved, 1);
  h.restart(); await prepare(); assert.equal(resolved, 1);
});
test('wrong workspace and anonymous context cannot send or acknowledge original command', async () => {
  for (const context of [{ userId: 'owner', workspaceId: 'other' }, { userId: '', workspaceId: 'workspace' }]) {
    const h = harness(); await h.enqueue(); await h.process('intent-a', op => deliverInventoryCommand(op, { ...h.transport, context: async () => context }));
    assert.equal(h.calls.length, 0); assert.equal(h.stored()[0].errorCode, 'AUTHORIZATION_FAILURE');
  }
});
test('HTTP success without matching authoritative row cannot acknowledge', async () => {
  const h = harness(); await h.enqueue(); await h.process('intent-a', op => deliverInventoryCommand(op, { ...h.transport, rpc: async () => ({ data: null, error: null }) }));
  assert.equal(h.stored()[0].status, 'review_required');
});
test('queue storage failure prevents transmission', async () => {
  const q = createOfflineQueue({ storage: { getItem: async () => null, setItem: async () => { throw new Error('disk full'); } }, lock: createQueueLock(), runtimeId: 'a', newId: () => 'id' });
  await assert.rejects(q.enqueue(type, { command: command() }, { userId: 'owner', operationId: 'intent-a' }), /disk full/);
});
test('review-required and discarded intents are retained across restart without automatic rekey', async () => {
  const h = harness(); await h.enqueue(); await h.queue.discard('intent-a', 'owner', type); h.restart(); await h.process('intent-a');
  assert.equal(h.calls.length, 0); assert.equal(h.stored()[0].errorCode, 'discarded_by_user');
  await assert.rejects(h.enqueue({ ...command(), args: { ...command().args, extra: true } }), /conflicts/);
});
test('all session save modes share stable session/line identity; replay contains no recognition or row-exists shortcut', () => {
  const session = readFileSync(new URL('../app/scanner-session.tsx', import.meta.url), 'utf8');
  const replay = readFileSync(new URL('../services/scanner-replay.ts', import.meta.url), 'utf8');
  assert.match(session, /operationId: `scanner:\$\{confirmedSession.id\}:\$\{line.id\}`/);
  assert.match(session, /inventoryCommandVersion === 1 && line.syncState === 'local_only'/);
  assert.match(session, /line.syncState === 'synced'\) continue/);
  assert.doesNotMatch(replay, /inventoryItemExists|validateScannerInventoryIdentity|buildScannerAddPayload|recognize\(/);
});

test('queued UI intent comparison ignores confidence/prices but detects every stock edit', () => {
  const c: ScannerConfirmation = { userId: 'owner', candidate: { id: 'printing', name: 'Test', gameId: 'magic', setCode: 'TST', setName: null, collectorNumber: '1', finishes: ['normal'], language: 'en', confidence: 1, recognitionMode: 'manual_search' }, quantity: 1, condition: 'near_mint', finish: 'normal', language: 'en', storageLocationId: 'box-a', addToWishlist: false, tradeStatus: 'not_for_trade' };
  assert.equal(scannerIntentFingerprint(c), scannerIntentFingerprint({ ...c, candidate: { ...c.candidate, confidence: .5 } }));
  for (const patch of [{ quantity: 3 }, { storageLocationId: 'box-b' }, { language: null }, { finish: 'foil' as const }, { candidate: { ...c.candidate, id: 'other-printing' } }]) {
    assert.notEqual(scannerIntentFingerprint(c), scannerIntentFingerprint({ ...c, ...patch }));
  }
});
