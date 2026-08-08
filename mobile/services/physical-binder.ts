import type { CollectionCard } from './collector-workspace.ts';

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
};

export const BINDER_PLATFORM_BACKEND_TABLES = [
  'portfolio_binders',
  'portfolio_shares',
  'inventory_locations',
  'inventory_items',
] as const;

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

function clampPage(page: number, pageCount: number) {
  return Math.max(1, Math.min(Math.max(1, pageCount), Math.round(page)));
}
