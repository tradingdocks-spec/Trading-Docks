"use client";
import { summarizeInventoryValues, trustedInventoryValue } from "@/lib/intelligence-provenance";
import { legacyAcquisitionWriteDecision } from "@/lib/purchase-history/legacy-gate";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BarChart3, Boxes, Check, ChevronDown, CircleDollarSign,
  FileSpreadsheet, Layers3, PackageOpen, Plus, ReceiptText, Search, Sparkles,
  TrendingUp, Upload, WalletCards, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import { PageHeader } from "../common/PageHeader";

type Purchase = {
  id: string;
  name: string;
  source: string;
  purchase_type: string;
  purchased_at: string;
  estimated_card_count: number;
  purchase_cost: number;
  additional_expenses: number;
  payment_method: string;
  status: "unsorted" | "scanning" | "listed" | "completed";
  valuation_source: string;
  cost_basis_method: string;
  notes: string;
};

type LinkedItem = {
  id: string;
  bulk_purchase_id: string | null;
  card_name: string;
  quantity: number;
  inventory_value: number | null;
  data?: unknown;
};

type Sale = {
  id: string;
  bulk_purchase_id: string;
  gross_revenue: number;
  selling_fees: number;
  shipping_cost: number;
};

type PurchaseStats = {
  scannedCards: number;
  scannedValue: number | null;
  unpricedRows: number;
  revenue: number;
  fees: number;
  remainingValue: number | null;
  projectedProfit: number | null;
  cashPosition: number;
  recovery: number;
};

const money = { format: (value: number | null) => value === null ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value) };
const whole = new Intl.NumberFormat("en-US");

export function BulkPurchasesWorkspace() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [items, setItems] = useState<LinkedItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in again to load bulk purchases.");
      setLoading(false);
      return;
    }
    const [purchaseResult, itemResult, saleResult] = await Promise.all([
      supabase.from("bulk_purchases").select("*").eq("user_id", user.id).order("purchased_at", { ascending: false }),
      supabase.from("inventory_items").select("id,bulk_purchase_id,card_name,quantity,inventory_value,data").eq("user_id", user.id),
      supabase.from("bulk_purchase_sales").select("id,bulk_purchase_id,gross_revenue,selling_fees,shipping_cost").eq("user_id", user.id),
    ]);
    const firstError = purchaseResult.error || itemResult.error || saleResult.error;
    if (firstError) {
      setError(firstError.message.includes("bulk_purchases")
        ? "Run the included bulk purchase database migration, then refresh this page."
        : firstError.message);
    } else {
      setPurchases((purchaseResult.data ?? []) as Purchase[]);
      setItems((itemResult.data ?? []) as LinkedItem[]);
      setSales((saleResult.data ?? []) as Sale[]);
      setSelectedId((current) => current || purchaseResult.data?.[0]?.id || "");
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const statsByPurchase = useMemo(() => {
    const map = new Map<string, PurchaseStats>();
    for (const purchase of purchases) {
      const linked = items.filter((item) => item.bulk_purchase_id === purchase.id);
      const linkedSales = sales.filter((sale) => sale.bulk_purchase_id === purchase.id);
      const valuation = summarizeInventoryValues(linked.map(trustedInventoryValue));
      const scannedValue = valuation.value;
      const scannedCards = linked.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const revenue = linkedSales.reduce((sum, sale) => sum + Number(sale.gross_revenue || 0), 0);
      const fees = linkedSales.reduce((sum, sale) => sum + Number(sale.selling_fees || 0) + Number(sale.shipping_cost || 0), 0);
      const investment = Number(purchase.purchase_cost) + Number(purchase.additional_expenses);
      map.set(purchase.id, {
        scannedCards, scannedValue, unpricedRows: valuation.unpricedRows, revenue, fees, remainingValue: scannedValue,
        projectedProfit: scannedValue === null || valuation.unpricedRows > 0 ? null : revenue - fees + scannedValue - investment,
        cashPosition: revenue - fees - investment,
        recovery: investment > 0 ? Math.max(0, (revenue - fees) / investment * 100) : 0,
      });
    }
    return map;
  }, [purchases, items, sales]);

  const totals = useMemo(() => purchases.reduce((acc, purchase) => {
    const stats = statsByPurchase.get(purchase.id);
    acc.invested += Number(purchase.purchase_cost) + Number(purchase.additional_expenses);
    if (stats?.scannedValue != null) acc.value = (acc.value ?? 0) + stats.scannedValue;
    acc.unpricedRows += stats?.unpricedRows ?? 0;
    acc.profit = acc.profit === null || stats?.projectedProfit == null ? null : acc.profit + stats.projectedProfit;
    acc.cards += stats?.scannedCards ?? 0;
    return acc;
  }, { invested: 0, value: null as number | null, profit: 0 as number | null, cards: 0, unpricedRows: 0 }), [purchases, statsByPurchase]);

  const visiblePurchases = purchases.filter((purchase) =>
    `${purchase.name} ${purchase.source}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = purchases.find((purchase) => purchase.id === selectedId) ?? null;
  const selectedStats = selected ? statsByPurchase.get(selected.id) : null;

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Inventory acquisition"
        title="Know what every bulk purchase is worth."
        description="Connect each collection to the cards it produced, then follow scanned value, cash recovery, and projected profit without maintaining a separate spreadsheet."
        icon={WalletCards}
        actionLabel="Add bulk purchase"
        onAction={() => setCreateOpen(true)}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href="/dashboard/inventory" className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.02] px-3 text-[11px] font-semibold text-td-secondary hover:text-td-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> Inventory
        </Link>
        <button type="button" onClick={() => setImportOpen(true)} disabled={!purchases.length} className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-accent/[0.16] bg-td-accent/[0.05] px-3 text-[11px] font-semibold text-td-accent-text disabled:opacity-40">
          <Upload className="h-3.5 w-3.5" /> Import cards to a purchase
        </button>
        <span className="ml-auto text-[11px] text-td-muted">Simple view · Advanced accounting stays optional</span>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-td-warning/20 bg-td-warning/[0.05] px-4 py-3 text-xs text-td-warning">{error}</div> : null}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CircleDollarSign} label="Total invested" value={money.format(totals.invested)} detail={`${purchases.length} purchases`} tone="cyan" />
        <Metric icon={Layers3} label="Known market subtotal" value={money.format(totals.value)} detail={`${whole.format(totals.cards)} cards linked · ${totals.unpricedRows} unpriced rows`} tone="violet" />
        <Metric icon={TrendingUp} label="Projected profit" value={money.format(totals.profit)} detail="Revenue + remaining value − costs" tone="emerald" />
        <Metric icon={PackageOpen} label="Still processing" value={String(purchases.filter((p) => p.status !== "completed").length)} detail="Unsorted, scanning, or listed" tone="amber" />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface/92 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-td-accent-text">Bulk purchases</p>
              <h2 className="mt-1 text-lg font-semibold text-td-primary">Acquisition performance</h2>
            </div>
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-black/15 px-3 sm:ml-auto sm:max-w-xs">
              <Search className="h-3.5 w-3.5 text-td-muted" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search purchase or source" className="min-w-0 flex-1 bg-transparent text-[11px] text-td-primary outline-none placeholder:text-td-muted" />
            </label>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? <Empty title="Loading purchases…" body="Connecting inventory and acquisition records." /> : null}
            {!loading && !visiblePurchases.length ? <Empty title={purchases.length ? "No matching purchases" : "No bulk purchases yet"} body={purchases.length ? "Try a different search." : "Create your first purchase, then connect cards during import or scanning."} /> : null}
            {visiblePurchases.map((purchase) => {
              const stats = statsByPurchase.get(purchase.id)!;
              const investment = Number(purchase.purchase_cost) + Number(purchase.additional_expenses);
              return (
                <button key={purchase.id} type="button" onClick={() => setSelectedId(purchase.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === purchase.id ? "border-td-accent/25 bg-td-accent/[0.055]" : "border-td-ink/[0.06] bg-black/[0.08] hover:border-td-accent/15"}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-td-accent/15 bg-td-accent/[0.05] text-td-accent-text"><Boxes className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-td-primary">{purchase.name}</p>
                        <Status value={purchase.status} />
                      </div>
                      <p className="mt-1 text-[11px] text-td-muted">{purchase.source || "No source added"} · {formatDate(purchase.purchased_at)}</p>
                    </div>
                    <ArrowRight className="mt-2 h-4 w-4 text-td-muted" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Tiny label="Paid" value={money.format(investment)} />
                    <Tiny label="Known market subtotal" value={money.format(stats.scannedValue)} />
                    <Tiny label="Projected profit" value={money.format(stats.projectedProfit)} positive={stats.projectedProfit === null ? undefined : stats.projectedProfit >= 0} />
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] font-semibold text-td-muted"><span>{whole.format(stats.scannedCards)} of {whole.format(purchase.estimated_card_count)} cards scanned</span><span>{purchase.estimated_card_count ? Math.min(100, Math.round(stats.scannedCards / purchase.estimated_card_count * 100)) : 0}%</span></div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-td-ink/[0.05]"><div className="h-full rounded-full bg-gradient-to-r from-td-accent to-td-accent" style={{ width: `${purchase.estimated_card_count ? Math.min(100, stats.scannedCards / purchase.estimated_card_count * 100) : 0}%` }} /></div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <PurchaseDetail purchase={selected} stats={selectedStats ?? null} items={items.filter((item) => item.bulk_purchase_id === selectedId)} onImport={() => setImportOpen(true)} />
      </div>

      {createOpen ? <CreatePurchaseModal onClose={() => setCreateOpen(false)} onCreated={(purchase) => { setPurchases((current) => [purchase, ...current]); setSelectedId(purchase.id); setCreateOpen(false); setNotice("Bulk purchase created. Add cards whenever you are ready."); }} /> : null}
      {importOpen ? <ImportCardsModal purchases={purchases} initialPurchaseId={selectedId} onClose={() => setImportOpen(false)} onImported={(message) => { setImportOpen(false); setNotice(message); void load(); }} /> : null}
      {notice ? <div className="fixed bottom-20 right-5 z-[160] flex max-w-sm items-center gap-2 rounded-xl border border-td-success/20 bg-td-surface/95 px-4 py-3 text-[11px] font-semibold text-td-success shadow-2xl"><Check className="h-4 w-4 text-td-success" />{notice}</div> : null}
    </WorkspaceFrame>
  );
}

function PurchaseDetail({ purchase, stats, items, onImport }: { purchase: Purchase | null; stats: PurchaseStats | null; items: LinkedItem[]; onImport: () => void }) {
  if (!purchase || !stats) return <section className="flex min-h-[430px] items-center justify-center rounded-[24px] border border-dashed border-td-ink/[0.08] bg-td-ink/[0.015] p-8 text-center"><div><ReceiptText className="mx-auto h-7 w-7 text-td-muted" /><p className="mt-3 text-sm font-semibold text-td-secondary">Select a purchase</p><p className="mt-1 text-[11px] text-td-muted">Its progress and profit story will appear here.</p></div></section>;
  const investment = Number(purchase.purchase_cost) + Number(purchase.additional_expenses);
  return <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface/92 p-5">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-td-violet">Purchase detail</p><h2 className="mt-1 text-xl font-semibold text-td-primary">{purchase.name}</h2><p className="mt-1 text-[11px] text-td-muted">{purchase.source || "Source not recorded"} · {formatDate(purchase.purchased_at)}</p></div>
      <Status value={purchase.status} />
    </div>
    <div className="mt-5 rounded-2xl border border-td-success/15 bg-td-success/[0.045] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-success">Projected total profit</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-td-primary">{money.format(stats.projectedProfit)}</p>
      <p className="mt-2 text-[11px] leading-5 text-td-muted">Actual sales + remaining scanned value − purchase cost, expenses, selling fees, and shipping.</p>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Tiny label="Total invested" value={money.format(investment)} />
      <Tiny label="Known market subtotal" value={money.format(stats.scannedValue)} />
      <Tiny label="Sales revenue" value={money.format(stats.revenue)} />
      <Tiny label="Cash position" value={money.format(stats.cashPosition)} positive={stats.cashPosition >= 0} />
    </div>
    <div className="mt-4 rounded-2xl border border-td-ink/[0.06] bg-black/10 p-4">
      <div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-td-muted">Break-even progress</p><p className="text-xs font-semibold text-td-accent-text">{Math.round(stats.recovery)}%</p></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-td-ink/[0.05]"><div className="h-full rounded-full bg-gradient-to-r from-td-accent to-td-success" style={{ width: `${Math.min(100, stats.recovery)}%` }} /></div>
      <p className="mt-2 text-[11px] text-td-muted">{money.format(Math.max(0, investment - stats.revenue + stats.fees))} in net sales remaining to recover the purchase.</p>
    </div>
    <div className="mt-4 flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-td-muted">Linked inventory</p><p className="mt-1 text-xs text-td-secondary">{whole.format(stats.scannedCards)} cards · {items.length} inventory rows</p></div><button type="button" onClick={onImport} className="inline-flex h-9 items-center gap-2 rounded-xl border border-td-accent/15 bg-td-accent/[0.05] px-3 text-[11px] font-semibold text-td-accent-text"><Upload className="h-3.5 w-3.5" /> Add cards</button></div>
    <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
      {items.slice(0, 12).map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-td-ink/[0.05] bg-black/[0.08] px-3 py-2 text-[11px]"><span className="min-w-0 truncate text-td-secondary">{item.card_name}</span><span className="ml-3 shrink-0 text-td-muted">{item.quantity} · {money.format(trustedInventoryValue(item))}</span></div>)}
      {!items.length ? <p className="rounded-xl border border-dashed border-td-ink/[0.07] px-3 py-5 text-center text-[11px] text-td-muted">No cards linked yet.</p> : null}
    </div>
  </section>;
}

function CreatePurchaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (purchase: Purchase) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [form, setForm] = useState({ name: "", source: "", purchased_at: new Date().toISOString().slice(0, 10), estimated_card_count: "5000", purchase_cost: "", additional_expenses: "0", purchase_type: "collection", payment_method: "", status: "unsorted", cost_basis_method: "proportional", notes: "" });
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    const gate = legacyAcquisitionWriteDecision();
    if (!gate.allowed) { event.preventDefault(); setError(gate.message); return; }
    event.preventDefault(); setSaving(true); setError("");
    const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sign in again to save this purchase."); setSaving(false); return; }
    const payload = { ...form, user_id: user.id, estimated_card_count: Number(form.estimated_card_count || 0), purchase_cost: Number(form.purchase_cost || 0), additional_expenses: Number(form.additional_expenses || 0) };
    const { data, error: saveError } = await supabase.from("bulk_purchases").insert(payload).select("*").single();
    if (saveError) setError(saveError.message); else onCreated(data as Purchase);
    setSaving(false);
  }
  return <Modal title="Add bulk purchase" subtitle="Start with the essentials. You can connect cards immediately or later." onClose={onClose}>
    <form onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Purchase name" required value={form.name} onChange={(v) => set("name", v)} placeholder="Phoenix Collection – July 2026" wide />
        <Field label="Amount paid" required type="number" value={form.purchase_cost} onChange={(v) => set("purchase_cost", v)} placeholder="250.00" />
        <Field label="Estimated card count" type="number" value={form.estimated_card_count} onChange={(v) => set("estimated_card_count", v)} />
        <Field label="Seller or source" value={form.source} onChange={(v) => set("source", v)} placeholder="Local collection" />
        <Field label="Purchase date" type="date" value={form.purchased_at} onChange={(v) => set("purchased_at", v)} />
        <Select label="Purchase type" value={form.purchase_type} onChange={(v) => set("purchase_type", v)} options={[["collection","Collection"],["bulk_lot","Bulk lot"],["card_show","Card show"],["store_buy","Store buy"],["trade","Trade"],["other","Other"]]} />
      </div>
      <button type="button" onClick={() => setAdvanced((v) => !v)} className="mt-4 flex h-9 items-center gap-2 text-[11px] font-semibold text-td-muted hover:text-td-primary"><ChevronDown className={`h-3.5 w-3.5 transition ${advanced ? "rotate-180" : ""}`} /> Advanced details</button>
      {advanced ? <div className="grid gap-3 rounded-2xl border border-td-ink/[0.06] bg-black/10 p-4 sm:grid-cols-2"><Field label="Additional expenses" type="number" value={form.additional_expenses} onChange={(v) => set("additional_expenses", v)} /><Field label="Payment method" value={form.payment_method} onChange={(v) => set("payment_method", v)} /><Select label="Cost basis" value={form.cost_basis_method} onChange={(v) => set("cost_basis_method", v)} options={[["proportional","Proportional by value (recommended)"],["average","Average per card"],["manual","Manual"]]} /><Field label="Notes" value={form.notes} onChange={(v) => set("notes", v)} /></div> : null}
      {error ? <p className="mt-3 text-[11px] text-td-danger">{error}</p> : null}
      <div className="mt-5 flex gap-2"><button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-td-ink/[0.08] text-[11px] font-semibold text-td-secondary">Cancel</button><button disabled={saving || !form.name || !form.purchase_cost} className="h-11 flex-[1.4] rounded-xl bg-gradient-to-b from-td-accent to-td-accent text-[11px] font-bold text-td-on-accent disabled:opacity-45">{saving ? "Creating…" : "Create purchase"}</button></div>
    </form>
  </Modal>;
}

function ImportCardsModal({ purchases, initialPurchaseId, onClose, onImported }: { purchases: Purchase[]; initialPurchaseId: string; onClose: () => void; onImported: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [purchaseId, setPurchaseId] = useState(initialPurchaseId || purchases[0]?.id || "");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function choose(file?: File) {
    if (!file) return;
    setFileName(file.name); setError("");
    file.text().then((text) => {
      const parsed = parseCsv(text);
      if (!parsed.length) setError("No inventory rows were found in this CSV.");
      setRows(parsed);
    });
  }
  async function importRows() {
    const gate = legacyAcquisitionWriteDecision();
    if (!gate.allowed) { setError(gate.message); return; }
    setSaving(true); setError("");
    const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sign in again to import inventory."); setSaving(false); return; }
    const payload = rows.map((row, index) => {
      const name = findValue(row, ["name","card name","product name","product"]);
      const quantity = Number(findValue(row, ["quantity","total quantity","add to quantity","qty"]) || 1);
      const unitValue = Number(findValue(row, ["market price","tcg market price","price","value","low price"]) || 0);
      const id = crypto.randomUUID();
      const data = { id, name, sku: findValue(row, ["sku"]), category: "Single", quantity, locationId: "", condition: findValue(row, ["condition"]), set: findValue(row, ["set code","set"]), collectorNumber: findValue(row, ["collector number","collector #"]), costBasis: 0, unitMarketValue: unitValue, value: unitValue * quantity, updatedAt: new Date().toISOString(), bulkPurchaseId: purchaseId };
      return { id, user_id: user.id, card_name: name || `Imported card ${index + 1}`, sku: data.sku, location_id: null, set_code: data.set || null, collector_number: data.collectorNumber || null, quantity, inventory_value: data.value, bulk_purchase_id: purchaseId, data };
    });
    for (let i = 0; i < payload.length; i += 500) {
      const { error: insertError } = await supabase.from("inventory_items").upsert(payload.slice(i, i + 500), { onConflict: "user_id,id" });
      if (insertError) { setError(insertError.message); setSaving(false); return; }
    }
    await supabase.from("bulk_purchases").update({ status: "scanning", updated_at: new Date().toISOString() }).eq("id", purchaseId).eq("user_id", user.id);
    onImported(`${whole.format(payload.reduce((sum, row) => sum + row.quantity, 0))} cards linked to this bulk purchase.`);
  }
  const totalValue = rows.reduce((sum, row) => sum + Number(findValue(row, ["market price","tcg market price","price","value","low price"]) || 0) * Number(findValue(row, ["quantity","total quantity","add to quantity","qty"]) || 1), 0);
  return <Modal title="Import cards to a purchase" subtitle="Choose the purchase once. Every imported inventory row will stay connected to it." onClose={onClose}>
    <Select label="Which purchase did these cards come from?" value={purchaseId} onChange={setPurchaseId} options={purchases.map((p) => [p.id, p.name])} />
    <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 flex w-full flex-col items-center rounded-2xl border border-dashed border-td-accent/20 bg-td-accent/[0.025] px-5 py-8 text-center"><FileSpreadsheet className="h-7 w-7 text-td-accent-text" /><span className="mt-3 text-xs font-semibold text-td-primary">{fileName || "Choose inventory CSV"}</span><span className="mt-1 text-[11px] text-td-muted">Card name, quantity, set, condition, and market value are detected automatically.</span></button>
    <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
    {rows.length ? <div className="mt-4 grid grid-cols-3 gap-2"><Tiny label="Rows detected" value={whole.format(rows.length)} /><Tiny label="Cards" value={whole.format(rows.reduce((s,r) => s + Number(findValue(r,["quantity","total quantity","add to quantity","qty"]) || 1),0))} /><Tiny label="Known market subtotal" value={money.format(totalValue)} /></div> : null}
    {error ? <p className="mt-3 text-[11px] text-td-danger">{error}</p> : null}
    <div className="mt-5 flex gap-2"><button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-td-ink/[0.08] text-[11px] font-semibold text-td-secondary">Cancel</button><button type="button" onClick={importRows} disabled={saving || !rows.length || !purchaseId} className="h-11 flex-[1.4] rounded-xl bg-gradient-to-b from-td-accent to-td-accent text-[11px] font-bold text-td-on-accent disabled:opacity-45">{saving ? "Importing…" : "Import and link cards"}</button></div>
  </Modal>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-td-canvas/88 p-3 backdrop-blur-xl" role="dialog" aria-modal="true"><div className="my-auto w-full max-w-2xl rounded-[26px] border border-td-ink/[0.09] bg-td-surface p-5 shadow-[0_30px_120px_rgb(var(--td-shadow-rgb)/calc(.75*var(--td-shadow-strength)))] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-td-accent-text">Guided workflow</p><h2 className="mt-2 text-xl font-semibold text-td-primary">{title}</h2><p className="mt-1 text-[11px] leading-5 text-td-muted">{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-td-ink/[0.08] text-td-muted hover:text-td-primary"><X className="h-4 w-4" /></button></div><div className="mt-5">{children}</div></div></div>;
}
function Field({ label, value, onChange, placeholder, type="text", required=false, wide=false }: { label:string; value:string; onChange:(v:string)=>void; placeholder?:string; type?:string; required?:boolean; wide?:boolean }) { return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-[11px] font-semibold text-td-muted">{label}{required ? " *" : ""}</span><input required={required} type={type} min={type==="number" ? "0" : undefined} step={type==="number" ? "0.01" : undefined} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-td-ink/[0.08] bg-td-surface px-3 text-[11px] text-td-primary outline-none placeholder:text-td-muted focus:border-td-accent/30" /></label>; }
function Select({ label, value, onChange, options }: { label:string; value:string; onChange:(v:string)=>void; options:string[][] }) { return <label><span className="mb-1.5 block text-[11px] font-semibold text-td-muted">{label}</span><select value={value} onChange={(e)=>onChange(e.target.value)} className="h-11 w-full rounded-xl border border-td-ink/[0.08] bg-td-surface px-3 text-[11px] text-td-primary outline-none">{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>; }
function Metric({ icon:Icon,label,value,detail,tone }: { icon:React.ComponentType<{className?:string}>; label:string; value:string; detail:string; tone:string }) { const colors:Record<string,string>={cyan:"text-td-accent-text border-td-accent/15 bg-td-accent/[0.05]",violet:"text-td-violet border-td-violet/15 bg-td-violet/[0.05]",emerald:"text-td-success border-td-success/15 bg-td-success/[0.05]",amber:"text-td-warning border-td-warning/15 bg-td-warning/[0.05]"}; return <div className="rounded-2xl border border-td-ink/[0.07] bg-td-surface/92 p-4"><span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${colors[tone]}`}><Icon className="h-4 w-4" /></span><p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.13em] text-td-muted">{label}</p><p className="mt-1 text-xl font-semibold text-td-primary">{value}</p><p className="mt-1 text-[11px] text-td-muted">{detail}</p></div>; }
function Tiny({label,value,positive}:{label:string;value:string;positive?:boolean}) { return <div className="rounded-xl border border-td-ink/[0.055] bg-black/[0.08] px-3 py-2.5"><p className="text-[11px] uppercase tracking-[0.1em] text-td-muted">{label}</p><p className={`mt-1 truncate text-[11px] font-semibold ${positive === undefined ? "text-td-secondary" : positive ? "text-td-success" : "text-td-danger"}`}>{value}</p></div>; }
function Status({value}:{value:Purchase["status"]}) { const labels={unsorted:"Unsorted",scanning:"Scanning",listed:"Listed",completed:"Completed"}; return <span className="shrink-0 rounded-full border border-td-ink/[0.08] bg-td-ink/[0.025] px-2 py-1 text-[11px] font-semibold text-td-secondary">{labels[value]}</span>; }
function Empty({title,body}:{title:string;body:string}) { return <div className="rounded-2xl border border-dashed border-td-ink/[0.07] px-4 py-12 text-center"><Sparkles className="mx-auto h-5 w-5 text-td-muted" /><p className="mt-3 text-xs font-semibold text-td-secondary">{title}</p><p className="mt-1 text-[11px] text-td-muted">{body}</p></div>; }
function formatDate(value:string) { return new Date(`${value}T12:00:00`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function findValue(row:Record<string,string>, names:string[]) { for(const name of names){const key=Object.keys(row).find(k=>k.trim().toLowerCase()===name);if(key && row[key] !== undefined)return row[key].replace(/[$,]/g,"").trim();} return ""; }
function parseCsv(text:string) { const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean); if(lines.length<2)return []; const parse=(line:string)=>{const out:string[]=[];let current="",quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){current+='"';i++;}else if(c==='"'){quoted=!quoted;}else if(c===","&&!quoted){out.push(current);current="";}else current+=c;}out.push(current);return out;}; const headers=parse(lines[0]); return lines.slice(1).map(line=>Object.fromEntries(parse(line).map((value,index)=>[headers[index]||`column_${index}`,value]))).filter(row=>Object.values(row).some(Boolean)); }
