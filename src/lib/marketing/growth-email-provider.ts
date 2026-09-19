import { mockProviderMessageId } from "./growth-engine.ts";
import { createResendProvider, type MarketingSendInput } from "./email-delivery.ts";

export type GrowthEmailSendInput = MarketingSendInput & {
  idempotencyKey: string;
  recipient: string;
  subject: string;
  bodyText: string;
};

export type GrowthEmailSendResult = {
  provider: "mock" | "resend";
  providerMessageId: string;
  delivered: false;
};

export interface GrowthEmailProvider {
  readonly id: "mock" | "resend";
  send(input: GrowthEmailSendInput): Promise<GrowthEmailSendResult>;
}

const mockProvider: GrowthEmailProvider = {
  id: "mock",
  async send(input) {
    // The mock provider records intent only. It never contacts the recipient.
    return { provider: "mock", providerMessageId: mockProviderMessageId(input.idempotencyKey), delivered: false };
  },
};

export function createGrowthEmailProvider(options: { provider?: "mock" | "resend"; env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {}): GrowthEmailProvider {
  if (options.provider === "resend") {
    const resend = createResendProvider(options.env, options.fetchImpl);
    return { id: "resend", async send(input) { const result = await resend.send(input); return { provider: result.provider, providerMessageId: result.providerMessageId, delivered: false }; } };
  }
  return mockProvider;
}
