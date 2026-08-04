import type { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { authPreferences } from '@/services/auth-preferences';

type AuthState = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  biometricLocked: boolean;
  biometricError: string | null;
  unlockWithBiometrics: () => Promise<boolean>;
};
const AuthContext = createContext<AuthState>({ session: null, loading: true, configured: false, biometricLocked: false, biometricError: null, unlockWithBiometrics: async () => false });

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  const unlockWithBiometrics = useCallback(async () => {
    if (Platform.OS === 'web') { setBiometricLocked(false); return true; }
    try {
      const LocalAuthentication = await import('expo-local-authentication');
      const [hasHardware, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hasHardware || !enrolled) {
        setBiometricError('Face ID or biometric authentication is not configured on this device.');
        return false;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: Platform.OS === 'ios' ? 'Unlock Trading Docks with Face ID' : 'Unlock Trading Docks',
        cancelLabel: 'Use password',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setBiometricLocked(false);
        setBiometricError(null);
        return true;
      }
      setBiometricError('Trading Docks is still locked. Try again or sign in with your password.');
      return false;
    } catch {
      setBiometricError('Biometric authentication is unavailable in this build.');
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!supabase) { setLoading(false); return; }

    const initialize = async () => {
      const { data } = await supabase.auth.getSession();
      const discard = Boolean(data.session) && await authPreferences.shouldDiscardRestoredSession();
      if (discard) await supabase.auth.signOut({ scope: 'local' });
      const prefs = await authPreferences.load();
      if (mounted) {
        const restored = discard ? null : data.session;
        setSession(restored);
        setBiometricLocked(Boolean(restored) && Platform.OS !== 'web' && prefs.biometricEnabled);
        setLoading(false);
      }
    };
    initialize();

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      setSession(next);
      if (event === 'SIGNED_OUT') setBiometricLocked(false);
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  const value = useMemo(() => ({ session, loading, configured: Boolean(supabase), biometricLocked, biometricError, unlockWithBiometrics }), [session, loading, biometricLocked, biometricError, unlockWithBiometrics]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
