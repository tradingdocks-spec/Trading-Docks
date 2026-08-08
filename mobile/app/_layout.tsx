import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '@/providers/auth';
import { AccountProvider } from '@/providers/account';
import { SessionProvider } from '@/features/sessions/session-provider';
import { AdminProvider } from '@/providers/admin';
import { BiometricGate } from '@/components/biometric-gate';
import { ScannerReplayBridge } from '@/components/scanner-replay-bridge';
import { Logo } from '@/components/primitives';
import { TDButton, TDCard, TDText } from '@/components/design-system';
import { TradingDocksLaunchChoreography } from '@/components/signature-loading';
import { color, space } from '@/design';
import { releaseErrorState, releaseLoadingState } from '@/services/mobile-release-ux';

function AppFrame() {
  const { loading, biometricLocked } = useAuth();
  const loadingCopy = releaseLoadingState('profile');
  if (loading) {
    return (
      <View style={s.loading}>
        <TradingDocksLaunchChoreography message={loadingCopy.message} />
      </View>
    );
  }
  if (biometricLocked) return <BiometricGate />;
  return <AdminProvider><AccountProvider><ScannerReplayBridge /><SessionProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', animationDuration: 240 }} /></SessionProvider></AccountProvider></AdminProvider>;
}

export default function RootLayout() {
  return <AuthProvider><AppFrame /></AuthProvider>;
}

export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  const errorCopy = releaseErrorState('query_failed');
  return (
    <View style={s.loading}>
      <TDCard variant="floating" style={s.errorCard}>
        <Logo />
        <TDText variant="title" style={s.errorText}>Something went wrong</TDText>
        <TDText variant="small" tone="muted" style={s.errorText}>
          {errorCopy.message}
        </TDText>
        <View style={s.errorActions}>
          <TDButton label="Try again" onPress={retry} />
          <TDButton label="Go Home" variant="secondary" onPress={() => router.replace('/(tabs)')} />
        </View>
      </TDCard>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: color.canvas },
  errorCard: { width: '100%', maxWidth: 360, gap: space.md, alignItems: 'center' },
  errorText: { textAlign: 'center' },
  errorActions: { width: '100%', gap: space.sm },
});
