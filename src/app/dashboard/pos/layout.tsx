import Link from 'next/link';
import { requireServerCapability } from '@/lib/platform/server-access';
import './pos.css';

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  await requireServerCapability('pos.sell');
  return <div className="pos-workspace"><header className="pos-heading"><div><span className="pos-eyebrow">TRADING DOCKS</span><h1>Point of sale</h1></div><nav aria-label="Point of sale"><Link href="/dashboard/pos">Register</Link><Link href="/dashboard/pos/transactions">Transactions</Link><Link href="/dashboard/pos/setup">Setup</Link></nav></header>{children}</div>;
}
