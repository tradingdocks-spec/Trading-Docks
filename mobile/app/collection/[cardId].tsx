import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CollectibleThumbnail,
  LocationBreadcrumb,
  TDBadge,
  TDButton,
  TDCard,
  TDChip,
  TDEmptyState,
  TDErrorState,
  TDListRow,
  TDLoadingState,
  TDMetric,
  TDNavigationHeader,
  TDScreen,
  TDStatusIndicator,
  TDText,
} from '@/components/design-system';
import { radius, space } from '@/design';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/providers/account';
import { loadCollectorCardById } from '@/services/collector-data';
import { runMobileCollectorMutation } from '@/services/collector-mutation-data';
import {
  CARD_CONDITION_OPTIONS,
  CARD_FINISH_OPTIONS,
  TRADE_BINDER_STATUS_OPTIONS,
  applyCollectorMutationOptimistically,
  rollbackCollectorMutation,
  type CollectorMutation,
} from '@/services/collector-mutations';
import {
  displayCondition,
  displayFinish,
  displayPrinting,
  displayStorageLocation,
  priceLabel,
  type CollectionCard,
  type StorageLocation,
  type TradeBinderStatus,
} from '@/services/collector-workspace';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';

export default function MobileCollectionCardDetail() {
  const insets = useSafeAreaInsets();
  const { cardId } = useLocalSearchParams<{ cardId?: string }>();
  const { accountType, hasFullPlatformAccess } = useAccount();
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<string | null>(null);
  const [staleReason, setStaleReason] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    if (!cardId) {
      setCards([]);
      setLoading(false);
      return;
    }
    void supabase?.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    void loadCollectorCardById(cardId)
      .then((result) => {
        if (!active) return;
        setCards(result.cards);
        setLocations(result.locations);
        setTotalQuantity(result.totalQuantity);
        setStaleReason(result.stale ? result.unavailableReason ?? 'Showing cached collection data.' : null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Collection data is unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cardId]);

  const card = useMemo(
    () => cards.find((candidate) => candidate.id === cardId),
    [cardId, cards],
  );

  const runMutation = async (mutation: CollectorMutation) => {
    if (!card || !userId) {
      setMutationError('Sign in again to update this collection record.');
      return;
    }
    setMutationError(null);
    setPendingMutation(mutation.type);
    const optimistic = applyCollectorMutationOptimistically(cards, mutation, locations);
    setCards(optimistic.cards);
    if (mutation.type === 'quantity') {
      setTotalQuantity((value) => value - card.quantityOwned + mutation.quantity);
    }

    const result = await runMobileCollectorMutation({
      mutation,
      membershipTier: accountType,
      currentTotalQuantity: totalQuantity,
      currentCardQuantity: card.quantityOwned,
      hasFullPlatformAccess,
    });

    if (!result.ok) {
      setCards(rollbackCollectorMutation(optimistic));
      if (mutation.type === 'quantity') setTotalQuantity(totalQuantity);
      setMutationError(result.error);
    } else if (result.queued) {
      setMutationError(result.warning ?? 'Offline change queued for sync.');
    }
    setPendingMutation(null);
  };

  if (loading) {
    return (
      <TDScreen style={s.screen}>
        <TDLoadingState title="Loading card" message="Fetching card details from your saved collection." />
      </TDScreen>
    );
  }

  if (error) {
    return (
      <TDScreen style={s.screen}>
        <TDErrorState title="Card unavailable" message={error} action={<TDButton label="Back to Collection" variant="secondary" onPress={() => router.back()} />} />
      </TDScreen>
    );
  }

  if (!card) {
    return (
      <TDScreen style={s.screen}>
        <TDEmptyState title="Card not found" message="This card is not in the loaded collection page." action={<TDButton label="Back to Collection" variant="secondary" onPress={() => router.back()} />} />
      </TDScreen>
    );
  }

  return (
    <TDScreen style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: getMobileScrollBottomInset(insets.bottom) }]} showsVerticalScrollIndicator={false}>
        <TDNavigationHeader
          eyebrow={displayPrinting(card.printing)}
          title={card.cardName}
          subtitle={card.printing.setName ?? 'Set name unavailable'}
          leftAction={<TDButton label="Back" variant="ghost" iconName="chevron-back" onPress={() => router.back()} style={s.backButton} />}
          rightAction={staleReason ? <TDBadge tone="warning">Stale</TDBadge> : undefined}
        />

        <View style={s.hero}>
          <CollectibleThumbnail title={card.cardName} imageUrl={card.printing.imageUrl} size="lg" style={s.imageFrame} />

          <View style={s.heroCopy}>
            <View style={s.badgeRow}>
              <TDBadge tone="info">x{card.quantityOwned}</TDBadge>
              <TDBadge tone="neutral">{displayCondition(card.condition)}</TDBadge>
              <TDBadge tone="neutral">{displayFinish(card.printing.finish)}</TDBadge>
            </View>
            <View style={s.summaryGrid}>
              <TDMetric label="Value" value={priceLabel(card)} tone={card.marketPrice.amount === null ? 'neutral' : 'info'} compact />
              <TDMetric label="Storage" value={card.storageLocation ? card.storageLocation.name : 'Unassigned'} compact />
            </View>
            <LocationBreadcrumb path={displayStorageLocation(card)} />
            <TDButton
              label={card.storageLocation ? 'Move location' : 'Assign location'}
              iconName="file-tray-stacked-outline"
              accessibilityLabel="Open Storage Location Manager"
              onPress={() => router.push('/storage-locations' as never)}
            />
          </View>
        </View>

        <TDCard style={s.detailCard}>
          <TDText variant="title">Printing and value</TDText>
          <DetailLine label="Printing" value={displayPrinting(card.printing)} />
          <DetailLine label="Price summary" value={priceLabel(card)} muted={card.marketPrice.amount === null} />
          <DetailLine label="Language" value={card.printing.language ?? 'Language unavailable'} />
        </TDCard>

        {mutationError ? (
          <TDCard accessibilityRole="alert" variant="outlined" style={s.errorCard}>
            <TDStatusIndicator tone={mutationError.includes('queued') ? 'warning' : 'danger'} label={mutationError.includes('queued') ? 'Pending sync' : 'Update failed'} />
            <TDText variant="small" tone="muted">{mutationError}</TDText>
          </TDCard>
        ) : null}

        <TDCard style={s.actionPanel}>
          <TDText variant="title">Ownership</TDText>
          <TDText variant="small" tone="muted">
            Quantity zero is saved as zero owned. It does not delete or archive the collection record.
          </TDText>
          <View style={s.quantityRow}>
            <TDButton
              label="-"
              accessibilityLabel="Decrease quantity"
              variant="secondary"
              disabled={card.quantityOwned <= 0 || pendingMutation === 'quantity'}
              onPress={() => runMutation({ type: 'quantity', userId: userId ?? '', inventoryItemId: card.id, quantity: card.quantityOwned - 1 })}
            />
            <TDBadge tone="info">Owned x{card.quantityOwned}</TDBadge>
            <TDButton
              label="+"
              accessibilityLabel="Increase quantity"
              variant="secondary"
              disabled={pendingMutation === 'quantity'}
              onPress={() => runMutation({ type: 'quantity', userId: userId ?? '', inventoryItemId: card.id, quantity: card.quantityOwned + 1 })}
            />
          </View>
          <OptionGroup
            label="Condition"
            value={card.condition}
            options={CARD_CONDITION_OPTIONS}
            display={displayCondition}
            pending={pendingMutation === 'condition'}
            onSelect={(condition) => runMutation({ type: 'condition', userId: userId ?? '', inventoryItemId: card.id, condition })}
          />
          <OptionGroup
            label="Finish"
            value={card.printing.finish}
            options={CARD_FINISH_OPTIONS}
            display={displayFinish}
            pending={pendingMutation === 'finish'}
            onSelect={(finish) => runMutation({ type: 'finish', userId: userId ?? '', inventoryItemId: card.id, finish })}
          />
        </TDCard>

        <TDCard style={s.actionPanel}>
          <TDText variant="title">Organization</TDText>
          <TDListRow
            title={displayStorageLocation(card)}
            description={card.storageLocation ? 'Move this card or clear the assignment.' : 'Assign this card to a real location.'}
            iconName="file-tray-stacked-outline"
            right={<TDBadge tone={card.storageLocation ? 'info' : 'neutral'}>{card.storageLocation ? 'Assigned' : 'Open'}</TDBadge>}
            onPress={() => router.push('/storage-locations' as never)}
          />
          <OptionGroup
            label="Storage"
            value={card.storageLocation?.id ?? 'none'}
            options={['none', ...locations.map((location) => location.id)]}
            display={(locationId) => locationId === 'none' ? 'Clear location' : locations.find((location) => location.id === locationId)?.name ?? 'Unavailable'}
            pending={pendingMutation === 'storage'}
            onSelect={(locationId) => runMutation({ type: 'storage', userId: userId ?? '', inventoryItemId: card.id, storageLocationId: locationId === 'none' ? null : locationId })}
          />
        </TDCard>

        <TDCard style={s.actionPanel}>
          <TDText variant="title">Exchange status</TDText>
          <OptionGroup
            label="Trade Binder"
            value={card.tradeBinderStatus === 'unknown' ? 'not_for_trade' : card.tradeBinderStatus}
            options={TRADE_BINDER_STATUS_OPTIONS}
            display={displayTradeStatus}
            pending={pendingMutation === 'trade_binder_status'}
            onSelect={(status) => runMutation({ type: 'trade_binder_status', userId: userId ?? '', inventoryItemId: card.id, status })}
          />
          <TDButton
            label={card.wishlistStatus === 'wanted' ? 'Remove from Wishlist' : 'Add to Wishlist'}
            variant={card.wishlistStatus === 'wanted' ? 'ghost' : 'secondary'}
            iconName={card.wishlistStatus === 'wanted' ? 'star' : 'star-outline'}
            disabled={pendingMutation === 'wishlist'}
            onPress={() => runMutation({
              type: 'wishlist',
              userId: userId ?? '',
              inventoryItemId: card.id,
              wishlisted: card.wishlistStatus !== 'wanted',
              cardName: card.cardName,
              setCode: card.printing.setCode,
              condition: card.condition,
              finish: card.printing.finish,
            })}
          />
        </TDCard>

        <TDCard variant="outlined">
          <TDText variant="title">Advanced details</TDText>
          <DetailLine label="Scryfall ID" value={card.printing.scryfallId ?? 'Unavailable'} />
          <TDText variant="small" tone="muted">
            Scanner recognition, portfolio analytics, and deck-editing usage will connect here after their dedicated sprints.
          </TDText>
        </TDCard>
      </ScrollView>
    </TDScreen>
  );
}

function OptionGroup<T extends string>({
  label,
  value,
  options,
  display,
  pending,
  onSelect,
}: {
  label: string;
  value: T;
  options: T[];
  display: (value: T) => string;
  pending: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={s.optionGroup}>
      <TDText variant="label" tone="muted">{label}</TDText>
      <View style={s.optionRow}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <TDChip
              key={option}
              accessibilityLabel={`${display(option)} ${label}`}
              disabled={pending || selected}
              label={display(option)}
              onPress={() => onSelect(option)}
              selected={selected}
              tone={label === 'Trade Binder' ? 'success' : 'info'}
            />
          );
        })}
      </View>
    </View>
  );
}

function displayTradeStatus(status: Exclude<TradeBinderStatus, 'unknown'>) {
  const labels: Record<Exclude<TradeBinderStatus, 'unknown'>, string> = {
    not_for_trade: 'Not for trade',
    available: 'Available',
    reserved: 'Reserved',
    pending: 'Pending',
    looking_for_upgrade: 'Looking for upgrade',
    for_sale: 'For sale',
  };
  return labels[status];
}

function DetailLine({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={s.detailLine}>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant="small" tone={muted ? 'muted' : 'primary'} style={s.detailValue}>{value}</TDText>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md },
  backButton: { alignSelf: 'flex-start' },
  hero: { gap: space.lg },
  imageFrame: { width: '100%', maxWidth: 320, height: undefined, aspectRatio: 0.72, alignSelf: 'center', borderRadius: radius.lg },
  heroCopy: { gap: space.xs },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  detailCard: { gap: space.sm },
  detailLine: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md, paddingVertical: space.xs },
  detailValue: { flex: 1, textAlign: 'right' },
  actionPanel: { gap: space.md },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  optionGroup: { gap: space.xs },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  errorCard: { gap: space.xs },
});
