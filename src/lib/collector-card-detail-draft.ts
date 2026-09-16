import type { CollectorMutation } from "@/lib/collector-mutations";
import type {
  CollectionCard,
  TradeBinderStatus,
} from "@/lib/collector-workspace";

export type CollectorCardDetailDraft = {
  quantity: number;
  condition: CollectionCard["condition"];
  finish: CollectionCard["printing"]["finish"];
  storageLocationId: string | null;
  tradeStatus: Exclude<TradeBinderStatus, "unknown">;
  wishlisted: boolean;
};

export function draftFromCard(card: CollectionCard): CollectorCardDetailDraft {
  return {
    quantity: card.quantityOwned,
    condition: card.condition,
    finish: card.printing.finish,
    storageLocationId: card.storageLocation?.id ?? null,
    tradeStatus:
      card.tradeBinderStatus === "unknown"
        ? "not_for_trade"
        : card.tradeBinderStatus,
    wishlisted: card.wishlistStatus === "wanted",
  };
}

export function draftsEqual(
  a: CollectorCardDetailDraft,
  b: CollectorCardDetailDraft,
) {
  return (
    a.quantity === b.quantity &&
    a.condition === b.condition &&
    a.finish === b.finish &&
    a.storageLocationId === b.storageLocationId &&
    a.tradeStatus === b.tradeStatus &&
    a.wishlisted === b.wishlisted
  );
}

export function changedMutations(
  card: CollectionCard,
  draft: CollectorCardDetailDraft,
  userId: string,
): CollectorMutation[] {
  const mutations: CollectorMutation[] = [];
  const base = draftFromCard(card);
  if (draft.quantity !== base.quantity)
    mutations.push({
      type: "quantity",
      userId,
      inventoryItemId: card.id,
      quantity: draft.quantity,
    });
  if (draft.condition !== base.condition)
    mutations.push({
      type: "condition",
      userId,
      inventoryItemId: card.id,
      condition: draft.condition,
    });
  if (draft.finish !== base.finish)
    mutations.push({
      type: "finish",
      userId,
      inventoryItemId: card.id,
      finish: draft.finish,
    });
  if (draft.storageLocationId !== base.storageLocationId)
    mutations.push({
      type: "storage",
      userId,
      inventoryItemId: card.id,
      storageLocationId: draft.storageLocationId,
    });
  if (draft.tradeStatus !== base.tradeStatus)
    mutations.push({
      type: "trade_binder_status",
      userId,
      inventoryItemId: card.id,
      status: draft.tradeStatus,
    });
  if (draft.wishlisted !== base.wishlisted)
    mutations.push({
      type: "wishlist",
      userId,
      inventoryItemId: card.id,
      wishlisted: draft.wishlisted,
      cardName: card.cardName,
      setCode: card.printing.setCode,
      condition: draft.condition,
      finish: draft.finish,
    });
  return mutations;
}
