import type { PurchasingProductType } from "./product-lookup.ts";

export const PURCHASING_BUYING_RULES_DOCUMENT = "purchasing-intelligence:buying-rules:v1";

export type PurchasingBuyingRules = {
  singlesPercent: number;
  sealedPercent: number;
  storeCreditBonusPercent: number;
  manualOfferAllowed: boolean;
};

export type EffectiveBuyingRule = {
  productType: PurchasingProductType;
  percent: number | null;
  storeCreditBonusPercent: number;
  manualOfferAllowed: boolean;
  configured: boolean;
  label: string;
  sourceLabel: string;
};

export const DEFAULT_PURCHASING_BUYING_RULES: PurchasingBuyingRules = {
  singlesPercent: 60,
  sealedPercent: 75,
  storeCreditBonusPercent: 15,
  manualOfferAllowed: false,
};

export function normalizePurchasingBuyingRules(value: unknown): PurchasingBuyingRules | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  return {
    singlesPercent: normalizedPercent(source.singlesPercent ?? source.singlePercent ?? source.cardPercent),
    sealedPercent: normalizedPercent(source.sealedPercent),
    storeCreditBonusPercent: normalizedPercent(source.storeCreditBonusPercent, DEFAULT_PURCHASING_BUYING_RULES.storeCreditBonusPercent),
    manualOfferAllowed: source.manualOfferAllowed === true,
  };
}

export function resolvePurchasingBuyingRules(value: unknown): {
  rules: PurchasingBuyingRules;
  configured: boolean;
} {
  const normalized = normalizePurchasingBuyingRules(value);
  return {
    rules: normalized ?? DEFAULT_PURCHASING_BUYING_RULES,
    configured: Boolean(normalized),
  };
}

export function resolveEffectiveBuyingRule(input: {
  productType: PurchasingProductType;
  rules: PurchasingBuyingRules;
  configured?: boolean;
}): EffectiveBuyingRule {
  const percent = input.productType === "sealed"
    ? input.rules.sealedPercent
    : input.rules.singlesPercent;
  const productLabel = input.productType === "sealed" ? "Sealed" : "Singles";
  return {
    productType: input.productType,
    percent,
    storeCreditBonusPercent: input.rules.storeCreditBonusPercent,
    manualOfferAllowed: input.rules.manualOfferAllowed,
    configured: input.configured === true,
    label: `${percent}% · ${productLabel}`,
    sourceLabel: input.configured === true ? "Workspace rule" : "Default policy",
  };
}

function normalizedPercent(value: unknown, fallback = 0) {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return fallback;
  return Math.max(0, Math.min(100, Math.round(percent * 100) / 100));
}
