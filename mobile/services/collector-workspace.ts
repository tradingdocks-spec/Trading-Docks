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
  treatment?: string | null;
  imageUrl?: string | null;
};

export type StorageLocation = {
  id: string;
  name: string;
  type: 'binder' | 'box' | 'sealed' | 'bulk' | 'custom' | 'unknown';
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
  game?: string | null;
  printing: CardPrinting;
  condition: CardCondition;
  quantityOwned: number;
  storageLocation: StorageLocation | null;
  tradeBinderStatus: TradeBinderStatus;
  wishlistStatus: WishlistStatus;
  marketPrice: MarketPrice;
  updatedAt?: string | null;
};

export type CollectionFilter = {
  query?: string;
  condition?: CardCondition | 'all';
  finish?: CardFinish | 'all';
  storageLocationId?: string | 'all';
  tradeBinderStatus?: TradeBinderStatus | 'all';
  wishlistStatus?: WishlistStatus | 'all';
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
  storageLocationCount: number;
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
  | 'empty'
  | 'no_results'
  | 'ready'
  | 'error';

export type RawInventoryItem = {
  id: string;
  card_name?: string | null;
  sku?: string | null;
  location_id?: string | null;
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
      const unitMarketValue =
        positiveNumber(payload.unitMarketValue) ??
        (inventoryValue !== null && inventoryValue > 0 && quantityOwned > 0 ? inventoryValue / quantityOwned : null);
      const cardName = stringValue(payload.name) || item.card_name || 'Unnamed card';
      const condition = normalizeCardCondition(payload.condition);
      const finish = normalizeCardFinish(payload.finish ?? payload.treatment);
      const printing: CardPrinting = {
        scryfallId: stringValue(payload.scryfallId) || item.scryfall_id || null,
        setCode: stringValue(payload.set) || item.set_code || null,
        setName: stringValue(payload.setName) || null,
        collectorNumber: stringValue(payload.collectorNumber) || item.collector_number || null,
        language: stringValue(payload.language) || null,
        finish,
        treatment: stringValue(payload.treatment) || null,
        imageUrl: stringValue(payload.imageUrl) || null,
      };

      return {
        id: item.id,
        cardName,
        game: stringValue(payload.game) || 'Magic: The Gathering',
        printing,
        condition,
        quantityOwned,
        storageLocation: rawLocation
          ? buildStorageLocation(rawLocation, payload)
          : locationId
            ? {
                id: locationId,
                name: 'Storage location unavailable',
                type: 'unknown',
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
        updatedAt: item.updated_at ?? stringValue(payload.updatedAt) ?? null,
      };
    });
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
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (query && !searchHaystack.includes(query)) return false;
    if (filter.condition && filter.condition !== 'all' && card.condition !== filter.condition) return false;
    if (filter.finish && filter.finish !== 'all' && card.printing.finish !== filter.finish) return false;
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
      card.tradeBinderStatus !== filter.tradeBinderStatus
    ) {
      return false;
    }
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
  error,
  totalCount,
  visibleCount,
}: {
  loading: boolean;
  error?: string | null;
  totalCount: number;
  visibleCount: number;
}): CollectionViewState {
  if (loading) return 'loading';
  if (error) return 'error';
  if (totalCount === 0) return 'empty';
  if (visibleCount === 0) return 'no_results';
  return 'ready';
}

export function summarizeCollectionCards(
  cards: CollectionCard[],
  tier: unknown,
): CollectionSummary {
  const plan = MEMBERSHIP_PLANS[normalizeMembershipTier(tier)];
  const totalOwnedCards = cards.reduce((sum, card) => sum + card.quantityOwned, 0);
  const pricedCards = cards.filter((card) => card.marketPrice.amount !== null);
  const knownMarketValue = pricedCards.length
    ? cards.reduce((sum, card) => sum + (card.marketPrice.amount ?? 0) * card.quantityOwned, 0)
    : null;
  const storageIds = new Set(cards.map((card) => card.storageLocation?.id).filter(Boolean));
  const wishlistCount = cards.filter((card) => card.wishlistStatus === 'wanted').length;
  const tradeBinderCount = cards.filter((card) =>
    card.tradeBinderStatus === 'available' ||
    card.tradeBinderStatus === 'reserved' ||
    card.tradeBinderStatus === 'pending' ||
    card.tradeBinderStatus === 'for_sale',
  ).length;

  return {
    totalOwnedCards,
    uniquePrintings: cards.length,
    storageLocationCount: storageIds.size,
    tradeBinderCount,
    wishlistCount,
    knownMarketValue,
    missingPriceCount: cards.length - pricedCards.length,
    freeCardLimit: plan.id === 'free' ? plan.limits.cardLimit : null,
    freeCardLimitRemaining:
      plan.id === 'free' && plan.limits.cardLimit !== null
        ? Math.max(0, plan.limits.cardLimit - totalOwnedCards)
        : null,
    freeCardLimitExceeded:
      plan.id === 'free' && plan.limits.cardLimit !== null
        ? totalOwnedCards > plan.limits.cardLimit
        : false,
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

export function displayStorageLocation(card: CollectionCard) {
  if (!card.storageLocation) return 'Storage unavailable';
  return [
    card.storageLocation.name,
    card.storageLocation.binderPage ? `Page ${card.storageLocation.binderPage}` : '',
    card.storageLocation.binderSlot ? `Slot ${card.storageLocation.binderSlot}` : '',
  ].filter(Boolean).join(' - ');
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

export function normalizeCardCondition(value: unknown): CardCondition {
  const normalized = normalizeSearchText(String(value ?? '')).replace(/\s+/g, '_');
  if (normalized === 'nm' || normalized === 'near_mint') return 'near_mint';
  if (normalized === 'lp' || normalized === 'lightly_played') return 'lightly_played';
  if (normalized === 'mp' || normalized === 'moderately_played') return 'moderately_played';
  if (normalized === 'hp' || normalized === 'heavily_played') return 'heavily_played';
  if (normalized === 'damaged' || normalized === 'dm') return 'damaged';
  return 'unknown';
}

export function normalizeCardFinish(value: unknown): CardFinish {
  const normalized = normalizeSearchText(String(value ?? '')).replace(/[\s-]+/g, '_');
  if (normalized.includes('serialized')) return 'serialized';
  if (normalized.includes('borderless')) return 'borderless';
  if (normalized.includes('extended')) return 'extended_art';
  if (normalized.includes('showcase')) return 'showcase';
  if (normalized.includes('etched')) return 'etched';
  if (normalized.includes('foil')) return 'foil';
  if (normalized === 'normal' || normalized === 'regular') return 'normal';
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
): StorageLocation {
  const data = rawLocation.data ?? {};
  return {
    id: rawLocation.id,
    name: stringValue(data.name) || rawLocation.name || 'Unnamed location',
    type: normalizeStorageType(data.type ?? rawLocation.location_type),
    description: stringValue(data.description) || null,
    zone: stringValue(data.zone) || null,
    binderPage: numberValue(itemPayload.binderPage),
    binderSlot: stringValue(itemPayload.binderSlot) || null,
  };
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

function timestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
