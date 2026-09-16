import { ChaosSortBatchLabel, escapeLabelText, type ChaosSortLabelData } from "./batch-label.ts";
import { resolveLabelMedia } from "./label-media.ts";

// This document deliberately does not use app/layout.tsx, DashboardLayout or global print rules.
export function renderChaosSortPrintDocument(data: ChaosSortLabelData, requestUrl: string) {
  const url = new URL(requestUrl);
  const media = resolveLabelMedia(url.searchParams);
  const backPath = `/dashboard/inventory/batches/${encodeURIComponent(data.id)}`;
  const batchUrl = new URL(backPath, url.origin).href;
  const preview = url.searchParams.get("preview") === "1";
  const autoPrint = !preview && url.searchParams.get("autoprint") === "1";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeLabelText(data.batch_code)} · One Chaos Sort label</title><style>
@page { size: ${media.width}mm ${media.height}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #edf0f4; color: #172334; font-family: Arial, sans-serif; }
.print-controls { max-width: 640px; margin: 24px auto; padding: 0 20px; font-size: 14px; line-height: 1.6; }
.print-controls h1 { font-size: 20px; }.print-controls button { padding: 10px 16px; cursor: pointer; }.print-controls a { color: inherit; margin-left: 16px; }
.chaos-sort-label-print-root { width: ${media.width}mm; height: ${media.height}mm; margin: 20px auto; padding: 0; background: #fff; color: #000; line-height: 0; overflow: hidden; box-shadow: 0 2px 12px #0002; }
.chaos-sort-label-print-root > svg { display: block; width: 100%; height: 100%; }
body[data-preview="true"] { background: #fff; overflow: hidden; }
body[data-preview="true"] .print-controls { display: none; }
body[data-preview="true"] .chaos-sort-label-print-root { width: 100vw; height: 100vh; margin: 0; box-shadow: none; }
@media print {
  html, body { width: ${media.width}mm !important; height: ${media.height}mm !important; min-width: 0 !important; min-height: 0 !important; max-height: ${media.height}mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #fff !important; }
  body > :not(.chaos-sort-label-print-root) { display: none !important; }
  .chaos-sort-label-print-root { display: block !important; position: static !important; width: ${media.width}mm !important; height: ${media.height}mm !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; overflow: hidden !important; break-inside: avoid; page-break-inside: avoid; break-after: auto; }
}
</style></head><body data-preview="${preview}">
<header class="print-controls"><h1>Print one batch label</h1><p>${escapeLabelText(data.batch_code)} · ${media.width} × ${media.height} mm · 1 label</p><p>Select matching paper in your printer settings, 100% scale, and one copy. Turn off browser headers and footers.</p><button id="print-label" type="button" disabled>Preparing label…</button><a href="${escapeLabelText(backPath)}">Back to batch</a><p id="print-status" role="status">Preparing the QR code and label.</p></header>
${ChaosSortBatchLabel(data, media, batchUrl)}
<script>
(() => {
  const button = document.getElementById('print-label');
  const status = document.getElementById('print-status');
  let automaticPrintStarted = false;
  let printing = false;
  let ready = false;
  async function prepare() {
    try {
      if (document.fonts) await document.fonts.ready;
      await Promise.all(Array.from(document.images, image => image.decode()));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      ready = true;
      document.documentElement.dataset.labelReady = 'true';
      button.disabled = false; button.textContent = 'Print one label';
      status.textContent = 'One label ready. Printing does not include your batch contents.';
      if (${autoPrint} && !automaticPrintStarted) { automaticPrintStarted = true; printLabel(); }
    } catch { status.textContent = 'The label could not finish loading. Reload before printing.'; }
  }
  function printLabel() {
    if (!ready || printing) return;
    printing = true; button.disabled = true;
    try { window.print(); } finally { printing = false; button.disabled = false; }
  }
  button.addEventListener('click', printLabel);
  if (document.readyState === 'complete') void prepare();
  else window.addEventListener('load', prepare, { once: true });
})();
</script></body></html>`;
}
