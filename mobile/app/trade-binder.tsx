import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { TDBadge, TDButton, TDCard, TDEmptyState, TDErrorState, TDInput, TDLoadingState, TDScreen, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
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
  const [state, setState] = useState<ScreenState | null>(null);
  const [query, setQuery] = useState('');
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
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={s.header}>
            <TDButton label="Back" variant="ghost" iconName="chevron-back" onPress={() => router.back()} style={s.back} />
            <TDText variant="label" tone="info">Trade Binder</TDText>
            <TDText variant="display">Available trades</TDText>
            <TDText variant="small" tone="muted">Cards you have marked for trades, shows, sales, or upgrades.</TDText>
            {error ? <TDBadge tone={error.includes('queued') ? 'warning' : 'danger'}>{error.includes('queued') ? 'Pending sync' : 'Update failed'}</TDBadge> : null}
            <View style={s.summaryRow}>
              <Metric label="Items" value={String(state.tradeSummary.totalBinderItems)} />
              <Metric label="Quantity" value={String(state.tradeSummary.totalQuantityAvailable)} />
              <Metric label="Matches" value={String(state.matches.length)} />
            </View>
            <TDInput label="Search binder" value={query} onChangeText={setQuery} leftIconName="search-outline" placeholder="Card, set, condition, storage..." />
            <View style={s.chips}>
              <Chip label="All" selected={status === 'all'} onPress={() => setStatus('all')} />
              {TRADE_STATUS_OPTIONS.filter((option) => option !== 'not_for_trade').map((option) => <Chip key={option} label={tradeStatusLabel(option)} selected={status === option} onPress={() => setStatus(option)} />)}
            </View>
            <View style={s.chips}>
              {(['recent', 'name', 'quantity'] as const).map((option) => <Chip key={option} label={option} selected={sort === option} onPress={() => setSort(option)} />)}
            </View>
          </View>
        }
        ListEmptyComponent={state.tradeItems.length ? <TDEmptyState title="No matching binder cards" message="Adjust search or status filters." /> : <TDEmptyState title="No cards available to trade" message="Mark cards from card detail or Collection to build a Trade Binder." />}
        renderItem={({ item }) => (
          <TDCard style={s.itemCard}>
            <View style={s.row}>
              <View style={s.flex}>
                <TDText variant="title">{item.card.cardName}</TDText>
                <TDText variant="caption" tone="muted">{displayPrinting(item.card.printing)} - {displayCondition(item.card.condition)} - {displayFinish(item.card.printing.finish)}</TDText>
                <TDText variant="caption" tone="muted">{displayStorageLocation(item.card)}</TDText>
              </View>
              <TDBadge tone="info">x{item.quantityAvailable}</TDBadge>
            </View>
            {item.notes ? <TDText variant="small" tone="muted">{item.notes}</TDText> : null}
            <View style={s.chips}>
              {TRADE_STATUS_OPTIONS.map((option) => (
                <Chip key={option} label={tradeStatusLabel(option)} selected={item.status === option} disabled={pending === item.id} onPress={() => updateStatus(item, option)} />
              ))}
            </View>
          </TDCard>
        )}
      />
    </TDScreen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <TDCard style={s.metric}><TDText variant="caption" tone="muted">{label}</TDText><TDText variant="title">{value}</TDText></TDCard>;
}

function Chip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[s.chip, selected && s.chipSelected, disabled && s.disabled]}>
      <TDText variant="caption" tone={selected ? 'primary' : 'muted'}>{label}</TDText>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md, paddingBottom: 128 },
  header: { gap: space.md },
  back: { alignSelf: 'flex-start' },
  summaryRow: { flexDirection: 'row', gap: space.sm },
  metric: { flex: 1, padding: space.md, borderRadius: radius.md },
  itemCard: { gap: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { minHeight: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '30' },
  disabled: { opacity: 0.6 },
});
