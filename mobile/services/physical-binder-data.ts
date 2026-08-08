import { supabase } from '@/lib/supabase';
import { buildCollectionCards, type RawInventoryItem, type RawInventoryLocation } from '@/services/collector-workspace';
import {
  buildPhysicalBinderState,
  createBinderSharePayload,
  revokeBinderSharePayload,
  type BinderShareRequest,
  type PhysicalBinderState,
  type RawPortfolioBinder,
  type RawPortfolioShare,
} from '@/services/physical-binder';
import { MOBILE_CANONICAL_SITE_URL } from '@/services/mobile-release-config';

export type MobilePhysicalBinderState = PhysicalBinderState & {
  userId: string;
  stale: boolean;
  unavailableReason?: string;
};

export async function loadMobilePhysicalBinders(): Promise<MobilePhysicalBinderState> {
  if (!supabase) throw new Error('Supabase binders are not configured.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in again to manage binders.');
  const userId = auth.user.id;
  const [locationsResult, itemsResult, bindersResult, sharesResult] = await Promise.all([
    supabase.from('inventory_locations').select('id, name, location_type, data').eq('user_id', userId).limit(500),
    supabase.from('inventory_items').select('id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data').eq('user_id', userId).limit(500),
    supabase.from('portfolio_binders').select('id, user_id, location_id, slug, title, description, cover_url, cover_color, accent_color, visibility, is_trade_binder').eq('user_id', userId).limit(200),
    supabase.from('portfolio_shares').select('id, token, resource_id, visibility, is_active, revoked_at, share_type').eq('user_id', userId).eq('is_active', true).is('revoked_at', null).limit(200),
  ]);
  if (locationsResult.error) throw new Error(`Binder locations are unavailable: ${locationsResult.error.message}`);
  if (itemsResult.error) throw new Error(`Binder cards are unavailable: ${itemsResult.error.message}`);
  const rawLocations = (locationsResult.data ?? []) as RawInventoryLocation[];
  const cards = buildCollectionCards({ items: (itemsResult.data ?? []) as RawInventoryItem[], locations: rawLocations });
  return {
    userId,
    stale: false,
    ...buildPhysicalBinderState({
      userId,
      cards,
      rawLocations,
      rawBinders: (bindersResult.data ?? []) as RawPortfolioBinder[],
      rawShares: (sharesResult.data ?? []) as RawPortfolioShare[],
    }),
  };
}

export async function createMobileBinderShare(request: BinderShareRequest) {
  const headers = await binderShareHeaders();
  const response = await fetch(`${MOBILE_CANONICAL_SITE_URL}/api/collector-portfolio/shares`, {
    method: 'POST',
    headers,
    body: JSON.stringify(createBinderSharePayload(request)),
  });
  const payload = await response.json().catch(() => null) as { url?: string; error?: string } | null;
  if (!response.ok) return { ok: false as const, error: payload?.error ?? 'Binder share link could not be created.' };
  return { ok: true as const, url: payload?.url ?? '' };
}

export async function revokeMobileBinderShare(token: string) {
  const headers = await binderShareHeaders();
  const response = await fetch(`${MOBILE_CANONICAL_SITE_URL}/api/collector-portfolio/shares`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify(revokeBinderSharePayload({ token })),
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) return { ok: false as const, error: payload?.error ?? 'Binder share link could not be revoked.' };
  return { ok: true as const };
}

async function binderShareHeaders() {
  if (!supabase) throw new Error('Supabase binders are not configured.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in again to share binders.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}
