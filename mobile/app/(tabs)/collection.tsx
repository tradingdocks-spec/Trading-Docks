import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDEmptyState,
  TDErrorState,
  TDInput,
  TDLoadingState,
  TDScreen,
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
  shouldAcceptCollectionResponse,
  type CollectionCard,
  type CollectionSort,
} from '@/services/collector-workspace';

type DisplayMode = 'grid' | 'list';

const SORT_OPTIONS: { value: CollectionSort; label: string }[] = [
  { value: 'recently_updated', label: 'Recent' },
  { value: 'name_asc', label: 'Name' },
  { value: 'quantity_desc', label: 'Qty' },
  { value: 'set_asc', label: 'Set' },
  { value: 'price_desc', label: 'Price' },
];

export default function Collection() {
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
  const state = resolveCollectionViewState({
    loading,
    loadingMore,
    error,
    totalCount: cards.length,
    visibleCount: visibleCards.length,
    hasMore,
  });

  return (
    <TDScreen style={s.screen}>
      <FlatList
        key={displayMode}
        data={state === 'ready' ? visibleCards : []}
        keyExtractor={(item) => item.id}
        numColumns={displayMode === 'grid' ? 2 : 1}
        columnWrapperStyle={displayMode === 'grid' ? s.gridRow : undefined}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={s.headerStack}>
            <View style={s.titleRow}>
              <View style={s.titleCopy}>
                <TDText variant="label" tone="info">Collection</TDText>
                <TDText variant="display">Your cards</TDText>
                <TDText variant="small" tone="muted">
                  Exact printings, copies, storage, trade state, and wishlist state.
                </TDText>
              </View>
              {staleReason ? <TDBadge tone="warning">Offline or stale</TDBadge> : null}
            </View>

            <View style={s.summaryGrid}>
              <SummaryCard label="Owned" value={summary.totalOwnedCards.toLocaleString()} />
              <SummaryCard label="Unique" value={summary.uniquePrintings.toLocaleString()} />
              <SummaryCard label="Storage" value={summary.storageLocationCount.toLocaleString()} />
              <SummaryCard label="Missing prices" value={summary.missingPriceCount.toLocaleString()} />
            </View>

            {summary.freeCardLimit ? (
              <TDCard variant={summary.freeCardLimitExceeded ? 'outlined' : 'default'} style={s.limitCard}>
                <View style={s.limitIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color={summary.freeCardLimitExceeded ? color.danger : color.info} />
                </View>
                <View style={s.flex}>
                  <TDText variant="small">
                    Free plan card limit: {summary.totalOwnedCards}/{summary.freeCardLimit}
                  </TDText>
                  <TDText variant="caption" tone={summary.freeCardLimitExceeded ? 'danger' : 'muted'}>
                    {summary.freeCardLimitExceeded
                      ? 'Card limit exceeded. Upgrade before adding more cards.'
                      : `${summary.freeCardLimitRemaining} card slots remaining.`}
                  </TDText>
                </View>
              </TDCard>
            ) : null}

            {staleReason ? (
              <TDCard variant="outlined" style={s.staleCard}>
                <TDBadge tone="warning">Stale data</TDBadge>
                <TDText variant="caption" tone="muted">{staleReason}</TDText>
              </TDCard>
            ) : null}

            <TDInput
              label="Search collection"
              accessibilityLabel="Search collection by card name, set, collector number, or storage location"
              leftIconName="search-outline"
              placeholder="Search cards, sets, collector numbers, storage..."
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />

            <View style={s.controls}>
              <View style={s.chipRow} accessibilityLabel="Sort collection">
                {SORT_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={sort === option.value}
                    onPress={() => setSort(option.value)}
                  />
                ))}
              </View>
              <View style={s.modeRow}>
                <IconMode label="List view" iconName="list-outline" selected={displayMode === 'list'} onPress={() => setDisplayMode('list')} />
                <IconMode label="Grid view" iconName="grid-outline" selected={displayMode === 'grid'} onPress={() => setDisplayMode('grid')} />
              </View>
            </View>
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
        contentContainerStyle={s.listContent}
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <TDCard style={s.summaryCard}>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant="title">{value}</TDText>
    </TDCard>
  );
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
      <TDCard variant="elevated" style={[s.cardShell, compact && s.cardShellGrid]}>
        <View style={[s.imageFrame, compact && s.imageFrameGrid]}>
          {card.printing.imageUrl ? (
            <Image
              source={{ uri: card.printing.imageUrl }}
              style={s.cardImage}
              contentFit="cover"
              transition={150}
              placeholder={{ blurhash: 'L14ep^_3M{M{_3?b%Mof00xu%MRj' }}
              accessibilityLabel={`${card.cardName} card image`}
            />
          ) : (
            <View style={s.imagePlaceholder}>
              <Ionicons name="image-outline" size={22} color={color.textMuted} />
              <TDText variant="caption" tone="muted" style={s.centerText}>Image unavailable</TDText>
            </View>
          )}
        </View>
        <View style={s.cardBody}>
          <View style={s.cardTitleRow}>
            <TDText variant="title" style={s.cardTitle}>{card.cardName}</TDText>
            <TDBadge tone="info">x{card.quantityOwned}</TDBadge>
          </View>
          <TDText variant="caption" tone="muted">{displayPrinting(card.printing)}</TDText>
          <TDText variant="caption" tone="secondary">{displayCondition(card.condition)} - {displayFinish(card.printing.finish)}</TDText>
          <TDText variant="caption" tone="muted">{displayStorageLocation(card)}</TDText>
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
      </TDCard>
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
    return <TDLoadingState title="Loading collection" message="Fetching the latest saved card records." />;
  }
  if (state === 'error') {
    return (
      <TDErrorState
        title="Collection unavailable"
        message={error ?? 'Collection data could not be loaded.'}
        action={<TDButton label="Retry" variant="secondary" onPress={onRetry} />}
      />
    );
  }
  if (state === 'empty') {
    return (
      <TDEmptyState
        title="No cards in your collection yet"
        message="Saved inventory cards will appear here after they are added through supported collection tools."
      />
    );
  }
  if (state === 'no_results') {
    return (
      <TDEmptyState
        title="No matching cards"
        message={`No collection records match "${query}".`}
      />
    );
  }
  return null;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${label} sort`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.chip, selected && s.chipSelected]}
    >
      <TDText variant="caption" tone={selected ? 'primary' : 'muted'}>{label}</TDText>
    </Pressable>
  );
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
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.modeButton, selected && s.modeButtonSelected]}
    >
      <Ionicons name={iconName} size={18} color={selected ? color.text : color.textMuted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { paddingTop: 56, paddingBottom: 0 },
  listContent: { gap: space.md, paddingBottom: 130 },
  headerStack: { gap: space.md, marginBottom: space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  titleCopy: { flex: 1, gap: space.xs },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  summaryCard: { flexGrow: 1, flexBasis: '45%', padding: space.md, borderRadius: radius.md },
  limitCard: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  staleCard: { gap: space.xs, padding: space.md },
  limitIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.info + '12' },
  flex: { flex: 1 },
  controls: { gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { minHeight: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '35' },
  modeRow: { flexDirection: 'row', gap: space.xs },
  modeButton: { width: 46, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  modeButtonSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '35' },
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
