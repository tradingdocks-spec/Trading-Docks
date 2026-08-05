import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAccount } from '@/providers/account';
import { retryQueuedScannerAdds, type ScannerReplayTrigger } from '@/services/scanner-replay';

export function ScannerReplayBridge() {
  const { accountType, ready } = useAccount();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!ready || !supabase) return;
    const client = supabase;

    const replay = async (trigger: ScannerReplayTrigger, userId?: string | null) => {
      if (!userId || inFlight.current) return;
      inFlight.current = true;
      try {
        await retryQueuedScannerAdds({ userId, membershipTier: accountType, trigger });
      } catch (error) {
        console.warn('[scanner-replay] replay trigger failed', {
          trigger,
          message: error instanceof Error ? error.message : 'Unknown scanner replay failure.',
        });
      } finally {
        inFlight.current = false;
      }
    };

    void client.auth.getSession().then(({ data }) => replay('session_restore', data.session?.user.id));
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      void replay('session_restore', session?.user.id);
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void client.auth.getUser().then(({ data }) => replay('app_resume', data.user?.id));
    });
    const onlineListener = () => {
      void client.auth.getUser().then(({ data }) => replay('network_reconnect', data.user?.id));
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', onlineListener);
    }

    return () => {
      authListener.subscription.unsubscribe();
      appStateSubscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', onlineListener);
      }
    };
  }, [accountType, ready]);

  return null;
}
