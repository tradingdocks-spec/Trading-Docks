"use client";

import { useMemo, useState } from "react";
import {
  Calculator,
  Plus,
  ReceiptText,
  RotateCcw,
  Trash2,
} from "lucide-react";

import {
  BULK_RATE_PRESETS,
  calculateBulkRowOffer,
  summarizeBulkOffer,
  type BulkAdjustment,
  type BulkRateBasis,
} from "@/lib/bulk-buying-calculator";
import {
  createBulkPurchaseInput,
  PAYMENT_METHOD_LABELS,
  PURCHASE_STATUS_LABELS,
  type PurchasePaymentMethod,
  type PurchaseStatus,
} from "@/lib/purchase-history/ledger";

type CalculatorRow = {
  id: string;
  category: string;
  quantity: string;
  rate: string;
  basis: BulkRateBasis;
};

const basisLabels: Record<BulkRateBasis, string> = {
  each: "Each",
  per100: "Per 100",
  per1000: "Per 1,000",
};

const createBlankRow = (): CalculatorRow => ({
  id: crypto.randomUUID(),
  category: "",
  quantity: "",
  rate: "",
  basis: "each",
});

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("en-US");

function cleanNumericInput(value: string, allowSigned = false) {
  const allowed = allowSigned ? /[^0-9.,-]/g : /[^0-9.,]/g;
  return value.replace(allowed, "");
}

export function BulkBuyingCalculator() {
  const [rows, setRows] = useState<CalculatorRow[]>([createBlankRow()]);
  const [adjustment, setAdjustment] = useState<BulkAdjustment>({
    mode: "amount",
    value: "",
    label: "",
  });
  const [sellerName, setSellerName] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PurchasePaymentMethod>("unknown");
  const [purchaseStatus, setPurchaseStatus] =
    useState<PurchaseStatus>("pending");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const summary = useMemo(
    () => summarizeBulkOffer(rows, adjustment),
    [rows, adjustment],
  );

  function updateRow(id: string, patch: Partial<CalculatorRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addPreset(index: number) {
    const preset = BULK_RATE_PRESETS[index];
    setRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        category: preset.category,
        quantity: "",
        rate: String(preset.rate),
        basis: preset.basis,
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((current) =>
      current.length === 1 ? [createBlankRow()] : current.filter((row) => row.id !== id),
    );
  }

  function resetCalculator() {
    setRows([createBlankRow()]);
    setAdjustment({ mode: "amount", value: "", label: "" });
    setSellerName("");
    setPaymentMethod("unknown");
    setPurchaseStatus("pending");
    setNotes("");
    setSaveMessage("");
  }

  async function savePurchase() {
    const purchase = createBulkPurchaseInput({
      rows,
      adjustment,
      sellerName,
      paymentMethod,
      status: purchaseStatus,
      notes,
    });

    if (!purchase.lines.length || purchase.totalCost <= 0) {
      setSaveMessage("Add at least one priced bulk category before saving.");
      return;
    }

    setSaving(true);
    setSaveMessage("Saving purchase record...");
    try {
      const response = await fetch("/api/purchase-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-purchase",
          purchase,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.message ?? payload.error ?? "Purchase could not be saved.",
        );
      }
      setSaveMessage("Purchase saved to Purchase History. Inventory was not changed.");
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Purchase could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-td-canvas px-4 py-5 text-td-primary sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="rounded-[24px] border border-td-accent/[0.12] bg-td-surface p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-td-accent/[0.14] bg-td-accent/[0.05] text-td-accent-text">
                <Calculator className="h-5 w-5" />
              </div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
                Bulk Buying
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-td-primary sm:text-4xl">
                Build a clean bulk offer before money changes hands.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-td-secondary">
                Add flexible categories, set your live buy rates, and use the
                subtotal, adjustment, and final offer as a purchasing worksheet.
              </p>
            </div>
            <button
              type="button"
              onClick={resetCalculator}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-ink/[0.1] bg-td-ink/[0.03] px-4 text-xs font-semibold text-td-primary transition hover:border-td-accent/30 hover:text-td-accent-text focus:outline-none focus:ring-2 focus:ring-td-accent/50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset calculator
            </button>
          </div>
        </header>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="rounded-[22px] border border-td-ink/[0.08] bg-td-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-td-primary">
                    Quick-add rate presets
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-td-muted">
                    Defaults are editable after they are added.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {BULK_RATE_PRESETS.map((preset, index) => (
                  <button
                    key={`${preset.category}-${preset.basis}`}
                    type="button"
                    onClick={() => addPreset(index)}
                    className="rounded-2xl border border-td-ink/[0.08] bg-td-ink/[0.025] p-4 text-left transition hover:border-td-accent/30 hover:bg-td-accent/[0.04] focus:outline-none focus:ring-2 focus:ring-td-accent/50"
                  >
                    <span className="block text-sm font-semibold text-td-primary">
                      {preset.category}
                    </span>
                    <span className="mt-2 block text-xs text-td-accent-text">
                      {currency.format(preset.rate)} {basisLabels[preset.basis].toLowerCase()}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[22px] border border-td-ink/[0.08] bg-td-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-td-primary">
                    Offer worksheet
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-td-muted">
                    Empty rows and invalid negative values are ignored.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRows((current) => [...current, createBlankRow()])}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-bold text-td-on-accent transition hover:bg-td-accent-hover focus:outline-none focus:ring-2 focus:ring-td-accent"
                >
                  <Plus className="h-4 w-4" />
                  Add bulk category
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {rows.map((row, index) => {
                  const rowOffer = calculateBulkRowOffer(row);

                  return (
                    <div
                      key={row.id}
                      className="grid gap-3 rounded-2xl border border-td-ink/[0.08] bg-td-surface p-3 md:grid-cols-[minmax(160px,1.2fr)_120px_120px_130px_130px_42px]"
                    >
                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                          Category
                        </span>
                        <input
                          value={row.category}
                          onChange={(event) =>
                            updateRow(row.id, { category: event.target.value })
                          }
                          placeholder={`Category ${index + 1}`}
                          className="h-11 w-full rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.035] px-3 text-sm text-td-primary outline-none transition placeholder:text-td-muted focus:border-td-accent/50 focus:ring-2 focus:ring-td-accent/20"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                          Quantity
                        </span>
                        <input
                          value={row.quantity}
                          onChange={(event) =>
                            updateRow(row.id, {
                              quantity: cleanNumericInput(event.target.value),
                            })
                          }
                          inputMode="numeric"
                          placeholder="0"
                          className="h-11 w-full rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.035] px-3 text-sm text-td-primary outline-none transition placeholder:text-td-muted focus:border-td-accent/50 focus:ring-2 focus:ring-td-accent/20"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                          Rate
                        </span>
                        <input
                          value={row.rate}
                          onChange={(event) =>
                            updateRow(row.id, {
                              rate: cleanNumericInput(event.target.value),
                            })
                          }
                          inputMode="decimal"
                          placeholder="0.00"
                          className="h-11 w-full rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.035] px-3 text-sm text-td-primary outline-none transition placeholder:text-td-muted focus:border-td-accent/50 focus:ring-2 focus:ring-td-accent/20"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                          Rate basis
                        </span>
                        <select
                          value={row.basis}
                          onChange={(event) =>
                            updateRow(row.id, {
                              basis: event.target.value as BulkRateBasis,
                            })
                          }
                          className="h-11 w-full rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-sm text-td-primary outline-none transition focus:border-td-accent/50 focus:ring-2 focus:ring-td-accent/20"
                        >
                          {Object.entries(basisLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="space-y-1.5">
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                          Offer
                        </span>
                        <div className="flex h-11 items-center rounded-xl border border-td-accent/[0.12] bg-td-accent/[0.045] px-3 text-sm font-semibold text-td-accent-text">
                          {currency.format(rowOffer)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        aria-label={`Remove ${row.category || `category ${index + 1}`}`}
                        className="flex h-11 w-11 items-center justify-center self-end rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.025] text-td-muted transition hover:border-td-danger/30 hover:text-td-danger focus:outline-none focus:ring-2 focus:ring-td-danger/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[22px] border border-td-ink/[0.08] bg-td-surface p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-td-accent/[0.12] bg-td-accent/[0.04] text-td-accent-text">
                  <ReceiptText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-td-primary">
                    Optional adjustment
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-td-muted">
                    Add premiums, deductions, or rounding notes without changing
                    category rates.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[140px_160px_minmax(0,1fr)]">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                    Type
                  </span>
                  <select
                    value={adjustment.mode}
                    onChange={(event) =>
                      setAdjustment((current) => ({
                        ...current,
                        mode: event.target.value as BulkAdjustment["mode"],
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-sm text-td-primary outline-none transition focus:border-td-accent/50 focus:ring-2 focus:ring-td-accent/20"
                  >
                    <option value="amount">Amount</option>
                    <option value="percent">Percent</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                    Value
                  </span>
                  <input
                    value={String(adjustment.value ?? "")}
                    onChange={(event) =>
                      setAdjustment((current) => ({
                        ...current,
                        value: cleanNumericInput(event.target.value, true),
                      }))
                    }
                    inputMode="decimal"
                    placeholder={adjustment.mode === "amount" ? "-25.00" : "5"}
                    className="h-11 w-full rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.035] px-3 text-sm text-td-primary outline-none transition placeholder:text-td-muted focus:border-td-accent/50 focus:ring-2 focus:ring-td-accent/20"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                    Reason
                  </span>
                  <input
                    value={adjustment.label ?? ""}
                    onChange={(event) =>
                      setAdjustment((current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                    placeholder="Rounded cash offer, damaged boxes, event premium"
                    className="h-11 w-full rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.035] px-3 text-sm text-td-primary outline-none transition placeholder:text-td-muted focus:border-td-accent/50 focus:ring-2 focus:ring-td-accent/20"
                  />
                </label>
              </div>
            </section>
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[24px] border border-td-accent/[0.14] bg-td-surface p-5 shadow-2xl shadow-cyan-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
                Offer summary
              </p>
              <div className="mt-5">
                <p className="text-sm text-td-muted">Final offer</p>
                <p className="mt-1 text-4xl font-semibold tracking-[-0.04em] text-td-primary">
                  {currency.format(summary.finalOffer)}
                </p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <SummaryMetric label="Total cards" value={integer.format(summary.totalCards)} />
                <SummaryMetric label="Categories" value={String(summary.categoryCount)} />
                <SummaryMetric label="Subtotal" value={currency.format(summary.subtotal)} />
                <SummaryMetric
                  label="Avg/card"
                  value={currency.format(summary.averagePerCard)}
                />
              </div>
              <div className="mt-5 rounded-2xl border border-td-ink/[0.08] bg-black/15 p-4">
                <SummaryLine label="Calculated subtotal" value={currency.format(summary.subtotal)} />
                <SummaryLine
                  label="Adjustment"
                  value={currency.format(summary.adjustmentAmount)}
                  muted={summary.adjustmentAmount === 0}
                />
                <div className="my-3 h-px bg-td-ink/[0.08]" />
                <SummaryLine
                  label="Final offer"
                  value={currency.format(summary.finalOffer)}
                  strong
                />
              </div>
              <div className="mt-5 space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                    Seller / source
                  </span>
                  <input
                    value={sellerName}
                    onChange={(event) => setSellerName(event.target.value)}
                    placeholder="Customer, vendor, booth, or walk-in"
                    className="h-10 w-full rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.035] px-3 text-xs text-td-primary outline-none transition placeholder:text-td-muted focus:border-td-accent/50 focus:ring-2 focus:ring-td-accent/20"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                      Payment
                    </span>
                    <select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value as PurchasePaymentMethod)
                      }
                      className="h-10 w-full rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-xs text-td-primary outline-none transition focus:border-td-accent/50 focus:ring-2 focus:ring-td-accent/20"
                    >
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                      Status
                    </span>
                    <select
                      value={purchaseStatus}
                      onChange={(event) =>
                        setPurchaseStatus(event.target.value as PurchaseStatus)
                      }
                      className="h-10 w-full rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-xs text-td-primary outline-none transition focus:border-td-accent/50 focus:ring-2 focus:ring-td-accent/20"
                    >
                      {Object.entries(PURCHASE_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">
                    Notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    placeholder="Optional intake, condition, payout, or storage notes"
                    className="w-full resize-none rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.035] px-3 py-2.5 text-xs text-td-primary outline-none transition placeholder:text-td-muted focus:border-td-accent/50 focus:ring-2 focus:ring-td-accent/20"
                  />
                </label>
                <button
                  type="button"
                  onClick={savePurchase}
                  disabled={saving || summary.finalOffer <= 0}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-bold text-td-on-accent transition hover:bg-td-accent-hover focus:outline-none focus:ring-2 focus:ring-td-accent disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ReceiptText className="h-4 w-4" />
                  {saving ? "Saving..." : "Save to Purchase History"}
                </button>
                {saveMessage ? (
                  <p className="rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.025] px-3 py-2 text-xs leading-5 text-td-secondary">
                    {saveMessage}
                  </p>
                ) : null}
              </div>
              <p className="mt-4 text-xs leading-5 text-td-muted">
                Saving creates an acquisition ledger entry only. It does not
                create or duplicate inventory ownership records.
              </p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-td-ink/[0.08] bg-td-ink/[0.03] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-muted">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-td-primary">{value}</p>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={muted ? "text-td-muted" : "text-td-secondary"}>{label}</span>
      <span className={strong ? "font-semibold text-td-primary" : "font-medium text-td-primary"}>
        {value}
      </span>
    </div>
  );
}
