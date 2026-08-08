import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DockCardWell, DockMetric, DockSurface, TDBadge, TDButton, TDEmptyState, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { colorIdentityLabel, formatDeckValue, loadMobileDeckVault, type DeckRecord } from '@/services/mobile-deck-vault';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';

export default function DeckShowcaseScreen() {
  const insets = useSafeAreaInsets();
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const [deck, setDeck] = useState<DeckRecord | null>(null);
  const commander = deck?.cards.find((card) => card.board === 'commander') ?? deck?.cards[0];
  const keyCards = deck?.cards.filter((card) => card.gameChanger || card.board === 'commander').slice(0, 8) ?? [];

  useEffect(() => {
    let mounted = true;
    void loadMobileDeckVault().then((result) => {
      if (mounted) setDeck(result.decks.find((item) => item.id === deckId) ?? null);
    });
    return () => {
      mounted = false;
    };
  }, [deckId]);

  if (!deck) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 16, 40) }]}>
        <TDEmptyState title="Showcase unavailable" message="This deck could not be loaded from Deck Vault." action={<TDButton label="Back" variant="secondary" onPress={() => router.back()} />} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 12, 34), paddingBottom: getMobileScrollBottomInset(insets.bottom) }]}>
      <DockSurface level="raised" tone="active" style={s.hero}>
        <DockCardWell lifted style={s.heroArt}>
          {commander?.artCrop || commander?.image ? (
            <Image source={{ uri: commander.artCrop ?? commander.image }} style={s.heroImage} contentFit="cover" alt={`${deck.name} showcase art`} accessibilityLabel={`${deck.name} showcase art`} />
          ) : null}
        </DockCardWell>
        <TDText variant="caption" tone="info">Deck Showcase</TDText>
        <TDText variant="display" numberOfLines={2}>{deck.name}</TDText>
        <TDText variant="small" tone="muted">{deck.commander ?? deck.theme}</TDText>
        <View style={s.badges}>
          <TDBadge tone="info">{deck.format}</TDBadge>
          <TDBadge tone="accent">{colorIdentityLabel(deck.colors)}</TDBadge>
          <TDBadge tone={deck.status === 'Complete' ? 'success' : 'warning'}>{deck.status}</TDBadge>
        </View>
        <View style={s.metrics}>
          <DockMetric label="Cards" value={String(deck.cardCount)} />
          <DockMetric label="Power" value={deck.power.toFixed(1)} />
          <DockMetric label="Value" value={formatDeckValue(deck.marketValue || null)} />
        </View>
      </DockSurface>

      <DockSurface style={s.gallery}>
        <TDText variant="title">Key cards</TDText>
        <View style={s.cardGrid}>
          {keyCards.map((card) => (
            <DockCardWell key={card.id} style={s.keyCard}>
              {card.image ? <Image source={{ uri: card.image }} style={s.keyCardImage} contentFit="cover" alt={`${card.name} card art`} accessibilityLabel={`${card.name} card art`} /> : null}
              <TDText variant="caption" numberOfLines={2}>{card.name}</TDText>
            </DockCardWell>
          ))}
        </View>
      </DockSurface>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.md, paddingHorizontal: space.md },
  hero: { gap: space.sm, padding: space.md },
  heroArt: { height: 220, padding: 0, borderRadius: radius.object },
  heroImage: { width: '100%', height: '100%' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  metrics: { flexDirection: 'row', gap: space.xs },
  gallery: { gap: space.md },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  keyCard: { width: '47%', minHeight: 210, gap: space.xs },
  keyCardImage: { width: '100%', height: 168, borderRadius: radius.sm },
});
