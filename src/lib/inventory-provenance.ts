export type InventoryProvenance = {
  positionId: string;
  inventoryItemId: string;
  batchId: string | null;
  batchCode: string | null;
  batchTitle: string | null;
  position: number | null;
  quantity: number;
  locationId: string | null;
  condition: string | null;
  finish: string | null;
  language: string | null;
};

export function matchesInventorySearch(values: unknown[], query: string) {
  const haystack = values
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase()
    .replace(/[’']/g, "");
  return query
    .toLocaleLowerCase()
    .replace(/[’']/g, "")
    .replace(/[-_/]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => term.replace(/^#/, ""))
    .filter(Boolean)
    .every((term) => haystack.includes(term) || (/^[a-z]{5,}s$/.test(term) && haystack.includes(term.slice(0, -1))));
}

type SupabaseLike = {
  from: (table: string) => any;
};

export async function loadInventoryProvenance(
  supabase: SupabaseLike,
  userId: string,
  itemIds: string[],
): Promise<InventoryProvenance[]> {
  // Empty means no items, never permission to scan another source unbounded.
  if (!itemIds.length) return [];
  // Bound IN filters by encoded bytes, not just item count (Chaos IDs are long).
  const chunks: string[][] = [];
  let chunk: string[] = [];
  let bytes = 0;
  for (const id of [...new Set(itemIds)]) {
    const size = encodeURIComponent(id).length + 4;
    if (size > 4000) throw new Error("Inventory identity is too long for a provenance lookup.");
    if (bytes + size > 4000) { chunks.push(chunk); chunk = []; bytes = 0; }
    chunk.push(id); bytes += size;
  }
  if (chunk.length) chunks.push(chunk);
  const result: InventoryProvenance[] = [];
  for (let start = 0; start < chunks.length; start += 4) {
    const pages = await Promise.all(chunks.slice(start, start + 4).map((ids) => loadProvenanceChunk(supabase, userId, ids)));
    result.push(...pages.flat());
  }
  return result;
}

async function loadProvenanceChunk(supabase: SupabaseLike, userId: string, itemIds: string[]): Promise<InventoryProvenance[]> {
  const allPositions: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += 250) {
    const positionsQuery = supabase
      .from("chaos_sort_inventory_positions")
      .select("id,item_id,batch_id,position,quantity,location_id,condition,finish,language")
      .eq("user_id", userId)
      .gt("quantity", 0)
      .in("item_id", itemIds)
      .order("id", { ascending: true })
      .range(offset, offset + 249);
    const { data: positions, error: positionsError } = await positionsQuery;
    if (positionsError) {
      if (isMissingRelation(positionsError.message)) return [];
      throw new Error(`Inventory provenance is unavailable: ${positionsError.message}`);
    }

    allPositions.push(...(positions ?? []));
    if ((positions ?? []).length < 250) break;
  }
  const rows = allPositions;
  const batchIds = [...new Set(rows.map((row) => stringValue(row.batch_id)).filter(Boolean))];
  const batchById = new Map<string, { batchCode: string | null; batchTitle: string | null }>();
  for (let offset = 0; offset < batchIds.length; offset += 50) {
    const { data: batches, error: batchesError } = await supabase
      .from("chaos_sort_batches")
      .select("id,batch_code,title")
      .eq("user_id", userId)
      .in("id", batchIds.slice(offset, offset + 50))
      .limit(50);
    if (batchesError && !isMissingRelation(batchesError.message)) {
      throw new Error(`Inventory batch provenance is unavailable: ${batchesError.message}`);
    }
    for (const batch of (batches ?? []) as Array<Record<string, unknown>>) {
      const id = stringValue(batch.id);
      if (id) batchById.set(id, { batchCode: stringValue(batch.batch_code), batchTitle: stringValue(batch.title) });
    }
  }

  return rows.flatMap((row) => {
    const positionId = stringValue(row.id);
    const inventoryItemId = stringValue(row.item_id);
    if (!positionId || !inventoryItemId) return [];
    const batchId = stringValue(row.batch_id);
    const batch = batchId ? batchById.get(batchId) : undefined;
    return [{
      positionId,
      inventoryItemId,
      batchId: batchId ?? null,
      batchCode: batch?.batchCode ?? null,
      batchTitle: batch?.batchTitle ?? null,
      position: numberValue(row.position),
      quantity: Math.max(0, numberValue(row.quantity) ?? 0),
      locationId: stringValue(row.location_id),
      condition: stringValue(row.condition),
      finish: stringValue(row.finish),
      language: stringValue(row.language),
    }];
  });
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function isMissingRelation(message: unknown) {
  return typeof message === "string" && /does not exist|schema cache|relation .* not found/i.test(message);
}
