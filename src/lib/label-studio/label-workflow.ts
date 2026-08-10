import { renderLabel, type LabelRenderData, type LabelRenderResult, type LabelTemplate } from "./label-templates.ts";

export type LabelWorkflowMode =
  | "single"
  | "card_show"
  | "sealed"
  | "showcase"
  | "storage"
  | "audit";

export type BulkLabelSelection = {
  workspaceId: string;
  mode: LabelWorkflowMode;
  items: LabelRenderData[];
};

export type RepricingVariance = {
  sku: string;
  currentAskingPrice: number | null;
  proposedAskingPrice: number | null;
  marketPrice: number | null;
  variancePercent: number | null;
  actionRequired: boolean;
};

export function buildBulkLabelRenderJob(
  template: LabelTemplate,
  selection: BulkLabelSelection,
): LabelRenderResult[] {
  if (template.workspaceId !== selection.workspaceId) return [];
  return selection.items.map((item) => renderLabel(template, item));
}

export function detectRepricingVariance(
  items: LabelRenderData[],
  thresholdPercent: number,
): RepricingVariance[] {
  const threshold = Math.max(0, thresholdPercent);
  return items
    .map((item) => {
      const sku = item.inventory?.sku ?? "";
      const currentAskingPrice = money(item.inventory?.asking_price);
      const marketPrice = money(item.inventory?.market_price);
      const variancePercent =
        currentAskingPrice !== null && marketPrice !== null && marketPrice > 0
          ? Math.abs((currentAskingPrice - marketPrice) / marketPrice) * 100
          : null;
      return {
        sku,
        currentAskingPrice,
        proposedAskingPrice: marketPrice,
        marketPrice,
        variancePercent,
        actionRequired: variancePercent !== null && variancePercent > threshold,
      };
    })
    .filter((item) => item.sku);
}

function money(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
