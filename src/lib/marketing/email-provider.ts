import type { MarketingContact } from "./campaigns";

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

const disabledProvider: MarketingEmailProvider = {
  id: "disabled",
  configured: false,
  async sendMarketingEmail() {
    return {
      ok: false,
      code: "provider_not_configured",
      message: "Marketing email delivery is not configured for this environment.",
    };
  },
};

export function createMarketingEmailProvider(): MarketingEmailProvider {
  return disabledProvider;
}
