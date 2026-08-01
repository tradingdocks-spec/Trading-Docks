export type ParsedTcgplayerItem = {
  lineId: string;
  title: string;
  quantity: number;
  unitPrice: number | null;
  condition: string | null;
  language: string | null;
  finish: string | null;
};

export type ParsedTcgplayerOrder = {
  orderId: string;
  buyer: string | null;
  orderedAt: string | null;
  subtotal: number | null;
  shipping: number | null;
  tax: number | null;
  total: number | null;
  items: ParsedTcgplayerItem[];
};

function decodeQuotedPrintable(value: string) {
  return value.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function readableMessage(raw: string) {
  return decodeQuotedPrintable(raw)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/tr>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ");
}

function first(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1]?.trim();
    if (value) return value;
  }
  return null;
}

function amount(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseTcgplayerOrderEmail(raw: string): ParsedTcgplayerOrder | null {
  const text = readableMessage(raw);
  if (!/tcgplayer/i.test(text) || !/(new order|order (?:number|#|id)|you (?:made a sale|have a new order))/i.test(text)) return null;

  const orderId = first(text, [
    /(?:TCGplayer\s+)?Order\s*(?:Number|#|ID)\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
    /Order\s+([A-Z0-9]{3,}-[A-Z0-9-]{3,})/i,
  ]);
  if (!orderId) return null;

  const buyer = first(text, [/(?:Buyer|Customer|Sold\s+to)\s*:\s*([^\n|]{2,80})/i]);
  const orderedAt = dateValue(first(text, [/(?:Order Date|Date Ordered|Placed)\s*:\s*([^\n|]{5,80})/i]));
  const subtotal = amount(first(text, [/Subtotal\s*:?\s*(\$?[\d,]+\.\d{2})/i]));
  const shipping = amount(first(text, [/(?:Shipping|Shipping Total)\s*:?\s*(\$?[\d,]+\.\d{2})/i]));
  const tax = amount(first(text, [/(?:Tax|Sales Tax)\s*:?\s*(\$?[\d,]+\.\d{2})/i]));
  const total = amount(first(text, [/(?:Order Total|Total)\s*:?\s*(\$?[\d,]+\.\d{2})/i]));

  const items: ParsedTcgplayerItem[] = [];
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const itemPatterns = [
    /^(\d+)\s*[x×]\s+(.+?)\s+(?:\||-)\s*(?:\$)?([\d,]+\.\d{2})(?:\s+each)?$/i,
    /^(.+?)\s+(?:\||-)\s*(?:Qty|Quantity)\s*:?\s*(\d+)\s+(?:\||-)\s*(?:\$)?([\d,]+\.\d{2})/i,
  ];
  for (const line of lines) {
    let quantity: number | null = null; let title = ""; let price: number | null = null;
    const firstStyle = line.match(itemPatterns[0]);
    const secondStyle = line.match(itemPatterns[1]);
    if (firstStyle) { quantity = Number(firstStyle[1]); title = firstStyle[2].trim(); price = amount(firstStyle[3]); }
    else if (secondStyle) { title = secondStyle[1].trim(); quantity = Number(secondStyle[2]); price = amount(secondStyle[3]); }
    if (!quantity || !title || /subtotal|shipping|tax|total/i.test(title)) continue;
    const condition = first(title, [/\b(Near Mint|Lightly Played|Moderately Played|Heavily Played|Damaged|NM|LP|MP|HP|DMG)\b/i]);
    const language = first(title, [/\b(English|Japanese|French|German|Italian|Spanish|Portuguese|Korean|Russian|Chinese)\b/i]);
    const finish = first(title, [/\b(Non-?Foil|Foil|Etched|Textured)\b/i]);
    items.push({ lineId: String(items.length + 1), title, quantity, unitPrice: price, condition, language, finish });
  }

  return { orderId, buyer, orderedAt, subtotal, shipping, tax, total, items };
}
