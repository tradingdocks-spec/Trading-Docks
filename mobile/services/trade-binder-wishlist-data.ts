import { supabase } from '@/lib/supabase';
import { buildCollectionCards, type RawInventoryItem, type RawInventoryLocation, type RawTradeBinderStatus } from '@/services/collector-workspace';
import {
  TRADE_BINDER_OFFLINE_TYPE,
  buildTradeBinderWishlistState,
  tradeWishlistQueueKey,
  type RawTradeBinderRow,
  type RawWishlistRow,
  type TradeBinderWishlistState,
  type TradeStatus,
  type WishlistPriority,
} from '@/services/trade-binder-wishlist';
import { enqueueOfflineOperation, getOfflineQueue, processOfflineOperation } from '@/services/storage/offline';

export type TradeWishlistMutation =
  | { type: 'trade_status'; userId: string; inventoryItemId: string; status: TradeStatus }
  | { type: 'wishlist_priority'; userId: string; wishlistItemId: string; priority: WishlistPriority }
  | { type: 'wishlist_toggle'; userId: string; cardName: string; setCode?: string | null; condition?: string | null; finish?: string | null; wishlisted: boolean; priority?: WishlistPriority; notes?: string };

type MutationResult = { ok: true; queued?: false } | { ok: true; queued: true; warning: string } | { ok: false; error: string };

export async function loadMobileTradeBinderWishlist(): Promise<TradeBinderWishlistState & { userId: string; stale: boolean; unavailableReason?: string }> {
  if (!supabase) throw new Error('Supabase Trade Binder storage is not configured.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in again to load Trade Binder and Wishlist.');
  const userId = auth.user.id;
  const [{ data: items, error: itemError }, { data: locations }, { data: tradeRows }, { data: wishlistRows }] = await Promise.all([
    supabase.from('inventory_items').select('id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data').eq('user_id', userId).order('updated_at', { ascending: false }).limit(500),
    supabase.from('inventory_locations').select('id, name, location_type, data').eq('user_id', userId).order('name', { ascending: true }).limit(500),
    supabase.from('binder_card_trade_status').select('inventory_item_id, status, trade_value, notes, updated_at').eq('user_id', userId).limit(1000),
    supabase.from('collector_wishlist').select('id, card_name, set_code, target_condition, target_finish, target_value, priority, notes, created_at, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1000),
  ]);
  if (itemError) throw new Error(`Collection cards are unavailable: ${itemError.message}`);
  const cards = buildCollectionCards({
    items: (items ?? []) as RawInventoryItem[],
    locations: (locations ?? []) as RawInventoryLocation[],
    tradeStatuses: (tradeRows ?? []) as RawTradeBinderStatus[],
    wishlist: (wishlistRows ?? []) as RawWishlistRow[],
  });
  return {
    userId,
    stale: false,
    ...buildTradeBinderWishlistState({ userId, cards, tradeRows: (tradeRows ?? []) as RawTradeBinderRow[], wishlistRows: (wishlistRows ?? []) as RawWishlistRow[] }),
  };
}

export async function runMobileTradeWishlistMutation(mutation: TradeWishlistMutation): Promise<MutationResult> {
  const userId = await currentUserId();
  if (!userId) return queueMutation(mutation, 'Trade Binder is offline. The change is queued for sync.');
  if (mutation.userId !== userId) return { ok: false, error: 'You can only update your own Trade Binder and Wishlist.' };
  try {
    await executeMutation(mutation, userId);
    return { ok: true };
  } catch (error) {
    return queueMutation(mutation, error instanceof Error ? error.message : 'Trade Binder update queued for sync.', true);
  }
}

export async function retryQueuedTradeWishlistMutations(userId: string) {
  const queue = await getOfflineQueue();
  let attempted = 0;
  for (const operation of queue) {
    if (operation.type !== TRADE_BINDER_OFFLINE_TYPE || operation.userId !== userId) continue;
    const outcome = await processOfflineOperation(operation.id, userId, TRADE_BINDER_OFFLINE_TYPE, async (claimed) => {
      const mutation = claimed.payload as unknown as TradeWishlistMutation;
      if (mutation.userId !== userId) throw new Error('Invalid wishlist operation.');
      if (!['trade_status', 'wishlist_priority', 'wishlist_toggle'].includes(mutation.type)) throw new Error('Unsupported wishlist operation requires review.');
      await executeMutation(mutation, userId);
    }, { retrySafe: false });
    if (outcome.status !== 'skipped') attempted += 1;
  }
  return { attempted, remaining: (await getOfflineQueue()).filter((op) => op.userId === userId && op.type === TRADE_BINDER_OFFLINE_TYPE).length };
}

async function executeMutation(mutation: TradeWishlistMutation, userId: string) {
  if (!supabase) throw new Error('Supabase Trade Binder storage is not configured.');
  if (mutation.type === 'trade_status') {
    const { error } = await supabase.from('binder_card_trade_status').upsert({
      user_id: userId,
      inventory_item_id: mutation.inventoryItemId,
      status: mutation.status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,inventory_item_id' });
    if (error) throw new Error(error.message);
    return;
  }
  if (mutation.type === 'wishlist_priority') {
    const { error } = await supabase.from('collector_wishlist').update({ priority: mutation.priority, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('id', mutation.wishlistItemId);
    if (error) throw new Error(error.message);
    return;
  }
  if (mutation.type === 'wishlist_toggle') {
    if (mutation.wishlisted) {
      const { error } = await supabase.from('collector_wishlist').insert({
        user_id: userId,
        card_name: mutation.cardName.trim(),
        set_code: mutation.setCode?.trim().toUpperCase() || null,
        target_condition: mutation.condition || null,
        target_finish: mutation.finish || null,
        priority: mutation.priority ?? 'medium',
        notes: mutation.notes?.slice(0, 500) ?? '',
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return;
    }
    let query = supabase.from('collector_wishlist').delete().eq('user_id', userId).eq('card_name', mutation.cardName);
    query = mutation.setCode ? query.eq('set_code', mutation.setCode) : query.is('set_code', null);
    const { error } = await query;
    if (error) throw new Error(error.message);
  }
}

async function queueMutation(mutation: TradeWishlistMutation, warning: string, uncertain = false): Promise<MutationResult> {
  await enqueueOfflineOperation(
    TRADE_BINDER_OFFLINE_TYPE,
    mutation as unknown as Record<string, unknown>,
    { userId: mutation.userId, dedupeKey: mutationDedupeKey(mutation), uncertain },
  );
  return { ok: true, queued: true, warning: uncertain ? 'Server outcome is uncertain. Operation preserved for review; automatic replay is blocked.' : warning };
}

function mutationDedupeKey(mutation: TradeWishlistMutation) {
  if (mutation.type === 'trade_status') return tradeWishlistQueueKey({ userId: mutation.userId, targetId: mutation.inventoryItemId, type: mutation.type });
  if (mutation.type === 'wishlist_priority') return tradeWishlistQueueKey({ userId: mutation.userId, targetId: mutation.wishlistItemId, type: mutation.type });
  return tradeWishlistQueueKey({ userId: mutation.userId, targetId: `${mutation.cardName}:${mutation.setCode ?? 'any'}`, type: mutation.type });
}

async function currentUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
