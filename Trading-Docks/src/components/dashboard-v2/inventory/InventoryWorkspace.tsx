"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  Edit3,
  Filter,
  FolderKanban,
  History,
  Layers3,
  LibraryBig,
  MapPin,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Store,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

type LocationType =
  | "chaos"
  | "binder"
  | "sealed-local"
  | "sealed-warehouse"
  | "custom";

type LocationRecord = {
  id: string;
  name: string;
  type: LocationType;
  description: string;
  itemCount: number;
  estimatedValue: number;
  capacity?: number;
  parentId?: string;
};

type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  category: "Single" | "Sealed" | "Graded" | "Bulk";
  quantity: number;
  locationId: string;
  condition?: string;
  set?: string;
  value: number;
  updatedAt: string;
};

type Movement = {
  id: string;
  itemName: string;
  from?: string;
  to: string;
  quantity: number;
  action: "filed" | "moved" | "combined" | "renamed";
  timestamp: string;
};

type DuplicateMatch = {
  item: InventoryItem;
  location: LocationRecord;
};

const LOCATION_STORAGE_KEY = "trading-docks-inventory-locations-v1";
const ITEM_STORAGE_KEY = "trading-docks-inventory-items-v1";
const MOVEMENT_STORAGE_KEY = "trading-docks-inventory-movements-v1";

const TYPE_CONFIG: Record<
  LocationType,
  {
    label: string;
    icon: typeof Boxes;
    className: string;
  }
> = {
  chaos: {
    label: "Chaos Sort",
    icon: Layers3,
    className: "border-cyan-300/[0.14] bg-cyan-400/[0.05] text-cyan-200",
  },
  binder: {
    label: "Binders",
    icon: LibraryBig,
    className: "border-violet-300/[0.14] bg-violet-400/[0.05] text-violet-200",
  },
  "sealed-local": {
    label: "Local Sealed",
    icon: Store,
    className: "border-emerald-300/[0.14] bg-emerald-400/[0.05] text-emerald-200",
  },
  "sealed-warehouse": {
    label: "Warehouse Sealed",
    icon: Warehouse,
    className: "border-amber-300/[0.14] bg-amber-400/[0.05] text-amber-200",
  },
  custom: {
    label: "Custom",
    icon: FolderKanban,
    className: "border-blue-300/[0.14] bg-blue-400/[0.05] text-blue-200",
  },
};

const INITIAL_LOCATIONS: LocationRecord[] = [
  {
    id: "chaos-main",
    name: "Main Chaos Sort",
    type: "chaos",
    description: "Unsorted and partially sorted singles waiting for filing.",
    itemCount: 18240,
    estimatedValue: 21840,
    capacity: 30000,
  },
  {
    id: "binder-modern",
    name: "Modern Staples Binder",
    type: "binder",
    description: "Modern-format staples organized alphabetically.",
    itemCount: 842,
    estimatedValue: 18420,
    capacity: 1200,
  },
  {
    id: "binder-commander",
    name: "Commander Staples Binder",
    type: "binder",
    description: "Commander staples organized by color and card type.",
    itemCount: 1142,
    estimatedValue: 26890,
    capacity: 1600,
  },
  {
    id: "local-sealed",
    name: "Storefront Sealed Shelf",
    type: "sealed-local",
    description: "Locally accessible sealed inventory for active sales.",
    itemCount: 318,
    estimatedValue: 38200,
    capacity: 500,
  },
  {
    id: "warehouse-a",
    name: "Warehouse Rack A",
    type: "sealed-warehouse",
    description: "Long-term sealed inventory stored off-site.",
    itemCount: 612,
    estimatedValue: 82100,
    capacity: 900,
  },
];

const INITIAL_ITEMS: InventoryItem[] = [
  {
    id: "item-1",
    name: "Rhystic Study",
    sku: "WOT-25-NM",
    category: "Single",
    quantity: 4,
    locationId: "binder-commander",
    condition: "Near Mint",
    set: "Wilds of Eldraine: Enchanting Tales",
    value: 164,
    updatedAt: "Today, 10:14 AM",
  },
  {
    id: "item-2",
    name: "Rhystic Study",
    sku: "JMP-169-NM",
    category: "Single",
    quantity: 2,
    locationId: "chaos-main",
    condition: "Near Mint",
    set: "Jumpstart",
    value: 78,
    updatedAt: "Yesterday",
  },
  {
    id: "item-3",
    name: "Modern Horizons 3 Play Booster Box",
    sku: "MH3-PBB-EN",
    category: "Sealed",
    quantity: 12,
    locationId: "local-sealed",
    value: 2880,
    updatedAt: "Today, 8:42 AM",
  },
  {
    id: "item-4",
    name: "Modern Horizons 3 Play Booster Box",
    sku: "MH3-PBB-EN",
    category: "Sealed",
    quantity: 36,
    locationId: "warehouse-a",
    value: 8640,
    updatedAt: "Jul 22",
  },
  {
    id: "item-5",
    name: "Sol Ring",
    sku: "CMM-396-NM",
    category: "Single",
    quantity: 14,
    locationId: "binder-commander",
    condition: "Near Mint",
    set: "Commander Masters",
    value: 42,
    updatedAt: "Jul 23",
  },
];

const INITIAL_MOVEMENTS: Movement[] = [
  {
    id: "movement-1",
    itemName: "Rhystic Study",
    from: "Main Chaos Sort",
    to: "Commander Staples Binder",
    quantity: 4,
    action: "moved",
    timestamp: "Today, 10:14 AM",
  },
  {
    id: "movement-2",
    itemName: "Modern Horizons 3 Play Booster Box",
    to: "Storefront Sealed Shelf",
    quantity: 12,
    action: "filed",
    timestamp: "Today, 8:42 AM",
  },
];

export function InventoryWorkspace() {
  const [locations, setLocations] = useState<LocationRecord[]>(INITIAL_LOCATIONS);
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_ITEMS);
  const [movements, setMovements] = useState<Movement[]>(INITIAL_MOVEMENTS);
  const [activeType, setActiveType] = useState<LocationType | "all">("all");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("chaos-main");
  const [search, setSearch] = useState("");
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationRecord | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null);
  const [pendingFile, setPendingFile] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    hydrateState(LOCATION_STORAGE_KEY, setLocations);
    hydrateState(ITEM_STORAGE_KEY, setItems);
    hydrateState(MOVEMENT_STORAGE_KEY, setMovements);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    window.localStorage.setItem(ITEM_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    window.localStorage.setItem(MOVEMENT_STORAGE_KEY, JSON.stringify(movements));
  }, [movements]);

  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? locations[0];

  const visibleLocations = locations.filter((location) => {
    const typeMatch = activeType === "all" || location.type === activeType;
    const searchMatch = `${location.name} ${location.description}`
      .toLowerCase()
      .includes(search.toLowerCase());

    return typeMatch && searchMatch;
  });

  const selectedItems = items.filter(
    (item) => item.locationId === selectedLocation?.id,
  );

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, InventoryItem[]>();

    items.forEach((item) => {
      const key = normalizeInventoryKey(item);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });

    return [...groups.values()].filter(
      (group) => new Set(group.map((item) => item.locationId)).size > 1,
    );
  }, [items]);

  const totals = useMemo(() => {
    return {
      units: items.reduce((sum, item) => sum + item.quantity, 0),
      value: items.reduce((sum, item) => sum + item.value, 0),
      locations: locations.length,
      duplicates: duplicateGroups.length,
    };
  }, [items, locations, duplicateGroups]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function saveLocation(input: {
    name: string;
    type: LocationType;
    description: string;
    capacity?: number;
  }) {
    if (editingLocation) {
      const oldName = editingLocation.name;

      setLocations((current) =>
        current.map((location) =>
          location.id === editingLocation.id
            ? {
                ...location,
                ...input,
              }
            : location,
        ),
      );

      if (oldName !== input.name) {
        setMovements((current) => [
          {
            id: crypto.randomUUID(),
            itemName: input.name,
            from: oldName,
            to: input.name,
            quantity: 0,
            action: "renamed",
            timestamp: "Just now",
          },
          ...current,
        ]);
      }

      notify("Storage location updated.");
    } else {
      const newLocation: LocationRecord = {
        id: crypto.randomUUID(),
        name: input.name,
        type: input.type,
        description: input.description,
        capacity: input.capacity,
        itemCount: 0,
        estimatedValue: 0,
      };

      setLocations((current) => [...current, newLocation]);
      setSelectedLocationId(newLocation.id);
      notify("Storage location created.");
    }

    setEditingLocation(null);
    setLocationModalOpen(false);
  }

  function attemptFile(item: InventoryItem) {
    const match = items.find(
      (existing) =>
        normalizeInventoryKey(existing) === normalizeInventoryKey(item) &&
        existing.locationId !== item.locationId,
    );

    if (match) {
      const location = locations.find(
        (candidate) => candidate.id === match.locationId,
      );

      if (location) {
        setPendingFile(item);
        setDuplicateMatch({ item: match, location });
        return;
      }
    }

    addInventoryItem(item);
  }

  function addInventoryItem(item: InventoryItem) {
    setItems((current) => [...current, item]);
    updateLocationTotals(item.locationId, item.quantity, item.value);

    const location = locations.find(
      (candidate) => candidate.id === item.locationId,
    );

    setMovements((current) => [
      {
        id: crypto.randomUUID(),
        itemName: item.name,
        to: location?.name ?? "Unknown location",
        quantity: item.quantity,
        action: "filed",
        timestamp: "Just now",
      },
      ...current,
    ]);

    setFileModalOpen(false);
    setPendingFile(null);
    setDuplicateMatch(null);
    setSelectedLocationId(item.locationId);
    notify("Inventory filed successfully.");
  }

  function combineDuplicate() {
    if (!pendingFile || !duplicateMatch) return;

    setItems((current) =>
      current.map((item) =>
        item.id === duplicateMatch.item.id
          ? {
              ...item,
              quantity: item.quantity + pendingFile.quantity,
              value: item.value + pendingFile.value,
              updatedAt: "Just now",
            }
          : item,
      ),
    );

    updateLocationTotals(
      duplicateMatch.item.locationId,
      pendingFile.quantity,
      pendingFile.value,
    );

    setMovements((current) => [
      {
        id: crypto.randomUUID(),
        itemName: pendingFile.name,
        to: duplicateMatch.location.name,
        quantity: pendingFile.quantity,
        action: "combined",
        timestamp: "Just now",
      },
      ...current,
    ]);

    setSelectedLocationId(duplicateMatch.item.locationId);
    setPendingFile(null);
    setDuplicateMatch(null);
    setFileModalOpen(false);
    notify("Duplicate inventory combined into the existing location.");
  }

  function moveItem(itemId: string, destinationId: string) {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item || item.locationId === destinationId) return;

    const source = locations.find(
      (location) => location.id === item.locationId,
    );
    const destination = locations.find(
      (location) => location.id === destinationId,
    );

    const duplicate = items.find(
      (candidate) =>
        candidate.id !== item.id &&
        candidate.locationId === destinationId &&
        normalizeInventoryKey(candidate) === normalizeInventoryKey(item),
    );

    if (duplicate) {
      setItems((current) =>
        current
          .map((candidate) =>
            candidate.id === duplicate.id
              ? {
                  ...candidate,
                  quantity: candidate.quantity + item.quantity,
                  value: candidate.value + item.value,
                  updatedAt: "Just now",
                }
              : candidate,
          )
          .filter((candidate) => candidate.id !== item.id),
      );
    } else {
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                locationId: destinationId,
                updatedAt: "Just now",
              }
            : candidate,
        ),
      );
    }

    updateLocationTotals(item.locationId, -item.quantity, -item.value);
    updateLocationTotals(destinationId, item.quantity, item.value);

    setMovements((current) => [
      {
        id: crypto.randomUUID(),
        itemName: item.name,
        from: source?.name,
        to: destination?.name ?? "Unknown location",
        quantity: item.quantity,
        action: duplicate ? "combined" : "moved",
        timestamp: "Just now",
      },
      ...current,
    ]);

    notify(
      duplicate
        ? "Matching inventory was combined at the destination."
        : "Inventory moved successfully.",
    );
  }

  function updateLocationTotals(
    locationId: string,
    itemCountChange: number,
    valueChange: number,
  ) {
    setLocations((current) =>
      current.map((location) =>
        location.id === locationId
          ? {
              ...location,
              itemCount: Math.max(0, location.itemCount + itemCountChange),
              estimatedValue: Math.max(
                0,
                location.estimatedValue + valueChange,
              ),
            }
          : location,
      ),
    );
  }

  function deleteLocation(location: LocationRecord) {
    const containsInventory = items.some(
      (item) => item.locationId === location.id,
    );

    if (containsInventory) {
      notify("Move the inventory before deleting this location.");
      return;
    }

    setLocations((current) =>
      current.filter((candidate) => candidate.id !== location.id),
    );

    if (selectedLocationId === location.id) {
      setSelectedLocationId(
        locations.find((candidate) => candidate.id !== location.id)?.id ?? "",
      );
    }

    notify("Storage location deleted.");
  }

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Inventory Management"
        title="Know exactly what you own and where it is."
        description="Organize chaos-sort inventory, binders, local sealed product, warehouse stock, graded cards, bulk, and fully custom storage locations."
        icon={Boxes}
        actionLabel="File inventory"
        onAction={() => setFileModalOpen(true)}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Tracked units"
          value={totals.units.toLocaleString("en-US")}
          detail="Across all managed locations"
          icon={Boxes}
        />
        <MetricCard
          label="Inventory value"
          value={currency(totals.value)}
          detail="Current tracked value"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Storage locations"
          value={String(totals.locations)}
          detail="All names are customizable"
          icon={MapPin}
        />
        <MetricCard
          label="Duplicate locations"
          value={String(totals.duplicates)}
          detail="Items stored in multiple places"
          icon={Copy}
        />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-4`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <TypeButton
              active={activeType === "all"}
              label="All Locations"
              icon={FolderKanban}
              onClick={() => setActiveType("all")}
            />

            {(Object.keys(TYPE_CONFIG) as LocationType[]).map((type) => (
              <TypeButton
                key={type}
                active={activeType === type}
                label={TYPE_CONFIG[type].label}
                icon={TYPE_CONFIG[type].icon}
                onClick={() => setActiveType(type)}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 sm:w-[280px]">
              <Search className="h-3.5 w-3.5 text-slate-700" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search storage locations..."
                className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-300 outline-none placeholder:text-slate-700"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                setEditingLocation(null);
                setLocationModalOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/[0.14] bg-cyan-400/[0.05] px-4 text-[9px] font-semibold text-cyan-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Add location
            </button>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Storage map
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Inventory locations
              </h2>
            </div>
            <span className="text-[9px] text-slate-600">
              {visibleLocations.length} shown
            </span>
          </div>

          <div className="mt-5 space-y-2.5">
            {visibleLocations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                selected={selectedLocation?.id === location.id}
                onSelect={() => setSelectedLocationId(location.id)}
                onEdit={() => {
                  setEditingLocation(location);
                  setLocationModalOpen(true);
                }}
                onDelete={() => deleteLocation(location)}
              />
            ))}
          </div>
        </section>

        <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
          {selectedLocation ? (
            <>
              <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${TYPE_CONFIG[selectedLocation.type].className}`}
                  >
                    {(() => {
                      const Icon = TYPE_CONFIG[selectedLocation.type].icon;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </span>

                  <div>
                    <p className="text-lg font-semibold text-white">
                      {selectedLocation.name}
                    </p>
                    <p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-600">
                      {selectedLocation.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingLocation(selectedLocation);
                    setLocationModalOpen(true);
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[9px] font-semibold text-slate-400"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Rename or edit
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <CompactMetric
                  label="Units"
                  value={selectedLocation.itemCount.toLocaleString("en-US")}
                />
                <CompactMetric
                  label="Tracked value"
                  value={currency(selectedLocation.estimatedValue)}
                />
                <CompactMetric
                  label="Capacity"
                  value={
                    selectedLocation.capacity
                      ? `${Math.round(
                          (selectedLocation.itemCount /
                            selectedLocation.capacity) *
                            100,
                        )}% used`
                      : "Not set"
                  }
                />
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[8px] uppercase tracking-[0.14em] text-slate-700">
                      <th className="px-3 py-3">Inventory</th>
                      <th className="px-3 py-3">SKU</th>
                      <th className="px-3 py-3">Category</th>
                      <th className="px-3 py-3">Quantity</th>
                      <th className="px-3 py-3">Value</th>
                      <th className="px-3 py-3">Move to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((item) => (
                      <InventoryRow
                        key={item.id}
                        item={item}
                        locations={locations}
                        onMove={(destinationId) =>
                          moveItem(item.id, destinationId)
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {!selectedItems.length ? (
                <div className="mt-5 rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.015] px-4 py-10 text-center">
                  <PackageCheck className="mx-auto h-5 w-5 text-slate-700" />
                  <p className="mt-3 text-xs font-semibold text-slate-400">
                    No item records in this location
                  </p>
                  <button
                    type="button"
                    onClick={() => setFileModalOpen(true)}
                    className="mt-3 text-[10px] font-semibold text-cyan-300"
                  >
                    File inventory here
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <DuplicateCenter
          groups={duplicateGroups}
          locations={locations}
          onSelectLocation={setSelectedLocationId}
        />

        <MovementHistory movements={movements} />
      </div>

      <InventoryIdeasPanel />

      <LocationModal
        open={locationModalOpen}
        location={editingLocation}
        onClose={() => {
          setLocationModalOpen(false);
          setEditingLocation(null);
        }}
        onSave={saveLocation}
      />

      <FileInventoryModal
        open={fileModalOpen}
        locations={locations}
        defaultLocationId={selectedLocation?.id}
        onClose={() => setFileModalOpen(false)}
        onFile={attemptFile}
      />

      <DuplicateWarningModal
        match={duplicateMatch}
        pendingItem={pendingFile}
        onClose={() => {
          setDuplicateMatch(null);
          setPendingFile(null);
        }}
        onKeepSeparate={() => {
          if (pendingFile) addInventoryItem(pendingFile);
        }}
        onCombine={combineDuplicate}
      />

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[140] flex items-center gap-2 rounded-xl border border-cyan-300/[0.16] bg-[#06131d]/96 px-4 py-3 text-[10px] font-semibold text-cyan-100 shadow-[0_18px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <Check className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      ) : null}
    </WorkspaceFrame>
  );
}

function TypeButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof Boxes;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[9px] font-semibold transition",
        active
          ? "border-cyan-300/[0.18] bg-cyan-400/[0.075] text-cyan-100"
          : "border-transparent text-slate-600 hover:border-white/[0.06] hover:bg-white/[0.025] hover:text-slate-300",
      ].join(" ")}
    >
      <Icon className={active ? "h-3.5 w-3.5 text-cyan-300" : "h-3.5 w-3.5"} />
      {label}
    </button>
  );
}

function LocationCard({
  location,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  location: LocationRecord;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const config = TYPE_CONFIG[location.type];
  const Icon = config.icon;
  const capacity = location.capacity
    ? Math.min(100, (location.itemCount / location.capacity) * 100)
    : 0;

  return (
    <div
      className={[
        "rounded-2xl border p-3.5 transition",
        selected
          ? "border-cyan-300/[0.18] bg-cyan-400/[0.045]"
          : "border-white/[0.055] bg-black/[0.08] hover:border-cyan-300/[0.12]",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${config.className}`}
          >
            <Icon className="h-4 w-4" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold text-slate-200">
              {location.name}
            </span>
            <span className="mt-1 block text-[8px] text-slate-600">
              {location.itemCount.toLocaleString("en-US")} units ·{" "}
              {currency(location.estimatedValue)}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.055] bg-white/[0.018] text-slate-700 hover:text-cyan-300"
          >
            <Edit3 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.055] bg-white/[0.018] text-slate-700 hover:text-red-300"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {location.capacity ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300"
              style={{ width: `${capacity}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CompactMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.055] bg-black/[0.08] px-3.5 py-3">
      <p className="text-[8px] uppercase tracking-[0.13em] text-slate-700">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function InventoryRow({
  item,
  locations,
  onMove,
}: {
  item: InventoryItem;
  locations: LocationRecord[];
  onMove: (locationId: string) => void;
}) {
  return (
    <tr className="border-b border-white/[0.045] text-[10px] text-slate-500">
      <td className="px-3 py-4">
        <p className="font-semibold text-slate-200">{item.name}</p>
        <p className="mt-1 text-[8px] text-slate-700">
          {[item.set, item.condition].filter(Boolean).join(" · ")}
        </p>
      </td>
      <td className="px-3 py-4">{item.sku}</td>
      <td className="px-3 py-4">{item.category}</td>
      <td className="px-3 py-4">{item.quantity}</td>
      <td className="px-3 py-4 font-semibold text-emerald-300">
        {currency(item.value)}
      </td>
      <td className="px-3 py-4">
        <label className="relative block">
          <select
            value={item.locationId}
            onChange={(event) => onMove(event.target.value)}
            className="h-9 w-full appearance-none rounded-xl border border-white/[0.06] bg-[#07141e] pl-3 pr-8 text-[8px] text-slate-500"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-700" />
        </label>
      </td>
    </tr>
  );
}

function DuplicateCenter({
  groups,
  locations,
  onSelectLocation,
}: {
  groups: InventoryItem[][];
  locations: LocationRecord[];
  onSelectLocation: (id: string) => void;
}) {
  return (
    <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            Duplicate Location Center
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Inventory stored in multiple places
          </h2>
          <p className="mt-1 text-[9px] text-slate-600">
            Review matching items and decide whether the locations should remain
            separate.
          </p>
        </div>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/[0.12] bg-amber-400/[0.04] text-amber-300">
          <ShieldAlert className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {groups.slice(0, 4).map((group) => (
          <div
            key={normalizeInventoryKey(group[0])}
            className="rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4"
          >
            <p className="text-xs font-semibold text-slate-200">
              {group[0].name}
            </p>
            <p className="mt-1 text-[8px] text-slate-600">{group[0].sku}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {group.map((item) => {
                const location = locations.find(
                  (candidate) => candidate.id === item.locationId,
                );

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectLocation(item.locationId)}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[8px] text-slate-500 hover:border-cyan-300/[0.12] hover:text-cyan-200"
                  >
                    {location?.name} · {item.quantity}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {!groups.length ? (
          <div className="rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.015] px-4 py-9 text-center">
            <Check className="mx-auto h-5 w-5 text-emerald-300" />
            <p className="mt-3 text-xs font-semibold text-slate-400">
              No duplicate locations found
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MovementHistory({ movements }: { movements: Movement[] }) {
  return (
    <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Inventory History
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Recent location activity
          </h2>
        </div>
        <History className="h-4 w-4 text-cyan-300" />
      </div>

      <div className="mt-5 space-y-2.5">
        {movements.slice(0, 7).map((movement) => (
          <div
            key={movement.id}
            className="flex items-start gap-3 rounded-xl border border-white/[0.055] bg-black/[0.08] px-3.5 py-3"
          >
            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/[0.1] bg-cyan-400/[0.04] text-cyan-300">
              <ArrowRightLeft className="h-3 w-3" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-slate-300">
                {movement.itemName}
              </p>
              <p className="mt-1 text-[8px] leading-4 text-slate-600">
                {movement.action === "renamed"
                  ? `${movement.from} renamed to ${movement.to}`
                  : movement.from
                    ? `${movement.quantity} moved from ${movement.from} to ${movement.to}`
                    : `${movement.quantity} filed in ${movement.to}`}
              </p>
            </div>

            <span className="text-[7px] text-slate-700">
              {movement.timestamp}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function InventoryIdeasPanel() {
  const ideas = [
    {
      title: "Barcode and QR location labels",
      detail:
        "Print a QR code for every binder, shelf, box, and warehouse rack so employees can scan the destination while filing.",
      icon: ClipboardCheck,
    },
    {
      title: "Capacity and overflow rules",
      detail:
        "Set maximum capacity and automatically recommend an overflow location before a binder or shelf becomes full.",
      icon: AlertTriangle,
    },
    {
      title: "Pick-path optimization",
      detail:
        "Organize orders by storage route so an employee can pull cards in the shortest possible path.",
      icon: Truck,
    },
    {
      title: "Cycle counts",
      detail:
        "Schedule rotating inventory audits and compare expected quantity with physical count.",
      icon: RefreshCw,
    },
    {
      title: "Reserved and unavailable inventory",
      detail:
        "Mark cards as reserved for orders, decks, events, grading submissions, or insurance documentation.",
      icon: ShieldAlert,
    },
    {
      title: "Smart filing recommendations",
      detail:
        "Recommend the best destination based on set, color, format, card type, value, and available capacity.",
      icon: Sparkles,
    },
  ];

  return (
    <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-300">
          Future Inventory Intelligence
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">
          High-value features for the next phases
        </h2>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ideas.map((idea) => {
          const Icon = idea.icon;

          return (
            <div
              key={idea.title}
              className="rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-300/[0.1] bg-violet-400/[0.04] text-violet-300">
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-4 text-xs font-semibold text-slate-200">
                {idea.title}
              </p>
              <p className="mt-2 text-[9px] leading-4 text-slate-600">
                {idea.detail}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LocationModal({
  open,
  location,
  onClose,
  onSave,
}: {
  open: boolean;
  location: LocationRecord | null;
  onClose: () => void;
  onSave: (input: {
    name: string;
    type: LocationType;
    description: string;
    capacity?: number;
  }) => void;
}) {
  const [name, setName] = useState(location?.name ?? "");
  const [type, setType] = useState<LocationType>(location?.type ?? "custom");
  const [description, setDescription] = useState(
    location?.description ?? "",
  );
  const [capacity, setCapacity] = useState(
    location?.capacity ? String(location.capacity) : "",
  );

  useEffect(() => {
    setName(location?.name ?? "");
    setType(location?.type ?? "custom");
    setDescription(location?.description ?? "");
    setCapacity(location?.capacity ? String(location.capacity) : "");
  }, [location, open]);

  if (!open) return null;

  return (
    <ModalFrame onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;

          onSave({
            name: name.trim(),
            type,
            description: description.trim(),
            capacity: capacity ? Number(capacity) : undefined,
          });
        }}
      >
        <ModalHeader
          eyebrow={location ? "Edit storage location" : "New storage location"}
          title={location ? "Rename or update location" : "Create a location"}
          onClose={onClose}
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Location name" className="sm:col-span-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: Commander Binder 2"
              className="inventory-input"
              required
            />
          </Field>

          <Field label="Location type">
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as LocationType)
              }
              className="inventory-input"
            >
              {(Object.keys(TYPE_CONFIG) as LocationType[]).map((value) => (
                <option key={value} value={value}>
                  {TYPE_CONFIG[value].label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Capacity">
            <input
              type="number"
              min="0"
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              placeholder="Optional"
              className="inventory-input"
            />
          </Field>

          <Field label="Description" className="sm:col-span-2">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe how inventory is organized in this location."
              className="inventory-input min-h-[96px] resize-none py-3"
            />
          </Field>
        </div>

        <button
          type="submit"
          className="mt-6 h-11 w-full rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 text-xs font-semibold text-[#001018]"
        >
          {location ? "Save location" : "Create location"}
        </button>
      </form>
    </ModalFrame>
  );
}

function FileInventoryModal({
  open,
  locations,
  defaultLocationId,
  onClose,
  onFile,
}: {
  open: boolean;
  locations: LocationRecord[];
  defaultLocationId?: string;
  onClose: () => void;
  onFile: (item: InventoryItem) => void;
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] =
    useState<InventoryItem["category"]>("Single");
  const [quantity, setQuantity] = useState("1");
  const [locationId, setLocationId] = useState(
    defaultLocationId ?? locations[0]?.id ?? "",
  );
  const [condition, setCondition] = useState("Near Mint");
  const [cardSet, setCardSet] = useState("");
  const [value, setValue] = useState("0");

  useEffect(() => {
    if (defaultLocationId) setLocationId(defaultLocationId);
  }, [defaultLocationId, open]);

  if (!open) return null;

  return (
    <ModalFrame onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || !sku.trim() || !locationId) return;

          onFile({
            id: crypto.randomUUID(),
            name: name.trim(),
            sku: sku.trim(),
            category,
            quantity: Math.max(1, Number(quantity)),
            locationId,
            condition: category === "Single" ? condition : undefined,
            set: cardSet.trim() || undefined,
            value: Math.max(0, Number(value)),
            updatedAt: "Just now",
          });
        }}
      >
        <ModalHeader
          eyebrow="File inventory"
          title="Add inventory to a storage location"
          onClose={onClose}
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Card or product name" className="sm:col-span-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Rhystic Study"
              className="inventory-input"
              required
            />
          </Field>

          <Field label="SKU or product ID">
            <input
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder="WOT-25-NM"
              className="inventory-input"
              required
            />
          </Field>

          <Field label="Category">
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as InventoryItem["category"])
              }
              className="inventory-input"
            >
              <option>Single</option>
              <option>Sealed</option>
              <option>Graded</option>
              <option>Bulk</option>
            </select>
          </Field>

          <Field label="Quantity">
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="inventory-input"
            />
          </Field>

          <Field label="Total value">
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="inventory-input"
            />
          </Field>

          <Field label="Destination" className="sm:col-span-2">
            <select
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              className="inventory-input"
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Set or product line">
            <input
              value={cardSet}
              onChange={(event) => setCardSet(event.target.value)}
              placeholder="Wilds of Eldraine"
              className="inventory-input"
            />
          </Field>

          <Field label="Condition">
            <select
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              className="inventory-input"
              disabled={category !== "Single"}
            >
              <option>Near Mint</option>
              <option>Lightly Played</option>
              <option>Moderately Played</option>
              <option>Heavily Played</option>
              <option>Damaged</option>
            </select>
          </Field>
        </div>

        <div className="mt-5 rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.035] px-3.5 py-3">
          <div className="flex items-start gap-2.5">
            <Copy className="mt-0.5 h-3.5 w-3.5 text-cyan-300" />
            <p className="text-[8px] leading-4 text-slate-500">
              Trading Docks will check whether this exact SKU already exists in
              another location and ask whether you want to combine it.
            </p>
          </div>
        </div>

        <button
          type="submit"
          className="mt-6 h-11 w-full rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 text-xs font-semibold text-[#001018]"
        >
          File inventory
        </button>
      </form>
    </ModalFrame>
  );
}

function DuplicateWarningModal({
  match,
  pendingItem,
  onClose,
  onKeepSeparate,
  onCombine,
}: {
  match: DuplicateMatch | null;
  pendingItem: InventoryItem | null;
  onClose: () => void;
  onKeepSeparate: () => void;
  onCombine: () => void;
}) {
  if (!match || !pendingItem) return null;

  return (
    <ModalFrame onClose={onClose}>
      <div>
        <ModalHeader
          eyebrow="Duplicate location detected"
          title="This inventory already exists elsewhere"
          onClose={onClose}
          warning
        />

        <div className="mt-6 rounded-2xl border border-amber-300/[0.13] bg-amber-400/[0.035] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/[0.14] bg-amber-400/[0.05] text-amber-300">
              <AlertTriangle className="h-4 w-4" />
            </span>

            <div>
              <p className="text-sm font-semibold text-white">
                {pendingItem.name}
              </p>
              <p className="mt-1 text-[9px] text-slate-600">
                SKU: {pendingItem.sku}
              </p>
              <p className="mt-4 text-[10px] leading-5 text-slate-400">
                There are already {match.item.quantity} units stored in{" "}
                <span className="font-semibold text-amber-200">
                  {match.location.name}
                </span>
                .
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onKeepSeparate}
            className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-4 text-left"
          >
            <p className="text-xs font-semibold text-slate-200">
              Keep both locations
            </p>
            <p className="mt-2 text-[8px] leading-4 text-slate-600">
              File the new quantity in the selected destination and keep both
              records separate.
            </p>
          </button>

          <button
            type="button"
            onClick={onCombine}
            className="rounded-xl border border-cyan-300/[0.15] bg-cyan-400/[0.05] px-4 py-4 text-left"
          >
            <p className="text-xs font-semibold text-cyan-100">
              Combine into {match.location.name}
            </p>
            <p className="mt-2 text-[8px] leading-4 text-slate-500">
              Add the new quantity to the existing inventory record and use one
              storage location.
            </p>
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

function ModalFrame({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/72 p-4 backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label="Close modal"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-[28px] border border-cyan-300/[0.14] bg-[#06131d]/98 p-5 shadow-[0_38px_120px_rgba(0,0,0,0.55)] sm:p-6">
        {children}

        <style jsx global>{`
          .inventory-input {
            height: 42px;
            width: 100%;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.075);
            background: rgba(255, 255, 255, 0.025);
            padding: 0 12px;
            color: rgb(226 232 240);
            font-size: 11px;
            outline: none;
          }

          .inventory-input:focus {
            border-color: rgba(103, 232, 249, 0.24);
            box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.045);
          }

          .inventory-input:disabled {
            opacity: 0.42;
          }
        `}</style>
      </div>
    </div>
  );
}

function ModalHeader({
  eyebrow,
  title,
  onClose,
  warning = false,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  warning?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p
          className={[
            "text-[8px] font-semibold uppercase tracking-[0.17em]",
            warning ? "text-amber-300" : "text-cyan-300",
          ].join(" ")}
        >
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-2 block text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function normalizeInventoryKey(item: InventoryItem) {
  return `${item.sku}|${item.condition ?? ""}`.trim().toLowerCase();
}

function hydrateState<T>(
  key: string,
  setter: React.Dispatch<React.SetStateAction<T>>,
) {
  const stored = window.localStorage.getItem(key);
  if (!stored) return;

  try {
    setter(JSON.parse(stored));
  } catch {
    window.localStorage.removeItem(key);
  }
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
