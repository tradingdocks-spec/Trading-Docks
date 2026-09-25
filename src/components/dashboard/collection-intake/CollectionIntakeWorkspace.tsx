"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Loader2,
  PackagePlus,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";
import {
  calculateCollectionValuation,
  COLLECTION_INTAKE_SCENARIOS,
  inferReviewState,
  normalizeNullableMoney,
  normalizeQuantity,
  normalizeScenario,
  type CollectionIntake,
  type CollectionIntakeItem,
  type CollectionIntakeScenarioKey,
} from "@/lib/collection-intake/domain";

const EMPTY_ITEM: Omit<CollectionIntakeItem, "id"> = {
  cardName: "",
  gameId: "magic",
  productType: "card",
  setCode: "",
  collectorNumber: "",
  scryfallId: null,
  tcgplayerProductId: null,
  tcgplayerSkuId: null,
  condition: null,
  finish: null,
  language: "",
  quantity: 1,
  unitMarketValue: null,
  reviewState: "unresolved_identity",
  notes: "",
};

type IntakeRow = CollectionIntakeItem & {
  unitMarketValueInput: string;
  quantityInput: string;
};

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function newRow(patch: Partial<CollectionIntakeItem> = {}): IntakeRow {
  const item = {
    ...EMPTY_ITEM,
    ...patch,
    id: patch.id ?? crypto.randomUUID(),
  };
  const reviewState = patch.reviewState ?? inferReviewState(item);
  return {
    ...item,
    reviewState,
    quantityInput: String(item.quantity || 1),
    unitMarketValueInput: item.unitMarketValue === null || item.unitMarketValue === undefined ? "" : String(item.unitMarketValue),
  };
}

function rowToItem(row: IntakeRow): CollectionIntakeItem {
  const item: CollectionIntakeItem = {
    id: row.id,
    cardName: row.cardName.trim(),
    gameId: row.gameId.trim() || "magic",
    productType: row.productType,
    setCode: row.setCode?.trim() || null,
    collectorNumber: row.collectorNumber?.trim() || null,
    scryfallId: row.scryfallId?.trim() || null,
    tcgplayerProductId: row.tcgplayerProductId,
    tcgplayerSkuId: row.tcgplayerSkuId,
    condition: row.condition?.trim() || null,
    finish: row.finish?.trim() || null,
    language: row.language.trim(),
    quantity: normalizeQuantity(row.quantityInput),
    unitMarketValue: normalizeNullableMoney(row.unitMarketValueInput),
    reviewState: row.reviewState,
    notes: row.notes.trim(),
  };
  return {
    ...item,
    reviewState: item.reviewState === "ready" ? inferReviewState(item) : item.reviewState,
  };
}

export function CollectionIntakeWorkspace() {
  const [intakeId, setIntakeId] = useState<string | null>(() => crypto.randomUUID());
  const [revision, setRevision] = useState(0);
  const [title, setTitle] = useState("Walk-in collection");
  const [sellerName, setSellerName] = useState("");
  const [sellerContact, setSellerContact] = useState("");
  const [notes, setNotes] = useState("");
  const [scenarioKey, setScenarioKey] = useState<CollectionIntakeScenarioKey>("standard");
  const [actualOfferInput, setActualOfferInput] = useState("");
  const [rows, setRows] = useState<IntakeRow[]>([newRow()]);
  const [savedIntakes, setSavedIntakes] = useState<CollectionIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const completionBusy = useRef(false);
  const pendingCompletion = useRef<{ intakeId: string; offer: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadIntakes();
  }, []);

  const items = useMemo(() => rows.map(rowToItem).filter((item) => item.quantity > 0), [rows]);
  const scenario = useMemo(() => normalizeScenario(scenarioKey), [scenarioKey]);
  const actualOffer = actualOfferInput.trim() ? Number(actualOfferInput) : null;
  const valuation = useMemo(() => calculateCollectionValuation({
    items,
    scenario,
    actualOffer,
  }), [actualOffer, items, scenario]);
  const canComplete = items.length > 0 && valuation.blockingReviewCount === 0 && !completing && !saving;

  async function loadIntakes() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/collection-intake", { credentials: "same-origin" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Collection Intake could not be loaded.");
        return;
      }
      const intakes = Array.isArray(payload.intakes) ? payload.intakes as CollectionIntake[] : [];
      setSavedIntakes(intakes);
      const open = intakes.find((intake) => intake.status !== "purchased" && intake.status !== "archived");
      if (open) loadDraft(open);
    } finally {
      setLoading(false);
    }
  }

  function loadDraft(intake: CollectionIntake) {
    setIntakeId(intake.id);
    setRevision(intake.revision ?? 0);
    setTitle(intake.title);
    setSellerName(intake.sellerName);
    setSellerContact(intake.sellerContact);
    setScenarioKey(intake.scenarioKey);
    setActualOfferInput(intake.actualOffer === null ? "" : String(intake.actualOffer));
    setNotes(intake.notes);
    setRows(intake.items.length ? intake.items.map((item) => newRow(item)) : [newRow()]);
    setNotice(`Recovered ${intake.title}.`);
  }

  function updateRow(id: string, patch: Partial<IntakeRow>) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, ...patch };
      return { ...next, reviewState: patch.reviewState ?? inferReviewState(rowToItem(next)) };
    }));
  }

  async function saveDraft(nextStatus?: "evaluating" | "offer_ready" | "declined" | "archived") {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/collection-intake", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          intake: {
            id: intakeId,
            revision,
            title,
            sellerName,
            sellerContact,
            scenarioKey,
            actualOffer,
            notes,
            status: nextStatus,
            items,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.message ?? payload.error ?? "Collection intake could not be saved.");
        return null;
      }
      setIntakeId(payload.intakeId);
      setRevision(payload.revision);
      setNotice(`Saved ${payload.itemCount ?? items.length} line${(payload.itemCount ?? items.length) === 1 ? "" : "s"}.`);
      return String(payload.intakeId);
    } catch {
      setError("Save response unavailable. Reload the saved intake before retrying.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function completePurchase() {
    if (!canComplete || completionBusy.current) return;
    completionBusy.current = true;
    setCompleting(true);
    setError("");
    setNotice("");
    try {
      const pending = pendingCompletion.current?.intakeId === intakeId ? pendingCompletion.current : null;
      const existing = savedIntakes.find((intake) => intake.id === intakeId && intake.purchaseLedgerId);
      const offer = pending?.offer ?? existing?.actualOffer ?? actualOffer ?? valuation.calculatedMaxOffer;
      const confirmed = window.confirm(`${pending ? "Retry" : "Complete"} this collection purchase for ${money(offer)}? This records the purchase and physical receipt. A retry cannot create another purchase.`);
      if (!confirmed) return;
      const savedId = pending?.intakeId ?? existing?.id ?? await saveDraft("offer_ready");
      if (!savedId) return;
      // Retain the exact request after an uncertain response; do not try to
      // re-save a draft that the server may already have finalized.
      pendingCompletion.current = { intakeId: savedId, offer };
      const response = await fetch("/api/collection-intake", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          completion: {
            intakeId: savedId,
            actualOffer: offer,
            idempotencyKey: `collection-intake:${savedId}:complete`,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.message ?? payload.error ?? "Collection purchase could not be completed.");
        return;
      }
      pendingCompletion.current = null;
      setNotice("Purchase completed. Inventory rows and event history were created.");
      await loadIntakes();
    } catch {
      setError("Completion response unavailable. Retry this same purchase to recover its authoritative result; do not create a new intake.");
    } finally {
      completionBusy.current = false;
      setCompleting(false);
    }
  }

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Acquire / Collection Intake"
        title="Collection Intake"
        description="Model a collection buy from exact-card valuation through offer, cost allocation, inventory creation, and event history."
        icon={ClipboardCheck}
        actionLabel="New intake"
        onAction={() => {
          setIntakeId(crypto.randomUUID());
          setRevision(0);
          setTitle("Walk-in collection");
          setSellerName("");
          setSellerContact("");
          setNotes("");
          setScenarioKey("standard");
          setActualOfferInput("");
          setRows([newRow()]);
          setNotice("Started a new intake draft.");
        }}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className={`${styles.glassPanel} min-w-0 rounded-[18px] p-4 sm:p-5`}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Intake name" value={title} onChange={setTitle} />
            <Field label="Seller" value={sellerName} onChange={setSellerName} />
            <Field label="Contact" value={sellerContact} onChange={setSellerContact} />
            <label className="grid gap-1.5 text-xs font-semibold text-td-secondary">
              Scenario
              <select
                value={scenarioKey}
                onChange={(event) => setScenarioKey(event.target.value as CollectionIntakeScenarioKey)}
                className="h-10 rounded-xl border border-td-ink/[0.08] bg-td-canvas/80 px-3 text-sm text-td-primary outline-none focus:border-td-accent/40"
              >
                <option value="conservative">Conservative</option>
                <option value="standard">Standard</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.12em] text-td-primary">Intake lines</h2>
              <p className="mt-1 text-xs text-td-secondary">Keep exact printing, condition, finish, and language separate. Ambiguous rows stay in review.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/purchasing-intelligence?action=add-inventory" className="td-button-secondary h-10 px-3 text-xs">
                <Search className="h-4 w-4" />
                Product lookup
              </Link>
              <button type="button" onClick={() => setRows((current) => [...current, newRow()])} className="td-button-primary h-10 px-3 text-xs">
                <Plus className="h-4 w-4" />
                Add line
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-td-ink/[0.06]">
            <table className="min-w-[980px] w-full border-collapse text-left">
              <thead className="bg-td-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-td-secondary">
                <tr>
                  <th className="px-3 py-3">Card / product</th>
                  <th className="px-3 py-3">Printing</th>
                  <th className="px-3 py-3">Condition</th>
                  <th className="px-3 py-3">Finish</th>
                  <th className="px-3 py-3">Qty</th>
                  <th className="px-3 py-3">Market</th>
                  <th className="px-3 py-3">Review</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-td-ink/[0.05]">
                {rows.map((row) => (
                  <tr key={row.id} className="bg-td-canvas/20 align-top">
                    <td className="px-3 py-3">
                      <input value={row.cardName} onChange={(event) => updateRow(row.id, { cardName: event.target.value })} placeholder="Card name" className="td-input h-10 w-56" />
                      <input value={row.language} onChange={(event) => updateRow(row.id, { language: event.target.value })} placeholder="Language" className="td-input mt-2 h-9 w-32 text-xs" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <input value={row.setCode ?? ""} onChange={(event) => updateRow(row.id, { setCode: event.target.value })} placeholder="Set" className="td-input h-10 w-20 uppercase" />
                        <input value={row.collectorNumber ?? ""} onChange={(event) => updateRow(row.id, { collectorNumber: event.target.value })} placeholder="#" className="td-input h-10 w-24" />
                      </div>
                      <input value={row.tcgplayerProductId ?? ""} onChange={(event) => updateRow(row.id, { tcgplayerProductId: Number(event.target.value) || null })} placeholder="TCGplayer ID" className="td-input mt-2 h-9 w-36 text-xs" />
                    </td>
                    <td className="px-3 py-3">
                      <input value={row.condition ?? ""} onChange={(event) => updateRow(row.id, { condition: event.target.value })} className="td-input h-10 w-32" />
                    </td>
                    <td className="px-3 py-3">
                      <select value={row.finish ?? ""} onChange={(event) => updateRow(row.id, { finish: event.target.value })} className="h-10 rounded-xl border border-td-ink/[0.08] bg-td-canvas/80 px-3 text-sm text-td-primary outline-none">
                        <option value="">Unknown</option>
                        <option value="nonfoil">Nonfoil</option>
                        <option value="foil">Foil</option>
                        <option value="etched">Etched</option>
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <input value={row.quantityInput} onChange={(event) => updateRow(row.id, { quantityInput: event.target.value })} inputMode="numeric" className="td-input h-10 w-20" />
                    </td>
                    <td className="px-3 py-3">
                      <input value={row.unitMarketValueInput} onChange={(event) => updateRow(row.id, { unitMarketValueInput: event.target.value })} inputMode="decimal" placeholder="0.00" className="td-input h-10 w-24" />
                      <p className="mt-1 text-[11px] text-td-muted">{money((normalizeNullableMoney(row.unitMarketValueInput) ?? 0) * normalizeQuantity(row.quantityInput))}</p>
                    </td>
                    <td className="px-3 py-3">
                      <ReviewBadge state={row.reviewState} />
                      {row.reviewState !== "ready" ? (
                        <button type="button" onClick={() => updateRow(row.id, { reviewState: "ready" })} className="mt-2 text-[11px] font-semibold text-td-accent-text hover:text-td-accent-text">
                          Mark reviewed
                        </button>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="rounded-lg p-2 text-td-muted transition hover:bg-td-danger/10 hover:text-td-danger" aria-label="Remove line">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="mt-4 grid gap-1.5 text-xs font-semibold text-td-secondary">
            Purchase notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="rounded-xl border border-td-ink/[0.08] bg-td-canvas/80 px-3 py-2 text-sm text-td-primary outline-none focus:border-td-accent/40" />
          </label>

          {error ? <Status tone="red" text={error} /> : null}
          {notice ? <Status tone="cyan" text={notice} /> : null}
        </section>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className={`${styles.glassPanel} rounded-[18px] p-4 sm:p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="td-kicker">Running valuation</p>
                <h2 className="mt-2 text-2xl font-black text-td-primary">{money(valuation.marketValue)}</h2>
                <p className="mt-1 text-xs text-td-secondary">{valuation.totalQuantity} cards / {valuation.uniqueLines} exact lines</p>
              </div>
              <Database className="h-5 w-5 text-td-accent-text" />
            </div>

            <div className="mt-4 grid gap-2">
              <Metric label="Expected gross realization" value={money(valuation.sellableValue)} />
              <Metric label="Selling costs" value={money(valuation.sellingCosts)} />
              <Metric label="Desired profit" value={money(valuation.desiredProfit)} />
              <Metric label="Calculated max offer" value={money(valuation.calculatedMaxOffer)} strong />
            </div>

            <label className="mt-4 grid gap-1.5 text-xs font-semibold text-td-secondary">
              Your offer
              <input value={actualOfferInput} onChange={(event) => setActualOfferInput(event.target.value)} placeholder={String(valuation.calculatedMaxOffer)} inputMode="decimal" className="td-input h-11 text-base font-bold" />
            </label>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Mini label="Profit" value={money(valuation.expectedProfit)} />
              <Mini label="ROI" value={percent(valuation.roiPercent)} />
              <Mini label="% market" value={percent(valuation.offerPercentOfMarket)} />
            </div>

            <div className="mt-4 rounded-2xl bg-td-canvas/45 p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-td-secondary">Review queue</p>
              <div className="mt-3 grid gap-2 text-xs">
                <Metric label="Blocking" value={String(valuation.blockingReviewCount)} />
                <Metric label="Warnings" value={String(valuation.warningReviewCount)} />
                <Metric label="Pricing coverage" value={percent(valuation.pricingCoveragePercent)} />
                <Metric label="Top line concentration" value={percent(valuation.topCardSharePercent)} />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button type="button" onClick={() => void saveDraft()} disabled={saving} className="td-button-secondary h-11 w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save draft
              </button>
              <button type="button" onClick={() => void completePurchase()} disabled={!canComplete} className="td-button-primary h-11 w-full">
                {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                Complete purchase
              </button>
              {!canComplete && valuation.blockingReviewCount > 0 ? (
                <p className="text-xs text-td-warning">Resolve blocking review lines before inventory creation.</p>
              ) : null}
            </div>
          </div>

          <div className={`${styles.glassPanel} mt-4 rounded-[18px] p-4`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-td-secondary">Recent intakes</p>
              <button type="button" onClick={() => void loadIntakes()} className="rounded-lg p-1.5 text-td-secondary hover:bg-td-ink/[0.06] hover:text-td-primary" aria-label="Refresh intakes">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {savedIntakes.slice(0, 5).map((intake) => (
                <button key={intake.id} type="button" onClick={() => loadDraft(intake)} className="rounded-xl border border-td-ink/[0.06] bg-td-ink/[0.03] p-3 text-left transition hover:border-td-accent/20 hover:bg-td-accent/[0.04]">
                  <span className="block text-sm font-bold text-td-primary">{intake.title}</span>
                  <span className="mt-1 block text-xs text-td-secondary">{intake.status.replaceAll("_", " ")} / {intake.items.length} lines</span>
                </button>
              ))}
              {!savedIntakes.length ? <p className="text-xs text-td-muted">No server-backed intakes yet.</p> : null}
            </div>
          </div>
        </aside>
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[18px] p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="td-kicker">Completion contract</p>
            <h2 className="mt-2 text-lg font-black text-td-primary">Inventory creation is tied to purchase history and event history.</h2>
            <p className="mt-2 max-w-3xl text-sm text-td-secondary">
              Completion uses the existing inventory mutation authority, allocates cost proportionally by market value, and writes source-linked inventory events. Missing prices are warnings; unresolved identity, ambiguous printing, unknown condition/finish, and high-value review are blockers.
            </p>
          </div>
          <div className="flex gap-2 text-xs font-semibold text-td-secondary">
            <Pill icon={ShieldCheck} text="User/workspace scoped" />
            <Pill icon={CheckCircle2} text="Idempotent completion" />
            <Pill icon={AlertTriangle} text="Review queue enforced" />
          </div>
        </div>
      </section>
    </WorkspaceFrame>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-td-secondary">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="td-input h-10" />
    </label>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-td-secondary">{label}</span>
      <span className={strong ? "text-sm font-black text-td-accent-text" : "text-sm font-bold text-td-primary"}>{value}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-td-ink/[0.04] p-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-td-muted">{label}</p>
      <p className="mt-1 text-sm font-black text-td-primary">{value}</p>
    </div>
  );
}

function ReviewBadge({ state }: { state: CollectionIntakeItem["reviewState"] }) {
  const ready = state === "ready";
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${ready ? "bg-td-success/10 text-td-success" : state === "missing_price" ? "bg-td-warning/10 text-td-warning" : "bg-td-danger/10 text-td-danger"}`}>
      {state.replaceAll("_", " ")}
    </span>
  );
}

function Status({ tone, text }: { tone: "red" | "cyan"; text: string }) {
  return (
    <div className={`mt-4 rounded-xl border px-3 py-2 text-sm ${tone === "red" ? "border-td-danger/20 bg-td-danger/10 text-td-danger" : "border-td-accent/20 bg-td-accent/10 text-td-accent-text"}`}>
      {text}
    </div>
  );
}

function Pill({ icon: Icon, text }: { icon: ComponentType<{ className?: string }>; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-td-ink/[0.05] px-3 py-1.5">
      <Icon className="h-3.5 w-3.5 text-td-accent-text" />
      {text}
    </span>
  );
}
