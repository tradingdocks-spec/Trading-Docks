type BudgetClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: unknown;
  }>;
};

// The separate RPC commits even when a later provider request fails.
export async function providerBudget(
  client: BudgetClient,
  workspaceId: string,
  bucket: 'oauth' | 'device' | 'payment',
) {
  const { data, error } = await client.rpc('pos_provider_request_budget', {
    p_workspace_id: workspaceId,
    p_bucket: bucket,
  });
  if (error || data !== true) {
    return Response.json(
      { code: 'POS_RATE_LIMIT', error: 'Payment status checks are temporarily limited. Trading Docks will retry shortly.' },
      { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } },
    );
  }
  return null;
}
