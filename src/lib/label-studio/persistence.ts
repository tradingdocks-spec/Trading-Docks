import {
  createDefaultLabelTemplate,
  type LabelCategory,
  type LabelRenderData,
  type LabelTemplate,
  type LabelTemplateElement,
  type LabelUnit,
  type PricingRule,
} from "./label-templates.ts";

export type LabelStudioTemplateRow = {
  id: string;
  workspace_id: string;
  name: string;
  category: LabelCategory;
  width: number | string;
  height: number | string;
  unit: LabelUnit;
  orientation: "portrait" | "landscape";
  qr_enabled: boolean;
  barcode_enabled: boolean;
  logo_enabled: boolean;
  price_field: "asking_price" | "market_price" | "none";
  pricing_rule: PricingRule | null;
  template_data: {
    sizePresetId?: LabelTemplate["sizePresetId"];
    elements?: LabelTemplateElement[];
  } | null;
};

export type LabelStudioInventoryRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  item_kind?: string | null;
  game_id?: string | null;
  product_type?: string | null;
  variant?: string | null;
  language?: string | null;
  provider_category_id?: string | null;
  provider_product_id?: string | null;
  provider_sku_id?: string | null;
  tcgplayer_product_id?: number | string | null;
  tcgplayer_sku_id?: number | string | null;
  card_name?: string | null;
  product_name?: string | null;
  set_code?: string | null;
  collector_number?: string | null;
  sku?: string | null;
  barcode_value?: string | null;
  upc?: string | null;
  asking_price?: number | string | null;
  market_price?: number | string | null;
  data?: Record<string, unknown> | null;
};

export type LabelStudioIdentityRow = {
  id: string;
  workspace_id: string;
  inventory_user_id: string;
  inventory_item_id: string;
  target_type: string;
  sku: string;
  qr_token: string;
  barcode_value?: string | null;
  status: "active" | "revoked" | "archived";
  public_enabled: boolean;
  revoked_at?: string | null;
};

export type LabelStudioPriceReviewRow = {
  id: string;
  workspace_id: string;
  inventory_identity_id?: string | null;
  inventory_item_id: string;
  current_asking_price?: number | string | null;
  proposed_asking_price?: number | string | null;
  market_price?: number | string | null;
  variance_percent?: number | string | null;
  status: "pending" | "approved" | "dismissed" | "applied";
};

export type LabelStudioItem = LabelRenderData & {
  id: string;
  userId: string;
  workspaceId: string;
  targetType: string;
  identity: LabelStudioIdentityRow | null;
  barcodeValue: string | null;
  upc: string | null;
  qrUrl: string | null;
};

export function templateFromRow(row: LabelStudioTemplateRow): LabelTemplate {
  const fallback = createDefaultLabelTemplate({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    category: row.category,
    sizePresetId: row.template_data?.sizePresetId ?? "custom",
  });
  return {
    ...fallback,
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    category: row.category,
    sizePresetId: row.template_data?.sizePresetId ?? "custom",
    width: Number(row.width),
    height: Number(row.height),
    unit: row.unit,
    orientation: row.orientation,
    qrEnabled: row.qr_enabled,
    barcodeEnabled: row.barcode_enabled,
    logoEnabled: row.logo_enabled,
    priceField: row.price_field,
    pricingRule: row.pricing_rule ?? undefined,
    elements: Array.isArray(row.template_data?.elements)
      ? row.template_data.elements
      : fallback.elements,
  };
}

export function templateToRow(template: LabelTemplate, workspaceId: string) {
  return {
    workspace_id: workspaceId,
    name: template.name.trim(),
    category: template.category,
    width: template.width,
    height: template.height,
    unit: template.unit,
    orientation: template.orientation,
    qr_enabled: template.qrEnabled,
    barcode_enabled: template.barcodeEnabled,
    logo_enabled: template.logoEnabled,
    price_field: template.priceField,
    pricing_rule: template.pricingRule ?? { mode: "none" },
    template_data: {
      sizePresetId: template.sizePresetId,
      elements: template.elements,
    },
  };
}

export function labelItemFromRows(
  item: LabelStudioInventoryRow,
  identity: LabelStudioIdentityRow | null,
  origin: string,
): LabelStudioItem {
  const data = item.data && typeof item.data === "object" ? item.data : {};
  const gameId = normalizeGameId(item.game_id ?? data.game_id ?? data.gameId ?? data.game);
  const productType = normalizeProductType(item.product_type ?? data.product_type ?? data.productType ?? item.item_kind);
  const condition = stringValue(data.condition);
  const variant = stringValue(item.variant) ?? stringValue(data.variant) ?? stringValue(data.finish) ?? stringValue(data.treatment);
  const finish = gameId === "magic" ? variant : null;
  const language = stringValue(item.language) ?? stringValue(data.language);
  const productName =
    stringValue(item.product_name) ??
    stringValue(data.productName) ??
    stringValue(data.name);
  const cardName = stringValue(item.card_name);
  const sku = identity?.sku ?? stringValue(item.sku);
  const targetType = identity?.target_type ?? stringValue(item.item_kind) ?? (productType === "sealed" || (productName && !cardName) ? "sealed" : "single");
  return {
    id: item.id,
    userId: item.user_id,
    workspaceId: item.workspace_id ?? identity?.workspace_id ?? "",
    targetType,
    identity,
    barcodeValue: identity?.barcode_value ?? stringValue(item.barcode_value) ?? stringValue(item.upc),
    upc: stringValue(item.upc),
    qrUrl: identity?.qr_token ? `${origin}/q/${identity.qr_token}` : null,
    card: {
      name: cardName,
      set: stringValue(item.set_code),
      collector_number: stringValue(item.collector_number),
    },
    sealed: {
      product_name: productName,
    },
    inventory: {
      game: gameLabel(gameId),
      product_type: productType === "sealed" ? "Sealed" : "Card",
      condition,
      finish,
      variant,
      language,
      asking_price: money(item.asking_price),
      market_price: money(item.market_price),
      sku,
      location: stringValue(data.location) ?? stringValue(data.locationLabel),
    },
    workspace: {
      name: "Trading Docks",
    },
  };
}

export function boundedIds(value: string | null, limit = 50) {
  if (!value) return [];
  return [...new Set(value.split(",").map((id) => id.trim()).filter((id) => /^[A-Za-z0-9_-]{1,80}$/.test(id)))]
    .slice(0, limit);
}

function money(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeGameId(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "pokemon" || raw === "ptcg" || raw === "3") return "pokemon";
  return "magic";
}

function normalizeProductType(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "sealed" || raw === "sealed_product" || raw === "unopened") return "sealed";
  return "card";
}

function gameLabel(gameId: string) {
  return gameId === "pokemon" ? "Pokemon" : "Magic";
}
