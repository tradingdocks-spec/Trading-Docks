"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Boxes,
  CheckCircle2,
  DatabaseZap,
  Download,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Store,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";

import {
  applyDefaults,
  blockingIssues,
  CSV_FORMATS,
  detectCsvFormat,
  exportCsv,
  normalizeRows,
  parseCsv,
  type CardRow,
  type CsvFormatId,
} from "@/lib/csv-converter";
import { accountStorageKey } from "@/lib/account-storage";

const outputFormats = CSV_FORMATS.filter((format) => format.id !== "generic");
const conditions = ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"];
const LOCATION_STORAGE_KEY = "trading-docks-inventory-locations-v1";
const ITEM_STORAGE_KEY = "trading-docks-inventory-items-v1";
const MOVEMENT_STORAGE_KEY = "trading-docks-inventory-movements-v1";

type InventoryLocation = {
  id: string;
  name: string;
  type: "chaos" | "binder" | "sealed-local" | "sealed-warehouse" | "custom";
  description: string;
  itemCount: number;
  estimatedValue: number;
  capacity?: number;
  capacityUnit?: "cards" | "products" | "slots" | "boxes";
};

type ListingChannel = "Unlisted" | "TCGplayer" | "eBay" | "Mana Pool" | "Trading Docks" | "In-Store";

type StorageKeys = {
  locations: string;
  items: string;
  movements: string;
};

type ScryfallResult = {
  id?: string;
  name?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  rarity?: string;
  tcgplayer_id?: number;
  image_uris?: { normal?: string; small?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; small?: string } }>;
  prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null };
};

export function MarketplaceWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [inputFormat, setInputFormat] = useState<CsvFormatId>("auto");
  const [detectedFormat, setDetectedFormat] = useState("Waiting for a file");
  const [outputFormat, setOutputFormat] = useState<Exclude<CsvFormatId, "auto" | "generic">>("tcgplayer");
  const [rows, setRows] = useState<CardRow[]>([]);
  const [defaultCondition, setDefaultCondition] = useState("Near Mint");
  const [defaultFinish, setDefaultFinish] = useState<CardRow["finish"]>("normal");
  const [defaultLanguage, setDefaultLanguage] = useState("English");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(0);
  const [storageKeys, setStorageKeys] = useState<StorageKeys | null>(null);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [destinationId, setDestinationId] = useState("");
  const [listingChannel, setListingChannel] = useState<ListingChannel>("Unlisted");
  const [savingInventory, setSavingInventory] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      accountStorageKey(LOCATION_STORAGE_KEY),
      accountStorageKey(ITEM_STORAGE_KEY),
      accountStorageKey(MOVEMENT_STORAGE_KEY),
    ]).then(([locationsKey, itemsKey, movementsKey]) => {
      if (!active) return;
      const storedLocations = readStoredArray<InventoryLocation>(locationsKey);
      setLocations(storedLocations);
      setDestinationId(storedLocations[0]?.id ?? "new-bulk-box");
      setStorageKeys({
        locations: locationsKey,
        items: itemsKey,
        movements: movementsKey,
      });
    }).catch(() => {
      if (active) setError("Inventory storage could not be opened for this account.");
    });
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => ({
    rows: rows.length,
    cards: rows.reduce((sum, row) => sum + row.quantity, 0),
    issues: blockingIssues(rows, outputFormat),
    ready: rows.filter((row) => row.name && row.quantity > 0 && (outputFormat !== "tcgplayer" || row.tcgplayerId)).length,
  }), [rows, outputFormat]);

  async function loadFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a CSV file to continue.");
      return;
    }
    setError("");
    setVerified(0);
    try {
      const parsed = parseCsv(await file.text());
      if (!parsed.headers.length || !parsed.rows.length) throw new Error("This CSV does not contain any inventory rows.");
      const detected = detectCsvFormat(parsed.headers);
      const selected = inputFormat === "auto" ? detected.id : inputFormat;
      setFilename(file.name);
      setDetectedFormat(detected.name);
      setRows(normalizeRows(parsed, selected));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The CSV could not be read.");
    }
  }

  function useDefaults() {
    setRows((current) => applyDefaults(current, defaultCondition, defaultFinish, defaultLanguage));
  }

  async function verifyCards() {
    if (!rows.length) return;
    setVerifying(true);
    setError("");
    try {
      const response = await fetch("/api/csv-converter/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rows.map((row) => ({
            scryfallId: row.scryfallId,
            name: row.name,
            setCode: row.setCode,
            collectorNumber: row.collectorNumber,
          })),
        }),
      });
      const payload = (await response.json()) as { cards?: Array<ScryfallResult | null>; error?: string };
      if (!response.ok) throw new Error(payload.error || "Card verification failed.");
      let matchCount = 0;
      setRows((current) => current.map((row, index) => {
        const card = payload.cards?.[index];
        if (!card) return { ...row, warnings: [...new Set([...row.warnings, "Printing could not be verified"])] };
        matchCount += 1;
        const price =
          row.finish === "foil" ? card.prices?.usd_foil :
          row.finish === "etched" ? card.prices?.usd_etched :
          card.prices?.usd;
        return {
          ...row,
          name: card.name ?? row.name,
          setCode: card.set ?? row.setCode,
          setName: card.set_name ?? row.setName,
          collectorNumber: card.collector_number ?? row.collectorNumber,
          scryfallId: card.id ?? row.scryfallId,
          tcgplayerId: card.tcgplayer_id ? String(card.tcgplayer_id) : row.tcgplayerId,
          rarity: card.rarity?.slice(0, 1).toUpperCase() ?? row.rarity,
          price: row.price || price || "",
          photoUrl: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || row.photoUrl,
          warnings: row.warnings.filter((warning) => warning !== "Missing printing identifier" && warning !== "Printing could not be verified"),
        };
      }));
      setVerified(matchCount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Card verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  function downloadOutput() {
    if (!rows.length) return;
    const csv = exportCsv(rows, outputFormat);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename.replace(/\.csv$/i, "") || "trading-docks"}-${outputFormat}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setFilename("");
    setRows([]);
    setVerified(0);
    setDetectedFormat("Waiting for a file");
    setError("");
    setSaveMessage("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function saveToInventory() {
    if (!storageKeys || !rows.length || totals.issues > 0) return;
    setSavingInventory(true);
    setSaveMessage("");

    try {
      const currentLocations = readStoredArray<InventoryLocation>(storageKeys.locations);
      let destination = currentLocations.find((location) => location.id === destinationId);

      if (!destination || destinationId === "new-bulk-box") {
        destination = {
          id: crypto.randomUUID(),
          name: uniqueBulkBoxName(currentLocations),
          type: "custom",
          description: "Bulk inventory created from the CSV Conversion Engine.",
          itemCount: 0,
          estimatedValue: 0,
          capacityUnit: "cards",
        };
        currentLocations.push(destination);
      }

      const now = new Date().toISOString();
      const inventoryItems = readStoredArray<Record<string, unknown>>(storageKeys.items);
      const movements = readStoredArray<Record<string, unknown>>(storageKeys.movements);
      let unitsAdded = 0;
      let valueAdded = 0;

      for (const row of rows) {
        const unitValue = Number.parseFloat(row.price) || 0;
        const quantity = Math.max(0, row.quantity);
        unitsAdded += quantity;
        valueAdded += unitValue * quantity;
        inventoryItems.push({
          id: crypto.randomUUID(),
          name: row.name,
          sku: row.tcgplayerId || row.scryfallId || `${row.setCode}-${row.collectorNumber}`,
          category: "Single",
          quantity,
          locationId: destination.id,
          condition: row.condition,
          set: row.setName || row.setCode,
          collectorNumber: row.collectorNumber,
          language: row.language,
          finish: row.finish || "normal",
          scryfallId: row.scryfallId,
          imageUrl: row.photoUrl,
          costBasis: Number.parseFloat(row.purchasePrice) || undefined,
          unitMarketValue: unitValue || undefined,
          value: unitValue * quantity,
          updatedAt: now,
          marketplaceListings: listingChannel === "Unlisted"
            ? []
            : [{
                platform: listingChannel,
                status: "Active",
                quantity,
                price: unitValue || undefined,
                updatedAt: now,
              }],
        });
      }

      destination.itemCount = (destination.itemCount || 0) + unitsAdded;
      destination.estimatedValue = (destination.estimatedValue || 0) + valueAdded;
      movements.unshift({
        id: crypto.randomUUID(),
        itemName: `${filename || "CSV conversion"} (${rows.length} rows)`,
        to: destination.name,
        quantity: unitsAdded,
        action: "filed",
        timestamp: "Just now",
      });

      window.localStorage.setItem(storageKeys.locations, JSON.stringify(currentLocations));
      window.localStorage.setItem(storageKeys.items, JSON.stringify(inventoryItems));
      window.localStorage.setItem(storageKeys.movements, JSON.stringify(movements));
      setLocations(currentLocations);
      setDestinationId(destination.id);
      setSaveMessage(
        `${unitsAdded.toLocaleString()} cards saved to ${destination.name}${
          listingChannel === "Unlisted" ? "" : ` and marked active on ${listingChannel}`
        }.`,
      );
    } catch {
      setError("The converted list could not be saved to inventory.");
    } finally {
      setSavingInventory(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1640px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[30px] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_36%),#06131d] p-6 shadow-[0_30px_90px_rgba(0,0,0,.3)] sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/[.07] px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-cyan-200">
                Seller + Store
              </span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/[.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
                Browser-private processing
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Universal CSV Conversion Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Upload nearly any card inventory CSV, standardize every printing, verify it against Scryfall,
              and download a marketplace-ready file without rebuilding columns by hand.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
            <HeroStat value="14" label="Input presets" />
            <HeroStat value="13" label="Export presets" />
            <HeroStat value="16" label="TCGplayer fields" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
        <div className="space-y-5">
          <Panel title="1. Choose your source" icon={Upload} detail="Auto-detect a known platform or choose a preset manually.">
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <Field label="Input format">
                <select value={inputFormat} onChange={(event) => setInputFormat(event.target.value as CsvFormatId)} className={inputClass}>
                  <option value="auto">Auto detect</option>
                  {CSV_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.name}</option>)}
                </select>
              </Field>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void loadFile(event.dataTransfer.files[0]);
                }}
                className={`group flex min-h-32 items-center justify-center rounded-2xl border border-dashed px-5 text-left transition ${
                  dragging ? "border-cyan-300 bg-cyan-400/[.09]" : "border-white/15 bg-white/[.025] hover:border-cyan-300/35 hover:bg-cyan-400/[.04]"
                }`}
              >
                <span className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/[.07]">
                    <FileSpreadsheet className="h-6 w-6 text-cyan-300" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{filename || "Drop a CSV here or choose a file"}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {filename ? `Detected as ${detectedFormat}` : "TCGplayer, ManaBox, Cardsphere, Deckbox, Dragon Shield, Moxfield, MTGO, and more"}
                    </span>
                  </span>
                </span>
              </button>
              <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void loadFile(event.target.files?.[0])} />
            </div>
            {error && <Alert message={error} />}
          </Panel>

          <Panel title="2. Normalize and verify" icon={DatabaseZap} detail="Fill only missing values, then verify exact printings and IDs.">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Default condition">
                <select value={defaultCondition} onChange={(event) => setDefaultCondition(event.target.value)} className={inputClass}>
                  {conditions.map((condition) => <option key={condition}>{condition}</option>)}
                </select>
              </Field>
              <Field label="Default finish">
                <select value={defaultFinish} onChange={(event) => setDefaultFinish(event.target.value as CardRow["finish"])} className={inputClass}>
                  <option value="normal">Non-foil</option>
                  <option value="foil">Foil</option>
                  <option value="etched">Etched foil</option>
                </select>
              </Field>
              <Field label="Default language">
                <select value={defaultLanguage} onChange={(event) => setDefaultLanguage(event.target.value)} className={inputClass}>
                  <option>English</option>
                  <option>Japanese</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>German</option>
                  <option>Italian</option>
                  <option>Portuguese</option>
                  <option>Korean</option>
                  <option>Russian</option>
                  <option>Chinese Simplified</option>
                  <option>Chinese Traditional</option>
                </select>
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <ActionButton icon={WandSparkles} label="Apply missing defaults" onClick={useDefaults} disabled={!rows.length} />
              <ActionButton icon={verifying ? LoaderCircle : ShieldCheck} label={verifying ? "Verifying…" : "Verify with Scryfall"} onClick={() => void verifyCards()} disabled={!rows.length || verifying} spin={verifying} />
              {rows.length > 0 && <button type="button" onClick={reset} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-slate-400 hover:text-white"><X className="h-4 w-4" />Clear file</button>}
            </div>
          </Panel>

          <Panel title="3. Review inventory" icon={FileSearch} detail="Nothing uncertain is silently guessed. Review warnings before export.">
            {rows.length ? (
              <div className="overflow-hidden rounded-2xl border border-white/[.08]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-white/[.035] text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Card</th>
                        <th className="px-4 py-3">Printing</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Condition</th>
                        <th className="px-4 py-3">Finish</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[.06]">
                      {rows.slice(0, 100).map((row, index) => (
                        <tr key={`${row.sourceRow}-${row.name}-${index}`} className="text-slate-300">
                          <td className="px-4 py-3"><span className="font-semibold text-white">{row.name || "Missing name"}</span><span className="block text-[10px] text-slate-600">Row {row.sourceRow}</span></td>
                          <td className="px-4 py-3">{row.setCode?.toUpperCase() || "—"} · {row.collectorNumber || "—"}<span className="block text-[10px] text-slate-600">{row.scryfallId ? "Scryfall ID present" : "No Scryfall ID"}</span></td>
                          <td className="px-4 py-3">{row.quantity}</td>
                          <td className="px-4 py-3">{row.condition || "Review"}</td>
                          <td className="px-4 py-3 capitalize">{row.finish || "Review"}</td>
                          <td className="px-4 py-3">
                            {row.warnings.length ? (
                              <span className="inline-flex items-center gap-1.5 text-amber-300"><AlertTriangle className="h-3.5 w-3.5" />{row.warnings.length} warning{row.warnings.length === 1 ? "" : "s"}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Ready</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 100 && <p className="border-t border-white/[.06] px-4 py-3 text-center text-xs text-slate-500">Showing the first 100 of {rows.length.toLocaleString()} rows.</p>}
              </div>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[.015] text-center">
                <FileCheck2 className="h-9 w-9 text-slate-700" />
                <p className="mt-3 text-sm font-semibold text-slate-400">Your converted rows will appear here</p>
                <p className="mt-1 text-xs text-slate-600">Upload a CSV to begin with a clean workspace.</p>
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <Panel title="Conversion summary" icon={RefreshCw}>
            <div className="grid grid-cols-2 gap-3">
              <SummaryStat label="CSV rows" value={totals.rows} />
              <SummaryStat label="Total cards" value={totals.cards} />
              <SummaryStat label="Verified" value={verified} accent="cyan" />
              <SummaryStat label="Needs attention" value={totals.issues} accent={totals.issues ? "amber" : "green"} />
            </div>
          </Panel>

          <Panel title="Export destination" icon={Download} detail="The downloaded file uses the destination’s exact column layout.">
            <Field label="Output format">
              <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as typeof outputFormat)} className={inputClass}>
                {outputFormats.map((format) => <option key={format.id} value={format.id}>{format.name}</option>)}
              </select>
            </Field>
            <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[.04] p-4">
              <div className="flex items-start gap-3">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <div>
                  <p className="text-xs font-semibold text-cyan-100">
                    {outputFormats.find((format) => format.id === outputFormat)?.name}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    {outputFormats.find((format) => format.id === outputFormat)?.description}
                  </p>
                </div>
              </div>
            </div>
            {outputFormat === "tcgplayer" && (
              <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-400/[.04] p-3 text-[11px] leading-5 text-amber-100/70">
                TCGplayer exports require a verified TCGplayer ID. For condition corrections, export to ManaBox first, update conditions there, then bring that file back and export to TCGplayer.
              </div>
            )}
            <button
              type="button"
              onClick={downloadOutput}
              disabled={!rows.length || totals.issues > 0}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-sm font-bold text-[#031019] shadow-[0_14px_35px_rgba(34,211,238,.18)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none"
            >
              <Download className="h-4 w-4" />
              {totals.issues ? `Resolve ${totals.issues} issue${totals.issues === 1 ? "" : "s"} to export` : `Download ${outputFormats.find((format) => format.id === outputFormat)?.name} CSV`}
            </button>
          </Panel>

          <Panel title="Store converted cards" icon={Archive} detail="File the normalized list into inventory and optionally record where it is listed.">
            <Field label="Storage destination">
              <select
                value={destinationId}
                onChange={(event) => setDestinationId(event.target.value)}
                className={inputClass}
              >
                <option value="new-bulk-box">Create a new Bulk Box</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="mt-4">
              <Field label="Selling status">
                <select
                  value={listingChannel}
                  onChange={(event) => setListingChannel(event.target.value as ListingChannel)}
                  className={inputClass}
                >
                  <option value="Unlisted">Store only — not listed</option>
                  <option value="TCGplayer">Listed on TCGplayer</option>
                  <option value="eBay">Listed on eBay</option>
                  <option value="Mana Pool">Listed on Mana Pool</option>
                  <option value="Trading Docks">Listed on Trading Docks</option>
                  <option value="In-Store">Listed for in-store sale</option>
                </select>
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3">
                <Boxes className="h-4 w-4 text-cyan-300" />
                <p className="mt-2 text-[10px] text-slate-500">Inventory destination</p>
              </div>
              <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3">
                <Store className="h-4 w-4 text-emerald-300" />
                <p className="mt-2 text-[10px] text-slate-500">Listing allocation</p>
              </div>
            </div>

            <button
              type="button"
              onClick={saveToInventory}
              disabled={!storageKeys || !rows.length || totals.issues > 0 || savingInventory}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/[.08] text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/[.13] disabled:cursor-not-allowed disabled:border-white/[.06] disabled:bg-slate-900 disabled:text-slate-600"
            >
              {savingInventory ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Save list to inventory
            </button>

            {saveMessage && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[.05] p-3 text-[11px] leading-5 text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {saveMessage}
              </div>
            )}
          </Panel>

          <Panel title="Supported formats" icon={FileSpreadsheet}>
            <div className="flex flex-wrap gap-2">
              {CSV_FORMATS.filter((format) => format.id !== "generic").map((format) => (
                <span key={format.id} className="rounded-lg border border-white/[.08] bg-white/[.025] px-2.5 py-1.5 text-[10px] font-medium text-slate-400">{format.name}</span>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-slate-600">
              Unknown files can still use Generic CSV detection. Custom manual column mapping is the next testing milestone.
            </p>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

const inputClass = "h-11 w-full rounded-xl border border-white/10 bg-[#071722] px-3 text-xs text-slate-200 outline-none transition focus:border-cyan-300/40";

function Panel({ title, detail, icon: Icon, children }: { title: string; detail?: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-white/[.08] bg-[#07141e]/92 p-5 shadow-[0_20px_60px_rgba(0,0,0,.18)] sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/[.055]"><Icon className="h-4.5 w-4.5 text-cyan-300" /></span>
        <div><h2 className="text-base font-semibold text-white">{title}</h2>{detail && <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>}</div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">{label}</span>{children}</label>;
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-2xl border border-white/[.08] bg-black/15 px-3 py-3 text-center"><p className="text-lg font-bold text-white">{value}</p><p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-500">{label}</p></div>;
}

function SummaryStat({ label, value, accent = "default" }: { label: string; value: number; accent?: "default" | "cyan" | "amber" | "green" }) {
  const color = accent === "cyan" ? "text-cyan-300" : accent === "amber" ? "text-amber-300" : accent === "green" ? "text-emerald-300" : "text-white";
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{label}</p></div>;
}

function ActionButton({ icon: Icon, label, onClick, disabled, spin }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; disabled?: boolean; spin?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex h-11 items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-400/[.055] px-4 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/[.1] disabled:cursor-not-allowed disabled:opacity-40"><Icon className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} />{label}</button>;
}

function Alert({ message }: { message: string }) {
  return <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300/15 bg-rose-400/[.05] p-3 text-xs leading-5 text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>;
}

function readStoredArray<T>(key: string): T[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function uniqueBulkBoxName(locations: InventoryLocation[]) {
  const names = new Set(locations.map((location) => location.name.toLowerCase()));
  let index = 1;
  while (names.has(`csv bulk box ${index}`)) index += 1;
  return `CSV Bulk Box ${index}`;
}
