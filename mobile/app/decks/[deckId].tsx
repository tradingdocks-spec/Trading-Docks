import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DockCardWell,
  DockHeader,
  DockMetric,
  DockRail,
  DockSurface,
  DockTray,
  TDBadge,
  TDButton,
  TDEmptyState,
  TDNavigationHeader,
  TDSkeleton,
  TDText,
} from '@/components/design-system';
import { color, radius, space } from '@/design';
import {
  analyzeMobileDeck,
  colorIdentityLabel,
  formatDeckValue,
  loadMobileDeckVault,
  type DeckCard,
  type DeckRecord,
} from '@/services/mobile-deck-vault';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';

const SECTION_ORDER = ['Commander', 'Creatures', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Planeswalkers', 'Lands', 'Other'];

export default function DeckDetailScreen() {
  const insets = useSafeAreaInsets();
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const [deck, setDeck] = useState<DeckRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadMobileDeckVault()
      .then((result) => {
        if (!mounted) return;
        const found = result.decks.find((item) => item.id === deckId) ?? null;
        setDeck(found);
        setError(found ? null : result.unavailableReason ?? 'Deck not found in your Deck Vault.');
      })
      .catch((loadError) => {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Deck could not be loaded.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [deckId]);

  const analytics = useMemo(() => deck ? analyzeMobileDeck(deck) : null, [deck]);
  const sections = useMemo(() => deck ? groupDeckCards(deck.cards) : [], [deck]);
  const commander = deck?.cards.find((card) => card.board === 'commander') ?? deck?.cards[0];

  if (loading) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 16, 40) }]}>
        <TDSkeleton lines={6} />
      </ScrollView>
    );
  }

  if (!deck || !analytics) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 16, 40) }]}>
        <TDEmptyState title="Deck unavailable" message={error ?? 'This deck could not be loaded.'} action={<TDButton label="Back to Decks" variant="secondary" onPress={() => router.back()} />} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 12, 34), paddingBottom: getMobileScrollBottomInset(insets.bottom) }]}>
      <TDNavigationHeader
        eyebrow="Deck Detail"
        title={deck.name}
        subtitle={`${deck.format} - ${colorIdentityLabel(deck.colors)} - ${deck.cardCount} cards`}
      />

      <DockSurface level="raised" tone="active" style={s.hero}>
        <DockCardWell lifted style={s.heroArt}>
          {commander?.artCrop || commander?.image ? (
            <Image source={{ uri: commander.artCrop ?? commander.image }} style={s.heroImage} contentFit="cover" alt={`${deck.name} hero art`} accessibilityLabel={`${deck.name} hero art`} />
          ) : (
            <View style={s.heroPlaceholder}>
              <Ionicons name="albums-outline" size={34} color={color.primaryBright} />
            </View>
          )}
        </DockCardWell>
        <DockHeader
          eyebrow={deck.commander ? 'Commander' : deck.theme}
          title={deck.commander ?? deck.name}
          subtitle={`${deck.status} - Updated ${deck.updatedAt}`}
          right={<TDBadge tone={deck.status === 'Complete' ? 'success' : 'accent'}>{deck.status}</TDBadge>}
        />
        <View style={s.metrics}>
          <DockMetric label="Value" value={formatDeckValue(analytics.knownValue)} tone={analytics.knownValue === null ? 'neutral' : 'success'} />
          <DockMetric label="Avg MV" value={analytics.averageManaValue.toFixed(2)} />
          <DockMetric label="Missing" value={String(analytics.missingCards)} tone={analytics.missingCards ? 'warning' : 'success'} />
        </View>
        <DockRail compact>
          <TDButton label="Edit" size="sm" iconName="create-outline" onPress={() => router.push(`/decks/${deck.id}/edit` as never)} />
          <TDButton label="Showcase" size="sm" variant="secondary" iconName="sparkles-outline" onPress={() => router.push(`/decks/${deck.id}/showcase` as never)} />
        </DockRail>
      </DockSurface>

      <DockSurface style={s.intelligence}>
        <DockHeader
          eyebrow="Deck intelligence"
          title={deck.status === 'Complete' ? 'Deck is ready to show' : 'Deck still has build work'}
          subtitle={analytics.missingCards ? `${analytics.missingCards} card${analytics.missingCards === 1 ? '' : 's'} are not marked owned.` : 'Ownership, value, and composition are resolved from saved deck data.'}
        />
      </DockSurface>

      <DockSurface style={s.composition}>
        <TDText variant="title">Mana curve</TDText>
        <View style={s.barRow}>
          {analytics.manaCurve.map((bucket) => <MiniBar key={bucket.label} label={bucket.label} value={bucket.value} max={Math.max(1, ...analytics.manaCurve.map((item) => item.value))} />)}
        </View>
      </DockSurface>

      <DockSurface style={s.composition}>
        <TDText variant="title">Card types</TDText>
        {analytics.cardTypes.filter((item) => item.value > 0).map((item) => (
          <View key={item.label} style={s.typeRow}>
            <TDText variant="caption" tone="muted">{item.label}</TDText>
            <TDText variant="caption">{item.value}</TDText>
          </View>
        ))}
      </DockSurface>

      {sections.map((section) => (
        <DockSurface key={section.title} style={s.section}>
          <TDText variant="title">{section.title}</TDText>
          {section.cards.slice(0, 12).map((card) => (
            <DockTray key={card.id} style={s.cardRow}>
              <TDText variant="small" style={s.flex} numberOfLines={1}>{card.quantity} {card.name}</TDText>
              <TDBadge tone={card.owned ? 'success' : 'warning'}>{card.owned ? 'Owned' : 'Missing'}</TDBadge>
            </DockTray>
          ))}
        </DockSurface>
      ))}
    </ScrollView>
  );
}

function MiniBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <View style={s.miniBar}>
      <View style={[s.miniBarFill, { height: `${Math.max(8, Math.round((value / max) * 100))}%` }]} />
      <TDText variant="caption" tone="muted">{label}</TDText>
    </View>
  );
}

function groupDeckCards(cards: DeckCard[]) {
  const groups = new Map<string, DeckCard[]>();
  for (const card of cards) {
    const section = sectionForCard(card);
    groups.set(section, [...(groups.get(section) ?? []), card]);
  }
  return SECTION_ORDER
    .map((title) => ({ title, cards: groups.get(title) ?? [] }))
    .filter((section) => section.cards.length > 0);
}

function sectionForCard(card: DeckCard) {
  if (card.board === 'commander') return 'Commander';
  const typeLine = card.typeLine.toLowerCase();
  if (typeLine.includes('creature')) return 'Creatures';
  if (typeLine.includes('instant')) return 'Instants';
  if (typeLine.includes('sorcery')) return 'Sorceries';
  if (typeLine.includes('artifact')) return 'Artifacts';
  if (typeLine.includes('enchantment')) return 'Enchantments';
  if (typeLine.includes('planeswalker')) return 'Planeswalkers';
  if (typeLine.includes('land')) return 'Lands';
  return 'Other';
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.md, paddingHorizontal: space.md },
  hero: { gap: space.md, padding: space.md },
  heroArt: { height: 172, borderRadius: radius.object, padding: 0 },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', gap: space.xs },
  intelligence: { padding: space.md },
  composition: { gap: space.sm },
  barRow: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  miniBar: { flex: 1, height: 110, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  miniBarFill: { width: '100%', borderRadius: radius.xs, backgroundColor: color.accent + '88' },
  typeRow: { minHeight: 28, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: color.border },
  section: { gap: space.sm },
  cardRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
