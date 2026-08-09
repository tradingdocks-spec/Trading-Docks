import {
  LABEL_SIZE_PRESETS,
  createDefaultLabelTemplate,
  paginateLabels,
  renderLabel,
} from "@/lib/label-studio/label-templates";
import { buildBulkLabelRenderJob, detectRepricingVariance } from "@/lib/label-studio/label-workflow";

const previewItem = {
  card: {
    name: "Unblinking Observer",
    set: "MID",
    collector_number: "82",
  },
  inventory: {
    condition: "Near Mint",
    finish: "Nonfoil",
    asking_price: 1.99,
    market_price: 1.63,
    sku: "TD-A7K4-92XM",
    location: "Showcase > Tray 2",
  },
  sealed: {
    product_name: "Collector Booster Box",
  },
  workspace: {
    name: "Trading Docks",
  },
};

const templates = [
  createDefaultLabelTemplate({
    id: "card-show-default",
    workspaceId: "workspace-preview",
    name: "Card Show Single",
    category: "card_show",
    sizePresetId: "2x1",
  }),
  createDefaultLabelTemplate({
    id: "sealed-default",
    workspaceId: "workspace-preview",
    name: "Sealed Product",
    category: "sealed",
    sizePresetId: "4x2",
  }),
  createDefaultLabelTemplate({
    id: "storage-default",
    workspaceId: "workspace-preview",
    name: "Storage Bin",
    category: "storage",
    sizePresetId: "3x2",
  }),
];

const sampleJob = buildBulkLabelRenderJob(templates[0], {
  workspaceId: "workspace-preview",
  mode: "card_show",
  items: [previewItem, { ...previewItem, inventory: { ...previewItem.inventory, sku: "TD-M9X2-K4QL" } }],
});
const previewPages = paginateLabels(sampleJob, 2);
const repricing = detectRepricingVariance([previewItem], 10);

export function LabelStudioWorkspace() {
  return (
    <section className="space-y-8">
      <div className="rounded-[2rem] border border-cyan-400/20 bg-slate-950 px-8 py-7 text-white shadow-2xl shadow-cyan-950/20">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
          Headquarters
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Label Studio</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Workspace-scoped labels for singles, sealed products, showcases, storage,
              card shows, inventory audits, and future POS workflows. This preview
              uses the platform contract and waits on a reviewed migration before
              writing templates or QR identities.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Presets" value={String(LABEL_SIZE_PRESETS.length)} />
            <Metric label="Templates" value={String(templates.length)} />
            <Metric label="Print pages" value={String(previewPages.length)} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-950">Template catalog</h2>
          {templates.map((template) => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              key={template.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-950">{template.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {template.category.replace(/_/g, " ")} / {template.width} x {template.height} {template.unit}
                  </p>
                </div>
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                  {template.qrEnabled ? "QR" : "No QR"}
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {template.elements.length} structured fields / {template.barcodeEnabled ? "barcode enabled" : "barcode optional"}
              </p>
            </article>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-950">Physical preview</h2>
          <div className="rounded-[1.75rem] bg-slate-100 p-5">
            <LabelPreview />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Metric label="Bulk labels" value={String(sampleJob.length)} tone="light" />
            <Metric label="Needs repricing" value={String(repricing.filter((item) => item.actionRequired).length)} tone="light" />
            <Metric label="Printer mode" value="Browser" tone="light" />
          </div>
        </div>
      </div>
    </section>
  );
}

function LabelPreview() {
  const result = renderLabel(templates[0], previewItem);
  return (
    <div
      className="mx-auto rounded-xl border border-slate-300 bg-white p-4 shadow-xl"
      style={{ aspectRatio: `${result.width} / ${result.height}`, maxWidth: 520 }}
    >
      <div className="flex h-full justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-lg font-semibold text-slate-950">
            {previewItem.card.name}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            {previewItem.card.set} #{previewItem.card.collector_number} / {previewItem.inventory.condition}
          </p>
          <p className="mt-auto text-3xl font-bold text-slate-950">
            {result.elements.find((element) => element.id === "price")?.value}
          </p>
          <p className="text-xs font-mono text-slate-500">{previewItem.inventory.sku}</p>
        </div>
        <div className="flex w-24 flex-col items-center justify-center rounded-lg border border-slate-300 bg-slate-50">
          <div className="grid grid-cols-5 gap-0.5">
            {Array.from({ length: 25 }).map((_, index) => (
              <span
                className={index % 3 === 0 ? "h-2 w-2 bg-slate-950" : "h-2 w-2 bg-slate-300"}
                key={index}
              />
            ))}
          </div>
          <span className="mt-2 text-[10px] font-semibold text-slate-500">QR</span>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "dark",
}: {
  label: string;
  value: string;
  tone?: "dark" | "light";
}) {
  const dark = tone === "dark";
  return (
    <div className={dark ? "rounded-2xl bg-white/10 p-4" : "rounded-2xl bg-white p-4 shadow-sm"}>
      <p className={dark ? "text-xs uppercase tracking-[0.2em] text-cyan-100" : "text-xs uppercase tracking-[0.2em] text-slate-500"}>
        {label}
      </p>
      <p className={dark ? "mt-2 text-2xl font-semibold text-white" : "mt-2 text-2xl font-semibold text-slate-950"}>
        {value}
      </p>
    </div>
  );
}
