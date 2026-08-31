"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CloudUpload,
  Layers3,
  PackageCheck,
  Play,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TDButton, TDCard, TDBadge, TDInput, TDLoadingState, TDText } from "@/components/design-system/td-primitives";
import { PageHeader } from "@/components/dashboard/common/PageHeader";
import { WorkspaceFrame } from "@/components/dashboard/common/WorkspaceFrame";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  buildChaosSortPlan,
  buildDefaultChaosSortRules,
  classifyChaosSortRecognition,
  createChaosSortBatchCode,
  makeChaosSortFileHash,
  summarizeChaosSortBatch,
  type ChaosSortBatch,
  type ChaosSortItem,
  type ChaosSortRecognitionState,
  type ChaosSortRule,
} from "@/lib/chaos-sort/domain";
import {
  buildChaosSortQueue,
  CHAOS_SORT_MAX_BATCH_SIZE,
  CHAOS_SORT_RECOGNITION_CONCURRENCY,
  runBoundedChaosSortQueue,
} from "@/lib/chaos-sort/batch-queue";

type InventoryRow = {
  id: string;
  card_name: string;
  location_id: string | null;
  scryfall_id: string | null;
  set_code: string | null;
  collector_number: string | null;
  quantity: number;
  inventory_value: number;
  data: Record<string, unknown> | null;
};

type LocationRow = {
  id: string;
  name: string;
  location_type: string;
};

type FilterState = "all" | "ready" | "needs_review" | "unknown" | "failed";
type StagedScan = { id: string; file: File; hash: string; previewUrl: string };

const BATCH_SEQUENCE_KEY = "td-chaos-sort-batch-sequence";

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function normalizeField(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function parseCsvValues(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function selectionValue(value: string | null | undefined) {
  return value ?? "";
}

function selectionNumber(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(value) ? "" : String(value);
}

function chaosSortBatchFromSequence(sequence: number): ChaosSortBatch {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    batchCode: createChaosSortBatchCode(sequence),
    title: "Scanner intake batch",
    status: "draft",
    sourceCount: 0,
    duplicateCount: 0,
    identifiedCount: 0,
    confirmedCount: 0,
    needsReviewCount: 0,
    unknownCount: 0,
    estimatedMarketValue: 0,
    acquisitionCost: null,
    destinationLocationId: null,
    destinationLabel: "Unassigned",
    createdAt: now,
    updatedAt: now,
    items: [],
    rules: buildDefaultChaosSortRules(),
  };
}

export function ChaosSortWorkspace() {
  const [sequence, setSequence] = useState(1);
  const [batch, setBatch] = useState<ChaosSortBatch>(() => chaosSortBatchFromSequence(1));
  const [items, setItems] = useState<ChaosSortItem[]>([]);
  const [stagedFiles, setStagedFiles] = useState<StagedScan[]>([]);
  const [staging, setStaging] = useState(false);
  const [rules, setRules] = useState<ChaosSortRule[]>(() => buildDefaultChaosSortRules());
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<FilterState>("all");
  const [sortMode, setSortMode] = useState<"review" | "sorting">("review");
  const [sortIndex, setSortIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingItems, setLoadingItems] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [title, setTitle] = useState("Scanner intake batch");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<ChaosSortItem[]>([]);
  const inventoryRef = useRef<InventoryRow[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    inventoryRef.current = inventoryRows;
  }, [inventoryRows]);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(BATCH_SEQUENCE_KEY) ?? "1");
    const next = Number.isFinite(stored) && stored > 0 ? stored : 1;
    setSequence(next);
    setBatch(chaosSortBatchFromSequence(next));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      setLoadingInventory(true);
      try {
        const [{ data: auth }, { data: locationsData }, { data: inventoryData }] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("inventory_locations")
            .select("id,name,location_type")
            .order("name", { ascending: true })
            .limit(200),
          supabase
            .from("inventory_items")
            .select("id,card_name,location_id,scryfall_id,set_code,collector_number,quantity,inventory_value,data")
            .limit(500),
        ]);
        if (!auth.user) {
          throw new Error("Sign in again to use Chaos Sort.");
        }
        setLocations((locationsData ?? []) as LocationRow[]);
        setInventoryRows((inventoryData ?? []) as InventoryRow[]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Inventory data is unavailable.");
      } finally {
        setLoadingInventory(false);
      }
    })();
  }, []);

  const plan = useMemo(() => buildChaosSortPlan(items, rules), [items, rules]);
  const queueCounts = useMemo(() => ({
    analyzed: items.filter((item) => item.processingState === "ready" || item.processingState === "failed").length,
    processing: items.filter((item) => item.processingState === "processing").length,
    identified: items.filter((item) => item.processingState === "ready" && item.recognitionState === "high_confidence").length,
    needsReview: items.filter((item) => item.processingState === "ready" && item.recognitionState === "review").length,
    unknown: items.filter((item) => item.processingState === "ready" && item.recognitionState === "unknown").length,
    failed: items.filter((item) => item.processingState === "failed").length,
  }), [items]);
  const stagedDuplicateCount = useMemo(() => stagedFiles.length - new Set(stagedFiles.map((entry) => entry.hash)).size, [stagedFiles]);
  const summary = useMemo(() => {
    const liveBatch: ChaosSortBatch = {
      ...batch,
      title,
      acquisitionCost: acquisitionCost.trim() ? Number(acquisitionCost) : null,
      destinationLocationId: destinationLocationId || null,
      destinationLabel: destinationLocationLabel(destinationLocationId, locations),
      sourceCount: items.length,
      duplicateCount: items.filter((item) => item.duplicateOfItemId !== null).length,
      identifiedCount: items.filter((item) => item.recognitionState !== "unknown").length,
      confirmedCount: items.filter((item) => item.humanState === "confirmed").length,
      needsReviewCount: items.filter((item) => item.recognitionState === "review" || item.humanState === "pending").length,
      unknownCount: items.filter((item) => item.recognitionState === "unknown").length,
      estimatedMarketValue: roundMoney(items.reduce((sum, item) => sum + (item.marketPrice ?? 0) * item.quantity, 0)),
      updatedAt: new Date().toISOString(),
      items,
      rules,
    };
    return summarizeChaosSortBatch(liveBatch);
  }, [acquisitionCost, batch, destinationLocationId, items, locations, rules, title]);

  const planById = useMemo(() => new Map(plan.items.map((entry) => [entry.itemId, entry])), [plan.items]);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;
  const selectedPlan = selectedItem ? planById.get(selectedItem.id) ?? null : null;
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (item.humanState === "removed") return false;
      if (filterState === "ready") return item.recognitionState === "high_confidence" && item.humanState !== "unknown";
      if (filterState === "needs_review") return item.recognitionState === "review";
      if (filterState === "failed") return item.processingState === "failed";
      if (filterState === "unknown") return item.processingState !== "failed" && item.recognitionState === "unknown";
      return true;
    });
  }, [filterState, items]);
  const sortableItems = useMemo(
    () => plan.items.filter((entry) => {
      const item = items.find((candidate) => candidate.id === entry.itemId);
      return Boolean(item && item.humanState !== "removed" && entry.pile !== "review" && entry.pile !== "unknown");
    }),
    [items, plan.items],
  );
  const currentSortEntry = sortableItems[sortIndex] ?? sortableItems[0] ?? null;
  const currentSortItem = currentSortEntry ? items.find((item) => item.id === currentSortEntry.itemId) ?? null : null;

  useEffect(() => {
    if (!selectedItemId && items.length) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    if (sortMode !== "sorting") return;
    if (!currentSortEntry && sortableItems.length) {
      setSortIndex(0);
    }
  }, [currentSortEntry, sortMode, sortableItems.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loadingItems) {
      setProgressText(items.length ? `Processing ${items.length} cards in ${batch.batchCode}.` : "Drop scanner photos to create a batch.");
    }
  }, [batch.batchCode, items.length, loadingItems]);

  const updateItem = useCallback((itemId: string, patch: Partial<ChaosSortItem>) => {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item;
      const next = { ...item, ...patch };
      const recognitionState = patch.recognitionState ?? classifyChaosSortRecognition({
        processingState: next.processingState,
        confidence: next.confidence,
        cardName: next.cardName,
        setCode: next.setCode,
        collectorNumber: next.collectorNumber,
      });
      return {
        ...next,
        recognitionState,
        updatedAt: new Date().toISOString(),
      };
    }));
  }, []);

  const stageFiles = useCallback(async (incomingFiles: FileList | File[]) => {
    const incoming = Array.from(incomingFiles);
    const valid = incoming.filter((file) => SUPPORTED_FILE_TYPES.includes(file.type));
    const invalidCount = incoming.length - valid.length;
    if (!valid.length) {
      setError("Use JPG, JPEG, PNG, or WebP files.");
      return;
    }
    setStaging(true);
    setError(invalidCount ? `${invalidCount} file${invalidCount === 1 ? "" : "s"} skipped. JPG, JPEG, PNG, and WebP are supported.` : "");
    const room = Math.max(0, CHAOS_SORT_MAX_BATCH_SIZE - stagedFiles.length);
    const accepted = valid.slice(0, room);
    const staged = await Promise.all(accepted.map(async (file) => ({ id: crypto.randomUUID(), file, hash: await makeChaosSortFileHash(file), previewUrl: URL.createObjectURL(file) })));
    setStagedFiles((current) => [...current, ...staged]);
    if (valid.length > room) setError(`Only ${CHAOS_SORT_MAX_BATCH_SIZE} scans can be staged in one batch. ${valid.length - room} additional file${valid.length - room === 1 ? "" : "s"} skipped.`);
    setStaging(false);
  }, [stagedFiles.length]);

  const processFiles = useCallback(async (files: StagedScan[]) => {
    if (!files.length) return;
    setError("");
    setNotice("");
    setLoadingItems(files.length);
    const queue = buildChaosSortQueue(files, (entry, index) => `${entry.hash}:${index}`);
    const seenHashes = new Map<string, string>();
    const baseItems = queue.map((entry) => {
      const { file, hash, previewUrl } = entry.input;
      const id = crypto.randomUUID();
      const duplicate = itemsRef.current.find((item) => item.sourceFileHash === hash);
      const duplicateOfItemId = duplicate?.id ?? seenHashes.get(hash) ?? null;
      seenHashes.set(hash, id);
      return {
        id,
        batchId: batch.id,
        sourceFileName: file.name,
        sourceFileHash: hash,
        sourceImageUrl: previewUrl,
        processingState: "processing",
        recognitionState: "review",
        humanState: "pending",
        cardName: file.name.replace(/\.[^.]+$/, ""),
        scryfallId: null,
        gameId: "magic",
        setCode: null,
        collectorNumber: null,
        rarity: null,
        finish: null,
        condition: null,
        quantity: 1,
        marketPrice: null,
        existingOwnedQuantity: 0,
        destinationLocationId: destinationLocationId || null,
        destinationLabel: destinationLocationLabel(destinationLocationId, locations),
        sortPile: "review",
        sortPass: 1,
        confidence: 0,
        evidence: [],
        notes: "",
        duplicateOfItemId,
        sortRuleId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies ChaosSortItem;
    });
    setItems((current) => [...current, ...baseItems]);
    let completed = 0;
    await runBoundedChaosSortQueue(queue, async (entry) => {
      const base = baseItems[queue.findIndex((candidate) => candidate.id === entry.id)];
      if (!base) return;
      if (base.duplicateOfItemId) {
        const duplicate = itemsRef.current.find((item) => item.id === base.duplicateOfItemId) ?? baseItems.find((item) => item.id === base.duplicateOfItemId);
        updateItem(base.id, { processingState: "ready", recognitionState: duplicate?.recognitionState ?? "review", humanState: "unknown", notes: "Duplicate scan image." });
        completed += 1;
        setLoadingItems(Math.max(0, files.length - completed));
        return;
      }
      try {
        entry.state = "processing";
        const form = new FormData();
        form.append("image", entry.input.file);
        form.append("gameId", "magic");
        const response = await fetch("/api/purchasing/card-photo-scan", { method: "POST", body: form });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(String(payload.error ?? payload.message ?? "Card recognition failed."));
        }
        const identification = payload.identification ?? {};
        const candidate = Array.isArray(payload.candidates) ? payload.candidates[0] ?? null : null;
        const cardName = String(candidate?.name ?? identification.name ?? entry.input.file.name.replace(/\.[^.]+$/, "")).trim();
        const setCode = typeof candidate?.setCode === "string" && candidate.setCode.trim()
          ? candidate.setCode.trim()
          : typeof identification.setCode === "string" && identification.setCode.trim()
            ? identification.setCode.trim().toUpperCase()
            : null;
        const collectorNumber = typeof candidate?.collectorNumber === "string" && candidate.collectorNumber.trim()
          ? candidate.collectorNumber.trim()
          : typeof identification.collectorNumber === "string" && identification.collectorNumber.trim()
            ? identification.collectorNumber.trim()
            : null;
        const finish = normalizeField(identification.finish) ? normalizeField(identification.finish) : null;
        const confidence = Number(identification.confidence ?? candidate?.confidence ?? 0);
        const marketPrice = Array.isArray(candidate?.prices)
          ? candidate.prices.find((price: { available?: boolean; value?: number | null }) => price.available && typeof price.value === "number")?.value ?? null
          : null;
        const match = resolveInventoryMatch(inventoryRef.current, locations, { cardName, setCode, collectorNumber, scryfallId: candidate?.id ?? null });
        const recognitionState = classifyChaosSortRecognition({
          processingState: "ready",
          confidence,
          cardName,
          setCode,
          collectorNumber,
        });
        entry.state = recognitionState === "high_confidence" ? "identified" : recognitionState === "review" ? "needs_review" : "unknown";
        updateItem(base.id, {
          processingState: "ready",
          recognitionState,
          humanState: confidence >= 0.8 ? "confirmed" : "pending",
          cardName,
          scryfallId: candidate?.id ?? null,
          setCode,
          collectorNumber,
          rarity: typeof candidate?.rarity === "string" ? candidate.rarity : null,
          finish,
          quantity: 1,
          marketPrice,
          existingOwnedQuantity: match.quantity,
          destinationLocationId: (match.locationId ?? destinationLocationId) || null,
          destinationLabel: match.locationName ?? destinationLocationLabel(destinationLocationId, locations),
          confidence,
          evidence: Array.isArray(identification.notes) ? identification.notes : [],
          notes: Array.isArray(payload.warnings) ? payload.warnings.join(" • ") : "",
          sortRuleId: null,
        });
      } catch (caught) {
        entry.state = "failed";
        updateItem(base.id, {
          processingState: "failed",
          recognitionState: "unknown",
          humanState: "unknown",
          notes: caught instanceof Error ? caught.message : "Recognition failed.",
        });
      }
      completed += 1;
      setLoadingItems(Math.max(0, files.length - completed));
      setProgressText(`Analyzed ${completed} of ${files.length} scans.`);
    });
    setLoadingItems(0);
  }, [batch.id, destinationLocationId, locations, updateItem]);

  const startBatch = useCallback(() => {
    const pending = stagedFiles;
    setStagedFiles([]);
    void processFiles(pending);
  }, [processFiles, stagedFiles]);

  const removeStagedFile = useCallback((id: string) => {
    setStagedFiles((current) => {
      const removed = current.find((entry) => entry.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  }, []);

  const clearStagedFiles = useCallback(() => {
    stagedFiles.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    setStagedFiles([]);
  }, [stagedFiles]);

  const retryRecognition = useCallback(async (retryItems: ChaosSortItem[]) => {
    const candidates = retryItems.filter((item) => item.processingState === "failed" && item.sourceImageUrl);
    const staged = await Promise.all(candidates.map(async (item) => {
      const blob = await fetch(item.sourceImageUrl as string).then((response) => response.blob());
      return { id: item.id, file: new File([blob], item.sourceFileName, { type: blob.type || "image/jpeg" }), hash: item.sourceFileHash, previewUrl: item.sourceImageUrl as string };
    }).filter(Boolean));
    const retryIds = new Set(candidates.map((item) => item.id));
    itemsRef.current = itemsRef.current.filter((item) => !retryIds.has(item.id));
    setItems((current) => current.filter((item) => !retryIds.has(item.id)));
    await processFiles(staged);
  }, [processFiles]);

  const confirmItem = useCallback((itemId: string) => {
    updateItem(itemId, { humanState: "confirmed" });
    const nextException = items.find((item) => item.id !== itemId && item.humanState !== "removed" && (item.recognitionState === "review" || item.recognitionState === "unknown" || item.processingState === "failed"));
    if (nextException) setSelectedItemId(nextException.id);
  }, [items, updateItem]);

  const markUnknown = useCallback((itemId: string) => {
    updateItem(itemId, { humanState: "unknown", recognitionState: "unknown" });
    const nextException = items.find((item) => item.id !== itemId && item.humanState !== "removed" && (item.recognitionState === "review" || item.recognitionState === "unknown" || item.processingState === "failed"));
    if (nextException) setSelectedItemId(nextException.id);
  }, [items, updateItem]);

  const removeItem = useCallback((itemId: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === itemId);
    if (item?.sourceImageUrl) URL.revokeObjectURL(item.sourceImageUrl);
    updateItem(itemId, { humanState: "removed", processingState: "ready" });
  }, [updateItem]);

  const advanceSort = useCallback((step: number) => {
    setSortIndex((current) => {
      if (!sortableItems.length) return 0;
      const next = Math.min(sortableItems.length - 1, Math.max(0, current + step));
      return next;
    });
  }, [sortableItems.length]);

  useEffect(() => {
    if (typeof window === "undefined" || sortMode !== "sorting") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        advanceSort(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        advanceSort(-1);
      } else if (event.key === "Escape") {
        setSortMode("review");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceSort, sortMode, sortableItems.length]);

  const confirmVisible = useCallback(() => {
    visibleItems.forEach((item) => {
      if (item.recognitionState === "high_confidence") {
        updateItem(item.id, { humanState: "confirmed" });
      }
    });
  }, [updateItem, visibleItems]);

  const resetBatch = useCallback(() => {
    const nextSequence = sequence + 1;
    window.localStorage.setItem(BATCH_SEQUENCE_KEY, String(nextSequence));
    setSequence(nextSequence);
    setBatch(chaosSortBatchFromSequence(nextSequence));
    setItems([]);
    stagedFiles.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    itemsRef.current.forEach((item) => { if (item.sourceImageUrl) URL.revokeObjectURL(item.sourceImageUrl); });
    setStagedFiles([]);
    setSelectedItemId(null);
    setFilterState("all");
    setTitle("Scanner intake batch");
    setAcquisitionCost("");
    setDestinationLocationId("");
    setSelectedItemIds([]);
    setSortMode("review");
    setSortIndex(0);
    setNotice(`Started ${createChaosSortBatchCode(nextSequence)}.`);
    setError("");
  }, [locations, sequence, stagedFiles]);

  const commitBatch = useCallback(async () => {
    const unresolved = items.filter((item) => item.humanState !== "confirmed" && item.humanState !== "removed");
    if (unresolved.some((item) => item.recognitionState === "review" || item.recognitionState === "unknown")) {
      setError("Resolve every card before committing the batch.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        batch: {
          ...batch,
          title,
          acquisitionCost: acquisitionCost.trim() ? Number(acquisitionCost) : null,
          destinationLocationId: destinationLocationId || null,
          destinationLabel: destinationLocationLabel(destinationLocationId, locations),
          sourceCount: items.length,
          duplicateCount: items.filter((item) => item.duplicateOfItemId !== null).length,
          estimatedMarketValue: roundMoney(items.reduce((sum, item) => sum + (item.marketPrice ?? 0) * item.quantity, 0)),
          updatedAt: new Date().toISOString(),
        },
        items: items
          .filter((item) => item.humanState !== "removed")
          .map((item) => {
            const planEntry = planById.get(item.id);
            return {
              ...item,
              sortPile: planEntry?.pile ?? item.sortPile,
              sortPass: planEntry?.pass ?? item.sortPass,
              sortRuleId: planEntry?.ruleId ?? item.sortRuleId,
              destinationLocationId: item.destinationLocationId || destinationLocationId || null,
              destinationLabel: item.destinationLabel || destinationLocationLabel(destinationLocationId, locations),
            };
          }),
        rules,
      };
      const response = await fetch("/api/chaos-sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(result.error ?? result.message ?? "Chaos Sort commit failed."));
      }
      setNotice(`Committed ${String(result.committedCount ?? payload.items.length)} cards into inventory.`);
      setBatch((current) => ({ ...current, status: "committed", updatedAt: new Date().toISOString() }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chaos Sort commit failed.");
    } finally {
      setSaving(false);
    }
  }, [acquisitionCost, batch, destinationLocationId, items, locations, planById, rules, title]);

  const updateRule = useCallback((ruleId: string, patch: Partial<ChaosSortRule>) => {
    setRules((current) => current.map((rule) => {
      if (rule.id !== ruleId) return rule;
      return {
        ...rule,
        ...patch,
        criteria: {
          ...rule.criteria,
          ...(patch.criteria ?? {}),
        },
      };
    }));
  }, []);

  const selectedItemPlan = selectedItem ? planById.get(selectedItem.id) ?? null : null;
  const selectItems = useCallback((predicate: (item: ChaosSortItem) => boolean) => {
    setSelectedItemIds(items.filter((item) => predicate(item)).map((item) => item.id));
  }, [items]);
  const removeSelected = useCallback(() => {
    selectedItemIds.forEach((itemId) => removeItem(itemId));
    setSelectedItemIds([]);
  }, [removeItem, selectedItemIds]);
  return (
    <WorkspaceFrame>
      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/dashboard/inventory" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <TDBadge tone="info">{batch.batchCode}</TDBadge>
            <TDBadge tone={batch.status === "committed" ? "success" : "neutral"}>{batch.status}</TDBadge>
            <TDButton variant="secondary" size="sm" onClick={resetBatch} icon={<RefreshCw className="h-4 w-4" />}>New Batch</TDButton>
          </div>
        </div>

        <PageHeader
          eyebrow="Inventory / Chaos Sort"
          title="Chaos Sort"
          description="Drop scanner photos into a review queue, resolve the cards against canonical inventory identities, sort them into physical piles, and commit the verified cards into inventory."
          icon={Layers3}
        />

        <section className="rounded-[22px] border border-cyan-300/[0.14] bg-[#061823] p-5 sm:p-6">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">Chaos Sort orientation</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-white">Tame your TCG inventory</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Trading Docks does not require cards to be alphabetized or sorted by set, game, color, or rarity. Store cards in any physical order as long as each accepted item has an exact location.</p>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
            <div className="rounded-2xl border border-rose-300/[0.14] bg-rose-300/[0.035] p-4"><p className="text-[11px] font-black uppercase tracking-[.16em] text-rose-200">Without Trading Docks</p><p className="mt-3 text-sm leading-6 text-slate-300">Dig through large boxes · manual sorting · slow pulls · lost stock · memory</p></div>
            <div className="hidden items-center justify-center px-1 text-xl text-slate-600 lg:flex">→</div>
            <div className="rounded-2xl border border-emerald-300/[0.14] bg-emerald-300/[0.035] p-4"><p className="text-[11px] font-black uppercase tracking-[.16em] text-emerald-200">With Trading Docks</p><p className="mt-3 text-sm leading-6 text-slate-300">Exact physical address · smaller search area · fast picking · mixed cards are okay · scan, locate, pull, ship</p></div>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-5"><span><b className="mr-1 text-cyan-300">1.</b> Drop scans</span><span><b className="mr-1 text-cyan-300">2.</b> Identify</span><span><b className="mr-1 text-cyan-300">3.</b> Review</span><span><b className="mr-1 text-cyan-300">4.</b> Assign location</span><span><b className="mr-1 text-cyan-300">5.</b> Sort → commit</span></div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-[22px] border border-white/[0.08] bg-[#06121b] p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">Your physical model</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="font-black text-white">SHELF A</p><p className="mt-2 text-sm leading-7 text-slate-400">Box 1<br /><span className="text-cyan-200">A-1-A · A-1-B · A-1-C</span><br />Box 2<br /><span className="text-cyan-200">A-2-A · A-2-B</span></p></div><div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="font-black text-white">SHELF B</p><p className="mt-2 text-sm leading-7 text-slate-400">Box 1<br /><span className="text-cyan-200">B-1-A · B-1-B · B-1-C</span></p></div></div></div>
          <div className="rounded-[22px] border border-amber-300/[0.15] bg-amber-300/[0.045] p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-amber-200">Pro tip</p><p className="mt-3 text-sm leading-6 text-amber-50/80">Keep physical locations small enough that a card can be found quickly without traditional sorting.</p><p className="mt-3 text-xs leading-5 text-amber-100/55">Smaller locations mean fewer cards to flip through when an order arrives. This is guidance, not an enforced capacity rule.</p></div>
        </section>

        {notice ? (
          <TDCard variant="outlined" className="border-emerald-300/20 bg-emerald-300/[0.04] text-emerald-100">
            <TDText variant="small">{notice}</TDText>
          </TDCard>
        ) : null}
        {error ? (
          <TDCard variant="outlined" className="border-red-300/20 bg-red-300/[0.04] text-red-100">
            <TDText variant="small">{error}</TDText>
          </TDCard>
        ) : null}
        {loadingInventory && !items.length ? (
          <TDLoadingState title="Loading inventory context" message="Fetching storage locations and owned inventory for canonical matching." />
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <TDCard variant="floating" className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <TDBadge tone="info">Batch {batch.batchCode}</TDBadge>
                <TDText as="h2" variant="heading">Drop scanner photos here</TDText>
                <TDText tone="secondary" className="max-w-2xl">
                  JPG, JPEG, PNG, and WebP are supported. Duplicates are flagged, recognition stays separate from human confirmation, and no cards are written to inventory until you commit.
                </TDText>
              </div>
              <div className="flex flex-wrap gap-2">
                <TDButton
                  variant="secondary"
                  size="sm"
                  icon={<CloudUpload className="h-4 w-4" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Add images
                </TDButton>
                <TDButton
                  variant="secondary"
                  size="sm"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={confirmVisible}
                >
                  Confirm high confidence
                </TDButton>
                {queueCounts.failed ? <TDButton variant="secondary" size="sm" onClick={() => void retryRecognition(items.filter((item) => item.processingState === "failed"))}>Retry Failed ({queueCounts.failed})</TDButton> : null}
                <TDButton
                  size="sm"
                  loading={saving}
                  icon={<PackageCheck className="h-4 w-4" />}
                  onClick={commitBatch}
                  disabled={summary.needsReview > 0 || summary.unknown > 0 || !items.length}
                >
                  Commit to Inventory
                </TDButton>
              </div>
            </div>

            {stagedFiles.length ? (
              <div className="rounded-[22px] border border-cyan-300/[0.2] bg-cyan-300/[0.045] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-200">Chaos Sort batch staging</p><p className="mt-1 text-lg font-semibold text-white">{stagedFiles.length} scans ready</p><p className="mt-1 text-xs text-slate-400">Destination: <span className="font-semibold text-cyan-100">{destinationLocationLabel(destinationLocationId, locations)}</span></p><p className="text-xs text-slate-400">Set the destination below, then start the entire batch. Recognition runs automatically with {CHAOS_SORT_RECOGNITION_CONCURRENCY} workers.</p></div>
                  <div className="flex flex-wrap gap-2"><TDButton variant="ghost" size="sm" onClick={clearStagedFiles}>Clear batch</TDButton><TDButton size="sm" loading={staging} onClick={startBatch} disabled={staging}>Start Batch</TDButton></div>
                </div>
                <div className="mt-4 flex max-h-20 gap-2 overflow-hidden">{stagedFiles.slice(0, 18).map((entry) => <div key={entry.id} className="group relative h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/[0.1]"><img src={entry.previewUrl} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => removeStagedFile(entry.id)} aria-label={`Remove ${entry.file.name}`} className="absolute inset-0 hidden bg-black/65 text-xs text-white group-hover:block">×</button></div>)}{stagedFiles.length > 18 ? <span className="self-center text-xs text-slate-500">+{stagedFiles.length - 18} more</span> : null}</div>
              </div>
            ) : null}

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (event.dataTransfer.files.length) {
                  void stageFiles(event.dataTransfer.files);
                }
              }}
              className={cn(
                "rounded-[24px] border border-dashed p-6 transition",
                "border-cyan-300/20 bg-cyan-300/[0.04] hover:border-cyan-300/35 hover:bg-cyan-300/[0.06]",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.length) {
                    void stageFiles(event.target.files);
                    event.target.value = "";
                  }
                }}
              />
              <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                    <ScanSearch className="h-5 w-5" />
                  </div>
                  <div>
                      <TDText variant="title">Drop an entire scanner batch</TDText>
                    <TDText variant="caption" tone="muted">
                      {progressText || "Drag 50–100 card scans here. Trading Docks identifies the entire batch automatically."}
                    </TDText>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] px-3 py-1">{queueCounts.identified} Identified</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] px-3 py-1">{queueCounts.needsReview} Need review</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] px-3 py-1">{queueCounts.processing} Processing</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] px-3 py-1">{queueCounts.failed} Failed</span>
                  {stagedDuplicateCount ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/[0.14] px-3 py-1 text-amber-200">{stagedDuplicateCount} Duplicate staged</span> : null}
                </div>
              </div>
            </div>

            {items.length ? <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[.12em] text-slate-500"><span>{queueCounts.analyzed} / {items.length} analyzed</span><span>{queueCounts.needsReview + queueCounts.unknown} cards need your attention</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${(queueCounts.analyzed / items.length) * 100}%` }} /></div></div> : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile label="Identified" value={summary.identified.toString()} detail="Resolved into canonical identities" />
              <SummaryTile label="Confirmed" value={summary.confirmed.toString()} detail="Ready for commit" />
              <SummaryTile label="Needs review" value={summary.needsReview.toString()} detail="Uncertain or pending" />
              <SummaryTile label="Market value" value={money(summary.estimatedMarketValue)} detail="No profit assumed" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile label="Existing matches" value={summary.existingInventoryMatches.toString()} detail="Already owned" />
              <SummaryTile label="New positions" value={summary.newInventoryPositions.toString()} detail="Will create inventory rows" />
              <SummaryTile label="Unknown" value={summary.unknown.toString()} detail="No silent guesses" />
              <SummaryTile label="Source images" value={summary.totalImages.toString()} detail="Batch intake count" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(["all", "ready", "needs_review", "unknown", "failed"] as FilterState[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setFilterState(filter)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    filterState === filter
                      ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                      : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-white",
                  )}
                >
                  {filter === "all" ? "All" : filter === "ready" ? "Ready" : filter === "needs_review" ? "Needs Review" : filter === "failed" ? "Failed" : "Unknown"}
                </button>
              ))}
              {summary.needsReview + summary.unknown > 0 ? <button type="button" onClick={() => { setFilterState("needs_review"); setSelectedItemIds([]); }} className="rounded-full border border-amber-300/[0.22] bg-amber-300/[0.08] px-3 py-1.5 text-xs font-black text-amber-100">Review {summary.needsReview + summary.unknown} exceptions</button> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-xs">
              <span className="mr-2 text-slate-500">{selectedItemIds.length} selected</span>
              <button type="button" onClick={() => selectItems((item) => item.processingState === "ready" && item.recognitionState === "high_confidence")} className="rounded-lg border border-white/[0.08] px-3 py-2 font-semibold text-slate-300">Select all ready</button>
              <button type="button" onClick={() => selectItems((item) => item.recognitionState === "review" || item.processingState === "failed")} className="rounded-lg border border-white/[0.08] px-3 py-2 font-semibold text-slate-300">Select exceptions</button>
              <button type="button" onClick={() => selectItems(() => true)} className="rounded-lg border border-white/[0.08] px-3 py-2 font-semibold text-slate-300">Select all</button>
              {selectedItemIds.length ? <button type="button" onClick={removeSelected} className="rounded-lg border border-rose-300/[0.18] px-3 py-2 font-semibold text-rose-200">Remove selected</button> : null}
            </div>

            <div className="grid gap-3">
              {visibleItems.length ? visibleItems.map((item) => {
                const entry = planById.get(item.id);
                const pile = entry?.pile ?? item.sortPile;
                const isSelected = selectedItemId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={cn(
                      "group grid gap-3 rounded-[22px] border p-3 text-left transition sm:grid-cols-[96px_1fr]",
                      isSelected
                        ? "border-cyan-300/30 bg-cyan-300/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.03]",
                    )}
                  >
                    <div className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#07131f]">
                      {item.sourceImageUrl ? (
                        <img src={item.sourceImageUrl} alt={item.cardName || item.sourceFileName} className="aspect-[0.72] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[0.72] items-center justify-center text-slate-700">
                          <ShieldAlert className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="checkbox" aria-label={`Select ${item.cardName || item.sourceFileName}`} checked={selectedItemIds.includes(item.id)} onClick={(event) => event.stopPropagation()} onChange={() => setSelectedItemIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} className="h-4 w-4 accent-cyan-300" />
                        <TDBadge tone={item.processingState === "failed" || item.recognitionState === "unknown" ? "danger" : item.processingState === "processing" ? "info" : item.recognitionState === "review" ? "warning" : "success"}>
                          {item.processingState === "processing" ? "PROCESSING" : item.processingState === "failed" ? "FAILED" : item.recognitionState === "high_confidence" ? "IDENTIFIED" : item.recognitionState === "review" ? "NEEDS REVIEW" : "UNKNOWN"}
                        </TDBadge>
                        <TDBadge tone={item.humanState === "confirmed" ? "success" : item.humanState === "unknown" ? "danger" : "neutral"}>
                          {item.humanState}
                        </TDBadge>
                        <TDBadge tone="neutral">{pile}</TDBadge>
                      </div>
                      <TDText variant="title" className="truncate">{item.cardName || item.sourceFileName}</TDText>
                      <TDText variant="caption" tone="muted" className="truncate">
                        {[
                          item.setCode,
                          item.collectorNumber,
                          item.finish,
                          item.condition,
                        ].filter(Boolean).join(" · ") || "Identity still resolving"}
                      </TDText>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                        <span className="rounded-full border border-white/[0.06] px-2.5 py-1">Market {money(item.marketPrice)}</span>
                        <span className="rounded-full border border-white/[0.06] px-2.5 py-1">Owned {item.existingOwnedQuantity}</span>
                        <span className="rounded-full border border-white/[0.06] px-2.5 py-1">Conf {Math.round(item.confidence * 100)}%</span>
                        <span className="rounded-full border border-white/[0.06] px-2.5 py-1">{entry?.label ?? "Review"}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.processingState === "failed" ? <TDButton size="sm" variant="secondary" onClick={() => void retryRecognition([item])}>Retry recognition</TDButton> : <TDButton size="sm" variant="secondary" onClick={() => confirmItem(item.id)}>Confirm</TDButton>}
                        <TDButton size="sm" variant="secondary" onClick={() => markUnknown(item.id)}>Mark unknown</TDButton>
                        <TDButton size="sm" variant="ghost" onClick={() => removeItem(item.id)} icon={<Trash2 className="h-4 w-4" />}>Remove</TDButton>
                      </div>
                    </div>
                  </button>
                );
              }) : (
                <TDCard variant="outlined" className="border-dashed text-center">
                  <TDText variant="title">No cards in the batch yet</TDText>
                  <TDText tone="muted" className="mt-2">Drop photos to start a sorting session. Failed files stay isolated and do not block the rest of the batch.</TDText>
                </TDCard>
              )}
            </div>
          </TDCard>

          <div className="space-y-5">
            <TDCard variant="floating" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <TDText variant="title">Physical sort mode</TDText>
                  <TDText variant="caption" tone="muted">Desktop-friendly pile navigation with large targets and keyboard shortcuts.</TDText>
                </div>
                <TDButton
                  size="sm"
                  variant="secondary"
                  icon={<Play className="h-4 w-4" />}
                  onClick={() => setSortMode("sorting")}
                  disabled={!sortableItems.length}
                >
                  Start Sorting
                </TDButton>
              </div>
              <div className="rounded-[22px] border border-white/[0.06] bg-[#07131e] p-4">
                {sortMode === "sorting" && currentSortItem ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Card {sortIndex + 1} / {sortableItems.length}</span>
                      <span>Pile {currentSortEntry?.label ?? "Review"}</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
                      <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-black">
                        <img
                          src={currentSortItem.sourceImageUrl ?? ""}
                          alt={currentSortItem.cardName}
                          className="aspect-[0.72] w-full object-cover"
                        />
                      </div>
                      <div className="space-y-3">
                        <div>
                          <TDText as="h3" variant="heading">{currentSortItem.cardName}</TDText>
                          <TDText variant="caption" tone="muted">
                            {currentSortItem.setCode ?? "Unknown set"} · {currentSortItem.collectorNumber ?? "?"} · {currentSortItem.finish ?? "finish unknown"}
                          </TDText>
                        </div>
                        <div className="rounded-[20px] border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
                          <TDText variant="label" tone="info">Sort destination</TDText>
                          <TDText as="h3" variant="display" className="mt-1">{currentSortEntry?.label ?? "Review"}</TDText>
                          <TDText variant="caption" tone="muted" className="mt-2">
                            {currentSortEntry?.secondPassLabel ?? "Use the first pass pile now, then subdivide later."}
                          </TDText>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <TDButton variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => advanceSort(-1)}>Previous</TDButton>
                          <TDButton variant="secondary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => advanceSort(1)}>Next</TDButton>
                          <TDButton variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => setSortMode("review")}>Exit sort mode</TDButton>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-slate-500">
                    <TDText variant="title">Sorting is ready when you are</TDText>
                    <TDText tone="muted">
                      The first pass groups cards into premium, value, bulk, foil, review, and unknown piles. Once this batch is confirmed, move into the physical sort lane and keep keyboard flow moving fast.
                    </TDText>
                  </div>
                )}
              </div>
            </TDCard>

            <TDCard variant="floating" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <TDText variant="title">Batch summary</TDText>
                  <TDText variant="caption" tone="muted">Shows exactly what the commit will write.</TDText>
                </div>
                <TDBadge tone={summary.needsReview > 0 || summary.unknown > 0 ? "warning" : "success"}>
                  {summary.needsReview > 0 || summary.unknown > 0 ? "Needs review" : "Ready"}
                </TDBadge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryTile label="Total images" value={summary.totalImages.toString()} detail="Files in this batch" />
                <SummaryTile label="Confirmed" value={summary.confirmed.toString()} detail="Verified cards" />
                <SummaryTile label="Needs review" value={summary.needsReview.toString()} detail="Must be resolved" />
                <SummaryTile label="Unknown" value={summary.unknown.toString()} detail="No silent invention" />
              </div>
              <div className="space-y-3">
                <TDInput
                  label="Batch title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <TDInput
                  label="Acquisition cost"
                  value={acquisitionCost}
                  onChange={(event) => setAcquisitionCost(event.target.value)}
                  placeholder="Optional"
                />
                <div className="space-y-2">
                  <label className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">Destination storage location</label>
                  <select
                    value={destinationLocationId}
                    onChange={(event) => {
                      const nextLocationId = event.target.value;
                      const previousLabel = destinationLocationLabel(destinationLocationId, locations);
                      setDestinationLocationId(nextLocationId);
                      setItems((current) => current.map((item) => item.destinationLocationId === destinationLocationId || item.destinationLabel === previousLabel
                        ? { ...item, destinationLocationId: nextLocationId || null, destinationLabel: destinationLocationLabel(nextLocationId, locations) }
                        : item));
                    }}
                    className="min-h-12 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-4 text-sm text-[var(--td-text-primary)] outline-none transition focus:border-[var(--td-border-focus)]"
                  >
                    <option value="">No destination selected</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                  </select>
                </div>
              </div>
                <div className="rounded-[20px] border border-cyan-300/[0.14] bg-cyan-300/[0.04] p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Batch destination</span>
                  <span className="font-bold text-cyan-100">{destinationLocationLabel(destinationLocationId, locations)}</span>
                  </div>
                <p className="mt-2 text-xs text-slate-400">Accepted cards inherit this location. Override a single card below when it belongs somewhere else.</p>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  {plan.piles.map((pile) => (
                    <div key={pile.pile} className="flex items-center justify-between rounded-xl border border-white/[0.05] px-3 py-2">
                      <span>{pile.label}</span>
                      <span className="text-xs text-slate-500">{pile.count} cards · {money(pile.marketValue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TDCard>

            <TDCard variant="floating" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <TDText variant="title">Review inspector</TDText>
                  <TDText variant="caption" tone="muted">Fast edits for card, printing, finish, and condition.</TDText>
                </div>
                {selectedItem ? <TDBadge tone="info">{selectedItem.sourceFileName}</TDBadge> : null}
              </div>
              {selectedItem ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-[22px] border border-white/[0.06] bg-black">
                    <img src={selectedItem.sourceImageUrl ?? ""} alt={selectedItem.cardName} className="aspect-[0.72] w-full object-cover" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TDInput label="Card name" value={selectedItem.cardName} onChange={(event) => updateItem(selectedItem.id, { cardName: event.target.value })} />
                    <TDInput label="Set code" value={selectionValue(selectedItem.setCode)} onChange={(event) => updateItem(selectedItem.id, { setCode: event.target.value.toUpperCase() })} />
                    <TDInput label="Collector number" value={selectionValue(selectedItem.collectorNumber)} onChange={(event) => updateItem(selectedItem.id, { collectorNumber: event.target.value })} />
                    <TDInput label="Finish" value={selectionValue(selectedItem.finish)} onChange={(event) => updateItem(selectedItem.id, { finish: event.target.value })} />
                    <TDInput label="Condition" value={selectionValue(selectedItem.condition)} onChange={(event) => updateItem(selectedItem.id, { condition: event.target.value })} />
                    <TDInput label="Quantity" value={String(selectedItem.quantity)} onChange={(event) => updateItem(selectedItem.id, { quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) })} />
                    <TDInput label="Market price" value={selectionNumber(selectedItem.marketPrice)} onChange={(event) => updateItem(selectedItem.id, { marketPrice: event.target.value ? Number(event.target.value) : null })} />
                    <div className="space-y-2 sm:col-span-2">
                      <label className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">Physical destination override</label>
                      <select
                        value={selectedItem.destinationLocationId ?? ""}
                        onChange={(event) => updateItem(selectedItem.id, { destinationLocationId: event.target.value || null, destinationLabel: destinationLocationLabel(event.target.value, locations) })}
                        className="min-h-12 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-4 text-sm text-[var(--td-text-primary)] outline-none transition focus:border-[var(--td-border-focus)]"
                      >
                        <option value="">Unassigned / pending location</option>
                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                      </select>
                      <p className="text-xs text-slate-500">Leave unassigned when the physical destination is not known. No location is invented.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">Human state</label>
                      <select
                        value={selectedItem.humanState}
                        onChange={(event) => updateItem(selectedItem.id, { humanState: event.target.value as ChaosSortItem["humanState"] })}
                        className="min-h-12 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-4 text-sm text-[var(--td-text-primary)] outline-none transition focus:border-[var(--td-border-focus)]"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="edited">Edited</option>
                        <option value="unknown">Unknown</option>
                        <option value="removed">Removed</option>
                      </select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">Notes</label>
                      <textarea
                        value={selectedItem.notes}
                        onChange={(event) => updateItem(selectedItem.id, { notes: event.target.value })}
                        className="min-h-24 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-4 py-3 text-sm text-[var(--td-text-primary)] outline-none transition focus:border-[var(--td-border-focus)]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <TDButton variant="secondary" size="sm" onClick={() => confirmItem(selectedItem.id)}>Confirm</TDButton>
                    <TDButton variant="secondary" size="sm" onClick={() => markUnknown(selectedItem.id)}>Mark unknown</TDButton>
                    <TDButton variant="ghost" size="sm" onClick={() => removeItem(selectedItem.id)} icon={<Trash2 className="h-4 w-4" />}>Remove</TDButton>
                  </div>
                  <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
                    <div className="flex items-center justify-between gap-3">
                      <span>Recognition</span>
                      <span>{selectedItem.recognitionState}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Canonical plan</span>
                      <span>{selectedPlan?.label ?? "Review"}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Existing owned quantity</span>
                      <span>{selectedItem.existingOwnedQuantity}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <TDLoadingState title="No item selected" message="Upload a batch, then pick a card to inspect it." />
              )}
            </TDCard>

            <TDCard variant="floating" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <TDText variant="title">Sorting rules</TDText>
                  <TDText variant="caption" tone="muted">Defaults are editable and can be tuned per batch.</TDText>
                </div>
                <TDButton variant="secondary" size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setRules(buildDefaultChaosSortRules())}>
                  Reset defaults
                </TDButton>
              </div>
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div key={rule.id} className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}
                          className="h-4 w-4 rounded border-white/20 bg-transparent"
                        />
                        <TDInput
                          value={rule.label}
                          onChange={(event) => updateRule(rule.id, { label: event.target.value })}
                          className="!min-h-10 !w-[240px]"
                        />
                      </div>
                      <select
                        value={rule.targetPile}
                        onChange={(event) => updateRule(rule.id, { targetPile: event.target.value as ChaosSortRule["targetPile"] })}
                        className="min-h-10 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-3 text-sm"
                      >
                        <option value="high_value">High Value</option>
                        <option value="mid_value">Mid Value</option>
                        <option value="bulk_rare">Bulk Rare</option>
                        <option value="bulk_cu">Bulk C/U</option>
                        <option value="foil">Foil</option>
                        <option value="review">Review</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <TDInput
                        label="Min market"
                        value={selectionNumber(rule.criteria.minMarket)}
                        onChange={(event) => updateRule(rule.id, { criteria: { minMarket: event.target.value ? Number(event.target.value) : undefined } })}
                        placeholder="Optional"
                      />
                      <TDInput
                        label="Max market"
                        value={selectionNumber(rule.criteria.maxMarket)}
                        onChange={(event) => updateRule(rule.id, { criteria: { maxMarket: event.target.value ? Number(event.target.value) : undefined } })}
                        placeholder="Optional"
                      />
                      <TDInput
                        label="Rarity list"
                        value={(rule.criteria.rarityIn ?? []).join(", ")}
                        onChange={(event) => updateRule(rule.id, { criteria: { rarityIn: parseCsvValues(event.target.value) } })}
                        placeholder="rare, mythic"
                      />
                      <TDInput
                        label="Finish list"
                        value={(rule.criteria.finishIn ?? []).join(", ")}
                        onChange={(event) => updateRule(rule.id, { criteria: { finishIn: parseCsvValues(event.target.value) } })}
                        placeholder="foil, etched"
                      />
                      <TDInput
                        label="Game ids"
                        value={(rule.criteria.gameIdIn ?? []).join(", ")}
                        onChange={(event) => updateRule(rule.id, { criteria: { gameIdIn: parseCsvValues(event.target.value) } })}
                        placeholder="magic"
                      />
                      <TDInput
                        label="Set codes"
                        value={(rule.criteria.setCodeIn ?? []).join(", ")}
                        onChange={(event) => updateRule(rule.id, { criteria: { setCodeIn: parseCsvValues(event.target.value).map((value) => value.toUpperCase()) } })}
                        placeholder="MKM, OTJ"
                      />
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">Confidence</label>
                        <select
                          value={(rule.criteria.confidenceIn ?? []).join(",")}
                          onChange={(event) => {
                            const raw = event.target.value;
                            updateRule(rule.id, {
                              criteria: {
                                confidenceIn: raw
                                  ? (raw.split(",") as ChaosSortRecognitionState[])
                                  : undefined,
                              },
                            });
                          }}
                          className="min-h-12 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-4 text-sm"
                        >
                          <option value="">Any confidence</option>
                          <option value="high_confidence">High confidence</option>
                          <option value="review">Review</option>
                          <option value="unknown">Unknown</option>
                          <option value="review,unknown">Review + unknown</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">Ownership</label>
                        <select
                          value={(rule.criteria.ownedStateIn ?? []).join(",")}
                          onChange={(event) => {
                            const raw = event.target.value;
                            updateRule(rule.id, {
                              criteria: {
                                ownedStateIn: raw
                                  ? (raw.split(",") as Array<"new" | "owned">)
                                  : undefined,
                              },
                            });
                          }}
                          className="min-h-12 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-4 text-sm"
                        >
                          <option value="">Any ownership</option>
                          <option value="new">New</option>
                          <option value="owned">Owned</option>
                          <option value="new,owned">New + owned</option>
                        </select>
                      </div>
                    </div>
                    <TDText variant="caption" tone="muted" className="mt-3">{rule.description}</TDText>
                  </div>
                ))}
              </div>
            </TDCard>
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}

function SummaryTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function roundMoney(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function destinationLocationLabel(destinationLocationId: string, locations: LocationRow[]) {
  if (!destinationLocationId) return "Unassigned";
  return locations.find((location) => location.id === destinationLocationId)?.name ?? "Unassigned";
}

function resolveInventoryMatch(
  rows: InventoryRow[],
  locations: LocationRow[],
  input: { cardName: string; setCode: string | null; collectorNumber: string | null; scryfallId: string | null },
) {
  const exact = rows.filter((row) => {
    const nameMatch = normalizeField(row.card_name) === normalizeField(input.cardName);
    const setMatch = normalizeField(row.set_code) === normalizeField(input.setCode);
    const numberMatch = normalizeField(row.collector_number) === normalizeField(input.collectorNumber);
    const scryfallMatch = input.scryfallId ? row.scryfall_id === input.scryfallId : true;
    return nameMatch && setMatch && numberMatch && scryfallMatch;
  });
  const locationId = exact[0]?.location_id ?? null;
  return {
    quantity: exact.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0),
    locationId,
    locationName: locationId ? locations.find((location) => location.id === locationId)?.name ?? "Unassigned" : null,
  };
}

const SUPPORTED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
