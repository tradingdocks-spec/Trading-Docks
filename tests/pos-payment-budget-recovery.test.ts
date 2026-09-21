import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentRequest } from '../src/lib/pos/payments/client.ts';
import { budgetedProvider } from '../src/lib/pos/payments/budgeted-provider.ts';
import { PaymentOrchestrator } from '../src/lib/pos/payments/orchestrator.ts';
import { MockPaymentProvider, type PaymentStore } from '../src/lib/pos/payments/provider.ts';
import type { Payment } from '../src/lib/pos/payments/domain.ts';

test('429 retries the exact persisted payment/refund request once after Retry-After', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const requests: RequestInit[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    requests.push(init);
    return requests.length === 1 ? Response.json({ code: 'POS_RATE_LIMIT' }, { status: 429, headers: { 'Retry-After': '60' } }) : Response.json({ id: 'same-attempt' });
  });
  const messages: string[] = [];
  const pending = paymentRequest('/payment/refunds', { key: 'retained-key', intent: { quantity: 1 } }, message => messages.push(message));
  await new Promise(setImmediate);
  assert.equal(requests.length, 1);
  t.mock.timers.tick(59000);
  assert.equal(requests.length, 1);
  t.mock.timers.tick(1000);
  assert.deepEqual(await pending, { id: 'same-attempt' });
  assert.deepEqual(requests[1], requests[0]);
  assert.deepEqual(messages, ['Payment status checks are temporarily limited. Trading Docks will retry shortly.']);
});

test('a continued throttle stops automatic retries and does not suggest a replacement payment', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ code: 'POS_RATE_LIMIT' }, { status: 429, headers: { 'Retry-After': '1' } }); });
  const pending = assert.rejects(paymentRequest('/id/check', {}), /do not start another payment/);
  await new Promise(setImmediate);
  t.mock.timers.tick(1000);
  await pending; assert.equal(calls, 2);
});

test('concurrent provider polling is bounded; confirmed sale finalization bypasses the exhausted outbound budget', async () => {
  let outbound = 0, budget = 0, finalized = 0;
  const payment = { id: 'one', provider: 'MOCK', status: 'UNKNOWN', saleState: 'PAYING' } as Payment;
  const store: PaymentStore = async <T>(action: string) => {
    if (action === 'provider_get') outbound++;
    if (action === 'finalize') { finalized++; payment.saleState = 'COMPLETED'; payment.saleId = 'single-sale'; }
    return { ...payment } as T;
  };
  const limited = budgetedProvider(new MockPaymentProvider(store, 'test'), async () => { if (++budget > 12) throw Error('POS_RATE_LIMIT'); });
  const service = new PaymentOrchestrator(store, 'test', { MOCK: limited });
  const checks = await Promise.allSettled(Array.from({ length: 30 }, () => service.check('one')));
  assert.equal(outbound, 12);
  assert.equal(checks.filter(r => r.status === 'rejected').length, 18);
  payment.status = 'SUCCEEDED';
  assert.equal((await service.check('one')).saleId, 'single-sale');
  await Promise.all(Array.from({ length: 30 }, () => service.check('one')));
  assert.equal(outbound, 12); assert.equal(finalized, 1);
});
