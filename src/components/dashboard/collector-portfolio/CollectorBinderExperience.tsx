"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  Grid3X3,
  Layers3,
  List,
  Maximize2,
  Palette,
  Share2,
  Sparkles,
  Star,
} from "lucide-react";

import type { CollectorProfile, PortfolioBinderView } from "@/lib/collector-portfolio";

type ViewMode = "spread" | "flipbook" | "gallery";

export function CollectorBinderExperience({
  profile,
  binder,
}: {
  profile: CollectorProfile;
  binder: PortfolioBinderView;
}) {
  const [view, setView] = useState<ViewMode>("spread");
  const [page, setPage] = useState(1);
  const [selectedCardId, setSelectedCardId] = useState(binder.cards[0]?.id ?? "");
  const [showValues, setShowValues] = useState(binder.show_values);
  const [focusMode, setFocusMode] = useState(false);

  const selectedCard = binder.cards.find((card) => card.id === selectedCardId);
  const pageCount = Math.max(1, binder.pageCount);
  const leftPage = page % 2 === 0 ? Math.max(1, page - 1) : page;
  const rightPage = Math.min(pageCount, leftPage + 1);

  const pageSummaries = useMemo(
    () =>
      Array.from({ length: pageCount }, (_, index) => {
        const pageNumber = index + 1;
        const cards = binder.cards.filter((card) => card.binderPage === pageNumber);
        return {
          page: pageNumber,
          cards,
          value: cards.reduce((sum, card) => sum + card.value, 0),
        };
      }),
    [binder.cards, pageCount],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") setPage((current) => Math.max(1, current - (view === "spread" ? 2 : 1)));
      if (event.key === "ArrowRight") setPage((current) => Math.min(pageCount, current + (view === "spread" ? 2 : 1)));
      if (event.key.toLowerCase() === "f") setFocusMode((current) => !current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pageCount, view]);

  return (
    <main className={`min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.15),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,211,238,.09),transparent_32%),#020911] text-white ${focusMode ? "p-2" : "px-4 py-5 sm:px-6 lg:px-8"}`}>
      <div className="mx-auto max-w-[1800px]">
        {!focusMode ? (
          <>
            <header className="relative overflow-hidden rounded-[28px] border border-violet-300/[0.15] bg-[linear-gradient(135deg,#0b1e2c,#071522_52%,#160d28)] p-5 shadow-[0_30px_100px_rgba(0,0,0,.42)] sm:p-6">
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-[110px]" style={{ backgroundColor: `${binder.accent_color}2c` }} />
              <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-4">
                  <Link href="/dashboard/collector-portfolio" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-black/15 text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" /></Link>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.17em] text-cyan-300"><Palette className="h-3.5 w-3.5" /> Collector Portfolio</span>
                      {binder.is_featured ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/[0.15] bg-amber-300/[0.05] px-2 py-1 text-[8px] font-semibold text-amber-200"><Star className="h-3 w-3 fill-amber-300" /> Featured</span> : null}
                    </div>
                    <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{binder.title}</h1>
                    <p className="mt-1 text-[10px] text-slate-500">@{profile.username} · {binder.cardCount} cards · {money(binder.estimatedValue)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-xl border border-white/[0.08] bg-black/20 p-1">
                    <ViewButton active={view === "spread"} onClick={() => setView("spread")} icon={Layers3} label="Spread" />
                    <ViewButton active={view === "flipbook"} onClick={() => setView("flipbook")} icon={BookOpen} label="Flipbook" />
                    <ViewButton active={view === "gallery"} onClick={() => setView("gallery")} icon={Grid3X3} label="Gallery" />
                  </div>
                  <button onClick={() => setShowValues((current) => !current)} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[10px] font-semibold transition ${showValues ? "border-emerald-300/[0.18] bg-emerald-300/[0.06] text-emerald-200" : "border-white/[0.08] bg-black/15 text-slate-500"}`}><Eye className="h-4 w-4" /> Values</button>
                  <Link href="/dashboard/collector-portfolio?tab=showcase" className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-3.5 text-[10px] font-bold text-[#031319]"><Share2 className="h-4 w-4" /> Share</Link>
                  <button onClick={() => setFocusMode(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-black/15 text-slate-400 transition hover:text-white" title="Focus mode"><Maximize2 className="h-4 w-4" /></button>
                </div>
              </div>
            </header>

            <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Summary label="Cards" value={binder.cardCount.toLocaleString()} />
              <Summary label="Value" value={money(binder.estimatedValue)} accent />
              <Summary label="Pages" value={String(pageCount)} />
              <Summary label="Current" value={view === "spread" ? `${leftPage}–${rightPage}` : String(page)} />
            </section>
          </>
        ) : null}

        <section className={`${focusMode ? "" : "mt-4"} relative overflow-hidden rounded-[30px] border border-violet-300/[0.14] bg-[radial-gradient(circle_at_top,rgba(139,92,246,.11),transparent_34%),linear-gradient(145deg,#120d20,#07131d_50%,#0c1722)] shadow-[0_38px_130px_rgba(0,0,0,.52)]`}>
          <div className="pointer-events-none absolute inset-x-20 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/45 to-transparent" />

          {view === "gallery" ? (
            <Gallery pages={pageSummaries} onOpen={(nextPage) => { setPage(nextPage); setView("spread"); }} showValues={showValues} />
          ) : (
            <div className="grid min-h-[720px] xl:grid-cols-[1fr_320px]">
              <div className="relative flex min-w-0 flex-col p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <button onClick={() => setPage((current) => Math.max(1, current - (view === "spread" ? 2 : 1)))} disabled={page <= 1} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/15 px-3 text-[10px] font-semibold text-slate-300 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /> Previous</button>
                  <div className="text-center">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300">{view === "spread" ? "Binder spread" : "Interactive flipbook"}</p>
                    <p className="mt-1 text-[10px] text-slate-600">{view === "spread" ? `Pages ${leftPage}–${rightPage}` : `Page ${page}`} of {pageCount}</p>
                  </div>
                  <button onClick={() => setPage((current) => Math.min(pageCount, current + (view === "spread" ? 2 : 1)))} disabled={page >= pageCount} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/15 px-3 text-[10px] font-semibold text-slate-300 disabled:opacity-30">Next <ChevronRight className="h-4 w-4" /></button>
                </div>

                {view === "spread" ? (
                  <div className="relative grid flex-1 gap-3 lg:grid-cols-2">
                    <div className="pointer-events-none absolute bottom-5 left-1/2 top-5 z-20 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-black/75 to-transparent lg:block" />
                    <PortfolioPage binder={binder} page={leftPage} selectedCardId={selectedCardId} onSelect={setSelectedCardId} showValues={showValues} side="left" />
                    <PortfolioPage binder={binder} page={rightPage} selectedCardId={selectedCardId} onSelect={setSelectedCardId} showValues={showValues} side="right" />
                  </div>
                ) : (
                  <div className="mx-auto flex w-full max-w-[760px] flex-1 items-center [perspective:1800px]">
                    <div className="w-full origin-left transition duration-500 [transform:rotateY(-2deg)]">
                      <PortfolioPage binder={binder} page={page} selectedCardId={selectedCardId} onSelect={setSelectedCardId} showValues={showValues} side="single" />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {pageSummaries.map((summary) => (
                    <button key={summary.page} onClick={() => setPage(summary.page)} className={`h-1.5 min-w-8 flex-1 rounded-full transition ${summary.page === page || (view === "spread" && (summary.page === leftPage || summary.page === rightPage)) ? "bg-cyan-300" : summary.cards.length ? "bg-violet-300/35 hover:bg-violet-300/60" : "bg-white/[0.06]"}`} title={`Page ${summary.page}`} />
                  ))}
                </div>
              </div>

              <aside className="border-t border-white/[0.07] bg-black/15 p-5 xl:border-l xl:border-t-0">
                {selectedCard ? (
                  <div className="sticky top-5">
                    <p className="text-[8px] font-bold uppercase tracking-[0.17em] text-cyan-300">Card spotlight</p>
                    {selectedCard.imageUrl ? <img src={selectedCard.imageUrl} alt={selectedCard.name} className="mt-4 aspect-[.716] w-full rounded-[18px] object-cover shadow-[0_24px_65px_rgba(0,0,0,.46)]" /> : null}
                    <h2 className="mt-4 text-xl font-semibold text-white">{selectedCard.name}</h2>
                    <p className="mt-1 text-[10px] text-slate-600">{[selectedCard.set, selectedCard.condition, selectedCard.finish].filter(Boolean).join(" · ")}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Summary label="Quantity" value={String(selectedCard.quantity)} />
                      <Summary label="Value" value={showValues ? money(selectedCard.value) : "Hidden"} accent={showValues} />
                    </div>
                    <p className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[9px] leading-5 text-slate-500">
                      Page {selectedCard.binderPage ?? "—"} · Pocket {selectedCard.binderSlot ?? "—"}
                    </p>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
                    <Sparkles className="h-7 w-7 text-slate-700" />
                    <p className="mt-4 text-sm font-semibold text-slate-400">Select a card</p>
                    <p className="mt-2 text-[10px] text-slate-700">Card details will appear here without covering the binder.</p>
                  </div>
                )}
              </aside>
            </div>
          )}

          {focusMode ? (
            <button onClick={() => setFocusMode(false)} className="absolute right-4 top-4 z-40 inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.10] bg-black/65 px-3 text-[10px] font-semibold text-white backdrop-blur"><List className="h-4 w-4" /> Exit focus</button>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function PortfolioPage({
  binder,
  page,
  selectedCardId,
  onSelect,
  showValues,
  side,
}: {
  binder: PortfolioBinderView;
  page: number;
  selectedCardId: string;
  onSelect: (id: string) => void;
  showValues: boolean;
  side: "left" | "right" | "single";
}) {
  const columns = binder.location.binderColumns ?? 3;
  const rows = binder.location.binderRows ?? 3;
  const count = columns * rows;
  const cards = binder.cards
    .filter((card) => card.binderPage === page)
    .sort((a, b) => (a.binderSlot ?? "").localeCompare(b.binderSlot ?? ""));

  return (
    <article className={`relative flex min-h-[620px] flex-col overflow-hidden rounded-[26px] border border-violet-300/[0.15] bg-[radial-gradient(circle_at_top,rgba(139,92,246,.13),transparent_36%),linear-gradient(145deg,#171126,#0b151f_55%,#101121)] p-4 shadow-[inset_0_0_90px_rgba(0,0,0,.32),0_24px_70px_rgba(0,0,0,.36)] ${side === "left" ? "lg:rounded-r-[18px]" : side === "right" ? "lg:rounded-l-[18px]" : ""}`}>
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/45 to-transparent" />
      <div className="mb-4 flex items-center justify-between">
        <div><p className="text-[8px] font-bold uppercase tracking-[0.17em] text-violet-200">Physical page</p><p className="mt-1 text-sm font-semibold text-white">Page {page}</p></div>
        <span className="rounded-lg border border-white/[0.07] bg-black/15 px-2 py-1 text-[8px] text-slate-600">{cards.length}/{count}</span>
      </div>
      <div className="grid flex-1 gap-2.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: count }, (_, index) => {
          const card = cards[index];
          return (
            <button key={card?.id ?? index} onClick={() => card && onSelect(card.id)} className={`group relative min-h-0 overflow-hidden rounded-xl border bg-black/25 text-left transition duration-300 ${card?.id === selectedCardId ? "border-cyan-200 shadow-[0_0_0_3px_rgba(34,211,238,.10),0_0_28px_rgba(34,211,238,.13)]" : "border-white/[0.07] hover:-translate-y-1 hover:border-violet-300/35"}`}>
              {card?.imageUrl ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" /> : <span className="flex h-full min-h-[150px] items-center justify-center text-slate-800"><BookOpen className="h-5 w-5" /></span>}
              {card && showValues ? <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-1 text-[7px] font-semibold text-emerald-300 backdrop-blur">{money(card.value)}</span> : null}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function Gallery({
  pages,
  onOpen,
  showValues,
}: {
  pages: Array<{ page: number; cards: PortfolioBinderView["cards"]; value: number }>;
  onOpen: (page: number) => void;
  showValues: boolean;
}) {
  return (
    <div className="p-5 sm:p-7">
      <div><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-cyan-300">Binder gallery</p><h2 className="mt-2 text-2xl font-semibold text-white">Jump to any page.</h2></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pages.map((summary) => (
          <button key={summary.page} onClick={() => onOpen(summary.page)} className="group rounded-[22px] border border-white/[0.08] bg-black/15 p-3 text-left transition hover:-translate-y-1 hover:border-violet-300/30">
            <div className="grid aspect-[1.4] grid-cols-3 gap-1.5 overflow-hidden rounded-[15px] bg-[linear-gradient(145deg,#171126,#0b151f)] p-2">
              {Array.from({ length: 9 }, (_, index) => {
                const card = summary.cards[index];
                return <div key={card?.id ?? index} className="overflow-hidden rounded border border-white/[0.05] bg-black/25">{card?.imageUrl ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" /> : null}</div>;
              })}
            </div>
            <div className="mt-3 flex items-center justify-between"><div><p className="text-[11px] font-semibold text-white">Page {summary.page}</p><p className="mt-1 text-[9px] text-slate-600">{summary.cards.length} cards</p></div>{showValues ? <span className="text-[10px] font-semibold text-emerald-300">{money(summary.value)}</span> : null}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ViewButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof BookOpen; label: string }) {
  return <button onClick={onClick} className={`inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-[9px] font-semibold transition ${active ? "bg-violet-300 text-[#18092b]" : "text-slate-600 hover:text-white"}`}><Icon className="h-3.5 w-3.5" /> {label}</button>;
}

function Summary({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3"><p className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-700">{label}</p><p className={`mt-1 text-sm font-semibold ${accent ? "text-emerald-300" : "text-white"}`}>{value}</p></div>;
}

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 1000 ? 0 : 2 });
}
