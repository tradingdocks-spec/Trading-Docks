import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function BillingSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-td-canvas px-5 text-td-primary">
      <section className="w-full max-w-lg rounded-[28px] border border-td-accent/20 bg-td-surface p-8 text-center shadow-2xl">
        <CheckCircle2 className="mx-auto h-12 w-12 text-td-accent-text" />
        <h1 className="mt-5 text-3xl font-semibold">Subscription confirmed</h1>
        <p className="mt-3 text-sm leading-6 text-td-secondary">
          RevenueCat received your purchase. Your Trading Docks access updates automatically as the secure entitlement confirmation arrives.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-td-accent px-6 text-sm font-semibold text-td-on-accent"
        >
          Open your workspace
        </Link>
      </section>
    </main>
  );
}
