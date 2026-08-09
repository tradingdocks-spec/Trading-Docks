import { isTradingDocksSku, type QrInventoryAction } from "./inventory-identity.ts";

export type PosLookupInputKind =
  | "trading_docks_qr"
  | "trading_docks_sku"
  | "upc"
  | "barcode"
  | "card_scanner_result"
  | "manual_search";

export type PosLookupInput = {
  kind: PosLookupInputKind;
  value: string;
  workspaceId: string;
};

export type PosCartItemContract = {
  source: PosLookupInputKind;
  workspaceId: string;
  inventorySku?: string | null;
  inventoryItemId?: string | null;
  sealedProductId?: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number | null;
  allowedAction: Extract<QrInventoryAction, "pos.add_to_cart">;
};

export function classifyPosLookupInput(input: PosLookupInput): PosLookupInputKind {
  const value = input.value.trim();
  if (/^https?:\/\/(?:www\.)?tradingdocks\.com\/q\/[A-Za-z0-9]+$/.test(value) || /^\/q\/[A-Za-z0-9]+$/.test(value)) {
    return "trading_docks_qr";
  }
  if (isTradingDocksSku(value)) return "trading_docks_sku";
  if (/^\d{8,14}$/.test(value)) return "upc";
  return input.kind;
}

export function buildPosCartItemContract(input: {
  source: PosLookupInputKind;
  workspaceId: string;
  itemName: string;
  unitPrice?: number | null;
  inventorySku?: string | null;
  inventoryItemId?: string | null;
  sealedProductId?: string | null;
  quantity?: number;
}): PosCartItemContract {
  return {
    source: input.source,
    workspaceId: input.workspaceId,
    inventorySku: input.inventorySku ?? null,
    inventoryItemId: input.inventoryItemId ?? null,
    sealedProductId: input.sealedProductId ?? null,
    itemName: input.itemName,
    quantity: Math.max(1, Math.floor(input.quantity ?? 1)),
    unitPrice: typeof input.unitPrice === "number" && Number.isFinite(input.unitPrice) ? input.unitPrice : null,
    allowedAction: "pos.add_to_cart",
  };
}
