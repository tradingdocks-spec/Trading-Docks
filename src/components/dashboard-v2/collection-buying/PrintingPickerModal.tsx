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

    setQuery("");
    setPrintings([]);
    setFinish(request.item.finish ?? rememberedFinish);
    setCondition(request.item.condition ?? rememberedCondition);
    setApplyToAllCopies(Boolean(request.applyToMatchingCopies));
    setError("");

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const results = await searchPrintings(
          request.item.card?.name ?? request.item.name,
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

      <div className="relative z-10 max-h-[94vh] w-full max-w-[1120px] overflow-y-auto rounded-[30px] border border-cyan-300/[0.15] bg-[#06131d]/98 p-5 shadow-[0_40px_140px_rgba(0,0,0,0.68)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-cyan-300">
              Printing Selection
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Choose the exact printing
            </h2>
            <p className="mt-2 text-[9px] text-slate-600">
              {item.card?.name ?? item.name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.42fr]">
          <div>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.065] bg-white/[0.02] px-3">
              <Search className="h-3.5 w-3.5 text-slate-700" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search set name, code, or collector number..."
                className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-300 outline-none placeholder:text-slate-700"
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
                        ? "border-cyan-300/[0.28] bg-cyan-400/[0.06]"
                        : "border-white/[0.06] bg-black/[0.1] hover:border-cyan-300/[0.16]",
                    ].join(" ")}
                  >
                    <div className="flex gap-3">
                      <img
                        src={cardImage(printing)}
                        alt={printing.name}
                        className="h-[122px] w-[87px] shrink-0 rounded-lg object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-semibold text-slate-200">
                          {printing.set_name}
                        </p>
                        <p className="mt-1 text-[8px] text-slate-700">
                          {printing.set.toUpperCase()} #
                          {printing.collector_number}
                        </p>
                        <p className="mt-3 text-sm font-semibold text-white">
                          {price ? currency(price) : "No price"}
                        </p>
                        <p className="mt-1 text-[7px] text-slate-700">
                          Released {printing.released_at ?? "Unknown"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-1">
                          {isPreferred ? (
                            <span className="rounded-md border border-violet-300/[0.14] bg-violet-400/[0.05] px-1.5 py-0.5 text-[7px] text-violet-200">
                              Preferred set
                            </span>
                          ) : null}
                          {isCurrent ? (
                            <span className="rounded-md border border-cyan-300/[0.14] bg-cyan-400/[0.05] px-1.5 py-0.5 text-[7px] text-cyan-200">
                              Current
                            </span>
                          ) : null}
                          {expensiveWarning ? (
                            <span className="rounded-md border border-amber-300/[0.14] bg-amber-400/[0.05] px-1.5 py-0.5 text-[7px] text-amber-200">
                              Premium printing
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {expensiveWarning ? (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/[0.1] bg-amber-400/[0.035] px-2.5 py-2 text-[7px] leading-4 text-amber-100/80">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        This printing is significantly above the card’s median
                        printing price.
                      </div>
                    ) : null}
                  </button>
                );
              })}

              {!loading && !filtered.length ? (
                <div className="col-span-full rounded-2xl border border-dashed border-white/[0.07] py-16 text-center text-[9px] text-slate-600">
                  No matching printings found.
                </div>
              ) : null}

              {loading ? (
                <div className="col-span-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.07] py-16 text-[9px] text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                  Loading all printings...
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-black/[0.1] p-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-violet-300">
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
                className="mt-4 h-10 w-full rounded-xl border border-violet-300/[0.14] bg-violet-400/[0.04] text-[8px] font-semibold text-violet-200"
              >
                Apply finish and condition only
              </button>
            </div>

            <div className="rounded-2xl border border-cyan-300/[0.1] bg-cyan-400/[0.03] p-4">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                <div>
                  <p className="text-[9px] font-semibold text-cyan-100">
                    Smart set memory
                  </p>
                  <p className="mt-2 text-[8px] leading-4 text-slate-600">
                    Future cards will try the last selected set first. When
                    that card does not exist in the preferred set, Scryfall’s
                    normal printing is used.
                  </p>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-300/[0.12] bg-red-400/[0.04] p-3 text-[8px] text-red-200">
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
      <span className="mb-2 block text-[7px] font-semibold uppercase tracking-[0.12em] text-slate-700">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-xl border border-white/[0.065] bg-[#07141e] pl-3 pr-8 text-[9px] text-slate-400 outline-none"
        >
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-700" />
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
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 py-2.5 text-left"
    >
      <span className="text-[8px] text-slate-500">{label}</span>
      <span
        className={[
          "flex h-5 w-5 items-center justify-center rounded-md border",
          checked
            ? "border-cyan-300/[0.2] bg-cyan-400/[0.08] text-cyan-200"
            : "border-white/[0.07] text-transparent",
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
