import QRCode from "qrcode";
import type { ChaosSortLabelMedia } from "./label-media.ts";

export type ChaosSortLabelData = {
  id: string;
  batch_code: string;
  session_id: string | null;
  session_code: string | null;
  destination_label: string | null;
  current_quantity: number;
  initial_quantity: number;
  created_at: string;
  completed_at?: string | null;
  physical_card_count?: number | null;
};

export function escapeLabelText(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function lines(value: string, length: number, limit: number) {
  const result: string[] = [];
  let rest = value.replace(/\s+/g, " ").trim();
  while (rest && result.length < limit) {
    let end = Math.min(rest.length, length);
    const space = rest.lastIndexOf(" ", end);
    if (end < rest.length && space > length / 2) end = space;
    result.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) result[result.length - 1] = `${result[result.length - 1].slice(0, -1)}…`;
  return result;
}

/** Single static document component. No dashboard, item collection, duplicate preview or React hydration. */
export function renderChaosSortLabelSvg(data: ChaosSortLabelData, media: ChaosSortLabelMedia, batchUrl: string): string {
  const wide = media.width > media.height;
  const viewWidth = wide ? 700 : 290;
  const textX = wide ? 275 : 20;
  const textWidth = wide ? 400 : 250;
  let y = 28;
  const fragments: string[] = [];
  function text(value: string, size: number, limit = 2, bold = false) {
    const wrapped = lines(value, Math.max(1, Math.floor(textWidth / (size * 0.62))), limit);
    for (const line of wrapped) { fragments.push(`<text x="${textX}" y="${y}" font-size="${size}" font-weight="${bold ? 700 : 400}">${escapeLabelText(line)}</text>`); y += size * 1.25; }
  }
  // A monochrome TD mark and the publisher name stay crisp on thermal stock.
  fragments.push(`<rect x="${textX}" y="8" width="27" height="27" rx="3" fill="none" stroke="#000" stroke-width="2"/><text x="${textX + 3}" y="27" font-size="16" font-weight="700">TD</text><text x="${textX + 36}" y="28" font-size="20" font-weight="700">Trading Docks</text>`);
  y = 66;
  text(data.batch_code, 25, 3, true);
  y += 10;
  const qr = QRCode.create(batchUrl, { errorCorrectionLevel: "M" });
  const qrSize = qr.modules.size + 8;
  let path = "";
  for (let row = 0; row < qr.modules.size; row++) for (let column = 0; column < qr.modules.size; column++) {
    if (qr.modules.get(row, column)) path += `M${column + 4} ${row + 4}h1v1h-1z`;
  }
  const qrY = wide ? 25 : y;
  fragments.push(`<svg x="${wide ? 20 : 35}" y="${qrY}" width="220" height="220" viewBox="0 0 ${qrSize} ${qrSize}" aria-label="QR code for ${escapeLabelText(data.batch_code)}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`);
  if (!wide) y += 246;
  text(data.destination_label || "Location unassigned", 23, 3, true);
  y += 8;
  const quantity = (value: number) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  text(`Physical cards: ${quantity(data.physical_card_count ?? data.initial_quantity)}`, 23, 2, true);
  text(`${quantity(data.current_quantity)} / ${quantity(data.initial_quantity)} cards remaining`, 16, 2);
  y += 12;
  text(`Session: ${data.session_code || data.session_id || "Unassigned"}`, 17, 3);
  y += 8;
  text(`Batch ID: ${data.id}`, 15, 3);
  const date = new Date(data.created_at);
  if (Number.isFinite(date.getTime())) { y += 10; text(`Created ${date.toISOString().slice(0, 10)} UTC`, 16, 1); }
  if (data.completed_at) { const committed = new Date(data.completed_at); if (Number.isFinite(committed.getTime())) { y += 8; text(`Committed ${committed.toISOString().replace('T', ' ').replace('.000Z', ' UTC')}`, 15, 3); } }
  const align = media.position === "bottom" ? "YMax" : media.position === "center" ? "YMid" : "YMin";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewWidth} ${Math.ceil(Math.max(y + 20, wide ? 275 : 0))}" preserveAspectRatio="xMid${align} meet" role="img" aria-label="Chaos Sort batch label ${escapeLabelText(data.batch_code)}" font-family="Arial, sans-serif" fill="#000">${fragments.join("")}</svg>`;
}

export function ChaosSortBatchLabel(data: ChaosSortLabelData, media: ChaosSortLabelMedia, batchUrl: string): string {
  return `<main class="chaos-sort-label-print-root" aria-label="One label for ${escapeLabelText(data.batch_code)}" data-batch-id="${escapeLabelText(data.id)}">${renderChaosSortLabelSvg(data, media, batchUrl)}</main>`;
}
