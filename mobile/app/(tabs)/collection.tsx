import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DockCardWell,
  DockMetric,
  DockRail,
  DockSurface,
  DockTray,
  LocationBreadcrumb,
  TDBadge,
  TDButton,
  TDEmptyState,
  TDErrorState,
  TDIconButton,
  TDInput,
  TDLoadingState,
  TDNavigationHeader,
  TDScreen,
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
  collectionRequestKey,
  mergeCollectionPages,
  priceLabel,
  resolveCollectionViewState,
  summarizeCollectionCards,
  shouldRenderCollectionItems,
  shouldAcceptCollectionResponse,
  type CollectionCard,
  type CollectionSort,
} from '@/services/collector-workspace';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';
import { humanizeReleaseError, releaseEmptyState, releaseLoadingState } from '@/services/mobile-release-ux';
import { buildMobileCollectionIntelligence } from '@/services/mobile-collection-intelligence';

type DisplayMode = 'grid' | 'list';

const SORT_OPTIONS: { value: CollectionSort; label: string }[] = [
  { value: 'recently_updated', label: 'Recent' },
  { value: 'name_asc', label: 'Name' },
  { value: 'quantity_desc', label: 'Qty' },
  { value: 'set_asc', label: 'Set' },
  { value: 'price_desc', label: 'Price' },
];

export default function Collection() {
  const insets = useSafeAreaInsets();
  const { accountType } = useAccount();
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState<CollectionSort>('recently_updated');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('list');
  const activeRequestKey = useRef('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const loadPage = useCallback((cursor: string | null, reset: boolean) => {
    const filter = { query: debouncedQuery };
    const requestKey = collectionRequestKey({ filter, sort });
    activeRequestKey.current = requestKey;
    if (reset) {
      setLoading(true);
      setCards([]);
      setNextCursor(null);
      setHasMore(false);
    } else {
      if (!cursor) return;
      setLoadingMore(true);
    }
    setError(null);
    void loadCollectorCollectionPage({ filter, sort, cursor })
      .then((result) => {
        if (!shouldAcceptCollectionResponse(activeRequestKey.current, result.pageInfo.requestKey)) return;
        setCards((current) => mergeCollectionPages(current, result.cards, reset));
        setNextCursor(result.pageInfo.nextCursor);
        setHasMore(result.pageInfo.hasMore);
        setStaleReason(result.stale ? result.unavailableReason ?? 'Showing cached collection data.' : null);
      })
      .catch((loadError) => {
        if (!shouldAcceptCollectionResponse(activeRequestKey.current, requestKey)) return;
        if (reset) setCards([]);
        setError(loadError instanceof Error ? loadError.message : 'Collection data is unavailable.');
      })
      .finally(() => {
        if (!shouldAcceptCollectionResponse(activeRequestKey.current, requestKey)) return;
        if (reset) setLoading(false);
        else setLoadingMore(false);
      });
  }, [debouncedQuery, sort]);

  useEffect(() => {
    const timer = setTimeout(() => loadPage(null, true), 0);
    return () => clearTimeout(timer);
  }, [loadPage]);

  const retry = useCallback(() => {
    loadPage(null, true);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore && nextCursor) loadPage(nextCursor, false);
  }, [hasMore, loadPage, loading, loadingMore, nextCursor]);

  useEffect(() => {
    return () => {
      activeRequestKey.current = '';
    };
  }, []);

  const visibleCards = cards;
  const summary = useMemo(() => summarizeCollectionCards(cards, accountType), [accountType, cards]);
  const intelligence = useMemo(() => buildMobileCollectionIntelligence(cards), [cards]);
  const state = resolveCollectionViewState({
    loading,
    loadingMore,
    error,
    totalCount: cards.length,
    visibleCount: visibleCards.length,
    hasMore,
  });

  return (
    <TDScreen style={[s.screen, { paddingTop: Math.max(insets.top + 20, 48) }]}>
      <FlatList
        key={displayMode}
        data={shouldRenderCollectionItems(state, visibleCards.length) ? visibleCards : []}
        keyExtractor={(item) => item.id}
        numColumns={displayMode === 'grid' ? 2 : 1}
        columnWrapperStyle={displayMode === 'grid' ? s.gridRow : undefined}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={s.headerStack}>
            <TDNavigationHeader
              eyebrow="Collection"
              title="Your cards"
              subtitle="Search exact printings, condition, finish, quantity, and storage."
              rightAction={staleReason ? <TDBadge tone="warning">Stale</TDBadge> : undefined}
            />

            <DockSurface style={s.controlDock}>
              <View style={s.searchControls}>
                <TDInput
                  accessibilityLabel="Search collection by card name, set, collector number, or storage location"
                  containerStyle={s.searchInput}
                  leftIconName="search-outline"
                  placeholder="Name, set, number, storage..."
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                />
                <View style={s.modeRow}>
                  <IconMode label="List view" iconName="list-outline" selected={displayMode === 'list'} onPress={() => setDisplayMode('list')} />
                  <IconMode label="Grid view" iconName="grid-outline" selected={displayMode === 'grid'} onPress={() => setDisplayMode('grid')} />
                </View>
              </View>

              <DockRail compact style={s.filterRail} accessibilityLabel="Collection sort and shortcuts">
                {SORT_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Sort by ${option.label}`}
                    accessibilityState={{ selected: sort === option.value }}
                    onPress={() => setSort(option.value)}
                    style={({ pressed }) => [s.sortChip, sort === option.value && s.sortChipSelected, pressed && s.pressed]}
                  >
                    <TDText variant="caption" tone={sort === option.value ? 'primary' : 'muted'} numberOfLines={1}>{option.label}</TDText>
                  </Pressable>
                ))}
              </DockRail>
            </DockSurface>

            <View style={s.summaryStrip}>
              <DockMetric label="Owned" value={summary.totalOwnedCards.toLocaleString()} tone="active" />
              <DockMetric label="Unique" value={summary.uniquePrintings.toLocaleString()} />
              <DockMetric label="Storage" value={summary.storageLocationCount.toLocaleString()} />
            </View>

            {cards.length ? (
              <DockTray style={s.healthStrip}>
                <View style={s.healthMetric}>
                  <TDText variant="caption" tone="muted">Missing prices</TDText>
                  <TDText variant="small" tone={intelligence.missingPriceCount ? 'warning' : 'success'}>{intelligence.missingPriceCount}</TDText>
                </View>
                <View style={s.healthMetric}>
                  <TDText variant="caption" tone="muted">Duplicates</TDText>
                  <TDText variant="small">{intelligence.duplicateCount}</TDText>
                </View>
                <View style={s.healthMetric}>
                  <TDText variant="caption" tone="muted">Storage gaps</TDText>
                  <TDText variant="small" tone={intelligence.storageGapCount ? 'warning' : 'success'}>{intelligence.storageGapCount}</TDText>
                </View>
              </DockTray>
            ) : null}

            {summary.freeCardLimit ? (
              <View style={s.limitMeter} accessibilityLabel={`Free plan card limit ${summary.totalOwnedCards} of ${summary.freeCardLimit}`}>
                <View style={s.flex}>
                  <View style={s.limitTrack}>
                    <View style={[s.limitFill, { width: `${Math.min(100, Math.round((summary.totalOwnedCards / summary.freeCardLimit) * 100))}%` }, summary.freeCardLimitExceeded && s.limitFillExceeded]} />
                  </View>
                  <TDText variant="caption" tone={summary.freeCardLimitExceeded ? 'danger' : 'muted'}>
                    Free plan: {summary.totalOwnedCards}/{summary.freeCardLimit} cards · {summary.freeCardLimitExceeded ? 'Limit exceeded' : `${summary.freeCardLimitRemaining} remaining`}
                  </TDText>
                </View>
              </View>
            ) : null}

            {staleReason ? (
              <DockTray style={s.staleCard}>
                <TDStatusIndicator tone="warning" label="Showing cached collection data" />
                <TDText variant="caption" tone="muted">{staleReason}</TDText>
              </DockTray>
            ) : null}

            <DockRail compact style={s.secondaryActions}>
              <TDButton
                label="Storage"
                variant="secondary"
                size="sm"
                iconName="file-tray-stacked-outline"
                accessibilityLabel="Open Storage Location Manager"
                onPress={() => router.push('/storage-locations' as never)}
              />
              <TDButton
                label="Trade"
                variant="ghost"
                size="sm"
                iconName="swap-horizontal-outline"
                accessibilityLabel="Open Trade Binder"
                onPress={() => router.push('/trade-binder' as never)}
              />
              <TDButton
                label="Wishlist"
                variant="ghost"
                size="sm"
                iconName="star-outline"
                accessibilityLabel="Open Wishlist"
                onPress={() => router.push('/wishlist' as never)}
              />
            </DockRail>
          </View>
        }
        ListEmptyComponent={
          <CollectionState
            state={state}
            error={error}
            query={debouncedQuery}
            onRetry={retry}
          />
        }
        ListFooterComponent={
          state === 'ready' || state === 'loading_more' || state === 'end' ? (
            <CollectionFooter loadingMore={loadingMore} hasMore={hasMore} error={error} onLoadMore={loadMore} />
          ) : null
        }
        renderItem={({ item }) => (
          <CollectionCardRow
            card={item}
            compact={displayMode === 'grid'}
            onPress={() => router.push({ pathname: '/collection/[cardId]', params: { cardId: item.id } })}
          />
        )}
        contentContainerStyle={[s.listContent, { paddingBottom: getMobileScrollBottomInset(insets.bottom) }]}
        onEndReached={loadMore}
        onEndReachedThreshold={0.45}
        showsVerticalScrollIndicator={false}
      />
    </TDScreen>
  );
}

function CollectionFooter({
  loadingMore,
  hasMore,
  error,
  onLoadMore,
}: {
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onLoadMore: () => void;
}) {
  if (loadingMore) return <TDLoadingState title="Loading more cards" message="Fetching the next page." />;
  if (error) return <TDButton label="Retry page" variant="secondary" onPress={onLoadMore} />;
  if (!hasMore) return <TDText variant="caption" tone="muted" style={s.endText}>End of collection results</TDText>;
  return <TDButton label="Load more" variant="secondary" onPress={onLoadMore} />;
}

function CollectionCardRow({
  card,
  compact,
  onPress,
}: {
  card: CollectionCard;
  compact: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${card.cardName} details`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [compact ? s.cardGridItem : s.cardListItem, pressed && s.pressed]}
    >
      <DockSurface level="raised" style={[s.cardShell, compact && s.cardShellGrid]}>
        <DockCardWell style={[s.imageFrame, compact && s.imageFrameGrid]}>
          {card.printing.imageUrl ? (
            <Image
              source={{ uri: card.printing.imageUrl }}
              style={s.cardImage}
              contentFit="cover"
              transition={150}
              placeholder={{ blurhash: 'L14ep^_3M{M{_3?b%Mof00xu%MRj' }}
              alt={`${card.cardName} card image`}
              accessibilityLabel={`${card.cardName} card image`}
            />
          ) : (
            <View style={s.imagePlaceholder}>
              <Ionicons name="image-outline" size={22} color={color.textMuted} />
              <TDText variant="caption" tone="muted" style={s.centerText}>Image unavailable</TDText>
            </View>
          )}
        </DockCardWell>
        <View style={s.cardBody}>
          <View style={s.cardTitleRow}>
            <TDText variant="title" style={s.cardTitle}>{card.cardName}</TDText>
            <TDBadge tone="info">x{card.quantityOwned}</TDBadge>
          </View>
          <TDText variant="caption" tone="muted">{displayPrinting(card.printing)}</TDText>
          <TDText variant="caption" tone="secondary">{displayCondition(card.condition)} - {displayFinish(card.printing.finish)}</TDText>
          <LocationBreadcrumb compact path={displayStorageLocation(card)} />
          <View style={s.indicators}>
            <TDBadge tone={card.tradeBinderStatus === 'not_for_trade' ? 'neutral' : 'success'}>
              {card.tradeBinderStatus === 'not_for_trade' ? 'Not for trade' : 'Trade binder'}
            </TDBadge>
            <TDBadge tone={card.wishlistStatus === 'wanted' ? 'accent' : 'neutral'}>
              {card.wishlistStatus === 'wanted' ? 'Wishlist' : 'Not wishlisted'}
            </TDBadge>
          </View>
          <TDText variant="small" tone={card.marketPrice.amount === null ? 'muted' : 'primary'}>
            {priceLabel(card)}
          </TDText>
        </View>
      </DockSurface>
    </Pressable>
  );
}

function CollectionState({
  state,
  error,
  query,
  onRetry,
}: {
  state: string;
  error: string | null;
  query: string;
  onRetry: () => void;
}) {
  if (state === 'loading') {
    const copy = releaseLoadingState('collection');
    return <TDLoadingState title={copy.title} message={copy.message} />;
  }
  if (state === 'error') {
    const copy = humanizeReleaseError(error, 'query_failed');
    return (
      <TDErrorState
        title={copy.title}
        message={copy.message}
        action={<TDButton label={copy.actionLabel ?? 'Retry'} variant="secondary" onPress={onRetry} />}
      />
    );
  }
  if (state === 'empty') {
    const copy = releaseEmptyState('collection');
    return (
      <TDEmptyState
        title={copy.title}
        message={copy.message}
        action={<TDButton label={copy.actionLabel ?? 'Scan a card'} onPress={() => router.push('/scan' as never)} />}
      />
    );
  }
  if (state === 'no_results') {
    const copy = releaseEmptyState('search_results');
    return (
      <TDEmptyState
        title={copy.title}
        message={query ? `No cards match "${query}". Try a different name, set, number, or location.` : copy.message}
      />
    );
  }
  return null;
}

function IconMode({
  label,
  iconName,
  selected,
  onPress,
}: {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TDIconButton label={label} iconName={iconName} selected={selected} onPress={onPress} />
  );
}

const s = StyleSheet.create({
  screen: { paddingBottom: 0 },
  listContent: { gap: space.md },
  headerStack: { gap: space.sm, marginBottom: space.xs },
  controlDock: { gap: space.sm, padding: space.sm },
  searchControls: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  searchInput: { flex: 1 },
  filterRail: { gap: space.xs },
  sortChip: { minHeight: 34, flex: 1, minWidth: 0, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  sortChipSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '24' },
  summaryStrip: { flexDirection: 'row', gap: space.xs },
  healthStrip: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: space.xs, padding: space.xs },
  healthMetric: { flex: 1, minWidth: 0, borderRadius: radius.sm, backgroundColor: color.canvas + '88', paddingHorizontal: space.xs, paddingVertical: 6 },
  limitMeter: { gap: 5, paddingHorizontal: space.xs, paddingVertical: 2 },
  staleCard: { gap: space.xs, padding: space.md },
  limitTrack: { height: 5, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: color.canvasRaised },
  limitFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.primaryBright },
  limitFillExceeded: { backgroundColor: color.danger },
  flex: { flex: 1 },
  secondaryActions: { flexWrap: 'wrap', gap: space.xs, marginTop: -space.xs },
  modeRow: { flexDirection: 'row', gap: space.xs },
  gridRow: { gap: space.sm },
  cardListItem: { width: '100%' },
  cardGridItem: { flex: 1, maxWidth: '50%' },
  pressed: { opacity: 0.82 },
  cardShell: { flexDirection: 'row', gap: space.md, padding: space.md, minHeight: 148 },
  cardShellGrid: { flexDirection: 'column', minHeight: 280 },
  imageFrame: { width: 78, height: 108, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised },
  imageFrameGrid: { width: '100%', aspectRatio: 0.72, height: undefined },
  cardImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.xs },
  centerText: { textAlign: 'center' },
  endText: { textAlign: 'center', paddingVertical: space.lg },
  cardBody: { flex: 1, minWidth: 0, gap: 5 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.xs },
  cardTitle: { flex: 1 },
  indicators: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
});
