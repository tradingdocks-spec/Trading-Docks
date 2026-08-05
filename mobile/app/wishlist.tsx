import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { TDBadge, TDButton, TDCard, TDChip, TDEmptyState, TDErrorState, TDInput, TDLoadingState, TDMetricTile, TDScreen, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { loadMobileTradeBinderWishlist, runMobileTradeWishlistMutation } from '@/services/trade-binder-wishlist-data';
import {
  WISHLIST_PRIORITY_OPTIONS,
  applyWishlistPriorityOptimistically,
  filterWishlistItems,
  sortWishlistItems,
  wishlistPriorityLabel,
  type TradeBinderWishlistState,
  type WishlistItem,
  type WishlistPriority,
} from '@/services/trade-binder-wishlist';
import { displayCondition, displayFinish, displayPrinting, displayStorageLocation } from '@/services/collector-workspace';

type ScreenState = TradeBinderWishlistState & { userId: string; stale: boolean; unavailableReason?: string };

export default function WishlistScreen() {
  const [state, setState] = useState<ScreenState | null>(null);
  const [query, setQuery] = useState('');
  const [cardName, setCardName] = useState('');
  const [setCode, setSetCode] = useState('');
  const [priority, setPriority] = useState<WishlistPriority | 'all'>('all');
  const [matchState, setMatchState] = useState<'all' | 'matched' | 'unmatched'>('all');
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
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Wishlist is unavailable.'))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const visible = useMemo(() => sortWishlistItems(filterWishlistItems(state?.wishlistItems ?? [], state?.matches ?? [], { query, priority, matchState }), 'priority'), [matchState, priority, query, state]);

  const updatePriority = async (item: WishlistItem, nextPriority: WishlistPriority) => {
    if (!state) return;
    setPending(item.id);
    const optimistic = applyWishlistPriorityOptimistically(state.wishlistItems, item.id, nextPriority);
    setState({ ...state, wishlistItems: optimistic.items });
    const result = await runMobileTradeWishlistMutation({ type: 'wishlist_priority', userId: state.userId, wishlistItemId: item.id, priority: nextPriority });
    if (!result.ok) {
      setState({ ...state, wishlistItems: optimistic.previous });
      setError(result.error);
    } else if (result.queued) {
      setError(result.warning);
    }
    setPending(null);
  };

  const addWishlist = async () => {
    if (!state || !cardName.trim()) return;
    setPending('add');
    const result = await runMobileTradeWishlistMutation({ type: 'wishlist_toggle', userId: state.userId, cardName, setCode, wishlisted: true, priority: priority === 'all' ? 'medium' : priority });
    if (!result.ok) setError(result.error);
    else if (result.queued) setError(result.warning);
    setCardName('');
    setSetCode('');
    reload();
    setPending(null);
  };

  const removeWishlist = async (item: WishlistItem) => {
    if (!state) return;
    setPending(item.id);
    const result = await runMobileTradeWishlistMutation({ type: 'wishlist_toggle', userId: state.userId, cardName: item.cardName, setCode: item.setCode, wishlisted: false });
    if (!result.ok) setError(result.error);
    else if (result.queued) setError(result.warning);
    reload();
    setPending(null);
  };

  if (loading) return <TDScreen style={s.screen}><TDLoadingState title="Loading Wishlist" message="Checking wanted cards and matches." /></TDScreen>;
  if (!state) return <TDScreen style={s.screen}><TDErrorState title="Wishlist unavailable" message={error ?? 'Wishlist data could not be loaded.'} action={<TDButton label="Retry" variant="secondary" onPress={reload} />} /></TDScreen>;

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
            <TDText variant="label" tone="info">Wishlist</TDText>
            <TDText variant="display">Wanted cards</TDText>
            <TDText variant="small" tone="muted">Track strict targets and see which binder cards satisfy them.</TDText>
            {error ? <TDBadge tone={error.includes('queued') ? 'warning' : 'danger'}>{error.includes('queued') ? 'Pending sync' : 'Update failed'}</TDBadge> : null}
            <View style={s.summaryRow}>
              <TDMetricTile label="Targets" value={String(state.wishlistSummary.totalWishlistItems)} tone="info" compact />
              <TDMetricTile label="Matched" value={String(state.wishlistSummary.matchedWishlistItems)} tone={state.wishlistSummary.matchedWishlistItems ? 'success' : 'neutral'} compact />
              <TDMetricTile label="Exact" value={String(state.wishlistSummary.exactMatchCount)} compact />
            </View>
            <TDCard style={s.addCard}>
              <TDText variant="title">Add wanted card</TDText>
              <TDInput label="Card name" value={cardName} onChangeText={setCardName} placeholder="Rhystic Study" />
              <TDInput label="Set code" value={setCode} onChangeText={setSetCode} placeholder="Optional, e.g. WOT" autoCapitalize="characters" />
              <TDButton label="Add to Wishlist" loading={pending === 'add'} disabled={!cardName.trim()} onPress={addWishlist} />
            </TDCard>
            <TDInput label="Search wishlist" value={query} onChangeText={setQuery} leftIconName="search-outline" placeholder="Card, set, priority, notes..." />
            <View style={s.chips}>
              <TDChip label="All" selected={priority === 'all'} onPress={() => setPriority('all')} />
              {WISHLIST_PRIORITY_OPTIONS.map((option) => <TDChip key={option} label={wishlistPriorityLabel(option)} selected={priority === option} tone="accent" onPress={() => setPriority(option)} />)}
            </View>
            <View style={s.chips}>
              {(['all', 'matched', 'unmatched'] as const).map((option) => <TDChip key={option} label={option} selected={matchState === option} tone="success" onPress={() => setMatchState(option)} />)}
            </View>
          </View>
        }
        ListEmptyComponent={state.wishlistItems.length ? <TDEmptyState title="No matching wishlist cards" message="Adjust search, priority, or match filters." /> : <TDEmptyState title="Wishlist is empty" message="Add cards you are looking for before a trade or show." />}
        renderItem={({ item }) => {
          const matches = state.matches.filter((match) => match.wishlistItem.id === item.id);
          return (
            <TDCard style={s.itemCard}>
              <View style={s.row}>
                <View style={s.flex}>
                  <TDText variant="title">{item.cardName}</TDText>
                  <TDText variant="caption" tone="muted">{[item.setCode ?? 'Any set', item.targetCondition, item.targetFinish].join(' - ')}</TDText>
                </View>
                <TDBadge tone={item.priority === 'grail' ? 'accent' : 'info'}>{wishlistPriorityLabel(item.priority)}</TDBadge>
              </View>
              {item.notes ? <TDText variant="small" tone="muted">{item.notes}</TDText> : null}
              <View style={s.chips}>
                {WISHLIST_PRIORITY_OPTIONS.map((option) => <TDChip key={option} label={wishlistPriorityLabel(option)} selected={item.priority === option} disabled={pending === item.id} tone="accent" onPress={() => updatePriority(item, option)} />)}
              </View>
              {matches.length ? matches.map((match) => (
                <View key={match.id} style={s.matchRow}>
                  <View style={s.flex}>
                    <TDText variant="small">{match.binderItem.card.cardName}</TDText>
                    <TDText variant="caption" tone="muted">{displayPrinting(match.binderItem.card.printing)} - {displayCondition(match.binderItem.card.condition)} - {displayFinish(match.binderItem.card.printing.finish)}</TDText>
                    <TDText variant="caption" tone="muted">{displayStorageLocation(match.binderItem.card)}</TDText>
                  </View>
                  <TDBadge tone={match.matchType === 'exact' ? 'success' : 'warning'}>{match.matchType} x{match.quantityAvailable}</TDBadge>
                </View>
              )) : <TDText variant="small" tone="muted">No binder matches yet.</TDText>}
              <TDButton label="Remove" variant="ghost" loading={pending === item.id} onPress={() => removeWishlist(item)} />
            </TDCard>
          );
        }}
      />
    </TDScreen>
  );
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md, paddingBottom: 128 },
  header: { gap: space.md },
  back: { alignSelf: 'flex-start' },
  summaryRow: { flexDirection: 'row', gap: space.sm },
  addCard: { gap: space.md },
  itemCard: { gap: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm },
});
