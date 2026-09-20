import Link from 'next/link';
import { posCommand } from '@/lib/pos/server';
import { money } from '@/lib/pos/domain';
type Sale = { id: string; receipt_number: string; created_at: string; total_minor: number };
export default async function Transactions({ searchParams }: { searchParams: Promise<{ before?: string; beforeId?: string }> }) {
  const { before, beforeId } = await searchParams;
  const result = await posCommand('history', { before: before ?? '', beforeId: beforeId ?? '' });
  if (result.response) return <p role="alert">Transaction history is unavailable.</p>;
  const sales = result.data as Sale[];
  return <><h2>Transactions</h2><p>Completed cash sales recorded by your account in this workspace.</p><div className="pos-history">{sales.map(s => <Link key={s.id} href={`/dashboard/pos/transactions/${s.id}`}><span><strong>{s.receipt_number}</strong><small>{new Date(s.created_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC · Cash · Completed</small></span><b>{money(s.total_minor)}</b></Link>)}</div>{!sales.length && <p>No completed sales in this period.</p>}{sales.length === 50 && <Link href={`/dashboard/pos/transactions?before=${encodeURIComponent(sales[49].created_at)}&beforeId=${sales[49].id}`}>Older transactions →</Link>}</>;
}
