import type { CollectorMutation } from './collector-mutations.ts';
import { COLLECTION_MUTATION_QUEUE_TYPE } from './collector-mutations.ts';
import { classifyInventoryCommandError, deliverInventoryCommand, type InventoryCommand } from './inventory-command.ts';
import type { OfflineQueue } from './storage/offline-core.ts';
import { INVENTORY_BATCH_QUEUE_TYPE } from './inventory-command-batch.ts';

type Edit = Extract<CollectorMutation, { type: 'quantity' | 'condition' | 'finish' | 'storage' | 'move_quantity' | 'remove_quantity' }>;
export function isDurableCollectorEdit(mutation: CollectorMutation): mutation is Edit {
  return ['quantity', 'condition', 'finish', 'storage', 'move_quantity', 'remove_quantity'].includes(mutation.type);
}

/** Generic edits use the existing inventory command and queue, never scanner intents. */
export function collectorEditCommand(mutation: Edit, operationId: string, workspaceId: string, createdAt: string): InventoryCommand {
  if (!operationId || !workspaceId) throw new Error('OPERATION_ID_REQUIRED: scoped edit identity required.');
  if (mutation.type === 'remove_quantity' || mutation.type === 'move_quantity') {
    return { version: 1, operationId, userId: mutation.userId, workspaceId, createdAt,
      endpoint: mutation.type === 'remove_quantity' ? 'remove_inventory_lot_quantity' : 'move_inventory_lot_quantity',
      inventoryItemId: mutation.inventoryItemId,
      args: { p_inventory_item_id: mutation.inventoryItemId, p_quantity: mutation.quantity,
        ...(mutation.type === 'remove_quantity' ? { p_reason: mutation.reason ?? 'Removed from collection' } : { p_to_location_id: mutation.storageLocationId }),
        p_idempotency_key: operationId, p_source: 'collector_workspace' } };
  }
  return { version: 1, operationId, userId: mutation.userId, workspaceId, createdAt,
    endpoint: 'apply_collector_inventory_mutation', inventoryItemId: mutation.inventoryItemId,
    args: { p_inventory_item_id: mutation.inventoryItemId, p_mutation_type: mutation.type,
      p_quantity: mutation.type === 'quantity' ? mutation.quantity : null,
      p_condition: mutation.type === 'condition' ? mutation.condition : null,
      p_finish: mutation.type === 'finish' ? mutation.finish : null,
      p_location_id: mutation.type === 'storage' ? mutation.storageLocationId : null,
      p_idempotency_key: operationId, p_source: 'collector_workspace' } };
}

type Queue = Pick<OfflineQueue, 'enqueue' | 'process' | 'find' | 'list'>;
export async function persistCollectorEdit(queue: Queue, mutation: Edit, operationId: string,
  context: { userId: string; workspaceId: string }, createdAt = new Date().toISOString()) {
  if (context.userId !== mutation.userId) throw new Error('AUTHORIZATION_FAILURE');
  const command = collectorEditCommand(mutation, operationId, context.workspaceId, createdAt);
  // Enqueue compares the complete immutable command; changed payloads cannot reuse an ID.
  const pending = (await queue.list()).find(row => row.userId === mutation.userId && row.id !== operationId && (
    (row.type === COLLECTION_MUTATION_QUEUE_TYPE && ((row.payload.command as InventoryCommand | undefined)?.inventoryItemId === mutation.inventoryItemId || row.payload.inventoryItemId === mutation.inventoryItemId))
    || (row.type === INVENTORY_BATCH_QUEUE_TYPE && (row.payload.commands as InventoryCommand[] | undefined)?.some(c => c.inventoryItemId === mutation.inventoryItemId))));
  if (pending) throw new Error(`REVIEW_REQUIRED: recover or review saved edit ${pending.id} before changing this item again.`);
  const existing = await queue.find(operationId, mutation.userId, COLLECTION_MUTATION_QUEUE_TYPE);
  if (existing?.payload.command) command.createdAt = (existing.payload.command as InventoryCommand).createdAt;
  return queue.enqueue(COLLECTION_MUTATION_QUEUE_TYPE, { command }, {
    userId: mutation.userId, operationId, dedupeKey: operationId,
  });
}

export async function deliverCollectorEdit(queue: Queue, operationId: string, userId: string,
  transport: Parameters<typeof deliverInventoryCommand>[1]) {
  const outcome = await queue.process(operationId, userId, COLLECTION_MUTATION_QUEUE_TYPE,
    async (operation) => { await deliverInventoryCommand(operation, transport); },
    { retrySafe: true, classify: classifyInventoryCommandError });
  const operation = await queue.find(operationId, userId, COLLECTION_MUTATION_QUEUE_TYPE);
  const committed = operation?.status === 'committed' && !operation.errorCode;
  return { committed, outcome, operation };
}
