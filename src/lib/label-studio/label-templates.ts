export type LabelUnit = "in" | "mm";
export type LabelOrientation = "portrait" | "landscape";
export type LabelCategory =
  | "card_show"
  | "single"
  | "showcase"
  | "sealed"
  | "storage"
  | "buylist_intake"
  | "custom";

export type LabelSizePresetId =
  | "1x0_5"
  | "1x1"
  | "1_5x1"
  | "2x1"
  | "2_25x1_25"
  | "2x2"
  | "3x2"
  | "4x2"
  | "custom";

export type LabelElementType =
  | "text"
  | "price"
  | "qr"
  | "barcode"
  | "logo"
  | "image"
  | "sku"
  | "location";

export type LabelBinding =
  | "card.name"
  | "card.set"
  | "card.collector_number"
  | "inventory.condition"
  | "inventory.finish"
  | "inventory.asking_price"
  | "inventory.market_price"
  | "inventory.sku"
  | "inventory.location"
  | "sealed.product_name"
  | "workspace.name";

export type LabelSizePreset = {
  id: LabelSizePresetId;
  name: string;
  width: number;
  height: number;
  unit: LabelUnit;
};

export type LabelTemplateElement = {
  id: string;
  type: LabelElementType;
  binding?: LabelBinding;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  emphasis?: "subtle" | "normal" | "strong" | "price";
};

export type PricingRule = {
  mode: "none" | "market_percentage" | "fixed_markup";
  percentage?: number;
  fixedMarkup?: number;
  rounding?: "none" | "nearest_dollar" | "ending_99";
  minimumPrice?: number;
};

export type LabelTemplate = {
  id: string;
  workspaceId: string;
  name: string;
  category: LabelCategory;
  sizePresetId: LabelSizePresetId;
  width: number;
  height: number;
  unit: LabelUnit;
  orientation: LabelOrientation;
  qrEnabled: boolean;
  barcodeEnabled: boolean;
  logoEnabled: boolean;
  priceField: "asking_price" | "market_price" | "none";
  elements: LabelTemplateElement[];
  pricingRule?: PricingRule;
};

export type LabelRenderData = {
  card?: {
    name?: string | null;
    set?: string | null;
    collector_number?: string | null;
  };
  inventory?: {
    condition?: string | null;
    finish?: string | null;
    asking_price?: number | null;
    market_price?: number | null;
    sku?: string | null;
    location?: string | null;
  };
  sealed?: {
    product_name?: string | null;
  };
  workspace?: {
    name?: string | null;
  };
};

export type LabelRenderElement = LabelTemplateElement & {
  value: string;
};

export type LabelRenderResult = {
  templateId: string;
  width: number;
  height: number;
  unit: LabelUnit;
  elements: LabelRenderElement[];
  proposedPrice: number | null;
};

export type BulkLabelPage = {
  pageNumber: number;
  labels: LabelRenderResult[];
};

export const LABEL_SIZE_PRESETS: LabelSizePreset[] = [
  { id: "1x0_5", name: "1 x .5", width: 1, height: 0.5, unit: "in" },
  { id: "1x1", name: "1 x 1", width: 1, height: 1, unit: "in" },
  { id: "1_5x1", name: "1.5 x 1", width: 1.5, height: 1, unit: "in" },
  { id: "2x1", name: "2 x 1", width: 2, height: 1, unit: "in" },
  { id: "2_25x1_25", name: "2.25 x 1.25", width: 2.25, height: 1.25, unit: "in" },
  { id: "2x2", name: "2 x 2", width: 2, height: 2, unit: "in" },
  { id: "3x2", name: "3 x 2", width: 3, height: 2, unit: "in" },
  { id: "4x2", name: "4 x 2", width: 4, height: 2, unit: "in" },
  { id: "custom", name: "Custom", width: 2, height: 1, unit: "in" },
];

export const LABEL_CATEGORIES: LabelCategory[] = [
  "card_show",
  "single",
  "showcase",
  "sealed",
  "storage",
  "buylist_intake",
  "custom",
];

export const LABEL_BINDINGS: LabelBinding[] = [
  "card.name",
  "card.set",
  "card.collector_number",
  "inventory.condition",
  "inventory.finish",
  "inventory.asking_price",
  "inventory.market_price",
  "inventory.sku",
  "inventory.location",
  "sealed.product_name",
  "workspace.name",
];

export function createDefaultLabelTemplate(input: {
  id: string;
  workspaceId: string;
  name: string;
  category: LabelCategory;
  sizePresetId?: LabelSizePresetId;
}): LabelTemplate {
  const preset = labelSizePreset(input.sizePresetId ?? defaultPresetForCategory(input.category));
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    category: input.category,
    sizePresetId: preset.id,
    width: preset.width,
    height: preset.height,
    unit: preset.unit,
    orientation: preset.width >= preset.height ? "landscape" : "portrait",
    qrEnabled: true,
    barcodeEnabled: input.category === "sealed" || input.category === "card_show",
    logoEnabled: input.category === "showcase" || input.category === "storage",
    priceField: input.category === "storage" ? "none" : "asking_price",
    elements: defaultElementsForCategory(input.category),
  };
}

export function renderLabel(template: LabelTemplate, data: LabelRenderData): LabelRenderResult {
  const proposedPrice = applyPricingRule(
    template.pricingRule,
    data.inventory?.market_price ?? null,
    data.inventory?.asking_price ?? null,
  );
  return {
    templateId: template.id,
    width: template.width,
    height: template.height,
    unit: template.unit,
    proposedPrice,
    elements: template.elements.map((element) => ({
      ...element,
      value: resolveElementValue(element, data, proposedPrice),
    })),
  };
}

export function paginateLabels(labels: LabelRenderResult[], labelsPerPage: number): BulkLabelPage[] {
  const safePerPage = Math.max(1, Math.floor(labelsPerPage));
  const pages: BulkLabelPage[] = [];
  for (let index = 0; index < labels.length; index += safePerPage) {
    pages.push({
      pageNumber: pages.length + 1,
      labels: labels.slice(index, index + safePerPage),
    });
  }
  return pages;
}

export function validateLabelTemplate(template: LabelTemplate) {
  const errors: string[] = [];
  if (!template.workspaceId) errors.push("workspace_required");
  if (!template.name.trim()) errors.push("name_required");
  if (template.width <= 0 || template.height <= 0) errors.push("positive_dimensions_required");
  if (!LABEL_CATEGORIES.includes(template.category)) errors.push("invalid_category");
  for (const element of template.elements) {
    if (element.binding && !LABEL_BINDINGS.includes(element.binding)) {
      errors.push(`invalid_binding:${element.id}`);
    }
    if (element.width <= 0 || element.height <= 0) {
      errors.push(`invalid_element_size:${element.id}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function applyPricingRule(
  rule: PricingRule | undefined,
  marketPrice: number | null,
  currentAskingPrice: number | null = null,
) {
  if (!rule || rule.mode === "none") return currentAskingPrice;
  if (typeof marketPrice !== "number" || !Number.isFinite(marketPrice) || marketPrice < 0) return null;
  let price = marketPrice;
  if (rule.mode === "market_percentage") price = marketPrice * ((rule.percentage ?? 100) / 100);
  if (rule.mode === "fixed_markup") price = marketPrice + (rule.fixedMarkup ?? 0);
  price = Math.max(price, rule.minimumPrice ?? 0);
  if (rule.rounding === "nearest_dollar") price = Math.round(price);
  if (rule.rounding === "ending_99") price = Math.max(0.99, Math.ceil(price) - 0.01);
  return roundCurrency(price);
}

export function labelSizePreset(id: LabelSizePresetId) {
  return LABEL_SIZE_PRESETS.find((preset) => preset.id === id) ?? LABEL_SIZE_PRESETS[0];
}

function resolveElementValue(
  element: LabelTemplateElement,
  data: LabelRenderData,
  proposedPrice: number | null,
) {
  if (element.type === "price") {
    return formatCurrency(proposedPrice ?? data.inventory?.asking_price ?? data.inventory?.market_price ?? null);
  }
  if (element.type === "sku") return data.inventory?.sku ?? "";
  if (element.type === "location") return data.inventory?.location ?? "";
  if (element.type === "qr") return "QR";
  if (element.type === "barcode") return data.inventory?.sku ?? "";
  if (element.binding) return bindingValue(element.binding, data);
  return element.text ?? "";
}

function bindingValue(binding: LabelBinding, data: LabelRenderData) {
  const value = binding.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return null;
    return (current as Record<string, unknown>)[key];
  }, data);
  if (typeof value === "number") return formatCurrency(value);
  return typeof value === "string" ? value : "";
}

function defaultPresetForCategory(category: LabelCategory): LabelSizePresetId {
  if (category === "storage") return "3x2";
  if (category === "sealed") return "4x2";
  if (category === "showcase") return "2x2";
  return "2x1";
}

function defaultElementsForCategory(category: LabelCategory): LabelTemplateElement[] {
  const nameBinding: LabelBinding = category === "sealed" ? "sealed.product_name" : "card.name";
  return [
    { id: "name", type: "text", binding: nameBinding, x: 0.06, y: 0.06, width: 0.62, height: 0.22, emphasis: "strong" },
    { id: "price", type: "price", binding: "inventory.asking_price", x: 0.06, y: 0.68, width: 0.3, height: 0.24, emphasis: "price" },
    { id: "sku", type: "sku", binding: "inventory.sku", x: 0.06, y: 0.88, width: 0.4, height: 0.1, emphasis: "subtle" },
    { id: "qr", type: "qr", x: 0.74, y: 0.16, width: 0.2, height: 0.56, emphasis: "normal" },
    { id: "location", type: "location", binding: "inventory.location", x: 0.48, y: 0.88, width: 0.46, height: 0.1, emphasis: "subtle" },
  ];
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
