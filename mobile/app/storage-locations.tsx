import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDChip,
  TDEmptyState,
  TDErrorState,
  TDInput,
  TDListRow,
  TDLoadingState,
  TDMetric,
  TDNavigationHeader,
  TDSegmentedControl,
  TDScreen,
  TDStatusIndicator,
  TDText,
} from '@/components/design-system';
import { color, space } from '@/design';
import {
  assignMobileStorageLocation,
  createMobileStorageLocation,
  loadStorageLocationManager,
  renameMobileStorageLocation,
  archiveMobileStorageLocation,
} from '@/services/storage-location-data';
import {
  STORAGE_LOCATION_TYPES,
  cardsInLocation,
  favoriteLocationSummaries,
  recentLocationSummaries,
  searchLocationSummaries,
  type LocationManagerState,
  type LocationSummary,
  type StorageLocationType,
} from '@/services/storage-location-manager';
import type { CollectionCard } from '@/services/collector-workspace';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';

type ScreenState = LocationManagerState & { userId: string; stale: boolean; unavailableReason?: string };

export default function StorageLocationsScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ScreenState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cardQuery, setCardQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<StorageLocationType>('area');
  const [renameValue, setRenameValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    void loadStorageLocationManager()
      .then((result) => {
        setState(result);
        setSelectedId((current) => current ?? result.summaries[0]?.id ?? null);
        setError(null);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Storage locations are unavailable.'))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const summaries = useMemo(() => searchLocationSummaries(state?.summaries ?? [], query), [query, state]);
  const selected = useMemo(() => summaries.find((location) => location.id === selectedId) ?? summaries[0] ?? null, [selectedId, summaries]);
  const selectedCards = useMemo(() => selected && state ? cardsInLocation(state.cards ?? [], selected.id) : [], [selected, state]);
  const cardResults = useMemo(() => {
    const normalized = cardQuery.trim().toLowerCase();
    if (!normalized || !state) return [];
    return [...state.unassignedCards, ...selectedCards]
      .filter((card) => `${card.cardName} ${card.printing.setCode ?? ''} ${card.printing.collectorNumber ?? ''}`.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [cardQuery, selectedCards, state]);

  const run = async (key: string, action: () => Promise<{ ok: boolean; error?: string; queued?: boolean; warning?: string } | unknown>) => {
    setPending(key);
    setError(null);
    const result = await action();
    if (isLocationActionResult(result) && !result.ok) {
      setError(result.error ?? 'Storage location update failed.');
      setPending(null);
      return;
    }
    if (isLocationActionResult(result) && result.queued) {
      setError(result.warning ?? 'Storage move queued for sync.');
    }
    setNewName('');
    setRenameValue('');
    setCardQuery('');
    reload();
    setPending(null);
  };

  if (loading) {
    return (
      <TDScreen style={s.screen}>
        <TDLoadingState title="Loading locations" message="Building your storage map." />
      </TDScreen>
    );
  }

  if (!state) {
    return (
      <TDScreen style={s.screen}>
        <TDErrorState title="Storage unavailable" message={error ?? 'Storage locations could not be loaded.'} action={<TDButton label="Retry" variant="secondary" onPress={reload} />} />
      </TDScreen>
    );
  }

  return (
    <TDScreen style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: getMobileScrollBottomInset(insets.bottom) }]} showsVerticalScrollIndicator={false}>
        <TDNavigationHeader
          eyebrow="Find Card"
          title="Storage map"
          subtitle="Search locations, see the full path, then move cards with ownership-safe actions."
          leftAction={<TDButton label="Back" variant="ghost" iconName="chevron-back" onPress={() => router.back()} style={s.back} />}
          rightAction={state.stale ? <TDBadge tone="warning">Stale</TDBadge> : undefined}
        />

        <TDInput label="Search locations" value={query} onChangeText={setQuery} leftIconName="search-outline" placeholder="Area, shelf, binder, slot..." />
        <QuickLocations title="Favorites" locations={favoriteLocationSummaries(state.summaries)} onSelect={setSelectedId} />
        <QuickLocations title="Recent" locations={recentLocationSummaries(state.summaries)} onSelect={setSelectedId} />

        {state.stale ? <TDStatusIndicator tone="warning" label={state.unavailableReason ?? 'Offline or stale'} /> : null}
        {error ? (
          <TDCard accessibilityRole="alert" variant="outlined" style={s.errorCard}>
            <TDStatusIndicator tone={error.includes('queued') ? 'warning' : 'danger'} label={error.includes('queued') ? 'Pending sync' : 'Update failed'} />
            <TDText variant="small" tone="muted">{error}</TDText>
          </TDCard>
        ) : null}

        <TDCard style={s.createCard}>
          <TDText variant="title">Create location</TDText>
          <TDInput label="Name" value={newName} onChangeText={setNewName} placeholder="Office, Shelf B, Box 14..." />
          <TDSegmentedControl
            label="Type"
            options={STORAGE_LOCATION_TYPES.slice(0, 5).map((type) => ({ value: type, label: labelForType(type) }))}
            value={newType}
            onChange={setNewType}
          />
          <TDButton label="Create location" loading={pending === 'create'} disabled={!newName.trim()} onPress={() => run('create', () => createMobileStorageLocation({ name: newName, type: newType }))} />
        </TDCard>

        {summaries.length ? (
          <View style={s.locationList} accessibilityRole="list">
            {summaries.map((location) => (
              <TDListRow
                key={location.id}
                title={location.name}
                description={location.path.label}
                eyebrow={labelForType(location.type)}
                iconName={location.favorite ? 'star' : 'file-tray-stacked-outline'}
                right={<TDBadge tone={location.favorite ? 'accent' : 'neutral'}>{location.assignedQuantity} cards</TDBadge>}
                accessibilityLabel={`${location.name}, ${location.assignedQuantity} cards`}
                selected={selected?.id === location.id}
                onPress={() => setSelectedId(location.id)}
              />
            ))}
          </View>
        ) : (
          <TDEmptyState title="No locations yet" message="Create an Area, Shelf, Container, Section, or Slot to start organizing." />
        )}

        {selected ? (
          <TDCard style={s.detailCard}>
            <View style={s.locationTitleRow}>
              <View style={s.flex}>
                <TDText variant="title">{selected.name}</TDText>
                <TDText variant="caption" tone="muted">{selected.path.label}</TDText>
              </View>
              <TDBadge tone="info">{labelForType(selected.type)}</TDBadge>
            </View>
            <View style={s.metrics}>
              <TDMetric label="Records" value={String(selected.assignedCardCount)} compact />
              <TDMetric label="Quantity" value={String(selected.assignedQuantity)} compact tone="info" />
              <TDMetric label="Children" value={String(selected.childCount)} compact />
            </View>
            <TDInput label="Rename" value={renameValue} onChangeText={setRenameValue} placeholder={selected.name} />
            <View style={s.actions}>
              <TDButton label="Rename" variant="secondary" loading={pending === 'rename'} onPress={() => run('rename', () => renameMobileStorageLocation(selected.id, renameValue || selected.name))} />
              <TDButton label="Archive" variant="ghost" loading={pending === 'archive'} onPress={() => run('archive', () => archiveMobileStorageLocation(selected.id))} />
            </View>

            <TDInput label="Find card" value={cardQuery} onChangeText={setCardQuery} leftIconName="search-outline" placeholder="Search cards to assign or move" />
            {cardResults.length ? <CardList cards={cardResults} label="Assign here" pending={pending} onPress={(card) => run(`assign-${card.id}`, () => assignMobileStorageLocation({ userId: state.userId, inventoryItemId: card.id, fromLocationId: card.storageLocation?.id ?? null, toLocationId: selected.id }))} /> : null}
            {selectedCards.length ? (
              <CardList cards={selectedCards} label="Clear" pending={pending} onPress={(card) => run(`clear-${card.id}`, () => assignMobileStorageLocation({ userId: state.userId, inventoryItemId: card.id, fromLocationId: card.storageLocation?.id ?? null, toLocationId: null }))} />
            ) : (
              <TDEmptyState title="No cards assigned" message="Use Find Card or recent locations to move a card here." />
            )}
            {state.unassignedCards.length ? (
              <View style={s.sectionGap}>
                <TDText variant="label" tone="muted">Unassigned cards</TDText>
                <CardList cards={state.unassignedCards.slice(0, 5)} label="Assign here" pending={pending} onPress={(card) => run(`assign-${card.id}`, () => assignMobileStorageLocation({ userId: state.userId, inventoryItemId: card.id, fromLocationId: null, toLocationId: selected.id }))} />
              </View>
            ) : null}
          </TDCard>
        ) : null}

        {state.archivedLocations.length ? (
          <TDCard variant="outlined" style={s.sectionGap}>
            <TDText variant="title">Archived locations</TDText>
            {state.archivedLocations.map((location) => (
              <TDListRow
                key={location.id}
                title={location.name}
                description={location.path.label}
                iconName="archive-outline"
                right={<TDBadge tone="neutral">Archived</TDBadge>}
              />
            ))}
          </TDCard>
        ) : null}

        <TDCard variant="outlined" style={s.sectionGap}>
          <View style={s.locationTitleRow}>
            <Ionicons name="scan-outline" size={20} color={color.primaryBright} />
            <TDText variant="title">Scan-to-location</TDText>
          </View>
          <TDText variant="small" tone="muted">Integration point only. Scanner recognition is intentionally not enabled in this sprint.</TDText>
        </TDCard>
      </ScrollView>
    </TDScreen>
  );
}

function isLocationActionResult(value: unknown): value is { ok: boolean; error?: string; queued?: boolean; warning?: string } {
  return value !== null && typeof value === 'object' && 'ok' in value;
}

function QuickLocations({ title, locations, onSelect }: { title: string; locations: LocationSummary[]; onSelect: (id: string) => void }) {
  if (!locations.length) return null;
  return (
    <View style={s.sectionGap}>
      <TDText variant="label" tone="muted">{title}</TDText>
      <View style={s.typeRow}>
        {locations.map((location) => (
          <TDChip key={location.id} label={location.name} selected={false} iconName={location.favorite ? 'star' : undefined} onPress={() => onSelect(location.id)} />
        ))}
      </View>
    </View>
  );
}

function CardList({ cards, label, pending, onPress }: { cards: CollectionCard[]; label: string; pending: string | null; onPress: (card: CollectionCard) => void }) {
  return (
    <View style={s.cardList}>
      {cards.map((card) => (
        <TDListRow
          key={card.id}
          title={card.cardName}
          description={`${card.printing.setCode ?? 'Set unavailable'} #${card.printing.collectorNumber ?? '?'} - x${card.quantityOwned}`}
          iconName="albums-outline"
          right={<TDButton label={label} size="sm" variant="secondary" loading={pending === `assign-${card.id}` || pending === `clear-${card.id}`} onPress={() => onPress(card)} />}
        />
      ))}
    </View>
  );
}

function labelForType(type: StorageLocationType) {
  const labels: Record<StorageLocationType, string> = {
    area: 'Area',
    shelf: 'Shelf',
    container: 'Container',
    section: 'Section',
    slot: 'Slot',
    binder: 'Binder',
    box: 'Box',
    sealed: 'Sealed',
    bulk: 'Bulk',
    custom: 'Custom',
    unknown: 'Unknown',
  };
  return labels[type];
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md },
  back: { alignSelf: 'flex-start' },
  createCard: { gap: space.md },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  locationList: { gap: space.sm },
  locationTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  detailCard: { gap: space.md },
  metrics: { flexDirection: 'row', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  cardList: { gap: space.sm },
  flex: { flex: 1 },
  sectionGap: { gap: space.sm },
  errorCard: { gap: space.xs },
});
