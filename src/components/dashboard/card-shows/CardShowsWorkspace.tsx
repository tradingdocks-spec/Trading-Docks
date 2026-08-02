"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  MapPin,
  PackageSearch,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShoppingCart,
  Sparkles,
  Store,
  Target,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { CARD_SHOW_GAMES, type CardShowGameId } from "@/lib/card-show-games";
import { loadAccountDocument, saveAccountDocument } from "@/lib/account-documents";
import {
  persistInventorySnapshotDiff,
  type InventoryPersistenceRecord,
  type InventorySnapshot,
} from "@/lib/inventory-persistence";

type Tab = "overview" | "calendar" | "lookup" | "inventory" | "sales" | "reports";
type EventRecord = {
  id: string;
  name: string;
  venue: string;
  city: string;
  startDate: string;
  endDate: string;
  booth: string;
  budget: number;
  status: "planning" | "ready" | "complete";
};
type SaleRecord = { id: string; item: string; amount: number; method: string; time: string };
type InventoryRecord = { name: string; category: string; taken: number; sold: number; value: number };
type PriceVariant = {
  id: string;
  condition: string;
  printing: string;
  language: string | null;
  current: number | null;
  low30d: number | null;
  average30d: number | null;
  high30d: number | null;
  updatedAt: string | null;
};
type PriceResult = {
  id: string;
  name: string;
  game: string;
  setName: string;
  setCode: string | null;
  number: string | null;
  rarity: string | null;
  tcgplayerId: string | null;
  scryfallId: string | null;
  sealed: boolean;
  imageUrl: string | null;
  variants: PriceVariant[];
};
type PurchaseOrderLine = {
  id: string;
  cardId: string;
  variantId: string;
  name: string;
  game: string;
  setName: string;
  setCode: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  sealed: boolean;
  imageUrl: string | null;
  tcgplayerId: string | null;
  scryfallId: string | null;
  condition: string;
  printing: string;
  language: string | null;
  quantity: number;
  marketPrice: number;
  buyingRate: number;
  recommendedUnitOffer: number;
};

const tabs: Array<{ id: Tab; label: string; icon: typeof CalendarDays }> = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "lookup", label: "Quick Lookup", icon: PackageSearch },
  { id: "inventory", label: "Show Inventory", icon: Boxes },
  { id: "sales", label: "Sales", icon: ShoppingCart },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

const starterEvents: EventRecord[] = [];
const starterSales: SaleRecord[] = [];
const starterInventory: InventoryRecord[] = [];

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

export function CardShowsWorkspace() {
  const [tab, setTab] = useState<Tab>("overview");
  const [events, setEvents] = useState<EventRecord[]>(starterEvents);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [showEventForm, setShowEventForm] = useState(false);
  const [singleRate, setSingleRate] = useState("");
  const [sealedRate, setSealedRate] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [lookupType, setLookupType] = useState<"single" | "sealed">("single");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupGame, setLookupGame] = useState<CardShowGameId>("pokemon");
  const [sales, setSales] = useState<SaleRecord[]>(starterSales);
  const [inventory, setInventory] = useState<InventoryRecord[]>(starterInventory);
  const [saleItem, setSaleItem] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [toast, setToast] = useState("");
  const [cloudLoaded, setCloudLoaded] = useState(false);

  useEffect(() => {
    void (async () => { try {
      let parsed = await loadAccountDocument<{ events?: EventRecord[]; rates?: [string, string] | [number, number]; sales?: SaleRecord[]; inventory?: InventoryRecord[] }>("card-shows:v2");
      const legacy = window.localStorage.getItem("td-card-shows-v2");
      if (!parsed && legacy) { parsed = JSON.parse(legacy); await saveAccountDocument("card-shows:v2", parsed); window.localStorage.removeItem("td-card-shows-v2"); }
      if (!parsed) return;
      if (parsed.events) setEvents(parsed.events);
      if (parsed.rates) {
        setSingleRate(String(parsed.rates[0] ?? ""));
        setSealedRate(String(parsed.rates[1] ?? ""));
      }
      if (parsed.sales) setSales(parsed.sales);
      if (parsed.inventory) setInventory(parsed.inventory);
    } catch {} finally { setCloudLoaded(true); } })();
  }, []);

  useEffect(() => {
    if (!cloudLoaded) return;
    const timer = window.setTimeout(() => void saveAccountDocument("card-shows:v2", { events, rates: [singleRate, sealedRate], sales, inventory }), 300);
    return () => window.clearTimeout(timer);
  }, [events, singleRate, sealedRate, sales, inventory, cloudLoaded]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0];
  const salesTotal = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const inventoryValue = inventory.reduce((sum, item) => sum + item.value, 0);
  const unitsSold = inventory.reduce((sum, item) => sum + item.sold, 0);
  const rate = lookupType === "single" ? singleRate : sealedRate;
  const offer = marketPrice && rate ? Number(marketPrice) * (Number(rate) / 100) : null;

  function notify(message: string) {
    setToast(message);
  }

  function addEvent(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    const date = String(formData.get("date") || "");
    if (!name || !date) return;
    const event: EventRecord = {
      id: `${Date.now()}`,
      name,
      venue: String(formData.get("venue") || "Venue TBD"),
      city: String(formData.get("city") || "Location TBD"),
      startDate: date,
      endDate: String(formData.get("endDate") || date),
      booth: String(formData.get("booth") || "Table TBD"),
      budget: Number(formData.get("budget")) || 0,
      status: "planning",
    };
    setEvents((current) => [...current, event]);
    setSelectedEventId(event.id);
    setShowEventForm(false);
    notify("Card show added to your calendar");
  }

  function deleteEvent(eventId: string) {
    const event = events.find((item) => item.id === eventId);
    if (!event) return;
    if (!window.confirm(`Delete "${event.name}"? This cannot be undone.`)) return;
    setEvents((current) => current.filter((item) => item.id !== eventId));
    if (selectedEventId === eventId) {
      setSelectedEventId(events.find((item) => item.id !== eventId)?.id ?? "");
    }
    notify("Card show deleted");
  }

  function recordSale() {
    if (!saleItem.trim() || !Number(saleAmount)) return;
    setSales((current) => [
      {
        id: `${Date.now()}`,
        item: saleItem.trim(),
        amount: Number(saleAmount),
        method: "Card",
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      },
      ...current,
    ]);
    setSaleItem("");
    setSaleAmount("");
    notify("Sale recorded and inventory queued for adjustment");
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#02090f]">
      <div className="mx-auto w-full max-w-[1660px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(135deg,#071925_0%,#06131d_55%,#041019_100%)] p-5 shadow-[0_28px_90px_rgba(0,0,0,.28)] sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full bg-cyan-400/[0.1] blur-[110px]" />
          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">Seller workspace</span>
                <span className="rounded-full border border-emerald-300/15 bg-emerald-400/[0.06] px-3 py-1 text-[10px] font-semibold text-emerald-200">Live operations</span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Card Shows</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Plan events, buy at your target margins, control show inventory, and see the true profit from every table.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setTab("lookup")} className="inline-flex h-11 items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/[0.07] px-4 text-xs font-bold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.12]">
                <Search className="h-4 w-4" /> Quick card lookup
              </button>
              <button onClick={() => setShowEventForm(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 to-sky-500 px-4 text-xs font-bold text-[#001018] shadow-[0_14px_35px_rgba(6,182,212,.2)] transition hover:-translate-y-0.5">
                <Plus className="h-4 w-4" /> Add card show
              </button>
            </div>
          </div>
        </header>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#06131d]/80 p-1.5">
          <div className="flex min-w-max gap-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition ${active ? "bg-cyan-400/[0.11] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,.16)]" : "text-slate-500 hover:bg-white/[0.035] hover:text-slate-200"}`}>
                  <Icon className={`h-4 w-4 ${active ? "text-cyan-300" : ""}`} /> {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <main className="mt-5">
          {tab === "overview" ? (
            <Overview event={selectedEvent} events={events} salesTotal={salesTotal} inventoryValue={inventoryValue} unitsSold={unitsSold} onChooseEvent={setSelectedEventId} onDeleteEvent={deleteEvent} onNavigate={setTab} onAdd={() => setShowEventForm(true)} />
          ) : null}
          {tab === "calendar" ? <CalendarPanel events={events} onAdd={() => setShowEventForm(true)} onDeleteEvent={deleteEvent} /> : null}
          {tab === "lookup" ? (
            <LookupPanel
              query={lookupQuery}
              setQuery={setLookupQuery}
              game={lookupGame}
              setGame={setLookupGame}
              type={lookupType}
              setType={setLookupType}
              marketPrice={marketPrice}
              setMarketPrice={setMarketPrice}
              rate={rate}
              setRate={lookupType === "single" ? setSingleRate : setSealedRate}
              singleRate={singleRate}
              sealedRate={sealedRate}
              setSingleRate={setSingleRate}
              setSealedRate={setSealedRate}
              offer={offer}
              onSave={() => notify("Buying target saved")}
            />
          ) : null}
          {tab === "inventory" ? <InventoryPanel event={selectedEvent} inventory={inventory} value={inventoryValue} sold={unitsSold} /> : null}
          {tab === "sales" ? (
            <SalesPanel sales={sales} total={salesTotal} item={saleItem} amount={saleAmount} setItem={setSaleItem} setAmount={setSaleAmount} onRecord={recordSale} />
          ) : null}
          {tab === "reports" ? <ReportsPanel hasData={sales.length > 0 || inventory.length > 0} sales={salesTotal} inventoryValue={inventoryValue} budget={selectedEvent?.budget ?? 0} /> : null}
        </main>
      </div>

      {showEventForm ? <EventModal onClose={() => setShowEventForm(false)} onSubmit={addEvent} /> : null}
      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-300/25 bg-[#0a201c] px-4 py-2.5 text-xs font-semibold text-emerald-100 shadow-2xl md:bottom-7">
          <Check className="h-4 w-4 text-emerald-300" /> {toast}
        </div>
      ) : null}
    </div>
  );
}

function Overview({ event, events, salesTotal, inventoryValue, unitsSold, onChooseEvent, onDeleteEvent, onNavigate, onAdd }: { event?: EventRecord; events: EventRecord[]; salesTotal: number; inventoryValue: number; unitsSold: number; onChooseEvent: (id: string) => void; onDeleteEvent: (id: string) => void; onNavigate: (tab: Tab) => void; onAdd: () => void }) {
  const metrics = [
    { label: "Show inventory", value: inventoryValue ? money(inventoryValue) : "—", detail: inventoryValue ? "Inventory assigned by you" : "No inventory assigned", icon: Boxes },
    { label: "Buying budget", value: event?.budget ? money(event.budget) : "—", detail: event ? "Event target allocation" : "Add a show to set a budget", icon: WalletCards },
    { label: "Recorded sales", value: salesTotal ? money(salesTotal) : "—", detail: unitsSold ? `${unitsSold} inventory units sold` : "No sales recorded", icon: TrendingUp },
    { label: "Projected margin", value: "—", detail: "Calculated from your activity", icon: Target },
  ];
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="group rounded-[22px] border border-white/[0.065] bg-[#06131d] p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/15">
              <div className="flex items-start justify-between">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{metric.label}</p><p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{metric.value}</p></div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/[0.06] text-cyan-300"><Icon className="h-4 w-4" /></span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{metric.detail}</p>
            </article>
          );
        })}
      </section>

      {!event ? <EmptyState icon={CalendarDays} title="No card shows yet" description="Create your first event to start planning dates, inventory, buying targets, sales, and results." action="Add your first card show" onAction={onAdd} /> : <div className="grid gap-5 xl:grid-cols-[1.45fr_.9fr]">
        <section className="rounded-[24px] border border-white/[0.065] bg-[#06131d] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Next event</p><h2 className="mt-2 text-xl font-semibold text-white">{event?.name}</h2></div>
            <span className="rounded-full border border-emerald-300/15 bg-emerald-400/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200">{event?.status}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Info icon={CalendarDays} label="Show dates" value={event ? `${dayLabel(event.startDate)} – ${dayLabel(event.endDate)}` : "—"} />
            <Info icon={MapPin} label="Venue" value={event?.venue ?? "—"} />
            <Info icon={Store} label="Location" value={event?.booth ?? "—"} />
          </div>
          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/10 p-4"><p className="text-xs font-semibold text-slate-300">Show readiness</p><p className="mt-2 text-xs leading-5 text-slate-600">Your preparation checklist and readiness score will appear after you add them.</p></div>
          <button onClick={() => onNavigate("inventory")} className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-cyan-300 transition hover:text-cyan-200">Open event workspace <ArrowRight className="h-3.5 w-3.5" /></button>
        </section>

        <section className="rounded-[24px] border border-white/[0.065] bg-[#06131d] p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Schedule</p><h2 className="mt-2 text-lg font-semibold text-white">Upcoming shows</h2></div><CalendarDays className="h-5 w-5 text-cyan-300" /></div>
          <div className="mt-4 space-y-2">
            {events.map((item) => (
              <div key={item.id} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${event?.id === item.id ? "border-cyan-300/20 bg-cyan-400/[0.06]" : "border-white/[0.05] bg-white/[0.015] hover:border-white/[0.1]"}`}>
                <button type="button" onClick={() => onChooseEvent(item.id)} className="contents">
                <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-black/10"><strong className="text-sm text-white">{new Date(`${item.startDate}T12:00:00`).getDate()}</strong><span className="text-[8px] font-bold uppercase tracking-wider text-cyan-300">{new Date(`${item.startDate}T12:00:00`).toLocaleString("en-US", { month: "short" })}</span></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-200">{item.name}</span><span className="mt-1 block truncate text-[10px] text-slate-600">{item.city} · {item.booth}</span></span>
                <ChevronRight className="h-4 w-4 text-slate-700" />
                </button>
                <button type="button" onClick={() => onDeleteEvent(item.id)} aria-label={`Delete ${item.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-300/10 text-slate-600 transition hover:border-rose-300/25 hover:bg-rose-400/[0.07] hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>
      </div>}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/[0.055] bg-white/[0.018] p-4"><Icon className="h-4 w-4 text-cyan-300" /><p className="mt-3 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">{label}</p><p className="mt-1.5 truncate text-xs font-semibold text-slate-300">{value}</p></div>;
}

function CalendarPanel({ events, onAdd, onDeleteEvent }: { events: EventRecord[]; onAdd: () => void; onDeleteEvent: (id: string) => void }) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: 42 }, (_, index) => index - firstWeekday + 1);
  return (
    <section className="rounded-[24px] border border-white/[0.065] bg-[#06131d] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Event calendar</p><h2 className="mt-2 text-xl font-semibold text-white">{cursor.toLocaleString("en-US", { month: "long", year: "numeric" })}</h2></div><div className="flex gap-2"><button onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] text-slate-400"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] text-slate-400"><ChevronRight className="h-4 w-4" /></button><button onClick={onAdd} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-400 px-4 text-xs font-bold text-[#001018]"><Plus className="h-4 w-4" /> Add event</button></div></div>
      <div className="mt-6 grid grid-cols-7 overflow-hidden rounded-2xl border border-white/[0.06]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="border-b border-r border-white/[0.05] bg-white/[0.025] p-2 text-center text-[9px] font-bold uppercase tracking-wider text-slate-600">{day}</div>)}
        {days.map((day, index) => {
          const inMonth = day >= 1 && day <= daysInMonth;
          const event = inMonth ? events.find((item) => {
            const eventDate = new Date(`${item.startDate}T12:00:00`);
            return eventDate.getFullYear() === year && eventDate.getMonth() === month && eventDate.getDate() === day;
          }) : undefined;
          return <div key={index} className={`min-h-24 border-b border-r border-white/[0.045] p-2 sm:min-h-28 ${!inMonth ? "bg-black/10 text-slate-800" : "text-slate-500"}`}><span className="text-[10px] font-semibold">{inMonth ? day : ""}</span>{event ? <div className="mt-2 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08] p-2 text-[9px] font-semibold leading-4 text-cyan-100"><div className="flex items-start gap-1"><span className="min-w-0 flex-1"><span className="hidden sm:inline">{event.name}</span><span className="sm:hidden">Show</span></span><button type="button" onClick={() => onDeleteEvent(event.id)} aria-label={`Delete ${event.name}`} className="text-cyan-200/45 transition hover:text-rose-300"><X className="h-3 w-3" /></button></div></div> : null}</div>;
        })}
      </div>
    </section>
  );
}

function LookupPanel({ query, setQuery, game, setGame, type, setType, marketPrice, setMarketPrice, rate, setRate, singleRate, sealedRate, setSingleRate, setSealedRate, offer, onSave }: { query: string; setQuery: (v: string) => void; game: CardShowGameId; setGame: (v: CardShowGameId) => void; type: "single" | "sealed"; setType: (v: "single" | "sealed") => void; marketPrice: string; setMarketPrice: (v: string) => void; rate: string; setRate: (v: string) => void; singleRate: string; sealedRate: string; setSingleRate: (v: string) => void; setSealedRate: (v: string) => void; offer: number | null; onSave: () => void }) {
  const [results, setResults] = useState<PriceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [lastSearch, setLastSearch] = useState("");
  const [warning, setWarning] = useState("");
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderLine[]>([]);
  const [actualPaid, setActualPaid] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [sellerSource, setSellerSource] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [purchaseOrderLoaded, setPurchaseOrderLoaded] = useState(false);
  const numericRate = Number(rate);
  const hasBuyingRate = Number.isFinite(numericRate) && numericRate > 0 && numericRate <= 100;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("td-card-show-buying-cart-v1");
      if (saved) {
        const parsed = JSON.parse(saved) as {
          lines?: PurchaseOrderLine[];
          actualPaid?: string;
          purchaseDate?: string;
          sellerSource?: string;
          purchaseNotes?: string;
        };
        if (Array.isArray(parsed.lines)) setPurchaseOrder(parsed.lines);
        setActualPaid(parsed.actualPaid ?? "");
        setPurchaseDate(parsed.purchaseDate ?? "");
        setSellerSource(parsed.sellerSource ?? "");
        setPurchaseNotes(parsed.purchaseNotes ?? "");
      }
    } catch {}
    setPurchaseOrderLoaded(true);
  }, []);

  useEffect(() => {
    if (!purchaseOrderLoaded) return;
    window.localStorage.setItem(
      "td-card-show-buying-cart-v1",
      JSON.stringify({
        lines: purchaseOrder,
        actualPaid,
        purchaseDate,
        sellerSource,
        purchaseNotes,
      }),
    );
  }, [
    purchaseOrderLoaded,
    purchaseOrder,
    actualPaid,
    purchaseDate,
    sellerSource,
    purchaseNotes,
  ]);

  function offerFor(price: number | null) {
    return price !== null && hasBuyingRate ? price * (numericRate / 100) : null;
  }

  async function searchPrices(event: React.FormEvent) {
    event.preventDefault();
    const normalizedSearch = `${game}:${type}:${query.trim().toLocaleLowerCase()}`;
    if (query.trim().length < 2 || loading || normalizedSearch === lastSearch) return;
    setLoading(true);
    setError("");
    setWarning("");
    setResults([]);
    setSelectedVariantId("");
    try {
      const params = new URLSearchParams({ q: query.trim(), game, type });
      const response = await fetch(`/api/card-shows/search?${params}`);
      const payload = (await response.json()) as { results?: PriceResult[]; error?: string; remaining?: number | null; warning?: string };
      if (!response.ok) throw new Error(payload.error || "Search failed.");
      setResults(payload.results ?? []);
      setRemaining(typeof payload.remaining === "number" ? payload.remaining : null);
      setWarning(payload.warning ?? "");
      setLastSearch(normalizedSearch);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  function chooseVariant(variant: PriceVariant) {
    setSelectedVariantId(variant.id);
    if (variant.current !== null) setMarketPrice(String(variant.current));
  }

  const totalUnits = purchaseOrder.reduce((sum, line) => sum + line.quantity, 0);
  const totalMarketValue = purchaseOrder.reduce(
    (sum, line) => sum + line.marketPrice * line.quantity,
    0,
  );
  const totalRecommendedOffer = purchaseOrder.reduce(
    (sum, line) => sum + line.recommendedUnitOffer * line.quantity,
    0,
  );
  const averageMarketValue = totalUnits ? totalMarketValue / totalUnits : 0;

  function addToPurchaseOrder(result: PriceResult, variant: PriceVariant) {
    const currentPrice = variant.current;
    const recommendedOffer = offerFor(currentPrice);
    if (currentPrice === null || recommendedOffer === null) {
      setPurchaseMessage("Set a valid buying percentage before adding this item.");
      return;
    }
    const lineId = `${result.id}:${variant.id}`;
    setPurchaseOrder((current) => {
      const existing = current.find((line) => line.id === lineId);
      if (existing) {
        return current.map((line) =>
          line.id === lineId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        {
          id: lineId,
          cardId: result.id,
          variantId: variant.id,
          name: result.name,
          game: result.game,
          setName: result.setName,
          setCode: result.setCode,
          collectorNumber: result.number,
          rarity: result.rarity,
          sealed: result.sealed,
          imageUrl: result.imageUrl,
          tcgplayerId: result.tcgplayerId,
          scryfallId: result.scryfallId,
          condition: variant.condition,
          printing: variant.printing,
          language: variant.language,
          quantity: 1,
          marketPrice: currentPrice,
          buyingRate: numericRate,
          recommendedUnitOffer: recommendedOffer,
        },
      ];
    });
    setPurchaseMessage(`${result.name} added to the purchase order.`);
  }

  function updatePurchaseQuantity(id: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity < 1) return;
    setPurchaseOrder((current) =>
      current.map((line) => (line.id === id ? { ...line, quantity } : line)),
    );
  }

  async function finalizePurchase() {
    const paid = Number(actualPaid);
    if (!purchaseOrder.length) return;
    if (!purchaseDate) {
      setPurchaseMessage("Choose the purchase date before finalizing.");
      return;
    }
    if (!Number.isFinite(paid) || paid < 0 || actualPaid.trim() === "") {
      setPurchaseMessage("Enter the actual amount paid before finalizing.");
      return;
    }

    setFinalizing(true);
    setPurchaseMessage("");
    const purchasedAt = new Date(`${purchaseDate}T12:00:00`).toISOString();
    const allocationBasis = totalRecommendedOffer || totalMarketValue || totalUnits;
    const inventoryItems: InventoryPersistenceRecord[] = purchaseOrder.map((line) => {
      const lineBasis =
        totalRecommendedOffer > 0
          ? line.recommendedUnitOffer * line.quantity
          : totalMarketValue > 0
            ? line.marketPrice * line.quantity
            : line.quantity;
      const allocatedLineCost = allocationBasis ? paid * (lineBasis / allocationBasis) : 0;
      return {
        id: crypto.randomUUID(),
        name: line.name,
        sku: line.tcgplayerId ? `TCG-${line.tcgplayerId}` : line.variantId,
        category: line.sealed ? "Sealed" : "Single",
        quantity: line.quantity,
        locationId: "__trading-docks-put-away-queue__",
        condition: line.condition,
        set: line.setName,
        setCode: line.setCode,
        collectorNumber: line.collectorNumber,
        language: line.language || undefined,
        finish: line.printing,
        treatment: line.rarity || undefined,
        scryfallId: line.scryfallId || undefined,
        imageUrl: line.imageUrl || undefined,
        costBasis: line.quantity ? allocatedLineCost / line.quantity : 0,
        unitMarketValue: line.marketPrice,
        value: line.marketPrice * line.quantity,
        purchaseDate,
        purchasedAt,
        purchaseSource: sellerSource.trim() || undefined,
        purchaseNotes: purchaseNotes.trim() || undefined,
        purchaseOrderActualPaid: paid,
        purchaseOrderRecommendedOffer: totalRecommendedOffer,
        updatedAt: new Date().toISOString(),
      };
    });
    const movements: InventoryPersistenceRecord[] = inventoryItems.map((item) => ({
      id: crypto.randomUUID(),
      itemName: item.name,
      to: "Put-Away Queue",
      quantity: item.quantity,
      action: "queued",
      timestamp: new Date().toISOString(),
    }));
    const emptySnapshot: InventorySnapshot = { locations: [], items: [], movements: [] };
    try {
      await persistInventorySnapshotDiff(emptySnapshot, {
        locations: [],
        items: inventoryItems,
        movements,
      });
      window.localStorage.removeItem("td-card-show-buying-cart-v1");
      setPurchaseOrder([]);
      setActualPaid("");
      setPurchaseDate("");
      setSellerSource("");
      setPurchaseNotes("");
      setPurchaseMessage(
        `${totalUnits} ${totalUnits === 1 ? "item" : "items"} purchased and sent to Inventory Put-Away.`,
      );
    } catch (reason) {
      setPurchaseMessage(
        reason instanceof Error ? reason.message : "The purchase could not be finalized.",
      );
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.8fr]">
      <section className="rounded-[24px] border border-white/[0.065] bg-[#06131d] p-5 sm:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Buying desk</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Know your number before you buy.</h2><p className="mt-2 text-sm text-slate-500">Look up a single or sealed product and calculate your maximum offer instantly.</p>
        <div className="mt-6 flex rounded-xl border border-white/[0.07] bg-black/10 p-1">{(["single", "sealed"] as const).map((item) => <button key={item} onClick={() => setType(item)} className={`flex-1 rounded-lg py-2.5 text-xs font-bold capitalize transition ${type === item ? "bg-cyan-400/[0.12] text-cyan-200 shadow-[inset_0_0_0_1px_rgba(103,232,249,.17)]" : "text-slate-600"}`}>{item === "single" ? "Singles" : "Sealed products"}</button>)}</div>
        <div className="mt-4 flex flex-wrap gap-2">{CARD_SHOW_GAMES.map((item) => <button key={item.id} type="button" onClick={() => setGame(item.id)} className={`rounded-full border px-3 py-2 text-[10px] font-bold transition ${game === item.id ? "border-cyan-300/30 bg-cyan-400/[0.11] text-cyan-100" : "border-white/[0.07] text-slate-500 hover:text-slate-300"}`}>{item.label}</button>)}</div>
        <form onSubmit={searchPrices} className="mt-4">
          <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Card or product</span><span className="mt-2 flex h-12 items-center gap-3 rounded-xl border border-white/[0.08] bg-black/10 px-4 focus-within:border-cyan-300/30"><Search className="h-4 w-4 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={type === "single" ? "Enter a card name or card number" : "Enter a booster box, bundle, or deck"} className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-700" /><button type="submit" disabled={loading || query.trim().length < 2} className="h-8 rounded-lg bg-cyan-400 px-4 text-[10px] font-bold text-[#001018] disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Searching…" : "Search"}</button></span></label>
        </form>
        {error ? <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-200">{error}</div> : null}
        {warning ? <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-100">{warning}</div> : null}
        {!loading && !error && results.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-white/[0.08] px-5 py-7 text-center text-xs text-slate-600">Choose a game and submit a search. Searches only run when you press Search to protect your monthly allowance.</div> : null}
        {results.length ? <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">Live pricing results</p>{remaining !== null ? <p className="text-[10px] text-slate-700">{remaining.toLocaleString()} API requests remaining</p> : null}</div>
          {results.map((result) => <article key={result.id} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/10">
            <div className="flex gap-4 border-b border-white/[0.055] p-4">
              <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025] text-center text-[9px] font-bold text-slate-700 shadow-lg">{result.imageUrl ? <img src={result.imageUrl} alt={`${result.name} from ${result.setName}`} className="h-full w-full object-contain" loading="lazy" /> : <span className="px-2">Image not provided</span>}</div>
              <div className="min-w-0 flex-1 self-center"><p className="text-[9px] font-semibold uppercase tracking-wider text-cyan-300">{result.game} · {result.sealed ? "Sealed product" : "Single"}</p><h3 className="mt-1 text-base font-semibold leading-6 text-white">{result.name}</h3><p className="mt-2 text-xs font-semibold text-slate-300">{result.setName}</p><div className="mt-2 flex flex-wrap gap-2">{result.setCode ? <span className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-slate-400">Set: {result.setCode}</span> : null}{result.number ? <span className="rounded-md border border-white/[0.07] px-2 py-1 text-[10px] text-slate-500">#{result.number}</span> : null}{result.rarity ? <span className="rounded-md border border-white/[0.07] px-2 py-1 text-[10px] text-slate-500">{result.rarity}</span> : null}</div></div>
            </div>
            <div className="divide-y divide-white/[0.045]">{result.variants.slice(0, 5).map((variant) => <div key={variant.id} className={`grid gap-3 p-4 transition hover:bg-cyan-400/[0.04] lg:grid-cols-[minmax(150px,1fr)_auto] ${selectedVariantId === variant.id ? "bg-cyan-400/[0.07] ring-1 ring-inset ring-cyan-300/20" : ""}`}>
              <button type="button" onClick={() => chooseVariant(variant)} className="text-left"><span className="block text-xs font-semibold text-slate-300">{variant.printing} · {variant.condition}</span><span className="mt-1 block text-[9px] text-slate-600">{variant.language || "Language not listed"}{variant.updatedAt ? ` · Updated ${new Date(variant.updatedAt).toLocaleDateString()}` : ""}</span></button>
              <div className="flex flex-col gap-3 sm:items-end"><div className="grid grid-cols-3 gap-3 text-left sm:grid-cols-5 sm:text-right"><PriceCell label="30d low" value={variant.low30d} /><PriceCell label="30d avg" value={variant.average30d} /><PriceCell label="30d high" value={variant.high30d} /><PriceCell label="Current" value={variant.current} accent /><PriceCell label={hasBuyingRate ? `Offer · ${numericRate}%` : "Offer"} value={offerFor(variant.current)} offer /></div><button type="button" onClick={() => addToPurchaseOrder(result, variant)} disabled={!hasBuyingRate || variant.current === null} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/[0.07] px-3 text-[10px] font-bold text-emerald-200 transition hover:bg-emerald-400/[0.12] disabled:cursor-not-allowed disabled:opacity-35"><Plus className="h-3.5 w-3.5" /> Add to purchase order</button></div>
            </div>)}</div>
          </article>)}
          <p className="text-[10px] leading-4 text-slate-700">Low, average, and high are the selected variant&apos;s 30-day observed prices. Current is the latest market value supplied by JustTCG. Offer is calculated from the saved buying percentage for {type === "single" ? "singles" : "sealed products"}.</p>
        </div> : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label><span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Offer price basis</span><span className="mt-2 flex h-12 items-center rounded-xl border border-white/[0.08] bg-black/10 px-4"><span className="mr-1 text-sm text-slate-600">$</span><input type="number" step=".01" value={marketPrice} onChange={(event) => setMarketPrice(event.target.value)} placeholder="Select a result or enter price" className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-700" /></span></label>
          <label><span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Buying percentage</span><span className="mt-2 flex h-12 items-center rounded-xl border border-white/[0.08] bg-black/10 px-4"><input type="number" min="1" max="100" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="Enter target" className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-700" /><span className="text-sm text-slate-600">%</span></span></label>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,.09),rgba(14,165,233,.025))] p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Maximum cash offer</p><p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">{offer === null ? "—" : money(offer)}</p><p className="mt-1 text-xs text-slate-500">{offer === null ? "Enter a market price and buying percentage." : `${money(Number(marketPrice))} market × ${rate}% target`}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-slate-600">Target gross margin</p><p className="mt-1 text-xl font-semibold text-emerald-300">{rate ? `${100 - Number(rate)}%` : "—"}</p></div></div></div>
      </section>
      <div className="space-y-5">
      <section className="rounded-[24px] border border-white/[0.065] bg-[#06131d] p-5 sm:p-6">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-400/[0.07] text-violet-300"><Settings2 className="h-5 w-5" /></span><div><h3 className="text-sm font-semibold text-white">Buying rules</h3><p className="mt-1 text-[10px] text-slate-600">Applied automatically at this show</p></div></div>
        <div className="mt-5 space-y-3">
          <BuyingRateField label="Singles" value={singleRate} onChange={setSingleRate} active={type === "single"} onActivate={() => setType("single")} />
          <BuyingRateField label="Sealed products" value={sealedRate} onChange={setSealedRate} active={type === "sealed"} onActivate={() => setType("sealed")} />
        </div>
        <button onClick={onSave} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/[0.07] text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/[0.12]"><Check className="h-4 w-4" /> Save show buying targets</button>
      </section>
      <section className="rounded-[24px] border border-white/[0.065] bg-[#06131d] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Purchase order</p><h3 className="mt-2 text-lg font-semibold text-white">Buying cart</h3><p className="mt-1 text-[10px] leading-4 text-slate-600">Finalize purchases into Inventory Put-Away for filing later.</p></div><span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold text-slate-400">{totalUnits ? `${totalUnits} ${totalUnits === 1 ? "item" : "items"}` : "Empty"}</span></div>
        {!purchaseOrder.length ? <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] px-4 py-8 text-center"><ShoppingCart className="mx-auto h-5 w-5 text-slate-700" /><p className="mt-3 text-xs font-semibold text-slate-400">No cards added</p><p className="mt-1 text-[10px] leading-4 text-slate-700">Set a buying rate, then add the exact condition and printing from a search result.</p></div> : <div className="mt-5 space-y-2">{purchaseOrder.map((line) => <div key={line.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-3"><div className="flex gap-3">{line.imageUrl ? <img src={line.imageUrl} alt="" className="h-14 w-10 shrink-0 rounded-md object-contain" /> : <div className="h-14 w-10 shrink-0 rounded-md border border-white/[0.06] bg-black/10" />}<div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-200">{line.name}</p><p className="mt-1 truncate text-[9px] text-slate-600">{line.setName} · {line.printing} · {line.condition}</p><div className="mt-2 flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-[9px] text-slate-600">Qty<input type="number" min="1" step="1" value={line.quantity} onChange={(event) => updatePurchaseQuantity(line.id, Number(event.target.value))} className="h-8 w-14 rounded-lg border border-white/[0.07] bg-black/10 px-2 text-xs text-white outline-none" /></label><div className="text-right"><p className="text-[8px] uppercase tracking-wider text-slate-700">Offer</p><p className="text-xs font-semibold text-emerald-300">{money(line.recommendedUnitOffer * line.quantity)}</p></div><button type="button" onClick={() => setPurchaseOrder((current) => current.filter((item) => item.id !== line.id))} aria-label={`Remove ${line.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button></div></div></div></div>)}</div>}
        {purchaseOrder.length ? <><div className="mt-5 grid grid-cols-2 gap-2"><PurchaseMetric label="Average market" value={averageMarketValue} /><PurchaseMetric label="Total market" value={totalMarketValue} /><PurchaseMetric label="Recommended offer" value={totalRecommendedOffer} accent /><PurchaseMetric label="Potential spread" value={totalMarketValue - totalRecommendedOffer} /></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><PurchaseField label="Actual amount paid" type="number" value={actualPaid} onChange={setActualPaid} placeholder="Enter total paid" /><PurchaseField label="Purchase date" type="date" value={purchaseDate} onChange={setPurchaseDate} /><PurchaseField label="Seller / source" value={sellerSource} onChange={setSellerSource} placeholder="Name, booth, store, or event" /><label className="text-[9px] font-bold uppercase tracking-wider text-slate-600 sm:col-span-2 xl:col-span-1 2xl:col-span-2">Notes<textarea value={purchaseNotes} onChange={(event) => setPurchaseNotes(event.target.value)} placeholder="Optional purchase details" rows={3} className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-black/10 px-3 py-2.5 text-xs font-normal normal-case tracking-normal text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/30" /></label></div><button type="button" onClick={finalizePurchase} disabled={finalizing} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-300 to-emerald-500 text-xs font-bold text-[#00130c] disabled:opacity-50"><PackageSearch className="h-4 w-4" />{finalizing ? "Finalizing…" : "Finalize purchase to inventory"}</button></> : null}
        {purchaseMessage ? <p className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[10px] leading-4 text-slate-400">{purchaseMessage}</p> : null}
      </section>
      </div>
    </div>
  );
}

function BuyingRateField({ label, value, onChange, active, onActivate }: { label: string; value: string; onChange: (value: string) => void; active: boolean; onActivate: () => void }) {
  return <label className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition ${active ? "border-cyan-300/20 bg-cyan-400/[0.045]" : "border-white/[0.055] bg-white/[0.018]"}`}><span className="text-xs text-slate-400">{label}</span><span className="flex h-9 w-24 items-center rounded-lg border border-white/[0.08] bg-black/15 px-3" onClick={onActivate}><input type="number" min="1" max="100" value={value} onFocus={onActivate} onChange={(event) => onChange(event.target.value)} placeholder="Set" aria-label={`${label} buying percentage`} className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-white outline-none placeholder:text-slate-700" /><span className="ml-1 text-xs text-slate-500">%</span></span></label>;
}

function PurchaseMetric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className="rounded-xl border border-white/[0.055] bg-black/10 p-3"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-700">{label}</p><p className={`mt-1 text-sm font-semibold ${accent ? "text-emerald-300" : "text-white"}`}>{money(value)}</p></div>;
}

function PurchaseField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="text-[9px] font-bold uppercase tracking-wider text-slate-600">{label}<input type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? ".01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-black/10 px-3 text-xs font-normal normal-case tracking-normal text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/30" /></label>;
}

function PriceCell({ label, value, accent = false, offer = false }: { label: string; value: number | null; accent?: boolean; offer?: boolean }) {
  return <span className={offer ? "rounded-lg border border-emerald-300/15 bg-emerald-400/[0.06] px-2 py-1.5" : ""}><span className={`block text-[8px] font-bold uppercase tracking-wider ${offer ? "text-emerald-300/70" : "text-slate-700"}`}>{label}</span><strong className={`mt-1 block text-xs ${offer ? "text-emerald-200" : accent ? "text-cyan-200" : "text-slate-300"}`}>{value === null ? "—" : money(value)}</strong></span>;
}

function InventoryPanel({ event, inventory, value, sold }: { event?: EventRecord; inventory: InventoryRecord[]; value: number; sold: number }) {
  if (!event) return <EmptyState icon={Boxes} title="No show selected" description="Create a card show before assigning inventory." />;
  if (!inventory.length) return <EmptyState icon={Boxes} title="No show inventory yet" description="Transfer or scan inventory when you are ready. Nothing is preloaded." />;
  return <section className="rounded-[24px] border border-white/[0.065] bg-[#06131d] p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Temporary inventory location</p><h2 className="mt-2 text-xl font-semibold text-white">{event?.name} · {event?.booth}</h2><p className="mt-1 text-xs text-slate-500">Stock assigned here is reserved from online availability.</p></div><div className="flex gap-2"><button className="h-10 rounded-xl border border-white/[0.08] px-4 text-xs font-semibold text-slate-300">Transfer inventory</button><button className="h-10 rounded-xl bg-cyan-400 px-4 text-xs font-bold text-[#001018]">Scan item</button></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Info icon={Boxes} label="Assigned value" value={money(value)} /><Info icon={ShoppingCart} label="Units sold" value={`${sold} units`} /><Info icon={Store} label="Location status" value="Reserved for show" /></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-white/[0.07] text-[9px] font-bold uppercase tracking-[0.14em] text-slate-700"><th className="pb-3">Inventory group</th><th className="pb-3">Category</th><th className="pb-3 text-right">Taken</th><th className="pb-3 text-right">Sold</th><th className="pb-3 text-right">Remaining</th><th className="pb-3 text-right">Assigned value</th></tr></thead><tbody>{inventory.map((item) => <tr key={item.name} className="border-b border-white/[0.045] text-xs"><td className="py-4 font-semibold text-slate-200">{item.name}</td><td className="py-4 text-slate-500">{item.category}</td><td className="py-4 text-right text-slate-400">{item.taken}</td><td className="py-4 text-right text-emerald-300">{item.sold}</td><td className="py-4 text-right text-slate-400">{item.taken - item.sold}</td><td className="py-4 text-right font-semibold text-white">{money(item.value)}</td></tr>)}</tbody></table></div></section>;
}

function SalesPanel({ sales, total, item, amount, setItem, setAmount, onRecord }: { sales: SaleRecord[]; total: number; item: string; amount: string; setItem: (v: string) => void; setAmount: (v: string) => void; onRecord: () => void }) {
  return <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]"><section className="rounded-[24px] border border-white/[0.065] bg-[#06131d] p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Fast sale</p><h2 className="mt-2 text-xl font-semibold text-white">Record a show sale</h2><label className="mt-6 block text-[10px] font-bold uppercase tracking-wider text-slate-600">Item or bundle<input value={item} onChange={(event) => setItem(event.target.value)} placeholder="Search or describe item" className="mt-2 h-12 w-full rounded-xl border border-white/[0.08] bg-black/10 px-4 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-cyan-300/30" /></label><label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-600">Sale amount<input type="number" step=".01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="$0.00" className="mt-2 h-12 w-full rounded-xl border border-white/[0.08] bg-black/10 px-4 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-cyan-300/30" /></label><div className="mt-4 grid grid-cols-3 gap-2">{["Cash", "Card", "Trade"].map((method) => <button key={method} className={`rounded-xl border py-2.5 text-xs font-semibold ${method === "Card" ? "border-cyan-300/20 bg-cyan-400/[0.07] text-cyan-200" : "border-white/[0.06] text-slate-500"}`}>{method}</button>)}</div><button onClick={onRecord} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 to-sky-500 text-xs font-bold text-[#001018]"><ReceiptText className="h-4 w-4" /> Complete sale</button></section><section className="rounded-[24px] border border-white/[0.065] bg-[#06131d] p-5 sm:p-6"><div className="flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Today</p><h2 className="mt-2 text-xl font-semibold text-white">Recent sales</h2></div><div className="text-right"><p className="text-[10px] uppercase text-slate-600">Gross sales</p><p className="mt-1 text-2xl font-semibold text-emerald-300">{money(total)}</p></div></div><div className="mt-5 space-y-2">{sales.map((sale) => <div key={sale.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.055] bg-white/[0.018] p-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/[0.07] text-emerald-300"><CircleDollarSign className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-200">{sale.item}</p><p className="mt-1 text-[10px] text-slate-600">{sale.method} · {sale.time}</p></div><strong className="text-sm text-white">{money(sale.amount)}</strong></div>)}</div></section></div>;
}

function ReportsPanel({ hasData }: { hasData: boolean; sales: number; inventoryValue: number; budget: number }) {
  if (!hasData) {
    return <EmptyState icon={BarChart3} title="No report data yet" description="Your show results will calculate from the sales, inventory, purchases, and expenses you record." />;
  }
  return <EmptyState icon={BarChart3} title="Reports are ready for your data" description="Add actual event expenses and inventory costs to calculate accurate profit and operational performance." />;
}

function EmptyState({ icon: Icon, title, description, action, onAction }: { icon: typeof CalendarDays; title: string; description: string; action?: string; onAction?: () => void }) {
  return <section className="rounded-[24px] border border-dashed border-white/[0.09] bg-[#06131d] px-6 py-14 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] text-cyan-300"><Icon className="h-6 w-6" /></span><h2 className="mt-5 text-lg font-semibold text-white">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{description}</p>{action && onAction ? <button onClick={onAction} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-400 px-5 text-xs font-bold text-[#001018]"><Plus className="h-4 w-4" />{action}</button> : null}</section>;
}

function EventModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: FormData) => void }) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><form action={onSubmit} className="w-full max-w-2xl rounded-[26px] border border-white/[0.09] bg-[#071722] p-5 shadow-[0_35px_120px_rgba(0,0,0,.55)] sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">New event</p><h2 className="mt-2 text-2xl font-semibold text-white">Add a card show</h2><p className="mt-1 text-xs text-slate-500">Create the event workspace now. Details can be updated later.</p></div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] text-slate-500"><X className="h-4 w-4" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field name="name" label="Show name" placeholder="Enter show name" required /><Field name="venue" label="Venue" placeholder="Enter venue" /><Field name="city" label="City & state" placeholder="Enter city and state" /><Field name="booth" label="Booth / table" placeholder="Enter booth or table" /><Field name="date" label="Start date" type="date" required /><Field name="endDate" label="End date" type="date" /><Field name="budget" label="Buying budget" type="number" placeholder="Enter budget" /></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-white/[0.08] px-5 text-xs font-semibold text-slate-400">Cancel</button><button type="submit" className="h-11 rounded-xl bg-cyan-400 px-5 text-xs font-bold text-[#001018]">Create show workspace</button></div></form></div>;
}

function Field({ name, label, type = "text", placeholder, required }: { name: string; label: string; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}<input name={name} type={type} placeholder={placeholder} required={required} className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/10 px-3 text-xs font-normal normal-case tracking-normal text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/30" /></label>;
}
