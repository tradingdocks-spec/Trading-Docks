"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Store,
  Upload,
  WandSparkles,
} from "lucide-react";

import { accountStorageKey } from "@/lib/account-storage";
import {
  CANONICAL_FIELDS,
  CSV_TEMPLATES,
  detectTemplate,
  mappingForTemplate,
  outputForTemplate,
  type CanonicalKey,
  type CanonicalRow,
} from "@/lib/csv-conversion/templates";

type CsvRow = Record<string, string>;
type LocationRecord = {
  id: string;
  name: string;
  type: "chaos" | "binder" | "sealed-local" | "sealed-warehouse" | "custom";
  description: string;
  itemCount: number;
  estimatedValue: number;
};
const LOCATION_STORAGE_KEY = "trading-docks-inventory-locations-v1";
const ITEM_STORAGE_KEY = "trading-docks-inventory-items-v1";
const MOVEMENT_STORAGE_KEY = "trading-docks-inventory-movements-v1";
export function CsvConversionEngine() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Record<CanonicalKey, string>>(
    Object.fromEntries(CANONICAL_FIELDS.map(({ key }) => [key, ""])) as Record<CanonicalKey, string>,
  );
  const [detectedTemplate, setDetectedTemplate] = useState("Unknown / Generic");
  const [outputTemplateId, setOutputTemplateId] = useState("trading-docks");
  const [enrichedRows, setEnrichedRows] = useState<Record<number, Partial<CanonicalRow>>>({});
  const [destination, setDestination] = useState<"download" | "inventory">("download");
  const [locationName, setLocationName] = useState("Bulk Box 001");
  const [marketplace, setMarketplace] = useState("Unlisted");
  const [defaultCondition, setDefaultCondition] = useState("Near Mint");
  const [defaultFinish, setDefaultFinish] = useState("Nonfoil");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);

  const converted = useMemo(() => {
    const normalized = rows.flatMap((sourceRow) => {
      const base = Object.fromEntries(
        CANONICAL_FIELDS.map(({ key }) => [
          key,
          mapping[key] ? sourceRow[mapping[key]] ?? "" : "",
        ]),
      ) as CanonicalRow;
      return splitFinishQuantities(base).map((row) =>
        normalizeCanonicalRow(row, defaultCondition, defaultFinish),
      );
    });
    return normalized.map((row, index) => ({ ...row, ...(enrichedRows[index] ?? {}) }));
  }, [defaultCondition, defaultFinish, enrichedRows, mapping, rows]);
  const validRows = converted.filter((row) => row.name.trim());
  const quantityTotal = validRows.reduce(
    (sum, row) => sum + Math.max(1, Number.parseInt(row.quantity, 10) || 1),
    0,
  );

  function loadCsv(text: string, name = "pasted-data.csv") {
    const matrix = parseCsv(text);
    if (matrix.length < 2) {
      setNotice("The CSV needs a header row and at least one data row.");
      return;
    }
    const nextHeaders = matrix[0].map((value, index) => value.trim() || `Column ${index + 1}`);
    const nextRows = matrix
      .slice(1)
      .filter((values) => values.some((value) => value.trim()))
      .map((values) =>
        Object.fromEntries(nextHeaders.map((header, index) => [header, values[index] ?? ""])),
      );
    const detection = detectTemplate(nextHeaders);
    setHeaders(nextHeaders);
    setRows(nextRows);
    setMapping(mappingForTemplate(nextHeaders, detection.item));
    setDetectedTemplate(
      detection.score >= 0.45
        ? `${detection.item.name} (${Math.round(detection.score * 100)}% header match)`
        : "Unknown / Generic",
    );
    setEnrichedRows({});
    setFileName(name);
    setNotice(`${nextRows.length.toLocaleString()} rows loaded. Review the field mapping below.`);
  }

  async function handleFile(file: File) {
    const text = await file.text();
    setRawText(text);
    loadCsv(text, file.name);
  }

  function downloadConverted() {
    if (!validRows.length) return setNotice("Map a card or product name before exporting.");
    if (
      outputTemplateId === "tcgplayer" &&
      validRows.some((row) => !row.tcgplayerId.trim())
    ) {
      setNotice(
        "A direct TCGplayer export requires condition/printing-specific TCGplayer IDs. Download the ManaBox bridge file first, import it into ManaBox, then upload the TCGplayer export from ManaBox here. TCGCSV product IDs cannot safely replace TCGplayer SKU IDs.",
      );
      return;
    }
    const { headers: outputHeaders, values } = outputForTemplate(validRows, outputTemplateId);
    const outputName =
      CSV_TEMPLATES.find((template) => template.id === outputTemplateId)?.name ??
      "Trading Docks";
    const csv = [outputHeaders, ...values]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${baseName(fileName)}-${slug(outputName)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`${outputName} CSV downloaded with ${validRows.length.toLocaleString()} rows.`);
  }

  async function enrichForTcgplayer() {
    if (!validRows.length) return setNotice("Load and map rows before resolving TCGplayer IDs.");
    setWorking(true);
    setNotice("Resolving TCGplayer product IDs through TCGCSV…");
    try {
      const response = await fetch("/api/tools/csv/tcgplayer-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: converted.map((row) => ({
            name: row.name,
            set: row.set,
            setName: row.setName,
            collectorNumber: row.collectorNumber,
          })),
        }),
      });
      const payload = await response.json() as {
        error?: string;
        results?: Array<{
          matched: boolean;
          tcgplayerProductId?: string;
          productName?: string;
          setName?: string;
          collectorNumber?: string;
          rarity?: string;
          imageUrl?: string;
          productLine?: string;
          marketPrice?: string;
          lowPrice?: string;
          directLowPrice?: string;
        }>;
      };
      if (!response.ok || !payload.results) throw new Error(payload.error ?? "TCGCSV lookup failed.");
      const next: Record<number, Partial<CanonicalRow>> = {};
      let matched = 0;
      payload.results.forEach((result, index) => {
        if (!result.matched) return;
        matched += 1;
        next[index] = {
          tcgplayerProductId: result.tcgplayerProductId ?? "",
          name: result.productName ?? converted[index]?.name ?? "",
          setName: result.setName ?? converted[index]?.setName ?? "",
          collectorNumber: result.collectorNumber ?? converted[index]?.collectorNumber ?? "",
          rarity: result.rarity ?? converted[index]?.rarity ?? "",
          imageUrl: result.imageUrl ?? converted[index]?.imageUrl ?? "",
          productLine: result.productLine ?? "Magic",
          marketPrice: result.marketPrice || converted[index]?.marketPrice || "",
          lowPrice: result.lowPrice || converted[index]?.lowPrice || "",
          directLowPrice: result.directLowPrice || converted[index]?.directLowPrice || "",
        };
      });
      setEnrichedRows(next);
      setOutputTemplateId("tcgplayer");
      setNotice(
        `${matched.toLocaleString()} of ${payload.results.length.toLocaleString()} rows matched to TCGplayer IDs through TCGCSV. Review unmatched rows before download.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "TCGplayer IDs could not be resolved.");
    } finally {
      setWorking(false);
    }
  }

  async function saveToInventory() {
    if (!validRows.length) return setNotice("Map a card or product name before saving.");
    if (!locationName.trim()) return setNotice("Choose or enter a storage location.");
    setWorking(true);
    try {
      const [locationsKey, itemsKey, movementsKey] = await Promise.all([
        accountStorageKey(LOCATION_STORAGE_KEY),
        accountStorageKey(ITEM_STORAGE_KEY),
        accountStorageKey(MOVEMENT_STORAGE_KEY),
      ]);
      const locations = readStored<LocationRecord[]>(locationsKey, []);
      const items = readStored<Array<Record<string, unknown>>>(itemsKey, []);
      const movements = readStored<Array<Record<string, unknown>>>(movementsKey, []);
      let location = locations.find(
        (item) => item.name.trim().toLowerCase() === locationName.trim().toLowerCase(),
      );
      if (!location) {
        location = {
          id: crypto.randomUUID(),
          name: locationName.trim(),
          type: locationName.toLowerCase().includes("bulk") ? "chaos" : "custom",
          description: "Created by CSV Conversion Engine",
          itemCount: 0,
          estimatedValue: 0,
        };
        locations.push(location);
      }
      const now = new Date().toISOString();
      const newItems = validRows.map((row) => {
        const quantity = Math.max(1, Number.parseInt(row.quantity, 10) || 1);
        const price = Math.max(0, Number.parseFloat(row.marketPrice) || 0);
        return {
          id: crypto.randomUUID(),
          name: row.name.trim(),
          sku: row.sku.trim() || `TD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          category: "Single",
          quantity,
          locationId: location!.id,
          condition: row.condition.trim() || "Near Mint",
          set: row.set.trim().toUpperCase(),
          collectorNumber: row.collectorNumber.trim(),
          language: row.language.trim() || "English",
          finish: normalizeFinish(row.finish),
          scryfallId: row.scryfallId.trim() || undefined,
          tcgplayerId: row.tcgplayerId.trim() || undefined,
          costBasis: Math.max(0, Number.parseFloat(row.costBasis) || 0),
          unitMarketValue: price,
          value: price * quantity,
          updatedAt: now,
          marketplaceListings:
            marketplace === "Unlisted"
              ? []
              : [{ platform: marketplace, status: "Active", quantity, price, updatedAt: now }],
        };
      });
      location.itemCount += newItems.reduce((sum, item) => sum + item.quantity, 0);
      location.estimatedValue += newItems.reduce((sum, item) => sum + item.value, 0);
      const movementRows = newItems.map((item) => ({
        id: crypto.randomUUID(),
        itemName: item.name,
        to: location!.name,
        quantity: item.quantity,
        action: "filed",
        timestamp: now,
      }));
      window.localStorage.setItem(locationsKey, JSON.stringify(locations));
      window.localStorage.setItem(itemsKey, JSON.stringify([...items, ...newItems]));
      window.localStorage.setItem(movementsKey, JSON.stringify([...movements, ...movementRows]));
      setNotice(
        `${quantityTotal.toLocaleString()} units saved to ${location.name}${
          marketplace === "Unlisted" ? "" : ` and allocated to ${marketplace}`
        }.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The converted inventory could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  function reset() {
    setRawText("");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setDetectedTemplate("Unknown / Generic");
    setEnrichedRows({});
    setNotice("");
  }

  return (
    <div className="mx-auto w-full max-w-[1650px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[30px] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_32%),#06131d] p-6 shadow-[0_30px_90px_rgba(0,0,0,.3)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300"><WandSparkles className="h-4 w-4" />Seller & Store Tools</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">CSV Conversion Engine</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Convert marketplace, scanner, binder, and inventory files into one reviewed format—then download the result or file the cards directly into Trading Docks.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.03] px-4 py-3 text-[10px] text-emerald-100/65"><ShieldCheck className="h-4 w-4 text-emerald-300" />Local review before inventory changes</div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <div className="space-y-4 rounded-[26px] border border-white/[.08] bg-[#07141e] p-5">
          <SectionTitle step="1" title="Load source data" detail="Upload a CSV or paste its complete contents." />
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} />
          <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-28 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-300/[.025] text-cyan-100 hover:bg-cyan-300/[.05]"><Upload className="h-5 w-5 text-cyan-300" /><span className="mt-2 text-xs font-semibold">Choose CSV file</span><span className="mt-1 text-[9px] text-slate-600">TCGplayer, ManaBox, Moxfield, scanner, or generic CSV</span></button>
          <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder={"Name,Set,Collector Number,Condition,Quantity\nSol Ring,CMM,396,Near Mint,2"} className="min-h-44 w-full rounded-2xl border border-white/[.08] bg-black/15 p-4 font-mono text-[10px] leading-5 text-slate-300 outline-none placeholder:text-slate-700 focus:border-cyan-300/25" />
          <div className="flex gap-2">
            <button type="button" onClick={() => loadCsv(rawText)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 text-[10px] font-bold text-[#001018]"><FileSpreadsheet className="h-4 w-4" />Read pasted CSV</button>
            <button type="button" onClick={reset} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[.08] px-3 text-[10px] font-semibold text-slate-400"><RefreshCw className="h-3.5 w-3.5" />Reset</button>
          </div>
        </div>

        <div className="space-y-4 rounded-[26px] border border-white/[.08] bg-[#07141e] p-5">
          <SectionTitle step="2" title="Map and review fields" detail={headers.length ? `${fileName} · ${rows.length.toLocaleString()} rows · Detected: ${detectedTemplate}` : "Load a file to detect its columns."} />
          {headers.length ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CANONICAL_FIELDS.map((field) => (
                  <label key={field.key}>
                    <span className="text-[9px] font-semibold text-slate-400">{field.label}{field.required ? " *" : ""}</span>
                    <select value={mapping[field.key]} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-xl border border-white/[.08] bg-[#050e15] px-3 text-[10px] text-slate-300 outline-none">
                      <option value="">Not mapped</option>
                      {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="grid gap-3 rounded-2xl border border-violet-300/10 bg-violet-300/[.025] p-4 sm:grid-cols-2">
                <label><span className="text-[9px] font-semibold text-violet-100/70">Condition when source is blank</span><select value={defaultCondition} onChange={(event) => setDefaultCondition(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[.08] bg-[#050e15] px-3 text-[10px] text-slate-300"><option>Near Mint</option><option>Lightly Played</option><option>Moderately Played</option><option>Heavily Played</option><option>Damaged</option></select><span className="mt-1 block text-[9px] text-slate-600">Existing condition values are normalized; this is used only when the template omits condition.</span></label>
                <label><span className="text-[9px] font-semibold text-violet-100/70">Finish when source is blank</span><select value={defaultFinish} onChange={(event) => setDefaultFinish(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[.08] bg-[#050e15] px-3 text-[10px] text-slate-300"><option>Nonfoil</option><option>Foil</option><option>Etched</option></select><span className="mt-1 block text-[9px] text-slate-600">Regular and foil quantity columns are split into separate inventory rows automatically.</span></label>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-white/[.07]">
                <table className="w-full min-w-[760px] text-left text-[10px]">
                  <thead className="bg-white/[.025] text-slate-500"><tr>{["Name", "Set", "No.", "Condition", "Finish", "Qty", "Price"].map((value) => <th key={value} className="px-3 py-2.5 font-semibold">{value}</th>)}</tr></thead>
                  <tbody>{converted.slice(0, 8).map((row, index) => <tr key={`${row.name}-${index}`} className="border-t border-white/[.055] text-slate-300"><td className="max-w-52 truncate px-3 py-2.5 font-medium text-white">{row.name || "Unmapped"}</td><td className="px-3 py-2.5">{row.set}</td><td className="px-3 py-2.5">{row.collectorNumber}</td><td className="px-3 py-2.5">{row.condition}</td><td className="px-3 py-2.5">{row.finish}</td><td className="px-3 py-2.5">{row.quantity || "1"}</td><td className="px-3 py-2.5">{row.marketPrice}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 text-[9px]"><Stat label="Valid rows" value={validRows.length} /><Stat label="Units" value={quantityTotal} /><Stat label="Skipped" value={converted.length - validRows.length} /></div>
            </>
          ) : <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[.07] text-center"><FileSpreadsheet className="h-7 w-7 text-slate-700" /><p className="mt-3 text-xs font-semibold text-slate-500">No CSV loaded</p><p className="mt-1 text-[10px] text-slate-700">Your field mapping and preview will appear here.</p></div>}
        </div>
      </section>

      <section className="rounded-[26px] border border-white/[.08] bg-[#07141e] p-5">
        <SectionTitle step="3" title="Choose the result" detail="Download a marketplace-ready CSV or save reviewed rows into inventory." />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <button type="button" onClick={() => setDestination("download")} className={`rounded-2xl border p-4 text-left ${destination === "download" ? "border-cyan-300/25 bg-cyan-300/[.055]" : "border-white/[.07] bg-black/10"}`}><Download className="h-5 w-5 text-cyan-300" /><p className="mt-3 text-sm font-semibold text-white">Download converted CSV</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Create a clean file for another platform without changing inventory.</p></button>
          <button type="button" onClick={() => setDestination("inventory")} className={`rounded-2xl border p-4 text-left ${destination === "inventory" ? "border-cyan-300/25 bg-cyan-300/[.055]" : "border-white/[.07] bg-black/10"}`}><Boxes className="h-5 w-5 text-cyan-300" /><p className="mt-3 text-sm font-semibold text-white">Save into Trading Docks</p><p className="mt-1 text-[10px] leading-4 text-slate-500">File cards into a Bulk Box or another named storage location.</p></button>
        </div>
        {destination === "download" ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-white/[.07] bg-black/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1"><span className="text-[9px] font-semibold text-slate-500">Output template</span><select value={outputTemplateId} onChange={(event) => setOutputTemplateId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-white/[.08] bg-[#050e15] px-3 text-xs text-slate-300">{CSV_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
              {outputTemplateId === "tcgplayer" ? <button type="button" onClick={() => void enrichForTcgplayer()} disabled={!validRows.length || working} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[.06] px-5 text-xs font-bold text-cyan-100 disabled:opacity-40">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}Resolve TCGplayer IDs</button> : null}
              <button type="button" onClick={downloadConverted} disabled={!validRows.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-xs font-bold text-[#001018] disabled:opacity-40"><Download className="h-4 w-4" />Download CSV</button>
            </div>
            {outputTemplateId === "tcgplayer" ? <div className="rounded-xl border border-amber-300/10 bg-amber-300/[.025] p-3 text-[10px] leading-5 text-amber-100/55"><strong className="text-amber-200">Required TCGplayer bridge:</strong> First export the ManaBox preset with name, set, collector number, condition and foil preserved. Import that file into ManaBox, then export its TCGplayer template and upload it back here. “Resolve TCGplayer IDs” adds TCGCSV product data and pricing for review, but it does not substitute product IDs for condition/printing-specific TCGplayer SKU IDs.</div> : null}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 rounded-2xl border border-white/[.07] bg-black/10 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label><span className="text-[9px] font-semibold text-slate-500">Storage location</span><div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-white/[.08] bg-[#050e15] px-3"><MapPin className="h-4 w-4 text-cyan-300" /><input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Bulk Box 001" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none" /></div></label>
            <label><span className="text-[9px] font-semibold text-slate-500">Listing allocation</span><div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-white/[.08] bg-[#050e15] px-3"><Store className="h-4 w-4 text-cyan-300" /><select value={marketplace} onChange={(event) => setMarketplace(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-slate-300 outline-none"><option>Unlisted</option><option>TCGplayer</option><option>eBay</option><option>Mana Pool</option><option>Trading Docks</option><option>In-Store</option></select></div></label>
            <button type="button" onClick={() => void saveToInventory()} disabled={!validRows.length || working} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-xs font-bold text-[#001018] disabled:opacity-40">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}Save reviewed rows</button>
          </div>
        )}
      </section>
      {notice ? <div role="status" className="fixed bottom-5 right-5 z-[180] max-w-sm rounded-2xl border border-cyan-300/15 bg-[#0a1a24] px-4 py-3 text-xs leading-5 text-cyan-100 shadow-2xl">{notice}</div> : null}
    </div>
  );
}

function SectionTitle({ step, title, detail }: { step: string; title: string; detail: string }) {
  return <div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[.055] text-[10px] font-bold text-cyan-200">{step}</span><div><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mt-1 text-[10px] leading-4 text-slate-600">{detail}</p></div></div>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return <span className="inline-flex items-center gap-2 rounded-lg border border-white/[.07] bg-black/10 px-2.5 py-1.5 text-slate-500"><Check className="h-3 w-3 text-cyan-300" />{label}: <strong className="text-slate-200">{value.toLocaleString()}</strong></span>;
}
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); rows.push(row); row = []; value = "";
    } else value += char;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  return rows;
}
function csvEscape(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
function readStored<T>(key: string, fallback: T): T {
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}
function normalizeFinish(value: string) {
  const clean = value.trim().toLowerCase();
  if (clean.includes("etched")) return "Etched";
  if (clean === "nonfoil" || clean === "non-foil" || clean === "normal") return "Nonfoil";
  if (clean === "true" || clean.includes("foil")) return "Foil";
  return "Nonfoil";
}
function normalizeCanonicalRow(
  row: CanonicalRow,
  defaultCondition: string,
  defaultFinish: string,
) {
  return {
    ...row,
    condition: normalizeCondition(row.condition, defaultCondition),
    finish: normalizeFinishValue(row.finish, defaultFinish),
    language: normalizeLanguage(row.language),
    quantity: String(Math.max(1, Number.parseInt(row.quantity, 10) || 1)),
  };
}
function splitFinishQuantities(row: CanonicalRow) {
  const regular = Math.max(0, Number.parseInt(row.regularQuantity, 10) || 0);
  const foil = Math.max(0, Number.parseInt(row.foilQuantity, 10) || 0);
  if (!regular && !foil) return [row];
  const split: CanonicalRow[] = [];
  if (regular) split.push({ ...row, quantity: String(regular), finish: "Nonfoil" });
  if (foil) split.push({ ...row, quantity: String(foil), finish: "Foil" });
  return split;
}
function normalizeCondition(value: string, fallback: string) {
  const clean = value.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return fallback;
  if (["m", "mint", "nm", "nearmint"].includes(clean)) return "Near Mint";
  if (["ex", "excellent", "lp", "lightlyplayed"].includes(clean)) return "Lightly Played";
  if (["gd", "good", "mp", "moderatelyplayed"].includes(clean)) return "Moderately Played";
  if (["pl", "played", "hp", "heavilyplayed"].includes(clean)) return "Heavily Played";
  if (["po", "poor", "dmg", "damaged"].includes(clean)) return "Damaged";
  return value.trim();
}
function normalizeFinishValue(value: string, fallback: string) {
  const clean = value.trim().toLowerCase();
  if (!clean) return fallback;
  if (clean.includes("etched")) return "Etched";
  if (["1", "true", "yes", "foil", "premium"].includes(clean) || clean.includes("foil")) {
    return "Foil";
  }
  if (["0", "false", "no", "normal", "regular", "nonfoil", "non-foil"].includes(clean)) {
    return "Nonfoil";
  }
  return value.trim();
}
function normalizeLanguage(value: string) {
  const clean = value.trim().toLowerCase();
  if (!clean || clean === "0" || clean === "en") return "English";
  const languages: Record<string, string> = {
    de: "German", es: "Spanish", fr: "French", it: "Italian",
    ja: "Japanese", ko: "Korean", pt: "Portuguese", ru: "Russian",
    zhs: "Chinese Simplified", zht: "Chinese Traditional",
  };
  return languages[clean] ?? value.trim();
}
function baseName(value: string) {
  return (value || "trading-docks-converted").replace(/\.csv$/i, "");
}
function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
