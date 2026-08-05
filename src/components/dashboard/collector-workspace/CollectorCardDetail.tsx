"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, ImageIcon, Star, Tags } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  TDBadge,
  TDCard,
  TDEmptyState,
  TDErrorState,
  TDLoadingState,
  TDScreen,
  TDText,
} from "@/components/design-system/td-primitives";
import { loadWebCollectorCardById } from "@/lib/collector-workspace-client-data";
import {
  displayCondition,
  displayFinish,
  displayPrinting,
  displayStorageLocation,
  priceLabel,
  type CollectionCard,
} from "@/lib/collector-workspace";

export function CollectorCardDetail({ cardId }: { cardId: string }) {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadWebCollectorCardById(cardId)
      .then((result) => {
        if (!active) return;
        setCards(result.cards);
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

          <section className="grid gap-3 md:grid-cols-3" aria-label="Card actions">
            <FoundationAction icon={<Tags className="h-4 w-4" />} title="Trade Binder" description="Status is visible now. Editing is planned for the trade sprint." />
            <FoundationAction icon={<Star className="h-4 w-4" />} title="Wishlist" description="Wishlist matching is visible now. Editing is planned for the trade sprint." />
            <FoundationAction icon={<BookOpen className="h-4 w-4" />} title="Deck Usage" description="Deck usage entry point is reserved for the deck integration sprint." />
          </section>

          <TDCard variant="outlined">
            <TDText variant="title">Future integration points</TDText>
            <TDText tone="muted" className="mt-2">
              Scanner recognition, portfolio analytics, and full deck editing are intentionally left as future integrations. This detail page only shows saved collection data and unavailable states.
            </TDText>
          </TDCard>
        </div>
      </section>
    </TDScreen>
  );
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

function FoundationAction({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <TDCard variant="outlined" className="space-y-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-[var(--td-radius-sm)] border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
        {icon}
      </span>
      <TDText variant="small">{title}</TDText>
      <TDText variant="caption" tone="muted">{description}</TDText>
    </TDCard>
  );
}
