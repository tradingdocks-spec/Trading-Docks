import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TDBadge,
  TDCard,
  TDListRow,
  TDMetric,
  TDNavigationHeader,
  TDSectionHeader,
  TDText,
} from '@/components/design-system';
import { color, space } from '@/design';
import { useWorkSession } from '@/features/sessions/session-provider';
import { useAccount } from '@/providers/account';

export default function Sell() {
  const insets = useSafeAreaInsets();
  const { accountType } = useAccount();
  const { activeSession } = useWorkSession();
  const workspaceLabel = accountType === 'store' ? 'Activity' : accountType === 'seller' ? 'Signals' : 'Signals';

  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 14, 34), paddingBottom: 112 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <TDNavigationHeader
        eyebrow={workspaceLabel}
        title={headlineForAccount(accountType)}
        subtitle={subtitleForAccount(accountType)}
      />

      <TDCard variant="floating" style={s.hero}>
        <View style={s.heroTop}>
          <View style={s.flex}>
            <TDText variant="label" tone="info">Today</TDText>
            <TDText variant="heading">{activeSession ? activeSession.name : 'No active selling session'}</TDText>
            <TDText variant="small" tone="muted">
              {activeSession ? `${activeSession.status} - ${activeSession.itemCount} item${activeSession.itemCount === 1 ? '' : 's'}` : 'Start from the scanner, Deal Desk, or Collection when real work is ready.'}
            </TDText>
          </View>
          <TDBadge tone={activeSession ? 'success' : 'neutral'}>{activeSession ? 'Active' : 'Quiet'}</TDBadge>
        </View>
        <View style={s.signalGrid}>
          <TDMetric label="Active session" value={activeSession ? String(activeSession.itemCount) : '0'} tone={activeSession ? 'success' : 'neutral'} compact />
          <TDMetric label="Market alerts" value="Soon" compact />
          <TDMetric label="Data source" value="Saved" tone="info" compact />
        </View>
      </TDCard>

      <TDSectionHeader title="Available now" />
      <TDListRow
        title="Open Deal Desk"
        description="Start or resume a buying, trade, sealed, or show session."
        iconName="swap-horizontal-outline"
        right={<Ionicons name="chevron-forward" size={20} color={color.textMuted} />}
        onPress={() => router.push('/(tabs)/deal-desk' as never)}
      />
      <TDListRow
        title="Scan cards"
        description="Use OCR-assisted capture and exact-printing confirmation."
        iconName="scan-outline"
        right={<Ionicons name="chevron-forward" size={20} color={color.textMuted} />}
        onPress={() => router.push('/(tabs)/scan' as never)}
      />
      <TDListRow
        title={accountType === 'store' ? 'Review business inventory' : 'Review collection'}
        description="Search exact printings, locations, binder state, and wishlist state."
        iconName="layers-outline"
        right={<Ionicons name="chevron-forward" size={20} color={color.textMuted} />}
        onPress={() => router.push('/(tabs)/collection' as never)}
      />

      <TDCard variant="outlined" style={s.comingSoon}>
        <View style={s.comingSoonIcon}>
          <Ionicons name="pulse-outline" size={20} color={color.info} />
        </View>
        <View style={s.flex}>
          <TDText variant="small">Signals will stay grounded in your cards</TDText>
          <TDText variant="caption" tone="muted">
            Price movement, sales, order, and margin intelligence will appear only after those real data feeds are connected.
          </TDText>
        </View>
      </TDCard>
    </ScrollView>
  );
}

function headlineForAccount(accountType: string) {
  if (accountType === 'store') return 'Store activity and operations';
  if (accountType === 'seller') return 'Seller signals and workflow shortcuts';
  return 'Collection signals';
}

function subtitleForAccount(accountType: string) {
  if (accountType === 'store') return 'Use saved sessions and workspace shortcuts while operations metrics are being connected.';
  if (accountType === 'seller') return 'Use saved sessions and seller shortcuts while live margin and marketplace signals are being connected.';
  return 'Signals focus on your saved collection until live market intelligence is connected.';
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.md, paddingHorizontal: space.lg },
  hero: { gap: space.md, padding: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  signalGrid: { flexDirection: 'row', gap: space.xs },
  comingSoon: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  comingSoonIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: color.info + '16' },
  flex: { flex: 1, minWidth: 0 },
});
