import type { CollectionCard, RawInventoryItem, RawInventoryLocation } from './collector-workspace.ts';

export type StorageLocationType =
  | 'area'
  | 'shelf'
  | 'container'
  | 'section'
  | 'slot'
  | 'binder'
  | 'box'
  | 'sealed'
  | 'bulk'
  | 'custom'
  | 'unknown';

export type StorageLocation = {
  id: string;
  userId: string;
  name: string;
  type: StorageLocationType;
  parentId: string | null;
  archivedAt: string | null;
  favorite: boolean;
  recentUsedAt: string | null;
  description?: string | null;
};

export type StorageLocationPath = {
  locationId: string;
  nodes: Pick<StorageLocation, 'id' | 'name' | 'type'>[];
  label: string;
  complete: boolean;
};

export type LocationAssignment = {
  userId: string;
  inventoryItemId: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  queued?: boolean;
};

export type LocationSummary = StorageLocation & {
  path: StorageLocationPath;
  assignedCardCount: number;
  assignedQuantity: number;
  childCount: number;
};

export type LocationManagerState = {
  locations: StorageLocation[];
  cards: CollectionCard[];
  summaries: LocationSummary[];
  unassignedCards: CollectionCard[];
  archivedLocations: LocationSummary[];
};

export type LocationMutationResult =
  | { ok: true }
  | { ok: false; code: 'unauthorized' | 'invalid_location' | 'invalid_parent' | 'assigned_cards' | 'archived_location'; reason: string };

export const STORAGE_LOCATION_QUEUE_TYPE = 'collector_storage_location_assignment';
export const STORAGE_LOCATION_TYPES: StorageLocationType[] = ['area', 'shelf', 'container', 'section', 'slot', 'binder', 'box', 'sealed', 'bulk', 'custom'];

export function buildStorageLocationManagerState({
  userId,
  rawLocations,
  cards,
}: {
  userId: string;
  rawLocations: RawInventoryLocation[];
  cards: CollectionCard[];
}): LocationManagerState {
  const locations = rawLocations.map((location) => buildStorageLocation(userId, location));
  const summaries = summarizeLocations(locations, cards).filter((location) => !location.archivedAt);
  const archivedLocations = summarizeLocations(locations, cards).filter((location) => Boolean(location.archivedAt));
  return {
    locations,
    cards,
    summaries,
    archivedLocations,
    unassignedCards: cards.filter((card) => !card.storageLocation),
  };
}

export function buildStorageLocation(userId: string, raw: RawInventoryLocation): StorageLocation {
  const data = raw.data ?? {};
  return {
    id: raw.id,
    userId,
    name: stringValue(data.name) || raw.name || 'Unnamed location',
    type: normalizeStorageLocationType(data.type ?? raw.location_type),
    parentId: stringValue(data.parentId) || null,
    archivedAt: stringValue(data.archivedAt) || null,
    favorite: booleanValue(data.favorite),
    recentUsedAt: stringValue(data.recentUsedAt) || null,
    description: stringValue(data.description) || null,
  };
}

export function summarizeLocations(locations: StorageLocation[], cards: CollectionCard[]): LocationSummary[] {
  const childrenByParent = new Map<string, number>();
  for (const location of locations) {
    if (location.parentId) childrenByParent.set(location.parentId, (childrenByParent.get(location.parentId) ?? 0) + 1);
  }
  return locations.map((location) => {
    const assigned = cards.filter((card) => card.storageLocation?.id === location.id);
    return {
      ...location,
      path: buildLocationPath(location.id, locations),
      assignedCardCount: assigned.length,
      assignedQuantity: assigned.reduce((sum, card) => sum + card.quantityOwned, 0),
      childCount: childrenByParent.get(location.id) ?? 0,
    };
  });
}

export function buildLocationPath(locationId: string, locations: StorageLocation[]): StorageLocationPath {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const nodes: StorageLocationPath['nodes'] = [];
  const seen = new Set<string>();
  let current = byId.get(locationId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    nodes.unshift({ id: current.id, name: current.name, type: current.type });
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return {
    locationId,
    nodes,
    label: nodes.length ? nodes.map((node) => node.name).join(' > ') : 'Storage location unavailable',
    complete: Boolean(nodes.length) && !current,
  };
}

export function formatLocationBreadcrumb(path: StorageLocationPath, separator = '›') {
  return path.nodes.length ? path.nodes.map((node) => node.name).join(` ${separator} `) : locationFallbackLabel(path.locationId);
}

export function childLocationOptions(parentId: string | null, locations: StorageLocation[]) {
  return locations.filter((location) => (location.parentId ?? null) === parentId && !location.archivedAt);
}

export function searchLocationSummaries(locations: LocationSummary[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return locations;
  return locations.filter((location) => `${location.name} ${location.path.label} ${location.type}`.toLowerCase().includes(normalized));
}

export function recentLocationSummaries(locations: LocationSummary[], limit = 5) {
  return locations
    .filter((location) => Boolean(location.recentUsedAt) && !location.archivedAt)
    .sort((a, b) => String(b.recentUsedAt).localeCompare(String(a.recentUsedAt)))
    .slice(0, limit);
}

export function favoriteLocationSummaries(locations: LocationSummary[]) {
  return locations.filter((location) => location.favorite && !location.archivedAt);
}

export function cardsInLocation(cards: CollectionCard[], locationId: string) {
  return cards.filter((card) => card.storageLocation?.id === locationId);
}

export function cardsInLocationTree(cards: CollectionCard[], locationId: string, locations: StorageLocation[]) {
  const ids = descendantLocationIds(locationId, locations);
  return cards.filter((card) => card.storageLocation?.id && ids.has(card.storageLocation.id));
}

export function descendantLocationIds(locationId: string, locations: StorageLocation[]) {
  const childrenByParent = new Map<string, string[]>();
  for (const location of locations) {
    if (!location.parentId) continue;
    const current = childrenByParent.get(location.parentId) ?? [];
    current.push(location.id);
    childrenByParent.set(location.parentId, current);
  }
  const ids = new Set<string>([locationId]);
  const queue = [locationId];
  while (queue.length) {
    const current = queue.shift() as string;
    for (const childId of childrenByParent.get(current) ?? []) {
      if (ids.has(childId)) continue;
      ids.add(childId);
      queue.push(childId);
    }
  }
  return ids;
}

export function validateLocationOwnership({
  requestedUserId,
  authenticatedUserId,
  location,
}: {
  requestedUserId: string;
  authenticatedUserId: string;
  location?: StorageLocation | null;
}): LocationMutationResult {
  if (requestedUserId !== authenticatedUserId) {
    return { ok: false, code: 'unauthorized', reason: 'You can only manage your own storage locations.' };
  }
  if (location && location.userId !== authenticatedUserId) {
    return { ok: false, code: 'unauthorized', reason: 'That storage location belongs to another account.' };
  }
  return { ok: true };
}

export function validateLocationParent(location: Pick<StorageLocation, 'id' | 'parentId'>, locations: StorageLocation[]): LocationMutationResult {
  if (!location.parentId) return { ok: true };
  if (location.parentId === location.id) return { ok: false, code: 'invalid_parent', reason: 'A location cannot be its own parent.' };
  const byId = new Map(locations.map((candidate) => [candidate.id, candidate]));
  let current = byId.get(location.parentId);
  const seen = new Set([location.id]);
  while (current) {
    if (seen.has(current.id)) return { ok: false, code: 'invalid_parent', reason: 'Location hierarchy cannot contain a cycle.' };
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return byId.has(location.parentId) ? { ok: true } : { ok: false, code: 'invalid_parent', reason: 'Choose an existing parent location.' };
}

export function validateLocationAssignment({
  assignment,
  authenticatedUserId,
  locations,
}: {
  assignment: LocationAssignment;
  authenticatedUserId: string;
  locations: StorageLocation[];
}): LocationMutationResult {
  if (assignment.userId !== authenticatedUserId) {
    return { ok: false, code: 'unauthorized', reason: 'You can only move cards in your own collection.' };
  }
  const location = assignment.toLocationId ? locations.find((candidate) => candidate.id === assignment.toLocationId) : null;
  if (assignment.toLocationId && !location) return { ok: false, code: 'invalid_location', reason: 'Choose an existing storage location.' };
  if (location?.archivedAt) return { ok: false, code: 'archived_location', reason: 'Archived locations cannot receive new card assignments.' };
  return validateLocationOwnership({ requestedUserId: assignment.userId, authenticatedUserId, location });
}

export function validateArchiveLocation(location: LocationSummary, mode: 'reject_if_assigned' | 'explicit_archive_with_assignments' = 'reject_if_assigned'): LocationMutationResult {
  if (location.assignedCardCount > 0 && mode === 'reject_if_assigned') {
    return {
      ok: false,
      code: 'assigned_cards',
      reason: 'Move cards or clear assignments before archiving this location.',
    };
  }
  return { ok: true };
}

export function locationAssignmentQueueKey(assignment: LocationAssignment) {
  return `${assignment.userId}:${assignment.inventoryItemId}:storage-location-assignment`;
}

export function createLocationPayload({
  id,
  userId,
  name,
  type,
  parentId = null,
  favorite = false,
}: {
  id: string;
  userId: string;
  name: string;
  type: StorageLocationType;
  parentId?: string | null;
  favorite?: boolean;
}) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Location name is required.');
  const normalizedType = normalizeStorageLocationType(type);
  return {
    id,
    user_id: userId,
    name: cleanName,
    location_type: normalizedType,
    data: {
      name: cleanName,
      type: normalizedType,
      parentId,
      favorite,
      archivedAt: null,
      recentUsedAt: null,
    },
  };
}

export function locationDataPatch(data: Record<string, unknown> | null | undefined, patch: Record<string, unknown>) {
  return { ...(data ?? {}), ...patch };
}

export function normalizeStorageLocationType(value: unknown): StorageLocationType {
  return typeof value === 'string' && STORAGE_LOCATION_TYPES.includes(value as StorageLocationType)
    ? value as StorageLocationType
    : 'unknown';
}

export function locationFallbackLabel(locationId: string | null | undefined) {
  return locationId ? 'Storage location unavailable' : 'Unassigned';
}

export function storageLocationPathForCard(card: CollectionCard, locations: StorageLocation[]) {
  if (!card.storageLocation?.id) return 'Unassigned';
  return buildLocationPath(card.storageLocation.id, locations).label;
}

export function rawItemsForLocation(items: RawInventoryItem[], locationId: string | null) {
  return items.filter((item) => (item.location_id ?? null) === locationId);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown) {
  return value === true || value === 'true';
}
