"use client";
import { collectorEditQueue } from './collector-edit-queue';
import { collectorEditTransport } from './collector-workspace-client-data';
import { toDatabaseRow, type InventoryPersistenceRecord } from './inventory-persistence';
import { persistInventoryBatch, deliverInventoryBatch } from '../../mobile/services/inventory-command-batch';
import type { InventoryCommand } from '../../mobile/services/inventory-command';
/** CSV import is APPEND: existing rows are not updated or removed. */
export async function appendInventoryRecords(records: InventoryPersistenceRecord[]) {
  const transport = collectorEditTransport(), context = await transport.context(), queue = collectorEditQueue();
  const id = crypto.randomUUID(), createdAt = new Date().toISOString();
  const commands: InventoryCommand[] = records.map(record => ({ version: 1, operationId: `${id}:${record.id}`,
    createdAt, userId: context.userId, workspaceId: context.workspaceId, inventoryItemId: record.id,
    endpoint: 'create_inventory_item_with_event', args: {
      p_inventory: { ...toDatabaseRow('items', context.userId, record), workspace_id: context.workspaceId },
      p_source: 'csv_import', p_idempotency_key: `${id}:${record.id}`, p_related_entity_type: 'inventory_append', p_related_entity_id: id,
    } }));
  await persistInventoryBatch(queue, id, commands, 'append_import');
  const result = await deliverInventoryBatch(queue, id, context.userId, transport);
  if (!result.committed) throw Error(`Import is not fully acknowledged. Some rows may have completed. Recover saved operation ${id}; original rows are retained.`);
  return { operationId: id, records: records.length };
}
