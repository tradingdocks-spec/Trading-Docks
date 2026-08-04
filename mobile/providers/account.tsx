import { appStorage } from '@/services/storage/app-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type AccountType = 'free' | 'collector' | 'seller' | 'store';
type AccountState = { accountType: AccountType; ready: boolean; setAccountType: (type: AccountType) => Promise<void> };
const AccountContext = createContext<AccountState>({ accountType: 'free', ready: false, setAccountType: async () => {} });
const KEY = 'trading-docks-account-type';

export function AccountProvider({ children }: PropsWithChildren) {
  const [accountType, setType] = useState<AccountType>('free');
  const [ready, setReady] = useState(false);
  useEffect(() => { appStorage.getItem(KEY).then(value => { if (value) setType(value as AccountType); setReady(true); }); }, []);
  const setAccountType = async (type: AccountType) => { setType(type); await appStorage.setItem(KEY, type); };
  const value = useMemo(() => ({ accountType, ready, setAccountType }), [accountType, ready]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
export const useAccount = () => useContext(AccountContext);
