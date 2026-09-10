"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Archive,
  Check,
  Layers3,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Tags,
} from "lucide-react";

import {
  LABEL_CATEGORIES,
  LABEL_SIZE_PRESETS,
  createDefaultLabelTemplate,
  labelSizePreset,
  paginateLabels,
  renderLabel,
  type LabelTemplate,
  type LabelCategory,
} from "@/lib/label-studio/label-templates";
import type { LabelStudioItem, LabelStudioPriceReviewRow } from "@/lib/label-studio/persistence";
import {
  clearInventorySelection,
  selectAllInventoryItems,
  summarizeInventorySelection,
  toggleInventorySelection,
  uniqueSelection,
} from "@/lib/label-studio/selection";

type LabelStudioPayload = {
  workspaceId: string;
  source: string;
  mode: string;
  contextSelection: string[];
  templates: LabelTemplate[];
  items: LabelStudioItem[];
  priceReviews: LabelStudioPriceReviewRow[];
  capabilities: {
    canManageTemplates: boolean;
    canPrint: boolean;
    canReprice: boolean;
  };
  environment: {
    supabaseHost: string | null;
    stagingUnverified: boolean;
  };
};

type Status = { tone: "idle" | "success" | "error"; message: string };

export function LabelStudioWorkspace() {
  const [payload, setPayload] = useState<LabelStudioPayload | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<LabelTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [status, setStatus] = useState<Status>({ tone: "idle", message: "Loading staging Label Studio." });
  const initializedSelectionKey = useRef<string | null>(null);

  const searchParams = typeof window !== "undefined" ? window.location.search : "";

  useEffect(() => {
    void load();
  }, [searchParams]);

  useEffect(() => {
    if (!payload) return;
    const nextTemplate = payload.templates.find((template) => template.id === selectedTemplateId) ?? payload.templates[0];
    if (!nextTemplate) return;
    setSelectedTemplateId(nextTemplate.id);
    setDraft(structuredClone(nextTemplate));
  }, [payload, selectedTemplateId]);

  useEffect(() => {
    if (!payload) return;
    const selectionKey = `${payload.workspaceId}:${payload.source}:${payload.mode}:${payload.items.map((item) => item.id).join(",")}`;
    if (initializedSelectionKey.current === selectionKey) return;
    initializedSelectionKey.current = selectionKey;
    setSelectedIds(selectAllInventoryItems(payload.items));
  }, [payload]);

  const selectedItems = useMemo(
    () => {
      const selected = new Set(selectedIds);
      return (payload?.items ?? []).filter((item) => selected.has(item.id));
    },
    [payload?.items, selectedIds],
  );
  const renderItems = useMemo(
    () => selectedItems,
    [selectedItems],
  );
  const selectionSummary = useMemo(
    () => summarizeInventorySelection(payload?.items ?? [], selectedIds),
    [payload?.items, selectedIds],
  );
  const labels = useMemo(
    () => draft ? renderItems.map((item) => renderLabel(draft, item)) : [],
    [draft, renderItems],
  );
  const pages = useMemo(() => paginateLabels(labels, labelsPerPage(draft)), [draft, labels]);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/label-studio${window.location.search}`, { cache: "no-store" });
    const data = await response.json().catch(() => null) as LabelStudioPayload | { error?: string } | null;
    if (!response.ok || !isLabelStudioPayload(data)) {
      setStatus({ tone: "error", message: data && "error" in data ? data.error ?? "Label Studio could not load staging data." : "Label Studio could not load staging data." });
      setLoading(false);
      return;
    }
    setPayload(data);
    setStatus({
      tone: "success",
      message: data.environment.supabaseHost
        ? `Connected through ${data.environment.supabaseHost}. Confirm this is staging before printing.`
        : "Supabase host is not visible. Confirm staging configuration before printing.",
    });
    setLoading(false);
  }

  async function saveTemplate() {
    if (!draft) return;
    setSaving(true);
    const response = await post({ action: "save-template", template: draft });
    setSaving(false);
    if (!response.ok) return;
    const template = response.data.template as LabelTemplate;
    setPayload((current) => current ? {
      ...current,
      templates: [template, ...current.templates.filter((item) => item.id !== template.id)],
    } : current);
    setSelectedTemplateId(template.id);
    setStatus({ tone: "success", message: "Template saved to staging label_templates." });
  }

  async function archiveTemplate() {
    if (!draft || draft.id.startsWith("local-")) return;
    setSaving(true);
    const response = await post({ action: "archive-template", templateId: draft.id });
    setSaving(false);
    if (!response.ok) return;
    setPayload((current) => current ? {
      ...current,
      templates: current.templates.filter((item) => item.id !== draft.id),
    } : current);
    setSelectedTemplateId("");
    setStatus({ tone: "success", message: "Template archived in staging." });
  }

  async function resolveIdentities() {
    const ids = renderItems.map((item) => item.id);
    if (!ids.length) {
      setStatus({ tone: "error", message: "Select inventory before resolving labels." });
      return;
    }
    const response = await post({ action: "resolve-identities", inventoryItemIds: ids });
    if (!response.ok) return;
    const items = response.data.items as LabelStudioItem[];
    setPayload((current) => current ? {
      ...current,
      items: current.items.map((item) => items.find((next) => next.id === item.id) ?? item),
    } : current);
    setStatus({ tone: "success", message: "Real SKU and QR identities resolved from staging." });
  }

  async function printLabels() {
    if (!draft || !payload?.capabilities.canPrint) return;
    if (!renderItems.length) {
      setStatus({ tone: "error", message: "Select inventory before printing labels." });
      return;
    }
    if (renderItems.some((item) => !item.identity)) {
      await resolveIdentities();
      setTimeout(() => void printLabels(), 250);
      return;
    }
    setPrinting(true);
    const response = await post({
      action: "record-print-job",
      templateId: draft.id,
      templateName: draft.name,
      source: payload.source,
      mode: payload.mode,
      selectedIds: uniqueSelection(selectedIds),
      labelCount: labels.length,
      pageCount: pages.length,
    });
    setPrinting(false);
    if (!response.ok) return;
    setStatus({ tone: "success", message: `Print job ${response.data.printJobId} recorded. Opening browser print.` });
    window.setTimeout(() => window.print(), 100);
  }

  async function reviewPrice(reviewId: string, decision: "approve" | "dismiss") {
    const response = await post({ action: "review-price", reviewId, decision });
    if (!response.ok) return;
    setPayload((current) => current ? {
      ...current,
      priceReviews: current.priceReviews.filter((review) => review.id !== reviewId),
    } : current);
    setStatus({ tone: "success", message: decision === "approve" ? "Price update applied after explicit approval." : "Repricing suggestion dismissed." });
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/label-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      setStatus({ tone: "error", message: typeof data.error === "string" ? data.error : "Label Studio action failed." });
      return { ok: false as const, data };
    }
    return { ok: true as const, data };
  }

  return (
    <section className="space-y-6 text-td-primary">
      <style>{printCss(draft)}</style>
      <header className="rounded-[2rem] border border-td-accent/[0.13] bg-td-surface px-6 py-6 text-td-primary shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/calc(.28*var(--td-shadow-strength)))]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-td-accent-text">Operations</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Label Studio</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-td-secondary">
              Staging-backed labels for singles, sealed products, card shows, QR labels, barcode labels,
              bulk printing, repricing review, and future POS reprints.
            </p>
          </div>
          <div className="rounded-2xl border border-td-warning/20 bg-td-warning/[0.07] px-4 py-3 text-xs text-td-warning">
            Staging safety: {payload?.environment.supabaseHost ?? "host unavailable"}
          </div>
        </div>
      </header>

      <StatusBanner status={status} loading={loading} />

      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.82fr)_minmax(360px,1.18fr)_minmax(300px,0.92fr)]">
        <aside className="space-y-4">
          <Panel title="Templates" icon={Tags}>
            <div className="space-y-2">
              {(payload?.templates ?? []).map((template) => (
                <button
                  className={`w-full rounded-2xl border p-4 text-left transition ${selectedTemplateId === template.id ? "border-td-accent/45 bg-td-accent/[0.10] text-td-primary shadow-[inset_0_0_0_1px_rgb(var(--td-accent-rgb)/.06)]" : "border-td-ink/[0.08] bg-td-ink/[0.025] text-td-primary hover:border-td-accent/25 hover:bg-td-ink/[0.04]"}`}
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <p className="font-semibold">{template.name}</p>
                  <p className="mt-1 text-xs text-td-muted">
                    {template.category.replace(/_/g, " ")} / {template.width} x {template.height} {template.unit}
                  </p>
                </button>
              ))}
            </div>
            <button
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-td-accent/15 bg-td-accent/[0.055] px-3 text-xs font-semibold text-td-accent-text transition hover:border-td-accent/30 hover:bg-td-accent/[0.09]"
              onClick={() => {
                const workspaceId = payload?.workspaceId ?? "workspace";
                const template = createDefaultLabelTemplate({
                  id: `local-${Date.now()}`,
                  workspaceId,
                  name: "New Label Template",
                  category: "single",
                  sizePresetId: "2x1",
                });
                setDraft(template);
                setSelectedTemplateId(template.id);
              }}
            >
              <Layers3 className="h-4 w-4" /> New template
            </button>
          </Panel>

          <Panel title="Template settings" icon={Save}>
            {draft ? (
              <div className="space-y-3">
                <Field label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
                <label className="block text-xs font-semibold text-td-secondary">
                  Category
                  <select className="mt-1 h-10 w-full rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-sm text-td-primary outline-none transition focus:border-td-accent/40 disabled:opacity-45" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as LabelCategory })}>
                    {LABEL_CATEGORIES.map((category) => <option key={category} value={category}>{category.replace(/_/g, " ")}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-td-secondary">
                  Size
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-sm text-td-primary outline-none transition focus:border-td-accent/40 disabled:opacity-45"
                    value={draft.sizePresetId}
                    onChange={(event) => {
                      const preset = labelSizePreset(event.target.value as LabelTemplate["sizePresetId"]);
                      setDraft({ ...draft, sizePresetId: preset.id, width: preset.width, height: preset.height, unit: preset.unit });
                    }}
                  >
                    {LABEL_SIZE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="Width" value={draft.width} onChange={(width) => setDraft({ ...draft, width })} />
                  <NumberField label="Height" value={draft.height} onChange={(height) => setDraft({ ...draft, height })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Toggle label="QR" checked={draft.qrEnabled} onChange={(qrEnabled) => setDraft({ ...draft, qrEnabled })} />
                  <Toggle label="Barcode" checked={draft.barcodeEnabled} onChange={(barcodeEnabled) => setDraft({ ...draft, barcodeEnabled })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Market %"
                    value={draft.pricingRule?.percentage ?? 100}
                    onChange={(percentage) => setDraft({ ...draft, pricingRule: { ...(draft.pricingRule ?? { mode: "market_percentage" }), mode: "market_percentage", percentage } })}
                  />
                  <NumberField
                    label="Min price"
                    value={draft.pricingRule?.minimumPrice ?? 0}
                    onChange={(minimumPrice) => setDraft({ ...draft, pricingRule: { ...(draft.pricingRule ?? { mode: "market_percentage" }), minimumPrice } })}
                  />
                </div>
                <button disabled={!payload?.capabilities.canManageTemplates || saving} onClick={saveTemplate} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-td-accent text-xs font-bold text-td-on-accent shadow-[0_10px_28px_rgb(var(--td-accent-rgb)/.16)] transition hover:bg-td-accent-hover disabled:opacity-40">
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save template"}
                </button>
                <button disabled={!payload?.capabilities.canManageTemplates || draft.id.startsWith("local-")} onClick={archiveTemplate} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-td-danger/20 bg-td-danger/[0.035] text-xs font-semibold text-td-danger transition hover:bg-td-danger/[0.07] disabled:opacity-40">
                  <Archive className="h-4 w-4" /> Archive template
                </button>
              </div>
            ) : <Empty message="Load or create a template." />}
          </Panel>
        </aside>

        <main className="space-y-4">
          <Panel title="Live physical preview" icon={QrCode}>
            <div className="rounded-[1.75rem] border border-td-ink/[0.07] bg-td-canvas p-4 shadow-[inset_0_1px_0_rgb(var(--td-ink-rgb)/.035)]">
              {draft && renderItems[0] ? <PhysicalLabelPreview template={draft} item={renderItems[0]} /> : <Empty message="Select inventory to preview a real label." />}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Metric label="Selected" value={String(renderItems.length)} />
              <Metric label="Pages" value={String(pages.length)} />
              <Metric label="Identities" value={`${renderItems.filter((item) => item.identity).length}/${renderItems.length}`} />
            </div>
          </Panel>

          <section id="label-print-area" className="hidden print:block">
            {pages.map((page) => (
              <div className="label-print-page" key={page.pageNumber}>
                {page.labels.map((label, index) => (
                  <PrintedLabel
                    key={`${page.pageNumber}-${index}`}
                    label={label}
                    item={renderItems[(page.pageNumber - 1) * labelsPerPage(draft) + index]}
                    template={draft}
                  />
                ))}
              </div>
            ))}
          </section>

          <Panel title="Repricing review" icon={RefreshCw}>
            {payload?.priceReviews.length ? (
              <div className="space-y-2">
                {payload.priceReviews.map((review) => (
                  <div className="rounded-2xl border border-td-ink/[0.08] bg-td-ink/[0.025] p-4" key={review.id}>
                    <p className="text-xs font-semibold text-td-primary">Inventory item {review.inventory_item_id}</p>
                    <p className="mt-1 text-xs text-td-muted">
                      Current {money(review.current_asking_price)} / Market {money(review.market_price)} / Proposed {money(review.proposed_asking_price)}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button disabled={!payload.capabilities.canReprice} onClick={() => void reviewPrice(review.id, "approve")} className="h-9 rounded-xl bg-td-success px-3 text-xs font-bold text-td-primary disabled:opacity-40">Approve/update</button>
                      <button disabled={!payload.capabilities.canReprice} onClick={() => void reviewPrice(review.id, "dismiss")} className="h-9 rounded-xl border border-td-ink/[0.09] px-3 text-xs font-semibold text-td-secondary disabled:opacity-40">Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty message="No pending repricing reviews in staging." />}
          </Panel>
        </main>

        <aside className="space-y-4">
          <Panel title="Selected inventory" icon={Layers3}>
            <div className="overflow-hidden rounded-2xl border border-td-ink/[0.08] bg-td-canvas">
              <div className="sticky top-0 z-10 border-b border-td-ink/[0.08] bg-td-surface/95 p-3 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-td-primary">{selectionSummary.selectedCount} selected</p>
                    <p className="mt-0.5 text-[11px] text-td-muted">{selectionSummary.totalCount} visible inventory records</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${selectionSummary.allSelected ? "border-td-accent/25 bg-td-accent/[0.08] text-td-accent-text" : selectionSummary.partiallySelected ? "border-td-warning/20 bg-td-warning/[0.07] text-td-warning" : "border-td-ink/[0.08] bg-td-ink/[0.025] text-td-secondary"}`}>
                    {selectionSummary.allSelected ? "All" : selectionSummary.partiallySelected ? "Partial" : "None"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!payload?.items.length || selectionSummary.allSelected}
                    onClick={() => setSelectedIds(selectAllInventoryItems(payload?.items ?? []))}
                    className="h-9 rounded-xl border border-td-accent/15 bg-td-accent/[0.055] px-3 text-xs font-bold text-td-accent-text transition hover:bg-td-accent/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    disabled={!selectionSummary.selectedCount}
                    onClick={() => setSelectedIds(clearInventorySelection())}
                    className="h-9 rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.025] px-3 text-xs font-semibold text-td-secondary transition hover:bg-td-ink/[0.045] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
              <div className="max-h-[480px] space-y-2 overflow-auto p-2">
              {(payload?.items ?? []).map((item) => (
                <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${selectedIds.includes(item.id) ? "border-td-accent/30 bg-td-accent/[0.075]" : "border-td-ink/[0.07] bg-td-ink/[0.025] hover:border-td-accent/20 hover:bg-td-ink/[0.04]"}`} key={item.id}>
                  <input
                    className="mt-1 h-4 w-4 accent-td-accent"
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) => setSelectedIds((current) => toggleInventorySelection(current, item.id, event.target.checked))}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-td-primary">{item.sealed?.product_name || item.card?.name || "Inventory item"}</span>
                    <span className="mt-1 block text-xs text-td-muted">{item.inventory?.sku || "No SKU yet"} / {item.identity ? "QR ready" : "Needs identity"}</span>
                  </span>
                </label>
              ))}
              </div>
            </div>
            {!payload?.items.length ? <Empty message="No workspace inventory found for this Label Studio context." /> : null}
          </Panel>

          <Panel title="Print controls" icon={Printer}>
            <div className="space-y-3 text-sm">
              <button disabled={!payload?.capabilities.canPrint || !renderItems.length} onClick={resolveIdentities} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-td-accent/20 bg-td-accent/[0.07] text-xs font-bold text-td-accent-text transition hover:bg-td-accent/[0.11] disabled:opacity-40">
                <QrCode className="h-4 w-4" /> Resolve real SKU + QR
              </button>
              <button disabled={!payload?.capabilities.canPrint || printing || !labels.length} onClick={printLabels} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-td-accent text-xs font-bold text-td-on-accent shadow-[0_14px_34px_rgb(var(--td-accent-rgb)/.18)] transition hover:bg-td-accent-hover disabled:opacity-40">
                <Printer className="h-4 w-4" /> {printing ? "Recording..." : "Print labels"}
              </button>
              <p className="text-xs leading-5 text-td-muted">
                Printing uses browser print CSS with exact template dimensions. Print jobs store audit metadata only.
              </p>
            </div>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function PhysicalLabelPreview({ template, item }: { template: LabelTemplate; item: LabelStudioItem }) {
  const label = renderLabel(template, item);
  return (
    <div className="mx-auto max-w-full overflow-auto">
      <div
        data-print-surface
        className="relative mx-auto bg-white text-td-on-accent shadow-[0_18px_50px_rgb(var(--td-shadow-rgb)/calc(.45*var(--td-shadow-strength)))]"
        style={{
          width: `min(${Math.min(template.width * 180, 620)}px, 100%)`,
          aspectRatio: `${template.width} / ${template.height}`,
        }}
      >
        {label.elements.map((element) => (
          <LabelElement key={element.id} element={element} item={item} />
        ))}
      </div>
    </div>
  );
}

function LabelElement({ element, item }: { element: ReturnType<typeof renderLabel>["elements"][number]; item: LabelStudioItem }) {
  const style = {
    left: `${element.x * 100}%`,
    top: `${element.y * 100}%`,
    width: `${element.width * 100}%`,
    height: `${element.height * 100}%`,
  };
  if (element.type === "qr") return <QrImage className="absolute" style={style} value={item.qrUrl} />;
  if (element.type === "barcode") return <Barcode className="absolute" style={style} value={item.barcodeValue ?? item.inventory?.sku ?? ""} />;
  return (
    <div className={`absolute overflow-hidden px-1 ${element.emphasis === "price" ? "text-2xl font-black" : element.emphasis === "strong" ? "text-sm font-bold" : "text-[10px] font-semibold"}`} style={style}>
      {element.value}
    </div>
  );
}

function QrImage({ value, className, style }: { value: string | null; className?: string; style?: React.CSSProperties }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!value) {
      setSrc("");
      return;
    }
    void QRCode.toDataURL(value, { margin: 1, width: 180, errorCorrectionLevel: "M" }).then(setSrc);
  }, [value]);
  return (
    <div className={`${className ?? ""} flex items-center justify-center border border-td-line bg-white`} style={style}>
      {src ? <img alt="Inventory QR code" className="h-full w-full object-contain" src={src} /> : <span className="text-[8px] font-bold text-td-secondary">QR pending</span>}
    </div>
  );
}

function Barcode({ value, className, style }: { value: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`${className ?? ""} flex flex-col justify-end overflow-hidden`} style={style}>
      <div className="flex h-8 items-end gap-px">
        {Array.from({ length: 34 }).map((_, index) => (
          <span className="bg-td-canvas" style={{ width: index % 5 === 0 ? 2 : 1, height: `${35 + ((index * 17) % 55)}%` }} key={index} />
        ))}
      </div>
      <span className="truncate text-[8px] font-mono">{value}</span>
    </div>
  );
}

function PrintedLabel({ label, item, template }: { label: ReturnType<typeof renderLabel>; item: LabelStudioItem | undefined; template: LabelTemplate | null }) {
  if (!template || !item) return null;
  return (
    <div data-print-surface className="label-print-label relative border border-td-line bg-white">
      {label.elements.map((element) => (
        <LabelElement key={element.id} element={element} item={item} />
      ))}
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Tags; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-td-ink/[0.075] bg-td-surface p-5 shadow-[inset_0_1px_0_rgb(var(--td-ink-rgb)/.035),0_18px_55px_rgb(var(--td-shadow-rgb)/calc(.22*var(--td-shadow-strength)))]">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-td-accent-text" />
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-td-secondary">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatusBanner({ status, loading }: { status: Status; loading: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${status.tone === "error" ? "border-td-danger/25 bg-td-danger/[0.07] text-td-danger" : "border-td-accent/20 bg-td-accent/[0.07] text-td-accent-text"}`}>
      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      {status.message}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-semibold text-td-secondary">
      {label}
      <input className="mt-1 h-10 w-full rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-sm text-td-primary outline-none transition placeholder:text-td-muted focus:border-td-accent/40 disabled:opacity-45" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs font-semibold text-td-secondary">
      {label}
      <input className="mt-1 h-10 w-full rounded-xl border border-td-ink/[0.09] bg-td-surface px-3 text-sm text-td-primary outline-none transition focus:border-td-accent/40 disabled:opacity-45" type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-10 items-center justify-between rounded-xl border border-td-ink/[0.09] bg-td-ink/[0.025] px-3 text-xs font-semibold text-td-secondary">
      {label}
      <input className="h-4 w-4 accent-td-accent" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-td-ink/[0.075] bg-td-ink/[0.025] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-td-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-td-primary">{value}</p>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="rounded-2xl border border-dashed border-td-ink/[0.10] bg-td-ink/[0.025] p-4 text-sm text-td-muted">{message}</p>;
}

function labelsPerPage(template: LabelTemplate | null) {
  if (!template) return 1;
  if (template.width <= 2 && template.height <= 1) return 12;
  if (template.width <= 3 && template.height <= 2) return 6;
  return 2;
}

function printCss(template: LabelTemplate | null) {
  const width = template?.width ?? 2;
  const height = template?.height ?? 1;
  const unit = template?.unit ?? "in";
  return `
    @media print {
      body * { visibility: hidden !important; }
      #label-print-area, #label-print-area * { visibility: visible !important; }
      #label-print-area { display: block !important; position: absolute; inset: 0; background: white; }
      .label-print-page { page-break-after: always; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 0; padding: 0.125in; }
      .label-print-label { width: ${width}${unit}; height: ${height}${unit}; break-inside: avoid; color: #020617; }
    }
  `;
}

function money(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) return "n/a";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

function isLabelStudioPayload(value: LabelStudioPayload | { error?: string } | null): value is LabelStudioPayload {
  return Boolean(value && "workspaceId" in value && Array.isArray(value.templates) && Array.isArray(value.items));
}
