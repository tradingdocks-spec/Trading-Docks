export async function posRead<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const response = await fetch(`/api/pos?${new URLSearchParams({ action, ...params })}`, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'POS is unavailable.');
  return data;
}
export async function posWrite<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error ?? 'POS is unavailable.'), { code: data.code });
  return data;
}
