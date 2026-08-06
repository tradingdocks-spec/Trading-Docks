import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TDBadge,
  TDCard,
  TDEmptyState,
  TDListRow,
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
        subtitle="Only real saved sessions and available workspace shortcuts are shown here."
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
        <TDListRow
          title="Seller metrics unavailable"
          description="Orders, offers, and margin reporting will appear after real marketplace or POS data is connected."
          iconName="analytics-outline"
          right={<TDBadge tone="neutral">Planned</TDBadge>}
        />
      </TDCard>

      <TDSectionHeader title="Next actions" />
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

      <TDEmptyState
        title="Seller metrics are not connected yet"
        message="Sales, order, and margin reporting will appear here after real marketplace or POS data is wired."
      />
    </ScrollView>
  );
}

function headlineForAccount(accountType: string) {
  if (accountType === 'store') return 'Store activity and operations';
  if (accountType === 'seller') return 'Seller signals and workflow shortcuts';
  return 'Market signals and collection opportunities';
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.md, paddingHorizontal: space.lg },
  hero: { gap: space.md, padding: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
