export async function paymentRequest<T>(
  path: string,
  body?: Record<string, unknown>,
  onThrottle?: (message: string) => void,
): Promise<T> {
  const request = {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store" as const,
  };
  let response = await fetch(`/api/pos/payments${path}`, request);
  if (response.status === 429) {
    onThrottle?.('Payment status checks are temporarily limited. Trading Docks will retry shortly.');
    const seconds = Number(response.headers.get('Retry-After') ?? '60');
    await new Promise(resolve => setTimeout(resolve, Number.isFinite(seconds) ? Math.min(60, Math.max(1, seconds)) * 1000 : 60000));
    // Exact same persisted request/key; never create a replacement payment.
    response = await fetch(`/api/pos/payments${path}`, request);
  }
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      Error(response.status === 429 ? 'Payment checks are still limited. Keep this payment open and check its status shortly; do not start another payment.' : result.error ?? "Payment status is being verified."),
      { code: result.code },
    );
  return result;
}
