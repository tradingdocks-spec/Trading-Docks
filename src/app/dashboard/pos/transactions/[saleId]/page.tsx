import Link from 'next/link';
import { notFound } from 'next/navigation';
import { posCommand } from '@/lib/pos/server';
import { money, type Receipt } from '@/lib/pos/domain';
export default async function Transaction({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const result = await posCommand('receipt', { saleId });
  if (result.response) return <p role="alert">This transaction is unavailable.</p>;
  const receipt = result.data?.receipt as Receipt | undefined;
  if (!receipt) notFound();
  return <section className="pos-detail"><h2>{receipt.number}</h2><p>{receipt.site} · {receipt.register} · Cash completed</p><p>{receipt.createdAt} · Operator {receipt.actorId}</p>{receipt.lines.map(l => <article key={l.itemId}><strong>{l.name}</strong><span>{l.quantity} × {money(l.unitPriceMinor)}</span><small>{[l.setCode,l.collectorNumber,l.condition,l.finish,l.language,l.locationId].filter(Boolean).join(' · ')}</small><span>{money(l.lineTotalMinor)}</span></article>)}<p>Subtotal {money(receipt.subtotalMinor)} · Discount {money(receipt.discountMinor)} · Tax {money(receipt.taxMinor)}</p><h3>Total {money(receipt.totalMinor)}</h3><p>Cash {money(receipt.cashMinor)} · Change {money(receipt.changeMinor)}</p><Link target="_blank" href={`/dashboard/pos/transactions/${saleId}/receipt`}>Print receipt →</Link><p>Refunds are not available in this phase. Preserve this transaction when recording any return through your existing store process.</p></section>;
}
