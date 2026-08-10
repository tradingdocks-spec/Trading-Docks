import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DockSurface, TDButton, TDNavigationHeader, TDText } from '@/components/design-system';
import { color, space } from '@/design';

export default function ImportDeckScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 16, 40) }]}>
      <TDNavigationHeader
        eyebrow="Deck Vault"
        title="Import deck"
        subtitle="Moxfield, ManaBox, and text import remain powered by the canonical Headquarters Deck Vault import flow."
      />
      <DockSurface level="raised">
        <TDText variant="title">Use the shared importer</TDText>
        <TDText variant="small" tone="muted">Mobile will show imported decks after Headquarters saves them to the shared Deck Vault record.</TDText>
        <TDButton label="Back to Decks" variant="secondary" onPress={() => router.back()} />
      </DockSurface>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.md, paddingHorizontal: space.md, paddingBottom: space.xl },
});
