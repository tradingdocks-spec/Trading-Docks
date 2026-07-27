"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  FolderPlus,
  Import,
  LibraryBig,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { ManaPips } from "./ManaPips";
import { decks as sampleDecks } from "@/lib/deck-vault/sample-data";
import type { DeckRecord } from "@/lib/deck-vault/types";

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

export function DeckVaultHome() {
  const [format, setFormat] = useState("All Formats");
  const [savedDecks, setSavedDecks] =
    useState<DeckRecord[]>(sampleDecks);
  const [searchQuery, setSearchQuery] =
    useState("");

  useEffect(() => {
    try {
      const importedIds = JSON.parse(
        localStorage.getItem(
          "trading-docks-imported-decks",
        ) ?? "[]",
      ) as string[];

      const importedDecks = importedIds
        .map((id) => {
          const raw = localStorage.getItem(
            `trading-docks-deck:${id}`,
          );
          return raw
            ? (JSON.parse(raw) as DeckRecord)
            : null;
        })
        .filter(
          (deck): deck is DeckRecord =>
            Boolean(deck),
        );

      const byId = new Map<string, DeckRecord>();

      [...sampleDecks, ...importedDecks].forEach(
        (deck) => byId.set(deck.id, deck),
      );

      setSavedDecks(Array.from(byId.values()));
    } catch {
      setSavedDecks(sampleDecks);
    }
  }, []);

  const visibleDecks = useMemo(() => {
    const normalized =
      searchQuery.trim().toLowerCase();

    return savedDecks.filter((deck) => {
      const matchesFormat =
        format === "All Formats" ||
        deck.format === format;
      const matchesSearch =
        !normalized ||
        deck.name
          .toLowerCase()
          .includes(normalized) ||
        deck.commander
          ?.toLowerCase()
          .includes(normalized) ||
        deck.theme
          .toLowerCase()
          .includes(normalized);

      return matchesFormat && matchesSearch;
    });
  }, [format, savedDecks, searchQuery]);

  function deleteDeck(
    deckId: string,
    deckName: string,
  ) {
    const confirmed = window.confirm(
      `Delete "${deckName}" from Deck Vault?`,
    );

    if (!confirmed) return;

    localStorage.removeItem(
      `trading-docks-deck:${deckId}`,
    );
    localStorage.removeItem(
      `trading-docks-unresolved:${deckId}`,
    );

    const importedIds = JSON.parse(
      localStorage.getItem(
        "trading-docks-imported-decks",
      ) ?? "[]",
    ) as string[];

    localStorage.setItem(
      "trading-docks-imported-decks",
      JSON.stringify(
        importedIds.filter(
          (id) => id !== deckId,
        ),
      ),
    );

    setSavedDecks((current) =>
      current.filter(
        (deck) => deck.id !== deckId,
      ),
    );
  }

  return (
    <main className="min-h-screen bg-[#020912] px-5 py-7 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="relative overflow-hidden rounded-[30px] border border-sky-300/[0.12] bg-[#06131f] p-6 sm:p-8">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-sky-400/[0.08] blur-3xl" />
          <div className="absolute bottom-[-90px] left-[35%] h-56 w-56 rounded-full bg-violet-500/[0.08] blur-3xl" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/[0.14] bg-sky-400/[0.05] text-sky-300">
                  <LibraryBig className="h-5 w-5" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-300">
                  Deck Vault
                </p>
              </div>

              <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
                Build deeper. Analyze smarter. Know every deck.
              </h1>
              <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-400">
                Import decks from Moxfield, ManaBox, MTGGoldfish, Archidekt,
                Deckstats, Arena, CSV, or plain text and turn them into a
                living analytics workspace connected to your collection.
              </p>

              <div className="mt-5">
                <ManaPips colors={["W", "U", "B", "R", "G"]} size="lg" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/dashboard/deck-vault/import"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-300 px-5 text-[13px] font-semibold text-[#00121c]"
              >
                <Import className="h-4 w-4" />
                Import a deck
              </Link>
              <Link
                href="/dashboard/deck-vault/new"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 text-[13px] font-semibold text-slate-300"
              >
                <FolderPlus className="h-4 w-4" />
                Create new deck
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Decks" value="12" detail="8 Commander · 4 Standard" icon={LibraryBig} />
          <Kpi label="Combined Value" value="$6,842.73" detail="+4.8% over 30 days" icon={TrendingUp} />
          <Kpi label="Collection Coverage" value="91%" detail="48 cards missing" icon={Sparkles} />
          <Kpi label="AI Reviews" value="7" detail="3 recommendations ready" icon={BrainCircuit} />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.7fr]">
          <div className="rounded-[26px] border border-white/[0.07] bg-[#06131f] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-sky-300">
                  My Decks
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Recently opened</h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={format}
                  onChange={(event) =>
                    setFormat(event.target.value)
                  }
                  className="h-10 rounded-xl border border-white/[0.07] bg-[#07141e] px-3 text-[12px] text-slate-400 outline-none"
                >
                  {FORMATS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>

                <label className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-black/[0.1] px-3">
                  <Search className="h-4 w-4 text-slate-700" />
                  <input
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(
                        event.target.value,
                      )
                    }
                    placeholder="Search decks..."
                    className="bg-transparent text-[12px] text-slate-300 outline-none placeholder:text-slate-700"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {visibleDecks.map((deck) => (
                <article
                  key={deck.id}
                  className="group relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-black/[0.12] transition duration-300 hover:-translate-y-1 hover:border-sky-300/[0.18]"
                >
                  <Link
                    href={`/dashboard/deck-vault/decks/${deck.id}`}
                    className="block p-4"
                  >
                    <div className="absolute right-[-30px] top-[-30px] h-28 w-28 rounded-full bg-sky-400/[0.05] blur-2xl" />
                    <div className="relative">
                      <ManaPips colors={displayDeckColors(deck.colors)} />
                      <h3 className="mt-4 text-[18px] font-semibold">{deck.name}</h3>
                      <p className="mt-1 text-[13px] text-slate-400">{deck.commander || "No commander selected"}</p>
                      <p className="mt-1 text-[12px] text-slate-500">{deck.theme}</p>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <Metric label="Value" value={`$${deck.marketValue.toFixed(2)}`} />
                        <Metric label="Power" value={`${deck.power.toFixed(1)} / 10`} />
                        <Metric label="Owned" value={`${deck.ownedCount}%`} />
                        <Metric label="Format" value={deck.format} />
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3">
                        <span className="text-[12px] text-slate-500">{deck.updatedAt}</span>
                        <ArrowRight className="h-4 w-4 text-slate-700 transition group-hover:translate-x-1 group-hover:text-sky-300" />
                      </div>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      deleteDeck(
                        deck.id,
                        deck.name,
                      )
                    }
                    className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-rose-300/[0.13] bg-[#07141e]/92 text-rose-300 opacity-0 shadow-lg backdrop-blur transition hover:bg-rose-400/[0.08] group-hover:opacity-100"
                    aria-label={`Delete ${deck.name}`}
                    title="Delete deck"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-[26px] border border-violet-300/[0.11] bg-[#06131f] p-5">
              <div className="flex items-center gap-3">
                <BrainCircuit className="h-5 w-5 text-violet-300" />
                <div>
                  <p className="text-[18px] font-semibold">AI Deck Review</p>
                  <p className="mt-1 text-[12px] text-slate-500">3 new insights</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <Insight title="Atraxa Superfriends" text="Blue source count is low relative to demand." tone="sky" />
                <Insight title="Krenko Mob Boss" text="Add 2–3 more card-draw effects." tone="rose" />
                <Insight title="The Ur-Dragon" text="Strong win-condition density and ramp balance." tone="emerald" />
              </div>
            </section>

            <section className="rounded-[26px] border border-white/[0.07] bg-[#06131f] p-5">
              <p className="text-[18px] font-semibold">Collector loop</p>
              <div className="mt-4 space-y-2 text-[12px] text-slate-500">
                {[
                  "Import a deck",
                  "Compare against inventory",
                  "Identify missing cards",
                  "Create a want list",
                  "Track deck value",
                ].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-400/[0.07] text-[11px] font-semibold text-sky-300">
                      {index + 1}
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function displayDeckColors(
  colors: DeckRecord["colors"],
) {
  const unique = Array.from(
    new Set(colors),
  );
  const colored = unique.filter(
    (color) => color !== "C",
  );

  return colored.length
    ? colored
    : unique;
}

function Kpi({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-[#06131f] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-4 w-4 text-sky-300" />
      </div>
      <p className="mt-3 text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.09em] text-slate-600">{label}</p>
      <p className="mt-1 text-[12px] font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function Insight({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: "sky" | "rose" | "emerald";
}) {
  const toneClass = {
    sky: "border-sky-300/[0.1] bg-sky-400/[0.025]",
    rose: "border-rose-300/[0.1] bg-rose-400/[0.025]",
    emerald: "border-emerald-300/[0.1] bg-emerald-400/[0.025]",
  }[tone];

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[12px] font-semibold text-slate-200">{title}</p>
      <p className="mt-1 text-[12px] leading-5 text-slate-500">{text}</p>
    </div>
  );
}
