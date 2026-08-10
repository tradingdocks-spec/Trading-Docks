"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Upload,
  WandSparkles,
} from "lucide-react";

import {
  loadInventorySnapshot,
  persistInventorySnapshotDiff,
  type InventoryPersistenceRecord,
} from "@/lib/inventory-persistence";
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
const TCGPLAYER_HEADERS =
  CSV_TEMPLATES.find((template) => template.id === "tcgplayer")?.headers ?? [];
const IMPORTANT_FIELDS: CanonicalKey[] = [
  "name",
  "set",
  "collectorNumber",
  "condition",
  "finish",
  "quantity",
];
export function CsvConversionEngine() {
  const fileRef = useRef<HTMLInputElement>(null);
  const tcgplayerReferenceRef = useRef<HTMLInputElement>(null);
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
  const [showPaste, setShowPaste] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [showBridgeHelp, setShowBridgeHelp] = useState(false);
  const [tcgplayerReferenceName, setTcgplayerReferenceName] = useState("");
  const [tcgplayerReferenceRows, setTcgplayerReferenceRows] = useState<CsvRow[]>([]);

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
    return normalized.map((row, index) => {
      const enriched = { ...row, ...(enrichedRows[index] ?? {}) };
      return {
        ...enriched,
        ...matchTcgplayerReference(enriched, tcgplayerReferenceRows),
      };
    });
  }, [
    defaultCondition,
    defaultFinish,
    enrichedRows,
    mapping,
    rows,
    tcgplayerReferenceRows,
  ]);
  const validRows = converted.filter((row) => row.name.trim());
  const quantityTotal = validRows.reduce(
    (sum, row) => sum + Math.max(1, Number.parseInt(row.quantity, 10) || 1),
    0,
  );
  const missingTcgplayerSkuCount = validRows.filter((row) => !row.tcgplayerId.trim()).length;

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
    setShowAdvanced(detection.score < 0.45);
    setShowAllRows(false);
  }

  async function handleFile(file: File) {
    const text = await file.text();
    setRawText(text);
    loadCsv(text, file.name);
  }

  async function handleTcgplayerReference(file: File) {
    const matrix = parseCsv(await file.text());
    if (matrix.length < 2) {
      setNotice("The TCGplayer reference export does not contain any product rows.");
      return;
    }
    const referenceHeaders = matrix[0].map((value) => value.replace(/^\uFEFF/, "").trim());
    if (
      referenceHeaders.length !== TCGPLAYER_HEADERS.length ||
      referenceHeaders.some((header, index) => header !== TCGPLAYER_HEADERS[index])
    ) {
      setNotice(
        "That reference file does not match the required 16-column TCGplayer Pricing export.",
      );
      return;
    }
    const referenceRows = matrix
      .slice(1)
      .filter((values) => values.some((value) => value.trim()))
      .map((values) =>
        Object.fromEntries(referenceHeaders.map((header, index) => [header, values[index] ?? ""])),
      );
    setTcgplayerReferenceName(file.name);
    setTcgplayerReferenceRows(referenceRows);
    const withIds = referenceRows.filter((row) => row["TCGplayer Id"]?.trim()).length;
    setNotice(
      `${withIds.toLocaleString()} verified TCGplayer SKU rows loaded from ${file.name}.`,
    );
  }

  function downloadConverted() {
    if (!validRows.length) return setNotice("Map a card or product name before exporting.");
    if (
      outputTemplateId === "tcgplayer" &&
      validRows.some((row) => !row.tcgplayerId.trim())
    ) {
      setNotice(
        "A direct TCGplayer export requires exact condition and foil-specific TCGplayer IDs. Use Resolve exact TCGplayer IDs before downloading.",
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

  function downloadManaBoxBridge() {
    if (!validRows.length) return setNotice("Map a card or product name before exporting.");
    const { headers: outputHeaders, values } = outputForTemplate(validRows, "manabox");
    const csv = [outputHeaders, ...values]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${baseName(fileName)}-manabox-bridge.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(
      `ManaBox bridge downloaded with ${validRows.length.toLocaleString()} rows. Import it into ManaBox, export TCGplayer inventory from ManaBox, then upload that export here.`,
    );
  }

  async function enrichForTcgplayer() {
    if (!validRows.length) return setNotice("Load and map rows before matching TCGplayer products.");
    setWorking(true);
    setNotice("Matching TCGplayer products and prices through TCGCSV…");
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
        `${matched.toLocaleString()} of ${payload.results.length.toLocaleString()} products matched through TCGCSV. Product details and prices were added; condition-specific TCGplayer SKU IDs were not.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "TCGplayer products could not be matched.");
    } finally {
      setWorking(false);
    }
  }

  async function resolveExactTcgplayerIds() {
    if (!validRows.length) return setNotice("Load and map rows before resolving TCGplayer IDs.");
    setWorking(true);
    setNotice("Resolving exact condition and foil-specific TCGplayer IDs from the Trading Docks catalog...");
    try {
      const next: Record<number, Partial<CanonicalRow>> = { ...enrichedRows };
      let matched = 0;
      let ambiguous = 0;
      let unresolved = 0;

      for (let offset = 0; offset < converted.length; offset += 500) {
        const chunk = converted.slice(offset, offset + 500);
        const response = await fetch("/api/tools/csv/tcgplayer-resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: chunk.map((row) => ({
              name: row.name,
              set: row.set,
              setName: row.setName,
              collectorNumber: row.collectorNumber,
              condition: row.condition,
              finish: row.finish,
            })),
          }),
        });
        const payload = await response.json() as {
          error?: string;
          results?: Array<{
            status: "matched" | "ambiguous" | "unresolved";
            reason?: string;
            tcgplayerId?: string;
            productLine?: string;
            setName?: string;
            productName?: string;
            title?: string;
            collectorNumber?: string;
            rarity?: string;
            condition?: string;
            finish?: string;
            marketPrice?: string;
            directLowPrice?: string;
            lowPrice?: string;
            marketplacePrice?: string;
            photoUrl?: string;
          }>;
        };
        if (!response.ok || !payload.results) throw new Error(payload.error ?? "TCGplayer catalog resolution failed.");

        payload.results.forEach((result, index) => {
          const rowIndex = offset + index;
          if (result.status === "matched") {
            const finish = result.finish === "Foil" ? "Foil" : "Nonfoil";
            matched += 1;
            next[rowIndex] = {
              ...(next[rowIndex] ?? {}),
              tcgplayerId: result.tcgplayerId ?? "",
              productLine: result.productLine ?? "Magic",
              setName: result.setName ?? converted[rowIndex]?.setName ?? "",
              name: result.productName ?? converted[rowIndex]?.name ?? "",
              title: result.title ?? converted[rowIndex]?.title ?? "",
              collectorNumber: result.collectorNumber ?? converted[rowIndex]?.collectorNumber ?? "",
              rarity: result.rarity ?? converted[rowIndex]?.rarity ?? "",
              condition: finish === "Foil" && result.condition ? `${result.condition} Foil` : result.condition ?? converted[rowIndex]?.condition ?? "",
              finish,
              marketPrice: result.marketplacePrice || result.marketPrice || converted[rowIndex]?.marketPrice || "",
              directLowPrice: result.directLowPrice || converted[rowIndex]?.directLowPrice || "",
              lowPrice: result.lowPrice || converted[rowIndex]?.lowPrice || "",
              imageUrl: result.photoUrl || converted[rowIndex]?.imageUrl || "",
            };
          } else if (result.status === "ambiguous") {
            ambiguous += 1;
          } else {
            unresolved += 1;
          }
        });
      }

      setEnrichedRows(next);
      setOutputTemplateId("tcgplayer");
      setNotice(
        `${matched.toLocaleString()} exact TCGplayer IDs resolved. ${ambiguous.toLocaleString()} ambiguous and ${unresolved.toLocaleString()} unresolved rows still need condition, foil, set, or collector-number review.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Exact TCGplayer IDs could not be resolved.");
    } finally {
      setWorking(false);
    }
  }

  async function saveToInventory() {
    if (!validRows.length) return setNotice("Map a card or product name before saving.");
    if (!locationName.trim()) return setNotice("Choose or enter a storage location.");
    setWorking(true);
    try {
      const currentSnapshot = await loadInventorySnapshot();
      const locations = currentSnapshot.locations as unknown as LocationRecord[];
      const items = currentSnapshot.items;
      const movements = currentSnapshot.movements;
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
      await persistInventorySnapshotDiff(currentSnapshot, {
        locations: locations as unknown as InventoryPersistenceRecord[],
        items: [...items, ...newItems],
        movements: [...movements, ...movementRows],
      });
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
    setShowPaste(false);
    setShowAdvanced(false);
    setShowAllRows(false);
  }

  const mappedImportantFields = IMPORTANT_FIELDS.filter((key) => mapping[key]).length;

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-[26px] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.1),transparent_35%),#06131d] px-6 py-5 shadow-[0_24px_70px_rgba(0,0,0,.25)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300"><WandSparkles className="h-3.5 w-3.5" />Seller & Store Tools</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">CSV Converter</h1>
            <p className="mt-1 text-xs text-slate-500">Upload, review, then convert or save your cards.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-emerald-100/65"><ShieldCheck className="h-4 w-4 text-emerald-300" />Nothing changes until you confirm</div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/[.08] bg-[#07141e] p-5">
        <SectionTitle step="1" title="Upload your CSV" detail="We automatically detect supported marketplace and collection formats." />
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-300/[.035] text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/[.07]"><Upload className="h-4 w-4 text-cyan-300" />{headers.length ? "Choose a different CSV" : "Choose CSV file"}</button>
          <button type="button" onClick={() => setShowPaste((value) => !value)} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/[.08] px-5 text-xs font-semibold text-slate-400 hover:text-white"><FileSpreadsheet className="h-4 w-4" />Paste CSV instead<ChevronDown className={`h-4 w-4 transition ${showPaste ? "rotate-180" : ""}`} /></button>
          {headers.length ? <button type="button" onClick={reset} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/[.08] px-4 text-xs font-semibold text-slate-500 hover:text-white"><RefreshCw className="h-4 w-4" />Reset</button> : null}
        </div>
        {showPaste ? <div className="mt-3 space-y-3 rounded-2xl border border-white/[.07] bg-black/10 p-3"><textarea value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder={"Name,Set,Collector Number,Condition,Quantity\nSol Ring,CMM,396,Near Mint,2"} className="min-h-36 w-full rounded-xl border border-white/[.08] bg-[#050e15] p-4 font-mono text-[10px] leading-5 text-slate-300 outline-none placeholder:text-slate-700 focus:border-cyan-300/25" /><button type="button" onClick={() => loadCsv(rawText)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-[10px] font-bold text-[#001018]"><FileSpreadsheet className="h-4 w-4" />Read pasted CSV</button></div> : null}
        {headers.length ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.025] px-4 py-3 text-[10px]"><Check className="h-4 w-4 text-emerald-300" /><strong className="text-white">{fileName}</strong><span className="text-slate-600">•</span><span className="text-slate-400">{rows.length.toLocaleString()} rows</span><span className="text-slate-600">•</span><span className="text-emerald-200">{detectedTemplate}</span></div> : null}
      </section>

      <section className="rounded-[24px] border border-white/[.08] bg-[#07141e] p-5">
        <SectionTitle step="2" title="Choose the result" detail="Pick where the reviewed cards should go." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setDestination("download")} className={`rounded-2xl border p-4 text-left ${destination === "download" ? "border-cyan-300/25 bg-cyan-300/[.055]" : "border-white/[.07] bg-black/10"}`}><Download className="h-5 w-5 text-cyan-300" /><p className="mt-3 text-sm font-semibold text-white">Download converted CSV</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Create a clean file for another platform without changing inventory.</p></button>
          <button type="button" onClick={() => setDestination("inventory")} className={`rounded-2xl border p-4 text-left ${destination === "inventory" ? "border-cyan-300/25 bg-cyan-300/[.055]" : "border-white/[.07] bg-black/10"}`}><Boxes className="h-5 w-5 text-cyan-300" /><p className="mt-3 text-sm font-semibold text-white">Save into Trading Docks</p><p className="mt-1 text-[10px] leading-4 text-slate-500">File cards into a Bulk Box or another named storage location.</p></button>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/[.08] bg-[#07141e] p-5">
        <SectionTitle step="3" title="Review and finish" detail={headers.length ? `${validRows.length.toLocaleString()} valid rows · ${quantityTotal.toLocaleString()} total cards` : "Upload a CSV to continue."} />
        {!headers.length ? <div className="mt-4 flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[.07] text-center"><FileSpreadsheet className="h-6 w-6 text-slate-700" /><p className="mt-2 text-xs font-semibold text-slate-500">Waiting for a CSV</p></div> : <>
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/[.07] bg-black/10 p-4 lg:flex-row lg:items-end">
            <label className="flex-1"><span className="text-[9px] font-semibold text-slate-500">Default condition if missing</span><select value={defaultCondition} onChange={(event) => setDefaultCondition(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-white/[.08] bg-[#050e15] px-3 text-xs text-slate-300"><option>Near Mint</option><option>Lightly Played</option><option>Moderately Played</option><option>Heavily Played</option><option>Damaged</option></select></label>
            <label className="flex-1"><span className="text-[9px] font-semibold text-slate-500">Default finish if missing</span><select value={defaultFinish} onChange={(event) => setDefaultFinish(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-white/[.08] bg-[#050e15] px-3 text-xs text-slate-300"><option>Nonfoil</option><option>Foil</option><option>Etched</option></select></label>
            <div className="flex flex-wrap gap-2 text-[9px] lg:pb-1"><Stat label="Valid" value={validRows.length} /><Stat label="Units" value={quantityTotal} /><Stat label="Skipped" value={converted.length - validRows.length} /></div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[.07]">
            <table className="w-full min-w-[700px] text-left text-[10px]">
              <thead className="bg-white/[.025] text-slate-500"><tr>{["Name", "Set", "No.", "Condition", "Finish", "Qty"].map((value) => <th key={value} className="px-3 py-2.5 font-semibold">{value}</th>)}</tr></thead>
              <tbody>{converted.slice(0, showAllRows ? converted.length : 5).map((row, index) => <tr key={`${row.name}-${index}`} className="border-t border-white/[.055] text-slate-300"><td className="max-w-60 truncate px-3 py-2.5 font-medium text-white">{row.name || <span className="text-amber-300">Missing name</span>}</td><td className="px-3 py-2.5">{row.set || row.setName}</td><td className="px-3 py-2.5">{row.collectorNumber}</td><td className="px-3 py-2.5">{row.condition}</td><td className="px-3 py-2.5">{row.finish}</td><td className="px-3 py-2.5">{row.quantity || "1"}</td></tr>)}</tbody>
            </table>
          </div>
          {converted.length > 5 ? <button type="button" onClick={() => setShowAllRows((value) => !value)} className="mt-3 inline-flex items-center gap-2 text-[10px] font-semibold text-cyan-200"><Eye className="h-3.5 w-3.5" />{showAllRows ? "Show fewer cards" : `Review all ${converted.length.toLocaleString()} cards`}</button> : null}

          <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-white/[.07] bg-black/10 px-4 py-3 text-left">
            <span className="flex items-center gap-3"><SlidersHorizontal className="h-4 w-4 text-cyan-300" /><span><strong className="block text-xs text-white">Advanced field mapping</strong><span className="mt-0.5 block text-[9px] text-slate-600">{mappedImportantFields} of {IMPORTANT_FIELDS.length} important fields mapped · Open only if something looks wrong</span></span></span>
            <ChevronDown className={`h-4 w-4 text-slate-500 transition ${showAdvanced ? "rotate-180" : ""}`} />
          </button>
          {showAdvanced ? <div className="mt-3 grid gap-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.02] p-4 sm:grid-cols-2 lg:grid-cols-3">{CANONICAL_FIELDS.map((field) => <label key={field.key}><span className="text-[9px] font-semibold text-slate-400">{field.label}{field.required ? " *" : ""}</span><select value={mapping[field.key]} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-xl border border-white/[.08] bg-[#050e15] px-3 text-[10px] text-slate-300 outline-none"><option value="">Not mapped</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div> : null}

          {destination === "download" ? <div className="mt-4 space-y-3 rounded-2xl border border-white/[.07] bg-black/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1"><span className="text-[9px] font-semibold text-slate-500">Convert to</span><select value={outputTemplateId} onChange={(event) => setOutputTemplateId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-white/[.08] bg-[#050e15] px-3 text-xs text-slate-300">{CSV_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
              {outputTemplateId === "tcgplayer" ? <button type="button" onClick={() => void resolveExactTcgplayerIds()} disabled={!validRows.length || working} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-xs font-bold text-[#001018] disabled:opacity-40">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}Resolve exact TCGplayer IDs</button> : null}
              {outputTemplateId === "tcgplayer" ? <button type="button" onClick={() => void enrichForTcgplayer()} disabled={!validRows.length || working} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[.06] px-5 text-xs font-bold text-cyan-100 disabled:opacity-40"><WandSparkles className="h-4 w-4" />Match product details</button> : null}
              {outputTemplateId !== "tcgplayer" || !missingTcgplayerSkuCount ? <button type="button" onClick={downloadConverted} disabled={!validRows.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-xs font-bold text-[#001018] disabled:opacity-40"><Download className="h-4 w-4" />Download CSV</button> : null}
            </div>
            {outputTemplateId === "tcgplayer" ? <>
              <input ref={tcgplayerReferenceRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleTcgplayerReference(file); }} />
              <p className="rounded-xl border border-cyan-300/10 bg-cyan-300/[.025] px-3 py-2 text-[10px] leading-5 text-cyan-100/70">Trading Docks resolves exact condition and foil-specific TCGplayer IDs from the imported catalog. The reference export below is only a fallback comparison file.</p>
              <div className="grid gap-3 rounded-2xl border border-white/[.07] bg-[#050e15] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div><strong className="text-xs text-white">TCGplayer ID reference export</strong><p className="mt-1 text-[10px] leading-4 text-slate-500">{tcgplayerReferenceRows.length ? `${tcgplayerReferenceName} · ${tcgplayerReferenceRows.length.toLocaleString()} verified SKU rows loaded` : "Upload a TCGplayer Pricing Custom Export containing every card and variant in this conversion."}</p></div>
                <button type="button" onClick={() => tcgplayerReferenceRef.current?.click()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[.06] px-4 text-[10px] font-bold text-cyan-100"><Upload className="h-4 w-4" />{tcgplayerReferenceRows.length ? "Replace reference" : "Upload reference export"}</button>
              </div>
              <div className={`rounded-xl border p-3 text-[10px] leading-5 ${missingTcgplayerSkuCount ? "border-amber-300/10 bg-amber-300/[.025] text-amber-100/60" : "border-emerald-300/10 bg-emerald-300/[.025] text-emerald-100/60"}`}>{missingTcgplayerSkuCount ? <><strong className="text-amber-200">{(validRows.length - missingTcgplayerSkuCount).toLocaleString()} of {validRows.length.toLocaleString()} rows have verified TCGplayer IDs.</strong> The final download stays locked until the Trading Docks catalog or optional reference export contains one exact SKU match for every card, printing, condition, and finish.{validRows.length ? <span className="mt-1 block">Unresolved: {validRows.filter((row) => !row.tcgplayerId.trim()).slice(0, 5).map((row) => `${row.name} (${row.setName || row.set} ${row.collectorNumber}, ${tcgplayerCondition(row.condition, row.finish)})`).join("; ")}</span> : null}</> : <><strong className="text-emerald-200">All {validRows.length.toLocaleString()} TCGplayer IDs are verified.</strong> The final file uses the exact 16-column TCGplayer inventory header.</>}</div>
              {missingTcgplayerSkuCount ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void resolveExactTcgplayerIds()} disabled={!validRows.length || working} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[.06] px-4 text-[10px] font-semibold text-cyan-100 disabled:opacity-40"><WandSparkles className="h-4 w-4" />Resolve IDs from catalog</button><button type="button" onClick={downloadManaBoxBridge} disabled={!validRows.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[.08] px-4 text-[10px] font-semibold text-slate-300 disabled:opacity-40"><Download className="h-4 w-4" />Download ManaBox bridge instead</button></div> : null}
              <button type="button" onClick={() => setShowBridgeHelp((value) => !value)} className="inline-flex items-center gap-2 text-[10px] font-semibold text-amber-200/75"><CircleHelp className="h-3.5 w-3.5" />How ID verification works<ChevronDown className={`h-3.5 w-3.5 transition ${showBridgeHelp ? "rotate-180" : ""}`} /></button>{showBridgeHelp ? <div className="rounded-xl border border-white/[.07] bg-black/10 p-3 text-[10px] leading-5 text-slate-500">Trading Docks resolves the exact TCGplayer inventory SKU from the uploaded canonical catalog by matching product name, set name, collector number, condition, and foil or nonfoil. TCGCSV can still fill product details and prices, but it does not replace the condition-specific TCGplayer ID and Trading Docks will not guess between duplicate variants.</div> : null}
            </> : null}
          </div> : <div className="mt-4 grid gap-3 rounded-2xl border border-white/[.07] bg-black/10 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label><span className="text-[9px] font-semibold text-slate-500">Storage location</span><div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-white/[.08] bg-[#050e15] px-3"><MapPin className="h-4 w-4 text-cyan-300" /><input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Bulk Box 001" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none" /></div></label>
            <label><span className="text-[9px] font-semibold text-slate-500">Listing allocation</span><div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-white/[.08] bg-[#050e15] px-3"><Store className="h-4 w-4 text-cyan-300" /><select value={marketplace} onChange={(event) => setMarketplace(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-slate-300 outline-none"><option>Unlisted</option><option>TCGplayer</option><option>eBay</option><option>Mana Pool</option><option>Trading Docks</option><option>In-Store</option></select></div></label>
            <button type="button" onClick={() => void saveToInventory()} disabled={!validRows.length || working} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-xs font-bold text-[#001018] disabled:opacity-40">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}Save cards</button>
          </div>}
        </>}
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
function matchTcgplayerReference(
  row: CanonicalRow,
  referenceRows: CsvRow[],
): Partial<CanonicalRow> {
  if (!referenceRows.length || !row.name.trim()) return {};
  const desiredCondition = tcgplayerCondition(row.condition, row.finish);
  const candidates = referenceRows.filter((reference) => {
    const nameMatches = normalizedLookup(reference["Product Name"]) === normalizedLookup(row.name);
    const numberMatches =
      normalizedLookup(reference.Number) === normalizedLookup(row.collectorNumber);
    const setMatches =
      !row.setName.trim() ||
      normalizedLookup(reference["Set Name"]) === normalizedLookup(row.setName);
    const conditionMatches =
      normalizedLookup(reference.Condition) === normalizedLookup(desiredCondition);
    return nameMatches && numberMatches && setMatches && conditionMatches;
  });
  if (candidates.length !== 1) return {};
  const reference = candidates[0];
  return {
    tcgplayerId: reference["TCGplayer Id"]?.trim() ?? "",
    productLine: reference["Product Line"] || row.productLine || "Magic",
    setName: reference["Set Name"] || row.setName,
    name: reference["Product Name"] || row.name,
    title: reference.Title || row.title,
    collectorNumber: reference.Number || row.collectorNumber,
    rarity: reference.Rarity || row.rarity,
    condition: reference.Condition || desiredCondition,
    marketPrice: reference["TCG Market Price"] || row.marketPrice,
    directLowPrice: reference["TCG Direct Low"] || row.directLowPrice,
    lowPrice:
      reference["TCG Low Price With Shipping"] ||
      reference["TCG Low Price"] ||
      row.lowPrice,
    addQuantity: row.addQuantity || row.quantity || "1",
    imageUrl: reference["Photo URL"] || row.imageUrl,
  };
}
function tcgplayerCondition(condition: string, finish: string) {
  const base = normalizeCondition(condition.replace(/\s+foil$/i, ""), "Near Mint");
  return normalizeFinishValue(finish, "Nonfoil") === "Nonfoil" ? base : `${base} Foil`;
}
function normalizedLookup(value = "") {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
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
