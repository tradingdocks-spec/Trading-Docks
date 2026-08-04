import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AdminRole } from '@/constants/admin';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

type AdminState = {
  role: AdminRole | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const AdminContext = createContext<AdminState>({ role: null, isAdmin: false, loading: true, error: null, refresh: async () => {} });

export function AdminProvider({ children }: PropsWithChildren) {
  const { session, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (authLoading) return;
    if (!session || !supabase) { setRole(null); setLoading(false); setError(null); return; }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (queryError) {
      setRole(null);
      setError(queryError.code === '42P01' ? 'Admin database migration has not been installed.' : queryError.message);
    } else {
      setRole((data?.role as AdminRole | undefined) ?? null);
      setError(null);
    }
    setLoading(false);
  }, [authLoading, session]);

  useEffect(() => { refresh(); }, [refresh]);
  const value = useMemo(() => ({ role, isAdmin: Boolean(role), loading, error, refresh }), [role, loading, error, refresh]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export const useAdmin = () => useContext(AdminContext);
