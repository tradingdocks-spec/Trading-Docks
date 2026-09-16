import {
  normalizeCardCondition,
  normalizeCardFinish,
  type CardCondition,
  type CardFinish,
} from "../../mobile/services/collector-workspace.ts";

export type CollectionLocationImportRow = {
  name?: string | null;
  set?: string | null;
  setCode?: string | null;
  collectorNumber?: string | null;
  condition?: string | null;
  finish?: string | null;
  quantity?: string | number | null;
  storageLocation?: string | null;
  storagePath?: string | null;
  tcgplayerId?: string | number | null;
  tcgplayerSkuId?: string | number | null;
};

export type ReviewedCollectionLocationImportRow = {
  ok: boolean;
  name: string;
  setCode: string | null;
  collectorNumber: string | null;
  condition: CardCondition;
  finish: CardFinish;
  quantity: number;
  storagePath: string | null;
  tcgplayerId: number | null;
  tcgplayerSkuId: number | null;
  issues: string[];
};

export function reviewCollectionLocationImportRow(row: CollectionLocationImportRow): ReviewedCollectionLocationImportRow {
  const name = stringValue(row.name).trim();
  const setCode = (stringValue(row.setCode) || stringValue(row.set)).trim().toUpperCase() || null;
  const collectorNumber = stringValue(row.collectorNumber).trim() || null;
  const condition = normalizeCardCondition(row.condition);
  const finish = normalizeCardFinish(row.finish);
  const quantity = positiveInteger(row.quantity);
  const storagePath = normalizeStoragePath(stringValue(row.storagePath) || stringValue(row.storageLocation));
  const tcgplayerId = positiveNumericId(row.tcgplayerId);
  const tcgplayerSkuId = positiveNumericId(row.tcgplayerSkuId);
  const issues: string[] = [];

  if (!name) issues.push("missing_name");
  if (quantity <= 0) issues.push("invalid_quantity");
  if (condition === "unknown") issues.push("unknown_condition");
  if (finish === "unknown") issues.push("unknown_finish");

  return {
    ok: issues.length === 0,
    name,
    setCode,
    collectorNumber,
    condition,
    finish,
    quantity,
    storagePath,
    tcgplayerId,
    tcgplayerSkuId,
    issues,
  };
}

export function normalizeStoragePath(value: string) {
  const clean = value
    .split(/[>›/]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" / ");
  return clean || null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function positiveInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function positiveNumericId(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
