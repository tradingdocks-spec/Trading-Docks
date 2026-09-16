import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CollectibleCard,
  DockMetric,
  DockSurface,
  DockTray,
  TDBadge,
  TDButton,
  TDEmptyState,
  TDInput,
  TDNavigationHeader,
  TDSegmentedControl,
  TDSheet,
  TDStatusIndicator,
  TDText,
} from '@/components/design-system';
import { color, radius, space } from '@/design';
import { useAccount } from '@/providers/account';
import { loadCollectorCollectionPage } from '@/services/collector-data';
import {
  displayCondition,
  displayFinish,
  displayPrinting,
  displayStorageLocation,
  priceLabel,
  summarizeCollectionCards,
  type CollectionCard,
  type CollectionSummary,
} from '@/services/collector-workspace';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';

type SearchScope = 'cards' | 'sets';
type ProductTypeFilter = 'all' | 'card' | 'sealed';
type TradeFilter = 'all' | 'tradeable';

type SearchSetGroup = {
  key: string;
  sampleCardId: string;
  setCode: string;
  setName: string;
  count: number;
  value: number | null;
  imageUrl: string | null;
  latestCardName: string;
};

type SearchListItem =
  | { kind: 'card'; id: string; card: CollectionCard }
  | { kind: 'set'; id: string; group: SearchSetGroup };

export default function Search() {
  const insets = useSafeAreaInsets();
  const { accountType } = useAccount();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('cards');
  const [gameId, setGameId] = useState<string | 'all'>('all');
  const [productType, setProductType] = useState<ProductTypeFilter>('all');
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeRequestKey = useRef('');
  const cardsRef = useRef<CollectionCard[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 220);
    return () => clearTimeout(timer);
  }, [query]);

  const gameOptions = useMemo(() => {
    const options = summary?.games?.map((game) => ({ value: game.gameId, label: game.label })) ?? [];
    return [{ value: 'all', label: 'All games' }, ...options];
  }, [summary]);

  const loadPage = useCallback((cursor: string | null, reset: boolean) => {
    const filter = {
      query: debouncedQuery,
      gameId,
      productType,
      tradeBinderStatus: tradeFilter,
    } as const;
    const requestKey = JSON.stringify({ filter, cursor });
    activeRequestKey.current = requestKey;
    if (reset) {
      setLoading(true);
      setCards([]);
      setSummary(null);
      setNextCursor(null);
      setHasMore(false);
    } else if (!cursor) {
      return;
    } else {
      setLoadingMore(true);
    }
    setError(null);
    void loadCollectorCollectionPage({ filter, sort: 'recently_updated', cursor, limit: 72 })
      .then((result) => {
        if (activeRequestKey.current !== requestKey) return;
        const merged = reset ? result.cards : [...cardsRef.current, ...result.cards];
        cardsRef.current = merged;
        setCards(merged);
        setSummary(summarizeCollectionCards(merged, accountType, { ignoreFreeLimit: true }));
        setNextCursor(result.pageInfo.nextCursor);
        setHasMore(result.pageInfo.hasMore);
        setStaleReason(result.stale ? result.unavailableReason ?? 'Showing cached search results.' : null);
      })
      .catch((loadError) => {
        if (activeRequestKey.current !== requestKey) return;
        if (reset) {
          cardsRef.current = [];
          setCards([]);
        }
        setError(loadError instanceof Error ? loadError.message : 'Search is unavailable.');
      })
      .finally(() => {
        if (activeRequestKey.current !== requestKey) return;
        if (reset) setLoading(false);
        else setLoadingMore(false);
      });
  }, [accountType, debouncedQuery, gameId, productType, tradeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => loadPage(null, true), 0);
    return () => clearTimeout(timer);
  }, [loadPage]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const loadMore = () => {
    if (!loading && !loadingMore && hasMore && nextCursor) {
      loadPage(nextCursor, false);
    }
  };

  const visibleCards = useMemo(() => cards, [cards]);
  const setGroups = useMemo(() => groupSearchSets(cards), [cards]);
  const visibleSetGroups = useMemo(() => {
    if (!debouncedQuery.trim()) return setGroups;
    const normalized = debouncedQuery.trim().toLowerCase();
    return setGroups.filter((group) =>
      group.setName.toLowerCase().includes(normalized) ||
      group.setCode.toLowerCase().includes(normalized) ||
      group.latestCardName.toLowerCase().includes(normalized),
    );
  }, [debouncedQuery, setGroups]);
  const matchesCount = scope === 'cards' ? visibleCards.length : visibleSetGroups.length;
  const searchSummary = summary ?? summarizeCollectionCards(cards, accountType, { ignoreFreeLimit: true });
  const listData: SearchListItem[] = scope === 'cards'
    ? visibleCards.map((card) => ({ kind: 'card', id: card.id, card }))
    : visibleSetGroups.map((group) => ({ kind: 'set', id: group.key, group }));

  return (
    <View style={s.screen}>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => item.kind === 'card'
          ? <SearchCardRow card={item.card} />
          : <SearchSetRow group={item.group} />}
        contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 14, 34), paddingBottom: getMobileScrollBottomInset(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={s.headerStack}>
            <TDNavigationHeader
              eyebrow="Search"
              title="Find exact cards"
              subtitle="Search cards, sets, collector numbers, and storage from the same inventory model."
              rightAction={<TDBadge tone={staleReason ? 'warning' : 'info'}>{scope === 'cards' ? `${matchesCount} matches` : `${matchesCount} sets`}</TDBadge>}
            />

            <DockSurface material="raisedControl" level="raised" style={s.searchDock}>
              <TDInput
                accessibilityLabel="Search cards by name, set, collector number, or storage"
                leftIconName="search-outline"
                placeholder="Name, set, collector number, storage..."
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
              />
              <TDSegmentedControl
                label="Search"
                options={[
                  { value: 'cards', label: 'Cards', iconName: 'albums-outline' },
                  { value: 'sets', label: 'Sets', iconName: 'layers-outline' },
                ]}
                value={scope}
                onChange={(value) => setScope(value)}
              />
              <View style={s.summaryRow}>
                <DockMetric label="Matches" value={String(matchesCount)} tone="active" />
                <DockMetric label="Cards" value={String(searchSummary.totalOwnedCards)} />
                <DockMetric label="Value" value={searchSummary.knownMarketValue === null ? '—' : formatUsd(searchSummary.knownMarketValue)} tone={searchSummary.knownMarketValue === null ? 'neutral' : 'success'} />
              </View>
              <View style={s.actionRow}>
                <TDButton label="Filters" variant="secondary" size="sm" iconName="options-outline" onPress={() => setFiltersOpen(true)} />
                {staleReason ? <TDStatusIndicator tone="warning" label="Cached search data" /> : null}
              </View>
            </DockSurface>

            {scope === 'cards' && cards.length ? (
              <DockTray style={s.metaStrip}>
                <View style={s.metaMetric}>
                  <TDText variant="caption" tone="muted">Owned</TDText>
                  <TDText variant="small">{searchSummary.totalOwnedCards.toLocaleString()}</TDText>
                </View>
                <View style={s.metaMetric}>
                  <TDText variant="caption" tone="muted">Printings</TDText>
                  <TDText variant="small">{searchSummary.uniquePrintings.toLocaleString()}</TDText>
                </View>
                <View style={s.metaMetric}>
                  <TDText variant="caption" tone="muted">Storage</TDText>
                  <TDText variant="small">{searchSummary.storageLocationCount.toLocaleString()}</TDText>
                </View>
              </DockTray>
            ) : null}

            {gameOptions.length > 1 ? (
              <DockTray style={s.filterRail}>
                <TDText variant="caption" tone="muted">Game</TDText>
                <View style={s.filterChips}>
                  {gameOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by ${option.label}`}
                      accessibilityState={{ selected: gameId === option.value }}
                      onPress={() => setGameId(option.value)}
                      style={({ pressed }) => [s.filterChip, gameId === option.value && s.filterChipSelected, pressed && s.pressed]}
                    >
                      <TDText variant="caption" tone={gameId === option.value ? 'primary' : 'muted'}>{option.label}</TDText>
                    </Pressable>
                  ))}
                </View>
              </DockTray>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? <SearchSkeleton /> : <SearchEmpty error={error} query={debouncedQuery} onOpenCollection={() => router.push('/(tabs)/collection' as never)} />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={s.footerLoading}>
              <TDText variant="caption" tone="muted">Loading more results...</TDText>
            </View>
          ) : hasMore ? (
            <TDButton label="Load more" variant="secondary" onPress={loadMore} />
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
      />

      {filtersOpen ? (
        <TDSheet title="Search filters" onClose={() => setFiltersOpen(false)} style={s.sheet}>
          <TDSegmentedControl
            label="Product"
            options={[
              { value: 'all', label: 'All', iconName: 'apps-outline' },
              { value: 'card', label: 'Cards', iconName: 'albums-outline' },
              { value: 'sealed', label: 'Sealed', iconName: 'cube-outline' },
            ]}
            value={productType}
            onChange={(value) => setProductType(value)}
          />
          <TDSegmentedControl
            label="Trade"
            options={[
              { value: 'all', label: 'All', iconName: 'swap-horizontal-outline' },
              { value: 'tradeable', label: 'Tradeable', iconName: 'briefcase-outline' },
            ]}
            value={tradeFilter}
            onChange={(value) => setTradeFilter(value)}
          />
          <View style={s.sheetActions}>
            <TDButton label="Clear filters" variant="secondary" size="sm" onPress={() => {
              setGameId('all');
              setProductType('all');
              setTradeFilter('all');
            }} />
            <TDButton label="Done" size="sm" onPress={() => setFiltersOpen(false)} />
          </View>
        </TDSheet>
      ) : null}
    </View>
  );
}

function SearchCardRow({ card }: { card: CollectionCard }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${card.cardName}`}
      onPress={() => router.push({ pathname: '/collection/[cardId]', params: { cardId: card.id } })}
      style={({ pressed }) => [s.cardPressable, pressed && s.pressed]}
    >
      <CollectibleCard
        title={card.cardName}
      subtitle={`${displayPrinting(card.printing)} · ${displayCondition(card.condition)} · ${displayFinish(card.printing.finish)}`}
        metadata={displayStorageLocation(card)}
        imageUrl={card.printing.imageUrl ?? null}
        quantityLabel={`x${card.quantityOwned}`}
        style={s.card}
      >
        <TDText variant="caption" tone={card.marketPrice.amount === null ? 'muted' : 'primary'}>{priceLabel(card)}</TDText>
      </CollectibleCard>
    </Pressable>
  );
}

function SearchSetRow({ group }: { group: SearchSetGroup }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open set ${group.setName}`}
      onPress={() => router.push({ pathname: '/collection/[cardId]', params: { cardId: group.sampleCardId } })}
      style={({ pressed }) => [s.setPressable, pressed && s.pressed]}
    >
      <DockSurface level="raised" style={s.setCard}>
        <View style={s.setCover}>
          {group.imageUrl ? (
            <Image source={{ uri: group.imageUrl }} style={s.setImage} contentFit="cover" />
          ) : (
            <Ionicons name="layers-outline" size={22} color={color.textMuted} />
          )}
        </View>
        <View style={s.setCopy}>
          <View style={s.setTitleRow}>
            <View style={s.flex}>
              <TDText variant="title" numberOfLines={1}>{group.setName}</TDText>
              <TDText variant="caption" tone="muted" numberOfLines={1}>{group.setCode.toUpperCase()} · {group.count} cards</TDText>
            </View>
            <TDBadge tone="info">Sets</TDBadge>
          </View>
          <TDText variant="caption" tone="muted" numberOfLines={1}>{group.latestCardName}</TDText>
          <TDText variant="caption" tone={group.value === null ? 'muted' : 'primary'} numberOfLines={1}>
            {group.value === null ? 'Value unavailable' : `Market ${formatUsd(group.value)}`}
          </TDText>
        </View>
      </DockSurface>
    </Pressable>
  );
}

function SearchEmpty({
  error,
  query,
  onOpenCollection,
}: {
  error: string | null;
  query: string;
  onOpenCollection: () => void;
}) {
  if (error) {
    return (
      <TDEmptyState
        title="Search unavailable"
        message={error}
        action={<TDButton label="Open Collection" variant="secondary" onPress={onOpenCollection} />}
      />
    );
  }
  return (
    <TDEmptyState
      title={query ? 'No matching cards' : 'Start searching'}
      message={query ? `No cards match "${query}". Try a set code, collector number, or a different name.` : 'Search by name, set, collector number, or storage. Card images will stay front and center.'}
      action={<TDButton label="Open Collection" variant="secondary" onPress={onOpenCollection} />}
    />
  );
}

function SearchSkeleton() {
  return (
    <DockSurface style={s.skeleton}>
      <View style={s.skeletonLine} />
      <View style={[s.skeletonLine, s.skeletonLineShort]} />
      <View style={[s.skeletonLine, { width: '84%' }]} />
    </DockSurface>
  );
}

function groupSearchSets(cards: CollectionCard[]): SearchSetGroup[] {
  const groups = new Map<string, SearchSetGroup>();
  for (const card of cards) {
    const setCode = card.printing.setCode ?? 'SET';
    const setName = card.printing.setName ?? 'Unknown set';
    const key = `${setCode}|${setName}`;
    const quantity = card.quantityOwned;
    const marketValue = card.marketPrice.amount === null ? null : (card.marketPrice.amount * quantity);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        sampleCardId: card.id,
        setCode,
        setName,
        count: quantity,
        value: marketValue,
        imageUrl: card.printing.imageUrl ?? null,
        latestCardName: card.cardName,
      });
      continue;
    }
    existing.count += quantity;
    existing.value = existing.value === null || marketValue === null ? null : existing.value + marketValue;
    if (!existing.imageUrl && card.printing.imageUrl) existing.imageUrl = card.printing.imageUrl;
  }
  return [...groups.values()].sort((a, b) => a.setName.localeCompare(b.setName));
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.md },
  headerStack: { gap: space.sm, paddingHorizontal: space.md },
  searchDock: { gap: space.sm, padding: space.sm },
  summaryRow: { flexDirection: 'row', gap: space.xs },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  metaStrip: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.xs, padding: space.xs },
  metaMetric: { flex: 1, minWidth: 0, borderRadius: radius.sm, backgroundColor: color.canvas + '88', paddingHorizontal: space.xs, paddingVertical: 6 },
  filterRail: { gap: space.xs, padding: space.sm },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  filterChip: { borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised, paddingHorizontal: space.sm, paddingVertical: 6 },
  filterChipSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '20' },
  pressed: { opacity: 0.82, transform: [{ translateY: 1 }] },
  cardPressable: { marginHorizontal: space.md },
  card: { width: '100%' },
  setPressable: { marginHorizontal: space.md },
  setCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  setCover: { width: 72, height: 100, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  setImage: { width: '100%', height: '100%' },
  setCopy: { flex: 1, minWidth: 0, gap: 4 },
  setTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
  skeleton: { marginHorizontal: space.md, gap: space.xs, padding: space.md },
  skeletonLine: { height: 12, borderRadius: radius.pill, backgroundColor: color.surfaceRaised },
  skeletonLineShort: { width: '64%' },
  footerLoading: { alignItems: 'center', paddingVertical: space.md },
  sheet: { gap: space.md },
  sheetActions: { flexDirection: 'row', gap: space.xs, justifyContent: 'flex-end' },
});
