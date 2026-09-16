import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { TDBadge, TDButton, TDIconButton, TDListRow, TDNavigationHeader, TDSectionHeader, TDStatusIndicator, TDText } from '@/components/design-system';
import { color, space } from '@/design';
import { getMobileAppVersionInfo, getMobileReleaseLinks, isDevelopmentToolEnabled, MOBILE_PUBLIC_ENV_KEYS } from '@/services/mobile-release-config';
import {
  DEFAULT_SCANNER_FEEDBACK_PREFERENCES,
  loadScannerFeedbackPreferences,
  saveScannerFeedbackPreferences,
  type ScannerFeedbackPreferences,
} from '@/services/scanner-feedback-preferences';

const settingRows: {
  title: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
  section: 'Security' | 'Preferences' | 'Scanner';
  status: string;
  tone: 'success' | 'info' | 'warning' | 'neutral';
  devOnly?: boolean;
}[] = [
  { title: 'Biometric unlock', description: 'Available when enabled from the sign-in security flow on this device.', iconName: 'finger-print-outline', section: 'Security', status: 'Session lock', tone: 'info' },
  { title: 'Offline scanner sync', description: 'Queued scanner and collection changes retry when the authenticated user reconnects.', iconName: 'cloud-upload-outline', section: 'Preferences', status: 'Automatic', tone: 'success' },
  { title: 'Haptic feedback', description: 'Primary scanner, tab, and confirmation actions use restrained native haptics.', iconName: 'phone-portrait-outline', section: 'Preferences', status: 'Built in', tone: 'success' },
  { title: 'Notifications', description: 'Push notification preferences are managed from the device settings until mobile notifications are connected.', iconName: 'notifications-outline', section: 'Preferences', status: 'Device', tone: 'neutral' },
  { title: 'Scanner diagnostics', description: 'Development-only scanner analysis details.', iconName: 'bug-outline', section: 'Scanner', status: 'Dev only', tone: 'warning', devOnly: true },
];

export default function Settings() {
  const diagnosticsEnabled = isDevelopmentToolEnabled(MOBILE_PUBLIC_ENV_KEYS.scannerDiagnostics);
  const links = getMobileReleaseLinks();
  const version = getMobileAppVersionInfo();
  const [scannerPreferences, setScannerPreferences] = useState<ScannerFeedbackPreferences>(DEFAULT_SCANNER_FEEDBACK_PREFERENCES);

  useEffect(() => {
    let active = true;
    void loadScannerFeedbackPreferences().then((preferences) => {
      if (!active) return;
      setScannerPreferences(preferences);
    });
    return () => {
      active = false;
    };
  }, []);

  const updatePreference = (key: keyof ScannerFeedbackPreferences, value: boolean) => {
    setScannerPreferences((current) => {
      const next = { ...current, [key]: value };
      void saveScannerFeedbackPreferences(next);
      return next;
    });
  };

  const visibleRows = settingRows.filter((row) => !row.devOnly || diagnosticsEnabled);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <TDNavigationHeader
          eyebrow="Settings"
          title="Preferences and security"
          subtitle="Keep device behavior clear, recoverable, and honest."
          leftAction={<TDIconButton label="Back" iconName="chevron-back" onPress={() => router.back()} />}
          rightAction={<TDBadge tone={diagnosticsEnabled ? 'warning' : 'neutral'}>{diagnosticsEnabled ? 'Dev diagnostics' : 'Standard'}</TDBadge>}
        />

        <View style={s.hero}>
          <TDStatusIndicator label="Membership visible from Profile and Plans" tone="info" />
          <TDStatusIndicator label="Scanner diagnostics hidden unless explicitly enabled" tone={diagnosticsEnabled ? 'warning' : 'success'} />
        </View>

        <View style={s.section}>
          <TDSectionHeader title="Scanner feedback" />
          <TDListRow
            title="Visual confirmation"
            description="Show a compact card acknowledgement after a successful scan."
            iconName="scan-outline"
            right={<Switch value={scannerPreferences.visualConfirmation} onValueChange={(value) => updatePreference('visualConfirmation', value)} trackColor={{ false: color.border, true: color.primary }} thumbColor={color.text} />}
          />
          <TDListRow
            title="Audio confirmation"
            description="Play a short success tone after accepted scans. Requires a native audio dependency."
            iconName="musical-notes-outline"
            right={<Switch value={scannerPreferences.audioConfirmation} onValueChange={(value) => updatePreference('audioConfirmation', value)} trackColor={{ false: color.border, true: color.primary }} thumbColor={color.text} />}
          />
          <TDListRow
            title="Haptic feedback"
            description="Use restrained native haptics for success, review, and error states."
            iconName="phone-portrait-outline"
            right={<Switch value={scannerPreferences.hapticConfirmation} onValueChange={(value) => updatePreference('hapticConfirmation', value)} trackColor={{ false: color.border, true: color.primary }} thumbColor={color.text} />}
          />
        </View>

        <View style={s.section}>
          <TDSectionHeader title="Scanner behavior" />
          <TDListRow
            title="Prevent duplicate scans"
            description="Block repeated captures of the same card presentation while it remains in frame."
            iconName="scan-circle-outline"
            right={<Switch value={scannerPreferences.blockDuplicateScans} onValueChange={(value) => updatePreference('blockDuplicateScans', value)} trackColor={{ false: color.border, true: color.primary }} thumbColor={color.text} />}
          />
          <TDListRow
            title="Require next card"
            description="Wait for a meaningful card change before rearming the scanner."
            iconName="copy-outline"
            right={<Switch value={scannerPreferences.requireCardChangeBeforeRearm} onValueChange={(value) => updatePreference('requireCardChangeBeforeRearm', value)} trackColor={{ false: color.border, true: color.primary }} thumbColor={color.text} />}
          />
        </View>

        {(['Security', 'Preferences', 'Scanner'] as const).map((section) => {
          const rows = visibleRows.filter((row) => row.section === section);
          if (!rows.length) return null;
          return (
            <View key={section} style={s.section}>
              <TDSectionHeader title={section} />
              {rows.map((row) => (
                <TDListRow
                  key={row.title}
                  title={row.title}
                  description={row.description}
                  iconName={row.iconName}
                  right={<TDBadge tone={row.tone}>{row.status}</TDBadge>}
                />
              ))}
            </View>
          );
        })}

        <View style={s.section}>
          <TDSectionHeader title="Support and privacy" />
          <TDListRow title="Privacy" description="Camera captures are not retained by default." iconName="shield-checkmark-outline" right={<TDBadge tone="success">Protected</TDBadge>} />
          <TDListRow title="Support" description="Help, account questions, and product feedback." iconName="help-circle-outline" right={<Ionicons name="open-outline" size={19} color={color.textMuted} />} onPress={() => void Linking.openURL(links.support.url)} />
          <TDListRow title="Privacy Policy" description={links.privacy.url} iconName="shield-checkmark-outline" right={<Ionicons name="open-outline" size={19} color={color.textMuted} />} onPress={() => void Linking.openURL(links.privacy.url)} />
          <TDListRow title="Terms of Service" description={links.terms.url} iconName="document-text-outline" right={<Ionicons name="open-outline" size={19} color={color.textMuted} />} onPress={() => void Linking.openURL(links.terms.url)} />
          <TDListRow title="Delete Account" description="Request account deletion and review consequences." iconName="trash-outline" right={<Ionicons name="chevron-forward" size={19} color={color.textMuted} />} onPress={() => router.push('/account-delete' as never)} />
        </View>

        <View style={s.section}>
          <TDSectionHeader title="About" />
          <TDListRow title="Trading Docks" description={`Version ${version.version} - Build ${version.build}`} iconName="information-circle-outline" right={<TDBadge tone="neutral">{version.name}</TDBadge>} />
        </View>

        <TDButton label="Return to account" variant="secondary" iconName="person-outline" onPress={() => router.push('/(tabs)/profile' as never)} />
        <TDText variant="caption" tone="muted" style={s.note}>
          Settings only show production-backed behavior. Configuration that belongs to Headquarters or iOS Settings stays outside mobile V1.
        </TDText>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.lg, padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  hero: { gap: space.xs },
  section: { gap: space.xs },
  note: { textAlign: 'center' },
});
