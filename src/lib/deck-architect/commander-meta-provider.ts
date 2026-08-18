import type {
  CommanderCardEvidence,
  CommanderMetaProfile,
  CommanderMetaProvider,
  CommanderStrategyEvidence,
} from "./types.ts";

export class EdhrecLicensedMetaProvider implements CommanderMetaProvider {
  async getCommanderProfile(_commanderId: string): Promise<CommanderMetaProfile | null> {
    return null;
  }

  async getCardEvidence(_commanderId: string, _cardId: string, _strategyId?: string): Promise<CommanderCardEvidence | null> {
    return null;
  }

  async getStrategyProfiles(_commanderId: string): Promise<CommanderStrategyEvidence[]> {
    return [];
  }
}

export const EDHREC_INTEGRATION_STATUS = {
  status: "disabled_unlicensed",
  integrated: false,
  reason: "Commercial permission/licensing required before EDHREC data can be used by Trading Docks.",
  scrapingAllowed: false,
  providerInterfaceReady: true,
} as const satisfies {
  status: "disabled_unlicensed" | "configured" | "unavailable";
  integrated: boolean;
  reason: string;
  scrapingAllowed: boolean;
  providerInterfaceReady: boolean;
};
