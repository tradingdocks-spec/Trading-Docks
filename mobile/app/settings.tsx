import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { TDBadge, TDButton, TDIconButton, TDListRow, TDNavigationHeader, TDSectionHeader, TDStatusIndicator, TDText } from '@/components/design-system';
import { color, space } from '@/design';
import { getMobileAppVersionInfo, getMobileReleaseLinks, isDevelopmentToolEnabled, MOBILE_PUBLIC_ENV_KEYS } from '@/services/mobile-release-config';

type SettingKey = 'biometric' | 'sync' | 'haptics' | 'notifications' | 'diagnostics';

const settingRows: {
  key: SettingKey;
  title: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
  section: 'Security' | 'Preferences' | 'Scanner';
  devOnly?: boolean;
}[] = [
  { key: 'biometric', title: 'Biometric unlock', description: 'Protect a saved session with Face ID or device biometrics.', iconName: 'finger-print-outline', section: 'Security' },
  { key: 'sync', title: 'Background sync', description: 'Retry saved scanner and session work when a connection returns.', iconName: 'cloud-upload-outline', section: 'Preferences' },
  { key: 'haptics', title: 'Haptic feedback', description: 'Use subtle tactile confirmation for key actions.', iconName: 'phone-portrait-outline', section: 'Preferences' },
  { key: 'notifications', title: 'Notifications', description: 'Account, scanner, and session alerts.', iconName: 'notifications-outline', section: 'Preferences' },
  { key: 'diagnostics', title: 'Scanner diagnostics', description: 'Development-only scanner analysis details.', iconName: 'bug-outline', section: 'Scanner', devOnly: true },
];

const initialValues: Record<SettingKey, boolean> = {
  biometric: false,
  sync: true,
  haptics: true,
  notifications: false,
  diagnostics: false,
};

export default function Settings() {
  const [values, setValues] = useState(initialValues);
  const diagnosticsEnabled = isDevelopmentToolEnabled(MOBILE_PUBLIC_ENV_KEYS.scannerDiagnostics);
  const links = getMobileReleaseLinks();
  const version = getMobileAppVersionInfo();

  const setValue = (key: SettingKey, value: boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
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

        {(['Security', 'Preferences', 'Scanner'] as const).map((section) => {
          const rows = visibleRows.filter((row) => row.section === section);
          if (!rows.length) return null;
          return (
            <View key={section} style={s.section}>
              <TDSectionHeader title={section} />
              {rows.map((row) => (
                <TDListRow
                  key={row.key}
                  title={row.title}
                  description={row.description}
                  iconName={row.iconName}
                  right={(
                    <Switch
                      accessibilityLabel={row.title}
                      accessibilityRole="switch"
                      value={values[row.key]}
                      onValueChange={(value) => setValue(row.key, value)}
                      trackColor={{ false: color.border, true: color.primary }}
                    />
                  )}
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

        <TDButton label="Return to profile" variant="secondary" iconName="person-outline" onPress={() => router.push('/(tabs)/profile' as never)} />
        <TDText variant="caption" tone="muted" style={s.note}>
          Some controls are foundation preferences until production provider configuration and native release QA are complete.
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
