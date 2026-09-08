import {
  MEMBERSHIP_PLANS,
  normalizeMembershipTier,
} from './membership-catalog.ts';

export type CardCondition =
  | 'near_mint'
  | 'lightly_played'
  | 'moderately_played'
  | 'heavily_played'
  | 'damaged'
  | 'unknown';

export type CardFinish =
  | 'normal'
  | 'foil'
  | 'etched'
  | 'showcase'
  | 'extended_art'
  | 'borderless'
  | 'serialized'
  | 'unknown';

export type TradeBinderStatus =
  | 'available'
  | 'reserved'
  | 'pending'
  | 'not_for_trade'
  | 'looking_for_upgrade'
  | 'for_sale'
  | 'unknown';

export type WishlistStatus = 'wanted' | 'not_wishlisted' | 'unknown';

export type CardPrinting = {
  scryfallId?: string | null;
  setCode?: string | null;
  setName?: string | null;
  collectorNumber?: string | null;
  language?: string | null;
  finish: CardFinish;
  variant?: string | null;
  treatment?: string | null;
  imageUrl?: string | null;
};

export type StorageLocation = {
  id: string;
  name: string;
  type: 'binder' | 'box' | 'sealed' | 'bulk' | 'custom' | 'unknown';
  parentId?: string | null;
  pathLabel?: string | null;
  description?: string | null;
  zone?: string | null;
  binderPage?: number | null;
  binderSlot?: string | null;
};

export type MarketPrice = {
  amount: number | null;
  currency: 'USD';
  source: 'inventory' | 'scryfall' | 'unavailable';
  updatedAt?: string | null;
};

export type CollectionCard = {
  id: string;
  cardName: string;
  batchCode?: string | null;
  game?: string | null;
  gameId: string;
  gameLabel: string;
  productType: 'card' | 'sealed';
  printing: CardPrinting;
  condition: CardCondition;
  quantityOwned: number;
  storageLocation: StorageLocation | null;
  tradeBinderStatus: TradeBinderStatus;
  wishlistStatus: WishlistStatus;
  marketPrice: MarketPrice;
  costBasisKnown: boolean;
  updatedAt?: string | null;
};

export type CollectionFilter = {
  query?: string;
  gameId?: string | 'all';
  productType?: 'card' | 'sealed' | 'all';
  condition?: CardCondition | 'all';
  finish?: CardFinish | 'all';
  variant?: string | 'all';
  setCode?: string | 'all';
  storageLocationId?: string | 'all';
  tradeBinderStatus?: TradeBinderStatus | 'all' | 'tradeable';
  wishlistStatus?: WishlistStatus | 'all';
};

export type InventoryHealthIssueId =
  | 'unassigned'
  | 'missing_price'
  | 'missing_cost_basis'
  | 'unknown_condition'
  | 'unknown_finish';

export type InventoryHealthIssue = {
  id: InventoryHealthIssueId;
  label: string;
  count: number;
  severity: 'attention' | 'neutral';
};

export type InventoryHealthSummary = {
  score: number;
  locatedQuantity: number;
  unassignedQuantity: number;
  issues: InventoryHealthIssue[];
};

export type CollectionSort =
  | 'name_asc'
  | 'name_desc'
  | 'recently_updated'
  | 'quantity_desc'
  | 'set_asc'
  | 'price_desc';

export type CollectionSummary = {
  totalOwnedCards: number;
  uniquePrintings: number;
  games: Array<{
    gameId: string;
    label: string;
    quantity: number;
    uniquePrintings: number;
    knownMarketValue: number | null;
  }>;
  productTypes: Array<{
    productType: 'card' | 'sealed';
    quantity: number;
    uniquePrintings: number;
    knownMarketValue: number | null;
  }>;
  storageLocationCount: number;
  storedCards: number;
  unassignedCards: number;
  storedQuantity: number;
  unassignedQuantity: number;
  tradeBinderCount: number;
  wishlistCount: number;
  knownMarketValue: number | null;
  missingPriceCount: number;
  freeCardLimit: number | null;
  freeCardLimitRemaining: number | null;
  freeCardLimitExceeded: boolean;
};

export type CollectionViewState =
  | 'loading'
  | 'loading_more'
  | 'empty'
  | 'no_results'
  | 'ready'
  | 'end'
  | 'error';

export type CollectionCursor = {
  sort: CollectionSort;
  value: string | number | null;
  id: string;
};

export type CollectionPageRequest = {
  filter?: CollectionFilter;
  sort?: CollectionSort;
  cursor?: string | null;
  limit?: number;
};

export type CollectionPageInfo = {
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
  requestKey: string;
};

export type RawInventoryItem = {
  id: string;
  card_name?: string | null;
  sku?: string | null;
  location_id?: string | null;
  game_id?: string | null;
  product_type?: string | null;
  provider_category_id?: string | null;
  provider_product_id?: string | null;
  provider_sku_id?: string | null;
  tcgplayer_product_id?: number | null;
  tcgplayer_sku_id?: number | null;
  variant?: string | null;
  language?: string | null;
  scryfall_id?: string | null;
  set_code?: string | null;
  collector_number?: string | null;
  quantity?: number | null;
  inventory_value?: number | null;
  updated_at?: string | null;
  data?: Record<string, unknown> | null;
};

export type RawInventoryLocation = {
  id: string;
  name?: string | null;
  location_type?: string | null;
  data?: Record<string, unknown> | null;
};

export type RawTradeBinderStatus = {
  inventory_item_id?: string | null;
  status?: string | null;
};

export type RawWishlistItem = {
  card_name?: string | null;
  set_code?: string | null;
  target_condition?: string | null;
  target_finish?: string | null;
};

export type BuildCollectionInput = {
  items: RawInventoryItem[];
  locations?: RawInventoryLocation[];
  tradeStatuses?: RawTradeBinderStatus[];
  wishlist?: RawWishlistItem[];
};

export const COLLECTION_PAGE_SIZE = 100;
export const COLLECTION_MAX_PAGE_SIZE = 100;
export const COLLECTION_CACHE_KEY_PREFIX = 'trading-docks-collector-workspace-cache-v1';

export function collectorCacheKeyForUser(userId: string) {
  return `${COLLECTION_CACHE_KEY_PREFIX}:${userId}`;
}

export function buildCollectionCards({
  items,
  locations = [],
  tradeStatuses = [],
  wishlist = [],
}: BuildCollectionInput): CollectionCard[] {
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const pathByLocationId = buildLocationPathLabels(locations);
  const tradeByItemId = new Map(
    tradeStatuses
      .filter((status) => typeof status.inventory_item_id === 'string')
      .map((status) => [status.inventory_item_id as string, normalizeTradeBinderStatus(status.status)]),
  );

  return items
    .filter((item) => typeof item.id === 'string' && item.id.length > 0)
    .map((item) => {
      const payload = item.data ?? {};
      const locationId = stringValue(payload.locationId) || item.location_id || null;
      const rawLocation = locationId ? locationById.get(locationId) : undefined;
      const quantityOwned = positiveNumber(item.quantity) ?? positiveNumber(payload.quantity) ?? 0;
      const inventoryValue = numberValue(item.inventory_value) ?? numberValue(payload.value);
      const costBasisKnown = knownCostBasisValue(payload) !== null;
      const unitMarketValue =
        positiveNumber(payload.unitMarketValue) ??
        (inventoryValue !== null && inventoryValue > 0 && quantityOwned > 0 ? inventoryValue / quantityOwned : null);
      const productType = normalizeProductType(item.product_type ?? payload.productType ?? payload.product_type);
      const cardName = stringValue(payload.name) || item.card_name || (productType === 'sealed' ? 'Unnamed sealed product' : 'Unnamed card');
      const batchCode = stringValue(payload.batchCode) || stringValue(payload.batch_code) || null;
      const gameId = normalizeCollectionGameId(item.game_id ?? payload.gameId ?? payload.game_id ?? payload.game);
      const gameLabel = collectionGameLabel(gameId, payload.gameLabel ?? payload.game ?? item.provider_category_id);
      const condition = normalizeCardCondition(payload.condition);
      const variant = stringValue(item.variant) || stringValue(payload.variant) || stringValue(payload.finish) || stringValue(payload.treatment) || null;
      const finish = normalizeCardFinish(variant);
      const language = stringValue(item.language) || stringValue(payload.language) || null;
      const printing: CardPrinting = {
        scryfallId: stringValue(payload.scryfallId) || item.scryfall_id || null,
        setCode: stringValue(payload.set) || item.set_code || null,
        setName: stringValue(payload.setName) || null,
        collectorNumber: stringValue(payload.collectorNumber) || item.collector_number || null,
        language,
        finish,
        variant,
        treatment: stringValue(payload.treatment) || null,
        imageUrl: resolveCardImageUrl({
          explicitImageUrl: stringValue(payload.imageUrl),
          scryfallId: gameId === 'magic' ? stringValue(payload.scryfallId) || item.scryfall_id || null : null,
          setCode: stringValue(payload.set) || item.set_code || null,
          collectorNumber: stringValue(payload.collectorNumber) || item.collector_number || null,
        }),
      };

      return {
        id: item.id,
        cardName,
        batchCode,
        game: gameLabel,
        gameId,
        gameLabel,
        productType,
        printing,
        condition,
        quantityOwned,
        storageLocation: rawLocation
          ? buildStorageLocation(rawLocation, payload, pathByLocationId.get(rawLocation.id) ?? null)
          : locationId
            ? {
                id: locationId,
                name: 'Storage location unavailable',
                type: 'unknown',
                parentId: null,
                pathLabel: 'Storage location unavailable',
                binderPage: numberValue(payload.binderPage),
                binderSlot: stringValue(payload.binderSlot) || null,
              }
            : null,
        tradeBinderStatus: tradeByItemId.get(item.id) ?? normalizeTradeBinderStatus(payload.tradeBinderStatus),
        wishlistStatus: resolveWishlistStatus(cardName, printing, condition, finish, wishlist),
        marketPrice: {
          amount: unitMarketValue,
          currency: 'USD',
          source: unitMarketValue === null ? 'unavailable' : 'inventory',
          updatedAt: item.updated_at ?? stringValue(payload.updatedAt) ?? null,
        },
        costBasisKnown,
        updatedAt: item.updated_at ?? stringValue(payload.updatedAt) ?? null,
      };
    });
}

export function shouldRenderCollectionItems(state: CollectionViewState, visibleCount: number) {
  return visibleCount > 0 && state !== 'loading' && state !== 'empty' && state !== 'no_results';
}

export function filterCollectionCards(
  cards: CollectionCard[],
  filter: CollectionFilter,
) {
  const query = normalizeSearchText(filter.query ?? '');
  return cards.filter((card) => {
    const searchHaystack = normalizeSearchText(
      [
        card.cardName,
        card.printing.setName,
        card.printing.setCode,
        card.printing.collectorNumber,
        card.storageLocation?.name,
        card.storageLocation?.pathLabel,
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (query && !searchHaystack.includes(query)) return false;
    if (filter.gameId && filter.gameId !== 'all' && card.gameId !== filter.gameId) return false;
    if (filter.productType && filter.productType !== 'all' && card.productType !== filter.productType) return false;
    if (filter.condition && filter.condition !== 'all' && card.condition !== filter.condition) return false;
    if (filter.finish && filter.finish !== 'all' && card.printing.finish !== filter.finish) return false;
    if (filter.variant && filter.variant !== 'all' && normalizeSearchText(card.printing.variant ?? '') !== normalizeSearchText(filter.variant)) return false;
    if (filter.setCode && filter.setCode !== 'all' && card.printing.setCode?.toLowerCase() !== filter.setCode.toLowerCase()) return false;
    if (
      filter.storageLocationId &&
      filter.storageLocationId !== 'all' &&
      card.storageLocation?.id !== filter.storageLocationId
    ) {
      return false;
    }
    if (
      filter.tradeBinderStatus &&
      filter.tradeBinderStatus !== 'all' &&
      filter.tradeBinderStatus !== 'tradeable' &&
      card.tradeBinderStatus !== filter.tradeBinderStatus
    ) {
      return false;
    }
    if (filter.tradeBinderStatus === 'tradeable' && card.tradeBinderStatus === 'not_for_trade') return false;
    if (
      filter.wishlistStatus &&
      filter.wishlistStatus !== 'all' &&
      card.wishlistStatus !== filter.wishlistStatus
    ) {
      return false;
    }
    return true;
  });
}

export function sortCollectionCards(cards: CollectionCard[], sort: CollectionSort) {
  return [...cards].sort((a, b) => {
    if (sort === 'name_desc') return b.cardName.localeCompare(a.cardName);
    if (sort === 'recently_updated') return timestamp(b.updatedAt) - timestamp(a.updatedAt);
    if (sort === 'quantity_desc') return b.quantityOwned - a.quantityOwned || a.cardName.localeCompare(b.cardName);
    if (sort === 'set_asc') {
      return (
        (a.printing.setCode ?? '').localeCompare(b.printing.setCode ?? '') ||
        (a.printing.collectorNumber ?? '').localeCompare(b.printing.collectorNumber ?? '', undefined, { numeric: true }) ||
        a.cardName.localeCompare(b.cardName)
      );
    }
    if (sort === 'price_desc') {
      return (b.marketPrice.amount ?? -1) - (a.marketPrice.amount ?? -1) || a.cardName.localeCompare(b.cardName);
    }
    return a.cardName.localeCompare(b.cardName);
  });
}

export function resolveCollectionViewState({
  loading,
  loadingMore,
  error,
  totalCount,
  visibleCount,
  hasMore,
}: {
  loading: boolean;
  loadingMore?: boolean;
  error?: string | null;
  totalCount: number;
  visibleCount: number;
  hasMore?: boolean;
}): CollectionViewState {
  if (loading) return 'loading';
  if (loadingMore) return 'loading_more';
  if (error) return 'error';
  if (totalCount === 0) return 'empty';
  if (visibleCount === 0) return 'no_results';
  if (hasMore === false) return 'end';
  return 'ready';
}

export function normalizeCollectionPageSize(limit: unknown) {
  const parsed = typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : COLLECTION_PAGE_SIZE;
  return Math.min(Math.max(parsed, 1), COLLECTION_MAX_PAGE_SIZE);
}

export function collectionRequestKey({
  filter = {},
  sort = 'recently_updated',
  limit = COLLECTION_PAGE_SIZE,
}: Omit<CollectionPageRequest, 'cursor'>) {
  return JSON.stringify({
    filter: {
      query: normalizeSearchText(filter.query ?? ''),
      gameId: filter.gameId ?? 'all',
      productType: filter.productType ?? 'all',
      condition: filter.condition ?? 'all',
      finish: filter.finish ?? 'all',
      variant: normalizeSearchText(filter.variant && filter.variant !== 'all' ? filter.variant : ''),
      setCode: normalizeSearchText(filter.setCode && filter.setCode !== 'all' ? filter.setCode : ''),
      storageLocationId: filter.storageLocationId ?? 'all',
      tradeBinderStatus: filter.tradeBinderStatus ?? 'all',
      wishlistStatus: filter.wishlistStatus ?? 'all',
    },
    sort,
    limit: normalizeCollectionPageSize(limit),
  });
}

export function encodeCollectionCursor(cursor: CollectionCursor) {
  return [
    encodeURIComponent(cursor.sort),
    encodeURIComponent(String(cursor.value ?? '')),
    encodeURIComponent(cursor.id),
  ].join('|');
}

export function decodeCollectionCursor(value?: string | null): CollectionCursor | null {
  if (!value) return null;
  const [sort, rawCursorValue, id] = value.split('|').map((part) => decodeURIComponent(part ?? ''));
  if (!isCollectionSort(sort) || !id) return null;
  return { sort, value: rawCursorValue || null, id };
}

export function cursorForCollectionCard(card: CollectionCard, sort: CollectionSort) {
  return encodeCollectionCursor({ sort, value: sortCursorValue(card, sort), id: card.id });
}

export function buildCollectionPageInfo({
  cards,
  request,
  hasMore,
}: {
  cards: CollectionCard[];
  request: CollectionPageRequest;
  hasMore?: boolean;
}): CollectionPageInfo {
  const pageSize = normalizeCollectionPageSize(request.limit);
  const pageHasMore = hasMore ?? cards.length === pageSize;
  const lastCard = cards.at(-1);
  return {
    nextCursor: pageHasMore && lastCard ? cursorForCollectionCard(lastCard, request.sort ?? 'recently_updated') : null,
    hasMore: pageHasMore,
    pageSize,
    requestKey: collectionRequestKey({ filter: request.filter, sort: request.sort, limit: pageSize }),
  };
}

export function mergeCollectionPages(existing: CollectionCard[], nextPage: CollectionCard[], reset = false) {
  if (reset) return [...nextPage];
  const byId = new Map(existing.map((card) => [card.id, card]));
  for (const card of nextPage) byId.set(card.id, card);
  return [...byId.values()];
}

export function shouldAcceptCollectionResponse(activeRequestKey: string, responseRequestKey: string) {
  return activeRequestKey === responseRequestKey;
}

export function buildInventorySearchFilterExpression(query: string, locationIds?: string[] | null) {
  const pattern = `%${query.trim().replace(/[%_]/g, '')}%`;
  const filters = [
    `card_name.ilike.${pattern}`,
    `set_code.ilike.${pattern}`,
    `collector_number.ilike.${pattern}`,
  ];
  if (locationIds?.length) {
    filters.push(`location_id.in.(${locationIds.map(encodeSupabaseListValue).join(',')})`);
  }
  return filters.join(',');
}

function encodeSupabaseListValue(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function summarizeCollectionCards(
  cards: CollectionCard[],
  tier: unknown,
  options: { ignoreFreeLimit?: boolean } = {},
): CollectionSummary {
  const plan = MEMBERSHIP_PLANS[normalizeMembershipTier(tier)];
  const totalOwnedCards = cards.reduce((sum, card) => sum + card.quantityOwned, 0);
  const pricedCards = cards.filter((card) => card.marketPrice.amount !== null);
  const knownMarketValue = pricedCards.length
    ? cards.reduce((sum, card) => sum + (card.marketPrice.amount ?? 0) * card.quantityOwned, 0)
    : null;
  const storageIds = new Set(cards.map((card) => card.storageLocation?.id).filter(Boolean));
  const stored = cards.filter((card) => Boolean(card.storageLocation));
  const unassigned = cards.filter((card) => !card.storageLocation);
  const wishlistCount = cards.filter((card) => card.wishlistStatus === 'wanted').length;
  const tradeBinderCount = cards.filter((card) =>
    card.tradeBinderStatus === 'available' ||
    card.tradeBinderStatus === 'reserved' ||
    card.tradeBinderStatus === 'pending' ||
    card.tradeBinderStatus === 'for_sale',
  ).length;
  const games = summarizeBy(cards, (card) => card.gameId, (card) => card.gameLabel);
  const productTypes = summarizeBy(
    cards,
    (card) => card.productType,
    (card) => card.productType === 'sealed' ? 'Sealed' : 'Cards',
  ).map((entry) => ({
    productType: entry.gameId as 'card' | 'sealed',
    quantity: entry.quantity,
    uniquePrintings: entry.uniquePrintings,
    knownMarketValue: entry.knownMarketValue,
  }));

  return {
    totalOwnedCards,
    uniquePrintings: cards.length,
    games,
    productTypes,
    storageLocationCount: storageIds.size,
    storedCards: stored.length,
    unassignedCards: unassigned.length,
    storedQuantity: stored.reduce((sum, card) => sum + card.quantityOwned, 0),
    unassignedQuantity: unassigned.reduce((sum, card) => sum + card.quantityOwned, 0),
    tradeBinderCount,
    wishlistCount,
    knownMarketValue,
    missingPriceCount: cards.length - pricedCards.length,
    freeCardLimit: plan.id === 'free' && !options.ignoreFreeLimit ? plan.limits.cardLimit : null,
    freeCardLimitRemaining:
      plan.id === 'free' && !options.ignoreFreeLimit && plan.limits.cardLimit !== null
        ? Math.max(0, plan.limits.cardLimit - totalOwnedCards)
        : null,
    freeCardLimitExceeded:
      plan.id === 'free' && !options.ignoreFreeLimit && plan.limits.cardLimit !== null
        ? totalOwnedCards > plan.limits.cardLimit
        : false,
  };
}

export function countActiveCollectionFilters(filter: CollectionFilter) {
  return [
    filter.query?.trim() ? 'query' : null,
    filter.gameId && filter.gameId !== 'all' ? 'gameId' : null,
    filter.productType && filter.productType !== 'all' ? 'productType' : null,
    filter.condition && filter.condition !== 'all' ? 'condition' : null,
    filter.finish && filter.finish !== 'all' ? 'finish' : null,
    filter.variant && filter.variant !== 'all' ? 'variant' : null,
    filter.setCode && filter.setCode !== 'all' ? 'setCode' : null,
    filter.storageLocationId && filter.storageLocationId !== 'all' ? 'storageLocationId' : null,
    filter.tradeBinderStatus && filter.tradeBinderStatus !== 'all' ? 'tradeBinderStatus' : null,
    filter.wishlistStatus && filter.wishlistStatus !== 'all' ? 'wishlistStatus' : null,
  ].filter(Boolean).length;
}

export function buildInventoryHealth(cards: CollectionCard[]): InventoryHealthSummary {
  const totalQuantity = cards.reduce((sum, card) => sum + card.quantityOwned, 0);
  const locatedQuantity = cards
    .filter((card) => Boolean(card.storageLocation))
    .reduce((sum, card) => sum + card.quantityOwned, 0);
  const unassignedQuantity = Math.max(0, totalQuantity - locatedQuantity);
  const missingPrice = cards.filter((card) => card.marketPrice.amount === null).length;
  const missingCostBasis = cards.filter((card) => !card.costBasisKnown).length;
  const unknownCondition = cards.filter((card) => card.condition === 'unknown').length;
  const unknownFinish = cards.filter((card) => card.printing.finish === 'unknown').length;
  const weightedIssues = unassignedQuantity + missingPrice + missingCostBasis + unknownCondition + unknownFinish;
  const score = totalQuantity <= 0 ? 100 : Math.max(0, Math.round(((totalQuantity - weightedIssues) / totalQuantity) * 100));

  const issues: InventoryHealthIssue[] = [
    { id: 'unassigned', label: 'Need storage location', count: unassignedQuantity, severity: 'attention' },
    { id: 'missing_price', label: 'Missing market value', count: missingPrice, severity: 'neutral' },
    { id: 'missing_cost_basis', label: 'Missing cost basis', count: missingCostBasis, severity: 'neutral' },
    { id: 'unknown_condition', label: 'Condition unavailable', count: unknownCondition, severity: 'neutral' },
    { id: 'unknown_finish', label: 'Finish unavailable', count: unknownFinish, severity: 'neutral' },
  ];

  return {
    score,
    locatedQuantity,
    unassignedQuantity,
    issues: issues.filter((issue) => issue.count > 0),
  };
}

export function displayPrinting(printing: CardPrinting) {
  const setLabel = printing.setCode?.toUpperCase() ?? 'Set unavailable';
  const collectorNumber = printing.collectorNumber ? `#${printing.collectorNumber}` : 'number unavailable';
  return `${setLabel} ${collectorNumber}`;
}

export function displayCondition(condition: CardCondition) {
  const labels: Record<CardCondition, string> = {
    near_mint: 'Near Mint',
    lightly_played: 'Lightly Played',
    moderately_played: 'Moderately Played',
    heavily_played: 'Heavily Played',
    damaged: 'Damaged',
    unknown: 'Condition unavailable',
  };
  return labels[condition];
}

export function displayFinish(finish: CardFinish) {
  const labels: Record<CardFinish, string> = {
    normal: 'Normal',
    foil: 'Foil',
    etched: 'Etched',
    showcase: 'Showcase',
    extended_art: 'Extended Art',
    borderless: 'Borderless',
    serialized: 'Serialized',
    unknown: 'Finish unavailable',
  };
  return labels[finish];
}

export function displayVariant(card: CollectionCard) {
  return card.printing.variant || displayFinish(card.printing.finish);
}

export function displayStorageLocation(card: CollectionCard) {
  if (!card.storageLocation) return 'Storage unavailable';
  const base = card.storageLocation.pathLabel || card.storageLocation.name;
  return [
    base,
    card.storageLocation.binderPage ? `Page ${card.storageLocation.binderPage}` : '',
    card.storageLocation.binderSlot ? `Slot ${card.storageLocation.binderSlot}` : '',
  ].filter(Boolean).join(' › ');
}

export function priceLabel(card: CollectionCard) {
  if (card.marketPrice.amount === null) return 'Price unavailable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: card.marketPrice.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(card.marketPrice.amount);
}

export function isPhysicalTradeBinderLocation(location?: StorageLocation | null) {
  if (!location) return false;
  const text = `${location.name} ${location.pathLabel ?? ''} ${location.type}`.toLowerCase();
  return location.type === 'binder' && text.includes('trade');
}

export function isPhysicalTradeBinderCard(card: CollectionCard) {
  return isPhysicalTradeBinderLocation(card.storageLocation);
}

export function filterLooseCollectionCards(cards: CollectionCard[]) {
  return cards.filter((card) => !isPhysicalTradeBinderCard(card));
}

export function buildCollectionLotKey(card: CollectionCard) {
  return [
    card.gameId,
    card.productType,
    card.cardName.trim().toLowerCase(),
    card.printing.scryfallId ?? '',
    card.printing.setCode?.toLowerCase() ?? '',
    card.printing.collectorNumber ?? '',
    card.printing.language?.toLowerCase() ?? '',
    card.printing.finish,
    card.condition,
  ].join('|');
}

export function resolveCardImageUrl({
  explicitImageUrl,
  scryfallId,
  setCode,
  collectorNumber,
}: {
  explicitImageUrl?: string | null;
  scryfallId?: string | null;
  setCode?: string | null;
  collectorNumber?: string | null;
}) {
  const explicit = explicitImageUrl?.trim();
  if (explicit) return explicit;
  const cleanScryfallId = scryfallId?.trim();
  if (cleanScryfallId) {
    return `https://api.scryfall.com/cards/${encodeURIComponent(cleanScryfallId)}?format=image&version=normal`;
  }
  const cleanSetCode = setCode?.trim().toLowerCase();
  const cleanCollectorNumber = collectorNumber?.trim();
  if (cleanSetCode && cleanCollectorNumber) {
    return `https://api.scryfall.com/cards/${encodeURIComponent(cleanSetCode)}/${encodeURIComponent(cleanCollectorNumber)}?format=image&version=normal`;
  }
  return null;
}

export function normalizeCardCondition(value: unknown): CardCondition {
  const normalized = normalizeSearchText(String(value ?? '')).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const compact = normalized.replace(/_/g, '');
  if (normalized === 'nm' || normalized === 'near_mint' || compact === 'nearmint') return 'near_mint';
  if (normalized === 'lp' || normalized === 'lightly_played' || compact === 'lightplayed' || compact === 'lightlyplayed') return 'lightly_played';
  if (normalized === 'mp' || normalized === 'moderately_played' || compact === 'modplayed' || compact === 'moderatelyplayed') return 'moderately_played';
  if (normalized === 'hp' || normalized === 'heavily_played' || compact === 'heavyplayed' || compact === 'heavilyplayed') return 'heavily_played';
  if (normalized === 'damaged' || normalized === 'dm') return 'damaged';
  return 'unknown';
}

export function normalizeCardFinish(value: unknown): CardFinish {
  const normalized = normalizeSearchText(String(value ?? '')).replace(/[\s-]+/g, '_');
  if (normalized === 'nonfoil' || normalized === 'non_foil' || normalized === 'normal' || normalized === 'regular') return 'normal';
  if (normalized.includes('serialized')) return 'serialized';
  if (normalized.includes('borderless')) return 'borderless';
  if (normalized.includes('extended')) return 'extended_art';
  if (normalized.includes('showcase')) return 'showcase';
  if (normalized.includes('etched')) return 'etched';
  if (normalized.includes('foil')) return 'foil';
  return 'unknown';
}

export function normalizeTradeBinderStatus(value: unknown): TradeBinderStatus {
  if (
    value === 'available' ||
    value === 'reserved' ||
    value === 'pending' ||
    value === 'not_for_trade' ||
    value === 'looking_for_upgrade' ||
    value === 'for_sale'
  ) {
    return value;
  }
  return 'not_for_trade';
}

function buildStorageLocation(
  rawLocation: RawInventoryLocation,
  itemPayload: Record<string, unknown>,
  pathLabel: string | null,
): StorageLocation {
  const data = rawLocation.data ?? {};
  return {
    id: rawLocation.id,
    name: stringValue(data.name) || rawLocation.name || 'Unnamed location',
    type: normalizeStorageType(data.type ?? rawLocation.location_type),
    parentId: stringValue(data.parentId) || null,
    pathLabel,
    description: stringValue(data.description) || null,
    zone: stringValue(data.zone) || null,
    binderPage: numberValue(itemPayload.binderPage),
    binderSlot: stringValue(itemPayload.binderSlot) || null,
  };
}

export function buildCollectionLocationPathLabel(locationId: string, locations: RawInventoryLocation[], separator = ' › ') {
  return buildLocationPathLabels(locations, separator).get(locationId) ?? null;
}

function buildLocationPathLabels(locations: RawInventoryLocation[], separator = ' › ') {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const labels = new Map<string, string>();
  for (const location of locations) {
    const nodes: string[] = [];
    const seen = new Set<string>();
    let current: RawInventoryLocation | undefined = location;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      nodes.unshift(stringValue(current.data?.name) || current.name || 'Unnamed location');
      const parentId = stringValue(current.data?.parentId);
      current = parentId ? byId.get(parentId) : undefined;
    }
    labels.set(location.id, nodes.join(separator));
  }
  return labels;
}

function normalizeStorageType(value: unknown): StorageLocation['type'] {
  if (value === 'binder') return 'binder';
  if (value === 'sealed-local' || value === 'sealed-warehouse' || value === 'sealed') return 'sealed';
  if (value === 'bulk' || value === 'chaos') return 'bulk';
  if (value === 'box') return 'box';
  if (value === 'custom') return 'custom';
  return 'unknown';
}

function resolveWishlistStatus(
  cardName: string,
  printing: CardPrinting,
  condition: CardCondition,
  finish: CardFinish,
  wishlist: RawWishlistItem[],
): WishlistStatus {
  const match = wishlist.some((item) => {
    const nameMatches = normalizeSearchText(item.card_name ?? '') === normalizeSearchText(cardName);
    const setMatches = !item.set_code || !printing.setCode || item.set_code.toLowerCase() === printing.setCode.toLowerCase();
    const conditionMatches =
      !item.target_condition ||
      normalizeCardCondition(item.target_condition) === condition;
    const finishMatches =
      !item.target_finish ||
      normalizeCardFinish(item.target_finish) === finish;
    return nameMatches && setMatches && conditionMatches && finishMatches;
  });
  return match ? 'wanted' : 'not_wishlisted';
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCollectionGameId(value: unknown) {
  const normalized = normalizeSearchText(String(value ?? ''));
  if (normalized === 'pokemon' || normalized === 'ptcg' || normalized === 'pkm' || normalized === '3') return 'pokemon';
  if (
    normalized === 'magic' ||
    normalized === 'mtg' ||
    normalized === 'magic: the gathering' ||
    normalized === '1' ||
    normalized === ''
  ) {
    return 'magic';
  }
  return normalized.replace(/[^a-z0-9-]+/g, '-') || 'magic';
}

function collectionGameLabel(gameId: string, value: unknown) {
  const explicit = stringValue(value);
  if (explicit && explicit !== '1' && explicit !== '3') return explicit;
  if (gameId === 'pokemon') return 'Pokemon';
  if (gameId === 'magic') return 'Magic: The Gathering';
  return gameId
    .split('-')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ') || 'Unknown game';
}

function normalizeProductType(value: unknown): 'card' | 'sealed' {
  const normalized = normalizeSearchText(String(value ?? ''));
  return normalized === 'sealed' ||
    normalized === 'sealed_product' ||
    normalized === 'sealed-product' ||
    normalized === 'unopened'
    ? 'sealed'
    : 'card';
}

function summarizeBy(
  cards: CollectionCard[],
  keyForCard: (card: CollectionCard) => string,
  labelForCard: (card: CollectionCard) => string,
) {
  const byKey = new Map<string, {
    gameId: string;
    label: string;
    quantity: number;
    uniquePrintings: number;
    knownMarketValue: number | null;
    missingPriceCount: number;
  }>();
  for (const card of cards) {
    const key = keyForCard(card);
    const current = byKey.get(key) ?? {
      gameId: key,
      label: labelForCard(card),
      quantity: 0,
      uniquePrintings: 0,
      knownMarketValue: null,
      missingPriceCount: 0,
    };
    current.quantity += card.quantityOwned;
    current.uniquePrintings += 1;
    if (card.marketPrice.amount === null) {
      current.missingPriceCount += 1;
    } else {
      current.knownMarketValue = (current.knownMarketValue ?? 0) + card.marketPrice.amount * card.quantityOwned;
    }
    byKey.set(key, current);
  }
  return [...byKey.values()].map(({ missingPriceCount: _missingPriceCount, ...summary }) => ({
    ...summary,
    knownMarketValue: summary.knownMarketValue,
  }));
}

function isCollectionSort(value: string): value is CollectionSort {
  return (
    value === 'name_asc' ||
    value === 'name_desc' ||
    value === 'recently_updated' ||
    value === 'quantity_desc' ||
    value === 'set_asc' ||
    value === 'price_desc'
  );
}

function sortCursorValue(card: CollectionCard, sort: CollectionSort): string | number | null {
  if (sort === 'name_asc' || sort === 'name_desc') return card.cardName;
  if (sort === 'quantity_desc') return card.quantityOwned;
  if (sort === 'set_asc') return `${card.printing.setCode ?? ''}:${card.printing.collectorNumber ?? ''}:${card.cardName}`;
  if (sort === 'price_desc') return card.marketPrice.amount ?? -1;
  return card.updatedAt ?? null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function positiveNumber(value: unknown) {
  const parsed = numberValue(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function nonNegativeNumber(value: unknown) {
  const parsed = numberValue(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function knownCostBasisValue(payload: Record<string, unknown>) {
  return nonNegativeNumber(payload.unitCost)
    ?? nonNegativeNumber(payload.costBasis)
    ?? nonNegativeNumber(payload.purchasePrice)
    ?? nonNegativeNumber(payload.totalCost)
    ?? nonNegativeNumber(payload.totalCostBasis);
}

function timestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
