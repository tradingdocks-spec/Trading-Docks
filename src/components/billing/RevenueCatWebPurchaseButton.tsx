"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import type { BillingCycle } from "@/lib/membership-catalog";
import type { RevenueCatWebPurchasePlan } from "@/lib/revenuecat/web-billing";

export function RevenueCatWebPurchaseButton({
  plan,
  billing,
  label,
  featured = false,
}: {
  plan: RevenueCatWebPurchasePlan;
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
      const response = await fetch("/api/billing/revenuecat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing }),
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error || "RevenueCat checkout could not start.");
      }
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "RevenueCat checkout could not start.");
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
            ? "bg-gradient-to-b from-td-accent to-td-accent text-td-on-accent hover:brightness-110"
            : "border border-td-ink/[0.1] bg-td-ink/[0.04] text-td-on-accent group-hover:border-td-accent group-hover:bg-td-accent group-hover:text-td-on-accent group-hover:shadow-[0_10px_30px_rgb(var(--td-accent-rgb)/0.18)]"
        }`}
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {loading ? "Opening RevenueCat checkout..." : label}
      </button>
      {error ? <p className="mt-2 text-center text-xs text-td-danger">{error}</p> : null}
    </div>
  );
}
