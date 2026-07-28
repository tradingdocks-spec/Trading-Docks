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
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";

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
  const [sales, setSales] = useState<SaleRecord[]>(starterSales);
  const [inventory, setInventory] = useState<InventoryRecord[]>(starterInventory);
  const [saleItem, setSaleItem] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("td-card-shows-v2");
      if (!saved) return;
      const parsed = JSON.parse(saved) as { events?: EventRecord[]; rates?: [string, string] | [number, number]; sales?: SaleRecord[]; inventory?: InventoryRecord[] };
      if (parsed.events) setEvents(parsed.events);
      if (parsed.rates) {
        setSingleRate(String(parsed.rates[0] ?? ""));
        setSealedRate(String(parsed.rates[1] ?? ""));
      }
      if (parsed.sales) setSales(parsed.sales);
      if (parsed.inventory) setInventory(parsed.inventory);
    } catch {}
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "td-card-shows-v2",
      JSON.stringify({ events, rates: [singleRate, sealedRate], sales, inventory }),
    );
  }, [events, singleRate, sealedRate, sales, inventory]);

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
            <Overview event={selectedEvent} events={events} salesTotal={salesTotal} inventoryValue={inventoryValue} unitsSold={unitsSold} onChooseEvent={setSelectedEventId} onNavigate={setTab} onAdd={() => setShowEventForm(true)} />
          ) : null}
          {tab === "calendar" ? <CalendarPanel events={events} onAdd={() => setShowEventForm(true)} /> : null}
          {tab === "lookup" ? (
            <LookupPanel
              query={lookupQuery}
              setQuery={setLookupQuery}
              type={lookupType}
              setType={setLookupType}
              marketPrice={marketPrice}
              setMarketPrice={setMarketPrice}
              rate={rate}
              setRate={lookupType === "single" ? setSingleRate : setSealedRate}
              singleRate={singleRate}
              sealedRate={sealedRate}
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

function Overview({ event, events, salesTotal, inventoryValue, unitsSold, onChooseEvent, onNavigate, onAdd }: { event?: EventRecord; events: EventRecord[]; salesTotal: number; inventoryValue: number; unitsSold: number; onChooseEvent: (id: string) => void; onNavigate: (tab: Tab) => void; onAdd: () => void }) {
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
              <button key={item.id} onClick={() => onChooseEvent(item.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${event?.id === item.id ? "border-cyan-300/20 bg-cyan-400/[0.06]" : "border-white/[0.05] bg-white/[0.015] hover:border-white/[0.1]"}`}>
                <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-black/10"><strong className="text-sm text-white">{new Date(`${item.startDate}T12:00:00`).getDate()}</strong><span className="text-[8px] font-bold uppercase tracking-wider text-cyan-300">{new Date(`${item.startDate}T12:00:00`).toLocaleString("en-US", { month: "short" })}</span></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-200">{item.name}</span><span className="mt-1 block truncate text-[10px] text-slate-600">{item.city} · {item.booth}</span></span>
                <ChevronRight className="h-4 w-4 text-slate-700" />
              </button>
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

function CalendarPanel({ events, onAdd }: { events: EventRecord[]; onAdd: () => void }) {
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
          return <div key={index} className={`min-h-24 border-b border-r border-white/[0.045] p-2 sm:min-h-28 ${!inMonth ? "bg-black/10 text-slate-800" : "text-slate-500"}`}><span className="text-[10px] font-semibold">{inMonth ? day : ""}</span>{event ? <div className="mt-2 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08] p-2 text-[9px] font-semibold leading-4 text-cyan-100"><span className="hidden sm:inline">{event.name}</span><span className="sm:hidden">Show</span></div> : null}</div>;
        })}
      </div>
    </section>
  );
}

function LookupPanel({ query, setQuery, type, setType, marketPrice, setMarketPrice, rate, setRate, singleRate, sealedRate, offer, onSave }: { query: string; setQuery: (v: string) => void; type: "single" | "sealed"; setType: (v: "single" | "sealed") => void; marketPrice: string; setMarketPrice: (v: string) => void; rate: string; setRate: (v: string) => void; singleRate: string; sealedRate: string; offer: number | null; onSave: () => void }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.8fr]">
      <section className="rounded-[24px] border border-white/[0.065] bg-[#06131d] p-5 sm:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Buying desk</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Know your number before you buy.</h2><p className="mt-2 text-sm text-slate-500">Look up a single or sealed product and calculate your maximum offer instantly.</p>
        <div className="mt-6 flex rounded-xl border border-white/[0.07] bg-black/10 p-1">{(["single", "sealed"] as const).map((item) => <button key={item} onClick={() => setType(item)} className={`flex-1 rounded-lg py-2.5 text-xs font-bold capitalize transition ${type === item ? "bg-cyan-400/[0.12] text-cyan-200 shadow-[inset_0_0_0_1px_rgba(103,232,249,.17)]" : "text-slate-600"}`}>{item === "single" ? "Singles" : "Sealed products"}</button>)}</div>
        <label className="mt-4 block"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Card or product</span><span className="mt-2 flex h-12 items-center gap-3 rounded-xl border border-white/[0.08] bg-black/10 px-4 focus-within:border-cyan-300/30"><Search className="h-4 w-4 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={type === "single" ? "Search Sheoldred, the Apocalypse…" : "Search Commander Masters Collector Booster…"} className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-700" /></span></label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label><span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Current market price</span><span className="mt-2 flex h-12 items-center rounded-xl border border-white/[0.08] bg-black/10 px-4"><span className="mr-1 text-sm text-slate-600">$</span><input type="number" step=".01" value={marketPrice} onChange={(event) => setMarketPrice(event.target.value)} className="w-full bg-transparent text-sm font-semibold text-white outline-none" /></span></label>
          <label><span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Buying percentage</span><span className="mt-2 flex h-12 items-center rounded-xl border border-white/[0.08] bg-black/10 px-4"><input type="number" min="1" max="100" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="Enter target" className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-700" /><span className="text-sm text-slate-600">%</span></span></label>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,.09),rgba(14,165,233,.025))] p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Maximum cash offer</p><p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">{offer === null ? "—" : money(offer)}</p><p className="mt-1 text-xs text-slate-500">{offer === null ? "Enter a market price and buying percentage." : `${money(Number(marketPrice))} market × ${rate}% target`}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-slate-600">Target gross margin</p><p className="mt-1 text-xl font-semibold text-emerald-300">{rate ? `${100 - Number(rate)}%` : "—"}</p></div></div></div>
      </section>
      <section className="rounded-[24px] border border-white/[0.065] bg-[#06131d] p-5 sm:p-6">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-400/[0.07] text-violet-300"><Settings2 className="h-5 w-5" /></span><div><h3 className="text-sm font-semibold text-white">Buying rules</h3><p className="mt-1 text-[10px] text-slate-600">Applied automatically at this show</p></div></div>
        <div className="mt-5 space-y-3">{[{ label: "Singles", value: singleRate }, { label: "Sealed products", value: sealedRate }].map((rule) => <div key={rule.label} className="flex items-center justify-between rounded-xl border border-white/[0.055] bg-white/[0.018] px-4 py-3"><span className="text-xs text-slate-400">{rule.label}</span><strong className="text-sm text-white">{rule.value ? `${rule.value}%` : "Not set"}</strong></div>)}</div>
        <button onClick={onSave} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/[0.07] text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/[0.12]"><Check className="h-4 w-4" /> Save show buying targets</button>
      </section>
    </div>
  );
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
