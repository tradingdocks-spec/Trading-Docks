"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Boxes,
  CheckCircle2,
  ExternalLink,
  PackageOpen,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

type CatalogDeck = {
  code: string;
  fileName: string;
  name: string;
  releaseDate: string;
  type: string;
};

type PricedCard = {
  name: string;
  count: number;
  setCode: string;
  collectorNumber: string;
  unitPrice: number;
  totalPrice: number;
  image: string;
};

type Analysis = {
  deck: {
    name: string;
    code: string;
    releaseDate: string;
    cardCount: number;
    pricedCount: number;
    grossSinglesValue: number;
    cards: PricedCard[];
  };
  sources: { referenceUrl: string; pricedAt: string };
};

export function PreconIntelligenceWorkspace() {
  const [catalog, setCatalog] = useState<CatalogDeck[]>([]);
  const [query, setQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [purchasePrice, setPurchasePrice] = useState(49.99);
  const [feePercent, setFeePercent] = useState(13.25);
  const [fulfillment, setFulfillment] = useState(8);
  const [bulkRate, setBulkRate] = useState(0.1);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadCatalog();
  }, []);

  async function loadCatalog() {
    setLoadingCatalog(true);
    setError("");
    try {
      const response = await fetch("/api/precon-intelligence", { cache: "no-store" });
      const payload = await response.json() as { decks?: CatalogDeck[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load commander decks.");
      setCatalog(payload.decks ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load commander decks.");
    } finally {
      setLoadingCatalog(false);
    }
  }

  async function analyze(fileName = selectedFile) {
    if (!fileName) return;
    setLoadingDeck(true);
    setError("");
    try {
      const response = await fetch(`/api/precon-intelligence?file=${encodeURIComponent(fileName)}`, { cache: "no-store" });
      const payload = await response.json() as Analysis & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not price this deck.");
      setAnalysis(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not price this deck.");
    } finally {
      setLoadingDeck(false);
    }
  }

  const filteredDecks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.filter((deck) => !needle || `${deck.name} ${deck.code}`.toLowerCase().includes(needle)).slice(0, 80);
  }, [catalog, query]);

  const economics = useMemo(() => {
    const cards = analysis?.deck.cards ?? [];
    const sellableGross = cards.filter((card) => card.unitPrice >= 1).reduce((sum, card) => sum + card.totalPrice, 0);
    const subDollarCards = cards.filter((card) => card.unitPrice > 0 && card.unitPrice < 1).reduce((sum, card) => sum + card.count, 0);
    const bulkRecovery = subDollarCards * Math.max(0, bulkRate);
    const fees = sellableGross * Math.max(0, feePercent) / 100;
    const expectedNet = sellableGross - fees - Math.max(0, fulfillment) + bulkRecovery;
    const profit = expectedNet - Math.max(0, purchasePrice);
    const roi = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;
    const safeBuyPrice = Math.max(0, expectedNet / 1.25);
    const recovery = purchasePrice > 0 ? expectedNet / purchasePrice : 0;
    const verdict = recovery >= 1.4 ? "Strong break" : recovery >= 1.15 ? "Worth reviewing" : recovery >= 1 ? "Thin margin" : "Keep sealed";
    return { sellableGross, subDollarCards, bulkRecovery, fees, expectedNet, profit, roi, safeBuyPrice, recovery, verdict };
  }, [analysis, bulkRate, feePercent, fulfillment, purchasePrice]);

  const verdictTone = economics.recovery >= 1.4 ? "emerald" : economics.recovery >= 1.15 ? "cyan" : economics.recovery >= 1 ? "amber" : "rose";

  return (
    <main className="min-h-screen bg-[#020b12] px-4 py-6 text-white sm:px-7 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-5 border-b border-white/[0.07] pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              <PackageOpen className="h-4 w-4" /> Purchasing Intelligence
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Commander Precon Breakdowns</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Compare a sealed deck&apos;s acquisition cost with the realistic value of the singles inside—after fees, low-value cards, and fulfillment.
            </p>
          </div>
          <a href="https://deckcheck.co/app/precons" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-semibold text-slate-300 hover:border-cyan-300/25 hover:text-cyan-200">
            Browse on DeckCheck <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </header>

        <section className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-white/[0.07] bg-[#071522] p-4 xl:sticky xl:top-5 xl:h-[calc(100vh-40px)]">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-semibold">Choose a precon</p><p className="mt-1 text-[10px] text-slate-500">{catalog.length || "—"} commander products</p></div>
              <button type="button" onClick={loadCatalog} aria-label="Refresh commander decks" className="rounded-lg border border-white/[0.07] p-2 text-slate-500 hover:text-cyan-200"><RefreshCw className={`h-3.5 w-3.5 ${loadingCatalog ? "animate-spin" : ""}`} /></button>
            </div>
            <label className="mt-4 flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 focus-within:border-cyan-300/25">
              <Search className="h-4 w-4 text-slate-600" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search deck or set…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-700" />
            </label>
            <div className="mt-3 max-h-[calc(100vh-180px)] space-y-1 overflow-y-auto pr-1">
              {filteredDecks.map((deck) => (
                <button key={deck.fileName} type="button" onClick={() => { setSelectedFile(deck.fileName); void analyze(deck.fileName); }} className={`w-full rounded-xl border px-3 py-3 text-left transition ${selectedFile === deck.fileName ? "border-cyan-300/25 bg-cyan-400/[0.07]" : "border-transparent hover:border-white/[0.07] hover:bg-white/[0.025]"}`}>
                  <p className="truncate text-xs font-semibold text-slate-200">{deck.name}</p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-slate-600">{deck.code} · {formatDate(deck.releaseDate)}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="min-w-0">
            {error ? <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-200"><ShieldAlert className="h-4 w-4" />{error}</div> : null}
            {!analysis && !loadingDeck ? <EmptyState /> : null}
            {loadingDeck ? <LoadingState /> : null}
            {analysis && !loadingDeck ? (
              <>
                <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.11),transparent_35%),#071522] p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="h-[142px] w-[100px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl">
                        {analysis.deck.cards[0]?.image ? <img src={analysis.deck.cards[0].image} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 pt-1">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300">{analysis.deck.code} · {formatDate(analysis.deck.releaseDate)}</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{analysis.deck.name}</h2>
                        <p className="mt-2 text-xs text-slate-500">{analysis.deck.cardCount} cards · {analysis.deck.pricedCount} priced · Updated {formatTime(analysis.sources.pricedAt)}</p>
                      </div>
                    </div>
                    <div className={`rounded-2xl border px-5 py-4 text-left lg:min-w-[210px] ${toneClasses(verdictTone)}`}>
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] opacity-70">Breakdown verdict</p>
                      <p className="mt-2 text-xl font-semibold">{economics.verdict}</p>
                      <p className="mt-1 text-xs opacity-70">{economics.roi >= 0 ? "+" : ""}{economics.roi.toFixed(1)}% estimated ROI</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InputMetric label="Your sealed cost" prefix="$" value={purchasePrice} onChange={setPurchasePrice} />
                    <InputMetric label="Marketplace fees" suffix="%" value={feePercent} onChange={setFeePercent} />
                    <InputMetric label="Total fulfillment" prefix="$" value={fulfillment} onChange={setFulfillment} />
                    <InputMetric label="Bulk recovery / card" prefix="$" value={bulkRate} step="0.01" onChange={setBulkRate} />
                  </div>
                </section>

                <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ResultMetric icon={Boxes} label="All singles market" value={money(analysis.deck.grossSinglesValue)} detail="Headline deck value" />
                  <ResultMetric icon={BadgeDollarSign} label="Sellable singles" value={money(economics.sellableGross)} detail="Cards priced $1+" />
                  <ResultMetric icon={TrendingUp} label="Expected net" value={money(economics.expectedNet)} detail={`${money(economics.fees)} fees deducted`} />
                  <ResultMetric icon={economics.profit >= 0 ? CheckCircle2 : ShieldAlert} label="Net profit" value={money(economics.profit)} detail={`Safe buy: ${money(economics.safeBuyPrice)}`} tone={economics.profit >= 0 ? "emerald" : "rose"} />
                </section>

                <section className="mt-4 rounded-2xl border border-white/[0.07] bg-[#071522]">
                  <div className="flex flex-col gap-2 border-b border-white/[0.06] p-5 sm:flex-row sm:items-end sm:justify-between">
                    <div><h3 className="text-base font-semibold">Value stack</h3><p className="mt-1 text-xs text-slate-500">Exact included printings, ranked by total value.</p></div>
                    <p className="text-[10px] text-slate-600">{economics.subDollarCards} sub-$1 cards valued at {money(economics.bulkRecovery)} bulk recovery</p>
                  </div>
                  <div className="divide-y divide-white/[0.055]">
                    {analysis.deck.cards.slice(0, 30).map((card, index) => (
                      <div key={`${card.setCode}-${card.collectorNumber}-${card.name}`} className="grid grid-cols-[28px_minmax(0,1fr)_70px_85px] items-center gap-3 px-4 py-3 sm:grid-cols-[32px_42px_minmax(0,1fr)_90px_100px] sm:px-5">
                        <span className="text-[10px] font-semibold text-slate-700">{String(index + 1).padStart(2, "0")}</span>
                        <div className="hidden h-12 w-9 overflow-hidden rounded-md border border-white/[0.08] bg-slate-950 sm:block">{card.image ? <img src={card.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}</div>
                        <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">{card.count > 1 ? `${card.count}× ` : ""}{card.name}</p><p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-slate-600">{card.setCode} #{card.collectorNumber}</p></div>
                        <p className="text-right text-[10px] text-slate-500">{money(card.unitPrice)} ea.</p>
                        <p className="text-right text-xs font-semibold text-slate-200">{money(card.totalPrice)}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <p className="mt-4 text-[10px] leading-5 text-slate-600">Deck composition is refreshed from MTGJSON and exact-printing price estimates from Scryfall. DeckCheck is linked as the precon discovery reference. Prices are estimates; verify listings, condition, demand, and sealed-product contents before purchasing.</p>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function EmptyState() {
  return <div className="flex min-h-[500px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-[#071522]/60 px-6 text-center"><div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.05] p-4 text-cyan-300"><PackageOpen className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-semibold">Find the margin inside the box.</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Choose a commander precon to see the cards carrying its value and set your actual acquisition costs.</p></div>;
}

function LoadingState() {
  return <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-white/[0.07] bg-[#071522]"><div className="text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-cyan-300" /><p className="mt-3 text-xs text-slate-500">Resolving exact printings and live prices…</p></div></div>;
}

function InputMetric({ label, value, prefix, suffix, step = "0.25", onChange }: { label: string; value: number; prefix?: string; suffix?: string; step?: string; onChange: (value: number) => void }) {
  return <label className="rounded-xl border border-white/[0.07] bg-black/20 p-3"><span className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-600">{label}</span><span className="mt-2 flex items-center gap-1 text-sm font-semibold text-slate-200">{prefix}<input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="min-w-0 flex-1 bg-transparent outline-none" />{suffix}</span></label>;
}

function ResultMetric({ icon: Icon, label, value, detail, tone = "slate" }: { icon: typeof Boxes; label: string; value: string; detail: string; tone?: "slate" | "emerald" | "rose" }) {
  const color = tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : "text-cyan-300";
  return <div className="rounded-2xl border border-white/[0.07] bg-[#071522] p-4"><div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.13em] text-slate-600"><Icon className={`h-4 w-4 ${color}`} />{label}</div><p className={`mt-3 text-2xl font-semibold tracking-[-0.03em] ${tone === "slate" ? "text-white" : color}`}>{value}</p><p className="mt-1 text-[10px] text-slate-600">{detail}</p></div>;
}

function toneClasses(tone: string) {
  if (tone === "emerald") return "border-emerald-300/20 bg-emerald-400/[0.07] text-emerald-200";
  if (tone === "cyan") return "border-cyan-300/20 bg-cyan-400/[0.07] text-cyan-200";
  if (tone === "amber") return "border-amber-300/20 bg-amber-400/[0.07] text-amber-200";
  return "border-rose-300/20 bg-rose-400/[0.07] text-rose-200";
}

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(value) ? value : 0); }
function formatDate(value: string) { if (!value) return "Unknown date"; return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function formatTime(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
