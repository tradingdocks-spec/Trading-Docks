import type { OfflineOperation } from './storage/offline-core.ts';

/** Serialized arguments for the existing Phase 1K RPCs, not another writer. */
export type InventoryCommand = {
  version: 1;
  operationId: string;
  userId: string;
  workspaceId: string;
  createdAt: string;
  endpoint: 'create_inventory_item_with_event' | 'apply_collector_inventory_mutation' | 'remove_inventory_lot_quantity' | 'move_inventory_lot_quantity';
  args: Record<string, unknown>;
  inventoryItemId: string;
};

export function inventoryCommandError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

export function classifyInventoryCommandError(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  const code = value?.code ?? '';
  const message = value?.message ?? '';
  let outcome = 'RETRYABLE_FAILURE';
  if (/IDEMPOTENCY_CONFLICT/.test(message + code)) outcome = 'IDEMPOTENCY_CONFLICT';
  else if (/REVIEW_REQUIRED|LEGACY_OPERATION|OPERATION_ID_REQUIRED/.test(message + code)) outcome = 'REVIEW_REQUIRED';
  else if (['42501', '28000', '401', '403', 'PGRST301', 'PGRST302'].includes(code) || /UNAUTHORIZED|FORBIDDEN|AUTHORIZATION/.test(message + code)) outcome = 'AUTHORIZATION_FAILURE';
  else if (/^(22|23)/.test(code) || ['P0001', 'P0002'].includes(code) || /TD_COLLECTOR_|INVALID_|VALIDATION_REJECTED/.test(message + code)) outcome = 'VALIDATION_REJECTED';
  // No raw payload/server detail is needed for client recovery or diagnostics.
  return { code: outcome, message: outcome === 'RETRYABLE_FAILURE'
    ? 'Delivery was not confirmed. The original command is retained for retry.'
    : `${outcome}: original operation retained. Review before taking a new action.`, actionRequired: outcome !== 'RETRYABLE_FAILURE' };
}

export function readInventoryCommand(operation: OfflineOperation): InventoryCommand {
  const c = operation.payload.command as InventoryCommand | undefined;
  if (!c || c.version !== 1 || c.operationId !== operation.id || c.userId !== operation.userId
      || !c.workspaceId || !c.createdAt || !c.inventoryItemId || !c.args
      || c.args.p_idempotency_key !== c.operationId
      || !['create_inventory_item_with_event', 'apply_collector_inventory_mutation', 'remove_inventory_lot_quantity', 'move_inventory_lot_quantity'].includes(c.endpoint)) {
    throw inventoryCommandError('REVIEW_REQUIRED', 'Legacy or invalid inventory command requires review.');
  }
  if (c.endpoint === 'create_inventory_item_with_event') {
    const p = c.args.p_inventory as Record<string, unknown> | undefined;
    if (!p || p.id !== c.inventoryItemId || p.user_id !== c.userId || p.workspace_id !== c.workspaceId) {
      throw inventoryCommandError('REVIEW_REQUIRED', 'Inventory command identity is inconsistent.');
    }
  } else if (c.args.p_inventory_item_id !== c.inventoryItemId) {
    throw inventoryCommandError('REVIEW_REQUIRED', 'Inventory target is inconsistent.');
  }
  return c;
}

export async function deliverInventoryCommand(operation: OfflineOperation, transport: {
  context(): Promise<{ userId: string; workspaceId: string }>;
  rpc(endpoint: InventoryCommand['endpoint'] | 'apply_inventory_manifest', args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
}) {
  const command = readInventoryCommand(operation);
  const context = await transport.context();
  if (context.userId !== command.userId || context.workspaceId !== command.workspaceId) {
    throw inventoryCommandError('AUTHORIZATION_FAILURE', 'Return to the original authorized workspace to review this command.');
  }
  const { data, error } = await transport.rpc(command.endpoint, command.args);
  if (error) throw error;
  const result = data as Record<string, unknown> | null;
  if (!result || result.id !== command.inventoryItemId || result.user_id !== command.userId || result.workspace_id !== command.workspaceId) {
    throw inventoryCommandError('REVIEW_REQUIRED', 'Server did not return a definitive matching inventory receipt.');
  }
  // Phase 1K intentionally returns the same composite on NEW and REPLAYED.
  // Both definitively acknowledge; do not guess which disposition occurred.
  return result;
}
