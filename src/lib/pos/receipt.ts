import { money, type Receipt } from "./domain.ts";
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export type ReceiptRefund = { total_minor: number; created_at: string };
/** Stable immutable sale view, with separately identified subsequent refunds. */
export function renderReceipt(r: Receipt, refunds: ReceiptRefund[] = []) {
  const settings = r.settings ?? {};
  const width = settings.receiptWidth === "58" ? 58 : 80;
  const letter = settings.receiptWidth === "Letter";
  const date = new Date(r.createdAt).toLocaleString("en-US", {
    timeZone: r.timezone ?? "America/Phoenix",
  });
  const register =
    settings.showLocation === false ? "" : ` · ${escape(r.register)}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Receipt ${escape(r.number)}</title><style>
@page{size:${letter ? "Letter" : `${width}mm 200mm`};margin:${letter ? "12mm" : "4mm"}}*{box-sizing:border-box}body{font:12px monospace;color:#111;background:white;margin:0 auto;width:${letter ? "180mm" : `${width - 8}mm`}}h1{font-size:18px;margin:8px 0}table{width:100%;table-layout:fixed;border-collapse:collapse}td{vertical-align:top;padding:6px 0;border-bottom:1px dashed #aaa;overflow-wrap:anywhere}td:last-child{width:25%;text-align:right}small{display:block}p{overflow-wrap:anywhere;margin:10px 0;white-space:pre-line}.total{font-size:18px;font-weight:bold}.controls{padding:12px 0}@media print{.controls{display:none}tr{break-inside:avoid}body{margin:0}.receipt{padding:0}}
</style><style id="paper-size"></style></head><body><div class="controls"><button id="print">Print receipt</button></div><main class="receipt"><h1>${escape(r.site)}</h1>${settings.address ? `<p>${escape(settings.address)}</p>` : ""}<p>Trading Docks${register}</p><p>${escape(r.number)}<br>${escape(date)} ${escape(r.timezone ?? "America/Phoenix")}</p>${settings.showEmployee !== false && r.employeeName ? `<p>Served by ${escape(r.employeeName)}</p>` : ""}<table><tbody>${r.lines.map((l) => `<tr><td>${escape(l.name)}<small>${escape([l.setCode, l.collectorNumber, l.condition, l.finish, l.language].filter(Boolean).join(" · "))}</small>${settings.showSku !== false && l.sku ? `<small>${escape(l.sku)}</small>` : ""}<small>${l.quantity} × ${money(l.unitPriceMinor)}</small>${l.discountMinor ? `<small>Discount −${money(l.discountMinor)}</small>` : ""}</td><td>${money(l.lineTotalMinor)}</td></tr>`).join("")}</tbody></table><p>Subtotal ${money(r.subtotalMinor)}<br>Discount −${money(r.discountMinor)}<br>Tax ${money(r.taxMinor)}</p><p class="total">Total ${money(r.totalMinor)}</p><p>Cash ${money(r.cashMinor)}<br>Change ${money(r.changeMinor)}</p>${refunds.length ? `<p>Subsequent cash refunds: ${money(refunds.reduce((n, f) => n + Number(f.total_minor), 0))}</p>` : ""}${settings.returnPolicy ? `<p>${escape(settings.returnPolicy)}</p>` : ""}<p>${escape(settings.footer ?? "Thank you for shopping with us.")}</p></main><script>
function fitPaper(){${letter ? "" : `const height=Math.ceil(document.querySelector('.receipt').getBoundingClientRect().height*25.4/96)+10;document.getElementById('paper-size').textContent='@page{size:${width}mm '+Math.max(40,height)+'mm;margin:4mm}';`}}
document.fonts.ready.then(fitPaper);window.addEventListener('beforeprint',fitPaper);document.getElementById('print').addEventListener('click',()=>{fitPaper();window.print()});
</script></body></html>`;
}
