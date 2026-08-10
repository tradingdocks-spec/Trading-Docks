export type InventoryIdentityTargetType =
  | "single"
  | "sealed"
  | "showcase"
  | "storage"
  | "card_show_item"
  | "pos_item";

export type InventoryIdentityTarget = {
  workspaceId: string;
  inventoryItemId?: string | null;
  sealedProductId?: string | null;
  targetType: InventoryIdentityTargetType;
};

export type InventorySku = {
  value: string;
  workspaceId: string;
  targetType: InventoryIdentityTargetType;
  humanReadable: true;
  publicSafe: true;
};

export type QrToken = {
  token: string;
  route: string;
  workspaceId: string;
  targetType: InventoryIdentityTargetType;
  revoked: boolean;
  publicSafe: true;
};

export type QrResolveContext =
  | { kind: "public"; workspaceId?: null }
  | { kind: "employee"; workspaceId: string; permissions: string[] };

export type QrResolvedInventoryItem = {
  token: string;
  sku: string;
  targetType: InventoryIdentityTargetType;
  workspaceId: string;
  itemName: string;
  cardName?: string | null;
  sealedProductName?: string | null;
  setCode?: string | null;
  collectorNumber?: string | null;
  condition?: string | null;
  finish?: string | null;
  askingPrice?: number | null;
  marketPrice?: number | null;
  locationLabel?: string | null;
  costBasis?: number | null;
  internalCustomerId?: string | null;
  privateNotes?: string | null;
};

export type PublicQrView = {
  token: string;
  sku: string;
  itemName: string;
  targetType: InventoryIdentityTargetType;
  cardName?: string | null;
  sealedProductName?: string | null;
  setCode?: string | null;
  collectorNumber?: string | null;
  condition?: string | null;
  finish?: string | null;
  askingPrice?: number | null;
  marketPrice?: number | null;
};

export type EmployeeQrView = PublicQrView & {
  workspaceId: string;
  locationLabel?: string | null;
  allowedActions: QrInventoryAction[];
};

export type QrInventoryAction =
  | "inventory.open"
  | "storage.move"
  | "pos.add_to_cart"
  | "audit.mark_present"
  | "card_show.add_to_sale";

export const TRADING_DOCKS_SKU_PATTERN = /^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const SKU_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export type RandomByteSource = (length: number) => Uint8Array<ArrayBufferLike>;

export function generateInventorySku(randomBytes: RandomByteSource = defaultRandomBytes): string {
  const bytes = randomBytes(8);
  const body = Array.from(bytes, (byte) => SKU_ALPHABET[byte % SKU_ALPHABET.length]).join("");
  return `TD-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

export function buildInventorySku(
  target: InventoryIdentityTarget,
  randomBytes?: RandomByteSource,
): InventorySku {
  return {
    value: generateInventorySku(randomBytes),
    workspaceId: target.workspaceId,
    targetType: target.targetType,
    humanReadable: true,
    publicSafe: true,
  };
}

export function normalizeInventorySku(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function isTradingDocksSku(value: string) {
  return TRADING_DOCKS_SKU_PATTERN.test(normalizeInventorySku(value));
}

export function generateQrToken(randomBytes: RandomByteSource = defaultRandomBytes): string {
  const bytes = randomBytes(24);
  return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join("");
}

export function buildQrToken(
  target: InventoryIdentityTarget,
  randomBytes?: RandomByteSource,
): QrToken {
  const token = generateQrToken(randomBytes);
  return {
    token,
    route: `/q/${token}`,
    workspaceId: target.workspaceId,
    targetType: target.targetType,
    revoked: false,
    publicSafe: true,
  };
}

export function resolveQrView(
  item: QrResolvedInventoryItem,
  context: QrResolveContext,
): PublicQrView | EmployeeQrView {
  const publicView = sanitizePublicQrView(item);
  if (context.kind === "public") return publicView;
  if (context.workspaceId !== item.workspaceId) return publicView;
  return {
    ...publicView,
    workspaceId: item.workspaceId,
    locationLabel: item.locationLabel ?? null,
    allowedActions: allowedQrActions(context.permissions),
  };
}

export function sanitizePublicQrView(item: QrResolvedInventoryItem): PublicQrView {
  return {
    token: item.token,
    sku: item.sku,
    itemName: item.itemName,
    targetType: item.targetType,
    cardName: item.cardName ?? null,
    sealedProductName: item.sealedProductName ?? null,
    setCode: item.setCode ?? null,
    collectorNumber: item.collectorNumber ?? null,
    condition: item.condition ?? null,
    finish: item.finish ?? null,
    askingPrice: finiteMoney(item.askingPrice),
    marketPrice: finiteMoney(item.marketPrice),
  };
}

export function skuSortKey(workspaceId: string, sku: string) {
  return `${workspaceId}:${normalizeInventorySku(sku)}`;
}

function allowedQrActions(permissions: string[]): QrInventoryAction[] {
  const allowed: QrInventoryAction[] = [];
  if (permissions.includes("inventory.read")) allowed.push("inventory.open");
  if (permissions.includes("storage.move")) allowed.push("storage.move");
  if (permissions.includes("pos.sell")) allowed.push("pos.add_to_cart");
  if (permissions.includes("inventory.audit")) allowed.push("audit.mark_present");
  if (permissions.includes("card_show.sell")) allowed.push("card_show.add_to_sale");
  return allowed;
}

function finiteMoney(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function defaultRandomBytes(length: number) {
  const bytes = new Uint8Array(length);
  const cryptoLike = globalThis.crypto;
  if (cryptoLike?.getRandomValues) return cryptoLike.getRandomValues(bytes);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}
