import type { SupabaseClient } from "@supabase/supabase-js";

import { createMockEbayAdapter, type EbayListingInput } from "./ebay.ts";

export type EbayPublishSummary = { attempted: number; published: number; blocked: number; failed: number; alreadyActive: number; results: Array<Record<string, unknown>> };

function inputFromCandidate(candidate: Record<string, unknown>): EbayListingInput {
  return {
    tradingDocksCandidateId: String(candidate.id), inventoryItemId: String(candidate.inventory_item_id), cardName: String(candidate.card_name ?? ""),
    setCode: candidate.set_code as string | null, collectorNumber: candidate.collector_number as string | null, game: candidate.game_id as string | null,
    condition: candidate.condition as string | null, listingPrice: candidate.listing_price as number | null, quantity: Number(candidate.quantity ?? 0),
    imageUrls: candidate.image_source ? [String(candidate.image_source).startsWith("http") ? String(candidate.image_source) : `https://catalog.invalid/${candidate.image_source}`] : [],
    categoryId: candidate.category_id as string | null, sellerAccountId: candidate.seller_account_id as string | null,
    merchantLocationKey: candidate.merchant_location_key as string | null, fulfillmentPolicyId: candidate.fulfillment_policy_id as string | null,
    paymentPolicyId: candidate.payment_policy_id as string | null, returnPolicyId: candidate.return_policy_id as string | null,
    itemSpecifics: (candidate.item_specifics ?? {}) as Record<string, string[]>,
  };
}

export async function publishCandidatesInMockMode({ supabase, userId, workspaceId, candidateIds }: { supabase: SupabaseClient; userId: string; workspaceId: string; candidateIds: string[] }): Promise<EbayPublishSummary> {
  const { data: candidates, error } = await supabase.from("selling_listing_candidates").select("*").eq("user_id", userId).eq("workspace_id", workspaceId).in("id", candidateIds);
  if (error) throw new Error(error.message);
  const adapter = createMockEbayAdapter();
  const summary: EbayPublishSummary = { attempted: candidateIds.length, published: 0, blocked: 0, failed: 0, alreadyActive: 0, results: [] };
  for (const candidate of candidates ?? []) {
    const input = inputFromCandidate(candidate as Record<string, unknown>);
    const prepared = adapter.prepare(input);
    const existing = await supabase.from("selling_marketplace_listings").select("id,normalized_status,external_listing_id").eq("candidate_id", candidate.id).eq("workspace_id", workspaceId).eq("marketplace_id", "ebay").maybeSingle();
    if (existing.data?.normalized_status === "ACTIVE") { summary.alreadyActive += 1; summary.results.push({ candidateId: candidate.id, status: "ALREADY_ACTIVE" }); continue; }
    if (!prepared.ok || !prepared.value) {
      summary.blocked += 1;
      summary.results.push({ candidateId: candidate.id, status: "BLOCKED", error: prepared.error?.message ?? "eBay requirements are incomplete." });
      continue;
    }
    const now = new Date().toISOString();
    const { data: listing, error: listingError } = await supabase.from("selling_marketplace_listings").upsert({
      user_id: userId, workspace_id: workspaceId, candidate_id: candidate.id, marketplace_id: "ebay", sku: prepared.value.sku,
      title: prepared.value.title, category_id: prepared.value.categoryId, quantity: prepared.value.quantity, price: prepared.value.price,
      condition_mapping: prepared.value.condition, image_references: prepared.value.imageUrls, prepared_payload: prepared.value,
      normalized_status: "ACTIVE", lifecycle_status: "ACTIVE", marketplace_status: "MOCK_ACTIVE", environment: "mock",
      external_listing_id: `MOCK-${prepared.value.sku}`, external_offer_id: `MOCK-OFFER-${prepared.value.sku}`, external_status: "ACTIVE",
      last_publish_attempt: now, last_successful_publish: now, last_sync_at: now, last_error: null, updated_at: now,
    }, { onConflict: "workspace_id,candidate_id,marketplace_id" }).select("id").single();
    if (listingError || !listing) { summary.failed += 1; summary.results.push({ candidateId: candidate.id, status: "FAILED", error: listingError?.message ?? "Listing state could not be saved." }); continue; }
    await supabase.from("selling_marketplace_operations").insert([
      { user_id: userId, workspace_id: workspaceId, listing_id: listing.id, candidate_id: candidate.id, marketplace_id: "ebay", operation: "publish_requested", normalized_result: "QUEUED", metadata: { environment: "mock" } },
      { user_id: userId, workspace_id: workspaceId, listing_id: listing.id, candidate_id: candidate.id, marketplace_id: "ebay", operation: "publish_succeeded", normalized_result: "ACTIVE", external_inventory_id: prepared.value.sku, external_offer_id: `MOCK-OFFER-${prepared.value.sku}`, external_listing_id: `MOCK-${prepared.value.sku}`, metadata: { environment: "mock" } },
    ]);
    summary.published += 1; summary.results.push({ candidateId: candidate.id, status: "PUBLISHED", listingId: listing.id, environment: "mock" });
  }
  return summary;
}
