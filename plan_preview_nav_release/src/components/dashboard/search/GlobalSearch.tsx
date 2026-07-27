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

import { accountStorageKey } from "@/lib/account-storage";
import type { DeckRecord } from "@/lib/deck-vault/types";

const LOCATION_KEY = "trading-docks-inventory-locations-v1";
const ITEM_KEY = "trading-docks-inventory-items-v1";
const DECK_LIST_KEY = "trading-docks-imported-decks";
const PUT_AWAY_QUEUE_ID = "__trading-docks-put-away-queue__";

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

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ").trim();
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

  return {
    name: location?.name ?? "Unassigned inventory",
    detail: pocket,
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

    void Promise.all([
      accountStorageKey(LOCATION_KEY),
      accountStorageKey(ITEM_KEY),
      accountStorageKey(DECK_LIST_KEY),
    ]).then(async ([locationKey, itemKey, deckListKey]) => {
      const locations = safeParse<LocationRecord[]>(localStorage.getItem(locationKey), []);
      const items = safeParse<SearchableInventoryItem[]>(localStorage.getItem(itemKey), []);
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
            href: `/dashboard/inventory?item=${encodeURIComponent(item.id)}&location=${encodeURIComponent(item.locationId)}`,
          };
        });

      const deckIds = safeParse<string[]>(localStorage.getItem(deckListKey), []);
      const deckKeys = await Promise.all(
        deckIds.map((deckId) => accountStorageKey(`trading-docks-deck:${deckId}`)),
      );
      const decks = deckKeys
        .map((key) => safeParse<DeckRecord | null>(localStorage.getItem(key), null))
        .filter((deck): deck is DeckRecord => Boolean(deck));
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

      if (active) {
        setPlacements([...inventoryPlacements, ...deckPlacements]);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [open]);

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
        className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-left transition hover:border-cyan-300/[0.16] hover:bg-cyan-400/[0.035] sm:max-w-[540px]"
        aria-label="Search all cards and inventory"
      >
        <Search className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-cyan-300/75" />
        <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
          Find any card across inventory, decks, binders, boxes...
        </span>
        <kbd className="hidden items-center gap-1 rounded-md border border-white/[0.07] bg-black/20 px-1.5 py-0.5 font-sans text-[10px] text-slate-600 sm:inline-flex">
          <Command className="h-2.5 w-2.5" /> K
        </kbd>
      </button>

      {mounted && open
        ? createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-[#01070c]/95 px-3 py-4 backdrop-blur-md sm:px-6 sm:py-[7vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Search Trading Docks"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="relative isolate w-full max-w-5xl overflow-hidden rounded-[28px] border border-cyan-300/[0.14] bg-[#06131d] shadow-[0_35px_120px_rgba(0,0,0,0.82),0_0_50px_rgba(34,211,238,0.06)]">
            <div className="bg-[#06131d] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 shrink-0 text-cyan-300" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search a card name, set, collector number, or location..."
                  className="h-11 min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:font-normal placeholder:text-slate-600 sm:text-lg"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="hidden rounded-lg border border-white/[0.07] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 transition hover:text-slate-300 sm:block"
                >
                  Esc
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-4">
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
                      "rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition",
                      activeFilter === id
                        ? "border-cyan-300/25 bg-cyan-300/[0.09] text-cyan-100"
                        : "border-white/[0.08] bg-white/[0.025] text-slate-400 hover:text-white",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
                <button type="button" className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400" title="Sealed products, vendors, events, orders, and tasks are coming next">
                  <span className="inline-flex items-center gap-1.5">More <MoreHorizontal className="h-3 w-3" /></span>
                </button>
                <label className="ml-auto flex items-center gap-2 text-[10px] text-slate-400">
                  <span>Sort</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value as ResultSort)} className="h-8 rounded-lg border border-white/[0.08] bg-[#081a26] px-2 text-[11px] text-slate-200 outline-none">
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
                  <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-300">Checking every card location…</p>
                </div>
              ) : query.trim().length < 2 ? (
                <SearchEmpty />
              ) : filteredGroups.length ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 px-1 text-[12px] text-slate-300">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
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
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                    <Search className="h-6 w-6 text-slate-600" />
                  </div>
                  <SearchX className="mt-4 h-5 w-5 text-slate-500" />
                  <p className="mt-3 text-base font-semibold text-slate-100">No cards found for “{query.trim()}”</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                    Try another spelling, printing, set code, collector number, or location name.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Link href="/dashboard/inventory" onClick={() => setOpen(false)} className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold text-cyan-100">Add to inventory</Link>
                    <a href={`https://scryfall.com/search?q=${encodeURIComponent(query.trim())}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-semibold text-slate-300">Search Scryfall <ExternalLink className="h-3.5 w-3.5" /></a>
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-cyan-300/[0.13] bg-cyan-400/[0.045]">
          <MapPin className="h-7 w-7 text-cyan-300/75" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-white">Find any card, wherever it lives</h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Search checks binders and pocket addresses, bulk boxes, decks, the Put-Away Queue,
          unassigned inventory, and marketplace listing details stored with each card.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {["Cyclonic Rift", "Sol Ring", "Commander Masters", "Bulk Box A"].map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-lg border border-white/[0.06] bg-white/[0.018] px-3 py-1.5 text-[10px] text-slate-500"
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
    <section className="overflow-hidden rounded-2xl border border-white/[0.075] bg-[#020c13]/75">
      <div className="flex gap-3 border-b border-white/[0.06] p-3.5 sm:gap-4 sm:p-4">
        <div className="group/image relative h-[86px] w-[62px] shrink-0 overflow-visible rounded-lg border border-white/[0.09] bg-white/[0.025]">
          {group.imageUrl ? (
            <>
              <Image src={group.imageUrl} alt="" fill sizes="62px" className="rounded-lg object-cover" unoptimized />
              <div className="pointer-events-none absolute left-full top-0 z-30 ml-3 hidden h-[310px] w-[223px] overflow-hidden rounded-2xl border border-white/15 bg-[#020912] shadow-2xl group-hover/image:block">
                <Image src={group.imageUrl} alt={`${group.name} preview`} fill sizes="223px" className="object-cover" unoptimized />
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Grid3X3 className="h-5 w-5 text-slate-700" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white sm:text-base">{group.name}</h3>
              <p className="mt-1 text-[12px] text-slate-300">
                {printing?.set ? `${printing.set}` : "Printing not recorded"}
                {printing?.collectorNumber ? ` · #${printing.collectorNumber}` : ""}
                {printing?.finish ? ` · ${printing.finish}` : ""}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {group.quantity} total {group.quantity === 1 ? "copy" : "copies"} across {group.placements.length}{" "}
                {group.placements.length === 1 ? "location" : "locations"}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-300/[0.12] bg-emerald-300/[0.045] px-3 py-2 text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-300/75">Total value</p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-100">${group.value.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="border-b border-white/[0.055] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-200/70">
          Found in {group.placements.length} {group.placements.length === 1 ? "location" : "locations"}
        </p>
        <div className="divide-y divide-white/[0.055]">
        {group.placements.map((placement, placementIndex) => (
          <Link
            key={placement.id}
            href={placement.href}
            onClick={onNavigate}
            data-global-search-result
            className={[
              "group flex items-center gap-3 border-l-2 px-3.5 py-3.5 transition sm:px-4",
              activeResult === startIndex + placementIndex
                ? "border-cyan-300 bg-cyan-400/[0.08]"
                : "border-transparent hover:border-cyan-300/60 hover:bg-cyan-400/[0.045]",
            ].join(" ")}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-cyan-300/75">
              <PlacementIcon type={placement.locationType} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate text-sm font-semibold text-white">{placement.locationName}</p>
                <span className="rounded-md bg-white/[0.035] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  {placement.source === "deck" ? "Deck" : placement.locationType === "marketplace" ? "Listed" : "Inventory"}
                </span>
              </div>
              <p className="mt-1 truncate text-[12px] text-slate-300">
                {placement.locationDetail}
                {placement.condition ? ` · ${placement.condition}` : ""}
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-4 sm:flex">
              <span className="text-right">
                <span className="block text-[9px] uppercase tracking-[0.1em] text-slate-500">Quantity</span>
                <span className="text-sm font-semibold text-white">{placement.quantity}</span>
              </span>
              <span className="text-right">
                <span className="block text-[9px] uppercase tracking-[0.1em] text-slate-500">Value here</span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-200">
                  <CircleDollarSign className="h-3 w-3 text-emerald-300/55" />
                  {(placement.unitValue * placement.quantity).toFixed(2)}
                </span>
              </span>
            </div>
            <span className="hidden shrink-0 items-center gap-1 text-[11px] font-semibold text-cyan-200 sm:inline-flex">Open location <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
          </Link>
        ))}
        </div>
      </div>
    </section>
  );
}
