import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";

export default function SellingListingsPage() {
  return <div className="min-h-[calc(100vh-72px)] bg-[var(--td-background-primary)] px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1500px]"><Link href="/dashboard/selling" className="inline-flex items-center gap-2 text-xs font-semibold text-td-muted hover:text-td-primary"><ArrowLeft className="h-3.5 w-3.5" /> Selling</Link><div className="mt-6 rounded-2xl border border-td-ink/[.08] bg-td-surface/70 p-8 text-center"><ClipboardList className="mx-auto h-8 w-8 text-td-accent-text" /><h1 className="mt-4 text-2xl font-semibold text-td-primary">Listing workstation</h1><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-td-secondary">Listing batches and candidates will appear here once the additive selling foundation is migrated locally. Physical inventory remains the source of truth.</p></div></div></div>;
}
