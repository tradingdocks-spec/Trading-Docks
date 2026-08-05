"use client";

import { createClient } from "@/lib/supabase/client";
import { buildCollectionCards, type RawInventoryItem, type RawInventoryLocation } from "@/lib/collector-workspace";
import {
  buildStorageLocation,
  buildStorageLocationManagerState,
  createLocationPayload,
  locationDataPatch,
  validateArchiveLocation,
  validateLocationAssignment,
  validateLocationParent,
  type LocationAssignment,
  type StorageLocationType,
} from "@/lib/storage-location-manager";

export async function loadWebStorageLocationManager() {
  const supabase = createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sign in again to manage storage locations.");
  const userId = auth.user.id;
  const [{ data: locations, error: locationError }, { data: items, error: itemError }] = await Promise.all([
    supabase
      .from("inventory_locations")
      .select("id, name, location_type, data")
      .eq("user_id", userId)
      .order("name", { ascending: true })
      .limit(500),
    supabase
      .from("inventory_items")
      .select("id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);
  if (locationError) throw new Error(`Storage locations are unavailable: ${locationError.message}`);
  if (itemError) throw new Error(`Collection cards are unavailable: ${itemError.message}`);
  const rawLocations = (locations ?? []) as RawInventoryLocation[];
  const cards = buildCollectionCards({ items: (items ?? []) as RawInventoryItem[], locations: rawLocations });
  return {
    userId,
    ...buildStorageLocationManagerState({ userId, rawLocations, cards }),
  };
}

export async function createWebStorageLocation(input: {
  name: string;
  type: StorageLocationType;
  parentId?: string | null;
  favorite?: boolean;
}) {
  const { supabase, userId, locations } = await authLocationContext();
  const id = globalThis.crypto?.randomUUID?.() ?? `loc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const parentValidation = validateLocationParent({ id, parentId: input.parentId ?? null }, locations);
  if (!parentValidation.ok) throw new Error(parentValidation.reason);
  const { error } = await supabase.from("inventory_locations").insert(createLocationPayload({ ...input, id, userId }));
  if (error) throw new Error(error.message);
  return { id };
}

export async function renameWebStorageLocation(locationId: string, name: string) {
  const { supabase, userId, rawLocations } = await authLocationContext();
  const raw = rawLocations.find((location) => location.id === locationId);
  if (!raw) throw new Error("Choose one of your storage locations.");
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Location name is required.");
  const { error } = await supabase
    .from("inventory_locations")
    .update({ name: cleanName, data: locationDataPatch(raw.data, { name: cleanName }), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", locationId);
  if (error) throw new Error(error.message);
}

export async function archiveWebStorageLocation(locationId: string, explicitArchiveWithAssignments = false) {
  const state = await loadWebStorageLocationManager();
  const location = [...state.summaries, ...state.archivedLocations].find((candidate) => candidate.id === locationId);
  if (!location) throw new Error("Choose one of your storage locations.");
  const validation = validateArchiveLocation(location, explicitArchiveWithAssignments ? "explicit_archive_with_assignments" : "reject_if_assigned");
  if (!validation.ok) throw new Error(validation.reason);
  const { rawLocations } = await authLocationContext();
  const raw = rawLocations.find((candidate) => candidate.id === locationId);
  const supabase = createClient();
  const { error } = await supabase
    .from("inventory_locations")
    .update({ data: locationDataPatch(raw?.data, { archivedAt: new Date().toISOString() }), updated_at: new Date().toISOString() })
    .eq("user_id", state.userId)
    .eq("id", locationId);
  if (error) throw new Error(error.message);
}

export async function assignWebStorageLocation(assignment: LocationAssignment) {
  const { supabase, userId, locations, rawItems } = await authLocationContext();
  const validation = validateLocationAssignment({ assignment, authenticatedUserId: userId, locations });
  if (!validation.ok) throw new Error(validation.reason);
  if (!rawItems.some((item) => item.id === assignment.inventoryItemId)) throw new Error("Choose one of your collection records.");
  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("data")
    .eq("user_id", userId)
    .eq("id", assignment.inventoryItemId)
    .maybeSingle();
  if (itemError) throw new Error(itemError.message);
  const previousData = isRecord(item?.data) ? item.data : {};
  const { error } = await supabase
    .from("inventory_items")
    .update({
      location_id: assignment.toLocationId,
      data: locationDataPatch(previousData, { locationId: assignment.toLocationId, locationMovedAt: new Date().toISOString() }),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", assignment.inventoryItemId);
  if (error) throw new Error(error.message);
}

async function authLocationContext() {
  const supabase = createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sign in again to manage storage locations.");
  const userId = auth.user.id;
  const [{ data: rawLocations }, { data: rawItems }] = await Promise.all([
    supabase.from("inventory_locations").select("id, name, location_type, data").eq("user_id", userId).limit(500),
    supabase.from("inventory_items").select("id, location_id").eq("user_id", userId).limit(500),
  ]);
  const locations = ((rawLocations ?? []) as RawInventoryLocation[]).map((location) => buildStorageLocation(userId, location));
  return { supabase, userId, rawLocations: (rawLocations ?? []) as RawInventoryLocation[], rawItems: (rawItems ?? []) as RawInventoryItem[], locations };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
