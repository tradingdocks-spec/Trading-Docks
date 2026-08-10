"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  FileImage,
  ImagePlus,
  Layers3,
  LoaderCircle,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  UploadCloud,
  WandSparkles,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import type {
  CardCandidate,
  CardScanResponse,
  PricePoint,
} from "@/lib/card-photo-scanner/types";

type Quality = {
  width: number;
  height: number;
  megapixels: number;
  score: number;
  messages: Array<{ label: string; status: "good" | "warning" }>;
};

const conditions = [
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
];

const finishOptions = ["Nonfoil", "Foil", "Etched"];

const conditionMultiplier: Record<string, number> = {
  "Near Mint": 1,
  "Lightly Played": 0.9,
  "Moderately Played": 0.76,
  "Heavily Played": 0.58,
  Damaged: 0.4,
};

const sourceBrand: Record<
  string,
  { short: string; accent: string; badge: string }
> = {
  Scryfall: {
    short: "SC",
    accent: "text-emerald-300",
    badge: "border-emerald-300/15 bg-emerald-300/[.045]",
  },
  TCGplayer: {
    short: "TCG",
    accent: "text-blue-300",
    badge: "border-blue-300/15 bg-blue-300/[.045]",
  },
  "Mana Pool": {
    short: "MP",
    accent: "text-violet-300",
    badge: "border-violet-300/15 bg-violet-300/[.045]",
  },
  CardSphere: {
    short: "CS",
    accent: "text-fuchsia-300",
    badge: "border-fuchsia-300/15 bg-fuchsia-300/[.045]",
  },
  Cardmarket: {
    short: "CM",
    accent: "text-amber-300",
    badge: "border-amber-300/15 bg-amber-300/[.045]",
  },
};

function currency(value: number | null, code = "USD") {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
  }).format(value);
}

function qualityFor(width: number, height: number): Quality {
  const megapixels = (width * height) / 1_000_000;
  const ratio = width / height;
  const normalized = Math.min(ratio, 1 / ratio);
  let score = 100;
  const messages: Quality["messages"] = [];

  if (Math.min(width, height) >= 700) {
    messages.push({
      label: "Resolution supports collector-number recognition",
      status: "good",
    });
  } else {
    messages.push({
      label: "Use a larger photo for small-print recognition",
      status: "warning",
    });
    score -= 24;
  }

  if (megapixels >= 1) {
    messages.push({
      label: `${megapixels.toFixed(1)} MP detail available`,
      status: "good",
    });
  } else {
    messages.push({
      label: "Image is below one megapixel",
      status: "warning",
    });
    score -= 18;
  }

  if (normalized > 0.58 && normalized < 0.82) {
    messages.push({
      label: "Card-like proportions detected",
      status: "good",
    });
  } else {
    messages.push({
      label: "Keep the full card visible with less background",
      status: "warning",
    });
    score -= 12;
  }

  return {
    width,
    height,
    megapixels,
    score: Math.max(35, score),
    messages,
  };
}

export function CardPhotoScanner() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [manualName, setManualName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CardScanResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [condition, setCondition] = useState("Near Mint");
  const [finish, setFinish] = useState("Nonfoil");
  const [offerPercent, setOfferPercent] = useState(60);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const selected = useMemo(
    () =>
      result?.candidates.find((candidate) => candidate.id === selectedId) ??
      result?.candidates[0] ??
      null,
    [result, selectedId],
  );

  const referencePrice = useMemo(() => {
    if (!selected) return null;

    const target =
      finish === "Foil"
        ? "foil reference"
        : finish === "Etched"
          ? "etched reference"
          : "nonfoil reference";

    return (
      selected.prices.find((price) =>
        price.label.toLowerCase().includes(target),
      )?.value ??
      selected.prices.find((price) => price.value != null)?.value ??
      null
    );
  }, [selected, finish]);

  const adjustedValue =
    referencePrice == null
      ? null
      : referencePrice * conditionMultiplier[condition];

  const suggestedOffer =
    adjustedValue == null ? null : adjustedValue * (offerPercent / 100);

  const grossSpread =
    adjustedValue == null || suggestedOffer == null
      ? null
      : adjustedValue - suggestedOffer;

  const marginPercent =
    adjustedValue == null || suggestedOffer == null || adjustedValue === 0
      ? null
      : Math.round((grossSpread! / adjustedValue) * 100);

  const identificationConfidence = Math.round(
    (selected?.confidence ?? result?.identification.confidence ?? 0) * 100,
  );

  const chooseFile = useCallback(
    (next: File | null) => {
      setError("");
      setResult(null);
      setSelectedId(null);

      if (!next) return;

      if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
        setError("Use a JPG, PNG, or WebP image.");
        return;
      }

      if (next.size > 12 * 1024 * 1024) {
        setError("Images must be 12 MB or smaller.");
        return;
      }

      if (preview) URL.revokeObjectURL(preview);

      const url = URL.createObjectURL(next);
      setFile(next);
      setPreview(url);

      const image = new window.Image();
      image.onload = () =>
        setQuality(qualityFor(image.naturalWidth, image.naturalHeight));
      image.src = url;
    },
    [preview],
  );

  async function analyze() {
    if (!file && !manualName.trim()) {
      setError("Drop in a card photo or enter the card name.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const form = new FormData();
      if (file) form.set("image", file);
      if (manualName.trim()) form.set("cardName", manualName.trim());

      const response = await fetch("/api/purchasing/card-photo-scan", {
        method: "POST",
        body: form,
      });

      const payload = (await response.json().catch(() => null)) as
        | (CardScanResponse & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(
          payload?.error ?? "The card could not be analyzed.",
        );
      }

      setResult(payload);
      setSelectedId(payload.candidates[0]?.id ?? null);

      if (payload.identification.finish === "foil") setFinish("Foil");
      if (payload.identification.finish === "etched") setFinish("Etched");
      if (payload.identification.finish === "nonfoil") setFinish("Nonfoil");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The card could not be analyzed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setQuality(null);
    setManualName("");
    setResult(null);
    setSelectedId(null);
    setError("");
    setNotice("");
  }

  return (
    <main className="min-h-screen bg-[#020914] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-5">
        <Hero />

        {!result ? (
          <ScanWorkspace
            preview={preview}
            file={file}
            quality={quality}
            manualName={manualName}
            dragging={dragging}
            loading={loading}
            error={error}
            inputRef={inputRef}
            setManualName={setManualName}
            setDragging={setDragging}
            chooseFile={chooseFile}
            analyze={analyze}
          />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <RecognitionSummary
                preview={preview}
                selected={selected}
                confidence={identificationConfidence}
                quality={quality}
                result={result}
                reset={reset}
              />

              <CandidateList
                candidates={result.candidates}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
              />
            </aside>

            <section className="space-y-5">
              {selected ? (
                <>
                  <DecisionHero
                    selected={selected}
                    confidence={identificationConfidence}
                    adjustedValue={adjustedValue}
                    suggestedOffer={suggestedOffer}
                    grossSpread={grossSpread}
                    marginPercent={marginPercent}
                    condition={condition}
                    finish={finish}
                    setCondition={setCondition}
                    setFinish={setFinish}
                    offerPercent={offerPercent}
                    setOfferPercent={setOfferPercent}
                    advancedOpen={advancedOpen}
                    setAdvancedOpen={setAdvancedOpen}
                  />

                  <MarketIntelligence
                    candidate={selected}
                    coverage={result.pricingCoverage}
                  />

                  <ActionBar
                    candidate={selected}
                    suggestedOffer={suggestedOffer}
                    notice={notice}
                    setNotice={setNotice}
                  />
                </>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Hero() {
  return (
    <header className="relative overflow-hidden rounded-[28px] border border-blue-300/[.14] bg-[#07121f] px-6 py-7 shadow-[0_28px_90px_rgba(0,0,0,.3)] sm:px-8">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-500/[.11] blur-3xl" />
      <div className="pointer-events-none absolute right-52 top-6 h-44 w-44 rounded-full bg-cyan-300/[.055] blur-3xl" />

      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-blue-300">
            <WandSparkles className="h-4 w-4" />
            Trading Docks Vision
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">
            Purchasing Intelligence
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Identify the exact printing, compare available markets, and turn a
            card photo into a transparent buying decision.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <HeroBadge icon={ScanLine} label="Vision matching" />
          <HeroBadge icon={Store} label="Multi-market pricing" />
          <HeroBadge icon={BadgeDollarSign} label="Offer intelligence" />
        </div>
      </div>
    </header>
  );
}

type ScanWorkspaceProps = {
  preview: string | null;
  file: File | null;
  quality: Quality | null;
  manualName: string;
  dragging: boolean;
  loading: boolean;
  error: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setManualName: (value: string) => void;
  setDragging: (value: boolean) => void;
  chooseFile: (file: File | null) => void;
  analyze: () => void;
};

function ScanWorkspace({
  preview,
  quality,
  manualName,
  dragging,
  loading,
  error,
  inputRef,
  setManualName,
  setDragging,
  chooseFile,
  analyze,
}: ScanWorkspaceProps) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,.8fr)]">
      <div className="rounded-[28px] border border-white/[.075] bg-[#07121f] p-5 shadow-[0_24px_80px_rgba(0,0,0,.25)] sm:p-6">
        <SectionKicker icon={UploadCloud} label="Scan stage" />
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Drop in the card front
            </h2>
            <p className="mt-1 text-[10px] leading-5 text-slate-600">
              Full-card photos with even lighting produce the strongest result.
            </p>
          </div>
          <span className="rounded-full border border-white/[.07] bg-white/[.025] px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[.1em] text-slate-500">
            JPG · PNG · WebP
          </span>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            chooseFile(event.dataTransfer.files[0] ?? null);
          }}
          className={`relative mt-5 flex min-h-[510px] w-full overflow-hidden rounded-[24px] border transition ${
            dragging
              ? "border-cyan-300/55 bg-blue-400/[.08]"
              : "border-dashed border-blue-300/[.18] bg-[#030c17] hover:border-blue-300/38 hover:bg-blue-400/[.025]"
          }`}
        >
          {preview ? (
            <div className="relative flex w-full items-center justify-center p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Uploaded card"
                className="max-h-[455px] max-w-full rounded-2xl object-contain shadow-[0_24px_70px_rgba(0,0,0,.52)]"
              />
              <span className="absolute right-4 top-4 rounded-xl border border-white/[.1] bg-black/70 px-3 py-2 text-[9px] font-semibold text-white backdrop-blur">
                Replace image
              </span>
            </div>
          ) : (
            <div className="m-auto max-w-md px-6 py-14 text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-blue-300/[.16] bg-blue-400/[.055] text-blue-300 shadow-[0_0_55px_rgba(59,130,246,.12)]">
                <ImagePlus className="h-9 w-9" />
              </span>
              <p className="mt-6 text-xl font-semibold">
                Drop a card photo here
              </p>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                Keep the full border visible, avoid sleeve glare, and use the
                highest-resolution image available.
              </p>
              <span className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-300 px-5 text-[10px] font-semibold text-[#020914]">
                <FileImage className="h-4 w-4" />
                Choose image
              </span>
            </div>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) =>
            chooseFile(event.target.files?.[0] ?? null)
          }
        />
      </div>

      <div className="space-y-5">
        <div className="rounded-[28px] border border-white/[.075] bg-[#07121f] p-5 sm:p-6">
          <SectionKicker icon={Sparkles} label="Recognition assist" />
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Confirm the scan input
          </h2>
          <p className="mt-2 text-[10px] leading-5 text-slate-600">
            Entering the name is optional, but it is a reliable fallback when
            small text is obscured.
          </p>

          <label className="mt-5 block">
            <span className="text-[9px] font-semibold uppercase tracking-[.13em] text-slate-600">
              Optional card name
            </span>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                value={manualName}
                onChange={(event) =>
                  setManualName(event.target.value)
                }
                placeholder="Example: Rhystic Study"
                className="h-12 w-full rounded-xl border border-white/[.08] bg-[#030c17] pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-700"
              />
            </div>
          </label>

          <button
            type="button"
            onClick={analyze}
            disabled={loading}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-300 px-4 text-[11px] font-semibold text-[#020914] shadow-[0_14px_36px_rgba(37,99,235,.22)] disabled:opacity-50"
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "Analyzing card" : "Analyze card"}
          </button>

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300/15 bg-rose-400/[.04] p-3 text-[10px] leading-5 text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}
        </div>

        <QualityPanel quality={quality} />

        <div className="rounded-[28px] border border-white/[.075] bg-[#07121f] p-5 sm:p-6">
          <SectionKicker icon={ShieldCheck} label="Accuracy standard" />
          <div className="mt-4 space-y-3">
            <AccuracyItem
              title="Exact-printing confirmation"
              text="The purchase recommendation does not finalize until a printing is selected."
            />
            <AccuracyItem
              title="No fabricated pricing"
              text="Unavailable connectors remain clearly labeled as unavailable."
            />
            <AccuracyItem
              title="Future scanner ready"
              text="Camera, upload, and physical scanner inputs use the same recognition workflow."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function RecognitionSummary(props: {
  preview: string | null;
  selected: CardCandidate | null;
  confidence: number;
  quality: Quality | null;
  result: CardScanResponse;
  reset: () => void;
}) {
  return (
    <section className="rounded-[26px] border border-white/[.075] bg-[#07121f] p-5 shadow-[0_22px_70px_rgba(0,0,0,.24)]">
      <div className="flex items-start justify-between gap-3">
        <SectionKicker icon={ScanLine} label="Recognition" />
        <button
          type="button"
          onClick={props.reset}
          className="flex h-9 items-center gap-2 rounded-xl border border-white/[.08] bg-white/[.025] px-3 text-[9px] font-semibold text-slate-500 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          New scan
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-[22px] border border-white/[.07] bg-[#030c17] p-4">
        {props.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.preview}
            alt="Scanned card"
            className="mx-auto max-h-[310px] max-w-full rounded-xl object-contain"
          />
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-lg font-semibold">
          {props.selected?.name ?? props.result.identification.name}
        </p>
        <p className="mt-1 text-[10px] leading-5 text-slate-500">
          {props.selected
            ? `${props.selected.setName} · ${props.selected.setCode} #${props.selected.collectorNumber}`
            : "Select a printing candidate"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <RecognitionMetric
          label="Printing"
          value={`${props.confidence}%`}
          tone="blue"
        />
        <RecognitionMetric
          label="Image quality"
          value={`${props.quality?.score ?? 0}%`}
          tone={(props.quality?.score ?? 0) >= 80 ? "green" : "amber"}
        />
        <RecognitionMetric label="Language" value="English" />
        <RecognitionMetric label="Condition" value="Manual" />
      </div>
    </section>
  );
}

function CandidateList(props: {
  candidates: CardCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-[26px] border border-white/[.075] bg-[#07121f] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionKicker icon={Layers3} label="Printing candidates" />
          <p className="mt-2 text-sm font-semibold">
            Confirm the exact version
          </p>
        </div>
        <span className="rounded-full border border-white/[.07] px-2.5 py-1 text-[8px] font-semibold text-slate-600">
          {props.candidates.length} matches
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {props.candidates.map((candidate, index) => {
          const selected = candidate.id === props.selectedId;
          return (
            <button
              key={candidate.id}
              type="button"
              onClick={() => props.onSelect(candidate.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                selected
                  ? "border-blue-300/38 bg-blue-400/[.07]"
                  : "border-white/[.06] bg-black/[.13] hover:border-blue-300/18"
              }`}
            >
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-[#020914]">
                {candidate.imageUrl ? (
                  <Image
                    src={candidate.imageUrl}
                    alt={candidate.name}
                    fill
                    unoptimized
                    className="object-contain"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-semibold text-slate-700">
                    #{index + 1}
                  </span>
                  <span className="truncate text-xs font-semibold">
                    {candidate.setName}
                  </span>
                </div>
                <p className="mt-1 text-[9px] uppercase tracking-[.08em] text-blue-300">
                  {candidate.setCode} #{candidate.collectorNumber}
                </p>
                <p className="mt-1 text-[8px] text-slate-700">
                  {candidate.finishes.join(" · ") || "Finish unavailable"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-blue-200">
                  {Math.round(candidate.confidence * 100)}%
                </p>
                {selected ? (
                  <CheckCircle2 className="ml-auto mt-2 h-4 w-4 text-cyan-300" />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DecisionHero(props: {
  selected: CardCandidate;
  confidence: number;
  adjustedValue: number | null;
  suggestedOffer: number | null;
  grossSpread: number | null;
  marginPercent: number | null;
  condition: string;
  finish: string;
  setCondition: (value: string) => void;
  setFinish: (value: string) => void;
  offerPercent: number;
  setOfferPercent: (value: number) => void;
  advancedOpen: boolean;
  setAdvancedOpen: (value: boolean) => void;
}) {
  const recommendation =
    props.marginPercent == null
      ? "REVIEW"
      : props.marginPercent >= 38
        ? "BUY"
        : props.marginPercent >= 25
          ? "CONSIDER"
          : "PASS";

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-blue-300/[.16] bg-[#07121f] p-5 shadow-[0_26px_90px_rgba(37,99,235,.08)] sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-blue-500/[.1] blur-3xl" />

      <div className="relative">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <SectionKicker
              icon={BadgeDollarSign}
              label="Purchase recommendation"
            />
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              {props.selected.name}
            </h2>
            <p className="mt-1 text-[10px] text-slate-500">
              {props.selected.setName} · {props.selected.setCode} #
              {props.selected.collectorNumber}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/[.07] bg-black/[.15] px-4 py-3 text-right">
              <p className="text-[8px] font-semibold uppercase tracking-[.12em] text-slate-600">
                Confidence
              </p>
              <p className="mt-1 text-lg font-semibold text-blue-200">
                {props.confidence}%
              </p>
            </div>
            <div
              className={`rounded-2xl border px-5 py-3 ${
                recommendation === "BUY"
                  ? "border-emerald-300/18 bg-emerald-300/[.055]"
                  : recommendation === "CONSIDER"
                    ? "border-amber-300/18 bg-amber-300/[.055]"
                    : "border-white/[.08] bg-white/[.025]"
              }`}
            >
              <p className="text-[8px] font-semibold uppercase tracking-[.12em] text-slate-600">
                Recommendation
              </p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  recommendation === "BUY"
                    ? "text-emerald-300"
                    : recommendation === "CONSIDER"
                      ? "text-amber-300"
                      : "text-slate-300"
                }`}
              >
                {recommendation}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DecisionMetric
            label="Market reference"
            value={currency(props.adjustedValue)}
            detail={`${props.condition} · ${props.finish}`}
          />
          <DecisionMetric
            label="Recommended offer"
            value={currency(props.suggestedOffer)}
            detail={`Pay ${props.offerPercent}%`}
            featured
          />
          <DecisionMetric
            label="Gross spread"
            value={currency(props.grossSpread)}
            detail="Before fees and shipping"
          />
          <DecisionMetric
            label="Margin"
            value={
              props.marginPercent == null ? "—" : `${props.marginPercent}%`
            }
            detail="Reference spread"
          />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <SelectField
            label="Condition"
            value={props.condition}
            options={conditions}
            onChange={props.setCondition}
          />
          <SelectField
            label="Finish"
            value={props.finish}
            options={finishOptions}
            onChange={props.setFinish}
          />
          <button
            type="button"
            onClick={() => props.setAdvancedOpen(!props.advancedOpen)}
            className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[.08] bg-white/[.025] px-4 text-[10px] font-semibold text-slate-300"
          >
            Buying rules
            <ChevronDown
              className={`h-4 w-4 transition ${
                props.advancedOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {props.advancedOpen ? (
          <div className="mt-4 rounded-2xl border border-white/[.07] bg-black/[.15] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[.13em] text-slate-600">
                  Buying-rule percentage
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Pay {props.offerPercent}% of adjusted reference
                </p>
              </div>
              <span className="text-lg font-semibold text-blue-300">
                {props.offerPercent}%
              </span>
            </div>
            <input
              type="range"
              min="25"
              max="85"
              step="5"
              value={props.offerPercent}
              onChange={(event) =>
                props.setOfferPercent(Number(event.target.value))
              }
              className="mt-4 w-full accent-blue-400"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MarketIntelligence(props: {
  candidate: CardCandidate;
  coverage: CardScanResponse["pricingCoverage"];
}) {
  const rows = buildMarketRows(props.candidate.prices);

  return (
    <section className="rounded-[28px] border border-white/[.075] bg-[#07121f] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionKicker icon={BarChart3} label="Market intelligence" />
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Compare exact-printing markets
          </h2>
          <p className="mt-1 text-[10px] leading-5 text-slate-600">
            Prices are separated by source, freshness, and connector status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-300/14 bg-emerald-300/[.04] px-3 py-1.5 text-[8px] font-semibold text-emerald-300">
            {props.coverage.available} live
          </span>
          <span className="rounded-full border border-amber-300/14 bg-amber-300/[.04] px-3 py-1.5 text-[8px] font-semibold text-amber-300">
            {props.coverage.checked - props.coverage.available} pending
          </span>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[22px] border border-white/[.07]">
        <div className="hidden grid-cols-[1.35fr_.8fr_.8fr_.8fr_.55fr] border-b border-white/[.06] bg-white/[.018] px-4 py-3 text-[8px] font-semibold uppercase tracking-[.11em] text-slate-700 md:grid">
          <span>Marketplace</span>
          <span>Lowest / market</span>
          <span>Buylist</span>
          <span>Status</span>
          <span className="text-right">Open</span>
        </div>

        <div className="divide-y divide-white/[.055]">
          {rows.map((row) => (
            <MarketRow key={row.name} row={row} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MarketSummary
          label="Lowest verified"
          value={currency(
            rows
              .filter((row) => row.price != null)
              .map((row) => row.price!)
              .sort((a, b) => a - b)[0] ?? null,
          )}
          detail="Available reference sources"
          icon={TrendingUp}
        />
        <MarketSummary
          label="Connected sources"
          value={`${props.coverage.available}/${props.coverage.checked}`}
          detail="Live or exact-printing links"
          icon={Store}
        />
        <MarketSummary
          label="Data policy"
          value="Verified only"
          detail="No fabricated marketplace prices"
          icon={ShieldCheck}
        />
      </div>
    </section>
  );
}

function ActionBar(props: {
  candidate: CardCandidate;
  suggestedOffer: number | null;
  notice: string;
  setNotice: (value: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-white/[.075] bg-[#07121f] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold">Ready to continue?</p>
          <p className="mt-1 text-[9px] text-slate-600">
            Confirmed printing · Suggested offer{" "}
            {currency(props.suggestedOffer)}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() =>
              props.setNotice(
                "Purchase draft is staged. The next workflow step can write this exact printing into Collection Buying.",
              )
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-300 px-5 text-[10px] font-semibold text-[#020914]"
          >
            <ShoppingCart className="h-4 w-4" />
            Add to collection purchase
          </button>
          <Link
            href="/dashboard/inventory"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[.09] bg-white/[.025] px-5 text-[10px] font-semibold text-white"
          >
            <CircleDollarSign className="h-4 w-4 text-blue-300" />
            Open inventory intake
          </Link>
        </div>
      </div>

      {props.notice ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-300/15 bg-blue-400/[.04] p-3 text-[10px] leading-5 text-blue-100/75">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
          {props.notice}
        </div>
      ) : null}
    </section>
  );
}

function buildMarketRows(prices: PricePoint[]) {
  const scryfallNonfoil =
    prices.find((price) =>
      price.label.toLowerCase().includes("nonfoil reference"),
    ) ??
    prices.find((price) =>
      price.label.toLowerCase().includes("usd reference"),
    );

  const scryfallFoil = prices.find((price) =>
    price.label.toLowerCase().includes("foil reference"),
  );

  const tcg = prices.find((price) => price.source === "TCGplayer");
  const cardmarket = prices.find((price) => price.source === "Cardmarket");

  return [
    {
      name: "Scryfall",
      price: scryfallNonfoil?.value ?? null,
      secondary: scryfallFoil?.value ?? null,
      buylist: null,
      status: scryfallNonfoil?.value != null ? "Reference available" : "Unavailable",
      url: scryfallNonfoil?.url ?? null,
      note: "Reference pricing",
    },
    {
      name: "TCGplayer",
      price: null,
      secondary: null,
      buylist: null,
      status: tcg?.url ? "Exact-printing link" : "Connection required",
      url: tcg?.url ?? null,
      note: "Live seller-price API not connected",
    },
    {
      name: "Mana Pool",
      price: null,
      secondary: null,
      buylist: null,
      status: "API connection required",
      url: "https://manapool.com/api/docs/v1",
      note: "Official open API connector prepared",
    },
    {
      name: "CardSphere",
      price: null,
      secondary: null,
      buylist: null,
      status: "Connector planned",
      url: "https://www.cardsphere.com",
      note: "Buy and want-price integration slot",
    },
    {
      name: "Cardmarket",
      price: null,
      secondary: null,
      buylist: null,
      status: cardmarket?.url ? "Exact-printing link" : "Unavailable",
      url: cardmarket?.url ?? null,
      note: "Regional marketplace link",
    },
  ];
}

function MarketRow({
  row,
}: {
  row: {
    name: string;
    price: number | null;
    secondary: number | null;
    buylist: number | null;
    status: string;
    url: string | null;
    note: string;
  };
}) {
  const brand = sourceBrand[row.name] ?? sourceBrand.Scryfall;
  const ready =
    row.price != null ||
    row.status.toLowerCase().includes("link") ||
    row.status.toLowerCase().includes("available");

  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[1.35fr_.8fr_.8fr_.8fr_.55fr] md:items-center">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[9px] font-bold ${brand.badge} ${brand.accent}`}
        >
          {brand.short}
        </span>
        <div>
          <p className="text-xs font-semibold">{row.name}</p>
          <p className="mt-1 text-[8px] text-slate-700">{row.note}</p>
        </div>
      </div>

      <div>
        <p className="text-[8px] uppercase tracking-[.09em] text-slate-700 md:hidden">
          Lowest / market
        </p>
        <p className="mt-1 text-xs font-semibold md:mt-0">
          {row.price == null ? "—" : currency(row.price)}
        </p>
        {row.secondary != null ? (
          <p className="mt-1 text-[8px] text-slate-700">
            Foil {currency(row.secondary)}
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-[8px] uppercase tracking-[.09em] text-slate-700 md:hidden">
          Buylist
        </p>
        <p className="mt-1 text-xs font-semibold md:mt-0">
          {row.buylist == null ? "—" : currency(row.buylist)}
        </p>
      </div>

      <div>
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[8px] font-semibold ${
            ready
              ? "border-emerald-300/14 bg-emerald-300/[.04] text-emerald-300"
              : "border-amber-300/14 bg-amber-300/[.04] text-amber-300"
          }`}
        >
          {row.status}
        </span>
      </div>

      <div className="md:text-right">
        {row.url ? (
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.025] text-blue-300 hover:bg-blue-400/[.08]"
          >
            <ArrowUpRight className="h-4 w-4" />
          </a>
        ) : (
          <span className="text-[8px] text-slate-800">—</span>
        )}
      </div>
    </div>
  );
}

function QualityPanel({ quality }: { quality: Quality | null }) {
  return (
    <div className="rounded-[28px] border border-white/[.075] bg-[#07121f] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionKicker icon={Camera} label="Image quality" />
          <p className="mt-2 text-sm font-semibold">
            {quality ? `${quality.score}% scan readiness` : "Awaiting image"}
          </p>
        </div>
        {quality ? (
          <span
            className={`rounded-full px-3 py-1.5 text-[8px] font-semibold ${
              quality.score >= 80
                ? "bg-emerald-300/[.06] text-emerald-300"
                : "bg-amber-300/[.06] text-amber-300"
            }`}
          >
            {quality.width} × {quality.height}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2.5">
        {(quality?.messages ?? [
          {
            label: "Resolution and card proportions will be checked after upload",
            status: "good" as const,
          },
        ]).map((message) => (
          <div
            key={message.label}
            className="flex items-start gap-2 text-[9px] leading-5 text-slate-500"
          >
            {message.status === "good" ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            )}
            {message.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroBadge({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[.07] bg-black/[.14] px-3 text-[9px] font-semibold text-slate-400">
      <Icon className="h-3.5 w-3.5 text-blue-300" />
      {label}
    </span>
  );
}

function SectionKicker({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[.15em] text-blue-300">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

function AccuracyItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/[.06] bg-black/[.12] p-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
      <div>
        <p className="text-[10px] font-semibold">{title}</p>
        <p className="mt-1 text-[8px] leading-4 text-slate-700">{text}</p>
      </div>
    </div>
  );
}

function RecognitionMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "blue" | "green" | "amber";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-200"
      : tone === "green"
        ? "text-emerald-300"
        : tone === "amber"
          ? "text-amber-300"
          : "text-white";

  return (
    <div className="rounded-xl border border-white/[.06] bg-black/[.13] p-3">
      <p className="text-[8px] uppercase tracking-[.1em] text-slate-700">
        {label}
      </p>
      <p className={`mt-1 text-xs font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function DecisionMetric({
  label,
  value,
  detail,
  featured = false,
}: {
  label: string;
  value: string;
  detail: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        featured
          ? "border-blue-300/26 bg-blue-400/[.075]"
          : "border-white/[.07] bg-black/[.14]"
      }`}
    >
      <p className="text-[8px] font-semibold uppercase tracking-[.11em] text-slate-600">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          featured ? "text-cyan-200" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[8px] text-slate-700">{detail}</p>
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-[9px] font-semibold uppercase tracking-[.13em] text-slate-600">
        {props.label}
      </span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-white/[.08] bg-[#030c17] px-3 text-xs text-white outline-none"
      >
        {props.options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function MarketSummary({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-white/[.06] bg-black/[.13] p-4">
      <Icon className="h-4 w-4 text-blue-300" />
      <p className="mt-3 text-[8px] font-semibold uppercase tracking-[.11em] text-slate-700">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="mt-1 text-[8px] text-slate-700">{detail}</p>
    </div>
  );
}
