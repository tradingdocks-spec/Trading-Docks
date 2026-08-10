import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Alert, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { TDBadge, TDButton, TDCard, TDIconButton, TDNavigationHeader, TDSectionHeader, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { getMobileReleaseLinks } from '@/services/mobile-release-config';
import { useAuth } from '@/providers/auth';

const consequences = [
  'Account access will be disabled after the approved backend deletion flow is completed.',
  'Collection, storage, binder, wishlist, scanner, and workspace data may be removed or retained only when required for legal, tax, payment, security, or abuse-prevention reasons.',
  'Store workspaces may require owner transfer or separate business review before deletion.',
  'Active subscriptions must be cancelled through the billing provider before paid access is removed.',
] as const;

export default function AccountDelete() {
  const { session } = useAuth();
  const links = getMobileReleaseLinks();

  const requestDeletion = () => {
    Alert.alert(
      'Request account deletion',
      'Trading Docks does not yet expose a safe self-service deletion endpoint in mobile. Contact support to start the reviewed deletion process.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Contact support', onPress: () => void Linking.openURL(deletionRequestUrl(links.support.url, session?.user.email ?? null)) },
      ],
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <TDNavigationHeader
          eyebrow="Account"
          title="Delete account"
          subtitle="Review what happens before starting an account deletion request."
          leftAction={<TDIconButton label="Back" iconName="chevron-back" onPress={() => router.back()} />}
          rightAction={<TDBadge tone="warning">Review required</TDBadge>}
        />

        <TDCard variant="floating" style={s.warningCard}>
          <View style={s.warningIcon}>
            <Ionicons name="warning-outline" size={22} color={color.warning} />
          </View>
          <View style={s.flex}>
            <TDText variant="title">Deletion is not instant</TDText>
            <TDText variant="small" tone="muted">
              Mobile account creation is available, so account deletion must be clear and recoverable. The safe backend self-service endpoint is not implemented yet.
            </TDText>
          </View>
        </TDCard>

        <View style={s.section}>
          <TDSectionHeader title="Consequences" />
          {consequences.map((item) => (
            <View key={item} style={s.bulletRow}>
              <View style={s.bullet} />
              <TDText variant="small" tone="secondary" style={s.flex}>{item}</TDText>
            </View>
          ))}
        </View>

        <TDCard style={s.section}>
          <TDText variant="label" tone="muted">Current status</TDText>
          <TDText variant="small">
            Backend self-service deletion is Planned. Support-assisted deletion is the current safe release path.
          </TDText>
          <TDText variant="caption" tone="muted">
            Signed-in email: {session?.user.email ?? 'Not signed in'}
          </TDText>
        </TDCard>

        <TDButton label="Request deletion through support" variant="danger" iconName="mail-outline" onPress={requestDeletion} />
        <TDButton label="Cancel" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function deletionRequestUrl(supportUrl: string, email: string | null) {
  if (!supportUrl.startsWith('mailto:')) return supportUrl;
  const subject = encodeURIComponent('Trading Docks account deletion request');
  const body = encodeURIComponent(`Please help me delete my Trading Docks account.${email ? `\n\nAccount email: ${email}` : ''}`);
  return `${supportUrl}?subject=${subject}&body=${body}`;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.lg, padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  warningCard: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  warningIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.warning + '18' },
  section: { gap: space.sm },
  bulletRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  bullet: { width: 7, height: 7, borderRadius: 7, marginTop: 7, backgroundColor: color.warning },
  flex: { flex: 1, minWidth: 0 },
});
