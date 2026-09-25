import { currentInventoryWorkspace } from '@/services/inventory-workspace';
import { isDurableCollectorEdit, persistCollectorEdit, deliverCollectorEdit } from '@/services/collector-inventory-command';
import { findOfflineOperation } from '@/services/storage/offline';
import { supabase } from '@/lib/supabase';
import {
  COLLECTION_MUTATION_QUEUE_TYPE,
  classifyCollectorAuthoritativeError,
  mutationQueueKey,
  validateCollectorMutation,
  type CollectorMutation,
} from '@/services/collector-mutations';
import { loadInventoryQuantityTotal } from '@/services/inventory-quantity-total';
import {
  enqueueOfflineOperation,
  getOfflineQueue,
  processOfflineOperation,
} from '@/services/storage/offline';

type MutationResult =
  | { ok: true; queued?: false }
  | { ok: false; error: string; queued?: boolean }
  | { ok: true; queued: true; warning: string };

export async function runMobileCollectorMutation({
  mutation,
  membershipTier,
  currentTotalQuantity,
  currentCardQuantity,
}: {
  mutation: CollectorMutation;
  membershipTier: unknown;
  currentTotalQuantity: number;
  currentCardQuantity: number;
}): Promise<MutationResult> {
  if (isDurableCollectorEdit(mutation)) {
    const original = JSON.parse(JSON.stringify(mutation)) as typeof mutation;
    const operationId = mutation.operationId ?? globalThis.crypto?.randomUUID?.();
    if (!operationId) return { ok: false, error: 'Secure operation identity is unavailable. No edit was sent.' };
    try {
      const transport = collectorEditTransport();
      const context = await transport.context();
      await persistCollectorEdit(collectorQueue, original, operationId, context);
      const result = await deliverCollectorEdit(collectorQueue, operationId, original.userId, transport);
      return result.committed ? { ok: true, queued: false } : { ok: true, queued: true, warning: result.operation?.lastError ?? 'Original edit saved for safe retry.' };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'No edit was acknowledged.' }; }
  }
  const auth = await currentUserId();
  if (!auth) return queueCollectorMutation(mutation, 'Collection storage is offline. The change is queued for sync.');

  const validation = validateCollectorMutation(mutation, {
    membershipTier,
    currentTotalQuantity,
    currentCardQuantity,
    requestedUserId: mutation.userId,
    authenticatedUserId: auth,
  });
  if (!validation.ok) return { ok: false, error: validation.reason };

  try {
    await executeOnlineMutation(mutation, auth, membershipTier, currentTotalQuantity, currentCardQuantity);
    return { ok: true, queued: false };
  } catch (error) {
    const authoritativeError = classifyCollectorAuthoritativeError(error);
    if (authoritativeError) return { ok: false, error: authoritativeError.message };
    const message = error instanceof Error ? error.message : 'Collection update failed.';
    return queueCollectorMutation(mutation, message, true);
  }
}

export async function retryQueuedCollectorMutations({
  userId,
  membershipTier,
}: {
  userId: string;
  membershipTier: unknown;
}) {
  const queue = await getOfflineQueue();
  let attempted = 0;
  for (const operation of queue) {
    if (operation.type !== COLLECTION_MUTATION_QUEUE_TYPE || operation.userId !== userId) continue;
    if (operation.payload.command) {
      await deliverCollectorEdit(collectorQueue, operation.id, userId, collectorEditTransport());
      attempted += 1;
      continue;
    }
    // Old target-key edits have no immutable server command. Never mint a new ID on replay.
    const outcome = await processOfflineOperation(operation.id, userId, COLLECTION_MUTATION_QUEUE_TYPE, async (claimed) => {
      const mutation = claimed.payload as unknown as CollectorMutation;
      if (isDurableCollectorEdit(mutation)) throw new Error('LEGACY_OPERATION: review the prior server outcome.');
      if (mutation.userId !== userId || !mutation.inventoryItemId) throw new Error('Invalid collector operation.');
      if (!['quantity', 'condition', 'finish', 'storage', 'trade_binder_status', 'wishlist'].includes(mutation.type)) throw new Error('Unsupported queued mutation requires review.');
      const totals = await loadMutationQuantityContext(userId, mutation.inventoryItemId);
      await executeOnlineMutation(mutation, userId, membershipTier, totals.currentTotalQuantity, totals.currentCardQuantity);
    }, { retrySafe: false });
    if (outcome.status !== 'skipped') attempted += 1;
  }
  return { attempted, remaining: (await getOfflineQueue()).filter((op) => op.userId === userId && op.type === COLLECTION_MUTATION_QUEUE_TYPE).length };
}

async function executeOnlineMutation(
  mutation: CollectorMutation,
  userId: string,
  membershipTier: unknown,
  currentTotalQuantity: number,
  currentCardQuantity: number,
) {
  if (!supabase) throw new Error('Supabase collection storage is not configured.');
  const validation = validateCollectorMutation(mutation, {
    membershipTier,
    currentTotalQuantity,
    currentCardQuantity,
    requestedUserId: mutation.userId,
    authenticatedUserId: userId,
  });
  if (!validation.ok) throw new Error(validation.reason);

  if (isDurableCollectorEdit(mutation)) throw new Error('OPERATION_ID_REQUIRED: use the durable inventory command.');

  if (mutation.type === 'trade_binder_status') {
    const { error } = await supabase
      .from('binder_card_trade_status')
      .upsert({
        user_id: userId,
        inventory_item_id: mutation.inventoryItemId,
        status: mutation.status,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,inventory_item_id' });
    if (error) throw new Error(error.message);
    return;
  }

  if (mutation.type === 'wishlist') {
    if (mutation.wishlisted) {
      const existing = await matchingWishlistQuery(userId, mutation).select('id').maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      if (existing.data) {
        const { error } = await supabase
          .from('collector_wishlist')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', existing.data.id)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase
        .from('collector_wishlist')
        .insert({
          user_id: userId,
          card_name: mutation.cardName,
          set_code: mutation.setCode ?? null,
          target_condition: mutation.condition,
          target_finish: mutation.finish,
          updated_at: new Date().toISOString(),
        });
      if (error) throw new Error(error.message);
      return;
    }
    let deleteQuery = supabase
      .from('collector_wishlist')
      .delete()
      .eq('user_id', userId)
      .eq('card_name', mutation.cardName)
      .eq('target_condition', mutation.condition)
      .eq('target_finish', mutation.finish);
    deleteQuery = mutation.setCode ? deleteQuery.eq('set_code', mutation.setCode) : deleteQuery.is('set_code', null);
    const { error } = await deleteQuery;
    if (error) throw new Error(error.message);
  }
}

function matchingWishlistQuery(userId: string, mutation: Extract<CollectorMutation, { type: 'wishlist' }>) {
  if (!supabase) throw new Error('Supabase collection storage is not configured.');
  let query = supabase
    .from('collector_wishlist')
    .select('*')
    .eq('user_id', userId)
    .eq('card_name', mutation.cardName)
    .eq('target_condition', mutation.condition)
    .eq('target_finish', mutation.finish);
  query = mutation.setCode ? query.eq('set_code', mutation.setCode) : query.is('set_code', null);
  return query;
}

async function queueCollectorMutation(mutation: CollectorMutation, error: string, uncertain = false): Promise<MutationResult> {
  await enqueueOfflineOperation(
    COLLECTION_MUTATION_QUEUE_TYPE,
    mutation as unknown as Record<string, unknown>,
    { userId: mutation.userId, dedupeKey: mutationQueueKey(mutation), uncertain },
  );
  return { ok: true, queued: true, warning: uncertain ? 'Server outcome is uncertain. Operation preserved for review; automatic replay is blocked.' : error };
}

async function currentUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

async function loadMutationQuantityContext(userId: string, inventoryItemId: string) {
  if (!supabase) throw new Error('Supabase collection storage is not configured.');
  const [currentTotalQuantity, cardResult] = await Promise.all([
    loadInventoryQuantityTotal(supabase, userId),
    supabase
      .from('inventory_items')
      .select('quantity')
      .eq('user_id', userId)
      .eq('id', inventoryItemId)
      .maybeSingle(),
  ]);
  if (cardResult.error) throw new Error(cardResult.error.message);
  const currentCardQuantity = Number(cardResult.data?.quantity ?? 0);
  return { currentTotalQuantity, currentCardQuantity };
}

const collectorQueue = { list: getOfflineQueue, enqueue: enqueueOfflineOperation, process: processOfflineOperation, find: findOfflineOperation };
function collectorEditTransport() {
  return {
    context: async () => {
      const userId = await currentUserId();
      if (!supabase || !userId) throw new Error('AUTHORIZATION_FAILURE: connect to confirm the current workspace before preparing an edit.');
      return { userId, workspaceId: await currentInventoryWorkspace(supabase) };
    },
    rpc: async (endpoint: import('./inventory-command').InventoryCommand['endpoint'] | 'apply_inventory_manifest', args: Record<string, unknown>) => {
      if (!supabase) throw new Error('Collection storage unavailable.');
      return supabase.rpc(endpoint, args);
    },
  };
}
