"use client";

import { Archive, Boxes, MapPin, Plus, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  TDBadge,
  TDButton,
  TDCard,
  TDEmptyState,
  TDErrorState,
  TDInput,
  TDLoadingState,
  TDText,
} from "@/components/design-system/td-primitives";
import {
  archiveWebStorageLocation,
  assignWebStorageLocation,
  createWebStorageLocation,
  loadWebStorageLocationManager,
  renameWebStorageLocation,
} from "@/lib/storage-location-client-data";
import {
  STORAGE_LOCATION_TYPES,
  cardsInLocationTree,
  favoriteLocationSummaries,
  recentLocationSummaries,
  searchLocationSummaries,
  type LocationSummary,
  type StorageLocationType,
} from "@/lib/storage-location-manager";
import type { CollectionCard } from "@/lib/collector-workspace";

type ManagerState = Awaited<ReturnType<typeof loadWebStorageLocationManager>>;
const UNASSIGNED_LOCATION_ID = "__unassigned__";

export function StorageLocationManager() {
  const [state, setState] = useState<ManagerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<StorageLocationType>("area");
  const [newParentId, setNewParentId] = useState("");
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [cardSearch, setCardSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    void loadWebStorageLocationManager()
      .then((result) => {
        setState(result);
        setSelectedId((current) => current ?? UNASSIGNED_LOCATION_ID);
        setError(null);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Storage locations are unavailable."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    void loadWebStorageLocationManager()
      .then((result) => {
        if (!active) return;
        setState(result);
        setSelectedId((current) => current ?? UNASSIGNED_LOCATION_ID);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Storage locations are unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const summaries = useMemo(() => searchLocationSummaries(state?.summaries ?? [], query), [query, state]);
  const selected = useMemo(() => summaries.find((location) => location.id === selectedId) ?? null, [selectedId, summaries]);
  const selectedIsUnassigned = selectedId === UNASSIGNED_LOCATION_ID;
  const selectedCards = useMemo(
    () => selectedIsUnassigned && state ? state.unassignedCards : selected && state ? cardsInLocationTree(state.cards, selected.id, state.locations) : [],
    [selected, selectedIsUnassigned, state],
  );
  const filteredCards = useMemo(() => {
    const normalized = cardSearch.trim().toLowerCase();
    if (!normalized || !state) return [];
    return state.cards.filter((card) => `${card.cardName} ${card.printing.setCode ?? ""} ${card.printing.collectorNumber ?? ""}`.toLowerCase().includes(normalized)).slice(0, 8);
  }, [cardSearch, state]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setPending(key);
    setError(null);
    try {
      await action();
      setNewName("");
      setNewParentId("");
      setRenameValue("");
      setCardSearch("");
      setShowCreateLocation(false);
      reload();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Storage location update failed.");
    } finally {
      setPending(null);
    }
  };

  if (loading) {
    return (
      <TDCard variant="outlined">
        <TDLoadingState title="Loading locations" message="Building your storage map." />
      </TDCard>
    );
  }

  if (!state) {
    return (
      <TDCard variant="outlined">
        <TDErrorState title="Storage locations unavailable" message={error ?? "Location data could not be loaded."} action={<TDButton label="Retry" variant="secondary" onClick={reload} />} />
      </TDCard>
    );
  }

  return (
    <TDCard className="space-y-5" aria-labelledby="storage-location-manager-title">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <TDText id="storage-location-manager-title" as="h2" variant="title">Collection Storage</TDText>
          <TDText variant="small" tone="muted">Find where a card lives, assign it to a real-world place, and reorganize without leaving Collection.</TDText>
        </div>
        <TDButton label="New location" icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateLocation(true)} />
      </header>

      {error ? <TDErrorState title="Location update failed" message={error} /> : null}
      {showCreateLocation ? (
        <div className="rounded-[var(--td-radius-lg)] border border-cyan-300/15 bg-cyan-300/[.035] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <TDText variant="title">New location</TDText>
              <TDText variant="caption" tone="muted">Create an Area, Shelf, Box, Binder, Page, or Slot in the same storage system used by Collection rows.</TDText>
            </div>
            <button type="button" aria-label="Close new location" onClick={() => setShowCreateLocation(false)} className="rounded-full p-2 text-[var(--td-text-muted)] outline-none hover:text-[var(--td-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_150px_minmax(180px,1fr)_auto] md:items-end">
            <TDInput label="Name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Office, Shelf B, Box 14..." />
            <label className="space-y-2">
              <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">Type</span>
              <select value={newType} onChange={(event) => setNewType(event.target.value as StorageLocationType)} className="min-h-12 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-3 text-sm text-[var(--td-text-primary)]">
                {STORAGE_LOCATION_TYPES.map((type) => <option key={type} value={type}>{labelForType(type)}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">Parent location</span>
              <select value={newParentId} onChange={(event) => setNewParentId(event.target.value)} className="min-h-12 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-3 text-sm text-[var(--td-text-primary)]">
                <option value="">None</option>
                {state.summaries.map((location) => <option key={location.id} value={location.id}>{location.path.label}</option>)}
              </select>
            </label>
            <TDButton label="Create" loading={pending === "create"} disabled={!newName.trim()} onClick={() => run("create", () => createWebStorageLocation({ name: newName, type: newType, parentId: newParentId || null }))} />
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          <TDInput label="Search locations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Shelf, binder, slot..." />
          <button
            type="button"
            aria-pressed={selectedIsUnassigned}
            onClick={() => setSelectedId(UNASSIGNED_LOCATION_ID)}
            className="w-full rounded-[var(--td-radius-md)] border border-amber-300/20 bg-amber-300/[.06] p-3 text-left outline-none transition hover:border-amber-200/50 focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-black text-amber-100">Unassigned</span>
              <TDBadge tone="warning">{state.unassignedCards.reduce((sum, card) => sum + card.quantityOwned, 0)} cards</TDBadge>
            </div>
            <TDText variant="caption" tone="muted" className="mt-1">Cards with no physical location</TDText>
          </button>
          <QuickLocations title="Favorites" locations={favoriteLocationSummaries(state.summaries)} onSelect={setSelectedId} />
          <QuickLocations title="Recent" locations={recentLocationSummaries(state.summaries)} onSelect={setSelectedId} />
          {summaries.length ? (
            <div className="space-y-2" role="list" aria-label="Storage locations">
              {summaries.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  aria-pressed={selected?.id === location.id}
                  onClick={() => setSelectedId(location.id)}
                  className="w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] p-3 text-left outline-none transition hover:border-[var(--td-border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-black text-[var(--td-text-primary)]">{location.name}</span>
                    <TDBadge tone={location.favorite ? "accent" : "neutral"}>{location.assignedQuantity} cards</TDBadge>
                  </div>
                  <TDText variant="caption" tone="muted" className="mt-1">{location.path.label}</TDText>
                </button>
              ))}
            </div>
          ) : (
            <TDEmptyState title="No locations" message="Create your first Area, Shelf, Container, Section, or Slot." />
          )}
        </div>

        <div className="space-y-3">
          {selected || selectedIsUnassigned ? (
            <LocationDetail
              location={selected}
              cards={selectedCards}
              isUnassigned={selectedIsUnassigned}
              unassignedCards={state.unassignedCards}
              locations={state.summaries}
              filteredCards={filteredCards}
              cardSearch={cardSearch}
              setCardSearch={setCardSearch}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              pending={pending}
              onRename={() => selected ? run("rename", () => renameWebStorageLocation(selected.id, renameValue || selected.name)) : undefined}
              onArchive={() => selected ? run("archive", () => archiveWebStorageLocation(selected.id)) : undefined}
              onAssign={(card, toLocationId = selected?.id ?? null) => run(`assign-${card.id}`, () => assignWebStorageLocation({ userId: state.userId, inventoryItemId: card.id, fromLocationId: card.storageLocation?.id ?? null, toLocationId }))}
              onClear={(card) => run(`clear-${card.id}`, () => assignWebStorageLocation({ userId: state.userId, inventoryItemId: card.id, fromLocationId: card.storageLocation?.id ?? null, toLocationId: null }))}
            />
          ) : (
            <TDEmptyState title="No location selected" message="Choose a location to see assigned and unassigned cards." />
          )}
        </div>
      </section>
    </TDCard>
  );
}

function QuickLocations({ title, locations, onSelect }: { title: string; locations: LocationSummary[]; onSelect: (id: string) => void }) {
  if (!locations.length) return null;
  return (
    <div>
      <TDText variant="label" tone="muted">{title}</TDText>
      <div className="mt-2 flex flex-wrap gap-2">
        {locations.map((location) => (
          <button key={location.id} type="button" onClick={() => onSelect(location.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-cyan-300/25 px-3 text-xs font-black text-cyan-100 outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]">
            {title === "Favorites" ? <Star className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {location.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function LocationDetail({
  location,
  cards,
  isUnassigned,
  unassignedCards,
  locations,
  filteredCards,
  cardSearch,
  setCardSearch,
  renameValue,
  setRenameValue,
  pending,
  onRename,
  onArchive,
  onAssign,
  onClear,
}: {
  location: LocationSummary | null;
  cards: CollectionCard[];
  isUnassigned: boolean;
  unassignedCards: CollectionCard[];
  locations: LocationSummary[];
  filteredCards: CollectionCard[];
  cardSearch: string;
  setCardSearch: (value: string) => void;
  renameValue: string;
  setRenameValue: (value: string) => void;
  pending: string | null;
  onRename: () => void | Promise<void> | undefined;
  onArchive: () => void | Promise<void> | undefined;
  onAssign: (card: CollectionCard, toLocationId?: string | null) => void;
  onClear: (card: CollectionCard) => void;
}) {
  const title = isUnassigned ? "Unassigned" : location?.name ?? "Storage";
  const quantity = cards.reduce((sum, card) => sum + card.quantityOwned, 0);

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <TDBadge tone={isUnassigned ? "warning" : "info"}>{isUnassigned ? "Smart location" : labelForType(location?.type ?? "unknown")}</TDBadge>
            {location?.favorite ? <TDBadge tone="accent">Favorite</TDBadge> : null}
            {location?.archivedAt ? <TDBadge tone="warning">Archived</TDBadge> : null}
          </div>
          <TDText variant="heading">{title}</TDText>
          <TDText variant="small" tone="muted">{isUnassigned ? "Cards with no physical location. Assign these to make them findable later." : location?.path.label}</TDText>
          {!isUnassigned && location ? (
            <Link
              href={`/dashboard/inventory/import?locationId=${encodeURIComponent(location.id)}&locationName=${encodeURIComponent(location.path.label)}`}
              className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-[var(--td-radius-md)] border border-cyan-300/25 bg-cyan-300/10 px-3 text-xs font-black text-cyan-100 outline-none transition hover:border-cyan-200/50 focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Import CSV here
            </Link>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <MiniMetric icon={<Boxes className="h-4 w-4" />} label="Cards" value={String(cards.length)} />
            <MiniMetric icon={<Archive className="h-4 w-4" />} label="Quantity" value={String(quantity)} />
            <MiniMetric icon={<MapPin className="h-4 w-4" />} label={isUnassigned ? "Task" : "Children"} value={isUnassigned ? "Assign" : String(location?.childCount ?? 0)} />
          </div>
        </div>

        <TDInput label="Search cards" value={cardSearch} onChange={(event) => setCardSearch(event.target.value)} placeholder="Search cards to assign or move" />
        {filteredCards.length ? (
          <CardList cards={filteredCards} locations={locations} actionLabel={isUnassigned ? "Move to..." : "Assign here"} pending={pending} onAction={(card, toLocationId) => onAssign(card, isUnassigned ? toLocationId : location?.id ?? null)} />
        ) : cardSearch ? (
          <TDEmptyState title="No cards found" message="Try a card name, set code, or collector number." />
        ) : null}

        {cards.length ? (
          <CardList cards={cards} locations={locations} actionLabel={isUnassigned ? "Move to..." : "Clear assignment"} pending={pending} onAction={isUnassigned ? onAssign : onClear} />
        ) : (
          <TDEmptyState title={isUnassigned ? "Everything is assigned" : "No cards assigned"} message={isUnassigned ? "Every visible card has a physical location." : "Use search or unassigned cards to move cards into this location."} />
        )}

        {!isUnassigned && unassignedCards.length ? (
          <div>
            <TDText variant="label" tone="muted">Unassigned cards</TDText>
            <CardList cards={unassignedCards.slice(0, 6)} locations={locations} actionLabel="Assign here" pending={pending} onAction={(card) => onAssign(card, location?.id ?? null)} />
          </div>
        ) : null}
      </div>

      {!isUnassigned && location ? (
        <aside className="space-y-3 rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] p-4">
          <div>
            <TDText variant="title">Location details</TDText>
            <TDText variant="caption" tone="muted">Rename or archive only when you are intentionally managing the selected location.</TDText>
          </div>
          <TDInput label="Rename location" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} placeholder={location.name} />
          <div className="flex flex-wrap gap-2">
            <TDButton label="Rename" variant="secondary" loading={pending === "rename"} onClick={onRename} />
            <TDButton label="Archive" variant="ghost" loading={pending === "archive"} onClick={onArchive} />
          </div>
          <div className="rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] p-3">
            <TDText variant="label" tone="muted">Path</TDText>
            <TDText variant="small" className="mt-1">{location.path.label}</TDText>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function CardList({ cards, locations, actionLabel, pending, onAction }: { cards: CollectionCard[]; locations: LocationSummary[]; actionLabel: string; pending: string | null; onAction: (card: CollectionCard, locationId?: string | null) => void }) {
  return (
    <div className="space-y-2">
      {cards.map((card) => (
        <div key={card.id} className="flex flex-col gap-3 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <TDText variant="small">{card.cardName}</TDText>
            <TDText variant="caption" tone="muted">{card.printing.setCode ?? "Set unavailable"} #{card.printing.collectorNumber ?? "?"} - x{card.quantityOwned}</TDText>
          </div>
          {actionLabel === "Move to..." ? (
            <select
              aria-label={`Move ${card.cardName} to storage location`}
              disabled={pending === `assign-${card.id}` || !locations.length}
              onChange={(event) => {
                if (event.target.value) onAction(card, event.target.value);
                event.target.value = "";
              }}
              className="min-h-10 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-3 text-xs font-black text-[var(--td-text-primary)] outline-none focus:border-[var(--td-border-focus)] disabled:opacity-50"
              defaultValue=""
            >
              <option value="">{locations.length ? "Move to..." : "No locations"}</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.path.label}</option>)}
            </select>
          ) : (
            <TDButton label={actionLabel} variant="secondary" size="sm" loading={pending === `assign-${card.id}` || pending === `clear-${card.id}`} onClick={() => onAction(card)} />
          )}
        </div>
      ))}
    </div>
  );
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] p-3">
      <div className="flex items-center gap-2 text-[var(--td-text-muted)]">{icon}<TDText variant="caption" tone="muted">{label}</TDText></div>
      <TDText variant="title">{value}</TDText>
    </div>
  );
}

function labelForType(type: StorageLocationType) {
  const labels: Record<StorageLocationType, string> = {
    area: "Area",
    shelf: "Shelf",
    container: "Container",
    section: "Section",
    slot: "Slot",
    binder: "Binder",
    box: "Box",
    sealed: "Sealed",
    bulk: "Bulk",
    custom: "Custom",
    unknown: "Unknown",
  };
  return labels[type];
}
