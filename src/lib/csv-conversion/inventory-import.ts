import { createHash } from "node:crypto";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid import row.");
  return value as Record<string, unknown>;
}

function text(value: unknown, max = 250) {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > max) throw new Error("An import field is invalid or too long.");
  return value.trim();
}

function number(value: unknown, fallback: number) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Invalid import number.");
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > 1_000_000_000) throw new Error("Invalid import number.");
  return result;
}

// Content identity survives refreshes, duplicate uploads, and lost responses.
export function prepareInventoryImport(input: unknown) {
  const body = record(input);
  const locationName = text(body.locationName, 160);
  if (!locationName) throw new Error("Choose a storage location.");
  if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 5000) throw new Error("Import between 1 and 5000 rows at a time.");
  const marketplace = text(body.marketplace, 100) || "Unlisted";
  const items = body.rows.map((value) => {
    const row = record(value);
    const name = text(row.name);
    const quantity = number(row.quantity, 1);
    if (!name || !Number.isInteger(quantity) || quantity < 1) throw new Error("Each card needs a name and a positive whole quantity.");
    const unitMarketValue = number(row.marketPrice, 0);
    return {
      name, quantity, sku: text(row.sku), category: "Single",
      condition: text(row.condition) || "Near Mint", finish: text(row.finish) || "Nonfoil",
      set: text(row.set).toUpperCase(), collectorNumber: text(row.collectorNumber),
      language: text(row.language) || "English", scryfallId: text(row.scryfallId),
      tcgplayerId: text(row.tcgplayerId), costBasis: number(row.costBasis, 0), unitMarketValue,
      marketplaceListings: marketplace === "Unlisted" ? [] : [{ platform: marketplace, status: "Active", quantity, price: unitMarketValue }],
    };
  }).sort((a, b) => {
    const left = JSON.stringify(a); const right = JSON.stringify(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const payload = { locationName, items };
  const importKey = createHash("sha256").update(JSON.stringify({ ...payload, locationName: locationName.toLowerCase() })).digest("hex");
  return { payload, importKey };
}
