import { supabase } from '@/lib/supabase';

export type AdminUser = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  account_type: string;
  subscription_status: string;
  role: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

export type AuditEntry = {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function getAdminOverview() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const [{ data: metrics, error: metricsError }, { data: recent, error: recentError }] = await Promise.all([
    supabase.rpc('admin_overview'),
    supabase.rpc('admin_list_users', { search_text: '', result_limit: 5 }),
  ]);
  if (metricsError) throw metricsError;
  if (recentError) throw recentError;
  return { metrics: (metrics ?? {}) as Record<string, number>, recent: (recent ?? []) as AdminUser[] };
}

export async function listAdminUsers(search = '') {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('admin_list_users', { search_text: search.trim(), result_limit: 100 });
  if (error) throw error;
  return (data ?? []) as AdminUser[];
}

export async function listAuditEntries() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}

export async function updateUserAccess(userId: string, accountType: string, subscriptionStatus: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('admin_update_user_access', {
    target_user_id: userId,
    next_account_type: accountType,
    next_subscription_status: subscriptionStatus,
  });
  if (error) throw error;
}
