import type { MarketingContact } from "./campaigns";
import { createResendProvider, getMarketingEmailReadiness } from "./email-delivery";

export type MarketingSendInput = {
  workspaceId: string;
  campaignId: string;
  idempotencyKey: string;
  recipient: MarketingContact;
  subject: string;
  previewText?: string;
  bodyText: string;
  senderName: string;
  replyTo: string;
  unsubscribeUrl: string;
};

export type MarketingSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; code: "provider_not_configured" | "provider_rejected" | "transient_failure"; message: string };

export type MarketingEmailProvider = {
  id: string;
  configured: boolean;
  sendMarketingEmail(input: MarketingSendInput): Promise<MarketingSendResult>;
};

export function createMarketingEmailProvider(settings?: Parameters<typeof getMarketingEmailReadiness>[0]): MarketingEmailProvider {
  const readiness = getMarketingEmailReadiness(settings);
  if (!readiness.ready) return { id: readiness.provider, configured: false, async sendMarketingEmail() { return { ok: false, code: "provider_not_configured", message: readiness.blockers[0] ?? "Marketing email delivery is not ready." }; } };
  const provider = createResendProvider();
  return { id: "resend", configured: true, async sendMarketingEmail(input) { try { const result = await provider.send({ idempotencyKey: input.idempotencyKey, recipient: input.recipient.email ?? "", subject: input.subject, previewText: input.previewText ?? "", bodyHtml: input.bodyText, bodyText: input.bodyText, from: `${input.senderName} <${settings?.from_email ?? ""}>`, replyTo: input.replyTo, }); return { ok: true, providerMessageId: result.providerMessageId }; } catch (error) { return { ok: false, code: "provider_rejected", message: error instanceof Error ? error.message : "Marketing email provider rejected the message." }; } } };
}
