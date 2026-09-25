import { supabase } from '@/lib/supabase';
import { buildCollectionCards, type RawInventoryItem, type RawInventoryLocation } from '@/services/collector-workspace';
import {
  STORAGE_LOCATION_QUEUE_TYPE,
  buildStorageLocation,
  buildStorageLocationManagerState,
  createLocationPayload,
  locationAssignmentQueueKey,
  locationDataPatch,
  validateArchiveLocation,
  validateLocationAssignment,
  validateLocationParent,
  type LocationAssignment,
  type LocationManagerState,
  type StorageLocationType,
} from '@/services/storage-location-manager';
import {
  enqueueOfflineOperation,
  getOfflineQueue,
  processOfflineOperation,
} from '@/services/storage/offline';

type LocationResult<T = void> =
  | { ok: true; data: T; queued?: false }
  | { ok: true; queued: true; warning: string; data: T }
  | { ok: false; error: string };

export async function loadStorageLocationManager(): Promise<LocationManagerState & { userId: string; stale: boolean; unavailableReason?: string }> {
  if (!supabase) throw new Error('Supabase storage locations are not configured.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in again to manage storage locations.');
  const userId = auth.user.id;
  const [{ data: locations, error: locationError }, { data: items, error: itemError }] = await Promise.all([
    supabase
      .from('inventory_locations')
      .select('id, name, location_type, data')
      .eq('user_id', userId)
      .order('name', { ascending: true })
      .limit(500),
    supabase
      .from('inventory_items')
      .select('id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(500),
  ]);
  if (locationError) throw new Error(`Storage locations are unavailable: ${locationError.message}`);
  if (itemError) throw new Error(`Collection cards are unavailable: ${itemError.message}`);
  const rawLocations = (locations ?? []) as RawInventoryLocation[];
  const cards = buildCollectionCards({ items: (items ?? []) as RawInventoryItem[], locations: rawLocations });
  return {
    userId,
    stale: false,
    ...buildStorageLocationManagerState({ userId, rawLocations, cards }),
  };
}

export async function createMobileStorageLocation(input: {
  name: string;
  type: StorageLocationType;
  parentId?: string | null;
  favorite?: boolean;
}): Promise<LocationResult<{ id: string }>> {
  const { userId, locations } = await authLocationContext();
  const id = createId();
  const parentValidation = validateLocationParent({ id, parentId: input.parentId ?? null }, locations);
  if (!parentValidation.ok) return { ok: false, error: parentValidation.reason };
  const payload = createLocationPayload({ ...input, id, userId });
  const { error } = await supabase!
    .from('inventory_locations')
    .insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id } };
}

export async function renameMobileStorageLocation(locationId: string, name: string): Promise<LocationResult> {
  const { userId, rawLocations } = await authLocationContext();
  const raw = rawLocations.find((location) => location.id === locationId);
  if (!raw) return { ok: false, error: 'Choose one of your storage locations.' };
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: 'Location name is required.' };
  const { error } = await supabase!
    .from('inventory_locations')
    .update({ name: cleanName, data: locationDataPatch(raw.data, { name: cleanName }), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', locationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function archiveMobileStorageLocation(locationId: string, explicitArchiveWithAssignments = false): Promise<LocationResult> {
  const state = await loadStorageLocationManager();
  const summary = [...state.summaries, ...state.archivedLocations].find((location) => location.id === locationId);
  if (!summary) return { ok: false, error: 'Choose one of your storage locations.' };
  const validation = validateArchiveLocation(summary, explicitArchiveWithAssignments ? 'explicit_archive_with_assignments' : 'reject_if_assigned');
  if (!validation.ok) return { ok: false, error: validation.reason };
  const { rawLocations } = await authLocationContext();
  const raw = rawLocations.find((location) => location.id === locationId);
  const { error } = await supabase!
    .from('inventory_locations')
    .update({
      data: locationDataPatch(raw?.data, { archivedAt: new Date().toISOString() }),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', state.userId)
    .eq('id', locationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function assignMobileStorageLocation(assignment: LocationAssignment): Promise<LocationResult> {
  const { userId, locations, rawItems } = await authLocationContext();
  const validation = validateLocationAssignment({ assignment, authenticatedUserId: userId, locations });
  if (!validation.ok) return { ok: false, error: validation.reason };
  if (!rawItems.some((item) => item.id === assignment.inventoryItemId)) return { ok: false, error: 'Choose one of your collection records.' };
  try {
    await executeLocationAssignment(assignment, userId);
    return { ok: true, data: undefined };
  } catch {
    await enqueueOfflineOperation(
      STORAGE_LOCATION_QUEUE_TYPE,
      assignment as unknown as Record<string, unknown>,
      { userId: assignment.userId, dedupeKey: locationAssignmentQueueKey(assignment), uncertain: true },
    );
    return {
      ok: true,
      queued: true,
      warning: 'Storage outcome is uncertain. Operation preserved for review; automatic replay is blocked.',
      data: undefined,
    };
  }
}

export async function retryQueuedStorageLocationAssignments(userId: string) {
  const queue = await getOfflineQueue();
  let attempted = 0;
  for (const operation of queue) {
    if (operation.type !== STORAGE_LOCATION_QUEUE_TYPE || operation.userId !== userId) continue;
    const outcome = await processOfflineOperation(operation.id, userId, STORAGE_LOCATION_QUEUE_TYPE, async (claimed) => {
      const assignment = claimed.payload as unknown as LocationAssignment;
      if (assignment.userId !== userId || !assignment.inventoryItemId) throw new Error('Invalid location operation.');
      await executeLocationAssignment(assignment, userId, claimed.id);
    }, { retrySafe: false });
    if (outcome.status !== 'skipped') attempted += 1;
  }
  return { attempted, remaining: (await getOfflineQueue()).filter((op) => op.userId === userId && op.type === STORAGE_LOCATION_QUEUE_TYPE).length };
}

async function executeLocationAssignment(assignment: LocationAssignment, userId: string, operationId: string = createId()) {
  if (!supabase) throw new Error('Supabase storage locations are not configured.');
  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select('id')
    .eq('user_id', userId)
    .eq('id', assignment.inventoryItemId)
    .maybeSingle();
  if (itemError) throw new Error(itemError.message);
  if (!item) throw new Error('Choose one of your collection records.');
  const { error } = await supabase.rpc('apply_collector_inventory_mutation', {
    p_inventory_item_id: assignment.inventoryItemId,
    p_mutation_type: 'storage',
    p_quantity: null,
    p_condition: null,
    p_finish: null,
    p_location_id: assignment.toLocationId,
    p_idempotency_key: `storage:${operationId}`,
    p_source: 'mobile',
  });
  if (error) throw new Error(error.message);
  if (assignment.toLocationId) {
    const { data: location } = await supabase
      .from('inventory_locations')
      .select('data')
      .eq('user_id', userId)
      .eq('id', assignment.toLocationId)
      .maybeSingle();
    await supabase
      .from('inventory_locations')
      .update({ data: locationDataPatch(isRecord(location?.data) ? location.data : {}, { recentUsedAt: new Date().toISOString() }) })
      .eq('user_id', userId)
      .eq('id', assignment.toLocationId);
  }
}

async function authLocationContext() {
  if (!supabase) throw new Error('Supabase storage locations are not configured.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in again to manage storage locations.');
  const userId = auth.user.id;
  const [{ data: rawLocations }, { data: rawItems }] = await Promise.all([
    supabase.from('inventory_locations').select('id, name, location_type, data').eq('user_id', userId).limit(500),
    supabase.from('inventory_items').select('id, location_id').eq('user_id', userId).limit(500),
  ]);
  const locations = ((rawLocations ?? []) as RawInventoryLocation[]).map((location) => buildStorageLocation(userId, location));
  return { userId, rawLocations: (rawLocations ?? []) as RawInventoryLocation[], rawItems: (rawItems ?? []) as RawInventoryItem[], locations };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `loc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
