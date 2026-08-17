import type { BuildIntent, BuildIntentId } from "./types.ts";

export const BUILD_INTENTS: Record<BuildIntentId, BuildIntent> = {
  "use-collection": {
    id: "use-collection",
    label: "Use My Collection",
    ownershipWeight: 0.42,
    priceWeight: 0.18,
    powerWeight: 0.2,
    synergyWeight: 0.2,
    allowMissingCards: true,
  },
  "no-purchases": {
    id: "no-purchases",
    label: "No Purchases",
    ownershipWeight: 1,
    priceWeight: 0,
    powerWeight: 0,
    synergyWeight: 0,
    allowMissingCards: false,
  },
  "strongest-possible": {
    id: "strongest-possible",
    label: "Strongest Possible",
    ownershipWeight: 0.15,
    priceWeight: 0.1,
    powerWeight: 0.45,
    synergyWeight: 0.3,
    allowMissingCards: true,
  },
  budget: {
    id: "budget",
    label: "Budget Build",
    ownershipWeight: 0.34,
    priceWeight: 0.36,
    powerWeight: 0.14,
    synergyWeight: 0.16,
    allowMissingCards: true,
    budgetCents: 2500,
  },
  competitive: {
    id: "competitive",
    label: "Competitive",
    ownershipWeight: 0.2,
    priceWeight: 0.12,
    powerWeight: 0.38,
    synergyWeight: 0.3,
    allowMissingCards: true,
  },
  casual: {
    id: "casual",
    label: "Casual / Fun",
    ownershipWeight: 0.3,
    priceWeight: 0.18,
    powerWeight: 0.12,
    synergyWeight: 0.4,
    allowMissingCards: true,
  },
  "upgrade-over-time": {
    id: "upgrade-over-time",
    label: "Upgrade Over Time",
    ownershipWeight: 0.35,
    priceWeight: 0.25,
    powerWeight: 0.18,
    synergyWeight: 0.22,
    allowMissingCards: true,
  },
};

export function getBuildIntent(intentId: BuildIntentId) {
  return BUILD_INTENTS[intentId] ?? BUILD_INTENTS["use-collection"];
}
