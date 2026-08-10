import { NextResponse } from "next/server";

import { requireApiCapability } from "@/lib/platform/server-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScryfallMtgSetIdentities } from "@/lib/mtg/set-identity";
import { resolveTcgplayerVariant } from "@/lib/tcgplayer-catalog";
import type { SupabaseCatalogResolverClient } from "@/lib/tcgplayer-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InputRow = {
  name?: unknown;
  set?: unknown;
  setName?: unknown;
  collectorNumber?: unknown;
  condition?: unknown;
  finish?: unknown;
};

export async function POST(request: Request) {
  const capability = await requireApiCapability("csv.export");
  if (!capability.ok) return capability.response;

  const body = await request.json().catch(() => null) as { rows?: unknown } | null;
  if (!body || !Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 500) {
    return NextResponse.json({ error: "Send between 1 and 500 rows per request." }, { status: 400 });
  }

  const client = createAdminClient() as unknown as SupabaseCatalogResolverClient;
  const rows = body.rows.map(cleanRow);
  const setIdentities = await getScryfallMtgSetIdentities();
  const results = [];

  for (const row of rows) {
    const setName = row.setName || row.set;
    if (!row.name || !setName || !row.collectorNumber || !row.condition || !row.finish) {
      results.push({
        status: "unresolved",
        reason: "Name, set, collector number, condition, and foil status are required.",
      });
      continue;
    }
    if (row.finish === "etched") {
      results.push({
        status: "unresolved",
        reason: "Etched foil SKU resolution is not supported by the current TCGplayer catalog contract.",
      });
      continue;
    }

    try {
      const result = await resolveTcgplayerVariant(client, {
        productName: row.name,
        setName: row.setName,
        setCode: row.set,
        collectorNumber: row.collectorNumber,
        condition: row.condition,
        finish: row.finish,
        setIdentities,
      });

      if (result.status === "matched") {
        results.push({
          status: "matched",
          tcgplayerId: String(result.tcgplayerId),
          productLine: result.row.product_line,
          setName: result.row.set_name,
          productName: result.row.product_name,
          title: result.row.title ?? "",
          collectorNumber: result.row.collector_number ?? "",
          rarity: result.row.rarity ?? "",
          condition: result.row.condition,
          finish: result.row.finish,
          marketPrice: money(result.row.tcg_market_price),
          directLowPrice: money(result.row.tcg_direct_low),
          lowPrice: money(result.row.tcg_low_price_with_shipping ?? result.row.tcg_low_price),
          marketplacePrice: money(result.row.tcg_marketplace_price),
          photoUrl: result.row.photo_url ?? "",
          diagnostics: result.diagnostics,
        });
      } else {
        results.push({
          status: result.status,
          reason: result.reason,
          reasonCode: result.reasonCode,
          diagnostics: result.diagnostics,
          candidates: result.status === "ambiguous"
            ? result.candidates.map((candidate) => ({
              tcgplayerId: String(candidate.tcgplayer_id),
              setName: candidate.set_name,
              productName: candidate.product_name,
              collectorNumber: candidate.collector_number ?? "",
              condition: candidate.condition,
              finish: candidate.finish,
            }))
            : [],
        });
      }
    } catch (error) {
      results.push({
        status: "unresolved",
        reason: error instanceof Error ? error.message : "Could not resolve TCGplayer ID.",
      });
    }
  }

  return NextResponse.json({ source: "Trading Docks TCGplayer Catalog", results });
}

function cleanRow(row: InputRow) {
  return {
    name: stringValue(row.name, 250),
    set: stringValue(row.set, 250),
    setName: stringValue(row.setName, 250),
    collectorNumber: stringValue(row.collectorNumber, 60),
    condition: stringValue(row.condition, 80),
    finish: normalizeFinish(stringValue(row.finish, 40)),
  };
}

function stringValue(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeFinish(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || ["normal", "regular", "nonfoil", "non-foil", "false", "no", "0"].includes(normalized)) return "normal";
  if (normalized.includes("etched")) return "etched";
  if (normalized.includes("foil") && !normalized.includes("etched")) return "foil";
  return value;
}

function money(value: number | null) {
  return value == null ? "" : String(value);
}
