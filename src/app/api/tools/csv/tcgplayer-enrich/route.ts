import { NextResponse } from "next/server";

import { getCategories, getGroups, getPrices, getProducts } from "@/lib/tcgcsv/client";
import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";
export const maxDuration = 60;

type InputRow = {
  name?: unknown;
  set?: unknown;
  setName?: unknown;
  collectorNumber?: unknown;
};

export async function POST(request: Request) {
  const capability = await requireApiCapability("csv.export");
  if (!capability.ok) return capability.response;
  const body = await request.json().catch(() => null) as { rows?: unknown } | null;
  if (!body || !Array.isArray(body.rows) || body.rows.length > 500) {
    return NextResponse.json({ error: "Send between 1 and 500 rows per request." }, { status: 400 });
  }
  const rows = body.rows.map(cleanRow);
  const categories = await getCategories();
  const magic = categories.find((category) =>
    `${category.name} ${category.displayName ?? ""}`.toLowerCase().includes("magic"),
  );
  if (!magic) return NextResponse.json({ error: "TCGCSV Magic category is unavailable." }, { status: 502 });
  const groups = await getGroups(magic.categoryId);
  const uniqueSetKeys = [...new Set(rows.map((row) => row.set || row.setName).filter(Boolean))];
  const groupData = new Map<number, Awaited<ReturnType<typeof getProducts>>>();
  const priceData = new Map<number, Awaited<ReturnType<typeof getPrices>>>();
  for (const setKey of uniqueSetKeys) {
    const group = matchGroup(groups, setKey);
    if (group && !groupData.has(group.groupId)) {
      const [products, prices] = await Promise.all([
        getProducts(magic.categoryId, group.groupId),
        getPrices(magic.categoryId, group.groupId),
      ]);
      groupData.set(group.groupId, products);
      priceData.set(group.groupId, prices);
    }
  }
  const results = rows.map((row) => {
    const group = matchGroup(groups, row.set || row.setName);
    if (!group) return { matched: false, reason: "Set not found in TCGCSV" };
    const products = groupData.get(group.groupId) ?? [];
    const candidates = products.filter((product) =>
      extendedValue(product.extendedData, "number") === normalizeNumber(row.collectorNumber),
    );
    const product =
      candidates.find((candidate) => namesMatch(candidate.name, row.name)) ??
      candidates[0] ??
      products.find((candidate) => namesMatch(candidate.name, row.name));
    if (!product) return { matched: false, reason: "Card printing not found in TCGCSV" };
    const prices = (priceData.get(group.groupId) ?? []).filter(
      (price) => price.productId === product.productId,
    );
    const market = [...prices].sort(
      (a, b) => Number(b.marketPrice ?? 0) - Number(a.marketPrice ?? 0),
    )[0];
    return {
      matched: true,
      tcgplayerProductId: String(product.productId),
      productName: product.name,
      setName: group.name,
      collectorNumber: extendedValue(product.extendedData, "number") || row.collectorNumber,
      rarity: extendedValue(product.extendedData, "rarity"),
      imageUrl: product.imageUrl ?? "",
      productLine: "Magic",
      marketPrice: market?.marketPrice == null ? "" : String(market.marketPrice),
      lowPrice: market?.lowPrice == null ? "" : String(market.lowPrice),
      directLowPrice: market?.directLowPrice == null ? "" : String(market.directLowPrice),
    };
  });
  return NextResponse.json({ source: "TCGCSV", results });
}

function cleanRow(row: InputRow) {
  return {
    name: stringValue(row.name, 250),
    set: stringValue(row.set, 30),
    setName: stringValue(row.setName, 250),
    collectorNumber: stringValue(row.collectorNumber, 40),
  };
}
function stringValue(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function matchGroup(groups: Awaited<ReturnType<typeof getGroups>>, value: string) {
  const wanted = normalize(value);
  if (!wanted) return undefined;
  return groups.find((group) => normalize(group.abbreviation ?? "") === wanted) ??
    groups.find((group) => normalize(group.name) === wanted) ??
    groups.find((group) => normalize(group.name).includes(wanted));
}
function extendedValue(data: { name: string; displayName?: string; value: string }[] | undefined, key: string) {
  const wanted = normalize(key);
  return data?.find((item) => normalize(`${item.name} ${item.displayName ?? ""}`).includes(wanted))?.value ?? "";
}
function namesMatch(left: string, right: string) {
  const a = normalize(left).replace(/borderless|extendedart|showcase/g, "");
  const b = normalize(right).replace(/borderless|extendedart|showcase/g, "");
  return a === b || a.includes(b) || b.includes(a);
}
function normalizeNumber(value: string) {
  return value.trim().toLowerCase().replace(/^0+/, "");
}
function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
