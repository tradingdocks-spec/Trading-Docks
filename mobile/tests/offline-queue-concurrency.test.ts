import assert from 'node:assert/strict';
import test from 'node:test';
import { createOfflineQueue, createQueueLock, OFFLINE_QUEUE_KEY, type OfflineOperation, type QueueDiagnostic } from '../services/storage/offline-core.ts';

function deferred() { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; }
function harness(raw = '[]') {
  let persisted = raw; let sequence = 0; let failWrite = false;
  const lock = createQueueLock(); const diagnostics: QueueDiagnostic[] = [];
  const storage = { getItem: async () => persisted, setItem: async (_key: string, value: string) => { if (failWrite) throw Error('disk unavailable'); persisted = value; } };
  const create = (runtimeId = 'runtime-1') => createOfflineQueue({ storage, lock, runtimeId, newId: () => `id-${++sequence}`, diagnostic: (value) => diagnostics.push(value) });
  const queue = create();
  const enqueue = (id: string, type = 'scanner') => queue.enqueue(type, { quantity: 1 }, { userId: 'owner', operationId: id });
  return { queue, create, enqueue, diagnostics, raw: () => persisted, failWrites: (value: boolean) => { failWrite = value; } };
}
const safe = { retrySafe: true };

for (const ids of [['B'], ['B', 'C', 'D'], Array.from({ length: 50 }, (_, index) => `rapid-${index}`)]) {
  test(`enqueue during replay retains all ${ids.length} new operations`, async () => {
    const h = harness(); await h.enqueue('A'); const entered = deferred(), reply = deferred();
    const replay = h.queue.process('A', 'owner', 'scanner', async () => { entered.resolve(); await reply.promise; }, safe);
    await entered.promise; await Promise.all(ids.map((id) => h.enqueue(id))); reply.resolve();
    assert.equal((await replay).status, 'committed');
    assert.deepEqual((await h.queue.list()).map((row) => row.id), ids);
  });
}
test('failed A updates only A and retains new B', async () => {
  const h = harness(); await h.enqueue('A');
  await h.queue.process('A', 'owner', 'scanner', async () => { await h.enqueue('B'); throw Error('timeout'); }, safe);
  const rows = await h.queue.list(); assert.deepEqual(rows.map((r) => r.id), ['A', 'B']);
  assert.equal(rows[0].status, 'retryable'); assert.equal(rows[0].attempts, 1); assert.equal(rows[1].attempts, 0);
});
test('two replay coordinators share a claim and only one handler commits', async () => {
  const h = harness(); const other = h.create('runtime-2'); await h.enqueue('A'); let writes = 0;
  const results = await Promise.all([h.queue, other].map((q) => q.process('A', 'owner', 'scanner', async () => { writes++; }, safe)));
  assert.equal(writes, 1); assert.deepEqual(results.map((r) => r.status), ['committed', 'skipped']);
});
test('server commit then timeout retries the same operation identity', async () => {
  const h = harness(); await h.enqueue('A'); const ledger = new Map<string, number>(); let deliveries = 0;
  const server = async (row: OfflineOperation) => { deliveries++; if (!ledger.has(row.id)) ledger.set(row.id, Number(row.payload.quantity)); if (deliveries === 1) throw Error('reply lost'); };
  await h.queue.process('A', 'owner', 'scanner', server, safe);
  assert.equal((await h.queue.list())[0].id, 'A');
  await h.create('restarted').process('A', 'owner', 'scanner', server, safe);
  assert.equal(deliveries, 2); assert.equal(ledger.size, 1); assert.equal(ledger.get('A'), 1);
  assert.deepEqual(await h.queue.list(), []);
});
test('restart preserves pending and recovers safe processing work', async () => {
  const h = harness(); await h.enqueue('pending');
  const rows = JSON.parse(h.raw()); rows.push({ ...rows[0], id: 'interrupted', status: 'processing', claimId: 'old', runtimeId: 'old', attempts: 1 });
  const restarted = harness(JSON.stringify(rows));
  assert.equal((await restarted.queue.list()).length, 2);
  let id = ''; await restarted.queue.process('interrupted', 'owner', 'scanner', async (row) => { id = row.id; }, safe);
  assert.equal(id, 'interrupted'); assert.deepEqual((await restarted.queue.list()).map((r) => r.id), ['pending']);
  assert.ok(restarted.diagnostics.some((d) => d.event === 'restart_recovery'));
});
test('unsafe interrupted or failed writes require reconciliation, never blind replay', async () => {
  const h = harness(); await h.enqueue('A'); let writes = 0;
  await h.queue.process('A', 'owner', 'scanner', async () => { writes++; throw Error('unknown response'); }, { retrySafe: false });
  await h.queue.process('A', 'owner', 'scanner', async () => { writes++; }, { retrySafe: false });
  assert.equal(writes, 1); assert.equal((await h.queue.list())[0].status, 'review_required');
  const rows = JSON.parse(h.raw()); rows[0].status = 'processing';
  const restarted = harness(JSON.stringify(rows));
  await restarted.queue.process('A', 'owner', 'scanner', async () => { writes++; }, { retrySafe: false });
  assert.equal(writes, 1); assert.equal((await restarted.queue.list())[0].errorCode, 'uncertain_commit');
});
test('poison record is retained and does not prevent B completing', async () => {
  const h = harness('[null]'); await h.enqueue('B');
  await h.queue.process('B', 'owner', 'scanner', async () => {}, safe);
  const remaining = await h.queue.list(); assert.equal(remaining.length, 1); assert.equal(remaining[0].status, 'review_required');
  assert.deepEqual(remaining[0].payload, { preserved: null });
  await h.enqueue('C'); assert.deepEqual((await h.queue.list())[0].payload, { preserved: null });
});
test('cross-type enqueue and out-of-order completion affect only claimed items', async () => {
  const h = harness(); await h.enqueue('A'); const entered = deferred(), reply = deferred();
  const a = h.queue.process('A', 'owner', 'scanner', async () => { entered.resolve(); await reply.promise; }, safe);
  await entered.promise; await h.enqueue('B', 'location'); await h.enqueue('C', 'wishlist');
  await h.queue.process('B', 'owner', 'location', async () => {}, safe);
  assert.deepEqual((await h.queue.list()).map((r) => r.id), ['A', 'C']); reply.resolve(); await a;
  assert.deepEqual((await h.queue.list()).map((r) => r.id), ['C']);
});
test('failed claim persistence sends no request; failed completion persistence remains recoverable', async () => {
  const h = harness(); await h.enqueue('A'); let writes = 0; h.failWrites(true);
  await assert.rejects(h.queue.process('A', 'owner', 'scanner', async () => { writes++; }, safe)); assert.equal(writes, 0);
  h.failWrites(false);
  await assert.rejects(h.queue.process('A', 'owner', 'scanner', async () => { writes++; h.failWrites(true); }, safe));
  assert.equal(JSON.parse(h.raw())[0].status, 'processing'); h.failWrites(false);
  assert.equal((await h.create('restart').list())[0].id, 'A');
});
test('duplicate enqueue preserves identity and claim; conflicting payload fails closed', async () => {
  const h = harness(); await h.enqueue('A');
  await assert.rejects(h.queue.enqueue('scanner', { quantity: 2 }, { userId: 'owner', operationId: 'A' }));
  await h.queue.process('A', 'owner', 'scanner', async (claimed) => {
    const duplicate = await h.enqueue('A'); assert.equal(duplicate.claimId, claimed.claimId);
    assert.equal(await h.queue.discard('A', 'owner', 'scanner'), false);
  }, safe);
  await h.enqueue('A'); assert.deepEqual(await h.queue.list(), []);
});
test('malformed root JSON is never overwritten or cleared', async () => {
  const h = harness('{broken'); await assert.rejects(h.queue.list()); await assert.rejects(h.enqueue('A')); assert.equal(h.raw(), '{broken');
});
test('legacy unknown outcomes are preserved for review, not automatically delivered', async () => {
  const h = harness(JSON.stringify([{ id: 'legacy', type: 'scanner', payload: {}, userId: 'owner', createdAt: 'old' }]));
  assert.equal((await h.queue.list())[0].status, 'review_required');
  await h.queue.process('legacy', 'owner', 'scanner', async () => { assert.fail('must not replay'); }, safe);
  assert.equal((await h.queue.list())[0].id, 'legacy');
});
test('diagnostics exclude payloads, user IDs and raw failure messages', async () => {
  const h = harness(); await h.queue.enqueue('scanner', { token: 'DO_NOT_LOG' }, { userId: 'private-user', operationId: 'A' });
  await h.queue.process('A', 'private-user', 'scanner', async () => { throw Error('DO_NOT_LOG'); }, safe);
  const output = JSON.stringify(h.diagnostics); assert.equal(output.includes('DO_NOT_LOG'), false); assert.equal(output.includes('private-user'), false);
  assert.ok(h.diagnostics.some((d) => d.event === 'replay_failure'));
  assert.equal(OFFLINE_QUEUE_KEY, 'td-offline-operation-queue-v1');
});
