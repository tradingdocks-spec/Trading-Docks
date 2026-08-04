"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Boxes,
  ChevronDown,
  CheckCircle2,
  ExternalLink,
  PackageOpen,
  RefreshCw,
  Search,
  ShoppingCart,
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

type RetailerQuote = {
  itemPrice: number | null;
  shipping: number | null;
  stock: "unchecked" | "in-stock" | "out-of-stock";
};

const SEALED_SOURCES = [
  { id: "stomping-grounds", name: "Stomping Grounds", kind: "Specialty retailer", search: (q: string) => `https://www.stompinggroundstcg.com/search?q=${encodeURIComponent(q)}` },
  { id: "amazon", name: "Amazon", kind: "Marketplace", search: (q: string) => `https://www.amazon.com/s?k=${encodeURIComponent(`${q} commander deck`)}` },
  { id: "walmart", name: "Walmart", kind: "Retail marketplace", search: (q: string) => `https://www.walmart.com/search?q=${encodeURIComponent(`${q} commander deck`)}` },
  { id: "gamers-guild-az", name: "Gamers Guild AZ", kind: "Local specialty retailer", search: (q: string) => `https://gamersguildaz.com/search?q=${encodeURIComponent(q)}` },
  { id: "tcgplayer", name: "TCGplayer", kind: "TCG marketplace", search: (q: string) => `https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=${encodeURIComponent(q)}&view=grid` },
  { id: "manapool", name: "Mana Pool", kind: "TCG marketplace", search: (q: string) => `https://manapool.com/search?q=${encodeURIComponent(q)}` },
  { id: "cardsphere", name: "Cardsphere", kind: "Community market reference", search: (q: string) => `https://www.cardsphere.com/search?query=${encodeURIComponent(q)}` },
] as const;

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
  const [quotes, setQuotes] = useState<Record<string, RetailerQuote>>({});
  const [showPriceSources, setShowPriceSources] = useState(false);

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
      setQuotes({});
      setShowPriceSources(false);
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

  const verifiedQuotes = SEALED_SOURCES.flatMap((source) => {
    const quote = quotes[source.id];
    if (!quote || quote.stock !== "in-stock" || quote.itemPrice === null) return [];
    return [{ source, quote, delivered: quote.itemPrice + (quote.shipping ?? 0) }];
  }).sort((a, b) => a.delivered - b.delivered);
  const bestQuote = verifiedQuotes[0];
  const averageDeckCost = verifiedQuotes.length
    ? verifiedQuotes.reduce((sum, result) => sum + result.delivered, 0) / verifiedQuotes.length
    : null;
  const effectivePurchasePrice = averageDeckCost ?? purchasePrice;

  const economics = useMemo(() => {
    const cards = analysis?.deck.cards ?? [];
    const sellableGross = cards.filter((card) => card.unitPrice >= 1).reduce((sum, card) => sum + card.totalPrice, 0);
    const subDollarCards = cards.filter((card) => card.unitPrice > 0 && card.unitPrice < 1).reduce((sum, card) => sum + card.count, 0);
    const bulkRecovery = subDollarCards * Math.max(0, bulkRate);
    const fees = sellableGross * Math.max(0, feePercent) / 100;
    const expectedNet = sellableGross - fees - Math.max(0, fulfillment) + bulkRecovery;
    const profit = expectedNet - Math.max(0, effectivePurchasePrice);
    const roi = effectivePurchasePrice > 0 ? (profit / effectivePurchasePrice) * 100 : 0;
    const safeBuyPrice = Math.max(0, expectedNet / 1.25);
    const recovery = effectivePurchasePrice > 0 ? expectedNet / effectivePurchasePrice : 0;
    const verdict = recovery >= 1.4 ? "Strong break" : recovery >= 1.15 ? "Worth reviewing" : recovery >= 1 ? "Thin margin" : "Keep sealed";
    return { sellableGross, subDollarCards, bulkRecovery, fees, expectedNet, profit, roi, safeBuyPrice, recovery, verdict };
  }, [analysis, bulkRate, effectivePurchasePrice, feePercent, fulfillment]);

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
                    <InputMetric label={averageDeckCost === null ? "Your sealed cost" : "Manual cost fallback"} prefix="$" value={purchasePrice} onChange={setPurchasePrice} />
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

                <section className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#071522]">
                  <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-300"><ShoppingCart className="h-4 w-4" /> Average precon cost</p>
                      <div className="mt-2 flex items-baseline gap-3">
                        <h3 className="text-3xl font-semibold tracking-[-0.04em]">{money(effectivePurchasePrice)}</h3>
                        {bestQuote ? <span className="text-xs text-slate-500">Best found {money(bestQuote.delivered)}</span> : null}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{averageDeckCost === null ? "Using your manual cost until a retailer price is verified." : `Average delivered price across ${verifiedQuotes.length} verified ${verifiedQuotes.length === 1 ? "source" : "sources"}. Automatically used in the profit estimate.`}</p>
                    </div>
                    <button type="button" onClick={() => setShowPriceSources((current) => !current)} aria-expanded={showPriceSources} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-200">
                      {showPriceSources ? "Hide" : "View"} price sources <span className="text-slate-600">{verifiedQuotes.length}/{SEALED_SOURCES.length}</span><ChevronDown className={`h-4 w-4 transition ${showPriceSources ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  {showPriceSources ? <>
                  <div className="hidden grid-cols-[minmax(190px,1fr)_110px_110px_120px_130px_48px] gap-3 border-b border-white/[0.05] px-5 py-2 text-[8px] font-bold uppercase tracking-[0.13em] text-slate-700 lg:grid">
                    <span>Source</span><span>Item price</span><span>Shipping</span><span>Availability</span><span className="text-right">Delivered</span><span />
                  </div>
                  <div className="divide-y divide-white/[0.055]">
                    {SEALED_SOURCES.map((source) => {
                      const quote = quotes[source.id] ?? { itemPrice: null, shipping: null, stock: "unchecked" };
                      const delivered = quote.itemPrice === null ? null : quote.itemPrice + (quote.shipping ?? 0);
                      const isBest = bestQuote?.source.id === source.id;
                      const setQuote = (patch: Partial<RetailerQuote>) => setQuotes((current) => ({ ...current, [source.id]: { ...quote, ...patch } }));
                      return <div key={source.id} className={`grid gap-3 px-5 py-4 lg:grid-cols-[minmax(190px,1fr)_110px_110px_120px_130px_48px] lg:items-center ${isBest ? "bg-emerald-400/[0.035]" : ""}`}>
                        <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-xs font-semibold text-slate-200">{source.name}</p>{isBest ? <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-300">Best</span> : null}</div><p className="mt-1 text-[9px] text-slate-600">{source.kind}</p></div>
                        <PriceField label="Item price" value={quote.itemPrice} onChange={(value) => setQuote({ itemPrice: value, stock: value === null ? quote.stock : "in-stock" })} />
                        <PriceField label="Shipping" value={quote.shipping} onChange={(value) => setQuote({ shipping: value })} />
                        <select aria-label={`${source.name} availability`} value={quote.stock} onChange={(event) => setQuote({ stock: event.target.value as RetailerQuote["stock"] })} className="h-10 rounded-lg border border-white/[0.07] bg-[#04101a] px-2 text-[10px] text-slate-300 outline-none focus:border-cyan-300/25"><option value="unchecked">Not checked</option><option value="in-stock">In stock</option><option value="out-of-stock">Out of stock</option></select>
                        <div className="lg:text-right"><p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-700 lg:hidden">Delivered</p><p className={`mt-1 text-sm font-semibold lg:mt-0 ${isBest ? "text-emerald-300" : "text-slate-300"}`}>{delivered === null ? "—" : money(delivered)}</p></div>
                        <a href={source.search(analysis.deck.name)} target="_blank" rel="noreferrer" aria-label={`Check ${source.name}`} title={`Check ${source.name}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-white/[0.07] text-slate-500 transition hover:border-cyan-300/25 hover:text-cyan-200"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </div>;
                    })}
                  </div>
                  <div className="border-t border-white/[0.06] bg-black/10 px-5 py-3 text-[9px] leading-5 text-slate-600">Prices are saved only for the current comparison. Verify that listings are factory sealed, English, the correct deck—not a four-deck bundle—and immediately available. Cardsphere may serve as a community price reference when no sealed listing exists.</div>
                  </> : null}
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

function PriceField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return <label className="flex h-10 items-center rounded-lg border border-white/[0.07] bg-black/20 px-3 focus-within:border-cyan-300/25"><span className="mr-1 text-[10px] text-slate-600">$</span><input aria-label={label} type="number" min="0" step="0.01" value={value ?? ""} placeholder="0.00" onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-800" /></label>;
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
