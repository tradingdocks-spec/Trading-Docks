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
  }

  return (
    <main className="min-h-screen bg-[#020b12] px-4 py-5 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="rounded-[24px] border border-cyan-300/[0.12] bg-[#06141f] p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/[0.14] bg-cyan-400/[0.05] text-cyan-300">
                <Calculator className="h-5 w-5" />
              </div>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Bulk Buying
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Build a clean bulk offer before money changes hands.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Add flexible categories, set your live buy rates, and use the
                subtotal, adjustment, and final offer as a purchasing worksheet.
              </p>
            </div>
            <button
              type="button"
              onClick={resetCalculator}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset calculator
            </button>
          </div>
        </header>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="rounded-[22px] border border-white/[0.08] bg-[#06141f] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Quick-add rate presets
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
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
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.04] focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
                  >
                    <span className="block text-sm font-semibold text-slate-100">
                      {preset.category}
                    </span>
                    <span className="mt-2 block text-xs text-cyan-200">
                      {currency.format(preset.rate)} {basisLabels[preset.basis].toLowerCase()}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[22px] border border-white/[0.08] bg-[#06141f] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Offer worksheet
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Empty rows and invalid negative values are ignored.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRows((current) => [...current, createBlankRow()])}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100"
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
                      className="grid gap-3 rounded-2xl border border-white/[0.08] bg-[#04111b] p-3 md:grid-cols-[minmax(160px,1.2fr)_120px_120px_130px_130px_42px]"
                    >
                      <label className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Category
                        </span>
                        <input
                          value={row.category}
                          onChange={(event) =>
                            updateRow(row.id, { category: event.target.value })
                          }
                          placeholder={`Category ${index + 1}`}
                          className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
                          className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
                          className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Rate basis
                        </span>
                        <select
                          value={row.basis}
                          onChange={(event) =>
                            updateRow(row.id, {
                              basis: event.target.value as BulkRateBasis,
                            })
                          }
                          className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#071823] px-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
                        >
                          {Object.entries(basisLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="space-y-1.5">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Offer
                        </span>
                        <div className="flex h-11 items-center rounded-xl border border-cyan-300/[0.12] bg-cyan-300/[0.045] px-3 text-sm font-semibold text-cyan-100">
                          {currency.format(rowOffer)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        aria-label={`Remove ${row.category || `category ${index + 1}`}`}
                        className="flex h-11 w-11 items-center justify-center self-end rounded-xl border border-white/[0.08] bg-white/[0.025] text-slate-500 transition hover:border-rose-300/30 hover:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[22px] border border-white/[0.08] bg-[#06141f] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-300/[0.04] text-cyan-200">
                  <ReceiptText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Optional adjustment
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Add premiums, deductions, or rounding notes without changing
                    category rates.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[140px_160px_minmax(0,1fr)]">
                <label className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
                    className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#071823] px-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
                  >
                    <option value="amount">Amount</option>
                    <option value="percent">Percent</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
                    className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
                    className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
                  />
                </label>
              </div>
            </section>
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[24px] border border-cyan-300/[0.14] bg-[#071823] p-5 shadow-2xl shadow-cyan-950/20">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Offer summary
              </p>
              <div className="mt-5">
                <p className="text-sm text-slate-500">Final offer</p>
                <p className="mt-1 text-4xl font-semibold tracking-[-0.04em] text-white">
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
              <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
                <SummaryLine label="Calculated subtotal" value={currency.format(summary.subtotal)} />
                <SummaryLine
                  label="Adjustment"
                  value={currency.format(summary.adjustmentAmount)}
                  muted={summary.adjustmentAmount === 0}
                />
                <div className="my-3 h-px bg-white/[0.08]" />
                <SummaryLine
                  label="Final offer"
                  value={currency.format(summary.finalOffer)}
                  strong
                />
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                This calculator is local to the current worksheet. It does not
                save a purchase record or change inventory.
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
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-100">{value}</p>
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
      <span className={muted ? "text-slate-600" : "text-slate-400"}>{label}</span>
      <span className={strong ? "font-semibold text-white" : "font-medium text-slate-200"}>
        {value}
      </span>
    </div>
  );
}
