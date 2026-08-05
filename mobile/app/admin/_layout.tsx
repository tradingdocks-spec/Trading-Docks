import { Slot, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from '@/design';
import { useAdmin } from '@/providers/admin';
import { useAuth } from '@/providers/auth';
import { resolveProtectedRouteAccess } from '@/services/navigation-contract';

export default function AdminLayout() {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, loading, error, refresh } = useAdmin();
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
        <ActivityIndicator size="large" color={color.primaryBright} />
        <Text style={s.loading}>Verifying secure access...</Text>
      </View>
    );
  }

  if (!session) return null;

  if (!isAdmin) {
    return (
      <View style={s.center}>
        <Text style={s.lock}>Locked</Text>
        <Text style={s.title}>Admin access required</Text>
        <Text style={s.copy}>
          {error ?? 'This signed-in account does not have an administrative role.'}
        </Text>
        <Text style={s.hint}>
          Install the included Supabase migration, then promote your account using the owner setup command in ADMIN-SETUP.md.
        </Text>
        <Pressable onPress={refresh} style={s.button} accessibilityRole="button">
          <Text style={s.buttonText}>Check access again</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)/profile')} accessibilityRole="link">
          <Text style={s.link}>Return to profile</Text>
        </Pressable>
      </View>
    );
  }

  return <Slot />;
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: color.canvas, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  loading: { ...type.body, color: color.textSecondary, marginTop: space.md },
  lock: { ...type.label, color: color.warning, marginBottom: space.md },
  title: { ...type.heading, color: color.text, textAlign: 'center' },
  copy: { ...type.body, color: color.textSecondary, textAlign: 'center', maxWidth: 480, marginTop: space.sm },
  hint: { ...type.caption, color: color.textMuted, textAlign: 'center', maxWidth: 520, marginTop: space.md },
  button: { height: 52, borderRadius: radius.md, backgroundColor: color.primary, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center', marginTop: space.lg },
  buttonText: { color: '#fff', fontWeight: '900' },
  link: { color: color.primaryBright, fontWeight: '800', marginTop: space.lg },
});
