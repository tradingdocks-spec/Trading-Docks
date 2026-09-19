import { createHmac, timingSafeEqual } from "node:crypto";

export type MarketingProviderId = "mock" | "resend";

export type MarketingSenderSettings = {
  email_provider?: string | null;
  from_name?: string | null;
  from_email?: string | null;
  reply_to?: string | null;
  business_name?: string | null;
  business_address?: string | null;
  unsubscribe_base_url?: string | null;
  sending_domain?: string | null;
  spf_status?: string | null;
  dkim_status?: string | null;
  dmarc_status?: string | null;
  tracking_domain?: string | null;
};

export type MarketingEmailReadiness = {
  provider: MarketingProviderId;
  providerConfigured: boolean;
  senderConfigured: boolean;
  complianceConfigured: boolean;
  realSendEnabled: boolean;
  domainAuthentication: { sendingDomain: string | null; spf: string; dkim: string; dmarc: string };
  ready: boolean;
  blockers: string[];
};

export type MarketingSendInput = {
  idempotencyKey: string;
  recipient: string;
  subject: string;
  previewText: string;
  bodyHtml: string;
  bodyText: string;
  from: string;
  replyTo: string;
  headers?: Record<string, string>;
};

export type MarketingSendResult = {
  provider: MarketingProviderId;
  providerMessageId: string;
  accepted: boolean;
  submittedAt: string;
};

export type MarketingWebhookEvent = {
  provider: "resend";
  providerEventId: string;
  type: "submitted" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained" | "unsubscribed" | "failed";
  providerMessageId: string | null;
  occurredAt: string;
  clickedUrl?: string | null;
  bounceCategory?: "hard" | "soft" | null;
  reason?: string | null;
  payload: Record<string, unknown>;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getMarketingEmailReadiness(settings: MarketingSenderSettings | null | undefined, env: NodeJS.ProcessEnv = process.env): MarketingEmailReadiness {
  const configuredProvider = String(env.MARKETING_EMAIL_PROVIDER ?? settings?.email_provider ?? "mock").toLowerCase();
  const provider: MarketingProviderId = configuredProvider === "resend" ? "resend" : "mock";
  const providerConfigured = provider === "resend" && Boolean(env.MARKETING_EMAIL_API_KEY);
  const senderConfigured = Boolean(settings?.from_name?.trim() && validEmail(settings?.from_email) && validEmail(settings?.reply_to));
  const complianceConfigured = Boolean(settings?.business_name?.trim() && settings?.business_address?.trim() && validUrl(settings?.unsubscribe_base_url));
  const realSendEnabled = env.MARKETING_REAL_SEND_ENABLED === "true" && env.VERCEL_ENV === "production";
  const blockers: string[] = [];
  if (provider === "mock") blockers.push("A real email provider is not selected.");
  if (provider === "resend" && !providerConfigured) blockers.push("Resend API configuration is missing.");
  if (!senderConfigured) blockers.push("From name, From email, and Reply-to must be configured.");
  if (!complianceConfigured) blockers.push("Business name, physical address, and unsubscribe URL must be configured.");
  if (!realSendEnabled) blockers.push("Real sending is disabled for this environment.");
  return { provider, providerConfigured, senderConfigured, complianceConfigured, realSendEnabled, domainAuthentication: { sendingDomain: settings?.sending_domain ?? null, spf: settings?.spf_status ?? "unknown", dkim: settings?.dkim_status ?? "unknown", dmarc: settings?.dmarc_status ?? "unknown" }, ready: blockers.length === 0, blockers };
}

export function validEmail(value: string | null | undefined) { return typeof value === "string" && EMAIL.test(value.trim()); }
export function validUrl(value: string | null | undefined) { try { return Boolean(value && new URL(value)); } catch { return false; } }

export function createResendProvider(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch) {
  const apiKey = env.MARKETING_EMAIL_API_KEY;
  return {
    async send(input: MarketingSendInput): Promise<MarketingSendResult> {
      if (!apiKey) throw new Error("Marketing email provider is not configured.");
      let response: Response;
      try {
        response = await fetchImpl("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey }, body: JSON.stringify({ from: input.from, to: [input.recipient], subject: input.subject, preview_text: input.previewText, html: input.bodyHtml, text: input.bodyText, reply_to: input.replyTo, headers: input.headers }) });
      } catch {
        throw new Error("Marketing email provider could not be reached; delivery state is unknown.");
      }
      const payload = await response.json().catch(() => ({})) as { id?: unknown; message?: unknown };
      if (!response.ok || typeof payload.id !== "string") throw new Error(typeof payload.message === "string" ? "Marketing email provider rejected the message." : "Marketing email provider returned an invalid response.");
      return { provider: "resend", providerMessageId: payload.id, accepted: true, submittedAt: new Date().toISOString() };
    },
  };
}

export function verifyResendWebhook(rawBody: string, headers: Headers, secret: string | undefined, now = Date.now()): MarketingWebhookEvent | null {
  const payload = verifyResendPayload(rawBody, headers, secret, now);
  if (!payload) return null;
  const eventId = headers.get("svix-id") ?? "";
  return normalizeResendWebhook(eventId, payload);
}

export function verifyResendPayload(rawBody: string, headers: Headers, secret: string | undefined, now = Date.now()): Record<string, unknown> | null {
  const eventId = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!eventId || !timestamp || !signatureHeader || !secret) return null;
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > 5 * 60 * 1000) return null;
  const encodedSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let key: Buffer;
  try { key = Buffer.from(encodedSecret, "base64"); } catch { return null; }
  const expected = createHmac("sha256", key).update(`${eventId}.${timestamp}.${rawBody}`).digest("base64");
  const valid = signatureHeader.split(" ").some((signature) => { const value = signature.split(",")[1]; if (!value) return false; const a = Buffer.from(value); const b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a, b); });
  if (!valid) return null;
  try { return JSON.parse(rawBody) as Record<string, unknown>; } catch { return null; }
}

export function normalizeResendWebhook(providerEventId: string, payload: Record<string, unknown>): MarketingWebhookEvent | null {
  const type = String(payload.type ?? "");
  const mapped = ({ "email.sent": "sent", "email.delivered": "delivered", "email.opened": "opened", "email.clicked": "clicked", "email.bounced": "bounced", "email.complained": "complained", "email.failed": "failed", "email.delivery_delayed": "failed" } as Record<string, MarketingWebhookEvent["type"]>)[type] ?? null;
  if (!mapped) return null;
  const data = (payload.data && typeof payload.data === "object" ? payload.data : {}) as Record<string, unknown>;
  const click = (data.click && typeof data.click === "object" ? data.click : {}) as Record<string, unknown>;
  const bounce = (data.bounce && typeof data.bounce === "object" ? data.bounce : {}) as Record<string, unknown>;
  return { provider: "resend", providerEventId, type: mapped, providerMessageId: typeof data.email_id === "string" ? data.email_id : null, occurredAt: typeof payload.created_at === "string" ? payload.created_at : new Date().toISOString(), clickedUrl: typeof click.url === "string" ? click.url : null, bounceCategory: String(bounce.type ?? "").toLowerCase() === "hard" ? "hard" : mapped === "bounced" ? "soft" : null, reason: typeof bounce.message === "string" ? bounce.message : typeof data.reason === "string" ? data.reason : null, payload };
}
