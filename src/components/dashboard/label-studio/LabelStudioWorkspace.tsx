"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  LABEL_SIZE_PRESETS,
  type LabelTemplate,
} from "@/lib/label-studio/label-templates";
import {
  DEFAULT_PRINT_SETTINGS,
  PRINT_FIELDS,
  type LabelTarget,
  type PrintQueueEntry,
} from "@/lib/label-studio/print-settings";
import { retailPresets } from "@/lib/label-studio/retail-presets";
import type { LabelStudioPriceReviewRow } from "@/lib/label-studio/persistence";
import "./label-studio.css";
type Payload = {
  workspaceId: string;
  templates: LabelTemplate[];
  priceReviews: LabelStudioPriceReviewRow[];
  capabilities: {
    canPrint: boolean;
    canManageTemplates: boolean;
    canReprice: boolean;
  };
};
async function request<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Label request failed.");
  return data;
}
export function LabelStudioWorkspace() {
  const [payload, setPayload] = useState<Payload | null>(null),
    [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [draft, setDraft] = useState<LabelTemplate | null>(null),
    [items, setItems] = useState<LabelTarget[]>([]);
  const [queue, setQueue] = useState<PrintQueueEntry[]>([]),
    [query, setQuery] = useState("");
  const [message, setMessage] = useState("Loading Label Studio…"),
    [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(""),
    [zoom, setZoom] = useState(2),
    [source, setSource] = useState("manual");
  const [alias, setAlias] = useState(""),
    [aliasTarget, setAliasTarget] = useState("");
  const printWindow = useRef<Window | null>(null),
    inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    let selected: string[] | null = null;
    try {
      const token = params.get("selection");
      if (token) {
        const parsed = JSON.parse(
          sessionStorage.getItem(`td.label.selection.${token}`) ?? "null",
        );
        if (
          !Array.isArray(parsed) ||
          !parsed.length ||
          parsed.length > 500 ||
          parsed.some((id) => typeof id !== "string")
        )
          throw new Error(
            "The selected inventory could not be restored. Return to Inventory and select it again.",
          );
        selected = parsed;
      }
    } catch (error) {
      queueMicrotask(() =>
        setMessage(
          error instanceof Error ? error.message : "Selection unavailable.",
        ),
      );
      return;
    }
    void Promise.all([
      request<Payload>("/api/label-studio"),
      selected
        ? request<LabelTarget[]>("/api/label-studio/targets", { ids: selected })
        : request<LabelTarget[]>(`/api/label-studio/targets?${params}`),
    ])
      .then(([data, targets]) => {
        if (!active) return;
        const all = [
          ...retailPresets(data.workspaceId),
          ...data.templates.filter((t) => !t.id.startsWith("local-")),
        ];
        setPayload(data);
        setTemplates(all);
        setDraft(all.find((t) => t.isDefault) ?? all[0]);
        setItems(targets);
        setSource(params.get("source") ?? "manual");
        setAlias(params.get("barcode") ?? "");
        if (selected || params.has("ids") || params.has("batchId"))
          setQueue(targets.map((target) => ({ target, copies: 1 })));
        setMessage("Choose inventory, confirm the preview, then print.");
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const firstKey = queue[0]?.target.key;
  useEffect(() => {
    if (!draft || !firstKey) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch("/api/label-studio/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          template: draft,
          queue: [{ key: firstKey, copies: 1 }],
          preview: true,
        }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).error);
          return r.text();
        })
        .then(setPreview)
        .catch((error) => {
          if (error.name !== "AbortError") {
            setPreview("");
            setMessage(error.message);
          }
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, firstKey]);
  const count = queue.reduce((n, row) => n + row.copies, 0),
    settings = draft?.print ?? DEFAULT_PRINT_SETTINGS;
  const system = draft?.id.startsWith("system-");
  function edit(patch: Partial<LabelTemplate>) {
    if (draft) setDraft({ ...draft, ...patch });
  }
  function printEdit(patch: Partial<typeof settings>) {
    edit({ print: { ...settings, ...patch } });
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  function add(target: LabelTarget) {
    setQueue((rows) =>
      rows.some((row) => row.target.key === target.key)
        ? rows
        : [...rows, { target, copies: 1 }],
    );
  }
  async function refresh() {
    await act(async () => {
      const targets = await request<LabelTarget[]>(
        "/api/label-studio/targets",
        { ids: queue.map((row) => row.target.key) },
      );
      setQueue((rows) =>
        rows.map((row) => ({
          ...row,
          target: targets.find((t) => t.key === row.target.key) ?? row.target,
        })),
      );
      setMessage(
        "Current prices and identities refreshed. Missing stock is checked again before printing.",
      );
    });
  }
  async function print(test = false) {
    if (!draft || inFlight.current) return;
    if (printWindow.current && !printWindow.current.closed) {
      printWindow.current.focus();
      setMessage(
        "Close the existing print window before preparing another job.",
      );
      return;
    }
    if (
      !test &&
      count > 500 &&
      !window.confirm(`You are about to print ${count} labels. Continue?`)
    )
      return;
    inFlight.current = true;
    const popup = window.open("", "td-label-print", "width=850,height=750");
    printWindow.current = popup;
    if (!popup) {
      inFlight.current = false;
      setMessage("Allow the print window in your browser and retry.");
      return;
    }
    popup.document.body.textContent = "Preparing labels…";
    await act(async () => {
      try {
        const r = await fetch("/api/label-studio/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template: draft,
            queue: queue.map((row) => ({
              key: row.target.key,
              copies: row.copies,
            })),
            source,
            test,
          }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
        const html = await r.text();
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        setMessage(
          "Prepared. Use Print in the isolated window; verify media and 100% scale.",
        );
      } catch (error) {
        popup.close();
        throw error;
      } finally {
        inFlight.current = false;
      }
    });
  }
  function duplicate() {
    if (!draft) return;
    const next = {
      ...structuredClone(draft),
      id: `local-${crypto.randomUUID()}`,
      name: `${draft.name} copy`,
      isDefault: false,
    };
    setTemplates((all) => [...all, next]);
    setDraft(next);
  }
  const sizeFactor = draft?.unit === "in" ? 96 : 96 / 25.4;
  const shortSide =
      Math.min(draft?.width ?? 2, draft?.height ?? 1) * sizeFactor,
    longSide = Math.max(draft?.width ?? 2, draft?.height ?? 1) * sizeFactor;
  return (
    <section className="label-studio">
      <header>
        <div>
          <p className="label-eyebrow">INVENTORY OPERATIONS</p>
          <h1>Label Studio</h1>
          <p>Durable identities. Current prices. Exact inventory positions.</p>
        </div>
        <nav>
          <Link href="/dashboard/pos">POS register</Link>
          <Link href="/dashboard/pos/hardware">Scanner & printer test</Link>
        </nav>
      </header>
      <p role="status" aria-live="polite" className="label-status">
        {message}
      </p>
      <div className="label-workbench">
        <aside className="label-settings">
          <h2>Template</h2>
          <label>
            Preset / organization template
            <select
              value={draft?.id ?? ""}
              onChange={(e) =>
                setDraft(templates.find((t) => t.id === e.target.value) ?? null)
              }
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </label>
          {draft && (
            <>
              <label>
                Name
                <input
                  maxLength={100}
                  value={draft.name}
                  onChange={(e) => edit({ name: e.target.value })}
                />
              </label>
              <label>
                Label size
                <select
                  value={draft.sizePresetId}
                  onChange={(e) => {
                    const size = LABEL_SIZE_PRESETS.find(
                      (s) => s.id === e.target.value,
                    )!;
                    edit({
                      width: size.width,
                      height: size.height,
                      unit: size.unit,
                      sizePresetId: size.id,
                      orientation:
                        size.width >= size.height ? "landscape" : "portrait",
                    });
                  }}
                >
                  {LABEL_SIZE_PRESETS.map((size) => (
                    <option key={size.id} value={size.id}>
                      {size.name} {size.unit}
                    </option>
                  ))}
                </select>
              </label>
              <div className="label-pair">
                {(["width", "height"] as const).map((key) => (
                  <NumberField
                    key={key}
                    label={key}
                    value={draft[key]}
                    onChange={(value) =>
                      edit({ [key]: value, sizePresetId: "custom" })
                    }
                  />
                ))}
              </div>
              <div className="label-pair">
                <label>
                  Units
                  <select
                    value={draft.unit}
                    onChange={(e) => {
                      const unit = e.target.value as "in" | "mm",
                        f =
                          unit === draft.unit
                            ? 1
                            : unit === "mm"
                              ? 25.4
                              : 1 / 25.4;
                      edit({
                        unit,
                        width: Number((draft.width * f).toFixed(4)),
                        height: Number((draft.height * f).toFixed(4)),
                        sizePresetId: "custom",
                      });
                    }}
                  >
                    <option value="in">inches</option>
                    <option value="mm">millimeters</option>
                  </select>
                </label>
                <label>
                  Orientation
                  <select
                    value={draft.orientation}
                    onChange={(e) =>
                      edit({
                        orientation: e.target.value as "portrait" | "landscape",
                      })
                    }
                  >
                    <option>landscape</option>
                    <option>portrait</option>
                  </select>
                </label>
              </div>
              <label>
                Print mode
                <select
                  value={settings.mode}
                  onChange={(e) =>
                    printEdit({ mode: e.target.value as "roll" | "sheet" })
                  }
                >
                  <option value="roll">Roll — one label per page</option>
                  <option value="sheet">Sheet — Letter grid</option>
                </select>
              </label>
              {settings.mode === "sheet" && (
                <details open>
                  <summary>Sheet dimensions (mm)</summary>
                  <div className="label-pair">
                    {(
                      [
                        "width",
                        "height",
                        "rows",
                        "columns",
                        "margin",
                        "gapX",
                        "gapY",
                      ] as const
                    ).map((key) => (
                      <NumberField
                        key={key}
                        label={key}
                        value={settings.sheet[key]}
                        onChange={(value) =>
                          printEdit({
                            sheet: { ...settings.sheet, [key]: value },
                          })
                        }
                      />
                    ))}
                  </div>
                </details>
              )}
              <details open>
                <summary>Visible fields & order</summary>
                {PRINT_FIELDS.map((field) => (
                  <div className="label-field" key={field}>
                    <Toggle
                      label={field}
                      checked={settings.fields.includes(field)}
                      onChange={(checked) =>
                        printEdit({
                          fields: checked
                            ? [...settings.fields, field]
                            : settings.fields.filter((f) => f !== field),
                        })
                      }
                    />
                    <button
                      aria-label={`Move ${field} up`}
                      disabled={settings.fields.indexOf(field) <= 0}
                      onClick={() => {
                        const fields = [...settings.fields],
                          i = fields.indexOf(field);
                        [fields[i - 1], fields[i]] = [fields[i], fields[i - 1]];
                        printEdit({ fields });
                      }}
                    >
                      ↑{" "}
                      {settings.fields.includes(field)
                        ? settings.fields.indexOf(field) + 1
                        : ""}
                    </button>
                  </div>
                ))}
              </details>
              <NumberField
                label="Font size (6–14 pt)"
                value={settings.fontPt}
                onChange={(fontPt) => printEdit({ fontPt })}
              />
              <label>
                Store name
                <input
                  maxLength={80}
                  value={settings.storeName}
                  onChange={(e) => printEdit({ storeName: e.target.value })}
                />
              </label>
              <Toggle
                label="Code 128"
                checked={draft.barcodeEnabled}
                onChange={(barcodeEnabled) => edit({ barcodeEnabled })}
              />
              <Toggle
                label="Use unique product UPC when available"
                checked={Boolean(settings.useUpc)}
                onChange={(useUpc) => printEdit({ useUpc })}
              />
              <Toggle
                label="QR (opaque code)"
                checked={draft.qrEnabled}
                onChange={(qrEnabled) => edit({ qrEnabled })}
              />
              {(["humanReadable", "priceEmphasis", "border"] as const).map(
                (key) => (
                  <Toggle
                    key={key}
                    label={
                      {
                        humanReadable: "Human-readable code",
                        priceEmphasis: "Emphasize price",
                        border: "Border",
                      }[key]
                    }
                    checked={settings[key]}
                    onChange={(checked) => printEdit({ [key]: checked })}
                  />
                ),
              )}
              {payload?.capabilities.canManageTemplates && (
                <div className="label-actions">
                  <button onClick={duplicate}>Create / duplicate</button>
                  <button
                    disabled={busy || system}
                    onClick={() =>
                      void act(async () => {
                        const data = await request<{ template: LabelTemplate }>(
                          "/api/label-studio",
                          { action: "save-template", template: draft },
                        );
                        setTemplates((all) => [
                          ...all.filter((t) => t.id !== data.template.id),
                          data.template,
                        ]);
                        setDraft(data.template);
                        setMessage("Organization template saved.");
                      })
                    }
                  >
                    Save / rename
                  </button>
                  <button
                    disabled={busy || system || draft.id.startsWith("local-")}
                    onClick={() =>
                      void act(async () => {
                        await request("/api/label-studio", {
                          action: "default-template",
                          templateId: draft.id,
                        });
                        setTemplates((all) =>
                          all.map((t) => ({
                            ...t,
                            isDefault: t.id === draft.id,
                          })),
                        );
                        setMessage("Default template updated.");
                      })
                    }
                  >
                    Set default
                  </button>
                  <button
                    disabled={busy || system || draft.id.startsWith("local-")}
                    onClick={() =>
                      void act(async () => {
                        await request("/api/label-studio", {
                          action: "archive-template",
                          templateId: draft.id,
                        });
                        setTemplates((all) =>
                          all.filter((t) => t.id !== draft.id),
                        );
                        setDraft(templates[0]);
                      })
                    }
                  >
                    Archive
                  </button>
                </div>
              )}
              {system && (
                <small>
                  System presets remain available. Duplicate to save an
                  organization template.
                </small>
              )}
            </>
          )}
        </aside>
        <main>
          <section>
            <div className="label-toolbar">
              <h2>Physical preview</h2>
              <label>
                Zoom
                <select
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                >
                  {[1, 1.5, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n * 100}%
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {draft?.width} × {draft?.height} {draft?.unit} ·{" "}
                {draft?.orientation}
              </span>
            </div>
            <div className="label-preview-scroll">
              {preview && firstKey ? (
                <iframe
                  title="Actual label preview"
                  sandbox=""
                  srcDoc={preview}
                  style={{
                    width:
                      draft?.orientation === "portrait" ? shortSide : longSide,
                    height:
                      draft?.orientation === "portrait" ? longSide : shortSide,
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                  }}
                />
              ) : (
                <p>Add inventory to preview the actual renderer.</p>
              )}
            </div>
          </section>
          <section>
            <div className="label-toolbar">
              <h2>Print queue</h2>
              <strong>{count} labels</strong>
              <button
                disabled={busy || !queue.length}
                onClick={() => void refresh()}
              >
                Refresh prices / identities
              </button>
              <button onClick={() => setQueue([])}>Clear</button>
            </div>
            <div className="label-toolbar">
              <span>Copies per position</span>
              <button
                onClick={() =>
                  setQueue((rows) => rows.map((row) => ({ ...row, copies: 1 })))
                }
              >
                1 label
              </button>
              <button
                onClick={() =>
                  setQueue((rows) =>
                    rows.map((row) => ({
                      ...row,
                      copies: Math.min(1000, row.target.quantity),
                    })),
                  )
                }
              >
                Inventory quantity
              </button>
            </div>
            <div className="label-queue">
              {queue.map((row, index) => (
                <article key={`${row.target.key}:${index}`}>
                  <div>
                    <strong>{row.target.name}</strong>
                    <small>
                      {[
                        row.target.set,
                        row.target.number,
                        row.target.condition,
                        row.target.finish,
                        row.target.language,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                    <small>
                      {row.target.location} · {row.target.batch} ·{" "}
                      {row.target.sku ?? "Resolve identity before printing"}
                    </small>
                    <small>
                      {row.target.price === null
                        ? "Price unset"
                        : `$${Number(row.target.price).toFixed(2)}`}
                    </small>
                  </div>
                  <div className="label-copies">
                    <button
                      aria-label={`Decrease ${row.target.name}`}
                      onClick={() =>
                        setQueue((rows) =>
                          rows.map((r, i) =>
                            i === index
                              ? { ...r, copies: Math.max(1, r.copies - 1) }
                              : r,
                          ),
                        )
                      }
                    >
                      −
                    </button>
                    <input
                      aria-label={`Copies ${row.target.name}`}
                      type="number"
                      min="1"
                      max="1000"
                      value={row.copies}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n > 0 && n <= 1000)
                          setQueue((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, copies: n } : r,
                            ),
                          );
                      }}
                    />
                    <button
                      aria-label={`Increase ${row.target.name}`}
                      onClick={() =>
                        setQueue((rows) =>
                          rows.map((r, i) =>
                            i === index
                              ? { ...r, copies: Math.min(1000, r.copies + 1) }
                              : r,
                          ),
                        )
                      }
                    >
                      +
                    </button>
                    <button
                      onClick={() => setQueue((rows) => [...rows, { ...row }])}
                    >
                      Duplicate
                    </button>
                    <button
                      disabled={!row.target.sku}
                      onClick={() =>
                        void act(async () => {
                          await navigator.clipboard.writeText(row.target.sku!);
                          setMessage("Barcode copied.");
                        })
                      }
                    >
                      Copy barcode
                    </button>
                    <button
                      onClick={() =>
                        setQueue((rows) => rows.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <p className="label-note">
              Copies share the same position barcode. Each sale decrements that
              position. POS uses current prices.
            </p>
            <div className="label-actions">
              <button
                className="label-primary"
                disabled={busy || !count || !payload?.capabilities.canPrint}
                onClick={() => void print()}
              >
                Prepare {count} labels
              </button>
              <button
                disabled={busy || !payload?.capabilities.canPrint}
                onClick={() => void print(true)}
              >
                Print Test Label
              </button>
            </div>
          </section>
          <section>
            <h2>Find inventory / recent additions</h2>
            <button
              onClick={() =>
                void act(async () => {
                  setItems(
                    await request<LabelTarget[]>(
                      "/api/label-studio/targets?kind=location",
                    ),
                  );
                  setDraft(retailPresets(payload!.workspaceId)[4]);
                })
              }
            >
              Storage / location labels
            </button>
            <form
              className="label-toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () =>
                  setItems(
                    await request<LabelTarget[]>(
                      `/api/label-studio/targets?query=${encodeURIComponent(query)}`,
                    ),
                  ),
                );
              }}
            >
              <input
                aria-label="Find inventory for labels"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, SKU, location or batch"
              />
              <button disabled={busy}>Search / refresh</button>
              <button type="button" onClick={() => items.forEach(add)}>
                Add results
              </button>
            </form>
            <div className="label-results">
              {items.map((item) => (
                <button key={item.key} onClick={() => add(item)}>
                  <strong>{item.name}</strong>
                  <small>
                    {[
                      item.set,
                      item.number,
                      item.condition,
                      item.finish,
                      item.language,
                      item.location,
                      item.batch,
                    ]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · {item.quantity} copies
                  </small>
                  <span>Add to queue +</span>
                </button>
              ))}
            </div>
          </section>
          {payload?.capabilities.canManageTemplates && (
            <section>
              <h2>Assign external barcode</h2>
              <p>
                Aliases retain their original target. Refresh queue identities
                before assigning.
              </p>
              <div className="label-toolbar">
                <select
                  aria-label="Barcode target"
                  value={aliasTarget}
                  onChange={(e) => setAliasTarget(e.target.value)}
                >
                  <option value="">Choose target</option>
                  {queue
                    .filter((row) => row.target.identityId)
                    .map((row, i) => (
                      <option key={i} value={row.target.identityId!}>
                        {row.target.name} · {row.target.sku}
                      </option>
                    ))}
                </select>
                <input
                  aria-label="External barcode"
                  maxLength={160}
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
                <button
                  disabled={busy || !aliasTarget || !alias}
                  onClick={() =>
                    void act(async () => {
                      await request("/api/label-studio/aliases", {
                        identityId: aliasTarget,
                        value: alias,
                        type: /^\d{8,13}$/.test(alias) ? "upc_ean" : "external",
                      });
                      setMessage(
                        "Barcode alias assigned. It now resolves through POS.",
                      );
                    })
                  }
                >
                  Assign barcode
                </button>
              </div>
            </section>
          )}
          {!!payload?.priceReviews?.length && (
            <section>
              <h2>Price review</h2>
              {payload.priceReviews.map((review) => (
                <p key={review.id}>
                  {review.inventory_item_id}:{" "}
                  {String(review.current_asking_price)} →{" "}
                  {String(review.proposed_asking_price)}{" "}
                  {(["approve", "dismiss"] as const).map((decision) => (
                    <button
                      key={decision}
                      disabled={busy || !payload.capabilities.canReprice}
                      onClick={() =>
                        void act(async () => {
                          await request("/api/label-studio", {
                            action: "review-price",
                            reviewId: review.id,
                            decision,
                          });
                          setPayload({
                            ...payload,
                            priceReviews: payload.priceReviews.filter(
                              (r) => r.id !== review.id,
                            ),
                          });
                          setMessage(
                            decision === "approve"
                              ? "Price updated. Refresh the queue before reprinting."
                              : "Price suggestion dismissed.",
                          );
                        })
                      }
                    >
                      {decision === "approve"
                        ? "Approve price update"
                        : "Dismiss"}
                    </button>
                  ))}
                </p>
              ))}
            </section>
          )}
          <details>
            <summary>Printer settings & help</summary>
            <p>
              Use 100% scale, margins None, headers/footers Off, exact media
              dimensions, and matching orientation. Configure your printer
              through the operating system. Test one label before a large job.
            </p>
            <p>
              For price reprints, search by name, location or batch, add
              results, and refresh prices. Narrow stock may require QR/text-only
              output. Browser output cannot certify physical alignment or scan
              quality.
            </p>
          </details>
        </main>
      </div>
    </section>
  );
}
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="label-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
