import { mockProviderMessageId } from "./growth-engine.ts";

export type GrowthEmailSendInput = {
  idempotencyKey: string;
  recipient: string;
  subject: string;
  bodyText: string;
};

export type GrowthEmailSendResult = {
  provider: "mock";
  providerMessageId: string;
  delivered: false;
};

export interface GrowthEmailProvider {
  readonly id: "mock";
  send(input: GrowthEmailSendInput): Promise<GrowthEmailSendResult>;
}

const mockProvider: GrowthEmailProvider = {
  id: "mock",
  async send(input) {
    // The mock provider records intent only. It never contacts the recipient.
    return { provider: "mock", providerMessageId: mockProviderMessageId(input.idempotencyKey), delivered: false };
  },
};

export function createGrowthEmailProvider(): GrowthEmailProvider {
  return mockProvider;
}
