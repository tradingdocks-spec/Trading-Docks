import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TDBadge, TDButton, TDCard, TDChip, TDEmptyState, TDErrorState, TDIconButton, TDInput, TDListRow, TDLoadingState, TDMetric, TDNavigationHeader, TDStatusIndicator, TDScreen, TDText } from '@/components/design-system';
import { space } from '@/design';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';
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
  const insets = useSafeAreaInsets();
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
        contentContainerStyle={[s.content, { paddingBottom: getMobileScrollBottomInset(insets.bottom) }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={s.header}>
            <TDNavigationHeader
              eyebrow="Wishlist"
              title="Wanted cards"
              subtitle="Prioritize targets and review exact or flexible binder matches."
              leftAction={<TDIconButton label="Back" iconName="chevron-back" onPress={() => router.back()} />}
              rightAction={error ? <TDStatusIndicator label={error.includes('queued') ? 'Pending sync' : 'Update failed'} tone={error.includes('queued') ? 'warning' : 'danger'} /> : undefined}
            />
            <View style={s.summaryRow}>
              <TDMetric label="Targets" value={String(state.wishlistSummary.totalWishlistItems)} tone="info" compact />
              <TDMetric label="Matched" value={String(state.wishlistSummary.matchedWishlistItems)} tone={state.wishlistSummary.matchedWishlistItems ? 'success' : 'neutral'} compact />
              <TDMetric label="Exact" value={String(state.wishlistSummary.exactMatchCount)} compact />
            </View>
            <TDCard variant="outlined" style={s.addCard}>
              <View style={s.addHeader}>
                <View style={s.flex}>
                  <TDText variant="title">Add wanted card</TDText>
                  <TDText variant="caption" tone="muted">Use a set code only when the exact printing matters.</TDText>
                </View>
                <TDBadge tone="info">{priority === 'all' ? 'Medium' : wishlistPriorityLabel(priority)}</TDBadge>
              </View>
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
            <View style={s.itemWrap}>
              <TDListRow
                title={item.cardName}
                eyebrow={matches.length ? `${matches.length} binder match${matches.length === 1 ? '' : 'es'}` : 'No binder matches'}
                description={targetDescription(item)}
                iconName="star-outline"
                right={<TDBadge tone={item.priority === 'grail' ? 'accent' : 'info'}>{wishlistPriorityLabel(item.priority)}</TDBadge>}
                accessibilityLabel={`${item.cardName}, ${wishlistPriorityLabel(item.priority)}, ${matches.length} matches`}
              />
              {item.notes ? <TDText variant="small" tone="muted">{item.notes}</TDText> : null}
              <View style={s.chips}>
                {WISHLIST_PRIORITY_OPTIONS.map((option) => <TDChip key={option} label={wishlistPriorityLabel(option)} selected={item.priority === option} disabled={pending === item.id} tone="accent" onPress={() => updatePriority(item, option)} />)}
              </View>
              {matches.length ? matches.map((match) => (
                <TDListRow
                  key={match.id}
                  title={match.binderItem.card.cardName}
                  eyebrow={match.matchType === 'exact' ? 'Exact match' : 'Flexible match'}
                  description={`${displayPrinting(match.binderItem.card.printing)} - ${displayCondition(match.binderItem.card.condition)} - ${displayFinish(match.binderItem.card.printing.finish)} - ${displayStorageLocation(match.binderItem.card)}`}
                  iconName="git-compare-outline"
                  right={<TDBadge tone={match.matchType === 'exact' ? 'success' : 'warning'}>{match.matchType} x{match.quantityAvailable}</TDBadge>}
                />
              )) : <TDText variant="small" tone="muted">No binder matches yet.</TDText>}
              <TDButton label="Remove" variant="ghost" loading={pending === item.id} onPress={() => removeWishlist(item)} />
            </View>
          );
        }}
      />
    </TDScreen>
  );
}

function targetDescription(item: WishlistItem) {
  const specificity = item.setCode ? 'Exact target' : 'Flexible target';
  return `${specificity} - ${item.setCode ?? 'Any set'} - ${item.targetCondition ?? 'Any condition'} - ${item.targetFinish ?? 'Any finish'}`;
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md },
  header: { gap: space.md },
  summaryRow: { flexDirection: 'row', gap: space.sm },
  addHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  addCard: { gap: space.md },
  itemWrap: { gap: space.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
