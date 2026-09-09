"use client";

import { ArrowRightLeft, Heart, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TDBadge, TDButton, TDCard, TDEmptyState, TDErrorState, TDInput, TDLoadingState, TDText } from "@/components/design-system/td-primitives";
import { displayCondition, displayFinish, displayPrinting, displayStorageLocation } from "@/lib/collector-workspace";
import {
  addWebWishlistItem,
  loadWebTradeBinderWishlist,
  removeWebWishlistItem,
  updateWebTradeStatus,
  updateWebWishlistPriority,
} from "@/lib/trade-binder-wishlist-client-data";
import {
  TRADE_STATUS_OPTIONS,
  WISHLIST_PRIORITY_OPTIONS,
  applyTradeStatusOptimistically,
  applyWishlistPriorityOptimistically,
  filterTradeBinderItems,
  filterWishlistItems,
  sortTradeBinderItems,
  sortWishlistItems,
  tradeStatusLabel,
  wishlistPriorityLabel,
  type TradeBinderItem,
  type TradeStatus,
  type WishlistItem,
  type WishlistPriority,
} from "@/lib/trade-binder-wishlist";

type State = Awaited<ReturnType<typeof loadWebTradeBinderWishlist>>;
type Tab = "binder" | "wishlist" | "matches";

export function TradeBinderWishlistWorkspace() {
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>("binder");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TradeStatus | "all">("all");
  const [priority, setPriority] = useState<WishlistPriority | "all">("all");
  const [cardName, setCardName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    void loadWebTradeBinderWishlist()
      .then((result) => {
        setState(result);
        setError(null);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Trade Binder and Wishlist are unavailable."))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const binderItems = useMemo(() => sortTradeBinderItems(filterTradeBinderItems(state?.tradeItems ?? [], { query, status }), "recent"), [query, state, status]);
  const wishlistItems = useMemo(() => sortWishlistItems(filterWishlistItems(state?.wishlistItems ?? [], state?.matches ?? [], { query, priority }), "priority"), [priority, query, state]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setPending(key);
    setError(null);
    try {
      await action();
      reload();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Trade Binder update failed.");
    } finally {
      setPending(null);
    }
  };

  const updateStatus = async (item: TradeBinderItem, nextStatus: TradeStatus) => {
    if (!state) return;
    const optimistic = applyTradeStatusOptimistically(state.tradeItems, item.id, nextStatus);
    setState({ ...state, tradeItems: optimistic.items });
    try {
      await updateWebTradeStatus(state.userId, item.id, nextStatus);
    } catch (actionError) {
      setState({ ...state, tradeItems: optimistic.previous });
      setError(actionError instanceof Error ? actionError.message : "Trade Binder update failed.");
    }
  };

  const updatePriority = async (item: WishlistItem, nextPriority: WishlistPriority) => {
    if (!state) return;
    const optimistic = applyWishlistPriorityOptimistically(state.wishlistItems, item.id, nextPriority);
    setState({ ...state, wishlistItems: optimistic.items });
    try {
      await updateWebWishlistPriority(state.userId, item.id, nextPriority);
    } catch (actionError) {
      setState({ ...state, wishlistItems: optimistic.previous });
      setError(actionError instanceof Error ? actionError.message : "Wishlist update failed.");
    }
  };

  if (loading) {
    return <TDCard variant="outlined"><TDLoadingState title="Loading Trade Binder" message="Checking available trades and wanted cards." /></TDCard>;
  }

  if (!state) {
    return <TDCard variant="outlined"><TDErrorState title="Trade Binder unavailable" message={error ?? "Trade Binder data could not be loaded."} action={<TDButton label="Retry" variant="secondary" onClick={reload} />} /></TDCard>;
  }

  return (
    <TDCard className="space-y-5" aria-labelledby="trade-binder-wishlist-title">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <TDText id="trade-binder-wishlist-title" as="h2" variant="title">Trade Binder and Wishlist</TDText>
          <TDText variant="small" tone="muted">See what to bring, what you want, and where your strongest self-contained matches are.</TDText>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Trade Binder views">
          <TabButton label="Binder" icon={<ArrowRightLeft className="h-4 w-4" />} active={tab === "binder"} onClick={() => setTab("binder")} />
          <TabButton label="Wishlist" icon={<Heart className="h-4 w-4" />} active={tab === "wishlist"} onClick={() => setTab("wishlist")} />
          <TabButton label="Matches" icon={<Star className="h-4 w-4" />} active={tab === "matches"} onClick={() => setTab("matches")} />
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Metric label="Binder cards" value={String(state.tradeSummary.totalBinderItems)} />
        <Metric label="Wishlist targets" value={String(state.wishlistSummary.totalWishlistItems)} />
        <Metric label="Strong matches" value={String(state.matches.length)} />
      </section>

      {error ? <TDErrorState title="Update failed" message={error} /> : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto]">
        <TDInput label="Search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Card, set, condition, finish, storage, notes..." />
        {tab === "binder" ? (
          <Select label="Status" value={status} onChange={(value) => setStatus(value as TradeStatus | "all")} options={["all", ...TRADE_STATUS_OPTIONS.filter((option) => option !== "not_for_trade")]} />
        ) : (
          <Select label="Priority" value={priority} onChange={(value) => setPriority(value as WishlistPriority | "all")} options={["all", ...WISHLIST_PRIORITY_OPTIONS]} />
        )}
      </div>

      {tab === "binder" ? (
        binderItems.length ? <div className="grid gap-3 lg:grid-cols-2">{binderItems.map((item) => <BinderCard key={item.id} item={item} pending={pending} onStatus={updateStatus} />)}</div> : <TDEmptyState title={state.tradeItems.length ? "No matching binder cards" : "No cards available to trade"} message={state.tradeItems.length ? "Adjust search or status filters." : "Mark cards as available from card detail or Collection."} />
      ) : null}

      {tab === "wishlist" ? (
        <div className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
            <TDInput label="Wanted card" value={cardName} onChange={(event) => setCardName(event.target.value)} placeholder="Rhystic Study" />
            <TDInput label="Set" value={setCode} onChange={(event) => setSetCode(event.target.value.toUpperCase())} placeholder="Any" />
            <TDButton label="Add" loading={pending === "add"} disabled={!cardName.trim()} onClick={() => run("add", async () => {
              await addWebWishlistItem({ userId: state.userId, cardName, setCode, priority: priority === "all" ? "medium" : priority });
              setCardName("");
              setSetCode("");
            })} />
          </div>
          {wishlistItems.length ? <div className="grid gap-3 lg:grid-cols-2">{wishlistItems.map((item) => <WishlistCard key={item.id} item={item} matches={state.matches.filter((match) => match.wishlistItem.id === item.id)} pending={pending} onPriority={updatePriority} onRemove={() => run(item.id, () => removeWebWishlistItem(state.userId, item.id))} />)}</div> : <TDEmptyState title={state.wishlistItems.length ? "No matching wishlist cards" : "Wishlist is empty"} message={state.wishlistItems.length ? "Adjust search or priority filters." : "Add cards you want before a trade or card show."} />}
        </div>
      ) : null}

      {tab === "matches" ? (
        state.matches.length ? <div className="grid gap-3 lg:grid-cols-2">{state.matches.map((match) => <MatchCard key={match.id} match={match} />)}</div> : <TDEmptyState title="No matches yet" message="Matches appear when cards in your Trade Binder satisfy Wishlist targets." />
      ) : null}
    </TDCard>
  );
}

function BinderCard({ item, pending, onStatus }: { item: TradeBinderItem; pending: string | null; onStatus: (item: TradeBinderItem, status: TradeStatus) => void }) {
  return (
    <TDCard variant="outlined" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <TDText variant="title">{item.card.cardName}</TDText>
          <TDText variant="caption" tone="muted">{displayPrinting(item.card.printing)} - {displayCondition(item.card.condition)} - {displayFinish(item.card.printing.finish)}</TDText>
          <TDText variant="caption" tone="muted">{displayStorageLocation(item.card)}</TDText>
        </div>
        <TDBadge tone="info">x{item.quantityAvailable}</TDBadge>
      </div>
      {item.notes ? <TDText variant="small" tone="muted">{item.notes}</TDText> : null}
      <div className="flex flex-wrap gap-2">
        {TRADE_STATUS_OPTIONS.map((status) => <TDButton key={status} label={tradeStatusLabel(status)} size="sm" variant={item.status === status ? "secondary" : "ghost"} disabled={pending === item.id} onClick={() => onStatus(item, status)} />)}
      </div>
    </TDCard>
  );
}

function WishlistCard({ item, matches, pending, onPriority, onRemove }: { item: WishlistItem; matches: State["matches"]; pending: string | null; onPriority: (item: WishlistItem, priority: WishlistPriority) => void; onRemove: () => void }) {
  return (
    <TDCard variant="outlined" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <TDText variant="title">{item.cardName}</TDText>
          <TDText variant="caption" tone="muted">{[item.setCode ?? "Any set", item.targetCondition, item.targetFinish].join(" - ")}</TDText>
        </div>
        <TDBadge tone={item.priority === "grail" ? "accent" : "info"}>{wishlistPriorityLabel(item.priority)}</TDBadge>
      </div>
      {item.notes ? <TDText variant="small" tone="muted">{item.notes}</TDText> : null}
      <div className="flex flex-wrap gap-2">
        {WISHLIST_PRIORITY_OPTIONS.map((priority) => <TDButton key={priority} label={wishlistPriorityLabel(priority)} size="sm" variant={item.priority === priority ? "secondary" : "ghost"} disabled={pending === item.id} onClick={() => onPriority(item, priority)} />)}
        <TDButton label="Remove" size="sm" variant="ghost" loading={pending === item.id} onClick={onRemove} />
      </div>
      {matches.length ? matches.map((match) => <MatchCard key={match.id} match={match} compact />) : <TDText variant="small" tone="muted">No binder matches yet.</TDText>}
    </TDCard>
  );
}

function MatchCard({ match, compact = false }: { match: State["matches"][number]; compact?: boolean }) {
  return (
    <div className="rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <TDText variant={compact ? "small" : "title"}>{match.binderItem.card.cardName}</TDText>
          <TDText variant="caption" tone="muted">{displayPrinting(match.binderItem.card.printing)} - {displayCondition(match.binderItem.card.condition)} - {displayFinish(match.binderItem.card.printing.finish)}</TDText>
          <TDText variant="caption" tone="muted">{displayStorageLocation(match.binderItem.card)}</TDText>
        </div>
        <TDBadge tone={match.matchType === "exact" ? "success" : "warning"}>{match.matchType} x{match.quantityAvailable}</TDBadge>
      </div>
      {!compact ? <TDText variant="small" tone="muted" className="mt-2">Matches wishlist target: {match.wishlistItem.cardName}</TDText> : null}
    </div>
  );
}

function TabButton({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`inline-flex min-h-11 items-center gap-2 rounded-[var(--td-radius-md)] border px-3 text-sm font-black outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)] ${active ? "border-td-accent/40 bg-td-accent/10 text-td-accent-text" : "border-[var(--td-border-default)] text-[var(--td-text-muted)]"}`}>{icon}{label}</button>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <TDCard variant="outlined"><TDText variant="caption" tone="muted">{label}</TDText><TDText variant="title">{value}</TDText></TDCard>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-4 text-sm text-[var(--td-text-primary)] outline-none focus:border-[var(--td-border-focus)]">
        {options.map((option) => <option key={option} value={option}>{option === "all" ? "All" : option.includes("_") ? option.replaceAll("_", " ") : option}</option>)}
      </select>
    </label>
  );
}
