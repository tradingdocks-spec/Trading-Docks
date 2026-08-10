import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadMobileAccountAccessSnapshot,
  resolveMobileAccountAccessSnapshot,
} from '../services/mobile-account-access.ts';

test('mobile account access uses backend subscription tier after RevenueCat or Stripe reconciliation', () => {
  const snapshot = resolveMobileAccountAccessSnapshot({
    userId: 'user-123',
    localAccountType: 'free',
    rows: {
      preferences: { preferences: { account_type: 'collector' } },
      subscription: { plan_id: 'store', status: 'active', provider: 'revenuecat' },
    },
  });

  assert.equal(snapshot.source, 'server');
  assert.equal(snapshot.membershipTier, 'store');
  assert.equal(snapshot.accountType, 'store');
  assert.equal(snapshot.billingStatus, 'active');
});

test('admin role alone does not grant paid mobile membership or workspace tabs', () => {
  const snapshot = resolveMobileAccountAccessSnapshot({
    userId: 'admin-123',
    localAccountType: 'free',
    rows: {
      role: { role: 'admin' },
      preferences: { preferences: { account_type: 'collector' } },
      subscription: { plan_id: 'free', status: 'free' },
    },
  });

  assert.equal(snapshot.membershipTier, 'free');
  assert.equal(snapshot.accountType, 'collector');
  assert.equal(snapshot.platformRole, 'admin');
  assert.equal(snapshot.hasFullPlatformAccess, false);
});

test('trusted owner keeps Free billing membership but receives full mobile platform access', () => {
  const snapshot = resolveMobileAccountAccessSnapshot({
    userId: 'owner-123',
    localAccountType: 'free',
    rows: {
      role: { role: 'owner' },
      preferences: { preferences: { account_type: 'collector' } },
      subscription: { plan_id: 'free', status: 'free' },
    },
  });

  assert.equal(snapshot.membershipTier, 'free');
  assert.equal(snapshot.accountType, 'collector');
  assert.equal(snapshot.platformRole, 'owner');
  assert.equal(snapshot.hasFullPlatformAccess, true);
});

test('paid billing fallback ignores canceled or suspended provider state', () => {
  const canceled = resolveMobileAccountAccessSnapshot({
    userId: 'user-123',
    localAccountType: 'seller',
    rows: {
      subscription: { plan_id: 'seller', status: 'canceled', provider: 'revenuecat' },
    },
  });

  const suspended = resolveMobileAccountAccessSnapshot({
    userId: 'user-123',
    localAccountType: 'store',
    rows: {
      subscription: { plan_id: 'store', status: 'suspended', provider: 'stripe' },
    },
  });

  assert.equal(canceled.membershipTier, 'free');
  assert.equal(canceled.accountType, 'seller');
  assert.equal(suspended.membershipTier, 'free');
  assert.equal(suspended.accountType, 'store');
});

test('query errors keep membership local-fallback visible without inventing paid access', () => {
  const snapshot = resolveMobileAccountAccessSnapshot({
    userId: 'user-123',
    localAccountType: 'collector',
    rows: {},
    queryErrors: ['billing_subscriptions lookup failed'],
  });

  assert.equal(snapshot.source, 'local_fallback');
  assert.equal(snapshot.membershipTier, 'free');
  assert.equal(snapshot.accountType, 'collector');
  assert.match(snapshot.warnings.join(','), /billing_subscriptions lookup failed/);
});

test('unavailable Supabase client keeps local account type but does not grant paid membership', async () => {
  const snapshot = await loadMobileAccountAccessSnapshot({
    client: null,
    userId: 'user-123',
    localAccountType: 'store',
  });

  assert.equal(snapshot.source, 'local_fallback');
  assert.equal(snapshot.accountType, 'store');
  assert.equal(snapshot.membershipTier, 'free');
  assert.equal(snapshot.billingStatus, 'free');
  assert.match(snapshot.warnings.join(','), /membership_requires_server_confirmation/);
});
