import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TDBadge, TDButton, TDCard, TDSectionHeader } from '@/components/design-system';
import { Logo } from '@/components/primitives';
import { brand as B } from '@/constants/brand';
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
            <Text style={s.label}>CURRENT SESSION</Text>
            <Text style={s.cardTitle}>{activeSession.name}</Text>
            <Text style={s.meta}>{activeSession.status === 'paused' ? 'Paused and saved locally' : 'Active - available offline'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={B.cyan} />
        </TDCard>
      ) : null}

      <TDCard>
        <View style={s.row}>
          <View>
            <Text style={s.label}>MOBILE CONNECTION</Text>
            <Text style={s.cardTitle}>{configured ? 'Supabase configured' : 'Setup required'}</Text>
            <Text style={s.meta}>{configured ? 'Authentication and account sync are ready.' : 'Add Expo environment variables, then restart.'}</Text>
          </View>
          <Ionicons name={configured ? 'checkmark-circle' : 'alert-circle'} size={25} color={configured ? B.green : B.amber} />
        </View>
      </TDCard>

      <TDSectionHeader title="Account" />
      {items.map(([title, value, itemIcon]) => (
        <Pressable key={title} accessibilityRole="button" onPress={() => open(title)}>
          <TDCard style={s.item}>
            <View style={s.itemIcon}>
              <Ionicons name={itemIcon as keyof typeof Ionicons.glyphMap} size={20} color={B.cyan} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.itemTitle}>{title}</Text>
              <Text style={s.meta}>{value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={B.muted} />
          </TDCard>
        </Pressable>
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
  page: { flex: 1, backgroundColor: B.bg },
  content: { padding: 20, paddingTop: 58, paddingBottom: 140, gap: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10 },
  avatar: { width: 53, height: 53, borderRadius: 18, backgroundColor: B.blue, alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontSize: 22, fontWeight: '900' },
  name: { color: B.text, fontSize: 17, fontWeight: '900', textTransform: 'capitalize' },
  email: { color: B.muted, fontSize: 11, marginTop: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { color: B.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  cardTitle: { color: B.text, fontSize: 15, fontWeight: '900', marginTop: 7 },
  meta: { color: B.muted, fontSize: 11, marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  itemIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: B.blue + '20', alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: B.text, fontSize: 13, fontWeight: '900' },
  version: { color: B.muted, textAlign: 'center', fontSize: 10, marginTop: 6 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: B.surface2 },
  sessionDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: B.green },
});
