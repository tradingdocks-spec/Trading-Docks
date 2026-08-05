"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  BookOpen,
  Boxes,
  Check,
  CheckSquare2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  Download,
  Edit3,
  EllipsisVertical,
  Eye,
  ExternalLink,
  Filter,
  FolderKanban,
  FolderOpen,
  Globe2,
  Grid3X3,
  History,
  Layers3,
  LayoutGrid,
  LibraryBig,
  Link2,
  List,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Move,
  PackageCheck,
  PackageOpen,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Share2,
  ShieldAlert,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  Warehouse,
  X,
} from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";
import { accountStorageKey } from "@/lib/account-storage";
import {
  loadInventorySnapshot,
  persistInventorySnapshotDiff,
  type InventorySnapshot,
} from "@/lib/inventory-persistence";
import {
  PrintingSelector,
  type InventoryFinish,
  type SelectedPrinting,
} from "./PrintingSelector";

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
  zone?: string;
  organization?: string;
  capacityUnit?: "cards" | "products" | "slots" | "boxes";
  warningThreshold?: number;
  criticalThreshold?: number;
  binderColumns?: number;
  binderRows?: number;
  binderPages?: number;
  binderDoubleSided?: boolean;
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
  collectorNumber?: string;
  language?: string;
  finish?: InventoryFinish;
  treatment?: string;
  scryfallId?: string;
  imageUrl?: string;
  costBasis?: number;
  unitMarketValue?: number;
  value: number;
  updatedAt: string;
  binderPage?: number;
  binderSlot?: string;
  putAwayOrigin?: {
    locationId: string;
    binderPage?: number;
    binderSlot?: string;
  };
  marketplaceListings?: MarketplaceListing[];
};

type MarketplacePlatform =
  | "TCGplayer"
  | "eBay"
  | "Mana Pool"
  | "Trading Docks"
  | "In-Store";

type MarketplaceListingStatus =
  | "Draft"
  | "Active"
  | "Paused"
  | "Sold"
  | "Ended"
  | "Error";

type MarketplaceListing = {
  platform: MarketplacePlatform;
  status: MarketplaceListingStatus;
  quantity: number;
  price?: number;
  listingId?: string;
  listingUrl?: string;
  updatedAt: string;
};

type Movement = {
  id: string;
  itemName: string;
  from?: string;
  to: string;
  quantity: number;
  action: "filed" | "moved" | "combined" | "renamed" | "queued";
  timestamp: string;
};

type DuplicateMatch = {
  item: InventoryItem;
  location: LocationRecord;
};

const LOCATION_STORAGE_KEY = "trading-docks-inventory-locations-v1";
const ITEM_STORAGE_KEY = "trading-docks-inventory-items-v1";
const MOVEMENT_STORAGE_KEY = "trading-docks-inventory-movements-v1";
const PUT_AWAY_QUEUE_ID = "__trading-docks-put-away-queue__";

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

type InventoryPlan = "free" | "collector" | "seller" | "store";
type BusinessSavedView =
  | "all"
  | "recent"
  | "unlisted"
  | "multi-channel"
  | "high-value"
  | "no-cost"
  | "no-location"
  | "errors";
type InventoryAgeBucket = "all" | "0-30" | "31-60" | "61-90" | "91-180" | "180+";

const PLAN_RANK: Record<InventoryPlan, number> = {
  free: 0,
  collector: 1,
  seller: 2,
  store: 3,
};

export function TieredInventoryWorkspace({
  accountType,
  inventoryLimit,
}: {
  accountType: string;
  inventoryLimit: number | null;
}) {
  const plan: InventoryPlan =
    accountType === "store" || accountType === "business" || accountType === "seller" || accountType === "collector"
      ? accountType === "business" ? "store" : accountType
      : "free";
  const canManageCollection = true;
  const canOperate = PLAN_RANK[plan] >= PLAN_RANK.seller;
  const hasBusinessAnalytics = plan === "store";
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const itemsRef = useRef<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const persistenceBaselineRef = useRef<InventorySnapshot>({
    locations: [],
    items: [],
    movements: [],
  });
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const persistenceTimerRef = useRef<number | null>(null);
  const [activeType, setActiveType] = useState<LocationType | "all">("all");
  const [viewMode, setViewMode] = useState<"visual" | "operations">("visual");
  const [locationDisplay, setLocationDisplay] = useState<"cards" | "list">("cards");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [openLocationId, setOpenLocationId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [locationSort, setLocationSort] = useState<"name" | "type" | "capacity" | "units" | "value" | "updated">("name");
  const [showUnconfiguredOnly, setShowUnconfiguredOnly] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationRecord | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null);
  const [pendingFile, setPendingFile] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState("");
  const [putAwayOpen, setPutAwayOpen] = useState(false);
  const [deleteItemCandidate, setDeleteItemCandidate] = useState<InventoryItem | null>(null);
  const [deleteLocationCandidate, setDeleteLocationCandidate] = useState<LocationRecord | null>(null);
  const [channelFilter, setChannelFilter] = useState<MarketplacePlatform | "Unlisted" | "all">("all");
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const [savedView, setSavedView] = useState<BusinessSavedView>("all");
  const [ageBucket, setAgeBucket] = useState<InventoryAgeBucket>("all");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [cloudSnapshot, locationsKey, itemsKey, movementsKey] = await Promise.all([
          loadInventorySnapshot(),
          accountStorageKey(LOCATION_STORAGE_KEY),
          accountStorageKey(ITEM_STORAGE_KEY),
          accountStorageKey(MOVEMENT_STORAGE_KEY),
        ]);
        const localSnapshot: InventorySnapshot = {
          locations: readLocalInventoryRecords(locationsKey),
          items: readLocalInventoryRecords(itemsKey),
          movements: readLocalInventoryRecords(movementsKey),
        };
        const cloudIsEmpty =
          cloudSnapshot.locations.length === 0 &&
          cloudSnapshot.items.length === 0 &&
          cloudSnapshot.movements.length === 0;
        const localHasInventory =
          localSnapshot.locations.length > 0 ||
          localSnapshot.items.length > 0 ||
          localSnapshot.movements.length > 0;
        const snapshot = cloudIsEmpty && localHasInventory ? localSnapshot : cloudSnapshot;

        if (cloudIsEmpty && localHasInventory) {
          await persistInventorySnapshotDiff(
            { locations: [], items: [], movements: [] },
            localSnapshot,
          );
        }
        window.localStorage.removeItem(locationsKey);
        window.localStorage.removeItem(itemsKey);
        window.localStorage.removeItem(movementsKey);

        if (!active) return;
        persistenceBaselineRef.current = cloneInventorySnapshot(snapshot);
        setLocations(snapshot.locations as unknown as LocationRecord[]);
        setItems(snapshot.items as unknown as InventoryItem[]);
        setMovements(snapshot.movements as unknown as Movement[]);
        setPersistenceReady(true);
      } catch (error) {
        if (!active) return;
        setToast(
          error instanceof Error
            ? error.message
            : "Your cloud inventory could not be loaded.",
        );
      }
    })();
    return () => {
      active = false;
      if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!persistenceReady) return;
    if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current);
    const snapshot = toInventorySnapshot(locations, items, movements);
    persistenceTimerRef.current = window.setTimeout(() => {
      persistenceQueueRef.current = persistenceQueueRef.current
        .then(async () => {
          const previous = persistenceBaselineRef.current;
          await persistInventorySnapshotDiff(previous, snapshot);
          persistenceBaselineRef.current = cloneInventorySnapshot(snapshot);
        })
        .catch((error) => {
          setToast(
            error instanceof Error
              ? error.message
              : "Your inventory changes could not be saved.",
          );
        });
    }, 700);
  }, [items, locations, movements, persistenceReady]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!locations.length || !items.length) return;

    const repaired = repairUnassignedBinderItems(items, locations);
    if (repaired === items) return;

    itemsRef.current = repaired;
    setItems(repaired);
    notify("Recovered card records that were missing binder pocket assignments.");
  }, [items, locations]);

  useEffect(() => {
    if (!persistenceReady) return;
    const params = new URLSearchParams(window.location.search);
    const requestedLocation = params.get("location");
    if (!requestedLocation) return;

    if (requestedLocation === PUT_AWAY_QUEUE_ID) {
      setPutAwayOpen(true);
      return;
    }

    if (locations.some((location) => location.id === requestedLocation)) {
      setSelectedLocationId(requestedLocation);
      setOpenLocationId(requestedLocation);
    }
  }, [locations, persistenceReady]);

  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? locations[0];

  const visibleLocations = locations
    .filter((location) => {
      const typeMatch = activeType === "all" || location.type === activeType;
      const searchMatch = `${location.name} ${location.description}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const configurationMatch =
        !showUnconfiguredOnly || !location.capacity || !location.organization;
      const locationItems = items.filter((item) => item.locationId === location.id);
      const channelMatch =
        channelFilter === "all" ||
        (channelFilter === "Unlisted"
          ? locationItems.some(
              (item) =>
                !(item.marketplaceListings ?? []).some(
                  (listing) => listing.status === "Active",
                ),
            )
          : locationItems.some((item) =>
              (item.marketplaceListings ?? []).some(
                (listing) =>
                  listing.platform === channelFilter && listing.status === "Active",
                ),
            ));
      const savedViewMatch =
        savedView === "all" ||
        locationItems.some((item) => inventoryMatchesSavedView(item, savedView));
      const ageMatch =
        ageBucket === "all" ||
        locationItems.some((item) => inventoryMatchesAgeBucket(item, ageBucket));

      return (
        typeMatch &&
        searchMatch &&
        configurationMatch &&
        channelMatch &&
        savedViewMatch &&
        ageMatch
      );
    })
    .sort((a, b) => {
      if (locationSort === "type") return TYPE_CONFIG[a.type].label.localeCompare(TYPE_CONFIG[b.type].label) || a.name.localeCompare(b.name);
      if (locationSort === "capacity") return (b.capacity ?? -1) - (a.capacity ?? -1) || a.name.localeCompare(b.name);
      if (locationSort === "units") return b.itemCount - a.itemCount || a.name.localeCompare(b.name);
      if (locationSort === "value") return b.estimatedValue - a.estimatedValue || a.name.localeCompare(b.name);
      if (locationSort === "updated") return b.id.localeCompare(a.id);
      return a.name.localeCompare(b.name);
    });

  const selectedItems = items.filter(
    (item) => item.locationId === selectedLocation?.id,
  );
  const putAwayItems = items.filter(
    (item) => item.locationId === PUT_AWAY_QUEUE_ID,
  );
  const openLocation =
    locations.find((location) => location.id === openLocationId) ?? null;
  const openLocationItems = items.filter(
    (item) => item.locationId === openLocationId,
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
    const capacity = locations.reduce(
      (sum, location) => sum + (location.capacity ?? 0),
      0,
    );
    const nearCapacity = locations.filter((location) => {
      if (!location.capacity) return false;
      return location.itemCount / location.capacity >=
        (location.warningThreshold ?? 80) / 100;
    }).length;

    const listedUnits = items.reduce(
      (sum, item) =>
        sum +
        (item.marketplaceListings ?? [])
          .filter((listing) => listing.status === "Active")
          .reduce((listingSum, listing) => listingSum + listing.quantity, 0),
      0,
    );
    const costBasis = items.reduce(
      (sum, item) => sum + (item.costBasis ?? 0) * item.quantity,
      0,
    );
    const listedValue = items.reduce(
      (sum, item) =>
        sum +
        (item.marketplaceListings ?? [])
          .filter((listing) => listing.status === "Active")
          .reduce(
            (listingSum, listing) =>
              listingSum + (listing.price ?? item.unitMarketValue ?? 0) * listing.quantity,
            0,
          ),
      0,
    );
    const listingErrors = items.filter((item) =>
      (item.marketplaceListings ?? []).some((listing) => listing.status === "Error"),
    ).length;
    const overAllocated = items.filter(
      (item) =>
        (item.marketplaceListings ?? [])
          .filter((listing) => listing.status === "Active")
          .reduce((sum, listing) => sum + listing.quantity, 0) > item.quantity,
    ).length;
    return {
      units: items.reduce((sum, item) => sum + item.quantity, 0),
      value: items.reduce((sum, item) => sum + item.value, 0),
      locations: locations.length,
      duplicates: duplicateGroups.length,
      capacity,
      nearCapacity,
      listedUnits,
      availableUnits: Math.max(
        0,
        items.reduce((sum, item) => sum + item.quantity, 0) - listedUnits,
      ),
      costBasis,
      listedValue,
      potentialProfit: listedValue - costBasis,
      listingErrors,
      overAllocated,
    };
  }, [items, locations, duplicateGroups]);

  const channelSummaries = useMemo(() => {
    const platforms: MarketplacePlatform[] = [
      "TCGplayer",
      "eBay",
      "Mana Pool",
      "Trading Docks",
      "In-Store",
    ];
    const summaries = platforms.map((platform) => {
      let units = 0;
      let value = 0;
      items.forEach((item) => {
        (item.marketplaceListings ?? [])
          .filter((listing) => listing.platform === platform && listing.status === "Active")
          .forEach((listing) => {
            units += listing.quantity;
            value += (listing.price ?? item.unitMarketValue ?? 0) * listing.quantity;
          });
      });
      return { platform, units, value };
    });
    const listedItemIds = new Set(
      items
        .filter((item) =>
          (item.marketplaceListings ?? []).some((listing) => listing.status === "Active"),
        )
        .map((item) => item.id),
    );
    return {
      platforms: summaries,
      unlistedUnits: items
        .filter((item) => !listedItemIds.has(item.id))
        .reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [items]);

  const actionCounts = useMemo(
    () => ({
      putAway: putAwayItems.length,
      readyToList: items.filter(
        (item) =>
          item.locationId !== PUT_AWAY_QUEUE_ID &&
          !(item.marketplaceListings ?? []).some((listing) => listing.status === "Active"),
      ).length,
      pricing: items.filter((item) => !item.unitMarketValue).length,
      listingErrors: totals.listingErrors,
      allocation: totals.overAllocated,
      missingLocation: items.filter(
        (item) =>
          item.locationId !== PUT_AWAY_QUEUE_ID &&
          !locations.some((location) => location.id === item.locationId),
      ).length,
    }),
    [items, locations, putAwayItems.length, totals.listingErrors, totals.overAllocated],
  );
  const agingCounts = useMemo(
    () => ({
      "0-30": items.filter((item) => inventoryMatchesAgeBucket(item, "0-30")).length,
      "31-60": items.filter((item) => inventoryMatchesAgeBucket(item, "31-60")).length,
      "61-90": items.filter((item) => inventoryMatchesAgeBucket(item, "61-90")).length,
      "91-180": items.filter((item) => inventoryMatchesAgeBucket(item, "91-180")).length,
      "180+": items.filter((item) => inventoryMatchesAgeBucket(item, "180+")).length,
    }),
    [items],
  );

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function saveLocation(input: {
    name: string;
    type: LocationType;
    description: string;
    capacity?: number;
    zone?: string;
    organization?: string;
    capacityUnit?: LocationRecord["capacityUnit"];
    warningThreshold?: number;
    criticalThreshold?: number;
    binderColumns?: number;
    binderRows?: number;
    binderPages?: number;
    binderDoubleSided?: boolean;
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
        zone: input.zone,
        organization: input.organization,
        capacityUnit: input.capacityUnit,
                warningThreshold: input.warningThreshold,
                criticalThreshold: input.criticalThreshold,
                binderColumns: input.binderColumns,
                binderRows: input.binderRows,
                binderPages: input.binderPages,
                binderDoubleSided: input.binderDoubleSided,
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
    const currentUnits = items.reduce((sum, existing) => sum + existing.quantity, 0);
    if (inventoryLimit != null && inventoryLimit > 0 && currentUnits + item.quantity > inventoryLimit) {
      notify(
        `This would exceed your ${inventoryLimit.toLocaleString("en-US")}-item inventory limit. Reduce the quantity or upgrade your plan.`,
      );
      return;
    }

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

  function updateInventoryItem(itemId: string, updates: Partial<InventoryItem>) {
    const existing = items.find((item) => item.id === itemId);
    if (!existing) return;

    if (typeof updates.quantity === "number") {
      const currentUnits = items.reduce((sum, item) => sum + item.quantity, 0);
      const nextUnits = currentUnits - existing.quantity + updates.quantity;
      if (inventoryLimit != null && inventoryLimit > 0 && nextUnits > inventoryLimit) {
        notify(
          `This would exceed your ${inventoryLimit.toLocaleString("en-US")}-item inventory limit. Reduce the quantity or upgrade your plan.`,
        );
        return;
      }
      const quantityDelta = updates.quantity - existing.quantity;
      const valueDelta =
        (updates.value ?? existing.value) - existing.value;
      if (quantityDelta !== 0 || valueDelta !== 0) {
        updateLocationTotals(existing.locationId, quantityDelta, valueDelta);
      }
    }

    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, ...updates, updatedAt: "Just now" }
          : item,
      ),
    );
    notify("Inventory quantity updated.");
  }

  function addInventoryItem(item: InventoryItem) {
    const destination = locations.find((location) => location.id === item.locationId);
    const filedItem = destination?.type === "binder"
      ? assignFirstBinderPocket(item, destination, items)
      : item;
    setItems((current) => [...current, filedItem]);
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

  function moveItem(
    itemId: string,
    destinationId: string,
    placement?: Pick<InventoryItem, "binderPage" | "binderSlot">,
  ) {
    const currentItems = itemsRef.current;
    const item = currentItems.find((candidate) => candidate.id === itemId);
    if (!item) return;

    const source = locations.find(
      (location) => location.id === item.locationId,
    );
    const destination = locations.find(
      (location) => location.id === destinationId,
    );
    if (!destination) return;

    const staysInLocation = item.locationId === destinationId;
    if (staysInLocation && destination.type !== "binder") return;

    const resolvedBinderPlacement =
      destination.type === "binder"
        ? resolveBinderPlacement(
            destination,
            currentItems,
            item.id,
            placement?.binderPage,
            placement?.binderSlot,
          )
        : null;

    if (destination.type === "binder" && !resolvedBinderPlacement) {
      notify("That binder has no available pocket. The card was not moved.");
      return;
    }

    const binderPlacement =
      destination.type === "binder"
        ? resolvedBinderPlacement!
        : { binderPage: undefined, binderSlot: undefined };

    const duplicate = currentItems.find(
      (candidate) =>
        destination.type !== "binder" &&
        candidate.id !== item.id &&
        candidate.locationId === destinationId &&
        normalizeInventoryKey(candidate) === normalizeInventoryKey(item),
    );

    if (duplicate) {
      const nextItems = currentItems
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
          .filter((candidate) => candidate.id !== item.id);
      itemsRef.current = nextItems;
      setItems(nextItems);
    } else {
      const nextItems = currentItems.map((candidate) =>
          candidate.id === item.id
            ? {
              ...candidate,
              locationId: destinationId,
              ...binderPlacement,
              putAwayOrigin: undefined,
              updatedAt: "Just now",
            }
          : candidate,
        );
      itemsRef.current = nextItems;
      setItems(nextItems);
    }

    if (!staysInLocation) {
      updateLocationTotals(item.locationId, -item.quantity, -item.value);
      updateLocationTotals(destinationId, item.quantity, item.value);
    }

    setMovements((current) => [
      {
        id: crypto.randomUUID(),
        itemName: item.name,
        from: source?.name,
        to: destination.name,
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

  function sendToPutAwayQueue(itemId: string) {
    const currentItems = itemsRef.current;
    const item = currentItems.find((candidate) => candidate.id === itemId);
    if (!item || item.locationId === PUT_AWAY_QUEUE_ID) return;

    const source = locations.find((location) => location.id === item.locationId);
    const queuedItem: InventoryItem = {
      ...item,
      locationId: PUT_AWAY_QUEUE_ID,
      binderPage: undefined,
      binderSlot: undefined,
      putAwayOrigin: {
        locationId: item.locationId,
        binderPage: item.binderPage,
        binderSlot: item.binderSlot,
      },
      updatedAt: "Queued just now",
    };
    const nextItems = currentItems.map((candidate) =>
      candidate.id === itemId ? queuedItem : candidate,
    );

    itemsRef.current = nextItems;
    setItems(nextItems);
    updateLocationTotals(item.locationId, -item.quantity, -item.value);
    setMovements((current) => [
      {
        id: crypto.randomUUID(),
        itemName: item.name,
        from: source?.name,
        to: "Put-Away Queue",
        quantity: item.quantity,
        action: "queued",
        timestamp: "Just now",
      },
      ...current,
    ]);
    notify(`${item.name} was sent to the Put-Away Queue.`);
  }

  function undoPutAway(item: InventoryItem) {
    const origin = item.putAwayOrigin;
    if (!origin) return;
    moveItem(item.id, origin.locationId, {
      binderPage: origin.binderPage,
      binderSlot: origin.binderSlot,
    });
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

  function confirmDeleteInventoryItem() {
    if (!deleteItemCandidate) return;
    const item = deleteItemCandidate;
    const source = locations.find((location) => location.id === item.locationId);
    const nextItems = itemsRef.current.filter((candidate) => candidate.id !== item.id);

    itemsRef.current = nextItems;
    setItems(nextItems);
    updateLocationTotals(item.locationId, -item.quantity, -item.value);
    setMovements((current) => [
      {
        id: crypto.randomUUID(),
        itemName: item.name,
        from: source?.name,
        to: "Deleted from inventory",
        quantity: item.quantity,
        action: "moved",
        timestamp: "Just now",
      },
      ...current,
    ]);
    setDeleteItemCandidate(null);
    notify(`${item.name} was permanently deleted from inventory.`);
  }

  function requestDeleteLocation(location: LocationRecord) {
    if (items.some((item) => item.locationId === location.id)) {
      notify("Move or delete the inventory before deleting this location.");
      return;
    }
    setDeleteLocationCandidate(location);
  }

  return (
    <WorkspaceFrame>
      {!heroCollapsed ? (
        <div className="relative">
          <PageHeader
            eyebrow={hasBusinessAnalytics ? "Inventory Command Center" : canOperate ? "Seller Inventory" : "Personal Collection"}
            title="Every card. Every location. Always accounted for."
            description={
              hasBusinessAnalytics
                ? "Run intake, storage, listings, profitability, and inventory exceptions from one purpose-built workspace."
                : canOperate
                  ? "File, locate, price, and prepare inventory for every connected sales channel."
                  : "Keep your personal collection organized across binders, boxes, and shelves."
            }
            icon={Boxes}
          />
          <button
            type="button"
            onClick={() => setHeroCollapsed(true)}
            className="absolute right-4 top-4 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-[9px] font-semibold text-slate-500 transition hover:text-slate-200"
          >
            Collapse intro
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setHeroCollapsed(false)}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 text-[9px] font-semibold text-slate-500 hover:text-slate-200"
        >
          <Boxes className="h-3.5 w-3.5 text-cyan-300" />
          Show Inventory overview
        </button>
      )}

      {canManageCollection ? <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPutAwayOpen(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-300/[0.18] bg-amber-300/[0.055] px-4 text-[10px] font-semibold text-amber-100 transition hover:border-amber-300/35 hover:bg-amber-300/[0.09]"
        >
          <PackageOpen className="h-4 w-4 text-amber-300" />
          Put Away
          <span className="min-w-5 rounded-md bg-amber-300 px-1.5 py-0.5 text-center text-[8px] font-black text-[#211505]">
            {putAwayItems.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setFileModalOpen(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 to-sky-500 px-4 text-[10px] font-bold text-[#001018] shadow-[0_10px_30px_rgba(34,211,238,0.13)]"
        >
          <Plus className="h-4 w-4" />
          File inventory
        </button>
      </div> : null}

      <div className={`mt-5 grid gap-4 sm:grid-cols-2 ${hasBusinessAnalytics ? "xl:grid-cols-6" : "xl:grid-cols-4"}`}>
        <MetricCard
          label="Physical units"
          value={totals.units.toLocaleString("en-US")}
          detail={`${totals.availableUnits.toLocaleString("en-US")} available to list`}
          icon={Boxes}
        />
        <MetricCard
          label="Inventory value"
          value={currency(totals.value)}
          detail="Live value across every location"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Available to list"
          value={totals.availableUnits.toLocaleString("en-US")}
          detail={`${totals.listedUnits.toLocaleString("en-US")} committed to channels`}
          icon={ShoppingCart}
        />
        <MetricCard
          label="Inventory exceptions"
          value={String(totals.duplicates)}
          detail="Duplicates requiring review"
          icon={Copy}
        />
        {hasBusinessAnalytics ? (
          <>
            <MetricCard
              label="Listed value"
              value={currency(totals.listedValue)}
              detail="Active marketplace listings"
              icon={Store}
            />
            <MetricCard
              label="Potential profit"
              value={currency(totals.potentialProfit)}
              detail={`${currency(totals.costBasis)} tracked cost basis`}
              icon={TrendingUp}
            />
          </>
        ) : null}
      </div>

      {canOperate ? (
        <InventoryOperationsSummary
          channels={channelSummaries}
          activeChannel={channelFilter}
          onChannelChange={setChannelFilter}
          actions={actionCounts}
          business={hasBusinessAnalytics}
        />
      ) : null}
      {hasBusinessAnalytics ? (
        <BusinessInventoryInsights
          activeView={savedView}
          onViewChange={setSavedView}
          activeAge={ageBucket}
          onAgeChange={setAgeBucket}
          agingCounts={agingCounts}
        />
      ) : null}

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-4`}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-white/[0.07] bg-black/20 p-1">
              <button
                type="button"
                onClick={() => setViewMode("visual")}
                className={`flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-xs font-medium tracking-[-0.01em] transition ${viewMode === "visual" ? "bg-cyan-400/10 text-cyan-100" : "text-slate-500 hover:text-slate-300"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Visual Map
              </button>
              <button
                type="button"
                onClick={() => setViewMode("operations")}
                className={`flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-xs font-medium tracking-[-0.01em] transition ${viewMode === "operations" ? "bg-cyan-400/10 text-cyan-100" : "text-slate-500 hover:text-slate-300"}`}
              >
                <List className="h-3.5 w-3.5" />
                Operations
              </button>
              </div>
              <label className="relative">
                <span className="sr-only">Location category</span>
                <select
                  value={activeType}
                  onChange={(event) => setActiveType(event.target.value as LocationType | "all")}
                  className="inventory-location-select h-11 min-w-[190px] appearance-none rounded-xl border border-white/[0.08] bg-[#06131d] px-3.5 pr-9 text-[10px] font-semibold text-slate-200 outline-none focus:border-cyan-300/25"
                >
                  <option value="all">All locations ({locations.length})</option>
                  {(Object.keys(TYPE_CONFIG) as LocationType[]).map((type) => (
                    <option key={type} value={type}>
                      {TYPE_CONFIG[type].label} ({locations.filter((location) => location.type === type).length})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              </label>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex h-11 min-w-0 items-center gap-3 rounded-xl border border-white/[0.08] bg-[#06131d] px-3.5 focus-within:border-cyan-300/25 sm:w-[300px]">
              <Search className="h-4 w-4 shrink-0 text-cyan-300/70" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search storage locations..."
                className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-200 outline-none placeholder:text-slate-600"
              />
            </label>
            <div className="flex h-11 rounded-xl border border-white/[0.08] bg-[#06131d] p-1">
              <button type="button" onClick={() => setLocationDisplay("cards")} className={`flex items-center gap-1.5 rounded-lg px-3 text-[9px] font-semibold transition ${locationDisplay === "cards" ? "bg-cyan-400/10 text-cyan-100" : "text-slate-500 hover:text-slate-300"}`}><LayoutGrid className="h-3.5 w-3.5" /> Cards</button>
              <button type="button" onClick={() => setLocationDisplay("list")} className={`flex items-center gap-1.5 rounded-lg px-3 text-[9px] font-semibold transition ${locationDisplay === "list" ? "bg-cyan-400/10 text-cyan-100" : "text-slate-500 hover:text-slate-300"}`}><List className="h-3.5 w-3.5" /> List</button>
            </div>
            <label className="relative">
              <span className="sr-only">Sort locations</span>
              <select
                value={locationSort}
                onChange={(event) => setLocationSort(event.target.value as typeof locationSort)}
                className="inventory-location-select h-11 appearance-none rounded-xl border border-white/[0.08] bg-[#06131d] px-3.5 pr-9 text-[9px] font-semibold text-slate-300 outline-none focus:border-cyan-300/25"
              >
                <option value="name">Sort: Name</option>
                <option value="type">Sort: Type</option>
                <option value="capacity">Sort: Capacity</option>
                <option value="units">Sort: Units</option>
                <option value="value">Sort: Value</option>
                <option value="updated">Sort: Recently added</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            </label>

            <button
              type="button"
              onClick={() => {
                setEditingLocation(null);
                setLocationModalOpen(true);
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 to-sky-500 px-4 text-[10px] font-bold text-[#001018] shadow-[0_10px_30px_rgba(34,211,238,0.13)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add location
            </button>
          </div>
        </div>

          <div className="flex flex-wrap gap-2 border-t border-white/[0.055] pt-3">
            <TypeButton active={activeType === "all"} label={`All ${locations.length}`} icon={FolderKanban} onClick={() => setActiveType("all")} />
            {(Object.keys(TYPE_CONFIG) as LocationType[]).map((type) => (
              <TypeButton
                key={type}
                active={activeType === type}
                label={`${type === "custom" ? "Other" : TYPE_CONFIG[type].label} ${locations.filter((location) => location.type === type).length}`}
                icon={TYPE_CONFIG[type].icon}
                onClick={() => setActiveType(type)}
              />
            ))}
            <button
              type="button"
              onClick={() => setShowUnconfiguredOnly((current) => !current)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[9px] font-semibold transition ${
                showUnconfiguredOnly
                  ? "border-amber-300/20 bg-amber-300/[0.07] text-amber-100"
                  : "border-transparent text-slate-600 hover:border-white/[0.06] hover:text-slate-300"
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Needs setup ({locations.filter((location) => !location.capacity || !location.organization).length})
            </button>
          </div>
        </div>
      </section>

      <div className="mt-5">
        <section className={`${styles.glassPanel} min-w-0 rounded-[26px] p-5`}>
          <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Main Warehouse / All Zones
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Storage map
              </h2>
              <p className="mt-1 text-[9px] text-slate-600">
                Click any location to open its inventory. Names, capacity, organization, and type are editable.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[8px] font-medium text-slate-500">
              <span className="h-2 w-2 rounded-full bg-cyan-300" /> Available
              <span className="ml-2 h-2 w-2 rounded-full bg-amber-300" /> Near capacity
              <span className="ml-2 h-2 w-2 rounded-full bg-red-400" /> Critical
            </div>
          </div>

          <div className={viewMode === "visual" && locationDisplay === "cards" ? "mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "mt-5 space-y-2.5"}>
            {visibleLocations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                selected={selectedLocation?.id === location.id}
                onSelect={() => {
                  setSelectedLocationId(location.id);
                  setOpenLocationId(location.id);
                }}
                onEdit={() => {
                  setEditingLocation(location);
                  setLocationModalOpen(true);
                }}
                onDelete={() => requestDeleteLocation(location)}
                compact={viewMode === "operations" || locationDisplay === "list"}
                items={items.filter((item) => item.locationId === location.id)}
                editable={canManageCollection}
              />
            ))}
          </div>
          {!visibleLocations.length ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-5 py-14 text-center">
              <Warehouse className="mx-auto h-7 w-7 text-slate-700" />
              <p className="mt-4 text-sm font-semibold text-slate-300">Build your physical inventory map</p>
              <p className="mx-auto mt-2 max-w-md text-[10px] leading-5 text-slate-600">Create a box, binder, shelf, display case, or custom location. You can rename it and change capacity at any time.</p>
              <button type="button" onClick={() => { setEditingLocation(null); setLocationModalOpen(true); }} className="mt-5 rounded-xl bg-cyan-400 px-4 py-2.5 text-[10px] font-bold text-[#001018]">Create first location</button>
            </div>
          ) : null}
        </section>

        <section className="hidden">
          {selectedLocation ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
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
                    <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-cyan-300">{selectedLocation.zone || "Main Warehouse"}</p>
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
                  aria-label="Edit location"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-slate-400 hover:border-cyan-300/20 hover:text-cyan-200"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <CompactMetric
                  label="Units"
                  value={selectedLocation.itemCount.toLocaleString("en-US")}
                />
                <CompactMetric
                  label="Tracked value"
                  value={currency(selectedLocation.estimatedValue)}
                />
                <CompactMetric
                  label="Available"
                  value={
                    selectedLocation.capacity
                      ? Math.max(0, selectedLocation.capacity - selectedLocation.itemCount).toLocaleString("en-US")
                      : "Not set"
                  }
                />
                <CompactMetric label="Organized by" value={selectedLocation.organization || "Not set"} />
              </div>

              {selectedLocation.capacity ? (
                <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/10 p-4">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="font-semibold text-slate-300">Capacity</span>
                    <span className="text-slate-500">{selectedLocation.itemCount.toLocaleString("en-US")} / {selectedLocation.capacity.toLocaleString("en-US")} {selectedLocation.capacityUnit || "cards"}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className={`h-full rounded-full ${capacityTone(selectedLocation)}`} style={{ width: `${capacityPercent(selectedLocation)}%` }} />
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setFileModalOpen(true)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 text-[9px] font-bold text-[#001018]"><Plus className="h-3.5 w-3.5" /> File here</button>
                <button type="button" onClick={() => notify("QR label is queued for the printing phase.")} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] text-[9px] font-semibold text-slate-300"><Tag className="h-3.5 w-3.5" /> QR label</button>
              </div>

              <div className="mt-5 max-h-[360px] overflow-auto rounded-2xl border border-white/[0.06]">
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

      <div className={`mt-5 grid gap-5 ${duplicateGroups.length ? "xl:grid-cols-[1fr_1fr]" : ""}`}>
        <DuplicateCenter
          groups={duplicateGroups}
          locations={locations}
          onSelectLocation={setSelectedLocationId}
        />

        <MovementHistory movements={movements} business={hasBusinessAnalytics} />
      </div>

      <LocationModal
        open={locationModalOpen}
        location={editingLocation}
        onClose={() => {
          setLocationModalOpen(false);
          setEditingLocation(null);
        }}
        onSave={saveLocation}
      />

      <LocationContentsModal
        location={openLocation}
        items={openLocationItems}
        allItems={items}
        locations={locations}
        onClose={() => setOpenLocationId("")}
        onFile={() => {
          if (openLocation) setSelectedLocationId(openLocation.id);
          setOpenLocationId("");
          setFileModalOpen(true);
        }}
        onEdit={() => {
          if (!openLocation) return;
          setEditingLocation(openLocation);
          setOpenLocationId("");
          setLocationModalOpen(true);
        }}
        onMove={moveItem}
        onUpdateItem={updateInventoryItem}
        onUpdateLocation={(updates) => {
          if (!openLocation) return;
          setLocations((current) =>
            current.map((location) =>
              location.id === openLocation.id ? { ...location, ...updates } : location,
            ),
          );
          notify("Binder settings saved.");
        }}
        putAwayCount={putAwayItems.length}
        onOpenPutAway={() => setPutAwayOpen(true)}
        onSendToPutAway={sendToPutAwayQueue}
        onUndoPutAway={undoPutAway}
        onDeleteItem={setDeleteItemCandidate}
        onDeleteLocation={requestDeleteLocation}
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

      {putAwayOpen ? (
        <PutAwayDrawer
          items={putAwayItems}
          locations={locations}
          allItems={items}
          onClose={() => setPutAwayOpen(false)}
          onMove={moveItem}
          onUndo={undoPutAway}
          onDelete={setDeleteItemCandidate}
        />
      ) : null}

      {deleteItemCandidate ? (
        <ConfirmDeleteDialog
          title="Delete from inventory?"
          description={`${deleteItemCandidate.name} and its complete inventory record will be permanently removed. This is different from sending it to the Put-Away Queue and cannot be undone.`}
          confirmLabel="Delete permanently"
          onCancel={() => setDeleteItemCandidate(null)}
          onConfirm={confirmDeleteInventoryItem}
        />
      ) : null}

      {deleteLocationCandidate ? (
        <ConfirmDeleteDialog
          title={`Delete ${deleteLocationCandidate.name}?`}
          description="This empty storage location will be permanently removed from your inventory map. This cannot be undone."
          confirmLabel="Delete location"
          onCancel={() => setDeleteLocationCandidate(null)}
          onConfirm={() => {
            deleteLocation(deleteLocationCandidate);
            setDeleteLocationCandidate(null);
            setOpenLocationId("");
          }}
        />
      ) : null}

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

function InventoryOperationsSummary({
  channels,
  activeChannel,
  onChannelChange,
  actions,
  business,
}: {
  channels: {
    platforms: { platform: MarketplacePlatform; units: number; value: number }[];
    unlistedUnits: number;
  };
  activeChannel: MarketplacePlatform | "Unlisted" | "all";
  onChannelChange: (channel: MarketplacePlatform | "Unlisted" | "all") => void;
  actions: {
    putAway: number;
    readyToList: number;
    pricing: number;
    listingErrors: number;
    allocation: number;
    missingLocation: number;
  };
  business: boolean;
}) {
  const actionItems = [
    ["Ready for put-away", actions.putAway, PackageOpen, "text-amber-300"],
    ["Ready to list", actions.readyToList, Store, "text-cyan-300"],
    ["Pricing needed", actions.pricing, CircleDollarSign, "text-violet-300"],
    ["Listing errors", actions.listingErrors, AlertTriangle, "text-red-300"],
    ["Over-allocated", actions.allocation, ShieldAlert, "text-red-300"],
    ["Missing location", actions.missingLocation, MapPin, "text-amber-300"],
  ] as const;
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Sales channel inventory</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Where inventory is committed</h2>
            <p className="mt-1 text-[9px] text-slate-600">Select a channel to focus the operational view.</p>
          </div>
          <Store className="h-4 w-4 text-cyan-300" />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <ChannelSummaryButton
            label="Unlisted"
            units={channels.unlistedUnits}
            value={0}
            active={activeChannel === "Unlisted"}
            onClick={() => onChannelChange(activeChannel === "Unlisted" ? "all" : "Unlisted")}
          />
          {channels.platforms.map((channel) => (
            <ChannelSummaryButton
              key={channel.platform}
              label={channel.platform}
              units={channel.units}
              value={channel.value}
              active={activeChannel === channel.platform}
              onClick={() => onChannelChange(activeChannel === channel.platform ? "all" : channel.platform)}
            />
          ))}
        </div>
      </section>
      <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-300">Needs attention</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Inventory action queue</h2>
          </div>
          <ClipboardCheck className="h-4 w-4 text-amber-300" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {actionItems.map(([label, count, Icon, tone]) => (
            <button key={label} type="button" className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/[0.08] p-3 text-left transition hover:border-cyan-300/15">
              <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-200">{count}</span>
                <span className="block truncate text-[8px] text-slate-600">{label}</span>
              </span>
            </button>
          ))}
        </div>
        {!business ? (
          <p className="mt-3 flex items-center gap-2 text-[8px] text-slate-600">
            <LockKeyhole className="h-3 w-3" /> Aging, profit alerts, and team assignments are available on Business.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function ChannelSummaryButton({
  label,
  units,
  value,
  active,
  onClick,
}: {
  label: string;
  units: number;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? "border-cyan-300/25 bg-cyan-400/[0.07]"
          : "border-white/[0.06] bg-black/[0.08] hover:border-cyan-300/15"
      }`}
    >
      <span className="text-[9px] font-semibold text-slate-300">{label}</span>
      <span className="mt-2 flex items-end justify-between gap-2">
        <span className="text-lg font-semibold text-white">{units.toLocaleString("en-US")}</span>
        <span className="text-[8px] text-slate-600">{value ? currency(value) : "units"}</span>
      </span>
    </button>
  );
}

function BusinessInventoryInsights({
  activeView,
  onViewChange,
  activeAge,
  onAgeChange,
  agingCounts,
}: {
  activeView: BusinessSavedView;
  onViewChange: (view: BusinessSavedView) => void;
  activeAge: InventoryAgeBucket;
  onAgeChange: (bucket: InventoryAgeBucket) => void;
  agingCounts: Record<Exclude<InventoryAgeBucket, "all">, number>;
}) {
  const views: { id: BusinessSavedView; label: string }[] = [
    { id: "recent", label: "Recently acquired" },
    { id: "unlisted", label: "Not listed anywhere" },
    { id: "multi-channel", label: "Multiple channels" },
    { id: "high-value", label: "High value" },
    { id: "no-cost", label: "No cost basis" },
    { id: "no-location", label: "No location" },
    { id: "errors", label: "Marketplace errors" },
  ];
  const buckets: Exclude<InventoryAgeBucket, "all">[] = [
    "0-30",
    "31-60",
    "61-90",
    "91-180",
    "180+",
  ];
  return (
    <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-300">Business saved views</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Focus the warehouse in one click</h2>
            </div>
            {activeView !== "all" ? (
              <button type="button" onClick={() => onViewChange("all")} className="text-[9px] font-semibold text-cyan-300">Clear view</button>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => onViewChange(activeView === view.id ? "all" : view.id)}
                className={`h-9 rounded-xl border px-3 text-[9px] font-semibold transition ${
                  activeView === view.id
                    ? "border-violet-300/25 bg-violet-400/[0.08] text-violet-100"
                    : "border-white/[0.06] text-slate-500 hover:border-violet-300/15 hover:text-slate-200"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-300">Inventory aging</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Time since last inventory update</h2>
            </div>
            {activeAge !== "all" ? (
              <button type="button" onClick={() => onAgeChange("all")} className="text-[9px] font-semibold text-cyan-300">Clear age</button>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {buckets.map((bucket) => (
              <button
                key={bucket}
                type="button"
                onClick={() => onAgeChange(activeAge === bucket ? "all" : bucket)}
                className={`rounded-xl border px-2 py-3 text-center transition ${
                  activeAge === bucket
                    ? "border-amber-300/25 bg-amber-400/[0.07]"
                    : "border-white/[0.06] bg-black/[0.08] hover:border-amber-300/15"
                }`}
              >
                <span className="block text-sm font-semibold text-slate-200">{agingCounts[bucket]}</span>
                <span className="mt-1 block text-[7px] text-slate-600">{bucket} days</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-[#01070c]/78 p-5 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-[24px] border border-red-300/[0.15] bg-[#091721] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.72)]"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-300/15 bg-red-400/[0.07] text-red-300">
          <Trash2 className="h-5 w-5" />
        </span>
        <h3 className="mt-5 text-lg font-semibold text-slate-100">{title}</h3>
        <p className="mt-2 text-[10px] leading-5 text-slate-500">{description}</p>
        <div className="mt-4 rounded-xl border border-red-300/10 bg-red-400/[0.035] px-3 py-2.5 text-[9px] leading-4 text-red-100/75">
          If you only need to refile a card, use the Put-Away Queue instead.
        </div>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-xl border border-white/[0.08] text-[10px] font-semibold text-slate-400">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="h-11 flex-[1.35] rounded-xl bg-red-400 text-[10px] font-bold text-[#260707] shadow-[0_10px_28px_rgba(248,113,113,0.16)]">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function LocationCard({
  location,
  selected,
  onSelect,
  onEdit,
  onDelete,
  compact,
  items,
  editable,
}: {
  location: LocationRecord;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  compact: boolean;
  items: InventoryItem[];
  editable: boolean;
}) {
  const config = TYPE_CONFIG[location.type];
  const Icon = config.icon;
  const capacity = capacityPercent(location);
  const isCritical = capacity >= (location.criticalThreshold ?? 95);
  const isWarning = capacity >= (location.warningThreshold ?? 80);
  const typeDetail =
    location.type === "binder" && location.binderPages
      ? `${config.label.replace(/s$/, "")} · ${location.binderPages} pages`
      : location.capacity
        ? `${config.label.replace(/s$/, "")} · ${location.capacity.toLocaleString("en-US")} ${location.capacityUnit ?? "cards"}`
        : config.label.replace(/s$/, "");
  const costBasis = items.reduce(
    (sum, item) => sum + (item.costBasis ?? 0) * item.quantity,
    0,
  );
  const listedUnits = items.reduce(
    (sum, item) =>
      sum +
      (item.marketplaceListings ?? [])
        .filter((listing) => listing.status === "Active")
        .reduce((listingSum, listing) => listingSum + listing.quantity, 0),
    0,
  );
  const lastActivity = items
    .map((item) => item.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border transition duration-200",
        compact ? "p-3.5" : "flex min-h-[310px] flex-col p-4",
        selected
          ? "border-cyan-300/30 bg-cyan-400/[0.055] shadow-[0_18px_50px_rgba(6,182,212,0.07)]"
          : "border-white/[0.07] bg-black/[0.10] hover:-translate-y-0.5 hover:border-cyan-300/[0.16]",
      ].join(" ")}
    >
      {!compact ? <div className={`absolute inset-x-0 top-0 h-0.5 ${isCritical ? "bg-red-400" : isWarning ? "bg-amber-300" : "bg-cyan-300/60"}`} /> : null}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Open ${location.name} contents`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40"
        >
          <span
            className={`flex shrink-0 items-center justify-center rounded-2xl border ${compact ? "h-10 w-10" : "h-16 w-16"} ${config.className}`}
          >
            <Icon className={compact ? "h-4 w-4" : "h-7 w-7"} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[8px] font-semibold uppercase tracking-[0.15em] text-slate-600">
              {location.zone || "Main Warehouse"}
            </span>
            <span className={`mt-1 block font-semibold leading-5 text-slate-100 ${compact ? "truncate text-[11px]" : "line-clamp-2 min-h-10 text-sm"}`}>
              {location.name}
            </span>
            <span className="mt-1 block text-[8px] text-slate-500">
              {location.itemCount.toLocaleString("en-US")} units ·{" "}
              {currency(location.estimatedValue)}
            </span>
            {!compact ? <span className="mt-1.5 block text-[8px] font-medium text-slate-600">{typeDetail}</span> : null}
          </span>
        </button>

        {editable ? <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${location.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.055] bg-white/[0.018] text-slate-600 opacity-70 hover:text-cyan-300 group-hover:opacity-100"
          >
            <Edit3 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${location.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.055] bg-white/[0.018] text-slate-600 opacity-70 hover:text-red-300 group-hover:opacity-100"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div> : null}
      </div>

      {!compact ? (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 py-2.5">
            <p className="text-[7px] uppercase tracking-[0.14em] text-slate-700">Organized by</p>
            {location.organization ? (
              <p className="mt-1.5 truncate text-[9px] font-semibold text-slate-400">{location.organization}</p>
            ) : (
              <button type="button" onClick={onEdit} className="mt-1.5 text-[9px] font-semibold text-cyan-300/80 hover:text-cyan-200">Set method</button>
            )}
          </div>
          <div className="rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 py-2.5">
            <p className="text-[7px] uppercase tracking-[0.14em] text-slate-700">Available / listed</p>
            <p className="mt-1.5 text-[9px] font-semibold text-slate-400">{Math.max(0, location.itemCount - listedUnits)} / {listedUnits}</p>
          </div>
          <div className="rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 py-2.5">
            <p className="text-[7px] uppercase tracking-[0.14em] text-slate-700">Cost basis</p>
            <p className="mt-1.5 text-[9px] font-semibold text-slate-400">{currency(costBasis)}</p>
          </div>
          <div className="rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 py-2.5">
            <p className="text-[7px] uppercase tracking-[0.14em] text-slate-700">Unique items</p>
            <p className="mt-1.5 text-[9px] font-semibold text-slate-400">{items.length} · {lastActivity || "No activity"}</p>
          </div>
        </div>
      ) : null}

      <div className={compact ? "mt-3" : "mt-4 min-h-[39px]"}>
        {location.capacity ? (
          <>
          <div className="mb-2 flex items-center justify-between text-[8px]">
            <span className="text-slate-600">Capacity</span>
            <span className="font-semibold text-slate-400">{location.itemCount.toLocaleString("en-US")} / {location.capacity.toLocaleString("en-US")} · {capacity}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className={`h-full rounded-full ${capacityTone(location)}`}
              style={{ width: `${capacity}%` }}
            />
          </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-between rounded-lg border border-dashed border-white/[0.07] px-2.5 py-2 text-[8px]">
            <span className="text-slate-600">Capacity not configured</span>
            {editable ? <button type="button" onClick={onEdit} className="font-semibold text-cyan-300/80 hover:text-cyan-200">Set capacity</button> : null}
          </div>
        )}
      </div>

      {!compact ? (
        <button
          type="button"
          onClick={onSelect}
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/[0.12] bg-cyan-400/[0.045] px-3 py-2.5 text-[10px] font-semibold text-cyan-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/[0.08]"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Open contents
        </button>
      ) : null}
    </div>
  );
}

function capacityPercent(location: LocationRecord) {
  if (!location.capacity) return 0;
  return Math.min(100, Math.round((location.itemCount / location.capacity) * 100));
}

function capacityTone(location: LocationRecord) {
  const percent = capacityPercent(location);
  if (percent >= (location.criticalThreshold ?? 95)) return "bg-gradient-to-r from-red-500 to-rose-300";
  if (percent >= (location.warningThreshold ?? 80)) return "bg-gradient-to-r from-amber-500 to-yellow-300";
  return "bg-gradient-to-r from-cyan-500 to-cyan-300";
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

function LocationContentsModal({
  location,
  items,
  allItems,
  locations,
  onClose,
  onFile,
  onEdit,
  onMove,
  onUpdateItem,
  onUpdateLocation,
  putAwayCount,
  onOpenPutAway,
  onSendToPutAway,
  onUndoPutAway,
  onDeleteItem,
  onDeleteLocation,
}: {
  location: LocationRecord | null;
  items: InventoryItem[];
  allItems: InventoryItem[];
  locations: LocationRecord[];
  onClose: () => void;
  onFile: () => void;
  onEdit: () => void;
  onMove: (
    itemId: string,
    locationId: string,
    placement?: Pick<InventoryItem, "binderPage" | "binderSlot">,
  ) => void;
  onUpdateItem: (itemId: string, updates: Partial<InventoryItem>) => void;
  onUpdateLocation: (updates: Partial<LocationRecord>) => void;
  putAwayCount: number;
  onOpenPutAway: () => void;
  onSendToPutAway: (itemId: string) => void;
  onUndoPutAway: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => void;
  onDeleteLocation: (location: LocationRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [condition, setCondition] = useState("all");
  const [finish, setFinish] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDestination, setBulkDestination] = useState("");
  const [focusedItemId, setFocusedItemId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showImages, setShowImages] = useState(false);

  useEffect(() => {
    setQuery("");
    setCategory("all");
    setCondition("all");
    setFinish("all");
    setSortBy("name-asc");
    setPage(1);
    setSelectedIds([]);
    setBulkDestination("");
    setFocusedItemId("");
  }, [location?.id]);

  if (!location) return null;

  if (location.type === "binder") {
    return (
      <VirtualBinderModal
        location={location}
        items={items}
        allItems={allItems}
        locations={locations}
        onClose={onClose}
        onFile={onFile}
        onEdit={onEdit}
        onMove={onMove}
        onUpdateItem={onUpdateItem}
        onUpdateLocation={onUpdateLocation}
        putAwayCount={putAwayCount}
        onOpenPutAway={onOpenPutAway}
        onSendToPutAway={onSendToPutAway}
        onUndoPutAway={onUndoPutAway}
        onDeleteItem={onDeleteItem}
      />
    );
  }

  const config = TYPE_CONFIG[location.type];
  const Icon = config.icon;
  const categoryOptions = [...new Set(items.map((item) => item.category))].sort();
  const conditionOptions = [...new Set(items.map((item) => item.condition).filter(Boolean))] as string[];
  const finishOptions = [...new Set(items.map((item) => item.finish).filter(Boolean))] as string[];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items
    .filter((item) => {
      const queryMatch = `${item.name} ${item.sku} ${item.set ?? ""} ${item.collectorNumber ?? ""} ${item.condition ?? ""} ${item.finish ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery);
      return queryMatch
        && (category === "all" || item.category === category)
        && (condition === "all" || item.condition === condition)
        && (finish === "all" || item.finish === finish);
    })
    .sort((a, b) => {
      if (sortBy === "name-desc") return b.name.localeCompare(a.name);
      if (sortBy === "value-desc") return (b.unitMarketValue ?? b.value) - (a.unitMarketValue ?? a.value);
      if (sortBy === "quantity-desc") return b.quantity - a.quantity;
      if (sortBy === "recent") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (sortBy === "set") return (a.set ?? "").localeCompare(b.set ?? "") || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);
  const focusedItem = items.find((item) => item.id === focusedItemId) ?? null;
  const hasFilters = Boolean(query) || category !== "all" || condition !== "all" || finish !== "all";
  const visibleSelected = pageItems.filter((item) => selectedIds.includes(item.id));
  const allVisibleSelected = pageItems.length > 0 && visibleSelected.length === pageItems.length;

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setCondition("all");
    setFinish("all");
    setPage(1);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id],
    );
  }

  function moveSelected() {
    if (!bulkDestination) return;
    selectedIds.forEach((itemId) => onMove(itemId, bulkDestination));
    setSelectedIds([]);
    setBulkDestination("");
  }

  return (
    <div className="fixed inset-0 z-[120] flex bg-[#01070c]/88 p-2 backdrop-blur-xl sm:p-5" role="dialog" aria-modal="true" aria-label={`${location.name} inventory explorer`}>
      <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#07131d] shadow-[0_30px_120px_rgba(0,0,0,0.75)]">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.065] px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="flex h-10 items-center gap-2 rounded-xl border border-cyan-300/[0.16] bg-cyan-400/[0.045] px-3 text-[10px] font-semibold text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.08]">
            <ArrowLeft className="h-3.5 w-3.5" /> Return to Inventory
          </button>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${config.className}`}><Icon className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-300">{location.zone || "Main Warehouse"} · {config.label}</p>
            <div className="mt-1 flex items-baseline gap-3">
              <h2 className="truncate text-lg font-semibold text-slate-100">{location.name}</h2>
              <span className="hidden text-[10px] text-slate-500 sm:inline">{items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("en-US")} units · {currency(items.reduce((sum, item) => sum + item.value, 0))}</span>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button type="button" onClick={onEdit} className="hidden h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-semibold text-slate-300 sm:flex"><Edit3 className="h-3.5 w-3.5" /> Edit location</button>
            <button type="button" onClick={() => onDeleteLocation(location)} className="hidden h-9 items-center gap-2 rounded-xl border border-red-300/[0.12] bg-red-400/[0.025] px-3 text-[10px] font-semibold text-red-200 transition hover:border-red-300/25 hover:bg-red-400/[0.07] sm:flex">
              <Trash2 className="h-3.5 w-3.5" /> Delete box
            </button>
            <button type="button" onClick={onFile} className="flex h-9 items-center gap-2 rounded-xl bg-cyan-400 px-3 text-[10px] font-bold text-[#001018]"><Plus className="h-3.5 w-3.5" /> File here</button>
            <button type="button" onClick={onClose} aria-label="Close inventory explorer" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-slate-500 hover:text-slate-100"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="shrink-0 border-b border-white/[0.055] bg-[#081721] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/[0.09] bg-[#050e15] px-3.5 focus-within:border-cyan-300/30 focus-within:ring-2 focus-within:ring-cyan-300/[0.06]">
              <Search className="h-4 w-4 shrink-0 text-cyan-300/70" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search card name, set, collector number, SKU, condition…" className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600" />
              {query ? <button type="button" onClick={() => setQuery("")} className="text-slate-600 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button> : <span className="hidden rounded-md border border-white/[0.07] px-2 py-1 text-[8px] text-slate-600 sm:block">Fast search</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowFilters((value) => !value)} className={`flex h-11 items-center gap-2 rounded-xl border px-3.5 text-[10px] font-semibold ${showFilters || hasFilters ? "border-cyan-300/20 bg-cyan-400/[0.07] text-cyan-200" : "border-white/[0.08] text-slate-400"}`}><SlidersHorizontal className="h-3.5 w-3.5" /> Filters {hasFilters ? "•" : ""}</button>
              <label className="relative min-w-[180px] flex-1 sm:flex-none">
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="inventory-location-select h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#07141e] pl-3 pr-8 text-[10px] text-slate-300 outline-none">
                  <option value="name-asc">Name: A–Z</option><option value="name-desc">Name: Z–A</option><option value="set">Set, then name</option><option value="quantity-desc">Highest quantity</option><option value="value-desc">Highest value</option><option value="recent">Recently updated</option>
                </select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
              </label>
              <button type="button" onClick={() => setShowImages((value) => !value)} className={`flex h-11 items-center gap-2 rounded-xl border px-3.5 text-[10px] font-semibold ${showImages ? "border-violet-300/20 bg-violet-400/[0.07] text-violet-200" : "border-white/[0.08] text-slate-400"}`}><LayoutGrid className="h-3.5 w-3.5" /> Card art</button>
            </div>
          </div>
          {showFilters ? (
            <div className="mt-3 grid gap-2 rounded-xl border border-white/[0.06] bg-black/10 p-3 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
              <ExplorerSelect label="Category" value={category} onChange={(value) => { setCategory(value); setPage(1); }} options={categoryOptions} />
              <ExplorerSelect label="Condition" value={condition} onChange={(value) => { setCondition(value); setPage(1); }} options={conditionOptions} />
              <ExplorerSelect label="Finish" value={finish} onChange={(value) => { setFinish(value); setPage(1); }} options={finishOptions} />
              <button type="button" onClick={resetFilters} disabled={!hasFilters} className="h-10 rounded-xl border border-white/[0.07] px-4 text-[10px] font-semibold text-slate-400 disabled:cursor-not-allowed disabled:opacity-35">Clear filters</button>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[9px]">
            <span className="font-semibold text-slate-300">{filteredItems.length.toLocaleString("en-US")} records</span>
            <span className="text-slate-600">{filteredItems.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("en-US")} matching units</span>
            <span className="text-slate-600">{currency(filteredItems.reduce((sum, item) => sum + item.value, 0))} matching value</span>
            {hasFilters ? <span className="text-cyan-300">Filtered from {items.length.toLocaleString("en-US")}</span> : null}
          </div>
        </div>

        {selectedIds.length ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-cyan-300/[0.12] bg-cyan-400/[0.045] px-5 py-3 sm:px-6">
            <CheckSquare2 className="h-4 w-4 text-cyan-300" /><span className="text-[10px] font-semibold text-cyan-100">{selectedIds.length} selected</span>
            <label className="relative ml-auto min-w-[210px]">
              <select value={bulkDestination} onChange={(event) => setBulkDestination(event.target.value)} className="inventory-location-select h-9 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#07141e] pl-3 pr-8 text-[9px] text-slate-300"><option value="">Choose destination…</option>{locations.filter((destination) => destination.id !== location.id).map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}</select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
            </label>
            <button type="button" onClick={moveSelected} disabled={!bulkDestination} className="h-9 rounded-xl bg-cyan-400 px-4 text-[9px] font-bold text-[#001018] disabled:opacity-40">Move selected</button>
            <button type="button" onClick={() => setSelectedIds([])} className="h-9 px-2 text-[9px] text-slate-500">Cancel</button>
          </div>
        ) : null}

        {filteredItems.length ? (
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-[#0a1923] text-[8px] font-semibold uppercase tracking-[0.13em] text-slate-600 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
                  <tr>
                    <th className="w-11 px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !pageItems.some((item) => item.id === id)) : [...new Set([...current, ...pageItems.map((item) => item.id)])])} className="accent-cyan-400" aria-label="Select visible records" /></th>
                    {showImages ? <th className="w-12 px-2 py-3">Art</th> : null}
                    <th className="px-3 py-3">Card / Product</th><th className="px-3 py-3">Set / No.</th><th className="px-3 py-3">Condition</th><th className="px-3 py-3">Finish</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3 text-right">Unit value</th><th className="px-3 py-3 text-right">Total</th><th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => {
                    const unitValue = item.unitMarketValue ?? (item.quantity ? item.value / item.quantity : item.value);
                    return (
                      <tr key={item.id} onClick={() => setFocusedItemId(item.id)} className={`group cursor-pointer border-b border-white/[0.04] text-[10px] transition hover:bg-cyan-400/[0.03] ${focusedItemId === item.id ? "bg-cyan-400/[0.045]" : ""}`}>
                        <td className="px-4 py-2.5" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} className="accent-cyan-400" aria-label={`Select ${item.name}`} /></td>
                        {showImages ? <td className="px-2 py-2"><span className="flex h-10 w-8 items-center justify-center overflow-hidden rounded border border-white/[0.07] bg-white/[0.02]">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <PackageCheck className="h-3.5 w-3.5 text-slate-700" />}</span></td> : null}
                        <td className="max-w-[270px] px-3 py-2.5"><p className="truncate font-semibold text-slate-200">{item.name}</p><p className="mt-0.5 truncate text-[8px] text-slate-700">SKU {item.sku}</p></td>
                        <td className="px-3 py-2.5 text-slate-500">{item.set || "—"}{item.collectorNumber ? <span className="text-slate-700"> · #{item.collectorNumber}</span> : null}</td>
                        <td className="px-3 py-2.5 text-slate-400">{item.condition || "—"}</td><td className="px-3 py-2.5 text-slate-400">{item.finish || "—"}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-200">{item.quantity.toLocaleString("en-US")}</td><td className="px-3 py-2.5 text-right text-slate-500">{currency(unitValue)}</td><td className="px-3 py-2.5 text-right font-semibold text-emerald-300">{currency(item.value)}</td>
                        <td className="px-4 py-2.5"><button type="button" onClick={(event) => { event.stopPropagation(); setFocusedItemId(item.id); }} className="rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-[8px] font-semibold text-slate-500 hover:border-cyan-300/20 hover:text-cyan-200">Details</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {focusedItem ? (
              <aside className="hidden w-[310px] shrink-0 overflow-y-auto border-l border-white/[0.06] bg-[#081721] p-5 xl:block">
                <div className="flex items-start justify-between gap-3"><p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-cyan-300">Inventory detail</p><button type="button" onClick={() => setFocusedItemId("")} className="text-slate-600 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button></div>
                <div className="mx-auto mt-5 flex h-[210px] w-[150px] items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">{focusedItem.imageUrl ? <img src={focusedItem.imageUrl} alt="" className="h-full w-full object-cover" /> : <PackageCheck className="h-8 w-8 text-slate-700" />}</div>
                <h3 className="mt-5 text-base font-semibold text-slate-100">{focusedItem.name}</h3>
                <p className="mt-1 text-[10px] text-slate-500">{[focusedItem.set, focusedItem.collectorNumber ? `#${focusedItem.collectorNumber}` : "", focusedItem.condition, focusedItem.finish].filter(Boolean).join(" · ")}</p>
                <div className="mt-5 grid grid-cols-2 gap-2"><CompactMetric label="Quantity" value={focusedItem.quantity.toLocaleString("en-US")} /><CompactMetric label="Total value" value={currency(focusedItem.value)} /></div>
                <p className="mt-5 text-[8px] font-semibold uppercase tracking-[0.13em] text-slate-600">Move this inventory</p>
                <label className="relative mt-2 block"><select value={focusedItem.locationId} onChange={(event) => onMove(focusedItem.id, event.target.value)} className="inventory-location-select h-10 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#07141e] pl-3 pr-8 text-[9px] text-slate-300">{locations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" /></label>
                <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/10 p-3"><p className="text-[8px] uppercase tracking-[0.12em] text-slate-700">Physical path</p><p className="mt-2 text-[10px] font-semibold text-slate-300">{location.zone || "Main Warehouse"} <span className="text-slate-700">→</span> {location.name}</p></div>
                <button type="button" onClick={() => onDeleteItem(focusedItem)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-300/[0.12] bg-red-400/[0.025] text-[9px] font-semibold text-red-200 transition hover:border-red-300/25 hover:bg-red-400/[0.07]">
                  <Trash2 className="h-3.5 w-3.5" /> Delete from Inventory
                </button>
              </aside>
            ) : null}
          </div>
        ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-5 py-14 text-center">
          <FolderOpen className="mx-auto h-7 w-7 text-slate-700" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            {items.length ? "No matching inventory" : "This location is empty"}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[10px] leading-5 text-slate-600">
            {items.length ? "Try a different card name, SKU, set, or condition." : "File cards or products here and they will appear in this contents view."}
          </p>
          {!items.length ? (
            <button type="button" onClick={onFile} className="mt-4 rounded-xl bg-cyan-400 px-4 py-2.5 text-[10px] font-bold text-[#001018]">
              File first item
            </button>
          ) : null}
        </div>
      )}

        {filteredItems.length ? (
          <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-white/[0.06] bg-[#081721] px-5 py-3 sm:px-6">
            <p className="text-[9px] text-slate-600">Showing {((safePage - 1) * pageSize + 1).toLocaleString("en-US")}–{Math.min(safePage * pageSize, filteredItems.length).toLocaleString("en-US")} of {filteredItems.length.toLocaleString("en-US")}</p>
            <label className="relative ml-auto"><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="inventory-location-select h-8 appearance-none rounded-lg border border-white/[0.07] bg-[#07141e] pl-2.5 pr-7 text-[8px] text-slate-400"><option value={50}>50 per page</option><option value={100}>100 per page</option></select><ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-700" /></label>
            <div className="flex items-center gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-slate-500 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button><span className="min-w-[72px] text-center text-[9px] font-semibold text-slate-400">Page {safePage} of {totalPages}</span><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-slate-500 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button></div>
          </footer>
        ) : null}
      </div>
      <style jsx global>{`
        select.inventory-location-select { color-scheme: dark; }
        select.inventory-location-select option { background: #0b1822; color: #e2e8f0; }
      `}</style>
    </div>
  );
}

function VirtualBinderModal({
  location,
  items,
  allItems,
  locations,
  onClose,
  onFile,
  onEdit,
  onMove,
  onUpdateItem,
  onUpdateLocation,
  putAwayCount,
  onOpenPutAway,
  onSendToPutAway,
  onUndoPutAway,
  onDeleteItem,
}: {
  location: LocationRecord;
  items: InventoryItem[];
  allItems: InventoryItem[];
  locations: LocationRecord[];
  onClose: () => void;
  onFile: () => void;
  onEdit: () => void;
  onMove: (
    itemId: string,
    locationId: string,
    placement?: Pick<InventoryItem, "binderPage" | "binderSlot">,
  ) => void;
  onUpdateItem: (itemId: string, updates: Partial<InventoryItem>) => void;
  onUpdateLocation: (updates: Partial<LocationRecord>) => void;
  putAwayCount: number;
  onOpenPutAway: () => void;
  onSendToPutAway: (itemId: string) => void;
  onUndoPutAway: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => void;
}) {
  const columns = location.binderColumns ?? 3;
  const rows = location.binderRows ?? 3;
  const pageCount = Math.max(1, location.binderPages ?? 20);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [jumpMessage, setJumpMessage] = useState("");
  const [binderView, setBinderView] = useState<"single" | "spread" | "index">("single");
  const [matchIndex, setMatchIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState<InventoryItem | null>(null);
  const [recentlyRemoved, setRecentlyRemoved] = useState<{ item: InventoryItem; page: number; slot: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ item: InventoryItem; x: number; y: number } | null>(null);
  const [detailItemId, setDetailItemId] = useState("");
  const [moveCandidate, setMoveCandidate] = useState<InventoryItem | null>(null);
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const slotsPerPage = columns * rows;
  const occupied = items.filter((item) => item.binderPage && item.binderSlot).length;
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  const matches = query.trim()
    ? items.filter((item) => `${item.name} ${item.set ?? ""} ${item.collectorNumber ?? ""} ${item.condition ?? ""} ${item.finish ?? ""} ${item.binderPage ?? ""} ${item.binderSlot ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : [];
  const selectedItem = items.find((item) => item.id === selectedItemId);
  const detailItem = items.find((item) => item.id === detailItemId) ?? null;
  const pageSlots = Array.from({ length: slotsPerPage }, (_, index) => slotLabel(index, columns));

  function jumpToItem(item: InventoryItem) {
    if (!item.binderPage || !item.binderSlot) {
      setJumpMessage("This card has not been assigned to a pocket yet.");
      return;
    }
    setPage(item.binderPage);
    setSelectedItemId(item.id);
    setJumpMessage(`Found on Page ${item.binderPage} · ${item.binderSlot}`);
    setBinderView("single");
  }

  function cycleMatch(direction: number) {
    if (!matches.length) return;
    const next = (matchIndex + direction + matches.length) % matches.length;
    setMatchIndex(next);
    jumpToItem(matches[next]);
  }

  function moveToPocket(itemId: string, targetPage: number, targetSlot: string) {
    const occupying = items.find((item) => item.id !== itemId && item.binderPage === targetPage && item.binderSlot === targetSlot);
    const moving = items.find((item) => item.id === itemId);
    if (!moving) return;
    if (occupying) {
      onUpdateItem(occupying.id, { binderPage: moving.binderPage, binderSlot: moving.binderSlot });
    }
    onUpdateItem(itemId, { binderPage: targetPage, binderSlot: targetSlot });
    setSelectedItemId(itemId);
  }

  function confirmRemoveFromBinder() {
    if (!removeCandidate?.binderPage || !removeCandidate.binderSlot) return;
    setRecentlyRemoved({
      item: removeCandidate,
      page: removeCandidate.binderPage,
      slot: removeCandidate.binderSlot,
    });
    onSendToPutAway(removeCandidate.id);
    setSelectedItemId("");
    setJumpMessage(`${removeCandidate.name} sent to Put-Away · inventory record retained`);
    setRemoveCandidate(null);
    setContextMenu(null);
  }

  function undoRemoveFromBinder() {
    if (!recentlyRemoved) return;
    onUndoPutAway({
      ...recentlyRemoved.item,
      locationId: PUT_AWAY_QUEUE_ID,
      binderPage: undefined,
      binderSlot: undefined,
      putAwayOrigin: {
        locationId: location.id,
        binderPage: recentlyRemoved.page,
        binderSlot: recentlyRemoved.slot,
      },
    });
    setJumpMessage(`${recentlyRemoved.item.name} restored to Page ${recentlyRemoved.page} · ${recentlyRemoved.slot}`);
    setRecentlyRemoved(null);
  }

  function openCardDetails(item: InventoryItem) {
    setSelectedItemId(item.id);
    setDetailItemId(item.id);
    setContextMenu(null);
  }

  function completeLocationMove(destinationId: string, targetPage?: number, targetSlot?: string) {
    if (!moveCandidate) return;
    const destination = locations.find((candidate) => candidate.id === destinationId);
    if (!destination) return;
    onMove(
      moveCandidate.id,
      destinationId,
      destination.type === "binder"
        ? { binderPage: targetPage, binderSlot: targetSlot }
        : { binderPage: undefined, binderSlot: undefined },
    );
    setJumpMessage(`${moveCandidate.name} moved to ${destination.name}${targetPage && targetSlot ? ` · Page ${targetPage} · ${targetSlot}` : ""}`);
    setSelectedItemId("");
    setDetailItemId("");
    setMoveCandidate(null);
    setContextMenu(null);
  }

  const spreadLeft = binderView === "spread" ? (page % 2 === 0 ? Math.max(1, page - 1) : page) : page;
  const spreadRight = Math.min(pageCount, spreadLeft + 1);
  const currentPageItems = items.filter((item) =>
    binderView === "spread"
      ? item.binderPage === spreadLeft || item.binderPage === spreadRight
      : item.binderPage === page,
  );
  const inspectorItem = selectedItem ?? currentPageItems[0] ?? null;
  const usedPercent = Math.min(100, pageCount * slotsPerPage ? (occupied / (pageCount * slotsPerPage)) * 100 : 0);

  return (
    <div className="fixed inset-0 z-[120] bg-[#01070c]/94 p-1.5 backdrop-blur-xl sm:p-3" role="dialog" aria-modal="true" aria-label={`${location.name} virtual binder`}>
      <div className="relative mx-auto flex h-full w-full max-w-[1820px] flex-col overflow-hidden rounded-[28px] border border-violet-300/[0.14] bg-[#04101a] shadow-[0_42px_160px_rgba(0,0,0,.84)]">
        <header className="relative shrink-0 overflow-hidden border-b border-white/[0.065] bg-[radial-gradient(circle_at_78%_0%,rgba(139,92,246,.15),transparent_36%),linear-gradient(100deg,#071b28,#06131d_48%,#120b20)] px-3 py-3 sm:px-5">
          <div className="pointer-events-none absolute inset-x-20 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/45 to-transparent" />
          <div className="relative flex items-center gap-3">
            <button type="button" onClick={onClose} className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/[0.09] bg-black/15 px-3 text-[10px] font-semibold text-slate-300 transition hover:border-cyan-300/25 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Inventory</span>
            </button>

            <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-300/[0.18] bg-violet-400/[0.07] text-violet-200 sm:flex"><BookOpen className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[8px] font-bold uppercase tracking-[0.19em] text-cyan-300">Binder Studio</p>
                <span className="hidden items-center gap-1 text-[8px] font-semibold text-emerald-300/80 md:flex"><Check className="h-3 w-3" /> Autosaved</span>
              </div>
              <h2 className="mt-0.5 truncate text-lg font-semibold tracking-[-0.025em] text-white">{location.name}</h2>
              <p className="text-[8px] text-slate-600">{columns} × {rows} pockets · {pageCount} pages · {occupied} cards placed</p>
            </div>

            <div className="ml-auto hidden items-center gap-2 xl:flex">
              <BinderStat label="Value" value={currency(totalValue)} accent />
              <BinderStat label="Cards" value={items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("en-US")} />
              <BinderStat label="Used" value={`${occupied}/${pageCount * slotsPerPage}`} />
            </div>

            <div className="ml-auto flex items-center gap-2 xl:ml-2">
              <Link href={`/dashboard/collector-portfolio/binder/${location.id}`} className="hidden h-10 items-center gap-2 rounded-xl border border-violet-300/[0.22] bg-violet-400/[0.07] px-3 text-[9px] font-semibold text-violet-100 transition hover:border-violet-300/40 hover:bg-violet-400/[0.12] md:flex"><Sparkles className="h-3.5 w-3.5" /> Portfolio View</Link>
              <button type="button" onClick={() => setShowcaseOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-3 text-[9px] font-bold text-[#031319] shadow-[0_10px_26px_rgba(34,211,238,.13)]"><Share2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Share</span></button>
              <button type="button" onClick={() => setSettingsOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-black/15 text-slate-400 transition hover:text-white"><Settings2 className="h-4 w-4" /></button>
            </div>
          </div>
        </header>

        <div className="shrink-0 border-b border-white/[0.055] bg-[#06131d]/94 px-3 py-2.5 sm:px-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.075] bg-black/20 px-3">
              <Search className="h-4 w-4 text-slate-600" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setMatchIndex(0); }} onKeyDown={(event) => { if (event.key === "Enter" && matches.length) jumpToItem(matches[matchIndex] ?? matches[0]); }} placeholder="Search this binder by card, set, pocket, condition…" className="min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-slate-700" />
              {query ? <button type="button" onClick={() => { setQuery(""); setJumpMessage(""); }} className="text-slate-600 hover:text-white"><X className="h-3.5 w-3.5" /></button> : null}
            </label>

            <div className="flex items-center gap-2 overflow-x-auto">
              <div className="flex rounded-xl border border-white/[0.075] bg-black/20 p-1">
                {([
                  ["single", "Page", Grid3X3],
                  ["spread", "Spread", BookOpen],
                  ["index", "Index", List],
                ] as const).map(([value, label, Icon]) => (
                  <button key={value} type="button" onClick={() => setBinderView(value)} className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[8px] font-semibold transition ${binderView === value ? "bg-violet-300 text-[#18092b]" : "text-slate-600 hover:text-white"}`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={onOpenPutAway} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-amber-300/[0.14] bg-amber-300/[0.035] px-3 text-[9px] font-semibold text-amber-100"><PackageOpen className="h-3.5 w-3.5" /> Put Away <span className="rounded-md bg-amber-300 px-1.5 py-0.5 text-[7px] font-black text-[#211505]">{putAwayCount}</span></button>
              <button type="button" onClick={onFile} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-cyan-300/[0.14] bg-cyan-300/[0.035] px-3 text-[9px] font-semibold text-cyan-100"><Plus className="h-3.5 w-3.5" /> Add Card</button>
            </div>
          </div>

          {query && matches.length ? (
            <div className="mt-2 flex items-center gap-2 overflow-x-auto rounded-xl border border-cyan-300/[0.08] bg-cyan-300/[0.025] px-2 py-1.5">
              <span className="shrink-0 text-[8px] font-semibold text-cyan-200">{matches.length} result{matches.length === 1 ? "" : "s"}</span>
              <button type="button" onClick={() => cycleMatch(-1)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] text-slate-500"><ChevronLeft className="h-3 w-3" /></button>
              <button type="button" onClick={() => cycleMatch(1)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] text-slate-500"><ChevronRight className="h-3 w-3" /></button>
              {matches.slice(0, 8).map((item) => <button key={item.id} type="button" onClick={() => jumpToItem(item)} className="shrink-0 rounded-lg border border-white/[0.07] bg-black/15 px-2.5 py-1.5 text-[8px] font-semibold text-slate-400 hover:border-cyan-300/20 hover:text-cyan-100">{item.name}</button>)}
            </div>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[180px_minmax(0,1fr)] 2xl:grid-cols-[200px_minmax(0,1fr)_310px]">
          <aside className="hidden min-h-0 border-r border-white/[0.055] bg-[#05111a]/92 p-3 lg:flex lg:flex-col">
            <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-slate-600">Binder capacity</p>
              <div className="mt-3 flex items-end justify-between"><span className="text-xl font-semibold text-white">{Math.round(usedPercent)}%</span><span className="text-[8px] text-slate-700">{occupied}/{pageCount * slotsPerPage}</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-gradient-to-r from-violet-300 to-cyan-300" style={{ width: `${usedPercent}%` }} /></div>
            </div>

            <div className="mt-4 flex items-center justify-between px-1"><p className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-600">Pages</p><span className="text-[8px] text-slate-700">{pageCount}</span></div>
            <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {Array.from({ length: pageCount }, (_, index) => {
                const pageNumber = index + 1;
                const count = items.filter((item) => item.binderPage === pageNumber).length;
                const active = binderView === "spread" ? pageNumber === spreadLeft || pageNumber === spreadRight : pageNumber === page;
                return <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${active ? "border-violet-300/25 bg-violet-400/[0.08]" : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.025]"}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[8px] font-bold ${active ? "bg-violet-300 text-[#18092b]" : "bg-white/[0.04] text-slate-600"}`}>{pageNumber}</span><span className="min-w-0 flex-1"><span className={`block text-[9px] font-semibold ${active ? "text-violet-100" : "text-slate-500"}`}>Page {pageNumber}</span><span className="mt-0.5 block text-[7px] text-slate-700">{count}/{slotsPerPage} pockets</span></span></button>;
              })}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(34,211,238,.035),transparent_30%)] p-3 sm:p-4 lg:p-5">
            <div className="mx-auto max-w-[1320px]">
              <div className="mb-3 flex items-center justify-between">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - (binderView === "spread" ? 2 : 1)))} disabled={page <= 1} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-black/15 px-3 text-[8px] font-semibold text-slate-400 disabled:opacity-25"><ChevronLeft className="h-3.5 w-3.5" /> Previous</button>
                <div className="text-center"><p className="text-[8px] font-bold uppercase tracking-[0.17em] text-cyan-300">{binderView === "index" ? "Binder index" : binderView === "spread" ? "Physical binder spread" : "Physical binder page"}</p><p className="mt-1 text-[9px] text-slate-600">{binderView === "spread" ? `Pages ${spreadLeft}–${spreadRight}` : `Page ${page}`} of {pageCount}</p></div>
                <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + (binderView === "spread" ? 2 : 1)))} disabled={page >= pageCount} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-black/15 px-3 text-[8px] font-semibold text-slate-400 disabled:opacity-25">Next <ChevronRight className="h-3.5 w-3.5" /></button>
              </div>

              {binderView === "index" ? (
                <div className="overflow-hidden rounded-[24px] border border-white/[0.075] bg-[#06131d]/88">
                  <div className="grid grid-cols-[70px_minmax(0,1fr)_90px_100px] border-b border-white/[0.06] bg-white/[0.025] px-4 py-3 text-[8px] font-bold uppercase tracking-[0.13em] text-slate-600"><span>Pocket</span><span>Card</span><span>Qty</span><span>Value</span></div>
                  <div className="divide-y divide-white/[0.05]">
                    {[...items].sort((a,b) => (a.binderPage ?? 999) - (b.binderPage ?? 999) || (a.binderSlot ?? "").localeCompare(b.binderSlot ?? "")).map((item) => <button key={item.id} type="button" onClick={() => jumpToItem(item)} className={`grid w-full grid-cols-[70px_minmax(0,1fr)_90px_100px] items-center px-4 py-3 text-left transition hover:bg-cyan-300/[0.025] ${item.id === selectedItemId ? "bg-cyan-300/[0.045]" : ""}`}><span className="text-[9px] font-semibold text-cyan-200">{item.binderPage ? `P${item.binderPage} · ${item.binderSlot}` : "—"}</span><span className="flex min-w-0 items-center gap-3">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-10 w-7 rounded object-cover" /> : null}<span className="min-w-0"><span className="block truncate text-[10px] font-semibold text-white">{item.name}</span><span className="mt-1 block truncate text-[8px] text-slate-600">{[item.set,item.condition,item.finish].filter(Boolean).join(" · ")}</span></span></span><span className="text-[9px] text-slate-400">{item.quantity}</span><span className="text-[9px] font-semibold text-emerald-300">{currency(item.value)}</span></button>)}
                  </div>
                </div>
              ) : binderView === "spread" ? (
                <div className="relative grid gap-3 xl:grid-cols-2">
                  <div className="pointer-events-none absolute bottom-7 left-1/2 top-7 z-30 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-black/70 to-transparent xl:block" />
                  <BinderPageSurface page={spreadLeft} columns={columns} slots={pageSlots} items={items} selectedItemId={selectedItemId} onSelect={setSelectedItemId} onMove={moveToPocket} onRemove={setRemoveCandidate} onContextMenu={(item,x,y) => setContextMenu({ item,x,y })} />
                  <BinderPageSurface page={spreadRight} columns={columns} slots={pageSlots} items={items} selectedItemId={selectedItemId} onSelect={setSelectedItemId} onMove={moveToPocket} onRemove={setRemoveCandidate} onContextMenu={(item,x,y) => setContextMenu({ item,x,y })} rightPage />
                </div>
              ) : (
                <div className="mx-auto max-w-[850px]">
                  <BinderPageSurface page={page} columns={columns} slots={pageSlots} items={items} selectedItemId={selectedItemId} onSelect={setSelectedItemId} onMove={moveToPocket} onRemove={setRemoveCandidate} onContextMenu={(item,x,y) => setContextMenu({ item,x,y })} />
                </div>
              )}
            </div>
          </section>

          <aside className="hidden min-h-0 border-l border-white/[0.055] bg-[#05111a]/94 p-4 2xl:block">
            {inspectorItem ? (
              <div className="sticky top-0">
                <div className="flex items-center justify-between"><p className="text-[8px] font-bold uppercase tracking-[0.17em] text-cyan-300">Live inspector</p><button type="button" onClick={() => openCardDetails(inspectorItem)} className="text-[8px] font-semibold text-violet-300 hover:text-violet-200">Full details</button></div>
                {inspectorItem.imageUrl ? <img src={inspectorItem.imageUrl} alt={inspectorItem.name} className="mt-3 aspect-[.716] w-full rounded-[18px] object-contain shadow-[0_24px_64px_rgba(0,0,0,.48)]" /> : <div className="mt-3 flex aspect-[.716] items-center justify-center rounded-[18px] border border-white/[0.07] bg-black/20"><LibraryBig className="h-10 w-10 text-slate-700" /></div>}
                <h3 className="mt-4 text-lg font-semibold text-white">{inspectorItem.name}</h3>
                <p className="mt-1 text-[9px] text-slate-600">{[inspectorItem.set,inspectorItem.condition,inspectorItem.finish].filter(Boolean).join(" · ")}</p>
                <div className="mt-4 grid grid-cols-2 gap-2"><CompactMetric label="Quantity" value={String(inspectorItem.quantity)} /><CompactMetric label="Value" value={currency(inspectorItem.value)} /><CompactMetric label="Page" value={String(inspectorItem.binderPage ?? "—")} /><CompactMetric label="Pocket" value={inspectorItem.binderSlot ?? "—"} /></div>
                <div className="mt-4 space-y-2">
                  <button type="button" onClick={() => openCardDetails(inspectorItem)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/[0.14] bg-cyan-300/[0.035] text-[9px] font-semibold text-cyan-100"><Eye className="h-3.5 w-3.5" /> Inspect card</button>
                  <button type="button" onClick={() => setMoveCandidate(inspectorItem)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-300/[0.14] bg-violet-300/[0.035] text-[9px] font-semibold text-violet-100"><Move className="h-3.5 w-3.5" /> Move card</button>
                  <button type="button" onClick={() => setRemoveCandidate(inspectorItem)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-300/[0.13] bg-rose-300/[0.025] text-[9px] font-semibold text-rose-200"><Trash2 className="h-3.5 w-3.5" /> Send to Put-Away</button>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center"><Sparkles className="h-7 w-7 text-slate-700" /><p className="mt-4 text-sm font-semibold text-slate-400">Select a card</p><p className="mt-2 text-[9px] leading-5 text-slate-700">The permanent inspector keeps card details visible without covering your binder.</p></div>
            )}
          </aside>
        </div>

        <footer className="flex shrink-0 items-center gap-3 border-t border-white/[0.055] bg-[#06131d]/96 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {jumpMessage ? <span className="shrink-0 rounded-lg border border-cyan-300/[0.10] bg-cyan-300/[0.025] px-2.5 py-1.5 text-[8px] font-semibold text-cyan-100">{jumpMessage}</span> : <span className="text-[8px] text-slate-700">Drag cards between pockets. Right-click or use the inspector for actions.</span>}
            {recentlyRemoved ? <button type="button" onClick={undoRemoveFromBinder} className="shrink-0 rounded-lg border border-emerald-300/[0.12] bg-emerald-300/[0.035] px-2.5 py-1.5 text-[8px] font-semibold text-emerald-200">Undo Put-Away</button> : null}
          </div>
          <span className="hidden text-[8px] text-slate-700 md:block">Page {binderView === "spread" ? `${spreadLeft}–${spreadRight}` : page} · {currency(totalValue)}</span>
        </footer>

        {contextMenu ? (
          <div className="fixed z-[150] w-52 overflow-hidden rounded-xl border border-white/[0.10] bg-[#081721] p-1.5 shadow-[0_22px_70px_rgba(0,0,0,.65)]" style={{ left: Math.min(contextMenu.x, window.innerWidth - 220), top: Math.min(contextMenu.y, window.innerHeight - 230) }}>
            <button type="button" onClick={() => openCardDetails(contextMenu.item)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[9px] font-semibold text-slate-300 hover:bg-white/[0.05]"><Eye className="h-3.5 w-3.5" /> Inspect card</button>
            <button type="button" onClick={() => { setMoveCandidate(contextMenu.item); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[9px] font-semibold text-slate-300 hover:bg-white/[0.05]"><Move className="h-3.5 w-3.5" /> Move card</button>
            <button type="button" onClick={() => { setRemoveCandidate(contextMenu.item); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[9px] font-semibold text-rose-200 hover:bg-rose-300/[0.05]"><Trash2 className="h-3.5 w-3.5" /> Send to Put-Away</button>
          </div>
        ) : null}

        {detailItem ? <BinderCardDetail item={detailItem} location={location} onClose={() => setDetailItemId("")} onMove={() => { setMoveCandidate(detailItem); setDetailItemId(""); }} onRemove={() => { setRemoveCandidate(detailItem); setDetailItemId(""); }} onDelete={() => { onDeleteItem(detailItem); setDetailItemId(""); }} onUpdate={(updates) => onUpdateItem(detailItem.id, updates)} /> : null}
        {moveCandidate ? <MoveCardPanel item={moveCandidate} currentLocation={location} locations={locations} allItems={allItems} onClose={() => setMoveCandidate(null)} onMove={completeLocationMove} /> : null}

        {removeCandidate ? (
          <div className="absolute inset-0 z-[145] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setRemoveCandidate(null)}>
            <div className="w-full max-w-[440px] rounded-[24px] border border-rose-300/[0.16] bg-[#081721] p-5 shadow-[0_28px_90px_rgba(0,0,0,.72)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-300/[0.14] bg-rose-300/[0.04] text-rose-200"><Trash2 className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-semibold text-white">Send this card to Put-Away?</h3>
              <p className="mt-2 text-[10px] leading-5 text-slate-500">{removeCandidate.name} will leave this binder pocket, but the inventory record will be retained.</p>
              <div className="mt-5 flex gap-2"><button type="button" onClick={() => setRemoveCandidate(null)} className="h-11 flex-1 rounded-xl border border-white/[0.08] text-[10px] font-semibold text-slate-400">Cancel</button><button type="button" onClick={confirmRemoveFromBinder} className="h-11 flex-[1.35] rounded-xl bg-rose-300 text-[10px] font-bold text-[#250710]">Send to Put-Away</button></div>
            </div>
          </div>
        ) : null}

        {showcaseOpen ? <BinderShowcaseStudio location={location} items={items} page={page} binderView={binderView} totalValue={totalValue} occupied={occupied} onClose={() => setShowcaseOpen(false)} /> : null}
        {settingsOpen ? <BinderSettingsPanel location={location} items={items} onClose={() => setSettingsOpen(false)} onAdvancedEdit={() => { setSettingsOpen(false); onEdit(); }} onSave={(updates) => { onUpdateLocation(updates); setSettingsOpen(false); setPage((current) => Math.min(current, updates.binderPages ?? current)); }} /> : null}
      </div>
    </div>
  );
}

function BinderShowcaseStudio({
  location,
  items,
  page,
  binderView,
  totalValue,
  occupied,
  onClose,
}: {
  location: LocationRecord;
  items: InventoryItem[];
  page: number;
  binderView: "single" | "spread" | "index";
  totalValue: number;
  occupied: number;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"showcase" | "trade">("showcase");
  const [status, setStatus] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [cardCount, setCardCount] = useState<6 | 9 | 12>(() => items.filter((item) => item.binderPage && item.binderSlot).length >= 9 ? 9 : 6);
  const [exportTitle, setExportTitle] = useState(location.name);
  const [exportStyle, setExportStyle] = useState<"editorial" | "gallery">("editorial");
  const [exportTheme, setExportTheme] = useState<"harbor" | "midnight" | "carbon">("harbor");

  const cards = [...items]
    .filter((item) => item.binderPage && item.binderSlot)
    .sort((a, b) => (a.binderPage ?? 999) - (b.binderPage ?? 999) || (a.binderSlot ?? "").localeCompare(b.binderSlot ?? ""));
  const previewCards = cards.slice(0, cardCount);
  const totalCards = items.reduce((sum, item) => sum + item.quantity, 0);
  const caption = mode === "trade"
    ? `Trading ${location.name} on Trading Docks — ${totalCards} cards · ${currency(totalValue)} estimated value. Message me with offers.`
    : `${location.name} — ${totalCards} cards · ${currency(totalValue)} estimated value. Built and organized with Trading Docks.`;

  function openShareStudio() {
    const params = new URLSearchParams({ tab: "showcase", studio: "share", binder: location.id, page: String(page) });
    window.location.assign(`/dashboard/collector-portfolio?${params.toString()}`);
  }

  async function copyPost() {
    await navigator.clipboard.writeText(caption);
    setStatus(mode === "trade" ? "Trade post copied for Discord." : "Showcase caption copied.");
  }

  async function downloadSocialCard() {
    setDownloading(true);
    setStatus("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image export is unavailable.");

      const themes = {
        harbor: { top: "#071c29", bottom: "#07101b", accent: "#67e8f9", soft: "rgba(103,232,249,.16)", secondary: "#a5f3fc" },
        midnight: { top: "#101427", bottom: "#090a15", accent: "#a78bfa", soft: "rgba(167,139,250,.16)", secondary: "#ddd6fe" },
        carbon: { top: "#15191e", bottom: "#090b0e", accent: "#f1f5f9", soft: "rgba(241,245,249,.10)", secondary: "#cbd5e1" },
      } as const;
      const palette = themes[exportTheme];
      const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
      gradient.addColorStop(0, palette.top);
      gradient.addColorStop(1, palette.bottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1350);

      const glow = ctx.createRadialGradient(820, 130, 20, 820, 130, 520);
      glow.addColorStop(0, palette.soft);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 1080, 700);

      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(38, 38, 1004, 1274, 34);
      ctx.stroke();

      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.roundRect(70, 65, 44, 44, 13);
      ctx.fill();
      ctx.fillStyle = "#05202a";
      ctx.font = "800 24px Arial";
      ctx.fillText("T", 84, 96);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "700 25px Arial";
      ctx.fillText("Trading Docks", 130, 96);
      ctx.textAlign = "right";
      ctx.fillStyle = "#64748b";
      ctx.font = "700 13px Arial";
      ctx.fillText(mode === "trade" ? "TRADE EDITION" : "COLLECTOR EDITION", 1010, 92);
      ctx.textAlign = "left";
      ctx.fillStyle = "#f8fafc";
      ctx.font = "700 47px Arial";
      ctx.fillText((exportTitle.trim() || location.name).slice(0, 34), 70, 168);
      ctx.fillStyle = palette.secondary;
      ctx.font = "700 14px Arial";
      ctx.fillText(mode === "trade" ? "AVAILABLE FOR TRADE  /  OPEN TO OFFERS" : "A CURATED TRADING DOCKS COLLECTION", 70, 202);
      ctx.fillStyle = "rgba(255,255,255,.09)";
      ctx.fillRect(70, 230, 940, 1);
      ctx.font = "700 15px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`${totalCards.toLocaleString("en-US")} CARDS`, 70, 267);
      ctx.fillStyle = palette.accent;
      ctx.fillText(`${currency(totalValue)} EST. VALUE`, 235, 267);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`${occupied.toLocaleString("en-US")} POCKETS`, 490, 267);
      ctx.textAlign = "right";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${Math.min(cardCount, cards.length)} FEATURED`, 1010, 267);
      ctx.textAlign = "left";

      async function loadImage(url: string) {
        return await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = "anonymous";
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Image failed"));
          image.src = url;
        });
      }

      const columns = cardCount === 12 ? 4 : 3;
      const rows = Math.ceil(cardCount / columns);
      const cardWidth = cardCount === 6 ? 270 : cardCount === 9 ? 204 : 198;
      const cardHeight = Math.round(cardWidth * 1.395);
      const labelHeight = exportStyle === "editorial" ? (cardCount === 6 ? 54 : 44) : 0;
      const plateHeight = cardHeight + labelHeight;
      const gapX = cardCount === 12 ? 24 : cardCount === 9 ? 72 : 50;
      const gapY = cardCount === 6 ? 42 : 22;
      const gridWidth = columns * cardWidth + (columns - 1) * gapX;
      const gridHeight = rows * plateHeight + (rows - 1) * gapY;
      const gridX = (1080 - gridWidth) / 2;
      const gridY = 298 + Math.max(0, (880 - gridHeight) / 2);
      for (let index = 0; index < cardCount; index += 1) {
        const card = previewCards[index];
        const x = gridX + (index % columns) * (cardWidth + gapX);
        const y = gridY + Math.floor(index / columns) * (cardHeight + gapY);
        ctx.shadowColor = "rgba(0,0,0,.62)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 14;
        ctx.fillStyle = "rgba(2,8,15,.94)";
        ctx.beginPath();
        ctx.roundRect(x, y, cardWidth, plateHeight, 16);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = index === 0 ? palette.accent : "rgba(255,255,255,.12)";
        ctx.lineWidth = index === 0 ? 2.5 : 1.5;
        ctx.stroke();

        if (card?.imageUrl) {
          try {
            const image = await loadImage(card.imageUrl);
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x + 7, y + 7, cardWidth - 14, cardHeight - 14, 13);
            ctx.clip();
            ctx.drawImage(image, x + 7, y + 7, cardWidth - 14, cardHeight - 14);
            ctx.restore();
          } catch {
            ctx.fillStyle = "rgba(34,211,238,.08)";
            ctx.fillRect(x + 10, y + 10, cardWidth - 20, cardHeight - 20);
          }
        }

        if (card && labelHeight > 0) {
          ctx.fillStyle = "rgba(3,9,15,.98)";
          ctx.fillRect(x + 2, y + cardHeight - 1, cardWidth - 4, labelHeight - 1);
          ctx.fillStyle = "#f8fafc";
          ctx.font = `700 ${cardCount === 6 ? 14 : 11}px Arial`;
          ctx.fillText(card.name.slice(0, cardCount === 6 ? 26 : 20), x + 12, y + cardHeight + (cardCount === 6 ? 21 : 17));
          ctx.fillStyle = "#64748b";
          ctx.font = `700 ${cardCount === 6 ? 10 : 8}px Arial`;
          const meta = [card.set?.toUpperCase(), card.condition, card.finish].filter(Boolean).join("  ·  ");
          ctx.fillText(meta.slice(0, 34), x + 12, y + cardHeight + (cardCount === 6 ? 40 : 33));
          ctx.textAlign = "right";
          ctx.fillStyle = palette.accent;
          ctx.fillText(String(index + 1).padStart(2, "0"), x + cardWidth - 12, y + cardHeight + (cardCount === 6 ? 40 : 33));
          ctx.textAlign = "left";
        }

      }

      ctx.fillStyle = "rgba(255,255,255,.06)";
      ctx.fillRect(70, 1243, 940, 1);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 18px Arial";
      ctx.fillText("Organize · Showcase · Trade", 70, 1283);
      ctx.textAlign = "right";
      ctx.fillStyle = palette.accent;
      ctx.fillText("TRADINGDOCKS.COM", 1010, 1283);
      ctx.textAlign = "left";

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Export failed")), "image/png");
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${location.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "binder"}-${mode}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`1080 × 1350 social image with ${Math.min(cardCount, cards.length)} cards downloaded.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not export the social image.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="absolute inset-0 z-[96] flex items-center justify-center bg-[#01070c]/82 p-4 backdrop-blur-xl" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="grid max-h-[94dvh] w-full max-w-[1180px] overflow-hidden rounded-[30px] border border-violet-300/[0.18] bg-[#07131d] shadow-[0_38px_140px_rgba(0,0,0,.78)] lg:grid-cols-[1.08fr_.92fr]">
        <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/[0.18] bg-violet-400/[0.07] px-3 py-2 text-[9px] font-semibold text-violet-100"><Sparkles className="h-3.5 w-3.5 text-violet-300" /> Binder Showcase Studio</span>
              <h3 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-white">Turn your binder into content.</h3>
              <p className="mt-2 max-w-xl text-[11px] leading-6 text-slate-500">Create a public trade page, export an Instagram-ready graphic, or copy a polished Discord post.</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] text-slate-500 transition hover:text-white"><X className="h-4 w-4" /></button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-black/15 p-1.5">
            <button type="button" onClick={() => setMode("showcase")} className={`rounded-xl px-4 py-3 text-[10px] font-semibold transition ${mode === "showcase" ? "bg-cyan-300 text-[#031319]" : "text-slate-500 hover:text-slate-200"}`}>Collection showcase</button>
            <button type="button" onClick={() => setMode("trade")} className={`rounded-xl px-4 py-3 text-[10px] font-semibold transition ${mode === "trade" ? "bg-violet-300 text-[#15072a]" : "text-slate-500 hover:text-slate-200"}`}>Trade binder</button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-[10px] font-semibold text-slate-200">Cards in graphic</p><p className="mt-1 text-[9px] text-slate-600">Choose the density that best fits your post.</p></div>
              <span className="rounded-lg border border-cyan-300/[0.12] bg-cyan-300/[0.04] px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.13em] text-cyan-200">Instagram 4:5</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([6, 9, 12] as const).map((count) => <button key={count} type="button" onClick={() => setCardCount(count)} disabled={cards.length < count} className={`rounded-xl border px-3 py-2.5 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${cardCount === count ? "border-cyan-300/35 bg-cyan-300/[0.10] text-cyan-100" : "border-white/[0.07] text-slate-500 hover:border-white/[0.14] hover:text-slate-200"}`}>{count} cards</button>)}
            </div>
            {cards.length < 9 ? <p className="mt-3 text-[8px] leading-4 text-slate-600">Add more cards to this binder to unlock the 9- and 12-card layouts.</p> : null}
            <div className="mt-4 border-t border-white/[0.07] pt-4">
              <label className="text-[9px] font-semibold text-slate-400">Export title</label>
              <input value={exportTitle} onChange={(event) => setExportTitle(event.target.value)} maxLength={34} className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-[10px] text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/30" placeholder="Name this collection" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["editorial", "gallery"] as const).map((style) => <button key={style} type="button" onClick={() => setExportStyle(style)} className={`rounded-xl border px-3 py-2.5 text-[9px] font-semibold capitalize transition ${exportStyle === style ? "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-100" : "border-white/[0.07] text-slate-600"}`}>{style}</button>)}
              </div>
              <div className="mt-3 flex gap-2">
                {(["harbor", "midnight", "carbon"] as const).map((theme) => <button key={theme} type="button" aria-label={`${theme} color theme`} onClick={() => setExportTheme(theme)} className={`h-8 flex-1 rounded-lg border transition ${exportTheme === theme ? "border-white/50 ring-2 ring-cyan-300/20" : "border-white/[0.08]"}`} style={{ background: theme === "harbor" ? "linear-gradient(135deg,#0c3546,#07101b)" : theme === "midnight" ? "linear-gradient(135deg,#28204b,#090a15)" : "linear-gradient(135deg,#343a40,#090b0e)" }} />)}
              </div>
            </div>
          </div>

          <button type="button" onClick={openShareStudio} className="mt-6 flex w-full items-center justify-between rounded-2xl border border-violet-300/[0.22] bg-[linear-gradient(135deg,rgba(139,92,246,.13),rgba(34,211,238,.06))] p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-300/40">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-300 text-[#18092b]"><Share2 className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold text-white">Share this binder</p><p className="mt-1 text-[9px] text-slate-500">Use the same Share Studio for a page, spread, entire binder, or portfolio.</p></div></div><ChevronRight className="h-4 w-4 text-violet-200" />
          </button>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ShowcaseAction icon={Download} title="Export Instagram graphic" description={`Professional 1080 × 1350 poster · ${cardCount}-card layout.`} onClick={downloadSocialCard} loading={downloading} />
            <ShowcaseAction icon={MessageCircle} title="Copy Discord post" description="Caption, collection stats, and trade language." onClick={copyPost} />
          </div>

          {status ? <div className="mt-4 rounded-xl border border-cyan-300/[0.12] bg-cyan-300/[0.035] px-4 py-3 text-[9px] font-semibold text-cyan-100">{status}</div> : null}
        </div>

        <div className="relative min-h-[560px] overflow-hidden border-t border-white/[0.07] bg-[radial-gradient(circle_at_top,rgba(139,92,246,.18),transparent_38%),linear-gradient(160deg,#0b1b2a,#08111e_55%,#150b24)] p-5 lg:border-l lg:border-t-0 sm:p-7">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/[0.12] blur-3xl" />
          <div className="relative">
            <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">Live social preview</p>
            <h4 className="mt-2 text-2xl font-semibold text-white">{exportTitle.trim() || location.name}</h4>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-violet-200">{mode === "trade" ? "Trade binder" : "Collection showcase"}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <ShowcaseMetric label="Cards" value={totalCards.toLocaleString("en-US")} />
              <ShowcaseMetric label="Value" value={currency(totalValue)} accent />
              <ShowcaseMetric label="Pockets" value={occupied.toLocaleString("en-US")} />
            </div>
            <div className={`mt-5 grid gap-2 ${cardCount === 12 ? "grid-cols-4" : "grid-cols-3"}`}>
              {Array.from({ length: cardCount }, (_, index) => {
                const card = previewCards[index];
                return <div key={card?.id ?? index} className={`group relative aspect-[.716] overflow-hidden border bg-black/25 shadow-[0_14px_32px_rgba(0,0,0,.32)] ${index === 0 ? "rounded-xl border-cyan-300/45 shadow-[0_14px_34px_rgba(34,211,238,.10)]" : "rounded-lg border-white/[0.09]"}`}>{card?.imageUrl ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-slate-700"><Plus className="h-5 w-5" /></div>}{card ? <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/75 px-1.5 py-1 text-[6px] font-bold text-cyan-200">P{card.binderPage} · {card.binderSlot}</span> : null}</div>;
              })}
            </div>
            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 p-4 backdrop-blur"><p className="text-[10px] leading-5 text-slate-300">{caption}</p><div className="mt-4 flex items-center justify-between"><span className="inline-flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600"><MessageCircle className="h-3.5 w-3.5" /> Social-ready</span><span className="text-[8px] text-slate-700">Page {page} · {binderView}</span></div></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ShowcaseAction({ icon: Icon, title, description, onClick, loading = false }: { icon: typeof Share2; title: string; description: string; onClick: () => void | Promise<void>; loading?: boolean }) {
  return <button type="button" onClick={() => void onClick()} disabled={loading} className="group rounded-2xl border border-white/[0.075] bg-black/[0.12] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/[0.22] hover:bg-cyan-300/[0.035] disabled:opacity-60"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-300/[0.045] text-cyan-200">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}</span><p className="mt-3 text-[11px] font-semibold text-slate-100">{title}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{description}</p></button>;
}

function ShowcaseMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3"><p className="text-[7px] font-bold uppercase tracking-[0.14em] text-slate-600">{label}</p><p className={`mt-1 text-[12px] font-semibold ${accent ? "text-emerald-300" : "text-slate-100"}`}>{value}</p></div>;
}


function BinderSettingsPanel({
  location,
  items,
  onClose,
  onAdvancedEdit,
  onSave,
}: {
  location: LocationRecord;
  items: InventoryItem[];
  onClose: () => void;
  onAdvancedEdit: () => void;
  onSave: (updates: Partial<LocationRecord>) => void;
}) {
  const [columns, setColumns] = useState(location.binderColumns ?? 3);
  const [rows, setRows] = useState(location.binderRows ?? 3);
  const [pages, setPages] = useState(location.binderPages ?? 20);
  const [doubleSided, setDoubleSided] = useState(location.binderDoubleSided ?? true);
  const presets = [
    { label: "Standard", detail: "3 × 3", columns: 3, rows: 3 },
    { label: "Wide", detail: "4 × 3", columns: 4, rows: 3 },
    { label: "Square", detail: "4 × 4", columns: 4, rows: 4 },
    { label: "Display", detail: "5 × 4", columns: 5, rows: 4 },
  ];
  const validSlots = new Set(Array.from({ length: columns * rows }, (_, index) => slotLabel(index, columns)));
  const incompatible = items.filter(
    (item) =>
      Boolean(item.binderPage && item.binderSlot) &&
      ((item.binderPage ?? 0) > pages || !validSlots.has(item.binderSlot ?? "")),
  );
  const capacity = columns * rows * pages;
  const used = items.filter((item) => item.binderPage && item.binderSlot).length;

  return (
    <div className="absolute inset-0 z-50 flex justify-end bg-[#01070c]/72 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="flex h-full w-full max-w-[460px] flex-col border-l border-cyan-300/[0.12] bg-[#081721] shadow-[-28px_0_90px_rgba(0,0,0,0.48)]" role="dialog" aria-modal="true" aria-label="Binder settings">
        <div className="flex items-start gap-3 border-b border-white/[0.07] px-6 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/[0.15] bg-cyan-300/[0.05] text-cyan-300"><Settings2 className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Binder configuration</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-100">Page & pocket settings</h3>
            <p className="mt-1 text-[9px] leading-4 text-slate-600">Match the digital binder to the physical one on your shelf.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close binder settings" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] text-slate-500 hover:text-slate-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-600">Pocket layout</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {presets.map((preset) => {
              const active = columns === preset.columns && rows === preset.rows;
              return (
                <button key={preset.detail} type="button" onClick={() => { setColumns(preset.columns); setRows(preset.rows); }} className={`rounded-2xl border p-3 text-left transition ${active ? "border-cyan-300/35 bg-cyan-400/[0.09] shadow-[0_0_0_2px_rgba(34,211,238,0.05)]" : "border-white/[0.07] bg-white/[0.018] hover:border-cyan-300/20"}`}>
                  <span className={`text-[9px] font-semibold ${active ? "text-cyan-200" : "text-slate-400"}`}>{preset.label}</span>
                  <span className="mt-1 block text-lg font-semibold text-slate-100">{preset.detail}</span>
                  <span className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${preset.columns}, minmax(0, 1fr))` }}>
                    {Array.from({ length: Math.min(preset.columns * preset.rows, 16) }, (_, index) => <i key={index} className={`h-2 rounded-[2px] ${active ? "bg-cyan-300/35" : "bg-white/[0.07]"}`} />)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <BinderNumberField label="Columns" value={columns} min={1} max={8} onChange={setColumns} />
            <BinderNumberField label="Rows" value={rows} min={1} max={8} onChange={setRows} />
            <BinderNumberField label="Pages" value={pages} min={1} max={500} onChange={setPages} />
          </div>

          <label className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-3">
            <span><span className="block text-[10px] font-semibold text-slate-300">Double-sided pages</span><span className="mt-1 block text-[8px] text-slate-600">Track both faces of each physical sheet.</span></span>
            <input type="checkbox" checked={doubleSided} onChange={(event) => setDoubleSided(event.target.checked)} className="h-4 w-4 accent-cyan-400" />
          </label>

          <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-300/[0.1] bg-[linear-gradient(135deg,rgba(34,211,238,0.055),rgba(34,211,238,0.055))]">
            <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
              <BinderSettingMetric label="Total pockets" value={capacity.toLocaleString("en-US")} />
              <BinderSettingMetric label="Used" value={used.toLocaleString("en-US")} />
              <BinderSettingMetric label="Available" value={Math.max(0, capacity - used).toLocaleString("en-US")} />
            </div>
            <div className="h-1 bg-white/[0.045]"><div className="h-full bg-gradient-to-r from-cyan-300 to-cyan-300" style={{ width: `${Math.min(100, capacity ? (used / capacity) * 100 : 0)}%` }} /></div>
          </div>

          {incompatible.length ? (
            <div className="mt-4 rounded-2xl border border-amber-300/[0.18] bg-amber-300/[0.045] p-4">
              <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><div><p className="text-[10px] font-semibold text-amber-200">This size would displace {incompatible.length} card{incompatible.length === 1 ? "" : "s"}</p><p className="mt-1 text-[8px] leading-4 text-slate-500">Move those cards into pockets that exist in the new layout before downsizing. Nothing will be silently unassigned.</p></div></div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/[0.07] bg-[#07131d] px-6 py-4">
          <button type="button" onClick={onAdvancedEdit} className="mb-3 text-[9px] font-semibold text-slate-500 transition hover:text-cyan-200">Advanced binder details</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-white/[0.08] text-[10px] font-semibold text-slate-400">Cancel</button>
            <button type="button" disabled={Boolean(incompatible.length)} onClick={() => onSave({ binderColumns: columns, binderRows: rows, binderPages: pages, binderDoubleSided: doubleSided, capacity, capacityUnit: "slots" })} className="h-11 flex-[1.35] rounded-xl bg-gradient-to-r from-cyan-300 via-sky-300 to-cyan-300 text-[10px] font-bold text-[#031018] shadow-[0_10px_28px_rgba(34,211,238,0.12)] disabled:cursor-not-allowed disabled:opacity-35">Save binder size</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function BinderNumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span className="text-[8px] font-semibold uppercase tracking-[0.13em] text-slate-600">{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))} className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-[#050e15] px-3 text-sm font-semibold text-slate-200 outline-none focus:border-cyan-300/30" />
    </label>
  );
}

function BinderSettingMetric({ label, value }: { label: string; value: string }) {
  return <div className="px-3 py-4 text-center"><p className="text-[7px] font-semibold uppercase tracking-[0.13em] text-slate-600">{label}</p><p className="mt-1.5 text-sm font-semibold text-slate-100">{value}</p></div>;
}

function BinderPageSurface({ page, columns, slots, items, selectedItemId, onSelect, onMove, onRemove, onContextMenu, rightPage = false }: { page: number; columns: number; slots: string[]; items: InventoryItem[]; selectedItemId: string; onSelect: (id: string) => void; onMove: (itemId: string, page: number, slot: string) => void; onRemove: (item: InventoryItem) => void; onContextMenu: (item: InventoryItem, x: number, y: number) => void; rightPage?: boolean }) {
  return (
    <section className="group/page relative overflow-hidden rounded-[28px] border border-violet-300/[0.16] bg-[radial-gradient(circle_at_12%_0%,rgba(139,92,246,.15),transparent_34%),radial-gradient(circle_at_88%_0%,rgba(34,211,238,.11),transparent_34%),linear-gradient(145deg,#171126,#0b151f_52%,#111325)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.06),inset_0_0_100px_rgba(0,0,0,.30),0_30px_90px_rgba(0,0,0,.38)] transition duration-300 hover:border-violet-300/[0.26] sm:p-5">
      <div className={`pointer-events-none absolute inset-y-6 ${rightPage ? "left-0" : "right-0"} w-4 bg-gradient-to-${rightPage ? "r" : "l"} from-black/30 to-transparent`} />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/50 to-transparent" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-400/[0.08] blur-3xl" />
      <div className="mb-3 flex items-center justify-between px-1">
        <div><p className="text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300/70">{rightPage ? "Right page" : "Physical page"}</p><p className="mt-1 text-sm font-semibold text-slate-200">Page {page}</p></div>
        <span className="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-1.5 text-[8px] font-semibold text-slate-600">{slots.length} pockets</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {slots.map((slot) => {
          const item = items.find((candidate) => candidate.binderPage === page && candidate.binderSlot === slot);
          return <BinderPocket key={slot} slot={slot} item={item} highlighted={item?.id === selectedItemId} onSelect={() => item && onSelect(item.id)} onDropItem={(itemId) => onMove(itemId, page, slot)} onRemove={() => item && onRemove(item)} onContextMenu={(x, y) => item && onContextMenu(item, x, y)} />;
        })}
      </div>
      <p className="mt-4 text-center text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-700">{page}</p>
    </section>
  );
}

function BinderPocket({ slot, item, highlighted, onSelect, onDropItem, onRemove, onContextMenu }: { slot: string; item?: InventoryItem; highlighted: boolean; onSelect: () => void; onDropItem: (itemId: string) => void; onRemove: () => void; onContextMenu: (x: number, y: number) => void }) {
  return (
    <div data-binder-pocket={item ? "occupied" : "empty"} role="button" tabIndex={0} onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(); }} onContextMenu={(event) => { if (!item) return; event.preventDefault(); event.stopPropagation(); onContextMenu(event.clientX, event.clientY); }} draggable={Boolean(item)} onDragStart={(event) => item && event.dataTransfer.setData("text/plain", item.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); if (id) onDropItem(id); }} className={`group relative flex aspect-[0.70] min-h-[200px] cursor-pointer flex-col overflow-hidden rounded-[16px] border bg-black/25 p-2 pb-11 text-left transition duration-300 ${highlighted ? "border-cyan-200 shadow-[0_0_0_3px_rgba(34,211,238,.13),0_0_38px_rgba(34,211,238,.22)]" : "border-white/[0.09] hover:-translate-y-1 hover:scale-[1.01] hover:border-violet-300/40 hover:shadow-[0_22px_44px_rgba(0,0,0,.40),0_0_30px_rgba(139,92,246,.10)]"}`}>
      <span className="pointer-events-none absolute inset-1.5 rounded-[12px] border border-white/[0.06] bg-gradient-to-br from-white/[0.065] via-transparent to-black/10" /><span className="pointer-events-none absolute -left-1/2 top-0 z-30 h-full w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.09] to-transparent opacity-0 blur-sm transition duration-700 group-hover:left-[120%] group-hover:opacity-100" />
      <span className="pointer-events-none absolute inset-x-3 top-2 z-20 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {item ? <>{item.imageUrl ? <img src={item.imageUrl} alt={item.name} draggable={false} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContextMenu(event.clientX, event.clientY); }} className="relative z-10 h-full w-full select-none rounded-[10px] object-contain shadow-[0_12px_28px_rgba(0,0,0,.48)] transition duration-300 group-hover:scale-[1.025] group-hover:brightness-110" /> : <span className="relative z-10 flex flex-1 items-center justify-center"><LibraryBig className="h-8 w-8 text-cyan-300/30" /></span>}<span className="absolute left-3 top-3 z-30 flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-1 text-[7px] font-semibold text-slate-300 opacity-0 backdrop-blur transition group-hover:opacity-100">{item.condition || "—"} · {item.finish || "—"}</span><div className="absolute inset-x-2 bottom-2 z-40 flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] bg-[#070d14]/96 px-1.5 shadow-[0_-8px_22px_rgba(0,0,0,0.38)] backdrop-blur"><span className="rounded-md bg-cyan-300 px-1.5 py-1 text-[8px] font-black text-[#031319]">{slot}</span><span className="min-w-0 flex-1 truncate text-[9px] font-semibold text-slate-100">{item.name}</span><button type="button" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); onContextMenu(rect.right, rect.bottom + 6); }} aria-label={`Open actions for ${item.name}`} title="Card actions" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.1] text-slate-300 transition hover:border-cyan-300/35 hover:bg-cyan-400/15 hover:text-cyan-100"><EllipsisVertical className="h-3.5 w-3.5" /></button></div></> : <span className="relative z-10 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-cyan-300/15 bg-cyan-400/[0.025] text-slate-500 transition group-hover:border-cyan-300/30 group-hover:bg-cyan-400/[0.035] group-hover:text-cyan-200"><span className="absolute left-3 top-3 rounded-md border border-white/[0.07] px-1.5 py-1 text-[8px] font-bold text-slate-500">{slot}</span><span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-current"><Plus className="h-5 w-5" /></span><span className="mt-3 text-[9px] font-semibold">Add card</span></span>}
      {item ? <Move className="absolute bottom-12 right-3 z-30 h-3.5 w-3.5 text-white opacity-0 drop-shadow transition group-hover:opacity-70" /> : null}
    </div>
  );
}

function BinderCardDetail({
  item,
  location,
  onClose,
  onMove,
  onRemove,
  onDelete,
  onUpdate,
}: {
  item: InventoryItem;
  location: LocationRecord;
  onClose: () => void;
  onMove: () => void;
  onRemove: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<InventoryItem>) => void;
}) {
  const edhrecSlug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const listings = item.marketplaceListings ?? [];
  const activeListedQuantity = listings
    .filter((listing) => listing.status === "Active")
    .reduce((sum, listing) => sum + listing.quantity, 0);
  const availableQuantity = Math.max(0, item.quantity - activeListedQuantity);

  function updateListing(
    platform: MarketplacePlatform,
    updates: Partial<MarketplaceListing>,
  ) {
    const existing = listings.find((listing) => listing.platform === platform);
    const next: MarketplaceListing = {
      platform,
      status: "Draft",
      quantity: 0,
      updatedAt: "Just now",
      ...existing,
      ...updates,
    };
    onUpdate({
      marketplaceListings: [
        ...listings.filter((listing) => listing.platform !== platform),
        next,
      ],
    });
  }

  function removeListing(platform: MarketplacePlatform) {
    onUpdate({
      marketplaceListings: listings.filter(
        (listing) => listing.platform !== platform,
      ),
    });
  }

  return (
    <div className="absolute inset-0 z-[84] bg-black/45 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-cyan-300/15 bg-[#081721] shadow-[-24px_0_80px_rgba(0,0,0,0.55)]">
        <header className="flex items-start justify-between border-b border-white/[0.06] p-5"><div><p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Card details</p><h3 className="mt-1 text-lg font-semibold text-slate-100">{item.name}</h3><p className="mt-1 text-[9px] text-slate-500">{[item.set, item.collectorNumber ? `#${item.collectorNumber}` : "", item.condition, item.finish].filter(Boolean).join(" · ")}</p></div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mx-auto flex aspect-[0.716] w-full max-w-[270px] items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25 shadow-2xl">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" /> : <LibraryBig className="h-12 w-12 text-cyan-300/30" />}</div>
          <div className="mt-5 grid grid-cols-2 gap-2"><CompactMetric label="Market value" value={currency(item.value)} /><CompactMetric label="Pocket" value={item.binderPage && item.binderSlot ? `P${item.binderPage} · ${item.binderSlot}` : "Unassigned"} /></div>
          <Link href={`/dashboard/sell-optimizer?card=${encodeURIComponent(item.name)}`} className="mt-3 flex items-center justify-between rounded-xl border border-cyan-300/15 bg-cyan-400/[0.045] px-4 py-3 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.08]"><span><span className="block text-[10px] font-semibold text-cyan-200">Compare buylist offers</span><span className="mt-1 block text-[9px] text-slate-500">Check verified cash offers for this exact printing</span></span><ArrowRightLeft className="h-4 w-4 text-cyan-300" /></Link>
          <div className="mt-4 rounded-xl border border-cyan-300/10 bg-cyan-400/[0.025] p-3">
            <div className="flex items-end justify-between gap-4">
              <label className="min-w-0 flex-1">
                <span className="text-[8px] font-semibold uppercase tracking-[0.13em] text-cyan-300">Owned quantity</span>
                <input
                  aria-label="Owned inventory quantity"
                  type="number"
                  min={Math.max(0, activeListedQuantity)}
                  value={item.quantity}
                  onChange={(event) => {
                    const quantity = Math.max(activeListedQuantity, Number.parseInt(event.target.value, 10) || 0);
                    const unitValue = item.unitMarketValue ?? (item.quantity > 0 ? item.value / item.quantity : item.value);
                    onUpdate({ quantity, value: unitValue * quantity });
                  }}
                  className="mt-2 h-10 w-full rounded-lg border border-white/[0.09] bg-[#050e15] px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/35"
                />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { const quantity = Math.max(activeListedQuantity, item.quantity - 1); const unitValue = item.unitMarketValue ?? (item.quantity > 0 ? item.value / item.quantity : item.value); onUpdate({ quantity, value: unitValue * quantity }); }} className="h-10 w-10 rounded-lg border border-white/[0.09] text-lg text-slate-300 hover:border-cyan-300/25 hover:text-cyan-200">−</button>
                <button type="button" onClick={() => { const quantity = item.quantity + 1; const unitValue = item.unitMarketValue ?? (item.quantity > 0 ? item.value / item.quantity : item.value); onUpdate({ quantity, value: unitValue * quantity }); }} className="h-10 w-10 rounded-lg border border-white/[0.09] text-lg text-slate-300 hover:border-cyan-300/25 hover:text-cyan-200">+</button>
              </div>
            </div>
            <p className="mt-2 text-[9px] text-slate-600">Quantity cannot be reduced below the number assigned to active listings.</p>
          </div>
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/10 p-3"><p className="text-[8px] font-semibold uppercase tracking-[0.13em] text-slate-600">Inventory path</p><p className="mt-2 text-[11px] font-semibold text-slate-300">{location.name} <span className="text-slate-600">→</span> {item.binderPage && item.binderSlot ? `Page ${item.binderPage} → ${item.binderSlot}` : "Unassigned"}</p></div>
          <section className="mt-4 rounded-2xl border border-white/[0.07] bg-black/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-300">Marketplace listings</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">Assign quantities by sales channel.</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-100">{availableQuantity}</p>
                <p className="text-[9px] text-slate-600">available of {item.quantity}</p>
              </div>
            </div>

            {listings.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {listings.map((listing) => (
                  <MarketplaceBadge key={listing.platform} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-white/[0.08] px-3 py-3 text-[10px] text-slate-600">
                Not listed on any marketplace.
              </div>
            )}

            <div className="mt-4 space-y-2">
              {MARKETPLACE_PLATFORMS.map((platform) => {
                const listing = listings.find(
                  (candidate) => candidate.platform === platform,
                );
                const otherActiveQuantity = listings
                  .filter(
                    (candidate) =>
                      candidate.platform !== platform &&
                      candidate.status === "Active",
                  )
                  .reduce((sum, candidate) => sum + candidate.quantity, 0);
                const maximumQuantity = Math.max(
                  listing?.quantity ?? 0,
                  item.quantity - otherActiveQuantity,
                );

                return (
                  <MarketplaceListingRow
                    key={platform}
                    platform={platform}
                    listing={listing}
                    maximumQuantity={maximumQuantity}
                    onUpdate={(updates) => updateListing(platform, updates)}
                    onRemove={() => removeListing(platform)}
                  />
                );
              })}
            </div>
            {activeListedQuantity > item.quantity ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-300/20 bg-red-400/[0.06] px-3 py-2.5 text-[10px] leading-4 text-red-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Active listings exceed physical quantity by {activeListedQuantity - item.quantity}. Reduce a channel quantity before publishing.
              </div>
            ) : null}
          </section>
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={onMove} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-300 text-sm font-semibold tracking-[-0.01em] text-[#031018]"><ArrowRightLeft className="h-4 w-4" /> Move card or change location</button>
            <a href={`https://edhrec.com/cards/${edhrecSlug}`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] text-sm font-semibold tracking-[-0.01em] text-slate-300 hover:border-cyan-300/25 hover:text-cyan-200"><ExternalLink className="h-4 w-4" /> View on EDHREC</a>
            <button type="button" onClick={onRemove} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-300/15 text-sm font-semibold tracking-[-0.01em] text-amber-200 hover:bg-amber-400/[0.07]"><PackageOpen className="h-4 w-4" /> Send to Put-Away Queue</button>
            <button type="button" onClick={onDelete} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-red-300/[0.12] bg-red-400/[0.025] text-sm font-semibold tracking-[-0.01em] text-red-200 transition hover:border-red-300/25 hover:bg-red-400/[0.07]"><Trash2 className="h-4 w-4" /> Delete from Inventory</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

const MARKETPLACE_PLATFORMS: MarketplacePlatform[] = [
  "TCGplayer",
  "eBay",
  "Mana Pool",
  "Trading Docks",
  "In-Store",
];

function MarketplaceBadge({ listing }: { listing: MarketplaceListing }) {
  const tone =
    listing.status === "Active"
      ? "border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-200"
      : listing.status === "Error"
        ? "border-red-300/20 bg-red-400/[0.08] text-red-200"
        : listing.status === "Draft" || listing.status === "Paused"
          ? "border-amber-300/20 bg-amber-400/[0.08] text-amber-200"
          : "border-sky-300/20 bg-sky-400/[0.08] text-sky-200";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold ${tone}`}>
      <span>{listing.platform}</span>
      <span className="opacity-65">·</span>
      <span>{listing.quantity}</span>
      <span className="opacity-65">· {listing.status}</span>
    </span>
  );
}

function MarketplaceListingRow({
  platform,
  listing,
  maximumQuantity,
  onUpdate,
  onRemove,
}: {
  platform: MarketplacePlatform;
  listing?: MarketplaceListing;
  maximumQuantity: number;
  onUpdate: (updates: Partial<MarketplaceListing>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_74px_92px] items-center gap-2 rounded-xl border border-white/[0.06] bg-[#07131d]/70 p-2">
      <label className="flex min-w-0 items-center gap-2.5">
        <input
          type="checkbox"
          checked={Boolean(listing)}
          onChange={(event) =>
            event.target.checked
              ? onUpdate({ status: "Draft", quantity: Math.min(1, maximumQuantity) })
              : onRemove()
          }
          className="h-4 w-4 shrink-0 accent-cyan-400"
        />
        <span className="truncate text-[11px] font-semibold text-slate-200">{platform}</span>
      </label>
      <input
        aria-label={`${platform} listed quantity`}
        title="Listed quantity"
        type="number"
        min={0}
        max={maximumQuantity}
        disabled={!listing}
        value={listing?.quantity ?? 0}
        onChange={(event) =>
          onUpdate({
            quantity: Math.min(
              maximumQuantity,
              Math.max(0, Number(event.target.value) || 0),
            ),
          })
        }
        className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#050e15] px-2 text-center text-[11px] font-semibold text-slate-200 outline-none disabled:opacity-30"
      />
      <select
        aria-label={`${platform} listing status`}
        disabled={!listing}
        value={listing?.status ?? "Draft"}
        onChange={(event) =>
          onUpdate({ status: event.target.value as MarketplaceListingStatus })
        }
        className="inventory-location-select h-9 w-full rounded-lg border border-white/[0.08] bg-[#050e15] px-2 text-[10px] font-semibold text-slate-200 outline-none disabled:opacity-30"
      >
        {(["Draft", "Active", "Paused", "Sold", "Ended", "Error"] as MarketplaceListingStatus[]).map(
          (status) => <option key={status}>{status}</option>,
        )}
      </select>
    </div>
  );
}

function MoveCardPanel({ item, currentLocation, locations, allItems, onClose, onMove }: { item: InventoryItem; currentLocation: LocationRecord; locations: LocationRecord[]; allItems: InventoryItem[]; onClose: () => void; onMove: (destinationId: string, page?: number, slot?: string) => void }) {
  const [destinationId, setDestinationId] = useState(currentLocation.id);
  const destination = locations.find((candidate) => candidate.id === destinationId) ?? currentLocation;
  const destinationColumns = destination.binderColumns ?? 3;
  const destinationRows = destination.binderRows ?? 3;
  const destinationPages = Math.max(1, destination.binderPages ?? 20);
  const [targetPage, setTargetPage] = useState(1);
  const [targetSlot, setTargetSlot] = useState("");
  const destinationSlots = Array.from({ length: destinationColumns * destinationRows }, (_, index) => slotLabel(index, destinationColumns));
  const occupiedSlots = new Set(allItems.filter((candidate) => candidate.id !== item.id && candidate.locationId === destination.id && candidate.binderPage === targetPage && candidate.binderSlot).map((candidate) => candidate.binderSlot));
  const canMove = destination.type !== "binder" || Boolean(targetSlot && !occupiedSlots.has(targetSlot));
  return (
    <div className="absolute inset-0 z-[92] flex items-center justify-center bg-[#01070c]/75 p-4 backdrop-blur-md" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="max-h-[calc(100dvh-32px)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-[24px] border border-cyan-300/15 bg-[#091822] p-6 shadow-[0_30px_110px_rgba(0,0,0,0.7)]">
        <div className="flex items-start justify-between"><div><p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Move inventory</p><h3 className="mt-1 text-lg font-semibold text-slate-100">{item.name}</h3><p className="mt-1 text-[9px] text-slate-500">Choose another binder, a precise pocket, or any inventory location.</p></div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></div>
        <label className="mt-5 block"><span className="text-[8px] font-semibold uppercase tracking-[0.13em] text-slate-600">Destination</span><span className="relative mt-2 block"><select value={destinationId} onChange={(event) => { setDestinationId(event.target.value); setTargetPage(1); setTargetSlot(""); }} className="inventory-location-select h-11 w-full appearance-none rounded-xl border border-white/[0.09] bg-[#050e15] px-3 pr-9 text-[10px] font-semibold text-slate-200 outline-none focus:border-cyan-300/30">{locations.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {TYPE_CONFIG[candidate.type].label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" /></span></label>
        {destination.type === "binder" ? <div className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-400/[0.025] p-4"><div className="flex items-end gap-3"><label className="flex-1"><span className="text-[8px] font-semibold uppercase tracking-[0.13em] text-slate-600">Page</span><input type="number" min={1} max={destinationPages} value={targetPage} onChange={(event) => { setTargetPage(Math.min(destinationPages, Math.max(1, Number(event.target.value) || 1))); setTargetSlot(""); }} className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-[#050e15] px-3 text-[10px] text-slate-200 outline-none" /></label><p className="pb-3 text-[9px] text-slate-600">of {destinationPages}</p></div><p className="mt-4 text-[8px] font-semibold uppercase tracking-[0.13em] text-slate-600">Available pocket</p><div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(destinationColumns, 5)}, minmax(0, 1fr))` }}>{destinationSlots.map((slot) => { const unavailable = occupiedSlots.has(slot); return <button key={slot} type="button" disabled={unavailable} onClick={() => setTargetSlot(slot)} className={`h-10 rounded-xl border text-[9px] font-bold transition ${targetSlot === slot ? "border-cyan-200 bg-cyan-300 text-[#031319]" : unavailable ? "cursor-not-allowed border-white/[0.04] bg-black/10 text-slate-700 line-through" : "border-white/[0.08] text-slate-400 hover:border-cyan-300/25 hover:text-cyan-200"}`}>{slot}</button>; })}</div><p className="mt-3 text-[8px] text-slate-600">Occupied pockets are unavailable. Choose an open pocket to complete the move.</p></div> : <div className="mt-4 rounded-xl border border-cyan-300/10 bg-cyan-400/[0.025] p-4 text-[9px] leading-5 text-slate-500">This card will leave its binder pocket and move to <span className="font-semibold text-cyan-200">{destination.name}</span>. Its inventory history and value remain intact.</div>}
        <div className="mt-6 flex gap-2"><button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-white/[0.08] text-[10px] font-semibold text-slate-400">Cancel</button><button type="button" disabled={!canMove} onClick={() => onMove(destination.id, destination.type === "binder" ? targetPage : undefined, destination.type === "binder" ? targetSlot : undefined)} className="h-11 flex-[1.35] rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-300 text-[10px] font-bold text-[#031018] disabled:cursor-not-allowed disabled:opacity-35">Move card</button></div>
      </div>
    </div>
  );
}

function PutAwayDrawer({
  items,
  locations,
  allItems,
  onClose,
  onMove,
  onUndo,
  onDelete,
}: {
  items: InventoryItem[];
  locations: LocationRecord[];
  allItems: InventoryItem[];
  onClose: () => void;
  onMove: (
    itemId: string,
    locationId: string,
    placement?: Pick<InventoryItem, "binderPage" | "binderSlot">,
  ) => void;
  onUndo: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState<"all" | "binder" | "intake" | "recent">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDestination, setBulkDestination] = useState("");
  const [filingItem, setFilingItem] = useState<InventoryItem | null>(null);
  const filtered = items.filter((item) => {
    const origin = locations.find((location) => location.id === item.putAwayOrigin?.locationId);
    const matchesQuery = `${item.name} ${item.set ?? ""} ${item.condition ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesFilter =
      queueFilter === "all" ||
      (queueFilter === "binder" && origin?.type === "binder") ||
      (queueFilter === "intake" && !origin) ||
      (queueFilter === "recent" && item.updatedAt.toLowerCase().includes("just now"));
    return matchesQuery && matchesFilter;
  });
  const selectedValue = items
    .filter((item) => selectedIds.includes(item.id))
    .reduce((sum, item) => sum + item.value, 0);
  const originFor = (item: InventoryItem) =>
    locations.find((location) => location.id === item.putAwayOrigin?.locationId);

  function fileSelected() {
    if (!bulkDestination || !selectedIds.length) return;
    selectedIds.forEach((itemId) => onMove(itemId, bulkDestination));
    setSelectedIds([]);
    setBulkDestination("");
  }

  return (
    <div className="fixed inset-0 z-[170] bg-black/55 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-amber-300/[0.15] bg-[#07151e] shadow-[-28px_0_100px_rgba(0,0,0,0.65)]">
        <header className="border-b border-white/[0.065] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/15 bg-amber-300/[0.07] text-amber-300"><PackageOpen className="h-5 w-5" /></span>
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-amber-300">Inventory workflow</p><h2 className="mt-1 text-xl font-semibold text-slate-100">Put-Away Queue</h2><p className="mt-1 text-[10px] leading-4 text-slate-400">Cards waiting for their next physical location.</p></div>
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <CompactMetric label="Waiting to file" value={items.length.toLocaleString("en-US")} />
            <CompactMetric label="Queued value" value={currency(items.reduce((sum, item) => sum + item.value, 0))} />
          </div>
          <label className="mt-4 flex h-11 items-center gap-2 rounded-xl border border-white/[0.09] bg-[#040d13] px-3 focus-within:border-amber-300/30"><Search className="h-3.5 w-3.5 text-amber-300/80" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search queued cards…" className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-200 outline-none placeholder:text-slate-500" /></label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {([
              ["all", "All"],
              ["binder", "From binders"],
              ["intake", "From intake"],
              ["recent", "Recently added"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setQueueFilter(value)}
                className={`rounded-lg border px-3 py-2 text-[9px] font-semibold transition ${queueFilter === value ? "border-amber-300/30 bg-amber-300/[0.09] text-amber-100" : "border-white/[0.07] text-slate-500 hover:border-white/[0.12] hover:text-slate-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {items[0]?.putAwayOrigin ? (
            <button type="button" onClick={() => onUndo(items[0])} className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-semibold text-slate-400 transition hover:text-amber-200"><RotateCcw className="h-3 w-3" /> Undo last move</button>
          ) : null}
        </header>

        {selectedIds.length ? (
          <div className="border-b border-amber-300/10 bg-amber-300/[0.025] p-4">
            <div className="flex items-center justify-between"><p className="text-[9px] font-semibold text-amber-100">{selectedIds.length} selected · {currency(selectedValue)}</p><button type="button" onClick={() => setSelectedIds([])} className="text-[8px] font-semibold text-slate-500 hover:text-slate-300">Clear</button></div>
            <div className="mt-3 flex gap-2">
              <label className="relative min-w-0 flex-1"><select value={bulkDestination} onChange={(event) => setBulkDestination(event.target.value)} className="inventory-location-select h-10 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#050e15] px-3 pr-8 text-[9px] text-slate-300"><option value="">Choose destination…</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" /></label>
              <button type="button" disabled={!bulkDestination} onClick={fileSelected} className="h-10 rounded-xl bg-amber-300 px-4 text-[9px] font-bold text-[#211505] disabled:opacity-35">File selected</button>
            </div>
            <p className="mt-2 text-[8px] text-slate-600">Binder destinations use the first available pockets and safely stop if capacity is reached.</p>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {filtered.length ? <div className="space-y-2.5">
            {filtered.map((item) => {
              const selected = selectedIds.includes(item.id);
              const origin = originFor(item);
              return (
                <div key={item.id} className={`grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border p-3 transition sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] ${selected ? "border-amber-300/30 bg-amber-300/[0.055]" : "border-white/[0.075] bg-black/10 hover:border-amber-300/18"}`}>
                  <button type="button" onClick={() => setSelectedIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} aria-label={`${selected ? "Deselect" : "Select"} ${item.name}`} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${selected ? "border-amber-300 bg-amber-300 text-[#211505]" : "border-white/[0.09] text-slate-600"}`}>{selected ? <Check className="h-3.5 w-3.5" /> : <CheckSquare2 className="h-3.5 w-3.5" />}</button>
                  <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.07] bg-black/20">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <LibraryBig className="h-4 w-4 text-cyan-300/30" />}</div>
                  <div className="min-w-0"><p className="truncate text-[11px] font-semibold text-slate-100">{item.name}</p><p className="mt-1 truncate text-[9px] text-slate-500">{origin ? `From ${origin.name}${item.putAwayOrigin?.binderPage ? ` · P${item.putAwayOrigin.binderPage} · ${item.putAwayOrigin.binderSlot}` : ""}` : "Awaiting placement"}</p><p className="mt-1 text-[10px] font-semibold text-emerald-300">{currency(item.value)}</p></div>
                  <div className="col-span-3 flex items-center justify-end gap-2 sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      aria-label={`Delete ${item.name} from inventory`}
                      title="Delete from inventory"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-300/15 text-red-300/80 transition hover:border-red-300/35 hover:bg-red-400/[0.08] hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setFilingItem(item)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.055] px-3.5 text-[9px] font-semibold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.09]"><ArrowRightLeft className="h-3 w-3" /> Choose location</button>
                  </div>
                </div>
              );
            })}
          </div> : <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center"><span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.035] text-emerald-300"><PackageCheck className="h-7 w-7" /></span><h3 className="mt-5 text-sm font-semibold text-slate-200">{items.length ? "No matching cards" : "Everything is put away"}</h3><p className="mt-2 max-w-xs text-[10px] leading-5 text-slate-600">{items.length ? "Try another card name, set, or condition." : "Cards removed from binders will wait here safely until you file them somewhere else."}</p></div>}
        </div>
      </aside>
      {filingItem && locations.length ? (
        <MoveCardPanel
          item={filingItem}
          currentLocation={originFor(filingItem) ?? locations[0]}
          locations={locations}
          allItems={allItems}
          onClose={() => setFilingItem(null)}
          onMove={(destinationId, page, slot) => {
            onMove(
              filingItem.id,
              destinationId,
              page && slot ? { binderPage: page, binderSlot: slot } : undefined,
            );
            setFilingItem(null);
          }}
        />
      ) : null}
    </div>
  );
}

function BinderStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="min-w-[92px] rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2"><p className="text-[7px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</p><p className={`mt-1 text-xs font-semibold ${accent ? "text-emerald-300" : "text-slate-200"}`}>{value}</p></div>;
}

function slotLabel(index: number, columns: number) {
  return `${String.fromCharCode(65 + Math.floor(index / columns))}${(index % columns) + 1}`;
}

function resolveBinderPlacement(
  location: LocationRecord,
  allItems: InventoryItem[],
  movingItemId: string,
  requestedPage?: number,
  requestedSlot?: string,
): Pick<InventoryItem, "binderPage" | "binderSlot"> | null {
  const columns = location.binderColumns ?? 3;
  const rows = location.binderRows ?? 3;
  const pages = Math.max(1, location.binderPages ?? 20);
  const validSlots = Array.from(
    { length: columns * rows },
    (_, index) => slotLabel(index, columns),
  );
  const occupied = new Set(
    allItems
      .filter(
        (candidate) =>
          candidate.id !== movingItemId &&
          candidate.locationId === location.id &&
          candidate.binderPage &&
          candidate.binderSlot,
      )
      .map((candidate) => `${candidate.binderPage}-${candidate.binderSlot}`),
  );

  if (
    requestedPage &&
    requestedSlot &&
    requestedPage >= 1 &&
    requestedPage <= pages &&
    validSlots.includes(requestedSlot) &&
    !occupied.has(`${requestedPage}-${requestedSlot}`)
  ) {
    return { binderPage: requestedPage, binderSlot: requestedSlot };
  }

  for (let page = 1; page <= pages; page += 1) {
    for (const slot of validSlots) {
      if (!occupied.has(`${page}-${slot}`)) {
        return { binderPage: page, binderSlot: slot };
      }
    }
  }

  return null;
}

function repairUnassignedBinderItems(
  allItems: InventoryItem[],
  locations: LocationRecord[],
) {
  let repairedItems = allItems;
  let changed = false;

  for (const item of allItems) {
    const destination = locations.find(
      (location) => location.id === item.locationId,
    );
    if (
      destination?.type !== "binder" ||
      (item.binderPage && item.binderSlot)
    ) {
      continue;
    }

    const placement = resolveBinderPlacement(
      destination,
      repairedItems,
      item.id,
    );
    if (!placement) continue;

    repairedItems = repairedItems.map((candidate) =>
      candidate.id === item.id
        ? { ...candidate, ...placement, updatedAt: "Recovered just now" }
        : candidate,
    );
    changed = true;
  }

  return changed ? repairedItems : allItems;
}

function assignFirstBinderPocket(item: InventoryItem, location: LocationRecord, allItems: InventoryItem[]) {
  const placement = resolveBinderPlacement(location, allItems, item.id);
  return placement ? { ...item, ...placement } : item;
}

function ExplorerSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="relative">
      <span className="pointer-events-none absolute left-3 top-1.5 z-10 text-[7px] font-semibold uppercase tracking-[0.12em] text-slate-700">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="inventory-location-select h-10 w-full appearance-none rounded-xl border border-white/[0.07] bg-[#07141e] pb-1 pl-3 pr-8 pt-4 text-[9px] text-slate-300 outline-none">
        <option value="all">All {label.toLowerCase()}s</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
    </label>
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
  if (!groups.length) {
    return (
      <section className={`${styles.glassPanel} flex items-center gap-3 rounded-2xl border border-emerald-300/10 px-4 py-3`}>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/[0.07] text-emerald-300">
          <Check className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-semibold text-emerald-100">No duplicate locations detected</p>
          <p className="mt-0.5 text-[8px] text-slate-600">Every matching inventory record is currently filed in one physical location.</p>
        </div>
      </section>
    );
  }
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

      </div>
    </section>
  );
}

function MovementHistory({ movements, business }: { movements: Movement[]; business: boolean }) {
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
            {business ? (
              <button
                type="button"
                title="Undo recent reversible action"
                aria-label={`Undo ${movement.itemName} activity`}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] text-slate-600 transition hover:text-cyan-300"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ))}
        {!movements.length ? (
          <div className="rounded-xl border border-dashed border-white/[0.07] px-4 py-8 text-center text-[9px] text-slate-600">
            Activity will appear after inventory is filed, moved, listed, adjusted, or sold.
          </div>
        ) : null}
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
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
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
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.04] text-cyan-300">
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
    zone?: string;
    organization?: string;
    capacityUnit?: LocationRecord["capacityUnit"];
    warningThreshold?: number;
    criticalThreshold?: number;
    binderColumns?: number;
    binderRows?: number;
    binderPages?: number;
    binderDoubleSided?: boolean;
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
  const [zone, setZone] = useState(location?.zone ?? "Main Warehouse");
  const [organization, setOrganization] = useState(location?.organization ?? "");
  const [capacityUnit, setCapacityUnit] = useState<LocationRecord["capacityUnit"]>(location?.capacityUnit ?? "cards");
  const [warningThreshold, setWarningThreshold] = useState(String(location?.warningThreshold ?? 80));
  const [criticalThreshold, setCriticalThreshold] = useState(String(location?.criticalThreshold ?? 95));
  const [binderColumns, setBinderColumns] = useState(String(location?.binderColumns ?? 3));
  const [binderRows, setBinderRows] = useState(String(location?.binderRows ?? 3));
  const [binderPages, setBinderPages] = useState(String(location?.binderPages ?? 20));
  const [binderDoubleSided, setBinderDoubleSided] = useState(location?.binderDoubleSided ?? true);

  useEffect(() => {
    setName(location?.name ?? "");
    setType(location?.type ?? "custom");
    setDescription(location?.description ?? "");
    setCapacity(location?.capacity ? String(location.capacity) : "");
    setZone(location?.zone ?? "Main Warehouse");
    setOrganization(location?.organization ?? "");
    setCapacityUnit(location?.capacityUnit ?? "cards");
    setWarningThreshold(String(location?.warningThreshold ?? 80));
    setCriticalThreshold(String(location?.criticalThreshold ?? 95));
    setBinderColumns(String(location?.binderColumns ?? 3));
    setBinderRows(String(location?.binderRows ?? 3));
    setBinderPages(String(location?.binderPages ?? 20));
    setBinderDoubleSided(location?.binderDoubleSided ?? true);
  }, [location, open]);

  if (!open) return null;

  return (
    <ModalFrame onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;

          const binderCapacity = Number(binderColumns) * Number(binderRows) * Number(binderPages);
          onSave({
            name: name.trim(),
            type,
            description: description.trim(),
            capacity: type === "binder" ? binderCapacity : capacity ? Number(capacity) : undefined,
            zone: zone.trim() || "Main Warehouse",
            organization: organization.trim() || undefined,
            capacityUnit,
            warningThreshold: Math.min(100, Math.max(1, Number(warningThreshold) || 80)),
            criticalThreshold: Math.min(100, Math.max(Number(warningThreshold) + 1, Number(criticalThreshold) || 95)),
            binderColumns: type === "binder" ? Math.min(8, Math.max(1, Number(binderColumns) || 3)) : undefined,
            binderRows: type === "binder" ? Math.min(8, Math.max(1, Number(binderRows) || 3)) : undefined,
            binderPages: type === "binder" ? Math.max(1, Number(binderPages) || 20) : undefined,
            binderDoubleSided: type === "binder" ? binderDoubleSided : undefined,
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

          <Field label="Warehouse or zone">
            <input
              value={zone}
              onChange={(event) => setZone(event.target.value)}
              placeholder="Main Warehouse / Zone A"
              className="inventory-input"
            />
          </Field>

          {type === "binder" ? (
            <div className="sm:col-span-2 rounded-2xl border border-cyan-300/[0.13] bg-cyan-400/[0.035] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/[0.14] bg-cyan-400/[0.07] text-cyan-300"><BookOpen className="h-4 w-4" /></span>
                <div><p className="text-[10px] font-semibold text-cyan-200">Virtual page setup</p><p className="mt-1 text-[8px] leading-4 text-slate-600">Match the digital pockets to your physical binder. Every position receives a searchable page and slot address.</p></div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Field label="Columns"><select value={binderColumns} onChange={(event) => setBinderColumns(event.target.value)} className="inventory-input"><option value="3">3 columns</option><option value="4">4 columns</option><option value="5">5 columns</option><option value="6">6 columns</option></select></Field>
                <Field label="Rows"><select value={binderRows} onChange={(event) => setBinderRows(event.target.value)} className="inventory-input"><option value="3">3 rows</option><option value="4">4 rows</option><option value="5">5 rows</option></select></Field>
                <Field label="Physical pages"><input type="number" min="1" max="500" value={binderPages} onChange={(event) => setBinderPages(event.target.value)} className="inventory-input" /></Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2.5">
                <label className="flex items-center gap-2 text-[9px] text-slate-400"><input type="checkbox" checked={binderDoubleSided} onChange={(event) => setBinderDoubleSided(event.target.checked)} className="accent-cyan-400" /> Double-sided physical pages</label>
                <span className="text-[9px] font-semibold text-cyan-300">{(Number(binderColumns) * Number(binderRows) * Number(binderPages)).toLocaleString("en-US")} searchable pockets</span>
              </div>
            </div>
          ) : null}

          <Field label="Total capacity">
            {type === "binder" ? (
              <div className="inventory-input flex items-center text-slate-400">
                {(Number(binderColumns) * Number(binderRows) * Number(binderPages)).toLocaleString("en-US")} pockets · calculated automatically
              </div>
            ) : (
              <>
                <input
                  type="number"
                  min="0"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  placeholder="Optional"
                  className="inventory-input"
                />
                {(type === "chaos" || type === "custom") ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[400, 800, 1000, 3200, 5000].map((preset) => (
                      <button key={preset} type="button" onClick={() => setCapacity(String(preset))} className={`rounded-lg border px-2 py-1 text-[8px] font-semibold transition ${capacity === String(preset) ? "border-cyan-300/25 bg-cyan-400/[0.08] text-cyan-200" : "border-white/[0.07] text-slate-600 hover:text-slate-300"}`}>
                        {preset.toLocaleString("en-US")}
                      </button>
                    ))}
                    {capacity ? <button type="button" onClick={() => setCapacity("")} className="rounded-lg px-2 py-1 text-[8px] font-semibold text-slate-600 hover:text-red-300">Clear</button> : null}
                  </div>
                ) : null}
              </>
            )}
          </Field>

          <Field label="Capacity unit">
            <select value={capacityUnit} onChange={(event) => setCapacityUnit(event.target.value as LocationRecord["capacityUnit"])} className="inventory-input">
              <option value="cards">Cards</option>
              <option value="products">Products</option>
              <option value="slots">Slots</option>
              <option value="boxes">Boxes</option>
            </select>
          </Field>

          <Field label="Organization method">
            <input
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
              placeholder="Set, color, alphabet, value..."
              className="inventory-input"
            />
          </Field>

          <Field label="Capacity warning">
            <div className="relative">
              <input type="number" min="1" max="100" value={warningThreshold} onChange={(event) => setWarningThreshold(event.target.value)} className="inventory-input pr-9" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
            </div>
          </Field>

          <Field label="Capacity critical">
            <div className="relative">
              <input type="number" min="1" max="100" value={criticalThreshold} onChange={(event) => setCriticalThreshold(event.target.value)} className="inventory-input pr-9" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
            </div>
          </Field>

          <Field label="Notes or filing instructions" className="sm:col-span-2">
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
  const [collectorNumber, setCollectorNumber] = useState("");
  const [language, setLanguage] = useState("English");
  const [finish, setFinish] = useState<InventoryFinish>("Nonfoil");
  const [treatment, setTreatment] = useState("Traditional");
  const [selectedPrinting, setSelectedPrinting] =
    useState<SelectedPrinting | null>(null);
  const [costBasis, setCostBasis] = useState("0");
  const [unitMarketValue, setUnitMarketValue] = useState("0");

  useEffect(() => {
    if (defaultLocationId) setLocationId(defaultLocationId);
  }, [defaultLocationId, open]);

  if (!open) return null;

  return (
    <ModalFrame onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (category === "Single" && !selectedPrinting) return;
          if (!name.trim() || !sku.trim() || !locationId) return;

          const filedQuantity = Math.max(1, Number(quantity));
          const marketEach = Math.max(0, Number(unitMarketValue));
          onFile({
            id: crypto.randomUUID(),
            name: name.trim(),
            sku: sku.trim(),
            category,
            quantity: Math.max(1, Number(quantity)),
            locationId,
            condition: category === "Single" ? condition : undefined,
            set: cardSet.trim() || undefined,
            collectorNumber: collectorNumber.trim() || undefined,
            language: category === "Single" ? language : undefined,
            finish: category === "Single" ? finish : undefined,
            treatment: category === "Single" ? treatment : undefined,
            scryfallId: selectedPrinting?.scryfallId,
            imageUrl: selectedPrinting?.imageUrl,
            costBasis: Math.max(0, Number(costBasis)),
            unitMarketValue: marketEach,
            value: filedQuantity * marketEach,
            updatedAt: "Just now",
          });
        }}
      >
        <ModalHeader
          eyebrow="File inventory · Visual Printing Browser"
          title="Add inventory to a storage location"
          onClose={onClose}
        />

        <div className="mt-6 space-y-4">
          {category === "Single" ? (
            <PrintingSelector
              value={name}
              onValueChange={(nextName) => {
                setName(nextName);
                setSelectedPrinting(null);
              }}
              onSelect={(printing) => {
                setSelectedPrinting(printing);
                setName(printing.name);
                setCardSet(`${printing.setName} (${printing.setCode})`);
                setCollectorNumber(printing.collectorNumber);
                setFinish(printing.finish);
                setTreatment(printing.treatment);
                setUnitMarketValue(printing.marketPrice.toFixed(2));
                setSku(
                  `${printing.setCode}-${printing.collectorNumber}-${printing.finish.toUpperCase()}`,
                );
              }}
            />
          ) : (
            <FormSection
              step="1"
              title="Identify the product"
              description="Enter the product name before adding its inventory details."
            >
              <Field label="Product name" className="sm:col-span-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Product name"
                  className="inventory-input"
                  required
                />
              </Field>
            </FormSection>
          )}

          {category === "Single" && selectedPrinting && (
            <div className="flex gap-4 rounded-[20px] border border-emerald-300/20 bg-emerald-400/[0.05] p-4">
              {selectedPrinting.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedPrinting.imageUrl}
                  alt={selectedPrinting.name}
                  className="w-24 rounded-lg shadow-xl"
                />
              )}
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-300">
                  Exact printing selected
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {selectedPrinting.name}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {selectedPrinting.setName} · {selectedPrinting.setCode} #
                  {selectedPrinting.collectorNumber}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {selectedPrinting.finish} · {selectedPrinting.treatment}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedPrinting(null)}
                  className="mt-3 text-[9px] font-semibold text-cyan-300 hover:text-cyan-100"
                >
                  Choose a different printing
                </button>
              </div>
            </div>
          )}

          <FormSection
            step="2"
            title="Inventory and pricing"
            description="Record how many you have and the per-item financial details."
          >
            <Field label="Category">
              <select
                value={category}
                onChange={(event) => {
                  const nextCategory = event.target.value as InventoryItem["category"];
                  setCategory(nextCategory);
                  if (nextCategory !== "Single") setSelectedPrinting(null);
                }}
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
            <Field label="SKU or product ID">
              <input
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Generated after selecting a printing"
                className="inventory-input"
                required
              />
            </Field>
            <Field label="Market price each">
              <div className="inventory-money-input">
                <span>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitMarketValue}
                  onChange={(event) => setUnitMarketValue(event.target.value)}
                  className="inventory-input"
                />
              </div>
            </Field>
            <Field label="Cost paid each">
              <div className="inventory-money-input">
                <span>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costBasis}
                  onChange={(event) => setCostBasis(event.target.value)}
                  className="inventory-input"
                />
              </div>
            </Field>
          </FormSection>

          <FormSection
            step="3"
            title="Storage and card details"
            description="Confirm where this inventory is filed and review its exact attributes."
          >
            <Field label="Destination" className="sm:col-span-2">
              <select
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
                className="inventory-input"
              >
                <option value="" disabled>
                  {locations.length ? "Choose a storage location" : "Create a storage location first"}
                </option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Set / printing">
              <input
                value={cardSet}
                onChange={(event) => setCardSet(event.target.value)}
                placeholder="Choose an exact printing above"
                className="inventory-input inventory-readonly"
                readOnly={category === "Single"}
              />
            </Field>
            {category === "Single" && (
              <>
                <Field label="Collector number">
                  <input value={collectorNumber} className="inventory-input inventory-readonly" readOnly />
                </Field>
                <Field label="Language">
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="inventory-input"
                  >
                    <option>English</option>
                    <option>Japanese</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                    <option>Italian</option>
                    <option>Portuguese</option>
                    <option>Korean</option>
                    <option>Russian</option>
                    <option>Simplified Chinese</option>
                    <option>Traditional Chinese</option>
                  </select>
                </Field>
                <Field label="Finish / treatment">
                  <input value={`${finish} · ${treatment}`} className="inventory-input inventory-readonly" readOnly />
                </Field>
              </>
            )}
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
          </FormSection>
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
          disabled={
            !name.trim() ||
            !sku.trim() ||
            !locationId ||
            (category === "Single" && !selectedPrinting)
          }
          className="mt-6 h-11 w-full rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 text-xs font-semibold text-[#001018]"
        >
          {locations.length === 0
            ? "Create a storage location first"
            : category === "Single" && !selectedPrinting
              ? "Choose an exact printing first"
              : "File inventory"}
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
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.scrollTo({ top: 0, behavior: "instant" });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/72 px-4 pb-4 pt-4 backdrop-blur-md sm:pt-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label="Close modal"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={`relative z-10 max-h-[calc(100dvh-2rem)] w-full ${wide ? "max-w-[980px]" : "max-w-[720px]"} overflow-y-auto overscroll-contain rounded-[28px] border border-cyan-300/[0.14] bg-[#06131d]/98 p-5 shadow-[0_38px_120px_rgba(0,0,0,0.55)] sm:max-h-[calc(100dvh-3rem)] sm:p-7`}
      >
        {children}

        <style jsx global>{`
          .inventory-input {
            height: 44px;
            width: 100%;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.075);
            background: rgba(255, 255, 255, 0.025);
            padding: 0 13px;
            color: rgb(226 232 240);
            font-size: 12px;
            outline: none;
            transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
          }

          .inventory-input:focus {
            border-color: rgba(103, 232, 249, 0.24);
            box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.045);
          }

          .inventory-input:disabled {
            opacity: 0.42;
          }

          select.inventory-input {
            color-scheme: dark;
            cursor: pointer;
          }

          select.inventory-input option,
          select.inventory-input optgroup {
            background-color: #0b1822;
            color: #e2e8f0;
          }

          select.inventory-input option:checked {
            background: #164e63 linear-gradient(0deg, #164e63 0%, #164e63 100%);
            color: #ecfeff;
          }

          select.inventory-input option:disabled {
            color: #64748b;
          }

          .inventory-readonly {
            color: rgb(148 163 184);
            background: rgba(255, 255, 255, 0.015);
          }

          .inventory-money-input {
            position: relative;
          }

          .inventory-money-input > span {
            position: absolute;
            left: 13px;
            top: 50%;
            z-index: 1;
            transform: translateY(-50%);
            color: rgb(100 116 139);
            font-size: 12px;
          }

          .inventory-money-input .inventory-input {
            padding-left: 28px;
          }
        `}</style>
      </div>
    </div>,
    document.body,
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
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-white">{title}</h2>
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
      <span className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-white/[0.065] bg-white/[0.018] p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3 border-b border-white/[0.055] pb-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[0.07] text-[10px] font-semibold text-cyan-200">
          {step}
        </span>
        <div>
          <h3 className="text-[12px] font-semibold text-slate-200">{title}</h3>
          <p className="mt-1 text-[9px] leading-4 text-slate-600">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function normalizeInventoryKey(item: InventoryItem) {
  return `${item.sku}|${item.condition ?? ""}`.trim().toLowerCase();
}

function inventoryAgeDays(item: InventoryItem) {
  const timestamp = Date.parse(item.updatedAt);
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function inventoryMatchesAgeBucket(
  item: InventoryItem,
  bucket: Exclude<InventoryAgeBucket, "all">,
) {
  const age = inventoryAgeDays(item);
  if (bucket === "0-30") return age <= 30;
  if (bucket === "31-60") return age >= 31 && age <= 60;
  if (bucket === "61-90") return age >= 61 && age <= 90;
  if (bucket === "91-180") return age >= 91 && age <= 180;
  return age > 180;
}

function inventoryMatchesSavedView(item: InventoryItem, view: BusinessSavedView) {
  const activeListings = (item.marketplaceListings ?? []).filter(
    (listing) => listing.status === "Active",
  );
  if (view === "recent") return inventoryAgeDays(item) <= 30;
  if (view === "unlisted") return activeListings.length === 0;
  if (view === "multi-channel")
    return new Set(activeListings.map((listing) => listing.platform)).size > 1;
  if (view === "high-value") return item.value >= 100;
  if (view === "no-cost") return !item.costBasis;
  if (view === "no-location") return !item.locationId;
  if (view === "errors")
    return (item.marketplaceListings ?? []).some(
      (listing) => listing.status === "Error",
    );
  return true;
}

function readLocalInventoryRecords(key: string) {
  const stored = window.localStorage.getItem(key);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (record): record is { id: string; [key: string]: unknown } =>
        Boolean(
          record &&
            typeof record === "object" &&
            typeof (record as { id?: unknown }).id === "string",
        ),
    );
  } catch {
    return [];
  }
}

function toInventorySnapshot(
  locations: LocationRecord[],
  items: InventoryItem[],
  movements: Movement[],
): InventorySnapshot {
  return {
    locations: locations as unknown as InventorySnapshot["locations"],
    items: items as unknown as InventorySnapshot["items"],
    movements: movements as unknown as InventorySnapshot["movements"],
  };
}

function cloneInventorySnapshot(snapshot: InventorySnapshot): InventorySnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as InventorySnapshot;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
