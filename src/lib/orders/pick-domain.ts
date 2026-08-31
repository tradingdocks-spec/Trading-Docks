export type PhysicalLocation = {
  id: string;
  name: string;
  pathLabel: string;
  sortKey: string;
};

export type PickTaskState = "ready" | "found" | "missing";

export type PickTask = {
  id: string;
  title: string;
  quantity: number;
  imageUrl: string | null;
  condition: string | null;
  language: string | null;
  finish: string | null;
  physicalLocation: PhysicalLocation | null;
  state: PickTaskState;
  expectedLocationLabel: string;
};

type InventoryLocationRow = {
  id: string;
  name?: string | null;
  location_type?: string | null;
  data?: Record<string, unknown> | null;
};

type InventoryItemRow = {
  id: string;
  card_name?: string | null;
  set_code?: string | null;
  collector_number?: string | null;
  location_id?: string | null;
  quantity?: number | null;
  data?: Record<string, unknown> | null;
};

type OrderItemLike = {
  id?: string | null;
  title?: string | null;
  quantity?: number | string | null;
  image_url?: string | null;
  condition?: string | null;
  language?: string | null;
  finish?: string | null;
  external_sku?: string | null;
};

export function buildPhysicalLocationMap(rows: InventoryLocationRow[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const labels = new Map<string, string>();
  for (const row of rows) {
    const nodes: string[] = [];
    const seen = new Set<string>();
    let current: InventoryLocationRow | undefined = row;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      nodes.unshift(locationName(current));
      const parentId = stringValue(current.data?.parentId);
      current = parentId ? byId.get(parentId) : undefined;
    }
    labels.set(row.id, nodes.join(" › "));
  }
  return labels;
}

export function resolveOrderItemPhysicalLocation(
  item: OrderItemLike,
  inventoryRows: InventoryItemRow[],
  locations: InventoryLocationRow[],
): PhysicalLocation | null {
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const labels = buildPhysicalLocationMap(locations);
  const title = normalize(item.title);
  const sku = normalize(item.external_sku);
  const match = inventoryRows.find((row) => {
    const data = row.data ?? {};
    const nameMatch = normalize(row.card_name ?? data.cardName) === title;
    const skuMatch = sku && normalize(data.sku) === sku;
    return Boolean(row.location_id) && (nameMatch || skuMatch);
  });
  if (!match?.location_id) return null;
  const location = locationById.get(match.location_id);
  if (!location) return null;
  const pathLabel = labels.get(location.id) ?? locationName(location);
  return { id: location.id, name: locationName(location), pathLabel, sortKey: pathLabel };
}

export function buildDeterministicPickTasks(
  items: Array<OrderItemLike & { physicalLocation?: PhysicalLocation | null }>,
): PickTask[] {
  return [...items]
    .map((item, itemIndex) => ({
      id: item.id ?? `${item.title ?? "line-item"}-${itemIndex}`,
      title: item.title ?? "Unnamed card",
      quantity: Math.max(1, Number(item.quantity) || 1),
      imageUrl: item.image_url ?? null,
      condition: item.condition ?? null,
      language: item.language ?? null,
      finish: item.finish ?? null,
      physicalLocation: item.physicalLocation ?? null,
      state: "ready" as const,
      expectedLocationLabel: item.physicalLocation?.pathLabel ?? "LOCATION UNKNOWN",
    }))
    .sort((a, b) => {
      if (!a.physicalLocation && b.physicalLocation) return 1;
      if (a.physicalLocation && !b.physicalLocation) return -1;
      const locationCompare = a.physicalLocation && b.physicalLocation
        ? compareNatural(a.physicalLocation.sortKey, b.physicalLocation.sortKey)
        : 0;
      if (locationCompare) return locationCompare;
      return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    });
}

export function markPickTask(tasks: PickTask[], taskId: string, state: Exclude<PickTaskState, "ready">) {
  return tasks.map((task) => task.id === taskId ? { ...task, state } : task);
}

export function pickLocationCount(tasks: PickTask[]) {
  return new Set(tasks.map((task) => task.physicalLocation?.id ?? "unknown")).size;
}

function locationName(row: InventoryLocationRow) {
  const dataName = stringValue(row.data?.name);
  return dataName || row.name?.trim() || "Unnamed location";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function compareNatural(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
