"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Command,
  ExternalLink,
  Grid3X3,
  Layers3,
  LibraryBig,
  Loader2,
  MapPin,
  MoreHorizontal,
  PackageOpen,
  Search,
  SearchX,
  Store,
  X,
} from "lucide-react";

import { loadDeckVault } from "@/lib/deck-vault/persistence";
import { searchWebInventory } from "@/lib/collector-workspace-client-data";

const PUT_AWAY_QUEUE_ID = "__trading-docks-put-away-queue__";
const SEARCH_LOAD_TIMEOUT_MS = 10_000;

type LocationRecord = {
  id: string;
  name: string;
  type?: string;
  zone?: string;
};

type SearchableInventoryItem = {
  id: string;
  name: string;
  quantity: number;
  locationId: string;
  category?: string;
  condition?: string;
  set?: string;
  collectorNumber?: string;
  finish?: string;
  imageUrl?: string;
  unitMarketValue?: number;
  value?: number;
  binderPage?: number;
  binderSlot?: string;
  platform?: string;
  listingPlatform?: string;
  listingStatus?: string;
  listingId?: string;
  sku?: string;
  batchCode?: string;
};

type CardPlacement = {
  id: string;
  source: "inventory" | "deck";
  sourceId: string;
  cardName: string;
  quantity: number;
  locationName: string;
  locationDetail: string;
  locationType: string;
  condition?: string;
  set?: string;
  collectorNumber?: string;
  finish?: string;
  imageUrl?: string;
  unitValue: number;
  href: string;
};

type CardGroup = {
  key: string;
  name: string;
  quantity: number;
  value: number;
  imageUrl?: string;
  placements: CardPlacement[];
};

type ResultSort = "relevance" | "name" | "quantity" | "value" | "location";

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[’']/g, "").replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Search data took too long to load.")), timeoutMs);
    }),
  ]);
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[right.length];
}

function fuzzyIncludes(haystack: string, needle: string) {
  if (haystack.includes(needle)) return true;
  const needleWords = needle.split(" ").filter(Boolean);
  const haystackWords = haystack.split(/[\s/·#(),:-]+/).filter(Boolean);
  return needleWords.every((word) =>
    haystackWords.some((candidate) => {
      if (candidate.includes(word) || word.includes(candidate)) return true;
      const allowance = word.length >= 8 ? 2 : word.length >= 5 ? 1 : 0;
      return allowance > 0 && editDistance(candidate, word) <= allowance;
    }),
  );
}

function locationLabel(item: SearchableInventoryItem, location?: LocationRecord) {
  if (item.locationId === PUT_AWAY_QUEUE_ID) {
    return {
      name: "Put-Away Queue",
      detail: "Needs filing",
      type: "queue",
    };
  }

  const platform = item.listingPlatform ?? item.platform;
  if (platform || item.listingStatus) {
    return {
      name: platform ?? "Marketplace",
      detail: item.listingStatus ?? (item.listingId ? `Listing ${item.listingId}` : "Listed for sale"),
      type: "marketplace",
    };
  }

  const pocket =
    item.binderPage && item.binderSlot
      ? `Page ${item.binderPage} · Pocket ${item.binderSlot}`
      : location?.zone
        ? location.zone
        : location?.type === "binder"
          ? "Binder · Pocket not assigned"
          : "Stored inventory";

  const batchDetail = item.batchCode ? `Batch ${item.batchCode}` : "";
  return {
    name: location?.name ?? "Unassigned inventory",
    detail: batchDetail ? `${batchDetail} · ${pocket}` : pocket,
    type: location?.type ?? "unassigned",
  };
}

function PlacementIcon({ type }: { type: string }) {
  const className = "h-4 w-4";
  if (type === "binder") return <LibraryBig className={className} />;
  if (type === "queue") return <PackageOpen className={className} />;
  if (type === "marketplace") return <Store className={className} />;
  if (type === "deck") return <BookOpen className={className} />;
  if (type.includes("sealed")) return <Boxes className={className} />;
  return <Layers3 className={className} />;
}

export function GlobalSearch() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [inventoryAvailable, setInventoryAvailable] = useState(false);
  const [placements, setPlacements] = useState<CardPlacement[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "inventory" | "deck" | "listed">("all");
  const [sort, setSort] = useState<ResultSort>("relevance");
  const [activeResult, setActiveResult] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
      if (!open || !["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("[data-global-search-result]"),
      );
      if (!links.length) return;
      event.preventDefault();
      if (event.key === "ArrowDown") setActiveResult((current) => (current + 1) % links.length);
      if (event.key === "ArrowUp") setActiveResult((current) => (current - 1 + links.length) % links.length);
      if (event.key === "Enter") links[Math.min(activeResult, links.length - 1)]?.click();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeResult, open]);

  useEffect(() => {
    setActiveResult(0);
  }, [activeFilter, query, sort]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    setInventoryAvailable(false);

    void Promise.allSettled([
      withTimeout(searchWebInventory(query), SEARCH_LOAD_TIMEOUT_MS),
      withTimeout(loadDeckVault(), SEARCH_LOAD_TIMEOUT_MS),
    ]).then(([inventoryResult, deckResult]) => {
      if (!active) return;
      const inventorySearch = inventoryResult.status === "fulfilled" ? inventoryResult.value : null;
      const decks = deckResult.status === "fulfilled" ? deckResult.value : [];
      if (!inventorySearch && deckResult.status === "rejected") {
        setLoadError("Inventory could not be loaded. Try closing search and opening it again.");
      } else if (!inventorySearch) {
        setLoadError("Inventory could not be loaded. Your inventory results may be incomplete.");
      }
      setInventoryAvailable(Boolean(inventorySearch));
      if (!inventorySearch) {
        setPlacements(decks.flatMap((deck) => deck.cards.map((card) => ({
          id: `deck:${deck.id}:${card.id}`,
          source: "deck" as const,
          sourceId: deck.id,
          cardName: card.name,
          quantity: Math.max(1, card.quantity || 1),
          locationName: deck.name,
          locationDetail: card.board === "commander" ? "Commander" : card.board === "sideboard" ? "Sideboard" : card.board === "maybeboard" ? "Maybeboard" : "Main deck",
          locationType: "deck",
          set: card.setCode?.toUpperCase(),
          collectorNumber: card.collectorNumber,
          imageUrl: card.image,
          unitValue: card.price || 0,
          href: `/dashboard/deck-vault/decks/${encodeURIComponent(deck.id)}`,
        }))));
        setLoading(false);
        return;
      }
      const locations = inventorySearch.locations as unknown as LocationRecord[];
      const items = inventorySearch.items.map((item) => ({
        id: item.id,
        name: item.card_name ?? (typeof item.data?.name === "string" ? item.data.name : "Unnamed card"),
        quantity: item.quantity ?? 0,
        locationId: item.location_id ?? (typeof item.data?.locationId === "string" ? item.data.locationId : ""),
        category: item.product_type === "sealed" ? "Sealed" : "Single",
        condition: typeof item.data?.condition === "string" ? item.data.condition : undefined,
        set: typeof item.data?.setName === "string" ? item.data.setName : item.set_code ?? undefined,
        collectorNumber: typeof item.data?.collectorNumber === "string" ? item.data.collectorNumber : item.collector_number ?? undefined,
        finish: typeof item.data?.finish === "string" ? item.data.finish : undefined,
        imageUrl: typeof item.data?.imageUrl === "string" ? item.data.imageUrl : undefined,
        unitMarketValue: item.quantity ? (item.inventory_value ?? 0) / item.quantity : undefined,
        value: item.inventory_value ?? undefined,
        platform: typeof item.data?.listingPlatform === "string" ? item.data.listingPlatform : undefined,
        listingPlatform: typeof item.data?.listingPlatform === "string" ? item.data.listingPlatform : undefined,
        listingStatus: typeof item.data?.listingStatus === "string" ? item.data.listingStatus : undefined,
        listingId: typeof item.data?.listingId === "string" ? item.data.listingId : undefined,
        sku: item.sku ?? undefined,
      })) as SearchableInventoryItem[];
      const locationMap = new Map(locations.map((location) => [location.id, location]));
      const inventoryPlacements: CardPlacement[] = items
        .filter((item) => item.category === "Single" || !item.category)
        .map((item) => {
          const placement = locationLabel(item, locationMap.get(item.locationId));
          return {
            id: `inventory:${item.id}`,
            source: "inventory",
            sourceId: item.id,
            cardName: item.name,
            quantity: Math.max(1, item.quantity || 1),
            locationName: placement.name,
            locationDetail: placement.detail,
            locationType: placement.type,
            condition: item.condition,
            set: item.set,
            collectorNumber: item.collectorNumber,
            finish: item.finish,
            imageUrl: item.imageUrl,
            unitValue:
              item.unitMarketValue ??
              ((item.value ?? 0) / Math.max(1, item.quantity || 1)),
            href: `/dashboard/cards/${encodeURIComponent(item.id)}`,
          };
        });

      const deckPlacements: CardPlacement[] = decks.flatMap((deck) =>
        deck.cards.map((card) => ({
          id: `deck:${deck.id}:${card.id}`,
          source: "deck" as const,
          sourceId: deck.id,
          cardName: card.name,
          quantity: Math.max(1, card.quantity || 1),
          locationName: deck.name,
          locationDetail:
            card.board === "commander"
              ? "Commander"
              : card.board === "sideboard"
                ? "Sideboard"
                : card.board === "maybeboard"
                  ? "Maybeboard"
                  : "Main deck",
          locationType: "deck",
          set: card.setCode?.toUpperCase(),
          collectorNumber: card.collectorNumber,
          imageUrl: card.image,
          unitValue: card.price || 0,
          href: `/dashboard/deck-vault/decks/${encodeURIComponent(deck.id)}`,
        })),
      );

      setPlacements([...inventoryPlacements, ...deckPlacements]);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [open, query]);

  const filteredGroups = useMemo(() => {
    const needle = normalize(query);
    if (needle.length < 2) return [];

    const matching = placements.filter((placement) => {
      const searchable = normalize(
        [
          placement.cardName,
          placement.set,
          placement.collectorNumber,
          placement.locationName,
          placement.condition,
          placement.locationDetail,
        ]
          .filter(Boolean)
          .join(" "),
      );
      const filterMatch =
        activeFilter === "all" ||
        (activeFilter === "inventory" && placement.source === "inventory") ||
        (activeFilter === "deck" && placement.source === "deck") ||
        (activeFilter === "listed" && placement.locationType === "marketplace");
      return filterMatch && fuzzyIncludes(searchable, needle);
    });

    const groups = new Map<string, CardPlacement[]>();
    matching.forEach((placement) => {
      const key = normalize(placement.cardName);
      groups.set(key, [...(groups.get(key) ?? []), placement]);
    });

    const result = [...groups.entries()]
      .map(([key, groupPlacements]) => ({
        key,
        name: groupPlacements[0].cardName,
        quantity: groupPlacements.reduce((sum, item) => sum + item.quantity, 0),
        value: groupPlacements.reduce(
          (sum, item) => sum + item.unitValue * item.quantity,
          0,
        ),
        imageUrl: groupPlacements.find((item) => item.imageUrl)?.imageUrl,
        placements: groupPlacements.sort((a, b) =>
          a.locationName.localeCompare(b.locationName),
        ),
      }));

    result.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "quantity") return b.quantity - a.quantity;
      if (sort === "value") return b.value - a.value;
      if (sort === "location") {
        return (a.placements[0]?.locationName ?? "").localeCompare(
          b.placements[0]?.locationName ?? "",
        );
      }
      return (
        Number(normalize(a.name) !== needle) - Number(normalize(b.name) !== needle) ||
        Number(!normalize(a.name).startsWith(needle)) - Number(!normalize(b.name).startsWith(needle)) ||
        a.name.localeCompare(b.name)
      );
    });

    return result.slice(0, 20);
  }, [activeFilter, placements, query, sort]);

  const resultQuantity = filteredGroups.reduce((sum, group) => sum + group.quantity, 0);
  const locationCount = new Set(
    filteredGroups.flatMap((group) =>
      group.placements.map((placement) => `${placement.locationType}:${placement.locationName}`),
    ),
  ).size;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] px-3 text-left transition hover:border-td-accent/[0.16] hover:bg-td-accent/[0.035] sm:max-w-[540px]"
        aria-label="Search all cards and inventory"
      >
        <Search className="h-4 w-4 shrink-0 text-td-muted group-hover:text-td-accent-text/75" />
        <span className="min-w-0 flex-1 truncate text-xs text-td-muted">
          Find any card across inventory, decks, binders, boxes...
        </span>
        <kbd className="hidden items-center gap-1 rounded-md border border-td-ink/[0.07] bg-black/20 px-1.5 py-0.5 font-sans text-[11px] text-td-muted sm:inline-flex">
          <Command className="h-2.5 w-2.5" /> K
        </kbd>
      </button>

      {mounted && open
        ? createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-td-canvas/95 px-3 py-4 backdrop-blur-md sm:px-6 sm:py-[7vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Search Trading Docks"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="relative isolate w-full max-w-5xl overflow-hidden rounded-[28px] border border-td-accent/[0.14] bg-td-surface shadow-[0_35px_120px_rgb(var(--td-shadow-rgb)/calc(0.82*var(--td-shadow-strength))),0_0_50px_rgb(var(--td-accent-rgb)/0.06)]">
            <div className="bg-td-surface p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 shrink-0 text-td-accent-text" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search a card name, set, collector number, or location..."
                  className="h-11 min-w-0 flex-1 bg-transparent text-base font-semibold text-td-primary outline-none placeholder:font-normal placeholder:text-td-muted sm:text-lg"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-td-muted transition hover:bg-td-ink/[0.05] hover:text-td-primary"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="hidden rounded-lg border border-td-ink/[0.07] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-td-muted transition hover:text-td-secondary sm:block"
                >
                  Esc
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-td-ink/[0.07] pt-4">
                {([
                  ["all", "Everywhere"],
                  ["inventory", "Inventory"],
                  ["deck", "Decks"],
                  ["listed", "Listed"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveFilter(id)}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition",
                      activeFilter === id
                        ? "border-td-accent/25 bg-td-accent/[0.09] text-td-accent-text"
                        : "border-td-ink/[0.08] bg-td-ink/[0.025] text-td-secondary hover:text-td-primary",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
                <button type="button" className="rounded-lg border border-td-ink/[0.08] bg-td-ink/[0.025] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-td-secondary" title="Sealed products, vendors, events, orders, and tasks are coming next">
                  <span className="inline-flex items-center gap-1.5">More <MoreHorizontal className="h-3 w-3" /></span>
                </button>
                <label className="ml-auto flex items-center gap-2 text-[11px] text-td-secondary">
                  <span>Sort</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value as ResultSort)} className="h-8 rounded-lg border border-td-ink/[0.08] bg-td-surface px-2 text-[11px] text-td-primary outline-none">
                    <option value="relevance">Relevance</option>
                    <option value="name">Card name</option>
                    <option value="quantity">Quantity</option>
                    <option value="value">Highest value</option>
                    <option value="location">Location</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="max-h-[68vh] min-h-[360px] overflow-y-auto p-3 sm:p-5">
              {loading ? (
                <div className="flex min-h-[330px] flex-col items-center justify-center text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-td-accent-text" />
                  <p className="mt-3 text-sm font-semibold text-td-secondary">Checking every card location…</p>
                </div>
              ) : loadError ? (
                <div className="flex min-h-[330px] flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-td-warning/[0.14] bg-td-warning/[0.05]"><SearchX className="h-6 w-6 text-td-warning" /></div>
                  <p className="mt-4 text-base font-semibold text-td-primary">Search data is unavailable</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-td-secondary">{loadError}</p>
                </div>
              ) : query.trim().length < 2 ? (
                <SearchEmpty />
              ) : filteredGroups.length ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 px-1 text-[12px] text-td-secondary">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-td-success" />
                      {resultQuantity} {resultQuantity === 1 ? "copy" : "copies"} found
                    </span>
                    <span>across {locationCount} {locationCount === 1 ? "location" : "locations"}</span>
                  </div>
                  {filteredGroups.map((group, groupIndex) => {
                    const startIndex = filteredGroups
                      .slice(0, groupIndex)
                      .reduce((sum, item) => sum + item.placements.length, 0);
                    return <CardResult key={group.key} group={group} startIndex={startIndex} activeResult={activeResult} onNavigate={() => setOpen(false)} />;
                  })}
                </div>
              ) : (
                <div className="flex min-h-[330px] flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.025]">
                    <Search className="h-6 w-6 text-td-muted" />
                  </div>
                  <SearchX className="mt-4 h-5 w-5 text-td-muted" />
                  <p className="mt-3 text-base font-semibold text-td-primary">{activeFilter === "inventory" && inventoryAvailable ? `“${query.trim()}” is not in your inventory` : `Nothing in ${activeFilter === "all" ? "your inventory, decks, or listings" : activeFilter === "deck" ? "your decks" : "your listings"} matches “${query.trim()}”`}</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-td-secondary">
                    {activeFilter === "inventory" && inventoryAvailable ? "This search checked your saved inventory and found no matching cards." : "We finished checking the selected card locations. Try another spelling, printing, set code, collector number, or location name."}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Link href="/dashboard/inventory" onClick={() => setOpen(false)} className="rounded-lg border border-td-accent/20 bg-td-accent/[0.07] px-3 py-2 text-xs font-semibold text-td-accent-text">Add to inventory</Link>
                    <a href={`https://scryfall.com/search?q=${encodeURIComponent(query.trim())}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-td-ink/[0.08] px-3 py-2 text-xs font-semibold text-td-secondary">Search Scryfall <ExternalLink className="h-3.5 w-3.5" /></a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}

function SearchEmpty() {
  return (
    <div className="grid min-h-[330px] place-items-center">
      <div className="max-w-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-td-accent/[0.13] bg-td-accent/[0.045]">
          <MapPin className="h-7 w-7 text-td-accent-text/75" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-td-primary">Find any card, wherever it lives</h2>
        <p className="mt-2 text-xs leading-5 text-td-muted">
          Search checks binders and pocket addresses, bulk boxes, decks, the Put-Away Queue,
          unassigned inventory, and marketplace listing details stored with each card.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {["Cyclonic Rift", "Sol Ring", "Commander Masters", "Bulk Box A"].map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-lg border border-td-ink/[0.06] bg-td-ink/[0.018] px-3 py-1.5 text-[11px] text-td-muted"
              disabled
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardResult({
  group,
  startIndex,
  activeResult,
  onNavigate,
}: {
  group: CardGroup;
  startIndex: number;
  activeResult: number;
  onNavigate: () => void;
}) {
  const printing = group.placements.find((placement) =>
    placement.set || placement.collectorNumber || placement.finish,
  );
  return (
    <section className="overflow-hidden rounded-2xl border border-td-ink/[0.075] bg-td-canvas/75">
      <div className="flex gap-3 border-b border-td-ink/[0.06] p-3.5 sm:gap-4 sm:p-4">
        <div className="group/image relative h-[86px] w-[62px] shrink-0 overflow-visible rounded-lg border border-td-ink/[0.09] bg-td-ink/[0.025]">
          {group.imageUrl ? (
            <>
              <Image src={group.imageUrl} alt="" fill sizes="62px" className="rounded-lg object-cover" unoptimized />
              <div className="pointer-events-none absolute left-full top-0 z-30 ml-3 hidden h-[310px] w-[223px] overflow-hidden rounded-2xl border border-td-ink/15 bg-td-canvas shadow-2xl group-hover/image:block">
                <Image src={group.imageUrl} alt={`${group.name} preview`} fill sizes="223px" className="object-cover" unoptimized />
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Grid3X3 className="h-5 w-5 text-td-muted" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-td-primary sm:text-base">{group.name}</h3>
              <p className="mt-1 text-[12px] text-td-secondary">
                {printing?.set ? `${printing.set}` : "Printing not recorded"}
                {printing?.collectorNumber ? ` · #${printing.collectorNumber}` : ""}
                {printing?.finish ? ` · ${printing.finish}` : ""}
              </p>
              <p className="mt-1 text-[11px] text-td-secondary">
                {group.quantity} total {group.quantity === 1 ? "copy" : "copies"} across {group.placements.length}{" "}
                {group.placements.length === 1 ? "location" : "locations"}
              </p>
            </div>
            <div className="rounded-xl border border-td-success/[0.12] bg-td-success/[0.045] px-3 py-2 text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-td-success/75">Total value</p>
              <p className="mt-0.5 text-sm font-semibold text-td-success">${group.value.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="border-b border-td-ink/[0.055] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.13em] text-td-accent-text/70">
          Found in {group.placements.length} {group.placements.length === 1 ? "location" : "locations"}
        </p>
        <div className="divide-y divide-td-ink/[0.055]">
        {group.placements.map((placement, placementIndex) => (
          <Link
            key={placement.id}
            href={placement.href}
            onClick={onNavigate}
            data-global-search-result
            className={[
              "group flex items-center gap-3 border-l-2 px-3.5 py-3.5 transition sm:px-4",
              activeResult === startIndex + placementIndex
                ? "border-td-accent bg-td-accent/[0.08]"
                : "border-transparent hover:border-td-accent/60 hover:bg-td-accent/[0.045]",
            ].join(" ")}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] text-td-accent-text/75">
              <PlacementIcon type={placement.locationType} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate text-sm font-semibold text-td-primary">{placement.locationName}</p>
                <span className="rounded-md bg-td-ink/[0.035] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-td-muted">
                  {placement.source === "deck" ? "Deck" : placement.locationType === "marketplace" ? "Listed" : "Inventory"}
                </span>
              </div>
              <p className="mt-1 truncate text-[12px] text-td-secondary">
                {placement.locationDetail}
                {placement.condition ? ` · ${placement.condition}` : ""}
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-4 sm:flex">
              <span className="text-right">
                <span className="block text-[11px] uppercase tracking-[0.1em] text-td-muted">Quantity</span>
                <span className="text-sm font-semibold text-td-primary">{placement.quantity}</span>
              </span>
              <span className="text-right">
                <span className="block text-[11px] uppercase tracking-[0.1em] text-td-muted">Value here</span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-td-primary">
                  <CircleDollarSign className="h-3 w-3 text-td-success/55" />
                  {(placement.unitValue * placement.quantity).toFixed(2)}
                </span>
              </span>
            </div>
            <span className="hidden shrink-0 items-center gap-1 text-[11px] font-semibold text-td-accent-text sm:inline-flex">Open location <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
          </Link>
        ))}
        </div>
      </div>
    </section>
  );
}
