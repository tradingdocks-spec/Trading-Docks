import { posCommand } from '@/lib/pos/server';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const action = params.get('action') ?? 'bootstrap';
  if (!['bootstrap', 'search', 'history', 'receipt', 'recover'].includes(action)) return Response.json({ error: 'Unknown POS action.' }, { status: 400 });
  const body = Object.fromEntries(params.entries());
  const result = await posCommand(action, body);
  return result.response ?? Response.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  // Count streamed bytes too; Content-Length alone is not a body limit.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'Request required.' }, { status: 400 });
  let size = 0; let raw = ''; const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 32768) { await reader.cancel(); return Response.json({ error: 'Cart is too large.' }, { status: 413 }); }
    raw += decoder.decode(value, { stream: true });
  }
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw + decoder.decode()); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!body || Array.isArray(body) || typeof body !== 'object' || !['setup', 'open', 'close', 'checkout', 'cancel'].includes(String(body.action))) return Response.json({ error: 'Unknown POS action.' }, { status: 400 });
  const { action, ...payload } = body;
  const result = await posCommand(String(action), payload);
  return result.response ?? Response.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
