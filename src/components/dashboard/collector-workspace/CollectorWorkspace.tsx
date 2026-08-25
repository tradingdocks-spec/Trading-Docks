"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  Activity,
  BookOpen,
  Boxes,
  CheckSquare2,
  Download,
  Grid3X3,
  Heart,
  ImageIcon,
  Layers3,
  LibraryBig,
  List,
  MapPin,
  Move,
  Plus,
  Search,
  Tag,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  TDBadge,
  TDButton,
  TDCard,
  TDEmptyState,
  TDErrorState,
  TDScreen,
  TDText,
} from "@/components/design-system/td-primitives";
import { GameContextControl } from "@/components/dashboard/multi-tcg/GameContextControl";
import { cn } from "@/lib/utils";
import { loadWebCollectorCollectionPage } from "@/lib/collector-workspace-client-data";
import {
  assignWebStorageLocation,
  loadWebStorageLocationManager,
} from "@/lib/storage-location-client-data";
import {
  collectionRequestKey,
  countActiveCollectionFilters,
  displayCondition,
  displayFinish,
  displayPrinting,
  displayStorageLocation,
  mergeCollectionPages,
  priceLabel,
  buildInventoryHealth,
  resolveCollectionViewState,
  summarizeCollectionCards,
  shouldAcceptCollectionResponse,
  type CardCondition,
  type CardFinish,
  type CollectionCard,
  type CollectionFilter,
  type CollectionSummary,
  type CollectionSort,
  type InventoryHealthIssueId,
} from "@/lib/collector-workspace";
import {
  collectionGameEmptyMessage,
  collectionGameEmptyTitle,
  displayGameBadge,
  type GameContextId,
} from "@/lib/multi-tcg";
import type { AccountTier } from "@/lib/plan-entitlements";
import { StorageLocationManager } from "./StorageLocationManager";
import { TradeBinderWishlistWorkspace } from "./TradeBinderWishlistWorkspace";

type DisplayMode = "grid" | "list";
type CollectionSection = "overview" | "cards" | "binders" | "portfolio" | "storage" | "trade" | "wishlist";
type StorageManagerState = Awaited<ReturnType<typeof loadWebStorageLocationManager>>;
type InventoryTypeFilter = "all" | "card" | "sealed";
type InventorySavedView = "all" | "recent" | "unassigned" | "missing_price" | "tradeable" | "wishlist";

const SORT_OPTIONS: Array<{ value: CollectionSort; label: string }> = [
  { value: "recently_updated", label: "Recently updated" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "quantity_desc", label: "Quantity" },
  { value: "set_asc", label: "Set/number" },
  { value: "price_desc", label: "Price" },
];

const CONDITION_OPTIONS: Array<{ value: CardCondition | "all"; label: string }> = [
  { value: "all", label: "Any condition" },
  { value: "near_mint", label: "Near Mint" },
  { value: "lightly_played", label: "Lightly Played" },
  { value: "moderately_played", label: "Moderately Played" },
  { value: "heavily_played", label: "Heavily Played" },
  { value: "damaged", label: "Damaged" },
  { value: "unknown", label: "Unknown" },
];

const FINISH_OPTIONS: Array<{ value: CardFinish | "all"; label: string }> = [
  { value: "all", label: "Any finish" },
  { value: "normal", label: "Normal" },
  { value: "foil", label: "Foil" },
  { value: "etched", label: "Etched" },
  { value: "showcase", label: "Showcase" },
  { value: "extended_art", label: "Extended Art" },
  { value: "borderless", label: "Borderless" },
  { value: "serialized", label: "Serialized" },
  { value: "unknown", label: "Unknown" },
];

const INVENTORY_TYPE_OPTIONS: Array<{ value: InventoryTypeFilter; label: string; detail: string }> = [
  { value: "all", label: "All", detail: "All supported records" },
  { value: "card", label: "Singles", detail: "Card inventory" },
  { value: "sealed", label: "Sealed", detail: "Sealed products" },
];

const SAVED_VIEW_OPTIONS: Array<{ value: InventorySavedView; label: string }> = [
  { value: "all", label: "All inventory" },
  { value: "recent", label: "Recently added" },
  { value: "unassigned", label: "Unassigned" },
  { value: "missing_price", label: "Missing prices" },
  { value: "tradeable", label: "Trade binder" },
  { value: "wishlist", label: "Wishlist matches" },
];

export function CollectorWorkspace({
  accountType,
  inventoryLimit,
  hasFullPlatformAccess = false,
}: {
  accountType: AccountTier;
  inventoryLimit: number | null;
  hasFullPlatformAccess?: boolean;
}) {
  const searchParams = useSearchParams();
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<CollectionSort>("recently_updated");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [gameContext, setGameContext] = useState<GameContextId>("all");
  const [inventoryType, setInventoryType] = useState<InventoryTypeFilter>("all");
  const [conditionFilter, setConditionFilter] = useState<CardCondition | "all">("all");
  const [finishFilter, setFinishFilter] = useState<CardFinish | "all">("all");
  const [storageFilter, setStorageFilter] = useState<string | "all">("all");
  const [savedView, setSavedView] = useState<InventorySavedView>("all");
  const [tradeOnly, setTradeOnly] = useState(false);
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [activeSection, setActiveSection] = useState<CollectionSection>("cards");
  const [storageState, setStorageState] = useState<StorageManagerState | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storagePendingCardId, setStoragePendingCardId] = useState<string | null>(null);
  const [openStorageCardId, setOpenStorageCardId] = useState<string | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [inspectedCardId, setInspectedCardId] = useState<string | null>(null);
  const [bulkMoveTarget, setBulkMoveTarget] = useState<string>("");
  const activeRequestKey = useRef("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const requestedSection = searchParams.get("section");
    if (isCollectionSection(requestedSection)) {
      setActiveSection(requestedSection);
    }
  }, [searchParams]);

  const loadPage = useCallback((cursor: string | null, reset: boolean) => {
    const mappedSavedView = savedViewToFilter(savedView);
    const filter = {
      query: debouncedQuery,
      gameId: gameContext,
      productType: inventoryType,
      condition: conditionFilter,
      finish: finishFilter,
      storageLocationId: storageFilter,
      tradeBinderStatus: tradeOnly ? "tradeable" as const : mappedSavedView.tradeBinderStatus,
      wishlistStatus: wishlistOnly ? "wanted" as const : mappedSavedView.wishlistStatus,
    } satisfies CollectionFilter;
    const requestKey = collectionRequestKey({ filter, sort });
    activeRequestKey.current = requestKey;
    if (reset) {
      setLoading(true);
      setCards([]);
      setNextCursor(null);
      setHasMore(false);
    } else {
      if (!cursor) return;
      setLoadingMore(true);
    }
    setError(null);
    void loadWebCollectorCollectionPage({ filter, sort, cursor })
      .then((result) => {
        if (!shouldAcceptCollectionResponse(activeRequestKey.current, result.pageInfo.requestKey)) return;
        setCards((current) => mergeCollectionPages(current, result.cards, reset));
        setNextCursor(result.pageInfo.nextCursor);
        setHasMore(result.pageInfo.hasMore);
        setError(null);
      })
      .catch((loadError) => {
        if (!shouldAcceptCollectionResponse(activeRequestKey.current, requestKey)) return;
        if (reset) setCards([]);
        setError(loadError instanceof Error ? loadError.message : "Collection data is unavailable.");
      })
      .finally(() => {
        if (!shouldAcceptCollectionResponse(activeRequestKey.current, requestKey)) return;
        if (reset) setLoading(false);
        else setLoadingMore(false);
      });
  }, [conditionFilter, debouncedQuery, finishFilter, gameContext, inventoryType, savedView, sort, storageFilter, tradeOnly, wishlistOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadPage(null, true), 0);
    return () => window.clearTimeout(timer);
  }, [loadPage]);

  const retry = useCallback(() => loadPage(null, true), [loadPage]);
  const reloadStorageState = useCallback(() => {
    void loadWebStorageLocationManager()
      .then((result) => {
        setStorageState(result);
        setStorageError(null);
      })
      .catch((loadError) => setStorageError(loadError instanceof Error ? loadError.message : "Storage locations are unavailable."));
  }, []);
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore && nextCursor) loadPage(nextCursor, false);
  }, [hasMore, loadPage, loading, loadingMore, nextCursor]);

  useEffect(() => {
    reloadStorageState();
  }, [reloadStorageState]);

  useEffect(() => {
    return () => {
      activeRequestKey.current = "";
    };
  }, []);

  const visibleCards = useMemo(
    () => applySavedInventoryView(cards, savedView),
    [cards, savedView],
  );
  const summary = useMemo(
    () => summarizeCollectionCards(cards, accountType, { ignoreFreeLimit: hasFullPlatformAccess }),
    [accountType, cards, hasFullPlatformAccess],
  );
  const health = useMemo(() => buildInventoryHealth(cards), [cards]);
  const currentFilter: CollectionFilter = useMemo(() => ({
    query: debouncedQuery,
    gameId: gameContext,
    productType: inventoryType,
    condition: conditionFilter,
    finish: finishFilter,
    storageLocationId: storageFilter,
    tradeBinderStatus: tradeOnly ? "tradeable" : savedViewToFilter(savedView).tradeBinderStatus,
    wishlistStatus: wishlistOnly ? "wanted" : savedViewToFilter(savedView).wishlistStatus,
  }), [conditionFilter, debouncedQuery, finishFilter, gameContext, inventoryType, savedView, storageFilter, tradeOnly, wishlistOnly]);
  const activeFilterCount = countActiveCollectionFilters(currentFilter) + (savedView !== "all" && savedView !== "tradeable" && savedView !== "wishlist" ? 1 : 0);
  const viewState = resolveCollectionViewState({
    loading,
    loadingMore,
    error,
    totalCount: cards.length,
    visibleCount: visibleCards.length,
    hasMore,
  });
  const canUseSellerActions = accountType === "seller" || accountType === "store";
  const binderLocations = useMemo(() => (storageState?.summaries ?? []).filter((location) => location.type === "binder"), [storageState]);
  const featuredBinder = binderLocations.find((location) => location.favorite) ?? binderLocations[0] ?? null;
  const featuredBinderCards = featuredBinder ? cards.filter((card) => card.storageLocation?.id === featuredBinder.id).slice(0, 8) : [];
  const recentlyAddedCards = visibleCards.slice(0, 4);
  const inspectedCard = visibleCards.find((card) => card.id === inspectedCardId) ?? null;
  const selectedCards = useMemo(
    () => visibleCards.filter((card) => selectedCardIds.includes(card.id)),
    [selectedCardIds, visibleCards],
  );

  useEffect(() => {
    setSelectedCardIds((current) => current.filter((id) => visibleCards.some((card) => card.id === id)));
    if (inspectedCardId && !visibleCards.some((card) => card.id === inspectedCardId)) setInspectedCardId(null);
  }, [inspectedCardId, visibleCards]);
  const handleStorageAssignment = useCallback(async (card: CollectionCard, toLocationId: string | null) => {
    if (!storageState) return;
    setStoragePendingCardId(card.id);
    setStorageError(null);
    try {
      await assignWebStorageLocation({
        userId: storageState.userId,
        inventoryItemId: card.id,
        fromLocationId: card.storageLocation?.id ?? null,
        toLocationId,
      });
      setOpenStorageCardId(null);
      retry();
      reloadStorageState();
    } catch (assignError) {
      setStorageError(assignError instanceof Error ? assignError.message : "Storage assignment failed.");
    } finally {
      setStoragePendingCardId(null);
    }
  }, [reloadStorageState, retry, storageState]);

  const clearFilters = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setGameContext("all");
    setInventoryType("all");
    setConditionFilter("all");
    setFinishFilter("all");
    setStorageFilter("all");
    setSavedView("all");
    setTradeOnly(false);
    setWishlistOnly(false);
  }, []);

  const applyHealthIssue = useCallback((issueId: InventoryHealthIssueId) => {
    setActiveSection("cards");
    if (issueId === "unassigned") {
      setSavedView("unassigned");
      setStorageFilter("all");
    } else if (issueId === "missing_price") {
      setSavedView("missing_price");
    } else if (issueId === "unknown_condition") {
      setConditionFilter("unknown");
      setSavedView("all");
    } else if (issueId === "unknown_finish") {
      setFinishFilter("unknown");
      setSavedView("all");
    }
  }, []);

  const exportVisibleCsv = useCallback(() => {
    const rows = [
      ["Name", "Game", "Product Type", "Set", "Collector Number", "Condition", "Finish", "Quantity", "Storage", "Market Price"].join(","),
      ...visibleCards.map((card) => [
        card.cardName,
        card.gameLabel,
        card.productType,
        card.printing.setCode ?? "",
        card.printing.collectorNumber ?? "",
        displayCondition(card.condition),
        displayFinish(card.printing.finish),
        String(card.quantityOwned),
        displayStorageLocation(card),
        card.marketPrice.amount === null ? "" : String(card.marketPrice.amount),
      ].map(csvCell).join(",")),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "trading-docks-inventory.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [visibleCards]);

  const handleBulkMove = useCallback(async () => {
    if (!bulkMoveTarget || !selectedCards.length) return;
    for (const card of selectedCards) {
      await handleStorageAssignment(card, bulkMoveTarget === "__clear__" ? null : bulkMoveTarget);
    }
    setSelectedCardIds([]);
    setBulkMoveTarget("");
  }, [bulkMoveTarget, handleStorageAssignment, selectedCards]);

  return (
    <TDScreen className="space-y-4">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <TDText variant="label" tone="info">Inventory command center</TDText>
          <TDText as="h1" variant="heading" className="mt-2">Inventory</TDText>
          <TDText tone="muted" className="mt-2">
            Everything you own, everywhere you keep and sell it.
          </TDText>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/deck-vault" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] px-3.5 text-sm font-black text-[var(--td-text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
            <BookOpen className="h-4 w-4" />
            Decks
          </Link>
          <Link href="/dashboard/collector-portfolio" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] px-3.5 text-sm font-black text-[var(--td-text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
            <Layers3 className="h-4 w-4" />
            Portfolio
          </Link>
          <button type="button" onClick={() => setActiveSection("storage")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] px-3.5 text-sm font-black text-[var(--td-text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
            <MapPin className="h-4 w-4" />
            Storage
          </button>
          <Link href="/dashboard/card-photo-scanner" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-transparent px-3.5 text-sm font-black text-[var(--td-text-secondary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
            <Search className="h-4 w-4" />
            Scan
          </Link>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label="Collection summary">
        <SummaryMetric icon={<Boxes className="h-4 w-4" />} label="Items / cards" value={summary.totalOwnedCards.toLocaleString()} />
        <SummaryMetric icon={<Grid3X3 className="h-4 w-4" />} label="Unique printings" value={summary.uniquePrintings.toLocaleString()} />
        <SummaryMetric icon={<MapPin className="h-4 w-4" />} label="Stored" value={summary.storedQuantity.toLocaleString()} />
        <SummaryMetric icon={<Tag className="h-4 w-4" />} label="Unassigned" value={summary.unassignedQuantity.toLocaleString()} muted={summary.unassignedQuantity > 0} />
        <SummaryMetric
          icon={<ArrowUpDown className="h-4 w-4" />}
          label="Inventory value"
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

      <InventoryHealthStrip
        health={health}
        totalQuantity={summary.totalOwnedCards}
        onApplyIssue={applyHealthIssue}
      />

      <InventoryCommandBar
        query={query}
        onQueryChange={setQuery}
        canUseSellerActions={canUseSellerActions}
        filterCount={activeFilterCount}
        resultCount={visibleCards.length}
        totalCount={cards.length}
        onClearFilters={clearFilters}
        onExport={exportVisibleCsv}
      />

      <nav className="flex flex-wrap gap-2" aria-label="Collection navigation">
        <SectionTab label="Inventory" selected={activeSection === "cards"} onClick={() => setActiveSection("cards")} />
        <SectionTab label="Binders" selected={activeSection === "binders"} onClick={() => setActiveSection("binders")} />
        <SectionTab label="Storage" selected={activeSection === "storage"} onClick={() => setActiveSection("storage")} />
        <SectionTab label="Portfolio" selected={activeSection === "portfolio"} onClick={() => setActiveSection("portfolio")} />
        <SectionTab label="Trade Binder" selected={activeSection === "trade"} onClick={() => setActiveSection("trade")} />
        <SectionTab label="Wishlist" selected={activeSection === "wishlist"} onClick={() => setActiveSection("wishlist")} />
      </nav>

      <div className="flex flex-col gap-2 rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <TDText variant="label" tone="info">Game context</TDText>
          <TDText variant="caption" tone="muted">Shared Collection tools stay game-aware while Deck Vault and Commander tools remain Magic-specific.</TDText>
        </div>
        <GameContextControl value={gameContext} onChange={setGameContext} ariaLabel="Collection game filter" />
      </div>

      {storageError ? <TDErrorState title="Storage update failed" message={storageError} /> : null}

      {activeSection === "overview" ? (
        <CollectionOverview
          summary={summary}
          binderCount={binderLocations.length}
          featuredBinder={featuredBinder}
          featuredBinderCards={featuredBinderCards}
          recentlyAddedCards={recentlyAddedCards}
          onOpenCards={() => setActiveSection("cards")}
          onOpenStorage={() => setActiveSection("storage")}
          onOpenTrade={() => setActiveSection("trade")}
          onOpenWishlist={() => setActiveSection("wishlist")}
        />
      ) : activeSection === "binders" ? (
        <CollectionBindersView binders={binderLocations} onOpenStorage={() => setActiveSection("storage")} />
      ) : activeSection === "portfolio" ? (
        <CollectionPortfolioView summary={summary} cards={visibleCards} />
      ) : activeSection === "storage" ? (
        <StorageLocationManager />
      ) : activeSection === "trade" || activeSection === "wishlist" ? (
        <TradeBinderWishlistWorkspace />
      ) : (
      <>

      <section className="space-y-3" aria-label="Inventory controls">
        <div className="flex flex-wrap gap-2">
          {INVENTORY_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={inventoryType === option.value}
              onClick={() => setInventoryType(option.value)}
              className={cn(
                "rounded-[var(--td-radius-md)] border px-3.5 py-2.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]",
                inventoryType === option.value
                  ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
                  : "border-[var(--td-border-default)] bg-[var(--td-background-secondary)] text-[var(--td-text-secondary)] hover:text-[var(--td-text-primary)]",
              )}
            >
              <span className="block text-sm font-black">{option.label}</span>
              <span className="block text-[10px] font-semibold text-[var(--td-text-muted)]">{option.detail}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-2 rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] p-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(140px,1fr))_auto]">
          <FilterSelect label="Saved view" value={savedView} onChange={(value) => setSavedView(value as InventorySavedView)} options={SAVED_VIEW_OPTIONS} />
          <FilterSelect label="Condition" value={conditionFilter} onChange={(value) => setConditionFilter(value as CardCondition | "all")} options={CONDITION_OPTIONS} />
          <FilterSelect label="Finish" value={finishFilter} onChange={(value) => setFinishFilter(value as CardFinish | "all")} options={FINISH_OPTIONS} />
          <FilterSelect
            label="Storage"
            value={storageFilter}
            onChange={(value) => setStorageFilter(value)}
            options={[
              { value: "all", label: "Any location" },
              ...(storageState?.summaries ?? []).map((location) => ({ value: location.id, label: location.path.label })),
            ]}
          />
          <FilterSelect label="Sort" value={sort} onChange={(value) => setSort(value as CollectionSort)} options={SORT_OPTIONS} />
          <div className="flex items-end gap-2">
            <FilterButton label="Trade" selected={tradeOnly} onClick={() => setTradeOnly((value) => !value)} />
            <FilterButton label="Wishlist" selected={wishlistOnly} onClick={() => setWishlistOnly((value) => !value)} />
            <ViewToggle mode={displayMode} onChange={setDisplayMode} />
          </div>
        </div>
      </section>

      {selectedCards.length ? (
        <BulkActionBar
          selectedCount={selectedCards.length}
          locations={storageState?.summaries ?? []}
          moveTarget={bulkMoveTarget}
          onMoveTargetChange={setBulkMoveTarget}
          onMove={handleBulkMove}
          onClear={() => setSelectedCardIds([])}
          canUseSellerActions={canUseSellerActions}
        />
      ) : null}

      <section aria-label="Collection cards">
        {viewState === "loading" ? (
          <LoadingSkeleton />
        ) : viewState === "error" ? (
          <TDErrorState title="Collection unavailable" message={error ?? "Collection data could not be loaded."} action={<TDButton label="Retry" variant="secondary" onClick={retry} />} />
        ) : viewState === "empty" ? (
          <TDEmptyState title={collectionGameEmptyTitle(gameContext)} message={collectionGameEmptyMessage(gameContext)} />
        ) : viewState === "no_results" ? (
          <TDEmptyState title="No matching cards" message={`Adjust search, game, trade binder, or wishlist filters to widen the ${displayGameBadge(gameContext)} result set.`} />
        ) : displayMode === "grid" ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleCards.map((card) => (
              <CollectionCardTile
                key={card.id}
                card={card}
                selected={selectedCardIds.includes(card.id)}
                onSelect={(checked) => setSelectedCardIds((current) => toggleSelection(current, card.id, checked))}
                onInspect={() => setInspectedCardId(card.id)}
              />
            ))}
          </div>
        ) : (
          <>
          <div className="hidden overflow-hidden rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] md:block">
            <table className="w-full min-w-[1080px]">
              <thead>
                <tr className="sticky top-0 bg-[var(--td-background-primary)] text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select all visible inventory"
                      checked={visibleCards.length > 0 && selectedCards.length === visibleCards.length}
                      onChange={(event) => setSelectedCardIds(event.target.checked ? visibleCards.map((card) => card.id) : [])}
                      className="accent-cyan-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Card</th>
                  <th className="px-4 py-3 text-left">Set</th>
                  <th className="px-4 py-3 text-left">Finish / condition</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Cost basis</th>
                  <th className="px-4 py-3 text-right">Market value</th>
                  <th className="px-4 py-3 text-right">Gain/loss</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-left">Listing status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCards.map((card) => (
                  <tr key={card.id} className="border-t border-[var(--td-border-default)] transition hover:bg-white/[0.025]">
                    <td className="px-4 py-3 align-middle">
                      <input
                        type="checkbox"
                        aria-label={`Select ${card.cardName}`}
                        checked={selectedCardIds.includes(card.id)}
                        onChange={(event) => setSelectedCardIds((current) => toggleSelection(current, card.id, event.target.checked))}
                        className="accent-cyan-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setInspectedCardId(card.id)} className="flex min-w-0 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
                        <CardThumb card={card} />
                        <span className="min-w-0">
                          <span className="block truncate font-black text-[var(--td-text-primary)]">{card.cardName}</span>
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            <TDBadge tone={card.gameId === "pokemon" ? "accent" : "neutral"}>{displayGameBadge(card.gameId)}</TDBadge>
                            <TDBadge tone="neutral">{card.productType === "sealed" ? "Sealed" : "Single"}</TDBadge>
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--td-text-secondary)]">{displayPrinting(card.printing)}</td>
                    <td className="px-4 py-3 text-sm text-[var(--td-text-secondary)]">{displayFinish(card.printing.finish)} / {displayCondition(card.condition)}</td>
                    <td className="px-4 py-3 text-right font-black">{card.quantityOwned}</td>
                    <td className="px-4 py-3 text-right text-sm font-black text-[var(--td-text-muted)]">Not connected</td>
                    <td className={cn("px-4 py-3 text-right font-black", card.marketPrice.amount === null && "text-[var(--td-text-muted)]")}>{rowMarketValueLabel(card)}</td>
                    <td className="px-4 py-3 text-right text-sm font-black text-[var(--td-text-muted)]">Requires cost</td>
                    <td className="px-4 py-3 text-sm text-[var(--td-text-secondary)]">
                      <StorageCell
                        card={card}
                        storageState={storageState}
                        open={openStorageCardId === card.id}
                        pending={storagePendingCardId === card.id}
                        onToggle={() => setOpenStorageCardId((current) => current === card.id ? null : card.id)}
                        onAssign={(locationId) => void handleStorageAssignment(card, locationId)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadges card={card} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <TDButton label="Inspect" variant="ghost" size="sm" onClick={() => setInspectedCardId(card.id)} />
                        <Link href={`/dashboard/inventory/${encodeURIComponent(card.id)}`} className="inline-flex min-h-10 items-center justify-center rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] px-3 text-xs font-black text-[var(--td-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 md:hidden">
            {visibleCards.map((card) => (
              <MobileInventoryCard
                key={card.id}
                card={card}
                selected={selectedCardIds.includes(card.id)}
                onSelect={(checked) => setSelectedCardIds((current) => toggleSelection(current, card.id, checked))}
                onInspect={() => setInspectedCardId(card.id)}
              />
            ))}
          </div>
          </>
        )}
      </section>

      {(viewState === "ready" || viewState === "loading_more" || viewState === "end") ? (
        <div className="flex justify-center">
          {loadingMore ? (
            <TDText variant="small" tone="muted">Loading more cards...</TDText>
          ) : hasMore ? (
            <TDButton label="Load more" variant="secondary" onClick={loadMore} />
          ) : (
            <TDText variant="caption" tone="muted">End of collection results</TDText>
          )}
        </div>
      ) : null}

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

      <InventoryInspector
        card={inspectedCard}
        storageState={storageState}
        pending={inspectedCard ? storagePendingCardId === inspectedCard.id : false}
        canUseSellerActions={canUseSellerActions}
        onClose={() => setInspectedCardId(null)}
        onMove={(locationId) => inspectedCard ? void handleStorageAssignment(inspectedCard, locationId) : undefined}
        onOpenStorage={() => setActiveSection("storage")}
      />
      </>
      )}
    </TDScreen>
  );
}

function InventoryCommandBar({
  query,
  onQueryChange,
  canUseSellerActions,
  filterCount,
  resultCount,
  totalCount,
  onClearFilters,
  onExport,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  canUseSellerActions: boolean;
  filterCount: number;
  resultCount: number;
  totalCount: number;
  onClearFilters: () => void;
  onExport: () => void;
}) {
  return (
    <section className="rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] p-3" aria-label="Inventory command bar">
      <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--td-text-muted)]" />
          <input
            id="inventory-search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search inventory..."
            className="min-h-12 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] pl-11 pr-4 text-sm font-semibold text-[var(--td-text-primary)] outline-none transition placeholder:text-[var(--td-text-muted)] focus:border-[var(--td-border-focus)] focus:ring-2 focus:ring-[rgba(102,217,255,0.18)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/card-photo-scanner" className="td-button-primary min-h-11 px-3.5 text-sm"><Plus className="h-4 w-4" /> Add</Link>
          <Link href="/dashboard/card-photo-scanner" className="td-button-secondary min-h-11 px-3.5 text-sm"><Search className="h-4 w-4" /> Scan</Link>
          {canUseSellerActions ? <Link href="/dashboard/tools/csv-converter" className="td-button-secondary min-h-11 px-3.5 text-sm"><Download className="h-4 w-4" /> Import</Link> : null}
          <button type="button" onClick={onExport} className="td-button-secondary min-h-11 px-3.5 text-sm"><Download className="h-4 w-4" /> Export</button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[var(--td-text-muted)]">
        <span>{resultCount.toLocaleString()} shown / {totalCount.toLocaleString()} loaded</span>
        <span>{filterCount ? `${filterCount} filter${filterCount === 1 ? "" : "s"} active` : "No filters active"}</span>
        {filterCount ? <button type="button" onClick={onClearFilters} className="font-black text-cyan-300 hover:text-cyan-100">Clear filters</button> : null}
      </div>
    </section>
  );
}

function InventoryHealthStrip({
  health,
  totalQuantity,
  onApplyIssue,
}: {
  health: ReturnType<typeof buildInventoryHealth>;
  totalQuantity: number;
  onApplyIssue: (issueId: InventoryHealthIssueId) => void;
}) {
  return (
    <section className="grid gap-3 rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] p-3 lg:grid-cols-[220px_1fr]" aria-label="Inventory Health">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--td-radius-md)] border border-emerald-300/20 bg-emerald-300/10 text-lg font-black text-emerald-200">{health.score}%</span>
        <div>
          <TDText variant="label" tone="muted">Inventory Health</TDText>
          <TDText variant="caption" tone="muted">{health.locatedQuantity.toLocaleString()} / {totalQuantity.toLocaleString()} located</TDText>
        </div>
      </div>
      {health.issues.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {health.issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => onApplyIssue(issue.id)}
              className={cn(
                "rounded-[var(--td-radius-md)] border px-3 py-2 text-left text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]",
                issue.severity === "attention"
                  ? "border-amber-300/25 bg-amber-300/10 text-amber-100 hover:border-amber-200/45"
                  : "border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] text-[var(--td-text-secondary)] hover:text-[var(--td-text-primary)]",
              )}
            >
              {issue.count.toLocaleString()} {issue.label}
            </button>
          ))}
        </div>
      ) : (
        <TDText variant="small" tone="success">No inventory data-quality issues detected in the loaded records.</TDText>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-3 text-sm text-[var(--td-text-primary)] outline-none focus:border-[var(--td-border-focus)]"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function BulkActionBar({
  selectedCount,
  locations,
  moveTarget,
  canUseSellerActions,
  onMoveTargetChange,
  onMove,
  onClear,
}: {
  selectedCount: number;
  locations: StorageManagerState["summaries"];
  moveTarget: string;
  canUseSellerActions: boolean;
  onMoveTargetChange: (value: string) => void;
  onMove: () => void;
  onClear: () => void;
}) {
  return (
    <section className="sticky top-3 z-20 flex flex-col gap-3 rounded-[var(--td-radius-lg)] border border-cyan-300/25 bg-[#07131d]/95 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur md:flex-row md:items-center md:justify-between" aria-label="Bulk inventory actions">
      <div className="flex items-center gap-2">
        <CheckSquare2 className="h-4 w-4 text-cyan-300" />
        <TDText variant="small">{selectedCount.toLocaleString()} selected</TDText>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Bulk move destination"
          value={moveTarget}
          onChange={(event) => onMoveTargetChange(event.target.value)}
          className="min-h-10 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-3 text-xs font-bold text-[var(--td-text-primary)]"
        >
          <option value="">Move to...</option>
          <option value="__clear__">Clear assignment</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.path.label}</option>)}
        </select>
        <TDButton label="Move" variant="secondary" size="sm" disabled={!moveTarget} onClick={onMove} icon={<Move className="h-3.5 w-3.5" />} />
        {canUseSellerActions ? <Link href="/dashboard/tools/csv-converter" className="inline-flex min-h-10 items-center justify-center rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] px-3 text-xs font-black text-[var(--td-text-secondary)]">Export selected</Link> : null}
        <TDButton label="Clear" variant="ghost" size="sm" onClick={onClear} />
      </div>
    </section>
  );
}

function SectionTab({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm font-black outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]",
        selected
          ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
          : "border-[var(--td-border-default)] bg-[var(--td-background-secondary)] text-[var(--td-text-secondary)] hover:text-[var(--td-text-primary)]",
      )}
    >
      {label}
    </button>
  );
}

function CollectionOverview({
  summary,
  binderCount,
  featuredBinder,
  featuredBinderCards,
  recentlyAddedCards,
  onOpenCards,
  onOpenStorage,
  onOpenTrade,
  onOpenWishlist,
}: {
  summary: CollectionSummary;
  binderCount: number;
  featuredBinder: StorageManagerState["summaries"][number] | null;
  featuredBinderCards: CollectionCard[];
  recentlyAddedCards: CollectionCard[];
  onOpenCards: () => void;
  onOpenStorage: () => void;
  onOpenTrade: () => void;
  onOpenWishlist: () => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]" aria-label="Collection Overview">
      <TDCard className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <TDText variant="label" tone="info">Collection Overview</TDText>
            <TDText as="h2" variant="heading" className="mt-2">Everything you own, organized from one place.</TDText>
            <TDText variant="small" tone="muted" className="mt-2">Collection is the ownership home. Binders, storage, trade state, and portfolio analytics all reference these saved cards.</TDText>
          </div>
          <TDBadge tone="info">{summary.uniquePrintings.toLocaleString()} unique printings</TDBadge>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MiniOverviewMetric icon={<TrendingUp className="h-4 w-4" />} label="Collection value" value={summary.knownMarketValue === null ? "Unavailable" : currency(summary.knownMarketValue)} />
          <MiniOverviewMetric icon={<Boxes className="h-4 w-4" />} label="Owned cards" value={summary.totalOwnedCards.toLocaleString()} />
          <MiniOverviewMetric icon={<LibraryBig className="h-4 w-4" />} label="Binders" value={binderCount.toLocaleString()} />
          <MiniOverviewMetric icon={<ArrowUpDown className="h-4 w-4" />} label="Trade cards" value={summary.tradeBinderCount.toLocaleString()} />
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <QuickAction label="Cards" detail="Review exact printings" icon={<Grid3X3 className="h-4 w-4" />} onClick={onOpenCards} />
          <QuickAction label="Storage" detail={`${summary.unassignedQuantity.toLocaleString()} unassigned`} icon={<MapPin className="h-4 w-4" />} onClick={onOpenStorage} />
          <QuickAction label="Trade" detail={`${summary.tradeBinderCount.toLocaleString()} trade-ready`} icon={<ArrowUpDown className="h-4 w-4" />} onClick={onOpenTrade} />
          <QuickAction label="Wishlist" detail={`${summary.wishlistCount.toLocaleString()} wanted`} icon={<Heart className="h-4 w-4" />} onClick={onOpenWishlist} />
        </div>
      </TDCard>

      <div className="space-y-4">
        <TDCard className="space-y-3">
          <TDText variant="label" tone="muted">Featured binder</TDText>
          {featuredBinder ? (
            <div>
              <TDText variant="title">{featuredBinder.name}</TDText>
              <TDText variant="caption" tone="muted">{featuredBinder.path.label}</TDText>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {featuredBinderCards.length ? featuredBinderCards.map((card) => (
                  <CardThumb key={card.id} card={card} />
                )) : Array.from({ length: 4 }, (_, index) => (
                  <span key={index} className="grid h-12 w-9 place-items-center rounded-[var(--td-radius-sm)] border border-dashed border-[var(--td-border-default)] text-[var(--td-text-muted)]">
                    <ImageIcon className="h-3.5 w-3.5" />
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <TDBadge tone="info">{featuredBinder.assignedQuantity} cards</TDBadge>
                <TDBadge tone={featuredBinder.favorite ? "accent" : "neutral"}>{featuredBinder.favorite ? "Favorite" : "Binder"}</TDBadge>
              </div>
            </div>
          ) : (
            <TDEmptyState title="No binders yet" message="Create a binder storage location, then place cards from Storage." />
          )}
        </TDCard>

        <TDCard className="space-y-3">
          <TDText variant="label" tone="muted">Recently added</TDText>
          {recentlyAddedCards.length ? recentlyAddedCards.map((card) => (
            <div key={card.id} className="flex items-center justify-between gap-3 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] p-3">
              <div className="flex min-w-0 items-center gap-3">
                <CardThumb card={card} />
                <div className="min-w-0">
                <TDText variant="small" className="truncate">{card.cardName}</TDText>
                <TDText variant="caption" tone="muted">{displayPrinting(card.printing)}</TDText>
                <TDText variant="caption" tone="muted">{displayStorageLocation(card)}</TDText>
                </div>
              </div>
              <TDBadge tone="info">x{card.quantityOwned}</TDBadge>
            </div>
          )) : <TDEmptyState title="No recent cards" message="Cards appear here after Collection loads saved inventory." />}
        </TDCard>
      </div>
    </section>
  );
}

function CollectionBindersView({ binders, onOpenStorage }: { binders: StorageManagerState["summaries"]; onOpenStorage: () => void }) {
  const [filter, setFilter] = useState<"all" | "collection" | "trade" | "showcase">("all");
  const visible = binders.filter((binder) => {
    const purpose = binderPurpose(binder);
    return filter === "all" || purpose === filter;
  });

  return (
    <TDCard className="space-y-5" aria-labelledby="collection-binders-title">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <TDText id="collection-binders-title" as="h2" variant="title">Collection Binders</TDText>
          <TDText variant="small" tone="muted">Binders are curated presentations of owned cards. They reference Collection inventory and do not create duplicate ownership records.</TDText>
        </div>
        <TDButton label="Manage binder storage" variant="secondary" icon={<MapPin className="h-4 w-4" />} onClick={onOpenStorage} />
      </header>

      <div className="flex flex-wrap gap-2">
        {(["all", "collection", "trade", "showcase"] as const).map((value) => <SectionTab key={value} label={value === "all" ? "All" : titleCase(value)} selected={filter === value} onClick={() => setFilter(value)} />)}
      </div>

      {visible.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((binder) => (
            <TDCard key={binder.id} variant="outlined" className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <TDText variant="title">{binder.name}</TDText>
                  <TDText variant="caption" tone="muted">{binder.path.label}</TDText>
                </div>
                <TDBadge tone="info">{titleCase(binderPurpose(binder))}</TDBadge>
              </div>
              <div className="flex flex-wrap gap-2">
                <TDBadge tone="neutral">{binder.assignedQuantity} cards</TDBadge>
                <TDBadge tone={binder.favorite ? "accent" : "neutral"}>{binder.favorite ? "Favorite" : "Private"}</TDBadge>
              </div>
              <TDText variant="small" tone="muted">Visibility and public sharing remain handled by the existing portfolio binder compatibility routes.</TDText>
            </TDCard>
          ))}
        </div>
      ) : (
        <TDEmptyState title="No binders for this filter" message="Create or tag binder locations from Storage to organize cards for collection, trade, or showcase use." />
      )}
    </TDCard>
  );
}

function CollectionPortfolioView({ summary, cards }: { summary: CollectionSummary; cards: CollectionCard[] }) {
  const pricedCards = cards.filter((card) => card.marketPrice.amount !== null);
  const gainers = [...pricedCards].sort((a, b) => (b.marketPrice.amount ?? 0) - (a.marketPrice.amount ?? 0)).slice(0, 5);
  const allocation = allocationBySet(cards).slice(0, 6);

  return (
    <TDCard className="space-y-5" aria-labelledby="collection-portfolio-title">
      <header className="flex flex-col gap-2">
        <TDText id="collection-portfolio-title" as="h2" variant="title">Collection Portfolio</TDText>
        <TDText variant="small" tone="muted">Financial analytics for owned cards only. Wishlist targets and external wants are excluded from value and owned counts.</TDText>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Portfolio metrics">
        <MiniOverviewMetric icon={<TrendingUp className="h-4 w-4" />} label="Current value" value={summary.knownMarketValue === null ? "Unavailable" : currency(summary.knownMarketValue)} />
        <MiniOverviewMetric icon={<Activity className="h-4 w-4" />} label="Value change" value="Requires price history" muted />
        <MiniOverviewMetric icon={<Tag className="h-4 w-4" />} label="Cost basis" value="Requires purchase data" muted />
        <MiniOverviewMetric icon={<ArrowUpDown className="h-4 w-4" />} label="Unrealized gain/loss" value="Requires cost basis" muted />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <TDCard variant="outlined" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <TDText variant="title">Value over time</TDText>
            <div className="flex flex-wrap gap-1">{["7D", "30D", "90D", "1Y", "ALL"].map((range) => <TDBadge key={range} tone="neutral">{range}</TDBadge>)}</div>
          </div>
          <div className="flex h-44 items-center justify-center rounded-[var(--td-radius-lg)] border border-dashed border-[var(--td-border-default)]">
            <TDText variant="small" tone="muted">Price-history chart appears when historical collection snapshots are available.</TDText>
          </div>
        </TDCard>

        <TDCard variant="outlined" className="space-y-3">
          <TDText variant="title">Top value cards</TDText>
          {gainers.length ? gainers.map((card) => (
            <div key={card.id} className="flex items-center justify-between gap-3 border-b border-[var(--td-border-default)] pb-2 last:border-b-0 last:pb-0">
              <div className="min-w-0">
                <TDText variant="small" className="truncate">{card.cardName}</TDText>
                <TDText variant="caption" tone="muted">{displayPrinting(card.printing)}</TDText>
              </div>
              <TDText variant="small">{priceLabel(card)}</TDText>
            </div>
          )) : <TDEmptyState title="No priced cards" message="Portfolio value appears when owned cards have market prices." />}
        </TDCard>
      </div>

      <TDCard variant="outlined" className="space-y-3">
        <TDText variant="title">Allocation by set</TDText>
        {allocation.length ? allocation.map((item) => (
          <div key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <TDText variant="small">{item.label}</TDText>
            <TDBadge tone="neutral">{item.quantity} cards</TDBadge>
          </div>
        )) : <TDText variant="small" tone="muted">No allocation data yet.</TDText>}
      </TDCard>

      <TDCard variant="outlined" className="space-y-3">
        <TDText variant="title">Allocation by game</TDText>
        {summary.games.length ? summary.games.map((item) => (
          <div key={item.gameId} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="min-w-0">
              <TDText variant="small" className="truncate">{displayGameBadge(item.gameId)}</TDText>
              <TDText variant="caption" tone="muted">{item.uniquePrintings.toLocaleString()} unique versions</TDText>
            </div>
            <TDBadge tone={item.gameId === "pokemon" ? "accent" : "neutral"}>{item.quantity.toLocaleString()} cards</TDBadge>
          </div>
        )) : <TDText variant="small" tone="muted">No game allocation data yet.</TDText>}
      </TDCard>
    </TDCard>
  );
}

function MiniOverviewMetric({ icon, label, value, muted = false }: { icon: ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] p-4">
      <div className="flex items-center gap-2 text-[var(--td-text-muted)]">{icon}<TDText variant="caption" tone="muted">{label}</TDText></div>
      <TDText variant="title" tone={muted ? "muted" : "primary"} className="mt-2">{value}</TDText>
    </div>
  );
}

function QuickAction({ label, detail, icon, onClick }: { label: string; detail: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] p-4 text-left outline-none transition hover:border-[var(--td-border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
      <div className="flex items-center gap-2 text-cyan-200">{icon}<span className="text-sm font-black">{label}</span></div>
      <TDText variant="caption" tone="muted" className="mt-2">{detail}</TDText>
    </button>
  );
}

function binderPurpose(location: StorageManagerState["summaries"][number]): "collection" | "trade" | "showcase" {
  const text = `${location.name} ${location.path.label}`.toLowerCase();
  if (text.includes("trade")) return "trade";
  if (location.favorite || text.includes("showcase") || text.includes("favorite")) return "showcase";
  return "collection";
}

function allocationBySet(cards: CollectionCard[]) {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const label = card.printing.setCode?.toUpperCase() ?? "Unknown set";
    counts.set(label, (counts.get(label) ?? 0) + card.quantityOwned);
  }
  return [...counts.entries()]
    .map(([label, quantity]) => ({ label, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label));
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function isCollectionSection(value: string | null): value is CollectionSection {
  return value === "overview" ||
    value === "cards" ||
    value === "binders" ||
    value === "portfolio" ||
    value === "storage" ||
    value === "trade" ||
    value === "wishlist";
}

function StorageCell({
  card,
  storageState,
  open,
  pending,
  onToggle,
  onAssign,
}: {
  card: CollectionCard;
  storageState: StorageManagerState | null;
  open: boolean;
  pending: boolean;
  onToggle: () => void;
  onAssign: (locationId: string | null) => void;
}) {
  const assigned = Boolean(card.storageLocation);
  const locations = storageState?.summaries ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          "inline-flex min-h-10 max-w-[260px] items-center gap-2 rounded-[var(--td-radius-sm)] border px-3 text-left text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]",
          assigned
            ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:border-cyan-200/50"
            : "border-amber-300/25 bg-amber-300/10 text-amber-100 hover:border-amber-200/50",
        )}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{assigned ? displayStorageLocation(card) : "Assign storage"}</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-30 w-[320px] max-w-[80vw] rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] bg-[var(--td-background-primary)] p-3 shadow-2xl">
          <TDText variant="label" tone="info">Storage location</TDText>
          <TDText variant="title" className="mt-1">{assigned ? card.storageLocation?.name : "Unassigned"}</TDText>
          {assigned ? <TDText variant="caption" tone="muted">{displayStorageLocation(card)}</TDText> : <TDText variant="caption" tone="muted">Assign this card to an existing physical location.</TDText>}

          <div className="mt-3 max-h-52 space-y-1 overflow-y-auto pr-1">
            {locations.length ? locations.map((location) => (
              <button
                key={location.id}
                type="button"
                disabled={pending || location.id === card.storageLocation?.id}
                onClick={() => onAssign(location.id)}
                className="flex w-full items-center justify-between gap-3 rounded-[var(--td-radius-sm)] border border-transparent px-2 py-2 text-left text-xs font-bold text-[var(--td-text-secondary)] outline-none transition hover:border-[var(--td-border-focus)] hover:text-[var(--td-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="truncate">{location.path.label}</span>
                <span className="shrink-0 text-[10px] text-[var(--td-text-muted)]">{location.assignedQuantity}</span>
              </button>
            )) : <TDText variant="caption" tone="muted">No storage locations yet. Open Storage to create one.</TDText>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {assigned ? <TDButton label="Remove assignment" variant="ghost" size="sm" loading={pending} onClick={() => onAssign(null)} /> : null}
            <TDButton label="Change location" variant="secondary" size="sm" onClick={onToggle} />
          </div>
        </div>
      ) : null}
    </div>
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

function CollectionCardTile({
  card,
  selected,
  onSelect,
  onInspect,
}: {
  card: CollectionCard;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onInspect: () => void;
}) {
  return (
    <TDCard className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <input type="checkbox" aria-label={`Select ${card.cardName}`} checked={selected} onChange={(event) => onSelect(event.target.checked)} className="accent-cyan-300" />
        <TDButton label="Inspect" variant="ghost" size="sm" onClick={onInspect} />
      </div>
      <button type="button" onClick={onInspect} className="aspect-[0.72] overflow-hidden rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
        {card.printing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.printing.imageUrl} alt={`${card.cardName} card image`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--td-text-muted)]">
            <ImageIcon className="h-7 w-7" />
            <TDText variant="caption" tone="muted">Image unavailable</TDText>
          </div>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2">
        <button type="button" onClick={onInspect} className="text-left text-base font-black text-[var(--td-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
          {card.cardName}
        </button>
        <TDText variant="caption" tone="muted">{displayPrinting(card.printing)}</TDText>
        <TDBadge tone={card.gameId === "pokemon" ? "accent" : "neutral"}>{displayGameBadge(card.gameId)}</TDBadge>
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

function MobileInventoryCard({
  card,
  selected,
  onSelect,
  onInspect,
}: {
  card: CollectionCard;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onInspect: () => void;
}) {
  return (
    <article className="rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] p-3">
      <div className="grid grid-cols-[auto_1fr_auto] gap-3">
        <input type="checkbox" aria-label={`Select ${card.cardName}`} checked={selected} onChange={(event) => onSelect(event.target.checked)} className="mt-4 accent-cyan-300" />
        <button type="button" onClick={onInspect} className="grid grid-cols-[48px_1fr] gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
          <CardThumb card={card} size="lg" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-[var(--td-text-primary)]">{card.cardName}</span>
            <span className="mt-1 block text-xs font-semibold text-[var(--td-text-muted)]">{displayPrinting(card.printing)} · {displayCondition(card.condition)}</span>
            <span className="mt-1 block truncate text-xs font-semibold text-[var(--td-text-secondary)]">{displayStorageLocation(card)}</span>
          </span>
        </button>
        <div className="text-right">
          <TDText variant="small">x{card.quantityOwned}</TDText>
          <TDText variant="caption" tone={card.marketPrice.amount === null ? "muted" : "primary"}>{priceLabel(card)}</TDText>
        </div>
      </div>
    </article>
  );
}

function CardThumb({ card, size = "md" }: { card: CollectionCard; size?: "md" | "lg" }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-[var(--td-radius-sm)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)]", size === "lg" ? "h-16 w-12" : "h-12 w-9")}>
      {card.printing.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.printing.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-4 w-4 text-[var(--td-text-muted)]" />
      )}
    </span>
  );
}

function InventoryInspector({
  card,
  storageState,
  pending,
  canUseSellerActions,
  onClose,
  onMove,
  onOpenStorage,
}: {
  card: CollectionCard | null;
  storageState: StorageManagerState | null;
  pending: boolean;
  canUseSellerActions: boolean;
  onClose: () => void;
  onMove: (locationId: string | null) => void;
  onOpenStorage: () => void;
}) {
  if (!card) return null;
  const locations = storageState?.summaries ?? [];
  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[92vh] overflow-y-auto rounded-t-[var(--td-radius-xl)] border border-[var(--td-border-default)] bg-[var(--td-background-primary)] p-4 shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[420px] md:rounded-none md:border-y-0 md:border-r-0 md:p-5" aria-label="Inventory item inspector">
      <div className="flex items-start justify-between gap-4">
        <div>
          <TDText variant="label" tone="info">Inventory Inspector</TDText>
          <TDText as="h2" variant="title" className="mt-1">{card.cardName}</TDText>
          <TDText variant="caption" tone="muted">{displayPrinting(card.printing)}</TDText>
        </div>
        <TDButton label="Close" variant="ghost" size="sm" onClick={onClose} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[140px_1fr] md:grid-cols-1">
        <div className="overflow-hidden rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)]">
          {card.printing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.printing.imageUrl} alt={`${card.cardName} card image`} className="w-full object-cover" />
          ) : (
            <div className="flex aspect-[.72] items-center justify-center text-[var(--td-text-muted)]"><ImageIcon className="h-8 w-8" /></div>
          )}
        </div>
        <div className="space-y-3">
          <InspectorRow label="Game" value={card.gameLabel} />
          <InspectorRow label="Type" value={card.productType === "sealed" ? "Sealed product" : "Single card"} />
          <InspectorRow label="Condition" value={displayCondition(card.condition)} />
          <InspectorRow label="Finish" value={displayFinish(card.printing.finish)} />
          <InspectorRow label="Quantity" value={card.quantityOwned.toLocaleString()} />
          <InspectorRow label="Market value" value={rowMarketValueLabel(card)} muted={card.marketPrice.amount === null} />
          <InspectorRow label="Cost basis" value="Not connected" muted />
          <InspectorRow label="Gain/loss" value="Requires cost basis" muted />
          <InspectorRow label="Listing state" value={canUseSellerActions ? "No linked listing data" : "Seller feature"} muted />
          <InspectorRow label="Storage" value={displayStorageLocation(card)} muted={!card.storageLocation} />
        </div>
      </div>

      <div className="mt-5 rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] p-3">
        <TDText variant="label" tone="muted">Move inventory</TDText>
        <div className="mt-3 grid gap-2">
          {locations.length ? locations.slice(0, 8).map((location) => (
            <button
              key={location.id}
              type="button"
              disabled={pending || location.id === card.storageLocation?.id}
              onClick={() => onMove(location.id)}
              className="flex items-center justify-between gap-3 rounded-[var(--td-radius-sm)] px-2 py-2 text-left text-xs font-bold text-[var(--td-text-secondary)] outline-none transition hover:bg-white/[0.035] hover:text-[var(--td-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)] disabled:opacity-45"
            >
              <span className="truncate">{location.path.label}</span>
              <span>{location.assignedQuantity}</span>
            </button>
          )) : <TDText variant="caption" tone="muted">Create a storage location to move this item.</TDText>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {card.storageLocation ? <TDButton label="Remove assignment" variant="ghost" size="sm" loading={pending} onClick={() => onMove(null)} /> : null}
          <TDButton label="Open Storage" variant="secondary" size="sm" onClick={onOpenStorage} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/dashboard/inventory/${encodeURIComponent(card.id)}`} className="td-button-secondary min-h-10 px-3 text-xs">View Details</Link>
        <Link href="/dashboard/deck-vault" className="td-button-secondary min-h-10 px-3 text-xs">Add to Deck</Link>
        {canUseSellerActions ? <Link href="/dashboard/marketplaces" className="td-button-secondary min-h-10 px-3 text-xs">List</Link> : null}
      </div>
    </aside>
  );
}

function InspectorRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--td-border-default)] pb-2 last:border-b-0">
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant="small" tone={muted ? "muted" : "primary"} className="text-right">{value}</TDText>
    </div>
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

function savedViewToFilter(savedView: InventorySavedView): Pick<CollectionFilter, "tradeBinderStatus" | "wishlistStatus"> {
  if (savedView === "tradeable") return { tradeBinderStatus: "tradeable", wishlistStatus: "all" };
  if (savedView === "wishlist") return { tradeBinderStatus: "all", wishlistStatus: "wanted" };
  return { tradeBinderStatus: "all", wishlistStatus: "all" };
}

function applySavedInventoryView(cards: CollectionCard[], savedView: InventorySavedView) {
  if (savedView === "recent") return cards.filter((card) => timestamp(card.updatedAt) > Date.now() - 30 * 86_400_000);
  if (savedView === "unassigned") return cards.filter((card) => !card.storageLocation);
  if (savedView === "missing_price") return cards.filter((card) => card.marketPrice.amount === null);
  return cards;
}

function toggleSelection(current: string[], id: string, checked: boolean) {
  if (!checked) return current.filter((selectedId) => selectedId !== id);
  return current.includes(id) ? current : [...current, id];
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function rowMarketValueLabel(card: CollectionCard) {
  if (card.marketPrice.amount === null) return "Unavailable";
  return currency(card.marketPrice.amount * card.quantityOwned);
}

function timestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
