"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Eye,
  Globe2,
  Layers3,
  LibraryBig,
  Link2,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import type {
  CollectorProfile,
  PortfolioBinderView,
} from "@/lib/collector-portfolio";
import { sanitizeUsername } from "@/lib/collector-portfolio";

type PortfolioData = {
  userId: string;
  email: string;
  profile: CollectorProfile;
  binders: PortfolioBinderView[];
  featuredCards: Array<Record<string, unknown>>;
  tradeStatuses: Array<Record<string, unknown>>;
  totals: {
    cards: number;
    uniqueCards: number;
    value: number;
    binders: number;
    tradeCards: number;
  };
};

type PortfolioTab = "home" | "bookshelf" | "showcase" | "trade" | "highlights" | "settings";

const TABS: Array<{ id: PortfolioTab; label: string; icon: typeof BookOpen }> = [
  { id: "home", label: "Overview", icon: Sparkles },
  { id: "bookshelf", label: "Binders", icon: LibraryBig },
  { id: "showcase", label: "Showcase", icon: Share2 },
  { id: "trade", label: "Trades", icon: MessageCircle },
  { id: "settings", label: "Settings", icon: Settings },
];

export function CollectorPortfolioWorkspace({ initialData }: { initialData: PortfolioData }) {
  const [tab, setTab] = useState<PortfolioTab>(() => {
    if (typeof window === "undefined") return "home";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return requested === "showcase" || requested === "bookshelf" || requested === "trade" || requested === "highlights" || requested === "settings" ? requested : "home";
  });
  const [profile, setProfile] = useState(initialData.profile);
  const [binders, setBinders] = useState(initialData.binders);
  const [selectedBinderId, setSelectedBinderId] = useState(initialData.binders[0]?.id ?? "");
  const [studioOpen, setStudioOpen] = useState(false);
  const [editingBinder, setEditingBinder] = useState<PortfolioBinderView | null>(null);
  const [status, setStatus] = useState("");

  const featuredBinder = useMemo(
    () => binders.find((binder) => binder.is_featured) ?? binders[0],
    [binders],
  );
  const selectedBinder = binders.find((binder) => binder.id === selectedBinderId) ?? featuredBinder;

  async function saveProfile(next: CollectorProfile) {
    setStatus("Saving portfolio…");
    const response = await fetch("/api/collector-portfolio/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const result = (await response.json().catch(() => null)) as { profile?: CollectorProfile; error?: string } | null;
    if (!response.ok || !result?.profile) {
      setStatus(result?.error || "Portfolio settings could not be saved.");
      return;
    }
    setProfile(result.profile);
    setStatus("Portfolio saved.");
  }

  async function saveBinder(next: PortfolioBinderView) {
    setStatus("Saving binder presentation…");
    const response = await fetch("/api/collector-portfolio/binders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const result = (await response.json().catch(() => null)) as { binder?: PortfolioBinderView; error?: string } | null;
    if (!response.ok || !result?.binder) {
      setStatus(result?.error || "Binder presentation could not be saved.");
      return;
    }
    setBinders((current) =>
      current.map((binder) =>
        binder.location_id === result.binder!.location_id
          ? { ...binder, ...result.binder }
          : { ...binder, is_featured: result.binder!.is_featured ? false : binder.is_featured },
      ),
    );
    setEditingBinder(null);
    setStatus("Binder presentation saved.");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.10),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,211,238,.07),transparent_32%),#020911] px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1620px]">
        <section className="relative overflow-hidden rounded-[24px] border border-white/[0.09] bg-[linear-gradient(120deg,#0a1a27,#07131d_62%,#101326)] shadow-[0_24px_80px_rgba(0,0,0,.35)]">
          <div className="pointer-events-none absolute right-0 top-0 h-52 w-80 bg-cyan-400/[0.055] blur-[90px]" />
          <div className="relative flex flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] text-lg font-bold text-cyan-200">
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile.display_name || profile.username || "C").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-2xl font-semibold tracking-[-0.04em]">{profile.display_name || "Your collection"}</h1><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] ${profile.is_public ? "bg-emerald-300/[0.08] text-emerald-300" : "bg-white/[0.05] text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${profile.is_public ? "bg-emerald-300" : "bg-slate-600"}`} />{profile.is_public ? "Public" : "Private"}</span></div>
                <p className="mt-1 truncate text-[10px] font-semibold text-cyan-200/60">@{profile.username || "collector"}{profile.location ? ` · ${profile.location}` : ""}</p>
                <p className="mt-1 max-w-xl truncate text-[11px] text-slate-500">{profile.bio || "A curated collection of favorites, trade pieces, and cards worth sharing."}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="grid grid-cols-4 gap-5 border-y border-white/[0.07] py-3 sm:border-y-0 sm:border-r sm:py-0 sm:pr-5">
                <CompactMetric label="Value" value={money(initialData.totals.value)} accent />
                <CompactMetric label="Cards" value={initialData.totals.cards.toLocaleString()} />
                <CompactMetric label="Binders" value={String(initialData.totals.binders)} />
                <CompactMetric label="Trade" value={String(initialData.totals.tradeCards)} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStudioOpen(true)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-[11px] font-bold text-[#031319] transition hover:bg-cyan-200 sm:flex-none"><Share2 className="h-4 w-4" /> Share</button>
                {profile.is_public ? <Link href={`/collectors/${profile.username}`} target="_blank" title="Preview public profile" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-slate-300 hover:text-white"><Eye className="h-4 w-4" /></Link> : null}
                <button onClick={() => setTab("settings")} title="Portfolio settings" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03] text-slate-300 hover:text-white"><Settings className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </section>

        <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-white/[0.08] px-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`relative inline-flex h-11 shrink-0 items-center gap-2 px-3.5 text-[11px] font-semibold transition ${tab === id ? "text-cyan-200 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-cyan-300" : "text-slate-500 hover:text-white"}`}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {status ? <div className="mt-4 rounded-xl border border-cyan-300/[0.12] bg-cyan-300/[0.035] px-4 py-3 text-[10px] font-semibold text-cyan-100">{status}</div> : null}

        <div className="mt-5">
          {tab === "home" ? (
            <PortfolioHome
              profile={profile}
              featuredBinder={featuredBinder}
              binders={binders}
              totals={initialData.totals}
              onOpenBinder={(binder) => { window.location.href = `/dashboard/collector-portfolio/binder/${binder.location_id}`; }}
              onShare={() => setStudioOpen(true)}
            />
          ) : null}

          {tab === "bookshelf" ? (
            <Bookshelf binders={binders} onOpen={(binder) => { window.location.href = `/dashboard/collector-portfolio/binder/${binder.location_id}`; }} onEdit={setEditingBinder} onShare={(binder) => { setSelectedBinderId(binder.id); setStudioOpen(true); }} />
          ) : null}

          {tab === "showcase" ? (
            <ShowcaseOverview binders={binders} selectedBinder={selectedBinder} onSelect={setSelectedBinderId} onOpen={() => setStudioOpen(true)} />
          ) : null}

          {tab === "trade" ? <TradeCenter binders={binders} tradeCount={initialData.totals.tradeCards} /> : null}
          {tab === "highlights" ? <Highlights binders={binders} /> : null}
          {tab === "settings" ? <PortfolioSettings profile={profile} onSave={saveProfile} /> : null}
        </div>
      </div>

      {studioOpen ? <PortfolioShowcaseStudio profile={profile} binders={binders} selectedBinder={selectedBinder} onClose={() => setStudioOpen(false)} /> : null}
      {editingBinder ? <BinderPresentationEditor binder={editingBinder} onClose={() => setEditingBinder(null)} onSave={saveBinder} /> : null}
    </main>
  );
}

function PortfolioHome({ featuredBinder, binders, totals, onOpenBinder, onShare }: {
  profile: CollectorProfile;
  featuredBinder?: PortfolioBinderView;
  binders: PortfolioBinderView[];
  totals: PortfolioData["totals"];
  onOpenBinder: (binder: PortfolioBinderView) => void;
  onShare: () => void;
}) {
  const recentCards = binders.flatMap((binder) => binder.cards.map((card) => ({ ...card, binderId: binder.id }))).slice(0, 10);
  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-white/[0.08] bg-[#06131d]/88 p-5 shadow-[0_22px_70px_rgba(0,0,0,.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-cyan-300">Your collection</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-white">Binders</h2></div>
          <div className="flex gap-2"><button onClick={onShare} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.09] px-3 text-[10px] font-semibold text-slate-300 hover:text-white"><Share2 className="h-3.5 w-3.5" /> Share collection</button><Link href="/dashboard/inventory" className="inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-300 px-3 text-[10px] font-bold text-[#031319]"><Plus className="h-3.5 w-3.5" /> New binder</Link></div>
        </div>
        {binders.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{binders.slice(0, 7).map((binder) => <button key={binder.id} onClick={() => onOpenBinder(binder)} className="group flex min-h-[142px] overflow-hidden rounded-[20px] border border-white/[0.075] bg-black/15 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.025]"><div className="relative w-[104px] shrink-0 overflow-hidden" style={{ background: `linear-gradient(145deg,${binder.cover_color},#020617)` }}>{binder.cards.filter((card) => card.imageUrl).slice(0, 3).map((card, index) => <img key={card.id} src={card.imageUrl} alt="" className="absolute top-7 h-[78px] w-[56px] rounded-md border border-white/10 object-cover shadow-xl" style={{ left: `${12 + index * 16}px`, zIndex: index }} />)}</div><div className="flex min-w-0 flex-1 flex-col justify-between p-4"><div><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-white">{binder.title}</p>{binder.is_featured ? <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> : null}</div><p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-600">{binder.description || "Organized collection binder"}</p></div><div className="flex items-end justify-between"><div><p className="text-[13px] font-semibold text-emerald-300">{money(binder.estimatedValue)}</p><p className="mt-0.5 text-[8px] uppercase tracking-[0.1em] text-slate-600">{binder.cardCount} cards · {binder.pageCount} pages</p></div><ChevronRight className="h-4 w-4 text-slate-700 transition group-hover:translate-x-1 group-hover:text-cyan-300" /></div></div></button>)}</div> : <EmptyPanel title="Start your first binder" body="Organize cards from Inventory into a collection you can browse and share." />}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="rounded-[24px] border border-white/[0.08] bg-[#06131d]/82 p-5">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-violet-300">Latest cards</p><h2 className="mt-1 text-base font-semibold text-white">Recently added</h2></div><span className="text-[9px] text-slate-600">{recentCards.length} shown</span></div>
          {recentCards.length ? <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">{recentCards.map((card) => <button key={card.id} onClick={() => { const binder = binders.find((entry) => entry.id === card.binderId); if (binder) onOpenBinder(binder); }} title={card.name} className="group/card relative aspect-[.716] overflow-hidden rounded-lg border border-white/[0.08] bg-black/25 transition hover:-translate-y-1 hover:border-cyan-300/30">{card.imageUrl ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-1 text-center text-[7px] text-slate-600">{card.name}</span>}</button>)}</div> : <p className="mt-4 text-[10px] text-slate-600">Cards added to binders will appear here.</p>}
        </section>
        <section className="rounded-[24px] border border-emerald-300/[0.11] bg-[linear-gradient(145deg,#07191a,#06131d)] p-5">
          <div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-emerald-300">Collection health</p><span className="rounded-full bg-emerald-300/[0.08] px-2 py-1 text-[8px] font-semibold text-emerald-300">Live</span></div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{money(totals.value)}</p><p className="mt-1 text-[10px] text-slate-600">Current market value</p>
          <div className="mt-4 grid grid-cols-3 gap-2"><MiniMetric label="Unique" value={String(totals.uniqueCards)} /><MiniMetric label="Binders" value={String(totals.binders)} /><MiniMetric label="Trade" value={String(totals.tradeCards)} accent /></div>
          {featuredBinder ? <button onClick={() => onOpenBinder(featuredBinder)} className="mt-4 flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-black/15 p-3 text-left"><span><span className="block text-[8px] uppercase tracking-[0.12em] text-slate-600">Featured binder</span><span className="mt-1 block text-[11px] font-semibold text-white">{featuredBinder.title}</span></span><ChevronRight className="h-4 w-4 text-slate-600" /></button> : null}
        </section>
      </div>
    </div>
  );
}

function Bookshelf({ binders, onOpen, onEdit, onShare }: { binders: PortfolioBinderView[]; onOpen: (binder: PortfolioBinderView) => void; onEdit: (binder: PortfolioBinderView) => void; onShare: (binder: PortfolioBinderView) => void }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"custom" | "value" | "cards">("custom");
  const filtered = binders.filter((binder) => `${binder.title} ${binder.description}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "value" ? b.estimatedValue - a.estimatedValue : sort === "cards" ? b.cardCount - a.cardCount : a.portfolio_order - b.portfolio_order);
  return (
    <section className="rounded-[28px] border border-white/[0.075] bg-[#05111b]/90 p-5 shadow-[0_28px_85px_rgba(0,0,0,.28)] sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-300">Digital bookshelf</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">Every binder has a story.</h2><p className="mt-2 text-sm text-slate-500">Customize covers, publish selected binders, and create trade-ready collections.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row"><label className="flex h-11 min-w-[250px] items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3"><Search className="h-4 w-4 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search binders…" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-700" /></label><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort binders" className="h-11 rounded-xl border border-white/[0.08] bg-[#07131d] px-3 text-[10px] font-semibold text-slate-300 outline-none"><option value="custom">Custom order</option><option value="value">Highest value</option><option value="cards">Most cards</option></select></div>
      </div>
      {filtered.length ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((binder) => (
            <article key={binder.id} className="group">
              <button onClick={() => onOpen(binder)} className="block w-full text-left"><BinderCover binder={binder} /></button>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-white">{binder.title}</p>{binder.is_featured ? <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" /> : null}</div><p className="mt-1 text-[10px] text-slate-600">{binder.cardCount} cards · {money(binder.estimatedValue)}</p></div>
                <div className="flex gap-1"><IconButton label="Share" onClick={() => onShare(binder)}><Share2 className="h-3.5 w-3.5" /></IconButton><IconButton label="Edit cover" onClick={() => onEdit(binder)}><Settings className="h-3.5 w-3.5" /></IconButton></div>
              </div>
            </article>
          ))}
          {!query ? <Link href="/dashboard/inventory" className="flex min-h-[300px] flex-col items-center justify-center rounded-[22px] border border-dashed border-cyan-300/15 bg-cyan-300/[0.018] text-center transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.035]"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/[0.08] text-cyan-200"><Plus className="h-5 w-5" /></span><span className="mt-4 text-sm font-semibold text-white">Create new binder</span><span className="mt-1 text-[9px] text-slate-600">Organize cards from Inventory</span></Link> : null}
        </div>
      ) : <EmptyPanel title="No binders found" body="Try a different search or create a binder in Inventory." />}
    </section>
  );
}

function ShowcaseOverview({ binders, selectedBinder, onSelect, onOpen }: { binders: PortfolioBinderView[]; selectedBinder?: PortfolioBinderView; onSelect: (id: string) => void; onOpen: () => void }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[330px_1fr]">
      <aside className="rounded-[26px] border border-white/[0.075] bg-[#06131d]/88 p-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-violet-300">Choose a binder</p>
        <div className="mt-4 space-y-2">{binders.map((binder) => <button key={binder.id} onClick={() => onSelect(binder.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selectedBinder?.id === binder.id ? "border-cyan-300/25 bg-cyan-300/[0.06]" : "border-white/[0.06] bg-black/10 hover:border-white/[0.12]"}`}><div className="h-12 w-9 rounded-md" style={{ background: `linear-gradient(145deg,${binder.cover_color},#020617)` }} /><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-white">{binder.title}</p><p className="mt-1 text-[9px] text-slate-600">{binder.cardCount} cards</p></div></button>)}</div>
      </aside>
      <div className="rounded-[28px] border border-violet-300/[0.14] bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.14),transparent_34%),#06131d] p-6 sm:p-8">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-300">Showcase Studio</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Share the exact story you want.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Publish a current page, full spread, entire binder, featured-card gallery, or complete portfolio. Choose public, unlisted, or private-link visibility.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ScopeCard title="Current page" detail="One focused 3×3 page" />
          <ScopeCard title="Full spread" detail="Left and right pages together" />
          <ScopeCard title="Entire binder" detail="Interactive public flipbook" />
          <ScopeCard title="Full portfolio" detail="Profile, shelf, and highlights" />
        </div>
        <button onClick={onOpen} className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-violet-300 px-4 text-xs font-bold text-[#18092b] transition hover:bg-violet-200"><Share2 className="h-4 w-4" /> Open Showcase Studio</button>
      </div>
    </section>
  );
}

function TradeCenter({ binders, tradeCount }: { binders: PortfolioBinderView[]; tradeCount: number }) {
  const tradeBinders = binders.filter((binder) => binder.is_trade_binder);
  return <div className="grid gap-5 xl:grid-cols-[1fr_360px]"><section className="rounded-[28px] border border-emerald-300/[0.12] bg-[linear-gradient(145deg,#071a1b,#06131d)] p-6"><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-emerald-300">Trade Center</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Turn collection browsing into conversations.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Mark cards Available, Reserved, Pending, For Sale, or Looking for Upgrade. Visitors can build an interested list without accessing private inventory data.</p><div className="mt-7 grid gap-3 sm:grid-cols-3"><MiniMetric label="Available cards" value={String(tradeCount)} accent /><MiniMetric label="Trade binders" value={String(tradeBinders.length)} /><MiniMetric label="New requests" value="0" /></div></section><section className="rounded-[26px] border border-white/[0.075] bg-[#06131d]/88 p-5"><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-violet-300">Trade inbox</p><div className="mt-5 rounded-2xl border border-dashed border-white/[0.10] p-6 text-center"><MessageCircle className="mx-auto h-6 w-6 text-slate-700" /><p className="mt-3 text-sm font-semibold text-slate-300">No trade requests yet</p><p className="mt-2 text-[10px] leading-5 text-slate-600">Publish a trade binder to start receiving interest.</p></div></section></div>;
}

function Highlights({ binders }: { binders: PortfolioBinderView[] }) {
  const allCards = binders.flatMap((binder) => binder.cards.map((card) => ({ ...card, binder: binder.title })));
  const topCards = [...allCards].sort((a, b) => b.value - a.value).slice(0, 8);
  const mostValuable = [...binders].sort((a, b) => b.estimatedValue - a.estimatedValue)[0];
  return <section className="rounded-[28px] border border-white/[0.075] bg-[#05111b]/90 p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300">Collection highlights</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">The cards that define your collection.</h2></div>{mostValuable ? <span className="rounded-full border border-violet-300/[0.16] bg-violet-400/[0.05] px-3 py-2 text-[10px] text-violet-100">Most valuable binder: {mostValuable.title}</span> : null}</div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{topCards.map((card) => <article key={card.id} className="group overflow-hidden rounded-[20px] border border-white/[0.08] bg-black/20 p-2 transition hover:-translate-y-1 hover:border-violet-300/25">{card.imageUrl ? <img src={card.imageUrl} alt={card.name} className="aspect-[.716] w-full rounded-[14px] object-cover" /> : <div className="flex aspect-[.716] items-center justify-center rounded-[14px] bg-white/[0.03]"><Star className="h-8 w-8 text-slate-700" /></div>}<div className="p-3"><p className="truncate text-sm font-semibold text-white">{card.name}</p><p className="mt-1 text-[9px] text-slate-600">{card.binder}</p><p className="mt-3 text-[10px] font-semibold text-emerald-300">{money(card.value)}</p></div></article>)}</div></section>;
}

function PortfolioSettings({ profile, onSave }: { profile: CollectorProfile; onSave: (profile: CollectorProfile) => void }) {
  const [draft, setDraft] = useState(profile);
  return <section className="grid gap-5 xl:grid-cols-[1fr_420px]"><div className="rounded-[28px] border border-white/[0.075] bg-[#06131d]/90 p-6"><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-cyan-300">Portfolio identity</p><h2 className="mt-2 text-2xl font-semibold text-white">Claim your collector presence.</h2><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Display name"><input value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} className="portfolio-input" /></Field><Field label="Username"><div className="flex items-center rounded-xl border border-white/[0.08] bg-black/20"><span className="pl-3 text-[10px] text-slate-700">/collectors/</span><input value={draft.username} onChange={(e) => setDraft({ ...draft, username: sanitizeUsername(e.target.value) })} className="min-w-0 flex-1 bg-transparent px-2 py-3 text-xs text-white outline-none" /></div></Field><Field label="Bio" wide><textarea value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} rows={4} className="portfolio-input resize-none" /></Field><Field label="Location"><input value={draft.location ?? ""} onChange={(e) => setDraft({ ...draft, location: e.target.value })} className="portfolio-input" /></Field><Field label="Theme"><select value={draft.theme} onChange={(e) => setDraft({ ...draft, theme: e.target.value })} className="portfolio-input"><option value="aurora">Aurora</option><option value="museum">Museum</option><option value="midnight">Midnight</option><option value="collector">Collector</option></select></Field></div><button onClick={() => void onSave(draft)} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-[#031319]"><Check className="h-4 w-4" /> Save portfolio</button></div><div className="space-y-4"><ToggleCard title="Public profile" detail="Allow visitors to browse approved portfolio content." checked={draft.is_public} onChange={(checked) => setDraft({ ...draft, is_public: checked })} /><ToggleCard title="Show collection value" detail="Display portfolio and binder value totals publicly." checked={draft.show_collection_value} onChange={(checked) => setDraft({ ...draft, show_collection_value: checked })} /><ToggleCard title="Show location" detail="Display the location entered on your public profile." checked={draft.show_location} onChange={(checked) => setDraft({ ...draft, show_location: checked })} /><div className="rounded-[24px] border border-amber-300/[0.12] bg-amber-400/[0.035] p-5"><LockKeyhole className="h-5 w-5 text-amber-300" /><p className="mt-3 text-sm font-semibold text-amber-100">Private data stays private</p><p className="mt-2 text-[10px] leading-5 text-amber-100/55">Purchase price, cost basis, private notes, marketplace credentials, internal IDs, and non-binder storage locations are never included in public portfolio payloads.</p></div></div></section>;
}

function PortfolioShowcaseStudio({ profile, binders, selectedBinder, onClose }: { profile: CollectorProfile; binders: PortfolioBinderView[]; selectedBinder?: PortfolioBinderView; onClose: () => void }) {
  const [scope, setScope] = useState<"page" | "spread" | "binder" | "portfolio">("spread");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("unlisted");
  const [page, setPage] = useState(1);
  const [shareUrl, setShareUrl] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const binder = selectedBinder ?? binders[0];

  async function generate() {
    if (!binder && scope !== "portfolio") return;
    setWorking(true); setMessage("");
    const response = await fetch("/api/collector-portfolio/shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, visibility, page, binderLocationId: binder?.location_id ?? null }) });
    const result = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !result?.url) { setMessage(result?.error || "Share could not be generated."); setWorking(false); return; }
    setShareUrl(result.url);
    await navigator.clipboard.writeText(result.url);
    setMessage("Share link generated and copied.");
    setWorking(false);
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#01070c]/84 p-4 backdrop-blur-xl" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="grid max-h-[94dvh] w-full max-w-[1220px] overflow-hidden rounded-[30px] border border-violet-300/[0.18] bg-[#06131d] shadow-[0_40px_150px_rgba(0,0,0,.78)] lg:grid-cols-[.92fr_1.08fr]"><div className="min-h-0 overflow-y-auto p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-300">Showcase Studio</p><h2 className="mt-2 text-2xl font-semibold text-white">Choose the story to share.</h2></div><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></div><div className="mt-6 grid grid-cols-2 gap-2">{(["page","spread","binder","portfolio"] as const).map((value) => <button key={value} onClick={() => setScope(value)} className={`rounded-2xl border p-4 text-left transition ${scope === value ? "border-cyan-300/30 bg-cyan-300/[0.07]" : "border-white/[0.07] bg-black/10 hover:border-white/[0.13]"}`}><p className="text-[11px] font-semibold capitalize text-white">{value === "spread" ? "Full spread" : value === "binder" ? "Entire binder" : value === "portfolio" ? "Full portfolio" : "Current page"}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{scopeDescription(value)}</p></button>)}</div>{scope === "page" || scope === "spread" ? <Field label="Starting page"><input type="number" min={1} max={binder?.pageCount ?? 20} value={page} onChange={(e) => setPage(Math.max(1, Number(e.target.value)))} className="portfolio-input" /></Field> : null}<div className="mt-5"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">Visibility</p><div className="mt-2 grid grid-cols-3 gap-2">{(["public","unlisted","private"] as const).map((value) => <button key={value} onClick={() => setVisibility(value)} className={`rounded-xl border px-3 py-3 text-[9px] font-semibold capitalize ${visibility === value ? "border-violet-300/30 bg-violet-400/[0.08] text-violet-100" : "border-white/[0.07] text-slate-600"}`}>{value}</button>)}</div></div><button onClick={() => void generate()} disabled={working} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-bold text-[#031319] disabled:opacity-60">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Generate share link</button>{shareUrl ? <div className="mt-4 rounded-xl border border-emerald-300/[0.14] bg-emerald-400/[0.04] p-4"><p className="break-all text-[9px] leading-5 text-emerald-200/70">{shareUrl}</p><button onClick={() => void navigator.clipboard.writeText(shareUrl)} className="mt-3 inline-flex items-center gap-2 text-[9px] font-semibold text-emerald-200"><Copy className="h-3.5 w-3.5" /> Copy again</button></div> : null}{message ? <p className="mt-4 text-[9px] font-semibold text-cyan-200">{message}</p> : null}</div><div className="relative min-h-[620px] overflow-hidden border-t border-white/[0.07] bg-[radial-gradient(circle_at_top,rgba(139,92,246,.18),transparent_38%),linear-gradient(160deg,#0b1b2a,#08111e_55%,#150b24)] p-6 lg:border-l lg:border-t-0"><div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/[0.12] blur-3xl" /><div className="relative"><p className="text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">Live public preview</p><h3 className="mt-2 text-3xl font-semibold text-white">{scope === "portfolio" ? profile.display_name : binder?.title ?? "Binder showcase"}</h3><p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-violet-200">{scope === "spread" ? `Pages ${page}–${page + 1}` : scope}</p><div className={`mt-7 grid gap-3 ${scope === "spread" ? "grid-cols-2" : "grid-cols-1 max-w-[420px] mx-auto"}`}>{scope === "portfolio" ? binders.slice(0, 4).map((entry) => <BinderCover key={entry.id} binder={entry} />) : Array.from({ length: scope === "spread" ? 2 : 1 }, (_, pageOffset) => <PublicPagePreview key={pageOffset} binder={binder} page={page + pageOffset} />)}</div></div></div></section></div>;
}

function BinderPresentationEditor({ binder, onClose, onSave }: { binder: PortfolioBinderView; onClose: () => void; onSave: (binder: PortfolioBinderView) => void }) {
  const [draft, setDraft] = useState(binder);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#01070c]/84 p-4 backdrop-blur-xl" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="w-full max-w-[780px] rounded-[28px] border border-violet-300/[0.16] bg-[#07131d] p-6 shadow-[0_38px_130px_rgba(0,0,0,.75)]"><div className="flex items-start justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-violet-300">Binder presentation</p><h2 className="mt-2 text-2xl font-semibold text-white">Design the cover collectors remember.</h2></div><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] text-slate-500"><X className="h-4 w-4" /></button></div><div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]"><BinderCover binder={draft} large /><div className="space-y-4"><Field label="Binder title"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="portfolio-input" /></Field><Field label="Description"><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="portfolio-input resize-none" rows={3} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Cover color"><input type="color" value={draft.cover_color} onChange={(e) => setDraft({ ...draft, cover_color: e.target.value })} className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 p-1" /></Field><Field label="Accent color"><input type="color" value={draft.accent_color} onChange={(e) => setDraft({ ...draft, accent_color: e.target.value })} className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 p-1" /></Field></div><Field label="Visibility"><select value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value as PortfolioBinderView["visibility"] })} className="portfolio-input"><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></Field><ToggleCard compact title="Featured binder" detail="Place this binder at the center of your portfolio." checked={draft.is_featured} onChange={(checked) => setDraft({ ...draft, is_featured: checked })} /><ToggleCard compact title="Trade binder" detail="Enable trade availability and interested lists." checked={draft.is_trade_binder} onChange={(checked) => setDraft({ ...draft, is_trade_binder: checked })} /><button onClick={() => void onSave(draft)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-300 text-xs font-bold text-[#18092b]"><Check className="h-4 w-4" /> Save binder presentation</button></div></div></section></div>;
}

function BinderCover({ binder, large = false }: { binder: PortfolioBinderView; large?: boolean }) {
  const previewCards = binder.cards.filter((card) => card.imageUrl).slice(0, 6);
  return <div className={`group/cover relative overflow-hidden rounded-[22px] border border-white/[0.12] shadow-[0_24px_60px_rgba(0,0,0,.38)] transition duration-300 hover:-translate-y-1 ${large ? "aspect-[.78] w-full max-w-[300px]" : "aspect-[.78] w-full"}`} style={{ background: `radial-gradient(circle at 70% 10%, ${binder.accent_color}2e, transparent 34%), linear-gradient(145deg, ${binder.cover_color}, #020617)` }}><div className="absolute inset-y-0 left-0 z-20 w-5 bg-black/30 shadow-[8px_0_18px_rgba(0,0,0,.25)]" /><div className="absolute inset-x-7 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />{previewCards.length ? <div className="absolute inset-x-7 top-[21%] grid grid-cols-3 gap-1.5 opacity-90">{previewCards.map((card) => <div key={card.id} className="aspect-[.716] overflow-hidden rounded-md border border-white/10 bg-black/30 shadow-lg"><img src={card.imageUrl} alt="" className="h-full w-full object-cover" /></div>)}</div> : null}<div className="absolute inset-x-0 bottom-0 z-10 h-[48%] bg-gradient-to-t from-black via-black/80 to-transparent" /><div className="absolute inset-0 z-20 flex flex-col justify-between p-5"><div className="flex items-center justify-between"><span className="rounded-full border border-white/[0.13] bg-black/45 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur">{binder.is_trade_binder ? "Trade Binder" : "Collector Vault"}</span>{binder.visibility === "private" ? <LockKeyhole className="h-4 w-4 text-white/55" /> : <Globe2 className="h-4 w-4 text-white/65" />}</div><div><div className="mb-3 h-px w-12" style={{ backgroundColor: binder.accent_color }} /><p className={`${large ? "text-2xl" : "text-lg"} font-semibold leading-tight tracking-[-0.035em] text-white`}>{binder.title}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/50"><span>{binder.cardCount} cards</span><span>{money(binder.estimatedValue)}</span>{binder.is_trade_binder ? <span className="text-emerald-300/80">Trade ready</span> : null}</div></div></div><div className="pointer-events-none absolute -left-1/2 top-0 z-30 h-full w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 blur-sm transition duration-700 group-hover/cover:left-[120%] group-hover/cover:opacity-100" /></div>;
}

function PublicPagePreview({ binder, page }: { binder?: PortfolioBinderView; page: number }) {
  const cards = binder?.cards.filter((card) => card.binderPage === page).slice(0, 9) ?? [];
  return <div className="rounded-[22px] border border-white/[0.10] bg-[linear-gradient(145deg,#171126,#0b151f)] p-3 shadow-[0_22px_55px_rgba(0,0,0,.34)]"><div className="mb-3 flex items-center justify-between"><span className="text-[8px] font-bold uppercase tracking-[0.15em] text-violet-200">Page {page}</span><span className="text-[8px] text-slate-700">{cards.length}/9</span></div><div className="grid grid-cols-3 gap-2">{Array.from({ length: 9 }, (_, index) => { const card = cards[index]; return <div key={card?.id ?? index} className="aspect-[.716] overflow-hidden rounded-lg border border-white/[0.07] bg-black/25">{card?.imageUrl ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" /> : null}</div>; })}</div></div>;
}

function CompactMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="min-w-0"><p className={`truncate text-sm font-semibold ${accent ? "text-emerald-300" : "text-white"}`}>{value}</p><p className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-slate-600">{label}</p></div>; }
function MiniMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3"><p className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-700">{label}</p><p className={`mt-1 text-sm font-semibold ${accent ? "text-emerald-300" : "text-white"}`}>{value}</p></div>; }
function ScopeCard({ title, detail }: { title: string; detail: string }) { return <div className="rounded-2xl border border-white/[0.075] bg-black/10 p-4"><Layers3 className="h-5 w-5 text-violet-300" /><p className="mt-4 text-[11px] font-semibold text-white">{title}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{detail}</p></div>; }
function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button title={label} aria-label={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-slate-600 transition hover:border-cyan-300/20 hover:text-cyan-200">{children}</button>; }
function EmptyPanel({ title, body }: { title: string; body: string }) { return <div className="rounded-[26px] border border-dashed border-white/[0.10] bg-white/[0.018] p-12 text-center"><LibraryBig className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-4 text-lg font-semibold text-slate-300">{title}</p><p className="mt-2 text-[11px] text-slate-600">{body}</p><Link href="/dashboard/inventory" className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[10px] font-bold text-[#031319]"><Plus className="h-4 w-4" /> Open Inventory</Link></div>; }
function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-600">{label}</span>{children}</label>; }
function ToggleCard({ title, detail, checked, onChange, compact = false }: { title: string; detail: string; checked: boolean; onChange: (checked: boolean) => void; compact?: boolean }) { return <button type="button" onClick={() => onChange(!checked)} className={`flex w-full items-center gap-4 rounded-[20px] border text-left transition ${compact ? "p-3" : "p-5"} ${checked ? "border-emerald-300/[0.18] bg-emerald-400/[0.045]" : "border-white/[0.075] bg-[#06131d]/88"}`}><span className={`flex h-6 w-11 items-center rounded-full p-1 transition ${checked ? "justify-end bg-emerald-300" : "justify-start bg-slate-800"}`}><span className="h-4 w-4 rounded-full bg-white shadow" /></span><span><span className="block text-[11px] font-semibold text-white">{title}</span><span className="mt-1 block text-[9px] leading-4 text-slate-600">{detail}</span></span></button>; }
function money(value: number) { return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 1000 ? 0 : 2 }); }
function scopeDescription(scope: "page" | "spread" | "binder" | "portfolio") { return scope === "page" ? "One polished binder page." : scope === "spread" ? "Two facing pages together." : scope === "binder" ? "All pages in one public viewer." : "Profile, bookshelf, and featured binders."; }
