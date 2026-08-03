"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeDollarSign,
  Camera,
  CheckCircle2,
  ExternalLink,
  FileImage,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import type {
  CardCandidate,
  CardScanResponse,
  PricePoint,
} from "@/lib/card-photo-scanner/types";

const CONDITIONS = ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"];
const FINISHES = ["Nonfoil", "Foil", "Etched"];
const CONDITION_MULTIPLIER: Record<string, number> = {
  "Near Mint": 1,
  "Lightly Played": 0.9,
  "Moderately Played": 0.76,
  "Heavily Played": 0.58,
  Damaged: 0.4,
};

type Quality = {
  width: number;
  height: number;
  megapixels: number;
  score: number;
  notes: string[];
};

function money(value: number | null, currency = "USD") {
  return value == null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function inspectImage(width: number, height: number): Quality {
  const megapixels = (width * height) / 1_000_000;
  const shortSide = Math.min(width, height);
  const ratio = Math.min(width / height, height / width);
  const notes: string[] = [];
  let score = 100;
  if (shortSide >= 700) notes.push("Resolution is suitable for small card text.");
  else { notes.push("Use a larger image for collector-number recognition."); score -= 25; }
  if (megapixels >= 1) notes.push(`${megapixels.toFixed(1)} MP provides useful artwork detail.`);
  else { notes.push("Image is below 1 megapixel."); score -= 18; }
  if (ratio > 0.58 && ratio < 0.82) notes.push("Card-like proportions detected.");
  else { notes.push("Keep the complete card visible with less background."); score -= 12; }
  return { width, height, megapixels, score: Math.max(35, score), notes };
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
  const [notice, setNotice] = useState("");

  const selected = useMemo(
    () => result?.candidates.find((item) => item.id === selectedId) ?? result?.candidates[0] ?? null,
    [result, selectedId],
  );

  const referencePrice = useMemo(() => {
    if (!selected) return null;
    const label = finish === "Foil" ? "Foil" : finish === "Etched" ? "Etched" : "Nonfoil";
    return selected.prices.find((price) => price.label.startsWith(label))?.value ?? null;
  }, [selected, finish]);

  const adjustedValue = referencePrice == null ? null : referencePrice * CONDITION_MULTIPLIER[condition];
  const suggestedOffer = adjustedValue == null ? null : adjustedValue * (offerPercent / 100);
  const grossSpread = adjustedValue == null || suggestedOffer == null ? null : adjustedValue - suggestedOffer;

  const chooseFile = useCallback((next: File | null) => {
    setError(""); setResult(null); setSelectedId(null);
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      setError("Use a JPG, PNG, or WebP image."); return;
    }
    if (next.size > 12 * 1024 * 1024) {
      setError("Images must be 12 MB or smaller."); return;
    }
    if (preview) URL.revokeObjectURL(preview);
    const url = URL.createObjectURL(next);
    setFile(next); setPreview(url);
    const image = new window.Image();
    image.onload = () => setQuality(inspectImage(image.naturalWidth, image.naturalHeight));
    image.src = url;
  }, [preview]);

  async function analyze() {
    if (!file && !manualName.trim()) {
      setError("Drop in a card photo or enter the card name."); return;
    }
    setLoading(true); setError(""); setNotice("");
    try {
      const form = new FormData();
      if (file) form.set("image", file);
      if (manualName.trim()) form.set("cardName", manualName.trim());
      const response = await fetch("/api/purchasing/card-photo-scan", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as (CardScanResponse & { error?: string }) | null;
      if (!response.ok || !payload) throw new Error(payload?.error ?? "The card could not be analyzed.");
      setResult(payload); setSelectedId(payload.candidates[0]?.id ?? null);
      if (payload.identification.finish === "foil") setFinish("Foil");
      if (payload.identification.finish === "etched") setFinish("Etched");
      if (payload.identification.finish === "nonfoil") setFinish("Nonfoil");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The card could not be analyzed.");
    } finally { setLoading(false); }
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setQuality(null); setManualName("");
    setResult(null); setSelectedId(null); setError(""); setNotice("");
  }

  return (
    <main className="min-h-screen bg-[#020914] px-4 py-6 text-white sm:px-7 lg:px-9">
      <div className="mx-auto max-w-[1540px]">
        <header className="relative overflow-hidden rounded-[30px] border border-blue-300/[0.14] bg-[#07121f] p-6 shadow-[0_32px_110px_rgba(0,0,0,.34)] sm:p-8">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/[0.11] blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-blue-300"><ScanLine className="h-4 w-4" /> Purchasing intelligence</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Card Photo Price Scanner</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Drop in a Magic card photo, confirm the exact printing, and calculate a transparent acquisition offer. This same engine is ready for a physical scanner later.</p>
            </div>
            <div className="grid grid-cols-3 gap-2"><Metric value="1" label="Card per scan" /><Metric value="8" label="Candidates" /><Metric value="5" label="Connectors" /></div>
          </div>
        </header>

        <section className="mt-5 grid gap-5 2xl:grid-cols-[.92fr_1.08fr]">
          <div className="space-y-5">
            <Panel>
              <Heading icon={UploadCloud} eyebrow="Step 1" title="Upload the card front" detail="JPG, PNG, or WebP · 12 MB maximum" />
              <button type="button" onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0] ?? null); }} className={`mt-5 flex min-h-[360px] w-full overflow-hidden rounded-[24px] border border-dashed transition ${dragging ? "border-cyan-300/60 bg-blue-400/[.09]" : "border-blue-300/[.18] bg-[#030c17] hover:border-blue-300/40"}`}>
                {preview ? <div className="relative flex w-full items-center justify-center p-5"><img src={preview} alt="Uploaded card" className="max-h-[430px] max-w-full rounded-2xl object-contain shadow-2xl" /><span className="absolute right-3 top-3 rounded-xl border border-white/[.1] bg-black/65 px-3 py-2 text-[9px] font-semibold">Replace image</span></div> : <div className="m-auto px-6 py-12 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-blue-300/[.18] bg-blue-400/[.07] text-blue-300"><ImagePlus className="h-7 w-7" /></span><p className="mt-5 text-lg font-semibold">Drop a card photo here</p><p className="mt-2 text-xs leading-5 text-slate-500">Keep the full card visible and avoid glare.</p><span className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-300 px-4 text-[10px] font-semibold text-[#020914]"><FileImage className="h-4 w-4" /> Choose image</span></div>}
              </button>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
              {quality ? <div className="mt-4 rounded-2xl border border-white/[.07] bg-black/[.16] p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold">Image quality check</p><p className="mt-1 text-[9px] text-slate-600">{quality.width} × {quality.height} · {quality.megapixels.toFixed(1)} MP</p></div><span className={`rounded-full px-3 py-1 text-[9px] font-semibold ${quality.score >= 80 ? "bg-emerald-400/[.08] text-emerald-300" : "bg-amber-400/[.08] text-amber-300"}`}>{quality.score}% ready</span></div><div className="mt-3 space-y-2">{quality.notes.map((note) => <p key={note} className="flex gap-2 text-[10px] leading-4 text-slate-500"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />{note}</p>)}</div></div> : null}
              <div className="mt-4"><label className="text-[9px] font-semibold uppercase tracking-[.14em] text-slate-600">Optional card-name assist</label><div className="mt-2 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="Example: Rhystic Study" className="h-11 w-full rounded-xl border border-white/[.08] bg-[#030c17] pl-10 pr-3 text-sm outline-none placeholder:text-slate-700" /></div><button type="button" disabled={loading} onClick={analyze} className="inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-300 px-4 text-[10px] font-semibold text-[#020914] disabled:opacity-50">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{loading ? "Analyzing" : "Analyze"}</button></div></div>
              {error ? <div className="mt-4 flex gap-2 rounded-xl border border-rose-300/15 bg-rose-400/[.04] p-3 text-[10px] text-rose-200"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div> : null}
            </Panel>

            <Panel><Heading icon={ShieldCheck} eyebrow="Accuracy safeguards" title="Confidence before automation" detail="Printing, finish, language, and condition remain confirmable." /><div className="mt-5 grid gap-3 sm:grid-cols-2"><Safeguard title="Candidate ranking" text="Up to eight exact-printing candidates." /><Safeguard title="Photo validation" text="Resolution and card-proportion checks." /><Safeguard title="Manual confirmation" text="No final offer before a printing is selected." /><Safeguard title="Source transparency" text="Unavailable connectors are never fabricated." /></div></Panel>
          </div>

          <div className="space-y-5">
            {!result ? <EmptyState /> : <>
              <Panel><div className="flex items-start justify-between gap-4"><Heading icon={ScanLine} eyebrow="Step 2" title="Confirm the exact printing" detail={`${result.recognitionMode} recognition · ${Math.round(result.identification.confidence * 100)}% initial confidence`} /><button onClick={reset} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[.08] px-3 text-[9px] text-slate-400"><RotateCcw className="h-3.5 w-3.5" /> New scan</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{result.candidates.map((candidate, index) => <Candidate key={candidate.id} candidate={candidate} rank={index + 1} selected={selected?.id === candidate.id} onClick={() => setSelectedId(candidate.id)} />)}</div></Panel>
              {selected ? <Panel highlighted><Heading icon={BadgeDollarSign} eyebrow="Step 3" title="Price and build the offer" detail="Confirm finish and condition before relying on the recommendation." /><div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]"><div className="rounded-[22px] border border-white/[.07] bg-[#030c17] p-4">{selected.imageUrl ? <Image src={selected.imageUrl} alt={selected.name} width={488} height={680} unoptimized className="mx-auto max-h-[330px] w-auto rounded-xl" /> : <div className="flex aspect-[5/7] items-center justify-center"><Camera className="h-8 w-8 text-slate-700" /></div>}<p className="mt-4 font-semibold">{selected.name}</p><p className="mt-1 text-[10px] text-slate-500">{selected.setName} · {selected.setCode} #{selected.collectorNumber}</p></div><div><div className="grid gap-3 sm:grid-cols-2"><Select label="Condition" value={condition} options={CONDITIONS} onChange={setCondition} /><Select label="Finish" value={finish} options={FINISHES} onChange={setFinish} /></div><div className="mt-4 rounded-2xl border border-white/[.07] bg-black/[.15] p-4"><div className="flex justify-between"><div><p className="text-[9px] uppercase tracking-[.13em] text-slate-600">Buying-rule percentage</p><p className="mt-1 text-xs text-slate-400">Pay {offerPercent}% of adjusted reference</p></div><span className="text-lg font-semibold text-blue-300">{offerPercent}%</span></div><input type="range" min="25" max="85" step="5" value={offerPercent} onChange={(event) => setOfferPercent(Number(event.target.value))} className="mt-4 w-full accent-blue-400" /></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Value label="Reference" value={money(referencePrice)} detail="Selected finish" /><Value label="Adjusted" value={money(adjustedValue)} detail={condition} /><Value label="Suggested offer" value={money(suggestedOffer)} detail={grossSpread == null ? "No spread" : `${money(grossSpread)} gross spread`} featured /></div></div></div><div className="mt-5 rounded-[22px] border border-white/[.07] bg-[#030c17] p-4"><div className="flex flex-wrap gap-2">{result.pricingCoverage.sources.map((source) => <span key={source.name} className={`rounded-full border px-2.5 py-1 text-[8px] ${source.status === "available" ? "border-emerald-300/15 text-emerald-300" : "border-amber-300/15 text-amber-300"}`}>{source.name}</span>)}</div><div className="mt-4 grid gap-2">{selected.prices.map((price) => <Price key={price.label} price={price} />)}</div></div><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button onClick={() => setNotice("This confirmed card is ready for the Collection Buying handoff in the next integration step.")} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-300 text-[10px] font-semibold text-[#020914]"><ShoppingCart className="h-4 w-4" /> Add to collection purchase</button><Link href="/dashboard/inventory" className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/[.09] text-[10px] font-semibold">Open inventory intake</Link></div>{notice ? <div className="mt-4 rounded-xl border border-blue-300/15 bg-blue-400/[.04] p-3 text-[10px] text-blue-100/75">{notice}</div> : null}</Panel> : null}
            </>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({ children, highlighted = false }: { children: React.ReactNode; highlighted?: boolean }) { return <section className={`rounded-[26px] border bg-[#07121f] p-5 shadow-[0_22px_70px_rgba(0,0,0,.25)] sm:p-6 ${highlighted ? "border-blue-300/[.16]" : "border-white/[.075]"}`}>{children}</section>; }
function Heading({ icon: Icon, eyebrow, title, detail }: { icon: React.ComponentType<{ className?: string }>; eyebrow: string; title: string; detail: string }) { return <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-300/[.14] bg-blue-400/[.055] text-blue-300"><Icon className="h-4 w-4" /></span><div><p className="text-[8px] font-semibold uppercase tracking-[.15em] text-blue-300">{eyebrow}</p><h2 className="mt-1 text-base font-semibold">{title}</h2><p className="mt-1 text-[9px] leading-4 text-slate-600">{detail}</p></div></div>; }
function Metric({ value, label }: { value: string; label: string }) { return <div className="min-w-24 rounded-2xl border border-white/[.07] bg-black/[.16] px-4 py-3 text-center"><p className="text-lg font-semibold text-blue-200">{value}</p><p className="text-[8px] uppercase tracking-[.11em] text-slate-600">{label}</p></div>; }
function Safeguard({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-white/[.07] bg-black/[.13] p-4"><CheckCircle2 className="h-4 w-4 text-emerald-300" /><p className="mt-3 text-xs font-semibold">{title}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{text}</p></div>; }
function EmptyState() { return <section className="flex min-h-[620px] flex-col items-center justify-center rounded-[26px] border border-dashed border-blue-300/[.15] bg-[#07121f] p-8 text-center"><span className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-blue-300/[.14] bg-blue-400/[.05] text-blue-300"><ScanLine className="h-9 w-9" /></span><h2 className="mt-6 text-xl font-semibold">Your scan results will appear here</h2><p className="mt-3 max-w-md text-xs leading-6 text-slate-600">Upload a card image to receive printing candidates, confidence scores, pricing references, and a suggested acquisition offer.</p></section>; }
function Candidate({ candidate, rank, selected, onClick }: { candidate: CardCandidate; rank: number; selected: boolean; onClick: () => void }) { return <button onClick={onClick} className={`overflow-hidden rounded-[20px] border text-left transition ${selected ? "border-blue-300/45 bg-blue-400/[.075]" : "border-white/[.07] bg-black/[.13] hover:-translate-y-1"}`}><div className="relative aspect-[5/4] bg-[#020914]">{candidate.imageUrl ? <Image src={candidate.imageUrl} alt={candidate.name} fill unoptimized className="object-contain p-3" /> : null}<span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-1 text-[8px]">#{rank}</span><span className="absolute right-2 top-2 rounded-full bg-[#07121f]/90 px-2 py-1 text-[8px] text-blue-200">{Math.round(candidate.confidence * 100)}%</span></div><div className="p-3"><p className="truncate text-xs font-semibold">{candidate.name}</p><p className="mt-1 text-[9px] text-slate-600">{candidate.setName}</p><p className="mt-3 text-[8px] font-semibold uppercase tracking-[.09em] text-blue-300">{candidate.setCode} #{candidate.collectorNumber}</p></div></button>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label><span className="text-[9px] uppercase tracking-[.13em] text-slate-600">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/[.08] bg-[#030c17] px-3 text-xs">{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function Value({ label, value, detail, featured = false }: { label: string; value: string; detail: string; featured?: boolean }) { return <div className={`rounded-2xl border p-4 ${featured ? "border-blue-300/25 bg-blue-400/[.07]" : "border-white/[.07] bg-black/[.14]"}`}><p className="text-[8px] uppercase tracking-[.12em] text-slate-600">{label}</p><p className={`mt-2 text-xl font-semibold ${featured ? "text-cyan-200" : ""}`}>{value}</p><p className="mt-1 text-[8px] text-slate-700">{detail}</p></div>; }
function Price({ price }: { price: PricePoint }) { return <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[.055] bg-white/[.018] px-3 py-3"><div><p className="text-[10px] text-slate-300">{price.label}</p><p className="mt-1 text-[8px] text-slate-700">{price.source}{price.note ? ` · ${price.note}` : ""}</p></div><div className="flex items-center gap-2"><span className="text-[10px] font-semibold">{price.value == null ? (price.available ? "Open listings" : "Unavailable") : money(price.value, price.currency)}</span>{price.url ? <a href={price.url} target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[.07] text-blue-300"><ExternalLink className="h-3.5 w-3.5" /></a> : null}</div></div>; }
