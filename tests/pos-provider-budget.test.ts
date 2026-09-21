import test from 'node:test';
import assert from 'node:assert/strict';
import { providerBudget } from '../src/lib/pos/provider-budget.ts';

test('provider requests proceed only after an affirmative committed budget', async () => {
  const calls: unknown[] = [];
  const allowed = await providerBudget({ rpc: async (name, args) => { calls.push({ name, args }); return { data: true, error: null }; } }, 'workspace', 'payment');
  assert.equal(allowed, null);
  assert.deepEqual(calls, [{ name: 'pos_provider_request_budget', args: { p_workspace_id: 'workspace', p_bucket: 'payment' } }]);
  for (const result of [{ data: false, error: null }, { data: null, error: { message: 'private database details' } }, { data: 'true', error: null }]) {
    const response = await providerBudget({ rpc: async () => result }, 'workspace', 'oauth');
    assert.equal(response?.status, 429);
    assert.equal(response?.headers.get('Retry-After'), '60');
    assert.ok(!(await response!.text()).includes('private database details'));
  }
});
