import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DockSurface, TDButton, TDInput, TDNavigationHeader, TDText } from '@/components/design-system';
import { color, space } from '@/design';
import { loadMobileDeckVault, type DeckRecord } from '@/services/mobile-deck-vault';

export default function DeckEditScreen() {
  const insets = useSafeAreaInsets();
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const [deck, setDeck] = useState<DeckRecord | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadMobileDeckVault().then((result) => {
      if (mounted) setDeck(result.decks.find((item) => item.id === deckId) ?? null);
    });
    return () => {
      mounted = false;
    };
  }, [deckId]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 16, 40) }]}>
      <TDNavigationHeader
        eyebrow="Deck Editor"
        title={deck?.name ?? 'Edit deck'}
        subtitle="Mobile editing uses the canonical Deck Vault record. Save actions stay disabled until shared mutation parity is verified."
      />
      <DockSurface level="raised">
        <TDInput label="Deck name" value={deck?.name ?? ''} editable={false} />
        <TDInput label="Commander" value={deck?.commander ?? ''} editable={false} />
        <TDInput label="Format" value={deck?.format ?? ''} editable={false} />
        <TDText variant="small" tone="muted">Add card, remove card, quantity, commander, and exact-printing edits are intentionally routed through the shared Deck Vault model before mobile writes are enabled.</TDText>
        <TDButton label="Back to deck" variant="secondary" onPress={() => router.back()} />
      </DockSurface>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.md, paddingHorizontal: space.md, paddingBottom: space.xl },
});
