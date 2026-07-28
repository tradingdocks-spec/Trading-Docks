import type {
  SealedProductSearchResult,
  TcgCsvCategory,
  TcgCsvGroup,
} from "./types";

type SyncPayload = {
  categories: TcgCsvCategory[];
  groups: TcgCsvGroup[];
  products: SealedProductSearchResult[];
};

export async function syncTcgCsvToSupabase(
  payload: SyncPayload,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return {
      synced: false,
      reason:
        "Supabase service credentials are not configured.",
    };
  }

  await upsert(
    url,
    serviceKey,
    "tcg_categories",
    payload.categories.map((category) => ({
      category_id: category.categoryId,
      name: category.name,
      display_name:
        category.displayName ?? category.name,
      sealed_label: category.sealedLabel ?? null,
      modified_on: category.modifiedOn ?? null,
      synced_at: new Date().toISOString(),
    })),
    "category_id",
  );

  await upsert(
    url,
    serviceKey,
    "tcg_groups",
    payload.groups.map((group) => ({
      group_id: group.groupId,
      category_id: group.categoryId,
      name: group.name,
      abbreviation: group.abbreviation ?? null,
      published_on: group.publishedOn ?? null,
      modified_on: group.modifiedOn ?? null,
      synced_at: new Date().toISOString(),
    })),
    "group_id",
  );

  await upsert(
    url,
    serviceKey,
    "tcg_products",
    payload.products.map((product) => ({
      product_id: product.productId,
      category_id: product.categoryId,
      group_id: product.groupId,
      name: product.name,
      clean_name: product.cleanName,
      product_type: product.productType,
      image_url: product.imageUrl,
      product_url: product.productUrl,
      is_sealed: true,
      is_presale: product.isPresale,
      released_on: product.releasedOn,
      modified_on: product.modifiedOn,
      synced_at: new Date().toISOString(),
    })),
    "product_id",
  );

  const priceRows = payload.products.flatMap((product) =>
    (product.allPrices.length
      ? product.allPrices
      : [
          {
            productId: product.productId,
            subTypeName: product.priceSubtype,
            lowPrice: product.lowPrice,
            midPrice: product.midPrice,
            marketPrice: product.marketPrice,
            directLowPrice: product.directLowPrice,
          },
        ]
    ).map((price) => ({
      product_id: product.productId,
      subtype_name:
        price.subTypeName ?? "Sealed",
      low_price: price.lowPrice ?? null,
      mid_price: price.midPrice ?? null,
      high_price: price.highPrice ?? null,
      market_price: price.marketPrice ?? null,
      direct_low_price:
        price.directLowPrice ?? null,
      captured_at: new Date().toISOString(),
    })),
  );

  await upsert(
    url,
    serviceKey,
    "tcg_current_prices",
    priceRows,
    "product_id,subtype_name",
  );

  await insert(
    url,
    serviceKey,
    "tcg_price_history",
    priceRows,
  );

  return {
    synced: true,
    categories: payload.categories.length,
    groups: payload.groups.length,
    products: payload.products.length,
    prices: priceRows.length,
  };
}

async function upsert(
  baseUrl: string,
  serviceKey: string,
  table: string,
  rows: unknown[],
  conflict: string,
) {
  if (!rows.length) return;

  const response = await fetch(
    `${baseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(
      conflict,
    )}`,
    {
      method: "POST",
      headers: headers(serviceKey, {
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(rows),
    },
  );

  if (!response.ok) {
    throw new Error(
      `${table} upsert failed: ${await response.text()}`,
    );
  }
}

async function insert(
  baseUrl: string,
  serviceKey: string,
  table: string,
  rows: unknown[],
) {
  if (!rows.length) return;

  const response = await fetch(
    `${baseUrl}/rest/v1/${table}`,
    {
      method: "POST",
      headers: headers(serviceKey, {
        Prefer: "return=minimal",
      }),
      body: JSON.stringify(rows),
    },
  );

  if (!response.ok) {
    throw new Error(
      `${table} insert failed: ${await response.text()}`,
    );
  }
}

function headers(
  serviceKey: string,
  extra: Record<string, string>,
) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}
