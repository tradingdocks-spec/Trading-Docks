import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeRevenueCatWebhook,
  planMappingForRevenueCatProduct,
  providerEntitlementIsValid,
  providerStateFromRevenueCatEvent,
  resolveEffectiveMembership,
  verifyRevenueCatAuthorization,
} from '../../src/lib/revenuecat/reconciliation.ts';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-08-07T12:00:00.000Z');
const FUTURE = '2026-09-07T12:00:00.000Z';
const PAST = '2026-07-07T12:00:00.000Z';

function payload(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      id: 'event-1',
      type: 'INITIAL_PURCHASE',
      app_user_id: USER_ID,
      product_id: 'tradingdocks.collector.monthly',
      store: 'APP_STORE',
      transaction_id: 'tx-1',
      original_transaction_id: 'sub-1',
      purchased_at_ms: Date.parse('2026-08-07T11:00:00.000Z'),
      expiration_at_ms: Date.parse(FUTURE),
      environment: 'SANDBOX',
      will_renew: true,
      ...overrides,
    },
  };
}

test('authorized RevenueCat webhook accepts exact or bearer authorization', () => {
  assert.equal(verifyRevenueCatAuthorization('secret-value', 'secret-value'), true);
  assert.equal(verifyRevenueCatAuthorization('Bearer secret-value', 'secret-value'), true);
  assert.equal(verifyRevenueCatAuthorization('wrong', 'secret-value'), false);
  assert.equal(verifyRevenueCatAuthorization(null, 'secret-value'), false);
});

test('malformed RevenueCat event is rejected by normalization', () => {
  assert.equal(normalizeRevenueCatWebhook({}), null);
  assert.equal(normalizeRevenueCatWebhook(payload({ id: '' })), null);
  assert.equal(normalizeRevenueCatWebhook(payload({ app_user_id: '' })), null);
});

test('RevenueCat product mapping covers Collector, Seller, and Store', () => {
  assert.equal(planMappingForRevenueCatProduct('tradingdocks.collector.monthly')?.tier, 'collector');
  assert.equal(planMappingForRevenueCatProduct('tradingdocks.collector.yearly')?.billingCycle, 'annual');
  assert.equal(planMappingForRevenueCatProduct('tradingdocks.seller.monthly')?.tier, 'seller');
  assert.equal(planMappingForRevenueCatProduct('tradingdocks.seller.yearly')?.billingCycle, 'annual');
  assert.equal(planMappingForRevenueCatProduct('tradingdocks.store.monthly')?.tier, 'store');
  assert.equal(planMappingForRevenueCatProduct('tradingdocks.store.yearly')?.billingCycle, 'annual');
  assert.equal(planMappingForRevenueCatProduct('unknown.product'), null);
});

test('INITIAL_PURCHASE, RENEWAL, and UNCANCELLATION produce active provider state', () => {
  for (const type of ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION']) {
    const event = normalizeRevenueCatWebhook(payload({ id: `event-${type}`, type }));
    assert.ok(event);
    assert.equal(providerStateFromRevenueCatEvent(event, NOW)?.status, 'active');
  }
});

test('PRODUCT_CHANGE upgrades Collector to Seller then Seller to Store by product id', () => {
  const seller = normalizeRevenueCatWebhook(payload({
    type: 'PRODUCT_CHANGE',
    product_id: 'tradingdocks.seller.monthly',
  }));
  const store = normalizeRevenueCatWebhook(payload({
    type: 'PRODUCT_CHANGE',
    product_id: 'tradingdocks.store.yearly',
  }));

  assert.ok(seller);
  assert.ok(store);
  assert.equal(providerStateFromRevenueCatEvent(seller, NOW)?.planId, 'seller');
  assert.equal(providerStateFromRevenueCatEvent(store, NOW)?.planId, 'store');
});

test('CANCELLATION before expiration remains a valid entitlement but disables renewal', () => {
  const event = normalizeRevenueCatWebhook(payload({
    type: 'CANCELLATION',
    expiration_at_ms: Date.parse(FUTURE),
    will_renew: false,
  }));
  assert.ok(event);
  const state = providerStateFromRevenueCatEvent(event, NOW);

  assert.equal(state?.status, 'active');
  assert.equal(state?.cancelAtPeriodEnd, true);
  assert.equal(providerEntitlementIsValid({
    provider: 'apple',
    planId: 'collector',
    status: state?.status,
    currentPeriodEnd: state?.currentPeriodEnd,
  }, NOW), true);
});

test('EXPIRATION and BILLING_ISSUE classify provider state safely', () => {
  const expiredEvent = normalizeRevenueCatWebhook(payload({
    type: 'EXPIRATION',
    expiration_at_ms: Date.parse(PAST),
  }));
  const billingIssue = normalizeRevenueCatWebhook(payload({
    type: 'BILLING_ISSUE',
    expiration_at_ms: Date.parse(FUTURE),
  }));

  assert.ok(expiredEvent);
  assert.ok(billingIssue);
  assert.equal(providerStateFromRevenueCatEvent(expiredEvent, NOW)?.status, 'canceled');
  assert.equal(providerStateFromRevenueCatEvent(billingIssue, NOW)?.status, 'past_due');
});

test('unknown RevenueCat events are normalized without becoming actionable state', () => {
  const event = normalizeRevenueCatWebhook(payload({ type: 'TRANSFER' }));

  assert.ok(event);
  assert.equal(event.type, 'UNKNOWN');
});

test('missing app_user_id, invalid user id, or missing product prevents provider state', () => {
  assert.equal(normalizeRevenueCatWebhook(payload({ app_user_id: null })), null);

  const invalidUser = normalizeRevenueCatWebhook(payload({ app_user_id: 'not-a-uuid' }));
  const missingProduct = normalizeRevenueCatWebhook(payload({ product_id: null }));

  assert.ok(invalidUser);
  assert.ok(missingProduct);
  assert.equal(providerStateFromRevenueCatEvent(invalidUser, NOW), null);
  assert.equal(providerStateFromRevenueCatEvent(missingProduct, NOW), null);
});

test('Apple expiration does not downgrade an active Stripe Seller entitlement', () => {
  const resolution = resolveEffectiveMembership({
    now: NOW,
    providerEntitlements: [
      { provider: 'apple', planId: 'collector', status: 'canceled', currentPeriodEnd: PAST },
      { provider: 'stripe', planId: 'seller', status: 'active', currentPeriodEnd: FUTURE },
    ],
  });

  assert.equal(resolution.tier, 'seller');
  assert.equal(resolution.source, 'stripe');
});

test('Stripe expiration does not downgrade an active Apple Store entitlement', () => {
  const resolution = resolveEffectiveMembership({
    now: NOW,
    providerEntitlements: [
      { provider: 'stripe', planId: 'seller', status: 'canceled', currentPeriodEnd: PAST },
      { provider: 'apple', planId: 'store', status: 'active', currentPeriodEnd: FUTURE },
    ],
  });

  assert.equal(resolution.tier, 'store');
  assert.equal(resolution.source, 'apple');
});

test('manual admin override takes precedence when present', () => {
  const resolution = resolveEffectiveMembership({
    now: NOW,
    manualOverride: 'collector',
    providerEntitlements: [
      { provider: 'apple', planId: 'store', status: 'active', currentPeriodEnd: FUTURE },
    ],
  });

  assert.equal(resolution.tier, 'collector');
  assert.equal(resolution.source, 'manual');
});

test('no valid provider resolves to Free', () => {
  const resolution = resolveEffectiveMembership({
    now: NOW,
    providerEntitlements: [
      { provider: 'apple', planId: 'collector', status: 'canceled', currentPeriodEnd: PAST },
      { provider: 'stripe', planId: 'seller', status: 'incomplete', currentPeriodEnd: FUTURE },
    ],
  });

  assert.equal(resolution.tier, 'free');
  assert.equal(resolution.status, 'free');
});

test('duplicate webhook delivery is backed by event-id idempotency contract', () => {
  const first = normalizeRevenueCatWebhook(payload({ id: 'duplicate-event-id' }));
  const second = normalizeRevenueCatWebhook(payload({ id: 'duplicate-event-id' }));

  assert.ok(first);
  assert.ok(second);
  assert.equal(first.eventId, second.eventId);
});
