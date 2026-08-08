import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CollectibleHero,
  CollectibleThumbnail,
  DockMetric,
  DockRail,
  DockSurface,
  DockTray,
  TDBadge,
  TDButton,
  TDEmptyState,
  TDSkeleton,
  TDStatusIndicator,
  TDText,
} from '@/components/design-system';
import { color, radius, space } from '@/design';
import {
  colorIdentityLabel,
  formatDeckValue,
  loadMobileDeckVault,
  summarizeMobileDeckVault,
  type DeckRecord,
} from '@/services/mobile-deck-vault';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';

export default function DecksTab() {
  const insets = useSafeAreaInsets();
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let mounted = true;
    void loadMobileDeckVault()
      .then((result) => {
        if (!mounted) return;
        setDecks(result.decks);
        setStale(result.stale);
        setUnavailableReason(result.unavailableReason ?? null);
      })
      .catch((error) => {
        if (!mounted) return;
        setDecks([]);
        setUnavailableReason(error instanceof Error ? error.message : 'Deck Vault is unavailable.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => summarizeMobileDeckVault(decks), [decks]);

  return (
    <View style={s.screen}>
      <FlatList
        data={loading ? [] : decks}
        keyExtractor={(deck) => deck.id}
        contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 14, 34), paddingBottom: getMobileScrollBottomInset(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={s.headerStack}>
            <View style={s.headerCopy}>
              <TDText variant="caption" tone="info">Deck Vault</TDText>
              <TDText variant="display">Decks</TDText>
              <TDText variant="small" tone="muted">Build, edit, and show decks from the same Headquarters Deck Vault.</TDText>
            </View>

            <CollectibleHero
              eyebrow="Shared model"
              title={decks.length ? `${summary.deckCount} saved deck${summary.deckCount === 1 ? '' : 's'}` : 'Deck Vault ready'}
              subtitle={decks.length ? `${summary.totalCards.toLocaleString()} cards tracked across saved lists.` : 'Create or import decks in Headquarters, then manage them here.'}
              tone="decks"
              style={s.hero}
            >
              <TDBadge tone={stale ? 'warning' : 'accent'}>{stale ? 'Cached' : 'Synced'}</TDBadge>
              <View style={s.heroMetrics}>
                <DockMetric label="Decks" value={loading ? '...' : String(summary.deckCount)} tone="active" />
                <DockMetric label="Cards" value={loading ? '...' : summary.totalCards.toLocaleString()} />
                <DockMetric label="Value" value={loading ? '...' : formatDeckValue(summary.knownValue)} tone={summary.knownValue === null ? 'neutral' : 'success'} />
              </View>
            </CollectibleHero>

            <DockSurface style={s.searchDock}>
              <DockRail compact accessibilityLabel="Deck Vault actions">
                <TDButton label="New" size="sm" iconName="add-outline" onPress={() => router.push('/decks/new' as never)} />
                <TDButton label="Import" size="sm" variant="secondary" iconName="download-outline" onPress={() => router.push('/decks/import' as never)} />
                <TDButton label="Showcase" size="sm" variant="ghost" iconName="sparkles-outline" disabled={!decks.length} onPress={() => router.push(`/decks/${decks[0]?.id}/showcase` as never)} />
              </DockRail>
              {unavailableReason ? <TDStatusIndicator label={unavailableReason} tone="warning" /> : null}
            </DockSurface>
          </View>
        }
        ListEmptyComponent={loading ? <DeckSkeleton /> : <EmptyDeckVault reason={unavailableReason} />}
        renderItem={({ item }) => <DeckCard deck={item} />}
      />
    </View>
  );
}

function DeckCard({ deck }: { deck: DeckRecord }) {
  const commander = deck.cards.find((card) => card.board === 'commander') ?? deck.cards[0];
  const missingCount = deck.cardCount - deck.ownedCount;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${deck.name}. ${deck.format}. ${deck.cardCount} cards.`}
      onPress={() => router.push(`/decks/${deck.id}` as never)}
      style={({ pressed }) => [s.deckPressable, pressed && s.pressed]}
    >
      <DockSurface level="raised" style={s.deckCard}>
        <CollectibleThumbnail title={deck.name} imageUrl={commander?.image} subtitle="Cover unavailable" size="sm" style={s.deckArt} />
        <View style={s.deckBody}>
          <View style={s.deckTitleRow}>
            <View style={s.flex}>
              <TDText variant="title" numberOfLines={2}>{deck.name}</TDText>
              <TDText variant="caption" tone="muted" numberOfLines={1}>{deck.commander ?? deck.theme}</TDText>
            </View>
            <TDBadge tone={deck.status === 'Complete' ? 'success' : 'accent'}>{deck.status}</TDBadge>
          </View>
          <View style={s.deckMeta}>
            <TDBadge tone="info">{deck.format}</TDBadge>
            <TDBadge tone="neutral">{colorIdentityLabel(deck.colors)}</TDBadge>
            <TDBadge tone={missingCount > 0 ? 'warning' : 'success'}>{missingCount > 0 ? `${missingCount} missing` : 'Owned'}</TDBadge>
          </View>
          <View style={s.deckStats}>
            <TDText variant="caption" tone="secondary">{deck.cardCount} cards</TDText>
            <TDText variant="caption" tone="secondary">{formatDeckValue(deck.marketValue || null)}</TDText>
            <TDText variant="caption" tone="muted">Updated {deck.updatedAt}</TDText>
          </View>
        </View>
      </DockSurface>
    </Pressable>
  );
}

function DeckSkeleton() {
  return (
    <DockSurface style={s.skeleton}>
      <TDSkeleton lines={4} />
    </DockSurface>
  );
}

function EmptyDeckVault({ reason }: { reason: string | null }) {
  return (
    <DockTray style={s.empty}>
      <TDEmptyState
        title={reason ? 'Deck Vault unavailable' : 'No decks yet'}
        message={reason ?? 'Create or import a deck in Headquarters. Mobile will use that same Deck Vault record.'}
        action={<TDButton label="Open Headquarters" variant="secondary" iconName="open-outline" onPress={() => router.push('/(tabs)/profile' as never)} />}
      />
    </DockTray>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.md, paddingHorizontal: space.md },
  headerStack: { gap: space.md },
  headerCopy: { gap: space.xs },
  hero: { gap: space.md, overflow: 'hidden', padding: space.md },
  heroMetrics: { flexDirection: 'row', gap: space.xs },
  searchDock: { gap: space.sm, padding: space.sm },
  deckPressable: { width: '100%' },
  deckCard: { flexDirection: 'row', gap: space.md, padding: space.md },
  deckArt: { width: 84, height: 118, borderRadius: radius.object },
  deckBody: { flex: 1, minWidth: 0, gap: space.sm },
  deckTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.xs },
  deckMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  deckStats: { gap: 2 },
  skeleton: { minHeight: 170 },
  empty: { padding: 0 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.88, transform: [{ translateY: 1 }, { scale: 0.99 }] },
});
