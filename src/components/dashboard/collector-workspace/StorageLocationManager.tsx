"use client";

import { Archive, Boxes, MapPin, Star } from "lucide-react";
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
  cardsInLocation,
  favoriteLocationSummaries,
  recentLocationSummaries,
  searchLocationSummaries,
  type LocationSummary,
  type StorageLocationType,
} from "@/lib/storage-location-manager";
import type { CollectionCard } from "@/lib/collector-workspace";

type ManagerState = Awaited<ReturnType<typeof loadWebStorageLocationManager>>;

export function StorageLocationManager() {
  const [state, setState] = useState<ManagerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<StorageLocationType>("area");
  const [renameValue, setRenameValue] = useState("");
  const [cardSearch, setCardSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    void loadWebStorageLocationManager()
      .then((result) => {
        setState(result);
        setSelectedId((current) => current ?? result.summaries[0]?.id ?? null);
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
        setSelectedId((current) => current ?? result.summaries[0]?.id ?? null);
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
  const selected = useMemo(() => summaries.find((location) => location.id === selectedId) ?? summaries[0] ?? null, [selectedId, summaries]);
  const selectedCards = useMemo(
    () => selected && state ? cardsInLocation(state.cards, selected.id) : [],
    [selected, state],
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
      setRenameValue("");
      setCardSearch("");
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
          <TDText id="storage-location-manager-title" as="h2" variant="title">Storage Location Manager</TDText>
          <TDText variant="small" tone="muted">Find where a card lives, assign it to a real-world place, and keep unassigned cards visible.</TDText>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_150px_auto]">
          <TDInput label="New location" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Office, Shelf B, Box 14..." />
          <label className="space-y-2">
            <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-[var(--td-text-muted)]">Type</span>
            <select value={newType} onChange={(event) => setNewType(event.target.value as StorageLocationType)} className="min-h-12 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-3 text-sm text-[var(--td-text-primary)]">
              {STORAGE_LOCATION_TYPES.map((type) => <option key={type} value={type}>{labelForType(type)}</option>)}
            </select>
          </label>
          <TDButton label="Create" loading={pending === "create"} disabled={!newName.trim()} onClick={() => run("create", () => createWebStorageLocation({ name: newName, type: newType }))} />
        </div>
      </header>

      {error ? <TDErrorState title="Location update failed" message={error} /> : null}

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <TDInput label="Search locations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Shelf, binder, slot..." />
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
          {selected ? (
            <LocationDetail
              location={selected}
              cards={selectedCards}
              unassignedCards={state.unassignedCards}
              filteredCards={filteredCards}
              cardSearch={cardSearch}
              setCardSearch={setCardSearch}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              pending={pending}
              onRename={() => run("rename", () => renameWebStorageLocation(selected.id, renameValue || selected.name))}
              onArchive={() => run("archive", () => archiveWebStorageLocation(selected.id))}
              onAssign={(card) => run(`assign-${card.id}`, () => assignWebStorageLocation({ userId: state.userId, inventoryItemId: card.id, fromLocationId: card.storageLocation?.id ?? null, toLocationId: selected.id }))}
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
  unassignedCards,
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
  location: LocationSummary;
  cards: CollectionCard[];
  unassignedCards: CollectionCard[];
  filteredCards: CollectionCard[];
  cardSearch: string;
  setCardSearch: (value: string) => void;
  renameValue: string;
  setRenameValue: (value: string) => void;
  pending: string | null;
  onRename: () => void;
  onArchive: () => void;
  onAssign: (card: CollectionCard) => void;
  onClear: (card: CollectionCard) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[var(--td-radius-lg)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <TDBadge tone="info">{labelForType(location.type)}</TDBadge>
          {location.favorite ? <TDBadge tone="accent">Favorite</TDBadge> : null}
          {location.archivedAt ? <TDBadge tone="warning">Archived</TDBadge> : null}
        </div>
        <TDText variant="heading">{location.name}</TDText>
        <TDText variant="small" tone="muted">{location.path.label}</TDText>
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniMetric icon={<Boxes className="h-4 w-4" />} label="Cards" value={String(location.assignedCardCount)} />
          <MiniMetric icon={<Archive className="h-4 w-4" />} label="Quantity" value={String(location.assignedQuantity)} />
          <MiniMetric icon={<MapPin className="h-4 w-4" />} label="Children" value={String(location.childCount)} />
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <TDInput label="Rename" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} placeholder={location.name} />
          <TDButton label="Rename" variant="secondary" loading={pending === "rename"} onClick={onRename} />
          <TDButton label="Archive" variant="ghost" loading={pending === "archive"} onClick={onArchive} />
        </div>
      </div>

      <TDInput label="Find card" value={cardSearch} onChange={(event) => setCardSearch(event.target.value)} placeholder="Search cards to assign or move" />
      {filteredCards.length ? (
        <CardList cards={filteredCards} actionLabel="Assign here" pending={pending} onAction={onAssign} />
      ) : cardSearch ? (
        <TDEmptyState title="No cards found" message="Try a card name, set code, or collector number." />
      ) : null}

      {cards.length ? (
        <CardList cards={cards} actionLabel="Clear assignment" pending={pending} onAction={onClear} />
      ) : (
        <TDEmptyState title="No cards assigned" message="Use Find Card or unassigned cards to move cards into this location." />
      )}

      {unassignedCards.length ? (
        <div>
          <TDText variant="label" tone="muted">Unassigned cards</TDText>
          <CardList cards={unassignedCards.slice(0, 6)} actionLabel="Assign here" pending={pending} onAction={onAssign} />
        </div>
      ) : null}
    </div>
  );
}

function CardList({ cards, actionLabel, pending, onAction }: { cards: CollectionCard[]; actionLabel: string; pending: string | null; onAction: (card: CollectionCard) => void }) {
  return (
    <div className="space-y-2">
      {cards.map((card) => (
        <div key={card.id} className="flex flex-col gap-3 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <TDText variant="small">{card.cardName}</TDText>
            <TDText variant="caption" tone="muted">{card.printing.setCode ?? "Set unavailable"} #{card.printing.collectorNumber ?? "?"} - x{card.quantityOwned}</TDText>
          </div>
          <TDButton label={actionLabel} variant="secondary" size="sm" loading={pending === `assign-${card.id}` || pending === `clear-${card.id}`} onClick={() => onAction(card)} />
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
