import type { Session } from '@supabase/supabase-js';

export type AuthPreferenceSnapshot = {
  biometricEnabled: boolean;
};

export function resolveRestoredSessionState({
  session,
  discard,
  preferences,
  platform,
}: {
  session: Session | null;
  discard: boolean;
  preferences: AuthPreferenceSnapshot;
  platform: string;
}) {
  const restoredSession = discard ? null : session;
  return {
    session: restoredSession,
    biometricLocked: Boolean(restoredSession) && platform !== 'web' && preferences.biometricEnabled,
  };
}
