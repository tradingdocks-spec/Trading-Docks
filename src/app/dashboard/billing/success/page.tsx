import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function BillingSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030a10] px-5 text-white">
      <section className="w-full max-w-lg rounded-[28px] border border-cyan-300/20 bg-[#07141d] p-8 text-center shadow-2xl">
        <CheckCircle2 className="mx-auto h-12 w-12 text-cyan-300" />
        <h1 className="mt-5 text-3xl font-semibold">Subscription confirmed</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          RevenueCat received your purchase. Your Trading Docks access updates automatically as the secure entitlement confirmation arrives.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-cyan-300 px-6 text-sm font-semibold text-[#001018]"
        >
          Open your workspace
        </Link>
      </section>
    </main>
  );
}
