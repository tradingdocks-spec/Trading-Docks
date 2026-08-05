import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '@/providers/auth';
import { AccountProvider } from '@/providers/account';
import { SessionProvider } from '@/features/sessions/session-provider';
import { AdminProvider } from '@/providers/admin';
import { BiometricGate } from '@/components/biometric-gate';
import { ScannerReplayBridge } from '@/components/scanner-replay-bridge';
import { color, space, type } from '@/design';

function AppFrame() {
  const { loading, biometricLocked } = useAuth();
  if (loading) return <View style={s.loading}><ActivityIndicator color={color.primaryBright} /><Text style={s.loadingText}>Restoring secure session...</Text></View>;
  if (biometricLocked) return <BiometricGate />;
  return <AdminProvider><AccountProvider><ScannerReplayBridge /><SessionProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', animationDuration: 240 }} /></SessionProvider></AccountProvider></AdminProvider>;
}

export default function RootLayout() {
  return <AuthProvider><AppFrame /></AuthProvider>;
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: color.canvas },
  loadingText: { ...type.caption, color: color.textMuted },
});
