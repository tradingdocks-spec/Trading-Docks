import { Redirect } from 'expo-router';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { Logo } from '@/components/primitives';
import { TDText } from '@/components/design-system';
import { color, space } from '@/design';
import { useAuth } from '@/providers/auth';

export default function LaunchRoute() {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <Logo />
          <View style={s.copy}>
            <TDText variant="label" tone="info" style={s.label}>Trading Docks</TDText>
            <TDText variant="small" tone="muted" style={s.message}>Preparing your workspace</TDText>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return <Redirect href={session ? '/(tabs)' : '/welcome'} />;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.lg },
  copy: { alignItems: 'center', gap: space.xs },
  label: { letterSpacing: 2 },
  message: { textAlign: 'center' },
});
