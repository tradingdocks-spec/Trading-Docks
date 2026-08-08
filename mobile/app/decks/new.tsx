import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DockSurface, TDButton, TDNavigationHeader, TDText } from '@/components/design-system';
import { color, space } from '@/design';

export default function NewDeckScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 16, 40) }]}>
      <TDNavigationHeader
        eyebrow="Deck Vault"
        title="Create deck"
        subtitle="Mobile uses the Headquarters Deck Vault model. Full deck creation remains tied to the shared Deck Vault save flow."
      />
      <DockSurface level="raised">
        <TDText variant="title">Shared Deck Vault creation</TDText>
        <TDText variant="small" tone="muted">Use Headquarters to create or import a deck, then manage that same record on mobile.</TDText>
        <TDButton label="Back to Decks" variant="secondary" onPress={() => router.back()} />
      </DockSurface>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.md, paddingHorizontal: space.md, paddingBottom: space.xl },
});
