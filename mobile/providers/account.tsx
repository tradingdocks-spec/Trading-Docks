import { appStorage } from '@/services/storage/app-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import {
  loadMobileAccountAccessSnapshot,
  type MobileAccessClient,
  type MobileAccountAccessSnapshot,
} from '@/services/mobile-account-access';
import type { BillingStatus, MembershipTier, PlatformRole } from '@/services/platform-access';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AccountType = 'free' | 'collector' | 'seller' | 'store';
type AccountState = {
  accountType: AccountType;
  membershipTier: MembershipTier;
  billingStatus: BillingStatus;
  platformRole: PlatformRole;
  hasFullPlatformAccess: boolean;
  ready: boolean;
  source: MobileAccountAccessSnapshot['source'];
  error: string | null;
  refresh: () => Promise<void>;
  setAccountType: (type: AccountType) => Promise<void>;
};
const AccountContext = createContext<AccountState>({
  accountType: 'free',
  membershipTier: 'free',
  billingStatus: 'free',
  platformRole: 'user',
  hasFullPlatformAccess: false,
  ready: false,
  source: 'signed_out',
  error: null,
  refresh: async () => {},
  setAccountType: async () => {},
});
const KEY = 'trading-docks-account-type';

export function AccountProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [accountType, setType] = useState<AccountType>('free');
  const [membershipTier, setMembershipTier] = useState<MembershipTier>('free');
  const [billingStatus, setBillingStatus] = useState<BillingStatus>('free');
  const [platformRole, setPlatformRole] = useState<PlatformRole>('user');
  const [hasFullPlatformAccess, setHasFullPlatformAccess] = useState(false);
  const [source, setSource] = useState<MobileAccountAccessSnapshot['source']>('signed_out');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setReady(false);
    const local = await appStorage.getItem(KEY);
    const localAccountType = isAccountType(local) ? local : 'free';
    const snapshot = await loadMobileAccountAccessSnapshot({
      client: supabase as MobileAccessClient | null,
      userId: session?.user.id ?? null,
      localAccountType,
    });
    setType(snapshot.accountType);
    setMembershipTier(snapshot.membershipTier);
    setBillingStatus(snapshot.billingStatus);
    setPlatformRole(snapshot.platformRole);
    setHasFullPlatformAccess(snapshot.hasFullPlatformAccess);
    setSource(snapshot.source);
    setError(snapshot.warnings.length ? snapshot.warnings.join(', ') : null);
    if (snapshot.source === 'server') {
      await appStorage.setItem(KEY, snapshot.accountType);
    }
    setReady(true);
  }, [session?.user.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const setAccountType = async (type: AccountType) => {
    setType(type);
    setMembershipTier(type);
    setBillingStatus(type === 'free' ? 'free' : 'unknown');
    setPlatformRole('user');
    setHasFullPlatformAccess(false);
    setSource('local_fallback');
    await appStorage.setItem(KEY, type);
  };

  const value = useMemo(
    () => ({
      accountType,
      membershipTier,
      billingStatus,
      platformRole,
      hasFullPlatformAccess,
      ready,
      source,
      error,
      refresh,
      setAccountType,
    }),
    [accountType, billingStatus, error, hasFullPlatformAccess, membershipTier, platformRole, ready, refresh, source],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
export const useAccount = () => useContext(AccountContext);

function isAccountType(value: unknown): value is AccountType {
  return value === 'free' || value === 'collector' || value === 'seller' || value === 'store';
}
