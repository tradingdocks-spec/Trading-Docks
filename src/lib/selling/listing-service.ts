import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluateListingReadiness } from "./readiness.ts";

export type SellingCandidateRecord = {
  id: string;
  listing_batch_id: string;
  inventory_item_id: string;
  inventory_position_id: string | null;
  inventory_batch_id: string | null;
  location_id: string | null;
  card_name: string;
  game_id: string | null;
  set_code: string | null;
  collector_number: string | null;
  quantity: number;
  allocated_quantity: number;
  cost_basis: number | null;
  market_price: number | null;
  listing_price: number | null;
  condition: string | null;
  finish: string | null;
  language: string | null;
  readiness_code: string;
  readiness_message: string;
  lifecycle_status: string;
  source_provenance: Record<string, unknown>;
  image_source: string | null;
  selected_marketplaces: string[];
};

export type SellingListingBatch = {
  id: string;
  name: string;
  source: string;
  status: string;
  candidate_count: number;
  market_value: number | null;
  intended_value: number | null;
  projected_net: number | null;
  created_at: string;
  updated_at: string;
  candidates: SellingCandidateRecord[];
};

export async function loadSellingListingBatch({ supabase, userId, workspaceId, batchId }: { supabase: SupabaseClient; userId: string; workspaceId: string; batchId: string }): Promise<SellingListingBatch | null> {
  const [{ data: batch, error: batchError }, { data: candidates, error: candidateError }] = await Promise.all([
    supabase.from("selling_listing_batches").select("id,name,source,status,candidate_count,market_value,intended_value,projected_net,created_at,updated_at").eq("id", batchId).eq("user_id", userId).eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("selling_listing_candidates").select("id,listing_batch_id,inventory_item_id,inventory_position_id,inventory_batch_id,location_id,card_name,game_id,set_code,collector_number,quantity,allocated_quantity,cost_basis,market_price,listing_price,condition,finish,language,readiness_code,readiness_message,lifecycle_status,source_provenance,image_source,selected_marketplaces").eq("listing_batch_id", batchId).eq("user_id", userId).eq("workspace_id", workspaceId).order("card_name", { ascending: true }).limit(500),
  ]);
  if (batchError) throw new Error(`Listing batch is unavailable: ${batchError.message}`);
  if (candidateError) throw new Error(`Listing candidates are unavailable: ${candidateError.message}`);
  if (!batch) return null;
  return { ...batch, candidates: (candidates ?? []) as SellingCandidateRecord[] } as SellingListingBatch;
}

export function candidateReadiness(candidate: SellingCandidateRecord) {
  return evaluateListingReadiness({
    cardName: candidate.card_name,
    inventoryItemId: candidate.inventory_item_id,
    quantity: candidate.quantity,
    condition: candidate.condition,
    listingPrice: candidate.listing_price,
    marketplaceSelected: candidate.selected_marketplaces.length > 0,
    categorySelected: true,
    shippingPolicySelected: true,
    imageAvailable: Boolean(candidate.image_source),
  });
}

export function normalizeCandidatePatch(input: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  if (input.listingPrice !== undefined) {
    const price = Number(input.listingPrice);
    if (!Number.isFinite(price) || price < 0) throw new Error("Listing price must be zero or greater.");
    patch.listing_price = price;
  }
  for (const field of ["condition", "finish", "language"] as const) {
    if (input[field] !== undefined) {
      if (input[field] !== null && typeof input[field] !== "string") throw new Error(`${field} is invalid.`);
      patch[field] = input[field] === null ? null : String(input[field]).trim() || null;
    }
  }
  if (input.marketplaces !== undefined) {
    if (!Array.isArray(input.marketplaces) || input.marketplaces.some((value) => typeof value !== "string")) throw new Error("Marketplace selection is invalid.");
    patch.selected_marketplaces = [...new Set(input.marketplaces.map((value) => value.trim()).filter(Boolean))];
  }
  if (input.quantity !== undefined) {
    const quantity = Number(input.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Quantity must be a positive whole number.");
    patch.quantity = quantity;
  }
  return patch;
}
