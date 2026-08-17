import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from '@/providers/auth';
import { AccountProvider } from '@/providers/account';
import { SessionProvider } from '@/features/sessions/session-provider';
import { AdminProvider } from '@/providers/admin';
import { BiometricGate } from '@/components/biometric-gate';
import { ScannerReplayBridge } from '@/components/scanner-replay-bridge';
import { Logo } from '@/components/primitives';
import { color, space, type as typography } from '@/design';
import { releaseErrorState, releaseLoadingState } from '@/services/mobile-release-ux';
import { radius } from '@/design';
import { logStartupCheckpoint } from '@/services/startup-telemetry';

logStartupCheckpoint('JS bundle loaded');

function AppFrame() {
  const { loading, biometricLocked } = useAuth();
  const hasLoggedInitRef = useRef(false);
  useEffect(() => {
    logStartupCheckpoint('Root AppFrame mounted');
  }, []);

  useEffect(() => {
    if (!loading && !biometricLocked && !hasLoggedInitRef.current) {
      hasLoggedInitRef.current = true;
      logStartupCheckpoint('Router ready');
      logStartupCheckpoint('Initial screen rendered');
    }
  }, [biometricLocked, loading]);

  const loadingCopy = releaseLoadingState('profile');
  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={color.primaryBright} />
        <Text style={s.loadingText}>{loadingCopy.message}</Text>
        <Logo compact />
      </View>
    );
  }
  if (biometricLocked) return <BiometricGate />;
  return <AdminProvider><AccountProvider><ScannerReplayBridge /><SessionProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', animationDuration: 240 }} /></SessionProvider></AccountProvider></AdminProvider>;
}

export default function RootLayout() {
  useEffect(() => {
    logStartupCheckpoint('Root layout mounted');
  }, []);
  return <AuthProvider><AppFrame /></AuthProvider>;
}

export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  const errorCopy = releaseErrorState('query_failed');
  return (
    <View style={s.loading}>
      <View style={s.errorCard}>
        <Logo />
        <Text style={s.errorTitle}>Something went wrong</Text>
        <Text style={s.errorText}>
          {errorCopy.message}
        </Text>
        <View style={s.errorActions}>
          <Pressable style={s.buttonPrimary} onPress={retry}>
            <Text style={s.buttonPrimaryText}>Try again</Text>
          </Pressable>
          <Pressable style={s.buttonSecondary} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.buttonSecondaryText}>Go Home</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: color.canvas, paddingHorizontal: space.md },
  loadingText: { ...typography.caption, color: color.textSecondary, textAlign: 'center' },
  errorCard: { width: '100%', maxWidth: 360, gap: space.md, alignItems: 'center', backgroundColor: color.surfaceRaised, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: space.lg },
  errorTitle: { ...typography.title, color: color.text, textAlign: 'center' },
  errorText: { textAlign: 'center' },
  errorActions: { width: '100%', gap: space.sm },
  buttonPrimary: { height: 46, borderRadius: radius.md, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  buttonPrimaryText: { ...typography.caption, color: '#fff' },
  buttonSecondary: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  buttonSecondaryText: { ...typography.caption, color: color.text },
});
