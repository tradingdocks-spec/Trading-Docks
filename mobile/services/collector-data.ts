import { supabase } from '@/lib/supabase';
import {
  buildCollectionCards,
  COLLECTION_PAGE_SIZE,
  collectorCacheKeyForUser,
  type CollectionCard,
  type StorageLocation,
  type RawInventoryItem,
  type RawInventoryLocation,
  type RawTradeBinderStatus,
  type RawWishlistItem,
} from '@/services/collector-workspace';
import { appStorage } from '@/services/storage/app-storage';

export type CollectorCollectionPage = {
  cards: CollectionCard[];
  locations: StorageLocation[];
  totalQuantity: number;
  stale: boolean;
  unavailableReason?: string;
};

export async function loadCollectorCollectionPage({
  query = '',
  limit = COLLECTION_PAGE_SIZE,
}: {
  query?: string;
  limit?: number;
} = {}): Promise<CollectorCollectionPage> {
  if (!supabase) {
    return { cards: [], locations: [], totalQuantity: 0, stale: true, unavailableReason: 'Supabase collection storage is not configured.' };
  }

  let userId: string | null = null;
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Sign in again to load your collection.');
    userId = user.id;

    let itemQuery = supabase
      .from('inventory_items')
      .select('id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), COLLECTION_PAGE_SIZE));

    const cleanQuery = query.trim();
    if (cleanQuery) itemQuery = itemQuery.ilike('card_name', `%${cleanQuery}%`);

    const [{ data: items, error: itemsError }, { data: locations, error: locationsError }, { data: tradeStatuses }, { data: wishlist }] = await Promise.all([
      itemQuery,
      supabase
        .from('inventory_locations')
        .select('id, name, location_type, data')
        .eq('user_id', user.id)
        .order('name', { ascending: true })
        .limit(100),
      supabase
        .from('binder_card_trade_status')
        .select('inventory_item_id, status')
        .eq('user_id', user.id)
        .limit(500),
      supabase
        .from('collector_wishlist')
        .select('card_name, set_code, target_condition, target_finish')
        .eq('user_id', user.id)
        .limit(500),
    ]);

    if (itemsError) throw new Error(`Collection storage is unavailable: ${itemsError.message}`);
    if (locationsError) throw new Error(`Storage locations are unavailable: ${locationsError.message}`);

    const cards = buildCollectionCards({
      items: (items ?? []) as RawInventoryItem[],
      locations: (locations ?? []) as RawInventoryLocation[],
      tradeStatuses: (tradeStatuses ?? []) as RawTradeBinderStatus[],
      wishlist: (wishlist ?? []) as RawWishlistItem[],
    });
    await appStorage.setItem(collectorCacheKeyForUser(user.id), JSON.stringify(cards));
    return { cards, locations: buildStorageLocations((locations ?? []) as RawInventoryLocation[]), totalQuantity: cards.reduce((sum, card) => sum + card.quantityOwned, 0), stale: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Collection data is unavailable.';
    return userId
      ? loadCachedCollectionPage(userId, message)
      : { cards: [], locations: [], totalQuantity: 0, stale: true, unavailableReason: message };
  }
}

export async function loadCollectorCardById(cardId: string): Promise<CollectorCollectionPage> {
  if (!supabase) {
    return { cards: [], locations: [], totalQuantity: 0, stale: true, unavailableReason: 'Supabase collection storage is not configured.' };
  }

  let userId: string | null = null;
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Sign in again to load this card.');
    userId = user.id;

    const { data: item, error: itemError } = await supabase
      .from('inventory_items')
      .select('id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data')
      .eq('user_id', user.id)
      .eq('id', cardId)
      .maybeSingle();
    if (itemError) throw new Error(`Card details are unavailable: ${itemError.message}`);
    if (!item) return { cards: [], locations: [], totalQuantity: 0, stale: false };

    const [{ data: locations }, { data: tradeStatuses }, { data: wishlist }, { data: quantityRows }] = await Promise.all([
      supabase
        .from('inventory_locations')
        .select('id, name, location_type, data')
        .eq('user_id', user.id)
        .order('name', { ascending: true })
        .limit(100),
      supabase
        .from('binder_card_trade_status')
        .select('inventory_item_id, status')
        .eq('user_id', user.id)
        .eq('inventory_item_id', cardId)
        .limit(1),
      supabase
        .from('collector_wishlist')
        .select('card_name, set_code, target_condition, target_finish')
        .eq('user_id', user.id)
        .limit(500),
      supabase
        .from('inventory_items')
        .select('quantity')
        .eq('user_id', user.id)
        .limit(1000),
    ]);

    return {
      cards: buildCollectionCards({
        items: [item as RawInventoryItem],
        locations: (locations ?? []) as RawInventoryLocation[],
        tradeStatuses: (tradeStatuses ?? []) as RawTradeBinderStatus[],
        wishlist: (wishlist ?? []) as RawWishlistItem[],
      }),
      locations: buildStorageLocations((locations ?? []) as RawInventoryLocation[]),
      totalQuantity: (quantityRows ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0),
      stale: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Card details are unavailable.';
    return userId
      ? loadCachedCard(userId, cardId, message)
      : { cards: [], locations: [], totalQuantity: 0, stale: true, unavailableReason: message };
  }
}

async function loadCachedCollectionPage(userId: string, unavailableReason: string): Promise<CollectorCollectionPage> {
  const cached = await appStorage.getItem(collectorCacheKeyForUser(userId));
  if (!cached) return { cards: [], locations: [], totalQuantity: 0, stale: true, unavailableReason };
  try {
    const parsed: unknown = JSON.parse(cached);
    return {
      cards: Array.isArray(parsed) ? (parsed as CollectionCard[]) : [],
      locations: [],
      totalQuantity: Array.isArray(parsed)
        ? (parsed as CollectionCard[]).reduce((sum, card) => sum + card.quantityOwned, 0)
        : 0,
      stale: true,
      unavailableReason,
    };
  } catch {
    return { cards: [], locations: [], totalQuantity: 0, stale: true, unavailableReason };
  }
}

async function loadCachedCard(userId: string, cardId: string, unavailableReason: string): Promise<CollectorCollectionPage> {
  const cached = await loadCachedCollectionPage(userId, unavailableReason);
  return {
    ...cached,
    cards: cached.cards.filter((card) => card.id === cardId),
  };
}

function buildStorageLocations(locations: RawInventoryLocation[]): StorageLocation[] {
  return locations.map((location) => {
    const payload = location.data ?? {};
    return {
      id: location.id,
      name: typeof payload.name === 'string' && payload.name.trim() ? payload.name : location.name ?? 'Unnamed location',
      type: location.location_type === 'binder' ||
        location.location_type === 'box' ||
        location.location_type === 'sealed' ||
        location.location_type === 'bulk' ||
        location.location_type === 'custom'
        ? location.location_type
        : 'unknown',
      description: typeof payload.description === 'string' ? payload.description : null,
      zone: typeof payload.zone === 'string' ? payload.zone : null,
      binderPage: null,
      binderSlot: null,
    };
  });
}
