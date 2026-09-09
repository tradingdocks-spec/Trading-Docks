"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Loader2, Search, SlidersHorizontal, X } from "lucide-react";

export type InventoryFinish = "Nonfoil" | "Foil" | "Etched";

export type SelectedPrinting = {
  scryfallId: string;
  name: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  rarity: string;
  releasedAt?: string;
  imageUrl?: string;
  finishes: InventoryFinish[];
  finish: InventoryFinish;
  treatment: string;
  treatments: string[];
  marketPrice: number;
};

type ScryfallCard = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  released_at?: string;
  finishes?: string[];
  frame_effects?: string[];
  promo_types?: string[];
  foil?: boolean;
  nonfoil?: boolean;
  etched?: boolean;
  image_uris?: { small?: string; normal?: string };
  card_faces?: Array<{ image_uris?: { small?: string; normal?: string } }>;
  prices: { usd: string | null; usd_foil: string | null; usd_etched: string | null };
};

const SPECIAL_TREATMENTS: Array<[string, string[]]> = [
  ["Textured Foil", ["textured", "texturedfoil"]],
  ["Fracture Foil", ["fracture", "fracturefoil"]],
  ["Double Rainbow Foil", ["doublerainbow", "double rainbow"]],
  ["Confetti Foil", ["confetti", "confettifoil"]],
  ["Galaxy Foil", ["galaxy", "galaxyfoil"]],
  ["Gilded Foil", ["gilded", "gildedfoil"]],
  ["Halo Foil", ["halo", "halofoil"]],
  ["Invisible Ink Foil", ["invisibleink", "invisible ink"]],
  ["Neon Ink Foil", ["neonink", "neon ink"]],
  ["Oil Slick Raised Foil", ["oilslick", "oil slick"]],
  ["Silverscreen Foil", ["silverscreen", "silver screen"]],
  ["Step-and-Compleat Foil", ["stepandcompleat", "step-and-compleat"]],
  ["Surge Foil", ["surge", "surgefoil"]],
  ["Serialized", ["serialized"]],
  ["Showcase", ["showcase"]],
  ["Extended Art", ["extendedart", "extended art"]],
  ["Borderless", ["borderless"]],
  ["Retro Frame", ["retro", "retroframe"]],
];

export function PrintingSelector({
  value,
  onValueChange,
  onSelect,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (printing: SelectedPrinting) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);
  const [loadingPrintings, setLoadingPrintings] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [error, setError] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const sequence = useRef(0);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setLoadingNames(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const request = ++sequence.current;
      setLoadingNames(true);
      setError("");
      try {
        const response = await fetch(
          `/api/inventory/card-search?q=${encodeURIComponent(query)}&mode=names`,
          { signal: controller.signal },
        );
        const payload: { data?: string[]; details?: string } = await response.json();
        if (!response.ok) throw new Error(payload.details ?? "Card search failed.");
        if (request === sequence.current) setSuggestions((payload.data ?? []).slice(0, 12));
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (request === sequence.current) {
          setError(caught instanceof Error ? caught.message : "Card search failed.");
        }
      } finally {
        if (request === sequence.current) setLoadingNames(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [value]);

  async function chooseCard(cardName: string) {
    onValueChange(cardName);
    setSuggestions([]);
    setPrintings([]);
    setSetFilter("");
    setError("");
    setBrowserOpen(true);
    setLoadingPrintings(true);
    try {
      const response = await fetch(
        `/api/inventory/card-search?name=${encodeURIComponent(cardName)}&mode=printings`,
      );
      const payload: { data?: ScryfallCard[]; details?: string } = await response.json();
      if (!response.ok) throw new Error(payload.details ?? "Printing search failed.");
      setPrintings(payload.data ?? []);
      if (!(payload.data ?? []).length) setError("No printings were found for that card.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Printing search failed.");
    } finally {
      setLoadingPrintings(false);
    }
  }

  const visiblePrintings = useMemo(() => {
    const needle = setFilter.trim().toLowerCase();
    if (!needle) return printings;
    return printings.filter((card) =>
      `${card.set_name} ${card.set} ${card.collector_number} ${card.released_at ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [printings, setFilter]);

  function selectPrinting(card: ScryfallCard, finish: InventoryFinish) {
    const treatments = cardTreatments(card);
    onSelect({
      scryfallId: card.id,
      name: card.name,
      setName: card.set_name,
      setCode: card.set.toUpperCase(),
      collectorNumber: card.collector_number,
      rarity: card.rarity,
      releasedAt: card.released_at,
      imageUrl: cardImage(card),
      finishes: cardFinishes(card),
      finish,
      treatment: treatments[0] ?? "Traditional",
      treatments,
      marketPrice: priceFor(card, finish),
    });
    setBrowserOpen(false);
  }

  return (
    <div className="sm:col-span-2 rounded-[20px] border border-td-accent/20 bg-gradient-to-b from-td-accent/[0.055] to-td-accent/[0.025] p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-td-accent/20 bg-td-accent/10 text-td-accent-text">
          <Search className="h-3.5 w-3.5" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-td-accent-text">
        1. Search Magic cards
        </p>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-td-muted">
        Type at least two letters, choose the card name, then select its exact printing and finish.
      </p>
      <div className="relative mt-3">
        <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-11 items-center justify-center border-r border-td-accent/10">
          <Search className="h-4 w-4 text-td-accent-text" />
        </span>
        <input
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setSuggestions([]);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && suggestions[0]) {
              event.preventDefault();
              void chooseCard(suggestions[0]);
            }
          }}
          placeholder="Try: Cyclonic Rift"
          autoComplete="off"
          className="inventory-input !h-12 !pl-14 !pr-11 !text-[12px] !border-td-accent/25 !bg-td-surface"
          autoFocus
        />
        {loadingNames && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-td-accent-text" />
        )}
        {suggestions.length > 0 && (
          <div className="absolute z-[160] mt-1 w-full overflow-hidden rounded-xl border border-td-accent/25 bg-td-surface shadow-2xl">
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => void chooseCard(name)}
                className="flex w-full items-center justify-between border-b border-td-ink/[0.05] px-3.5 py-3 text-left text-[11px] text-td-primary last:border-0 hover:bg-td-accent/10"
              >
                <span>{name}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-td-accent-text">
                  View all printings
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && !browserOpen && <p className="mt-2 text-[11px] text-td-danger">{error}</p>}

      {browserOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setBrowserOpen(false)}
            aria-label="Close printing browser"
          />
          <div className="relative z-10 flex max-h-[94vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-[24px] border border-td-accent/25 bg-td-surface shadow-[0_40px_140px_rgb(var(--td-shadow-rgb)/calc(.75*var(--td-shadow-strength)))]">
            <div className="flex items-start justify-between border-b border-td-ink/[0.07] px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-td-accent-text">
                  2. Choose exact printing
                </p>
                <h3 className="mt-1 text-xl font-semibold text-td-primary">{value}</h3>
                <p className="mt-1 text-[11px] text-td-muted">
                  Each version below has its own set, artwork, collector number, price, and finishes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBrowserOpen(false)}
                className="rounded-xl border border-td-ink/[0.08] p-2 text-td-secondary hover:text-td-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-td-ink/[0.07] px-5 py-3">
              <div className="relative">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-td-muted" />
                <input
                  value={setFilter}
                  onChange={(event) => setSetFilter(event.target.value)}
                  placeholder="Filter by set, code, year, or collector number"
                  className="inventory-input pl-9"
                />
              </div>
              {!loadingPrintings && (
                <p className="mt-2 text-[11px] text-td-muted">
                  Showing {visiblePrintings.length} of {printings.length} printings
                </p>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {loadingPrintings && (
                <div className="flex min-h-72 items-center justify-center gap-2 text-[11px] text-td-secondary">
                  <Loader2 className="h-5 w-5 animate-spin text-td-accent-text" />
                  Loading every printing…
                </div>
              )}
              {error && !loadingPrintings && (
                <div className="rounded-xl border border-td-danger/20 bg-td-danger/[0.05] p-4 text-[11px] text-td-danger">
                  {error}
                </div>
              )}
              {!loadingPrintings && !error && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visiblePrintings.map((card) => {
                    const treatments = cardTreatments(card);
                    const image = cardImage(card);
                    return (
                      <article
                        key={card.id}
                        className="overflow-hidden rounded-2xl border border-td-ink/[0.08] bg-td-ink/[0.025]"
                      >
                        <div className="bg-black/25 p-3">
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={image}
                              alt={`${card.name} — ${card.set_name}`}
                              className="mx-auto aspect-[488/680] w-full max-w-56 rounded-xl object-cover shadow-xl"
                            />
                          ) : (
                            <div className="mx-auto flex aspect-[488/680] w-full max-w-56 items-center justify-center rounded-xl bg-td-canvas">
                              <ImageIcon className="h-8 w-8 text-td-muted" />
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h4 className="text-sm font-semibold text-td-primary">{card.set_name}</h4>
                          <p className="mt-1 text-[11px] text-td-muted">
                            {card.set.toUpperCase()} #{card.collector_number} ·{" "}
                            {card.released_at?.slice(0, 4) ?? "—"} · {titleCase(card.rarity)}
                          </p>
                          {treatments[0] !== "Traditional" && (
                            <p className="mt-2 text-[11px] font-medium text-fuchsia-300">
                              {treatments.join(" · ")}
                            </p>
                          )}
                          <div className="mt-4 grid gap-2">
                            {cardFinishes(card).map((entry) => (
                              <button
                                key={entry}
                                type="button"
                                onClick={() => selectPrinting(card, entry)}
                                className="rounded-lg bg-gradient-to-b from-td-violet to-td-violet px-3 py-2.5 text-[11px] font-semibold text-td-primary shadow hover:brightness-110"
                              >
                                Select {entry}
                                <span className="ml-1.5 text-td-violet">
                                  ${priceFor(card, entry).toFixed(2)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {visiblePrintings.length === 0 && (
                    <p className="col-span-full py-16 text-center text-[11px] text-td-muted">
                      No printings match that filter.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cardFinishes(card: ScryfallCard): InventoryFinish[] {
  const raw = new Set(card.finishes ?? []);
  if (card.nonfoil) raw.add("nonfoil");
  if (card.foil) raw.add("foil");
  if (card.etched) raw.add("etched");
  const values: InventoryFinish[] = [];
  if (raw.has("nonfoil")) values.push("Nonfoil");
  if (raw.has("foil")) values.push("Foil");
  if (raw.has("etched")) values.push("Etched");
  return values.length ? values : ["Nonfoil"];
}

function cardTreatments(card: ScryfallCard) {
  const haystack = [
    ...(card.frame_effects ?? []),
    ...(card.promo_types ?? []),
    card.name,
    card.set_name,
  ]
    .join(" ")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ");
  const compact = haystack.replaceAll(" ", "");
  const found = SPECIAL_TREATMENTS.filter(([, aliases]) =>
    aliases.some(
      (alias) =>
        haystack.includes(alias) ||
        compact.includes(alias.replaceAll(/[ -]/g, "")),
    ),
  ).map(([label]) => label);
  return found.length ? found : ["Traditional"];
}

function priceFor(card: ScryfallCard, finish: InventoryFinish) {
  const raw =
    finish === "Foil"
      ? card.prices.usd_foil
      : finish === "Etched"
        ? card.prices.usd_etched
        : card.prices.usd;
  return raw && Number.isFinite(Number(raw)) ? Number(raw) : 0;
}

function cardImage(card: ScryfallCard) {
  return (
    card.image_uris?.normal ??
    card.image_uris?.small ??
    card.card_faces?.[0]?.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.small
  );
}

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : "Unknown";
}
