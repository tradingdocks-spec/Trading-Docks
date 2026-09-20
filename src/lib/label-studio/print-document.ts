import bwip from "bwip-js/node";
import QRCode from "qrcode";
import {
  validateLabelTemplate,
  type LabelTemplate,
} from "./label-templates.ts";
import {
  DEFAULT_PRINT_SETTINGS,
  type PrintField,
  type LabelTarget,
  type PrintQueueEntry,
} from "./print-settings.ts";

const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function physicalSize(template: LabelTemplate) {
  const factor = template.unit === "in" ? 25.4 : 1;
  const sides = [template.width * factor, template.height * factor].sort(
    (a, b) => a - b,
  );
  return template.orientation === "portrait"
    ? { width: sides[0], height: sides[1] }
    : { width: sides[1], height: sides[0] };
}
export function code128(value: string, availableMm: number, barHeight = 8) {
  if (!/^[\x20-\x7e]{1,80}$/.test(value))
    throw new Error("A printable barcode identity is required.");
  const svg = bwip.toSVG({
    bcid: "code128",
    text: value,
    scale: 1,
    height: barHeight,
    paddingwidth: 10,
    backgroundcolor: "FFFFFF",
  });
  const modules = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1]);
  // Two 203-dpi dots per module, with ten-module quiet zones included by encoder.
  const dots = Math.max(
    2,
    Math.min(4, Math.floor(availableMm / modules / (25.4 / 203))),
  );
  const width = ((modules * 25.4) / 203) * dots;
  if (!Number.isFinite(width) || width > availableMm)
    throw new Error(
      `Code 128 needs ${(width + 4).toFixed(1)} mm label width. Choose wider stock or turn barcode off for a text/QR label.`,
    );
  return svg.replace(
    "<svg ",
    `<svg role="img" aria-label="${escape(value)}" width="${width}mm" height="${barHeight}mm" preserveAspectRatio="none" shape-rendering="crispEdges" `,
  );
}
export async function labelMarkup(
  template: LabelTemplate,
  target: LabelTarget,
) {
  const legacyFields = template.elements
    .map((element): PrintField | null => {
      if (element.type === "price")
        return template.priceField === "none" ? null : "price";
      if (element.type === "location") return "location";
      if (
        element.binding === "card.name" ||
        element.binding === "sealed.product_name"
      )
        return "name";
      if (
        element.binding === "card.set" ||
        element.binding === "card.collector_number"
      )
        return "printing";
      if (element.binding === "workspace.name") return "store";
      if (element.binding === "inventory.game") return "game";
      if (
        [
          "inventory.condition",
          "inventory.finish",
          "inventory.language",
          "inventory.variant",
        ].includes(element.binding ?? "")
      )
        return "details";
      return null;
    })
    .filter((field): field is PrintField => field !== null);
  const options = template.print ?? {
    ...DEFAULT_PRINT_SETTINGS,
    fields: [...new Set(legacyFields)],
  };
  const { width, height } = physicalSize(template);
  const inset = options.border ? 4.4 : 4;
  const barcodeValue = options.useUpc && target.upc ? target.upc : target.sku;
  const barHeight = height >= 70 ? 18 : height >= 45 ? 12 : 8;
  const barcode = template.barcodeEnabled
    ? code128(barcodeValue ?? "", width - inset, barHeight)
    : "";
  const footerMm =
    (barcode ? barHeight : 0) +
    (options.humanReadable && target.sku ? 3 : 0) +
    (template.qrEnabled ? 12 : 0);
  if (height < footerMm + inset + 4)
    throw new Error(
      "This label is too short for the selected barcode/QR. Increase height or remove QR.",
    );
  const values: Record<string, string> = {
    name: target.name,
    printing: [target.set, target.number].filter(Boolean).join(" "),
    details: [target.condition, target.language, target.finish]
      .filter(Boolean)
      .join(" · "),
    price:
      target.price === null
        ? ""
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(Number(target.price)),
    location: target.location,
    batch: target.batch ?? "",
    store: options.storeName,
    game: target.game ?? "",
  };
  const qr =
    template.qrEnabled && target.sku
      ? await QRCode.toString(target.sku, {
          type: "svg",
          margin: 4,
          errorCorrectionLevel: "M",
        })
      : "";
  const fields = options.fields.filter((field) => values[field]);
  const contentMm = height - footerMm - inset;
  const lineMm = (pt: number) => ((pt * 25.4) / 72) * 1.12;
  let fontPt = options.fontPt;
  const usedMm = () =>
    fields.reduce(
      (n, f) =>
        n +
        (f === "price" && options.priceEmphasis
          ? ((18 * 25.4) / 72) * 1.05
          : lineMm(fontPt)),
      0,
    );
  while (fontPt > 6 && usedMm() > contentMm) fontPt = Math.max(6, fontPt - 0.5);
  // Drop low-priority text before compromising bars, name or current price.
  for (const optional of [
    "store",
    "game",
    "batch",
    "location",
    "details",
    "printing",
  ]) {
    if (usedMm() <= contentMm) break;
    const i = fields.indexOf(optional as (typeof fields)[number]);
    if (i >= 0) fields.splice(i, 1);
  }
  if (usedMm() > contentMm)
    throw new Error(
      "Required name/price content does not fit. Use a larger label or disable price emphasis.",
    );
  return `<article class="label" data-label="${escape(target.key)}" style="width:${width}mm;height:${height}mm;border:${options.border ? "0.2mm solid black" : "0"};font-size:${options.fontPt}pt">
    <div class="content" style="height:${contentMm}mm;font-size:${fontPt}pt">${fields.map((field) => `<div class="field ${field}${field === "price" && options.priceEmphasis ? " emphasis" : ""}">${escape(values[field])}</div>`).join("")}</div>
    <div class="symbols">${qr ? `<div class="qr">${qr}</div>` : ""}${barcode}${options.humanReadable && target.sku ? `<div class="human">${escape(barcodeValue !== target.sku ? `${barcodeValue} · ${target.sku}` : target.sku)}</div>` : ""}</div></article>`;
}
export async function buildLabelDocument(
  template: LabelTemplate,
  queue: PrintQueueEntry[],
  preview = false,
) {
  if (!validateLabelTemplate(template).ok)
    throw new Error("Invalid label template.");
  if (
    !queue.length ||
    queue.length > 500 ||
    queue.some(
      (row) =>
        !Number.isInteger(row.copies) || row.copies < 1 || row.copies > 1000,
    )
  )
    throw new Error("Choose 1–1000 copies per queue row.");
  const count = queue.reduce((n, row) => n + row.copies, 0);
  if (count > 10000)
    throw new Error(
      "Split this print job into batches of at most 10,000 labels.",
    );
  const size = physicalSize(template);
  const options = template.print ?? DEFAULT_PRINT_SETTINGS;
  const sheet = options.mode === "sheet" && !preview;
  const s = options.sheet;
  if (
    sheet &&
    (s.columns * size.width + (s.columns - 1) * s.gapX + 2 * s.margin >
      s.width + 0.001 ||
      s.rows * size.height + (s.rows - 1) * s.gapY + 2 * s.margin >
        s.height + 0.001)
  )
    throw new Error(
      "The labels, margins and gaps do not fit this sheet. Reduce rows/columns or label size.",
    );
  const markup = await Promise.all(
    queue.map((row) => labelMarkup(template, row.target)),
  );
  const labels = preview
    ? [markup[0]]
    : queue.flatMap((row, i) =>
        Array.from({ length: row.copies }, () => markup[i]),
      );
  const perPage = sheet ? s.rows * s.columns : 1;
  const pages: string[] = [];
  for (let i = 0; i < labels.length; i += perPage)
    pages.push(
      `<section class="page">${labels.slice(i, i + perPage).join("")}</section>`,
    );
  const width = sheet ? s.width : size.width;
  const height = sheet ? s.height : size.height;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Trading Docks labels</title><style>
    @page{size:${width}mm ${height}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white;color:black;font-family:Arial,sans-serif}
    .page{width:${width}mm;height:${height}mm;overflow:hidden;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always;${sheet ? `display:grid;grid-template-columns:repeat(${s.columns},${size.width}mm);grid-template-rows:repeat(${s.rows},${size.height}mm);gap:${s.gapY}mm ${s.gapX}mm;padding:${s.margin}mm;` : ""}}
    .page:last-child{break-after:auto;page-break-after:auto}.label{padding:2mm;overflow:hidden;display:flex;flex-direction:column;break-inside:avoid;background:white;color:black}
    .content{overflow:hidden;flex-shrink:0;display:flex;flex-direction:column;justify-content:flex-start;line-height:1.12}.field{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;max-width:100%}.name{font-weight:700}.price{font-weight:700}.emphasis{font-size:18pt;line-height:1.05}.symbols{margin-top:auto;flex-shrink:0;display:flex;align-items:center;flex-direction:column}.symbols>svg{display:block;flex-shrink:0}.human{height:3mm;font:6pt monospace;text-align:center;white-space:nowrap}.qr{width:12mm;height:12mm}.qr svg{width:100%;height:100%;display:block}
    .controls{padding:12px;font:14px Arial;background:#eee}.controls button{padding:8px}.controls p{margin:6px 0}@media print{.controls{display:none!important}html,body{width:${width}mm} .page{margin:0}}
    </style></head><body>${preview ? "" : `<div class="controls"><button onclick="window.print()">Print ${count} labels</button><p>100% scale · No margins · Headers/footers off · ${width.toFixed(2)} × ${height.toFixed(2)} mm · Match printer media and orientation.</p><p>Opening the dialog does not confirm physical printing.</p></div>`}${pages.join("")}</body></html>`;
}
