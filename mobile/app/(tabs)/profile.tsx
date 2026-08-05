import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TDBadge, TDButton, TDCard, TDIconRow, TDSectionHeader, TDText } from '@/components/design-system';
import { Logo } from '@/components/primitives';
import { color, radius, space } from '@/design';
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
  const { session, configured } = useAuth();
  const { isAdmin, role } = useAdmin();
  const { accountType } = useAccount();
  const { activeSession } = useWorkSession();
  const items = [
    ...(isAdmin ? [['Command Center', `${role} access`, 'shield-checkmark-outline'] as const] : []),
    ['Membership', accountType[0].toUpperCase() + accountType.slice(1), 'diamond-outline'] as const,
    ...baseItems,
  ];

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
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Logo />
      <View style={s.identity}>
        <View style={s.avatar}>
          <Text style={s.initial}>{(session?.user.email?.[0] ?? 'C').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{session?.user.email?.split('@')[0] ?? 'Collector'}</Text>
          <Text style={s.email}>{session?.user.email ?? 'Preview mode'}</Text>
        </View>
        <TDBadge tone={session ? 'success' : 'warning'}>{session ? 'Signed in' : 'Preview'}</TDBadge>
      </View>

      {activeSession ? (
        <TDCard variant="elevated" style={s.sessionCard}>
          <View style={s.sessionDot} />
          <View style={{ flex: 1 }}>
            <TDText variant="label" tone="success">Current session</TDText>
            <TDText variant="title">{activeSession.name}</TDText>
            <TDText variant="caption" tone="muted">{activeSession.status === 'paused' ? 'Paused and saved locally' : 'Active - available offline'}</TDText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={color.info} />
        </TDCard>
      ) : null}

      <TDCard>
        <View style={s.row}>
          <View>
            <TDText variant="label" tone="muted">Mobile connection</TDText>
            <TDText variant="title">{configured ? 'Supabase configured' : 'Setup required'}</TDText>
            <TDText variant="caption" tone="muted">{configured ? 'Authentication and account sync are ready.' : 'Add Expo environment variables, then restart.'}</TDText>
          </View>
          <Ionicons name={configured ? 'checkmark-circle' : 'alert-circle'} size={25} color={configured ? color.success : color.warning} />
        </View>
      </TDCard>

      <TDSectionHeader title="Account" />
      {items.map(([title, value, itemIcon]) => (
        <TDIconRow
          key={title}
          accessibilityLabel={`Open ${title}`}
          description={value}
          iconName={itemIcon as keyof typeof Ionicons.glyphMap}
          onPress={() => open(title)}
          right={<Ionicons name="chevron-forward" size={19} color={color.textMuted} />}
          title={title}
        />
      ))}

      <TDButton
        label={session ? 'Sign out' : 'Sign in to Trading Docks'}
        onPress={session ? signOut : () => router.push('/auth')}
        variant="secondary"
      />
      <Text style={s.version}>Trading Docks Mobile Foundation 1.1</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { padding: 20, paddingTop: 58, paddingBottom: 140, gap: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10 },
  avatar: { width: 53, height: 53, borderRadius: radius.md, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontSize: 22, fontWeight: '900' },
  name: { color: color.text, fontSize: 17, fontWeight: '900', textTransform: 'capitalize' },
  email: { color: color.textMuted, fontSize: 11, marginTop: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  version: { color: color.textMuted, textAlign: 'center', fontSize: 10, marginTop: 6 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.surfaceRaised },
  sessionDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.success },
});
