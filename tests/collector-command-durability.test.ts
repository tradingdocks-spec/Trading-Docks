import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createOfflineQueue, createQueueLock } from '../mobile/services/storage/offline-core.ts';
import { persistCollectorEdit, deliverCollectorEdit } from '../mobile/services/collector-inventory-command.ts';
import { COLLECTION_MUTATION_QUEUE_TYPE } from '../mobile/services/collector-mutations.ts';

function fixture() {
  let raw = '[]';
  const storage = { getItem: async () => raw, setItem: async (_: string, v: string) => { raw = v; } };
  const lock = createQueueLock();
  const fresh = () => createOfflineQueue({ storage, lock, runtimeId: randomUUID(), newId: randomUUID });
  return { fresh, rows: () => JSON.parse(raw) };
}
const context = { userId: 'owner', workspaceId: 'workspace' };
const edit = { type: 'quantity' as const, userId: 'owner', inventoryItemId: 'item', quantity: 3 };

test('generic edit persists before send, freezes payload and acknowledges a scoped receipt', async () => {
  const f = fixture(), queue = f.fresh(), id = randomUUID();
  await persistCollectorEdit(queue, edit, id, context);
  const requests: unknown[] = [];
  const transport = { context: async () => context, rpc: async (_: string, args: Record<string, unknown>) => {
    assert.equal(f.rows()[0].status, 'processing'); requests.push(structuredClone(args));
    return { data: { id: 'item', user_id: 'owner', workspace_id: 'workspace' }, error: null };
  } };
  assert.equal((await deliverCollectorEdit(queue, id, 'owner', transport)).committed, true);
  await deliverCollectorEdit(f.fresh(), id, 'owner', transport);
  assert.equal(requests.length, 1);
  await assert.rejects(persistCollectorEdit(queue, { ...edit, quantity: 9 }, id, context), /conflicts/);
});

test('lost response and app restart preserve generic edit operation identity and arguments', async () => {
  const f = fixture(), queue = f.fresh(), id = randomUUID();
  await persistCollectorEdit(queue, { type: 'storage', userId: 'owner', inventoryItemId: 'item', storageLocationId: 'box' }, id, context);
  let lost = true; const requests: unknown[] = [];
  const transport = { context: async () => context, rpc: async (_: string, args: Record<string, unknown>) => {
    requests.push(structuredClone(args)); if (lost) { lost = false; throw Error('response lost'); }
    return { data: { id: 'item', user_id: 'owner', workspace_id: 'workspace' }, error: null };
  } };
  assert.equal((await deliverCollectorEdit(queue, id, 'owner', transport)).committed, false);
  assert.equal((await deliverCollectorEdit(f.fresh(), id, 'owner', transport)).committed, true);
  assert.deepEqual(requests[0], requests[1]);
});

test('generic edit refuses ambiguous receipt, wrong workspace and server payload conflict', async () => {
  for (const failure of ['receipt', 'workspace', 'conflict']) {
    const f = fixture(), queue = f.fresh(), id = randomUUID();
    await persistCollectorEdit(queue, edit, id, context);
    await deliverCollectorEdit(queue, id, 'owner', {
      context: async () => ({ ...context, workspaceId: failure === 'workspace' ? 'other' : context.workspaceId }),
      rpc: async () => ({ data: null, error: failure === 'conflict' ? { code: '22023', message: 'INVENTORY_IDEMPOTENCY_CONFLICT' } : null }),
    });
    assert.equal((await queue.find(id, 'owner', COLLECTION_MUTATION_QUEUE_TYPE))?.status, 'review_required');
  }
});

test('generic edit local storage failure cannot reach transport', async () => {
  const queue = createOfflineQueue({ storage: { getItem: async () => '[]', setItem: async () => { throw Error('disk full'); } }, lock: createQueueLock(), runtimeId: 'r', newId: randomUUID });
  await assert.rejects(persistCollectorEdit(queue, edit, randomUUID(), context), /disk full/);
});
