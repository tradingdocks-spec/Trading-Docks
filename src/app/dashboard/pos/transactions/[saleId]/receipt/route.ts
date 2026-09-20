import { posCommand } from '@/lib/pos/server';
import { renderReceipt } from '@/lib/pos/receipt';
export async function GET(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const result = await posCommand('receipt', { saleId });
  if (result.response) return result.response;
  if (!result.data?.receipt) return new Response('Receipt not found.', { status: 404 });
  return new Response(renderReceipt(result.data.receipt), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'" } });
}
