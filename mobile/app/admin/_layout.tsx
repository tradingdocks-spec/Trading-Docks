import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { TDButton, TDErrorState, TDLoadingState, TDText } from '@/components/design-system';
import { color, space } from '@/design';
import { useAdmin } from '@/providers/admin';
import { useAuth } from '@/providers/auth';
import { MOBILE_CANONICAL_SITE_URL } from '@/services/mobile-release-config';
import { resolveProtectedRouteAccess } from '@/services/navigation-contract';

export default function AdminLayout() {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, loading, error, refresh, role } = useAdmin();
  const access = resolveProtectedRouteAccess({
    authLoading,
    sessionExists: Boolean(session),
    adminLoading: loading,
    isAdmin,
    requiresAdmin: true,
  });

  useEffect(() => {
    if (access.state === 'redirect') router.replace(access.route);
  }, [access]);

  if (access.state === 'loading') {
    return (
      <View style={s.center}>
        <TDLoadingState title="Checking Command Center access" message="Verifying your signed-in role before showing protected tools." />
      </View>
    );
  }

  if (!session) return null;

  if (!isAdmin) {
    return (
      <View style={s.center}>
        <TDErrorState
          title="Command Center access required"
          message={error ?? 'This account does not currently have an administrative role.'}
          action={(
            <View style={s.actions}>
              <TDButton label="Check again" variant="secondary" onPress={refresh} />
              <TDButton label="Return to profile" variant="ghost" onPress={() => router.replace('/(tabs)/profile')} />
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={s.center}>
      <View style={s.handoff}>
        <TDText variant="caption" tone="info">Headquarters</TDText>
        <TDText variant="heading">Command Center is web-only</TDText>
        <TDText variant="small" tone="muted" style={s.copy}>
          {role ? `${role} access is available from the protected Trading Docks Headquarters.` : 'Platform administration is available from the protected Trading Docks Headquarters.'}
        </TDText>
        <View style={s.actions}>
          <TDButton label="Open Headquarters" iconName="open-outline" onPress={() => void Linking.openURL(`${MOBILE_CANONICAL_SITE_URL}/dashboard/admin`)} />
          <TDButton label="Return to profile" variant="secondary" onPress={() => router.replace('/(tabs)/profile')} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: color.canvas, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  handoff: { width: '100%', maxWidth: 440, gap: space.md, alignItems: 'stretch' },
  actions: { gap: space.sm, alignSelf: 'stretch' },
  copy: { textAlign: 'center' },
});
