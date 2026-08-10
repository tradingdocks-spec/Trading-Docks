import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { TDButton, TDCard, TDText } from '@/components/design-system';
import { Logo } from '@/components/primitives';
import { color, radius, space } from '@/design';

const valueProps = [
  { icon: 'scan-outline', title: 'Scan faster', copy: 'Capture cards and confirm exact printings.' },
  { icon: 'albums-outline', title: 'Know your collection', copy: 'Organize cards, storage, prices, and review work.' },
  { icon: 'swap-horizontal-outline', title: 'Trade smarter', copy: 'Keep binder, wishlist, and Deal Desk work connected.' },
] as const;

export default function Welcome() {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Logo />
          <View style={s.copy}>
            <TDText variant="display" style={s.title}>Trading Docks</TDText>
            <TDText variant="title" tone="secondary" style={s.subtitle}>
              Your TCG collection, wherever you trade.
            </TDText>
          </View>
          <View style={s.actions}>
            <TDButton label="Get Started" iconName="arrow-forward" onPress={() => router.push('/onboarding')} />
            <TDButton label="Sign In" variant="secondary" iconName="log-in-outline" onPress={() => router.push('/auth')} />
          </View>
        </View>

        <TDCard variant="outlined" style={s.valueCard}>
          {valueProps.map((item) => (
            <View key={item.title} style={s.valueRow}>
              <View style={s.valueIcon}>
                <Ionicons name={item.icon} size={20} color={color.primaryBright} />
              </View>
              <View style={s.valueCopy}>
                <TDText variant="small">{item.title}</TDText>
                <TDText variant="caption" tone="muted">{item.copy}</TDText>
              </View>
            </View>
          ))}
        </TDCard>

        <TDText variant="caption" tone="muted" style={s.footer}>
          Built for collectors, sellers, and stores. No invented prices, charts, or scanner certainty.
        </TDText>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  content: { flexGrow: 1, justifyContent: 'center', gap: space.xl, padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  hero: { gap: space.lg },
  copy: { gap: space.sm },
  title: { fontSize: 42, lineHeight: 46 },
  subtitle: { maxWidth: 330 },
  actions: { gap: space.sm },
  valueCard: { gap: space.md, padding: space.md },
  valueRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md },
  valueIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.primary + '18' },
  valueCopy: { flex: 1, minWidth: 0, gap: 2 },
  footer: { textAlign: 'center' },
});
