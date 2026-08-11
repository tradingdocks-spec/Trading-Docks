"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  ChevronDown,
  FolderPlus,
  Import,
  LibraryBig,
  MoreHorizontal,
  Save,
  Search,
  X,
} from "lucide-react";

import { ManaPips } from "./ManaPips";
import type { DeckRecord } from "@/lib/deck-vault/types";
import { loadDeckVault, saveDeckRecord } from "@/lib/deck-vault/persistence";

const FORMATS = [
  "All Formats",
  "EDH",
  "Pauper EDH",
  "Standard",
  "Modern",
  "Pioneer",
  "Legacy",
  "Vintage",
  "Alchemy",
  "Premodern",
  "Pauper",
];

const SORT_OPTIONS = [
  "Recently opened",
  "Name",
  "Value",
  "Power",
  "Coverage",
] as const;

type SortOption = (typeof SORT_OPTIONS)[number];

export function DeckVaultHome({
  plan,
  deckLimit,
}: {
  plan: string;
  deckLimit: number | null;
}) {
  const [format, setFormat] = useState("All Formats");
  const [sort, setSort] = useState<SortOption>("Recently opened");
  const [savedDecks, setSavedDecks] = useState<DeckRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [renameDeck, setRenameDeck] = useState<DeckRecord | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setSavedDecks(await loadDeckVault());
        setLoadError("");
      } catch (error) {
        setSavedDecks([]);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Your saved decks could not be loaded.",
        );
      }
    })();
  }, []);

  const visibleDecks = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    const filtered = savedDecks.filter((deck) => {
      const matchesFormat = format === "All Formats" || deck.format === format;
      const matchesSearch =
        !normalized ||
        deck.name.toLowerCase().includes(normalized) ||
        deck.commander?.toLowerCase().includes(normalized) ||
        deck.theme.toLowerCase().includes(normalized);

      return matchesFormat && matchesSearch;
    });

    return [...filtered].sort((left, right) => {
      if (sort === "Name") return left.name.localeCompare(right.name);
      if (sort === "Value") return right.marketValue - left.marketValue;
      if (sort === "Power") return right.power - left.power;
      if (sort === "Coverage") return right.ownedCount - left.ownedCount;
      return savedDecks.indexOf(left) - savedDecks.indexOf(right);
    });
  }, [format, savedDecks, searchQuery, sort]);

  const summary = useMemo(() => summarizeDecks(savedDecks, deckLimit), [deckLimit, savedDecks]);
  const limitReached = deckLimit !== null && savedDecks.length >= deckLimit;
  const hasDecks = savedDecks.length > 0;

  async function saveDeckName() {
    if (!renameDeck) return;
    const name = renameValue.trim();
    if (!name) return;
    const updated = { ...renameDeck, name, updatedAt: "Just now" };
    await saveDeckRecord(updated);
    setSavedDecks((current) =>
      current.map((deck) => (deck.id === updated.id ? updated : deck)),
    );
    setRenameDeck(null);
  }

  return (
    <main className="min-h-screen bg-[#020912] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px]">
        {loadError ? (
          <div className="mb-5 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
            {loadError}
          </div>
        ) : null}

        <header className="relative overflow-hidden rounded-[28px] border border-sky-300/[0.10] bg-[#06131f] px-5 py-5 shadow-[0_24px_90px_rgba(0,0,0,0.22)] sm:px-7 sm:py-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/30 to-transparent" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-300/[0.14] bg-sky-400/[0.055] text-sky-300">
                  <LibraryBig className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
                    Deck Vault
                  </p>
                  <div className="mt-1">
                    <ManaPips colors={["W", "U", "B", "R", "G"]} size="sm" />
                  </div>
                </div>
              </div>

              <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                Build deeper. Analyze smarter. Know every deck.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Import Moxfield, ManaBox, MTGGoldfish, Archidekt, Deckstats,
                Arena, CSV, or plain text lists and connect them to deck value,
                owned coverage, and upgrade intelligence.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Link
                href={limitReached ? "/dashboard/plans" : "/dashboard/deck-vault/import"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-300 px-4 text-[12px] font-bold text-[#00121c] shadow-[0_16px_36px_rgba(125,211,252,.16)] transition hover:bg-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <Import className="h-4 w-4" />
                {limitReached ? "Upgrade to add decks" : "Import deck"}
              </Link>
              <Link
                href={limitReached ? "/dashboard/plans" : "/dashboard/deck-vault/new"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-[12px] font-semibold text-slate-300 transition hover:border-sky-300/20 hover:bg-sky-400/[0.04] hover:text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-300/40"
              >
                <FolderPlus className="h-4 w-4" />
                {limitReached ? "Deck limit reached" : "Create new deck"}
              </Link>
              <Link
                href={limitReached ? "/dashboard/plans" : "/dashboard/deck-vault/import?mode=paste"}
                className="inline-flex h-11 items-center justify-center rounded-xl px-3 text-[12px] font-semibold text-slate-500 transition hover:bg-white/[0.025] hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300/30"
              >
                Paste decklist
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-[26px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.20)]">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_1.7fr] lg:items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Vault summary
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-4xl font-semibold tracking-[-0.055em] text-white">
                  {summary.deckCountLabel}
                </span>
                <span className="pb-1 text-sm text-slate-500">
                  {summary.limitLabel}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {summary.actionableLine}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryStat label="Total value" value={formatCurrency(summary.combinedValue)} detail="Across saved decks" />
              <SummaryStat label="Avg. owned" value={`${summary.averageCoverage}%`} detail="Collection coverage" />
              <SummaryStat label="AI reviews" value="0" detail="No saved reviews yet" />
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.65fr)]">
          <div className="rounded-[28px] bg-[#06131f] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_22px_80px_rgba(0,0,0,.22)] sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sky-300">
                  My Decks
                </p>
                <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.035em]">
                  Deck library
                </h2>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(150px,0.7fr)_minmax(150px,0.7fr)_minmax(220px,1fr)] xl:min-w-[640px]">
                <ControlSelect label="Sort" value={sort} onChange={(value) => setSort(value as SortOption)}>
                  {SORT_OPTIONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </ControlSelect>
                <ControlSelect label="Format" value={format} onChange={setFormat}>
                  {FORMATS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </ControlSelect>
                <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl bg-black/[0.16] px-3 ring-1 ring-white/[0.07] transition focus-within:ring-sky-300/35">
                  <Search className="h-4 w-4 shrink-0 text-slate-600" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search decks"
                    className="min-w-0 flex-1 bg-transparent text-[12px] text-slate-300 outline-none placeholder:text-slate-700"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {visibleDecks.length === 0 ? (
                <EmptyPanel
                  title={hasDecks ? "No decks match this view" : "Import or create your first deck"}
                  body={
                    hasDecks
                      ? "Try a different format, sort, or search term."
                      : "Import or create your first deck to begin tracking value, coverage, and deck intelligence."
                  }
                  actionHref={limitReached ? "/dashboard/plans" : "/dashboard/deck-vault/import"}
                  actionLabel={limitReached ? "View plan limits" : "Import deck"}
                />
              ) : null}

              {visibleDecks.map((deck) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  onRename={() => {
                    setRenameDeck(deck);
                    setRenameValue(deck.name);
                  }}
                />
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <AiDeckReviewPanel hasDecks={hasDecks} firstDeck={savedDecks[0]} />
            <CollectionConnectionPanel summary={summary} hasDecks={hasDecks} />
            {!hasDecks ? <CollectorLoopPanel /> : null}
          </aside>
        </section>
      </div>

      {renameDeck ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#01070c]/85 p-4 backdrop-blur-lg" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setRenameDeck(null);
        }}>
          <section className="w-full max-w-md rounded-[26px] border border-sky-300/[0.16] bg-[#07141e] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.65)]" role="dialog" aria-modal="true" aria-labelledby="rename-deck-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300">Deck Vault</p>
                <h2 id="rename-deck-title" className="mt-2 text-2xl font-semibold">Rename deck</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Choose the name you want shown in Deck Vault and global search.</p>
              </div>
              <button type="button" onClick={() => setRenameDeck(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-slate-400 hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-6 block">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Deck name</span>
              <input autoFocus value={renameValue} maxLength={80} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter") void saveDeckName();
                if (event.key === "Escape") setRenameDeck(null);
              }} className="mt-2 h-12 w-full rounded-xl border border-white/[0.1] bg-black/20 px-4 text-sm font-semibold text-white outline-none focus:border-sky-300/40" />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setRenameDeck(null)} className="h-11 rounded-xl border border-white/[0.08] px-4 text-sm font-semibold text-slate-300">Cancel</button>
              <button type="button" disabled={!renameValue.trim()} onClick={() => void saveDeckName()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-sky-300 px-5 text-sm font-semibold text-[#00121c] disabled:cursor-not-allowed disabled:opacity-40">
                <Save className="h-4 w-4" /> Save name
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function summarizeDecks(decks: DeckRecord[], deckLimit: number | null) {
  const combinedValue = decks.reduce(
    (total, deck) => total + (Number.isFinite(deck.marketValue) ? deck.marketValue : 0),
    0,
  );
  const averageCoverage = decks.length
    ? Math.round(decks.reduce((total, deck) => total + deck.ownedCount, 0) / decks.length)
    : 0;
  const missingCards = decks.reduce(
    (total, deck) => total + Math.max(deck.cardCount - Math.round((deck.cardCount * deck.ownedCount) / 100), 0),
    0,
  );

  return {
    combinedValue,
    averageCoverage,
    missingCards,
    deckCountLabel: `${decks.length} ${decks.length === 1 ? "deck" : "decks"}`,
    limitLabel: deckLimit === null ? "Unlimited vault" : `${deckLimit - decks.length} slots available`,
    actionableLine: decks.length
      ? `${missingCards} cards are still missing across the visible collection coverage data.`
      : "Start with one imported list, then compare it against Collection and generate deck intelligence.",
  };
}

function DeckCard({ deck, onRename }: { deck: DeckRecord; onRename: () => void }) {
  const colors = displayDeckColors(deck.colors);
  const commanderCard = deck.cards.find((card) => card.board === "commander" || card.name === deck.commander);
  const image = commanderCard?.artCrop ?? commanderCard?.image;
  const missingCount = Math.max(deck.cardCount - Math.round((deck.cardCount * deck.ownedCount) / 100), 0);

  return (
    <article className="group relative overflow-hidden rounded-[24px] bg-[#081721] shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_18px_52px_rgba(0,0,0,.24)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#091b27]">
      <div className="relative h-32 overflow-hidden bg-[#030b12]">
        {image ? (
          <Image src={image} alt="" fill sizes="(min-width: 1280px) 28vw, (min-width: 768px) 42vw, 100vw" className="object-cover opacity-72 transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,rgba(56,189,248,.12),rgba(15,23,42,.18))]">
            <ManaPips colors={colors} size="lg" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#081721] via-[#081721]/35 to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <ManaPips colors={colors} />
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-200 backdrop-blur">
            {deck.format}
          </span>
        </div>
        <button
          type="button"
          onClick={onRename}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-black/45 text-slate-300 backdrop-blur transition hover:bg-sky-300/15 hover:text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-300/50"
          aria-label={`Rename ${deck.name}`}
          title="Rename deck"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="min-h-[82px]">
          <h3 className="line-clamp-2 text-[19px] font-semibold leading-6 tracking-[-0.035em] text-white">
            {deck.name}
          </h3>
          <p className="mt-1 line-clamp-1 text-[13px] font-medium text-slate-300">
            {deck.commander || "No commander selected"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {deck.format} - {deck.cardCount} cards - {formatCurrency(deck.marketValue)}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric label="Power" value={deck.power ? `${deck.power.toFixed(1)}` : "Unrated"} />
          <Metric label="Owned" value={`${deck.ownedCount}%`} />
          <Metric label="Missing" value={`${missingCount}`} />
          <Metric label="Status" value={deck.status} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/deck-vault/decks/${deck.id}`}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-300 px-3 text-[12px] font-bold text-[#00121c] transition hover:bg-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-100"
          >
            Open deck
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/dashboard/deck-vault/decks/${deck.id}?panel=review`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-3 text-[12px] font-semibold text-slate-300 transition hover:border-violet-300/25 hover:bg-violet-300/[0.045] hover:text-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-300/40"
          >
            Analyze
          </Link>
        </div>
      </div>
    </article>
  );
}

function AiDeckReviewPanel({ hasDecks, firstDeck }: { hasDecks: boolean; firstDeck?: DeckRecord }) {
  return (
    <section className="rounded-[26px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.20)]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-300/[0.08] text-violet-200">
          <BrainCircuit className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[18px] font-semibold">AI Deck Review</p>
          <p className="mt-1 text-[12px] leading-5 text-slate-500">
            Analyze mana curve, interaction, removal, win conditions, weaknesses,
            upgrade opportunities, and collection coverage.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-black/[0.13] p-4">
        <p className="text-sm font-semibold text-slate-200">
          {hasDecks ? "No saved reviews yet" : "No deck selected"}
        </p>
        <p className="mt-2 text-[12px] leading-5 text-slate-500">
          {hasDecks
            ? "Analyze a deck to surface weaknesses, upgrades, and collection gaps."
            : "Import or create a deck first, then run analysis from the deck workspace."}
        </p>
        <Link
          href={firstDeck ? `/dashboard/deck-vault/decks/${firstDeck.id}?panel=review` : "/dashboard/deck-vault/import"}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-200 px-3.5 text-[12px] font-bold text-[#160d25] transition hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-100"
        >
          {hasDecks ? "Analyze a deck" : "Import deck"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

function CollectionConnectionPanel({
  summary,
  hasDecks,
}: {
  summary: ReturnType<typeof summarizeDecks>;
  hasDecks: boolean;
}) {
  return (
    <section className="rounded-[26px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.20)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-300/80">
            Collection connection
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-white">
            {hasDecks ? `${summary.averageCoverage}% average coverage` : "Coverage starts in Collection"}
          </h2>
        </div>
        <BarChart3 className="h-5 w-5 text-emerald-300" />
      </div>
      <p className="mt-3 text-[12px] leading-5 text-slate-500">
        {hasDecks
          ? `${summary.missingCards} missing cards are visible from existing deck coverage fields. Add inventory matches to improve accuracy.`
          : "Add cards to Collection to see how much of each deck you already own."}
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-emerald-300"
          style={{ width: `${Math.min(summary.averageCoverage, 100)}%` }}
        />
      </div>
    </section>
  );
}

function CollectorLoopPanel() {
  return (
    <section className="rounded-[26px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.20)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-sky-300">First deck workflow</p>
      <div className="mt-4 grid gap-2">
        {["Import deck", "Compare to collection", "Analyze", "Upgrade"].map((item, index) => (
          <div key={item} className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-3 py-2.5 text-[12px] text-slate-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-300/[0.08] text-[10px] font-bold text-sky-200">
              {index + 1}
            </span>
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function ControlSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative flex h-11 min-w-0 items-center rounded-xl bg-black/[0.16] px-3 ring-1 ring-white/[0.07] transition focus-within:ring-sky-300/35">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none bg-transparent pr-7 text-[12px] font-semibold text-slate-300 outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-600" />
    </label>
  );
}

function EmptyPanel({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="col-span-full flex min-h-[310px] flex-col items-center justify-center rounded-[24px] bg-black/[0.12] px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300/[0.08] text-sky-200">
        <LibraryBig className="h-5 w-5" />
      </span>
      <p className="mt-4 text-base font-semibold text-slate-200">{title}</p>
      <p className="mt-2 max-w-md text-[12px] leading-5 text-slate-500">{body}</p>
      <Link href={actionHref} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-sky-300 px-4 text-[12px] font-bold text-[#00121c]">
        {actionLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function SummaryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.028] p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-600">{detail}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.025] p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-slate-600">{label}</p>
      <p className="mt-1 truncate text-[12px] font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function displayDeckColors(colors: DeckRecord["colors"]) {
  const unique = Array.from(new Set(colors));
  const colored = unique.filter((color) => color !== "C");

  return colored.length ? colored : unique;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}
