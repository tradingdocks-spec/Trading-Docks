"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Clock3,
  Command,
  Search,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  quickCreateItems,
  type QuickCreateGroup,
  type QuickCreateItem,
} from "./quickCreateItems";

type QuickCreateMenuProps = {
  onClose: () => void;
  currentWorkspaceType?: "Collector" | "Seller" | "LGS" | "Warehouse";
};

const groupOrder: QuickCreateGroup[] = [
  "Inventory",
  "Organization",
  "Imports",
  "Commerce",
  "Automation",
];

const RECENT_STORAGE_KEY = "trading-docks-quick-create-recent";
const MAX_RECENT_ITEMS = 3;

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function matchesSearch(item: QuickCreateItem, query: string) {
  const normalizedQuery = normalizeSearch(query);

  if (!normalizedQuery) {
    return true;
  }

  const terms = normalizedQuery.split(/\s+/);

  const searchableContent = [
    item.title,
    item.description,
    item.group,
    ...item.keywords,
  ]
    .join(" ")
    .toLowerCase();

  return terms.every((term) => searchableContent.includes(term));
}

function getInitialRecentIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(
      RECENT_STORAGE_KEY,
    );

    if (!storedValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    return Array.isArray(parsedValue)
      ? parsedValue.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function QuickCreateMenu({
  onClose,
  currentWorkspaceType,
}: QuickCreateMenuProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(
    getInitialRecentIds,
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLAnchorElement>(null);

  const availableItems = useMemo(() => {
    return quickCreateItems.filter((item) => {
      if (!item.workspaceTypes || !currentWorkspaceType) {
        return true;
      }

      return item.workspaceTypes.includes(currentWorkspaceType);
    });
  }, [currentWorkspaceType]);

  const filteredItems = useMemo(() => {
    return availableItems.filter((item) =>
      matchesSearch(item, query),
    );
  }, [availableItems, query]);

  const groupedItems = useMemo(() => {
    return groupOrder
      .map((group) => ({
        group,
        items: filteredItems.filter(
          (item) => item.group === group,
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [filteredItems]);

  const recentItems = useMemo(() => {
    const storedRecentItems = recentIds
      .map((id) => availableItems.find((item) => item.id === id))
      .filter(
        (item): item is QuickCreateItem => item !== undefined,
      );

    if (storedRecentItems.length > 0) {
      return storedRecentItems.slice(0, MAX_RECENT_ITEMS);
    }

    return availableItems.slice(0, MAX_RECENT_ITEMS);
  }, [availableItems, recentIds]);

  const displayedItems = useMemo(() => {
    if (query) {
      return filteredItems;
    }

    const recentIdSet = new Set(recentItems.map((item) => item.id));

    return [
      ...recentItems,
      ...groupedItems.flatMap((section) =>
        section.items.filter(
          (item) => !recentIdSet.has(item.id),
        ),
      ),
    ];
  }, [filteredItems, groupedItems, query, recentItems]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex >= displayedItems.length) {
      setActiveIndex(Math.max(displayedItems.length - 1, 0));
    }
  }, [activeIndex, displayedItems.length]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex]);

  function recordRecentAction(itemId: string) {
    const nextRecentIds = [
      itemId,
      ...recentIds.filter((id) => id !== itemId),
    ].slice(0, MAX_RECENT_ITEMS);

    setRecentIds(nextRecentIds);

    window.localStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify(nextRecentIds),
    );
  }

  function selectItem(item: QuickCreateItem) {
    recordRecentAction(item.id);
    onClose();
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      setActiveIndex((current) =>
        displayedItems.length === 0
          ? 0
          : (current + 1) % displayedItems.length,
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      setActiveIndex((current) =>
        displayedItems.length === 0
          ? 0
          : (current - 1 + displayedItems.length) %
            displayedItems.length,
      );
    }

    if (event.key === "Enter") {
      const selectedItem = displayedItems[activeIndex];

      if (!selectedItem) {
        return;
      }

      event.preventDefault();
      recordRecentAction(selectedItem.id);
      window.location.href = selectedItem.href;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  function renderItem(
    item: QuickCreateItem,
    index: number,
    showGroup = false,
  ) {
    const Icon = item.icon;
    const isActive = activeIndex === index;

    return (
      <Link
        key={item.id}
        ref={isActive ? activeItemRef : undefined}
        href={item.href}
        onClick={() => selectItem(item)}
        onMouseEnter={() => setActiveIndex(index)}
        className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-150 ${
          isActive
            ? "border-cyan-300/20 bg-cyan-400/[0.07] shadow-[0_0_25px_rgba(34,211,238,0.05)]"
            : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.035]"
        }`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
            isActive
              ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-300"
              : "border-white/[0.07] bg-white/[0.025] text-slate-500 group-hover:text-cyan-300"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={`truncate text-[11px] font-medium ${
                isActive ? "text-cyan-100" : "text-white"
              }`}
            >
              {item.title}
            </p>

            {showGroup ? (
              <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-0.5 text-[8px] text-slate-500">
                {item.group}
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 truncate text-[9px] text-slate-500">
            {item.description}
          </p>
        </div>

        {item.shortcut ? (
          <span className="rounded-md border border-white/[0.08] bg-white/[0.025] px-1.5 py-1 text-[8px] font-medium text-slate-600">
            {item.shortcut}
          </span>
        ) : null}

        <ArrowRight
          className={`h-3.5 w-3.5 transition ${
            isActive
              ? "translate-x-0 text-cyan-300 opacity-100"
              : "-translate-x-1 text-slate-600 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
          }`}
        />
      </Link>
    );
  }

  let runningIndex = -1;

  return (
    <div
      role="dialog"
      aria-label="Quick Create"
      className="absolute right-0 top-[calc(100%+12px)] z-[90] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#071017]/98 shadow-[0_30px_90px_rgba(0,0,0,0.58),0_0_50px_rgba(34,211,238,0.08)] backdrop-blur-2xl"
    >
      <div className="border-b border-white/[0.06] px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-4 px-1">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />

              <p className="text-sm font-semibold text-white">
                Quick Create
              </p>
            </div>

            <p className="mt-1 text-[9px] text-slate-500">
              Search and launch any Trading Docks action.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.025] px-1.5 py-1 text-[8px] text-slate-600">
            <Command className="h-2.5 w-2.5" />
            Shift P
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />

          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search actions, imports, listings..."
            aria-label="Search Quick Create actions"
            className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-9 pr-3 text-[11px] text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/25 focus:bg-cyan-400/[0.025] focus:shadow-[0_0_24px_rgba(34,211,238,0.05)]"
          />
        </div>
      </div>

      <div className="quick-create-scrollbar max-h-[460px] overflow-y-auto p-2">
        {displayedItems.length > 0 ? (
          <>
            {!query && recentItems.length > 0 ? (
              <section className="mb-3">
                <div className="mb-1.5 flex items-center gap-2 px-2">
                  <Clock3 className="h-3 w-3 text-cyan-300" />

                  <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    Recently used
                  </p>
                </div>

                <div className="space-y-1">
                  {recentItems.map((item) => {
                    runningIndex += 1;

                    return renderItem(item, runningIndex, true);
                  })}
                </div>
              </section>
            ) : null}

            {query ? (
              <section>
                <p className="px-2 pb-1.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {filteredItems.length}{" "}
                  {filteredItems.length === 1 ? "result" : "results"}
                </p>

                <div className="space-y-1">
                  {filteredItems.map((item, index) =>
                    renderItem(item, index, true),
                  )}
                </div>
              </section>
            ) : (
              groupedItems.map((section) => {
                const recentIdSet = new Set(
                  recentItems.map((item) => item.id),
                );

                const sectionItems = section.items.filter(
                  (item) => !recentIdSet.has(item.id),
                );

                if (sectionItems.length === 0) {
                  return null;
                }

                return (
                  <section
                    key={section.group}
                    className="mb-3 last:mb-0"
                  >
                    <p className="px-2 pb-1.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      {section.group}
                    </p>

                    <div className="space-y-1">
                      {sectionItems.map((item) => {
                        runningIndex += 1;

                        return renderItem(item, runningIndex);
                      })}
                    </div>
                  </section>
                );
              })
            )}
          </>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center px-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025] text-slate-600">
              <Search className="h-4 w-4" />
            </div>

            <p className="mt-3 text-[11px] font-medium text-slate-300">
              No matching actions
            </p>

            <p className="mt-1 max-w-[280px] text-[9px] leading-4 text-slate-600">
              Try searching for a card, binder, import,
              marketplace listing, sale, or automation.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06] bg-white/[0.015] px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <Bot className="h-3.5 w-3.5 shrink-0 text-cyan-300" />

            <p className="truncate text-[8px] text-slate-500">
              AI Create will support natural-language actions here.
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-2 text-[8px] text-slate-600 sm:flex">
            <span>
              <kbd className="rounded border border-white/[0.08] bg-white/[0.025] px-1 py-0.5">
                ↑↓
              </kbd>{" "}
              Navigate
            </span>

            <span>
              <kbd className="rounded border border-white/[0.08] bg-white/[0.025] px-1 py-0.5">
                Enter
              </kbd>{" "}
              Open
            </span>

            <span>
              <kbd className="rounded border border-white/[0.08] bg-white/[0.025] px-1 py-0.5">
                Esc
              </kbd>{" "}
              Close
            </span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .quick-create-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.14)
            transparent;
        }

        .quick-create-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .quick-create-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .quick-create-scrollbar::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.12);
        }

        .quick-create-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.2);
        }
      `}</style>
    </div>
  );
}