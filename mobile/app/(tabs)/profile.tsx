import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TDBadge, TDButton, TDCard, TDListRow, TDNavigationHeader, TDSectionHeader, TDStatusIndicator, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/providers/account';
import { useAdmin } from '@/providers/admin';
import { useAuth } from '@/providers/auth';
import { useWorkSession } from '@/features/sessions/session-provider';

const baseItems = [
  ['Notifications', 'Price, session, and account alerts', 'notifications-outline'],
  ['Settings', 'Security, sync, and haptics', 'settings-outline'],
  ['Appearance', 'Trading Docks Dark', 'moon-outline'],
  ['Security', 'Account protection', 'shield-checkmark-outline'],
] as const;

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { session, configured } = useAuth();
  const { isAdmin, role } = useAdmin();
  const { accountType } = useAccount();
  const { activeSession } = useWorkSession();

  const signOut = async () => {
    await supabase?.auth.signOut();
    router.replace('/welcome');
  };

  const open = (title: string) => {
    if (title === 'Command Center') router.push('/admin');
    else if (title === 'Membership') router.push('/plans');
    else if (title === 'Settings' || title === 'Security' || title === 'Appearance' || title === 'Notifications') router.push('/settings');
  };

  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 14, 34), paddingBottom: getMobileScrollBottomInset(insets.bottom) }]} showsVerticalScrollIndicator={false}>
      <TDNavigationHeader
        eyebrow="Profile"
        title="Account and settings"
        subtitle="Manage your workspace, membership, security, and support options."
      />
      <TDCard variant="floating" style={s.identity}>
        <View style={s.avatar}>
          <TDText variant="title">{(session?.user.email?.[0] ?? 'C').toUpperCase()}</TDText>
        </View>
        <View style={s.flex}>
          <TDText variant="title" style={s.name}>{session?.user.email?.split('@')[0] ?? 'Collector'}</TDText>
          <TDText variant="caption" tone="muted">{session?.user.email ?? 'Preview mode'}</TDText>
          <TDStatusIndicator label={configured ? 'Connection ready' : 'Setup required'} tone={configured ? 'success' : 'warning'} />
        </View>
        <TDBadge tone={session ? 'success' : 'warning'}>{session ? 'Signed in' : 'Preview'}</TDBadge>
      </TDCard>

      {activeSession ? (
        <TDListRow
          eyebrow="Current session"
          title={activeSession.name}
          description={activeSession.status === 'paused' ? 'Paused and saved locally' : 'Active and available offline'}
          iconName="radio-outline"
          right={<Ionicons name="chevron-forward" size={20} color={color.info} />}
          onPress={() => router.push('/scanner-session' as never)}
        />
      ) : null}

      <TDSectionHeader title="Account" />
      <TDListRow title="Membership" description={accountType[0].toUpperCase() + accountType.slice(1)} iconName="diamond-outline" right={<Ionicons name="chevron-forward" size={19} color={color.textMuted} />} onPress={() => open('Membership')} />
      {isAdmin ? <TDListRow title="Command Center" description={`${role} access is additive to this workspace.`} iconName="shield-checkmark-outline" right={<Ionicons name="chevron-forward" size={19} color={color.textMuted} />} onPress={() => open('Command Center')} /> : null}

      <TDSectionHeader title="Security and preferences" />
      {baseItems.map(([title, value, itemIcon]) => (
        <TDListRow key={title} accessibilityLabel={`Open ${title}`} description={value} iconName={itemIcon as keyof typeof Ionicons.glyphMap} onPress={() => open(title)} right={<Ionicons name="chevron-forward" size={19} color={color.textMuted} />} title={title} />
      ))}

      <TDSectionHeader title="Scanner and support" />
      <TDListRow title="Scanner settings" description="Camera, OCR, and offline replay preferences." iconName="scan-outline" right={<Ionicons name="chevron-forward" size={19} color={color.textMuted} />} onPress={() => router.push('/settings' as never)} />
      <TDListRow title="Support" description="Help, account questions, and product feedback." iconName="help-circle-outline" right={<TDBadge tone="neutral">Planned</TDBadge>} />

      <TDButton
        label={session ? 'Sign out' : 'Sign in to Trading Docks'}
        onPress={session ? signOut : () => router.push('/auth')}
        variant="secondary"
      />
      <TDText variant="caption" tone="muted" style={s.version}>Trading Docks Mobile Foundation 1.1</TDText>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: space.lg, gap: space.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10 },
  avatar: { width: 53, height: 53, borderRadius: radius.md, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 3 },
  name: { textTransform: 'capitalize' },
  version: { color: color.textMuted, textAlign: 'center', fontSize: 10, marginTop: 6 },
});
