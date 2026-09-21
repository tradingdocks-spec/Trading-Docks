import "server-only";
import { activeHardware } from "./catalog";
import { purchaseLink, type AffiliateConfig } from "./links";
import { readHardwareAffiliateConfig } from "./affiliate-config";
export function affiliateConfig(): AffiliateConfig {
  return readHardwareAffiliateConfig(process.env);
}
export function hardwareViews() {
  const config = affiliateConfig();
  return activeHardware().map((item) => ({
    item,
    purchase: purchaseLink(item, config),
    disclosure: config.disclosure,
  }));
}
