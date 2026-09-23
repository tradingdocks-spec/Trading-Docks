import { buildInventorySearchFilterExpression, buildInventorySearchTerms } from "../../mobile/services/collector-workspace.ts";

/** Collection and global search use the authenticated client's RLS, never a service key.
 * Owner collection access does not inherit POS employee inventory delegation.
 * Workspace/location identities are returned intact; no cross-owner join is allowed.
 */
export const OWNED_INVENTORY_COLUMNS = "id, user_id, workspace_id, card_name, sku, location_id, game_id, product_type, provider_category_id, provider_product_id, provider_sku_id, tcgplayer_product_id, tcgplayer_sku_id, variant, language, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data";

export function ownedInventoryQuery(client: { from(table: string): any }, userId: string) {
  if (!userId) throw new Error("Authenticated inventory owner required.");
  return client.from("inventory_items").select(OWNED_INVENTORY_COLUMNS)
    .eq("user_id", userId).gt("quantity", 0);
}

/** A page stays below PostgREST's row cap. Callers must continue until exhausted. */
export async function readOwnedInventoryPage(client: { from(table: string): any }, userId: string, offset: number, search = "", locationIds: string[] = []) {
  let query = ownedInventoryQuery(client, userId);
  for (const term of buildInventorySearchTerms(search)) {
    // Treat PostgREST grammar as syntax, never user input. Plural/possessive
    // queries also match the singular name; SKU and collector tokens stay intact.
    const safe = term.replace(/[(),.\"\\]/g, " ").trim();
    if (!safe) continue;
    const alternatives = [safe, ...(/^[a-z]{5,}s$/.test(safe) ? [safe.slice(0,-1)] : [])];
    query = query.or(alternatives.map(value => buildInventorySearchFilterExpression(value, locationIds)).join(","));
  }
  const result = await query
    .order("id", { ascending: true }).range(offset, offset + 249);
  if (result.error) throw new Error(`Inventory search is unavailable: ${result.error.message}`);
  return result.data ?? [];
}
