import {
  displayCondition,
  displayFinish,
  displayPrinting,
  displayStorageLocation,
  isPhysicalTradeBinderCard,
  normalizeCardCondition,
  normalizeCardFinish,
  normalizeTradeBinderStatus,
  type CardCondition,
  type CardFinish,
  type CollectionCard,
  type TradeBinderStatus,
} from './collector-workspace.ts';

export type TradeStatus = Exclude<TradeBinderStatus, 'unknown'>;
export type WishlistPriority = 'low' | 'medium' | 'high' | 'grail';

export type RawTradeBinderRow = {
  inventory_item_id?: string | null;
  status?: string | null;
  trade_value?: number | string | null;
  notes?: string | null;
  updated_at?: string | null;
};

export type RawWishlistRow = {
  id?: string | null;
  game_id?: string | null;
  product_type?: string | null;
  card_name?: string | null;
  set_code?: string | null;
  target_condition?: string | null;
  target_finish?: string | null;
  target_variant?: string | null;
  target_language?: string | null;
  target_value?: number | string | null;
  priority?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TradeBinderItem = {
  id: string;
  userId: string;
  card: CollectionCard;
  status: TradeStatus;
  quantityAvailable: number;
  tradeValue: number | null;
  notes: string;
  updatedAt: string | null;
};

export type WishlistItem = {
  id: string;
  userId: string;
  gameId: string;
  productType: 'card' | 'sealed';
  cardName: string;
  setCode: string | null;
  targetCondition: CardCondition | 'any';
  targetFinish: CardFinish | 'any';
  targetVariant: string | 'any';
  targetLanguage: string | 'any';
  targetValue: number | null;
  priority: WishlistPriority;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WishlistMatch = {
  id: string;
  wishlistItem: WishlistItem;
  binderItem: TradeBinderItem;
  quantityAvailable: number;
  matchType: 'exact' | 'flexible';
  reasons: string[];
};

export type TradeSummary = {
  totalBinderItems: number;
  totalQuantityAvailable: number;
  availableCount: number;
  reservedCount: number;
  pendingCount: number;
  forSaleCount: number;
};

export type WishlistSummary = {
  totalWishlistItems: number;
  grailCount: number;
  highPriorityCount: number;
  matchedWishlistItems: number;
  exactMatchCount: number;
  flexibleMatchCount: number;
};

export type TradeBinderWishlistState = {
  tradeItems: TradeBinderItem[];
  wishlistItems: WishlistItem[];
  matches: WishlistMatch[];
  tradeSummary: TradeSummary;
  wishlistSummary: WishlistSummary;
};

export type TradeBinderFilter = {
  query?: string;
  status?: TradeStatus | 'all' | 'tradeable';
  condition?: CardCondition | 'all';
  finish?: CardFinish | 'all';
  storageLocationId?: string | 'all';
};

export type WishlistFilter = {
  query?: string;
  priority?: WishlistPriority | 'all';
  matchState?: 'all' | 'matched' | 'unmatched';
};

export type BinderWishlistSort = 'recent' | 'name' | 'priority' | 'quantity';

export const TRADE_BINDER_OFFLINE_TYPE = 'collector_trade_binder_wishlist_mutation';
export const TRADE_STATUS_OPTIONS: TradeStatus[] = ['not_for_trade', 'available', 'reserved', 'pending', 'looking_for_upgrade', 'for_sale'];
export const WISHLIST_PRIORITY_OPTIONS: WishlistPriority[] = ['low', 'medium', 'high', 'grail'];

export function buildTradeBinderWishlistState({
  userId,
  cards,
  tradeRows = [],
  wishlistRows = [],
}: {
  userId: string;
  cards: CollectionCard[];
  tradeRows?: RawTradeBinderRow[];
  wishlistRows?: RawWishlistRow[];
}): TradeBinderWishlistState {
  const tradeById = new Map(tradeRows.map((row) => [String(row.inventory_item_id ?? ''), row]));
  const tradeItems = cards
    .map((card) => buildTradeBinderItem(userId, card, tradeById.get(card.id)))
    .filter((item) => item.status !== 'not_for_trade');
  const wishlistItems = wishlistRows
    .map((row) => buildWishlistItem(userId, row))
    .filter((item): item is WishlistItem => Boolean(item));
  const matches = matchWishlistItems(wishlistItems, tradeItems);
  return {
    tradeItems,
    wishlistItems,
    matches,
    tradeSummary: summarizeTradeBinder(tradeItems),
    wishlistSummary: summarizeWishlist(wishlistItems, matches),
  };
}

export function buildTradeBinderItem(userId: string, card: CollectionCard, row?: RawTradeBinderRow): TradeBinderItem {
  const status = normalizeTradeBinderStatus(row?.status ?? card.tradeBinderStatus);
  const physicalTradeBinderStatus = status === 'not_for_trade' && isPhysicalTradeBinderCard(card) ? 'available' : status;
  return {
    id: card.id,
    userId,
    card,
    status: physicalTradeBinderStatus === 'unknown' ? 'not_for_trade' : physicalTradeBinderStatus,
    quantityAvailable: Math.max(0, card.quantityOwned),
    tradeValue: numberValue(row?.trade_value),
    notes: stringValue(row?.notes),
    updatedAt: row?.updated_at ?? card.updatedAt ?? null,
  };
}

export function buildWishlistItem(userId: string, row: RawWishlistRow): WishlistItem | null {
  const cardName = stringValue(row.card_name);
  if (!cardName) return null;
  return {
    id: stringValue(row.id) || wishlistStableId(row),
    userId,
    gameId: normalizeWishlistGame(row.game_id),
    productType: normalizeWishlistProductType(row.product_type),
    cardName,
    setCode: stringValue(row.set_code)?.toUpperCase() ?? null,
    targetCondition: normalizeWishlistCondition(row.target_condition),
    targetFinish: normalizeWishlistFinish(row.target_finish),
    targetVariant: stringValue(row.target_variant) || 'any',
    targetLanguage: stringValue(row.target_language) || 'any',
    targetValue: numberValue(row.target_value),
    priority: normalizeWishlistPriority(row.priority),
    notes: stringValue(row.notes),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function filterTradeBinderItems(items: TradeBinderItem[], filter: TradeBinderFilter) {
  const query = normalize(filter.query ?? '');
  return items.filter((item) => {
    const card = item.card;
    const haystack = normalize([
      card.cardName,
      displayPrinting(card.printing),
      displayCondition(card.condition),
      displayFinish(card.printing.finish),
      displayStorageLocation(card),
      item.status,
      item.notes,
    ].join(' '));
    if (query && !haystack.includes(query)) return false;
    if (filter.status && filter.status !== 'all' && filter.status !== 'tradeable' && item.status !== filter.status) return false;
    if (filter.status === 'tradeable' && item.status === 'not_for_trade') return false;
    if (filter.condition && filter.condition !== 'all' && card.condition !== filter.condition) return false;
    if (filter.finish && filter.finish !== 'all' && card.printing.finish !== filter.finish) return false;
    if (filter.storageLocationId && filter.storageLocationId !== 'all' && card.storageLocation?.id !== filter.storageLocationId) return false;
    return true;
  });
}

export function filterWishlistItems(items: WishlistItem[], matches: WishlistMatch[], filter: WishlistFilter) {
  const query = normalize(filter.query ?? '');
  const matchedIds = new Set(matches.map((match) => match.wishlistItem.id));
  return items.filter((item) => {
    const haystack = normalize([item.gameId, item.productType, item.cardName, item.setCode, item.targetCondition, item.targetVariant, item.targetLanguage, item.targetFinish, item.priority, item.notes].join(' '));
    if (query && !haystack.includes(query)) return false;
    if (filter.priority && filter.priority !== 'all' && item.priority !== filter.priority) return false;
    if (filter.matchState === 'matched' && !matchedIds.has(item.id)) return false;
    if (filter.matchState === 'unmatched' && matchedIds.has(item.id)) return false;
    return true;
  });
}

export function sortTradeBinderItems(items: TradeBinderItem[], sort: BinderWishlistSort) {
  return [...items].sort((a, b) => {
    if (sort === 'quantity') return b.quantityAvailable - a.quantityAvailable || a.card.cardName.localeCompare(b.card.cardName);
    if (sort === 'name') return a.card.cardName.localeCompare(b.card.cardName);
    return timestamp(b.updatedAt) - timestamp(a.updatedAt);
  });
}

export function sortWishlistItems(items: WishlistItem[], sort: BinderWishlistSort) {
  return [...items].sort((a, b) => {
    if (sort === 'priority') return priorityRank(b.priority) - priorityRank(a.priority) || a.cardName.localeCompare(b.cardName);
    if (sort === 'name') return a.cardName.localeCompare(b.cardName);
    return timestamp(b.updatedAt ?? b.createdAt) - timestamp(a.updatedAt ?? a.createdAt);
  });
}

export function matchWishlistItems(wishlistItems: WishlistItem[], tradeItems: TradeBinderItem[]): WishlistMatch[] {
  const matches: WishlistMatch[] = [];
  for (const wishlistItem of wishlistItems) {
    for (const binderItem of tradeItems) {
      const result = matchWishlistToBinderItem(wishlistItem, binderItem);
      if (result.ok) {
        matches.push({
          id: `${wishlistItem.id}:${binderItem.id}`,
          wishlistItem,
          binderItem,
          quantityAvailable: binderItem.quantityAvailable,
          matchType: result.matchType,
          reasons: result.reasons,
        });
      }
    }
  }
  return matches;
}

export function matchWishlistToBinderItem(wishlistItem: WishlistItem, binderItem: TradeBinderItem):
  | { ok: true; matchType: 'exact' | 'flexible'; reasons: string[] }
  | { ok: false; reason: 'name' | 'set' | 'condition' | 'finish' | 'quantity' } {
  const card = binderItem.card;
  if (binderItem.quantityAvailable <= 0) return { ok: false, reason: 'quantity' };
  if (card.gameId !== wishlistItem.gameId || card.productType !== wishlistItem.productType) return { ok: false, reason: 'name' };
  if (normalize(card.cardName) !== normalize(wishlistItem.cardName)) return { ok: false, reason: 'name' };
  if (wishlistItem.setCode && normalize(card.printing.setCode ?? '') !== normalize(wishlistItem.setCode)) return { ok: false, reason: 'set' };
  if (wishlistItem.targetCondition !== 'any' && card.condition !== wishlistItem.targetCondition) return { ok: false, reason: 'condition' };
  if (wishlistItem.targetVariant !== 'any' && normalize(card.printing.variant ?? displayFinish(card.printing.finish)) !== normalize(wishlistItem.targetVariant)) return { ok: false, reason: 'finish' };
  if (wishlistItem.targetLanguage !== 'any' && normalize(card.printing.language ?? '') !== normalize(wishlistItem.targetLanguage)) return { ok: false, reason: 'finish' };
  if (wishlistItem.targetFinish !== 'any' && card.printing.finish !== wishlistItem.targetFinish) return { ok: false, reason: 'finish' };
  const exact = Boolean(wishlistItem.setCode && wishlistItem.targetCondition !== 'any' && (wishlistItem.targetVariant !== 'any' || wishlistItem.targetFinish !== 'any'));
  const reasons = [
    wishlistItem.gameId,
    wishlistItem.setCode ? 'set' : 'any set',
    wishlistItem.targetCondition !== 'any' ? 'condition' : 'any condition',
    wishlistItem.targetVariant !== 'any' ? 'variant' : wishlistItem.targetFinish !== 'any' ? 'finish' : 'any variant',
  ];
  return { ok: true, matchType: exact ? 'exact' : 'flexible', reasons };
}

export function summarizeTradeBinder(items: TradeBinderItem[]): TradeSummary {
  return {
    totalBinderItems: items.length,
    totalQuantityAvailable: items.reduce((sum, item) => sum + item.quantityAvailable, 0),
    availableCount: items.filter((item) => item.status === 'available').length,
    reservedCount: items.filter((item) => item.status === 'reserved').length,
    pendingCount: items.filter((item) => item.status === 'pending').length,
    forSaleCount: items.filter((item) => item.status === 'for_sale').length,
  };
}

export function summarizeWishlist(items: WishlistItem[], matches: WishlistMatch[]): WishlistSummary {
  return {
    totalWishlistItems: items.length,
    grailCount: items.filter((item) => item.priority === 'grail').length,
    highPriorityCount: items.filter((item) => item.priority === 'high').length,
    matchedWishlistItems: new Set(matches.map((match) => match.wishlistItem.id)).size,
    exactMatchCount: matches.filter((match) => match.matchType === 'exact').length,
    flexibleMatchCount: matches.filter((match) => match.matchType === 'flexible').length,
  };
}

export function applyTradeStatusOptimistically(items: TradeBinderItem[], itemId: string, status: TradeStatus) {
  const previous = items.map(cloneTradeItem);
  return {
    previous,
    items: items.map((item) => item.id === itemId ? { ...item, status, updatedAt: new Date().toISOString() } : item),
  };
}

export function applyWishlistPriorityOptimistically(items: WishlistItem[], itemId: string, priority: WishlistPriority) {
  const previous = items.map((item) => ({ ...item }));
  return {
    previous,
    items: items.map((item) => item.id === itemId ? { ...item, priority, updatedAt: new Date().toISOString() } : item),
  };
}

export function tradeWishlistQueueKey(input: { userId: string; targetId: string; type: 'trade_status' | 'wishlist_priority' | 'wishlist_toggle' }) {
  return `${input.userId}:${input.targetId}:${input.type}`;
}

export function normalizeWishlistPriority(value: unknown): WishlistPriority {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'grail') return value;
  return 'medium';
}

export function tradeStatusLabel(status: TradeStatus) {
  const labels: Record<TradeStatus, string> = {
    not_for_trade: 'Not for trade',
    available: 'Available',
    reserved: 'Reserved',
    pending: 'Pending',
    looking_for_upgrade: 'Looking for upgrade',
    for_sale: 'For sale',
  };
  return labels[status];
}

export function wishlistPriorityLabel(priority: WishlistPriority) {
  const labels: Record<WishlistPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    grail: 'Grail',
  };
  return labels[priority];
}

function normalizeWishlistCondition(value: unknown): CardCondition | 'any' {
  const raw = normalize(String(value ?? ''));
  if (!raw || raw === 'any') return 'any';
  return normalizeCardCondition(value);
}

function normalizeWishlistFinish(value: unknown): CardFinish | 'any' {
  const raw = normalize(String(value ?? ''));
  if (!raw || raw === 'any') return 'any';
  return normalizeCardFinish(value);
}

function wishlistStableId(row: RawWishlistRow) {
  return [row.game_id ?? 'magic', row.product_type ?? 'card', row.card_name, row.set_code, row.target_condition, row.target_variant ?? row.target_finish, row.target_language].map((value) => normalize(String(value ?? 'any'))).join(':');
}

function normalizeWishlistGame(value: unknown) {
  const raw = normalize(String(value ?? ''));
  if (raw === 'pokemon' || raw === 'ptcg' || raw === '3') return 'pokemon';
  return 'magic';
}

function normalizeWishlistProductType(value: unknown): 'card' | 'sealed' {
  const raw = normalize(String(value ?? ''));
  return raw === 'sealed' || raw === 'sealedproduct' || raw === 'unopened' ? 'sealed' : 'card';
}

function cloneTradeItem(item: TradeBinderItem): TradeBinderItem {
  return { ...item, card: { ...item.card, printing: { ...item.card.printing }, marketPrice: { ...item.card.marketPrice }, storageLocation: item.card.storageLocation ? { ...item.card.storageLocation } : null } };
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function timestamp(value?: string | null) {
  return value ? Date.parse(value) || 0 : 0;
}

function priorityRank(priority: WishlistPriority) {
  return { low: 1, medium: 2, high: 3, grail: 4 }[priority];
}
