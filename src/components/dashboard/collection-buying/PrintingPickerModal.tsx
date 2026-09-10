"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { cardImage, searchPrintings } from "./scryfall";
import type {
  AppraisalCard,
  Condition,
  PriceFinish,
  ScryfallCard,
} from "./types";

export type PrintingPickerRequest = {
  item: AppraisalCard;
  applyToMatchingCopies?: boolean;
} | null;

export function PrintingPickerModal({
  request,
  rememberedSetCode,
  rememberedFinish,
  rememberedCondition,
  onClose,
  onChoose,
  onApplyDefaults,
}: {
  request: PrintingPickerRequest;
  rememberedSetCode: string;
  rememberedFinish: PriceFinish;
  rememberedCondition: Condition;
  onClose: () => void;
  onChoose: (
    rowId: string,
    printing: ScryfallCard,
    options: {
      rememberSet: boolean;
      rememberFinish: boolean;
      rememberCondition: boolean;
      finish: PriceFinish;
      condition: Condition;
      applyToAllCopies: boolean;
    },
  ) => void;
  onApplyDefaults: (
    rowId: string,
    finish: PriceFinish,
    condition: Condition,
  ) => void;
}) {
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [finish, setFinish] = useState<PriceFinish>("nonfoil");
  const [condition, setCondition] = useState<Condition>("NM");
  const [rememberSet, setRememberSet] = useState(true);
  const [rememberFinish, setRememberFinish] = useState(true);
  const [rememberCondition, setRememberCondition] = useState(true);
  const [applyToAllCopies, setApplyToAllCopies] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!request) return;

    const activeRequest = request;

    setQuery("");
    setPrintings([]);
    setFinish(activeRequest.item.finish ?? rememberedFinish);
    setCondition(activeRequest.item.condition ?? rememberedCondition);
    setApplyToAllCopies(Boolean(activeRequest.applyToMatchingCopies));
    setError("");

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const results = await searchPrintings(
          activeRequest.item.card?.name ?? activeRequest.item.name,
        );
        if (!cancelled) setPrintings(results);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Printings could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [request, rememberedFinish, rememberedCondition]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const matching = printings.filter((card) => {
      if (!normalized) return true;

      return `${card.set_name} ${card.set} ${card.collector_number}`
        .toLowerCase()
        .includes(normalized);
    });

    return [...matching].sort((a, b) => {
      const aPreferred = a.set.toLowerCase() === rememberedSetCode.toLowerCase();
      const bPreferred = b.set.toLowerCase() === rememberedSetCode.toLowerCase();

      if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;

      const aPrice = selectedPrice(a, finish);
      const bPrice = selectedPrice(b, finish);
      return bPrice - aPrice;
    });
  }, [printings, query, rememberedSetCode, finish]);

  const medianPrice = useMemo(() => {
    const prices = printings
      .map((card) => selectedPrice(card, finish))
      .filter((value) => value > 0)
      .sort((a, b) => a - b);

    if (!prices.length) return 0;
    const middle = Math.floor(prices.length / 2);

    return prices.length % 2
      ? prices[middle]
      : (prices[middle - 1] + prices[middle]) / 2;
  }, [printings, finish]);

  if (!request) return null;

  const item = request.item;

  return (
    <div className="fixed inset-0 z-[520] flex items-center justify-center bg-black/78 p-4 backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label="Close printing picker"
      />

      <div className="relative z-10 max-h-[94vh] w-full max-w-[1120px] overflow-y-auto rounded-[30px] border border-td-accent/[0.15] bg-td-surface/98 p-5 shadow-[0_40px_140px_rgb(var(--td-shadow-rgb)/calc(0.68*var(--td-shadow-strength)))] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-td-accent-text">
              Printing Selection
            </p>
            <h2 className="mt-2 text-xl font-semibold text-td-primary">
              Choose the exact printing
            </h2>
            <p className="mt-2 text-[11px] text-td-muted">
              {item.card?.name ?? item.name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] text-td-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.42fr]">
          <div>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-td-ink/[0.065] bg-td-ink/[0.02] px-3">
              <Search className="h-3.5 w-3.5 text-td-muted" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search set name, code, or collector number..."
                className="min-w-0 flex-1 bg-transparent text-[11px] text-td-secondary outline-none placeholder:text-td-muted"
              />
            </label>

            <div className="mt-4 grid max-h-[620px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((printing) => {
                const price = selectedPrice(printing, finish);
                const isPreferred =
                  rememberedSetCode &&
                  printing.set.toLowerCase() ===
                    rememberedSetCode.toLowerCase();
                const isCurrent = item.card?.id === printing.id;
                const premium =
                  medianPrice > 0 ? price / medianPrice : 1;
                const expensiveWarning = premium >= 1.75 && price >= 5;

                return (
                  <button
                    key={printing.id}
                    type="button"
                    onClick={() =>
                      onChoose(item.rowId, printing, {
                        rememberSet,
                        rememberFinish,
                        rememberCondition,
                        finish,
                        condition,
                        applyToAllCopies,
                      })
                    }
                    className={[
                      "relative overflow-hidden rounded-2xl border p-3 text-left transition",
                      isCurrent
                        ? "border-td-accent/[0.28] bg-td-accent/[0.06]"
                        : "border-td-ink/[0.06] bg-black/[0.1] hover:border-td-accent/[0.16]",
                    ].join(" ")}
                  >
                    <div className="flex gap-3">
                      <img
                        src={cardImage(printing)}
                        alt={printing.name}
                        className="h-[122px] w-[87px] shrink-0 rounded-lg object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold text-td-primary">
                          {printing.set_name}
                        </p>
                        <p className="mt-1 text-[11px] text-td-muted">
                          {printing.set.toUpperCase()} #
                          {printing.collector_number}
                        </p>
                        <p className="mt-3 text-sm font-semibold text-td-primary">
                          {price ? currency(price) : "No price"}
                        </p>
                        <p className="mt-1 text-[11px] text-td-muted">
                          Released {printing.released_at ?? "Unknown"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-1">
                          {isPreferred ? (
                            <span className="rounded-md border border-td-violet/[0.14] bg-td-violet/[0.05] px-1.5 py-0.5 text-[11px] text-td-violet">
                              Preferred set
                            </span>
                          ) : null}
                          {isCurrent ? (
                            <span className="rounded-md border border-td-accent/[0.14] bg-td-accent/[0.05] px-1.5 py-0.5 text-[11px] text-td-accent-text">
                              Current
                            </span>
                          ) : null}
                          {expensiveWarning ? (
                            <span className="rounded-md border border-td-warning/[0.14] bg-td-warning/[0.05] px-1.5 py-0.5 text-[11px] text-td-warning">
                              Premium printing
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {expensiveWarning ? (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-td-warning/[0.1] bg-td-warning/[0.035] px-2.5 py-2 text-[11px] leading-4 text-td-warning/80">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        This printing is significantly above the card’s median
                        printing price.
                      </div>
                    ) : null}
                  </button>
                );
              })}

              {!loading && !filtered.length ? (
                <div className="col-span-full rounded-2xl border border-dashed border-td-ink/[0.07] py-16 text-center text-[11px] text-td-muted">
                  No matching printings found.
                </div>
              ) : null}

              {loading ? (
                <div className="col-span-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-td-ink/[0.07] py-16 text-[11px] text-td-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-td-accent-text" />
                  Loading all printings...
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-td-ink/[0.06] bg-black/[0.1] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-td-violet">
                Session defaults
              </p>

              <div className="mt-4 space-y-3">
                <PickerSelect
                  label="Finish"
                  value={finish}
                  onChange={(value) => setFinish(value as PriceFinish)}
                  options={[
                    ["nonfoil", "Nonfoil"],
                    ["foil", "Foil"],
                    ["etched", "Etched"],
                  ]}
                />

                <PickerSelect
                  label="Condition"
                  value={condition}
                  onChange={(value) => setCondition(value as Condition)}
                  options={[
                    ["NM", "Near Mint"],
                    ["LP", "Lightly Played"],
                    ["MP", "Moderately Played"],
                    ["HP", "Heavily Played"],
                    ["DMG", "Damaged"],
                  ]}
                />
              </div>

              <div className="mt-4 space-y-2">
                <ToggleRow
                  checked={rememberSet}
                  onChange={setRememberSet}
                  label="Remember selected set"
                />
                <ToggleRow
                  checked={rememberFinish}
                  onChange={setRememberFinish}
                  label="Remember finish"
                />
                <ToggleRow
                  checked={rememberCondition}
                  onChange={setRememberCondition}
                  label="Remember condition"
                />
                <ToggleRow
                  checked={applyToAllCopies}
                  onChange={setApplyToAllCopies}
                  label="Apply to matching copies"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  onApplyDefaults(item.rowId, finish, condition)
                }
                className="mt-4 h-10 w-full rounded-xl border border-td-violet/[0.14] bg-td-violet/[0.04] text-[11px] font-semibold text-td-violet"
              >
                Apply finish and condition only
              </button>
            </div>

            <div className="rounded-2xl border border-td-accent/[0.1] bg-td-accent/[0.03] p-4">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-td-accent-text" />
                <div>
                  <p className="text-[11px] font-semibold text-td-accent-text">
                    Smart set memory
                  </p>
                  <p className="mt-2 text-[11px] leading-4 text-td-muted">
                    Future cards will try the last selected set first. When
                    that card does not exist in the preferred set, Scryfall’s
                    normal printing is used.
                  </p>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-td-danger/[0.12] bg-td-danger/[0.04] p-3 text-[11px] text-td-danger">
                {error}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function PickerSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label>
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-td-muted">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-xl border border-td-ink/[0.065] bg-td-surface pl-3 pr-8 text-[11px] text-td-secondary outline-none"
        >
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-td-muted" />
      </span>
    </label>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-td-ink/[0.055] bg-td-ink/[0.018] px-3 py-2.5 text-left"
    >
      <span className="text-[11px] text-td-muted">{label}</span>
      <span
        className={[
          "flex h-5 w-5 items-center justify-center rounded-md border",
          checked
            ? "border-td-accent/[0.2] bg-td-accent/[0.08] text-td-accent-text"
            : "border-td-ink/[0.07] text-transparent",
        ].join(" ")}
      >
        <Check className="h-3 w-3" />
      </span>
    </button>
  );
}

function selectedPrice(card: ScryfallCard, finish: PriceFinish) {
  const value =
    finish === "foil"
      ? card.prices.usd_foil
      : finish === "etched"
        ? card.prices.usd_etched
        : card.prices.usd;

  return value ? Number(value) : 0;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}