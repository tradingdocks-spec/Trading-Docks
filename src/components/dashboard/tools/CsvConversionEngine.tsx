"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
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
  ContextHelp,
  EmptyState,
  FeatureIntro,
  WorkflowSteps,
} from "@/components/dashboard/help/HelpPrimitives";

import { requestInventoryCommit } from "@/lib/inventory-commit-client";
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
type TcgplayerCandidate = {
  tcgplayerId: string;
  productLine?: string;
  setName: string;
  productName: string;
  title?: string;
  collectorNumber: string;
  rarity?: string;
  condition?: string;
  finish?: string;
  marketPrice?: string;
  directLowPrice?: string;
  lowPrice?: string;
  marketplacePrice?: string;
  photoUrl?: string;
};
type EnrichedRow = Partial<CanonicalRow> & {
  tcgplayerResolveReason?: string;
  tcgplayerResolveReasonCode?: string;
  tcgplayerTranslatedSetName?: string;
  tcgplayerSourceSetCode?: string;
  tcgplayerSourceCollectorNumber?: string;
  tcgplayerPrinting?: { name: string; setName: string; collectorNumber: string };
  tcgplayerCandidates?: TcgplayerCandidate[];
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
const TCGPLAYER_REASON_LABELS: Record<string, string> = {
  AMBIGUOUS_PRINTING: "Multiple printings matched",
  COLLECTOR_NUMBER_MISMATCH: "Collector number did not match",
  CONDITION_NOT_FOUND: "Condition was not found",
  FINISH_NOT_AVAILABLE: "Finish is unavailable",
  FINISH_NOT_FOUND: "Finish was not found",
  PRINTING_NOT_FOUND: "Printing was not found",
  SET_NOT_FOUND: "Set could not be identified",
  SET_MAPPED_NO_PRODUCT: "The set was found, but the exact card was not.",
  PLST_COMPOUND_COLLECTOR_UNRESOLVED: "The collector number needs a manual check.",
  SKU_NOT_FOUND: "Exact TCGplayer SKU was not found",
  UNKNOWN_SET_CODE: "Set could not be identified",
};

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
  const [enrichedRows, setEnrichedRows] = useState<Record<number, EnrichedRow>>({});
  const [destination, setDestination] = useState<"download" | "inventory">("download");
  const [locationName, setLocationName] = useState("Bulk Box 001");
  const [marketplace, setMarketplace] = useState("Unlisted");
  const [defaultCondition, setDefaultCondition] = useState("Near Mint");
  const [defaultFinish, setDefaultFinish] = useState("Nonfoil");
  const [notice, setNotice] = useState("");
  const [completion, setCompletion] = useState<{ units: number; locationName: string; duplicate: boolean } | null>(null);
  const [working, setWorking] = useState(false);
  const [commitFailed, setCommitFailed] = useState(false);
  const importPending = useRef(false);
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
  const matchedTcgplayerSkuCount = Math.max(0, validRows.length - missingTcgplayerSkuCount);
  const tcgplayerMode = destination === "download" && outputTemplateId === "tcgplayer";
  const hasAttemptedTcgplayerMatch =
    tcgplayerMode &&
    validRows.some(
      (row) =>
        row.tcgplayerId.trim() ||
        row.tcgplayerResolveReasonCode ||
        row.tcgplayerResolveReason,
    );
  const allTcgplayerMatched = tcgplayerMode && validRows.length > 0 && missingTcgplayerSkuCount === 0;
  const unresolvedTcgplayerRows = validRows.filter((row) => !row.tcgplayerId.trim());

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
    setCompletion(null);
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
        "A direct TCGplayer export requires exact condition and foil-specific TCGplayer IDs. Use Match to TCGplayer before downloading.",
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
      const next: Record<number, EnrichedRow> = {};
      let matched = 0;
      payload.results.forEach((result, index) => {
        if (!result.matched) return;
        matched += 1;
        next[index] = {
          tcgplayerProductId: result.tcgplayerProductId ?? "",
          tcgplayerPrinting: {
            name: result.productName ?? converted[index]?.name ?? "",
            setName: result.setName ?? converted[index]?.setName ?? "",
            collectorNumber: result.collectorNumber ?? converted[index]?.collectorNumber ?? "",
          },
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
    if (!validRows.length) return setNotice("Load and map rows before matching to TCGplayer.");
    setWorking(true);
    setNotice("Matching your cards to exact TCGplayer printings...");
    try {
      const next: Record<number, EnrichedRow> = { ...enrichedRows };
      let matched = 0;
      let ambiguous = 0;
      let unresolved = 0;
      const unresolvedReasons = new Map<string, number>();

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
              tcgplayerId: row.tcgplayerId,
              tcgplayerProductId: row.tcgplayerProductId,
              scryfallId: row.scryfallId,
            })),
          }),
        });
        const payload = await response.json() as {
          error?: string;
          results?: Array<{
            status: "matched" | "ambiguous" | "unresolved";
            reason?: string;
            reasonCode?: string;
            diagnostics?: {
              sourceSet?: string | null;
              translatedSetName?: string | null;
              sourceSetCode?: string;
              sourceCollectorNumber?: string;
            };
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
            candidates?: TcgplayerCandidate[];
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
              tcgplayerPrinting: {
                setName: result.setName ?? converted[rowIndex]?.setName ?? "",
                name: result.productName ?? converted[rowIndex]?.name ?? "",
                collectorNumber: result.collectorNumber ?? converted[rowIndex]?.collectorNumber ?? "",
              },
              title: result.title ?? converted[rowIndex]?.title ?? "",
              rarity: result.rarity ?? converted[rowIndex]?.rarity ?? "",
              condition: finish === "Foil" && result.condition ? `${result.condition} Foil` : result.condition ?? converted[rowIndex]?.condition ?? "",
              finish,
              marketPrice: result.marketplacePrice || result.marketPrice || converted[rowIndex]?.marketPrice || "",
              directLowPrice: result.directLowPrice || converted[rowIndex]?.directLowPrice || "",
              lowPrice: result.lowPrice || converted[rowIndex]?.lowPrice || "",
              imageUrl: result.photoUrl || converted[rowIndex]?.imageUrl || "",
              tcgplayerResolveReason: "",
              tcgplayerResolveReasonCode: "",
              tcgplayerCandidates: [],
              tcgplayerTranslatedSetName: result.diagnostics?.translatedSetName ?? "",
              tcgplayerSourceSetCode: result.diagnostics?.sourceSetCode,
              tcgplayerSourceCollectorNumber: result.diagnostics?.sourceCollectorNumber,
            };
          } else if (result.status === "ambiguous") {
            ambiguous += 1;
            const reasonCode = result.reasonCode ?? "AMBIGUOUS_PRINTING";
            unresolvedReasons.set(reasonCode, (unresolvedReasons.get(reasonCode) ?? 0) + 1);
            next[rowIndex] = {
              ...(next[rowIndex] ?? {}),
              tcgplayerId: "",
              tcgplayerPrinting: undefined,
              tcgplayerResolveReason: result.reason ?? "Multiple TCGplayer variants matched.",
              tcgplayerResolveReasonCode: reasonCode,
              tcgplayerCandidates: result.candidates ?? [],
              tcgplayerTranslatedSetName: result.diagnostics?.translatedSetName ?? "",
              tcgplayerSourceSetCode: result.diagnostics?.sourceSetCode,
              tcgplayerSourceCollectorNumber: result.diagnostics?.sourceCollectorNumber,
            };
          } else {
            unresolved += 1;
            const reasonCode = result.reasonCode ?? "PRINTING_NOT_FOUND";
            unresolvedReasons.set(reasonCode, (unresolvedReasons.get(reasonCode) ?? 0) + 1);
            next[rowIndex] = {
              ...(next[rowIndex] ?? {}),
              tcgplayerId: "",
              tcgplayerPrinting: undefined,
              tcgplayerResolveReason: result.reason ?? "No exact TCGplayer SKU matched.",
              tcgplayerResolveReasonCode: reasonCode,
              tcgplayerCandidates: [],
              tcgplayerTranslatedSetName: result.diagnostics?.translatedSetName ?? "",
              tcgplayerSourceSetCode: result.diagnostics?.sourceSetCode,
              tcgplayerSourceCollectorNumber: result.diagnostics?.sourceCollectorNumber,
            };
          }
        });
      }

      setEnrichedRows(next);
      setOutputTemplateId("tcgplayer");
      setNotice(
        `${matched.toLocaleString()} cards matched to TCGplayer. ${ambiguous.toLocaleString()} ambiguous and ${unresolved.toLocaleString()} unresolved. ${formatReasonSummary(unresolvedReasons)}`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Cards could not be matched to TCGplayer.");
    } finally {
      setWorking(false);
    }
  }

  function chooseTcgplayerCandidate(rowIndex: number, candidate: TcgplayerCandidate) {
    setEnrichedRows((current) => ({
      ...current,
      [rowIndex]: {
        ...(current[rowIndex] ?? {}),
        tcgplayerId: candidate.tcgplayerId,
        productLine: candidate.productLine ?? "Magic",
        name: candidate.productName || converted[rowIndex]?.name,
        setName: candidate.setName || converted[rowIndex]?.setName,
        title: candidate.title ?? converted[rowIndex]?.title ?? "",
        collectorNumber: candidate.collectorNumber || converted[rowIndex]?.collectorNumber,
        rarity: candidate.rarity ?? converted[rowIndex]?.rarity ?? "",
        condition: candidate.condition ?? converted[rowIndex]?.condition ?? "",
        finish: candidate.finish === "Foil" ? "Foil" : "Nonfoil",
        marketPrice: candidate.marketplacePrice || candidate.marketPrice || converted[rowIndex]?.marketPrice || "",
        directLowPrice: candidate.directLowPrice ?? converted[rowIndex]?.directLowPrice ?? "",
        lowPrice: candidate.lowPrice ?? converted[rowIndex]?.lowPrice ?? "",
        imageUrl: candidate.photoUrl ?? converted[rowIndex]?.imageUrl ?? "",
        tcgplayerPrinting: {
          name: candidate.productName,
          setName: candidate.setName,
          collectorNumber: candidate.collectorNumber,
        },
        tcgplayerResolveReason: "",
        tcgplayerResolveReasonCode: "",
        tcgplayerCandidates: [],
      },
    }));
    setNotice(`${candidate.productName} · ${candidate.setName} #${candidate.collectorNumber} selected.`);
  }

  async function saveToInventory() {
    if (importPending.current) return;
    if (!validRows.length) return setNotice("Map a card or product name before saving.");
    if (!locationName.trim()) return setNotice("Choose or enter a storage location.");
    importPending.current = true;
    setWorking(true); setCommitFailed(false); setNotice("");
    try {
      const result = await requestInventoryCommit<{ units: number; locationName: string; duplicate: boolean }>(
        "/api/collector-workspace/import", "POST", { rows: validRows.map((row) => ({ ...row, finish: normalizeFinish(row.finish) })), locationName, marketplace },
      );
      if (!Number.isFinite(result.units) || typeof result.locationName !== "string") throw new Error("The import could not be confirmed. Retry the same CSV and destination.");
      setNotice(result.duplicate
        ? `This import was already saved: ${result.units.toLocaleString()} units in ${result.locationName}. No duplicates were added.`
        : `${result.units.toLocaleString()} units saved to ${result.locationName}.`);
      setCompletion(result);
    } catch (error) {
      setCommitFailed(true);
      setNotice(error instanceof Error ? error.message : "The import could not be confirmed. Retry the same CSV and destination.");
    } finally {
      importPending.current = false;
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
    setCompletion(null);
    setShowPaste(false);
    setShowAdvanced(false);
    setShowAllRows(false);
  }

  const mappedImportantFields = IMPORTANT_FIELDS.filter((key) => mapping[key]).length;

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-[26px] border border-td-accent/15 bg-[radial-gradient(circle_at_top_right,rgb(var(--td-accent-rgb)/.1),transparent_35%),var(--td-surface-default)] px-6 py-5 shadow-[0_24px_70px_rgb(var(--td-shadow-rgb)/calc(.25*var(--td-shadow-strength)))]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-td-accent-text"><WandSparkles className="h-3.5 w-3.5" />Seller & Store Tools</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-td-primary">Import or convert inventory files</h1>
            <p className="mt-1 text-xs text-td-muted">Bring cards in from another system, review what Trading Docks found, then download a new file or add the cards to inventory.</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-td-success/65"><ShieldCheck className="h-4 w-4 text-td-success" />Nothing changes until you confirm</div>
        </div>
      </section>

      <FeatureIntro
        eyebrow="How it works"
        title="Your file stays unchanged until you choose an outcome."
        description="Trading Docks reads the columns, matches card details where it can, and shows you anything that needs attention before an inventory import."
      >
        <WorkflowSteps steps={["Upload file", "Review matches", "Choose destination", "Download or import"]} />
      </FeatureIntro>

      <section id="csv-upload" className="rounded-[24px] border border-td-ink/[.08] bg-td-surface p-5">
        <SectionTitle step="1" title="Upload your CSV" detail="CSV files from supported marketplaces or inventory apps work best. A generic card list can be mapped manually." />
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl border border-dashed border-td-accent/25 bg-td-accent/[.035] text-xs font-semibold text-td-accent-text transition hover:bg-td-accent/[.07]"><Upload className="h-4 w-4 text-td-accent-text" />{headers.length ? "Choose a different CSV" : "Choose CSV file"}</button>
          <button type="button" onClick={() => setShowPaste((value) => !value)} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-td-ink/[.08] px-5 text-xs font-semibold text-td-secondary hover:text-td-primary"><FileSpreadsheet className="h-4 w-4" />Paste CSV instead<ChevronDown className={`h-4 w-4 transition ${showPaste ? "rotate-180" : ""}`} /></button>
          {headers.length ? <button type="button" onClick={reset} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-td-ink/[.08] px-4 text-xs font-semibold text-td-muted hover:text-td-primary"><RefreshCw className="h-4 w-4" />Reset</button> : null}
        </div>
        {showPaste ? <div className="mt-3 space-y-3 rounded-2xl border border-td-ink/[.07] bg-black/10 p-3"><textarea value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder={"Name,Set,Collector Number,Condition,Quantity\nSol Ring,CMM,396,Near Mint,2"} className="min-h-36 w-full rounded-xl border border-td-ink/[.08] bg-td-canvas p-4 font-mono text-[11px] leading-5 text-td-secondary outline-none placeholder:text-td-muted focus:border-td-accent/25" /><button type="button" onClick={() => loadCsv(rawText)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-td-accent px-5 text-[11px] font-bold text-td-on-accent"><FileSpreadsheet className="h-4 w-4" />Read pasted CSV</button></div> : null}
        {headers.length ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-td-success/10 bg-td-success/[.025] px-4 py-3 text-[11px]"><Check className="h-4 w-4 text-td-success" /><strong className="text-td-primary">{fileName}</strong><span className="text-td-muted">•</span><span className="text-td-secondary">{rows.length.toLocaleString()} rows</span><span className="text-td-muted">•</span><span className={detectedTemplate === "Unknown / Generic" ? "text-td-warning" : "text-td-success"}>{detectedTemplate === "Unknown / Generic" ? "Format not recognized yet — map the columns below" : `Detected: ${detectedTemplate.replace(/ \(.*\)$/, "")}`}</span></div> : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ContextHelp label="What files can I upload?">Upload a CSV export from a marketplace or inventory app, or a simple file with card name and quantity. Trading Docks currently detects the formats listed in the destination selector; other files can use manual column mapping.</ContextHelp>
          <ContextHelp label="What does importing change?">Downloading a converted file changes nothing in Trading Docks. Choosing “Import into inventory” writes the reviewed rows to the storage location you provide, and combines duplicates according to the import result.</ContextHelp>
        </div>
      </section>

      <section className="rounded-[24px] border border-td-ink/[.08] bg-td-surface p-5">
        <SectionTitle step="2" title="Choose the result" detail="Download a file for another platform, or import these cards into Trading Docks inventory." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setDestination("download")} className={`rounded-2xl border p-4 text-left ${destination === "download" ? "border-td-accent/25 bg-td-accent/[.055]" : "border-td-ink/[.07] bg-black/10"}`}><Download className="h-5 w-5 text-td-accent-text" /><p className="mt-3 text-sm font-semibold text-td-primary">Download converted CSV</p><p className="mt-1 text-[11px] leading-4 text-td-muted">Create a clean file for another platform without changing inventory.</p></button>
          <button type="button" onClick={() => setDestination("inventory")} className={`rounded-2xl border p-4 text-left ${destination === "inventory" ? "border-td-accent/25 bg-td-accent/[.055]" : "border-td-ink/[.07] bg-black/10"}`}><Boxes className="h-5 w-5 text-td-accent-text" /><p className="mt-3 text-sm font-semibold text-td-primary">Import into inventory</p><p className="mt-1 text-[11px] leading-4 text-td-muted">Add reviewed cards to a named storage location. Nothing is written before you confirm.</p></button>
        </div>
      </section>

      <section className="rounded-[24px] border border-td-ink/[.08] bg-td-surface p-5">
        <SectionTitle step="3" title="Review and finish" detail={headers.length ? `${validRows.length.toLocaleString()} valid rows · ${quantityTotal.toLocaleString()} total cards` : "Upload a CSV to continue."} />
          {!headers.length ? <div className="mt-4"><EmptyState title="No file to review yet" description="Upload a CSV export or paste a few rows to see the detected format, field mapping, and cards that will be affected." action={{ label: "Choose a CSV file", href: "/dashboard/tools/csv-converter?start=upload" }} /></div> : <>
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-td-ink/[.07] bg-black/10 p-4 lg:flex-row lg:items-end">
            <label className="flex-1"><span className="text-[11px] font-semibold text-td-muted">Default condition if missing</span><select value={defaultCondition} onChange={(event) => setDefaultCondition(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-td-ink/[.08] bg-td-canvas px-3 text-xs text-td-secondary"><option>Near Mint</option><option>Lightly Played</option><option>Moderately Played</option><option>Heavily Played</option><option>Damaged</option></select></label>
            <label className="flex-1"><span className="text-[11px] font-semibold text-td-muted">Default finish if missing</span><select value={defaultFinish} onChange={(event) => setDefaultFinish(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-td-ink/[.08] bg-td-canvas px-3 text-xs text-td-secondary"><option>Nonfoil</option><option>Foil</option><option>Etched</option></select></label>
            <div className="flex flex-wrap gap-2 text-[11px] lg:pb-1"><Stat label="Valid" value={validRows.length} /><Stat label="Units" value={quantityTotal} /><Stat label="Skipped" value={converted.length - validRows.length} /></div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-td-ink/[.07]">
            <table className="w-full min-w-[700px] text-left text-[11px]">
              <thead className="bg-td-ink/[.025] text-td-muted"><tr>{["Card", "Set", "#", "Condition", "Finish", "Qty", ...(tcgplayerMode && hasAttemptedTcgplayerMatch ? ["TCGplayer Match"] : [])].map((value) => <th key={value} className="px-3 py-2.5 font-semibold">{value}</th>)}</tr></thead>
              <tbody>{converted.slice(0, showAllRows ? converted.length : 5).map((row, index) => <tr key={`${row.name}-${index}`} className="border-t border-td-ink/[.055] text-td-secondary"><td className="max-w-60 truncate px-3 py-2.5 font-medium text-td-primary">{row.name || <span className="text-td-warning">Missing name</span>}</td><td className="px-3 py-2.5">{row.set || row.setName}</td><td className="px-3 py-2.5">{row.collectorNumber}</td><td className="px-3 py-2.5">{row.condition}</td><td className="px-3 py-2.5">{row.finish}</td><td className="px-3 py-2.5">{row.quantity || "1"}</td>{tcgplayerMode && hasAttemptedTcgplayerMatch ? <td className="px-3 py-2.5">{row.tcgplayerId.trim() ? <span className="rounded-full bg-td-success/10 px-2 py-1 text-[11px] font-semibold text-td-success">Matched</span> : row.tcgplayerCandidates?.length ? <label className="block min-w-56"><span className="sr-only">Choose TCGplayer printing for {row.name}</span><select defaultValue="" onChange={(event) => { const candidate = row.tcgplayerCandidates?.find((item) => item.tcgplayerId === event.target.value); if (candidate) chooseTcgplayerCandidate(index, candidate); }} className="h-8 w-full rounded-lg border border-td-warning/20 bg-td-canvas px-2 text-[11px] text-td-secondary"><option value="">Choose printing…</option>{row.tcgplayerCandidates.map((candidate) => <option key={candidate.tcgplayerId} value={candidate.tcgplayerId}>{candidate.setName} · #{candidate.collectorNumber} · {candidate.condition}{candidate.finish === "Foil" ? " Foil" : ""}</option>)}</select></label> : <span className="rounded-full bg-td-warning/10 px-2 py-1 text-[11px] font-semibold text-td-warning">{tcgplayerReasonLabel(row)}</span>}</td> : null}</tr>)}</tbody>
            </table>
          </div>
          {converted.length > 5 ? <button type="button" onClick={() => setShowAllRows((value) => !value)} className="mt-3 inline-flex items-center gap-2 text-[11px] font-semibold text-td-accent-text"><Eye className="h-3.5 w-3.5" />{showAllRows ? "Show fewer cards" : `Review all ${converted.length.toLocaleString()} cards`}</button> : null}

          <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-td-ink/[.07] bg-black/10 px-4 py-3 text-left">
            <span className="flex items-center gap-3"><SlidersHorizontal className="h-4 w-4 text-td-accent-text" /><span><strong className="block text-xs text-td-primary">Advanced options</strong><span className="mt-0.5 block text-[11px] text-td-muted">{mappedImportantFields} of {IMPORTANT_FIELDS.length} important fields mapped · Field mapping, fallback exports, and diagnostics</span></span></span>
            <ChevronDown className={`h-4 w-4 text-td-muted transition ${showAdvanced ? "rotate-180" : ""}`} />
          </button>
          {showAdvanced ? <div className="mt-3 space-y-4 rounded-2xl border border-td-accent/10 bg-td-accent/[.02] p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{CANONICAL_FIELDS.map((field) => <label key={field.key}><span className="text-[11px] font-semibold text-td-secondary">{field.label}{field.required ? " *" : ""}</span><select value={mapping[field.key]} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-xl border border-td-ink/[.08] bg-td-canvas px-3 text-[11px] text-td-secondary outline-none"><option value="">Not mapped</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div>
            {tcgplayerMode ? <div className="space-y-3 border-t border-td-ink/[.06] pt-4">
              <input ref={tcgplayerReferenceRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleTcgplayerReference(file); }} />
              <div className="grid gap-3 rounded-2xl border border-td-ink/[.07] bg-td-canvas p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div><strong className="text-xs text-td-primary">TCGplayer reference export</strong><p className="mt-1 text-[11px] leading-4 text-td-muted">{tcgplayerReferenceRows.length ? `${tcgplayerReferenceName} · ${tcgplayerReferenceRows.length.toLocaleString()} verified SKU rows loaded` : "Optional fallback file for power users. The normal match uses the Trading Docks catalog first."}</p></div>
                <button type="button" onClick={() => tcgplayerReferenceRef.current?.click()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-td-accent/20 bg-td-accent/[.06] px-4 text-[11px] font-bold text-td-accent-text"><Upload className="h-4 w-4" />{tcgplayerReferenceRows.length ? "Replace reference" : "Upload reference export"}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void enrichForTcgplayer()} disabled={!validRows.length || working} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-td-accent/20 bg-td-accent/[.06] px-4 text-[11px] font-semibold text-td-accent-text disabled:opacity-40"><WandSparkles className="h-4 w-4" />Match product details</button>
                <button type="button" onClick={downloadManaBoxBridge} disabled={!validRows.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-td-ink/[.08] px-4 text-[11px] font-semibold text-td-secondary disabled:opacity-40"><Download className="h-4 w-4" />Download ManaBox bridge</button>
              </div>
              <button type="button" onClick={() => setShowBridgeHelp((value) => !value)} className="inline-flex items-center gap-2 text-[11px] font-semibold text-td-warning/75"><CircleHelp className="h-3.5 w-3.5" />How TCGplayer matching works<ChevronDown className={`h-3.5 w-3.5 transition ${showBridgeHelp ? "rotate-180" : ""}`} /></button>{showBridgeHelp ? <div className="rounded-xl border border-td-ink/[.07] bg-black/10 p-3 text-[11px] leading-5 text-td-muted">Trading Docks resolves the exact TCGplayer inventory SKU from the uploaded canonical catalog by matching product name, set name, collector number, condition, and foil or nonfoil. TCGCSV can still fill product details and prices, but it does not replace the condition-specific TCGplayer ID and Trading Docks will not guess between duplicate variants.</div> : null}
            </div> : null}
          </div> : null}

          {destination === "download" ? <div className="mt-4 space-y-3 rounded-2xl border border-td-ink/[.07] bg-black/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1"><span className="text-[11px] font-semibold text-td-muted">Convert to</span><select value={outputTemplateId} onChange={(event) => setOutputTemplateId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-td-ink/[.08] bg-td-canvas px-3 text-xs text-td-secondary">{CSV_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
              {tcgplayerMode ? null : <button type="button" onClick={downloadConverted} disabled={!validRows.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-td-accent px-5 text-xs font-bold text-td-on-accent disabled:opacity-40"><Download className="h-4 w-4" />Download CSV</button>}
            </div>
            {tcgplayerMode ? <>
              <div className={`rounded-2xl border p-4 ${allTcgplayerMatched ? "border-td-success/15 bg-td-success/[.035]" : hasAttemptedTcgplayerMatch ? "border-td-warning/15 bg-td-warning/[.035]" : "border-td-accent/15 bg-td-accent/[.035]"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[.2em] text-td-accent-text/70">Step 2</p>
                    <h3 className="mt-1 text-sm font-semibold text-td-primary">{allTcgplayerMatched ? `All ${validRows.length.toLocaleString()} cards matched` : hasAttemptedTcgplayerMatch ? `${missingTcgplayerSkuCount.toLocaleString()} cards need review` : "Match to TCGplayer"}</h3>
                    <p className="mt-1 max-w-2xl text-[11px] leading-5 text-td-secondary">{allTcgplayerMatched ? "Your cards have been matched to the correct TCGplayer printing, condition, and finish." : hasAttemptedTcgplayerMatch ? "Review the unmatched rows below, adjust set, number, condition, or finish, then match again." : "Use the Trading Docks catalog to attach exact TCGplayer IDs before downloading."}</p>
                  </div>
                  {allTcgplayerMatched ? <button type="button" onClick={downloadConverted} disabled={!validRows.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-td-accent px-5 text-xs font-bold text-td-on-accent disabled:opacity-40"><Download className="h-4 w-4" />Download TCGplayer CSV</button> : <button type="button" onClick={() => void resolveExactTcgplayerIds()} disabled={!validRows.length || working} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-td-accent px-5 text-xs font-bold text-td-on-accent disabled:opacity-40">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}Match to TCGplayer</button>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]"><Stat label="Matched" value={matchedTcgplayerSkuCount} /><Stat label="Need review" value={missingTcgplayerSkuCount} /></div>
              </div>
              {hasAttemptedTcgplayerMatch && missingTcgplayerSkuCount ? <div className="rounded-xl border border-td-warning/10 bg-td-warning/[.025] p-3 text-[11px] leading-5 text-td-warning/65"><strong className="text-td-warning">Review unmatched cards.</strong><span className="mt-1 block">{unresolvedTcgplayerRows.slice(0, 5).map((row) => `${row.name} (${row.setName || row.set} ${row.collectorNumber}, ${tcgplayerCondition(row.condition, row.finish)}) — ${tcgplayerReasonLabel(row)}${row.tcgplayerTranslatedSetName ? ` · Set translated: ${row.tcgplayerTranslatedSetName}` : ""}`).join("; ")}</span></div> : null}
            </> : null}
          </div> : <div className="mt-4 grid gap-3 rounded-2xl border border-td-ink/[.07] bg-black/10 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label><span className="text-[11px] font-semibold text-td-muted">Storage location</span><div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-td-ink/[.08] bg-td-canvas px-3"><MapPin className="h-4 w-4 text-td-accent-text" /><input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Bulk Box 001" className="min-w-0 flex-1 bg-transparent text-xs text-td-primary outline-none" /></div></label>
            <label><span className="text-[11px] font-semibold text-td-muted">Listing allocation</span><div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-td-ink/[.08] bg-td-canvas px-3"><Store className="h-4 w-4 text-td-accent-text" /><select value={marketplace} onChange={(event) => setMarketplace(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-td-secondary outline-none"><option>Unlisted</option><option>TCGplayer</option><option>eBay</option><option>Mana Pool</option><option>Trading Docks</option><option>In-Store</option></select></div></label>
            <button type="button" onClick={() => void saveToInventory()} disabled={!validRows.length || working} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-td-accent px-5 text-xs font-bold text-td-on-accent disabled:opacity-40">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}Import {quantityTotal.toLocaleString()} cards</button>
          </div>}
        </>}
      </section>
      {completion ? (
        <section className="rounded-[24px] border border-td-success/15 bg-td-success/[.035] p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-td-success" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-td-primary">{completion.duplicate ? "Import already completed" : "Cards imported into inventory"}</h2>
              <p className="mt-1 text-xs leading-5 text-td-secondary">{completion.units.toLocaleString()} cards {completion.duplicate ? "were already saved" : "saved"} in <strong>{completion.locationName}</strong>. {completion.duplicate ? "No duplicates were added." : "Your original file was not changed."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/dashboard/inventory" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-td-accent px-3 text-[11px] font-bold text-td-on-accent">View inventory</Link>
                <button type="button" onClick={reset} className="inline-flex min-h-9 items-center rounded-lg border border-td-ink/[.08] px-3 text-[11px] font-semibold text-td-secondary">Start another import</button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {notice ? <div role={commitFailed ? "alert" : "status"} className="fixed bottom-5 right-5 z-[180] max-w-sm rounded-2xl border border-td-accent/15 bg-td-surface px-4 py-3 text-xs leading-5 text-td-accent-text shadow-2xl">{notice}</div> : null}
    </div>
  );
}

function SectionTitle({ step, title, detail }: { step: string; title: string; detail: string }) {
  return <div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-td-accent/15 bg-td-accent/[.055] text-[11px] font-bold text-td-accent-text">{step}</span><div><h2 className="text-sm font-semibold text-td-primary">{title}</h2><p className="mt-1 text-[11px] leading-4 text-td-muted">{detail}</p></div></div>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return <span className="inline-flex items-center gap-2 rounded-lg border border-td-ink/[.07] bg-black/10 px-2.5 py-1.5 text-td-muted"><Check className="h-3 w-3 text-td-accent-text" />{label}: <strong className="text-td-primary">{value.toLocaleString()}</strong></span>;
}
function formatReasonSummary(reasons: Map<string, number>) {
  if (!reasons.size) return "No unresolved reason codes reported.";
  return [...reasons.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => `${reason}: ${count.toLocaleString()}`)
    .join(" · ");
}
function tcgplayerReasonLabel(row: Pick<EnrichedRow, "tcgplayerResolveReason" | "tcgplayerResolveReasonCode" | "tcgplayerSourceSetCode" | "tcgplayerSourceCollectorNumber">) {
  const code = row.tcgplayerResolveReasonCode?.trim();
  if (code === "PLST_COMPOUND_COLLECTOR_UNRESOLVED") return `${code} (${row.tcgplayerSourceSetCode?.toUpperCase() ?? "?"} #${row.tcgplayerSourceCollectorNumber ?? "?"})`;
  if (code && TCGPLAYER_REASON_LABELS[code]) return TCGPLAYER_REASON_LABELS[code];
  return row.tcgplayerResolveReason?.trim() || "Needs review";
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
