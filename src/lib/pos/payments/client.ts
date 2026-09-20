export async function paymentRequest<T>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`/api/pos/payments${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      Error(result.error ?? "Payment status is being verified."),
      { code: result.code },
    );
  return result;
}
