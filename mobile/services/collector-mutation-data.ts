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
  replaceOfflineQueue,
  type OfflineOperation,
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
  hasFullPlatformAccess = false,
}: {
  mutation: CollectorMutation;
  membershipTier: unknown;
  currentTotalQuantity: number;
  currentCardQuantity: number;
  hasFullPlatformAccess?: boolean;
}): Promise<MutationResult> {
  const auth = await currentUserId();
  if (!auth) return queueCollectorMutation(mutation, 'Collection storage is offline. The change is queued for sync.');

  const validation = validateCollectorMutation(mutation, {
    membershipTier,
    currentTotalQuantity,
    currentCardQuantity,
    hasFullPlatformAccess,
    requestedUserId: mutation.userId,
    authenticatedUserId: auth,
  });
  if (!validation.ok) return { ok: false, error: validation.reason };

  try {
    await executeOnlineMutation(mutation, auth, membershipTier, currentTotalQuantity, currentCardQuantity, hasFullPlatformAccess);
    return { ok: true, queued: false };
  } catch (error) {
    const authoritativeError = classifyCollectorAuthoritativeError(error);
    if (authoritativeError) return { ok: false, error: authoritativeError.message };
    const message = error instanceof Error ? error.message : 'Collection update failed.';
    return queueCollectorMutation(mutation, message);
  }
}

export async function retryQueuedCollectorMutations({
  userId,
  membershipTier,
  hasFullPlatformAccess = false,
}: {
  userId: string;
  membershipTier: unknown;
  hasFullPlatformAccess?: boolean;
}) {
  const queue = await getOfflineQueue();
  const remaining: OfflineOperation[] = [];
  for (const operation of queue) {
    if (operation.type !== COLLECTION_MUTATION_QUEUE_TYPE || operation.userId !== userId) {
      remaining.push(operation);
      continue;
    }
    const mutation = operation.payload as unknown as CollectorMutation;
    try {
      const totals = await loadMutationQuantityContext(userId, mutation.inventoryItemId);
      await executeOnlineMutation(mutation, userId, membershipTier, totals.currentTotalQuantity, totals.currentCardQuantity, hasFullPlatformAccess);
    } catch (error) {
      const authoritativeError = classifyCollectorAuthoritativeError(error);
      remaining.push({
        ...operation,
        lastError: authoritativeError?.message ?? (error instanceof Error ? error.message : 'Queued collection update failed.'),
        errorCode: authoritativeError?.code,
      });
    }
  }
  await replaceOfflineQueue(remaining);
  return { attempted: queue.length - remaining.length, remaining: remaining.length };
}

async function executeOnlineMutation(
  mutation: CollectorMutation,
  userId: string,
  membershipTier: unknown,
  currentTotalQuantity: number,
  currentCardQuantity: number,
  hasFullPlatformAccess = false,
) {
  if (!supabase) throw new Error('Supabase collection storage is not configured.');
  const validation = validateCollectorMutation(mutation, {
    membershipTier,
    currentTotalQuantity,
    currentCardQuantity,
    hasFullPlatformAccess,
    requestedUserId: mutation.userId,
    authenticatedUserId: userId,
  });
  if (!validation.ok) throw new Error(validation.reason);

  if (mutation.type === 'quantity') {
    const { error } = await supabase.rpc('apply_collector_inventory_mutation', {
      p_inventory_item_id: mutation.inventoryItemId,
      p_mutation_type: 'quantity',
      p_quantity: mutation.quantity,
      p_condition: null,
      p_finish: null,
      p_location_id: null,
      p_idempotency_key: mutationQueueKey(mutation),
      p_source: 'mobile',
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (mutation.type === 'condition' || mutation.type === 'finish') {
    const { error } = await supabase.rpc('apply_collector_inventory_mutation', {
      p_inventory_item_id: mutation.inventoryItemId,
      p_mutation_type: mutation.type,
      p_quantity: null,
      p_condition: mutation.type === 'condition' ? mutation.condition : null,
      p_finish: mutation.type === 'finish' ? mutation.finish : null,
      p_location_id: null,
      p_idempotency_key: mutationQueueKey(mutation),
      p_source: 'mobile',
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (mutation.type === 'storage') {
    const { error } = await supabase.rpc('apply_collector_inventory_mutation', {
      p_inventory_item_id: mutation.inventoryItemId,
      p_mutation_type: 'storage',
      p_quantity: null,
      p_condition: null,
      p_finish: null,
      p_location_id: mutation.storageLocationId,
      p_idempotency_key: mutationQueueKey(mutation),
      p_source: 'mobile',
    });
    if (error) throw new Error(error.message);
    return;
  }

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

async function queueCollectorMutation(mutation: CollectorMutation, error: string): Promise<MutationResult> {
  await enqueueOfflineOperation(
    COLLECTION_MUTATION_QUEUE_TYPE,
    mutation as unknown as Record<string, unknown>,
    { userId: mutation.userId, dedupeKey: mutationQueueKey(mutation) },
  );
  return { ok: true, queued: true, warning: error };
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
