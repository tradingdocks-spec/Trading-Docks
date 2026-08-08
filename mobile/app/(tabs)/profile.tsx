import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TDBadge, TDButton, TDCard, TDListRow, TDNavigationHeader, TDSectionHeader, TDStatusIndicator, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';
import { getMobileAppVersionInfo, getMobileReleaseLinks, MOBILE_CANONICAL_SITE_URL } from '@/services/mobile-release-config';
import { getMembershipPlan } from '@/services/membership-catalog';
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
  const links = getMobileReleaseLinks();
  const version = getMobileAppVersionInfo();

  const signOut = async () => {
    await supabase?.auth.signOut();
    router.replace('/welcome');
  };

  const open = (title: string) => {
    if (title === 'Command Center') void Linking.openURL(`${MOBILE_CANONICAL_SITE_URL}/dashboard/admin`);
    else if (title === 'Membership') router.push('/plans');
    else if (title === 'Settings' || title === 'Security' || title === 'Appearance' || title === 'Notifications') router.push('/settings');
  };

  const openLink = (url: string) => {
    void Linking.openURL(url);
  };

  const accountLabel = accountType[0].toUpperCase() + accountType.slice(1);
  const currentPlan = getMembershipPlan(accountType);

  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 26, 56), paddingBottom: getMobileScrollBottomInset(insets.bottom) }]} showsVerticalScrollIndicator={false}>
      <TDNavigationHeader
        eyebrow="Profile"
        title="Account"
        subtitle="Membership, security, scanner preferences, and support."
      />
      <TDCard variant="floating" style={s.identity}>
        <View style={s.avatar}>
          <TDText variant="title">{(session?.user.email?.[0] ?? 'C').toUpperCase()}</TDText>
        </View>
        <View style={s.flex}>
          <TDText variant="title" style={s.name}>{session?.user.email?.split('@')[0] ?? 'Collector'}</TDText>
          <TDText variant="caption" tone="muted">{session?.user.email ?? 'Preview mode'}</TDText>
          <View style={s.identityMeta}>
            <TDStatusIndicator label={configured ? 'Connected' : 'Setup required'} tone={configured ? 'success' : 'warning'} />
            <TDBadge tone="info">{accountLabel}</TDBadge>
          </View>
        </View>
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

      <TDSectionHeader title="Essentials" />
      <TDListRow title="Manage Membership" description={`Current plan: ${currentPlan.name}`} iconName="diamond-outline" right={<Ionicons name="chevron-forward" size={19} color={color.textMuted} />} onPress={() => open('Membership')} />
      {isAdmin ? <TDListRow title="Open Headquarters" description={`${role} access opens the protected web Command Center.`} iconName="shield-checkmark-outline" right={<Ionicons name="open-outline" size={19} color={color.textMuted} />} onPress={() => open('Command Center')} /> : null}
      <TDListRow title="Settings" description="Security, notifications, appearance, and scanner preferences." iconName="settings-outline" right={<Ionicons name="chevron-forward" size={19} color={color.textMuted} />} onPress={() => open('Settings')} />

      <TDSectionHeader title="Preferences" />
      {baseItems.filter(([title]) => title !== 'Settings').map(([title, value, itemIcon]) => (
        <TDListRow key={title} accessibilityLabel={`Open ${title}`} description={value} iconName={itemIcon as keyof typeof Ionicons.glyphMap} onPress={() => open(title)} right={<Ionicons name="chevron-forward" size={19} color={color.textMuted} />} title={title} />
      ))}
      <TDListRow title="Scanner settings" description="Camera, OCR, and offline replay preferences." iconName="scan-outline" right={<Ionicons name="chevron-forward" size={19} color={color.textMuted} />} onPress={() => router.push('/settings' as never)} />

      <TDSectionHeader title="Support and legal" />
      <TDListRow title="Support" description="Help, account questions, and product feedback." iconName="help-circle-outline" right={<Ionicons name="open-outline" size={19} color={color.textMuted} />} onPress={() => openLink(links.support.url)} />
      <TDListRow title="Privacy Policy" description={links.privacy.configuredFromEnv ? 'Configured for this build.' : 'Using documented Trading Docks legal page.'} iconName="shield-checkmark-outline" right={<Ionicons name="open-outline" size={19} color={color.textMuted} />} onPress={() => openLink(links.privacy.url)} />
      <TDListRow title="Terms of Service" description={links.terms.configuredFromEnv ? 'Configured for this build.' : 'Using documented Trading Docks legal page.'} iconName="document-text-outline" right={<Ionicons name="open-outline" size={19} color={color.textMuted} />} onPress={() => openLink(links.terms.url)} />
      <TDListRow title="Delete Account" description="Request account deletion and review data consequences." iconName="trash-outline" right={<Ionicons name="chevron-forward" size={19} color={color.textMuted} />} onPress={() => router.push('/account-delete' as never)} />

      <TDSectionHeader title="About" />
      <TDCard style={s.aboutCard}>
        <TDText variant="title">{version.name}</TDText>
        <TDText variant="small" tone="muted">Version {version.version}</TDText>
        <TDText variant="caption" tone="muted">Build {version.build}</TDText>
      </TDCard>

      <TDButton
        label={session ? 'Sign out' : 'Sign in to Trading Docks'}
        onPress={session ? signOut : () => router.push('/auth')}
        variant="secondary"
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: space.lg, gap: space.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10 },
  avatar: { width: 53, height: 53, borderRadius: radius.md, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 3 },
  identityMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  name: { textTransform: 'capitalize' },
  aboutCard: { gap: space.xs },
});
