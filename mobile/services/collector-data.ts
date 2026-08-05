import { supabase } from '@/lib/supabase';
import {
  buildCollectionCards,
  buildCollectionPageInfo,
  COLLECTION_PAGE_SIZE,
  collectorCacheKeyForUser,
  decodeCollectionCursor,
  normalizeCollectionPageSize,
  type CollectionCard,
  type CollectionFilter,
  type CollectionPageInfo,
  type CollectionPageRequest,
  type CollectionSort,
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
  pageInfo: CollectionPageInfo;
  unavailableReason?: string;
};

export async function loadCollectorCollectionPage({
  filter,
  sort = 'recently_updated',
  cursor = null,
  limit = COLLECTION_PAGE_SIZE,
}: CollectionPageRequest = {}): Promise<CollectorCollectionPage> {
  const pageSize = normalizeCollectionPageSize(limit);
  const request = { filter, sort, cursor, limit: pageSize };
  if (!supabase) {
    return emptyPage(request, true, 'Supabase collection storage is not configured.');
  }

  let userId: string | null = null;
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Sign in again to load your collection.');
    userId = user.id;

    const relatedFilters = await loadRelatedFilterIds(user.id, filter);

    let itemQuery = supabase
      .from('inventory_items')
      .select('id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data')
      .eq('user_id', user.id);

    itemQuery = applyInventoryFilters(itemQuery as unknown as InventoryQuery, filter, relatedFilters) as unknown as typeof itemQuery;
    itemQuery = applyInventorySort(itemQuery as unknown as InventoryQuery, sort) as unknown as typeof itemQuery;
    itemQuery = applyInventoryCursor(itemQuery as unknown as InventoryQuery, sort, cursor) as unknown as typeof itemQuery;
    itemQuery = itemQuery.limit(pageSize + 1);

    if (relatedFilters.blocked) return emptyPage(request, false);

    const [{ data: items, error: itemsError }, { data: locations, error: locationsError }] = await Promise.all([
      itemQuery,
      supabase
        .from('inventory_locations')
        .select('id, name, location_type, data')
        .eq('user_id', user.id)
        .order('name', { ascending: true })
        .limit(100),
    ]);

    if (itemsError) throw new Error(`Collection storage is unavailable: ${itemsError.message}`);
    if (locationsError) throw new Error(`Storage locations are unavailable: ${locationsError.message}`);

    const fetchedItems = (items ?? []) as RawInventoryItem[];
    const rawItems = fetchedItems.slice(0, pageSize);
    const itemIds = rawItems.map((item) => item.id).filter(Boolean);
    const cardNames = [...new Set(rawItems.map((item) => item.card_name).filter((name): name is string => typeof name === 'string' && name.length > 0))];
    const [{ data: tradeStatuses }, { data: wishlist }] = await Promise.all([
      itemIds.length
        ? supabase
          .from('binder_card_trade_status')
          .select('inventory_item_id, status')
          .eq('user_id', user.id)
          .in('inventory_item_id', itemIds)
        : Promise.resolve({ data: [] }),
      cardNames.length
        ? supabase
          .from('collector_wishlist')
          .select('card_name, set_code, target_condition, target_finish')
          .eq('user_id', user.id)
          .in('card_name', cardNames)
          .limit(1000)
        : Promise.resolve({ data: [] }),
    ]);
    const cards = buildCollectionCards({
      items: rawItems,
      locations: (locations ?? []) as RawInventoryLocation[],
      tradeStatuses: (tradeStatuses ?? []) as RawTradeBinderStatus[],
      wishlist: (wishlist ?? []) as RawWishlistItem[],
    });
    await appStorage.setItem(collectorCacheKeyForUser(user.id), JSON.stringify(cards));
    return {
      cards,
      locations: buildStorageLocations((locations ?? []) as RawInventoryLocation[]),
      totalQuantity: cards.reduce((sum, card) => sum + card.quantityOwned, 0),
      stale: false,
      pageInfo: buildCollectionPageInfo({ cards, request, hasMore: fetchedItems.length > pageSize }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Collection data is unavailable.';
    return userId
      ? loadCachedCollectionPage(userId, request, message)
      : emptyPage(request, true, message);
  }
}

export async function loadCollectorCardById(cardId: string): Promise<CollectorCollectionPage> {
  if (!supabase) {
    return emptyPage({}, true, 'Supabase collection storage is not configured.');
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
    if (!item) return emptyPage({}, false);

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

    const cards = buildCollectionCards({
      items: [item as RawInventoryItem],
      locations: (locations ?? []) as RawInventoryLocation[],
      tradeStatuses: (tradeStatuses ?? []) as RawTradeBinderStatus[],
      wishlist: (wishlist ?? []) as RawWishlistItem[],
    });

    return {
      cards,
      locations: buildStorageLocations((locations ?? []) as RawInventoryLocation[]),
      totalQuantity: (quantityRows ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0),
      stale: false,
      pageInfo: buildCollectionPageInfo({ cards, request: {} }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Card details are unavailable.';
    return userId
      ? loadCachedCard(userId, cardId, message)
      : emptyPage({}, true, message);
  }
}

async function loadCachedCollectionPage(userId: string, request: CollectionPageRequest, unavailableReason: string): Promise<CollectorCollectionPage> {
  const cached = await appStorage.getItem(collectorCacheKeyForUser(userId));
  if (!cached) return emptyPage(request, true, unavailableReason);
  try {
    const parsed: unknown = JSON.parse(cached);
    const cards = Array.isArray(parsed) ? (parsed as CollectionCard[]) : [];
    return {
      cards,
      locations: [],
      totalQuantity: cards.reduce((sum, card) => sum + card.quantityOwned, 0),
      stale: true,
      pageInfo: buildCollectionPageInfo({ cards, request }),
      unavailableReason,
    };
  } catch {
    return emptyPage(request, true, unavailableReason);
  }
}

async function loadCachedCard(userId: string, cardId: string, unavailableReason: string): Promise<CollectorCollectionPage> {
  const cached = await loadCachedCollectionPage(userId, {}, unavailableReason);
  return {
    ...cached,
    cards: cached.cards.filter((card) => card.id === cardId),
  };
}

async function loadRelatedFilterIds(userId: string, filter?: CollectionFilter) {
  if (!supabase) return { blocked: false as const };
  const tradeStatus = filter?.tradeBinderStatus;
  const wishlistStatus = filter?.wishlistStatus;
  const [tradeResult, wishlistResult] = await Promise.all([
    tradeStatus && tradeStatus !== 'all'
      ? supabase
        .from('binder_card_trade_status')
        .select('inventory_item_id')
        .eq('user_id', userId)
        .in('status', tradeStatus === 'tradeable'
          ? ['available', 'reserved', 'pending', 'looking_for_upgrade', 'for_sale']
          : [tradeStatus])
        .limit(1000)
      : Promise.resolve({ data: null, error: null }),
    wishlistStatus && wishlistStatus !== 'all'
      ? supabase
        .from('collector_wishlist')
        .select('card_name')
        .eq('user_id', userId)
        .limit(1000)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (tradeResult.error) throw new Error(`Trade Binder filters are unavailable: ${tradeResult.error.message}`);
  if (wishlistResult.error) throw new Error(`Wishlist filters are unavailable: ${wishlistResult.error.message}`);

  const tradeIds = tradeStatus && tradeStatus !== 'all'
    ? (tradeResult.data ?? []).map((row) => row.inventory_item_id).filter((id): id is string => typeof id === 'string' && id.length > 0)
    : null;
  const wishlistNames = wishlistStatus === 'wanted'
    ? [...new Set((wishlistResult.data ?? []).map((row) => row.card_name).filter((name): name is string => typeof name === 'string' && name.length > 0))]
    : null;

  return {
    blocked: Boolean((tradeIds && tradeIds.length === 0) || (wishlistNames && wishlistNames.length === 0)),
    tradeIds,
    wishlistNames,
  };
}

function applyInventoryFilters(query: InventoryQuery, filter: CollectionFilter | undefined, related: Awaited<ReturnType<typeof loadRelatedFilterIds>>) {
  let next = query;
  const cleanQuery = filter?.query?.trim();
  if (cleanQuery) {
    const pattern = `%${cleanQuery.replace(/[%_]/g, '')}%`;
    next = next.or(`card_name.ilike.${pattern},set_code.ilike.${pattern},collector_number.ilike.${pattern}`);
  }
  if (filter?.condition && filter.condition !== 'all') next = next.eq('data->>condition', filter.condition);
  if (filter?.finish && filter.finish !== 'all') next = next.eq('data->>finish', filter.finish);
  if (filter?.setCode && filter.setCode !== 'all') next = next.or(`set_code.eq.${filter.setCode},data->>set.eq.${filter.setCode}`);
  if (filter?.storageLocationId && filter.storageLocationId !== 'all') next = next.eq('location_id', filter.storageLocationId);
  if ('tradeIds' in related && related.tradeIds) next = next.in('id', related.tradeIds);
  if ('wishlistNames' in related && related.wishlistNames) next = next.in('card_name', related.wishlistNames);
  return next;
}

function applyInventorySort(query: InventoryQuery, sort: CollectionSort) {
  if (sort === 'name_asc') return query.order('card_name', { ascending: true }).order('id', { ascending: true });
  if (sort === 'name_desc') return query.order('card_name', { ascending: false }).order('id', { ascending: true });
  if (sort === 'quantity_desc') return query.order('quantity', { ascending: false }).order('id', { ascending: true });
  if (sort === 'set_asc') return query.order('set_code', { ascending: true }).order('collector_number', { ascending: true }).order('id', { ascending: true });
  if (sort === 'price_desc') return query.order('inventory_value', { ascending: false }).order('id', { ascending: true });
  return query.order('updated_at', { ascending: false }).order('id', { ascending: true });
}

function applyInventoryCursor(query: InventoryQuery, sort: CollectionSort, cursor?: string | null) {
  const decoded = decodeCollectionCursor(cursor);
  if (!decoded || decoded.sort !== sort) return query;
  const value = decoded.value;
  if (sort === 'name_asc') return query.or(`card_name.gt.${value},and(card_name.eq.${value},id.gt.${decoded.id})`);
  if (sort === 'name_desc') return query.or(`card_name.lt.${value},and(card_name.eq.${value},id.gt.${decoded.id})`);
  if (sort === 'quantity_desc') return query.or(`quantity.lt.${value},and(quantity.eq.${value},id.gt.${decoded.id})`);
  if (sort === 'price_desc') return query.or(`inventory_value.lt.${value},and(inventory_value.eq.${value},id.gt.${decoded.id})`);
  if (sort === 'set_asc') return query.gt('id', decoded.id);
  return query.or(`updated_at.lt.${value},and(updated_at.eq.${value},id.gt.${decoded.id})`);
}

type InventoryQuery = {
  eq(column: string, value: unknown): InventoryQuery;
  gt(column: string, value: unknown): InventoryQuery;
  in(column: string, values: unknown[]): InventoryQuery;
  limit(count: number): InventoryQuery;
  or(filters: string): InventoryQuery;
  order(column: string, options?: { ascending?: boolean }): InventoryQuery;
};

function emptyPage(request: CollectionPageRequest, stale: boolean, unavailableReason?: string): CollectorCollectionPage {
  return {
    cards: [],
    locations: [],
    totalQuantity: 0,
    stale,
    pageInfo: buildCollectionPageInfo({ cards: [], request }),
    unavailableReason,
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
