"use client";

import { useEffect, useMemo, useState } from "react";
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
    setSelectedIds((current) => current.length ? current : payload.items.map((item) => item.id));
  }, [payload, selectedTemplateId]);

  const selectedItems = useMemo(
    () => (payload?.items ?? []).filter((item) => selectedIds.includes(item.id)),
    [payload?.items, selectedIds],
  );
  const renderItems = useMemo(
    () => selectedItems.length ? selectedItems : payload?.items ?? [],
    [payload?.items, selectedItems],
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
      selectedIds,
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
    <section className="space-y-6">
      <style>{printCss(draft)}</style>
      <header className="rounded-[2rem] border border-cyan-400/20 bg-slate-950 px-6 py-6 text-white shadow-2xl shadow-cyan-950/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Operations</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Label Studio</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Staging-backed labels for singles, sealed products, card shows, QR labels, barcode labels,
              bulk printing, repricing review, and future POS reprints.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] px-4 py-3 text-xs text-amber-100">
            Staging safety: {payload?.environment.supabaseHost ?? "host unavailable"}
          </div>
        </div>
      </header>

      <StatusBanner status={status} loading={loading} />

      <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr_0.92fr]">
        <aside className="space-y-4">
          <Panel title="Templates" icon={Tags}>
            <div className="space-y-2">
              {(payload?.templates ?? []).map((template) => (
                <button
                  className={`w-full rounded-2xl border p-4 text-left transition ${selectedTemplateId === template.id ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white hover:border-cyan-200"}`}
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <p className="font-semibold text-slate-950">{template.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {template.category.replace(/_/g, " ")} / {template.width} x {template.height} {template.unit}
                  </p>
                </button>
              ))}
            </div>
            <button
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700"
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
                <label className="block text-xs font-semibold text-slate-600">
                  Category
                  <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as LabelCategory })}>
                    {LABEL_CATEGORIES.map((category) => <option key={category} value={category}>{category.replace(/_/g, " ")}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Size
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
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
                <button disabled={!payload?.capabilities.canManageTemplates || saving} onClick={saveTemplate} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-bold text-white disabled:opacity-40">
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save template"}
                </button>
                <button disabled={!payload?.capabilities.canManageTemplates || draft.id.startsWith("local-")} onClick={archiveTemplate} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 text-xs font-semibold text-rose-700 disabled:opacity-40">
                  <Archive className="h-4 w-4" /> Archive template
                </button>
              </div>
            ) : <Empty message="Load or create a template." />}
          </Panel>
        </aside>

        <main className="space-y-4">
          <Panel title="Live physical preview" icon={QrCode}>
            <div className="rounded-[1.75rem] bg-slate-100 p-4">
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
                  <PrintedLabel key={`${page.pageNumber}-${index}`} label={label} item={renderItems[index]} template={draft} />
                ))}
              </div>
            ))}
          </section>

          <Panel title="Repricing review" icon={RefreshCw}>
            {payload?.priceReviews.length ? (
              <div className="space-y-2">
                {payload.priceReviews.map((review) => (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4" key={review.id}>
                    <p className="text-xs font-semibold text-slate-950">Inventory item {review.inventory_item_id}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Current {money(review.current_asking_price)} / Market {money(review.market_price)} / Proposed {money(review.proposed_asking_price)}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button disabled={!payload.capabilities.canReprice} onClick={() => void reviewPrice(review.id, "approve")} className="h-9 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-40">Approve/update</button>
                      <button disabled={!payload.capabilities.canReprice} onClick={() => void reviewPrice(review.id, "dismiss")} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-40">Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty message="No pending repricing reviews in staging." />}
          </Panel>
        </main>

        <aside className="space-y-4">
          <Panel title="Selected inventory" icon={Layers3}>
            <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
              {(payload?.items ?? []).map((item) => (
                <label className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-white p-3" key={item.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950">{item.sealed?.product_name || item.card?.name || "Inventory item"}</span>
                    <span className="mt-1 block text-xs text-slate-500">{item.inventory?.sku || "No SKU yet"} / {item.identity ? "QR ready" : "Needs identity"}</span>
                  </span>
                </label>
              ))}
            </div>
            {!payload?.items.length ? <Empty message="No workspace inventory found for this Label Studio context." /> : null}
          </Panel>

          <Panel title="Print controls" icon={Printer}>
            <div className="space-y-3 text-sm">
              <button disabled={!payload?.capabilities.canPrint || !renderItems.length} onClick={resolveIdentities} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 text-xs font-bold text-cyan-800 disabled:opacity-40">
                <QrCode className="h-4 w-4" /> Resolve real SKU + QR
              </button>
              <button disabled={!payload?.capabilities.canPrint || printing || !labels.length} onClick={printLabels} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 text-xs font-bold text-slate-950 disabled:opacity-40">
                <Printer className="h-4 w-4" /> {printing ? "Recording..." : "Print labels"}
              </button>
              <p className="text-xs leading-5 text-slate-500">
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
        className="relative mx-auto bg-white shadow-xl"
        style={{
          width: `${Math.min(template.width * 180, 620)}px`,
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
    <div className={`${className ?? ""} flex items-center justify-center border border-slate-300 bg-white`} style={style}>
      {src ? <img alt="Inventory QR code" className="h-full w-full object-contain" src={src} /> : <span className="text-[8px] font-bold text-slate-400">QR pending</span>}
    </div>
  );
}

function Barcode({ value, className, style }: { value: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`${className ?? ""} flex flex-col justify-end overflow-hidden`} style={style}>
      <div className="flex h-8 items-end gap-px">
        {Array.from({ length: 34 }).map((_, index) => (
          <span className="bg-slate-950" style={{ width: index % 5 === 0 ? 2 : 1, height: `${35 + ((index * 17) % 55)}%` }} key={index} />
        ))}
      </div>
      <span className="truncate text-[8px] font-mono">{value}</span>
    </div>
  );
}

function PrintedLabel({ label, item, template }: { label: ReturnType<typeof renderLabel>; item: LabelStudioItem | undefined; template: LabelTemplate | null }) {
  if (!template || !item) return null;
  return (
    <div className="label-print-label relative border border-slate-300 bg-white">
      {label.elements.map((element) => (
        <LabelElement key={element.id} element={element} item={item} />
      ))}
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Tags; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-600" />
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-700">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatusBanner({ status, loading }: { status: Status; loading: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${status.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-cyan-200 bg-cyan-50 text-cyan-900"}`}>
      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      {status.message}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-10 items-center justify-between rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{message}</p>;
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
