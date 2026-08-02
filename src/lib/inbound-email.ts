import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const INBOUND_DOMAIN = "inbound.tradingdocks.com";
export const MAX_INBOUND_EMAIL_BYTES = 2_000_000;

export type ParsedInboundEmail = {
  messageId: string | null;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  text: string;
  marketplaceId: string | null;
  externalOrderId: string | null;
  total: number | null;
  eventType: "order" | "shipment" | "cancellation" | "refund" | "verification" | "unknown";
};

function headerValue(headers: Map<string, string>, key: string) {
  return headers.get(key.toLowerCase())?.trim() ?? "";
}

function decodeQuotedPrintable(value: string) {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function readableBody(rawBody: string, contentTransferEncoding: string) {
  if (/base64/i.test(contentTransferEncoding)) {
    try { return Buffer.from(rawBody.replace(/\s/g, ""), "base64").toString("utf8"); } catch { return rawBody; }
  }
  return /quoted-printable/i.test(contentTransferEncoding) ? decodeQuotedPrintable(rawBody) : rawBody;
}

export function parseInboundEmail(raw: string): ParsedInboundEmail {
  const splitAt = raw.search(/\r?\n\r?\n/);
  const rawHeaders = splitAt >= 0 ? raw.slice(0, splitAt) : raw;
  const rawBody = splitAt >= 0 ? raw.slice(splitAt).replace(/^\r?\n\r?\n/, "") : "";
  const unfolded = rawHeaders.replace(/\r?\n[\t ]+/g, " ");
  const headers = new Map<string, string>();
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon > 0) headers.set(line.slice(0, colon).toLowerCase(), line.slice(colon + 1));
  }

  const subject = headerValue(headers, "subject");
  const from = headerValue(headers, "from");
  const to = headerValue(headers, "to");
  const text = readableBody(rawBody, headerValue(headers, "content-transfer-encoding"))
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100_000);
  const haystack = `${from} ${subject} ${text.slice(0, 20_000)}`;
  const marketplaceId = /tcgplayer/i.test(haystack) ? "tcgplayer"
    : /ebay/i.test(haystack) ? "ebay"
      : /shopify/i.test(haystack) ? "shopify"
        : /whatnot/i.test(haystack) ? "whatnot"
          : /cardsphere/i.test(haystack) ? "cardsphere"
            : /cardtrader/i.test(haystack) ? "cardtrader"
              : /etsy/i.test(haystack) ? "etsy" : null;
  const eventType = /confirm|verification|verify/i.test(subject) ? "verification"
    : /refund/i.test(subject) ? "refund"
      : /cancel/i.test(subject) ? "cancellation"
        : /ship|tracking/i.test(subject) ? "shipment"
          : /order|sold|sale/i.test(subject) ? "order" : "unknown";
  const orderMatch = haystack.match(/(?:order(?:\s+(?:number|no\.?|#))?|order)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})/i);
  const totalMatch = haystack.match(/(?:order\s+total|total)\s*[:\s]*\$\s*([0-9,]+(?:\.\d{2})?)/i);

  return {
    messageId: headerValue(headers, "message-id") || null,
    subject: subject.slice(0, 500),
    from: from.slice(0, 500),
    to: to.slice(0, 500),
    date: headerValue(headers, "date") || null,
    text,
    marketplaceId,
    externalOrderId: orderMatch?.[1] ?? null,
    total: totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : null,
    eventType,
  };
}

export function sha256Hex(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validInboundSignature(secret: string, timestamp: string, recipient: string, bodyHash: string, supplied: string) {
  const expected = createHmac("sha256", secret).update(`${timestamp}.${recipient}.${bodyHash}`).digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const suppliedBytes = Buffer.from(supplied, "hex");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
