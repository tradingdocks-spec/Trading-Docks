import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TDBadge, TDButton, TDChip, TDEmptyState, TDErrorState, TDIconButton, TDInput, TDListRow, TDLoadingState, TDMetric, TDNavigationHeader, TDSegmentedControl, TDStatusIndicator, TDScreen, TDText } from '@/components/design-system';
import { space } from '@/design';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';
import { loadMobileTradeBinderWishlist, runMobileTradeWishlistMutation } from '@/services/trade-binder-wishlist-data';
import {
  TRADE_STATUS_OPTIONS,
  applyTradeStatusOptimistically,
  filterTradeBinderItems,
  sortTradeBinderItems,
  tradeStatusLabel,
  type TradeBinderItem,
  type TradeBinderWishlistState,
  type TradeStatus,
} from '@/services/trade-binder-wishlist';
import { displayCondition, displayFinish, displayPrinting, displayStorageLocation } from '@/services/collector-workspace';

type ScreenState = TradeBinderWishlistState & { userId: string; stale: boolean; unavailableReason?: string };

export default function TradeBinderScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ScreenState | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'binder' | 'matches' | 'status'>('binder');
  const [status, setStatus] = useState<TradeStatus | 'all'>('all');
  const [sort, setSort] = useState<'recent' | 'name' | 'quantity'>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    void loadMobileTradeBinderWishlist()
      .then((result) => {
        setState(result);
        setError(null);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Trade Binder is unavailable.'))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const visible = useMemo(() => sortTradeBinderItems(filterTradeBinderItems(state?.tradeItems ?? [], { query, status }), sort), [query, sort, state, status]);

  const updateStatus = async (item: TradeBinderItem, nextStatus: TradeStatus) => {
    if (!state) return;
    setPending(item.id);
    const optimistic = applyTradeStatusOptimistically(state.tradeItems, item.id, nextStatus);
    setState({ ...state, tradeItems: optimistic.items });
    const result = await runMobileTradeWishlistMutation({ type: 'trade_status', userId: state.userId, inventoryItemId: item.id, status: nextStatus });
    if (!result.ok) {
      setState({ ...state, tradeItems: optimistic.previous });
      setError(result.error);
    } else if (result.queued) {
      setError(result.warning);
    }
    setPending(null);
  };

  if (loading) {
    return <TDScreen style={s.screen}><TDLoadingState title="Loading Trade Binder" message="Finding cards marked available for trade." /></TDScreen>;
  }
  if (!state) {
    return <TDScreen style={s.screen}><TDErrorState title="Trade Binder unavailable" message={error ?? 'Trade data could not be loaded.'} action={<TDButton label="Retry" variant="secondary" onPress={reload} />} /></TDScreen>;
  }

  return (
    <TDScreen style={s.screen}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[s.content, { paddingBottom: getMobileScrollBottomInset(insets.bottom) }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={s.header}>
            <TDNavigationHeader
              eyebrow="Trade Binder"
              title="Available trades"
              subtitle="Cards marked for shows, sales, upgrades, and local deals."
              leftAction={<TDIconButton label="Back" iconName="chevron-back" onPress={() => router.back()} />}
              rightAction={error ? <TDStatusIndicator label={error.includes('queued') ? 'Pending sync' : 'Update failed'} tone={error.includes('queued') ? 'warning' : 'danger'} /> : undefined}
            />
            <View style={s.summaryRow}>
              <TDMetric label="Cards" value={String(state.tradeSummary.totalBinderItems)} tone="info" compact />
              <TDMetric label="Qty" value={String(state.tradeSummary.totalQuantityAvailable)} compact />
              <TDMetric label="Matches" value={String(state.matches.length)} tone={state.matches.length ? 'success' : 'neutral'} compact />
            </View>
            <TDButton
              label={state.matches.length ? 'Review matches' : 'Add cards from Collection'}
              iconName={state.matches.length ? 'git-compare-outline' : 'layers-outline'}
              onPress={() => state.matches.length ? setView('matches') : router.push('/(tabs)/collection' as never)}
            />
            <TDSegmentedControl
              label="Exchange view"
              options={[
                { value: 'binder', label: 'Binder', iconName: 'albums-outline' },
                { value: 'matches', label: 'Matches', iconName: 'git-compare-outline' },
                { value: 'status', label: 'Status', iconName: 'pulse-outline' },
              ]}
              value={view}
              onChange={setView}
            />
            <TDInput label="Search binder" value={query} onChangeText={setQuery} leftIconName="search-outline" placeholder="Card, set, condition, storage..." />
            <View style={s.chips}>
              <TDChip label="All" selected={status === 'all'} onPress={() => setStatus('all')} />
              {TRADE_STATUS_OPTIONS.filter((option) => option !== 'not_for_trade').map((option) => <TDChip key={option} label={tradeStatusLabel(option)} selected={status === option} onPress={() => setStatus(option)} />)}
            </View>
            <TDSegmentedControl label="Sort" options={sortOptions} value={sort} onChange={setSort} />
            {view === 'matches' ? <MatchSummary matches={state.matches} /> : null}
            {view === 'status' ? <StatusSummary state={state} /> : null}
          </View>
        }
        ListEmptyComponent={state.tradeItems.length ? <TDEmptyState title="No matching binder cards" message="Adjust search or status filters." /> : <TDEmptyState title="No cards available to trade" message="Mark cards from card detail or Collection to build a Trade Binder." />}
        renderItem={({ item }) => (
          <View style={s.itemWrap}>
            <TDListRow
              title={item.card.cardName}
              eyebrow={tradeStatusLabel(item.status)}
              description={`${displayPrinting(item.card.printing)} - ${displayCondition(item.card.condition)} - ${displayFinish(item.card.printing.finish)} - ${displayStorageLocation(item.card)}`}
              iconName="albums-outline"
              right={<TDBadge tone="info">x{item.quantityAvailable}</TDBadge>}
              accessibilityLabel={`${item.card.cardName}, ${tradeStatusLabel(item.status)}, quantity ${item.quantityAvailable}`}
            />
            {item.notes ? <TDText variant="small" tone="muted">{item.notes}</TDText> : null}
            <View style={s.chips}>
              {TRADE_STATUS_OPTIONS.map((option) => (
                <TDChip key={option} label={tradeStatusLabel(option)} selected={item.status === option} disabled={pending === item.id} tone="success" onPress={() => updateStatus(item, option)} />
              ))}
            </View>
          </View>
        )}
      />
    </TDScreen>
  );
}

const sortOptions: { value: 'recent' | 'name' | 'quantity'; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'name', label: 'Name' },
  { value: 'quantity', label: 'Qty' },
];

function MatchSummary({ matches }: { matches: TradeBinderWishlistState['matches'] }) {
  if (!matches.length) return <TDEmptyState title="No binder matches yet" message="Wishlist targets will appear here when binder cards satisfy them." />;
  return (
    <View style={s.summaryPanel}>
      <TDText variant="title">Strongest matches</TDText>
      {matches.slice(0, 3).map((match) => (
        <TDListRow
          key={match.id}
          title={match.binderItem.card.cardName}
          eyebrow={match.matchType === 'exact' ? 'Exact match' : 'Flexible match'}
          description={`Wanted: ${match.wishlistItem.cardName} - available x${match.quantityAvailable}`}
          iconName="git-compare-outline"
          right={<TDBadge tone={match.matchType === 'exact' ? 'success' : 'warning'}>{match.matchType}</TDBadge>}
        />
      ))}
    </View>
  );
}

function StatusSummary({ state }: { state: ScreenState }) {
  const active = state.tradeItems.filter((item) => item.status !== 'not_for_trade').length;
  return (
    <View style={s.summaryPanel}>
      <TDStatusIndicator label={`${active} active trade cards`} tone={active ? 'success' : 'neutral'} />
      <TDText variant="small" tone="muted">All non-not-for-trade statuses remain visible in trade filters.</TDText>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md },
  header: { gap: space.md },
  summaryRow: { flexDirection: 'row', gap: space.sm },
  itemWrap: { gap: space.sm },
  summaryPanel: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
