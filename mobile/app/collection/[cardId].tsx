import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDEmptyState,
  TDErrorState,
  TDLoadingState,
  TDScreen,
  TDText,
} from '@/components/design-system';
import { color, radius, space } from '@/design';
import { loadCollectorCardById } from '@/services/collector-data';
import {
  displayCondition,
  displayFinish,
  displayPrinting,
  displayStorageLocation,
  priceLabel,
  type CollectionCard,
} from '@/services/collector-workspace';

export default function MobileCollectionCardDetail() {
  const { cardId } = useLocalSearchParams<{ cardId?: string }>();
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staleReason, setStaleReason] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    if (!cardId) {
      setCards([]);
      setLoading(false);
      return;
    }
    void loadCollectorCardById(cardId)
      .then((result) => {
        if (!active) return;
        setCards(result.cards);
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
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <TDButton label="Back" variant="ghost" iconName="chevron-back" onPress={() => router.back()} style={s.backButton} />
        {staleReason ? <TDBadge tone="warning">Offline or stale</TDBadge> : null}

        <View style={s.hero}>
          <View style={s.imageFrame}>
            {card.printing.imageUrl ? (
              <Image source={{ uri: card.printing.imageUrl }} style={s.cardImage} contentFit="cover" accessibilityLabel={`${card.cardName} card image`} />
            ) : (
              <View style={s.imagePlaceholder}>
                <Ionicons name="image-outline" size={34} color={color.textMuted} />
                <TDText variant="small" tone="muted">Image unavailable</TDText>
              </View>
            )}
          </View>

          <View style={s.heroCopy}>
            <TDText variant="label" tone="info">{displayPrinting(card.printing)}</TDText>
            <TDText variant="display">{card.cardName}</TDText>
            <TDText variant="small" tone="muted">{card.printing.setName ?? 'Set name unavailable'}</TDText>
            <View style={s.badgeRow}>
              <TDBadge tone="info">x{card.quantityOwned}</TDBadge>
              <TDBadge tone="neutral">{displayCondition(card.condition)}</TDBadge>
              <TDBadge tone="neutral">{displayFinish(card.printing.finish)}</TDBadge>
            </View>
          </View>
        </View>

        <TDCard style={s.detailCard}>
          <DetailLine label="Storage location" value={displayStorageLocation(card)} />
          <DetailLine label="Language" value={card.printing.language ?? 'Language unavailable'} />
          <DetailLine label="Scryfall ID" value={card.printing.scryfallId ?? 'Unavailable'} />
          <DetailLine label="Price summary" value={priceLabel(card)} muted={card.marketPrice.amount === null} />
        </TDCard>

        <View style={s.actionGrid}>
          <TDButton label="Trade Binder planned" variant="secondary" iconName="swap-horizontal-outline" disabled />
          <TDButton label="Wishlist planned" variant="secondary" iconName="star-outline" disabled />
          <TDButton label="Deck Usage planned" variant="ghost" iconName="library-outline" disabled />
        </View>

        <TDCard variant="outlined">
          <TDText variant="title">Future integration points</TDText>
          <TDText variant="small" tone="muted">
            Scanner recognition, portfolio analytics, and deck-editing usage will connect here after their dedicated sprints.
          </TDText>
        </TDCard>
      </ScrollView>
    </TDScreen>
  );
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
  content: { gap: space.md, paddingBottom: 120 },
  backButton: { alignSelf: 'flex-start' },
  hero: { gap: space.lg },
  imageFrame: { width: '100%', maxWidth: 320, aspectRatio: 0.72, alignSelf: 'center', borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised },
  cardImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  heroCopy: { gap: space.xs },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  detailCard: { gap: space.sm },
  detailLine: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md, paddingVertical: space.xs },
  detailValue: { flex: 1, textAlign: 'right' },
  actionGrid: { gap: space.sm },
});
