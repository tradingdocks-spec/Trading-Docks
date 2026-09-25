import { deliverInventoryCommand, readInventoryCommand, inventoryCommandError, classifyInventoryCommandError, type InventoryCommand } from './inventory-command.ts';
import type { OfflineQueue } from './storage/offline-core.ts';
import { COLLECTION_MUTATION_QUEUE_TYPE } from './collector-mutations.ts';
export const INVENTORY_BATCH_QUEUE_TYPE = 'inventory_command_batch';
type Queue = Pick<OfflineQueue, 'enqueue' | 'process' | 'find' | 'list'>;
export async function persistInventoryBatch(queue: Queue, id: string, commands: InventoryCommand[], purpose: 'bulk_remove' | 'append_import') {
  if (!id || !commands.length || new Set(commands.map(c => c.operationId)).size !== commands.length) throw Error('INVALID_COMMAND_BATCH');
  const owner = commands[0].userId, workspace = commands[0].workspaceId;
  if (commands.some(c => c.userId !== owner || c.workspaceId !== workspace)) throw Error('AUTHORIZATION_FAILURE');
  const prior = await queue.find(id, owner, INVENTORY_BATCH_QUEUE_TYPE);
  if (!prior && (await queue.list()).some(r => r.userId === owner && r.type === INVENTORY_BATCH_QUEUE_TYPE)) {
    throw Error('REVIEW_REQUIRED: recover the existing inventory operation before starting another.');
  }
  if (!prior && (await queue.list()).some(r => r.userId === owner && r.type === COLLECTION_MUTATION_QUEUE_TYPE
    && commands.some(c => c.inventoryItemId === (r.payload.command as InventoryCommand | undefined)?.inventoryItemId || c.inventoryItemId === r.payload.inventoryItemId))) {
    throw Error('REVIEW_REQUIRED: recover the pending item edit before preparing this manifest.');
  }
  return queue.enqueue(INVENTORY_BATCH_QUEUE_TYPE, { commands: structuredClone(commands), purpose }, { userId: owner, operationId: id, dedupeKey: id });
}
/** The server atomically executes the frozen manifest or replays its receipt. */
export async function deliverInventoryBatch(queue: Queue, id: string, owner: string, transport: Parameters<typeof deliverInventoryCommand>[1]) {
  await queue.process(id, owner, INVENTORY_BATCH_QUEUE_TYPE, async parent => {
    const commands = parent.payload.commands as InventoryCommand[];
    if (!Array.isArray(commands) || !commands.length) throw Error('INVALID_COMMAND_BATCH');
    for (const command of commands) readInventoryCommand({ id: command.operationId, userId: owner, type: parent.type, createdAt: parent.createdAt, payload: { command } });
    const context = await transport.context();
    if (context.userId !== owner || commands.some(c => c.workspaceId !== context.workspaceId)) throw inventoryCommandError('AUTHORIZATION_FAILURE', 'Return to the original workspace.');
    const { data, error } = await transport.rpc('apply_inventory_manifest', { p_operation_id: id, p_manifest: {
      version: 1, userId: owner, workspaceId: context.workspaceId, purpose: parent.payload.purpose,
      commands: commands.map(command => { const value = { ...command } as Partial<InventoryCommand>; delete value.createdAt; return value; }),
    } });
    if (error) throw error;
    const receipt = data as { operationId?: string; userId?: string; workspaceId?: string; committed?: boolean; error?: { code: string; message: string } } | null;
    if (!receipt || receipt.operationId !== id || receipt.userId !== owner || receipt.workspaceId !== context.workspaceId) throw inventoryCommandError('REVIEW_REQUIRED', 'Server did not acknowledge this manifest.');
    if (!receipt.committed) throw receipt.error ?? inventoryCommandError('REVIEW_REQUIRED', 'Server did not commit this manifest.');
  }, { retrySafe: true, classify: classifyInventoryCommandError });
  const operation = await queue.find(id, owner, INVENTORY_BATCH_QUEUE_TYPE);
  return { committed: operation?.status === 'committed', operation };
}
