import { defaultDisclosure, type AffiliateConfig } from "./links.ts";

// Owner-approved public tracking identifier, not a secret. Keep it out of JSX.
export const APPROVED_AMAZON_US_ASSOCIATE_ID = "tradingdocks-20";

export function readHardwareAffiliateConfig(
  env: Record<string, string | undefined>,
): AffiliateConfig {
  return {
    // Account approval does not change deployment enablement or approve listings.
    enabled: env.HARDWARE_AFFILIATES_ENABLED === "true",
    amazonTag:
      env.AMAZON_ASSOCIATE_TAG?.trim() || APPROVED_AMAZON_US_ASSOCIATE_ID,
    disclosure: env.HARDWARE_AFFILIATE_DISCLOSURE?.trim() || defaultDisclosure,
  };
}
