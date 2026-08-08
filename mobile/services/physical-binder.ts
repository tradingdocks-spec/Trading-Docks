import type { CollectionCard, RawInventoryLocation } from './collector-workspace.ts';

export type PhysicalBinderVisibility = 'private' | 'unlisted' | 'public';
export type BinderShareScope = 'page' | 'spread' | 'binder' | 'portfolio';

export type PhysicalBinder = {
  id: string;
  ownerUserId: string;
  locationId: string;
  name: string;
  description: string;
  visibility: PhysicalBinderVisibility;
  coverUrl: string | null;
  coverColor: string;
  accentColor: string;
  pageCount: number;
  rows: number;
  columns: number;
  isTradeBinder: boolean;
};

export type PhysicalBinderCardPlacement = {
  inventoryItemId: string;
  card: CollectionCard;
  page: number;
  slot: string;
  quantity: number;
};

export type PhysicalBinderPocket = {
  page: number;
  slot: string;
  index: number;
  placement: PhysicalBinderCardPlacement | null;
};

export type PhysicalBinderPage = {
  binderId: string;
  page: number;
  side: 'left' | 'right' | 'single';
  pockets: PhysicalBinderPocket[];
  occupiedCount: number;
};

export type PhysicalBinderSpread = {
  binderId: string;
  left: PhysicalBinderPage;
  right: PhysicalBinderPage;
  pageDepthLabel: string;
};

export type BinderShareRequest = {
  binderId: string;
  scope: BinderShareScope;
  visibility: PhysicalBinderVisibility;
  page?: number;
};

export type BinderShareLink = {
  token: string;
  url: string;
  visibility: PhysicalBinderVisibility;
  scope: BinderShareScope;
  active?: boolean;
  revokedAt?: string | null;
};

export type RawPortfolioBinder = {
  id: string;
  user_id: string;
  location_id: string;
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  cover_url?: string | null;
  cover_color?: string | null;
  accent_color?: string | null;
  visibility?: PhysicalBinderVisibility | null;
  is_trade_binder?: boolean | null;
};

export type RawPortfolioShare = {
  id: string;
  token: string;
  resource_id: string | null;
  visibility: PhysicalBinderVisibility;
  is_active: boolean;
  revoked_at: string | null;
  share_type: BinderShareScope;
};

export type PhysicalBinderSummary = PhysicalBinder & {
  cardCount: number;
  occupiedPockets: number;
  shareLink: BinderShareLink | null;
};

export type PhysicalBinderState = {
  binders: PhysicalBinderSummary[];
  activeBinder: PhysicalBinderSummary | null;
  activeSpread: PhysicalBinderSpread | null;
  placements: PhysicalBinderCardPlacement[];
};

export const BINDER_PLATFORM_BACKEND_TABLES = [
  'portfolio_binders',
  'portfolio_shares',
  'inventory_locations',
  'inventory_items',
] as const;

export function buildPhysicalBinderState({
  userId,
  cards,
  rawLocations,
  rawBinders = [],
  rawShares = [],
  activeBinderId,
  page = 1,
}: {
  userId: string;
  cards: CollectionCard[];
  rawLocations: RawInventoryLocation[];
  rawBinders?: RawPortfolioBinder[];
  rawShares?: RawPortfolioShare[];
  activeBinderId?: string | null;
  page?: number;
}): PhysicalBinderState {
  const metadataByLocation = new Map(rawBinders.map((binder) => [binder.location_id, binder]));
  const sharesByLocation = new Map(
    rawShares
      .filter((share) => share.resource_id)
      .map((share) => [share.resource_id as string, share]),
  );
  const binders = rawLocations
    .filter((location) => locationType(location) === 'binder')
    .map((location, index): PhysicalBinderSummary => {
      const data = isRecord(location.data) ? location.data : {};
      const meta = metadataByLocation.get(location.id);
      const binderCards = cards.filter((card) => card.storageLocation?.id === location.id);
      const share = sharesByLocation.get(location.id) ?? null;
      return {
        id: meta?.id ?? `location-${location.id}`,
        ownerUserId: userId,
        locationId: location.id,
        name: meta?.title?.trim() || String(data.name ?? location.name ?? 'Binder'),
        description: meta?.description ?? String(data.description ?? ''),
        visibility: normalizeVisibility(meta?.visibility ?? data.visibility),
        coverUrl: meta?.cover_url ?? null,
        coverColor: meta?.cover_color ?? String(data.coverColor ?? '#172554'),
        accentColor: meta?.accent_color ?? String(data.accentColor ?? ['#67e8f9', '#c4b5fd', '#6ee7b7'][index % 3]),
        pageCount: numberValue(data.binderPages) ?? 20,
        rows: numberValue(data.binderRows) ?? 3,
        columns: numberValue(data.binderColumns) ?? 3,
        isTradeBinder: Boolean(meta?.is_trade_binder ?? data.isTradeBinder),
        cardCount: binderCards.reduce((sum, card) => sum + card.quantityOwned, 0),
        occupiedPockets: binderCards.filter((card) => card.storageLocation?.binderPage && card.storageLocation?.binderSlot).length,
        shareLink: share ? shareLinkFromRow(share) : null,
      };
    });
  const activeBinder = binders.find((binder) => binder.id === activeBinderId || binder.locationId === activeBinderId) ?? binders[0] ?? null;
  const placements = activeBinder
    ? cards
      .filter((card) => card.storageLocation?.id === activeBinder.locationId)
      .map((card, index) => ({
        inventoryItemId: card.id,
        card,
        page: card.storageLocation?.binderPage ?? 1,
        slot: card.storageLocation?.binderSlot ?? binderSlotLabels(activeBinder.rows, activeBinder.columns)[index % binderSlotLabels(activeBinder.rows, activeBinder.columns).length],
        quantity: Math.min(1, card.quantityOwned),
      }))
    : [];
  return {
    binders,
    activeBinder,
    activeSpread: activeBinder ? buildBinderSpread(activeBinder, page, placements) : null,
    placements,
  };
}

export function binderSlotLabels(rows: number, columns: number) {
  const safeRows = Math.max(1, Math.min(6, Math.floor(rows)));
  const safeColumns = Math.max(1, Math.min(6, Math.floor(columns)));
  return Array.from({ length: safeRows * safeColumns }, (_, index) => {
    const row = String.fromCharCode(65 + Math.floor(index / safeColumns));
    const column = (index % safeColumns) + 1;
    return `${row}${column}`;
  });
}

export function buildBinderPage({
  binder,
  page,
  placements,
  side = 'single',
}: {
  binder: PhysicalBinder;
  page: number;
  placements: PhysicalBinderCardPlacement[];
  side?: PhysicalBinderPage['side'];
}): PhysicalBinderPage {
  const normalizedPage = clampPage(page, binder.pageCount);
  const bySlot = new Map(
    placements
      .filter((placement) => placement.page === normalizedPage)
      .map((placement) => [placement.slot, placement]),
  );
  const pockets = binderSlotLabels(binder.rows, binder.columns).map((slot, index) => ({
    page: normalizedPage,
    slot,
    index,
    placement: bySlot.get(slot) ?? null,
  }));
  return {
    binderId: binder.id,
    page: normalizedPage,
    side,
    pockets,
    occupiedCount: pockets.filter((pocket) => pocket.placement).length,
  };
}

export function buildBinderSpread(binder: PhysicalBinder, page: number, placements: PhysicalBinderCardPlacement[]): PhysicalBinderSpread {
  const leftPage = clampPage(page % 2 === 0 ? page - 1 : page, binder.pageCount);
  const rightPage = clampPage(leftPage + 1, binder.pageCount);
  return {
    binderId: binder.id,
    left: buildBinderPage({ binder, page: leftPage, placements, side: 'left' }),
    right: buildBinderPage({ binder, page: rightPage, placements, side: 'right' }),
    pageDepthLabel: `Pages ${leftPage}-${rightPage} of ${binder.pageCount}`,
  };
}

export function placementKey(placement: Pick<PhysicalBinderCardPlacement, 'page' | 'slot'>) {
  return `page:${placement.page}:slot:${placement.slot}`;
}

export function validateBinderPlacement({
  binder,
  placement,
  existingPlacements,
}: {
  binder: PhysicalBinder;
  placement: PhysicalBinderCardPlacement;
  existingPlacements: PhysicalBinderCardPlacement[];
}) {
  if (placement.card.id !== placement.inventoryItemId) return { ok: false as const, reason: 'Card placement must reference an owned inventory item.' };
  if (placement.quantity < 1 || placement.quantity > placement.card.quantityOwned) return { ok: false as const, reason: 'Placed quantity must come from owned quantity.' };
  if (placement.page < 1 || placement.page > binder.pageCount) return { ok: false as const, reason: 'Choose a page inside this binder.' };
  if (!binderSlotLabels(binder.rows, binder.columns).includes(placement.slot)) return { ok: false as const, reason: 'Choose an existing pocket.' };
  const key = placementKey(placement);
  const occupied = existingPlacements.some((existing) => existing.inventoryItemId !== placement.inventoryItemId && placementKey(existing) === key);
  if (occupied) return { ok: false as const, reason: 'That pocket already has a card.' };
  return { ok: true as const };
}

export function normalizeBinderShareRequest(input: Partial<BinderShareRequest>): BinderShareRequest {
  return {
    binderId: String(input.binderId ?? ''),
    scope: input.scope === 'page' || input.scope === 'spread' || input.scope === 'portfolio' ? input.scope : 'binder',
    visibility: input.visibility === 'public' || input.visibility === 'private' ? input.visibility : 'unlisted',
    page: input.page && Number.isFinite(input.page) ? Math.max(1, Math.round(input.page)) : undefined,
  };
}

export function createBinderSharePayload(input: BinderShareRequest) {
  const normalized = normalizeBinderShareRequest(input);
  return {
    scope: normalized.scope,
    visibility: normalized.visibility,
    page: normalized.page ?? 1,
    binderLocationId: normalized.binderId,
  };
}

export function revokeBinderSharePayload(share: Pick<BinderShareLink, 'token'>) {
  return { token: share.token, isActive: false, revokedAt: new Date().toISOString() };
}

export function binderShareStatusLabel(share: BinderShareLink | null) {
  if (!share) return 'Not shared';
  if (share.revokedAt || share.active === false) return 'Revoked';
  return share.visibility === 'public' ? 'Public link' : share.visibility === 'private' ? 'Private' : 'Unlisted link';
}

function clampPage(page: number, pageCount: number) {
  return Math.max(1, Math.min(Math.max(1, pageCount), Math.round(page)));
}

function locationType(location: RawInventoryLocation) {
  const data = isRecord(location.data) ? location.data : {};
  return typeof data.type === 'string' ? data.type : location.location_type;
}

function normalizeVisibility(value: unknown): PhysicalBinderVisibility {
  return value === 'public' || value === 'private' ? value : 'unlisted';
}

function shareLinkFromRow(row: RawPortfolioShare): BinderShareLink {
  return {
    token: row.token,
    url: `/share/portfolio/${row.token}`,
    visibility: normalizeVisibility(row.visibility),
    scope: row.share_type === 'page' || row.share_type === 'spread' || row.share_type === 'portfolio' ? row.share_type : 'binder',
    active: row.is_active,
    revokedAt: row.revoked_at,
  };
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
