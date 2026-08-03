import { createHash } from "node:crypto";

export type ParsedEmailItem = {
  lineId: string;
  title: string;
  quantity: number;
  unitPrice: number | null;
  condition: string | null;
  finish: string | null;
  language: string | null;
  raw: string;
};

export type ParsedTcgplayerOrder = {
  externalOrderId: string;
  buyerAlias: string | null;
  orderedAt: string;
  subtotal: number | null;
  shipping: number | null;
  tax: number | null;
  total: number | null;
  items: ParsedEmailItem[];
  confidence: number;
  warnings: string[];
  text: string;
};

function unfoldHeaders(raw: string) {
  return raw.replace(/\r?\n[ \t]+/g, " ");
}

function header(raw: string, name: string) {
  const match = unfoldHeaders(raw).match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}

function decodeQuotedPrintable(input: string) {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

function decodeEncodedWord(value: string | null) {
  if (!value) return null;
  return value.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_all, _charset, mode, data) => {
    try {
      return mode.toUpperCase() === "B"
        ? Buffer.from(data, "base64").toString("utf8")
        : decodeQuotedPrintable(data.replace(/_/g, " "));
    } catch {
      return data;
    }
  });
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/?(?:tr|div|p|li|h\d|table|section|article)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function decodeMimeParts(raw: string) {
  const pieces: string[] = [];
  const boundary = header(raw, "Content-Type")?.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)?.slice(1).find(Boolean);
  const parts = boundary ? raw.split(`--${boundary}`) : [raw];

  for (const part of parts) {
    const split = part.search(/\r?\n\r?\n/);
    if (split < 0) continue;
    const partHeaders = part.slice(0, split);
    let body = part.slice(split).replace(/^\r?\n\r?\n/, "").trim();
    const contentType = header(partHeaders, "Content-Type")?.toLowerCase() ?? "";
    const encoding = header(partHeaders, "Content-Transfer-Encoding")?.toLowerCase() ?? "";

    try {
      if (encoding.includes("base64")) body = Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8");
      else if (encoding.includes("quoted-printable")) body = decodeQuotedPrintable(body);
    } catch {
      // Keep the original body for review rather than dropping the message.
    }

    if (contentType.includes("text/html")) pieces.push(stripHtml(body));
    else if (contentType.includes("text/plain") || !contentType) pieces.push(body);
  }

  const fallbackBody = raw.slice(raw.search(/\r?\n\r?\n/) + 2);
  return [...pieces, stripHtml(fallbackBody)]
    .join("\n")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function money(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function parseItems(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const items: ParsedEmailItem[] = [];
  const seen = new Set<string>();

  const add = (title: string, quantity: number, unitPrice: number | null, raw: string) => {
    title = title.replace(/^[-•*\s]+/, "").replace(/\s{2,}/g, " ").trim();
    if (title.length < 2 || /subtotal|shipping|tax|total|order number|buyer|address/i.test(title)) return;
    const key = `${title.toLowerCase()}|${quantity}|${unitPrice ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    const condition = firstMatch(raw, [/(?:condition|cond\.?)[\s:|-]+(near mint|lightly played|moderately played|heavily played|damaged|nm|lp|mp|hp)/i]);
    const finish = firstMatch(raw, [/(?:finish|printing)[\s:|-]+(foil|non-foil|etched|normal)/i]);
    const language = firstMatch(raw, [/(?:language)[\s:|-]+([a-z][a-z ]{2,18})/i]);
    items.push({
      lineId: createHash("sha256").update(key).digest("hex").slice(0, 24),
      title,
      quantity: Math.max(1, Math.min(999, quantity)),
      unitPrice,
      condition,
      finish,
      language,
      raw,
    });
  };

  for (const line of lines) {
    let match = line.match(/^(\d{1,3})\s*[x×]\s*(.+?)\s+(?:@\s*)?\$([\d,]+(?:\.\d{2})?)(?:\s+each)?$/i);
    if (match) { add(match[2], Number(match[1]), money(match[3]), line); continue; }
    match = line.match(/^(.+?)\s+[x×]\s*(\d{1,3})\s+(?:@\s*)?\$([\d,]+(?:\.\d{2})?)/i);
    if (match) { add(match[1], Number(match[2]), money(match[3]), line); continue; }
    match = line.match(/^(\d{1,3})\s+(.+?)\s+\$([\d,]+(?:\.\d{2})?)$/i);
    if (match && !/^\d{4}/.test(match[2])) { add(match[2], Number(match[1]), money(match[3]), line); continue; }
    match = line.match(/^(.+?)\s+Qty(?:uantity)?[:\s]+(\d{1,3}).*?(?:Price|Each)[:\s]+\$([\d,]+(?:\.\d{2})?)/i);
    if (match) add(match[1], Number(match[2]), money(match[3]), line);
  }

  return items.slice(0, 250);
}

export function parseTcgplayerOrder(raw: string): ParsedTcgplayerOrder | null {
  const subject = decodeEncodedWord(header(raw, "Subject")) ?? "";
  const text = decodeMimeParts(raw);
  const combined = `${subject}\n${text}`;
  if (!/tcgplayer/i.test(combined) || !/(sold|order|sale)/i.test(combined)) return null;

  const externalOrderId = firstMatch(combined, [
    /(?:TCGplayer\s*)?(?:order|order number|order id)\s*(?:#|:|-)?\s*([A-Z0-9][A-Z0-9-]{4,40})/i,
    /(?:transaction|invoice)\s*(?:#|:|-)?\s*([A-Z0-9][A-Z0-9-]{4,40})/i,
    /\/orders?\/([A-Z0-9-]{5,40})/i,
  ]);
  if (!externalOrderId) return null;

  const buyerAlias = firstMatch(combined, [
    /(?:buyer|customer|sold to)\s*(?:name)?\s*[:|-]\s*([^\n]{2,100})/i,
    /ship to\s*[:|-]\s*([^\n]{2,100})/i,
  ]);
  const subtotal = money(firstMatch(combined, [/subtotal\s*[:|-]?\s*\$([\d,]+(?:\.\d{2})?)/i] ) ?? undefined);
  const shipping = money(firstMatch(combined, [/(?:shipping|shipping fee)\s*[:|-]?\s*\$([\d,]+(?:\.\d{2})?)/i]) ?? undefined);
  const tax = money(firstMatch(combined, [/(?:sales tax|tax)\s*[:|-]?\s*\$([\d,]+(?:\.\d{2})?)/i]) ?? undefined);
  const total = money(firstMatch(combined, [/(?:order total|grand total|total)\s*[:|-]?\s*\$([\d,]+(?:\.\d{2})?)/i]) ?? undefined);
  const dateValue = firstMatch(combined, [
    /(?:order date|date ordered|sold on)\s*[:|-]\s*([^\n]{5,60})/i,
    /^Date:\s*(.+)$/im,
  ]);
  const date = dateValue ? new Date(dateValue) : new Date();
  const items = parseItems(text);
  const warnings: string[] = [];
  if (!items.length) warnings.push("No line items were confidently extracted.");
  if (total == null) warnings.push("Order total was not found.");
  if (!buyerAlias) warnings.push("Buyer name was not found.");
  const confidence = Math.max(0, Math.min(1,
    0.48 + (items.length ? 0.25 : 0) + (total != null ? 0.12 : 0) + (buyerAlias ? 0.08 : 0) + (dateValue ? 0.07 : 0),
  ));

  return {
    externalOrderId,
    buyerAlias,
    orderedAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
    subtotal,
    shipping,
    tax,
    total: total ?? (subtotal != null ? subtotal + (shipping ?? 0) + (tax ?? 0) : null),
    items,
    confidence,
    warnings,
    text,
  };
}
