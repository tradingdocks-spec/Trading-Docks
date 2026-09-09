"use client";

import Link from "next/link";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  TDBadge,
  TDButton,
  TDCard,
  TDEmptyState,
  TDErrorState,
  TDLoadingState,
  TDScreen,
  TDText,
} from "@/components/design-system/td-primitives";
import { createClient } from "@/lib/supabase/client";
import { loadWebCollectorCardById, runWebCollectorMutation } from "@/lib/collector-workspace-client-data";
import {
  CARD_CONDITION_OPTIONS,
  CARD_FINISH_OPTIONS,
  TRADE_BINDER_STATUS_OPTIONS,
  applyCollectorMutationOptimistically,
  rollbackCollectorMutation,
  type CollectorMutation,
} from "@/lib/collector-mutations";
import {
  displayCondition,
  displayFinish,
  displayPrinting,
  displayStorageLocation,
  priceLabel,
  type CollectionCard,
  type StorageLocation,
  type TradeBinderStatus,
} from "@/lib/collector-workspace";

export function CollectorCardDetail({ cardId }: { cardId: string }) {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void supabase.auth.getUser().then((result: { data: { user: { id: string } | null } }) => {
      if (active) setUserId(result.data.user?.id ?? null);
    });
    void loadWebCollectorCardById(cardId)
      .then((result) => {
        if (!active) return;
        setCards(result.cards);
        setLocations(result.locations);
        setTotalQuantity(result.totalQuantity);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Card details are unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cardId]);

  const card = useMemo(() => cards[0] ?? null, [cards]);

  const runMutation = async (mutation: CollectorMutation) => {
    if (!card || !userId) {
      setMutationError("Sign in again to update this collection record.");
      return;
    }
    setMutationError(null);
    setPendingMutation(mutation.type);
    const optimistic = applyCollectorMutationOptimistically(cards, mutation, locations);
    setCards(optimistic.cards);
    if (mutation.type === "quantity") setTotalQuantity((value) => value - card.quantityOwned + mutation.quantity);
    try {
      await runWebCollectorMutation(mutation);
    } catch (mutationFailure) {
      setCards(rollbackCollectorMutation(optimistic));
      if (mutation.type === "quantity") setTotalQuantity(totalQuantity);
      setMutationError(mutationFailure instanceof Error ? mutationFailure.message : "Collection update failed.");
    } finally {
      setPendingMutation(null);
    }
  };

  if (loading) {
    return (
      <TDScreen>
        <TDLoadingState title="Loading card" message="Fetching the exact saved printing." />
      </TDScreen>
    );
  }

  if (error) {
    return (
      <TDScreen>
        <TDErrorState title="Card unavailable" message={error} action={<BackLink />} />
      </TDScreen>
    );
  }

  if (!card) {
    return (
      <TDScreen>
        <TDEmptyState title="Card not found" message="This card is not available in the current collection data." action={<BackLink />} />
      </TDScreen>
    );
  }

  return (
    <TDScreen className="space-y-5">
      <BackLink />

      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[var(--td-radius-xl)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)]">
          {card.printing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.printing.imageUrl} alt={`${card.cardName} card image`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex aspect-[0.72] flex-col items-center justify-center gap-3 text-[var(--td-text-muted)]">
              <ImageIcon className="h-10 w-10" />
              <TDText tone="muted">Image unavailable</TDText>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <header>
            <TDText variant="label" tone="info">{displayPrinting(card.printing)}</TDText>
            <TDText as="h1" variant="display" className="mt-2">{card.cardName}</TDText>
            <TDText tone="muted" className="mt-2">{card.printing.setName ?? "Set name unavailable"}</TDText>
          </header>

          <div className="flex flex-wrap gap-2">
            <TDBadge tone="info">Owned x{card.quantityOwned}</TDBadge>
            <TDBadge tone="neutral">{displayCondition(card.condition)}</TDBadge>
            <TDBadge tone="neutral">{displayFinish(card.printing.finish)}</TDBadge>
            <TDBadge tone={card.tradeBinderStatus === "not_for_trade" ? "neutral" : "success"}>
              {card.tradeBinderStatus === "not_for_trade" ? "Not for trade" : "Trade binder"}
            </TDBadge>
            <TDBadge tone={card.wishlistStatus === "wanted" ? "accent" : "neutral"}>
              {card.wishlistStatus === "wanted" ? "Wishlist" : "Not wishlisted"}
            </TDBadge>
          </div>

          <TDCard className="grid gap-3 md:grid-cols-2">
            <DetailField label="Storage location" value={displayStorageLocation(card)} />
            <DetailField label="Language" value={card.printing.language ?? "Language unavailable"} />
            <DetailField label="Scryfall ID" value={card.printing.scryfallId ?? "Unavailable"} />
            <DetailField label="Price summary" value={priceLabel(card)} muted={card.marketPrice.amount === null} />
          </TDCard>

          {mutationError ? (
            <TDErrorState title="Update failed" message={mutationError} />
          ) : null}

          <TDCard className="space-y-5">
            <div>
              <TDText variant="title">Organization</TDText>
              <TDText tone="muted" className="mt-1">
                Quantity zero is saved as zero owned. It does not delete or archive this record.
                {totalQuantity >= 0 ? ` Current collection total: ${totalQuantity}.` : ""}
              </TDText>
            </div>

            <div className="flex flex-wrap items-center gap-2" aria-label="Quantity controls">
              <TDButton label="-" variant="secondary" disabled={card.quantityOwned <= 0 || pendingMutation === "quantity"} onClick={() => runMutation({ type: "quantity", userId: userId ?? "", inventoryItemId: card.id, quantity: card.quantityOwned - 1 })} />
              <TDBadge tone="info">Owned x{card.quantityOwned}</TDBadge>
              <TDButton label="+" variant="secondary" disabled={pendingMutation === "quantity"} onClick={() => runMutation({ type: "quantity", userId: userId ?? "", inventoryItemId: card.id, quantity: card.quantityOwned + 1 })} />
            </div>

            <OptionGroup label="Condition" value={card.condition} options={CARD_CONDITION_OPTIONS} display={displayCondition} pending={pendingMutation === "condition"} onSelect={(condition) => runMutation({ type: "condition", userId: userId ?? "", inventoryItemId: card.id, condition })} />
            <OptionGroup label="Finish" value={card.printing.finish} options={CARD_FINISH_OPTIONS} display={displayFinish} pending={pendingMutation === "finish"} onSelect={(finish) => runMutation({ type: "finish", userId: userId ?? "", inventoryItemId: card.id, finish })} />
            <OptionGroup
              label="Storage"
              value={card.storageLocation?.id ?? "none"}
              options={["none", ...locations.map((location) => location.id)]}
              display={(locationId) => locationId === "none" ? "Clear location" : locations.find((location) => location.id === locationId)?.name ?? "Unavailable"}
              pending={pendingMutation === "storage"}
              onSelect={(locationId) => runMutation({ type: "storage", userId: userId ?? "", inventoryItemId: card.id, storageLocationId: locationId === "none" ? null : locationId })}
            />
            <OptionGroup
              label="Trade Binder"
              value={card.tradeBinderStatus === "unknown" ? "not_for_trade" : card.tradeBinderStatus}
              options={TRADE_BINDER_STATUS_OPTIONS}
              display={displayTradeStatus}
              pending={pendingMutation === "trade_binder_status"}
              onSelect={(status) => runMutation({ type: "trade_binder_status", userId: userId ?? "", inventoryItemId: card.id, status })}
            />
            <TDButton
              label={card.wishlistStatus === "wanted" ? "Remove from Wishlist" : "Add to Wishlist"}
              variant={card.wishlistStatus === "wanted" ? "ghost" : "secondary"}
              onClick={() => runMutation({
                type: "wishlist",
                userId: userId ?? "",
                inventoryItemId: card.id,
                wishlisted: card.wishlistStatus !== "wanted",
                cardName: card.cardName,
                setCode: card.printing.setCode,
                condition: card.condition,
                finish: card.printing.finish,
              })}
              disabled={pendingMutation === "wishlist"}
            />
          </TDCard>

          <TDCard variant="outlined">
            <TDText variant="title">Future integration points</TDText>
            <TDText tone="muted" className="mt-2">
              Scanner recognition, portfolio analytics, deck editing, trade transactions, and marketplace listings remain future integrations.
            </TDText>
          </TDCard>
        </div>
      </section>
    </TDScreen>
  );
}

function OptionGroup<T extends string>({
  label,
  value,
  options,
  display,
  pending,
  onSelect,
}: {
  label: string;
  value: T;
  options: T[];
  display: (value: T) => string;
  pending: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <TDText variant="label" tone="muted">{label}</TDText>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={pending || selected}
              onClick={() => onSelect(option)}
              className={`min-h-10 rounded-full border px-3 text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)] disabled:opacity-70 ${selected ? "border-td-accent/50 bg-td-accent/15 text-td-accent-text" : "border-[var(--td-border-default)] text-[var(--td-text-muted)]"}`}
            >
              {display(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function displayTradeStatus(status: Exclude<TradeBinderStatus, "unknown">) {
  const labels: Record<Exclude<TradeBinderStatus, "unknown">, string> = {
    not_for_trade: "Not for trade",
    available: "Available",
    reserved: "Reserved",
    pending: "Pending",
    looking_for_upgrade: "Looking for upgrade",
    for_sale: "For sale",
  };
  return labels[status];
}

function BackLink() {
  return (
    <Link href="/dashboard/inventory" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] px-3 text-sm font-black text-[var(--td-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
      <ArrowLeft className="h-4 w-4" />
      Back to Collection
    </Link>
  );
}

function DetailField({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant="small" tone={muted ? "muted" : "primary"}>{value}</TDText>
    </div>
  );
}
