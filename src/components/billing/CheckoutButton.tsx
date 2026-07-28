"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import type { BillingCycle, PaidPlan } from "@/lib/stripe/plans";

export function CheckoutButton({
  plan,
  billing,
  label,
  featured = false,
}: {
  plan: PaidPlan;
  billing: BillingCycle;
  label: string;
  featured?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing }),
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not start.");
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not start.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={checkout}
        disabled={loading}
        className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:cursor-wait disabled:opacity-70 ${
          featured
            ? "bg-gradient-to-b from-cyan-300 to-sky-500 text-[#001018] hover:brightness-110"
            : "border border-white/[0.1] bg-white/[0.04] text-slate-100 group-hover:border-cyan-300 group-hover:bg-cyan-300 group-hover:text-[#001018] group-hover:shadow-[0_10px_30px_rgba(34,211,238,0.18)]"
        }`}
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {loading ? "Opening secure checkout…" : label}
      </button>
      {error && <p className="mt-2 text-center text-xs text-rose-300">{error}</p>}
    </div>
  );
}
