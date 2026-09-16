"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  FileUp,
  Globe2,
  Crown,
  Import,
  Link2,
  Search,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

import type { DeckCard, DeckFormat, DeckRecord, ManaColor, ScryfallCardResult } from "@/lib/deck-vault/types";
import { loadDeckVault, saveDeckRecord } from "@/lib/deck-vault/persistence";
import { DECK_FORMATS, normalizeDeckFormat } from "@/lib/deck-vault/formats";
import {
  detectDeckListSource,
  parseDeckListText,
  type DeckSuiteParsedEntry,
} from "@/lib/deck-suite/domain";

type ImportMode = "paste" | "url" | "file";

type ResolvedPayload = {
  cards: DeckCard[];
  unresolved: DeckSuiteParsedEntry[];
  colors: ManaColor[];
  marketValue: number;
};

const formats: DeckFormat[] = DECK_FORMATS;

export function DeckImportCenter({
  plan,
  deckLimit,
}: {
  plan: string;
  deckLimit: number | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>("paste");
  const [value, setValue] = useState("");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [deckName, setDeckName] = useState("Imported Deck");
  const [format, setFormat] = useState<DeckFormat>("EDH");
  const [source, setSource] = useState("Plain text");
  const [status, setStatus] = useState<"idle" | "loading-url" | "resolving" | "error">("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [commanderQuery, setCommanderQuery] = useState("");
  const [commanderResults, setCommanderResults] = useState<ScryfallCardResult[]>([]);
  const [selectedCommander, setSelectedCommander] = useState<ScryfallCardResult | null>(null);
  const [secondaryCommander, setSecondaryCommander] = useState<ScryfallCardResult | null>(null);
  const [selectingSecondary, setSelectingSecondary] = useState(false);
  const [commanderSearching, setCommanderSearching] = useState(false);
  const isCommanderFormat = format === "EDH" || format === "Pauper EDH";

  const parsed = useMemo(() => parseDeckListText(value), [value]);
  const totalQuantity = parsed.reduce((sum, card) => sum + card.quantity, 0);
  const commanderCount =
    (selectedCommander ? 1 : 0) +
    (secondaryCommander ? 1 : 0) ||
    parsed.filter((card) => card.board === "commander").length;
  const sideboardCount = parsed.filter((card) => card.board === "sideboard").reduce((sum, card) => sum + card.quantity, 0);

  function switchMode(nextMode: ImportMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function importUrl() {
    if (!url.trim()) {
      setError("Paste a public Moxfield deck URL first.");
      return;
    }

    setStatus("loading-url");
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/deck-vault/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "The deck URL could not be imported.");
      }

      setValue(payload.deckList ?? "");
      setDeckName(payload.name ?? "Imported Moxfield Deck");
      setFormat(normalizeFormat(payload.format));
      setSource(payload.source ?? "Moxfield");
      setMode("paste");
      setNotice(`Loaded ${payload.cardCount ?? 0} cards from Moxfield. Review the list, then import it.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The deck URL could not be imported.");
    } finally {
      setStatus("idle");
    }
  }

  async function handleFile(file?: File) {
    if (!file) return;
    setError("");
    setNotice("");

    const supported = /\.(txt|csv|dek)$/i.test(file.name) || file.type.startsWith("text/");
    if (!supported) {
      setError("Upload a TXT, CSV, or DEK decklist file.");
      return;
    }

    try {
      const text = await file.text();
      setValue(text);
      setFileName(file.name);
      setDeckName(file.name.replace(/\.[^.]+$/, "") || "Imported Deck");
      setSource(detectDeckListSource(text, file.name));
      setMode("paste");
      setNotice(`${file.name} was loaded successfully. Review the recognized cards below.`);
    } catch {
      setError("The selected file could not be read.");
    }
  }

  async function searchCommanders() {
    if (commanderQuery.trim().length < 2) {
      setCommanderResults([]);
      return;
    }

    setCommanderSearching(true);
    setError("");

    try {
      const params = new URLSearchParams({
        q: `${commanderQuery.trim()} is:commander`,
      });
      const response = await fetch(
        `/api/deck-vault/card-search?${params.toString()}`,
      );
      const payload = await response.json();
      setCommanderResults(payload.results ?? []);
    } catch {
      setError("Commander search could not be completed.");
    } finally {
      setCommanderSearching(false);
    }
  }

  function entriesWithCommander() {
    if (!isCommanderFormat) {
      return parsed.map((entry) =>
        entry.board === "commander"
          ? { ...entry, board: "main" as const }
          : entry,
      );
    }

    const selected = [
      selectedCommander,
      secondaryCommander,
    ].filter(
      (
        card,
      ): card is ScryfallCardResult =>
        Boolean(card),
    );

    if (!selected.length) return parsed;

    const selectedNames = new Set(
      selected.map((card) =>
        card.name.toLowerCase(),
      ),
    );

    const found = new Set<string>();

    const normalized = parsed.map((entry) => {
      const lower =
        entry.name.toLowerCase();

      if (selectedNames.has(lower)) {
        found.add(lower);
        return {
          ...entry,
          quantity: 1,
          board: "commander" as const,
        };
      }

      if (entry.board === "commander") {
        return {
          ...entry,
          board: "main" as const,
        };
      }

      return entry;
    });

    for (const commander of selected) {
      if (
        !found.has(
          commander.name.toLowerCase(),
        )
      ) {
        normalized.unshift({
          quantity: 1,
          name: commander.name,
          setCode: commander.setCode,
          collectorNumber:
            commander.collectorNumber,
          board: "commander",
        });
      }
    }

    return normalized;
  }

  async function createDeck() {
    if (!parsed.length) {
      setError("No cards were recognized. Use a quantity followed by a card name, such as “1 Sol Ring”.");
      return;
    }

    if (deckLimit !== null) {
      const saved = await loadDeckVault();
      if (saved.length >= deckLimit) {
        setError(
          `Your ${plan === "free" ? "Free" : "Collector"} plan includes up to ${deckLimit} decks. Delete a deck or upgrade your plan to add another.`,
        );
        return;
      }
    }

    setStatus("resolving");
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/deck-vault/import-resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: entriesWithCommander() }),
      });
      const payload = (await response.json()) as ResolvedPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "The cards could not be resolved.");
      }

      const id = crypto.randomUUID();
      const commanders = payload.cards.filter((card) => card.board === "commander");
      const commander = commanders[0];
      const mainCards = payload.cards.filter((card) => card.board !== "commander");
      const totalMain = mainCards.reduce((sum, card) => sum + card.quantity, 0);
      const ownedCount = totalMain
        ? Math.round((mainCards.reduce((sum, card) => sum + (card.owned ? card.quantity : 0), 0) / totalMain) * 100)
        : 0;

      const commandZoneColors = Array.from(
        new Set(
          commanders.flatMap(
            (card) => card.colors,
          ),
        ),
      ) as ManaColor[];
      const coloredCommandZone =
        commandZoneColors.filter(
          (color) => color !== "C",
        );

      const deck: DeckRecord = {
        id,
        name: deckName.trim() || "Imported Deck",
        commander: commander?.name,
        commanders: commanders.map((card) => card.name),
        format,
        theme: source === "Moxfield" ? "Imported from Moxfield" : `Imported from ${source}`,
        colors: commanders.length
          ? coloredCommandZone.length
            ? coloredCommandZone
            : (["C"] as ManaColor[])
          : payload.colors.length
            ? payload.colors
            : (["C"] as ManaColor[]),
        marketValue: payload.marketValue,
        ownedCount,
        cardCount: totalMain + commanders.length,
        power: 5,
        updatedAt: "Just now",
        status: payload.unresolved.length ? "Building" : "Complete",
        cards: payload.cards,
      };

      await saveDeckRecord(deck, payload.unresolved);

      router.push(`/dashboard/deck-vault/decks/${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The deck could not be imported.");
      setStatus("error");
    } finally {
      setStatus((current) => (current === "error" ? "error" : "idle"));
    }
  }

  return (
    <main className="min-h-screen bg-td-canvas px-5 py-7 text-td-primary sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="relative overflow-hidden rounded-[30px] border border-td-accent/[0.13] bg-td-surface p-7 shadow-[0_32px_90px_rgb(var(--td-shadow-rgb)/calc(0.28*var(--td-shadow-strength)))] sm:p-9">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgb(var(--td-accent-rgb)/0.14),transparent_34%),radial-gradient(circle_at_82%_15%,rgba(139,92,246,0.11),transparent_32%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(var(--td-accent-rgb)/0.018)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--td-accent-rgb)/0.018)_1px,transparent_1px)] bg-[size:34px_34px]" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-td-accent/[0.16] bg-td-accent/[0.05] text-td-accent-text">
                  <Import className="h-5 w-5" />
                </span>
                <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-td-accent-text">Universal Deck Import</span>
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Bring in a deck. Keep every detail.</h1>
              <p className="mt-4 max-w-4xl text-[15px] leading-7 text-td-secondary">
                Paste a list, load a public Moxfield URL, or upload a deck file. Trading Docks recognizes sections, resolves cards through Scryfall, and opens the finished deck directly in Deck Vault.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <HeroMetric label="Formats" value="8+" />
              <HeroMetric label="Card data" value="Scryfall" />
              <HeroMetric label="Workflow" value="Live" />
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="overflow-hidden rounded-[28px] border border-td-ink/[0.075] bg-td-surface shadow-[0_28px_80px_rgb(var(--td-shadow-rgb)/calc(0.22*var(--td-shadow-strength)))]">
            <div className="grid gap-2 border-b border-td-ink/[0.055] p-4 sm:grid-cols-3">
              <ModeButton icon={ClipboardPaste} label="Paste decklist" detail="Any common export format" active={mode === "paste"} onClick={() => switchMode("paste")} />
              <ModeButton icon={Link2} label="Moxfield URL" detail="Load a public deck" active={mode === "url"} onClick={() => switchMode("url")} />
              <ModeButton icon={FileUp} label="Upload file" detail="TXT, CSV, or DEK" active={mode === "file"} onClick={() => switchMode("file")} />
            </div>

            <div className="p-5 sm:p-6">
              {mode === "paste" ? (
                <div>
                  <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
                    <label>
                      <span className="text-[12px] font-semibold text-td-secondary">Deck name</span>
                      <input value={deckName} onChange={(event) => setDeckName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-td-ink/[0.075] bg-black/[0.13] px-4 text-[14px] text-td-primary outline-none focus:border-td-accent/[0.2]" />
                    </label>
                    <label>
                      <span className="text-[12px] font-semibold text-td-secondary">Format</span>
                      <select value={format} onChange={(event) => {
                        const nextFormat = event.target.value as DeckFormat;
                        setFormat(nextFormat);
                        if (nextFormat !== "EDH" && nextFormat !== "Pauper EDH") {
                          setSelectedCommander(null);
                          setSecondaryCommander(null);
                          setSelectingSecondary(false);
                          setCommanderQuery("");
                          setCommanderResults([]);
                        }
                      }} className="mt-2 h-12 w-full rounded-xl border border-td-ink/[0.075] bg-td-surface px-4 text-[14px] text-td-primary outline-none">
                        {formats.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </label>
                  </div>

                  {isCommanderFormat ? <section className="mt-5 rounded-2xl border border-td-violet/[0.12] bg-td-violet/[0.025] p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-td-violet/[0.14] bg-td-violet/[0.05]">
                        <Crown className="h-5 w-5 text-td-violet" />
                      </span>
                      <div>
                        <p className="text-[15px] font-semibold text-td-primary">
                          Choose your commander
                        </p>
                        <p className="mt-1 text-[12px] leading-5 text-td-muted">
                          Select the commander before importing. Trading Docks will mark it as the standalone commander even when the source list does not.
                        </p>
                      </div>
                    </div>

                    {selectedCommander ? (
                      <div className="mt-4 flex items-center gap-4 rounded-xl border border-td-success/[0.12] bg-td-success/[0.025] p-3">
                        {selectedCommander.image ? (
                          <img
                            src={selectedCommander.image}
                            alt={selectedCommander.name}
                            className="h-20 w-14 rounded-lg object-cover"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-td-primary">
                            {selectedCommander.name}
                          </p>
                          <p className="mt-1 text-[11px] text-td-muted">
                            {selectedCommander.typeLine}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCommander(null);
                            setCommanderQuery("");
                          }}
                          className="h-9 rounded-xl border border-td-ink/[0.07] px-3 text-[12px] text-td-secondary"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="mt-4 flex gap-2">
                          <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-td-ink/[0.075] bg-black/[0.13] px-3">
                            <Search className="h-4 w-4 text-td-muted" />
                            <input
                              value={commanderQuery}
                              onChange={(event) => setCommanderQuery(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void searchCommanders();
                                }
                              }}
                              placeholder="Search legendary commanders..."
                              className="min-w-0 flex-1 bg-transparent text-[13px] text-td-primary outline-none placeholder:text-td-muted"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => void searchCommanders()}
                            disabled={commanderSearching || commanderQuery.trim().length < 2}
                            className="h-11 rounded-xl border border-td-violet/[0.15] bg-td-violet/[0.04] px-4 text-[12px] font-semibold text-td-violet disabled:opacity-40"
                          >
                            {commanderSearching ? "Searching…" : "Find"}
                          </button>
                        </div>

                        {commanderResults.length ? (
                          <div className="mt-3 grid max-h-[250px] gap-2 overflow-y-auto sm:grid-cols-2">
                            {commanderResults.map((result) => (
                              <button
                                key={result.id}
                                type="button"
                                onClick={() => {
                                  if (selectingSecondary) {
                                    setSecondaryCommander(result);
                                    setSelectingSecondary(false);
                                  } else {
                                    setSelectedCommander(result);
                                  }
                                  setCommanderResults([]);
                                }}
                                className="flex items-center gap-3 rounded-xl border border-td-ink/[0.06] bg-td-ink/[0.015] p-2 text-left transition hover:border-td-violet/[0.16]"
                              >
                                {result.image ? (
                                  <img
                                    src={result.image}
                                    alt={result.name}
                                    className="h-16 w-12 rounded-lg object-cover"
                                  />
                                ) : null}
                                <div className="min-w-0">
                                  <p className="truncate text-[13px] font-semibold text-td-primary">
                                    {result.name}
                                  </p>
                                  <p className="mt-1 truncate text-[11px] text-td-muted">
                                    {result.typeLine}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                    <div className="mt-4 border-t border-td-ink/[0.055] pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-semibold text-td-primary">
                            Partner / second commander
                          </p>
                          <p className="mt-1 text-[11px] text-td-muted">
                            Optional for Partner, Friends Forever, Background, or Doctor's Companion decks.
                          </p>
                        </div>
                        {secondaryCommander ? (
                          <button
                            type="button"
                            onClick={() => setSecondaryCommander(null)}
                            className="h-9 rounded-xl border border-td-danger/[0.12] px-3 text-[11px] text-td-danger"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectingSecondary(true);
                              setCommanderQuery("");
                              setCommanderResults([]);
                            }}
                            className="h-9 rounded-xl border border-td-violet/[0.14] bg-td-violet/[0.035] px-3 text-[11px] font-semibold text-td-violet"
                          >
                            Add second commander
                          </button>
                        )}
                      </div>

                      {secondaryCommander ? (
                        <div className="mt-3 flex items-center gap-3 rounded-xl border border-td-violet/[0.12] bg-td-violet/[0.025] p-3">
                          {secondaryCommander.image ? (
                            <img
                              src={secondaryCommander.image}
                              alt={secondaryCommander.name}
                              className="h-16 w-12 rounded-lg object-cover"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-td-primary">
                              {secondaryCommander.name}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-td-muted">
                              {secondaryCommander.typeLine}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {selectingSecondary ? (
                        <div className="mt-3 space-y-3 rounded-xl border border-td-accent/[0.1] bg-td-accent/[0.025] p-3">
                          <div className="flex gap-2">
                            <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-td-ink/[0.075] bg-black/[0.13] px-3">
                              <Search className="h-4 w-4 text-td-muted" />
                              <input
                                value={commanderQuery}
                                onChange={(event) => setCommanderQuery(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void searchCommanders();
                                  }
                                }}
                                placeholder="Search partner commander..."
                                className="min-w-0 flex-1 bg-transparent text-[13px] text-td-primary outline-none placeholder:text-td-muted"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => void searchCommanders()}
                              disabled={commanderSearching || commanderQuery.trim().length < 2}
                              className="h-11 rounded-xl border border-td-accent/[0.15] bg-td-accent/[0.04] px-4 text-[12px] font-semibold text-td-accent-text disabled:opacity-40"
                            >
                              {commanderSearching ? "Searching…" : "Find"}
                            </button>
                          </div>

                          {commanderResults.length ? (
                            <div className="grid max-h-[220px] gap-2 overflow-y-auto sm:grid-cols-2">
                              {commanderResults.map((result) => (
                                <button
                                  key={`secondary-${result.id}`}
                                  type="button"
                                  onClick={() => {
                                    setSecondaryCommander(result);
                                    setSelectingSecondary(false);
                                    setCommanderResults([]);
                                    setCommanderQuery("");
                                  }}
                                  className="flex items-center gap-3 rounded-xl border border-td-ink/[0.06] bg-td-ink/[0.015] p-2 text-left transition hover:border-td-accent/[0.16]"
                                >
                                  {result.image ? (
                                    <img
                                      src={result.image}
                                      alt={result.name}
                                      className="h-16 w-12 rounded-lg object-cover"
                                    />
                                  ) : null}
                                  <div className="min-w-0">
                                    <p className="truncate text-[13px] font-semibold text-td-primary">
                                      {result.name}
                                    </p>
                                    <p className="mt-1 truncate text-[11px] text-td-muted">
                                      {result.typeLine}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </section> : null}

                  <label className="mt-5 block">
                    <span className="text-[12px] font-semibold text-td-secondary">Decklist</span>
                    <textarea
                      value={value}
                      onChange={(event) => {
                        setValue(event.target.value);
                    setSource(detectDeckListSource(event.target.value));
                      }}
                      placeholder={"Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet\n4 Island\n4 Forest"}
                      className="mt-2 min-h-[430px] w-full resize-y rounded-2xl border border-td-ink/[0.075] bg-black/[0.14] p-5 font-mono text-[14px] leading-7 text-td-primary outline-none placeholder:text-td-muted focus:border-td-accent/[0.22]"
                    />
                  </label>
                </div>
              ) : null}

              {mode === "url" ? (
                <div className="flex min-h-[510px] flex-col items-center justify-center rounded-[24px] border border-dashed border-td-accent/[0.16] bg-td-accent/[0.018] p-7 text-center">
                  <Globe2 className="h-12 w-12 text-td-accent-text" />
                  <h2 className="mt-5 text-2xl font-semibold">Import a public Moxfield deck</h2>
                  <p className="mt-3 max-w-xl text-[14px] leading-6 text-td-secondary">Paste the full deck URL. Trading Docks will retrieve the commander, mainboard, sideboard, maybeboard, deck name, and format.</p>
                  <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.moxfield.com/decks/..." className="mt-6 h-12 w-full max-w-2xl rounded-xl border border-td-ink/[0.08] bg-black/[0.15] px-4 text-[14px] text-td-primary outline-none placeholder:text-td-muted focus:border-td-accent/[0.22]" />
                  <button type="button" onClick={() => void importUrl()} disabled={status === "loading-url"} className="mt-4 inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-td-accent to-td-accent px-6 text-[14px] font-semibold text-td-on-accent disabled:opacity-50">
                    {status === "loading-url" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    {status === "loading-url" ? "Loading deck…" : "Load Moxfield deck"}
                  </button>
                </div>
              ) : null}

              {mode === "file" ? (
                <div className="flex min-h-[510px] flex-col items-center justify-center rounded-[24px] border border-dashed border-td-violet/[0.16] bg-td-violet/[0.018] p-7 text-center" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleFile(event.dataTransfer.files[0]); }}>
                  <UploadCloud className="h-12 w-12 text-td-violet" />
                  <h2 className="mt-5 text-2xl font-semibold">Drop a deck file here</h2>
                  <p className="mt-3 max-w-xl text-[14px] leading-6 text-td-secondary">Use a TXT, CSV, Arena export, ManaBox export, or other plain-text deck file. Printing identifiers are preserved when available.</p>
                  <input ref={fileInputRef} type="file" accept=".txt,.csv,.dek,text/plain,text/csv" onChange={(event) => void handleFile(event.target.files?.[0])} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-5 h-12 rounded-xl border border-td-violet/[0.16] bg-td-violet/[0.04] px-6 text-[14px] font-semibold text-td-violet">Choose file</button>
                  {fileName ? <p className="mt-4 text-[13px] text-td-success">Loaded: {fileName}</p> : null}
                </div>
              ) : null}

              {error ? <Message tone="error" text={error} onClose={() => setError("")} /> : null}
              {notice ? <Message tone="success" text={notice} onClose={() => setNotice("")} /> : null}

              <div className="mt-5 flex flex-col gap-4 border-t border-td-ink/[0.055] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-td-success" />
                  <p className="max-w-2xl text-[12px] leading-5 text-td-muted">Imports are resolved against current Scryfall card data. Commander, sideboard, and maybeboard markers are preserved.</p>
                </div>
                <button type="button" onClick={() => void createDeck()} disabled={!parsed.length || status === "resolving"} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-td-accent to-td-accent px-6 text-[14px] font-semibold text-td-on-accent shadow-[0_0_24px_rgb(var(--td-accent-rgb)/0.14)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35">
                  {status === "resolving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {status === "resolving" ? "Resolving cards…" : `Import ${totalQuantity || ""} cards`}
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[26px] border border-td-success/[0.11] bg-td-surface p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-td-success" />
                  <div>
                    <p className="text-[18px] font-semibold">Import Preview</p>
                    <p className="mt-1 text-[12px] text-td-muted">Updates as you type</p>
                  </div>
                </div>
                <span className={["rounded-full px-2.5 py-1 text-[11px] font-semibold", parsed.length ? "bg-td-success/[0.08] text-td-success" : "bg-td-ink/[0.035] text-td-muted"].join(" ")}>{parsed.length ? "Ready" : "Waiting"}</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Preview label="Unique cards" value={String(parsed.length)} />
                <Preview label="Total quantity" value={String(totalQuantity)} />
                {isCommanderFormat ? <Preview label="Commander" value={String(commanderCount)} /> : null}
                <Preview label="Sideboard" value={String(sideboardCount)} />
                <Preview label="Source" value={source} />
                <Preview label="Format" value={format} />
              </div>
            </section>

            <section className="rounded-[26px] border border-td-ink/[0.075] bg-td-surface p-5">
              <p className="text-[18px] font-semibold">Recognition Checklist</p>
              <div className="mt-4 space-y-3">
                <Checklist label="Quantity and card name" complete={parsed.length > 0} />
                {isCommanderFormat ? <Checklist label="Commander section" complete={commanderCount > 0} /> : null}
                <Checklist label="Set and collector numbers" complete={parsed.some((card) => card.setCode || card.collectorNumber)} optional />
                <Checklist label="Sideboard or maybeboard" complete={parsed.some((card) => card.board === "sideboard" || card.board === "maybeboard")} optional />
              </div>
            </section>

            <section className="rounded-[26px] border border-td-violet/[0.1] bg-td-surface p-5">
              <p className="text-[18px] font-semibold">Accepted examples</p>
              <div className="mt-4 space-y-3 font-mono text-[12px] leading-6 text-td-secondary">
                <Example title="Plain text" text={"1 Sol Ring\n4 Island"} onUse={() => { setValue("Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet\n4 Island\n4 Forest"); setSource("Plain text"); setMode("paste"); }} />
                <Example title="ManaBox / Moxfield export" text={"1x Sol Ring (CMM) 396\n1x Arcane Signet (ELD) 331"} onUse={() => { setValue("1x Sol Ring (CMM) 396\n1x Arcane Signet (ELD) 331"); setSource("ManaBox"); setMode("paste"); }} />
                <Example title="CSV" text={'Quantity,Name,Set,Collector Number\n1,"Sol Ring",CMM,396'} onUse={() => { setValue('Quantity,Name,Set,Collector Number\n1,"Sol Ring",CMM,396'); setSource("CSV"); setMode("paste"); }} />
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function normalizeFormat(value?: string): DeckFormat {
  return normalizeDeckFormat(String(value ?? ""));
}

function ModeButton({ icon: Icon, label, detail, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; detail: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={["flex items-center gap-3 rounded-2xl border p-4 text-left transition", active ? "border-td-accent/[0.2] bg-td-accent/[0.055]" : "border-td-ink/[0.06] bg-td-ink/[0.012] hover:border-td-accent/[0.12]"].join(" ")}><span className={["flex h-10 w-10 items-center justify-center rounded-xl", active ? "bg-td-accent text-td-on-accent" : "bg-td-ink/[0.035] text-td-muted"].join(" ")}><Icon className="h-4 w-4" /></span><span><span className={["block text-[14px] font-semibold", active ? "text-td-primary" : "text-td-secondary"].join(" ")}>{label}</span><span className="mt-1 block text-[11px] text-td-muted">{detail}</span></span></button>;
}

function Preview({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-td-ink/[0.055] bg-black/[0.08] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">{label}</p><p className="mt-2 truncate text-[16px] font-semibold text-td-primary">{value}</p></div>;
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-[105px] rounded-xl border border-td-ink/[0.07] bg-black/20 p-3 backdrop-blur"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">{label}</p><p className="mt-1 text-[14px] font-semibold text-td-primary">{value}</p></div>;
}

function Checklist({ label, complete, optional = false }: { label: string; complete: boolean; optional?: boolean }) {
  return <div className="flex items-center gap-3 rounded-xl border border-td-ink/[0.055] bg-td-ink/[0.012] px-3 py-3"><span className={["flex h-6 w-6 items-center justify-center rounded-full border", complete ? "border-td-success/[0.2] bg-td-success/[0.08] text-td-success" : "border-td-ink/[0.08] text-td-muted"].join(" ")}>{complete ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span><span className="text-[13px] text-td-secondary">{label}</span>{optional ? <span className="ml-auto text-[11px] uppercase tracking-[0.08em] text-td-muted">Optional</span> : null}</div>;
}

function Example({ title, text, onUse }: { title: string; text: string; onUse: () => void }) {
  return <button type="button" onClick={onUse} className="w-full rounded-xl border border-td-ink/[0.055] bg-td-ink/[0.012] p-3 text-left transition hover:border-td-violet/[0.14]"><span className="font-sans text-[12px] font-semibold text-td-violet">{title}</span><pre className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-td-muted">{text}</pre></button>;
}

function Message({ tone, text, onClose }: { tone: "error" | "success"; text: string; onClose: () => void }) {
  const errorTone = tone === "error";
  return <div className={["mt-5 flex items-start gap-3 rounded-xl border p-4", errorTone ? "border-td-danger/[0.14] bg-td-danger/[0.035] text-td-danger" : "border-td-success/[0.14] bg-td-success/[0.035] text-td-success"].join(" ")}>{errorTone ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}<p className="flex-1 text-[13px] leading-5">{text}</p><button type="button" onClick={onClose}><X className="h-4 w-4" /></button></div>;
}
