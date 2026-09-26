import { NextResponse } from "next/server";
import { getShowcaseTagAdmin } from "@/lib/showcase-tag-admin";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function GET() {
  const context = await getShowcaseTagAdmin();
  if ("error" in context) return json({ error: context.error }, context.status);
  const [{ data: tags, error: tagError }, { data: inventory, error: inventoryError }] = await Promise.all([
    context.supabase.from("storefront_tags").select("id,name,sort_order,created_at")
      .eq("workspace_id", context.workspaceId).order("sort_order").order("name").limit(300),
    context.supabase.from("inventory_items")
      .select("id,card_name,set_code,collector_number,quantity")
      .eq("user_id", context.ownerId).eq("workspace_id", context.workspaceId)
      .gt("quantity", 0).order("card_name").limit(500),
  ]);
  if (tagError || inventoryError) return json({ error: "Tag workspace data is temporarily unavailable." }, 503);
  const ids = (inventory ?? []).map((item) => item.id);
  const { data: assignments, error: assignmentError } = ids.length
    ? await context.supabase.from("storefront_inventory_tags")
      .select("inventory_item_id,tag_id").eq("workspace_id", context.workspaceId).in("inventory_item_id", ids)
    : { data: [], error: null };
  if (assignmentError) return json({ error: "Tag assignments are temporarily unavailable." }, 503);
  const { data: listings, error: listingError } = ids.length
    ? await context.supabase.from("storefront_listings").select("inventory_item_id,enabled,storefront_listing_price,price_status")
      .eq("workspace_id", context.workspaceId).in("inventory_item_id", ids)
    : { data: [], error: null };
  if (listingError) return json({ error: "Storefront listings are temporarily unavailable." }, 503);
  return json({ tags: tags ?? [], inventory: inventory ?? [], assignments: assignments ?? [], listings: listings ?? [] });
}

export async function POST(request: Request) {
  const context = await getShowcaseTagAdmin();
  if ("error" in context) return json({ error: context.error }, context.status);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return json({ error: "Invalid tag request." }, 400);

  if (body.action === "create") {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < 1 || name.length > 48) return json({ error: "Tag names must contain 1–48 characters." }, 400);
    const { data, error } = await context.supabase.from("storefront_tags")
      .insert({ workspace_id: context.workspaceId, name, created_by: context.user.id })
      .select("id,name,sort_order,created_at").single();
    if (error) return json({ error: error.code === "23505" ? "That tag already exists in this store." : "Tag could not be created." }, error.code === "23505" ? 409 : 400);
    return json({ tag: data }, 201);
  }

  if (body.action === "remove_tag") {
    const tagId = typeof body.tagId === "string" ? body.tagId : "";
    if (!tagId) return json({ error: "Choose a tag to remove." }, 400);
    const { error } = await context.supabase.from("storefront_tags").delete()
      .eq("workspace_id", context.workspaceId).eq("id", tagId);
    return error ? json({ error: "Tag could not be removed." }, 400) : json({ ok: true });
  }

  if (body.action === "apply" || body.action === "remove") {
    const tagId = typeof body.tagId === "string" ? body.tagId : "";
    const itemIds = Array.isArray(body.itemIds)
      ? [...new Set(body.itemIds.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 500)
      : [];
    if (!tagId || itemIds.length === 0) return json({ error: "Choose a tag and at least one inventory item." }, 400);
    if (body.action === "apply") {
      const rows = itemIds.map((inventory_item_id) => ({ workspace_id: context.workspaceId, user_id: context.ownerId, inventory_item_id, tag_id: tagId }));
      const { error } = await context.supabase.from("storefront_inventory_tags")
        .upsert(rows, { onConflict: "workspace_id,inventory_item_id,tag_id", ignoreDuplicates: true });
      return error ? json({ error: "Some tag assignments were not authorized or could not be saved." }, 403) : json({ ok: true, changed: rows.length });
    }
    const { error } = await context.supabase.from("storefront_inventory_tags").delete()
      .eq("workspace_id", context.workspaceId).eq("tag_id", tagId).in("inventory_item_id", itemIds);
    return error ? json({ error: "Tag assignments could not be removed." }, 403) : json({ ok: true });
  }
  if (body.action === "set_listing") {
    const itemIds = Array.isArray(body.itemIds)
      ? [...new Set(body.itemIds.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 500)
      : [];
    if (!itemIds.length || typeof body.enabled !== "boolean") return json({ error: "Choose inventory and a listing state." }, 400);
    if (body.enabled) {
      const { data: priced, error: priceError } = await context.supabase.from("storefront_listings")
        .select("inventory_item_id").eq("workspace_id", context.workspaceId)
        .in("inventory_item_id", itemIds).gt("storefront_listing_price", 0);
      if (priceError) return json({ error: "Listing prices are temporarily unavailable." }, 503);
      if (priced?.length !== itemIds.length) return json({ error: "A positive storefront price is required for every selected listing.", code: "PRICE_REQUIRED" }, 409);
      const { error } = await context.supabase.from("storefront_listings")
        .update({ enabled: true }).eq("workspace_id", context.workspaceId).in("inventory_item_id", itemIds);
      return error ? json({ error: "Some listings were not authorized or could not be saved." }, 403) : json({ ok: true, changed: itemIds.length });
    }
    const { error } = await context.supabase.from("storefront_listings").update({ enabled: false })
      .eq("workspace_id", context.workspaceId).in("inventory_item_id", itemIds);
    return error ? json({ error: "Listings could not be disabled." }, 403) : json({ ok: true, changed: itemIds.length });
  }
  return json({ error: "Unknown tag action." }, 400);
}
