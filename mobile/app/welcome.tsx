import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { TDBadge, TDButton, TDCard, TDStatusIndicator, TDText } from '@/components/design-system';
import { Logo } from '@/components/primitives';
import { color, space } from '@/design';

export default function Welcome() {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Logo />
          <TDBadge tone="info">Mobile workspace</TDBadge>
          <TDText variant="heading">Trading Docks keeps your cards, scans, and buying work organized.</TDText>
          <TDText variant="small" tone="secondary">
            Start with a calm mobile workspace, then sign in when you are ready to sync across Trading Docks.
          </TDText>
        </View>

        <TDCard variant="floating" style={s.trustCard}>
          <TDStatusIndicator label="Real collection data only" tone="success" />
          <TDStatusIndicator label="Scanner confirmation before collection writes" tone="info" />
          <TDStatusIndicator label="Free, Collector, Seller, and Store paths" tone="neutral" />
        </TDCard>

        <View style={s.actions}>
          <TDButton label="Get started" iconName="arrow-forward" onPress={() => router.push('/onboarding')} />
          <TDButton label="Sign in" variant="secondary" iconName="log-in-outline" onPress={() => router.push('/auth')} />
          <TDButton label="Preview mobile" variant="ghost" iconName="phone-portrait-outline" onPress={() => router.replace('/(tabs)')} />
        </View>

        <View style={s.footer}>
          <Ionicons name="shield-checkmark-outline" size={18} color={color.success} />
          <TDText variant="caption" tone="muted" style={s.footerCopy}>
            Trading Docks does not invent prices, scanner confidence, or collection totals.
          </TDText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  content: { flexGrow: 1, justifyContent: 'space-between', gap: space.xl, padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  hero: { gap: space.md },
  trustCard: { gap: space.sm },
  actions: { gap: space.sm },
  footer: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: space.xs },
  footerCopy: { flex: 1, textAlign: 'center' },
});
