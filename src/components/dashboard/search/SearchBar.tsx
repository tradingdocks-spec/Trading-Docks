"use client";

import Link from "next/link";
import {
  Boxes,
  CalendarDays,
  Command,
  FolderKanban,
  History,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SearchCategory =
  | "Inventory"
  | "Organization"
  | "Commerce"
  | "Actions";

type SearchResult = {
  id: string;
  title: string;
  description: string;
  href: string;
  category: SearchCategory;
  keywords: string[];
  icon: typeof Search;
  badge?: string;
};

type SearchBarProps = {
  className?: string;
  compact?: boolean;
};

const searchResults: SearchResult[] = [
  {
    id: "all-inventory",
    title: "All Inventory",
    description: "Search every card, product, grade, and location.",
    href: "/dashboard/inventory",
    category: "Inventory",
    keywords: [
      "inventory",
      "cards",
      "singles",
      "sealed",
      "graded",
      "bulk",
    ],
    icon: Boxes,
  },
  {
    id: "singles",
    title: "Singles",
    description: "Browse individual cards by set, condition, and printing.",
    href: "/dashboard/inventory?view=singles",
    category: "Inventory",
    keywords: [
      "single",
      "cards",
      "magic",
      "mtg",
      "pokemon",
      "condition",
    ],
    icon: Sparkles,
  },
  {
    id: "sealed",
    title: "Sealed Products",
    description: "Boxes, bundles, packs, cases, and preconstructed decks.",
    href: "/dashboard/inventory?view=sealed",
    category: "Inventory",
    keywords: [
      "sealed",
      "booster",
      "box",
      "bundle",
      "pack",
      "deck",
    ],
    icon: Package,
  },
  {
    id: "graded",
    title: "Graded Cards",
    description: "PSA, BGS, CGC, SGC, and certification tracking.",
    href: "/dashboard/inventory?view=graded",
    category: "Inventory",
    keywords: [
      "graded",
      "psa",
      "bgs",
      "cgc",
      "sgc",
      "slab",
      "certification",
    ],
    icon: Sparkles,
  },
  {
    id: "binders",
    title: "Binders",
    description: "Open binder collections and page-based storage.",
    href: "/dashboard/organization/binders",
    category: "Organization",
    keywords: [
      "binder",
      "pages",
      "collection",
      "storage",
      "organization",
    ],
    icon: FolderKanban,
  },
  {
    id: "locations",
    title: "Storage Locations",
    description: "Find shelves, boxes, bins, vaults, and warehouse spaces.",
    href: "/dashboard/organization/locations",
    category: "Organization",
    keywords: [
      "location",
      "shelf",
      "box",
      "bin",
      "warehouse",
      "vault",
    ],
    icon: Store,
  },
  {
    id: "card-shows",
    title: "Card Shows",
    description: "Plan events, manage show inventory, record sales, and track profit.",
    href: "/dashboard/card-shows",
    category: "Commerce",
    keywords: [
      "card show",
      "event",
      "vendor",
      "booth",
      "table",
      "show inventory",
      "show sales",
    ],
    icon: CalendarDays,
  },
  {
    id: "marketplaces",
    title: "Marketplaces",
    description: "Manage TCGplayer, eBay, Shopify, and Mana Pool.",
    href: "/dashboard/marketplaces",
    category: "Commerce",
    keywords: [
      "marketplace",
      "tcgplayer",
      "ebay",
      "shopify",
      "mana pool",
      "listing",
    ],
    icon: Store,
  },
  {
    id: "orders",
    title: "Orders",
    description: "Review open, fulfilled, shipped, and returned orders.",
    href: "/dashboard/orders",
    category: "Commerce",
    keywords: [
      "order",
      "shipping",
      "fulfilled",
      "pending",
      "return",
      "sale",
    ],
    icon: ShoppingBag,
    badge: "12 open",
  },
  {
    id: "add-card",
    title: "Add a Card",
    description: "Create a new single-card inventory record.",
    href: "/dashboard/inventory/new?type=single",
    category: "Actions",
    keywords: [
      "add",
      "new",
      "create",
      "card",
      "single",
      "inventory",
    ],
    icon: Sparkles,
  },
  {
    id: "create-binder",
    title: "Create a Binder",
    description: "Start a new binder and configure its layout.",
    href: "/dashboard/organization/binders/new",
    category: "Actions",
    keywords: [
      "create",
      "new",
      "binder",
      "pages",
      "collection",
    ],
    icon: FolderKanban,
  },
];

const categoryOrder: SearchCategory[] = [
  "Inventory",
  "Organization",
  "Commerce",
  "Actions",
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function matchesResult(result: SearchResult, query: string) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchableContent = [
    result.title,
    result.description,
    result.category,
    ...result.keywords,
  ]
    .join(" ")
    .toLowerCase();

  return normalizedQuery
    .split(/\s+/)
    .every((term) => searchableContent.includes(term));
}

export function SearchBar({
  className = "",
  compact = false,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredResults = useMemo(
    () =>
      searchResults.filter((result) =>
        matchesResult(result, query),
      ),
    [query],
  );

  const groupedResults = useMemo(
    () =>
      categoryOrder
        .map((category) => ({
          category,
          items: filteredResults.filter(
            (result) => result.category === category,
          ),
        }))
        .filter((group) => group.items.length > 0),
    [filteredResults],
  );

  const flatResults = useMemo(
    () => groupedResults.flatMap((group) => group.items),
    [groupedResults],
  );

  const closeSearch = useCallback(() => {
    setOpen(false);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      const isShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k";

      if (!isShortcut) {
        return;
      }

      event.preventDefault();
      setOpen(true);

      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }

    window.addEventListener("keydown", handleKeyboardShortcut);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboardShortcut,
      );
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeSearch();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
    };
  }, [closeSearch]);

  useEffect(() => {
    if (activeIndex >= flatResults.length) {
      setActiveIndex(Math.max(flatResults.length - 1, 0));
    }
  }, [activeIndex, flatResults.length]);

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (!open && event.key !== "Escape") {
      setOpen(true);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      setActiveIndex((current) =>
        flatResults.length === 0
          ? 0
          : (current + 1) % flatResults.length,
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      setActiveIndex((current) =>
        flatResults.length === 0
          ? 0
          : (current - 1 + flatResults.length) %
            flatResults.length,
      );
    }

    if (event.key === "Enter") {
      const selectedResult = flatResults[activeIndex];

      if (!selectedResult) {
        return;
      }

      event.preventDefault();
      window.location.href = selectedResult.href;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      inputRef.current?.blur();
    }
  }

  function clearQuery() {
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
    >
      <div
        className={`group relative flex items-center rounded-xl border transition-all duration-200 ${
          open
            ? "border-cyan-300/30 bg-[#08131a] shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_14px_40px_rgba(0,0,0,0.24),0_0_30px_rgba(34,211,238,0.06)]"
            : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.13] hover:bg-white/[0.035]"
        } ${
          compact ? "h-9" : "h-10"
        }`}
      >
        <Search
          className={`ml-3 h-4 w-4 shrink-0 transition-colors ${
            open
              ? "text-cyan-300"
              : "text-slate-600 group-hover:text-slate-400"
          }`}
        />

        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search inventory, orders, locations..."
          aria-label="Search Trading Docks"
          aria-expanded={open}
          aria-controls="dashboard-search-results"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[11px] text-white outline-none placeholder:text-slate-600"
        />

        {query ? (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="Clear search"
            className="mr-1.5 flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="mr-2 hidden items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.035] px-1.5 py-1 text-[8px] font-medium text-slate-600 sm:flex">
            <Command className="h-2.5 w-2.5" />
            K
          </div>
        )}
      </div>

      {open ? (
        <div
          id="dashboard-search-results"
          className="absolute left-0 right-0 top-[calc(100%+10px)] z-[80] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#071017]/98 shadow-[0_28px_90px_rgba(0,0,0,0.58),0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-2xl"
        >
          <div className="border-b border-white/[0.07] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold text-white">
                  Search Trading Docks
                </p>

                <p className="mt-0.5 text-[9px] text-slate-600">
                  Inventory, navigation, orders, and actions
                </p>
              </div>

              <div className="hidden items-center gap-1.5 text-[8px] text-slate-600 sm:flex">
                <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5">
                  ↑↓
                </span>
                Navigate
                <span className="ml-1 rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5">
                  Enter
                </span>
                Open
              </div>
            </div>
          </div>

          <div className="search-results-scrollbar max-h-[440px] overflow-y-auto p-2">
            {!query ? (
              <div className="mb-2 flex items-center gap-2 px-2 py-1 text-[9px] text-slate-600">
                <History className="h-3 w-3" />
                Suggested destinations
              </div>
            ) : null}

            {groupedResults.length > 0 ? (
              <div className="space-y-3">
                {groupedResults.map((group) => (
                  <div key={group.category}>
                    <p className="px-2 pb-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {group.category}
                    </p>

                    <div className="space-y-1">
                      {group.items.map((result) => {
                        const currentIndex = flatResults.findIndex(
                          (flatResult) => flatResult.id === result.id,
                        );
                        const active =
                          currentIndex === activeIndex;
                        const Icon = result.icon;

                        return (
                          <Link
                            key={result.id}
                            href={result.href}
                            onMouseEnter={() =>
                              setActiveIndex(currentIndex)
                            }
                            onClick={closeSearch}
                            className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                              active
                                ? "border-cyan-300/20 bg-cyan-400/[0.07] shadow-[0_0_22px_rgba(34,211,238,0.05)]"
                                : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.03]"
                            }`}
                          >
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
                                active
                                  ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-300"
                                  : "border-white/[0.07] bg-white/[0.025] text-slate-600 group-hover:text-slate-400"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p
                                  className={`truncate text-[11px] font-medium ${
                                    active
                                      ? "text-cyan-100"
                                      : "text-slate-200"
                                  }`}
                                >
                                  {result.title}
                                </p>

                                {result.badge ? (
                                  <span className="shrink-0 rounded-full border border-cyan-300/15 bg-cyan-400/[0.07] px-2 py-0.5 text-[8px] text-cyan-300">
                                    {result.badge}
                                  </span>
                                ) : null}
                              </div>

                              <p className="mt-0.5 truncate text-[9px] text-slate-600">
                                {result.description}
                              </p>
                            </div>

                            <span
                              className={`text-[9px] transition ${
                                active
                                  ? "translate-x-0 text-cyan-300 opacity-100"
                                  : "-translate-x-1 text-slate-700 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                              }`}
                            >
                              Open
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[190px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025] text-slate-600">
                  <Search className="h-4 w-4" />
                </div>

                <p className="mt-3 text-[11px] font-medium text-slate-300">
                  No results found
                </p>

                <p className="mt-1 max-w-[270px] text-[9px] leading-4 text-slate-600">
                  Try searching for an inventory category,
                  marketplace, order, binder, or storage location.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-2.5">
            <p className="text-[8px] text-slate-600">
              Search will expand to individual cards, SKUs, orders,
              and customers when those records are connected.
            </p>

            <button
              type="button"
              onClick={closeSearch}
              className="ml-4 shrink-0 text-[8px] font-medium text-slate-600 transition hover:text-slate-300"
            >
              Esc to close
            </button>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .search-results-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.14)
            transparent;
        }

        .search-results-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .search-results-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .search-results-scrollbar::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.12);
        }

        .search-results-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.2);
        }
      `}</style>
    </div>
  );
}
