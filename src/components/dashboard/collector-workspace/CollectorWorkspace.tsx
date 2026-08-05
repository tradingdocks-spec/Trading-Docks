"use client";

import Link from "next/link";
import {
  ArrowUpDown,
  BookOpen,
  Boxes,
  Download,
  Grid3X3,
  ImageIcon,
  Layers3,
  List,
  Search,
  Star,
  Tag,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  TDBadge,
  TDButton,
  TDCard,
  TDEmptyState,
  TDErrorState,
  TDInput,
  TDScreen,
  TDText,
} from "@/components/design-system/td-primitives";
import { cn } from "@/lib/utils";
import { loadWebCollectorCollectionPage } from "@/lib/collector-workspace-client-data";
import {
  displayCondition,
  displayFinish,
  displayPrinting,
  displayStorageLocation,
  filterCollectionCards,
  priceLabel,
  resolveCollectionViewState,
  sortCollectionCards,
  summarizeCollectionCards,
  type CollectionCard,
  type CollectionSort,
} from "@/lib/collector-workspace";
import type { AccountTier } from "@/lib/plan-entitlements";

type DisplayMode = "grid" | "list";

const SORT_OPTIONS: Array<{ value: CollectionSort; label: string }> = [
  { value: "recently_updated", label: "Recently updated" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "quantity_desc", label: "Quantity" },
  { value: "set_asc", label: "Set/number" },
  { value: "price_desc", label: "Price" },
];

export function CollectorWorkspace({
  accountType,
  inventoryLimit,
}: {
  accountType: AccountTier;
  inventoryLimit: number | null;
}) {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<CollectionSort>("recently_updated");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [tradeOnly, setTradeOnly] = useState(false);
  const [wishlistOnly, setWishlistOnly] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    void loadWebCollectorCollectionPage({ query: debouncedQuery })
      .then((result) => {
        if (!active) return;
        setCards(result.cards);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setCards([]);
        setError(loadError instanceof Error ? loadError.message : "Collection data is unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  const visibleCards = useMemo(() => {
    const filtered = filterCollectionCards(cards, {
      query: debouncedQuery,
      wishlistStatus: wishlistOnly ? "wanted" : "all",
    }).filter((card) => !tradeOnly || card.tradeBinderStatus !== "not_for_trade");
    return sortCollectionCards(filtered, sort);
  }, [cards, debouncedQuery, sort, tradeOnly, wishlistOnly]);
  const summary = useMemo(() => summarizeCollectionCards(cards, accountType), [accountType, cards]);
  const viewState = resolveCollectionViewState({
    loading,
    error,
    totalCount: cards.length,
    visibleCount: visibleCards.length,
  });
  const canUseSellerActions = accountType === "seller" || accountType === "store";

  return (
    <TDScreen className="space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <TDText variant="label" tone="info">Collector Workspace</TDText>
          <TDText as="h1" variant="display" className="mt-2">Collection</TDText>
          <TDText tone="muted" className="mt-2">
            Manage exact printings, quantities, storage, trade status, and wishlist state from existing saved collection records.
          </TDText>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/deck-vault" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] px-4 text-sm font-black text-[var(--td-text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
            <BookOpen className="h-4 w-4" />
            Decks entry
          </Link>
          <Link href="/dashboard/collector-portfolio" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] px-4 text-sm font-black text-[var(--td-text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
            <Layers3 className="h-4 w-4" />
            Portfolio
          </Link>
          <Link href="/dashboard/card-photo-scanner" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-transparent px-4 text-sm font-black text-[var(--td-text-secondary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
            <Search className="h-4 w-4" />
            Scanner
          </Link>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label="Collection summary">
        <SummaryMetric icon={<Boxes className="h-4 w-4" />} label="Owned cards" value={summary.totalOwnedCards.toLocaleString()} />
        <SummaryMetric icon={<Grid3X3 className="h-4 w-4" />} label="Unique printings" value={summary.uniquePrintings.toLocaleString()} />
        <SummaryMetric icon={<Tag className="h-4 w-4" />} label="Trade binder" value={summary.tradeBinderCount.toLocaleString()} />
        <SummaryMetric icon={<Star className="h-4 w-4" />} label="Wishlist" value={summary.wishlistCount.toLocaleString()} />
        <SummaryMetric
          icon={<ArrowUpDown className="h-4 w-4" />}
          label="Known value"
          value={summary.knownMarketValue === null ? "Unavailable" : currency(summary.knownMarketValue)}
          muted={summary.knownMarketValue === null}
        />
      </section>

      {inventoryLimit !== null ? (
        <TDCard variant={summary.freeCardLimitExceeded ? "outlined" : "default"} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <TDText variant="small">Free card limit: {summary.totalOwnedCards}/{inventoryLimit}</TDText>
            <TDText variant="caption" tone={summary.freeCardLimitExceeded ? "danger" : "muted"}>
              {summary.freeCardLimitExceeded
                ? "Card limit exceeded. Adding more cards should be blocked by entitlement-aware write paths."
                : `${summary.freeCardLimitRemaining ?? Math.max(0, inventoryLimit - summary.totalOwnedCards)} card slots remaining.`}
            </TDText>
          </div>
          <TDBadge tone={summary.freeCardLimitExceeded ? "danger" : "info"}>{accountType}</TDBadge>
        </TDCard>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto]" aria-label="Collection controls">
        <TDInput
          id="collection-search"
          label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search card, set, collector number, or storage location"
        />
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-2">
            <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as CollectionSort)}
              className="min-h-12 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-4 text-sm text-[var(--td-text-primary)] outline-none focus:border-[var(--td-border-focus)]"
            >
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <FilterButton label="Trade binder" selected={tradeOnly} onClick={() => setTradeOnly((value) => !value)} />
          <FilterButton label="Wishlist" selected={wishlistOnly} onClick={() => setWishlistOnly((value) => !value)} />
          <ViewToggle mode={displayMode} onChange={setDisplayMode} />
        </div>
      </section>

      <section aria-label="Collection cards">
        {viewState === "loading" ? (
          <LoadingSkeleton />
        ) : viewState === "error" ? (
          <TDErrorState title="Collection unavailable" message={error ?? "Collection data could not be loaded."} action={<TDButton label="Retry" variant="secondary" onClick={() => setDebouncedQuery(query)} />} />
        ) : viewState === "empty" ? (
          <TDEmptyState title="No cards in this collection yet" message="Saved inventory cards will appear here after they are added through supported collection tools." />
        ) : viewState === "no_results" ? (
          <TDEmptyState title="No matching cards" message="Adjust search, trade binder, or wishlist filters to widen the result set." />
        ) : displayMode === "grid" ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleCards.map((card) => <CollectionCardTile key={card.id} card={card} />)}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)]">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left">Card</th>
                  <th className="px-4 py-3 text-left">Printing</th>
                  <th className="px-4 py-3 text-left">Storage</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {visibleCards.map((card) => (
                  <tr key={card.id} className="border-t border-[var(--td-border-default)]">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/inventory/${encodeURIComponent(card.id)}`} className="font-black text-[var(--td-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
                        {card.cardName}
                      </Link>
                      <TDText variant="caption" tone="muted">{displayCondition(card.condition)} - {displayFinish(card.printing.finish)}</TDText>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--td-text-secondary)]">{displayPrinting(card.printing)}</td>
                    <td className="px-4 py-3 text-sm text-[var(--td-text-secondary)]">{displayStorageLocation(card)}</td>
                    <td className="px-4 py-3">
                      <StatusBadges card={card} />
                    </td>
                    <td className="px-4 py-3 text-right font-black">{card.quantityOwned}</td>
                    <td className={cn("px-4 py-3 text-right font-black", card.marketPrice.amount === null && "text-[var(--td-text-muted)]")}>{priceLabel(card)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canUseSellerActions ? (
        <TDCard variant="outlined" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <TDText variant="title">Seller and Store actions</TDText>
            <TDText variant="small" tone="muted">Import/export and listing workflows remain entitlement-aware entry points for later product sprints.</TDText>
          </div>
          <Link href="/dashboard/tools/csv-converter" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] px-4 text-sm font-black text-[var(--td-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
            <Download className="h-4 w-4" />
            Import/export
          </Link>
        </TDCard>
      ) : null}
    </TDScreen>
  );
}

function SummaryMetric({ icon, label, value, muted = false }: { icon: ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <TDCard className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--td-radius-sm)] border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
        {icon}
      </span>
      <div className="min-w-0">
        <TDText variant="caption" tone="muted">{label}</TDText>
        <TDText variant="title" tone={muted ? "muted" : "primary"}>{value}</TDText>
      </div>
    </TDCard>
  );
}

function FilterButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-[var(--td-radius-md)] border px-4 text-sm font-black outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]",
        selected
          ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
          : "border-[var(--td-border-default)] bg-[var(--td-background-secondary)] text-[var(--td-text-secondary)]",
      )}
    >
      {label}
    </button>
  );
}

function ViewToggle({ mode, onChange }: { mode: DisplayMode; onChange: (mode: DisplayMode) => void }) {
  return (
    <div className="flex overflow-hidden rounded-[var(--td-radius-md)] border border-[var(--td-border-default)]" role="group" aria-label="Collection view mode">
      <button type="button" aria-pressed={mode === "list"} aria-label="List view" onClick={() => onChange("list")} className={cn("flex h-12 w-12 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]", mode === "list" ? "bg-cyan-300/10 text-cyan-100" : "text-[var(--td-text-muted)]")}>
        <List className="h-4 w-4" />
      </button>
      <button type="button" aria-pressed={mode === "grid"} aria-label="Grid view" onClick={() => onChange("grid")} className={cn("flex h-12 w-12 items-center justify-center border-l border-[var(--td-border-default)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]", mode === "grid" ? "bg-cyan-300/10 text-cyan-100" : "text-[var(--td-text-muted)]")}>
        <Grid3X3 className="h-4 w-4" />
      </button>
    </div>
  );
}

function CollectionCardTile({ card }: { card: CollectionCard }) {
  return (
    <TDCard className="flex h-full flex-col gap-4">
      <div className="aspect-[0.72] overflow-hidden rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)]">
        {card.printing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.printing.imageUrl} alt={`${card.cardName} card image`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--td-text-muted)]">
            <ImageIcon className="h-7 w-7" />
            <TDText variant="caption" tone="muted">Image unavailable</TDText>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Link href={`/dashboard/inventory/${encodeURIComponent(card.id)}`} className="text-base font-black text-[var(--td-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
          {card.cardName}
        </Link>
        <TDText variant="caption" tone="muted">{displayPrinting(card.printing)}</TDText>
        <TDText variant="caption" tone="secondary">{displayStorageLocation(card)}</TDText>
        <StatusBadges card={card} />
        <div className="mt-auto flex items-center justify-between gap-3">
          <TDBadge tone="info">x{card.quantityOwned}</TDBadge>
          <TDText variant="small" tone={card.marketPrice.amount === null ? "muted" : "primary"}>{priceLabel(card)}</TDText>
        </div>
      </div>
    </TDCard>
  );
}

function StatusBadges({ card }: { card: CollectionCard }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <TDBadge tone={card.tradeBinderStatus === "not_for_trade" ? "neutral" : "success"}>
        {card.tradeBinderStatus === "not_for_trade" ? "Not for trade" : "Trade binder"}
      </TDBadge>
      <TDBadge tone={card.wishlistStatus === "wanted" ? "accent" : "neutral"}>
        {card.wishlistStatus === "wanted" ? "Wishlist" : "Not wishlisted"}
      </TDBadge>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} data-skeleton className="h-44 rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)]" />
      ))}
    </div>
  );
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
