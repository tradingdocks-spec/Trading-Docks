import { NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  let query = createAdminClient().from("marketing_prospects").select("*").order("updated_at", { ascending: false }).limit(200);
  if (search) query = query.or(`business_name.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%,postal_code.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: migrationMessage(error.message) }, { status: 503 });
  return NextResponse.json({ prospects: data ?? [] });
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const store = body?.store && typeof body.store === "object" ? body.store as Record<string, unknown> : null;
  if (!store || typeof store.providerPlaceId !== "string" || typeof store.businessName !== "string") return NextResponse.json({ error: "A valid store result is required." }, { status: 400 });
  const row = {
    provider: "google_places", provider_place_id: store.providerPlaceId, business_name: store.businessName, address: stringValue(store.address), city: stringValue(store.city), state: stringValue(store.state), postal_code: stringValue(store.postalCode), latitude: numberValue(store.latitude), longitude: numberValue(store.longitude), distance_miles: numberValue(store.distanceMiles), phone: nullableString(store.phone), website_url: nullableString(store.websiteUrl), listing_url: nullableString(store.listingUrl), category: nullableString(store.category), provider_data: { openNow: store.openNow, sourcePhrase: store.sourcePhrase }, created_by: actor.user.id,
  };
  const admin = createAdminClient();
  const existing = await admin.from("marketing_prospects").select("*").eq("provider", "google_places").eq("provider_place_id", row.provider_place_id).maybeSingle();
  if (existing.data) return NextResponse.json({ prospect: existing.data, alreadySaved: true });
  const { data, error } = await admin.from("marketing_prospects").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: migrationMessage(error.message) }, { status: 503 });
  await admin.from("marketing_activities").insert({ prospect_id: data.id, actor_user_id: actor.user.id, activity_type: "prospect_saved", body: "Saved from Store Finder." });
  return NextResponse.json({ prospect: data, alreadySaved: false }, { status: 201 });
}

export async function PATCH(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown; notes?: unknown; tags?: unknown; publicEmail?: unknown; contactName?: unknown; contactEmailVerified?: unknown } | null;
  if (typeof body?.id !== "string") return NextResponse.json({ error: "Prospect ID is required." }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (typeof body.status === "string") updates.status = body.status;
  if (typeof body.notes === "string") updates.notes = body.notes.slice(0, 10000);
  if (Array.isArray(body.tags)) updates.tags = body.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 20);
  if (typeof body.publicEmail === "string") { updates.public_email = body.publicEmail.trim().toLowerCase(); updates.public_email_normalized = body.publicEmail.trim().toLowerCase(); }
  if (typeof body.contactName === "string") updates.contact_name = body.contactName.slice(0, 200);
  if (typeof body.contactEmailVerified === "boolean") updates.contact_email_verified = body.contactEmailVerified;
  if (updates.status === "do_not_contact") { updates.suppressed = true; updates.suppression_reason = "Administrator marked do not contact"; }
  const admin = createAdminClient();
  const { data, error } = await admin.from("marketing_prospects").update(updates).eq("id", body.id).select("*").single();
  if (error) return NextResponse.json({ error: migrationMessage(error.message) }, { status: 503 });
  await admin.from("marketing_activities").insert({ prospect_id: body.id, actor_user_id: actor.user.id, activity_type: updates.status === "do_not_contact" ? "suppressed" : "prospect_updated", body: updates.status === "do_not_contact" ? "Marked Do Not Contact by an administrator." : "Prospect details updated.", metadata: updates });
  return NextResponse.json({ prospect: data });
}

function stringValue(value: unknown) { return typeof value === "string" ? value.slice(0, 500) : ""; }
function nullableString(value: unknown) { const text = stringValue(value); return text || null; }
function numberValue(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function migrationMessage(message: string) { return /relation .* does not exist|schema cache/i.test(message) ? "Marketing CRM is not initialized. Apply the documented Supabase migration in staging first." : message; }
