import { verifyResendPayload } from "./email-delivery.ts";

export type NormalizedInboundEmail = {
  provider: "resend";
  providerMessageId: string;
  providerThreadId?: string;
  inReplyToProviderMessageId?: string;
  references?: string[];
  from: { email: string; name?: string };
  to: string[];
  cc?: string[];
  subject: string;
  text?: string;
  html?: string;
  receivedAt: string;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

export type InboundMatchCandidate = {
  id: string;
  conversationId?: string | null;
  providerMessageId?: string | null;
  providerThreadId?: string | null;
  normalizedEmail?: string | null;
  subject?: string | null;
  lastMessageAt?: string | null;
};

export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }

function address(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(.*)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (match) return { email: normalizeEmail(match[2]), name: match[1].replace(/^"|"$/g, "").trim() || undefined };
  return { email: normalizeEmail(text.replace(/^mailto:/i, "")) };
}

function addresses(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => addresses(item));
  if (typeof value !== "string") return [];
  return value.split(/,\s*/).map((item) => address(item).email).filter(Boolean);
}

function headerMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => typeof item === "string" ? [[key.toLowerCase(), item]] : []));
}

function messageIds(value: string | undefined) { return (value ?? "").match(/<[^>]+>|\S+/g)?.map((item) => item.replace(/^<|>$/g, "")) ?? []; }

export function sanitizeInboundHtml(html: string | undefined) {
  if (!html) return "";
  return html
    .replace(/<\s*(script|style|iframe|object|embed|form|applet)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/\s+on[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*(["'])\s*(javascript:|data:|vbscript:)[\s\S]*?\2/gi, " $1=\"#\"")
    .replace(/<\s*(iframe|object|embed|base|meta|link)\b[^>]*>/gi, "");
}

export function matchInboundEmail(input: NormalizedInboundEmail, candidates: InboundMatchCandidate[]) {
  const from = normalizeEmail(input.from.email);
  const refs = new Set([...(input.references ?? []), input.inReplyToProviderMessageId ?? ""].filter(Boolean));
  const byThread = input.providerThreadId ? candidates.filter((item) => item.providerThreadId === input.providerThreadId) : [];
  if (byThread.length === 1) return { kind: "matched" as const, candidate: byThread[0], reason: "provider_thread" };
  const byReference = candidates.filter((item) => item.providerMessageId && refs.has(item.providerMessageId));
  if (byReference.length === 1) return { kind: "matched" as const, candidate: byReference[0], reason: "message_reference" };
  const recent = candidates.filter((item) => item.normalizedEmail === from && (!item.lastMessageAt || Date.now() - new Date(item.lastMessageAt).getTime() <= 30 * 86400000));
  const subject = input.subject.toLowerCase().replace(/^\s*(re|fwd):\s*/i, "");
  const byEmailAndSubject = recent.filter((item) => !item.subject || item.subject.toLowerCase().replace(/^\s*(re|fwd):\s*/i, "") === subject);
  if (byEmailAndSubject.length === 1) return { kind: "matched" as const, candidate: byEmailAndSubject[0], reason: "recent_contact_subject" };
  if (recent.length === 1 && !subject) return { kind: "matched" as const, candidate: recent[0], reason: "recent_contact" };
  return { kind: "unmatched" as const, reason: recent.length > 1 ? "ambiguous_contact" : "no_safe_match" };
}

export function parseResendInboundPayload(payload: Record<string, unknown>, receivedAt = new Date().toISOString()): NormalizedInboundEmail | null {
  if (payload.type !== "email.received") return null;
  const data = (payload.data && typeof payload.data === "object" ? payload.data : {}) as Record<string, unknown>;
  const headers = headerMap(data.headers);
  const from = address(data.from);
  if (!from.email) return null;
  const references = messageIds(headers.references);
  const inReplyTo = messageIds(headers["in-reply-to"])[0];
  const thread = typeof data.thread_id === "string" ? data.thread_id : references[0];
  return { provider: "resend", providerMessageId: typeof data.email_id === "string" ? data.email_id : String(data.message_id ?? ""), providerThreadId: thread, inReplyToProviderMessageId: inReplyTo, references, from, to: addresses(data.to), cc: addresses(data.cc), subject: typeof data.subject === "string" ? data.subject : "", text: typeof data.text === "string" ? data.text : undefined, html: typeof data.html === "string" ? data.html : undefined, receivedAt: typeof payload.created_at === "string" ? payload.created_at : receivedAt, headers, metadata: { emailId: data.email_id, rawType: payload.type } };
}

export async function verifyAndParseResendInbound(rawBody: string, headers: Headers, secret: string | undefined, now = Date.now(), apiKey = process.env.MARKETING_EMAIL_API_KEY, fetchImpl: typeof fetch = fetch) {
  const payload = verifyResendPayload(rawBody, headers, secret, now);
  if (!payload) return null;
  const parsed = parseResendInboundPayload(payload);
  if (!parsed?.providerMessageId) return null;
  if (!parsed.text && !parsed.html && apiKey && parsed.metadata?.emailId) {
    try {
      const response = await fetchImpl(`https://api.resend.com/emails/receiving/${encodeURIComponent(String(parsed.metadata.emailId))}`, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (response.ok) {
        const detail = await response.json() as Record<string, unknown>;
        if (typeof detail.text === "string") parsed.text = detail.text;
        if (typeof detail.html === "string") parsed.html = detail.html;
        if (typeof detail.subject === "string" && !parsed.subject) parsed.subject = detail.subject;
      }
    } catch {
      // Preserve the verified event and safe metadata when provider hydration is unavailable.
    }
  }
  return parsed;
}
